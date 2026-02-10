// ==============================
// Ponuka áut + filtrovanie + brand kontext (pamätá si výber)
// + úprava sekcií: Značky (nadpis + 1 tile) + Testimonials (nadpis + texty)
// ==============================

let BRAND_CTX = null; // 'subaru' | 'kgm' | 'jeep' | null
const BRAND_STORAGE_KEY = 'ppauto.brand';

const BRAND_LABEL = {
  subaru: 'Subaru',
  kgm: 'KGM',
  jeep: 'Jeep',
};

const BRAND_CONFIG = {
  subaru: {
    tileText:
      'Symetrický AWD, BOXER motory a bezpečnosť EyeSight. Ideálne do Tatier aj na každý deň — stabilita, istota v zime a komfort na dlhých trasách.',
    testiTitle: 'Čo o nás hovoria zákazníci',
    quotes: [
      { text: '„Profesionálny prístup, rýchle dodanie a perfektný servis. Odporúčam.“', by: '— Zákazník z Popradu' },
      { text: '„Test jazda Subaru vybavená na počkanie, všetko zrozumiteľne vysvetlené.“', by: '— P. J., Kežmarok' },
      { text: '„AWD v zime neoceniteľné. PP AUTO sa o všetko postaralo.“', by: '— M. K., Svit' },
    ],
  },
  kgm: {
    tileText:
      'Moderné SUV a praktické rodinné modely, spoľahlivý pohon 4×4 a výborný pomer ceny a výbavy. KGM je robustné, komfortné a pripravené na mesto aj dlhé cesty.',
    testiTitle: 'Čo o nás hovoria zákazníci',
    quotes: [
      { text: '„Výborný prístup, férové jednanie a rýchle vybavenie všetkých formalít.“', by: '— Zákazník z Popradu' },
      { text: '„KGM ma milo prekvapilo výbavou a komfortom. Odporúčam prísť si to vyskúšať.“', by: '— R. S., Levoča' },
      { text: '„Všetko vysvetlené jasne a bez tlaku. Super skúsenosť.“', by: '— J. T., Spišská Nová Ves' },
    ],
  },
  jeep: {
    tileText:
      'DNA terénu a sloboda na každom kilometri. Jeep ponúka charakter, robustnosť a schopnosti od mesta až po off-road — s modernými technológiami a pohodlím.',
    testiTitle: 'Čo o nás hovoria zákazníci',
    quotes: [
      { text: '„Jeep pripravený na odber rýchlo, všetko prebehlo hladko. Perfektný prístup.“', by: '— Zákazník z Popradu' },
      { text: '„Test jazda vybavená na počkanie, vysvetlené financovanie bez skrytých poplatkov.“', by: '— P. J., Kežmarok' },
      { text: '„Auto má charakter a v teréne je to radosť. Ďakujem za servis a starostlivosť.“', by: '— M. K., Svit' },
    ],
  },
};

function isKnownBrand(b) {
  return b === 'subaru' || b === 'kgm' || b === 'jeep';
}

function setStoredBrand(brand) {
  try {
    if (!brand) {
      localStorage.removeItem(BRAND_STORAGE_KEY);
      return;
    }
    localStorage.setItem(BRAND_STORAGE_KEY, brand);
  } catch (e) {
    // fallback (ak je localStorage bloknutý)
    try {
      if (!brand) sessionStorage.removeItem(BRAND_STORAGE_KEY);
      else sessionStorage.setItem(BRAND_STORAGE_KEY, brand);
    } catch (e2) {}
  }
}

function getStoredBrand() {
  try {
    const v = (localStorage.getItem(BRAND_STORAGE_KEY) || '').toLowerCase().trim();
    return isKnownBrand(v) ? v : null;
  } catch (e) {
    try {
      const v = (sessionStorage.getItem(BRAND_STORAGE_KEY) || '').toLowerCase().trim();
      return isKnownBrand(v) ? v : null;
    } catch (e2) {
      return null;
    }
  }
}

function getBrandFromURLRaw() {
  const raw = new URLSearchParams(location.search).get('brand');
  return raw ? raw.toLowerCase().trim() : null;
}

/**
 * - ak je v URL ?brand=... → nastav BRAND_CTX + ulož do storage
 * - ak je ?brand=all → vymaž storage a BRAND_CTX = null
 * - ak v URL nič nie je → zober zo storage (aby fungoval refresh)
 */
function resolveBrandContext() {
  const fromURL = getBrandFromURLRaw();

  if (fromURL) {
    if (fromURL === 'all') {
      setStoredBrand(null);
      return null;
    }
    if (isKnownBrand(fromURL)) {
      setStoredBrand(fromURL);
      return fromURL;
    }
    // neznámy brand → ignoruj a vymaž
    setStoredBrand(null);
    return null;
  }

  return getStoredBrand();
}

