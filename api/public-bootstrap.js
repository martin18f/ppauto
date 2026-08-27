// /api/public-bootstrap
// Jediný verejný bootstrap pre hlavnú stránku: autá + objednávkové možnosti + aktuality.
// GitHub súbory sa čítajú paralelne a klient už neposiela tri samostatné requesty.

const PUBLIC_BRANDS = ['Subaru', 'KGM', 'Jeep', 'Chery'];
const FIELD_NAMES = [
  'znacka',
  'palivo',
  'typ_prevodovky',
  'vybava_paket',
  'karoseria',
  'pohon',
  'farba',
];
const CHOICE_SEPARATOR = /\s*(?:\+|\/|,|;|\u2022|\u00b7)\s*/u;
const CACHE_TTL_MS = 60 * 1000;
let warmCache = { expiresAt: 0, value: null };

function setPublicCacheHeaders(res) {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
}

function encodeGithubPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function clean(value) {
  return String(value ?? '').trim();
}

function same(a, b) {
  return clean(a).localeCompare(clean(b), 'sk', { sensitivity: 'accent' }) === 0;
}

function unique(values) {
  const out = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const value = clean(raw);
    if (!value || out.some(item => same(item, value))) continue;
    out.push(value);
  }
  return out;
}

function choiceValues(value) {
  const out = [];
  function append(raw) {
    if (Array.isArray(raw)) {
      raw.forEach(append);
      return;
    }
    if (raw === null || raw === undefined) return;
    clean(raw).split(CHOICE_SEPARATOR).forEach(part => {
      const item = clean(part);
      if (!item || out.some(existing => same(existing, item))) return;
      out.push(item);
    });
  }
  append(value);
  return out;
}

function publicFuelLabel(value) {
  const parts = choiceValues(value);
  if (!parts.length) return '';

  const compositeIndex = parts.findIndex(item => /^benz[ií]n\s+(?:HEV|MHEV|PHEV)$/iu.test(item));
  if (compositeIndex >= 0) {
    const composite = parts[compositeIndex];
    return unique([
      composite,
      ...parts.filter((item, index) => index !== compositeIndex && !/^benz[ií]n$/iu.test(item)),
    ]).join(' ');
  }

  const petrolIndex = parts.findIndex(item => /^benz[ií]n$/iu.test(item));
  const hybridIndex = parts.findIndex(item => /^(?:HEV|MHEV|PHEV)$/iu.test(item));
  if (petrolIndex >= 0 && hybridIndex >= 0) {
    const combined = `Benzín ${parts[hybridIndex].toUpperCase()}`;
    return unique([
      combined,
      ...parts.filter((_, index) => index !== petrolIndex && index !== hybridIndex),
    ]).join(' ');
  }

  return parts.join(' ');
}

function parseEuroAmount(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  const normalized = clean(value)
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ');
  if (!normalized || !/^(?:\d+|\d{1,3}(?: \d{3})+)\s*€?$/.test(normalized)) return null;
  const amount = Number(normalized.replace(/[ €]/g, ''));
  return Number.isSafeInteger(amount) ? amount : null;
}

function normalizeEuroPrice(value) {
  const raw = clean(value);
  if (!raw) return '';
  const amount = parseEuroAmount(value);
  if (amount === null) return raw;
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function normalizeCarForClient(car) {
  if (!car || typeof car !== 'object' || Array.isArray(car)) return car;
  return {
    ...car,
    palivo: choiceValues(car.palivo),
    stara_cena: normalizeEuroPrice(car.stara_cena),
    nova_cena: normalizeEuroPrice(car.nova_cena),
  };
}

function normalizeParameterOptions(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const sourceFields = source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields)
    ? source.fields
    : {};
  const sourceModels = source.models && typeof source.models === 'object' && !Array.isArray(source.models)
    ? source.models
    : {};

  const fields = {};
  FIELD_NAMES.forEach(name => {
    if (name === 'znacka') {
      fields[name] = [...PUBLIC_BRANDS];
    } else if (name === 'palivo') {
      fields[name] = unique((Array.isArray(sourceFields[name]) ? sourceFields[name] : [])
        .map(publicFuelLabel)
        .filter(Boolean));
    } else {
      fields[name] = unique(sourceFields[name]);
    }
  });

  const models = {};
  PUBLIC_BRANDS.forEach(brand => {
    const sourceKey = Object.keys(sourceModels).find(key => same(key, brand));
    models[brand] = unique(sourceKey ? sourceModels[sourceKey] : []);
  });

  return { version: 3, fields, models };
}

function ensureIdentityOptions(options, cars) {
  const next = normalizeParameterOptions(options);
  for (const car of Array.isArray(cars) ? cars : []) {
    if (!car || typeof car !== 'object' || Array.isArray(car)) continue;
    const brand = PUBLIC_BRANDS.find(item => same(item, car.znacka));
    const model = clean(car.model);
    if (!brand || !model) continue;
    if (!next.models[brand].some(item => same(item, model))) next.models[brand].push(model);
  }
  return next;
}

function buildNumericOptions(cars) {
  const engineVolumes = [];
  const powers = [];
  for (const car of Array.isArray(cars) ? cars : []) {
    if (!car || typeof car !== 'object' || Array.isArray(car)) continue;
    const volume = Number(car.objem);
    const power = Number(car.vykon);
    if (Number.isFinite(volume) && volume >= 0 && !engineVolumes.includes(volume)) engineVolumes.push(volume);
    if (Number.isFinite(power) && power >= 0 && !powers.includes(power)) powers.push(power);
  }
  engineVolumes.sort((a, b) => a - b);
  powers.sort((a, b) => a - b);
  return { engineVolumes, powers };
}

async function readGithubJson(path, fallback) {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH || !path) return fallback;

  const safePath = encodeGithubPath(path);
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (response.status === 404) return fallback;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GET ${path} failed: ${response.status} ${response.statusText} ${text.slice(0, 180)}`);
  }

  const payload = await response.json();
  if (!payload || Array.isArray(payload) || !payload.content) return fallback;
  const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
  return JSON.parse(decoded || 'null') ?? fallback;
}

async function buildBootstrap() {
  if (warmCache.value && warmCache.expiresAt > Date.now()) return warmCache.value;

  const DATA_PATH = process.env.DATA_PATH || 'data/auta.json';
  const OPTIONS_PATH = process.env.OPTIONS_PATH || 'data/parametre.json';
  const PROMOS_PATH = process.env.PROMOS_PATH || 'data/akcie.json';

  const [carsRaw, parameterOptions, promosRaw] = await Promise.all([
    readGithubJson(DATA_PATH, []),
    readGithubJson(OPTIONS_PATH, { version: 1, fields: {}, models: {} }),
    readGithubJson(PROMOS_PATH, []),
  ]);

  const cars = Array.isArray(carsRaw) ? carsRaw : [];
  const options = ensureIdentityOptions(parameterOptions, cars);
  const orderOptions = {
    ...options,
    numericOptions: buildNumericOptions(cars),
  };

  const value = {
    version: 1,
    cars: cars.filter(car => car && car.skryte !== true).map(normalizeCarForClient),
    orderOptions,
    promos: (Array.isArray(promosRaw) ? promosRaw : []).filter(item => item && item.skryte !== true),
  };

  warmCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  setPublicCacheHeaders(res);

  try {
    const payload = await buildBootstrap();
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
