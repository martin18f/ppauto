// /api/cars
function encodeGithubPath(path) {
  // Zachová lomky, enkóduje len segmenty
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export default async function handler(req, res) {
  const isAdmin = !!req.headers.cookie?.includes("admin=1");

  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, DATA_PATH } = process.env;

    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH || !DATA_PATH) {
      return res.status(500).json({
        error:
          "Chýbajú env premenné (GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, DATA_PATH)",
      });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    async function getFile() {
      const safePath = encodeGithubPath(DATA_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(
        GITHUB_BRANCH
      )}`;

      const r = await fetch(url, { headers });

      if (!r.ok) {
        throw new Error(
          `GET file failed: ${r.status} ${r.statusText} | url=${url}`
        );
      }

      const data = await r.json();

      if (!data || Array.isArray(data) || !data.content) {
        throw new Error("DATA_PATH neukazuje na súbor (auta.json)");
      }

      const content = Buffer.from(data.content, "base64").toString("utf8");
      const json = JSON.parse(content);
      if (!Array.isArray(json)) throw new Error("auta.json nie je pole []");

      return { cars: json, sha: data.sha };
    }

    async function putFile(cars, sha, message) {
      const safePath = encodeGithubPath(DATA_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;

      const body = {
        message,
        content: Buffer.from(JSON.stringify(cars, null, 2), "utf8").toString(
          "base64"
        ),
        branch: GITHUB_BRANCH,
        sha,
      };

      const r = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const txt = await r.text();
        throw new Error(
          `PUT file failed: ${r.status} ${r.statusText} – ${txt} | url=${url}`
        );
      }

      return r.json();
    }

    // DEBUG režim – otvor si /api/cars?debug=1 na produkcii a uvidíš presne,
    // aký repo/branch/path používa produkcia (bez tokenu).
    if (req.method === "GET" && (req.query?.debug || "") === "1") {
      const safePath = encodeGithubPath(DATA_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(
        GITHUB_BRANCH
      )}`;
      const r = await fetch(url, { headers });
      const text = await r.text();
      return res.status(200).json({
        env: {
          GITHUB_REPO,
          GITHUB_BRANCH,
          DATA_PATH,
          hasToken: !!GITHUB_TOKEN,
        },
        github: {
          url,
          status: r.status,
          statusText: r.statusText,
          bodyPreview: text.slice(0, 300),
        },
      });
    }

    // GET (public) / GET include_hidden=1 (admin only)
    if (req.method === "GET") {
      const includeHidden = (req.query?.include_hidden || "").toString() === "1";
      if (includeHidden && !isAdmin) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { cars } = await getFile();
      const visible = includeHidden
        ? cars
        : cars.filter((c) => c && c.skryte !== true);

      return res.status(200).json(visible);
    }

    if (req.method === "POST") {
      if (!isAdmin) return res.status(401).json({ error: "Unauthorized" });
      const car = req.body;

      const { cars, sha } = await getFile();
      cars.push(car);

      await putFile(
        cars,
        sha,
        `chore(admin): add car ${car?.znacka || ""} ${car?.model || ""}`.trim()
      );

      return res.status(200).json({ ok: true });
    }

    if (req.method === "PUT") {
      if (!isAdmin) return res.status(401).json({ error: "Unauthorized" });

      const index = parseInt(req.query?.index, 10);
      if (!Number.isInteger(index) || index < 0) {
        return res.status(400).json({ error: "Bad index" });
      }

      const car = req.body;
      const { cars, sha } = await getFile();

      if (index >= cars.length) return res.status(404).json({ error: "Not found" });

      cars[index] = car;
      await putFile(cars, sha, `chore(admin): update car #${index + 1}`);

      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      if (!isAdmin) return res.status(401).json({ error: "Unauthorized" });

      const index = parseInt(req.query?.index, 10);
      if (!Number.isInteger(index) || index < 0) {
        return res.status(400).json({ error: "Bad index" });
      }

      const { cars, sha } = await getFile();
      if (index >= cars.length) return res.status(404).json({ error: "Not found" });

      cars.splice(index, 1);
      await putFile(cars, sha, `chore(admin): delete car #${index + 1}`);

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}
