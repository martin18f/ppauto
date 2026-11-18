// PP AUTO – posúvanie servisných akcií.
(function () {
  'use strict';

  const root = document.querySelector('#servis [data-promo]');
  if (!root) return;

  const track = root.querySelector('.promo-track');
  const prev = root.querySelector('.promo-btn.prev');
  const next = root.querySelector('.promo-btn.next');
  if (!track || !prev || !next) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function updateControls() {
    const canScroll = track.scrollWidth - track.clientWidth > 1;
    prev.hidden = !canScroll;
    next.hidden = !canScroll;
  }

  function move(direction) {
    const end = track.scrollWidth - track.clientWidth;
    const images = Array.from(track.querySelectorAll('.promo-img:not(.promo-hidden)'));
    if (end <= 1 || !images.length) return;

    const firstLeft = images[0].getBoundingClientRect().left;
    const positions = images.map(img => Math.min(end, img.getBoundingClientRect().left - firstLeft));
    positions.push(end);
    const current = track.scrollLeft;
    const left = direction > 0
      ? (positions.find(position => position > current + 1) ?? 0)
      : (positions.findLast(position => position < current - 1) ?? end);

    track.scrollTo({ left, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));

  track.addEventListener('keydown', (event) => {
    if (next.hidden) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
  });

  track.addEventListener('pp:promo-filter', () => {
    track.scrollLeft = 0;
    updateControls();
  });
  track.addEventListener('load', updateControls, true);
  new ResizeObserver(updateControls).observe(track);
  updateControls();
})();
