// ==============================
// Detail auta (auto.html)
// - načíta auto podľa /auta/{id} alebo ?id=... z /api/cars
// - zobrazí galériu + údaje + výbavu
// ==============================

(function () {
  const mount = document.getElementById('carDetail');
  const qs = new URLSearchParams(location.search);
  function wantedIdFromPathname() {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('auta');
    return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '').trim() : '';
  }

  const wantedId = (qs.get('id') || wantedIdFromPathname()).trim();
  const INVENTORY_RETURN_KEY = 'ppauto.inventoryReturn';
  const backToInventory = document.querySelector('.car-breadcrumb a');

  function isLocalRouteHost() {
    return location.protocol === 'file:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '::1';
  }

  function getStoredInventoryReturnHref() {
    if (!wantedId) return '';

    try {
      const stored = JSON.parse(sessionStorage.getItem(INVENTORY_RETURN_KEY) || 'null');
      if (!stored || String(stored.carId || '') !== wantedId || !stored.href) return '';

      const url = new URL(stored.href, location.href);
      const sameSite =
        location.protocol === 'file:'
          ? url.protocol === 'file:'
          : url.origin === location.origin;

      if (!sameSite) return '';

      const slug = url.pathname.replace(/\/+$/, '').split('/').pop().toLowerCase();
      const isInventoryRoute =
        slug === 'ponuka' ||
        slug === 'subaru' ||
        slug === 'kgm' ||
        slug === 'jeep' ||
        slug === 'chery' ||
        slug === 'index.html';

      if (!isInventoryRoute) return '';

      url.hash = 'ponuka';
      return url.href;
    } catch (e) {
      return '';
    }
  }

  function getDefaultInventoryHref(brand) {
    const normalized = String(brand || '').toLowerCase().trim();
    const knownBrand =
      normalized === 'subaru' ||
      normalized === 'kgm' ||
      normalized === 'jeep' ||
      normalized === 'chery';

    const english = (qs.get('lang') || '').toLowerCase() === 'en';

    if (isLocalRouteHost()) {
      const params = new URLSearchParams();
      params.set('brand', knownBrand ? normalized : 'all');
      if (english) params.set('lang', 'en');
      return `index.html?${params.toString()}#ponuka`;
    }

    const path = knownBrand ? `/${normalized}` : '/ponuka';
    return path + (english ? '?lang=en' : '') + '#ponuka';
  }

  function setBackToInventoryHref(fallbackBrand) {
    const href = getStoredInventoryReturnHref() || getDefaultInventoryHref(fallbackBrand);
    if (backToInventory) backToInventory.setAttribute('href', href);
    return href;
  }

  if (!mount) return;

  setBackToInventoryHref();

    // ==============================
  // TEST DRIVE (EmailJS)
  // ==============================
  const EMAILJS_PUBLIC_KEY = '_7xrgG31AEooF0kcr';
  const EMAILJS_SERVICE_ID = 'service_i68hphn';
  const EMAILJS_TEMPLATE_TESTDRIVE = 'template_testdrive'; // <- SEM daj template ID z EmailJS

  let _emailReady = false;
  let _tdModalReady = false;
  let _tdCarCtx = null;

  function initEmailJsOnce() {
    if (_emailReady) return true;
    if (!window.emailjs) {
      console.warn('EmailJS nie je načítaný. Skontroluj script tag v auto.html.');
      return false;
    }
    window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    _emailReady = true;
    return true;
  }

  function formatDateSK(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return String(iso);
    return d.toLocaleDateString('sk-SK');
  }

  function ensureTestDriveModal() {
    if (_tdModalReady) return;

    const el = document.createElement('div');
    el.id = 'tdModal';
    el.className = 'td-modal';
    el.hidden = true;
    el.innerHTML = `
      <div class="td-dialog">
        <div class="td-head">
          <div class="td-title">
            Žiadosť o testovaciu jazdu
          </div>
          <button type="button" id="tdClose" class="td-close" aria-label="Zavrieť">×</button>
        </div>

        <div class="td-body">
          <div id="tdCarLine" class="td-car-line">
            —
          </div>

          <form id="tdForm">
            <div class="td-grid">
              <input class="td-input" name="meno" required placeholder="Meno">
              <input class="td-input" name="email" required type="email" placeholder="E-mail">
              <input class="td-input" name="telefon" placeholder="Telefón">
              <input class="td-input" name="datum_iso" type="date" required>

              <select class="td-input" name="slot_text">
                <option value="Nezáleží">Časť dňa: Nezáleží</option>
                <option value="Dopoludnia">Časť dňa: Dopoludnia</option>
                <option value="Popoludní">Časť dňa: Popoludní</option>
              </select>

              <input class="td-input" name="time_text" type="time" placeholder="Konkrétny čas">
            </div>

            <!-- honeypot -->
            <input class="pp-hidden-field" name="website" tabindex="-1" autocomplete="off">

            <textarea class="td-note" name="poznamka" rows="4" placeholder="Poznámka (voliteľné)"></textarea>

            <div class="td-actions">
              <button type="submit" id="tdSubmit" class="td-submit">
                Odoslať žiadosť
              </button>
              <div id="tdStatus" class="td-status"></div>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const close = () => { el.hidden = true; document.body.classList.remove('no-scroll'); };
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    el.querySelector('#tdClose').addEventListener('click', close);

    const form = el.querySelector('#tdForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!initEmailJsOnce()) return;

      const status = el.querySelector('#tdStatus');
      const btn = el.querySelector('#tdSubmit');

      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());

      if (data.website) { // bot
        form.reset();
        if (status) status.textContent = 'Ďakujeme! Žiadosť bola odoslaná.';
        close();
        return;
      }

      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = 'Odosielam…';
      if (status) status.textContent = '';

      try {
        const ctx = _tdCarCtx || {};
        const templateParams = {
          // Vozidlo
          car_title: ctx.car_title || '—',
          car_id: ctx.car_id || '—',
          car_vybava: ctx.car_vybava || '—',
          car_palivo: ctx.car_palivo || '—',
          car_prevodovka: ctx.car_prevodovka || '—',
          car_cena: ctx.car_cena || '—',
          car_url: ctx.car_url || '—',

          // Termín (do šablóny posielame už “text”)
          datum_text: formatDateSK(data.datum_iso),
          slot_text: (data.slot_text || '—'),
          time_text: (data.time_text || '—'),

          // Kontakt
          meno: data.meno || '—',
          email: data.email || '—',
          telefon: data.telefon || '—',
          poznamka: (data.poznamka || '—')
        };

        await window.emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_TESTDRIVE,
          templateParams
        );

        if (status) status.textContent = 'Ďakujeme! Žiadosť bola odoslaná.';
        form.reset();
        close();
      } catch (err) {
        console.error(err);
        if (status) status.textContent = 'Nepodarilo sa odoslať. Skúste neskôr.';
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    _tdModalReady = true;
  }

  function openTestDriveModalForCar(ctx) {
    ensureTestDriveModal();
    _tdCarCtx = ctx;

    const modal = document.getElementById('tdModal');
    const line = modal.querySelector('#tdCarLine');
    if (line) line.textContent = ctx?.car_title ? ctx.car_title : '—';

    modal.hidden = false;
    document.body.classList.add('no-scroll');
  }


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

  function resolveLocalAssetUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(raw)) return raw;
    return '/' + raw.replace(/^\.?\//, '');
  }

  function resolveCarId(car, baseCounts, usedIds) {
    const existing = (car?.id || '').toString().trim();
    if (existing) {
      if (usedIds) usedIds.add(existing);
      return existing;
    }

    const base = slugify(`${car?.znacka || ''}-${car?.model || ''}-${car?.rok ?? ''}`) || 'auto';
    const used = usedIds || new Set();

    if (!used.has(base) && !(baseCounts.get(base) > 0)) {
      used.add(base);
      baseCounts.set(base, 1);
      return base;
    }

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

  function formatNumber(n) {
    if (n === null || n === undefined || n === '') return '';
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    return new Intl.NumberFormat('sk-SK').format(num);
  }

  function hasValue(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }

  function gearboxFullLabel(typRaw) {
  const t = String(typRaw || '').trim().toUpperCase();

  if (t === 'AT') return 'Automatická prevodovka';
  if (t === 'MT') return 'Manuálna prevodovka';

  // ak je niečo iné, nechaj ako je
  return String(typRaw || '').trim();
}

function parseLegacyPrevodovka(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return { typ: '', paket: '' };

  const parts = txt
    .split(/•|·|\|/g)
    .map(p => p.trim())
    .filter(Boolean);

  if (!parts.length) return { typ: '', paket: '' };

  if (parts.length === 1) {
    const one = parts[0].toUpperCase().replace(/\s+/g, '');
    if (/^(AT|MT|CVT|DCT|DSG)$/.test(one)) return { typ: one, paket: '' };
    return { typ: '', paket: parts[0] };
  }

  return { typ: parts[0].toUpperCase().replace(/\s+/g, ''), paket: parts.slice(1).join(' • ') };
}


  function ensureLightbox() {
  let root = document.getElementById('carLightbox');
  if (!root) {
    root = document.createElement('div');
    root.id = 'carLightbox';
    root.className = 'car-lightbox';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="car-lightbox__inner" role="dialog" aria-modal="true">
        <button type="button" class="car-lightbox__close" aria-label="Zavrieť">×</button>
        <img class="car-lightbox__img" alt="">
      </div>
    `;
    document.body.appendChild(root);
  }

  const img = root.querySelector('.car-lightbox__img');
  const closeBtn = root.querySelector('.car-lightbox__close');

  function open(src, alt) {
    img.src = src;
    img.alt = alt || '';
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }

  function close() {
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');

    // nezruš no-scroll, ak je otvorené mobilné menu
    const navOpen = document.querySelector('header .nav')?.classList.contains('open');
    if (!navOpen) document.body.classList.remove('no-scroll');
  }

  // klik mimo obrázka zavrie
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });

  closeBtn.addEventListener('click', close);

  return { root, img, open, close, isOpen: () => root.classList.contains('open') };
}


  function setBrandFromCar(car) {
    const make = (car?.znacka || '').toLowerCase().trim();
    if (make === 'subaru' || make === 'kgm' || make === 'jeep' || make === 'chery') {
      document.documentElement.setAttribute('data-brand', make);
      applyDetailBrandText(make);
      setBackToInventoryHref(make);
    }
  }

  function applyDetailBrandText(brand) {
    const label = brand === 'kgm' ? 'KGM' : brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : '';
    if (!label) return;

    document.querySelectorAll('[data-brand-text="footer"]').forEach((el) => {
      const text = `Autorizovaný predaj a servis ${label} v Poprade od roku 2011.`;
      el.textContent = window.ppI18n?.isEnglish?.() ? window.ppI18n.t(text) : text;
    });
  }

  function renderNotFound(message) {
    const english =
      (qs.get('lang') || '').toLowerCase() === 'en' ||
      document.documentElement.lang === 'en';
    const title = english ? 'Vehicle not found' : 'Vozidlo sa nenašlo';
    const description = english
      ? 'This vehicle is no longer available, is hidden, or the address is invalid.'
      : (message || 'Toto vozidlo už nie je v ponuke alebo je adresa neplatná.');
    const backLabel = english ? '← Back to the vehicle offer' : '← Späť na ponuku';
    const backHref = setBackToInventoryHref();

    const escapeHtml = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    document.title = `${title} | PP AUTO s.r.o.`;

    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex,follow');

    mount.innerHTML = `
      <section class="car-card">
        <div class="section-title"><h2>${escapeHtml(title)}</h2></div>
        <div class="section-body">
          <p class="empty-note">${escapeHtml(description)}</p>
          <div class="car-cta">
            <a class="btn car-btn car-btn-primary" href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a>
            <a class="btn car-btn" href="tel:+421903905280">${english ? 'Call sales' : 'Zavolať predaj'}</a>
            <a class="btn car-btn" href="#" data-mail="sales">${english ? 'Email sales' : 'Napísať predaju'}</a>
          </div>
        </div>
      </section>
    `;
  }

  function priceHtml(car) {
    const hasDiscount = !!(car?.nova_cena && String(car.nova_cena).trim() !== '');
    if (hasDiscount) {
      return `
        <div class="price-big">${car.nova_cena}</div>
        <div class="price-old">${car.stara_cena || ''}</div>
      `;
    }
    const p = (car?.stara_cena && String(car.stara_cena).trim() !== '') ? car.stara_cena : 'Cena na vyžiadanie';
    return `<div class="price-big">${p}</div>`;
  }

  function buildKV(rows) {
    const filtered = rows.filter(r => hasValue(r.value));
    if (!filtered.length) {
      return `<p class="empty-note">Údaje zatiaľ nie sú doplnené.</p>`;
    }
    return `
      <div class="kv">
        ${filtered
          .map(r => `
            <div class="row">
              <span class="label">${r.label}</span>
              <span class="value">${r.value}</span>
            </div>
          `)
          .join('')}
      </div>
    `;
  }

  function render(car) {
    const title = `${car.rok || ''} ${(car.znacka || '').toUpperCase()} ${car.model || ''}`.trim();
    document.title = `${title} | PP AUTO s.r.o.`;
    setBrandFromCar(car);

    const gallery =
  (Array.isArray(car.galeria) && car.galeria.length) ? car.galeria :
  (Array.isArray(car.obrazky) && car.obrazky.length) ? car.obrazky : [];

let images = gallery.map(resolveLocalAssetUrl).filter(Boolean);

const cover = resolveLocalAssetUrl(car.titulka || car.obrazok || '');
if (cover) {
  // titulka vždy prvá + bez duplicit
  images = [cover, ...images.filter(u => u !== cover)];
}

if (!images.length && cover) images = [cover];

    const tags = Array.isArray(car.tagy) ? car.tagy.filter(Boolean) : [];

    const objem = hasValue(car.objem) ? `${formatNumber(car.objem)} cm³` : '';
    const najazdene = hasValue(car.najazdene) ? `${formatNumber(car.najazdene)} km` : '';
    const vykon = hasValue(car.vykon) ? `${formatNumber(car.vykon)} kW` : '';
    const metaliza = car.metaliza === true ? 'Áno' : (car.metaliza === false ? '' : '');

    // Admin má v jednom texte "Prevodovka / Výbava" (napr. "AT • Premium").
// V detaile to rozdelíme: prevodovka -> Technické údaje, vybavaBalik -> Základné údaje.


// --- Prevodovka + Výbava balík (oddelené polia + fallback zo starého "AT • Premium") ---
const legacy = parseLegacyPrevodovka(car.prevodovka || '');

// typ prevodovky: preferuj nové pole z adminu, inak fallback na legacy
const typPrevodovky =
  (car.typ_prevodovky && String(car.typ_prevodovky).trim())
    ? String(car.typ_prevodovky).trim()
    : (legacy.typ || '');

// balík výbavy: preferuj nové pole z adminu, inak fallback na legacy
const vybavaPaket =
  (car.vybava_paket && String(car.vybava_paket).trim())
    ? String(car.vybava_paket).trim()
    : (legacy.paket || '');

// AT/MT -> celé slovo
const prevodovkaText = gearboxFullLabel(typPrevodovky);




    const basicRows = [
  { label: 'Značka', value: car.znacka ? String(car.znacka).toUpperCase() : '' },
  { label: 'Model', value: car.model || '' },
  { label: 'Rok výroby', value: hasValue(car.rok) ? String(car.rok) : '' },

  // výbava (balík) v základných údajoch
  { label: 'Výbava', value: vybavaPaket || '' },

  { label: 'Karoséria', value: car.karoseria || '' },
  { label: 'Pohon', value: car.pohon || '' },
  { label: 'Farba', value: car.farba || '' },
  { label: 'Metalíza', value: metaliza },
];

    const techRows = [
  { label: 'Palivo', value: car.palivo || '' },
  { label: 'Prevodovka', value: prevodovkaText || '' },

  { label: 'Objem', value: objem },
  { label: 'Výkon', value: vykon },
  { label: 'Najazdené', value: najazdene },
];



    const vybava = Array.isArray(car.vybava) ? car.vybava.filter(Boolean) : [];

    mount.innerHTML = `
      <div class="car-top">
        <div class="car-card gallery">
          <div class="gallery-main">
            <div class="imgwrap">
              <img id="mainImg" src="${images[0] || ''}" alt="${title}">
            </div>
            ${images.length > 1 ? `
              <button class="gal-btn prev" type="button" aria-label="Predchádzajúca fotka" id="prevBtn">‹</button>
              <button class="gal-btn next" type="button" aria-label="Ďalšia fotka" id="nextBtn">›</button>
            ` : ''}
          </div>
          ${images.length ? `
            <div class="thumbs" id="thumbs">
              ${images
                .map((src, i) => `
                  <div class="thumb ${i === 0 ? 'is-active' : ''}" data-idx="${i}">
                    <img src="${src}" alt="${title} – foto ${i + 1}">
                  </div>
                `)
                .join('')}
            </div>
          ` : `
            <div class="section-body"><p class="empty-note">Fotky nie sú doplnené.</p></div>
          `}
        </div>

        <aside class="car-card">
          <div class="car-hero">
            <h2>${title}</h2>
            ${tags.length ? `
              
            ` : `<p>Vozidlo z ponuky PP AUTO.</p>`}
          </div>

          <div class="car-pricebox">
            ${priceHtml(car)}
            <div class="price-note">Pre presnú dostupnosť a detaily nás prosím kontaktujte.</div>
          </div>

          <div class="car-cta">
  <a class="btn car-btn car-btn-primary" href="tel:+421903905280">Zavolať predaj</a>
  <a class="btn car-btn" href="#testdrive" id="openTestDrive">Testovacia jazda</a>
  <a class="btn car-btn" href="#" data-mail="sales">Napísať predaju</a>
  <a class="btn car-btn" href="/ponuka#kontakt">Navigovať / Kontakt</a>
</div>
        </aside>
      </div>

      <div class="car-sections">
        <section class="car-card">
          <div class="section-title"><h3>Základné údaje</h3></div>
          <div class="section-body">
            ${buildKV(basicRows)}
          </div>
        </section>

        <section class="car-card">
          <div class="section-title"><h3>Technické údaje</h3></div>
          <div class="section-body">
            ${buildKV(techRows)}
          </div>
        </section>

        <section class="car-card">
          <div class="section-title"><h3>Výbava</h3></div>
          <div class="section-body">
            ${vybava.length
              ? `<div class="equip">${vybava.map(v => `<div class="item">${v}</div>`).join('')}</div>`
              : `<p class="empty-note">Výbava zatiaľ nie je doplnená.</p>`}
          </div>
        </section>

              <section class="car-card" id="testdrive">
  <div class="section-title"><h3>Testovacia jazda</h3></div>
  <div class="section-body">

    <div class="car-td-picked">
      <div class="car-td-title">${title}</div>
      <div class="car-td-meta">
        ${[vybavaPaket, car.palivo, prevodovkaText, car.pohon, car.farba, najazdene].filter(Boolean).join(' • ')}
      </div>
    </div>

    <form id="carTestDriveForm" class="car-td-form">
      <div class="car-td-grid">
        <div class="car-td-field">
          <label for="carTdDate">Preferovaný dátum</label>
          <input id="carTdDate" name="datum" type="date" />
        </div>

        <div class="car-td-field">
          <label for="carTdSlot">Časť dňa</label>
          <select id="carTdSlot" name="cas_okno">
            <option value="">Nezáleží</option>
            <option value="Ráno (8:00–10:00)">Ráno (8:00–10:00)</option>
            <option value="Dopoludnia (10:00–12:00)">Dopoludnia (10:00–12:00)</option>
            <option value="Obed (12:00–14:00)">Obed (12:00–14:00)</option>
            <option value="Popoludní (14:00–17:00)">Popoludní (14:00–17:00)</option>
            <option value="Konkrétny čas">Konkrétny čas</option>
          </select>
        </div>

        <div class="car-td-field" id="carTdTimeRow" hidden>
          <label for="carTdTime">Konkrétny čas</label>
          <select id="carTdTime" name="cas">
            <option value="">Vyberte čas</option>
            <option>08:00</option><option>08:30</option><option>09:00</option><option>09:30</option>
            <option>10:00</option><option>10:30</option><option>11:00</option><option>11:30</option>
            <option>12:00</option><option>12:30</option><option>13:00</option><option>13:30</option>
            <option>14:00</option><option>14:30</option><option>15:00</option><option>15:30</option>
            <option>16:00</option><option>16:30</option>
          </select>
        </div>

        <div class="car-td-field">
          <label for="carTdName">Meno</label>
          <input id="carTdName" name="meno" required placeholder="Meno" />
        </div>

        <div class="car-td-field">
          <label for="carTdEmail">E-mail</label>
          <input id="carTdEmail" name="email" required type="email" placeholder="E-mail" />
        </div>

        <div class="car-td-field">
          <label for="carTdPhone">Telefón</label>
          <input id="carTdPhone" name="telefon" placeholder="Telefón" />
        </div>

        <div class="car-td-field car-td-span">
          <label for="carTdNote">Poznámka (voliteľné)</label>
          <textarea id="carTdNote" name="poznamka" rows="3" placeholder="Napíšte nám preferencie, otázky, …"></textarea>
        </div>

        <label class="car-td-consent car-td-span">
          <input type="checkbox" required />
          Súhlasím so spracovaním osobných údajov za účelom kontaktovania ohľadom testovacej jazdy.
        </label>

        <!-- anti-spam honeypot -->
        <input class="pp-hidden-field" name="website" tabindex="-1" autocomplete="off">

        <!-- EmailJS template field -->
        <textarea class="pp-hidden-field" name="sprava" id="carTdMessage"></textarea>

              <!-- AUTO info pre EmailJS template (pekne rozdelené sekcie) -->
<input type="hidden" name="auto_nazov" id="carTdAutoNazov">
<input type="hidden" name="auto_id" id="carTdAutoId">
<input type="hidden" name="auto_vybava" id="carTdAutoVybava">
<input type="hidden" name="auto_palivo" id="carTdAutoPalivo">
<input type="hidden" name="auto_prevodovka" id="carTdAutoPrevodovka">
<input type="hidden" name="auto_cena" id="carTdAutoCena">
<input type="hidden" name="auto_url" id="carTdAutoUrl">


        <!-- tlačidlo má rovnaký look ako car-btn-primary, lebo je v .car-cta -->
        <div class="car-cta car-td-actions car-td-span">
          <button class="btn car-btn car-btn-primary" id="carTdSubmit" type="submit">Odoslať žiadosť</button>
          <small id="carTdStatus" class="hint" aria-live="polite"></small>
        </div>
      </div>
    </form>

  </div>
</section>


      </div>
    `;

    // ===== Test drive: priprav dáta o aute + bind na tlačidlo =====
    initEmailJsOnce();

    const carIdForMail = String(car.__resolvedId || car.id || wantedId || '').trim();
    const carTitleForMail = `${car.rok || ''} ${(car.znacka || '').toUpperCase()} ${car.model || ''}`
      .replace(/\s+/g, ' ')
      .trim();

    const carPriceForMail =
      (car.nova_cena && String(car.nova_cena).trim()) ||
      (car.stara_cena && String(car.stara_cena).trim()) ||
      'Cena na vyžiadanie';

    const carUrlForMail = carIdForMail
      ? new URL(`/auta/${encodeURIComponent(carIdForMail)}`, location.origin).href
      : location.href;

    const ctx = {
      car_title: carTitleForMail || '—',
      car_id: carIdForMail || '—',
      car_vybava: (vybavaPaket || '').trim() || '—',
      car_palivo: (car.palivo || '').trim() || '—',
      car_prevodovka: (prevodovkaText || '').trim() || '—',
      car_cena: carPriceForMail,
      car_url: carUrlForMail
    };

    


// ==============================
// Testovacia jazda – na detaile auta (EmailJS SEND s templateParams)
// ==============================
const tdOpen = document.getElementById('openTestDrive');
const tdSection = document.getElementById('testdrive');
const tdForm = document.getElementById('carTestDriveForm');

const tdSlot = document.getElementById('carTdSlot');
const tdTimeRow = document.getElementById('carTdTimeRow');
const tdTime = document.getElementById('carTdTime');

const tdSubmitBtn = document.getElementById('carTdSubmit');
const tdStatus = document.getElementById('carTdStatus');

function getPriceText(c) {
  const n = (c?.nova_cena && String(c.nova_cena).trim() !== '') ? String(c.nova_cena).trim() : '';
  const s = (c?.stara_cena && String(c.stara_cena).trim() !== '') ? String(c.stara_cena).trim() : '';
  if (n) return n;
  if (s) return s;
  return 'Cena na vyžiadanie';
}

tdOpen?.addEventListener('click', (e) => {
  e.preventDefault();
  tdSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('carTdName')?.focus(), 350);
  history.replaceState(null, '', '#testdrive');
});

