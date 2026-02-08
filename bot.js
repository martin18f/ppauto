const { chromium } = require('playwright');

const auto = {
  znacka: "Jeep",
  model: "Avenger",
  rok: 2025,
  palivo: "Elektromotor",
  prevodovka: "AT • Altitude • 54 kWh"
};

(async () => {
  const browser = await chromium.launch({
    headless: false,     // 🔥 beží na pozadí
    slowMo: 300
  });

  const page = await browser.newPage();

  // ⬇️ URL admin panelu
  await page.goto('https://ppauto.sk/admin.html', { waitUntil: 'networkidle' });

  await page.waitForSelector('#carForm');

  // --- VYPLNENIE POLÍ ---
  await page.fill('#znacka', auto.znacka);
  await page.fill('#model', auto.model);
  await page.fill('#rok', String(auto.rok));
  await page.fill('#palivo', auto.palivo);
  await page.fill('#prevodovka', auto.prevodovka);

  // --- SUBMIT (ULOŽIŤ) ---
  await page.evaluate(() => {
    document
      .querySelector('#carForm')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  // malá rezerva pre API / GitHub
  await page.waitForTimeout(1200);

  await browser.close();
})();
