// /api/order-options
// Public, read-only order configuration built from the same data managed by admin.
// Only whitelisted technical values are exposed; prices, images, hidden flags and
// other internal vehicle data never leave this endpoint.

const FIELD_NAMES = [
  'znacka',
  'palivo',
  'typ_prevodovky',
  'vybava_paket',
  'karoseria',
  'pohon',
  'farba',
];

const PUBLIC_CACHE_TTL_MS = 60 * 1000;
let warmOrderOptionsCache = { expiresAt: 0, value: null };

function setPublicCacheHeaders(res) {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
}

const PUBLIC_BRANDS = ['Subaru', 'KGM', 'Jeep', 'Chery'];

const CHOICE_SEPARATOR = /\s*(?:\+|\/|,|;|\u2022|\u00b7)\s*/u;

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

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseLegacyPrevodovka(raw) {
  const text = clean(raw);
  if (!text) return { transmission: '', package: '' };

  const parts = text.split(/\s*(?:\u2022|\u00b7|\|)\s*/u).map(clean).filter(Boolean);
  if (!parts.length) return { transmission: '', package: '' };

  const normalizeTransmission = value => clean(value).toUpperCase().replace(/\s+/g, '');
  if (parts.length === 1) {
    const transmission = normalizeTransmission(parts[0]);
    if (/^(AT|MT|CVT|DCT|DSG)$/.test(transmission)) {
      return { transmission, package: '' };
    }
    return { transmission: '', package: parts[0] };
  }

  return {
    transmission: normalizeTransmission(parts[0]),
    package: parts.slice(1).join(' • '),
  };
}

function publicFuelLabel(value) {
  // Hodnoty zostávajú založené na admin dátach, iba odstránime technické
  // oddeľovače a bežné duplicitné kombinácie.
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
      return;
    }
    if (name === 'palivo') {
      fields[name] = unique((Array.isArray(sourceFields[name]) ? sourceFields[name] : [])
        .map(publicFuelLabel)
        .filter(Boolean));
      return;
    }
    fields[name] = unique(sourceFields[name]);
  });

  const models = {};
  PUBLIC_BRANDS.forEach(brand => {
    const sourceKey = Object.keys(sourceModels).find(key => same(key, brand));
    models[brand] = unique(sourceKey ? sourceModels[sourceKey] : []);
  });

  return { version: 2, fields, models };
}

function ensureIdentityOptions(options, cars) {
  const next = normalizeParameterOptions(options);

  for (const car of Array.isArray(cars) ? cars : []) {
    if (!car || typeof car !== 'object' || Array.isArray(car)) continue;
    const brand = PUBLIC_BRANDS.find(item => same(item, car.znacka));
    const model = clean(car.model);
    if (!brand) continue;

    const brandKey = next.fields.znacka.find(item => same(item, brand));

    let modelKey = Object.keys(next.models).find(key => same(key, brandKey));
    if (!modelKey) {
      next.models[brandKey] = [];
      modelKey = brandKey;
    }

    if (model && !next.models[modelKey].some(item => same(item, model))) {
      next.models[modelKey].push(model);
    }
  }

  return next;
}

function addUniqueNumber(target, value) {
  const number = safeNumber(value);
  if (number === null || target.includes(number)) return;
  target.push(number);
}

function makeModelConfiguration() {
  return {
    fuels: [],
    packages: [],
    transmissions: [],
    engineVolumes: [],
    powers: [],
    bodies: [],
    drives: [],
    colors: [],
    variants: [],
  };
}

function pushUnique(target, value) {
  const item = clean(value);
  if (!item || target.some(existing => same(existing, item))) return;
  target.push(item);
}

