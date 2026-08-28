// /api/orders
// Public bootstrap + vehicle-order storage + server-side form e-mail delivery.
// Kept in one Vercel Function intentionally to stay within the Hobby function limit.

import crypto from 'node:crypto';
import { hasAdminSession } from '../lib/admin-session.js';
import { sendAdminMail, sendCustomerMail, smtpPublicStatus } from '../lib/mailer.js';

const SOURCES = new Set(['stock', 'custom']);
const STATUSES = new Set(['new', 'contacted', 'reserved', 'in_progress', 'ordered', 'closed', 'cancelled']);
const FORM_TYPES = new Set(['contact', 'finance', 'testdrive']);
const STORE_VERSION = 2;
const PUBLIC_BRANDS = ['Subaru', 'KGM', 'Jeep', 'Chery'];
const PUBLIC_FIELDS = ['znacka', 'palivo', 'typ_prevodovky', 'vybava_paket', 'karoseria', 'pohon', 'farba'];
const PUBLIC_TTL_MS = 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 12;
const MIN_FORM_AGE_MS = 700;

let publicWarmCache = { expiresAt: 0, value: null };
const rateBuckets = new Map();
const formSubmissionCache = new Map();

function clean(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanMultiline(value, max = 4000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max);
}

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanArray(value, maxItems = 80) {
  const source = Array.isArray(value) ? value : clean(value, 1800).split(/\s*(?:\+|\/|,|;|•|·)\s*/u);
  const out = [];
  for (const raw of source) {
    const item = clean(raw, 180);
    if (!item || out.some(existing => same(existing, item))) continue;
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function same(a, b) {
  return clean(a).localeCompare(clean(b), 'sk', { sensitivity: 'accent' }) === 0;
}

function unique(values) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const item = clean(value, 180);
    if (!item || out.some(existing => same(existing, item))) continue;
    out.push(item);
  }
  return out;
}

function normalizeFuelLabel(value) {
  const parts = cleanArray(value, 20);
  if (!parts.length) return '';
  const composite = parts.find(item => /^benz[ií]n\s+(?:HEV|MHEV|PHEV)$/iu.test(item));
  if (composite) return unique([composite, ...parts.filter(item => !same(item, composite) && !/^benz[ií]n$/iu.test(item))]).join(' ');
  const petrol = parts.findIndex(item => /^benz[ií]n$/iu.test(item));
  const hybrid = parts.findIndex(item => /^(?:HEV|MHEV|PHEV)$/iu.test(item));
  if (petrol >= 0 && hybrid >= 0) {
    return unique([`Benzín ${parts[hybrid].toUpperCase()}`, ...parts.filter((_, i) => i !== petrol && i !== hybrid)]).join(' ');
  }
  return parts.join(' ');
}

function normalizeSource(value) {
  const source = clean(value, 20).toLowerCase();
  return SOURCES.has(source) ? source : 'custom';
}

function normalizeStatus(value, fallback = 'new') {
  const status = clean(value, 30).toLowerCase();
  return STATUSES.has(status) ? status : fallback;
}

function positiveSafeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function safeEmail(value) {
  const email = clean(value, 180).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function encodeGithubPath(path) {
  return String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

function primaryGithub() {
  const token = clean(process.env.GITHUB_TOKEN, 1000);
  const repo = clean(process.env.GITHUB_REPO, 300);
  const branch = clean(process.env.GITHUB_BRANCH, 200);
  if (!token || !repo || !branch) {
    const error = new Error('Public data storage is not configured.');
    error.status = 503;
    throw error;
  }
  return { token, repo, branch };
}

function catalogGithub() {
  const base = primaryGithub();
  return {
    token: clean(process.env.DATA_GITHUB_TOKEN, 1000) || base.token,
    repo: clean(process.env.DATA_GITHUB_REPO, 300) || base.repo,
    branch: clean(process.env.DATA_GITHUB_BRANCH, 200) || base.branch,
  };
}

function orderGithub() {
  const token = clean(process.env.ORDERS_GITHUB_TOKEN, 1000);
  const repo = clean(process.env.ORDERS_GITHUB_REPO, 300);
  const branch = clean(process.env.ORDERS_GITHUB_BRANCH || 'main', 200);
  const path = clean(process.env.ORDER_REQUESTS_PATH || 'data/orders.enc.json', 500);
  if (!token || !repo || !branch || !path) {
    const error = new Error('Private order storage is not configured.');
    error.status = 503;
    throw error;
  }
  return { token, repo, branch, path };
}

async function readGithubJson(config, path, fallback) {
  const safePath = encodeGithubPath(path);
  const url = `https://api.github.com/repos/${config.repo}/contents/${safePath}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(config.token), cache: 'no-store' });
  if (response.status === 404) return { value: fallback, sha: null };
  if (!response.ok) {
    const error = new Error(`Storage read failed (${response.status}).`);
    error.status = response.status >= 500 ? 503 : response.status;
    throw error;
  }
  const payload = await response.json();
  if (!payload || Array.isArray(payload) || !payload.content) return { value: fallback, sha: payload?.sha || null };
  const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
  return { value: JSON.parse(decoded || 'null') ?? fallback, sha: payload.sha || null };
}

async function putGithubText(config, path, text, sha, message) {
  const safePath = encodeGithubPath(path);
  const url = `https://api.github.com/repos/${config.repo}/contents/${safePath}`;
  const body = {
    message,
    branch: config.branch,
    content: Buffer.from(text, 'utf8').toString('base64'),
  };
  if (sha) body.sha = sha;
  const response = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(config.token),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`Storage write failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function encryptionKey() {
  const raw = String(process.env.ORDERS_ENCRYPTION_KEY || '').trim();
  let key = Buffer.alloc(0);
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else if (raw) {
    try { key = Buffer.from(raw, 'base64'); } catch { key = Buffer.alloc(0); }
  }
  if (key.length !== 32) {
    const error = new Error('ORDERS_ENCRYPTION_KEY must contain exactly 32 bytes (base64 or 64 hex chars).');
    error.status = 503;
    throw error;
  }
  return key;
}

function encryptStore(store) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(store), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    version: 1,
    alg: 'A256GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }, null, 2) + '\n';
}

function decryptStore(payload) {
  if (payload && typeof payload === 'object' && payload.alg === 'A256GCM') {
    const iv = Buffer.from(String(payload.iv || ''), 'base64');
    const tag = Buffer.from(String(payload.tag || ''), 'base64');
    const data = Buffer.from(String(payload.data || ''), 'base64');
    if (iv.length !== 12 || tag.length !== 16 || !data.length) throw new Error('Encrypted order store is invalid.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
  }

  if (String(process.env.ALLOW_PLAINTEXT_ORDER_MIGRATION || '').toLowerCase() === 'true') return payload;
  const error = new Error('Order store is not encrypted. Enable one-time migration explicitly if needed.');
  error.status = 503;
  throw error;
}

function emptyStore() {
  return { version: STORE_VERSION, nextOrderNumber: 1, orders: [] };
}

function normalizeStore(payload) {
  let orders = [];
  let requestedNext = null;
  if (Array.isArray(payload)) orders = payload;
  else if (payload && typeof payload === 'object' && Array.isArray(payload.orders)) {
    orders = payload.orders;
    requestedNext = positiveSafeInteger(payload.nextOrderNumber);
  } else if (payload == null) {
    return emptyStore();
  } else {
    throw new Error('Unsupported order store format.');
  }
  let highest = 0;
  for (const order of orders) highest = Math.max(highest, positiveSafeInteger(order?.orderNumber) || 0);
  return {
    version: STORE_VERSION,
    nextOrderNumber: Math.max(requestedNext || 1, highest + 1),
    orders: [...orders],
  };
}

async function readOrderStore() {
  const config = orderGithub();
  const safePath = encodeGithubPath(config.path);
  const url = `https://api.github.com/repos/${config.repo}/contents/${safePath}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(config.token), cache: 'no-store' });
  if (response.status === 404) return { store: emptyStore(), sha: null, config };
  if (!response.ok) {
    const error = new Error(`Private order storage read failed (${response.status}).`);
    error.status = response.status >= 500 ? 503 : response.status;
    throw error;
  }
  const file = await response.json();
  const decoded = Buffer.from(file.content || '', 'base64').toString('utf8');
  const parsed = JSON.parse(decoded || '{}');
  return { store: normalizeStore(decryptStore(parsed)), sha: file.sha || null, config };
}

function isConflict(error) {
  return error?.status === 409 || /409|Conflict/i.test(String(error?.message || ''));
}

async function mutateOrders(mutator, message) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { store, sha, config } = await readOrderStore();
    const draft = { ...store, orders: [...store.orders] };
    const next = normalizeStore(mutator(draft));
    try {
      await putGithubText(config, config.path, encryptStore(next), sha, message);
      return next;
    } catch (error) {
      if (attempt < 4 && isConflict(error)) continue;
      throw error;
    }
  }
  throw new Error('Order storage update failed.');
}

