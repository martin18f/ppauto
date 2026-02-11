// ==============================
// Ponuka áut + filtrovanie + brand kontext (pamätá si výber)
// + Modely áut pás (Subaru/KGM/Jeep) + filter podľa modelu
// ==============================

const BRAND_STORAGE_KEY = 'ppauto.brand';

const BRAND_FILTERS = new Set(['subaru', 'kgm', 'jeep']);

let BRAND_CTX = null;        // 'subaru' | 'kgm' | 'jeep' | null (len brand režim z vyber-znacky/storage)
let ACTIVE_FILTER = 'all';   // aktuálne kliknutý filter v lište
let ACTIVE_MODEL = null;     // slug modelu (napr. "forester", "grand-cherokee")
let MODELS_BRAND = null;     // pre ktorý brand je práve vykreslený pás modelov



const MODEL_STRIP_CONFIG = {
  subaru: [
    { key: 'forester',   name: 'FORESTER',   img: 'img/forester.png',   alt: 'Subaru Forester' },
    { key: 'outback',    name: 'OUTBACK',    img: 'img/outback.png',    alt: 'Subaru Outback' },
    { key: 'solterra',   name: 'SOLTERRA',   img: 'img/solterra.png',   alt: 'Subaru Solterra' },
    { key: 'crosstrek',  name: 'CROSSTREK',  img: 'img/crosstrek.png',  alt: 'Subaru Crosstrek' },
    { key: 'brz',        name: 'BRZ',        img: 'img/brz.png',        alt: 'Subaru BRZ' },
  ],
  kgm: [
    { key: 'torres',     name: 'TORRES',     img: 'img/torres.png',        alt: 'KGM Torres' },
    { key: 'korando',    name: 'KORANDO',    img: 'img/korando.png',       alt: 'KGM Korando' },
    { key: 'tivoli',     name: 'TIVOLI',     img: 'img/tivoli.png',        alt: 'KGM Tivoli' },
    { key: 'rexton',     name: 'REXTON',     img: 'img/rexton.png',        alt: 'KGM Rexton' },
    { key: 'musso',      name: 'MUSSO',      img: 'img/musso.png',         alt: 'KGM Musso' },
  ],
  jeep: [
    { key: 'avenger',         name: 'AVENGER',        img: 'img/avenger.png',        alt: 'Jeep Avenger' },
    { key: 'renegade',        name: 'RENEGADE',       img: 'img/renegade.png',       alt: 'Jeep Renegade' },
    { key: 'compass',         name: 'COMPASS',        img: 'img/compass.png',        alt: 'Jeep Compass' },
    { key: 'wrangler',        name: 'WRANGLER',       img: 'img/wrangler.png',       alt: 'Jeep Wrangler' },
    { key: 'grand-cherokee',  name: 'GRAND CHEROKEE', img: 'img/grand-cherokee.png', alt: 'Jeep Grand Cherokee' },
  ],
};


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
    const v = (btn.getAttribute('data-filter') || '').toLowerCase().trim();
    btn.style.display = allowed.has(v) ? '' : 'none';
  });

  // nastav "Všetko" ako aktívne
  const allBtn = document.querySelector('.filter-row .tag[data-filter="all"]');
  if (allBtn) {
    buttons.forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
  }
}





function applyPromoBrandFilter(brandView) {
  const imgs = document.querySelectorAll('#servis .promo-img');
  if (!imgs.length) return;

  const bv = (brandView || '').toLowerCase().trim();

  imgs.forEach(img => {
    const b = (img.getAttribute('data-brand') || 'all').toLowerCase().trim();
    const show = !bv || bv === 'all' || b === 'all' || b === bv;
    img.classList.toggle('promo-hidden', !show);
  });

  const track = document.querySelector('#servis .promo-track');
  if (track) track.style.transform = 'translateX(0px)';

  const servis = document.querySelector('#servis');
  if (servis) servis.classList.add('promo-ready');
}








