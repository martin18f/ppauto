const { chromium } = require('playwright');

const EUROTIP_URL = 'https://eurotip-vozidla.sk/?field_zna_ka_tid_selective=1214'; // Jeep filter
const BRAND_NAME = 'Jeep';

// ⬇️ SEM DAJ TVOJ ADMIN
const ADMIN_URL = 'https://ppauto.sk/admin.html';

// Bezpečné prepínače
const HEADLESS = true;   // pri debugovaní daj false
const DRY_RUN = false;    // najprv true (len vypíše), potom false (bude ukladať)
const MAX_CARS = 50;     // poistka

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function getExpectedTotalFromPageText(text) {
  const m = text.match(/Spolu:\s*(\d+)\s*áut/i);
  return m ? parseInt(m[1], 10) : null;
}

function gearboxAbbrev(raw) {
  const g = norm(raw).toLowerCase();
  if (g.includes('automat')) return 'AT';
  if (g.includes('manu')) return 'MT';
  return '';
}

// ✅ whitelist trimov – presne tie, čo máš v súhrne
const KNOWN_TRIMS = [
  'Axenture',
  'Altitude',
  'Summit',
  'Night Eagle II',
  'High Upland',
  'First Edition'
];

function detectTrimFromTitle(title) {
  const t = norm(title).toLowerCase();
  for (const k of KNOWN_TRIMS) {
    if (t.includes(k.toLowerCase())) return k;
  }
  return '';
}

// MOŽNOSŤ A: "AT • First Edition"
function buildPrevodovkaA(title, rawGearbox) {
  const abbr = gearboxAbbrev(rawGearbox);
  const trim = detectTrimFromTitle(title);

  if (abbr && trim) return `${abbr} • ${trim}`;
  if (abbr) return abbr;
  if (trim) return trim;
  return norm(rawGearbox);
}

async function scrapeEurotipJeep(page) {
  await page.goto(EUROTIP_URL, { waitUntil: 'networkidle' });

  // 1) zober očakávaný počet “Spolu: X áut” (ak je na stránke)
  const expectedTotal = await page.evaluate(() => {
    return document.body ? document.body.innerText : '';
  }).then(getExpectedTotalFromPageText);

  // 2) nájdi správny “view” kontajner: ten, ktorý obsahuje filter select
  const view = page.locator('div.view').filter({
    has: page.locator('form:has(select[name="field_zna_ka_tid_selective"])')
  }).first();

  await view.waitFor({ state: 'visible', timeout: 45000 });

  // 3) riadky len v tomto view (tým odstrihneme iné views-row bloky)
  const rows = view.locator('.view-content .views-row');
  await rows.first().waitFor({ state: 'visible', timeout: 45000 });

  // 4) vytiahni dáta z riadkov
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

      // “vyzerá ako karta auta”
      const looksLikeCar = Boolean(title && href && znacka && model && rok && palivo);

      return looksLikeCar
        ? { title, href, znacka, model, rok, palivo, prevodovkaRaw }
        : null;
    }).filter(Boolean);
  });

  // 5) tvrdý filter len Jeep
  const onlyJeep = raw.filter(c => norm(c.znacka) === BRAND_NAME);

  // 6) dedup iba podľa href (odstráni DOM duplicity, ale zachová reálne rozdielne autá)
  const byHref = new Map();
  for (const c of onlyJeep) {
    const key = c.href.trim();
    if (!byHref.has(key)) byHref.set(key, c);
  }

  const unique = Array.from(byHref.values()).slice(0, MAX_CARS);

  // 7) bezpečnostná brzda: ak stránka hovorí “Spolu: 11” a my máme iné číslo -> STOP
  if (expectedTotal !== null && unique.length !== expectedTotal) {
    const list = unique.map(x => `- ${x.title} | ${x.palivo} | ${x.href}`).join('\n');
    throw new Error(
      `STOP: Eurotip hlási "Spolu: ${expectedTotal} áut", ale scraper našiel ${unique.length}.\n` +
      `Neukladám nič. Zoznam, čo scraper našiel:\n${list}`
    );
  }

  return { expectedTotal, cars: unique };
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

  // Tagy vždy jeep
  await adminPage.fill('#tagy', 'jeep');

  // klik submit + čakaj na POST /api/cars (ak tvoj admin posiela cez fetch)
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
    console.log('🔍 Eurotip: načítavam Jeep…');
    const { expectedTotal, cars } = await scrapeEurotipJeep(listPage);

    console.log(`✅ Eurotip: našiel som ${cars.length} áut${expectedTotal !== null ? ` (Spolu: ${expectedTotal})` : ''}`);
    console.log('📋 Zoznam (čo budem spracovávať):');
    cars.forEach((c, i) => {
      const prev = buildPrevodovkaA(c.title, c.prevodovkaRaw);
      console.log(
        `${i + 1}. ${c.znacka} ${c.model} (${c.rok}) | ${c.palivo} | ${prev} | ${c.href}`
      );
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
