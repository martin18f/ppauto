// ==============================
// PP AUTO – dynamické generovanie áut + filtrovanie + brand režim (Subaru/KGM/Jeep)
// ==============================

const BRAND_STORAGE_KEY = 'ppauto.brand';

// brand: 'subaru' | 'kgm' | 'jeep' | null
let BRAND_CTX = null;

const BRAND_CONFIG = {
  subaru: {
    label: 'Subaru',
    badge: 'Subaru',
    seoTitle: 'PP AUTO s.r.o. – Subaru | Poprad',
    seoDescription: 'Autorizovaný predaj a servis Subaru v Poprade. Skladové vozidlá, testovacie jazdy, financovanie, servis a náhradné diely.',
    heroTitleHTML: 'Subaru. Nové aj skladové vozidlá.<br>Autorizovaný servis v Poprade.',
    heroLeadHTML: 'Od roku 2011 poskytujeme v Poprade autorizovaný predaj a servis Subaru. Pomôžeme s&nbsp;výberom, financovaním aj poistením a postaráme sa o&nbsp;vaše Subaru počas celej životnosti.',
    quickTestLead: 'Zažite Subaru naživo na cestách – rezervujte si test jazdu.',
    inventoryTitle: 'Aktuálna ponuka Subaru',
    brandsTitle: 'Subaru – informácie a test jazda',
    footerLineHTML: 'Autorizovaný predaj a servis Subaru v Poprade od roku 2011.'
  },
  kgm: {
    label: 'KGM',
    badge: 'KGM - SsangYong Motor',
    seoTitle: 'PP AUTO s.r.o. – KGM | Poprad',
    seoDescription: 'Autorizovaný predaj a servis KGM v Poprade. Skladové vozidlá, testovacie jazdy, financovanie, servis a náhradné diely.',
    heroTitleHTML: 'KGM. Moderné SUV a skladové vozidlá.<br>Autorizovaný servis v Poprade.',
    heroLeadHTML: 'Od roku 2011 poskytujeme v Poprade profesionálny predaj a servis. Vyberieme s&nbsp;vami vhodné KGM, pomôžeme s&nbsp;financovaním a postaráme sa o&nbsp;servis počas celej životnosti vozidla.',
    quickTestLead: 'Zažite KGM naživo na cestách – rezervujte si test jazdu.',
    inventoryTitle: 'Aktuálna ponuka KGM',
    brandsTitle: 'KGM – informácie a test jazda',
    footerLineHTML: 'Autorizovaný predaj a servis KGM v Poprade od roku 2011.'
  },
  jeep: {
    label: 'Jeep',
    badge: 'Jeep',
    seoTitle: 'PP AUTO s.r.o. – Jeep | Poprad',
    seoDescription: 'Autorizovaný predaj a servis Jeep v Poprade. Skladové vozidlá, testovacie jazdy, financovanie, servis a náhradné diely.',
    heroTitleHTML: 'Jeep. Skladové vozidlá a dobrodružstvo.<br>Autorizovaný servis v Poprade.',
    heroLeadHTML: 'Od roku 2011 prinášame v Poprade profesionálne služby pri predaji a servise. Pomôžeme s&nbsp;výberom Jeepu, financovaním aj poistením a postaráme sa o&nbsp;vaše vozidlo počas celej životnosti.',
    quickTestLead: 'Zažite Jeep naživo na cestách – rezervujte si test jazdu.',
    inventoryTitle: 'Aktuálna ponuka Jeep',
    brandsTitle: 'Jeep – informácie a test jazda',
    footerLineHTML: 'Autorizovaný predaj a servis Jeep v Poprade od roku 2011.'
  }
};

function isKnownBrand(b) {
  return b === 'subaru' || b === 'kgm' || b === 'jeep';
}

function getBrandFromURLRaw() {
  const raw = new URLSearchParams(location.search).get('brand');
  return raw ? raw.toLowerCase().trim() : null;
}

