// /api/orders
// Public bootstrap + vehicle-order storage + server-side form e-mail delivery.
// Kept in one Vercel Function intentionally to stay within the Hobby function limit.

import crypto from 'node:crypto';
import { hasAdminSession } from '../lib/admin-session.js';
import { renderAdminRequestEmail, renderCustomerConfirmationEmail } from '../lib/email-templates.js';
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

function textBlock(title, lines) {
  const visible = (Array.isArray(lines) ? lines : [])
    .map(line => cleanMultiline(line, 30000))
    .filter(Boolean);
  return visible.length ? [title, ...visible].join('\n') : '';
}

function formatDateTime(value) {
  const raw = clean(value, 120);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat('sk-SK', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Bratislava',
    }).format(parsed);
  } catch {
    return raw;
  }
}

function formatDateOnly(value) {
  const raw = clean(value, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat('sk-SK', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(parsed);
  } catch {
    return raw;
  }
}

function numberWithUnit(value, unit) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  const formatted = Number.isFinite(number)
    ? new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 }).format(number)
    : clean(value, 100);
  return `${formatted} ${unit}`;
}

function vehicleTitle(vehicle = {}) {
  return [clean(vehicle.znacka, 80), clean(vehicle.model, 120)].filter(Boolean).join(' ') || 'Vozidlo';
}

function publicVehicleUrl(value) {
  const raw = clean(value, 700);
  return raw.startsWith('/') ? `https://ppauto.sk${raw}` : raw;
}

function orderVehicleItems(order) {
  const v = order.vehicle || {};
  return [
    { label: 'Vozidlo', value: vehicleTitle(v) },
    { label: 'ID skladového vozidla', value: v.stockCarId },
    { label: 'Detail vozidla', value: publicVehicleUrl(v.stockUrl) },
    { label: 'Značka', value: v.znacka },
    { label: 'Model', value: v.model },
    { label: 'Rok', value: v.rok ?? '' },
    { label: 'Palivo', value: v.palivo },
    { label: 'Typ prevodovky', value: v.typ_prevodovky },
    { label: 'Prevodovka – detail', value: v.prevodovka },
    { label: 'Výbava / paket', value: v.vybava_paket },
    { label: 'Karoséria', value: v.karoseria },
    { label: 'Pohon', value: v.pohon },
    { label: 'Farba', value: v.farba },
    { label: 'Metalíza', value: v.metaliza ? 'Áno' : 'Nie' },
    { label: 'Objem motora', value: numberWithUnit(v.objem, 'cm³') },
    { label: 'Výkon', value: numberWithUnit(v.vykon, 'kW') },
    { label: 'Najazdené', value: numberWithUnit(v.najazdene, 'km') },
    { label: v.nova_cena ? 'Pôvodná cena' : 'Cena', value: v.stara_cena },
    { label: 'Akciová cena', value: v.nova_cena },
    { label: 'Obrázok', value: v.obrazok },
  ];
}

function orderPreferenceItems(order) {
  const p = order.preferences || {};
  return [
    { label: 'Preferovaný termín', value: p.deliveryTime },
    { label: 'Financovanie', value: p.financing },
    { label: 'Protiúčet', value: p.tradeIn },
    { label: 'Rozpočet', value: p.budget },
    { label: 'Ďalšia konfigurácia', value: p.extraEquipmentNote },
    { label: 'Poznámka', value: p.note },
  ];
}

function formatOrderText(order) {
  const v = order.vehicle || {};
  const c = order.customer || {};
  const equipment = Array.isArray(v.vybava) ? v.vybava.filter(Boolean) : [];
  const sourceLabel = order.source === 'stock' ? 'Skladové vozidlo' : 'Individuálna konfigurácia';
  const vehicleLines = orderVehicleItems(order).map(item => item.value ? `${item.label}: ${item.value}` : '');
  if (equipment.length) vehicleLines.push(`Kompletná výbava:\n${equipment.map(item => `- ${item}`).join('\n')}`);

  return [
    textBlock(`Nová online objednávková požiadavka #${order.orderNumber}`, [
      `Typ: ${sourceLabel}`,
      formatDateTime(order.createdAt) ? `Prijaté: ${formatDateTime(order.createdAt)}` : '',
    ]),
    textBlock('Zákazník', [
      `Meno: ${c.name}`,
      `E-mail: ${c.email}`,
      `Telefón: ${c.phone}`,
      c.company ? `Firma: ${c.company}` : '',
      c.preferredContact ? `Preferovaný kontakt: ${c.preferredContact}` : '',
    ]),
    textBlock('Vozidlo', vehicleLines),
    textBlock('Preferencie zákazníka', orderPreferenceItems(order).map(item => (
      item.value ? `${item.label}: ${item.value}` : ''
    ))),
    textBlock('Informácie o požiadavke', [
      `Súhlas so spracovaním údajov: ${order.consent ? 'Áno' : 'Nie'}`,
      `Stránka: ${order.page || '—'}`,
    ]),
  ].filter(Boolean).join('\n\n');
}

