// ==============================
// Dynamické generovanie áut z data/auta.json
// + filtrovanie podľa značiek / tagov
// ==============================

async function nacitajAuta() {
  try {
    const response = await fetch('/api/cars', { cache: 'no-store' });
    const auta = await response.json();

    const container = document.getElementById('inventory');
    if (!container) {
      console.error('❌ Nenašiel som #inventory vo vašom HTML.');
      return;
    }

    // vyčisti kontajner a vykresli karty
    container.innerHTML = '';
    auta.forEach(auto => container.appendChild(vykresliKartu(auto)));

    // inicializuj filtrovanie
    initFiltery();

    console.log('✅ Načítané autá:', auta.length);
  } catch (error) {
    console.error('❌ Chyba pri načítaní data/auta.json:', error);
  }
}

/**
 * Vytvorí DOM element <article> pre jedno auto
 */
function vykresliKartu(auto) {
  const article = document.createElement('article');
  article.className = 'car';
  article.dataset.make = (auto.znacka || '').toLowerCase();
  article.dataset.tags = (auto.tagy || []).join(' ');

  // --- LOGIKA CIEN ---
  const maZlavu = !!(auto.nova_cena && String(auto.nova_cena).trim() !== '');
  let priceHTML = '';

  if (maZlavu) {
    // so zľavou: stará (prečiarknutá) + nová (zelená)
    priceHTML = `
      <div class="price">
        <span class="oldprice">${auto.stara_cena || ''}</span>
      </div>
      <div class="discountprice">${auto.nova_cena}</div>
    `;
  } else {
    // bez zľavy: jedna biela cena
    const aktualna = (auto.stara_cena && String(auto.stara_cena).trim() !== '')
      ? auto.stara_cena
      : 'Cena na vyžiadanie';
    priceHTML = `
      <div class="price">
        <span class="singleprice">${aktualna}</span>
      </div>
    `;
  }

  article.innerHTML = `
    <div class="img">
      <img src="${auto.obrazok}" alt="${auto.rok || ''} ${auto.znacka || ''} ${auto.model || ''}">
    </div>
    <div class="body">
      <h4>${auto.rok || ''} ${(auto.znacka || '').toUpperCase()} ${auto.model || ''}</h4>

      <div class="specs">
        <div class="spec">${auto.rok || '-'}</div>
        <div class="spec">${auto.palivo || '-'}</div>
        <div class="spec">${auto.prevodovka || '-'}</div>
      </div>

      <div class="price-row">
        <div class="price-group">
          ${priceHTML}
        </div>
        <a class="pill" href="#kontakt">Zistiť viac</a>
      </div>
    </div>
  `;

  return article;
}

/**
 * Nastaví filtrovanie podľa tlačidiel s .tag (data-filter)
 */
function initFiltery() {
  const buttons = document.querySelectorAll('.filter-row .tag');
  const cards = document.querySelectorAll('#inventory .car');

  if (!buttons.length || !cards.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // active stav
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      cards.forEach(card => {
        card.classList.remove('is-hidden');

        if (filter === 'all') return;

        const make = card.dataset.make || '';
        const tags = (card.dataset.tags || '').split(/\s+/);

        const matchMake = make === filter;
        const matchTag = tags.includes(filter);

        if (!(matchMake || matchTag)) {
          card.classList.add('is-hidden');
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', nacitajAuta);
