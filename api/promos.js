// /api/promos
function encodeGithubPath(path) {
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function isConflictError(err) {
  const msg = String(err?.message || err || "");
  return msg.includes(" 409 ") || msg.includes("409 Conflict");
}

export default async function handler(req, res) {
  const isAdmin = !!req.headers.cookie?.includes("admin=1");

  try {
    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
    const PROMOS_PATH = process.env.PROMOS_PATH || "data/akcie.json";

    if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_BRANCH) {
      return res.status(500).json({
        error: "Chýbajú env premenné (GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH)",
      });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    async function getFile() {
      const safePath = encodeGithubPath(PROMOS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(
        GITHUB_BRANCH
      )}`;

      const r = await fetch(url, { headers });

      // ak súbor ešte neexistuje → prázdne pole
      if (r.status === 404) {
        return { promos: [], sha: null };
      }

      if (!r.ok) {
        throw new Error(`GET file failed: ${r.status} ${r.statusText} | url=${url}`);
      }

      const data = await r.json();
      if (!data || Array.isArray(data) || !data.content) {
        throw new Error("PROMOS_PATH neukazuje na súbor (akcie.json)");
      }

      const content = Buffer.from(data.content, "base64").toString("utf8");
      const json = JSON.parse(content);
      if (!Array.isArray(json)) throw new Error("akcie.json nie je pole []");

      return { promos: json, sha: data.sha };
    }

    async function putFile(promos, sha, message) {
      const safePath = encodeGithubPath(PROMOS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}`;

      const body = {
        message,
        content: Buffer.from(JSON.stringify(promos, null, 2), "utf8").toString("base64"),
        branch: GITHUB_BRANCH,
      };

      // sha posielame iba ak súbor existuje
      if (sha) body.sha = sha;

      const r = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`PUT file failed: ${r.status} ${r.statusText} – ${txt} | url=${url}`);
      }

      return r.json();
    }

    async function mutate(mutator, message) {
      // 2 pokusy – pri 409 refetch a skúsi znovu
      for (let attempt = 1; attempt <= 2; attempt++) {
        const { promos, sha } = await getFile();
        const next = mutator([...promos]);

        try {
          await putFile(next, sha, message);
          return;
        } catch (e) {
          if (attempt < 2 && isConflictError(e)) continue;
          throw e;
        }
      }
    }

    // DEBUG: /api/promos?debug=1
    if (req.method === "GET" && (req.query?.debug || "") === "1") {
      const safePath = encodeGithubPath(PROMOS_PATH);
      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${safePath}?ref=${encodeURIComponent(
        GITHUB_BRANCH
      )}`;
      const r = await fetch(url, { headers });
      const text = await r.text();
      return res.status(200).json({
        env: { GITHUB_REPO, GITHUB_BRANCH, PROMOS_PATH, hasToken: !!GITHUB_TOKEN },
        github: { url, status: r.status, statusText: r.statusText, bodyPreview: text.slice(0, 300) },
      });
    }

    // GET (public) / GET include_hidden=1 (admin only)
    if (req.method === "GET") {
      const includeHidden = (req.query?.include_hidden || "").toString() === "1";
      if (includeHidden && !isAdmin) return res.status(401).json({ error: "Unauthorized" });

      const { promos } = await getFile();
      const visible = includeHidden ? promos : promos.filter((p) => p && p.skryte !== true);
      return res.status(200).json(visible);
    }

    if (req.method === "POST") {
      if (!isAdmin) return res.status(401).json({ error: "Unauthorized" });

      const p = req.body || {};
      const now = new Date().toISOString();

      const promo = {
        id: p.id || `promo_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        title: String(p.title || "").trim(),
        brand: String(p.brand || "all").toLowerCase().trim() || "all", // subaru/kgm/jeep/all
        image: String(p.image || "").trim(),
        link: String(p.link || "#ponuka").trim() || "#ponuka",
        skryte: !!p.skryte,
        createdAt: p.createdAt || now,
      };

      if (!promo.image) return res.status(400).json({ error: "Missing image" });
      if (!promo.title) return res.status(400).json({ error: "Missing title" });

      await mutate(
        (arr) => {
          arr.push(promo);
          return arr;
        },
        `chore(admin): add promo ${promo.brand} ${promo.title}`.trim()
      );

      return res.status(200).json({ ok: true });
    }

    if (req.method === "PUT") {
      if (!isAdmin) return res.status(401).json({ error: "Unauthorized" });

      const index = parseInt(req.query?.index, 10);
      if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: "Bad index" });

      const incoming = req.body || {};

      await mutate(
        (arr) => {
          if (index >= arr.length) {
            const err = new Error("Not found");
            err.status = 404;
            throw err;
          }

          const prev = arr[index] || {};
          arr[index] = {
            ...prev,
            ...incoming,
            title: String(incoming.title ?? prev.title ?? "").trim(),
            brand: String(incoming.brand ?? prev.brand ?? "all").toLowerCase().trim() || "all",
            image: String(incoming.image ?? prev.image ?? "").trim(),
            link: String(incoming.link ?? prev.link ?? "#ponuka").trim() || "#ponuka",
            skryte: incoming.skryte === undefined ? !!prev.skryte : !!incoming.skryte,
          };

          return arr;
        },
        `chore(admin): update promo #${index + 1}`
      );

      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      if (!isAdmin) return res.status(401).json({ error: "Unauthorized" });

      const index = parseInt(req.query?.index, 10);
      if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: "Bad index" });

      await mutate(
        (arr) => {
          if (index >= arr.length) {
            const err = new Error("Not found");
            err.status = 404;
            throw err;
          }
          arr.splice(index, 1);
          return arr;
        },
        `chore(admin): delete promo #${index + 1}`
      );

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    if (e && e.status === 404) return res.status(404).json({ error: "Not found" });
    console.error(e);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}
