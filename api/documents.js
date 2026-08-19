// /api/documents
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

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeBrand(value) {
  const brand = clean(value);
  const key = brand.toLowerCase();
  if (key === 'subaru') return 'Subaru';
  if (key === 'kgm') return 'KGM';
  if (key === 'jeep') return 'Jeep';
  if (key === 'chery') return 'Chery';
  return brand;
}

// Cenník je jediný podporovaný typ PDF dokumentu.
// Staršie záznamy typu "vybava" sa pri načítaní automaticky správajú ako cenník.
function normalizeType() {
  return 'cennik';
}

function normalizeDocument(doc) {
  const source = doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : {};
  return {
    id: clean(source.id),
    brand: normalizeBrand(source.brand),
    model: clean(source.model),
    type: normalizeType(source.type),
    title: clean(source.title),
    filename: clean(source.filename),
    path: clean(source.path),
    size: Number.isFinite(Number(source.size)) ? Number(source.size) : 0,
    createdAt: clean(source.createdAt),
    updatedAt: clean(source.updatedAt),
  };
}

function normalizeDocuments(data) {
  return (Array.isArray(data) ? data : [])
    .map(normalizeDocument)
    .filter(doc => doc.id && doc.brand && doc.path && doc.filename);
}

function isConflictError(error) {
  const text = String(error?.message || error || '');
  return text.includes('409') || text.includes('Conflict');
}

export default async function handler(req, res) {
  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || 'data/dokumenty.json';
    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res.status(500).json({ error: 'Missing env: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH' });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    async function getRegistry() {
      const safePath = encodeGithubPath(DOCUMENTS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const r = await fetch(url, { headers });
      if (r.status === 404) return { documents: [], sha: null };
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Document registry read failed: ${r.status} ${text.slice(0, 300)}`);
      }
      const payload = await r.json();
      const decoded = Buffer.from(payload.content || '', 'base64').toString('utf8');
      return { documents: normalizeDocuments(JSON.parse(decoded || '[]')), sha: payload.sha || null };
    }

    async function putRegistry(documents, sha, message) {
      const safePath = encodeGithubPath(DOCUMENTS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;
      const body = {
        message,
        content: Buffer.from(JSON.stringify(normalizeDocuments(documents), null, 2) + '\n', 'utf8').toString('base64'),
        branch: GITHUB_BRANCH,
      };
      if (sha) body.sha = sha;
      const r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`Document registry write failed: ${r.status} ${text.slice(0, 300)}`);
      }
    }

    async function mutate(mutator, message) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const { documents, sha } = await getRegistry();
        const next = normalizeDocuments(mutator([...documents]));
        try {
          await putRegistry(next, sha, message);
          return next;
        } catch (error) {
          if (attempt < 4 && isConflictError(error)) continue;
          throw error;
        }
      }
      throw new Error('Document registry update failed');
    }

    async function deleteGithubFile(path) {
      if (!path || !path.startsWith('uploads/documents/')) return;
      const safePath = encodeGithubPath(path);
      const readUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const read = await fetch(readUrl, { headers });
      if (read.status === 404) return;
      if (!read.ok) throw new Error(`PDF lookup before delete failed: ${read.status}`);
      const payload = await read.json();
      const del = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          message: `chore(admin): delete PDF ${path.split('/').pop()}`,
          sha: payload.sha,
          branch: GITHUB_BRANCH,
        }),
      });
      if (!del.ok && del.status !== 404) {
        const text = await del.text().catch(() => '');
        throw new Error(`PDF delete failed: ${del.status} ${text.slice(0, 300)}`);
      }
    }

    if (req.method === 'GET') {
      const { documents } = await getRegistry();
      return res.status(200).json(documents);
    }

    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'POST') {
      const now = new Date().toISOString();
      const incoming = normalizeDocument({
        ...req.body,
        type: 'cennik',
        id: clean(req.body?.id) || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        updatedAt: now,
      });

      if (!incoming.brand) return res.status(400).json({ error: 'Vyber značku.' });
      if (!incoming.path || !incoming.path.startsWith('uploads/documents/')) {
        return res.status(400).json({ error: 'Chýba nahraný PDF súbor.' });
      }
      if (!/\.pdf$/i.test(incoming.filename)) return res.status(400).json({ error: 'Neplatný PDF súbor.' });

      const next = await mutate(arr => [...arr, incoming], `chore(admin): add cennik PDF ${incoming.filename}`);
      return res.status(200).json({ ok: true, document: incoming, documents: next });
    }

    if (req.method === 'PUT') {
      const id = clean(req.body?.id || req.query?.id);
      if (!id) return res.status(400).json({ error: 'Chýba ID dokumentu.' });
      let updated = null;
      const next = await mutate(arr => arr.map(doc => {
        if (doc.id !== id) return doc;
        updated = normalizeDocument({
          ...doc,
          ...req.body,
          type: 'cennik',
          id: doc.id,
          createdAt: doc.createdAt,
          updatedAt: new Date().toISOString(),
        });
        return updated;
      }), `chore(admin): update PDF ${id}`);
      if (!updated) return res.status(404).json({ error: 'Dokument sa nenašiel.' });
      return res.status(200).json({ ok: true, document: updated, documents: next });
    }

    if (req.method === 'DELETE') {
      const id = clean(req.body?.id || req.query?.id);
      if (!id) return res.status(400).json({ error: 'Chýba ID dokumentu.' });
      const { documents } = await getRegistry();
      const target = documents.find(doc => doc.id === id);
      if (!target) return res.status(404).json({ error: 'Dokument sa nenašiel.' });

      const next = await mutate(arr => arr.filter(doc => doc.id !== id), `chore(admin): remove PDF ${id}`);
      try {
        await deleteGithubFile(target.path);
      } catch (error) {
        console.warn('PDF metadata removed, physical file cleanup failed:', error?.message || error);
      }
      return res.status(200).json({ ok: true, documents: next });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}