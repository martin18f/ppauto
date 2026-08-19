// PP AUTO admin – Cenníky / Výbavy
(function () {
  'use strict';

  const MAX_PDF_BYTES = 3 * 1024 * 1024;
  const BRAND_ORDER = ['Subaru', 'KGM', 'Jeep', 'Chery'];

  let documents = [];
  let parameterOptions = { fields: { znacka: [] }, models: {} };
  let editingId = '';
  let busy = false;

  function api(path) {
    return typeof window.apiUrl === 'function' ? window.apiUrl(path) : path;
  }

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

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    if (value >= 1024) return `${Math.round(value / 1024)} KB`;
    return `${value} B`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat('sk-SK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function typeLabel(type) {
    return type === 'vybava' ? 'Výbava' : 'Cenník';
  }

  function ensureStyles() {
    if (document.querySelector('link[data-admin-documents-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/admin-documents.css';
    link.dataset.adminDocumentsStyle = '1';
    document.head.appendChild(link);
  }

  function hideLegacyEquipmentEditor() {
    const form = document.getElementById('carForm');
    if (!form) return;

    const nodes = [
      form.querySelector('.vybava-brand-switch'),
      form.querySelector('.vybava-grid'),
      document.getElementById('vybavaSelectAll')?.closest('label'),
    ].filter(Boolean);

    const directLabel = Array.from(form.children).find(node =>
      node.tagName === 'LABEL' && clean(node.textContent) === 'Výbava'
    );
    if (directLabel) nodes.push(directLabel);

    nodes.forEach(node => {
      node.hidden = true;
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    });
  }

  function buildUi() {
    if (document.getElementById('documentsAdminSection')) return;

    const wrap = document.querySelector('.wrap');
    if (!wrap) return;

    const section = document.createElement('section');
    section.id = 'documentsAdminSection';
    section.className = 'documents-admin';
    section.innerHTML = `
      <div class="documents-admin__head">
        <div>
          <h2>Cenníky / Výbavy</h2>
          <p>PDF dokumenty priradené ku značke alebo konkrétnemu modelu.</p>
        </div>
        <span class="documents-admin__limit">PDF · max. 3 MB</span>
      </div>

      <div class="documents-admin__editor" id="documentsEditor">
        <div class="documents-admin__editor-head">
          <div>
            <strong id="documentsEditorTitle">Pridať dokument</strong>
            <span id="documentsEditorSubtitle">Po vybraní PDF sa súbor nahrá automaticky.</span>
          </div>
          <button class="documents-admin__cancel" id="documentsCancelEdit" type="button" hidden>Zrušiť úpravu</button>
        </div>

        <div class="documents-admin__fields">
          <label>
            <span>Značka</span>
            <select id="documentBrand"></select>
          </label>
          <label>
            <span>Model</span>
            <select id="documentModel"></select>
          </label>
          <label>
            <span>Typ</span>
            <select id="documentType">
              <option value="cennik">Cenník</option>
              <option value="vybava">Výbava</option>
            </select>
          </label>
          <label>
            <span>Názov na webe</span>
            <input id="documentTitle" type="text" maxlength="120" placeholder="Predvolene názov PDF súboru">
          </label>
        </div>

        <label class="documents-admin__drop" id="documentDrop">
          <input id="documentFile" type="file" accept="application/pdf,.pdf">
          <span class="documents-admin__drop-icon">PDF</span>
          <span class="documents-admin__drop-copy">
            <strong id="documentDropTitle">Vyber PDF súbor</strong>
            <small id="documentDropHint">Maximálna veľkosť 3 MB · upload začne automaticky</small>
          </span>
        </label>

        <div class="documents-admin__edit-actions" id="documentsEditActions" hidden>
          <button class="btnx primary" id="documentsSaveMeta" type="button">Uložiť zmeny</button>
          <span>Zmenu PDF spravíš jednoduchým výberom nového súboru vyššie.</span>
        </div>

        <div class="documents-admin__status" id="documentsStatus" role="status" aria-live="polite"></div>
      </div>

      <div class="documents-admin__table-wrap">
        <table class="documents-admin__table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Model</th>
              <th>Súbor</th>
              <th>Veľkosť</th>
              <th>Upravené</th>
              <th>Akcie</th>
            </tr>
          </thead>
          <tbody id="documentsTableBody"></tbody>
        </table>
      </div>
    `;

    wrap.insertAdjacentElement('afterend', section);
  }

  function refs() {
    return {
      section: document.getElementById('documentsAdminSection'),
      editor: document.getElementById('documentsEditor'),
      editorTitle: document.getElementById('documentsEditorTitle'),
      editorSubtitle: document.getElementById('documentsEditorSubtitle'),
      cancelEdit: document.getElementById('documentsCancelEdit'),
      brand: document.getElementById('documentBrand'),
      model: document.getElementById('documentModel'),
      type: document.getElementById('documentType'),
      title: document.getElementById('documentTitle'),
      file: document.getElementById('documentFile'),
      drop: document.getElementById('documentDrop'),
      dropTitle: document.getElementById('documentDropTitle'),
      dropHint: document.getElementById('documentDropHint'),
      editActions: document.getElementById('documentsEditActions'),
      saveMeta: document.getElementById('documentsSaveMeta'),
      status: document.getElementById('documentsStatus'),
      tbody: document.getElementById('documentsTableBody'),
    };
  }

  function setStatus(message, kind = '') {
    const { status } = refs();
    if (!status) return;
    status.textContent = message || '';
    status.dataset.kind = kind;
  }

  function setBusy(next, message = '') {
    busy = !!next;
    const r = refs();
    r.editor?.classList.toggle('is-busy', busy);
    [r.brand, r.model, r.type, r.title, r.file, r.saveMeta, r.cancelEdit].forEach(element => {
      if (element) element.disabled = busy;
    });
    if (message) setStatus(message, 'working');
  }

  function getBrands() {
    const configured = Array.isArray(parameterOptions?.fields?.znacka)
      ? parameterOptions.fields.znacka.map(clean).filter(Boolean)
      : [];
    const fromDocuments = documents.map(doc => clean(doc.brand)).filter(Boolean);
    const all = [...BRAND_ORDER, ...configured, ...fromDocuments];
    return all.filter((brand, index) => all.findIndex(item => eq(item, brand)) === index);
  }

  function modelValuesForBrand(brand) {
    const models = parameterOptions?.models || {};
    const key = Object.keys(models).find(item => eq(item, brand));
    return key && Array.isArray(models[key]) ? models[key].map(clean).filter(Boolean) : [];
  }

  function renderBrandOptions(selected = '') {
    const { brand } = refs();
    if (!brand) return;
    const brands = getBrands();
    brand.innerHTML = [
      '<option value="">Vyber značku</option>',
      ...brands.map(item => `<option value="${esc(item)}">${esc(item)}</option>`),
    ].join('');
    brand.value = brands.find(item => eq(item, selected)) || '';
  }

  function renderModelOptions(selected = '') {
    const { brand, model } = refs();
    if (!model) return;
    const models = modelValuesForBrand(brand?.value || '');
    model.innerHTML = [
      '<option value="">Všetky modely značky</option>',
      ...models.map(item => `<option value="${esc(item)}">${esc(item)}</option>`),
    ].join('');
    model.value = models.find(item => eq(item, selected)) || '';
  }

  async function request(path, options = {}) {
    const response = await fetch(api(path), {
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Požiadavka zlyhala (${response.status}).`);
    return payload;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('PDF sa nepodarilo načítať.'));
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.readAsDataURL(file);
    });
  }

  function validatePdf(file) {
    if (!file) throw new Error('Vyber PDF súbor.');
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      throw new Error('Podporovaný je iba PDF formát.');
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(`PDF má ${formatBytes(file.size)}. Maximálna veľkosť je 3 MB.`);
    }
  }

  function currentDocument() {
    return documents.find(doc => doc.id === editingId) || null;
  }

  function resetEditor() {
    editingId = '';
    const r = refs();
    r.editorTitle.textContent = 'Pridať dokument';
    r.editorSubtitle.textContent = 'Po vybraní PDF sa súbor nahrá automaticky.';
    r.cancelEdit.hidden = true;
    r.editActions.hidden = true;
    r.type.value = 'cennik';
    r.title.value = '';
    r.file.value = '';
    r.dropTitle.textContent = 'Vyber PDF súbor';
    r.dropHint.textContent = 'Maximálna veľkosť 3 MB · upload začne automaticky';
    renderBrandOptions('');
    renderModelOptions('');
    setStatus('');
  }

  function beginEdit(id) {
    const doc = documents.find(item => item.id === id);
    if (!doc) return;
    editingId = id;
    const r = refs();
    r.editorTitle.textContent = 'Upraviť dokument';
    r.editorSubtitle.textContent = doc.filename;
    r.cancelEdit.hidden = false;
    r.editActions.hidden = false;
    renderBrandOptions(doc.brand);
    renderModelOptions(doc.model);
    r.type.value = doc.type === 'vybava' ? 'vybava' : 'cennik';
    r.title.value = doc.title || '';
    r.file.value = '';
    r.dropTitle.textContent = 'Nahradiť PDF súbor';
    r.dropHint.textContent = `${doc.filename} · ${formatBytes(doc.size)} · nový súbor sa nahrá automaticky`;
    setStatus('');
    r.section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function uploadNew(file) {
    const r = refs();
    const brand = clean(r.brand.value);
    if (!brand) throw new Error('Pred výberom PDF zvoľ značku.');

    validatePdf(file);
    setBusy(true, `Nahrávam ${file.name}…`);

    try {
      const contentBase64 = await fileToBase64(file);
      const uploaded = await request('/api/upload-pdf', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentBase64 }),
      });

      const created = await request('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          brand,
          model: clean(r.model.value),
          type: r.type.value,
          title: clean(r.title.value) || file.name,
          filename: file.name,
          path: uploaded.path,
          size: uploaded.size,
        }),
      });

      documents = Array.isArray(created.documents) ? created.documents : documents;
      renderTable();
      resetEditor();
      setStatus(`PDF „${file.name}“ bolo nahrané.`, 'success');
    } finally {
      setBusy(false);
      r.file.value = '';
    }
  }

  async function replaceFile(file) {
    const doc = currentDocument();
    if (!doc) return;
    validatePdf(file);
    setBusy(true, `Nahrádzam ${doc.filename}…`);

    try {
      const contentBase64 = await fileToBase64(file);
      const uploaded = await request('/api/upload-pdf', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          contentBase64,
          replacePath: doc.path,
        }),
      });

      const shouldRenameTitle = !clean(refs().title.value) || eq(clean(refs().title.value), doc.filename);
      const updated = await request('/api/documents', {
        method: 'PUT',
        body: JSON.stringify({
          id: doc.id,
          filename: file.name,
          size: uploaded.size,
          title: shouldRenameTitle ? file.name : clean(refs().title.value),
        }),
      });

      documents = Array.isArray(updated.documents) ? updated.documents : documents;
      beginEdit(doc.id);
      renderTable();
      setStatus(`PDF bolo nahradené súborom „${file.name}“.`, 'success');
    } finally {
      setBusy(false);
      refs().file.value = '';
    }
  }

  async function saveMetadata() {
    if (busy) return;
    const doc = currentDocument();
    if (!doc) return;
    const r = refs();
    const brand = clean(r.brand.value);
    if (!brand) return setStatus('Vyber značku.', 'error');

    setBusy(true, 'Ukladám zmeny…');
    try {
      const payload = await request('/api/documents', {
        method: 'PUT',
        body: JSON.stringify({
          id: doc.id,
          brand,
          model: clean(r.model.value),
          type: r.type.value,
          title: clean(r.title.value) || doc.filename,
        }),
      });
      documents = Array.isArray(payload.documents) ? payload.documents : documents;
      renderTable();
      beginEdit(doc.id);
      setStatus('Zmeny boli uložené.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(id) {
    if (busy) return;
    const doc = documents.find(item => item.id === id);
    if (!doc) return;

    const previous = [...documents];
    documents = documents.filter(item => item.id !== id);
    renderTable();
    if (editingId === id) resetEditor();
    setStatus(`Mažem „${doc.filename}“…`, 'working');

    try {
      const payload = await request(`/api/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      documents = Array.isArray(payload.documents) ? payload.documents : documents;
      renderTable();
      setStatus(`PDF „${doc.filename}“ bolo zmazané.`, 'success');
    } catch (error) {
      documents = previous;
      renderTable();
      setStatus(error.message, 'error');
    }
  }

  function sortedDocuments() {
    const brandIndex = brand => {
      const idx = BRAND_ORDER.findIndex(item => eq(item, brand));
      return idx === -1 ? 999 : idx;
    };
    return [...documents].sort((a, b) =>
      brandIndex(a.brand) - brandIndex(b.brand) ||
      clean(a.brand).localeCompare(clean(b.brand), 'sk') ||
      clean(a.model).localeCompare(clean(b.model), 'sk') ||
      clean(a.type).localeCompare(clean(b.type), 'sk') ||
      clean(a.filename).localeCompare(clean(b.filename), 'sk')
    );
  }

  function renderTable() {
    const { tbody } = refs();
    if (!tbody) return;
    const list = sortedDocuments();
    if (!list.length) {
      tbody.innerHTML = `
        <tr class="documents-admin__empty">
          <td colspan="6">Zatiaľ nie je nahraný žiadny PDF dokument.</td>
        </tr>
      `;
      return;
    }

    let lastBrand = '';
    const rows = [];
    list.forEach(doc => {
      if (!eq(lastBrand, doc.brand)) {
        lastBrand = doc.brand;
        rows.push(`
          <tr class="documents-admin__brand-row">
            <td colspan="6"><span>${esc(doc.brand)}</span></td>
          </tr>
        `);
      }
      rows.push(`
        <tr data-document-id="${esc(doc.id)}">
          <td><span class="documents-admin__type documents-admin__type--${esc(doc.type)}">${esc(typeLabel(doc.type))}</span></td>
          <td>${doc.model ? esc(doc.model) : '<span class="documents-admin__all-models">Všetky modely</span>'}</td>
          <td>
            <a class="documents-admin__file" href="/api/document-file?id=${encodeURIComponent(doc.id)}">
              <span class="documents-admin__pdf-icon">PDF</span>
              <span>
                <strong>${esc(doc.title || doc.filename)}</strong>
                <small>${esc(doc.filename)}</small>
              </span>
            </a>
          </td>
          <td>${esc(formatBytes(doc.size))}</td>
          <td>${esc(formatDate(doc.updatedAt || doc.createdAt))}</td>
          <td>
            <div class="documents-admin__actions">
              <a class="btnx" href="/api/document-file?id=${encodeURIComponent(doc.id)}">Stiahnuť</a>
              <button class="btnx" type="button" data-document-action="edit" data-id="${esc(doc.id)}">Upraviť</button>
              <button class="btnx danger" type="button" data-document-action="delete" data-id="${esc(doc.id)}">Zmazať</button>
            </div>
          </td>
        </tr>
      `);
    });
    tbody.innerHTML = rows.join('');
  }

  async function loadData() {
    try {
      const [docs, options] = await Promise.all([
        request('/api/documents'),
        request('/api/options'),
      ]);
      documents = Array.isArray(docs) ? docs : [];
      parameterOptions = options && typeof options === 'object'
        ? options
        : { fields: { znacka: [] }, models: {} };
      renderBrandOptions('');
      renderModelOptions('');
      renderTable();
    } catch (error) {
      console.error(error);
      setStatus(`Dokumenty sa nepodarilo načítať: ${error.message}`, 'error');
    }
  }

  function bind() {
    const r = refs();

    r.brand?.addEventListener('change', () => renderModelOptions(''));
    r.file?.addEventListener('change', async () => {
      const file = r.file.files?.[0];
      if (!file) return;
      try {
        if (editingId) await replaceFile(file);
        else await uploadNew(file);
      } catch (error) {
        console.error(error);
        setStatus(error.message || 'Upload PDF zlyhal.', 'error');
        setBusy(false);
        r.file.value = '';
      }
    });

    r.saveMeta?.addEventListener('click', saveMetadata);
    r.cancelEdit?.addEventListener('click', resetEditor);

    r.tbody?.addEventListener('click', event => {
      const button = event.target.closest('button[data-document-action]');
      if (!button) return;
      const id = clean(button.dataset.id);
      if (button.dataset.documentAction === 'edit') beginEdit(id);
      if (button.dataset.documentAction === 'delete') deleteDocument(id);
    });
  }

  ensureStyles();
  hideLegacyEquipmentEditor();
  buildUi();
  bind();
  resetEditor();
  loadData();
})();
