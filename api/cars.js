// /api/cars
function parseEuroAmount(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  const normalized = String(value ?? "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || !/^(?:\d+|\d{1,3}(?: \d{3})+)\s*€?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized.replace(/[ €]/g, ""));
  return Number.isSafeInteger(amount) ? amount : null;
}

function normalizeEuroPrice(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const amount = parseEuroAmount(value);
  if (amount === null) return raw;

  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} €`;
}

function getInvalidPriceField(car) {
  if (!car || typeof car !== "object" || Array.isArray(car)) return "car";

  return ["stara_cena", "nova_cena"].find((field) => {
    const value = car[field];
    return String(value ?? "").trim() !== "" && parseEuroAmount(value) === null;
  }) || "";
}

function normalizeCarPrices(car) {
  if (!car || typeof car !== "object" || Array.isArray(car)) return car;
  return {
    ...car,
    stara_cena: normalizeEuroPrice(car.stara_cena),
    nova_cena: normalizeEuroPrice(car.nova_cena),
  };
}

function encodeGithubPath(path) {
  // Zachová lomky, enkóduje len segmenty
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function slugifyCarId(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function reserveUniqueCarId(base, usedIds) {
  const cleanBase = slugifyCarId(base) || "auto";
  let candidate = cleanBase;
  let suffix = 1;

  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = `${cleanBase}-${suffix}`;
  }

  usedIds.add(candidate);
  return candidate;
}

function collectEffectiveCarIds(cars) {
  const usedIds = new Set(
    cars
      .map((car) => String(car?.id || "").trim())
      .filter(Boolean)
  );

  for (const car of cars) {
    if (!car || typeof car !== "object" || Array.isArray(car) || String(car.id || "").trim()) {
      continue;
    }

    reserveUniqueCarId(`${car.znacka || ""}-${car.model || ""}-${car.rok ?? ""}`, usedIds);
  }

  return usedIds;
}

function createDuplicateCar(source, cars) {
  const duplicate = normalizeCarPrices(JSON.parse(JSON.stringify(source)));
  const usedIds = collectEffectiveCarIds(cars);
  const preferredId = String(source.id || "").trim() ||
    `${source.znacka || ""}-${source.model || ""}-${source.rok ?? ""}`;

  duplicate.id = reserveUniqueCarId(preferredId, usedIds);
  return duplicate;
}

function normalizeRevision(value) {
  return String(value || "")
    .trim()
    .replace(/^W\//i, "")
    .replace(/^"|"$/g, "");
}

function setRevisionHeaders(res, revision) {
  const value = String(revision || "").trim();
  if (!value) return;

  res.setHeader("ETag", `"${value}"`);
  res.setHeader("X-Cars-Revision", value);
  res.setHeader("Access-Control-Expose-Headers", "ETag, X-Cars-Revision");
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
        content: Buffer.from(JSON.stringify(cars.map(normalizeCarPrices), null, 2), "utf8").toString(
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
        const error = new Error(
          `PUT file failed: ${r.status} ${r.statusText} – ${txt} | url=${url}`
        );
        error.status = r.status;
        error.code = r.status === 409 ? "REVISION_CONFLICT" : "GITHUB_WRITE_FAILED";
        throw error;
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

      const { cars, sha } = await getFile();
      const normalizedCars = cars.map(normalizeCarPrices);
      const visible = includeHidden
        ? normalizedCars
        : normalizedCars.filter((c) => c && c.skryte !== true);

      setRevisionHeaders(res, sha);
      return res.status(200).json(visible);
    }

    if (req.method === "POST") {
      if (!isAdmin) return res.status(401).json({ error: "Unauthorized" });

      if (String(req.query?.action || "").toLowerCase() === "duplicate") {
        const rawIndex = Array.isArray(req.query?.index) ? "" : String(req.query?.index ?? "");
        if (!/^(0|[1-9]\d*)$/.test(rawIndex)) {
          return res.status(400).json({ error: "Bad index", code: "BAD_INDEX" });
        }

        const index = Number(rawIndex);
        if (!Number.isSafeInteger(index)) {
          return res.status(400).json({ error: "Bad index", code: "BAD_INDEX" });
        }

        const expectedRevision = normalizeRevision(
          req.headers["x-cars-revision"] || req.headers["if-match"]
        );
        if (!expectedRevision) {
          return res.status(428).json({
            error: "Cars revision is required",
            code: "PRECONDITION_REQUIRED",
          });
        }

        const { cars, sha } = await getFile();
        if (expectedRevision !== sha) {
          setRevisionHeaders(res, sha);
          return res.status(409).json({
            error: "Cars list changed; reload and retry",
            code: "REVISION_CONFLICT",
          });
        }

        const source = cars[index];
        if (source === undefined) {
          return res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
        }
        if (!source || typeof source !== "object" || Array.isArray(source)) {
          return res.status(422).json({ error: "Invalid car record", code: "INVALID_SOURCE" });
        }

        const duplicate = createDuplicateCar(source, cars);
        const insertedIndex = index + 1;
        cars.splice(insertedIndex, 0, duplicate);

        const result = await putFile(
          cars,
          sha,
          `chore(admin): duplicate car #${index + 1}`
        );
        const revision = result?.content?.sha || "";

        setRevisionHeaders(res, revision);
        return res.status(201).json({
          ok: true,
          action: "duplicate",
          sourceIndex: index,
          insertedIndex,
          car: duplicate,
          revision,
        });
      }

      const invalidPriceField = getInvalidPriceField(req.body);
      if (invalidPriceField) {
        return res.status(400).json({
          error: `Invalid price field: ${invalidPriceField}`,
          code: "INVALID_PRICE",
        });
      }
      const car = normalizeCarPrices(req.body);

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

      const invalidPriceField = getInvalidPriceField(req.body);
      if (invalidPriceField) {
        return res.status(400).json({
          error: `Invalid price field: ${invalidPriceField}`,
          code: "INVALID_PRICE",
        });
      }
      const car = normalizeCarPrices(req.body);
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
    const status = Number.isInteger(e?.status) ? e.status : 500;
    return res.status(status).json({
      error: e.message || "Internal error",
      ...(e?.code ? { code: e.code } : {}),
    });
  }
}