function cleanBrandParamFromURL() {
  const url = new URL(location.href);
  if (!url.searchParams.has('brand')) return;
  url.searchParams.delete('brand');
  history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
}

/**
 * Zobraz len povolené záložky pre brand: Všetko, Novinky, Skladom
 * (brand taby schováme, lebo už si v brand režime)
 */
function pruneTabsForBrand() {
  const buttons = document.querySelectorAll('.filter-row .tag');
  if (!buttons.length) return;

  if (!BRAND_CTX) {
    // bez brand kontextu nechaj všetko
    buttons.forEach(btn => (btn.style.display = ''));
    return;
  }

  const allowed = new Set(['all', 'novinky', 'skladom']);
  buttons.forEach(btn => {
    const v = (btn.getAttribute('data-filter') || '').toLowerCase();
    btn.style.display = allowed.has(v) ? '' : 'none';
  });

  // nastav "Všetko" ako aktívne
  const allBtn = document.querySelector('.filter-row .tag[data-filter="all"]');
  if (allBtn) {
    buttons.forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
  }
}

/**
 * Aplikuje filtrovanie: brand (ak je) + vybraná kategória (Novinky/Skladom)
 */
function applyFilters(filter) {
  const cards = document.querySelectorAll('#inventory .car');
  const f = (filter || 'all').toLowerCase();

  cards.forEach(card => {
    const make = (card.dataset.make || '').toLowerCase().trim();
    const tags = (card.dataset.tags || '').toLowerCase().split(/\s+/).filter(Boolean);

    const brandOK = !BRAND_CTX || (make === BRAND_CTX || tags.includes(BRAND_CTX));

    let catOK = true;
    if (f !== 'all') {
      catOK = tags.includes(f);
    }

    card.classList.toggle('is-hidden', !(brandOK && catOK));
  });
}

/**
 * Upraví len to, čo chceš:
 * - #znacky: nadpis = Jeep/Subaru/KGM, nechá len 1 tile + jeho text
 * - testimonials: nadpis = "Čo o nás hovoria zákazníci" + zmení 3 quote (aby nesedeli na inú značku)
 */
function applyBrandSections() {
  // --- ZNAČKY ---
  const znacky = document.getElementById('znacky');
  if (znacky) {
    const head = znacky.querySelector('.section-head h3');

    if (!BRAND_CTX) {
      // default
      if (head) head.textContent = 'Naše značky';
      znacky.querySelectorAll('.brand-tile').forEach(tile => (tile.style.display = ''));
    } else {
      const label = BRAND_LABEL[BRAND_CTX] || 'Naše značky';
      if (head) head.textContent = label;

      const cfg = BRAND_CONFIG[BRAND_CTX];

      znacky.querySelectorAll('.brand-tile').forEach(tile => {
        const h4 = (tile.querySelector('h4')?.textContent || '').toLowerCase().trim();
        const match = h4 === label.toLowerCase();

        tile.style.display = match ? '' : 'none';

        if (match && cfg) {
          const p = tile.querySelector('p');
          if (p) p.textContent = cfg.tileText;
        }
      });
    }
  }

  // --- TESTIMONIALS ---
  const testiWrap = document.querySelector('.testi');
  if (testiWrap) {
    const sec = testiWrap.closest('section');
    const titleEl = sec?.querySelector('.section-head h3');

    if (!BRAND_CTX) {
      if (titleEl) titleEl.textContent = 'Čo hovoria zákazníci';
      return;
    }

    const cfg = BRAND_CONFIG[BRAND_CTX];
    if (!cfg) return;

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
 * Vytvorí DOM element <article> pre jedno auto
 */
function vykresliKartu(auto) {
  const article = document.createElement('article');
  article.className = 'car';
  article.dataset.make = (auto.znacka || '').toLowerCase().trim();
  article.dataset.tags = (auto.tagy || []).join(' ').toLowerCase().trim();

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
    const aktualna =
      auto.stara_cena && String(auto.stara_cena).trim() !== '' ? auto.stara_cena : 'Cena na vyžiadanie';
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
 * Načítanie áut
 */
async function nacitajAuta() {
  try {
    const response = await fetch('/api/cars', { cache: 'no-store' });
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
  BRAND_CTX = resolveBrandContext();
  if (BRAND_CTX) document.documentElement.setAttribute('data-brand', BRAND_CTX);
else document.documentElement.removeAttribute('data-brand');
     // ✅ teraz sa pamätá aj po refresh
  applyBrandSections();                 // ✅ Naše značky -> Jeep/Subaru/KGM
  cleanBrandParamFromURL();             // URL ostane "čisté", ale brand ostáva v storage
  nacitajAuta();
});