function orderAdminHtml(order) {
  const c = order.customer || {};
  const v = order.vehicle || {};
  const equipment = Array.isArray(v.vybava) ? v.vybava.filter(Boolean) : [];
  const sourceLabel = order.source === 'stock' ? 'Skladové vozidlo' : 'Individuálna konfigurácia';

  return renderAdminRequestEmail({
    preheader: `Nová online objednávka #${order.orderNumber} od ${c.name}.`,
    typeLabel: 'Online objednávka',
    title: 'Online objednávka vozidla',
    reference: `Objednávka #${order.orderNumber}`,
    intro: `${sourceLabel} · ${vehicleTitle(v)}`,
    contacts: [
      { label: 'Meno a priezvisko', value: c.name },
      { label: 'E-mail', value: c.email },
      { label: 'Telefón', value: c.phone },
    ],
    sections: [
      {
        title: 'Zákazník',
        items: [
          { label: 'Firma', value: c.company },
          { label: 'Preferovaný kontakt', value: c.preferredContact },
        ],
      },
      { title: 'Vozidlo', items: orderVehicleItems(order) },
      {
        title: 'Kompletná výbava vozidla',
        items: [{ label: 'Položky výbavy', value: equipment.map(item => `• ${item}`).join('\n') }],
      },
      { title: 'Preferencie zákazníka', items: orderPreferenceItems(order) },
      {
        title: 'Informácie o požiadavke',
        items: [
          { label: 'Číslo', value: `#${order.orderNumber}` },
          { label: 'Typ', value: sourceLabel },
          { label: 'Prijaté', value: formatDateTime(order.createdAt) },
          { label: 'Súhlas s údajmi', value: order.consent ? 'Áno' : 'Nie' },
          { label: 'Zdrojová stránka', value: order.page || '—' },
        ],
      },
    ],
  });
}

function orderCustomerHtml(order) {
  const v = order.vehicle || {};
  const p = order.preferences || {};
  const sourceLabel = order.source === 'stock' ? 'Skladové vozidlo' : 'Individuálna konfigurácia';

  return renderCustomerConfirmationEmail({
    preheader: `Potvrdenie online požiadavky #${order.orderNumber} – ${vehicleTitle(v)}.`,
    typeLabel: 'Online objednávka',
    title: 'Vašu požiadavku sme prijali',
    greeting: `Dobrý deň, ${order.customer.name},`,
    intro: 'Ďakujeme za váš záujem o vozidlo z ponuky PP AUTO. Nižšie nájdete súhrn prijatej požiadavky.',
    reference: `Požiadavka #${order.orderNumber}`,
    summaryLabel: 'Vybrané vozidlo',
    summaryValue: vehicleTitle(v),
    sections: [
      {
        title: 'Zhrnutie vozidla',
        items: [
          { label: 'Typ požiadavky', value: sourceLabel },
          { label: 'Rok', value: v.rok ?? '' },
          { label: 'Palivo', value: v.palivo },
          { label: 'Prevodovka', value: v.typ_prevodovky || v.prevodovka },
          { label: 'Výbava / paket', value: v.vybava_paket },
          { label: 'Farba', value: v.farba ? `${v.farba}${v.metaliza ? ' · metalíza' : ''}` : '' },
          { label: 'Cena', value: v.nova_cena || v.stara_cena },
        ],
      },
      {
        title: 'Vaše preferencie',
        items: [
          { label: 'Preferovaný termín', value: p.deliveryTime },
          { label: 'Financovanie', value: p.financing },
          { label: 'Protiúčet', value: p.tradeIn },
          { label: 'Ďalšia konfigurácia', value: p.extraEquipmentNote },
          { label: 'Poznámka', value: p.note },
        ],
      },
    ],
    nextStep: 'Náš predajca vás bude kontaktovať a potvrdí dostupnosť vozidla, aktuálnu cenu a ďalší postup.',
    disclaimer: 'Požiadavka je nezáväzná a nepredstavuje uzatvorenie kúpnej zmluvy.',
  });
}

