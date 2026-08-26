// /api/orders

const SOURCES = new Set(['stock', 'custom']);
const STATUSES = new Set(['new', 'contacted', 'reserved', 'in_progress', 'ordered', 'closed', 'cancelled']);

function encodeGithubPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function isAdmin(req) {
  return /(?:^|;\s*)admin=1(?:;|$)/.test(String(req.headers.cookie || ''));
}

function clean(value, max = 500) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = 3000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max);
}

function cleanArray(value, maxItems = 80) {
  const source = Array.isArray(value)
    ? value
    : clean(value, 1500).split(/\s*\+\s*|\s*,\s*/g);
  const out = [];
  for (const raw of source) {
    const item = clean(raw, 180);
    if (!item || out.some(existing => existing.localeCompare(item, 'sk', { sensitivity: 'accent' }) === 0)) continue;
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeSource(value) {
  const source = clean(value, 20).toLowerCase();
  return SOURCES.has(source) ? source : 'custom';
}

function normalizeStatus(value, fallback = 'new') {
  const status = clean(value, 30).toLowerCase();
  return STATUSES.has(status) ? status : fallback;
}

function orderId() {
  return `order_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeVehicle(vehicle = {}) {
  const v = vehicle && typeof vehicle === 'object' && !Array.isArray(vehicle) ? vehicle : {};
  return {
    stockCarId: clean(v.stockCarId || v.id, 120),
    stockUrl: clean(v.stockUrl, 500),
    znacka: clean(v.znacka, 80),
    model: clean(v.model, 120),
    rok: numberOrNull(v.rok),
    palivo: clean(v.palivo, 100),
    typ_prevodovky: clean(v.typ_prevodovky, 50),
    prevodovka: clean(v.prevodovka, 140),
    vybava_paket: cleanArray(v.vybava_paket, 20).join(' + '),
    karoseria: clean(v.karoseria, 100),
    pohon: clean(v.pohon, 80),
    farba: clean(v.farba, 100),
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
    email: clean(c.email, 180),
    phone: clean(c.phone, 80),
    company: clean(c.company, 160),
    preferredContact: clean(c.preferredContact, 80),
  };
}

function normalizePreferences(preferences = {}) {
  const p = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  return {
    budget: clean(p.budget, 120),
    deliveryTime: clean(p.deliveryTime, 120),
    financing: clean(p.financing, 120),
    tradeIn: clean(p.tradeIn, 120),
    extraEquipmentNote: cleanMultiline(p.extraEquipmentNote, 1500),
    note: cleanMultiline(p.note, 3000),
  };
}

function normalizeIncomingOrder(body, previous = null) {
  const source = normalizeSource(body?.source ?? previous?.source);
  const now = new Date().toISOString();
  const prevHistory = Array.isArray(previous?.history) ? previous.history : [];

  return {
    ...(previous || {}),
    id: clean(previous?.id || body?.id, 120) || orderId(),
    source,
    status: normalizeStatus(body?.status ?? previous?.status, previous?.status || 'new'),
    archived: body?.archived === undefined ? !!previous?.archived : bool(body.archived),
    customer: normalizeCustomer(body?.customer ?? previous?.customer),
    vehicle: normalizeVehicle(body?.vehicle ?? previous?.vehicle),
    preferences: normalizePreferences(body?.preferences ?? previous?.preferences),
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

function validateOrder(order) {
  if (!order.customer.name) {
    const error = new Error('Chýba meno zákazníka.');
    error.status = 400;
    throw error;
  }
  if (!order.customer.email && !order.customer.phone) {
    const error = new Error('Chýba e-mail alebo telefón zákazníka.');
    error.status = 400;
    throw error;
  }
  if (!order.consent) {
    const error = new Error('Chýba súhlas so spracovaním údajov.');
    error.status = 400;
    throw error;
  }
  if (order.source === 'stock' && !order.vehicle.stockCarId && !(order.vehicle.znacka && order.vehicle.model)) {
    const error = new Error('Nie je vybrané skladové vozidlo.');
    error.status = 400;
    throw error;
  }
  if (order.source === 'custom' && (!order.vehicle.znacka || !order.vehicle.model)) {
    const error = new Error('Pri individuálnej objednávke chýba značka alebo model.');
    error.status = 400;
    throw error;
  }
}

function isConflict(error) {
  const text = String(error?.message || error || '');
  return text.includes('409') || text.includes('Conflict');
}

function findOrderIndex(orders, query = {}) {
  const rawIndex = String(query.index ?? '').trim();
  if (/^(0|[1-9]\d*)$/.test(rawIndex)) {
    const index = Number(rawIndex);
    return Number.isSafeInteger(index) ? index : -1;
  }

  const id = clean(query.id, 120);
  if (!id) return -1;
  return orders.findIndex(order => clean(order?.id, 120) === id);
}

export default async function handler(req, res) {
  const admin = isAdmin(req);
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  const ORDERS_PATH = process.env.ORDER_REQUESTS_PATH || process.env.ORDERS_PATH || 'data/objednavky-test.json';

  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');

  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res.status(500).json({
        error: 'Chýbajú env premenné (GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH)',
      });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    async function getFile() {
      const safePath = encodeGithubPath(ORDERS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const response = await fetch(url, { headers, cache: 'no-store' });

      if (response.status === 404) {
        return { orders: [], sha: null };
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`GET orders failed: ${response.status} ${response.statusText} ${text.slice(0, 300)}`);
      }

      const payload = await response.json();
      if (!payload || Array.isArray(payload) || !payload.content) {
        throw new Error('ORDERS_PATH neukazuje na JSON súbor');
      }

      const decoded = Buffer.from(payload.content || '', 'base64').toString('utf8');
      const orders = JSON.parse(decoded || '[]');
      if (!Array.isArray(orders)) throw new Error('Súbor objednávok nie je pole []');
      return { orders, sha: payload.sha || null };
    }

    async function putFile(orders, sha, message) {
      const safePath = encodeGithubPath(ORDERS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;
      const body = {
        message,
        branch: GITHUB_BRANCH,
        content: Buffer.from(JSON.stringify(orders, null, 2) + '\n', 'utf8').toString('base64'),
      };
      if (sha) body.sha = sha;

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`PUT orders failed: ${response.status} ${response.statusText} ${text.slice(0, 300)}`);
      }

      return response.json();
    }

    async function mutate(mutator, message) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const { orders, sha } = await getFile();
        const next = mutator([...orders]);
        try {
          await putFile(next, sha, message);
          return next;
        } catch (error) {
          if (attempt < 3 && isConflict(error)) continue;
          throw error;
        }
      }
      throw new Error('Nepodarilo sa uložiť objednávky.');
    }

    if (req.method === 'GET') {
      if (!admin) return res.status(401).json({ error: 'Unauthorized' });
      const includeArchived = String(req.query?.include_archived || '') === '1';
      const { orders } = await getFile();
      const visible = includeArchived ? orders : orders.filter(order => order && order.archived !== true);
      return res.status(200).json(visible);
    }

    if (req.method === 'POST') {
      const honeypot = clean(req.body?.website, 200);
      if (honeypot) return res.status(200).json({ ok: true });

      const order = normalizeIncomingOrder({
        source: req.body?.source,
        customer: req.body?.customer,
        vehicle: req.body?.vehicle,
        preferences: req.body?.preferences,
        consent: req.body?.consent,
        page: req.body?.page,
        userAgent: req.headers['user-agent'],
      });
      order.status = 'new';
      order.archived = false;
      order.employeeNote = '';
      order.assignedTo = '';
      order.history = [{ status: 'new', at: order.createdAt, note: 'Vytvorené cez web' }];
      validateOrder(order);

      await mutate(orders => [order, ...orders], `chore(orders): add ${order.source} order ${order.id}`);
      return res.status(201).json({ ok: true, id: order.id });
    }

    if (req.method === 'PUT') {
      if (!admin) return res.status(401).json({ error: 'Unauthorized' });

      let updatedOrder = null;
      await mutate(orders => {
        const index = findOrderIndex(orders, req.query);
        if (index < 0 || index >= orders.length) {
          const error = new Error('Objednávka nebola nájdená.');
          error.status = 404;
          throw error;
        }

        const previous = orders[index] || {};
        const next = normalizeIncomingOrder(req.body || {}, previous);
        const previousStatus = normalizeStatus(previous.status, 'new');
        if (next.status !== previousStatus) {
          next.history = [
            ...(Array.isArray(previous.history) ? previous.history : []),
            {
              status: next.status,
              at: next.updatedAt,
              note: clean(req.body?.historyNote, 300) || 'Zmena stavu v admin paneli',
            },
          ];
        }

        updatedOrder = next;
        orders[index] = next;
        return orders;
      }, `chore(orders): update order ${clean(req.query?.id || req.query?.index, 120)}`);

      return res.status(200).json({ ok: true, order: updatedOrder });
    }

    if (req.method === 'DELETE') {
      if (!admin) return res.status(401).json({ error: 'Unauthorized' });

      await mutate(orders => {
        const index = findOrderIndex(orders, req.query);
        if (index < 0 || index >= orders.length) {
          const error = new Error('Objednávka nebola nájdená.');
          error.status = 404;
          throw error;
        }
        orders.splice(index, 1);
        return orders;
      }, `chore(orders): delete order ${clean(req.query?.id || req.query?.index, 120)}`);

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({ error: error?.message || 'Internal error' });
  }
}
