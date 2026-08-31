import crypto from 'node:crypto';
import { hasAdminSession } from './admin-session.js';

const STORE_VERSION = 1;
const SOURCES = new Set(['testdrive','contact','finance','tradein','service','phone','visit','email']);
const STATUSES = new Set(['new','assigned','contacted','appointment','offer','negotiation','won','lost']);
const BRANDS = new Set(['Subaru','KGM','Jeep','Chery']);
const SLA_MS = 60 * 60 * 1000;

function clean(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanMultiline(value, max = 4000) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().slice(0, max);
}
function safeEmail(value) {
  const email = clean(value, 180).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
function normalizePhone(value) {
  const raw = clean(value, 80);
  if (!raw) return '';
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  return `${plus ? '+' : ''}${digits}`;
}
function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}
function encodeGithubPath(path) {
  return String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');
}
function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
}
function storageConfig() {
  const token = clean(process.env.SYSTEM_GITHUB_TOKEN || process.env.ORDERS_GITHUB_TOKEN, 1000);
  const repo = clean(process.env.SYSTEM_GITHUB_REPO || process.env.ORDERS_GITHUB_REPO, 300);
  const branch = clean(process.env.SYSTEM_GITHUB_BRANCH || process.env.ORDERS_GITHUB_BRANCH || 'main', 200);
  const path = clean(process.env.SYSTEM_STORE_PATH || 'data/ppauto-system.enc.json', 500);
  if (!token || !repo || !branch || !path) {
    const error = new Error('PP AUTO System storage is not configured.');
    error.status = 503;
    throw error;
  }
  return { token, repo, branch, path };
}
function encryptionKey() {
  const raw = String(process.env.SYSTEM_ENCRYPTION_KEY || process.env.ORDERS_ENCRYPTION_KEY || '').trim();
  let key = Buffer.alloc(0);
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else if (raw) {
    try { key = Buffer.from(raw, 'base64'); } catch { key = Buffer.alloc(0); }
  }
  if (key.length !== 32) {
    const error = new Error('PP AUTO System encryption key is not configured.');
    error.status = 503;
    throw error;
  }
  return key;
}
function encryptStore(store) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(store), 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ version: 1, alg: 'A256GCM', iv: iv.toString('base64'), tag: tag.toString('base64'), data: encrypted.toString('base64') }, null, 2) + '\n';
}
function decryptStore(payload) {
  if (!payload || payload.alg !== 'A256GCM') {
    const error = new Error('PP AUTO System store has invalid encryption format.');
    error.status = 503;
    throw error;
  }
  const iv = Buffer.from(String(payload.iv || ''), 'base64');
  const tag = Buffer.from(String(payload.tag || ''), 'base64');
  const data = Buffer.from(String(payload.data || ''), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}
function emptyStore() {
  return { version: STORE_VERSION, customers: [], leads: [], sales: [], serviceOrders: [], incidents: [], audit: [] };
}
function normalizeStore(store) {
  const source = store && typeof store === 'object' && !Array.isArray(store) ? store : {};
  return {
    version: STORE_VERSION,
    customers: Array.isArray(source.customers) ? source.customers : [],
    leads: Array.isArray(source.leads) ? source.leads : [],
    sales: Array.isArray(source.sales) ? source.sales : [],
    serviceOrders: Array.isArray(source.serviceOrders) ? source.serviceOrders : [],
    incidents: Array.isArray(source.incidents) ? source.incidents : [],
    audit: Array.isArray(source.audit) ? source.audit : [],
  };
}
async function readStore() {
  const config = storageConfig();
  const url = `https://api.github.com/repos/${config.repo}/contents/${encodeGithubPath(config.path)}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(config.token), cache: 'no-store' });
  if (response.status === 404) return { store: emptyStore(), sha: null, config };
  if (!response.ok) throw Object.assign(new Error(`System storage read failed (${response.status}).`), { status: response.status >= 500 ? 503 : response.status });
  const file = await response.json();
  const decoded = Buffer.from(file.content || '', 'base64').toString('utf8');
  return { store: normalizeStore(decryptStore(JSON.parse(decoded || '{}'))), sha: file.sha || null, config };
}
async function writeStore(config, store, sha, message) {
  const url = `https://api.github.com/repos/${config.repo}/contents/${encodeGithubPath(config.path)}`;
  const body = { message, branch: config.branch, content: Buffer.from(encryptStore(store), 'utf8').toString('base64') };
  if (sha) body.sha = sha;
  const response = await fetch(url, { method: 'PUT', headers: githubHeaders(config.token), body: JSON.stringify(body) });
  if (!response.ok) throw Object.assign(new Error(`System storage write failed (${response.status}).`), { status: response.status });
}
async function mutateStore(mutator, message) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { store, sha, config } = await readStore();
    const draft = normalizeStore(structuredClone(store));
    const next = normalizeStore(await mutator(draft));
    try {
      await writeStore(config, next, sha, message);
      return next;
    } catch (error) {
      if (attempt < 4 && error?.status === 409) continue;
      throw error;
    }
  }
  throw new Error('System storage update failed.');
}
function customerPayload(input = {}, previous = null) {
  const name = clean(input.name ?? previous?.name, 140);
  const email = safeEmail(input.email ?? previous?.email);
  const phone = normalizePhone(input.phone ?? previous?.phone);
  if (!name) throw Object.assign(new Error('Chýba meno zákazníka.'), { status: 400 });
  if (!email && !phone) throw Object.assign(new Error('Zadaj e-mail alebo telefón zákazníka.'), { status: 400 });
  const now = new Date().toISOString();
  return {
    ...(previous || {}), id: previous?.id || id('customer'), name, email, phone,
    company: clean(input.company ?? previous?.company, 160),
    note: cleanMultiline(input.note ?? previous?.note, 2500),
    createdAt: previous?.createdAt || now, updatedAt: now,
  };
}
function findCustomer(store, input = {}) {
  const email = safeEmail(input.email);
  const phone = normalizePhone(input.phone);
  return store.customers.find(customer => (email && customer.email === email) || (phone && customer.phone === phone)) || null;
}
function upsertCustomer(store, input = {}) {
  const existing = findCustomer(store, input);
  const customer = customerPayload(input, existing);
  if (existing) store.customers[store.customers.findIndex(x => x.id === existing.id)] = customer;
  else store.customers.push(customer);
  return customer;
}
function normalizeSource(value) {
  const source = clean(value, 40).toLowerCase();
  if (!SOURCES.has(source)) throw Object.assign(new Error('Neplatný zdroj leadu.'), { status: 400 });
  return source;
}
function normalizeStatus(value, fallback = 'new') {
  const status = clean(value || fallback, 40).toLowerCase();
  if (!STATUSES.has(status)) throw Object.assign(new Error('Neplatný status leadu.'), { status: 400 });
  return status;
}
function normalizeBrand(value) {
  const raw = clean(value, 80);
  if (!raw) return '';
  const brand = [...BRANDS].find(item => item.toLowerCase() === raw.toLowerCase());
  if (!brand) throw Object.assign(new Error('Neplatná značka.'), { status: 400 });
  return brand;
}
function reactionMinutes(lead) {
  if (!lead?.createdAt || !lead?.firstContactAt) return null;
  return Math.max(0, Math.round((new Date(lead.firstContactAt) - new Date(lead.createdAt)) / 60000));
}
function leadView(lead) {
  const age = Date.now() - new Date(lead.createdAt).getTime();
  return { ...lead, reactionMinutes: reactionMinutes(lead), slaBreached: !lead.firstContactAt && age >= SLA_MS };
}
function createLead(store, body) {
  const now = new Date().toISOString();
  const customer = upsertCustomer(store, body.customer || {});
  const status = normalizeStatus(body.status, clean(body.assignedTo) ? 'assigned' : 'new');
  const lostReason = clean(body.lostReason, 300);
  if (status === 'lost' && !lostReason) throw Object.assign(new Error('Pri stratenom leade je dôvod povinný.'), { status: 400 });
  const lead = {
    id: id('lead'), customerId: customer.id, source: normalizeSource(body.source), status,
    brand: normalizeBrand(body.brand), model: clean(body.model, 120), assignedTo: clean(body.assignedTo, 140),
    note: cleanMultiline(body.note, 3000), followUpAt: clean(body.followUpAt, 80), lostReason,
    firstContactAt: status === 'contacted' ? now : '', wonAt: status === 'won' ? now : '', lostAt: status === 'lost' ? now : '',
    createdAt: now, updatedAt: now,
    history: [{ at: now, type: 'created', status, note: 'Lead vytvorený v PP AUTO System' }],
  };
  store.leads.unshift(lead);
  store.audit.unshift({ id: id('audit'), at: now, entity: 'lead', entityId: lead.id, action: 'create' });
  return lead;
}
function updateLead(store, leadId, patch) {
  const index = store.leads.findIndex(item => item.id === leadId);
  if (index < 0) throw Object.assign(new Error('Lead neexistuje.'), { status: 404 });
  const prev = store.leads[index];
  const now = new Date().toISOString();
  let customerId = prev.customerId;
  if (patch.customer) customerId = upsertCustomer(store, patch.customer).id;
  const status = patch.status === undefined ? prev.status : normalizeStatus(patch.status, prev.status);
  const lostReason = patch.lostReason === undefined ? prev.lostReason : clean(patch.lostReason, 300);
  if (status === 'lost' && !lostReason) throw Object.assign(new Error('Pri stratenom leade je dôvod povinný.'), { status: 400 });
  const next = {
    ...prev, customerId, status,
    source: patch.source === undefined ? prev.source : normalizeSource(patch.source),
    brand: patch.brand === undefined ? prev.brand : normalizeBrand(patch.brand),
    model: patch.model === undefined ? prev.model : clean(patch.model, 120),
    assignedTo: patch.assignedTo === undefined ? prev.assignedTo : clean(patch.assignedTo, 140),
    note: patch.note === undefined ? prev.note : cleanMultiline(patch.note, 3000),
    followUpAt: patch.followUpAt === undefined ? prev.followUpAt : clean(patch.followUpAt, 80),
    lostReason: status === 'lost' ? lostReason : (patch.lostReason === undefined ? prev.lostReason : lostReason),
    firstContactAt: prev.firstContactAt || (['contacted','appointment','offer','negotiation','won','lost'].includes(status) ? now : ''),
    wonAt: status === 'won' ? (prev.wonAt || now) : prev.wonAt,
    lostAt: status === 'lost' ? (prev.lostAt || now) : prev.lostAt,
    updatedAt: now,
    history: [...(Array.isArray(prev.history) ? prev.history : []), { at: now, type: 'updated', status, note: clean(patch.historyNote, 500) }],
  };
  store.leads[index] = next;
  store.audit.unshift({ id: id('audit'), at: now, entity: 'lead', entityId: leadId, action: 'update' });
  return next;
}
function customerView(store, customer) {
  const leads = store.leads.filter(lead => lead.customerId === customer.id);
  return { ...customer, leadCount: leads.length, lastLeadAt: leads.map(x => x.createdAt).sort().reverse()[0] || '' };
}
function metrics(store) {
  const leads = store.leads.map(leadView);
  return {
    leads: leads.length,
    openLeads: leads.filter(x => !['won','lost'].includes(x.status)).length,
    overdueLeads: leads.filter(x => x.slaBreached).length,
    wonLeads: leads.filter(x => x.status === 'won').length,
    customers: store.customers.length,
  };
}
function withCustomers(store) {
  const map = new Map(store.customers.map(c => [c.id, c]));
  return store.leads.map(lead => ({ ...leadView(lead), customer: map.get(lead.customerId) || null }));
}
function requireAdmin(req, res) {
  if (!hasAdminSession(req)) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}
