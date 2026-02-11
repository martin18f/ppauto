// /api/upload-image
// Klient pošle JSON: { filename: "subaru.avif", contentBase64: "..." }  (čisté base64 bez prefixu)
// Route obrázok uloží do GitHub repa (raw URL sa použije priamo v <img>)
// Vyžaduje ENV: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH

function encodeGithubPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

export default async function handler(req, res) {
  if (!req.headers.cookie?.includes('admin=1')) {
    return res.status(401).end();
  }

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res
        .status(500)
        .json({ error: 'Missing env: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH' });
    }

    const { filename, contentBase64 } = req.body || {};
    if (!filename || !contentBase64) {
      return res.status(400).json({ error: 'Missing filename or contentBase64' });
    }

    const safeName = String(filename).replace(/[^\w.\-]+/g, '_');
    const path = `uploads/${Date.now()}-${safeName}`;

    const safePath = encodeGithubPath(path);
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;

    const body = {
      message: `chore(admin): upload image ${safeName}`,
      content: contentBase64, // čisté base64
      branch: GITHUB_BRANCH,
    };

    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const t = await r.text();
      return res
        .status(r.status)
        .json({ error: `GitHub upload failed: ${r.status} ${r.statusText}`, details: t });
    }

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
    return res.status(200).json({ ok: true, url: rawUrl, path });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
