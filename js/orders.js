(function () {
  'use strict';

  const form = document.getElementById('vehicleOrderForm');
  if (!form) return;

  const API_BASE = location.protocol === 'file:' ? '' : location.origin;
  const apiUrl = path => `${API_BASE}${path}`;
  const vehicleData = window.ppVehicleData;

  const EMAILJS_SERVICE_ID = String(form.dataset.emailjsService || 'service_i68hphn').trim();
  const EMAILJS_TEMPLATE_ADMIN = String(form.dataset.emailjsAdminTemplate || 'template_order_admin').trim();
  const EMAILJS_TEMPLATE_CUSTOMER = String(form.dataset.emailjsCustomerTemplate || 'template_order_customer').trim();
  const EMAILJS_ADMIN_EMAIL = String(form.dataset.emailjsAdminEmail || 'martinsulak18@gmail.com').trim();

  const DEFAULT_OPTIONS = {
    fields: {
      znacka: [],
      palivo: [],
      typ_prevodovky: [],
      vybava_paket: [],
      karoseria: [],
      pohon: [],
      farba: [],
    },
    models: {},
    configurations: {},
    brandConfigurations: {},
    numericOptions: { engineVolumes: [], powers: [] },
  };

  const BRAND_KEYS = {
    subaru: 'Subaru',
    kgm: 'KGM',
    jeep: 'Jeep',
    chery: 'Chery',
  };
  const PUBLIC_BRANDS = Object.values(BRAND_KEYS);

  const FIXED_CHOICE_FIELDS = {
    fuel: { config: 'fuels', global: 'palivo', placeholder: 'Vyberte palivo' },
    transmission: { config: 'transmissions', global: 'typ_prevodovky', placeholder: 'Vyberte prevodovku' },
    package: { config: 'packages', global: 'vybava_paket', placeholder: 'Vyberte výbavu/paket' },
    body: { config: 'bodies', global: 'karoseria', placeholder: 'Vyberte karosériu' },
    drive: { config: 'drives', global: 'pohon', placeholder: 'Vyberte pohon' },
  };
  const KNOWN_MODEL_FIXED_FIELDS = ['fuel', 'transmission', 'package', 'body', 'drive'];
  const UNKNOWN_MODEL_FIXED_FIELDS = ['fuel', 'transmission', 'body', 'drive'];

  const els = {
    stockPanel: document.getElementById('orderStockPanel'),
    customPanel: document.getElementById('orderCustomPanel'),
    stockSearch: document.getElementById('orderStockSearch'),
    stockBrand: document.getElementById('orderStockBrand'),
    stockList: document.getElementById('orderStockList'),
    stockSelected: document.getElementById('orderStockSelected'),
    stockCarId: document.getElementById('orderStockCarId'),
    brand: document.getElementById('orderBrand'),
    model: document.getElementById('orderModel'),
    year: document.getElementById('orderYear'),
    fuel: document.getElementById('orderFuel'),
    transmission: document.getElementById('orderTransmission'),
    package: document.getElementById('orderPackage'),
    body: document.getElementById('orderBody'),
    drive: document.getElementById('orderDrive'),
    color: document.getElementById('orderColor'),
    metallic: document.getElementById('orderMetallic'),
    volume: document.getElementById('orderEngineVolume'),
    power: document.getElementById('orderPower'),
    extraEquipment: document.getElementById('orderExtraEquipmentNote'),
    delivery: document.getElementById('orderDelivery'),
    financing: document.getElementById('orderFinancing'),
    tradeIn: document.getElementById('orderTradeIn'),
    note: document.getElementById('orderNote'),
    customerName: document.getElementById('orderCustomerName'),
    customerEmail: document.getElementById('orderCustomerEmail'),
    customerPhone: document.getElementById('orderCustomerPhone'),
    customerCompany: document.getElementById('orderCustomerCompany'),
    preferredContact: document.getElementById('orderPreferredContact'),
    submit: document.getElementById('orderSubmit'),
    status: document.getElementById('orderFormStatus'),
    configModeNote: document.getElementById('orderConfigModeNote'),
  };

  const state = {
    cars: [],
    options: structuredCloneSafe(DEFAULT_OPTIONS),
    selectedStockId: '',
    scopeBrand: normalizeBrand(document.documentElement.dataset.brand),
  };

  const choiceControls = {
    brand: {
      select: els.brand,
    },
    model: {
      select: els.model,
    },
    fuel: {
      select: els.fuel,
      custom: document.getElementById('orderFuelCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="fuel"]'),
    },
    transmission: {
      select: els.transmission,
      custom: document.getElementById('orderTransmissionCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="transmission"]'),
    },
    package: {
      select: els.package,
      custom: document.getElementById('orderPackageCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="package"]'),
    },
    volume: {
      select: els.volume,
      custom: document.getElementById('orderEngineVolumeCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="volume"]'),
    },
    power: {
      select: els.power,
      custom: document.getElementById('orderPowerCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="power"]'),
    },
    body: {
      select: els.body,
      custom: document.getElementById('orderBodyCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="body"]'),
    },
    drive: {
      select: els.drive,
      custom: document.getElementById('orderDriveCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="drive"]'),
    },
    color: {
      select: els.color,
      custom: document.getElementById('orderColorCustom'),
      toggle: form.querySelector('[data-order-choice-toggle="color"]'),
    },
  };

  Object.values(choiceControls).forEach(control => {
    if (control.toggle) control.toggle.dataset.defaultLabel = control.toggle.textContent.trim();
  });

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

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

  function esc(value) {
    return clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeBrand(value) {
    const key = clean(value).toLowerCase();
    return BRAND_KEYS[key] || Object.values(BRAND_KEYS).find(label => eq(label, value)) || '';
  }

  function normalizeGearbox(raw) {
    return clean(raw).toUpperCase().replace(/\s+/g, '');
  }

  function parseLegacyPrevodovka(raw) {
    const txt = clean(raw);
    if (!txt) return { typ: '', paket: '' };
    const parts = txt.split(/•|·|\|/g).map(part => part.trim()).filter(Boolean);
    if (!parts.length) return { typ: '', paket: '' };
    if (parts.length === 1) {
      const one = normalizeGearbox(parts[0]);
      if (/^(AT|MT|CVT|DCT|DSG)$/.test(one)) return { typ: one, paket: '' };
      return { typ: '', paket: parts[0] };
    }
    return { typ: normalizeGearbox(parts[0]), paket: parts.slice(1).join(' • ') };
  }

  function slugify(value) {
    return clean(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  function assignCarIds(cars) {
    const counts = new Map();
    const used = new Set(cars.map(car => clean(car?.id)).filter(Boolean));
    cars.forEach(car => {
      const existing = clean(car?.id);
      if (existing) {
        car.__orderId = existing;
        return;
      }
      const base = slugify(`${car?.znacka || ''}-${car?.model || ''}-${car?.rok || ''}`) || 'auto';
      const count = (counts.get(base) || 0) + 1;
      counts.set(base, count);
      let candidate = count === 1 ? base : `${base}-${count}`;
      let suffix = count;
      while (used.has(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
      }
      used.add(candidate);
      car.__orderId = candidate;
    });
  }

  function parseEuroAmount(value) {
    const normalized = clean(value).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
    if (!normalized || !/^(?:\d+|\d{1,3}(?: \d{3})+)\s*€?$/.test(normalized)) return null;
    const amount = Number(normalized.replace(/[ €]/g, ''));
    return Number.isSafeInteger(amount) ? amount : null;
  }

  function formatEuro(value) {
    const amount = parseEuroAmount(value);
    if (amount === null) return clean(value);
    return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
  }

  function carPrice(car) {
    return formatEuro(car?.nova_cena || car?.stara_cena || '') || 'Cena na vyžiadanie';
  }

  function carImage(car) {
    return vehicleData.primaryImage(car);
  }

  function carTitle(car) {
    return `${clean(car?.znacka)} ${clean(car?.model)}`.replace(/\s+/g, ' ').trim() || 'Vozidlo';
  }

  function stockCarById(id) {
    return state.cars.find(car => clean(car.__orderId) === clean(id));
  }

  async function fetchJson(path) {
    if (window.ppPublicData) {
      if (path === '/api/cars') return window.ppPublicData.getCars();
      if (path === '/api/order-options') return window.ppPublicData.getOrderOptions();
    }

    // Hobby-safe fallback: samostatný /api/order-options endpoint už neexistuje.
    // Rovnaké verejné dáta sú súčasťou bootstrap režimu existujúcej /api/orders funkcie.
    if (path === '/api/order-options') {
      const response = await fetch(apiUrl('/api/orders?mode=bootstrap'));
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Požiadavka zlyhala (${response.status})`);
      if (!payload?.orderOptions) throw new Error('Bootstrap neobsahuje možnosti objednávky');
      return payload.orderOptions;
    }

    const response = await fetch(apiUrl(path));
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `Požiadavka zlyhala (${response.status})`);
    return payload;
  }

  function numberList(values) {
    const out = [];
    for (const raw of Array.isArray(values) ? values : []) {
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 0 || out.includes(number)) continue;
      out.push(number);
    }
    return out;
  }

  function normalizeVariant(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const engineVolume = Number(source.engineVolume);
    const power = Number(source.power);
    return {
      fuel: clean(source.fuel),
      package: clean(source.package),
      transmission: clean(source.transmission),
      engineVolume: Number.isFinite(engineVolume) && engineVolume >= 0 ? engineVolume : null,
      power: Number.isFinite(power) && power >= 0 ? power : null,
      body: clean(source.body),
      drives: unique(source.drives),
      color: clean(source.color),
    };
  }

  function normalizeConfiguration(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      fuels: unique(source.fuels),
      packages: unique(source.packages),
      transmissions: unique(source.transmissions),
      engineVolumes: numberList(source.engineVolumes),
      powers: numberList(source.powers),
      bodies: unique(source.bodies),
      drives: unique(source.drives),
      colors: unique(source.colors),
      variants: (Array.isArray(source.variants) ? source.variants : []).map(normalizeVariant),
    };
  }

  function mergeOptions(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const sourceFields = source.fields && typeof source.fields === 'object' ? source.fields : {};
    const sourceModels = source.models && typeof source.models === 'object' ? source.models : {};
    const sourceConfigurations = source.configurations && typeof source.configurations === 'object'
      ? source.configurations
      : {};
    const sourceBrandConfigurations = source.brandConfigurations && typeof source.brandConfigurations === 'object'
      ? source.brandConfigurations
      : {};
    const sourceNumericOptions = source.numericOptions && typeof source.numericOptions === 'object'
      ? source.numericOptions
      : {};
    const fields = {};

    Object.keys(DEFAULT_OPTIONS.fields).forEach(key => {
      fields[key] = key === 'znacka'
        ? [...PUBLIC_BRANDS]
        : unique(sourceFields[key]);
    });

    const models = {};
    PUBLIC_BRANDS.forEach(brand => {
      const sourceKey = Object.keys(sourceModels).find(key => eq(key, brand));
      models[brand] = unique(sourceKey ? sourceModels[sourceKey] : []);
    });

    const configurations = {};
    Object.entries(sourceConfigurations).forEach(([rawBrand, rawModels]) => {
      if (!rawModels || typeof rawModels !== 'object' || Array.isArray(rawModels)) return;
      const brand = fields.znacka.find(item => eq(item, rawBrand));
      if (!brand) return;
      const modelKey = Object.keys(models).find(key => eq(key, brand));
      configurations[brand] ||= {};

      Object.entries(rawModels).forEach(([rawModel, rawConfig]) => {
        if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return;
        const model = modelKey
          ? models[modelKey].find(item => eq(item, rawModel)) || clean(rawModel)
          : clean(rawModel);
        if (!model) return;

        configurations[brand][model] = normalizeConfiguration(rawConfig);
      });
    });

    const brandConfigurations = {};
    PUBLIC_BRANDS.forEach(brand => {
      const sourceKey = Object.keys(sourceBrandConfigurations).find(key => eq(key, brand));
      brandConfigurations[brand] = normalizeConfiguration(sourceKey ? sourceBrandConfigurations[sourceKey] : {});
    });

    const numericOptions = {
      engineVolumes: numberList(sourceNumericOptions.engineVolumes),
      powers: numberList(sourceNumericOptions.powers),
    };

    // Kompatibilita so starším /api/order-options, ktoré posielalo hodnoty
    // objemu/výkonu v modelových konfiguráciách.
    if (!numericOptions.engineVolumes.length || !numericOptions.powers.length) {
      Object.values(configurations).forEach(rawModels => {
        Object.values(rawModels || {}).forEach(config => {
          if (!numericOptions.engineVolumes.length) {
            config.engineVolumes.forEach(value => {
              if (!numericOptions.engineVolumes.includes(value)) numericOptions.engineVolumes.push(value);
            });
          }
          if (!numericOptions.powers.length) {
            config.powers.forEach(value => {
              if (!numericOptions.powers.includes(value)) numericOptions.powers.push(value);
            });
          }
        });
      });
      numericOptions.engineVolumes.sort((a, b) => a - b);
      numericOptions.powers.sort((a, b) => a - b);
    }

    return { version: 3, fields, models, configurations, brandConfigurations, numericOptions };
  }

  function optionHtml(value) {
    return `<option value="${esc(value)}">${esc(value)}</option>`;
  }

  function populateSelect(select, values, placeholder, { autoSelectSingle = false } = {}) {
    if (!select) return;
    const normalized = unique(values);
    const previous = clean(select.value);
    select.innerHTML = `<option value="">${esc(placeholder)}</option>${normalized.map(optionHtml).join('')}`;
    if (previous && normalized.some(value => eq(value, previous))) {
      select.value = normalized.find(value => eq(value, previous));
    } else if (autoSelectSingle && normalized.length === 1) {
      select.value = normalized[0];
    }
  }

  function choiceControl(name) {
    return choiceControls[name] || null;
  }

  function isCustomMode(name) {
    const control = choiceControl(name);
    return !!control?.custom && control.custom.hidden === false;
  }

  function choiceValue(name) {
    const control = choiceControl(name);
    if (!control) return '';
    return clean(isCustomMode(name) ? control.custom?.value : control.select?.value);
  }

  function selectValueCount(select) {
    if (!select) return 0;
    return [...select.options].filter(option => clean(option.value)).length;
  }

  function refreshChoiceToggle(name, { forceHidden = false } = {}) {
    const control = choiceControl(name);
    if (!control?.toggle) return;
    const fixedBrand = name === 'brand' && !!configuredBrandForScope();
    const hasChoices = selectValueCount(control.select) > 0;
    control.toggle.hidden = forceHidden || fixedBrand || (!hasChoices && isCustomMode(name));
    control.toggle.textContent = isCustomMode(name)
      ? '← Vybrať z dostupných možností'
      : (control.toggle.dataset.defaultLabel || '+ Zadať vlastnú hodnotu');
    control.toggle.classList.toggle('is-custom-active', isCustomMode(name));
  }

  function setChoiceMode(name, useCustom, {
    focus = false,
    clearCustom = false,
    forceToggleHidden = false,
  } = {}) {
    const control = choiceControl(name);
    if (!control?.select || !control?.custom) return;

    if (name === 'brand' && configuredBrandForScope()) useCustom = false;

    if (clearCustom) control.custom.value = '';
    if (useCustom && !clean(control.custom.value) && clean(control.select.value)) {
      control.custom.value = clean(control.select.value);
    }

    control.select.hidden = !!useCustom;
    control.select.disabled = !!useCustom;
    control.custom.hidden = !useCustom;
    control.custom.disabled = !useCustom;
    control.custom.required = false;

    const label = control.select.closest('.order-field')?.querySelector('label');
    if (label) label.htmlFor = useCustom ? control.custom.id : control.select.id;

    refreshChoiceToggle(name, { forceHidden: forceToggleHidden });
    if (focus && useCustom) control.custom.focus();
  }

  function clearChoice(name) {
    const control = choiceControl(name);
    if (!control) return;
    if (control.select) control.select.value = '';
    if (control.custom) control.custom.value = '';
  }

  function configuredBrandForScope() {
    if (!state.scopeBrand) return '';
    return state.options.fields.znacka.find(brand => normalizeBrand(brand) === state.scopeBrand)
      || BRAND_KEYS[state.scopeBrand.toLowerCase()]
      || '';
  }

  function selectedBrand() {
    return choiceValue('brand');
  }

  function selectedModel() {
    return choiceValue('model');
  }

  function configuredBrandKey(value = selectedBrand()) {
    return state.options.fields.znacka.find(brand => eq(brand, value)) || '';
  }

  function configuredModelsForBrand(value = selectedBrand()) {
    const brand = configuredBrandKey(value);
    if (!brand) return [];
    const modelKey = Object.keys(state.options.models).find(key => eq(key, brand));
    return modelKey ? state.options.models[modelKey] || [] : [];
  }

  function modelConfiguration() {
    if (isCustomMode('model')) return null;
    const brand = configuredBrandKey();
    const model = selectedModel();
    if (!brand || !model) return null;

    const brandKey = Object.keys(state.options.configurations || {}).find(key => eq(key, brand));
    if (!brandKey) return null;
    const modelKey = Object.keys(state.options.configurations[brandKey] || {}).find(key => eq(key, model));
    return modelKey ? state.options.configurations[brandKey][modelKey] : null;
  }

  function brandConfiguration() {
    const brand = configuredBrandKey();
    if (!brand) return null;
    const brandKey = Object.keys(state.options.brandConfigurations || {}).find(key => eq(key, brand));
    return brandKey ? state.options.brandConfigurations[brandKey] : null;
  }

  function fixedChoiceValues(name) {
    const definition = FIXED_CHOICE_FIELDS[name];
    if (!definition) return [];
    // Verejný formulár používa celý zoznam možností spravovaný v admin paneli,
    // nie iba hodnoty, ktoré sú aktuálne aplikované na konkrétnom aute/modeli.
    return unique(state.options.fields[definition.global]);
  }

  function allNumericConfigurationValues(key) {
    const direct = numberList(state.options.numericOptions?.[key]);
    if (direct.length) return direct.sort((a, b) => a - b).map(String);

    const values = [];
    Object.values(state.options.configurations || {}).forEach(models => {
      Object.values(models || {}).forEach(config => {
        (Array.isArray(config?.[key]) ? config[key] : []).forEach(value => {
          const number = Number(value);
          if (Number.isFinite(number) && number >= 0 && !values.includes(number)) values.push(number);
        });
      });
    });
    return values.sort((a, b) => a - b).map(String);
  }

  function setOrderFieldVisible(name, visible) {
    const field = choiceControl(name)?.select?.closest('.order-field');
    if (field) field.hidden = !visible;
  }

  function updateConfigModeNote() {
    if (!els.configModeNote) return;
    const brand = selectedBrand();
    const model = selectedModel();
    els.configModeNote.classList.remove('is-known', 'is-manual');

    if (!brand) {
      els.configModeNote.textContent = 'Vyberte jednu zo značiek Subaru, KGM, Jeep alebo Chery.';
      return;
    }
    if (!model) {
      els.configModeNote.textContent = 'Vyberte model z ponuky admin panela.';
      return;
    }

    els.configModeNote.classList.add('is-known');
    els.configModeNote.textContent = 'Vyberte si z kompletných možností admin panela. Každý parameter okrem značky a modelu môžete prepísať vlastnou hodnotou.';
  }

  function setKnownChoice(name, values, placeholder, { reset = false, autoSelectSingle = false } = {}) {
    const control = choiceControl(name);
    if (!control) return;
    if (reset) clearChoice(name);
    populateSelect(control.select, values, placeholder, { autoSelectSingle });

    if (values.length) {
      control.select.disabled = false;
      if (reset) setChoiceMode(name, false);
      else refreshChoiceToggle(name);
    } else {
      setChoiceMode(name, true, { clearCustom: reset, forceToggleHidden: true });
    }
  }

  function setManualChoice(name, { clear = false, keepCommonChoices = false } = {}) {
    const control = choiceControl(name);
    if (!control) return;
    if (clear) clearChoice(name);
    if (!keepCommonChoices) populateSelect(control.select, [], 'Bez dostupných možností');
    setChoiceMode(name, true, { clearCustom: clear, forceToggleHidden: true });
  }

  function setFixedChoice(name, values, { reset = false } = {}) {
    const control = choiceControl(name);
    const definition = FIXED_CHOICE_FIELDS[name];
    if (!control?.select || !definition) return;
    if (reset) control.select.value = '';
    populateSelect(
      control.select,
      values,
      values.length ? definition.placeholder : 'Bez dostupných možností',
      { autoSelectSingle: true }
    );
    control.select.hidden = false;
    control.select.disabled = values.length === 0;
  }

  function updateModelDependentFields({ resetFields = false } = {}) {
    const model = selectedModel();

    if (!model) {
      Object.keys(FIXED_CHOICE_FIELDS).forEach(name => setOrderFieldVisible(name, true));
      ['fuel', 'transmission', 'package', 'volume', 'power', 'body', 'drive', 'color'].forEach(name => {
        clearChoice(name);
        const control = choiceControl(name);
        populateSelect(control?.select, [], 'Najprv vyberte model');
        setChoiceMode(name, false, { forceToggleHidden: true });
        if (control?.select) control.select.disabled = true;
      });
      updateConfigModeNote();
      return;
    }

    // Všetky výberové polia dostanú CELÝ adminom spravovaný zoznam možností.
    Object.keys(FIXED_CHOICE_FIELDS).forEach(name => {
      setOrderFieldVisible(name, true);
      const definition = FIXED_CHOICE_FIELDS[name];
      const values = fixedChoiceValues(name);
      setKnownChoice(name, values, definition.placeholder, {
        reset: resetFields,
        autoSelectSingle: false,
      });
    });

    // Objem/výkon nemajú samostatný katalóg možností v parametre.json, preto
    // ako rýchle voľby zobrazíme všetky hodnoty evidované v admin vozidlách.
    // Používateľ ich môže vždy prepísať vlastnou hodnotou.
    setKnownChoice('volume', allNumericConfigurationValues('engineVolumes'), 'Vyberte objem motora', {
      reset: resetFields,
      autoSelectSingle: false,
    });
    setKnownChoice('power', allNumericConfigurationValues('powers'), 'Vyberte výkon', {
      reset: resetFields,
      autoSelectSingle: false,
    });

    // Farba je rovnako globálna admin možnosť, nie iba farba aplikovaná na model.
    setKnownChoice('color', unique(state.options.fields.farba), 'Vyberte farbu', {
      reset: resetFields,
      autoSelectSingle: false,
    });

    updateConfigModeNote();
  }

  function updateBrandDependentFields({ resetModel = true } = {}) {
    const brand = selectedBrand();
    const configuredBrand = configuredBrandKey(brand);
    const models = configuredBrand ? configuredModelsForBrand(configuredBrand) : [];
    const modelControl = choiceControl('model');

    if (!brand) {
      clearChoice('model');
      populateSelect(modelControl?.select, [], 'Najprv vyberte značku');
      setChoiceMode('model', false, { forceToggleHidden: true });
      if (modelControl?.select) modelControl.select.disabled = true;
      updateModelDependentFields({ resetFields: true });
      return;
    }

    if (resetModel) clearChoice('model');
    populateSelect(modelControl?.select, models, models.length ? 'Vyberte model' : 'Pre túto značku nie sú v admin paneli modely');
    if (modelControl?.select) modelControl.select.disabled = models.length === 0;
    updateModelDependentFields({ resetFields: true });
  }

  function populateStaticFields({ resetCustom = false } = {}) {
    const scopedBrand = configuredBrandForScope();
    const brandValues = scopedBrand ? [scopedBrand] : state.options.fields.znacka;

    if (resetCustom) {
      Object.keys(choiceControls).forEach(clearChoice);
    }

    populateSelect(els.brand, brandValues, scopedBrand ? 'Značka' : 'Vyberte značku');
    populateSelect(els.stockBrand, brandValues, scopedBrand ? 'Značka' : 'Všetky značky');

    if (scopedBrand) {
      if (els.brand) {
        els.brand.value = scopedBrand;
        els.brand.disabled = true;
        els.brand.hidden = false;
        els.brand.setAttribute('aria-label', `Zvolená značka: ${scopedBrand}`);
      }
      const brandControl = choiceControl('brand');
      if (brandControl?.custom) {
        brandControl.custom.hidden = true;
        brandControl.custom.disabled = true;
      }
      refreshChoiceToggle('brand', { forceHidden: true });

      if (els.stockBrand) {
        els.stockBrand.value = scopedBrand;
        els.stockBrand.disabled = true;
        els.stockBrand.setAttribute('aria-label', `Zvolená značka: ${scopedBrand}`);
      }
    } else {
      setChoiceMode('brand', false);
      if (els.brand) {
        els.brand.disabled = false;
        els.brand.removeAttribute('aria-label');
      }
      if (els.stockBrand) {
        els.stockBrand.disabled = false;
        els.stockBrand.removeAttribute('aria-label');
      }
    }

    updateBrandDependentFields({ resetModel: true });
  }

  function renderStockList() {
    if (!els.stockList) return;
    const query = clean(els.stockSearch?.value).toLowerCase();
    const brand = state.scopeBrand || normalizeBrand(els.stockBrand?.value);
    const cars = state.cars.filter(car => {
      if (brand && normalizeBrand(car?.znacka) !== brand) return false;
      if (!query) return true;
      const haystack = [
        car?.znacka,
        car?.model,
        car?.rok,
        vehicleData.formatFuel(car),
        car?.prevodovka,
        car?.typ_prevodovky,
        car?.vybava_paket,
        car?.farba,
        vehicleData.formatChoices(car?.pohon),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });

    if (!cars.length) {
      els.stockList.innerHTML = '<div class="order-empty">Nenašli sa skladové vozidlá pre vybraný filter.</div>';
      updateSelectedStockSummary();
      return;
    }

    els.stockList.innerHTML = cars.map(car => {
      const id = clean(car.__orderId);
      const parsed = parseLegacyPrevodovka(car?.prevodovka);
      const img = carImage(car);
      const selected = eq(id, state.selectedStockId);
      const meta = unique([
        car?.rok ? `Rok ${car.rok}` : '',
        vehicleData.formatFuel(car),
        car?.typ_prevodovky || parsed.typ,
        car?.vybava_paket || parsed.paket,
      ]).slice(0, 4);
      return `
        <button class="order-stock-card${selected ? ' is-selected' : ''}" type="button" data-stock-id="${esc(id)}" aria-pressed="${selected ? 'true' : 'false'}">
          <span class="order-stock-card__img">
            ${img ? `<img src="${esc(img)}" alt="${esc(carTitle(car))}" loading="lazy" decoding="async">` : ''}
          </span>
          <span class="order-stock-card__body">
            <span class="order-stock-card__title">${esc(carTitle(car))}</span>
            <span class="order-stock-card__price">${esc(carPrice(car))}</span>
            <span class="order-stock-card__meta">${meta.map(item => `<span class="order-mini-pill">${esc(item)}</span>`).join('')}</span>
          </span>
        </button>
      `;
    }).join('');
    updateSelectedStockSummary();
  }

  function updateSelectedStockSummary() {
    if (!els.stockSelected || !els.stockCarId) return;
    const car = stockCarById(state.selectedStockId);
    els.stockCarId.value = car ? clean(car.__orderId) : '';
    if (!car) {
      els.stockSelected.hidden = true;
      els.stockSelected.innerHTML = '';
      return;
    }
    const parsed = parseLegacyPrevodovka(car.prevodovka);
    els.stockSelected.hidden = false;
    els.stockSelected.innerHTML = `
      <strong>${esc(carTitle(car))}</strong>
      <span>${esc(carPrice(car))} · ${esc(car.rok || '')} · ${esc(vehicleData.formatFuel(car))} · ${esc(car.typ_prevodovky || parsed.typ || car.prevodovka || '')}</span>
    `;
  }

  function activeSource() {
    return clean(new FormData(form).get('source')) || 'stock';
  }

  function updateMode() {
    const source = activeSource();
    if (els.stockPanel) els.stockPanel.hidden = source !== 'stock';
    if (els.customPanel) els.customPanel.hidden = source !== 'custom';
  }

  function numberValue(input) {
    const value = clean(input?.value);
    if (!value) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function stockSnapshot(car) {
    const parsed = parseLegacyPrevodovka(car?.prevodovka);
    const id = clean(car?.__orderId || car?.id);
    const detailPath = id ? `/auta/${encodeURIComponent(id)}` : '';
    return {
      stockCarId: id,
      stockUrl: detailPath ? `${location.origin}${detailPath}` : location.href,
      znacka: clean(car?.znacka),
      model: clean(car?.model),
      rok: numberValue({ value: car?.rok }),
      palivo: vehicleData.fuelValues(car),
      typ_prevodovky: clean(car?.typ_prevodovky || parsed.typ),
      prevodovka: clean(car?.prevodovka),
      vybava_paket: clean(car?.vybava_paket || parsed.paket),
      karoseria: clean(car?.karoseria),
      pohon: vehicleData.formatChoices(car?.pohon),
      farba: clean(car?.farba),
      metaliza: !!car?.metaliza,
      objem: numberValue({ value: car?.objem }),
      vykon: numberValue({ value: car?.vykon }),
      najazdene: numberValue({ value: car?.najazdene }),
      stara_cena: clean(car?.stara_cena),
      nova_cena: clean(car?.nova_cena),
      obrazok: carImage(car),
      vybava: Array.isArray(car?.vybava) ? car.vybava : [],
    };
  }

  function customVehiclePayload() {
    return {
      znacka: choiceValue('brand'),
      model: choiceValue('model'),
      rok: numberValue(els.year),
      palivo: vehicleData.fuelValues(choiceValue('fuel')),
      typ_prevodovky: choiceValue('transmission'),
      vybava_paket: choiceValue('package'),
      karoseria: choiceValue('body'),
      pohon: choiceValue('drive'),
      farba: choiceValue('color'),
      metaliza: !!els.metallic?.checked,
      objem: numberValue({ value: choiceValue('volume') }),
      vykon: numberValue({ value: choiceValue('power') }),
    };
  }

  function preferencesPayload() {
    return {
      deliveryTime: clean(els.delivery?.value),
      financing: clean(els.financing?.value),
      tradeIn: clean(els.tradeIn?.value),
      extraEquipmentNote: clean(els.extraEquipment?.value),
      note: clean(els.note?.value),
    };
  }

  function customerPayload() {
    return {
      name: clean(els.customerName?.value),
      email: clean(els.customerEmail?.value),
      phone: clean(els.customerPhone?.value),
      company: clean(els.customerCompany?.value),
      preferredContact: clean(els.preferredContact?.value),
    };
  }

  function setStatus(message, type = '') {
    if (!els.status) return;
    els.status.classList.toggle('is-ok', type === 'ok');
    els.status.classList.toggle('is-error', type === 'error');
    els.status.textContent = message || '';
  }

  function emailText(value, fallback = '—') {
    const normalized = Array.isArray(value)
      ? value.map(clean).filter(Boolean).join(' • ')
      : clean(value);
    return normalized || fallback;
  }

  function buildOrderEmailParams(payload, result) {
    const vehicle = payload.vehicle || {};
    const customer = payload.customer || {};
    const preferences = payload.preferences || {};
    const orderNumber = Number(result?.orderNumber);
    const reference = Number.isSafeInteger(orderNumber) && orderNumber > 0
      ? `#${orderNumber}`
      : emailText(result?.reference, '—');

    return {
      order_id: emailText(result?.id),
      order_number: Number.isSafeInteger(orderNumber) && orderNumber > 0 ? String(orderNumber) : '—',
      order_reference: reference,
      order_created_at: new Date().toLocaleString('sk-SK'),
      admin_email: EMAILJS_ADMIN_EMAIL,
      source: emailText(payload.source),
      source_label: payload.source === 'stock' ? 'Skladové vozidlo' : 'Individuálna objednávka',
      customer_name: emailText(customer.name),
      customer_email: emailText(customer.email),
      customer_phone: emailText(customer.phone),
      customer_company: emailText(customer.company),
      preferred_contact: emailText(customer.preferredContact),
      vehicle_stock_id: emailText(vehicle.stockCarId),
      vehicle_stock_url: emailText(vehicle.stockUrl),
      vehicle_brand: emailText(vehicle.znacka),
      vehicle_model: emailText(vehicle.model),
      vehicle_year: emailText(vehicle.rok),
      vehicle_fuel: emailText(vehicleData.formatFuel(vehicle.palivo)),
      vehicle_transmission: emailText(vehicle.typ_prevodovky),
      vehicle_legacy_transmission: emailText(vehicle.prevodovka),
      vehicle_package: emailText(vehicle.vybava_paket),
      vehicle_body: emailText(vehicle.karoseria),
      vehicle_drive: emailText(vehicle.pohon),
      vehicle_color: emailText(vehicle.farba),
      vehicle_metallic: vehicle.metaliza ? 'Áno' : 'Nie',
      vehicle_engine_volume: emailText(vehicle.objem),
      vehicle_power: emailText(vehicle.vykon),
      vehicle_mileage: emailText(vehicle.najazdene),
      vehicle_old_price: emailText(vehicle.stara_cena),
      vehicle_new_price: emailText(vehicle.nova_cena),
      vehicle_image: emailText(vehicle.obrazok),
      vehicle_equipment: emailText(vehicle.vybava),
      delivery_time: emailText(preferences.deliveryTime),
      financing: emailText(preferences.financing),
      trade_in: emailText(preferences.tradeIn),
      extra_equipment: emailText(preferences.extraEquipmentNote),
      note: emailText(preferences.note),
      page_url: emailText(payload.page),
      consent: payload.consent ? 'Áno' : 'Nie',
    };
  }

  function orderEmailSummary(params) {
    return [
      `Objednávka: ${params.order_reference}`,
      `Typ: ${params.source_label}`,
      `Zákazník: ${params.customer_name}`,
      `E-mail: ${params.customer_email}`,
      `Telefón: ${params.customer_phone}`,
      `Vozidlo: ${params.vehicle_brand} ${params.vehicle_model}`,
      `Rok: ${params.vehicle_year}`,
      `Palivo: ${params.vehicle_fuel}`,
      `Prevodovka: ${params.vehicle_transmission}`,
      `Výbava/paket: ${params.vehicle_package}`,
      `Karoséria: ${params.vehicle_body}`,
      `Pohon: ${params.vehicle_drive}`,
      `Objem: ${params.vehicle_engine_volume}`,
      `Výkon: ${params.vehicle_power}`,
      `Farba: ${params.vehicle_color}`,
      `Poznámka: ${params.note}`,
    ].join('\n');
  }

  async function sendOrderEmails(params) {
    if (typeof window.emailjs?.send !== 'function') {
      console.error('EmailJS nie je dostupný; objednávka už bola uložená.');
      return { adminSent: false, customerSent: false };
    }

    const summary = orderEmailSummary(params);
    const adminParams = {
      ...params,
      to_email: EMAILJS_ADMIN_EMAIL,
      recipient_email: EMAILJS_ADMIN_EMAIL,
      to_name: 'PP AUTO',
      recipient_name: 'PP AUTO',
      reply_to: params.customer_email,
      email_role: 'admin',
      message: summary,
    };
    const customerParams = {
      ...params,
      to_email: params.customer_email,
      recipient_email: params.customer_email,
      to_name: params.customer_name,
      recipient_name: params.customer_name,
      reply_to: EMAILJS_ADMIN_EMAIL,
      email_role: 'customer',
      message: summary,
    };

    const results = await Promise.allSettled([
      Promise.resolve().then(() => window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, adminParams)),
      Promise.resolve().then(() => window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, customerParams)),
    ]);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`EmailJS ${index === 0 ? 'admin' : 'customer'} notification failed`, result.reason);
      }
    });
    return {
      adminSent: results[0].status === 'fulfilled',
      customerSent: results[1].status === 'fulfilled',
    };
  }

  function emailDeliveryMessage(result) {
    if (result.adminSent && result.customerSent) {
      return ' Potvrdenie sme poslali na váš e-mail.';
    }
    if (result.customerSent) {
      return ' Potvrdenie sme poslali na váš e-mail, interné e-mailové upozornenie sa však nepodarilo odoslať.';
    }
    if (result.adminSent) {
      return ' Predajcu sme upozornili, potvrdenie na váš e-mail sa však nepodarilo odoslať.';
    }
    return ' Objednávka bola uložená, ale e-mailové upozornenia sa nepodarilo odoslať.';
  }

  function validateBeforeSubmit(source) {
    if (source === 'stock' && !stockCarById(state.selectedStockId)) {
      setStatus('Najprv vyberte skladové vozidlo.', 'error');
      els.stockPanel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (source === 'custom') {
      if (!choiceValue('brand')) {
        setStatus('Pri individuálnej objednávke vyberte značku.', 'error');
        els.brand?.focus();
        return false;
      }
      if (!choiceValue('model')) {
        setStatus('Pri individuálnej objednávke vyberte model.', 'error');
        els.model?.focus();
        return false;
      }
    }
    return true;
  }

  async function submitOrder(event) {
    event.preventDefault();
    setStatus('');

    if (!form.reportValidity()) return;

    const source = activeSource();
    if (!validateBeforeSubmit(source)) return;

    const stockCar = stockCarById(state.selectedStockId);
    const payload = {
      source,
      website: clean(form.elements.website?.value),
      customer: customerPayload(),
      vehicle: source === 'stock' ? stockSnapshot(stockCar) : customVehiclePayload(),
      preferences: preferencesPayload(),
      consent: !!form.elements.orderPrivacy?.checked,
      page: location.href,
    };

    if (els.submit) {
      els.submit.disabled = true;
      els.submit.textContent = 'Odosielam...';
    }
    setStatus('Odosielam objednávku...');

    try {
      const response = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `Odoslanie zlyhalo (${response.status})`);

      const createdId = clean(result.id);
      const orderNumber = Number(result.orderNumber);
      const isStoredOrder = !!createdId && Number.isSafeInteger(orderNumber) && orderNumber > 0;
      let emailResult = { adminSent: false, customerSent: false };
      if (isStoredOrder) {
        try {
          emailResult = await sendOrderEmails(buildOrderEmailParams(payload, result));
        } catch (emailError) {
          console.error('EmailJS notifications failed after the order was stored', emailError);
        }
      }

      form.reset();
      state.selectedStockId = '';
      document.getElementById('orderSourceStock').checked = true;
      updateMode();
      populateStaticFields({ resetCustom: true });
      renderStockList();
      const publicNumber = isStoredOrder ? `#${orderNumber}` : '';
      const emailMessage = isStoredOrder ? emailDeliveryMessage(emailResult) : '';
      setStatus(
        publicNumber
          ? `Ďakujeme, objednávka bola odoslaná. Číslo objednávky: ${publicNumber}.${emailMessage}`
          : 'Ďakujeme, objednávka bola odoslaná.',
        'ok'
      );
    } catch (error) {
      console.error(error);
      setStatus(error?.message || 'Objednávku sa nepodarilo odoslať.', 'error');
    } finally {
      if (els.submit) {
        els.submit.disabled = false;
        els.submit.textContent = 'Odoslať objednávku';
      }
    }
  }

  async function init() {
    updateMode();
    setStatus('Načítavam možnosti objednávky...');

    try {
      const [carsResult, optionsResult] = await Promise.allSettled([
        fetchJson('/api/cars'),
        fetchJson('/api/order-options'),
      ]);
      const loadIssues = [];

      if (carsResult.status === 'fulfilled' && Array.isArray(carsResult.value)) {
        state.cars = carsResult.value.filter(car => (
          car && car.skryte !== true && !!normalizeBrand(car.znacka)
        ));
        assignCarIds(state.cars);
      } else {
        loadIssues.push('skladové vozidlá');
      }

      if (optionsResult.status === 'fulfilled') {
        state.options = mergeOptions(optionsResult.value);
      } else {
        console.warn('Order options fallback', optionsResult.reason);
        state.options = mergeOptions({});
        loadIssues.push('možnosti parametrov z admin panela');
      }

      populateStaticFields();
      renderStockList();
      setStatus(
        loadIssues.length
          ? `Nepodarilo sa načítať: ${loadIssues.join(' a ')}. Skúste stránku obnoviť.`
          : '',
        loadIssues.length ? 'error' : ''
      );
    } catch (error) {
      console.error(error);
      state.options = mergeOptions({});
      populateStaticFields();
      renderStockList();
      setStatus('Nepodarilo sa načítať všetky dáta. Formulár môžete vyplniť ručne.', 'error');
    }
  }

  form.addEventListener('change', event => {
    if (event.target?.name === 'source') updateMode();
  });

  els.brand?.addEventListener('change', () => updateBrandDependentFields({ resetModel: true }));
  els.model?.addEventListener('change', () => updateModelDependentFields({ resetFields: true }));

  Object.entries(choiceControls).forEach(([name, control]) => {
    control.toggle?.addEventListener('click', () => {
      const nextCustom = !isCustomMode(name);
      setChoiceMode(name, nextCustom, { focus: nextCustom, clearCustom: false });
    });
  });


  els.stockSearch?.addEventListener('input', renderStockList);
  els.stockBrand?.addEventListener('change', renderStockList);
  els.stockList?.addEventListener('click', event => {
    const button = event.target.closest('[data-stock-id]');
    if (!button) return;
    state.selectedStockId = clean(button.dataset.stockId);
    renderStockList();
  });
  form.addEventListener('submit', submitOrder);

  init();
})();
