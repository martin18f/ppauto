// Dynamic admin parameter options for PP AUTO.
// Load this AFTER the existing inline admin script.
(function () {
  'use strict';

  const MANAGED_FIELDS = [
    'znacka',
    'model',
    'palivo',
    'typ_prevodovky',
    'vybava_paket',
    'karoseria',
    'pohon',
    'farba',
  ];

  let adminOptions = {
    version: 1,
    fields: {},
    models: {},
  };

  function clean(value) {
    return String(value ?? '').trim();
  }

  function eq(a, b) {
    return clean(a).localeCompare(clean(b), 'sk', { sensitivity: 'accent' }) === 0;
  }

  function unique(values) {
    const out = [];
    for (const raw of Array.isArray(values) ? values : []) {
      const value = clean(raw);
      if (!value || out.some(item => eq(item, value))) continue;
      out.push(value);
    }
    return out;
  }

  function fieldLabel(name) {
    const field = choiceFieldElement(name);
    return clean(field?.querySelector('.choice-label')?.textContent) || name;
  }

  function currentBrandLabel() {
    return clean(form.elements.znacka?.value);
  }

  function findBrandKey(brand) {
    const value = clean(brand);
    return Object.keys(adminOptions.models || {}).find(key => eq(key, value)) || value;
  }

  function persistedValuesFor(name) {
    if (name === 'model') {
      const brand = currentBrandLabel();
      if (!brand) return [];
      const key = findBrandKey(brand);
      return unique(adminOptions.models?.[key] || []);
    }
    return unique(adminOptions.fields?.[name] || []);
  }

  function isPersisted(name, value) {
    return persistedValuesFor(name).some(item => eq(item, value));
  }

  function buildOptionsForField(name) {
    const persisted = persistedValuesFor(name);
    const selected = clean(form.elements[name]?.value);
    return unique([...persisted, ...(selected ? [selected] : [])]);
  }

  function refreshAllChoiceFields() {
    MANAGED_FIELDS.forEach(name => {
      setChoiceOptions(name, buildOptionsForField(name));
    });
  }

  async function requestOptions(url, options) {
    const response = await fetch(apiUrl(url), {
      cache: 'no-store',
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Požiadavka zlyhala (${response.status})`);
    }
    return payload;
  }

  async function loadAdminOptions() {
    try {
      const payload = await requestOptions('/api/options');
      adminOptions = payload && typeof payload === 'object'
        ? payload
        : { version: 1, fields: {}, models: {} };
      refreshAllChoiceFields();
      syncBrandInputs(currentBrandLabel());
    } catch (error) {
      console.error('Nepodarilo sa načítať /api/options', error);
      alert('Nepodarilo sa načítať uložené možnosti parametrov. Admin bude používať aktuálne hodnoty iba do obnovenia stránky.');
    }
  }

  async function addOption(name) {
    const label = fieldLabel(name);
    const brand = name === 'model' ? currentBrandLabel() : '';

    if (name === 'model' && !brand) {
      alert('Najprv vyber značku vozidla.');
      return;
    }

    const value = window.prompt(`Pridať novú možnosť pre „${label}“:`);
    if (value === null) return;
    const trimmed = clean(value);
    if (!trimmed) return;

    if (isPersisted(name, trimmed)) {
      setChoiceValue(name, trimmed, { emit: true });
      return;
    }

    try {
      const payload = await requestOptions('/api/options', {
        method: 'POST',
        body: JSON.stringify({ field: name, value: trimmed, ...(brand ? { brand } : {}) }),
      });
      adminOptions = payload;
      refreshAllChoiceFields();
      if (name === 'znacka') syncBrandInputs(trimmed);
      setChoiceValue(name, trimmed, { emit: true });
    } catch (error) {
      console.error('Pridanie možnosti zlyhalo', error);
      alert(error.message || 'Pridanie možnosti zlyhalo.');
    }
  }

  async function deleteOption(name, value) {
    const label = fieldLabel(name);
    const brand = name === 'model' ? currentBrandLabel() : '';
    const message = name === 'model'
      ? `Odstrániť „${value}“ zo zoznamu modelov značky ${brand}?\n\nExistujúce autá sa nezmenia.`
      : `Odstrániť „${value}“ zo zoznamu „${label}“?\n\nExistujúce autá sa nezmenia.`;

    if (!window.confirm(message)) return;

    try {
      const payload = await requestOptions('/api/options', {
        method: 'DELETE',
        body: JSON.stringify({ field: name, value, ...(brand ? { brand } : {}) }),
      });
      adminOptions = payload;

      // Ak je mazaná hodnota práve vybratá vo formulári, necháme ju dočasne viditeľnú.
      // Tak sa pri editácii starého auta nikdy nestratí jeho pôvodná hodnota.
      refreshAllChoiceFields();
      if (name === 'znacka') syncBrandInputs(currentBrandLabel());
    } catch (error) {
      console.error('Mazanie možnosti zlyhalo', error);
      alert(error.message || 'Mazanie možnosti zlyhalo.');
    }
  }

  // Nahradí pôvodné vykreslenie volieb. Samotná hodnota formulára a save logika zostávajú pôvodné.
  renderChoiceField = function renderDynamicChoiceField(name) {
    const field = choiceFieldElement(name);
    const input = form.elements[name];
    const buttons = field?.querySelector('.choice-buttons');
    if (!field || !input || !buttons) return;

    const settings = CHOICE_SETTINGS[name] || {};
    const values = choiceOptions.get(name) || [];
    const selected = clean(input.value);
    buttons.innerHTML = '';

    if (settings.allowEmpty) {
      const empty = document.createElement('button');
      empty.type = 'button';
      empty.className = 'choice-option choice-option--empty';
      empty.textContent = 'Neuvedené';
      const active = !selected;
      empty.classList.toggle('is-selected', active);
      empty.setAttribute('aria-pressed', active ? 'true' : 'false');
      empty.addEventListener('click', () => setChoiceValue(name, '', { emit: true }));
      buttons.appendChild(empty);
    }

    values.forEach(value => {
      const wrapper = document.createElement('span');
      wrapper.className = 'choice-option-wrap';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-option';
      button.textContent = value;
      button.dataset.choiceValue = value;
      const active = eq(selected, value);
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.addEventListener('click', () => setChoiceValue(name, value, { emit: true }));
      wrapper.appendChild(button);

      if (isPersisted(name, value)) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'choice-option-delete';
        remove.textContent = '×';
        remove.title = `Zmazať „${value}“`;
        remove.setAttribute('aria-label', `Zmazať ${value}`);
        remove.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          deleteOption(name, value);
        });
        wrapper.appendChild(remove);
      } else {
        wrapper.classList.add('is-legacy');
        wrapper.title = 'Hodnota je uložená iba na tomto aute, nie v globálnom zozname.';
      }

      buttons.appendChild(wrapper);
    });

    if (!values.length && name === 'model') {
      const note = document.createElement('span');
      note.className = 'choice-empty-note';
      note.textContent = currentBrandLabel() ? 'Zatiaľ nie je pridaný žiadny model.' : 'Najprv vyber značku.';
      buttons.appendChild(note);
    }

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'choice-option choice-option--add';
    add.textContent = '+ Pridať';
    add.addEventListener('click', () => addOption(name));
    buttons.appendChild(add);
  };

  // Už neťaháme globálne možnosti z existujúcich áut. Staré hodnoty sa zobrazia iba pri editácii konkrétneho auta.
  refreshChoiceOptionsFromCars = function refreshDynamicChoiceOptions() {
    refreshAllChoiceFields();
    syncBrandInputs(currentBrandLabel());
  };

  // Modely sa berú iba z persistentného zoznamu zvoleného brandu + aktuálne editovaná hodnota.
  syncBrandInputs = function syncDynamicBrandInputs(brand) {
    const current = clean(brand || form.elements.znacka?.value);
    const modelInput = form.elements.model;
    const selectedModel = clean(modelInput?.value);
    const key = findBrandKey(current);
    const models = current ? unique(adminOptions.models?.[key] || []) : [];
    setChoiceOptions('model', [...models, ...(selectedModel ? [selectedModel] : [])]);
  };

  normalizeModelForBrand = function normalizeDynamicModelForBrand(_brand, model) {
    const raw = clean(model);
    const values = persistedValuesFor('model');
    return values.find(item => eq(item, raw)) || raw;
  };

  // Pri zmene značky okamžite prepneme modelový zoznam.
  form.elements.znacka?.addEventListener('change', () => {
    syncBrandInputs(currentBrandLabel());
  });

  loadAdminOptions();
})();
