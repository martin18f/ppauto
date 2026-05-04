(function () {
  'use strict';

  // 1) Sem doplň skutočné GA4 Measurement ID, napr. G-ABC123XYZ.
  //    Ak Google Analytics nepoužívaš, nechaj prázdne.
  const GA4_MEASUREMENT_ID = 'G-D1M84JBWQG';

  const STORAGE_KEY = 'ppauto_cookie_consent_v1';
  const MAX_AGE_DAYS = 180;

  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Predvolený stav: bez súhlasu sa analytika ani marketingové signály nepovoľujú.
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    personalization_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted'
  });

  function nowIso() { return new Date().toISOString(); }

  function readConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.savedAt) return null;
      const saved = new Date(data.savedAt).getTime();
      if (!Number.isFinite(saved)) return null;
      const ageDays = (Date.now() - saved) / (1000 * 60 * 60 * 24);
      if (ageDays > MAX_AGE_DAYS) return null;
      return {
        necessary: true,
        analytics: !!data.analytics,
        maps: !!data.maps,
        savedAt: data.savedAt
      };
    } catch (e) {
      return null;
    }
  }

  function saveConsent(consent) {
    const data = {
      necessary: true,
      analytics: !!consent.analytics,
      maps: !!consent.maps,
      savedAt: nowIso()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  function hasRealGaId() {
    return GA4_MEASUREMENT_ID && !/X{4,}/.test(GA4_MEASUREMENT_ID);
  }

  function loadGoogleAnalytics() {
    if (!hasRealGaId()) return;
    if (document.getElementById('pp-ga4-script')) return;

    const s = document.createElement('script');
    s.id = 'pp-ga4-script';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_MEASUREMENT_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', GA4_MEASUREMENT_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function updateGoogleConsent(consent) {
    gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      personalization_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted'
    });
    if (consent.analytics) loadGoogleAnalytics();
  }

  function activateMaps() {
    document.querySelectorAll('[data-cookie-embed="maps"]').forEach((box) => {
      if (box.querySelector('iframe')) return;
      const src = box.getAttribute('data-src');
      if (!src) return;
      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.width = '100%';
      iframe.height = box.getAttribute('data-height') || '400';
      iframe.style.border = '0';
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.title = box.getAttribute('data-title') || 'Mapa PP AUTO';
      box.innerHTML = '';
      box.appendChild(iframe);
    });
  }

  function blockMaps() {
    document.querySelectorAll('[data-cookie-embed="maps"]').forEach((box) => {
      if (box.querySelector('.pp-map-placeholder')) return;
      box.innerHTML = [
        '<div class="pp-map-placeholder">',
        '<div>',
        '<strong>Mapa je zablokovaná</strong>',
        '<p>Google Maps sa načíta až po povolení kategórie „Mapy a externý obsah“.</p>',
        '<button class="pp-cookie-btn primary" type="button" data-cookie-open-settings>Povoliť mapu</button>',
        '</div>',
        '</div>'
      ].join('');
    });
  }

  function applyConsent(consent) {
    const c = consent || { necessary: true, analytics: false, maps: false };
    updateGoogleConsent(c);
    if (c.maps) activateMaps(); else blockMaps();
  }

  function bannerHtml() {
    return [
      '<div class="pp-cookie-banner" id="ppCookieBanner" role="dialog" aria-live="polite" aria-label="Nastavenie cookies">',
      '<div class="pp-cookie-card">',
      '<div>',
      '<h2>Cookies a externé služby</h2>',
      '<p>Používame nevyhnutné súbory pre fungovanie webu. Analytiku Google Analytics a Google Maps načítame iba po vašom súhlase. Nastavenie môžete kedykoľvek zmeniť.</p>',
      '</div>',
      '<div class="pp-cookie-actions">',
      '<button class="pp-cookie-btn ghost" type="button" data-cookie-reject>Odmietnuť voliteľné</button>',
      '<button class="pp-cookie-btn" type="button" data-cookie-open-settings>Nastavenia</button>',
      '<button class="pp-cookie-btn primary" type="button" data-cookie-accept-all>Prijať všetko</button>',
      '</div>',
      '</div>',
      '</div>',
      '<button class="pp-cookie-open-settings" id="ppCookieOpenSettings" type="button" data-cookie-open-settings>Nastavenia cookies</button>'
    ].join('');
  }

  function modalHtml() {
    return [
      '<div class="pp-cookie-modal" id="ppCookieModal" role="dialog" aria-modal="true" aria-label="Nastavenia cookies">',
      '<div class="pp-cookie-dialog">',
      '<div class="pp-cookie-head">',
      '<h2>Nastavenia cookies</h2>',
      '<button class="pp-cookie-close" type="button" data-cookie-close aria-label="Zavrieť">×</button>',
      '</div>',
      '<div class="pp-cookie-body">',
      '<p>Zvoľte, ktoré voliteľné služby môže web používať. Nevyhnutné technické uloženia sú vždy aktívne, pretože bez nich web alebo bezpečnostné funkcie nevedia fungovať.</p>',
      '<div class="pp-cookie-row">',
      '<div><h3>Nevyhnutné</h3><p>Zapamätanie nastavení cookies, technická bezpečnosť, základné fungovanie webu a administrácie.</p></div>',
      '<label class="pp-cookie-switch"><input type="checkbox" checked disabled><span class="pp-cookie-slider"></span></label>',
      '</div>',
      '<div class="pp-cookie-row">',
      '<div><h3>Analytika</h3><p>Google Analytics – meranie návštevnosti a zlepšovanie webu. Spustí sa len po súhlase.</p></div>',
      '<label class="pp-cookie-switch"><input id="ppCookieAnalytics" type="checkbox"><span class="pp-cookie-slider"></span></label>',
      '</div>',
      '<div class="pp-cookie-row">',
      '<div><h3>Mapy a externý obsah</h3><p>Google Maps iframe v sekcii „Tu nás nájdete“. Bez súhlasu ostane mapa nahradená bezpečným placeholderom.</p></div>',
      '<label class="pp-cookie-switch"><input id="ppCookieMaps" type="checkbox"><span class="pp-cookie-slider"></span></label>',
      '</div>',
      '</div>',
      '<div class="pp-cookie-foot">',
      '<button class="pp-cookie-btn ghost" type="button" data-cookie-reject>Odmietnuť voliteľné</button>',
      '<button class="pp-cookie-btn" type="button" data-cookie-save>Uložiť nastavenia</button>',
      '<button class="pp-cookie-btn primary" type="button" data-cookie-accept-all>Prijať všetko</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join('');
  }

  function showBanner() {
    const banner = document.getElementById('ppCookieBanner');
    if (banner) banner.classList.add('is-visible');
    const settings = document.getElementById('ppCookieOpenSettings');
    if (settings) settings.classList.remove('is-visible');
  }

  function hideBanner() {
    const banner = document.getElementById('ppCookieBanner');
    if (banner) banner.classList.remove('is-visible');
    const settings = document.getElementById('ppCookieOpenSettings');
    if (settings) settings.classList.add('is-visible');
  }

  function openSettings() {
    const current = readConsent() || { analytics: false, maps: false };
    const analytics = document.getElementById('ppCookieAnalytics');
    const maps = document.getElementById('ppCookieMaps');
    if (analytics) analytics.checked = !!current.analytics;
    if (maps) maps.checked = !!current.maps;
    const modal = document.getElementById('ppCookieModal');
    if (modal) modal.classList.add('is-visible');
  }

  function closeSettings() {
    const modal = document.getElementById('ppCookieModal');
    if (modal) modal.classList.remove('is-visible');
  }

  function storeAndApply(consent) {
    const saved = saveConsent(consent);
    applyConsent(saved);
    hideBanner();
    closeSettings();
  }

  function initUi() {
    document.body.insertAdjacentHTML('beforeend', bannerHtml() + modalHtml());

    document.addEventListener('click', function (e) {
      const target = e.target.closest('button');
      if (!target) return;
      if (target.matches('[data-cookie-open-settings]')) openSettings();
      if (target.matches('[data-cookie-close]')) closeSettings();
      if (target.matches('[data-cookie-accept-all]')) storeAndApply({ analytics: true, maps: true });
      if (target.matches('[data-cookie-reject]')) storeAndApply({ analytics: false, maps: false });
      if (target.matches('[data-cookie-save]')) {
        storeAndApply({
          analytics: !!document.getElementById('ppCookieAnalytics')?.checked,
          maps: !!document.getElementById('ppCookieMaps')?.checked
        });
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSettings();
    });

    window.ppCookieSettings = openSettings;

    const current = readConsent();
    if (current) {
      applyConsent(current);
      hideBanner();
    } else {
      applyConsent({ analytics: false, maps: false });
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUi, { once: true });
  } else {
    initUi();
  }
})();