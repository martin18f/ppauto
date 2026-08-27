// /api/public-promos
// Rýchly read-only endpoint pre verejnú stránku. Admin CRUD ostáva na /api/promos.

function encodeGithubPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

const CACHE_TTL_MS = 60 * 1000;
let warmCache = { expiresAt: 0, value: null };

function setPublicCacheHeaders(res) {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
}

async function readPromos() {
  if (warmCache.value && warmCache.expiresAt > Date.now()) return warmCache.value;

  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  const PROMOS_PATH = process.env.PROMOS_PATH || 'data/akcie.json';

  if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
    throw new Error('Chýbajú env premenné (GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH)');
  }

  const safePath = encodeGithubPath(PROMOS_PATH);
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`GET promos failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!payload || Array.isArray(payload) || !payload.content) {
    throw new Error('PROMOS_PATH neukazuje na JSON súbor');
  }

  const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
  const json = JSON.parse(decoded || '[]');
  if (!Array.isArray(json)) throw new Error('akcie.json nie je pole []');

  const visible = json.filter(item => item && item.skryte !== true);
  warmCache = { expiresAt: Date.now() + CACHE_TTL_MS, value: visible };
  return visible;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  setPublicCacheHeaders(res);

  try {
    const promos = await readPromos();
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json(promos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