function normalizeVehicle(vehicle = {}) {
  const v = vehicle && typeof vehicle === 'object' && !Array.isArray(vehicle) ? vehicle : {};
  return {
    stockCarId: clean(v.stockCarId || v.id, 120),
    stockUrl: clean(v.stockUrl, 700),
    znacka: clean(v.znacka, 80),
    model: clean(v.model, 120),
    rok: numberOrNull(v.rok),
    palivo: normalizeFuelLabel(v.palivo),
    typ_prevodovky: clean(v.typ_prevodovky, 80),
    prevodovka: clean(v.prevodovka, 160),
    vybava_paket: cleanArray(v.vybava_paket, 20).join(' + '),
    karoseria: clean(v.karoseria, 100),
    pohon: cleanArray(v.pohon, 20).join(' + '),
    farba: clean(v.farba, 120),
    metaliza: bool(v.metaliza),
    objem: numberOrNull(v.objem),
    vykon: numberOrNull(v.vykon),
    najazdene: numberOrNull(v.najazdene),
    stara_cena: clean(v.stara_cena, 80),
    nova_cena: clean(v.nova_cena, 80),
    obrazok: clean(v.obrazok || v.titulka, 700),
    vybava: cleanArray(v.vybava, 120),
  };
}

function normalizeCustomer(customer = {}) {
  const c = customer && typeof customer === 'object' && !Array.isArray(customer) ? customer : {};
  return {
    name: clean(c.name, 120),
    email: safeEmail(c.email),
    phone: clean(c.phone, 80),
    company: clean(c.company, 160),
    preferredContact: clean(c.preferredContact, 80),
  };
}

function normalizePreferences(preferences = {}, previousPreferences = null) {
  const p = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  const normalized = {
    deliveryTime: clean(p.deliveryTime, 120),
    financing: clean(p.financing, 120),
    tradeIn: clean(p.tradeIn, 200),
    extraEquipmentNote: cleanMultiline(p.extraEquipmentNote, 1500),
    note: cleanMultiline(p.note, 3000),
  };
  const legacyBudget = clean(previousPreferences?.budget, 120);
  if (legacyBudget) normalized.budget = legacyBudget;
  return normalized;
}

