// ==============================
// Ponuka áut + filtrovanie + brand kontext z URL
// + Modely áut pás (Subaru/KGM/Jeep/Chery) + filter podľa modelu
// ==============================

const BRAND_STORAGE_KEY = 'ppauto.brand';

const BRAND_FILTERS = new Set(['subaru', 'kgm', 'jeep', 'chery']);
const CLEAN_BRAND_PATHS = {
  all: '/ponuka',
  subaru: '/subaru',
  kgm: '/kgm',
  jeep: '/jeep',
  chery: '/chery',
};

function parseEuroAmount(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  const normalized = String(value ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || !/^(?:\d+|\d{1,3}(?: \d{3})+)\s*€?$/.test(normalized)) return null;

  const amount = Number(normalized.replace(/[ €]/g, ''));
  return Number.isSafeInteger(amount) ? amount : null;
}

function groupIntegerDigits(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatEuroAmount(value) {
  const amount = parseEuroAmount(value);
  return amount === null ? '' : `${groupIntegerDigits(amount)} €`;
}

function isLocalRouteHost() {
  return location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '::1';
}

let BRAND_CTX = null;        // 'subaru' | 'kgm' | 'jeep' | 'chery' | null (len brand režim z vyber-znacky/URL)
let ACTIVE_FILTER = 'all';   // aktuálne kliknutý filter v lište
let ACTIVE_MODEL = null;     // slug modelu (napr. "forester", "grand-cherokee")
let MODELS_BRAND = null;     // pre ktorý brand je práve vykreslený pás modelov



const MODEL_STRIP_CONFIG = {
  subaru: [
    { key: 'forester',   name: 'FORESTER',   img: 'img/preview_modely/Subaru/forester.png',   alt: 'Subaru Forester' },
    { key: 'outback',    name: 'OUTBACK',    img: 'img/preview_modely/Subaru/outback.png',    alt: 'Subaru Outback' },
    { key: 'solterra',   name: 'SOLTERRA',   img: 'img/preview_modely/Subaru/solterra.png',   alt: 'Subaru Solterra' },
    { key: 'crosstrek',  name: 'CROSSTREK',  img: 'img/preview_modely/Subaru/crosstrek.png',  alt: 'Subaru Crosstrek' },
    { key: 'brz',        name: 'BRZ',        img: 'img/preview_modely/Subaru/brz.png',        alt: 'Subaru BRZ' },
  ],
  kgm: [
    { key: 'torres',     name: 'TORRES',     img: 'img/preview_modely/KGM/torres.png',        alt: 'KGM Torres' },
    { key: 'torres-evx',  name: 'TORRES EVX',  img: 'img/preview_modely/KGM/torres-evx.png',   alt: 'KGM Torres EVX' },
    { key: 'korando',    name: 'KORANDO',    img: 'img/preview_modely/KGM/korando.png',       alt: 'KGM Korando' },
    { key: 'tivoli',     name: 'TIVOLI',     img: 'img/preview_modely/KGM/tivoli.png',        alt: 'KGM Tivoli' },
    { key: 'rexton',     name: 'REXTON',     img: 'img/preview_modely/KGM/rexton.png',        alt: 'KGM Rexton' },
    { key: 'musso',       name: 'MUSSO GRAND', img: 'img/preview_modely/KGM/musso.png',        alt: 'KGM Musso Grand' },
    { key: 'actyon',      name: 'ACTYON',      img: 'img/preview_modely/KGM/actyon.png',       alt: 'KGM Actyon' },
    
  ],
  jeep: [
    { key: 'avenger',         name: 'AVENGER',        img: 'img/preview_modely/Jeep/avenger.png',        alt: 'Jeep Avenger' },
    { key: 'renegade',        name: 'RENEGADE',       img: 'img/preview_modely/Jeep/renegade.png',       alt: 'Jeep Renegade' },
    { key: 'compass',         name: 'COMPASS',        img: 'img/preview_modely/Jeep/compass.png',        alt: 'Jeep Compass' },
    { key: 'wrangler',        name: 'WRANGLER',       img: 'img/preview_modely/Jeep/wrangler.png',       alt: 'Jeep Wrangler' },
    { key: 'grand-cherokee',  name: 'GRAND CHEROKEE', img: 'img/preview_modely/Jeep/grand-cherokee.png', alt: 'Jeep Grand Cherokee' },
  ],
  chery: [
  {
    key: 'tiggo-9-plug-in-hybrid',
    name: 'TIGGO 9 Plug-in Hybrid',
    img: 'img/preview_modely/Chery/tiggo_9_series.avif',
    alt: 'Chery TIGGO 9 Plug-in Hybrid'
  },
  {
    key: 'tiggo-8-plug-in-hybrid',
    name: 'TIGGO 8 Plug-in Hybrid',
    img: 'img/preview_modely/Chery/tiggo_8_plug_in_hybrid.png',
    alt: 'Chery TIGGO 8 Plug-in Hybrid'
  },
  {
    key: 'tiggo-7-plug-in-hybrid',
    name: 'TIGGO 7 Plug-in Hybrid',
    img: 'img/preview_modely/Chery/tiggo_7_plug_in_hybrid.png',
    alt: 'Chery TIGGO 7 Plug-in Hybrid'
  },
  {
    key: 'tiggo-7-hybrid',
    name: 'TIGGO 7 Hybrid',
    img: 'img/preview_modely/Chery/tiggo_7_hybrid.png',
    alt: 'Chery TIGGO 7 Hybrid'
  },
  {
    key: 'tiggo-4-hybrid',
    name: 'TIGGO 4 Hybrid',
    img: 'img/preview_modely/Chery/tiggo_4_hybrid.png',
    alt: 'Chery TIGGO 4 Hybrid'
  }
],
};


const BRAND_LABEL = {
  subaru: 'Subaru',
  kgm: 'KGM',
  jeep: 'Jeep',
  chery: 'Chery',
};

const BRAND_VISIBLE_TEXT = {
  subaru: {
    heroReserve: 'Zažite Subaru naživo na cestách.',
    heroBrandsCta: 'Subaru a demo jazdy',
    service: 'Profesionálna starostlivosť pre Subaru. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.',
    footer: 'Autorizovaný predaj a servis Subaru v Poprade od roku 2011.',
  },
  kgm: {
    heroReserve: 'Zažite KGM naživo na cestách.',
    heroBrandsCta: 'KGM a demo jazdy',
    service: 'Profesionálna starostlivosť pre KGM. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.',
    footer: 'Autorizovaný predaj a servis KGM v Poprade od roku 2011.',
  },
  jeep: {
    heroReserve: 'Zažite Jeep naživo na cestách.',
    heroBrandsCta: 'Jeep a demo jazdy',
    service: 'Profesionálna starostlivosť pre Jeep. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.',
    footer: 'Autorizovaný predaj a servis Jeep v Poprade od roku 2011.',
  },
  chery: {
    heroReserve: 'Zažite Chery naživo na cestách.',
    heroBrandsCta: 'Chery a demo jazdy',
    service: 'Profesionálna starostlivosť pre Chery. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.',
    footer: 'Autorizovaný predaj a servis Chery v Poprade od roku 2011.',
  },
};

const BRAND_CONFIG = {
  subaru: {
    tileText:
      'Subaru je synonymom istoty v každom počasí. Symetrický pohon AWD, nízke ťažisko BOXER motorov a špičková bezpečnostná technológia EyeSight prinášajú stabilitu, presnosť a pokoj za volantom. Či ideš cez zasnežené priesmyky, po mokrej okreske alebo na dlhú diaľničnú trasu, Subaru drží stopu a zároveň ponúkne komfort, ktorý si rýchlo obľúbiš. Pre ľudí, ktorí chcú spoľahlivé auto „na roky“ – bez kompromisov v bezpečí, trakcii a jazdnom prejave.',
    testiTitle: 'Skúsenosti našich zákazníkov',
    quotes: [
      {
        text: '„Od prvého kontaktu po odovzdanie auta všetko prebehlo profesionálne. Oceňujem férový prístup, rýchle vybavenie a servis, na ktorý sa dá spoľahnúť.“',
        by: '— zákazník z Popradu',
      },
      {
        text: '„Testovaciu jazdu mi pripravili prakticky hneď. Vysvetlili rozdiely výbav, financovanie aj prevádzku bez zbytočných rečí – vecne a zrozumiteľne.“',
        by: '— P. J., Kežmarok',
      },
      {
        text: '„V zime je AWD na nezaplatenie. Auto drží, cítiš sa bezpečne a v PP AUTO sa postarali o všetko okolo – registrácia, papiere, nastavenie auta.“',
        by: '— M. K., Svit',
      },
    ],
  },

  kgm: {
    tileText:
      'KGM je praktická voľba pre ľudí, ktorí chcú moderné SUV s výbornou výbavou a rozumnými nákladmi. Robustná konštrukcia, pohodlný podvozok a dostupný pohon 4×4 robia z KGM spoľahlivého partnera do mesta, na rodinné výlety aj na dlhé trasy. Dostaneš veľa auta za férové peniaze – priestor, komfort a technológie, ktoré reálne využiješ každý deň. Ideálne pre tých, čo chcú maximum hodnoty bez zbytočného preplácania.',
    testiTitle: 'Skúsenosti našich zákazníkov',
    quotes: [
      {
        text: '„Komunikácia bola rýchla, ústretová a férová. Všetky kroky vybavili bez komplikácií a presne tak, ako sme sa dohodli.“',
        by: '— zákazník z Popradu',
      },
      {
        text: '„KGM ma prekvapilo – výbava, priestor aj jazda. Najlepšie je prísť sa previezť a porovnať, mne to rozhodlo.“',
        by: '— R. S., Levoča',
      },
      {
        text: '„Žiadny nátlak, všetko vysvetlené normálne a na rovinu. Výborná skúsenosť a dobrý pocit z kúpy.“',
        by: '— J. T., Spišská Nová Ves',
      },
    ],
  },

  jeep: {
    tileText:
      'Jeep je životný štýl aj schopnosti – jedno aj druhé v jednom aute. Charakter, robustnosť a legenda terénu sa tu spájajú s modernými technológiami, komfortom a bezpečnosťou. V meste pôsobí sebavedomo, na dlhých cestách je pohodlný a keď zídeš z asfaltu, ukáže svoju pravú DNA. Jeep je pre ľudí, ktorí chcú auto s osobnosťou – a zároveň chcú vedieť, že sa môžu spoľahnúť, kamkoľvek sa vyberú.',
    testiTitle: 'Skúsenosti našich zákazníkov',
    quotes: [
      {
        text: '„Auto bolo pripravené na odber rýchlo a bez stresu. Prístup bol profesionálny a všetko prebehlo hladko od začiatku do konca.“',
        by: '— zákazník z Popradu',
      },
      {
        text: '„Testovaciu jazdu mi vybavili na počkanie. Financovanie mi vysvetlili transparentne, bez skrytých poplatkov a bez nátlaku.“',
        by: '— P. J., Kežmarok',
      },
      {
        text: '„Jeep má charakter a v teréne je to radosť. Servis aj starostlivosť po kúpe boli presne také, ako si predstavujem.“',
        by: '— M. K., Svit',
      },
    ],
  },

  chery: {
    tileText:
      'Chery prináša moderné SUV s dôrazom na technológie, komfort a výbornú hodnotu. Rodina modelov Tiggo kombinuje priestranný interiér, bohatú výbavu, pokročilé asistenčné systémy a efektívne benzínové, hybridné alebo plug-in hybridné pohony. Je to značka pre vodičov, ktorí chcú veľa výbavy, moderný dizajn a praktické rodinné auto bez zbytočných kompromisov.',
    testiTitle: 'Skúsenosti našich zákazníkov',
    quotes: [
      {
        text: '„Zaujali ma technológie, priestor a výbava. V PP AUTO mi všetko vysvetlili jasne a bez tlaku.“',
        by: '— zákazník z Popradu',
      },
      {
        text: '„Chery pôsobí moderne a prakticky. Testovacia jazda mi pomohla rýchlo si urobiť obraz o aute aj výbave.“',
        by: '— P. J., Kežmarok',
      },
      {
        text: '„Ocenil som pokojný prístup, porovnanie možností a pomoc s financovaním. Dobrá skúsenosť od začiatku.“',
        by: '— M. K., Svit',
      },
    ],
  },
};


function isKnownBrand(b) {
  return b === 'subaru' || b === 'kgm' || b === 'jeep' || b === 'chery';
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
  if (raw) return raw.toLowerCase().trim();
  return getBrandFromPathnameRaw();
}

function getBrandFromPathnameRaw() {
  const slug = location.pathname.replace(/\/+$/, '').split('/').pop().toLowerCase();
  if (slug === 'ponuka') return 'all';
  return isKnownBrand(slug) ? slug : null;
}

/**
 * Brand kontext berieme z čistej URL alebo zo starého ?brand=... fallbacku.
 * Nič neukladáme do localStorage/sessionStorage.
 * - ?brand=subaru|kgm|jeep|chery → BRAND_CTX
 * - ?brand=all → null
 */
function resolveBrandContext() {
  const fromURL = getBrandFromURLRaw();
  if (!fromURL) return null;
  if (fromURL === 'all') return null;
  return isKnownBrand(fromURL) ? fromURL : null;
}


function cleanBrandParamFromURL() {
  const url = new URL(location.href);
  if (!url.searchParams.has('brand')) return;
  if (url.searchParams.has('lang')) return;
  if (isLocalRouteHost()) return;

  const brand = (url.searchParams.get('brand') || '').toLowerCase().trim();

  if (CLEAN_BRAND_PATHS[brand]) {
    history.replaceState({}, '', CLEAN_BRAND_PATHS[brand] + (url.hash || ''));
    return;
  }

  url.searchParams.delete('brand');
  history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
}

/**
 * Zobraz len povolené záložky pre brand: Všetko, Novinky, Skladom, Predvádzacie
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

  const allowed = new Set(['all', 'novinky', 'skladom', 'predvadzacie']);
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

    // bez brandu = zobraziť všetko
    const show = !bv || bv === 'all' || b === 'all' || b === bv;

    img.classList.toggle('promo-hidden', !show);
  });

  // reset slideru, aby nezostal posunutý na skrytý banner
  const track = document.querySelector('#servis .promo-track');
  if (track) track.style.transform = 'translateX(0px)';
  
}








/**
 * Aplikuje filtrovanie: brand (ak je) + vybraná kategória (Novinky/Skladom/Predvádzacie)
 */
function applyFilters(filter) {
  const cards = document.querySelectorAll('#inventory .car');
  const f = (filter || 'all').toLowerCase().trim();

  ACTIVE_FILTER = f;

  const isBrandFilter = BRAND_FILTERS.has(f);

  // 🔹 DÔLEŽITÉ:
  // brandView určuje LEN globálny brand (z vyber-znacky)
  const brandView = BRAND_CTX; 

  cards.forEach(card => {
    const make  = (card.dataset.make || '').toLowerCase().trim();
    const tags  = (card.dataset.tags || '').toLowerCase().split(/\s+/);
    const model = (card.dataset.model || '').toLowerCase().trim();

    // 1️⃣ globálny brand režim
    const brandOK = !brandView || make === brandView;

    // 2️⃣ filter v ponuke (Subaru/KGM/Jeep/Chery)
    const filterOK = !isBrandFilter || make === f;

    // 3️⃣ kategórie (novinky/skladom)
    let catOK = true;
    if (!isBrandFilter && f !== 'all') {
      catOK = tags.includes(f);
    }

    // 4️⃣ model filter (iba ak sme v brand režime)
    let modelOK = true;
    if (brandView && ACTIVE_MODEL) {
      modelOK = model === ACTIVE_MODEL || model.startsWith(ACTIVE_MODEL + '-');
    }

    card.classList.toggle(
      'is-hidden',
      !(brandOK && filterOK && catOK && modelOK)
    );
  });

  // 🔹 modelový pás sa zobrazuje LEN pri globálnom brand režime
  syncModelsStrip(brandView);
  updateModelActiveUI();
  applyBrandSections();
}




/**
 * Upraví len to, čo chceš:
 * - #znacky: nadpis = Jeep/Subaru/KGM/Chery, nechá len 1 tile + jeho text
 * - testimonials: nadpis = "Čo o nás hovoria zákazníci" + zmení 3 quote (aby nesedeli na inú značku)
 */
function applyBrandSections() {
  const brand = getBrandView(ACTIVE_FILTER);
  applyPromoBrandFilter(brand);
  applyVisibleBrandText(brand);
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

function applyVisibleBrandText(brand) {
  document.querySelectorAll('[data-brand-text]').forEach((el) => {
    if (!el.dataset.defaultHtml) el.dataset.defaultHtml = el.innerHTML;

    const key = el.dataset.brandText;
    const text = brand ? BRAND_VISIBLE_TEXT[brand]?.[key] : '';

    if (text) {
      el.textContent = window.ppI18n?.isEnglish?.() ? window.ppI18n.t(text) : text;
    } else {
      el.innerHTML = el.dataset.defaultHtml;
    }
  });
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
  article.className = 'car car-pro';
  article.dataset.make = (auto.znacka || '').toLowerCase().trim();
  article.dataset.tags = (auto.tagy || []).join(' ').toLowerCase().trim();
  article.dataset.model = slugify(auto.model || '');

  // --- helpers ---
  const escHtml = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const escAttr = (v) => escHtml(v).replace(/\s+/g, ' ').trim();

  const normalizeGearbox = (raw) =>
    String(raw || '').trim().toUpperCase().replace(/\s+/g, '');

  const parseLegacyPrevodovka = (raw) => {
    const txt = String(raw || '').trim();
    if (!txt) return { typ: '', paket: '' };

    const parts = txt
      .split(/•|·|\|/g)
      .map((p) => p.trim())
      .filter(Boolean);

    if (!parts.length) return { typ: '', paket: '' };

    if (parts.length === 1) {
      const one = normalizeGearbox(parts[0]);
      if (/^(AT|MT|CVT|DCT|DSG)$/.test(one)) return { typ: one, paket: '' };
      return { typ: '', paket: parts[0] };
    }

    return { typ: normalizeGearbox(parts[0]), paket: parts.slice(1).join(' • ') };
  };

  const formatObjem = (val) => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'string' && /cm/i.test(val)) return val.trim();

    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0) return '';

    return `${new Intl.NumberFormat('sk-SK').format(num)} cm³`;
  };

  const parsePriceNumber = (s) => parseEuroAmount(s) || 0;

  // --- ID + link na detail ---
  const carId = auto.__resolvedId || (auto.id || '').toString().trim();
  const rawDetailHref = carId
    ? (isLocalRouteHost() ? `auto.html?id=${encodeURIComponent(carId)}` : `/auta/${encodeURIComponent(carId)}`)
    : '#kontakt';
  const detailHref = window.ppI18n ? window.ppI18n.withLang(rawDetailHref) : rawDetailHref;

  // --- titulka / galéria fallback ---
  const coverImg =
    String(
      auto.titulka ||
        (Array.isArray(auto.galeria) && auto.galeria.length ? auto.galeria[0] : '') ||
        (Array.isArray(auto.obrazky) && auto.obrazky.length ? auto.obrazky[0] : '') ||
        auto.obrazok ||
        ''
    ).trim();

  // --- cena ---
  const formattedOldPrice = formatEuroAmount(auto.stara_cena);
  const formattedNewPrice = formatEuroAmount(auto.nova_cena);
  const maZlavu = !!formattedNewPrice;
  const priceNew = maZlavu
    ? formattedNewPrice
    : (formattedOldPrice || 'Cena na vyžiadanie');

  const priceOld = maZlavu ? formattedOldPrice : '';

  // --- prevodovka + paket (nové polia, fallback na legacy) ---
  const legacy = String(auto.prevodovka || '').trim();
  const parsed = parseLegacyPrevodovka(legacy);

  const typ = normalizeGearbox(auto.typ_prevodovky || parsed.typ || '');
  const vybavaPaket = String(auto.vybava_paket || parsed.paket || '').trim();

  const prevodovkaText =
    typ === 'AT' ? 'Automat' :
    typ === 'MT' ? 'Manuál' :
    (typ ? typ : '-');

  // --- ostatné hodnoty ---
  const palivo = String(auto.palivo || '-').trim() || '-';
  const objem = formatObjem(auto.objem) || '-';

  const znackaUpper = String(auto.znacka || '').toUpperCase().trim();
  const rokText = String(auto.rok || '').trim();

  // názov bez roka (povolíme max 2 riadky cez CSS)
  const titleText = `${znackaUpper} ${auto.model || ''}`.replace(/\s+/g, ' ').trim();
  const altText = `${rokText ? rokText + ' ' : ''}${titleText}`.trim();

  // --- META riadok (rok + zľava + statusy) ---
  const tags = Array.isArray(auto.tagy)
    ? auto.tagy.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
    : [];

  const metaItems = [];

  if (rokText) {
    metaItems.push({
      cls: 'meta-item--year',
      html: `Rok <span class="year-val">${escHtml(rokText)}</span>`
    });
  }

  if (maZlavu) {
    const oldN = parsePriceNumber(priceOld);
    const newN = parsePriceNumber(priceNew);

    let dealAmount = '';
    if (oldN > 0 && newN > 0 && oldN > newN) dealAmount = formatEuroAmount(oldN - newN);

    metaItems.push({
      cls: 'meta-item--deal',
      html: dealAmount
        ? `Zľava <span class="deal-amount">${escHtml(dealAmount)}</span>`
        : `Zľava`
    });
  }

  const status = [];
  if (tags.includes('novinky')) status.push('Novinka');
  if (tags.includes('skladom')) status.push('Skladom');
  if (tags.includes('predvadzacie')) status.push('Predvádzacie');

  const blacklist = new Set(['subaru', 'kgm', 'jeep', 'chery', 'all', 'novinky', 'skladom', 'predvadzacie']);
  for (const t of tags) {
    if (status.length >= 3) break;
    if (blacklist.has(t)) continue;
    status.push(t);
  }

  if (status.length) {
    metaItems.push({ cls: 'meta-item--status', html: escHtml(status.join(' • ')) });
  }

  const metaHTML = metaItems.length
    ? `<div class="car-meta">${
        metaItems
          .map((m, i) =>
            `<span class="meta-item ${m.cls}">${m.html}</span>` +
            (i < metaItems.length - 1 ? `<span class="meta-sep">•</span>` : '')
          )
          .join('')
      }</div>`
    : '';

  const imgHTML = coverImg
    ? `<img src="${escAttr(coverImg)}" loading="lazy" decoding="async" alt="${escAttr(altText)}">`
    : `<div class="img-placeholder" aria-hidden="true">Bez fotky</div>`;

  article.innerHTML = `
    <div class="img">
      ${imgHTML}
    </div>

    <div class="body">
      <div class="car-head">
        <div class="car-titlewrap">
          <h4 class="car-title">${escHtml(titleText)}</h4>
          ${metaHTML}
        </div>

        <div class="car-price">
          <div class="price-new">${escHtml(priceNew)}</div>
          ${maZlavu && priceOld ? `<div class="price-old">${escHtml(priceOld)}</div>` : ``}
        </div>
      </div>

      <div class="car-specgrid">
        <div class="specitem">
          <div class="k">Palivo</div>
          <div class="v">${escHtml(palivo)}</div>
        </div>

        <div class="specitem">
          <div class="k">Prevodovka</div>
          <div class="v">${escHtml(prevodovkaText)}</div>
        </div>

        <div class="specitem">
          <div class="k">Výbava</div>
          <div class="v">${escHtml(vybavaPaket || '-')}</div>
        </div>

        <div class="specitem">
          <div class="k">Objem</div>
          <div class="v">${escHtml(objem)}</div>
        </div>
      </div>

      <div class="car-actions">
        <a class="car-link primary" href="${detailHref}">Zobraziť viac</a>
      </div>
    </div>
  `;

        // Klik na celú kartu = otvor detail (okrem kliknutia na interaktívne prvky)
  article.style.cursor = 'pointer';
  article.setAttribute('role', 'link');
  article.setAttribute('tabindex', '0');

  const goDetail = () => {
    if (!detailHref || detailHref === '#kontakt') return;
    window.location.assign(detailHref);
  };

  article.addEventListener('click', (e) => {
    // ak klikneš na link/tlačidlo v karte, nech to funguje normálne a nezdvojí sa navigácia
    const interactive = e.target.closest('a, button, input, textarea, select, label');
    if (interactive) return;
    goDetail();
  });

  // prístupnosť: Enter / Space
  article.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goDetail();
    }
  });



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

  // ✅ DOPLNIŤ – nech sa servisné akcie hneď vyfiltrujú podľa globálneho brandu
  applyPromoBrandFilter(BRAND_CTX);

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
        <img src="${m.img}" alt="${m.alt || m.name}" loading="lazy" onerror="this.onerror=null;this.src='img/logo.svg'" />
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

