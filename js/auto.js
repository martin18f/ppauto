// ==============================
// Detail auta (auto.html)
// - načíta auto podľa ?id=... z /api/cars
// - zobrazí galériu + údaje + výbavu
// ==============================

(function () {
  const mount = document.getElementById('carDetail');
  const qs = new URLSearchParams(location.search);
  const wantedId = (qs.get('id') || '').trim();

  if (!mount) return;

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
    if (make === 'subaru' || make === 'kgm' || make === 'jeep') {
      document.documentElement.setAttribute('data-brand', make);
      try {
        localStorage.setItem('ppauto.brand', make);
      } catch (e) {
        try { sessionStorage.setItem('ppauto.brand', make); } catch (e2) {}
      }
    }
  }

  function renderNotFound(message) {
    mount.innerHTML = `
      <div class="car-card not-found">
        <h2>Auto sa nenašlo</h2>
        <p>${message || 'Skontroluj odkaz alebo sa vráť späť na ponuku.'}</p>
        <div class="car-cta">
          <a class="btn primary" href="index.html#ponuka">Späť na ponuku</a>
          <a class="btn" href="index.html#kontakt">Kontakt</a>
        </div>
      </div>
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

let images = gallery.filter(Boolean);

const cover = String(car.titulka || car.obrazok || '').trim();
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
const prevodovkaRaw = (car.prevodovka || '').trim();

let prevodovkaOnly = prevodovkaRaw; // napr. "AT"


if (prevodovkaRaw) {
  const parts = prevodovkaRaw
    .split(/•|·|\|/g)               // podporí "•" aj iné oddeľovače
    .map(p => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    prevodovkaOnly = parts[0];
    vybavaBalik = parts.slice(1).join(' • ');
  }
}

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
  <a class="btn car-btn" href="mailto:predaj@ppauto.sk">Napísať predaju</a>
  <a class="btn car-btn" href="index.html#kontakt">Navigovať / Kontakt</a>
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
      </div>
    `;

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
      renderNotFound('Chýba parameter id (napr. auto.html?id=jeep-compass-2021).');
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
