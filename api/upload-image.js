// /api/upload-image
// Klient pošle JSON: { filename: "subaru.avif", contentBase64: "iVBORw0KGgo..." }  (čisté base64 bez prefixu)
// Route obrázok uloží do GitHub repa (bez redeployu ho budeš používať cez raw.githubusercontent URL)
// Vyžaduje tie isté ENV premenne ako /api/cars: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res.status(500).json({ error: 'Missing env: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH' });
    }

    const { filename, contentBase64 } = req.body || {};
    if (!filename || !contentBase64) {
      return res.status(400).json({ error: 'Missing filename or contentBase64' });
    }

    // jednoduchá sanitizácia názvu
    const safeName = String(filename).replace(/[^\w.\-]+/g, '_');
    const path = `uploads/${Date.now()}-${safeName}`; // napr. uploads/1739736251-subaru.avif

    // GitHub Contents API – vytvor/aktualizuj súbor
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`;
    const body = {
      message: `chore(admin): upload image ${safeName}`,
      content: contentBase64, // MUSÍ byť čisté base64, nie data:uri
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
      return res.status(r.status).json({ error: `GitHub upload failed: ${r.status} ${r.statusText}`, details: t });
    }

    // Skladanie RAW URL – netreba redeploy, <img> to načíta priamo
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
    return res.status(200).json({ ok: true, url: rawUrl, path });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