tdSlot?.addEventListener('change', () => {
  const wantsExact = tdSlot.value === 'Konkrétny čas';
  if (tdTimeRow) tdTimeRow.hidden = !wantsExact;
  if (!wantsExact && tdTime) tdTime.value = '';
});

tdForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!initEmailJsOnce()) {
    if (tdStatus) tdStatus.textContent = 'Chýba EmailJS script v auto.html.';
    return;
  }

  const fd = new FormData(tdForm);
  const payload = Object.fromEntries(fd.entries());

  // honeypot
  if (payload.website) {
    if (tdStatus) tdStatus.textContent = 'Ďakujeme! Žiadosť bola odoslaná.';
    tdForm.reset();
    if (tdTimeRow) tdTimeRow.hidden = true;
    return;
  }

  const slotText = (payload.cas_okno && String(payload.cas_okno).trim()) ? String(payload.cas_okno).trim() : 'Nezáleží';
  const timeText = slotText === 'Konkrétny čas'
    ? ((payload.cas && String(payload.cas).trim()) ? String(payload.cas).trim() : '—')
    : '—';

  const dateText = (payload.datum && String(payload.datum).trim())
    ? formatDateSK(String(payload.datum).trim())
    : '—';

  const noteText = (payload.poznamka && String(payload.poznamka).trim())
    ? String(payload.poznamka).trim()
    : '—';

  // !!! TOTO MUSI SEDIET na tvoje EmailJS template premenné ({{car_title}}, {{car_url}}, ...)
  const templateParams = {
    // Vozidlo
    car_title: title || '—',
    car_id: wantedId || '—',
    car_vybava: (vybavaPaket || '').trim() || '—',
    car_palivo: (car.palivo || '').trim() || '—',
    car_prevodovka: (prevodovkaText || '').trim() || '—',
    car_cena: getPriceText(car),
    car_url: location.href, // plná URL => tlačidlo v emaili bude klikateľné

    // Termín
    datum_text: dateText,
    slot_text: slotText,
    time_text: timeText,

    // Kontakt
    meno: (payload.meno && String(payload.meno).trim()) ? String(payload.meno).trim() : '—',
    email: (payload.email && String(payload.email).trim()) ? String(payload.email).trim() : '—',
    telefon: (payload.telefon && String(payload.telefon).trim()) ? String(payload.telefon).trim() : '—',
    poznamka: noteText
  };

  // UI
  if (tdSubmitBtn) tdSubmitBtn.disabled = true;
  const oldText = tdSubmitBtn?.textContent || '';
  if (tdSubmitBtn) tdSubmitBtn.textContent = 'Odosielam…';
  if (tdStatus) tdStatus.textContent = '';

  try {
    await window.emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_TESTDRIVE,
      templateParams
    );

    if (tdStatus) tdStatus.textContent = 'Ďakujeme! Termín vám potvrdíme telefonicky alebo e-mailom.';
    tdForm.reset();
    if (tdTimeRow) tdTimeRow.hidden = true;

  } catch (err) {
    console.error(err);
    if (tdStatus) tdStatus.textContent = 'Nepodarilo sa odoslať. Skúste neskôr alebo nám zavolajte.';
  } finally {
    if (tdSubmitBtn) tdSubmitBtn.disabled = false;
    if (tdSubmitBtn) tdSubmitBtn.textContent = oldText;
  }
});



    // Gallery logic + Lightbox
