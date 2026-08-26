(function () {
  'use strict';

  const form = document.getElementById('vehicleOrderForm');
  if (!form) return;

  const API_BASE = location.protocol === 'file:' ? '' : location.origin;
  const apiUrl = path => `${API_BASE}${path}`;

  const DEFAULT_OPTIONS = {
    fields: {
      znacka: ['Subaru', 'KGM', 'Jeep', 'Chery'],
      palivo: ['Benzín', 'Diesel', 'Hybrid', 'Plug-in hybrid', 'MHEV', 'Elektromotor'],
      typ_prevodovky: ['AT', 'MT', 'CVT', 'DCT', 'DSG'],
      vybava_paket: ['Comfort', 'Style', 'Premium', 'Limited', 'Adventure', 'Sport'],
      karoseria: ['SUV', 'Crossover', 'Hatchback', 'Sedan', 'Kombi', 'Coupé', 'Cabrio', 'Pick-up', 'MPV'],
      pohon: ['Predný', 'Zadný', 'AWD', '4x4'],
      farba: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Červená', 'Zelená', 'Žltá', 'Hnedá', 'Oranžová', 'Béžová'],
    },
    models: {
      Subaru: ['FORESTER', 'OUTBACK', 'SOLTERRA', 'CROSSTREK', 'BRZ'],
      KGM: ['TORRES', 'TORRES EVX', 'KORANDO', 'TIVOLI', 'REXTON', 'MUSSO GRAND', 'ACTYON'],
      Jeep: ['AVENGER', 'RENEGADE', 'COMPASS', 'WRANGLER', 'GRAND CHEROKEE'],
      Chery: ['TIGGO 9 Plug-in Hybrid', 'TIGGO 8 Plug-in Hybrid', 'TIGGO 8', 'TIGGO 7 Plug-in Hybrid', 'TIGGO 7 Hybrid', 'TIGGO 7', 'TIGGO 4 Hybrid'],
    },
    vehicle: {
      equipment: [],
      colors: {
        Subaru: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Zelená', 'Hnedá'],
        KGM: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Zlatá', 'Béžová'],
        Jeep: ['Biela', 'Čierna', 'Sivá', 'Zelená', 'Žltá', 'Červená', 'Modrá'],
        Chery: ['Biela', 'Čierna', 'Sivá', 'Strieborná', 'Modrá', 'Červená', 'Zelená'],
      },
    },
  };

  const BRAND_KEYS = {
    subaru: 'Subaru',
    kgm: 'KGM',
    jeep: 'Jeep',
    chery: 'Chery',
  };

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
    mileage: document.getElementById('orderMileage'),
    equipment: document.getElementById('orderEquipmentList'),
    extraEquipment: document.getElementById('orderExtraEquipmentNote'),
    budget: document.getElementById('orderBudget'),
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
  };

  const state = {
    cars: [],
    options: structuredCloneSafe(DEFAULT_OPTIONS),
    selectedStockId: '',
  };

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
    return clean(
      car?.titulka ||
      (Array.isArray(car?.galeria) && car.galeria[0]) ||
      (Array.isArray(car?.obrazky) && car.obrazky[0]) ||
      car?.obrazok
    );
  }

  function carTitle(car) {
    return `${clean(car?.znacka)} ${clean(car?.model)}`.replace(/\s+/g, ' ').trim() || 'Vozidlo';
  }

  function stockCarById(id) {
    return state.cars.find(car => clean(car.__orderId) === clean(id));
  }

  async function fetchJson(path) {
    const response = await fetch(apiUrl(path), { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `Požiadavka zlyhala (${response.status})`);
    return payload;
  }

  function mergeOptions(payload) {
    const defaults = structuredCloneSafe(DEFAULT_OPTIONS);
    const source = payload && typeof payload === 'object' ? payload : {};
    const fields = source.fields && typeof source.fields === 'object' ? source.fields : {};
    const models = source.models && typeof source.models === 'object' ? source.models : {};
    const vehicle = source.vehicle && typeof source.vehicle === 'object' ? source.vehicle : {};

    Object.keys(defaults.fields).forEach(key => {
      defaults.fields[key] = unique([...(defaults.fields[key] || []), ...(fields[key] || [])]);
    });

    Object.keys(defaults.models).forEach(brand => {
      const remoteKey = Object.keys(models).find(key => eq(key, brand));
      defaults.models[brand] = unique([...(defaults.models[brand] || []), ...((remoteKey && models[remoteKey]) || [])]);
    });

    Object.entries(models).forEach(([brand, values]) => {
      const normalized = normalizeBrand(brand) || clean(brand);
      if (!normalized || defaults.models[normalized]) return;
      defaults.models[normalized] = unique(values);
    });

    const colors = vehicle.colors && typeof vehicle.colors === 'object' ? vehicle.colors : {};
    Object.keys(defaults.vehicle.colors).forEach(brand => {
      defaults.vehicle.colors[brand] = unique([...(defaults.vehicle.colors[brand] || []), ...(colors[brand] || [])]);
    });

    defaults.vehicle.equipment = unique([...(defaults.vehicle.equipment || []), ...(vehicle.equipment || [])]);
    return defaults;
  }

  function enrichOptionsFromCars() {
    const fields = state.options.fields;
    state.cars.forEach(car => {
      const brand = normalizeBrand(car?.znacka);
      const parsed = parseLegacyPrevodovka(car?.prevodovka);
      if (brand) {
        state.options.models[brand] = unique([...(state.options.models[brand] || []), car?.model]);
        state.options.vehicle.colors[brand] = unique([...(state.options.vehicle.colors[brand] || []), car?.farba]);
      }
      fields.palivo = unique([...fields.palivo, car?.palivo]);
      fields.typ_prevodovky = unique([...fields.typ_prevodovky, car?.typ_prevodovky || parsed.typ]);
      fields.vybava_paket = unique([...fields.vybava_paket, car?.vybava_paket || parsed.paket]);
      fields.karoseria = unique([...fields.karoseria, car?.karoseria]);
      fields.pohon = unique([...fields.pohon, car?.pohon]);
      fields.farba = unique([...fields.farba, car?.farba]);
      state.options.vehicle.equipment = unique([...state.options.vehicle.equipment, ...(Array.isArray(car?.vybava) ? car.vybava : [])]);
    });
  }

  function optionHtml(value) {
    return `<option value="${esc(value)}">${esc(value)}</option>`;
  }

  function populateSelect(select, values, placeholder) {
    if (!select) return;
    const previous = clean(select.value);
    select.innerHTML = `<option value="">${esc(placeholder)}</option>${unique(values).map(optionHtml).join('')}`;
    if (previous && unique(values).some(value => eq(value, previous))) {
      select.value = unique(values).find(value => eq(value, previous));
    }
  }

  function selectedBrand() {
    return normalizeBrand(els.brand?.value);
  }

  function equipmentForBrand(brand) {
    const fromCars = state.cars
      .filter(car => normalizeBrand(car?.znacka) === brand)
      .flatMap(car => Array.isArray(car?.vybava) ? car.vybava : []);
    return unique([...fromCars, ...(state.options.vehicle.equipment || [])]);
  }

  function renderEquipment() {
    if (!els.equipment) return;
    const brand = selectedBrand();
    const values = equipmentForBrand(brand);
    if (!brand) {
      els.equipment.innerHTML = '<div class="order-empty">Po výbere značky sa zobrazí dostupná výbava.</div>';
      return;
    }
    if (!values.length) {
      els.equipment.innerHTML = '<div class="order-empty">Pre túto značku zatiaľ nie je uložená výbava.</div>';
      return;
    }
    els.equipment.innerHTML = values.map(value => `
      <label class="order-chip">
        <input type="checkbox" name="orderEquipment" value="${esc(value)}">
        <span>${esc(value)}</span>
      </label>
    `).join('');
  }

  function updateBrandDependentFields() {
    const brand = selectedBrand();
    const models = brand ? state.options.models[brand] || [] : [];
    const colors = brand ? state.options.vehicle.colors[brand] || [] : state.options.fields.farba;
    populateSelect(els.model, models, brand ? 'Vyberte model' : 'Najprv vyberte značku');
    populateSelect(els.color, colors, brand ? 'Vyberte farbu' : 'Najprv vyberte značku');
    renderEquipment();
  }

  function populateStaticFields() {
    populateSelect(els.brand, state.options.fields.znacka, 'Vyberte značku');
    populateSelect(els.fuel, state.options.fields.palivo, 'Vyberte palivo');
    populateSelect(els.transmission, state.options.fields.typ_prevodovky, 'Vyberte prevodovku');
    populateSelect(els.package, state.options.fields.vybava_paket, 'Vyberte výbavu/paket');
    populateSelect(els.body, state.options.fields.karoseria, 'Vyberte karosériu');
    populateSelect(els.drive, state.options.fields.pohon, 'Vyberte pohon');
    populateSelect(els.stockBrand, state.options.fields.znacka, 'Všetky značky');
    updateBrandDependentFields();
  }

  function renderStockList() {
    if (!els.stockList) return;
    const query = clean(els.stockSearch?.value).toLowerCase();
    const brand = normalizeBrand(els.stockBrand?.value);
    const cars = state.cars.filter(car => {
      if (brand && normalizeBrand(car?.znacka) !== brand) return false;
      if (!query) return true;
      const haystack = [
        car?.znacka,
        car?.model,
        car?.rok,
        car?.palivo,
        car?.prevodovka,
        car?.typ_prevodovky,
        car?.vybava_paket,
        car?.farba,
        car?.pohon,
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
        car?.palivo,
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
      <span>${esc(carPrice(car))} · ${esc(car.rok || '')} · ${esc(car.palivo || '')} · ${esc(car.typ_prevodovky || parsed.typ || car.prevodovka || '')}</span>
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

  function selectedEquipment() {
    return [...form.querySelectorAll('input[name="orderEquipment"]:checked')].map(input => clean(input.value)).filter(Boolean);
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
      palivo: clean(car?.palivo),
      typ_prevodovky: clean(car?.typ_prevodovky || parsed.typ),
      prevodovka: clean(car?.prevodovka),
      vybava_paket: clean(car?.vybava_paket || parsed.paket),
      karoseria: clean(car?.karoseria),
      pohon: clean(car?.pohon),
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
      znacka: clean(els.brand?.value),
      model: clean(els.model?.value),
      rok: numberValue(els.year),
      palivo: clean(els.fuel?.value),
      typ_prevodovky: clean(els.transmission?.value),
      vybava_paket: clean(els.package?.value),
      karoseria: clean(els.body?.value),
      pohon: clean(els.drive?.value),
      farba: clean(els.color?.value),
      metaliza: !!els.metallic?.checked,
      objem: numberValue(els.volume),
      vykon: numberValue(els.power),
      najazdene: numberValue(els.mileage),
      vybava: selectedEquipment(),
    };
  }

  function preferencesPayload() {
    return {
      budget: clean(els.budget?.value),
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

  function validateBeforeSubmit(source) {
    if (source === 'stock' && !stockCarById(state.selectedStockId)) {
      setStatus('Najprv vyberte skladové vozidlo.', 'error');
      els.stockPanel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (source === 'custom') {
      if (!clean(els.brand?.value)) {
        setStatus('Pri individuálnej objednávke vyberte značku.', 'error');
        els.brand?.focus();
        return false;
      }
      if (!clean(els.model?.value)) {
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

      form.reset();
      state.selectedStockId = '';
      document.getElementById('orderSourceStock').checked = true;
      updateMode();
      populateStaticFields();
      renderStockList();
      setStatus(`Ďakujeme, objednávka bola odoslaná. Číslo požiadavky: ${result.id || 'nová objednávka'}.`, 'ok');
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

      if (carsResult.status === 'fulfilled' && Array.isArray(carsResult.value)) {
        state.cars = carsResult.value.filter(car => car && car.skryte !== true);
        assignCarIds(state.cars);
      }

      if (optionsResult.status === 'fulfilled') {
        state.options = mergeOptions(optionsResult.value);
      } else {
        console.warn('Order options fallback', optionsResult.reason);
        state.options = mergeOptions({});
      }

      enrichOptionsFromCars();
      populateStaticFields();
      renderStockList();
      setStatus('');
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

  els.brand?.addEventListener('change', updateBrandDependentFields);
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