// ==============================
// PROMOS → naplnenie PROMO2 slidera z /api/promos
// ==============================
(function () {
  const API_BASE = (location.protocol === 'file:')
    ? 'https://ppauto.sk'
    : location.origin;

  const apiUrl = (path) => `${API_BASE}${path}`;

  function normalizeBrand(b) {
  // neznámy/nezadaný brand NEMÁ byť univerzálny (univerzálne je len explicitné "all")
  const v = String(b || '').toLowerCase().trim();
  return (v === 'subaru' || v === 'kgm' || v === 'jeep' || v === 'chery' || v === 'all') ? v : '';
  }

  async function loadPromosIntoPromo2() {
    const track = document.getElementById('promo2Track');
    if (!track) return;

    // empty state počas loadingu
    track.innerHTML = `<div class="promo2-empty">Načítavam…</div>`;

    try {
      const r = await fetch(apiUrl('/api/promos'), { cache: 'no-store' });
      if (!r.ok) throw new Error(`GET /api/promos failed: ${r.status}`);

      const items = await r.json().catch(() => []);
      const promos = Array.isArray(items) ? items : [];

      // nič nie je → empty
      if (!promos.length) {
        track.innerHTML = `<div class="promo2-empty">Momentálne nie sú žiadne актуálne ponuky.</div>`;
        window.PP_PROMO2_UPDATE && window.PP_PROMO2_UPDATE();
        return;
      }

      // render DOM bezpečne (bez innerHTML pre title)
      track.innerHTML = '';
      for (const p of promos) {
        const brand = normalizeBrand(p.brand);
        const title = String(p.title || '').trim();
        const imgUrl = String(p.image || '').trim();
        const link = String(p.link || '#ponuka').trim() || '#ponuka';

        if (!imgUrl || !title) continue;

        const article = document.createElement('article');
        article.className = 'promo2-slide';
        article.dataset.brand = brand;

        const a = document.createElement('a');
        a.className = 'promo2-card';
        a.href = link;

        const img = document.createElement('img');
        img.className = 'promo2-img';
        img.loading = 'lazy';
        img.src = imgUrl;
        img.alt = title;
        img.setAttribute('data-full', imgUrl);

        const overlay = document.createElement('div');
        overlay.className = 'promo2-overlay';

        const meta = document.createElement('div');
        meta.className = 'promo2-meta';

        const name = document.createElement('div');
        name.className = 'promo2-name';
        name.textContent = title;

        const cta = document.createElement('div');
        cta.className = 'promo2-cta';
        cta.textContent = 'Pozrieť ponuku';

        meta.appendChild(name);
        meta.appendChild(cta);

        a.appendChild(img);
        a.appendChild(overlay);
        a.appendChild(meta);

        article.appendChild(a);
        track.appendChild(article);
      }

      window.PP_PROMO2_UPDATE && window.PP_PROMO2_UPDATE();
    } catch (e) {
      console.error(e);
      track.innerHTML = `<div class="promo2-empty">Aktuality sa nepodarilo načítať.</div>`;
      window.PP_PROMO2_UPDATE && window.PP_PROMO2_UPDATE();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPromosIntoPromo2, { once: true });
  } else {
    loadPromosIntoPromo2();
  }

  // voliteľné: ručný refresh z konzoly
  window.PP_PROMOS_RELOAD = loadPromosIntoPromo2;
})();