function orderId() {
  return `order_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function normalizeIncomingOrder(body, previous = null) {
  const now = new Date().toISOString();
  const prevHistory = Array.isArray(previous?.history) ? previous.history : [];
  return {
    ...(previous || {}),
    id: clean(previous?.id || body?.id, 120) || orderId(),
    submissionId: clean(previous?.submissionId || body?.submissionId, 120),
    source: normalizeSource(body?.source ?? previous?.source),
    status: normalizeStatus(body?.status ?? previous?.status, previous?.status || 'new'),
    archived: body?.archived === undefined ? !!previous?.archived : bool(body.archived),
    customer: normalizeCustomer(body?.customer ?? previous?.customer),
    vehicle: normalizeVehicle(body?.vehicle ?? previous?.vehicle),
    preferences: normalizePreferences(body?.preferences ?? previous?.preferences, previous?.preferences),
    consent: body?.consent === undefined ? !!previous?.consent : bool(body.consent),
    page: clean(body?.page ?? previous?.page, 700),
    userAgent: clean(body?.userAgent ?? previous?.userAgent, 500),
    employeeNote: cleanMultiline(body?.employeeNote ?? previous?.employeeNote, 3000),
    assignedTo: clean(body?.assignedTo ?? previous?.assignedTo, 120),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    history: prevHistory.length ? prevHistory : [{ status: 'new', at: now, note: 'Vytvorené cez web' }],
  };
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

function enrichCarIds(cars) {
  const list = Array.isArray(cars) ? cars : [];
  const used = new Set(list.map(car => clean(car?.id, 120)).filter(Boolean));
  const counts = new Map();
  return list.map(car => {
    const existing = clean(car?.id, 120);
    if (existing) return { ...car, __resolvedId: existing };
    const base = slugify(`${car?.znacka || ''}-${car?.model || ''}-${car?.rok ?? ''}`) || 'auto';
    let id = base;
    let n = Math.max(counts.get(base) || 1, 1);
    while (used.has(id)) { n += 1; id = `${base}-${n}`; }
    counts.set(base, n);
    used.add(id);
    return { ...car, __resolvedId: id };
  });
}

async function readCatalogRaw() {
  const { value } = await readGithubJson(catalogGithub(), process.env.DATA_PATH || 'data/auta.json', []);
  return Array.isArray(value) ? value : [];
}

async function readParameterOptions() {
  const { value } = await readGithubJson(catalogGithub(), process.env.OPTIONS_PATH || 'data/parametre.json', { fields: {}, models: {} });
  return value && typeof value === 'object' && !Array.isArray(value) ? value : { fields: {}, models: {} };
}

function publicOptions(optionsRaw, cars) {
  const sourceFields = optionsRaw?.fields && typeof optionsRaw.fields === 'object' ? optionsRaw.fields : {};
  const sourceModels = optionsRaw?.models && typeof optionsRaw.models === 'object' ? optionsRaw.models : {};
  const fields = {};
  PUBLIC_FIELDS.forEach(name => {
    fields[name] = name === 'znacka'
      ? [...PUBLIC_BRANDS]
      : name === 'palivo'
        ? unique((Array.isArray(sourceFields[name]) ? sourceFields[name] : []).map(normalizeFuelLabel).filter(Boolean))
        : unique(sourceFields[name]);
  });

  const models = {};
  PUBLIC_BRANDS.forEach(brand => {
    const key = Object.keys(sourceModels).find(item => same(item, brand));
    models[brand] = unique(key ? sourceModels[key] : []);
  });
  for (const car of Array.isArray(cars) ? cars : []) {
    const brand = PUBLIC_BRANDS.find(item => same(item, car?.znacka));
    const model = clean(car?.model, 120);
    if (brand && model && !models[brand].some(item => same(item, model))) models[brand].push(model);
  }

  const engineVolumes = unique((cars || []).map(car => numberOrNull(car?.objem)).filter(v => v !== null).map(String)).map(Number).sort((a, b) => a - b);
  const powers = unique((cars || []).map(car => numberOrNull(car?.vykon)).filter(v => v !== null).map(String)).map(Number).sort((a, b) => a - b);
  return { version: 4, fields, models, numericOptions: { engineVolumes, powers } };
}

async function getPublicBootstrap() {
  if (publicWarmCache.value && publicWarmCache.expiresAt > Date.now()) return publicWarmCache.value;
  const primary = primaryGithub();
  const [carsRaw, optionsRaw, promosResult] = await Promise.all([
    readCatalogRaw(),
    readParameterOptions(),
    readGithubJson(primary, process.env.PROMOS_PATH || 'data/akcie.json', []),
  ]);
  const visibleCars = carsRaw.filter(car => car && car.skryte !== true).map(car => ({
    ...car,
    palivo: cleanArray(car.palivo, 20),
  }));
  const payload = {
    version: 2,
    cars: visibleCars,
    orderOptions: publicOptions(optionsRaw, carsRaw),
    promos: (Array.isArray(promosResult.value) ? promosResult.value : []).filter(item => item && item.skryte !== true),
  };
  publicWarmCache = { expiresAt: Date.now() + PUBLIC_TTL_MS, value: payload };
  return payload;
}

function validateOrderBasics(order) {
  if (!order.customer.name) throw Object.assign(new Error('Chýba meno zákazníka.'), { status: 400 });
  if (!order.customer.email) throw Object.assign(new Error('Chýba platný e-mail zákazníka.'), { status: 400 });
  if (!order.customer.phone) throw Object.assign(new Error('Chýba telefón zákazníka.'), { status: 400 });
  if (!order.consent) throw Object.assign(new Error('Chýba súhlas so spracovaním údajov.'), { status: 400 });
  if (!order.submissionId || order.submissionId.length < 8) throw Object.assign(new Error('Neplatný identifikátor odoslania.'), { status: 400 });
}

async function serverValidateVehicle(order) {
  const cars = enrichCarIds(await readCatalogRaw());
  if (order.source === 'stock') {
    const wanted = clean(order.vehicle.stockCarId, 120);
    const car = cars.find(item => item && item.skryte !== true && clean(item.__resolvedId || item.id, 120) === wanted);
    if (!car) throw Object.assign(new Error('Vybrané skladové vozidlo už nie je dostupné.'), { status: 400 });
    return {
      ...order,
      vehicle: normalizeVehicle({
        ...car,
        stockCarId: clean(car.__resolvedId || car.id, 120),
        stockUrl: `/auta/${encodeURIComponent(clean(car.__resolvedId || car.id, 120))}`,
      }),
    };
  }

  const brand = PUBLIC_BRANDS.find(item => same(item, order.vehicle.znacka));
  if (!brand) throw Object.assign(new Error('Neplatná značka vozidla.'), { status: 400 });
  const options = publicOptions(await readParameterOptions(), cars);
  const allowedModels = options.models[brand] || [];
  if (!allowedModels.some(model => same(model, order.vehicle.model))) {
    throw Object.assign(new Error('Vybraný model už nie je dostupný.'), { status: 400 });
  }
  order.vehicle.znacka = brand;
  order.vehicle.model = allowedModels.find(model => same(model, order.vehicle.model)) || order.vehicle.model;
  order.vehicle.stockCarId = '';
  order.vehicle.stockUrl = '';
  order.vehicle.stara_cena = '';
  order.vehicle.nova_cena = '';
  order.vehicle.najazdene = null;
  return order;
}

function requestIp(req) {
  return clean(String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0], 100) || 'unknown';
}

function rateKey(req, scope) {
  return crypto.createHash('sha256').update(`${scope}|${requestIp(req)}`).digest('hex').slice(0, 24);
}

function rateLimit(req, scope) {
  const now = Date.now();
  const key = rateKey(req, scope);
  const previous = rateBuckets.get(key);
  const bucket = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + RATE_WINDOW_MS }
    : previous;
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 500) {
    for (const [entryKey, entry] of rateBuckets) if (entry.resetAt <= now) rateBuckets.delete(entryKey);
  }
  return bucket.count <= RATE_MAX;
}

function allowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map(v => v.trim()).filter(Boolean);
  return new Set(configured.length ? configured : [
    'https://ppauto.sk',
    'https://www.ppauto.sk',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
}

function verifyPublicOrigin(req) {
  const origin = clean(req.headers.origin, 300);
  if (!origin) return process.env.NODE_ENV !== 'production';
  return allowedOrigins().has(origin);
}

function suspiciousSubmission(body) {
  if (clean(body?.website, 200)) return 'honeypot';
  const started = Number(body?.formStartedAt);
  if (Number.isFinite(started) && started > 0 && Date.now() - started < MIN_FORM_AGE_MS) return 'too-fast';
  return '';
}

function fakeSuccess(res) {
  return res.status(200).json({ ok: true });
}

function formatOrderText(order) {
  const v = order.vehicle || {};
  const c = order.customer || {};
  const p = order.preferences || {};
  return [
    `Nová online objednávková požiadavka #${order.orderNumber}`,
    `Typ: ${order.source === 'stock' ? 'Skladové vozidlo' : 'Individuálna konfigurácia'}`,
    '',
    `Zákazník: ${c.name}`,
    `E-mail: ${c.email}`,
    `Telefón: ${c.phone}`,
    c.company ? `Firma: ${c.company}` : '',
    c.preferredContact ? `Preferovaný kontakt: ${c.preferredContact}` : '',
    '',
    `Vozidlo: ${v.znacka} ${v.model}`,
    v.rok ? `Rok: ${v.rok}` : '',
    v.palivo ? `Palivo: ${v.palivo}` : '',
    v.typ_prevodovky ? `Prevodovka: ${v.typ_prevodovky}` : '',
    v.vybava_paket ? `Výbava/paket: ${v.vybava_paket}` : '',
    v.karoseria ? `Karoséria: ${v.karoseria}` : '',
    v.pohon ? `Pohon: ${v.pohon}` : '',
    v.objem !== null ? `Objem: ${v.objem} cm³` : '',
    v.vykon !== null ? `Výkon: ${v.vykon} kW` : '',
    v.farba ? `Farba: ${v.farba}${v.metaliza ? ' (metalíza)' : ''}` : '',
    v.najazdene !== null ? `Najazdené: ${v.najazdene} km` : '',
    v.nova_cena ? `Cena: ${v.nova_cena}` : v.stara_cena ? `Cena: ${v.stara_cena}` : '',
    '',
    p.deliveryTime ? `Preferovaný termín: ${p.deliveryTime}` : '',
    p.financing ? `Financovanie: ${p.financing}` : '',
    p.tradeIn ? `Protiúčet: ${p.tradeIn}` : '',
    p.extraEquipmentNote ? `Ďalšia konfigurácia: ${p.extraEquipmentNote}` : '',
    p.note ? `Poznámka: ${p.note}` : '',
    '',
    `Stránka: ${order.page || '—'}`,
  ].filter(Boolean).join('\n');
}