/**
 * Aplikuje filtrovanie: brand (ak je) + vybraná kategória (Novinky/Skladom)
 */
function applyFilters(filter) {
  const cards = document.querySelectorAll('#inventory .car');
  const f = (filter || 'all').toLowerCase().trim();

  ACTIVE_FILTER = f;

const isBrandFilter = BRAND_FILTERS.has(f);

// kliknutá značka má prednosť (inak brand režim z BRAND_CTX)
const brandView = isBrandFilter ? f : (BRAND_CTX || null);
applyPromoBrandFilter(brandView);
// drž CSS/HTML brand v synchronizácii (ak máš štýly podľa data-brand)
if (brandView) document.documentElement.setAttribute('data-brand', brandView);
else document.documentElement.removeAttribute('data-brand');

  // ukáž/prekresli pás modelov podľa aktuálnej značky
  syncModelsStrip(brandView);

  cards.forEach(card => {
    const make = (card.dataset.make || '').toLowerCase().trim();
    const tags = (card.dataset.tags || '').toLowerCase().split(/\s+/).filter(Boolean);
    const model = (card.dataset.model || '').toLowerCase().trim();

    // značka: buď z BRAND_CTX alebo z kliknutej značky v lište
    const brandOK = !brandView || (make === brandView || tags.includes(brandView));

    // kategória: len keď filter NIE JE značka
    let catOK = true;
    if (!isBrandFilter && f !== 'all') {
      catOK = tags.includes(f);
    }

    // model: len keď sme vo "view" konkrétnej značky
    let modelOK = true;
    if (brandView && ACTIVE_MODEL) {
    modelOK = (model === ACTIVE_MODEL) || model.startsWith(ACTIVE_MODEL + '-');
    }

    card.classList.toggle('is-hidden', !(brandOK && catOK && modelOK));
  });
  syncModelsStrip(brandView);
  updateModelActiveUI();
  applyBrandSections();
}



/**
 * Upraví len to, čo chceš:
 * - #znacky: nadpis = Jeep/Subaru/KGM, nechá len 1 tile + jeho text
 * - testimonials: nadpis = "Čo o nás hovoria zákazníci" + zmení 3 quote (aby nesedeli na inú značku)
 */
