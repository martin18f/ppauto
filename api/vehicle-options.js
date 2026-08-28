import { hasAdminSession } from '../lib/admin-session.js';
// /api/vehicle-options
function encodeGithubPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function isAdmin(req) {
  return hasAdminSession(req);
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
  const raw = clean(value);
  const key = raw.toLowerCase();
  if (key === 'subaru') return 'Subaru';
  if (key === 'kgm') return 'KGM';
  if (key === 'jeep') return 'Jeep';
  if (key === 'chery') return 'Chery';
  return '';
}

function normalize(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const colors = source.colors && typeof source.colors === 'object' && !Array.isArray(source.colors)
    ? source.colors
    : {};

  return {
    version: 1,
    equipment: unique(source.equipment),
    colors: {
      Subaru: unique(colors.Subaru),
      KGM: unique(colors.KGM),
      Jeep: unique(colors.Jeep),
      Chery: unique(colors.Chery),
    },
  };
}

function isConflict(error) {
  const text = String(error?.message || error || '');
  return text.includes('409') || text.includes('Conflict');
}

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    const VEHICLE_OPTIONS_PATH = process.env.VEHICLE_OPTIONS_PATH || 'data/vehicle-options.json';

    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res.status(500).json({ error: 'Missing env: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH' });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    async function readFile() {
      const safePath = encodeGithubPath(VEHICLE_OPTIONS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const response = await fetch(url, { headers });

      if (response.status === 404) {
        return { data: normalize({}), sha: null };
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Vehicle options read failed: ${response.status} ${text.slice(0, 300)}`);
      }

      const payload = await response.json();
      const decoded = Buffer.from(payload.content || '', 'base64').toString('utf8');
      return { data: normalize(JSON.parse(decoded || '{}')), sha: payload.sha || null };
    }

    async function writeFile(data, sha, message) {
      const safePath = encodeGithubPath(VEHICLE_OPTIONS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;
      const body = {
        message,
        branch: GITHUB_BRANCH,
        content: Buffer.from(JSON.stringify(normalize(data), null, 2) + '\n', 'utf8').toString('base64'),
      };
      if (sha) body.sha = sha;

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Vehicle options write failed: ${response.status} ${text.slice(0, 300)}`);
      }
    }

    async function mutate(mutator, message) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const { data, sha } = await readFile();
        const next = normalize(mutator(data));
        try {
          await writeFile(next, sha, message);
          return next;
        } catch (error) {
          if (attempt < 4 && isConflict(error)) continue;
          throw error;
        }
      }
      throw new Error('Vehicle options update failed');
    }

    if (req.method === 'GET') {
      const { data } = await readFile();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const action = clean(req.body?.action).toLowerCase();
      const scope = clean(req.body?.scope).toLowerCase();
      const value = clean(req.body?.value);
      const brand = canonicalBrand(req.body?.brand);

      if (action !== 'add' && action !== 'delete') {
        return res.status(400).json({ error: 'Neplatná akcia.' });
      }
      if (scope !== 'equipment' && scope !== 'color') {
        return res.status(400).json({ error: 'Neplatný typ možnosti.' });
      }
      if (!value) return res.status(400).json({ error: 'Chýba hodnota.' });
      if (value.length > 100) return res.status(400).json({ error: 'Hodnota je príliš dlhá.' });
      if (scope === 'color' && !brand) return res.status(400).json({ error: 'Najprv vyber značku.' });

      const next = await mutate(data => {
        if (scope === 'equipment') {
          data.equipment = action === 'add'
            ? unique([...data.equipment, value])
            : data.equipment.filter(item => !same(item, value));
          return data;
        }

        data.colors[brand] = action === 'add'
          ? unique([...(data.colors[brand] || []), value])
          : (data.colors[brand] || []).filter(item => !same(item, value));
        return data;
      }, `chore(admin): ${action} ${scope} ${value}`);

      return res.status(200).json(next);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
