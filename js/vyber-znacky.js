(function () {
  'use strict';

  const BRAND_SESSION_KEY = 'ppauto.brandSession';
  const LEGACY_BRAND_KEY = 'ppauto.brand';
  const SESSION_TTL_MS = 2 * 60 * 1000;
  const ALLOWED_BRANDS = new Set(['subaru', 'kgm', 'jeep', 'chery', 'all']);

  function isLocalRouteHost() {
    return location.protocol === 'file:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '::1';
  }

  function withLang(href) {
    return window.ppI18n ? window.ppI18n.withLang(href) : href;
  }

  function cleanBrandHref(brand) {
    if (isLocalRouteHost()) return 'index.html?brand=' + encodeURIComponent(brand);
    return brand === 'all' ? '/ponuka' : '/' + encodeURIComponent(brand);
  }

  function orderFormHref() {
    return withLang(cleanBrandHref('all')) + '#objednat-auto';
  }

  function forcedChooser() {
    return new URLSearchParams(location.search).get('choose') === '1';
  }

  function clearLegacyStorage() {
    try {
      localStorage.removeItem(BRAND_SESSION_KEY);
      localStorage.removeItem(LEGACY_BRAND_KEY);
    } catch (e) {}
    try { sessionStorage.removeItem('selected_brand'); } catch (e) {}
  }

  function clearBrandSession() {
    try {
      sessionStorage.removeItem(BRAND_SESSION_KEY);
      sessionStorage.removeItem(LEGACY_BRAND_KEY);
    } catch (e) {}
    clearLegacyStorage();
  }

  function readBrandSession() {
    try {
      const raw = sessionStorage.getItem(BRAND_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const brand = String(parsed?.brand || '').toLowerCase().trim();
      const expiresAt = Number(parsed?.expiresAt || 0);
      if (!ALLOWED_BRANDS.has(brand) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        clearBrandSession();
        return null;
      }
      return { brand, expiresAt };
    } catch (e) {
      clearBrandSession();
      return null;
    }
  }

  function writeBrandSession(brand) {
    const normalized = String(brand || '').toLowerCase().trim();
    if (!ALLOWED_BRANDS.has(normalized)) return false;

    clearLegacyStorage();
    try {
      const session = {
        brand: normalized,
        expiresAt: Date.now() + SESSION_TTL_MS,
      };
      sessionStorage.setItem(BRAND_SESSION_KEY, JSON.stringify(session));
      if (normalized === 'all') sessionStorage.removeItem(LEGACY_BRAND_KEY);
      else sessionStorage.setItem(LEGACY_BRAND_KEY, normalized);
      return true;
    } catch (e) {
      return false;
    }
  }

  clearLegacyStorage();

  // Pri obyčajnom návrate na chooser počas stále platnej session pokračuj vo voľbe.
  // ?choose=1 je explicitné „Zmeniť značku“ a chooser musí zostať zobrazený.
  const existingSession = readBrandSession();
  if (!forcedChooser() && existingSession) {
    location.replace(withLang(cleanBrandHref(existingSession.brand)));
    return;
  }

  const cards = document.querySelectorAll('.card');

  // Tilt + svetelný lesk.
  cards.forEach(card => {
    const shine = card.querySelector('.media .shine');
    card.addEventListener('mousemove', event => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      card.style.transform = `perspective(900px) rotateX(${(py - 0.5) * -6}deg) rotateY(${(px - 0.5) * 10}deg)`;
      if (shine) {
        shine.style.setProperty('--mx', (px * 100) + '%');
        shine.style.setProperty('--my', (py * 100) + '%');
      }
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  function go(brand) {
    const normalized = String(brand || '').toLowerCase().trim();
    if (!ALLOWED_BRANDS.has(normalized)) return;
    if (!writeBrandSession(normalized)) return;
    location.href = withLang(cleanBrandHref(normalized));
  }

  cards.forEach(card => {
    const brand = String(card.dataset.brand || '').toLowerCase().trim();
    const mainLink = card.querySelector('.card-main-link');

    if (brand && mainLink) {
      mainLink.setAttribute('href', withLang(cleanBrandHref(brand)));
      mainLink.addEventListener('click', event => {
        // Pri otvorení v novom tabe nemôžeme preniesť sessionStorage; nech nový tab
        // začne ako nový návštevník cez chooser.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) return;
        if (!writeBrandSession(brand)) event.preventDefault();
      });
    }

    card.addEventListener('click', event => {
      if (event.target.closest('a, button')) return;
      if (brand) go(brand);
    });

    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (brand) go(brand);
    });
  });

  document.querySelectorAll('.enter').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const brand = event.currentTarget.dataset.brand;
      if (brand) go(brand);
    });
  });

  // Online objednávka potrebuje rovnakú krátku brand session ako vstup do ponuky.
  // Používame režim „all“, aby objednávkový formulár nebol filtrovaný na jednu značku.
  const onlineOrderCta = document.querySelector('.online-order-launch__cta');
  if (onlineOrderCta) {
    onlineOrderCta.setAttribute('href', orderFormHref());
    onlineOrderCta.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) return;
      if (!writeBrandSession('all')) event.preventDefault();
    });
  }

  document.getElementById('skipOnce')?.addEventListener('click', () => go('all'));

  // Slider fotiek autosalónu – zachované pôvodné správanie.
  const slider = document.querySelector('.showroom-slider');
  if (slider) {
    const track = slider.querySelector('.showroom-slider__track');
    const slides = Array.from(slider.querySelectorAll('.showroom-slider__track img'));
    const prev = slider.querySelector('[data-showroom-slider="prev"]');
    const next = slider.querySelector('[data-showroom-slider="next"]');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer = null;

    function render() {
      if (track) track.style.transform = `translateX(-${index * 100}%)`;
    }

    function moveSlider(delta) {
      if (!slides.length) return;
      index = (index + delta + slides.length) % slides.length;
      render();
    }

    function stopAuto() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    function startAuto() {
      if (reduceMotion || slides.length <= 1 || timer) return;
      timer = setInterval(() => moveSlider(1), 3500);
    }

    prev?.addEventListener('click', () => moveSlider(-1));
    next?.addEventListener('click', () => moveSlider(1));
    startAuto();
    slider.addEventListener('mouseenter', stopAuto);
    slider.addEventListener('mouseleave', startAuto);
  }

  if (navigator.connection?.effectiveType !== '2g') {
    [
      'img/subarulogo.png',
      'img/grandcherokke2024red.avif',
      'img/subaruoutback2025magnetitgrey.avif',
      'img/cherylogo.png',
    ].forEach(src => {
      const image = new Image();
      image.src = src;
    });
  }
})();