// ==============================
// PROMO2 slider – brand aware, bez dots, reaguje na zmenu značky bez refreshu
// ==============================
(function () {
  const state = {
    idx: 0,
    total: 0,
    timer: null,
    bound: false,
  };

  function safe(v){ return String(v || '').toLowerCase().trim(); }
  function isBrand(b){ return b === 'subaru' || b === 'kgm' || b === 'jeep' || b === 'chery'; }

  function getCurrentBrand(){
    // 1) DOM atribút (téma)
    const dom = safe(document.documentElement.getAttribute('data-brand'));
    if (isBrand(dom)) return dom;

    // 2) URL param (keď ešte DOM nie je prepnutý)
    try {
      const q = safe(new URLSearchParams(location.search).get('brand'));
      if (q === 'all') return null;
      if (isBrand(q)) return q;
    } catch(e){}

    // 3) čistá URL (/subaru, /kgm, /jeep, /chery)
    const pathBrand = safe(getBrandFromPathnameRaw());
    if (pathBrand === 'all') return null;
    if (isBrand(pathBrand)) return pathBrand;

    // 4) storage fallback
    

    return null;
  }

  function stop(){
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function start(){
    stop();
    if (state.total <= 1) return;

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    state.timer = setInterval(() => go(state.idx + 1, false), 2000);
  }

  function render(track){
    track.style.transform = `translateX(-${state.idx * 100}%)`;
  }

  function go(i, user){
    if (!state.total) return;
    state.idx = (i + state.total) % state.total;
    const track = document.getElementById('promo2Track');
    if (track) render(track);
    if (user) start();
  }

 function rebuild(){
  const track = document.getElementById('promo2Track');
  const viewport = document.getElementById('promo2Viewport');
  if (!track || !viewport) return;

  // odstráň náš brand-specific empty stav (ak tam ostal z predchádzajúceho brandu)
  track.querySelector('.promo2-empty--brand')?.remove();

  const brand = getCurrentBrand();
  const slides = Array.from(track.querySelectorAll('.promo2-slide'));

  // ešte nič nie je načítané (loading/empty rieši loader inde)
  if (!slides.length) {
    state.total = 0;
    state.idx = 0;
    stop();
    track.style.transition = 'none';
    track.style.transform = 'translateX(0%)';
    requestAnimationFrame(() => { track.style.transition = ''; });
    return;
  }

  // show/hide podľa brandu
  slides.forEach(slide => {
    const b = safe(slide.dataset.brand);
    slide.style.display = (!brand || b === brand || b === 'all') ? '' : 'none';
  });

  let active = slides.filter(s => s.style.display !== 'none');

  // ak je zvolený konkrétny brand a nemá žiadne promo → NEukazuj iné značky
  if (brand && !active.length) {
    state.total = 0;
    state.idx = 0;

    // reset bez skoku animácie
    track.style.transition = 'none';
    track.style.transform = 'translateX(0%)';
    requestAnimationFrame(() => { track.style.transition = ''; });

    const msg = document.createElement('div');
    msg.className = 'promo2-empty promo2-empty--brand';
    msg.textContent = 'Pre túto značku momentálne nie sú žiadne aktuálne ponuky.';
    track.appendChild(msg);

    stop();
    return;
  }

  state.total = active.length;
  state.idx = 0;

  // reset bez skoku animácie
  track.style.transition = 'none';
  track.style.transform = 'translateX(0%)';
  requestAnimationFrame(() => { track.style.transition = ''; });

  // bind controls len raz
  if (!state.bound) {
    state.bound = true;

    document.querySelectorAll('[data-promo2="next"]').forEach(btn =>
      btn.addEventListener('click', () => go(state.idx + 1, true))
    );
    document.querySelectorAll('[data-promo2="prev"]').forEach(btn =>
      btn.addEventListener('click', () => go(state.idx - 1, true))
    );

    viewport.addEventListener('mouseenter', stop);
    viewport.addEventListener('mouseleave', start);

    viewport.addEventListener('touchstart', stop, { passive:true });
    viewport.addEventListener('touchend', () => setTimeout(start, 600), { passive:true });

    window.addEventListener('pageshow', () => rebuild());
  }

  render(track);
  start();
}


  // init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rebuild, { once:true });
  } else {
    rebuild();
  }

  // reaguj na zmenu data-brand (napr. keď sa značka prepne)
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName === 'data-brand') {
        rebuild();
        break;
      }
    }
  });
  mo.observe(document.documentElement, { attributes:true, attributeFilter:['data-brand'] });

  // voliteľné ručné volanie
  window.PP_PROMO2_UPDATE = rebuild;
})();