let idx = 0;
const mainImg = document.getElementById('mainImg');
const thumbs = document.getElementById('thumbs');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const lightbox = ensureLightbox();

function setIdx(next) {
  if (!images.length) return;
  idx = (next + images.length) % images.length;
  if (mainImg) mainImg.src = images[idx];

  if (thumbs) {
    thumbs.querySelectorAll('.thumb').forEach(t => t.classList.remove('is-active'));
    const active = thumbs.querySelector(`.thumb[data-idx="${idx}"]`);
    if (active) active.classList.add('is-active');
    try {
      active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } catch (e) {}
  }

  // ak je otvorený lightbox, meníme aj tam
  if (lightbox.isOpen()) {
    lightbox.img.src = images[idx];
  }
}

// klik na hlavnú fotku -> otvorí plné rozlíšenie
mainImg?.addEventListener('click', () => {
  if (!images.length) return;
  lightbox.open(images[idx], title);
});

// šípky (len ak je viac fotiek)
if (images.length > 1) {
  prevBtn?.addEventListener('click', () => setIdx(idx - 1));
  nextBtn?.addEventListener('click', () => setIdx(idx + 1));

  thumbs?.addEventListener('click', (e) => {
    const el = e.target?.closest?.('.thumb');
    if (!el) return;
    const i = parseInt(el.getAttribute('data-idx') || '', 10);
    if (!Number.isFinite(i)) return;
    setIdx(i);
  });
}

