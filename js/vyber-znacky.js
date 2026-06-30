(function(){
  try { sessionStorage.removeItem('ppauto.chooserRedirectAt'); } catch (e) {}

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
    return '/' + encodeURIComponent(brand);
  }

  function go(brand){
    const href = cleanBrandHref(brand);
    location.href = withLang(href);
  }

  // Klik a klávesnica na kartách
  cards.forEach(card => {
    const brand = card.dataset.brand;
    const mainLink = card.querySelector('.card-main-link');
    if (brand && mainLink) mainLink.setAttribute('href', withLang(cleanBrandHref(brand)));

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

  // „Zobraziť všetko“
  document.getElementById('skipOnce')?.addEventListener('click', () => {
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
