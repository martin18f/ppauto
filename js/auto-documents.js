// PP AUTO detail vozidla – PDF dokumenty pod technickými údajmi
(function () {
  'use strict';

  const mount = document.getElementById('carDetail');
  if (!mount) return;

  let documentsPromise = null;
  let scheduled = false;

  function clean(value) {
    return String(value ?? '').trim();
  }

  function eq(a, b) {
    return clean(a).localeCompare(clean(b), 'sk', { sensitivity: 'accent' }) === 0;
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function ensureStyles() {
    if (document.querySelector('link[data-auto-documents-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/auto-documents.css';
    link.dataset.autoDocumentsStyle = '1';
    document.head.appendChild(link);
  }

  function sectionByTitle(title) {
    return Array.from(mount.querySelectorAll('.car-sections > section')).find(section =>
      clean(section.querySelector('.section-title h3')?.textContent) === title
    ) || null;
  }

  function removeLegacyEquipmentSection() {
    const section = sectionByTitle('Výbava');
    if (section) section.remove();
  }

  function getBasicValue(label) {
    const basic = sectionByTitle('Základné údaje');
    if (!basic) return '';
    const row = Array.from(basic.querySelectorAll('.kv .row')).find(item =>
      clean(item.querySelector('.label')?.textContent) === label
    );
    return clean(row?.querySelector('.value')?.textContent);
  }

  function loadDocuments() {
    if (!documentsPromise) {
      documentsPromise = fetch('/api/documents', { cache: 'no-store' })
        .then(async response => {
          if (!response.ok) throw new Error(`Documents API ${response.status}`);
          const payload = await response.json().catch(() => []);
          return Array.isArray(payload) ? payload : [];
        })
        .catch(error => {
          console.error('Nepodarilo sa načítať dokumenty vozidla', error);
          return [];
        });
    }
    return documentsPromise;
  }

  function typeLabel(type) {
    return type === 'vybava' ? 'Výbava' : 'Cenník';
  }

  function matchingDocuments(all, brand, model) {
    return all
      .filter(doc => eq(doc?.brand, brand))
      .filter(doc => !clean(doc?.model) || eq(doc?.model, model))
      .sort((a, b) => {
        const aExact = clean(a.model) && eq(a.model, model) ? 0 : 1;
        const bExact = clean(b.model) && eq(b.model, model) ? 0 : 1;
        return aExact - bExact || clean(a.type).localeCompare(clean(b.type), 'sk') || clean(a.title || a.filename).localeCompare(clean(b.title || b.filename), 'sk');
      });
  }

  function renderStrip(documents, technicalSection) {
    mount.querySelector('.car-documents-strip')?.remove();
    if (!documents.length || !technicalSection) return;

    const strip = document.createElement('section');
    strip.className = 'car-documents-strip';
    strip.setAttribute('aria-label', 'Dokumenty k vozidlu');
    strip.innerHTML = `
      <div class="car-documents-strip__label">
        <span>Dokumenty</span>
      </div>
      <div class="car-documents-strip__items">
        ${documents.map(doc => `
          <a class="car-document-link" href="/api/document-file?id=${encodeURIComponent(doc.id)}">
            <span class="car-document-link__icon">PDF</span>
            <span class="car-document-link__copy">
              <strong>${esc(doc.title || doc.filename)}</strong>
              <small>${esc(typeLabel(doc.type))}${doc.model ? ` · ${esc(doc.model)}` : ''}</small>
            </span>
            <span class="car-document-link__download" aria-hidden="true">↓</span>
          </a>
        `).join('')}
      </div>
    `;

    technicalSection.insertAdjacentElement('afterend', strip);
  }

  async function enhance() {
    scheduled = false;
    removeLegacyEquipmentSection();

    const technical = sectionByTitle('Technické údaje');
    if (!technical) return;

    const brand = getBasicValue('Značka');
    const model = getBasicValue('Model');
    if (!brand || !model) return;

    const all = await loadDocuments();
    removeLegacyEquipmentSection();
    renderStrip(matchingDocuments(all, brand, model), sectionByTitle('Technické údaje'));
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(enhance);
  }

  ensureStyles();
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(mount, { childList: true, subtree: true });
  scheduleEnhance();
})();