// klávesy: keď je otvorený lightbox -> ESC zavrie, šípky menia fotky
document.addEventListener('keydown', (e) => {
  if (lightbox.isOpen()) {
    if (e.key === 'Escape') lightbox.close();
    if (images.length > 1 && e.key === 'ArrowLeft') setIdx(idx - 1);
    if (images.length > 1 && e.key === 'ArrowRight') setIdx(idx + 1);
    return;
  }

  // bežné prepínanie (bez lightboxu)
  if (images.length > 1 && e.key === 'ArrowLeft') setIdx(idx - 1);
  if (images.length > 1 && e.key === 'ArrowRight') setIdx(idx + 1);
});

  }

  async function boot() {
    if (!wantedId) {
      renderNotFound('Chýba ID vozidla v adrese (napr. /auta/jeep-compass-2021).');
      return;
    }

    try {
      const r = await fetch('/api/cars', { cache: 'no-store' });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        renderNotFound(`Nepodarilo sa načítať ponuku áut (${r.status}). ${t ? 'Pozri konzolu.' : ''}`);
        return;
      }

      const cars = await r.json();

      const list = Array.isArray(cars) ? cars : [];
      const baseCounts = new Map();
      const usedIds = new Set(
        list
          .map(c => (c && c.id ? String(c.id).trim() : ''))
          .filter(Boolean)
      );

      const enriched = list.map(c => {
        const resolved = resolveCarId(c, baseCounts, usedIds);
        return { ...c, __resolvedId: resolved };
      });

      const found = enriched.find(c => String(c.__resolvedId) === wantedId);
      if (!found || found.skryte === true) {
        renderNotFound('Toto auto už nie je v ponuke alebo je skryté.');
        return;
      }

      render(found);
    } catch (e) {
      console.error(e);
      renderNotFound('Nastala chyba pri načítaní detailu auta.');
    }
  }

  boot();
})();
