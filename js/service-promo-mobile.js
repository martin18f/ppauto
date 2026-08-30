// PP AUTO – mobilné ovládanie servisných akcií.
// Na desktope necháva pôvodnú logiku bez zásahu.
(function () {
  'use strict';

  const root = document.querySelector('#servis [data-promo]');
  if (!root) return;

  const track = root.querySelector('.promo-track');
  const prev = root.querySelector('.promo-btn.prev');
  const next = root.querySelector('.promo-btn.next');
  if (!track) return;

  const mobile = window.matchMedia('(max-width: 720px)');

  function visibleImages() {
    return Array.from(track.querySelectorAll('.promo-img')).filter((img) => {
      if (img.classList.contains('promo-hidden')) return false;
      return getComputedStyle(img).display !== 'none';
    });
  }

  function nearestVisibleIndex(images) {
    if (!images.length) return -1;
    const trackRect = track.getBoundingClientRect();
    let bestIndex = 0;
    let bestDistance = Infinity;

    images.forEach((img, index) => {
      const rect = img.getBoundingClientRect();
      const distance = Math.abs(rect.left - trackRect.left);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function scrollToImage(img, behavior = 'smooth') {
    if (!img) return;
    const trackRect = track.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    const left = track.scrollLeft + (imageRect.left - trackRect.left);
    track.scrollTo({ left, behavior });
  }

  function move(direction) {
    const images = visibleImages();
    if (!images.length) return;

    const current = nearestVisibleIndex(images);
    const nextIndex = current < 0
      ? 0
      : (current + direction + images.length) % images.length;

    scrollToImage(images[nextIndex]);
  }

  function bindButton(button, direction) {
    button?.addEventListener('click', (event) => {
      if (!mobile.matches) return;

      // Pôvodný slider má vlastný bubble listener. Na mobile ho nahradíme
      // týmto presným scrollom na najbližší viditeľný banner.
      event.preventDefault();
      event.stopImmediatePropagation();
      move(direction);
    }, true);
  }

  bindButton(prev, -1);
  bindButton(next, 1);

  track.addEventListener('keydown', (event) => {
    if (!mobile.matches) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
  });

  // Pri zmene brand filtra sa niektoré bannery skryjú. Starý scrollLeft by
  // potom mohol zostať na prázdnom mieste, preto sa vrátime na prvý viditeľný.
  let resetFrame = 0;
  const resetAfterFilter = () => {
    cancelAnimationFrame(resetFrame);
    resetFrame = requestAnimationFrame(() => {
      if (!mobile.matches) return;
      const first = visibleImages()[0];
      if (first) scrollToImage(first, 'auto');
      else track.scrollTo({ left: 0, behavior: 'auto' });
    });
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'attributes')) resetAfterFilter();
  });

  track.querySelectorAll('.promo-img').forEach((img) => {
    observer.observe(img, { attributes: true, attributeFilter: ['class', 'style'] });
  });

  mobile.addEventListener?.('change', (event) => {
    if (event.matches) resetAfterFilter();
  });

  if (mobile.matches) resetAfterFilter();
})();