async function sendOrderNotifications(order) {
  const reference = `#${order.orderNumber}`;
  const adminText = formatOrderText(order);
  const customerText = [
    `Dobrý deň ${order.customer.name},`,
    '',
    `ďakujeme za vašu online objednávkovú požiadavku ${reference}.`,
    `Vozidlo: ${order.vehicle.znacka} ${order.vehicle.model}.`,
    '',
    'Požiadavka je nezáväzná. Náš predajca vás bude kontaktovať a potvrdí dostupnosť, cenu a ďalší postup.',
    '',
    'PP AUTO s.r.o.',
  ].join('\n');

  const [adminResult, customerResult] = await Promise.allSettled([
    sendAdminMail({
      kind: 'orders',
      subject: `Nová objednávka ${reference} – ${order.vehicle.znacka} ${order.vehicle.model}`,
      text: adminText,
      replyTo: order.customer.email,
    }),
    sendCustomerMail({
      to: order.customer.email,
      subject: `PP AUTO – potvrdenie požiadavky ${reference}`,
      text: customerText,
    }),
  ]);

  return {
    adminSent: adminResult.status === 'fulfilled' && adminResult.value?.sent === true,
    customerSent: customerResult.status === 'fulfilled' && customerResult.value?.sent === true,
  };
}