// ==============================
// PROMO2 LIGHTBOX – klik na kartu/foto = plné rozlíšenie
// (CTA "Pozrieť ponuku" zostáva normálne klikateľné)
// ==============================
(function () {

  function ensureLightbox(){
    let lb = document.querySelector('.promo2-lightbox');
    if (lb) return lb;

    lb = document.createElement('div');
    lb.className = 'promo2-lightbox';
    lb.innerHTML = `
      <div class="promo2-lightbox__panel" role="dialog" aria-modal="true" aria-label="Náhľad obrázka">
        <button class="promo2-lightbox__close" type="button" aria-label="Zavrieť">×</button>
        <img class="promo2-lightbox__img" alt="">
      </div>
    `;
    document.body.appendChild(lb);

    // klik mimo panelu = zavrieť
    lb.addEventListener('click', (e) => {
      if (e.target === lb) close(lb);
    });

    // X = zavrieť
    lb.querySelector('.promo2-lightbox__close').addEventListener('click', () => close(lb));

    // ESC = zavrieť
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lb.classList.contains('is-open')) close(lb);
    });

    return lb;
  }

  function open(src, alt){
    const lb = ensureLightbox();
    const img = lb.querySelector('.promo2-lightbox__img');
    img.src = src;
    img.alt = alt || '';
    lb.classList.add('is-open');
    document.body.classList.add('promo2-lock');
  }

  function close(lb){
    const img = lb.querySelector('.promo2-lightbox__img');
    lb.classList.remove('is-open');
    document.body.classList.remove('promo2-lock');
    img.src = '';
    img.alt = '';
  }

  // Delegácia: klik na promo2 kartu otvorí lightbox (okrem CTA)
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.promo2-card');
    if (!card) return;

    // CTA nech ostane normálny link na #ponuka
    if (e.target.closest('.promo2-cta')) return;

    const imgEl = card.querySelector('.promo2-img');
    if (!imgEl) return;

    e.preventDefault();
    e.stopPropagation();

    const full = imgEl.getAttribute('data-full') || imgEl.currentSrc || imgEl.src;
    open(full, imgEl.getAttribute('alt') || 'Foto');
  }, true);

})();