function resource(req) {
  return clean(req.query?.resource || 'bootstrap', 50).toLowerCase();
}

export async function handlePpAutoSystem(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  if (!requireAdmin(req, res)) return;
  try {
    const target = resource(req);
    if (req.method === 'GET') {
      if (target === 'health') {
        const started = Date.now();
        const { store } = await readStore();
        return res.status(200).json({ ok: true, admin: 'online', database: 'online', responseMs: Date.now() - started, metrics: metrics(store) });
      }
      const { store } = await readStore();
      if (target === 'leads') return res.status(200).json({ leads: withCustomers(store), metrics: metrics(store) });
      if (target === 'customers') return res.status(200).json({ customers: store.customers.map(c => customerView(store, c)) });
      return res.status(200).json({ metrics: metrics(store), leads: withCustomers(store), customers: store.customers.map(c => customerView(store, c)) });
    }
    if (req.method === 'POST' && target === 'leads') {
      let created;
      const store = await mutateStore(draft => { created = createLead(draft, req.body || {}); return draft; }, 'PP AUTO System: create lead');
      const customer = store.customers.find(c => c.id === created.customerId) || null;
      return res.status(201).json({ lead: { ...leadView(created), customer }, metrics: metrics(store) });
    }
    if (req.method === 'PUT' && target === 'leads') {
      const leadId = clean(req.query?.id, 160);
      if (!leadId) return res.status(400).json({ error: 'Chýba ID leadu.' });
      let updated;
      const store = await mutateStore(draft => { updated = updateLead(draft, leadId, req.body || {}); return draft; }, 'PP AUTO System: update lead');
      const customer = store.customers.find(c => c.id === updated.customerId) || null;
      return res.status(200).json({ lead: { ...leadView(updated), customer }, metrics: metrics(store) });
    }
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('PP AUTO System API:', error?.message || error);
    return res.status(error?.status || 500).json({ error: error?.message || 'Internal server error' });
  }
}
