import { hasAdminSession } from '../lib/admin-session.js';
// /api/options

function encodeGithubPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function getIsAdmin(req) {
  return hasAdminSession(req);
}

function isConflictError(err) {
  const msg = String(err?.message || err || '');
  return msg.includes(' 409 ') || msg.includes('409 Conflict');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const FIELD_NAMES = new Set([
  'znacka',
  'palivo',
  'typ_prevodovky',
  'vybava_paket',
  'karoseria',
  'pohon',
  'farba',
]);

function cleanValue(value) {
  return String(value ?? '').trim();
}

function sameValue(a, b) {
  return cleanValue(a).localeCompare(cleanValue(b), 'sk', { sensitivity: 'accent' }) === 0;
}

function uniqueValues(values) {
  const out = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const value = cleanValue(raw);
    if (!value || out.some(item => sameValue(item, value))) continue;
    out.push(value);
  }
  return out;
}

function normalizeOptions(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const fields = source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields)
    ? source.fields
    : {};
  const models = source.models && typeof source.models === 'object' && !Array.isArray(source.models)
    ? source.models
    : {};

  const normalizedFields = {};
  FIELD_NAMES.forEach(name => {
    normalizedFields[name] = uniqueValues(fields[name]);
  });

  const normalizedModels = {};
  Object.entries(models).forEach(([brand, values]) => {
    const cleanBrand = cleanValue(brand);
    if (!cleanBrand) return;
    normalizedModels[cleanBrand] = uniqueValues(values);
  });

  normalizedFields.znacka.forEach(brand => {
    const existingKey = Object.keys(normalizedModels).find(key => sameValue(key, brand));
    if (!existingKey) normalizedModels[brand] = [];
  });

  return {
    version: 1,
    fields: normalizedFields,
    models: normalizedModels,
  };
}

export default async function handler(req, res) {
  const isAdmin = getIsAdmin(req);
  if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    const OPTIONS_PATH = process.env.OPTIONS_PATH || 'data/parametre.json';

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
      const safePath = encodeGithubPath(OPTIONS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const r = await fetch(url, { headers, cache: 'no-store' });

      if (r.status === 404) {
        return {
          options: normalizeOptions({ version: 1, fields: {}, models: {} }),
          sha: null,
        };
      }

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`GET options failed: ${r.status} ${r.statusText} ${text.slice(0, 300)}`);
      }

      const payload = await r.json();
      if (!payload || Array.isArray(payload) || !payload.content) {
        throw new Error('OPTIONS_PATH neukazuje na JSON súbor');
      }

      const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
      return {
        options: normalizeOptions(JSON.parse(decoded)),
        sha: payload.sha,
      };
    }

    async function putFile(options, sha, message) {
      const safePath = encodeGithubPath(OPTIONS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;
      const body = {
        message,
        branch: GITHUB_BRANCH,
        content: Buffer.from(JSON.stringify(normalizeOptions(options), null, 2) + '\n', 'utf8').toString('base64'),
      };
      if (sha) body.sha = sha;

      const r = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`PUT options failed: ${r.status} ${r.statusText} ${text.slice(0, 300)}`);
      }
    }

    async function mutate(mutator, message) {
      const maxAttempts = 4;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { options, sha } = await getFile();
        const next = normalizeOptions(mutator(options));

        try {
          await putFile(next, sha, message);
          return next;
        } catch (err) {
          if (attempt < maxAttempts && isConflictError(err)) {
            await wait(120 * attempt);
            continue;
          }
          throw err;
        }
      }

      throw new Error('Nepodarilo sa uložiť parametre');
    }

    if (req.method === 'GET') {
      const { options } = await getFile();
      return res.status(200).json(options);
    }

    if (req.method === 'POST') {
      const field = cleanValue(req.body?.field);
      const value = cleanValue(req.body?.value);
      const brand = cleanValue(req.body?.brand);

      if (!value) return res.status(400).json({ error: 'Chýba hodnota' });
      if (value.length > 100) return res.status(400).json({ error: 'Hodnota je príliš dlhá' });

      const next = await mutate(options => {
        if (field === 'model') {
          if (!brand) {
            const err = new Error('Pri modeli chýba značka');
            err.status = 400;
            throw err;
          }

          const brandKey = options.fields.znacka.find(item => sameValue(item, brand));
          if (!brandKey) {
            const err = new Error('Neznáma značka');
            err.status = 400;
            throw err;
          }

          const modelKey = Object.keys(options.models).find(key => sameValue(key, brandKey)) || brandKey;
          options.models[modelKey] = uniqueValues([...(options.models[modelKey] || []), value]);
          return options;
        }

        if (!FIELD_NAMES.has(field)) {
          const err = new Error('Neplatné pole');
          err.status = 400;
          throw err;
        }

        options.fields[field] = uniqueValues([...(options.fields[field] || []), value]);
        if (field === 'znacka') {
          const existingKey = Object.keys(options.models).find(key => sameValue(key, value));
          if (!existingKey) options.models[value] = [];
        }
        return options;
      }, `chore(admin): add ${field} option ${value}`);

      return res.status(200).json(next);
    }

    if (req.method === 'DELETE') {
      const field = cleanValue(req.body?.field || req.query?.field);
      const value = cleanValue(req.body?.value || req.query?.value);
      const brand = cleanValue(req.body?.brand || req.query?.brand);

      if (!value) return res.status(400).json({ error: 'Chýba hodnota' });

      const next = await mutate(options => {
        if (field === 'model') {
          if (!brand) {
            const err = new Error('Pri modeli chýba značka');
            err.status = 400;
            throw err;
          }
          const modelKey = Object.keys(options.models).find(key => sameValue(key, brand));
          if (modelKey) {
            options.models[modelKey] = (options.models[modelKey] || []).filter(item => !sameValue(item, value));
          }
          return options;
        }

        if (!FIELD_NAMES.has(field)) {
          const err = new Error('Neplatné pole');
          err.status = 400;
          throw err;
        }

        options.fields[field] = (options.fields[field] || []).filter(item => !sameValue(item, value));

        if (field === 'znacka') {
          const modelKey = Object.keys(options.models).find(key => sameValue(key, value));
          if (modelKey) delete options.models[modelKey];
        }

        return options;
      }, `chore(admin): delete ${field} option ${value}`);

      return res.status(200).json(next);
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    if (err?.status === 400) return res.status(400).json({ error: err.message || 'Bad Request' });
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
