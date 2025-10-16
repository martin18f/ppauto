// Vercel Serverless Function: /api/cars
// - GET    /api/cars                -> vráti pole áut z GitHubu
// - POST   /api/cars                -> pridá auto { ...car }
// - PUT    /api/cars?index=NUMBER   -> upraví auto na indexe
// - DELETE /api/cars?index=NUMBER   -> vymaže auto na indexe
//
// ENV premenné (nastav vo Vercel projekte):
// - GITHUB_TOKEN   (Personal Access Token s právom repo)
// - GITHUB_REPO    (napr. "tvoje-meno/tvoj-repo")
// - GITHUB_BRANCH  (napr. "main")
// - DATA_PATH      (napr. "data/auta.json")

export default async function handler(req, res) {
  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, DATA_PATH } = process.env;
    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH || !DATA_PATH) {
      return res.status(500).json({ error: 'Chýbajú env premenné (GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, DATA_PATH)' });
    }

    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    // Pomocné: načítaj JSON a SHA z GitHubu
    async function getFile() {
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(DATA_PATH)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`GET file failed: ${r.status} ${r.statusText}`);
      const data = await r.json();
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const json = JSON.parse(content);
      if (!Array.isArray(json)) throw new Error('auta.json nie je pole []');
      return { cars: json, sha: data.sha };
    }

    // Pomocné: commitni nový JSON
    async function putFile(cars, sha, message) {
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(DATA_PATH)}`;
      const body = {
        message,
        content: Buffer.from(JSON.stringify(cars, null, 2), 'utf8').toString('base64'),
        branch: GITHUB_BRANCH,
        sha
      };
      const r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`PUT file failed: ${r.status} ${r.statusText} – ${txt}`);
      }
      return r.json();
    }

    // ROUTING
    if (req.method === 'GET') {
      const { cars } = await getFile();
      return res.status(200).json(cars);
    }

    if (req.method === 'POST') {
      const car = req.body;
      const { cars, sha } = await getFile();
      cars.push(car);
      await putFile(cars, sha, `chore(admin): add car ${car?.znacka || ''} ${car?.model || ''}`);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const index = parseInt(req.query.index, 10);
      if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: 'Bad index' });
      const car = req.body;
      const { cars, sha } = await getFile();
      if (index >= cars.length) return res.status(404).json({ error: 'Not found' });
      cars[index] = car;
      await putFile(cars, sha, `chore(admin): update car #${index + 1}`);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const index = parseInt(req.query.index, 10);
      if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: 'Bad index' });
      const { cars, sha } = await getFile();
      if (index >= cars.length) return res.status(404).json({ error: 'Not found' });
      cars.splice(index, 1);
      await putFile(cars, sha, `chore(admin): delete car #${index + 1}`);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