function applyBrandSections() {
  const brand = getBrandView(ACTIVE_FILTER);

  // --- ZNAČKY ---
  const znacky = document.getElementById('znacky');
  if (znacky) {
    const head = znacky.querySelector('.section-head h3');

    if (!brand) {
      if (head) head.textContent = 'Naše značky';
      znacky.querySelectorAll('.brand-tile').forEach(tile => (tile.style.display = ''));
    } else {
      const label = BRAND_LABEL[brand] || 'Naše značky';
      if (head) head.textContent = label;

      const cfg = BRAND_CONFIG[brand];

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

    if (!brand) {
      if (titleEl) titleEl.textContent = 'Čo hovoria zákazníci';
      return;
    }

    const cfg = BRAND_CONFIG[brand];
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


// ==============================
// Detail stránka auta – stabilné ID (slug)
// - ak auto už má `id`, použije sa
// - inak sa vygeneruje z: znacka-model-rok (+ -2, -3 pri duplicite)
// ==============================
function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function resolveCarId(auto, baseCounts, usedIds) {
  const existing = (auto?.id || '').toString().trim();
  if (existing) {
    if (usedIds) usedIds.add(existing);
    return existing;
  }

  const base = slugify(`${auto?.znacka || ''}-${auto?.model || ''}-${auto?.rok ?? ''}`) || 'auto';
  const used = usedIds || new Set();

  // ak je základ voľný, použijeme ho
  if (!used.has(base) && !(baseCounts.get(base) > 0)) {
    used.add(base);
    baseCounts.set(base, 1);
    return base;
  }

  // inak pridáme suffix -2, -3, ... a vyhneme sa kolíziám aj s existujúcimi ID
  let n = Math.max(baseCounts.get(base) || 1, 1);
  let candidate = '';
  while (true) {
    n += 1;
    candidate = `${base}-${n}`;
    if (!used.has(candidate)) break;
  }
  baseCounts.set(base, n);
  used.add(candidate);
  return candidate;
}

/**
 * Vytvorí DOM element <article> pre jedno auto
 */
function vykresliKartu(auto) {
  const article = document.createElement('article');
  article.className = 'car';
  article.dataset.make = (auto.znacka || '').toLowerCase().trim();
  article.dataset.tags = (auto.tagy || []).join(' ').toLowerCase().trim();

  article.dataset.model = slugify(auto.model || '');

  const carId = auto.__resolvedId || (auto.id || '').toString().trim();
  const detailHref = carId ? `auto.html?id=${encodeURIComponent(carId)}` : '#kontakt';

  const coverImg = (Array.isArray(auto.obrazky) && auto.obrazky.length ? auto.obrazky[0] : auto.obrazok) || '';

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
      <img src="${coverImg}" alt="${auto.rok || ''} ${auto.znacka || ''} ${auto.model || ''}">
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
        <a class="pill" href="${detailHref}">Zistiť viac</a>
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

      const filter = (btn.getAttribute('data-filter') || 'all').toLowerCase().trim();
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

    // Stabilné ID pre linky na detail (aj pre staré záznamy bez `id`)
    // stabilné (a nekolidujúce) ID pre detail stránky
    const idCounts = new Map();
    const usedIds = new Set(
      auta
        .map(a => (a && a.id ? String(a.id).trim() : ''))
        .filter(Boolean)
    );

    auta.forEach(a => {
      if (!a) return;
      a.__resolvedId = resolveCarId(a, idCounts, usedIds);
    });

    const container = document.getElementById('inventory');
    if (!container) {
      console.error('❌ Nenašiel som #inventory vo vašom HTML.');
      return;
    }

    container.innerHTML = '';

    auta.forEach(auto => {
      // /api/cars už vracia len viditeľné autá, ale necháme aj tento safeguard
      if (!auto || auto.skryte === true) return;
      container.appendChild(vykresliKartu(auto));
    });


    initFiltery();
    pruneTabsForBrand();
    applyFilters('all');

    console.log('✅ Načítané autá:', auta.length, '| BRAND_CTX =', BRAND_CTX || 'none');
  } catch (error) {
    console.error('❌ Chyba pri načítaní zoznamu áut:', error);
  }
  
}


document.addEventListener('DOMContentLoaded', () => {
  BRAND_CTX = resolveBrandContext();
  if (BRAND_CTX) document.documentElement.setAttribute('data-brand', BRAND_CTX);
  else document.documentElement.removeAttribute('data-brand');

  applyBrandSections();
  cleanBrandParamFromURL();

  initModelsStrip();
  syncModelsStrip('all');

  nacitajAuta();
});

function getBrandView(filterValue) {
  const f = (filterValue || ACTIVE_FILTER || 'all').toLowerCase();

  // keď user klikne na značku v lište, tá má prednosť
  if (BRAND_FILTERS.has(f)) return f;

  // inak (Všetko/Novinky/Skladom) sa riadime brand režimom zo storage
  return BRAND_CTX;
}

function renderModelsStrip(brand) {
  const strip = document.getElementById('models-strip');
  const row = document.getElementById('models-strip-row');
  if (!strip || !row) return;

  const list = MODEL_STRIP_CONFIG[brand] || [];

  // nič pre brand → schovaj
  if (!brand || !list.length) {
    strip.hidden = true;
    row.innerHTML = '';
    MODELS_BRAND = null;
    return;
  }

  // zmena brandu → zruš model filter
  if (MODELS_BRAND && MODELS_BRAND !== brand) {
    ACTIVE_MODEL = null;
  }
  MODELS_BRAND = brand;

  strip.hidden = false;

  row.innerHTML = list.map(m => `
    <a class="model-tile" href="#" data-model="${m.key}">
      <div class="model-tile__img">
        <img src="${m.img}" alt="${m.alt || m.name}" loading="lazy" />
      </div>
      <div class="model-tile__name">${m.name}</div>
    </a>
  `).join('');

  updateModelActiveUI();
}

function updateModelActiveUI() {
  const row = document.getElementById('models-strip-row');
  if (!row) return;

  row.querySelectorAll('.model-tile').forEach(tile => {
    const m = (tile.dataset.model || '').toLowerCase().trim();
    tile.classList.toggle('is-active', !!ACTIVE_MODEL && m === ACTIVE_MODEL);
  });
}

function syncModelsStrip(value) {
  // value môže byť značka alebo niečo ako all/novinky/skladom
  const v = (value || '').toLowerCase();
  const brand = BRAND_FILTERS.has(v) ? v : (BRAND_CTX || null);

  renderModelsStrip(brand);

  // ak už nie sme v brand view, zruš model filter
  if (!brand && ACTIVE_MODEL) {
    ACTIVE_MODEL = null;
    updateModelActiveUI();
  }
}

function initModelsStrip() {
  const row = document.getElementById('models-strip-row');
  if (!row || row.dataset.inited === '1') return;

  row.dataset.inited = '1';

  row.addEventListener('click', (e) => {
    const tile = e.target.closest('.model-tile');
    if (!tile) return;

    // žiadny jump/scroll
    e.preventDefault();

    const model = (tile.dataset.model || '').toLowerCase().trim();
    if (!model) return;

    // toggle: klik na rovnaký model = vypne filter
    ACTIVE_MODEL = (ACTIVE_MODEL === model) ? null : model;

    updateModelActiveUI();
    applyFilters(ACTIVE_FILTER);
  });
}

// =========================
// SERVICE: Promo slider + Lightbox + FAQ
// =========================
(function () {
  // PROMO SLIDER + LIGHTBOX
  const promoRoot = document.querySelector('#servis [data-promo]');
  if (promoRoot) {
    const track = promoRoot.querySelector('.promo-track');
    const prev = promoRoot.querySelector('.promo-btn.prev');
    const next = promoRoot.querySelector('.promo-btn.next');

    const lightbox = document.querySelector('#servis [data-lightbox]');
    const lightboxImg = document.querySelector('#servis [data-lightbox-img]');
    const lightboxClose = document.querySelector('#servis [data-close]');

    const scrollByCard = (dir) => {
      const firstImg = track?.querySelector('img');
      const cardW = firstImg ? (firstImg.getBoundingClientRect().width + 12) : 320;
      track.scrollBy({ left: dir * cardW, behavior: 'smooth' });
    };

    if (prev) prev.addEventListener('click', () => scrollByCard(-1));
    if (next) next.addEventListener('click', () => scrollByCard(1));

    // click image -> lightbox
    track?.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img || !lightbox || !lightboxImg) return;
      lightboxImg.src = img.src;
      lightbox.style.display = 'flex';
    });

    // close lightbox
    const closeLb = () => {
      if (!lightbox) return;
      lightbox.style.display = 'none';
      if (lightboxImg) lightboxImg.src = '';
    };
    lightboxClose?.addEventListener('click', closeLb);
    lightbox?.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLb();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLb();
    });
  }

  // FAQ
  const faqRoot = document.querySelector('#servis [data-faq]');
  if (faqRoot) {
    faqRoot.addEventListener('click', (e) => {
      const item = e.target.closest('.faq-item');
      if (!item) return;

      // optional: iba jeden otvorený naraz
      [...faqRoot.querySelectorAll('.faq-item')].forEach((x) => {
        if (x !== item) x.classList.remove('is-open');
      });

      item.classList.toggle('is-open');
    });
  }
})();

