(function(){
  try { sessionStorage.removeItem('ppauto.chooserRedirectAt'); } catch (e) {}

  const BRAND_SESSION_KEY = 'ppauto.brandSession';
  const LEGACY_BRAND_KEY = 'ppauto.brand';
  const SESSION_TTL_MS = 60 * 1000;
  const ALLOWED_BRANDS = new Set(['subaru', 'kgm', 'jeep', 'chery', 'all']);

  function readBrandSession() {
    try {
      const raw = localStorage.getItem(BRAND_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const brand = String(parsed?.brand || '').toLowerCase().trim();
      const lastSeen = Number(parsed?.lastSeen || 0);
      if (!ALLOWED_BRANDS.has(brand) || !Number.isFinite(lastSeen) || lastSeen <= 0) return null;
      return { brand, lastSeen };
    } catch (e) {
      return null;
    }
  }

  function writeBrandSession(brand, now = Date.now()) {
    const normalized = String(brand || '').toLowerCase().trim();
    if (!ALLOWED_BRANDS.has(normalized)) return false;

    try {
      localStorage.setItem(BRAND_SESSION_KEY, JSON.stringify({ brand: normalized, lastSeen: now }));
      // Zachovanie kompatibility s existujúcou brand témou na detailoch vozidiel.
      if (normalized === 'all') localStorage.removeItem(LEGACY_BRAND_KEY);
      else localStorage.setItem(LEGACY_BRAND_KEY, normalized);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearExpiredBrandSession() {
    try {
      localStorage.removeItem(BRAND_SESSION_KEY);
      localStorage.removeItem(LEGACY_BRAND_KEY);
    } catch (e) {}
  }

  function isSessionFresh(session, now = Date.now()) {
    return !!session && now - session.lastSeen <= SESSION_TTL_MS;
  }

  function isLocalRouteHost() {
    return location.protocol === 'file:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '::1';
  }

  function withLang(href) {
    return window.ppI18n ? window.ppI18n.withLang(href) : href;
  }

  // Navigácia cez čitateľné URL na produkcii, cez reálne súbory lokálne.
  function cleanBrandHref(brand) {
    if (isLocalRouteHost()) return 'index.html?brand=' + encodeURIComponent(brand);
    if (brand === 'all') return '/ponuka';
    return '/' + encodeURIComponent(brand);
  }

  function forcedChooser() {
    return new URLSearchParams(location.search).get('choose') === '1';
  }

  // Ak sa používateľ vráti na ppauto.sk počas stále platnej session,
  // výberová stránka ho pošle rovno späť do jeho poslednej voľby.
  // Parameter ?choose=1 je vedomé kliknutie na „Zmeniť značku“ a výber vždy zobrazí.
  const existingSession = readBrandSession();
  if (!forcedChooser() && existingSession) {
    if (isSessionFresh(existingSession)) {
      writeBrandSession(existingSession.brand);
      location.replace(withLang(cleanBrandHref(existingSession.brand)));
      return;
    }
    clearExpiredBrandSession();
  }

  const cards = document.querySelectorAll('.card');

  // Tilt + svetelný lesk
  cards.forEach(card => {
    const shine = card.querySelector('.media .shine');
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -6;
      const ry = (px - 0.5) * 10;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      if (shine){
        shine.style.setProperty('--mx', (px*100)+'%');
        shine.style.setProperty('--my', (py*100)+'%');
      }
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  function go(brand){
    if (!ALLOWED_BRANDS.has(String(brand || '').toLowerCase())) return;
    writeBrandSession(brand);
    const href = cleanBrandHref(brand);
    location.href = withLang(href);
  }

  // Klik a klávesnica na kartách
  cards.forEach(card => {
    const brand = String(card.dataset.brand || '').toLowerCase();
    const mainLink = card.querySelector('.card-main-link');
    if (brand && mainLink) mainLink.setAttribute('href', withLang(cleanBrandHref(brand)));

    // Link samotný musí session uložiť ešte pred navigáciou.
    mainLink?.addEventListener('click', () => {
      if (brand) writeBrandSession(brand);
    });

    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      if (brand) go(brand);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(brand); }
    });
  });

  // Tlačidlo „Vstúpiť“
  document.querySelectorAll('.enter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const brand = e.currentTarget.dataset.brand;
      if (brand) go(brand);
    });
  });

  // „Zobraziť všetko“ je tiež platná voľba session.
  document.getElementById('skipOnce')?.addEventListener('click', () => {
    writeBrandSession('all');
    const href = isLocalRouteHost() ? 'index.html?brand=all' : '/ponuka';
    location.href = withLang(href);
  });

  // Slider fotiek autosalónu
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

  // Preload pre svižnejší hover
  if (navigator.connection?.effectiveType !== '2g') {
    ['img/subarulogo.png','img/grandcherokke2024red.avif','img/subaruoutback2025magnetitgrey.avif','img/cherylogo.png']
      .forEach(src => { const i = new Image(); i.src = src; });
  }
})();