function formData(body) {
  const source = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  return {
    name: clean(source.name || source.meno, 120),
    email: safeEmail(source.email),
    phone: clean(source.phone || source.telefon, 80),
    message: cleanMultiline(source.message || source.sprava, 5000),
    brand: clean(source.brand || source.znacka, 80),
    model: clean(source.model, 120),
    date: clean(source.date || source.datum, 80),
    slot: clean(source.slot || source.cas_dna || source.cas_okno, 120),
    time: clean(source.time || source.konkretny_cas || source.cas, 80),
    note: cleanMultiline(source.note || source.poznamka, 3000),
    carTitle: clean(source.carTitle || source.car_title || source.auto_nazov, 200),
    carId: clean(source.carId || source.car_id || source.auto_id, 120),
    carUrl: clean(source.carUrl || source.car_url || source.auto_url, 700),
    calcSummary: cleanMultiline(source.calcSummary, 2500),
  };
}

function formMailText(type, data, page) {
  const title = type === 'contact' ? 'Kontaktný formulár' : type === 'finance' ? 'Dopyt na financovanie' : 'Žiadosť o testovaciu jazdu';
  return [
    title,
    '------------------------------',
    `Meno: ${data.name}`,
    `E-mail: ${data.email}`,
    data.phone ? `Telefón: ${data.phone}` : '',
    data.brand ? `Značka: ${data.brand}` : '',
    data.model ? `Model: ${data.model}` : '',
    data.carTitle ? `Vozidlo: ${data.carTitle}` : '',
    data.carId ? `ID vozidla: ${data.carId}` : '',
    data.carUrl ? `Vozidlo URL: ${data.carUrl}` : '',
    data.date ? `Dátum: ${data.date}` : '',
    data.slot ? `Časť dňa: ${data.slot}` : '',
    data.time ? `Čas: ${data.time}` : '',
    data.calcSummary ? `\nKalkulácia:\n${data.calcSummary}` : '',
    data.message ? `\nSpráva:\n${data.message}` : '',
    data.note ? `\nPoznámka:\n${data.note}` : '',
    `\nStránka: ${clean(page, 700) || '—'}`,
  ].filter(Boolean).join('\n');
}

