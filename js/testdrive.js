// Testovacia jazda – logika sekcie #jazda
(function () {
  function isKnownBrand(b) {
    return b === 'subaru' || b === 'kgm' || b === 'jeep' || b === 'chery';
  }

  function brandLabel(b) {
    if (b === 'subaru') return 'Subaru';
    if (b === 'kgm') return 'KGM';
    if (b === 'jeep') return 'Jeep';
    if (b === 'chery') return 'Chery';
    return b || '';
  }

  function safeLower(v) {
    return String(v || '').toLowerCase().trim();
  }

  function getBrandFromDOM() {
    const b = document.documentElement.getAttribute('data-brand');
    const s = safeLower(b);
    return isKnownBrand(s) ? s : null;
  }

  function getBrandFromURL() {
    const raw = new URLSearchParams(location.search).get('brand');
    const b = safeLower(raw);
    return isKnownBrand(b) ? b : null;
  }

  function api(path) {
    try {
      if (typeof window.apiUrl === 'function') return window.apiUrl(path);
    } catch (e) {}
    return path;
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  whenReady(async function init() {
    const form = document.getElementById('testDriveForm');
    if (!form) return;

    const brandRow = document.getElementById('tdBrandRow');
    const brandInput = document.getElementById('tdBrandInput');

    const modelSelect = document.getElementById('tdModel');
    const otherWrap = document.getElementById('tdOtherWrap');
    const otherInput = document.getElementById('tdModelOther');

    const dateInput = document.getElementById('tdDate');
    const slotSelect = document.getElementById('tdSlot');
    const timeRow = document.getElementById('tdTimeRow');
    const timeSelect = document.getElementById('tdTime');

    const note = document.getElementById('tdNote');
    const message = document.getElementById('tdMessage');

    const btn = document.getElementById('tdSubmit');
    const status = document.getElementById('tdStatus');

    // preview
    const pTitle = document.getElementById('tdPreviewTitle');
    const pBrand = document.getElementById('tdSumBrand');
    const pModel = document.getElementById('tdSumModel');
    const pDate = document.getElementById('tdSumDate');
    const pSlot = document.getElementById('tdSumSlot');
    const pTime = document.getElementById('tdSumTime');

    // Povinné minimálne elementy (inak skript nemá zmysel)
    if (!modelSelect || !otherWrap || !otherInput || !slotSelect || !timeRow || !timeSelect || !message) {
      console.warn('[testdrive] Chýbajú elementy formulára (ID). Skontroluj HTML.');
      return;
    }

    // EmailJS – bezpečne init
    if (window.emailjs && typeof window.emailjs.init === 'function' && !window.__ppEmailJSInited) {
      try {
        window.emailjs.init({ publicKey: '_7xrgG31AEooF0kcr' });
        window.__ppEmailJSInited = true;
      } catch (e) {}
    }

    // (voliteľné) min dátum = dnes
    if (dateInput) {
      try {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateInput.min = `${yyyy}-${mm}-${dd}`;
      } catch (e) {}
    }

    // 1) Načítaj modely z konfigurácie adminu aj z reálnych áut.
    // Konfigurácia zabezpečí, že vo formulári sú aj modely, ktoré práve nie sú skladom.
    let modelMap = new Map();
    try {
      const tmp = new Map();

      function addModel(brand, model) {
        const b = safeLower(brand);
        const m = String(model || '').trim();
        if (!isKnownBrand(b) || !m) return;
        if (!tmp.has(b)) tmp.set(b, new Set());
        tmp.get(b).add(m);
      }

      const [carsResult, optionsResult] = await Promise.allSettled([
        fetch(api('/api/cars'), { cache: 'no-store' }),
        fetch(api('/api/options'), { cache: 'no-store' }),
      ]);

      if (carsResult.status === 'fulfilled' && carsResult.value.ok) {
        const cars = await carsResult.value.json().catch(() => []);
        const list = Array.isArray(cars) ? cars : [];
        list.forEach((c) => {
          if (c && c.skryte === true) return;
          addModel(c && c.znacka, c && c.model);
        });
      }

      if (optionsResult.status === 'fulfilled' && optionsResult.value.ok) {
        const options = await optionsResult.value.json().catch(() => ({}));
        const models = options && typeof options.models === 'object' ? options.models : {};
        Object.entries(models || {}).forEach(([brand, values]) => {
          (Array.isArray(values) ? values : []).forEach((model) => addModel(brand, model));
        });
      }

      tmp.forEach((set, b) => {
        modelMap.set(b, Array.from(set).sort((x, y) => x.localeCompare(y, 'sk')));
      });
    } catch (e) {
      // fallback bude „Iný model“
    }

    // state
    const state = {
      brand: null,
      model: '',
      date: '',
      slot: '',
      time: ''
    };

    function setPreview() {
      const bTxt = state.brand ? brandLabel(state.brand) : '—';
      const mTxt = state.model ? state.model : '—';
      const dTxt = state.date ? state.date : '—';
      const sTxt = state.slot ? state.slot : '—';
      const tTxt = state.time ? state.time : '—';

      if (pBrand) pBrand.textContent = bTxt;
      if (pModel) pModel.textContent = mTxt;
      if (pDate) pDate.textContent = dTxt;
      if (pSlot) pSlot.textContent = sTxt;
      if (pTime) pTime.textContent = tTxt;

      if (pTitle) {
        if (state.brand && state.model) pTitle.textContent = `${brandLabel(state.brand)} • ${state.model}`;
        else if (state.brand) pTitle.textContent = `${brandLabel(state.brand)} • vyberte model`;
        else pTitle.textContent = `Vyberte značku a model`;
      }
    }

    function populateModels(brand) {
      const models = modelMap.get(brand) || [];
      modelSelect.innerHTML = '';

      if (!brand) {
        modelSelect.innerHTML = `<option value="">Najprv vyberte značku</option>`;
        modelSelect.disabled = true;
        otherWrap.hidden = true;
        otherInput.value = '';
        return;
      }

      modelSelect.disabled = false;

      const first = document.createElement('option');
      first.value = '';
      first.textContent = models.length ? 'Vyberte model' : 'Modely sa nepodarilo načítať – zvoľte Iný';
      modelSelect.appendChild(first);

      models.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });

      const other = document.createElement('option');
      other.value = '__other__';
      other.textContent = 'Iný (napísať)';
      modelSelect.appendChild(other);

      otherWrap.hidden = true;
      otherInput.value = '';
    }

    function setBrand(b) {
      state.brand = b;

      if (brandInput) brandInput.value = b ? brandLabel(b) : '';

      // chip active
      if (brandRow) {
        brandRow.querySelectorAll('[data-td-brand]').forEach((btnEl) => {
          btnEl.classList.toggle('is-active', btnEl.getAttribute('data-td-brand') === b);
        });
      }

      // reset model
      state.model = '';
      populateModels(b);

      // vyčisti “Iný”
      otherWrap.hidden = true;
      otherInput.value = '';

      setPreview();
    }

    function setModel(m) {
      state.model = String(m || '').trim();
      setPreview();
    }

    // brand click
    if (brandRow) {
      brandRow.querySelectorAll('[data-td-brand]').forEach((btnEl) => {
        btnEl.addEventListener('click', () => setBrand(btnEl.getAttribute('data-td-brand')));
      });
    }

    // model change
    modelSelect.addEventListener('change', () => {
      const v = modelSelect.value;
      if (v === '__other__') {
        otherWrap.hidden = false;
        setModel('');
        otherInput.focus();
        return;
      }
      otherWrap.hidden = true;
      otherInput.value = '';
      setModel(v);
    });

    otherInput.addEventListener('input', () => {
      if (!otherWrap.hidden) setModel(otherInput.value);
    });

    // termín
    if (dateInput) {
      dateInput.addEventListener('change', () => {
        state.date = dateInput.value || '';
        setPreview();
      });
    }

    slotSelect.addEventListener('change', () => {
      state.slot = slotSelect.value || '';
      const wantsExact = state.slot === 'Konkrétny čas';
      timeRow.hidden = !wantsExact;

      if (!wantsExact) {
        state.time = '';
        timeSelect.value = '';
      }
      setPreview();
    });

    timeSelect.addEventListener('change', () => {
      state.time = timeSelect.value || '';
      setPreview();
    });

    // predvyplnenie brandu (DOM -> URL)
    const preBrand = getBrandFromDOM() || getBrandFromURL();
    if (preBrand) setBrand(preBrand);
    else {
      populateModels(null);
      setPreview();
    }

    function resetUIAfterSend() {
      // reset “other” a “time”
      otherWrap.hidden = true;
      otherInput.value = '';
      timeRow.hidden = true;
      timeSelect.value = '';

      // reset state okrem brandu (brand riešime nižšie)
      state.model = '';
      state.date = '';
      state.slot = '';
      state.time = '';

      setPreview();
    }

    // submit – poskladáme správu do hidden `sprava` a pošleme cez EmailJS
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (status) status.textContent = '';

      // základná validácia výberu auta
      if (!state.brand) {
        if (status) status.textContent = 'Vyberte značku.';
        return;
      }
      if (!state.model) {
        if (status) status.textContent = 'Vyberte model (alebo zvoľte „Iný“).';
        return;
      }

      // anti-spam honeypot
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      if (payload.website) {
        if (status) status.textContent = 'Ďakujeme! Správa bola odoslaná.';
        form.reset();
        resetUIAfterSend();
        return;
      }

      // poskladať text správy do emailjs template poľa `sprava`
      const lines = [];
      lines.push('Žiadosť o TESTOVACIU JAZDU');
      lines.push('--------------------------');
      lines.push(`Značka: ${brandLabel(state.brand)}`);
      lines.push(`Model: ${state.model}`);
      if (state.date) lines.push(`Preferovaný dátum: ${state.date}`);
      if (state.slot) lines.push(`Časť dňa: ${state.slot}`);
      if (state.time) lines.push(`Konkrétny čas: ${state.time}`);

      const noteTxt = String((note && note.value) || '').trim();
      if (noteTxt) {
        lines.push('');
        lines.push('Poznámka:');
        lines.push(noteTxt);
      }
      lines.push('');
      lines.push(`Stránka: ${location.href}`);

      message.value = lines.join('\n');

      // UI
      if (btn) btn.disabled = true;
      const oldText = btn ? btn.textContent : '';
      if (btn) btn.textContent = 'Odosielam…';

      try {
        if (!window.emailjs || typeof window.emailjs.sendForm !== 'function') {
          throw new Error('EmailJS nie je načítaný');
        }

        const contactNumber = Math.floor(Math.random() * 100000);

        await window.emailjs.sendForm(
          'service_i68hphn',
          'template_testdrive',
          form,
          { contact_number: contactNumber }
        );

        if (status) status.textContent = 'Ďakujeme! Ozveme sa vám kvôli potvrdeniu termínu.';
        form.reset();
        resetUIAfterSend();

        // v brand režime nechávame značku, inak resetneme aj značku
        const keepBrand = !!getBrandFromDOM();
        if (keepBrand) {
          setBrand(state.brand);
        } else {
          setBrand(null);
        }
      } catch (err) {
        console.error(err);
        if (status) status.textContent = 'Nepodarilo sa odoslať. Skúste neskôr.';
      } finally {
        if (btn) btn.disabled = false;
        if (btn) btn.textContent = oldText;
      }
    });
  });
})();
