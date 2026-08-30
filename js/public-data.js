(function () {
  'use strict';

  if (window.ppPublicData) return;

  const API_BASE = location.protocol === 'file:' ? 'https://ppauto.sk' : location.origin;
  const CACHE_KEY = `ppauto.publicBootstrap.v1:${API_BASE}`;
  const CACHE_TTL_MS = 60 * 1000;
  let bootstrapPromise = null;

  function clone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (e) {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const savedAt = Number(parsed.savedAt || 0);
      if (!Number.isFinite(savedAt) || Date.now() - savedAt > CACHE_TTL_MS) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return clone(parsed.payload);
    } catch (e) {
      return null;
    }
  }

  function writeSession(payload) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
    } catch (e) {
      // Ak storage nie je dostupný, in-memory Promise stále odstráni duplicitné requesty.
    }
  }

  async function fetchBootstrap() {
    const response = await fetch(`${API_BASE}/api/orders?mode=bootstrap`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `Bootstrap zlyhal (${response.status})`);
    }
    if (!payload || typeof payload !== 'object') throw new Error('Bootstrap vrátil neplatné dáta');
    writeSession(payload);
    return payload;
  }

  function getBootstrap({ force = false } = {}) {
    if (force) bootstrapPromise = null;
    if (bootstrapPromise) return bootstrapPromise;

    if (!force) {
      const cached = readSession();
      if (cached) {
        bootstrapPromise = Promise.resolve(cached);
        return bootstrapPromise;
      }
    }

    bootstrapPromise = fetchBootstrap().catch(error => {
      bootstrapPromise = null;
      throw error;
    });
    return bootstrapPromise;
  }

  async function fallbackJson(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `${path} zlyhalo (${response.status})`);
    return payload;
  }

  function fromBootstrap(key, fallbackPath) {
    return getBootstrap()
      .then(payload => {
        if (payload?.[key] === undefined) throw new Error(`Bootstrap neobsahuje ${key}`);
        return payload[key];
      })
      .catch(error => {
        console.warn(`Public bootstrap fallback pre ${key}`, error);
        return fallbackJson(fallbackPath);
      });
  }

  function getCars() {
    return fromBootstrap('cars', '/api/cars');
  }

  function getOrderOptions() {
    return getBootstrap().then(payload => {
      if (!payload?.orderOptions) throw new Error('Bootstrap neobsahuje orderOptions');
      return payload.orderOptions;
    });
  }

  function getPromos() {
    return fromBootstrap('promos', '/api/promos');
  }

  function clear() {
    bootstrapPromise = null;
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
  }

  function loadServicePromoMobileFix() {
    if (!document.querySelector('#servis [data-promo]')) return;

    if (!document.querySelector('link[data-service-promo-mobile-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = '/css/service-promo-mobile.css';
      style.dataset.servicePromoMobileStyle = '1';
      document.head.appendChild(style);
    }

    if (!document.querySelector('script[data-service-promo-mobile-script]')) {
      const script = document.createElement('script');
      script.src = '/js/service-promo-mobile.js';
      script.defer = true;
      script.dataset.servicePromoMobileScript = '1';
      document.head.appendChild(script);
    }
  }

  window.ppPublicData = {
    getBootstrap,
    getCars,
    getOrderOptions,
    getPromos,
    clear,
  };

  loadServicePromoMobileFix();

  // Začni čítať dáta hneď po parsovaní DOM. Ponuka, aktuality a objednávka
  // sa potom napoja na tú istú Promise namiesto troch samostatných requestov.
  if (
    document.getElementById('inventory') ||
    document.getElementById('vehicleOrderForm') ||
    document.getElementById('promo2Track')
  ) {
    getBootstrap().catch(() => {});
  }
})();
