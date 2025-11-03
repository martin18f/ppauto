// ==============================
// Dynamické generovanie áut + filtrovanie s brand kontextom
// ==============================

let BRAND_CTX = null; // 'subaru' | 'kgm' | 'jeep' | null

function getBrandFromURL(){
  const raw = new URLSearchParams(location.search).get('brand');
  if (!raw) return null;
  const b = raw.toLowerCase();
  return (b === 'all') ? null : b; // 'all' = bez brand obmedzenia
}

/**
 * Zobraz len povolené záložky pre brand: Všetko, Novinky, Predvádzacie, Jazdené
 */
function pruneTabsForBrand(){
  if (!BRAND_CTX) return; // bez brand kontextu nič neskryváme

  const allowed = new Set(['all', 'novinky', 'predvadzacie', 'jazdene']);
  document.querySelectorAll('.filter-row .tag').forEach(btn => {
    const v = (btn.getAttribute('data-filter') || '').toLowerCase();
    if (!allowed.has(v)) {
      btn.style.display = 'none';
    } else {
      btn.style.display = ''; // istota
    }
  });

  // nastav "Všetko" ako aktívne
  const allBtn = document.querySelector('.filter-row .tag[data-filter="all"]');
  if (allBtn) {
    document.querySelectorAll('.filter-row .tag').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
  }
}

/**
 * Aplikuje kombinované filtrovanie: brand (ak je) + vybraná kategória (tab)
 * @param {string} filter - 'all' | 'novinky' | 'predvadzacie' | 'jazdene' | brand | iný tag
 */
function applyFilters(filter){
  const cards = document.querySelectorAll('#inventory .car');
  const f = (filter || 'all').toLowerCase();

  cards.forEach(card => {
    const make = (card.dataset.make || '').toLowerCase();
    const tags = (card.dataset.tags || '').toLowerCase().split(/\s+/);

    // 1) Brand match – ak máme BRAND_CTX, pustíme len túto značku
    const brandOK = !BRAND_CTX || (make === BRAND_CTX || tags.includes(BRAND_CTX));

    // 2) Kategória/tab match
    let catOK = true;
    if (f !== 'all') {
      catOK = tags.includes(f);
    }

    card.classList.toggle('is-hidden', !(brandOK && catOK));
  });
}

/**
 * Vytvorí DOM element <article> pre jedno auto
 */
function vykresliKartu(auto) {
  const article = document.createElement('article');
  article.className = 'car';
  article.dataset.make = (auto.znacka || '').toLowerCase();
  article.dataset.tags = (auto.tagy || []).join(' ').toLowerCase();

  // --- LOGIKA CIEN ---
  const maZlavu = !!(auto.nova_cena && String(auto.nova_cena).trim() !== '');
  let priceHTML = '';

  if (maZlavu) {
    priceHTML = `
      <div class="price">
        <span class="oldprice">${auto.stara_cena || ''}</span>
      </div>
      <div class="discountprice">${auto.nova_cena}</div>
    `;
  } else {
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
 * Inicializuje správanie záložiek (tabov)
 */
function initFiltery() {
  const buttons = document.querySelectorAll('.filter-row .tag');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = (btn.getAttribute('data-filter') || 'all').toLowerCase();
      applyFilters(filter);
    });
  });
}

/**
 * Načítanie áut a nastavenie brand kontextu
 */
async function nacitajAuta() {
  try {
    // 🔹 automatická detekcia prostredia
    const isLocal = location.protocol === 'file:' || location.hostname === 'localhost';
    const response = await fetch(isLocal ? 'data/auta.json' : '/api/cars', { cache: 'no-store' });
    const auta = await response.json();

    const container = document.getElementById('inventory');
    if (!container) {
      console.error('❌ Nenašiel som #inventory vo vašom HTML.');
      return;
    }

    container.innerHTML = '';
    auta.forEach(auto => container.appendChild(vykresliKartu(auto)));

    initFiltery();
    BRAND_CTX = getBrandFromURL();
    pruneTabsForBrand();
    applyFilters('all');

    try { history.replaceState({}, '', 'index.html'); } catch (e) {}

    console.log('✅ Načítané autá:', auta.length, '| BRAND_CTX =', BRAND_CTX || 'none');
  } catch (error) {
    console.error('❌ Chyba pri načítaní zoznamu áut:', error);
  }
}


document.addEventListener('DOMContentLoaded', nacitajAuta);
