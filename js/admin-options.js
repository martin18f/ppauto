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

  const PARAMETER_GROUPS = [
    {
      key: 'identity',
      title: 'Základné údaje',
      fields: ['znacka', 'model'],
    },
    {
      key: 'powertrain',
      title: 'Pohon',
      fields: ['palivo', 'typ_prevodovky', 'pohon'],
    },
    {
      key: 'configuration',
      title: 'Vyhotovenie',
      fields: ['karoseria', 'vybava_paket', 'farba'],
    },
  ];

  let adminOptions = {
    version: 1,
    fields: {},
    models: {},
  };

  const busyFields = new Set();

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

  function cloneOptions(value = adminOptions) {
    return JSON.parse(JSON.stringify(value || { version: 1, fields: {}, models: {} }));
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

  function organizeParameterLayout() {
    if (form.querySelector('.vehicle-parameters-panel')) return;

    const firstField = choiceFieldElement('znacka');
    const anchorRow = firstField?.closest('.row');
    if (!firstField || !anchorRow) return;

    const sourceRows = new Set();
    MANAGED_FIELDS.forEach(name => {
      const field = choiceFieldElement(name);
      const row = field?.closest('.row');
      if (row) sourceRows.add(row);
    });

    const panel = document.createElement('section');
    panel.className = 'vehicle-parameters-panel';
    panel.setAttribute('aria-labelledby', 'vehicleParametersTitle');

    const header = document.createElement('div');
    header.className = 'vehicle-parameters-header';
    header.innerHTML = `
      <div>
        <h3 id="vehicleParametersTitle">Parametre vozidla</h3>
        <p>Vyber hodnotu alebo uprav dostupné možnosti.</p>
      </div>
    `;
    panel.appendChild(header);

    PARAMETER_GROUPS.forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'vehicle-parameter-group';
      groupEl.dataset.group = group.key;

      const title = document.createElement('div');
      title.className = 'vehicle-parameter-group__title';
      title.textContent = group.title;
      groupEl.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'vehicle-parameter-group__grid';

      group.fields.forEach(name => {
        const field = choiceFieldElement(name);
        if (field) grid.appendChild(field);
      });

      groupEl.appendChild(grid);
      panel.appendChild(groupEl);
    });

    form.insertBefore(panel, anchorRow);

    // Po presunutí výberových polí odstránime prázdne riadky.
    // Riadky, v ktorých zostalo napr. iba „Rok“ alebo „Najazdené“,
    // zmeníme na jeden stĺpec, aby nevznikali prázdne polovice formulára.
    sourceRows.forEach(row => {
      if (!row.children.length) {
        row.remove();
        return;
      }
      if (!row.querySelector('.choice-control')) {
        row.classList.add('vehicle-parameter-source-row');
        if (row.children.length === 1) {
          row.classList.add('vehicle-parameter-source-row--single');
        }
      }
    });
  }

  function applyBusyState(name) {
    const field = choiceFieldElement(name);
    if (!field) return;
    const busy = busyFields.has(name);
    field.classList.toggle('is-busy', busy);
    field.setAttribute('aria-busy', busy ? 'true' : 'false');
    field.querySelectorAll('button').forEach(button => {
      button.disabled = busy;
    });
  }

  function setFieldBusy(name, busy) {
    if (busy) busyFields.add(name);
    else busyFields.delete(name);
    applyBusyState(name);
  }

  function refreshAllChoiceFields() {
    MANAGED_FIELDS.forEach(name => {
      setChoiceOptions(name, buildOptionsForField(name));
      applyBusyState(name);
    });
  }

  function addLocalOption(name, value, brand) {
    const next = cloneOptions();
    next.fields ||= {};
    next.models ||= {};

    if (name === 'model') {
      const brandKey = Object.keys(next.models).find(key => eq(key, brand)) || brand;
      next.models[brandKey] = unique([...(next.models[brandKey] || []), value]);
    } else {
      next.fields[name] = unique([...(next.fields[name] || []), value]);
      if (name === 'znacka') {
        const existingKey = Object.keys(next.models).find(key => eq(key, value));
        if (!existingKey) next.models[value] = [];
      }
    }

    adminOptions = next;
  }

  function deleteLocalOption(name, value, brand) {
    const next = cloneOptions();
    next.fields ||= {};
    next.models ||= {};

    if (name === 'model') {
      const key = Object.keys(next.models).find(item => eq(item, brand));
      if (key) next.models[key] = unique(next.models[key]).filter(item => !eq(item, value));
    } else {
      next.fields[name] = unique(next.fields[name]).filter(item => !eq(item, value));
      if (name === 'znacka') {
        const modelKey = Object.keys(next.models).find(key => eq(key, value));
        if (modelKey) delete next.models[modelKey];
      }
    }

    adminOptions = next;
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
      alert('Nepodarilo sa načítať uložené možnosti parametrov.');
    }
  }

  async function addOption(name) {
    if (busyFields.has(name)) return;

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

    const previousOptions = cloneOptions();
    const previousValue = clean(form.elements[name]?.value);

    addLocalOption(name, trimmed, brand);
    refreshAllChoiceFields();
    if (name === 'znacka') syncBrandInputs(trimmed);
    setChoiceValue(name, trimmed, { emit: true });
    setFieldBusy(name, true);

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
      adminOptions = previousOptions;
      refreshAllChoiceFields();
      setChoiceValue(name, previousValue, { emit: true });
      console.error('Pridanie možnosti zlyhalo', error);
      alert(error.message || 'Pridanie možnosti zlyhalo.');
    } finally {
      setFieldBusy(name, false);
    }
  }

  async function deleteOption(name, value) {
    if (busyFields.has(name)) return;

    const brand = name === 'model' ? currentBrandLabel() : '';
    const previousOptions = cloneOptions();
    const previousValue = clean(form.elements[name]?.value);
    const wasSelected = eq(previousValue, value);

    // Bez potvrdzovacieho dialógu: klik na × je samotná mazacia akcia.
    // UI reaguje okamžite a pri chybe servera sa pôvodný stav obnoví.
    deleteLocalOption(name, value, brand);
    if (wasSelected) setChoiceValue(name, '', { emit: true });
    refreshAllChoiceFields();
    if (name === 'znacka') syncBrandInputs(currentBrandLabel());
    setFieldBusy(name, true);

    try {
      const payload = await requestOptions('/api/options', {
        method: 'DELETE',
        body: JSON.stringify({ field: name, value, ...(brand ? { brand } : {}) }),
      });
      adminOptions = payload;
      if (wasSelected) setChoiceValue(name, '', { emit: true });
      refreshAllChoiceFields();
      if (name === 'znacka') syncBrandInputs(currentBrandLabel());
    } catch (error) {
      adminOptions = previousOptions;
      refreshAllChoiceFields();
      setChoiceValue(name, previousValue, { emit: true });
      console.error('Mazanie možnosti zlyhalo', error);
      alert(error.message || 'Mazanie možnosti zlyhalo.');
    } finally {
      setFieldBusy(name, false);
    }
  }

  function clearLegacyOption(name, value) {
    const input = form.elements[name];
    if (!input || !eq(input.value, value)) return;
    setChoiceValue(name, '', { emit: true });
    refreshAllChoiceFields();
  }

  renderChoiceField = function renderDynamicChoiceField(name) {
    const field = choiceFieldElement(name);
    const input = form.elements[name];
    const buttons = field?.querySelector('.choice-buttons');
    if (!field || !input || !buttons) return;

    const settings = CHOICE_SETTINGS[name] || {};
    const values = choiceOptions.get(name) || [];
    const selected = clean(input.value);
    buttons.innerHTML = '';

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
      button.addEventListener('click', () => {
        if (active && settings.allowEmpty) {
          setChoiceValue(name, '', { emit: true });
          return;
        }
        setChoiceValue(name, value, { emit: true });
      });
      wrapper.appendChild(button);

      const persisted = isPersisted(name, value);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'choice-option-delete';
      remove.textContent = '×';
      remove.title = persisted ? `Zmazať „${value}“` : `Odstrániť „${value}“ z formulára`;
      remove.setAttribute('aria-label', persisted ? `Zmazať ${value}` : `Odstrániť ${value} z formulára`);
      remove.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (persisted) deleteOption(name, value);
        else clearLegacyOption(name, value);
      });
      wrapper.appendChild(remove);

      if (!persisted) wrapper.classList.add('is-legacy');
      buttons.appendChild(wrapper);
    });

    if (!values.length && name === 'model') {
      const note = document.createElement('span');
      note.className = 'choice-empty-note';
      note.textContent = currentBrandLabel()
        ? 'Zatiaľ nie je pridaný žiadny model.'
        : 'Najprv vyber značku.';
      buttons.appendChild(note);
    }

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'choice-option choice-option--add';
    add.textContent = '+ Pridať';
    add.addEventListener('click', () => addOption(name));
    buttons.appendChild(add);

    applyBusyState(name);
  };

  refreshChoiceOptionsFromCars = function refreshDynamicChoiceOptions() {
    refreshAllChoiceFields();
    syncBrandInputs(currentBrandLabel());
  };

  syncBrandInputs = function syncDynamicBrandInputs(brand) {
    const current = clean(brand || form.elements.znacka?.value);
    const modelInput = form.elements.model;
    const selectedModel = clean(modelInput?.value);
    const key = findBrandKey(current);
    const models = current ? unique(adminOptions.models?.[key] || []) : [];
    setChoiceOptions('model', [...models, ...(selectedModel ? [selectedModel] : [])]);
    applyBusyState('model');
  };

  normalizeModelForBrand = function normalizeDynamicModelForBrand(_brand, model) {
    const raw = clean(model);
    const values = persistedValuesFor('model');
    return values.find(item => eq(item, raw)) || raw;
  };

  form.elements.znacka?.addEventListener('change', () => {
    syncBrandInputs(currentBrandLabel());
  });

  organizeParameterLayout();
  loadAdminOptions();
})();