async function handlePublicForm(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!verifyPublicOrigin(req)) return res.status(403).json({ error: 'Request origin is not allowed.' });
  if (!rateLimit(req, 'form')) return res.status(429).json({ error: 'Príliš veľa požiadaviek. Skúste to neskôr.' });
  if (suspiciousSubmission(req.body)) return fakeSuccess(res);

  const type = clean(req.body?.type, 30).toLowerCase();
  if (!FORM_TYPES.has(type)) return res.status(400).json({ error: 'Neplatný typ formulára.' });
  const submissionId = clean(req.body?.submissionId, 120);
  if (submissionId && formSubmissionCache.has(submissionId)) return res.status(200).json(formSubmissionCache.get(submissionId));

  const data = formData(req.body);
  if (!data.name || !data.email) return res.status(400).json({ error: 'Vyplňte meno a platný e-mail.' });
  if (type === 'contact' && !data.message) return res.status(400).json({ error: 'Napíšte správu.' });
  if (type === 'testdrive' && (!data.brand && !data.carTitle)) return res.status(400).json({ error: 'Vyberte vozidlo.' });

  const kind = type;
  const label = type === 'contact' ? 'kontaktný formulár' : type === 'finance' ? 'financovanie' : 'testovaciu jazdu';
  const adminText = formMailText(type, data, req.body?.page);
  const customerText = [
    `Dobrý deň ${data.name},`,
    '',
    `ďakujeme, prijali sme vašu požiadavku (${label}).`,
    'Ozveme sa vám čo najskôr.',
    '',
    'PP AUTO s.r.o.',
  ].join('\n');

  let adminSent = false;
  let customerSent = false;
  try {
    const adminResult = await sendAdminMail({
      kind,
      subject: `PP AUTO – ${label} – ${data.name}`,
      text: adminText,
      replyTo: data.email,
    });
    adminSent = adminResult?.sent === true;
    if (!adminSent) throw new Error('Admin mail was not sent.');

    try {
      const customerResult = await sendCustomerMail({
        to: data.email,
        subject: `PP AUTO – potvrdenie: ${label}`,
        text: customerText,
      });
      customerSent = customerResult?.sent === true;
    } catch (error) {
      console.warn('Customer confirmation failed:', error?.code || error?.message || 'mail error');
    }
  } catch (error) {
    console.error('Form delivery failed:', error?.code || error?.message || 'mail error');
    return res.status(503).json({ error: 'Správu sa nepodarilo odoslať. Skúste to, prosím, znova.' });
  }

  const result = { ok: true, notifications: { adminSent, customerSent } };
  if (submissionId) {
    formSubmissionCache.set(submissionId, result);
    if (formSubmissionCache.size > 300) formSubmissionCache.delete(formSubmissionCache.keys().next().value);
  }
  return res.status(200).json(result);
}

function findOrderIndex(orders, query = {}) {
  const rawIndex = String(query.index ?? '').trim();
  if (/^(0|[1-9]\d*)$/.test(rawIndex)) return Number(rawIndex);
  const id = clean(query.id, 120);
  return id ? orders.findIndex(order => clean(order?.id, 120) === id) : -1;
}