function buildModelConfigurations(options, cars) {
  const configurations = {};

  function configuredIdentity(rawBrand, rawModel) {
    const brand = options.fields.znacka.find(item => same(item, rawBrand));
    if (!brand) return null;

    const modelKey = Object.keys(options.models).find(key => same(key, brand));
    const model = modelKey
      ? options.models[modelKey].find(item => same(item, rawModel)) || clean(rawModel)
      : clean(rawModel);
    if (!model) return null;
    return { brand, model };
  }

  for (const car of Array.isArray(cars) ? cars : []) {
    if (!car || typeof car !== 'object' || Array.isArray(car)) continue;
    const identity = configuredIdentity(car.znacka, car.model);
    if (!identity) continue;

    configurations[identity.brand] ||= {};
    configurations[identity.brand][identity.model] ||= makeModelConfiguration();
    const config = configurations[identity.brand][identity.model];

    const legacy = parseLegacyPrevodovka(car.prevodovka);
    const packageValue = clean(car.vybava_paket || legacy.package);
    const transmission = clean(car.typ_prevodovky || legacy.transmission);
    const body = clean(car.karoseria);
    const color = clean(car.farba);
    const drives = choiceValues(car.pohon);
    const engineVolume = safeNumber(car.objem);
    const power = safeNumber(car.vykon);
    const fuel = publicFuelLabel(car.palivo);

    pushUnique(config.fuels, fuel);
    pushUnique(config.packages, packageValue);
    pushUnique(config.transmissions, transmission);
    pushUnique(config.bodies, body);
    pushUnique(config.colors, color);
    drives.forEach(value => pushUnique(config.drives, value));
    addUniqueNumber(config.engineVolumes, engineVolume);
    addUniqueNumber(config.powers, power);

    const variant = {
      fuel,
      package: packageValue,
      transmission,
      engineVolume,
      power,
      body,
      drives,
      color,
    };

    const signature = JSON.stringify(variant);
    if (!config.variants.some(item => JSON.stringify(item) === signature)) {
      config.variants.push(variant);
    }
  }

  return configurations;
}

function mergeConfiguration(target, source) {
  ['fuels', 'packages', 'transmissions', 'bodies', 'drives', 'colors'].forEach(name => {
    for (const value of Array.isArray(source?.[name]) ? source[name] : []) {
      pushUnique(target[name], value);
    }
  });
  for (const value of Array.isArray(source?.engineVolumes) ? source.engineVolumes : []) {
    addUniqueNumber(target.engineVolumes, value);
  }
  for (const value of Array.isArray(source?.powers) ? source.powers : []) {
    addUniqueNumber(target.powers, value);
  }
  for (const variant of Array.isArray(source?.variants) ? source.variants : []) {
    const signature = JSON.stringify(variant);
    if (!target.variants.some(item => JSON.stringify(item) === signature)) {
      target.variants.push(variant);
    }
  }
  return target;
}

function buildBrandConfigurations(configurations) {
  const brands = {};
  PUBLIC_BRANDS.forEach(brand => {
    const brandKey = Object.keys(configurations || {}).find(key => same(key, brand));
    const aggregate = makeModelConfiguration();
    Object.values((brandKey && configurations[brandKey]) || {}).forEach(config => {
      mergeConfiguration(aggregate, config);
    });
    brands[brand] = aggregate;
  });
  return brands;
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
    throw new Error(`GET ${path} failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  if (!payload || Array.isArray(payload) || !payload.content) return fallback;

  const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
  return JSON.parse(decoded || 'null') ?? fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  setPublicCacheHeaders(res);

  try {
    if (warmOrderOptionsCache.value && warmOrderOptionsCache.expiresAt > Date.now()) {
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).json(warmOrderOptionsCache.value);
    }

    const OPTIONS_PATH = process.env.OPTIONS_PATH || 'data/parametre.json';
    const DATA_PATH = process.env.DATA_PATH || 'data/auta.json';

    const [parameterOptions, cars] = await Promise.all([
      readGithubJson(OPTIONS_PATH, { version: 1, fields: {}, models: {} }),
      readGithubJson(DATA_PATH, []),
    ]);

    const options = ensureIdentityOptions(parameterOptions, Array.isArray(cars) ? cars : []);
    const configurations = buildModelConfigurations(options, Array.isArray(cars) ? cars : []);
    const brandConfigurations = buildBrandConfigurations(configurations);

    const responsePayload = {
      ...options,
      configurations,
      brandConfigurations,
    };
    warmOrderOptionsCache = {
      expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS,
      value: responsePayload,
    };

    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
