// /api/order-options

const DEFAULT_FIELDS = {
  znacka: ['Subaru', 'KGM', 'Jeep', 'Chery'],
  palivo: ['Benzín', 'Diesel', 'Hybrid', 'Plug-in hybrid', 'MHEV', 'Elektromotor'],
  typ_prevodovky: ['AT', 'MT', 'CVT', 'DCT', 'DSG'],
  vybava_paket: ['Comfort', 'Style', 'Premium', 'Limited', 'Adventure', 'Sport'],
  karoseria: ['SUV', 'Crossover', 'Hatchback', 'Sedan', 'Kombi', 'Coupé', 'Cabrio', 'Pick-up', 'MPV'],
  pohon: ['Predný', 'Zadný', 'AWD', '4x4'],
  farba: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Červená', 'Zelená', 'Žltá', 'Hnedá', 'Oranžová', 'Béžová'],
};

const DEFAULT_MODELS = {
  Subaru: ['FORESTER', 'OUTBACK', 'SOLTERRA', 'CROSSTREK', 'BRZ'],
  KGM: ['TORRES', 'TORRES EVX', 'KORANDO', 'TIVOLI', 'REXTON', 'MUSSO GRAND', 'ACTYON'],
  Jeep: ['AVENGER', 'RENEGADE', 'COMPASS', 'WRANGLER', 'GRAND CHEROKEE'],
  Chery: [
    'TIGGO 9 Plug-in Hybrid',
    'TIGGO 8 Plug-in Hybrid',
    'TIGGO 8',
    'TIGGO 7 Plug-in Hybrid',
    'TIGGO 7 Hybrid',
    'TIGGO 7',
    'TIGGO 4 Hybrid',
  ],
};

const DEFAULT_COLORS = {
  Subaru: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Zelená', 'Hnedá'],
  KGM: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Zlatá', 'Béžová'],
  Jeep: ['Biela', 'Čierna', 'Sivá', 'Zelená', 'Žltá', 'Červená', 'Modrá'],
  Chery: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Červená', 'Zelená'],
};

const DEFAULT_EQUIPMENT = [
  'Adaptívny tempomat',
  'Asistent jazdných pruhov',
  'Sledovanie mŕtveho uhla',
  'Parkovacia kamera',
  '360° kamera',
  'Vyhrievané predné sedadlá',
  'Vyhrievaný volant',
  'Dvojzónová automatická klimatizácia',
  'Bezkľúčový vstup a štartovanie',
  'Apple CarPlay a Android Auto',
  'LED svetlomety',
  'Panoramatické strešné okno',
  'Ťažné zariadenie',
  'Strešné nosiče',
];

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

function canonicalBrand(value) {
  const key = clean(value).toLowerCase();
  if (key === 'subaru') return 'Subaru';
  if (key === 'kgm') return 'KGM';
  if (key === 'jeep') return 'Jeep';
  if (key === 'chery') return 'Chery';
  return '';
}

function mergeFieldOptions(remote = {}) {
  const fields = {};
  Object.keys(DEFAULT_FIELDS).forEach(field => {
    fields[field] = unique([...(DEFAULT_FIELDS[field] || []), ...(remote[field] || [])]);
  });
  return fields;
}

function mergeModels(remote = {}) {
  const models = {};
  Object.entries(DEFAULT_MODELS).forEach(([brand, values]) => {
    const remoteKey = Object.keys(remote || {}).find(key => same(key, brand));
    models[brand] = unique([...(values || []), ...((remoteKey && remote[remoteKey]) || [])]);
  });
  Object.entries(remote || {}).forEach(([brand, values]) => {
    const cleanBrand = canonicalBrand(brand) || clean(brand);
    if (!cleanBrand || models[cleanBrand]) return;
    models[cleanBrand] = unique(values);
  });
  return models;
}

function mergeColors(remote = {}) {
  const colors = {};
  Object.entries(DEFAULT_COLORS).forEach(([brand, values]) => {
    colors[brand] = unique([...(values || []), ...(remote[brand] || [])]);
  });
  return colors;
}

function normalizeParameterOptions(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const fields = source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields)
    ? source.fields
    : {};
  const models = source.models && typeof source.models === 'object' && !Array.isArray(source.models)
    ? source.models
    : {};

  return {
    fields: mergeFieldOptions(fields),
    models: mergeModels(models),
  };
}

function normalizeVehicleOptions(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const colors = source.colors && typeof source.colors === 'object' && !Array.isArray(source.colors)
    ? source.colors
    : {};

  return {
    equipment: unique([...DEFAULT_EQUIPMENT, ...(source.equipment || [])]),
    colors: mergeColors(colors),
  };
}

async function readGithubJson(path, fallback) {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) return fallback;

  const safePath = encodeGithubPath(path);
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
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

  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');

  try {
    const OPTIONS_PATH = process.env.OPTIONS_PATH || 'data/parametre.json';
    const VEHICLE_OPTIONS_PATH = process.env.VEHICLE_OPTIONS_PATH || 'data/vehicle-options.json';

    const [parameterOptions, vehicleOptions] = await Promise.all([
      readGithubJson(OPTIONS_PATH, {}),
      readGithubJson(VEHICLE_OPTIONS_PATH, {}),
    ]);

    const normalizedParameters = normalizeParameterOptions(parameterOptions);
    const normalizedVehicle = normalizeVehicleOptions(vehicleOptions);

    return res.status(200).json({
      version: 1,
      fields: normalizedParameters.fields,
      models: normalizedParameters.models,
      vehicle: normalizedVehicle,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