export default async function handler(req, res) {
  const mode = clean(req.query?.mode, 40).toLowerCase();
  const bootstrap = (req.method === 'GET' || req.method === 'HEAD') && mode === 'bootstrap';
  res.setHeader('Cache-Control', bootstrap
    ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
    : 'private, no-store, max-age=0, must-revalidate');

  try {
    if (bootstrap) {
      const payload = await getPublicBootstrap();
      res.setHeader('X-PP-Mail', smtpPublicStatus().configured ? 'configured' : 'not-configured');
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).json(payload);
    }

    if (mode === 'form') return handlePublicForm(req, res);

    const admin = hasAdminSession(req);

    if (req.method === 'GET') {
      if (!admin) return res.status(401).json({ error: 'Unauthorized' });
      const { store } = await readOrderStore();
      const archivedOnly = String(req.query?.archived_only || '') === '1';
      const includeArchived = String(req.query?.include_archived || '') === '1';
      const visible = archivedOnly
        ? store.orders.filter(order => order?.archived === true)
        : includeArchived
          ? store.orders
          : store.orders.filter(order => order?.archived !== true);
      return res.status(200).json(visible);
    }

    if (req.method === 'POST') {
      if (!verifyPublicOrigin(req)) return res.status(403).json({ error: 'Request origin is not allowed.' });
      if (!rateLimit(req, 'order')) return res.status(429).json({ error: 'Príliš veľa požiadaviek. Skúste to neskôr.' });
      if (suspiciousSubmission(req.body)) return fakeSuccess(res);

      let order = normalizeIncomingOrder({
        ...req.body,
        userAgent: req.headers['user-agent'],
      });
      order.status = 'new';
      order.archived = false;
      order.employeeNote = '';
      order.assignedTo = '';
      order.history = [{ status: 'new', at: order.createdAt, note: 'Vytvorené cez web' }];
      validateOrderBasics(order);
      order = await serverValidateVehicle(order);

      let duplicate = null;
      let createdOrder = null;
      await mutateOrders(store => {
        duplicate = store.orders.find(item => clean(item?.submissionId, 120) === order.submissionId) || null;
        if (duplicate) return store;
        const number = positiveSafeInteger(store.nextOrderNumber);
        if (!number || number >= Number.MAX_SAFE_INTEGER) throw new Error('Nie je možné prideliť ďalšie číslo objednávky.');
        createdOrder = { ...order, orderNumber: number };
        store.nextOrderNumber = number + 1;
        store.orders.unshift(createdOrder);
        return store;
      }, `chore(orders): add ${order.source} order ${order.id}`);

      if (duplicate) {
        return res.status(200).json({ ok: true, id: duplicate.id, orderNumber: duplicate.orderNumber, duplicate: true });
      }

      let notifications = { adminSent: false, customerSent: false };
      try { notifications = await sendOrderNotifications(createdOrder); }
      catch (error) { console.error('Order notification failed:', error?.code || error?.message || 'mail error'); }

      return res.status(201).json({
        ok: true,
        id: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        notifications,
      });
    }

    if (req.method === 'PUT') {
      if (!admin) return res.status(401).json({ error: 'Unauthorized' });
      let updatedOrder = null;
      await mutateOrders(store => {
        const index = findOrderIndex(store.orders, req.query);
        if (index < 0 || index >= store.orders.length) throw Object.assign(new Error('Objednávka nebola nájdená.'), { status: 404 });
        const previous = store.orders[index] || {};
        const next = normalizeIncomingOrder(req.body || {}, previous);
        const previousStatus = normalizeStatus(previous.status, 'new');
        if (next.status !== previousStatus) {
          next.history = [
            ...(Array.isArray(previous.history) ? previous.history : []),
            { status: next.status, at: next.updatedAt, note: clean(req.body?.historyNote, 300) || 'Zmena stavu v admin paneli' },
          ];
        }
        updatedOrder = next;
        store.orders[index] = next;
        return store;
      }, `chore(orders): update order ${clean(req.query?.id || req.query?.index, 120)}`);
      return res.status(200).json({ ok: true, order: updatedOrder });
    }

    if (req.method === 'DELETE') {
      if (!admin) return res.status(401).json({ error: 'Unauthorized' });
      await mutateOrders(store => {
        const index = findOrderIndex(store.orders, req.query);
        if (index < 0 || index >= store.orders.length) throw Object.assign(new Error('Objednávka nebola nájdená.'), { status: 404 });
        store.orders.splice(index, 1);
        return store;
      }, `chore(orders): delete order ${clean(req.query?.id || req.query?.index, 120)}`);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error(error?.code || error?.message || error);
    return res.status(status).json({
      error: status >= 500 ? 'Služba je dočasne nedostupná.' : (error?.message || 'Bad Request'),
    });
  }
}
