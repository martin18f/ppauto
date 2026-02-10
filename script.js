// ==============================
// Dynamické generovanie áut + filtrovanie s brand kontextom
// + úprava sekcií: Naše značky, Čo o nás hovoria zákazníci
// ==============================

let BRAND_CTX = null; // 'subaru' | 'kgm' | 'jeep' | null

const BRAND_CONFIG = {
  subaru: {
    tileText:
      'Symetrický AWD, BOXER motory a bezpečnosť EyeSight. Subaru je ideálne do Tatier aj na každý deň — stabilita, istota v zime a komfort na dlhých trasách.',
    testiTitle: 'Čo o nás hovoria zákazníci',
    quotes: [
      { text: '„Profesionálny prístup, rýchle dodanie a perfektný servis. Odporúčam.“', by: '— Zákazník z Popradu' },
      { text: '„Test jazda Subaru vybavená na počkanie, všetko zrozumiteľne vysvetlené.“', by: '— P. J., Kežmarok' },
      { text: '„AWD v zime neoceniteľné. PP AUTO sa o všetko postaralo.“', by: '— M. K., Svit' }
    ]
  },
  kgm: {
    tileText:
      'Moderné SUV a praktické rodinné modely, spoľahlivý pohon 4×4 a výborný pomer ceny a výbavy. KGM je robustné, komfortné a pripravené na mesto aj dlhé cesty.',
    testiTitle: 'Čo o nás hovoria zákazníci',
    quotes: [
      { text: '„Výborný prístup, férové jednanie a rýchle vybavenie všetkých formalít.“', by: '— Zákazník z Popradu' },
      { text: '„KGM ma milo prekvapilo výbavou a komfortom. Odporúčam prísť si to vyskúšať.“', by: '— R. S., Levoča' },
      { text: '„Všetko vysvetlené jasne a bez tlaku. Super skúsenosť.“', by: '— J. T., Spišská Nová Ves' }
    ]
  },
  jeep: {
    tileText:
      'DNA terénu a sloboda na každom kilometri. Jeep ponúka charakter, robustnosť a schopnosti od mesta až po off-road — s modernými technológiami a pohodlím.',
    testiTitle: 'Čo o nás hovoria zákazníci',
    quotes: [
      { text: '„Jeep pripravený na odber rýchlo, všetko prebehlo hladko. Perfektný prístup.“', by: '— Zákazník z Popradu' },
      { text: '„Test jazda vybavená na počkanie, vysvetlené financovanie bez skrytých poplatkov.“', by: '— P. J., Kežmarok' },
      { text: '„Auto má charakter a v teréne je to radosť. Ďakujem za servis a starostlivosť.“', by: '— M. K., Svit' }
    ]
  }
};

function isKnownBrand(b) {
  return b === 'subaru' || b === 'kgm' || b === 'jeep';
}

function getBrandFromURL() {
  const raw = new URLSearchParams(location.search).get('brand');
  if (!raw) return null;
  const b = raw.toLowerCase().trim();
  if (b === 'all') return null;
  return isKnownBrand(b) ? b : null;
}

function cleanBrandParamFromURL() {
  const url = new URL(location.href);
  if (!url.searchParams.has('brand')) return;
  url.searchParams.delete('brand');
  history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
}

/**
 * Brand režim:
 * - Ponuka áut: schovať brand taby (subaru/kgm/jeep), nechať len all/novinky/skladom
 * - Naše značky: nechať len 1 tile + brand text
 * - Testimonial: prepísať title a texty
 */
function applyBrandSections() {
  if (!BRAND_CTX) return;

  const cfg = BRAND_CONFIG[BRAND_CTX];
  if (!cfg) return;

  // 1) Naše značky: nechaj iba vybranú značku + text
  const znacky = document.getElementById('znacky');
  if (znacky) {
    znacky.querySelectorAll('.brand-tile').forEach(tile => {
      const h4 = (tile.querySelector('h4')?.textContent || '').toLowerCase().trim();

      const match =
        (BRAND_CTX === 'subaru' && h4.includes('subaru')) ||
        (BRAND_CTX === 'kgm' && h4.includes('kgm')) ||
        (BRAND_CTX === 'jeep' && h4.includes('jeep'));

      tile.style.display = match ? '' : 'none';

      if (match) {
        const p = tile.querySelector('p');
        if (p) p.textContent = cfg.tileText;

        const btn = tile.querySelector('a.btn');
        if (btn) btn.textContent = `Test jazda ${BRAND_CTX.toUpperCase() === 'KGM' ? 'KGM' : cfg ? (BRAND_CTX === 'kgm' ? 'KGM' : BRAND_CTX.charAt(0).toUpperCase() + BRAND_CTX.slice(1)) : 'Test jazda'}`;
      }
    });
  }

  // 2) Čo o nás hovoria zákazníci: nájdi sekciu podľa .testi
  const testiWrap = document.querySelector('.testi');
  if (testiWrap) {
    const sec = testiWrap.closest('section');
    const titleEl = sec?.querySelector('.section-head h3');
    if (titleEl) titleEl.textContent = cfg.testiTitle;

    const quotes = testiWrap.querySelectorAll('.quote');
    cfg.quotes.forEach((q, i) => {
      if (!quotes[i]) return;
      const p = quotes[i].querySelector('p');
      const by = quotes[i].querySelector('.by');
      if (p) p.textContent = q.text;
      if (by) by.textContent = q.by;
    });
  }
}

/**
 * Zobraz len povolené záložky pre brand: Všetko, Novinky, Skladom
 */
function pruneTabsForBrand() {
  if (!BRAND_CTX) return;

  const allowed = new Set(['all', 'novinky', 'skladom']);
  document.querySelectorAll('.filter-row .tag').forEach(btn => {
    const v = (btn.getAttribute('data-filter') || '').toLowerCase();
    btn.style.display = allowed.has(v) ? '' : 'none';
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
 * @param {string} filter - 'all' | 'novinky' | 'skladom' | iný tag
 */
function applyFilters(filter) {
  const cards = document.querySelectorAll('#inventory .car');
  const f = (filter || 'all').toLowerCase();

  cards.forEach(card => {
    const make = (card.dataset.make || '').toLowerCase().trim();
    const tags = (card.dataset.tags || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    // 1) Brand match – ak máme BRAND_CTX, pustíme len túto značku
    const brandOK = !BRAND_CTX || (make === BRAND_CTX || tags.includes(BRAND_CTX));

    // 2) Kategória/tab match (Novinky/Skladom)
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
  article.dataset.make = (auto.znacka || '').toLowerCase().trim();
  article.dataset.tags = (auto.tagy || []).join(' ').toLowerCase().trim();

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
 * Načítanie áut a aplikovanie filtrov
 */
async function nacitajAuta() {
  try {
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
    pruneTabsForBrand();
    applyFilters('all');

    console.log('✅ Načítané autá:', auta.length, '| BRAND_CTX =', BRAND_CTX || 'none');
  } catch (error) {
    console.error('❌ Chyba pri načítaní zoznamu áut:', error);
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  BRAND_CTX = getBrandFromURL();

  // uprav len: Naše značky + referencie + filter taby v ponuke
  applyBrandSections();

  // vyčisti URL len o brand parameter (zachová prípadné iné parametre)
  cleanBrandParamFromURL();

  // načítaj autá a aplikuj filtre
  nacitajAuta();
});