// ==============================
// Financovanie – kalkulačka + rýchly dopyt (EmailJS)
// ==============================
(function () {
  const calcRoot = document.querySelector('[data-finance-calc]');
  const form = document.getElementById('financeForm');

  function isKnownBrandSafe(b){
    return b === 'subaru' || b === 'kgm' || b === 'jeep' || b === 'chery';
  }

  function currentBrand(){
    const b = (document.documentElement.getAttribute('data-brand') || '').toLowerCase().trim();
    return isKnownBrandSafe(b) ? b : null;
  }

  function formatMoney(n){
    if (!isFinite(n)) return '—';
    return formatEuroAmount(Math.round(n)) || '—';
  }

  function caretAfterDigitCount(formattedDigits, digitCount) {
    if (digitCount <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < formattedDigits.length; i += 1) {
      if (/\d/.test(formattedDigits[i])) seen += 1;
      if (seen >= digitCount) return i + 1;
    }
    return formattedDigits.length;
  }

  function setFinanceMoneyInputLocked(input, locked) {
    if (!input) return;
    if (locked) {
      input.dataset.priceInputLocked = 'true';
      input.setAttribute('aria-invalid', 'true');
      input.setCustomValidity('Suma musí byť celé číslo bez desatinných miest.');
    } else {
      delete input.dataset.priceInputLocked;
      input.removeAttribute('aria-invalid');
      input.setCustomValidity('');
    }
  }

  function formatFinanceMoneyInput(input, preserveCaret = true) {
    if (!input) return;

    if (input.dataset.priceInputLocked === 'true') {
      input.value = input.dataset.lastValidPrice || '';
      return;
    }

    const raw = input.value;
    const invalidCharacters = /[^\d\s\u00a0\u202f€]/u.test(raw);
    const euroCount = (raw.match(/€/g) || []).length;
    if (invalidCharacters || euroCount > 1) {
      input.value = input.dataset.lastValidPrice || '';
      setFinanceMoneyInputLocked(input, true);
      return;
    }

    const rawCaret = input.selectionStart ?? raw.length;
    const rawDigits = raw.replace(/\D/g, '');
    const digits = rawDigits.replace(/^0+(?=\d)/, '');

    if (!digits) {
      input.value = '';
      input.dataset.lastValidPrice = '';
      return;
    }

    const grouped = groupIntegerDigits(digits);
    input.value = `${grouped} €`;
    input.dataset.lastValidPrice = input.value;

    if (preserveCaret && document.activeElement === input) {
      const removedLeadingZeros = rawDigits.length - digits.length;
      const digitsBeforeCaret = raw.slice(0, rawCaret).replace(/\D/g, '').length;
      const normalizedDigitCount = Math.max(0, digitsBeforeCaret - removedLeadingZeros);
      const nextCaret = caretAfterDigitCount(grouped, normalizedDigitCount);
      input.setSelectionRange(nextCaret, nextCaret);
    }
  }

  function computePayment(principal, months, annualRatePct){
    const n = Number(months) || 0;
    const P = Number(principal) || 0;
    const r = (Number(annualRatePct) || 0) / 100 / 12;

    if (!n || P <= 0) return 0;
    if (r <= 0) return P / n;

    const pow = Math.pow(1 + r, -n);
    return (P * r) / (1 - pow);
  }

  function readCalcValues(){
    if (!calcRoot) return null;
    const priceEl = calcRoot.querySelector('#finPrice');
    const downEl  = calcRoot.querySelector('#finDown');
    const monEl   = calcRoot.querySelector('#finMonths');
    const rateEl  = calcRoot.querySelector('#finRate');
    if (!priceEl || !downEl || !monEl || !rateEl) return null;

    const price = parseEuroAmount(priceEl.value) ?? 0;
    const down  = parseEuroAmount(downEl.value) ?? 0;
    const months = Math.max(0, Number(monEl.value) || 0);
    const rate = Math.max(0, Number(rateEl.value) || 0);

    const principal = Math.max(0, price - down);
    const monthly = computePayment(principal, months, rate);
    const total = (monthly * months) + down;

    return { price, down, months, rate, principal, monthly, total };
  }

  function financeSummaryText(v){
    if (!v) return '';

    const b = currentBrand();
    const hasBrandLabel = (typeof BRAND_LABEL !== 'undefined' && BRAND_LABEL);
    const bLabel = b ? ((hasBrandLabel && BRAND_LABEL[b]) ? BRAND_LABEL[b] : b) : 'Všetky značky';

    return [
      'Dopyt: financovanie',
      `Značka: ${bLabel}`,
      `Cena vozidla: ${formatMoney(v.price)}`,
      `Akontácia: ${formatMoney(v.down)}`,
      `Doba splácania: ${v.months} mes.`,
      `Úrok p.a.: ${v.rate}%`,
      `Orientačná splátka: ${formatMoney(v.monthly)} / mes.`,
      '',
      'Prosím o prípravu ponuky.',
    ].join('\n');
  }

  function renderCalc(){
    const v = readCalcValues();
    if (!v) return;

    const monthlyEl = calcRoot.querySelector('#finMonthly');
    const princEl   = calcRoot.querySelector('#finPrincipal');
    const totalEl   = calcRoot.querySelector('#finTotal');

    if (monthlyEl) monthlyEl.textContent = formatMoney(v.monthly);
    if (princEl)   princEl.textContent   = formatMoney(v.principal);
    if (totalEl)   totalEl.textContent   = formatMoney(v.total);

    calcRoot.dataset.financeSummary = financeSummaryText(v);
  }

  if (calcRoot) {
    const moneyInputs = [
      calcRoot.querySelector('#finPrice'),
      calcRoot.querySelector('#finDown'),
    ].filter(Boolean);

    moneyInputs.forEach(input => {
      setFinanceMoneyInputLocked(input, false);
      formatFinanceMoneyInput(input, false);
      input.addEventListener('beforeinput', event => {
        const isDelete = event.inputType.startsWith('delete');
        const isInsert = event.inputType.startsWith('insert');

        if (input.dataset.priceInputLocked === 'true') {
          if (isDelete) setFinanceMoneyInputLocked(input, false);
          else if (isInsert) event.preventDefault();
          return;
        }

        if (event.inputType === 'insertText' && event.data && /[^\d]/u.test(event.data)) {
          event.preventDefault();
          if (/[^\s€]/u.test(event.data)) setFinanceMoneyInputLocked(input, true);
        }
      });
      input.addEventListener('blur', () => {
        setFinanceMoneyInputLocked(input, false);
        formatFinanceMoneyInput(input, false);
        renderCalc();
      });
      input.addEventListener('focus', () => {
        if (input.selectionStart === input.value.length && input.value.endsWith(' €')) {
          const nextCaret = input.value.length - 2;
          input.setSelectionRange(nextCaret, nextCaret);
        }
      });
    });

    ['input', 'change'].forEach(ev => {
      calcRoot.addEventListener(ev, (e) => {
        if (!e.target) return;
        const id = e.target.id;
        if (id === 'finPrice' || id === 'finDown') {
          formatFinanceMoneyInput(e.target, ev === 'input');
        }
        if (id === 'finPrice' || id === 'finDown' || id === 'finMonths' || id === 'finRate') renderCalc();
      });
    });
    renderCalc();
  }

  

  // Rýchly dopyt – odoslanie cez EmailJS (rovnaký template ako kontakt)
  if (form) {
    const submitBtn = document.getElementById('financeSubmit');
    const statusEl = document.getElementById('financeStatus');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // honeypot anti-spam
      const hp = form.querySelector('input[name="website"]');
      if (hp && hp.value) return;

      const ta = form.querySelector('textarea[name="sprava"]');
      const summary = (calcRoot?.dataset?.financeSummary || '').trim();
      if (ta && !ta.value.trim() && summary) ta.value = summary;

      if (!window.emailjs || typeof window.emailjs.sendForm !== 'function') {
        if (statusEl) statusEl.textContent = 'Odoslanie formulára nie je dostupné (EmailJS). Použite prosím e-mail alebo telefón.';
        return;
      }

      try {
        if (statusEl) statusEl.textContent = 'Odosielam...';
        if (submitBtn) submitBtn.disabled = true;

        await window.emailjs.sendForm('service_i68hphn', 'template_contact', form);

        if (statusEl) statusEl.textContent = 'Dopyt bol odoslaný. Ozveme sa vám čo najskôr.';
        form.reset();
        renderCalc();
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Odoslanie zlyhalo. Skúste to prosím znova alebo použite e-mail.';
        console.error(err);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();
