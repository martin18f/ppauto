// /api/document-file
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

function safeDownloadName(filename) {
  const name = clean(filename) || 'dokument.pdf';
  return name.replace(/[\r\n"]/g, '_');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || 'data/dokumenty.json';
    const id = clean(req.query?.id);

    if (!id) return res.status(400).json({ error: 'Chýba ID dokumentu.' });
    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res.status(500).json({ error: 'Missing env: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH' });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    };

    const registryUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeGithubPath(DOCUMENTS_PATH)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
    const registryResponse = await fetch(registryUrl, { headers });
    if (!registryResponse.ok) return res.status(404).json({ error: 'Dokument sa nenašiel.' });

    const registryPayload = await registryResponse.json();
    const documents = JSON.parse(Buffer.from(registryPayload.content || '', 'base64').toString('utf8') || '[]');
    const document = Array.isArray(documents) ? documents.find(item => clean(item?.id) === id) : null;
    if (!document?.path) return res.status(404).json({ error: 'Dokument sa nenašiel.' });

    const fileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeGithubPath(document.path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
    const fileResponse = await fetch(fileUrl, { headers });
    if (!fileResponse.ok) return res.status(404).json({ error: 'PDF súbor sa nenašiel.' });

    const filePayload = await fileResponse.json();
    const bytes = Buffer.from(filePayload.content || '', 'base64');
    if (!bytes.length) return res.status(404).json({ error: 'PDF súbor je prázdny.' });

    const filename = safeDownloadName(document.filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(bytes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
