// PP AUTO – promo testovacích jázd na hlavnej/brand stránke.
(function () {
  'use strict';

  const finance = document.getElementById('financovanie');
  if (!finance || document.getElementById('testdrive')) return;

  const WHEEL_ICON = `
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="18"></circle>
      <circle cx="24" cy="24" r="4.2"></circle>
      <path d="M7.5 21.5h33"></path>
      <path d="M24 28.2V42"></path>
      <path d="M20.8 27.2 12.6 38"></path>
      <path d="m27.2 27.2 8.2 10.8"></path>
      <path d="M12.1 18.5c3.6-5.2 7.6-7.8 11.9-7.8s8.3 2.6 11.9 7.8"></path>
    </svg>
  `;

  function ensureStyles() {
    if (document.querySelector('link[data-testdrive-promo-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/testdrive-promo.css';
    link.dataset.testdrivePromoStyle = '1';
    document.head.appendChild(link);
  }

  function timeOptions() {
    const out = ['<option value="">Vyberte konkrétny čas</option>'];
    for (let h = 8; h <= 16; h += 1) {
      ['00', '30'].forEach((m) => {
        if (h === 16 && m === '30') return;
        const value = `${String(h).padStart(2, '0')}:${m}`;
        out.push(`<option value="${value}">${value}</option>`);
      });
    }
    return out.join('');
  }

  function createSection() {
    const section = document.createElement('section');
    section.id = 'testdrive';
    section.className = 'pp-testdrive';
    section.setAttribute('aria-labelledby', 'testdriveTitle');
    section.innerHTML = `
      <div class="container">
        <div class="pp-testdrive__head">
          <div>
            <span class="pp-testdrive__kicker">Testovacia jazda</span>
            <h3 id="testdriveTitle">Zažite auto skôr, než sa rozhodnete.</h3>
            <p>Vyberte značku, model a termín. Ozveme sa vám a jazdu potvrdíme.</p>
          </div>
          <div class="pp-testdrive__head-icon" aria-hidden="true">${WHEEL_ICON}</div>
        </div>

        <div class="pp-testdrive__layout">
          <aside class="pp-testdrive__summary" aria-label="Súhrn testovacej jazdy">
            <div class="pp-testdrive__summary-icon" aria-hidden="true">${WHEEL_ICON}</div>
            <span class="pp-testdrive__eyebrow">Vaša jazda</span>
            <h4 id="tdPreviewTitle">Vyberte značku a model</h4>
            <p class="pp-testdrive__summary-copy">Stačí niekoľko údajov. Termín vám následne potvrdíme telefonicky alebo e-mailom.</p>

            <div class="pp-testdrive__summary-grid">
              <div><span>Značka</span><strong id="tdSumBrand">—</strong></div>
              <div><span>Model</span><strong id="tdSumModel">—</strong></div>
              <div><span>Dátum</span><strong id="tdSumDate">—</strong></div>
              <div><span>Časť dňa</span><strong id="tdSumSlot">—</strong></div>
              <div><span>Čas</span><strong id="tdSumTime">—</strong></div>
            </div>

            <div class="pp-testdrive__summary-note">
              <strong>Bez záväzkov.</strong>
              <span>Jazda slúži na reálne vyskúšanie vozidla a jeho vlastností.</span>
            </div>
          </aside>

          <form id="testDriveForm" class="pp-testdrive__form">
            <div class="pp-testdrive__step">
              <div class="pp-testdrive__step-head">
                <span>01</span>
                <div>
                  <strong>Vyberte vozidlo</strong>
                  <small>Všetky značky a modely PP AUTO</small>
                </div>
              </div>

              <div id="tdBrandRow" class="pp-testdrive__brands" role="group" aria-label="Výber značky">
                <button type="button" data-td-brand="subaru">Subaru</button>
                <button type="button" data-td-brand="kgm">KGM</button>
                <button type="button" data-td-brand="jeep">Jeep</button>
                <button type="button" data-td-brand="chery">Chery</button>
              </div>
              <input id="tdBrandInput" name="znacka" type="hidden">

              <div class="pp-testdrive__field">
                <label for="tdModel">Model</label>
                <select id="tdModel" name="model" disabled>
                  <option value="">Najprv vyberte značku</option>
                </select>
              </div>

              <div id="tdOtherWrap" class="pp-testdrive__field" hidden>
                <label for="tdModelOther">Iný model</label>
                <input id="tdModelOther" type="text" autocomplete="off" placeholder="Napíšte model">
              </div>
            </div>

            <div class="pp-testdrive__step">
              <div class="pp-testdrive__step-head">
                <span>02</span>
                <div>
                  <strong>Kontakt</strong>
                  <small>Aby sme vám mohli termín potvrdiť</small>
                </div>
              </div>

              <div class="pp-testdrive__fields pp-testdrive__fields--contact">
                <div class="pp-testdrive__field">
                  <label for="tdName">Meno</label>
                  <input id="tdName" name="meno" required autocomplete="name" placeholder="Vaše meno">
                </div>
                <div class="pp-testdrive__field">
                  <label for="tdEmail">E-mail</label>
                  <input id="tdEmail" name="email" required type="email" autocomplete="email" placeholder="vas@email.sk">
                </div>
                <div class="pp-testdrive__field pp-testdrive__field--wide">
                  <label for="tdPhone">Telefón</label>
                  <input id="tdPhone" name="telefon" type="tel" autocomplete="tel" placeholder="+421 ...">
                </div>
              </div>
            </div>

            <div class="pp-testdrive__step">
              <div class="pp-testdrive__step-head">
                <span>03</span>
                <div>
                  <strong>Preferovaný termín</strong>
                  <small>Vyberte dátum a približný čas</small>
                </div>
              </div>

              <div class="pp-testdrive__fields">
                <div class="pp-testdrive__field">
                  <label for="tdDate">Dátum</label>
                  <input id="tdDate" name="datum" type="date">
                </div>
                <div class="pp-testdrive__field">
                  <label for="tdSlot">Časť dňa</label>
                  <select id="tdSlot" name="cas_dna">
                    <option value="">Nezáleží</option>
                    <option value="Dopoludnia">Dopoludnia</option>
                    <option value="Popoludní">Popoludní</option>
                    <option value="Konkrétny čas">Konkrétny čas</option>
                  </select>
                </div>
                <div id="tdTimeRow" class="pp-testdrive__field pp-testdrive__field--wide" hidden>
                  <label for="tdTime">Konkrétny čas</label>
                  <select id="tdTime" name="konkretny_cas">${timeOptions()}</select>
                </div>
              </div>
            </div>

            <div class="pp-testdrive__step pp-testdrive__step--last">
              <div class="pp-testdrive__field">
                <label for="tdNote">Poznámka <span>(voliteľné)</span></label>
                <textarea id="tdNote" name="poznamka" rows="4" placeholder="Máte otázku alebo špeciálnu požiadavku?"></textarea>
              </div>

              <input class="pp-hidden-field" name="website" tabindex="-1" autocomplete="off">
              <textarea id="tdMessage" name="sprava" class="pp-hidden-field" tabindex="-1" aria-hidden="true"></textarea>

              <label class="form-privacy pp-testdrive__privacy">
                <input type="checkbox" required>
                <span>
                  Beriem na vedomie, že PP AUTO s.r.o. spracúva moje údaje za účelom vybavenia žiadosti o testovaciu jazdu.
                  Viac informácií nájdete v dokumente
                  <a href="/gdpr.html" target="_blank" rel="noopener">Ochrana osobných údajov</a>.
                </span>
              </label>

              <div class="pp-testdrive__submit-row">
                <button class="btn primary pp-testdrive__submit" id="tdSubmit" type="submit">Objednať testovaciu jazdu</button>
                <div class="form-status pp-testdrive__status" id="tdStatus" aria-live="polite"></div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    finance.insertAdjacentElement('afterend', section);
    return section;
  }

  function createFloatingCta(section) {
    const link = document.createElement('a');
    link.className = 'pp-testdrive-fab';
    link.href = '#testdrive';
    link.setAttribute('aria-label', 'Objednajte si testovaciu jazdu');
    link.innerHTML = `
      <span class="pp-testdrive-fab__icon">${WHEEL_ICON}</span>
      <span class="pp-testdrive-fab__copy">
        <small>Vyskúšajte si auto</small>
        <strong>Objednajte si testovaciu jazdu</strong>
      </span>
    `;
    document.body.appendChild(link);

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        link.classList.toggle('is-section-visible', entries.some(entry => entry.isIntersecting));
      }, { threshold: 0.12 });
      io.observe(section);
    }
  }

  function scrollToRequestedSection(section) {
    if (location.hash !== '#testdrive') return;

    // Sekcia vzniká až za behu JS, preto natívny hash pri prvom načítaní
    // nemusí mať cieľ. Po vložení ju doscrollujeme explicitne.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function requestedVehiclePreset() {
    const params = new URLSearchParams(location.search);
    const brand = String(params.get('td_brand') || '').toLowerCase().trim();
    const model = String(params.get('td_model') || '').trim();
    if (!['subaru', 'kgm', 'jeep', 'chery'].includes(brand) || !model) return null;
    return { brand, model };
  }

  function applyRequestedVehiclePreset() {
    const preset = requestedVehiclePreset();
    if (!preset) return;

    let attempts = 0;
    const maxAttempts = 80;

    const tryApply = () => {
      attempts += 1;
      const brandButton = document.querySelector(`#tdBrandRow [data-td-brand="${preset.brand}"]`);
      const modelSelect = document.getElementById('tdModel');
      const otherWrap = document.getElementById('tdOtherWrap');
      const otherInput = document.getElementById('tdModelOther');

      if (!brandButton || !modelSelect) {
        if (attempts < maxAttempts) setTimeout(tryApply, 75);
        return;
      }

      if (!brandButton.classList.contains('is-active')) brandButton.click();

      if (modelSelect.disabled || modelSelect.options.length <= 1) {
        if (attempts < maxAttempts) setTimeout(tryApply, 75);
        return;
      }

      const exactOption = Array.from(modelSelect.options).find(option =>
        option.value && option.value !== '__other__' &&
        option.value.localeCompare(preset.model, 'sk', { sensitivity: 'accent' }) === 0
      );

      if (exactOption) {
        modelSelect.value = exactOption.value;
        modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }

      const otherOption = Array.from(modelSelect.options).find(option => option.value === '__other__');
      if (otherOption && otherWrap && otherInput) {
        modelSelect.value = '__other__';
        modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
        otherInput.value = preset.model;
        otherInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      if (attempts < maxAttempts) setTimeout(tryApply, 75);
    };

    tryApply();
  }

  function loadScriptOnce(src, marker) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[${marker}]`);
      if (existing) {
        if (existing.dataset.loaded === '1') resolve();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.setAttribute(marker, '1');
      script.addEventListener('load', () => {
        script.dataset.loaded = '1';
        resolve();
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureTestDriveLogic() {
    try {
      if (!document.querySelector('script[data-pp-testdrive-logic]')) {
        await loadScriptOnce('/js/testdrive.js', 'data-pp-testdrive-logic');
      }
    } catch (error) {
      console.error('Nepodarilo sa načítať formulár testovacej jazdy', error);
      const status = document.getElementById('tdStatus');
      if (status) status.textContent = 'Formulár sa nepodarilo pripraviť. Obnovte stránku alebo nás kontaktujte telefonicky.';
    }
  }

  ensureStyles();
  const section = createSection();
  createFloatingCta(section);
  scrollToRequestedSection(section);
  ensureTestDriveLogic();
  applyRequestedVehiclePreset();
})();
