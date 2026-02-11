const { chromium } = require('playwright');

// ✅ Subaru filter (podľa tvojho URL v destination parametri)
const EUROTIP_URL =
  'https://eurotip-vozidla.sk/?field_zna_ka_tid_selective=1169';

const BRAND_NAME = 'Subaru';
const TAG_VALUE = 'subaru';

// ⬇️ SEM DAJ TVOJU ADRESU ADMIN PANELU
const ADMIN_URL = 'https://ppauto.sk/admin.html';

// Bezpečné prepínače
const HEADLESS = true;   // pri debugovaní daj false
const DRY_RUN = false;    // najprv true (len vypíše), potom false (bude ukladať)
const MAX_CARS = 80;     // poistka

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function getExpectedTotalFromPageText(text) {
  const m = text.match(/Spolu:\s*(\d+)\s*áut/i);
  return m ? parseInt(m[1], 10) : null;
}

function gearboxAbbrev(raw) {
  const g = norm(raw).toLowerCase();
  // Subaru má často "Automatická bezstupňová" (CVT/Lineartronic),
  // ale ty chceš AT/MT štýl, takže mapujeme na AT.
  if (g.includes('automat')) return 'AT';
  if (g.includes('manu')) return 'MT';
  return '';
}

// ✅ Trim whitelist pre Subaru (aby nevznikali nezmysly z technických tokenov)
const KNOWN_TRIMS = [
  'Style',
  'Premium',
  'Touring',
  'Limited',
  'Sport',
  'Active',
  'Comfort',
  'Executive',
  'Platinum',
  'Exclusive'
];

function detectTrimFromTitle(title) {
  const t = norm(title).toLowerCase();
  for (const k of KNOWN_TRIMS) {
    if (t.includes(k.toLowerCase())) return k;
  }
  return '';
}

// MOŽNOSŤ A: "AT • Style"
function buildPrevodovkaA(title, rawGearbox) {
  const abbr = gearboxAbbrev(rawGearbox);
  const trim = detectTrimFromTitle(title);

  if (abbr && trim) return `${abbr} • ${trim}`;
  if (abbr) return abbr;
  if (trim) return trim;
  return norm(rawGearbox);
}

async function scrapeEurotip(page) {
  await page.goto(EUROTIP_URL, { waitUntil: 'networkidle' });

  // pokus o získanie "Spolu: X áut" (ak stránka zobrazuje súhrn)
  const expectedTotal = await page.evaluate(() => document.body?.innerText || '')
    .then(getExpectedTotalFromPageText);

  // Scopovanie na správny "view" kontajner (rovnaké ako v opravenom Jeep skripte)
  const view = page.locator('div.view').filter({
    has: page.locator('form:has(select[name="field_zna_ka_tid_selective"])')
  }).first();

  await view.waitFor({ state: 'visible', timeout: 45000 });

  const rows = view.locator('.view-content .views-row');
  await rows.first().waitFor({ state: 'visible', timeout: 45000 });

  const raw = await rows.evaluateAll((els) => {
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const pick = (root, sel) => norm(root.querySelector(sel)?.textContent || '');
    const attr = (root, sel, a) => root.querySelector(sel)?.getAttribute(a) || '';

    return els.map((row) => {
      const title = pick(row, '.views-field-title a');
      const href = attr(row, '.views-field-title a', 'href');
      const znacka = pick(row, '.views-field-field-zna-ka .field-content');
      const model = pick(row, '.views-field-field-model .field-content');
      const rok = pick(row, '.views-field-field-rok .field-content');
      const palivo = pick(row, '.views-field-field-palivo .field-content');
      const prevodovkaRaw = pick(row, '.views-field-field-prevodovka .field-content');

      // bonusy (ak chceš neskôr vyplniť)
      const objemRaw = pick(row, '.views-field-field-objem-motora .field-content');

      const looksLikeCar = Boolean(title && href && znacka && model && rok && palivo);
      if (!looksLikeCar) return null;

      return { title, href, znacka, model, rok, palivo, prevodovkaRaw, objemRaw };
    }).filter(Boolean);
  });

  // tvrdý filter len Subaru
  const onlyBrand = raw.filter(c => norm(c.znacka) === BRAND_NAME);

  // dedup podľa href
  const byHref = new Map();
  for (const c of onlyBrand) {
    const key = c.href.trim();
    if (!byHref.has(key)) byHref.set(key, c);
  }

  const cars = Array.from(byHref.values()).slice(0, MAX_CARS);

  // bezpečnostná brzda, ak existuje "Spolu: X áut"
  if (expectedTotal !== null && cars.length !== expectedTotal) {
    const list = cars.map(x => `- ${x.title} | ${x.palivo} | ${x.href}`).join('\n');
    throw new Error(
      `STOP: Eurotip hlási "Spolu: ${expectedTotal} áut", ale scraper našiel ${cars.length}.\n` +
      `Neukladám nič. Zoznam, čo scraper našiel:\n${list}`
    );
  }

  return { expectedTotal, cars };
}

