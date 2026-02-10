(function(){
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

  // Navigácia – len parametrom v URL (nič neukladáme)
  function go(brand){
    location.href = 'index.html?brand=' + encodeURIComponent(brand);
  }

  // Klik a klávesnica na kartách
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.enter')) return;
      const brand = card.dataset.brand;
      if (brand) go(brand);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(card.dataset.brand); }
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
    location.href = 'index.html?brand=all';
  });

  // Preload pre svižnejší hover
  if (navigator.connection?.effectiveType !== '2g') {
    ['img/subarulogo.png','img/grandcherokke2024red.avif','img/subaruoutback2025magnetitgrey.avif']
      .forEach(src => { const i = new Image(); i.src = src; });
  }
})();