/**
 * 1) Ak je v URL ?brand=..., zober to a ulož do sessionStorage (kvôli refreshu).
 * 2) Ak ?brand=all → zruš uložený brand a vráť null.
 * 3) Ak v URL nič nie je, použi uložený brand (ak existuje).
 */
function resolveBrandContext() {
  const fromURL = getBrandFromURLRaw();

  if (fromURL) {
    if (fromURL === 'all') {
      sessionStorage.removeItem(BRAND_STORAGE_KEY);
      return null;
    }
    if (isKnownBrand(fromURL)) {
      sessionStorage.setItem(BRAND_STORAGE_KEY, fromURL);
      return fromURL;
    }

    // neznámy brand → radšej nič (a vyčisti)
    sessionStorage.removeItem(BRAND_STORAGE_KEY);
    return null;
  }

  const stored = (sessionStorage.getItem(BRAND_STORAGE_KEY) || '').toLowerCase().trim();
  return isKnownBrand(stored) ? stored : null;
}

function cleanBrandParamFromURL() {
  if (!new URLSearchParams(location.search).has('brand')) return;
  try {
    const url = new URL(location.href);
    url.searchParams.delete('brand');
    // zachováme iné parametre (ak by boli) aj hash
    history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
  } catch (e) {
    // ignore
  }
}

// ------------------------------
// Brand UI (texty/odkazy/sekcie)
// ------------------------------

function setIfFound(selector, cb) {
  const el = document.querySelector(selector);
  if (el) cb(el);
}

function applyBrandUI() {
  if (!BRAND_CTX) return;

  const cfg = BRAND_CONFIG[BRAND_CTX];
  if (!cfg) return;

  // dataset/class pre prípadné CSS rozšírenia
  document.body.dataset.brand = BRAND_CTX;

  // SEO
  if (cfg.seoTitle) document.title = cfg.seoTitle;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && cfg.seoDescription) metaDesc.setAttribute('content', cfg.seoDescription);

  // HERO: badges
  setIfFound('.hero .badge-row', (row) => {
    row.innerHTML = [
      '<span class="badge">Autorizovaný predaj &amp; servis</span>',
      `<span class="badge">${cfg.badge}</span>`
    ].join('');
  });

  // HERO: titulok + lead
  setIfFound('.hero-card h2', (h2) => { h2.innerHTML = cfg.heroTitleHTML; });
  setIfFound('.hero-card > p', (p) => { p.innerHTML = cfg.heroLeadHTML; });

  // HERO: CTA tlačidlá
  setIfFound('.hero .quick a[href="#ponuka"]', (a) => { a.textContent = `Pozrieť ${cfg.label} vozidlá`; });
  setIfFound('.hero .quick a[href="#znacky"]', (a) => {
    a.textContent = `Test jazda ${cfg.label}`;
    a.setAttribute('href', '#kontakt');
  });

  // HERO: posledná quick-card (test jazda)
  setIfFound('.hero .quick-grid .quick-card:last-child p', (p) => { p.textContent = cfg.quickTestLead; });

  // INVENTORY: názov sekcie
  setIfFound('#ponuka .section-head h3', (h3) => { h3.textContent = cfg.inventoryTitle; });

  // SERVIS: prepis značiek v 1. bode (Subaru, KGM a Jeep → len vybraná značka)
  setIfFound('#servis .no-bullets li:first-child b', (b) => { b.textContent = cfg.label; });

  // ZNAČKY: nechaj iba 1 tile + uprav nadpis
  setIfFound('#znacky .section-head h3', (h3) => { h3.textContent = cfg.brandsTitle; });
  document.querySelectorAll('#znacky .brand-tile').forEach((tile) => {
    const name = (tile.querySelector('h4')?.textContent || '').toLowerCase().trim();
    tile.style.display = (name === cfg.label.toLowerCase()) ? '' : 'none';
  });

  // FOOTER claim
  setIfFound('footer .foot-brand p', (p) => { p.innerHTML = cfg.footerLineHTML; });

  // Pridaj link na zmenu značky do navigácie (ak tam ešte nie je)
  const navLinks = document.querySelector('header .nav-links');
  if (navLinks && !navLinks.querySelector('a[href="vyber-znacky.html"]')) {
    const a = document.createElement('a');
    a.href = 'vyber-znacky.html';
    a.textContent = 'Vybrať inú značku';
    navLinks.appendChild(a);
  }

  // Brand režim = "čistejšia" stránka (odstrihneme nerelevantné sekcie)
  hideNonBrandSections();
  pruneHiddenAnchorLinks();
}