async function sendOrderNotifications(order) {
  const reference = `#${order.orderNumber}`;
  const adminText = formatOrderText(order);
  const customerText = [
    `Dobrý deň, ${order.customer.name},`,
    '',
    `ďakujeme za vašu online objednávkovú požiadavku ${reference}.`,
    `Vozidlo: ${vehicleTitle(order.vehicle)}.`,
    `Typ: ${order.source === 'stock' ? 'Skladové vozidlo' : 'Individuálna konfigurácia'}.`,
    order.preferences?.deliveryTime ? `Preferovaný termín: ${order.preferences.deliveryTime}.` : '',
    '',
    'Požiadavka je nezáväzná. Náš predajca vás bude kontaktovať a potvrdí dostupnosť, cenu a ďalší postup.',
    '',
    'PP AUTO s.r.o.',
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join('\n');

  const [adminResult, customerResult] = await Promise.allSettled([
    sendAdminMail({
      kind: 'orders',
      subject: `Nová objednávka ${reference} – ${order.vehicle.znacka} ${order.vehicle.model}`,
      text: adminText,
      htmlBody: orderAdminHtml(order),
      replyTo: order.customer.email,
    }),
    sendCustomerMail({
      to: order.customer.email,
      subject: `PP AUTO – potvrdenie požiadavky ${reference}`,
      text: customerText,
      htmlBody: orderCustomerHtml(order),
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

function formPresentation(type) {
  if (type === 'contact') {
    return {
      label: 'kontaktný formulár',
      typeLabel: 'Kontaktný formulár',
      adminTitle: 'Kontaktný formulár',
      customerTitle: 'Ďakujeme za vašu správu',
      summaryLabel: 'Stav požiadavky',
      summaryValue: 'Správa bola úspešne doručená',
      nextStep: 'Našu odpoveď vám pošleme e-mailom alebo vás budeme kontaktovať telefonicky, ak ste uviedli telefónne číslo.',
      disclaimer: 'Tento e-mail potvrdzuje prijatie správy odoslanej cez kontaktný formulár PP AUTO.',
    };
  }
  if (type === 'finance') {
    return {
      label: 'financovanie',
      typeLabel: 'Financovanie',
      adminTitle: 'Dopyt na financovanie',
      customerTitle: 'Dopyt na financovanie sme prijali',
      summaryLabel: 'Typ požiadavky',
      summaryValue: 'Financovanie vozidla',
      nextStep: 'Náš predajca vás bude kontaktovať, doplní potrebné údaje a pripraví riešenie podľa vašich preferencií.',
      disclaimer: 'Orientačná kalkulácia nie je záväznou ponukou financovania. Presné podmienky vám potvrdí predajca.',
    };
  }
  return {
    label: 'testovaciu jazdu',
    typeLabel: 'Testovacia jazda',
    adminTitle: 'Žiadosť o testovaciu jazdu',
    customerTitle: 'Žiadosť o testovaciu jazdu sme prijali',
    summaryLabel: 'Vybrané vozidlo',
    summaryValue: '',
    nextStep: 'Vybraný termín je predbežný. Náš predajca vás bude kontaktovať a dostupnosť vozidla aj presný čas jazdy potvrdí.',
    disclaimer: 'Termín testovacej jazdy je platný až po potvrdení zo strany PP AUTO.',
  };
}

function formVehicleTitle(data) {
  return data.carTitle || [data.brand, data.model].filter(Boolean).join(' ');
}

function formVehicleItems(data) {
  return [
    { label: 'Vozidlo', value: data.carTitle },
    { label: 'Značka', value: data.brand },
    { label: 'Model', value: data.model },
    { label: 'ID vozidla', value: data.carId },
    { label: 'Detail vozidla', value: data.carUrl },
  ];
}

function formAppointmentItems(data) {
  return [
    { label: 'Dátum', value: formatDateOnly(data.date) },
    { label: 'Časť dňa', value: data.slot },
    { label: 'Konkrétny čas', value: data.time },
  ];
}

function formMailText(type, data, page) {
  const presentation = formPresentation(type);
  return [
    presentation.adminTitle,
    textBlock('Zákazník', [
      `Meno: ${data.name}`,
      `E-mail: ${data.email}`,
      data.phone ? `Telefón: ${data.phone}` : '',
    ]),
    textBlock('Vozidlo', formVehicleItems(data).map(item => item.value ? `${item.label}: ${item.value}` : '')),
    textBlock('Požadovaný termín', formAppointmentItems(data).map(item => item.value ? `${item.label}: ${item.value}` : '')),
    textBlock('Obsah požiadavky', [
      data.calcSummary ? `Kalkulácia:\n${data.calcSummary}` : '',
      data.message ? `Správa:\n${data.message}` : '',
      data.note ? `Poznámka:\n${data.note}` : '',
    ]),
    textBlock('Informácie o odoslaní', [`Stránka: ${clean(page, 700) || '—'}`]),
  ].filter(Boolean).join('\n\n');
}

function formAdminHtml(type, data, page) {
  const presentation = formPresentation(type);
  const vehicle = formVehicleTitle(data);
  return renderAdminRequestEmail({
    preheader: `${presentation.adminTitle} od ${data.name}.`,
    typeLabel: presentation.typeLabel,
    title: presentation.adminTitle,
    intro: vehicle ? `Nová požiadavka z webu · ${vehicle}` : 'Nová požiadavka z webu PP AUTO.',
    contacts: [
      { label: 'Meno a priezvisko', value: data.name },
      { label: 'E-mail', value: data.email },
      { label: 'Telefón', value: data.phone },
    ],
    sections: [
      { title: 'Vozidlo', items: formVehicleItems(data) },
      { title: 'Požadovaný termín', items: formAppointmentItems(data) },
      {
        title: 'Obsah požiadavky',
        items: [
          { label: 'Kalkulácia', value: data.calcSummary },
          { label: 'Správa', value: data.message },
          { label: 'Poznámka', value: data.note },
        ],
      },
      {
        title: 'Informácie o odoslaní',
        items: [{ label: 'Zdrojová stránka', value: clean(page, 700) || '—' }],
      },
    ],
  });
}

function formCustomerHtml(type, data) {
  const presentation = formPresentation(type);
  const vehicle = formVehicleTitle(data);
  const summaryValue = type === 'testdrive' ? (vehicle || 'Testovacia jazda') : presentation.summaryValue;
  const sections = [];

  if (type === 'testdrive') {
    sections.push(
      {
        title: 'Vozidlo',
        items: [
          { label: 'Vybrané vozidlo', value: vehicle },
          { label: 'Značka', value: data.brand },
          { label: 'Model', value: data.model },
        ],
      },
      { title: 'Požadovaný termín', items: formAppointmentItems(data) },
      { title: 'Doplňujúce údaje', items: [{ label: 'Poznámka', value: data.note }] },
    );
  } else if (type === 'finance') {
    sections.push({
      title: 'Zhrnutie dopytu',
      items: [
        { label: 'Orientačná kalkulácia', value: data.calcSummary },
        { label: 'Vaša správa', value: data.message },
      ],
    });
  } else {
    sections.push({
      title: 'Vaša správa',
      items: [{ label: 'Správa', value: data.message }],
    });
  }

  return renderCustomerConfirmationEmail({
    preheader: `${presentation.customerTitle} – PP AUTO.`,
    typeLabel: presentation.typeLabel,
    title: presentation.customerTitle,
    greeting: `Dobrý deň, ${data.name},`,
    intro: 'Ďakujeme, vašu požiadavku sme úspešne prijali. Jej súhrn nájdete nižšie.',
    summaryLabel: presentation.summaryLabel,
    summaryValue,
    sections,
    nextStep: presentation.nextStep,
    disclaimer: presentation.disclaimer,
  });
}

function formCustomerText(type, data) {
  const presentation = formPresentation(type);
  const details = [];
  const vehicle = formVehicleTitle(data);
  if (vehicle) details.push(`Vozidlo: ${vehicle}`);
  if (data.date) details.push(`Dátum: ${formatDateOnly(data.date)}`);
  if (data.slot) details.push(`Časť dňa: ${data.slot}`);
  if (data.time) details.push(`Čas: ${data.time}`);
  if (type === 'finance' && data.calcSummary) details.push(`Orientačná kalkulácia:\n${data.calcSummary}`);

  return [
    `Dobrý deň, ${data.name},`,
    '',
    `ďakujeme, prijali sme vašu požiadavku (${presentation.label}).`,
    ...details,
    '',
    presentation.nextStep,
    '',
    'PP AUTO s.r.o.',
  ].join('\n');
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
  const label = formPresentation(type).label;
  const adminText = formMailText(type, data, req.body?.page);
  const customerText = formCustomerText(type, data);

  let adminSent = false;
  let customerSent = false;
  try {
    const adminResult = await sendAdminMail({
      kind,
      subject: `PP AUTO – ${label} – ${data.name}`,
      text: adminText,
      htmlBody: formAdminHtml(type, data, req.body?.page),
      replyTo: data.email,
    });
    adminSent = adminResult?.sent === true;
    if (!adminSent) throw new Error('Admin mail was not sent.');

    try {
      const customerResult = await sendCustomerMail({
        to: data.email,
        subject: `PP AUTO – potvrdenie: ${label}`,
        text: customerText,
        htmlBody: formCustomerHtml(type, data),
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
