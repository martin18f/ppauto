const { chromium } = require('playwright');

const EUROTIP_URL =
  'https://eurotip-vozidla.sk/?field_zna_ka_tid_selective=1214';

// ⬇️ SEM DAJ TVOJU ADRESU ADMIN PANELU
const ADMIN_URL = 'https://ppauto.sk/admin.html';

// --- helper: normalizácia prevodovky + výbavy (MOŽNOSŤ A)
function buildPrevodovka(title, rawGearbox) {
  let at = '';
  if (rawGearbox.toLowerCase().includes('automat')) {
    at = 'AT';
  }

  // výbava z názvu
  const knownTrims = [
    'First Edition',
    'Altitude',
    'Summit',
    'Limited',
    'Longitude',
    'Trailhawk',
    'Overland',
    'S'
  ];

  let trim = '';
  for (const t of knownTrims) {
    if (title.toLowerCase().includes(t.toLowerCase())) {
      trim = t;
      break;
    }
  }

  if (at && trim) return `${at} • ${trim}`;
  if (at) return at;
  if (trim) return trim;
  return rawGearbox.trim();
}

(async () => {
  const browser = await chromium.launch({
    headless: false, // 🔁 prepni na false ak chceš vidieť čo robí
    slowMo: 0
  });

  const page = await browser.newPage();

  // =====================================================
  // 1️⃣ EUROTIP – EXTRAKCIA
  // =====================================================
  console.log('🔍 Načítavam Eurotip…');
  await page.goto(EUROTIP_URL, { waitUntil: 'networkidle' });

  await page.waitForSelector('.views-row');

  const cars = await page.$$eval('.views-row', rows =>
    rows.map(row => {
      const get = sel =>
        row.querySelector(sel)?.textContent?.trim() || '';

      const title = get('.views-field-title a');
      const znacka = get('.views-field-field-zna-ka .field-content');
      const model = get('.views-field-field-model .field-content');
      const rok = get('.views-field-field-rok .field-content');
      const palivo = get('.views-field-field-palivo .field-content');
      const prevodovkaRaw = get(
        '.views-field-field-prevodovka .field-content'
      );

      return {
        title,
        znacka,
        model,
        rok,
        palivo,
        prevodovkaRaw
      };
    })
  );

  console.log(`✅ Nájdených áut: ${cars.length}`);

  // =====================================================
  // 2️⃣ ADMIN PANEL – VYPLNENIE + SUBMIT
  // =====================================================
  for (const car of cars) {
    const prevodovka = buildPrevodovka(
      car.title,
      car.prevodovkaRaw
    );

    console.log(
      `➡️ Pridávam: ${car.znacka} ${car.model} (${car.rok})`
    );

    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#carForm');

    await page.fill('#znacka', car.znacka);
    await page.fill('#model', car.model);
    await page.fill('#rok', car.rok);
    await page.fill('#palivo', car.palivo);
    await page.fill('#prevodovka', prevodovka);

    // TAGY – vždy jeep
    await page.fill('#tagy', 'jeep');

    // SUBMIT
    await page.evaluate(() => {
      document
        .querySelector('#carForm')
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true })
        );
    });

    // rezerva pre API
    await page.waitForTimeout(1200);
  }

  await browser.close();
  console.log('🎉 HOTOVO – všetky autá spracované');
})();