function hideNonBrandSections() {
  if (!BRAND_CTX) return;

  // Nechávame: hero, ponuka, servis, značky, kontakt
  const keepIds = new Set(['ponuka', 'servis', 'znacky', 'kontakt']);

  // všetky sekcie v <main>
  document.querySelectorAll('main > section').forEach((sec) => {
    if (sec.classList.contains('hero')) return;
    const id = (sec.id || '').trim();
    if (!keepIds.has(id)) sec.style.display = 'none';
  });

  // Mapa nech ostane (ľudia chcú navigovať)
  // Ak by si mapu nechcel v brand režime, odkomentuj:
  // document.getElementById('mapa')?.style && (document.getElementById('mapa').style.display = 'none');
}

function pruneHiddenAnchorLinks() {
  if (!BRAND_CTX) return;

  // Skryj iba interné odkazy, ktoré smerujú na skrytú / neexistujúcu sekciu
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href === '#' || href.length < 2) return;

    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;

    const isHidden = (target.style && target.style.display === 'none');
    if (isHidden) a.style.display = 'none';
  });
}

// -------------------------------------
// Filter lišta (taby) pre brand kontext
// -------------------------------------

/**
 * Zobraz len povolené záložky pre brand:
 *  - Všetko, Novinky, Skladom (+ voliteľne predvádzacie, jazdené – ak ich raz doplníš)
 */
function pruneTabsForBrand() {
  if (!BRAND_CTX) return; // bez brand kontextu nič neskryváme

  const allowed = new Set(['all', 'novinky', 'skladom', 'predvadzacie', 'jazdene']);
  document.querySelectorAll('.filter-row .tag').forEach((btn) => {
    const v = (btn.getAttribute('data-filter') || '').toLowerCase();
    if (!allowed.has(v)) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  });

  // nastav "Všetko" ako aktívne
  const allBtn = document.querySelector('.filter-row .tag[data-filter="all"]');
  if (allBtn) {
    document.querySelectorAll('.filter-row .tag').forEach((b) => b.classList.remove('active'));
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

  cards.forEach((card) => {
    const make = (card.dataset.make || '').toLowerCase();
    const tags = (card.dataset.tags || '').toLowerCase().split(/\s+/).filter(Boolean);

    // 1) Brand match – ak máme BRAND_CTX, pustíme len túto značku
    const brandOK = !BRAND_CTX || (make === BRAND_CTX || tags.includes(BRAND_CTX));

    // 2) Kategória/tab match
    //    - ak klikneš na značku (subaru/kgm/jeep) v "plnom" režime, chceme filtrovať podľa make
    //    - inak podľa tagov
    let catOK = true;
    if (f !== 'all') {
      if (isKnownBrand(f)) {
        catOK = (make === f) || tags.includes(f);
      } else {
        catOK = tags.includes(f);
      }
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

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = (btn.getAttribute('data-filter') || 'all').toLowerCase();
      applyFilters(filter);
    });
  });
}

/**
 * Načítanie áut + aplikovanie filtrovania
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
    auta.forEach((auto) => container.appendChild(vykresliKartu(auto)));

    initFiltery();
    pruneTabsForBrand();
    applyFilters('all');

    console.log('✅ Načítané autá:', auta.length, '| BRAND_CTX =', BRAND_CTX || 'none');
  } catch (error) {
    console.error('❌ Chyba pri načítaní zoznamu áut:', error);
  }
}

// ------------------------------
// Bootstrap
// ------------------------------

document.addEventListener('DOMContentLoaded', () => {
  BRAND_CTX = resolveBrandContext();
  applyBrandUI();
  cleanBrandParamFromURL();
  nacitajAuta();
});
