// PP AUTO – spoločný backendový klient pre verejné formuláre.
// Všetky verejné formuláre odosiela vlastný Vercel backend cez /api/orders?mode=form.
(function () {
  'use strict';

  const FORM_IDS = new Set(['contactForm', 'financeForm', 'testDriveForm', 'carTestDriveForm']);
  const state = new WeakMap();

  function clean(value) {
    return String(value ?? '').trim();
  }

  function apiUrl(path) {
    if (location.protocol === 'file:') return `https://ppauto.sk${path}`;
    return `${location.origin}${path}`;
  }

  function newSubmissionId() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (_) {}
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function formState(form) {
    let current = state.get(form);
    if (!current) {
      current = { startedAt: Date.now(), submissionId: '' };
      state.set(form, current);
    }
    return current;
  }

  function resetFormState(form) {
    state.set(form, { startedAt: Date.now(), submissionId: '' });
  }

  function values(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function statusElements(form) {
    const map = {
      contactForm: ['contactSubmit', 'contactStatus'],
      financeForm: ['financeSubmit', 'financeStatus'],
      testDriveForm: ['tdSubmit', 'tdStatus'],
      carTestDriveForm: ['carTdSubmit', 'carTdStatus'],
    };
    const [buttonId, statusId] = map[form.id] || [];
    return {
      button: buttonId ? document.getElementById(buttonId) : null,
      status: statusId ? document.getElementById(statusId) : null,
    };
  }

  function setBusy(form, busy, message) {
    const { button, status } = statusElements(form);
    if (button) {
      if (busy) {
        if (!button.dataset.ppOriginalText) button.dataset.ppOriginalText = button.textContent || '';
        button.disabled = true;
        button.textContent = 'Odosielam…';
      } else {
        button.disabled = false;
        if (button.dataset.ppOriginalText) {
          button.textContent = button.dataset.ppOriginalText;
          delete button.dataset.ppOriginalText;
        }
      }
    }
    if (status && typeof message === 'string') status.textContent = message;
  }

  function setResult(form, message) {
    const { status } = statusElements(form);
    if (status) status.textContent = message;
  }

  function confirmationSuffix(result) {
    return result?.notifications?.customerSent
      ? ' Potvrdenie sme poslali aj na váš e-mail.'
      : '';
  }

  function mainTestDriveData(form, raw) {
    const selectedModel = clean(raw.model);
    const otherModel = clean(document.getElementById('tdModelOther')?.value);
    return {
      name: clean(raw.meno),
      email: clean(raw.email),
      phone: clean(raw.telefon),
      brand: clean(raw.znacka),
      model: selectedModel === '__other__' ? otherModel : (selectedModel || otherModel),
      date: clean(raw.datum),
      slot: clean(raw.cas_dna),
      time: clean(raw.konkretny_cas),
      note: clean(raw.poznamka),
    };
  }

  function detailTestDriveData(raw) {
    return {
      name: clean(raw.meno),
      email: clean(raw.email),
      phone: clean(raw.telefon),
      date: clean(raw.datum),
      slot: clean(raw.cas_okno),
      time: clean(raw.cas),
      note: clean(raw.poznamka),
      carTitle: clean(raw.auto_nazov),
      carId: clean(raw.auto_id),
      carUrl: clean(raw.auto_url) || location.href,
    };
  }

  function payloadFor(form) {
    const raw = values(form);
    const current = formState(form);
    current.submissionId ||= newSubmissionId();

    let type = '';
    let data = {};

    if (form.id === 'contactForm') {
      type = 'contact';
      data = {
        name: clean(raw.meno),
        email: clean(raw.email),
        phone: clean(raw.telefon),
        message: clean(raw.sprava),
      };
    } else if (form.id === 'financeForm') {
      type = 'finance';
      data = {
        name: clean(raw.meno),
        email: clean(raw.email),
        phone: clean(raw.telefon),
        message: clean(raw.sprava),
        calcSummary: clean(document.querySelector('[data-finance-calc]')?.dataset?.financeSummary),
      };
    } else if (form.id === 'testDriveForm') {
      type = 'testdrive';
      data = mainTestDriveData(form, raw);
    } else if (form.id === 'carTestDriveForm') {
      type = 'testdrive';
      data = detailTestDriveData(raw);
    }

    return {
      type,
      submissionId: current.submissionId,
      formStartedAt: current.startedAt,
      website: clean(raw.website),
      data,
      page: location.href,
    };
  }

  function resetMainTestDrive(form, sentBrand) {
    form.reset();
    const brandButton = sentBrand
      ? document.querySelector(`#tdBrandRow [data-td-brand="${CSS.escape(sentBrand.toLowerCase())}"]`)
      : null;
    if (brandButton) {
      // Synchronizuje aj interný state v existujúcej test-drive logike.
      brandButton.click();
    } else {
      const title = document.getElementById('tdPreviewTitle');
      if (title) title.textContent = 'Vyberte značku a model';
      ['tdSumBrand', 'tdSumModel', 'tdSumDate', 'tdSumSlot', 'tdSumTime'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
      });
    }
    const other = document.getElementById('tdOtherWrap');
    const time = document.getElementById('tdTimeRow');
    if (other) other.hidden = true;
    if (time) time.hidden = true;
  }

  function resetAfterSuccess(form, payload) {
    if (form.id === 'testDriveForm') {
      resetMainTestDrive(form, payload.data.brand);
    } else {
      form.reset();
      if (form.id === 'carTestDriveForm') {
        const time = document.getElementById('carTdTimeRow');
        if (time) time.hidden = true;
      }
    }
    resetFormState(form);
  }

  async function submit(form) {
    const payload = payloadFor(form);
    if (!payload.type) return;

    // Honeypot odpovedáme ako úspech bez odoslania.
    if (payload.website) {
      setResult(form, 'Ďakujeme! Správa bola odoslaná.');
      resetAfterSuccess(form, payload);
      return;
    }

    setBusy(form, true, 'Odosielam…');
    try {
      const response = await fetch(apiUrl('/api/orders?mode=form'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(clean(result?.error) || 'Odoslanie sa nepodarilo.');

      const suffix = confirmationSuffix(result);
      const message = form.id.includes('TestDrive') || form.id === 'testDriveForm'
        ? `Ďakujeme! Termín vám potvrdíme telefonicky alebo e-mailom.${suffix}`
        : form.id === 'financeForm'
          ? `Dopyt bol odoslaný. Ozveme sa vám čo najskôr.${suffix}`
          : `Ďakujeme! Správa bola odoslaná.${suffix}`;

      resetAfterSuccess(form, payload);
      setResult(form, message);
    } catch (error) {
      console.error('[PP AUTO form]', error);
      setResult(form, error?.message || 'Odoslanie zlyhalo. Skúste to prosím znova alebo nám zavolajte.');
    } finally {
      setBusy(form, false);
    }
  }

  // Capture fáza je zámerná: zastaví staré submit listenery ešte predtým,
  // než sa k nim udalosť dostane. Po migrácii používa formulár iba vlastný backend.
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !FORM_IDS.has(form.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submit(form);
  }, true);

  document.addEventListener('focusin', (event) => {
    const form = event.target?.closest?.('form');
    if (form && FORM_IDS.has(form.id)) formState(form);
  });
})();
