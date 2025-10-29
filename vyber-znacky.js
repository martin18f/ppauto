// Tilt + highlight „svetelného lesku“
document.querySelectorAll('.card').forEach(card => {
  const media = card.querySelector('.media .shine');
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * -6; // naklonenie X
    const ry = (px - 0.5) * 10; // naklonenie Y
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    media && (media.style.setProperty('--mx', (px*100)+'%'), media.style.setProperty('--my', (py*100)+'%'));
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// Klik – ulož značku a choď na index s parametrom ?brand=
function go(brand){
  // nič neukladáme – len otvoríme index s parametrom
  location.href = 'index.html?brand=' + encodeURIComponent(brand);
}

document.querySelectorAll('.card .enter').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const brand = e.currentTarget.closest('.card')?.dataset.brand;
    if (brand) go(brand);
  });
});

// Voliteľné: "Zobraziť všetko" = otvorí index bez obmedzenia značky
document.getElementById('skipOnce')?.addEventListener('click', () => {
  location.href = 'index.html?brand=all';
});