function parseObjemToCm3(objemRaw) {
  // "1995.00 cm3" -> "1995 cm³"
  const m = norm(objemRaw).match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return '';
  const n = Math.round(parseFloat(m[1].replace(',', '.')));
  return n ? `${n} cm³` : '';
}

async function submitToAdmin(adminPage, car) {
  await adminPage.goto(ADMIN_URL, { waitUntil: 'networkidle' });
  await adminPage.waitForSelector('#carForm', { timeout: 45000 });

  const prevodovka = buildPrevodovkaA(car.title, car.prevodovkaRaw);

  await adminPage.fill('#znacka', norm(car.znacka));
  await adminPage.fill('#model', norm(car.model));
  await adminPage.fill('#rok', String(parseInt(norm(car.rok), 10) || ''));
  await adminPage.fill('#palivo', norm(car.palivo));
  await adminPage.fill('#prevodovka', norm(prevodovka));

  // Tagy vždy subaru
  await adminPage.fill('#tagy', TAG_VALUE);

  // ✅ Ak máš v admin formulári pole #objem, vyplní sa (inak sa ignoruje)
  const objem = parseObjemToCm3(car.objemRaw);
  const objemInput = await adminPage.$('#objem');
  if (objemInput && objem) {
    await adminPage.fill('#objem', objem);
  }

  // klik submit a čakaj na POST /api/cars
  await Promise.all([
    adminPage.waitForResponse(r =>
      r.url().includes('/api/cars') && r.request().method() === 'POST',
      { timeout: 45000 }
    ),
    adminPage.click('#submitBtn')
  ]);
}

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS });

  const listPage = await browser.newPage();
  const adminPage = await browser.newPage();

  try {
    console.log(`🔍 Eurotip: načítavam ${BRAND_NAME}…`);
    const { expectedTotal, cars } = await scrapeEurotip(listPage);

    console.log(`✅ Eurotip: našiel som ${cars.length} áut${expectedTotal !== null ? ` (Spolu: ${expectedTotal})` : ''}`);
    console.log('📋 Zoznam (čo budem spracovávať):');
    cars.forEach((c, i) => {
      const prev = buildPrevodovkaA(c.title, c.prevodovkaRaw);
      console.log(`${i + 1}. ${c.znacka} ${c.model} (${c.rok}) | ${c.palivo} | ${prev} | ${c.href}`);
    });

    if (DRY_RUN) {
      console.log('🧪 DRY_RUN=true → nič neukladám. Keď je zoznam OK, nastav DRY_RUN=false.');
      await browser.close();
      return;
    }

    let added = 0;
    for (const c of cars) {
      console.log(`➡️ Ukladám: ${c.title} | ${c.href}`);
      await submitToAdmin(adminPage, c);
      added++;
    }

    console.log(`🎉 HOTOVO: uložené = ${added}`);
    await browser.close();
  } catch (err) {
    console.error('❌ Chyba:', err?.message || err);
    await browser.close();
    process.exit(1);
  }
})();
