(() => {
  const footer = document.querySelector('.ms-footer');
  if (!footer) return;

  const year = footer.querySelector('[data-ms-year]');
  if (year) year.textContent = new Date().getFullYear();

  let currentX = footer.clientWidth / 2;
  let currentY = footer.clientHeight / 2;
  let targetX = currentX;
  let targetY = currentY;
  let rafId = null;

  const animateGlow = () => {
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;

    footer.style.setProperty('--mouse-x', `${currentX}px`);
    footer.style.setProperty('--mouse-y', `${currentY}px`);

    const diffX = Math.abs(targetX - currentX);
    const diffY = Math.abs(targetY - currentY);

    if (diffX > 0.1 || diffY > 0.1) {
      rafId = requestAnimationFrame(animateGlow);
    } else {
      rafId = null;
    }
  };

  const startGlow = () => {
    if (!rafId) rafId = requestAnimationFrame(animateGlow);
  };

  footer.addEventListener('mousemove', (event) => {
    const rect = footer.getBoundingClientRect();
    targetX = event.clientX - rect.left;
    targetY = event.clientY - rect.top;
    startGlow();
  });

  footer.addEventListener('mouseleave', () => {
    targetX = footer.clientWidth / 2;
    targetY = footer.clientHeight / 2;
    startGlow();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        footer.classList.add('ms-visible');
        observer.disconnect();
      });
    }, { threshold: 0.12 });

    observer.observe(footer);
  } else {
    footer.classList.add('ms-visible');
  }
})();
