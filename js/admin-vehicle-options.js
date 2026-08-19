// PP AUTO admin – brand-specific colors, multi-select equipment, automatic promo upload.
// Load AFTER js/admin-options.js and after the original inline admin script.
(function () {
  'use strict';

  const baseRenderChoiceField = renderChoiceField;
  const baseSetChoiceValue = setChoiceValue;
  const baseSyncBrandInputs = syncBrandInputs;

  let scopedOptions = {
    version: 1,
    equipment: [],
    colors: { Subaru: [], KGM: [], Jeep: [], Chery: [] },
  };
  let loaded = false;
  const busy = new Set();

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

  function canonicalBrand(value) {
    const key = clean(value).toLowerCase();
    if (key === 'subaru') return 'Subaru';
    if (key === 'kgm') return 'KGM';
    if (key === 'jeep') return 'Jeep';
    if (key === 'chery') return 'Chery';
    return '';
  }

  function currentBrand() {
    return canonicalBrand(form.elements.znacka?.value);
  }

  function parseEquipment(value) {
    return unique(clean(value).split(/\s*\+\s*/g));
  }

  function equipmentValue(values) {
    return unique(values).join(' + ');
  }

  function selectedEquipment() {
    return parseEquipment(form.elements.vybava_paket?.value);
  }

  function dispatchField(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setEquipment(values, { emit = false } = {}) {
    const input = form.elements.vybava_paket;
    if (!input) return;
    input.value = equipmentValue(values);
    renderChoiceField('vybava_paket');
    if (emit) dispatchField(input);
  }

  function colorValues() {
    const brand = currentBrand();
    return brand ? unique(scopedOptions.colors?.[brand] || []) : [];
  }

  function setFieldBusy(name, value) {
    if (value) busy.add(name);
    else busy.delete(name);
    const field = choiceFieldElement(name);
    if (!field) return;
    field.classList.toggle('is-busy', value);
    field.setAttribute('aria-busy', value ? 'true' : 'false');
    field.querySelectorAll('button').forEach(button => { button.disabled = value; });
  }

  function cloneOptions() {
    return JSON.parse(JSON.stringify(scopedOptions));
  }

  async function api(body) {
    const response = await fetch(apiUrl('/api/vehicle-options'), {
      method: body ? 'POST' : 'GET',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Požiadavka zlyhala (${response.status})`);
    return payload;
  }

  async function mutateOption({ scope, action, value, brand = '' }) {
    const fieldName = scope === 'color' ? 'farba' : 'vybava_paket';
    if (busy.has(fieldName)) return false;

    const previous = cloneOptions();
    const previousEquipment = selectedEquipment();
    const previousColor = clean(form.elements.farba?.value);

    if (scope === 'equipment') {
      scopedOptions.equipment = action === 'add'
        ? unique([...scopedOptions.equipment, value])
        : scopedOptions.equipment.filter(item => !eq(item, value));
      if (action === 'delete' && previousEquipment.some(item => eq(item, value))) {
        setEquipment(previousEquipment.filter(item => !eq(item, value)), { emit: true });
      }
    } else {
      scopedOptions.colors[brand] = action === 'add'
        ? unique([...(scopedOptions.colors[brand] || []), value])
        : (scopedOptions.colors[brand] || []).filter(item => !eq(item, value));
      if (action === 'delete' && eq(previousColor, value)) {
        baseSetChoiceValue('farba', '', { emit: true });
      }
    }

    renderChoiceField(fieldName);
    setFieldBusy(fieldName, true);

    try {
      scopedOptions = await api({ action, scope, value, ...(brand ? { brand } : {}) });
      renderChoiceField(fieldName);
      return true;
    } catch (error) {
      scopedOptions = previous;
      if (scope === 'equipment') setEquipment(previousEquipment, { emit: true });
      else baseSetChoiceValue('farba', previousColor, { emit: true });
      renderChoiceField(fieldName);
      console.error('Scoped vehicle option update failed', error);
      alert(error.message || 'Uloženie možnosti zlyhalo.');
      return false;
    } finally {
      setFieldBusy(fieldName, false);
    }
  }

  function optionWrapper(name, value, selected, persisted, onSelect, onDelete) {
    const wrapper = document.createElement('span');
    wrapper.className = 'choice-option-wrap';
    if (!persisted) wrapper.classList.add('is-legacy');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-option';
    button.textContent = value;
    button.dataset.choiceValue = value;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.addEventListener('click', onSelect);
    wrapper.appendChild(button);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'choice-option-delete';
    remove.textContent = '×';
    remove.title = persisted ? `Zmazať „${value}“` : `Odstrániť „${value}“ z formulára`;
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      onDelete();
    });
    wrapper.appendChild(remove);

    return wrapper;
  }

  function addButton(buttons, handler) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'choice-option choice-option--add';
    add.textContent = '+ Pridať';
    add.addEventListener('click', handler);
    buttons.appendChild(add);
  }

  function renderEquipmentField() {
    const field = choiceFieldElement('vybava_paket');
    const input = form.elements.vybava_paket;
    const buttons = field?.querySelector('.choice-buttons');
    if (!field || !input || !buttons) return;

    field.classList.add('choice-control--multi');
    field.dataset.choiceMode = 'multi';
    const selected = selectedEquipment();
    const persisted = unique(scopedOptions.equipment);
    const values = unique([...persisted, ...selected]);
    choiceOptions.set('vybava_paket', values);
    buttons.innerHTML = '';

    values.forEach(value => {
      const active = selected.some(item => eq(item, value));
      const isPersisted = persisted.some(item => eq(item, value));
      buttons.appendChild(optionWrapper(
        'vybava_paket',
        value,
        active,
        isPersisted,
        () => {
          const current = selectedEquipment();
          const next = current.some(item => eq(item, value))
            ? current.filter(item => !eq(item, value))
            : [...current, value];
          setEquipment(next, { emit: true });
        },
        () => {
          if (isPersisted) {
            mutateOption({ scope: 'equipment', action: 'delete', value });
          } else {
            setEquipment(selectedEquipment().filter(item => !eq(item, value)), { emit: true });
          }
        }
      ));
    });

    addButton(buttons, async () => {
      if (busy.has('vybava_paket')) return;
      const value = window.prompt('Pridať novú výbavu:');
      if (value === null || !clean(value)) return;
      const trimmed = clean(value);
      const exists = scopedOptions.equipment.some(item => eq(item, trimmed));
      if (!exists) {
        const ok = await mutateOption({ scope: 'equipment', action: 'add', value: trimmed });
        if (!ok) return;
      }
      const current = selectedEquipment();
      if (!current.some(item => eq(item, trimmed))) {
        setEquipment([...current, trimmed], { emit: true });
      }
    });

    setFieldBusy('vybava_paket', busy.has('vybava_paket'));
  }

  function renderColorField() {
    const field = choiceFieldElement('farba');
    const input = form.elements.farba;
    const buttons = field?.querySelector('.choice-buttons');
    if (!field || !input || !buttons) return;

    field.dataset.choiceMode = 'brand';
    const brand = currentBrand();
    const persisted = colorValues();
    const selected = clean(input.value);
    const values = unique([...persisted, ...(selected ? [selected] : [])]);
    choiceOptions.set('farba', values);
    buttons.innerHTML = '';

    if (!brand && !selected) {
      const note = document.createElement('span');
      note.className = 'choice-empty-note';
      note.textContent = 'Najprv vyber značku.';
      buttons.appendChild(note);
    }

    values.forEach(value => {
      const active = eq(selected, value);
      const isPersisted = persisted.some(item => eq(item, value));
      buttons.appendChild(optionWrapper(
        'farba',
        value,
        active,
        isPersisted,
        () => baseSetChoiceValue('farba', active ? '' : value, { emit: true }),
        () => {
          if (isPersisted && brand) {
            mutateOption({ scope: 'color', action: 'delete', brand, value });
          } else if (active) {
            baseSetChoiceValue('farba', '', { emit: true });
            renderColorField();
          }
        }
      ));
    });

    addButton(buttons, async () => {
      const brandNow = currentBrand();
      if (!brandNow) return alert('Najprv vyber značku vozidla.');
      if (busy.has('farba')) return;
      const value = window.prompt(`Pridať farbu pre ${brandNow}:`);
      if (value === null || !clean(value)) return;
      const trimmed = clean(value);
      const exists = (scopedOptions.colors[brandNow] || []).some(item => eq(item, trimmed));
      if (!exists) {
        const ok = await mutateOption({ scope: 'color', action: 'add', brand: brandNow, value: trimmed });
        if (!ok) return;
      }
      baseSetChoiceValue('farba', trimmed, { emit: true });
      renderColorField();
    });

    setFieldBusy('farba', busy.has('farba'));
  }

  renderChoiceField = function renderWithScopedOptions(name) {
    if (name === 'vybava_paket') return renderEquipmentField();
    if (name === 'farba') return renderColorField();
    return baseRenderChoiceField(name);
  };

  setChoiceValue = function setChoiceValueWithMulti(name, value, options = {}) {
    if (name === 'vybava_paket') {
      setEquipment(parseEquipment(value), options);
      return;
    }
    baseSetChoiceValue(name, value, options);
  };

  syncBrandInputs = function syncBrandAndScopedOptions(brand) {
    baseSyncBrandInputs(brand);
    renderChoiceField('farba');
  };

  function onBrandChanged() {
    if (!loaded) return;
    const selectedColor = clean(form.elements.farba?.value);
    const allowed = colorValues();
    if (selectedColor && !allowed.some(item => eq(item, selectedColor))) {
      baseSetChoiceValue('farba', '', { emit: true });
    }
    renderChoiceField('farba');
  }

  function enablePromoAutoUpload() {
    const input = document.getElementById('promoImageFile');
    const button = document.getElementById('promoUploadBtn');
    if (!input) return;

    button?.remove();
    input.closest('.upload-inline')?.classList.add('upload-inline--auto');

    if (input.dataset.autoUploadBound === '1') return;
    input.dataset.autoUploadBound = '1';
    input.addEventListener('change', () => {
      if (!input.files?.[0]) return;
      if (typeof onPromoUpload !== 'function') return;
      onPromoUpload();
    });
  }

  function ensureStyles() {
    if (document.querySelector('link[data-admin-vehicle-options-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/admin-vehicle-options.css';
    link.dataset.adminVehicleOptionsStyle = '1';
    document.head.appendChild(link);
  }

  async function init() {
    ensureStyles();
    enablePromoAutoUpload();
    form.elements.znacka?.addEventListener('change', onBrandChanged);

    try {
      scopedOptions = await api();
      loaded = true;
      renderChoiceField('vybava_paket');
      renderChoiceField('farba');
    } catch (error) {
      console.error('Vehicle scoped options load failed', error);
      alert('Nepodarilo sa načítať farby a výbavy podľa značiek.');
    }
  }

  init();
})();
