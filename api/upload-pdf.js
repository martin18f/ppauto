// /api/upload-pdf
function encodeGithubPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_PDF_BYTES / 3) * 4 + 16;

function isAdmin(req) {
  return /(?:^|;\s*)admin=1(?:;|$)/.test(String(req.headers.cookie || ''));
}

function safeFilename(filename) {
  const raw = String(filename || '').trim();
  const withoutPath = raw.split(/[\\/]/).pop() || 'document.pdf';
  const clean = withoutPath
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+/, '');
  return (clean || 'document.pdf').slice(0, 120);
}

async function getGithubFileSha({ repo, branch, path, headers }) {
  const safePath = encodeGithubPath(path);
  const url = `https://api.github.com/repos/${repo}/contents/${safePath}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, { headers });
  if (r.status === 404) return null;
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`PDF lookup failed: ${r.status} ${r.statusText} ${text.slice(0, 300)}`);
  }
  const payload = await r.json();
  return payload?.sha || null;
}

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res.status(500).json({ error: 'Missing env: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH' });
    }

    const filename = String(req.body?.filename || '').trim();
    const contentBase64 = String(req.body?.contentBase64 || '');
    const replacePath = String(req.body?.replacePath || '').trim();

    if (!filename || !contentBase64) {
      return res.status(400).json({ error: 'Chýba PDF súbor.' });
    }
    if (!/\.pdf$/i.test(filename)) {
      return res.status(400).json({ error: 'Podporovaný je iba PDF formát.' });
    }
    if (contentBase64.length > MAX_BASE64_CHARS) {
      return res.status(413).json({ error: 'PDF je príliš veľké. Maximálna veľkosť je 3 MB.' });
    }

    let bytes;
    try {
      bytes = Buffer.from(contentBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'PDF sa nepodarilo načítať.' });
    }

    if (!bytes.length || bytes.length > MAX_PDF_BYTES) {
      return res.status(413).json({ error: 'PDF je príliš veľké. Maximálna veľkosť je 3 MB.' });
    }
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(400).json({ error: 'Vybraný súbor nie je platné PDF.' });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    const safeName = safeFilename(filename);
    const path = replacePath || `uploads/documents/${Date.now()}-${safeName}`;
    if (replacePath && !replacePath.startsWith('uploads/documents/')) {
      return res.status(400).json({ error: 'Neplatná cesta dokumentu.' });
    }

    const sha = replacePath
      ? await getGithubFileSha({ repo: GITHUB_REPO, branch: GITHUB_BRANCH, path, headers })
      : null;

    const safePath = encodeGithubPath(path);
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;
    const body = {
      message: replacePath
        ? `chore(admin): replace PDF ${safeName}`
        : `chore(admin): upload PDF ${safeName}`,
      content: bytes.toString('base64'),
      branch: GITHUB_BRANCH,
    };
    if (sha) body.sha = sha;

    const r = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).json({
        error: `Nahratie PDF zlyhalo (${r.status}).`,
        details: text.slice(0, 400),
      });
    }

    return res.status(200).json({
      ok: true,
      path,
      filename,
      size: bytes.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
