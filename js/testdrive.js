// Testovacia jazda – logika sekcie #jazda
(function () {
  function isKnownBrand(b) {
    return b === 'subaru' || b === 'kgm' || b === 'jeep';
  }

  function brandLabel(b) {
    if (b === 'subaru') return 'Subaru';
    if (b === 'kgm') return 'KGM';
    if (b === 'jeep') return 'Jeep';
    return b || '';
  }

  function safeLower(v) {
    return String(v || '').toLowerCase().trim();
  }

  function getBrandFromDOM() {
    const b = document.documentElement.getAttribute('data-brand');
    return isKnownBrand(safeLower(b)) ? safeLower(b) : null;
  }

  function getBrandFromStorage() {
    try {
      const b = safeLower(localStorage.getItem('ppauto.brand'));
      return isKnownBrand(b) ? b : null;
    } catch (e) {
      try {
        const b = safeLower(sessionStorage.getItem('ppauto.brand'));
        return isKnownBrand(b) ? b : null;
      } catch (e2) {
        return null;
      }
    }
  }

  function getBrandFromURL() {
    const raw = new URLSearchParams(location.search).get('brand');
    const b = safeLower(raw);
    return isKnownBrand(b) ? b : null;
  }

  function api(path) {
    // ak už máš globálnu apiUrl() niekde inde, využijeme ju
    try {
      if (typeof window.apiUrl === 'function') return window.apiUrl(path);
    } catch (e) {}
    return path;
  }

  document.addEventListener('DOMContentLoaded', async () => {
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

    // EmailJS – bezpečne init (kľudne aj keď už je initnuté inde)
    if (window.emailjs && typeof window.emailjs.init === 'function' && !window.__ppEmailJSInited) {
      window.emailjs.init({ publicKey: '_7xrgG31AEooF0kcr' });
      window.__ppEmailJSInited = true;
    }

    // 1) Načítaj autá a sprav mapu brand -> modely
    let modelMap = new Map();
    try {
      const r = await fetch(api('/api/cars'));
      if (r.ok) {
        const cars = await r.json();
        const tmp = new Map();

        (cars || []).forEach((c) => {
          const b = safeLower(c && c.znacka);
          const m = String(c && c.model || '').trim();
          if (!isKnownBrand(b) || !m) return;

          if (!tmp.has(b)) tmp.set(b, new Set());
          tmp.get(b).add(m);
        });

        // set -> array (sorted)
        tmp.forEach((set, b) => {
          modelMap.set(b, Array.from(set).sort((a, d) => a.localeCompare(d, 'sk')));
        });
      }
    } catch (e) {
      // nič – fallback bude „Iný model“
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
      brandInput.value = b ? brandLabel(b) : '';

      // chip active
      if (brandRow) {
        brandRow.querySelectorAll('[data-td-brand]').forEach((btn) => {
          btn.classList.toggle('is-active', btn.getAttribute('data-td-brand') === b);
        });
      }

      // reset model
      state.model = '';
      populateModels(b);
      setPreview();
    }

    function setModel(m) {
      state.model = String(m || '').trim();
      setPreview();
    }

    // brand click
    if (brandRow) {
      brandRow.querySelectorAll('[data-td-brand]').forEach((b) => {
        b.addEventListener('click', () => setBrand(b.getAttribute('data-td-brand')));
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
      setModel(v);
    });

    otherInput.addEventListener('input', () => {
      if (!otherWrap.hidden) setModel(otherInput.value);
    });

    // termín
    dateInput.addEventListener('change', () => {
      state.date = dateInput.value || '';
      setPreview();
    });

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

    // predvyplnenie brandu (DOM -> URL -> storage)
    const preBrand = getBrandFromDOM() || getBrandFromURL() || getBrandFromStorage();
    if (preBrand) setBrand(preBrand);
    else {
      populateModels(null);
      setPreview();
    }

    // submit – poskladáme správu do hidden `sprava` a pošleme cez EmailJS
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

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
      const noteTxt = String(note.value || '').trim();
      if (noteTxt) {
        lines.push('');
        lines.push('Poznámka:');
        lines.push(noteTxt);
      }
      lines.push('');
      lines.push(`Stránka: ${location.href}`);

      message.value = lines.join('\n');

      // UI
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = 'Odosielam…';
      if (status) status.textContent = '';

      try {
        if (!window.emailjs || typeof window.emailjs.sendForm !== 'function') {
          throw new Error('EmailJS nie je načítaný');
        }

        const contactNumber = Math.floor(Math.random() * 100000);

        await window.emailjs.sendForm(
          'service_i68hphn',
          'template_ntrqrhh',
          form,
          { contact_number: contactNumber }
        );

        if (status) status.textContent = 'Ďakujeme! Ozveme sa vám kvôli potvrdeniu termínu.';
        form.reset();

        // reset state
        state.model = '';
        state.date = '';
        state.slot = '';
        state.time = '';
        otherWrap.hidden = true;
        timeRow.hidden = true;

        // v brand režime nechávame značku, inak resetneme aj značku
        const keepBrand = !!getBrandFromDOM();
        if (!keepBrand) {
          setBrand(null);
          brandInput.value = '';
        } else {
          // znovu naplň modely pre brand
          populateModels(state.brand);
        }

        setPreview();
      } catch (err) {
        console.error(err);
        if (status) status.textContent = 'Nepodarilo sa odoslať. Skúste neskôr.';
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  });
})();
