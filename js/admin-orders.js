(function () {
  'use strict';

  const root = document.getElementById('adminOrders');
  if (!root) return;

  const API_BASE = location.protocol === 'file:' ? 'https://ppauto.sk' : location.origin;
  const apiUrlLocal = path => `${API_BASE}${path}`;

  const STATUS_LABELS = {
    new: 'Nová',
    contacted: 'Kontaktovaný',
    reserved: 'Rezervované',
    in_progress: 'V riešení',
    ordered: 'Objednané',
    closed: 'Vybavené',
    cancelled: 'Zrušené',
  };

  const SOURCE_LABELS = {
    stock: 'Skladovka',
    custom: 'Mimo skladu',
  };

  const els = {
    search: document.getElementById('ordersSearch'),
    status: document.getElementById('ordersStatusFilter'),
    source: document.getElementById('ordersSourceFilter'),
    showArchived: document.getElementById('ordersShowArchived'),
    table: document.getElementById('ordersTable'),
    tbody: document.querySelector('#ordersTable tbody'),
    detail: document.getElementById('orderDetail'),
    live: document.getElementById('ordersStatus'),
  };

  let orders = [];
  let selectedId = '';
  let mutationBusy = false;
  let loadGeneration = 0;

  function clean(value) {
    return String(value ?? '').trim();
  }

  function esc(value) {
    return clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('sk-SK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function formatOrderNumber(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? `#${number}` : '-';
  }

  function arrayText(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);
    return clean(value).split(/\s*\+\s*|\s*,\s*/g).map(clean).filter(Boolean);
  }

  function vehicleTitle(order) {
    const vehicle = order?.vehicle || {};
    return `${clean(vehicle.znacka)} ${clean(vehicle.model)}`.replace(/\s+/g, ' ').trim() || 'Bez vozidla';
  }

  function sourceLabel(source) {
    return SOURCE_LABELS[clean(source)] || 'Neznáme';
  }

  function statusLabel(status) {
    return STATUS_LABELS[clean(status)] || 'Nová';
  }

  function selectedOrder() {
    return orders.find(order => clean(order?.id) === selectedId) || null;
  }

  function archivedViewActive() {
    return !!els.showArchived?.checked;
  }

  function belongsToArchiveView(order, archivedView = archivedViewActive()) {
    return archivedView ? order?.archived === true : order?.archived !== true;
  }

  function applyOrders(data, preferredId = selectedId) {
    orders = Array.isArray(data) ? data : [];
    const preferred = clean(preferredId);
    selectedId = orders.some(order => clean(order?.id) === preferred)
      ? preferred
      : clean(orders[0]?.id);
    renderTable();
  }

  function showOrderProgress(total, text) {
    if (typeof window.showProgress !== 'function') return false;
    window.showProgress(total, text);
    return true;
  }

  function setOrderProgress(done, text) {
    if (typeof window.setProgress === 'function') window.setProgress(done, text);
  }

  function hideOrderProgress() {
    if (typeof window.hideProgress === 'function') window.hideProgress();
  }

  function setLive(message) {
    if (!els.live) return;
    els.live.textContent = '';
    requestAnimationFrame(() => {
      els.live.textContent = message || '';
    });
  }

  let saveToastTimer = 0;
  function showSaveToast(message = 'Zmeny uložené') {
    let toast = document.getElementById('orderSaveToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'orderSaveToast';
      toast.className = 'order-save-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      root.appendChild(toast);
    }
    window.clearTimeout(saveToastTimer);
    toast.textContent = message;
    toast.classList.remove('is-visible');
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
    saveToastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  async function requestOrders(path, options) {
    const response = await fetch(apiUrlLocal(path), {
      cache: 'no-store',
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Požiadavka zlyhala (${response.status})`);
    return payload;
  }

  function filteredOrders() {
    const q = clean(els.search?.value).toLowerCase();
    const status = clean(els.status?.value);
    const source = clean(els.source?.value);

    return orders
      .map((order, index) => ({ order, index }))
      .filter(({ order }) => {
        if (status && clean(order?.status) !== status) return false;
        if (source && clean(order?.source) !== source) return false;
        if (!q) return true;

        const customer = order?.customer || {};
        const vehicle = order?.vehicle || {};
        const prefs = order?.preferences || {};
        const haystack = [
          order?.id,
          order?.orderNumber,
          formatOrderNumber(order?.orderNumber),
          order?.source,
          order?.status,
          customer.name,
          customer.email,
          customer.phone,
          customer.company,
          vehicle.znacka,
          vehicle.model,
          vehicle.rok,
          vehicle.palivo,
          vehicle.farba,
          vehicle.vybava_paket,
          prefs.note,
          prefs.extraEquipmentNote,
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
  }

  function renderTable() {
    if (!els.tbody) return;
    const rows = filteredOrders();

    if (!rows.length) {
      selectedId = '';
      els.tbody.innerHTML = '<tr><td colspan="8">Zatiaľ tu nie sú žiadne objednávky.</td></tr>';
      renderDetail();
      return;
    }

    if (!rows.some(({ order }) => clean(order?.id) === selectedId)) {
      selectedId = clean(rows[0].order?.id);
    }

    els.tbody.innerHTML = rows.map(({ order, index }) => {
      const id = clean(order?.id);
      const customer = order?.customer || {};
      const source = clean(order?.source) || 'custom';
      const archived = !!order?.archived;
      const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => (
        `<option value="${esc(value)}"${clean(order?.status) === value ? ' selected' : ''}>${esc(label)}</option>`
      )).join('');

      return `
        <tr data-order-id="${esc(id)}"${id === selectedId ? ' class="is-selected"' : ''}>
          <td>${esc(formatOrderNumber(order?.orderNumber))}</td>
          <td>
            <div class="order-cell-main">${esc(formatDate(order?.createdAt))}</div>
          </td>
          <td>
            <div class="order-cell-main">${esc(customer.name || '-')}</div>
          </td>
          <td><span class="order-source-pill order-source-pill--${esc(source)}">${esc(sourceLabel(source))}</span></td>
          <td>
            <div class="order-cell-main">${esc(vehicleTitle(order))}</div>
          </td>
          <td>
            <select class="order-status-select" data-order-status="${esc(id)}">${statusOptions}</select>
          </td>
          <td>${archived ? '<span class="pill-mini">Archivované</span>' : '<span class="pill-mini">Aktívne</span>'}</td>
          <td class="cell-actions">
            <button class="btnx" type="button" data-order-detail="${esc(id)}">Detail</button>
            <button class="btnx" type="button" data-order-archive="${esc(id)}">${archived ? 'Obnoviť' : 'Archivovať'}</button>
            <button class="btnx danger" type="button" data-order-delete="${esc(id)}">Zmazať</button>
          </td>
        </tr>
      `;
    }).join('');

    renderDetail();
  }

  function detailItem(label, value) {
    return `
      <div class="order-detail-item">
        <strong>${esc(label)}</strong>
        <span>${esc(value || '-')}</span>
      </div>
    `;
  }

  function detailBlock(title, html) {
    return `
      <div class="order-detail-block">
        <h4>${esc(title)}</h4>
        ${html}
      </div>
    `;
  }

  function renderDetail() {
    if (!els.detail) return;
    const order = selectedOrder();
    if (!order) {
      els.detail.innerHTML = `
        <h3>Detail objednávky</h3>
        <p class="order-detail-empty">Vyberte objednávku v tabuľke.</p>
      `;
      return;
    }

    const customer = order.customer || {};
    const vehicle = order.vehicle || {};
    const prefs = order.preferences || {};
    const legacyEquipment = arrayText(vehicle.vybava);
    const packages = arrayText(vehicle.vybava_paket);
    const history = Array.isArray(order.history) ? order.history : [];

    const legacyEquipmentHtml = legacyEquipment.length
      ? `<div class="order-detail-list">${legacyEquipment.map(item => `<span>${esc(item)}</span>`).join('')}</div>`
      : '';

    const historyHtml = history.length
      ? `<div class="order-detail-list">${history.map(item => `<span>${esc(statusLabel(item.status))} · ${esc(formatDate(item.at))}</span>`).join('')}</div>`
      : '<div class="order-detail-text">-</div>';

    els.detail.innerHTML = `
      <h3>${esc(formatOrderNumber(order.orderNumber))} · ${esc(vehicleTitle(order))}</h3>
      <div class="order-detail-list">
        <span>${esc(sourceLabel(order.source))}</span>
        <span>${esc(statusLabel(order.status))}</span>
        ${order.archived ? '<span>Archivované</span>' : '<span>Aktívne</span>'}
      </div>

      ${detailBlock('Zákazník', `
        <div class="order-detail-grid">
          ${detailItem('Meno', customer.name)}
          ${detailItem('Firma', customer.company)}
          ${detailItem('Telefón', customer.phone)}
          ${detailItem('E-mail', customer.email)}
          ${detailItem('Preferovaný kontakt', customer.preferredContact)}
          ${detailItem('Vytvorené', formatDate(order.createdAt))}
        </div>
      `)}

      ${detailBlock('Vozidlo', `
        <div class="order-detail-grid">
          ${detailItem('Typ objednávky', sourceLabel(order.source))}
          ${clean(order.source) === 'stock' ? detailItem('Skladové ID', vehicle.stockCarId) : ''}
          ${detailItem('Značka', vehicle.znacka)}
          ${detailItem('Model', vehicle.model)}
          ${detailItem('Rok', vehicle.rok)}
          ${detailItem('Palivo', vehicle.palivo)}
          ${detailItem('Prevodovka', vehicle.typ_prevodovky || vehicle.prevodovka)}
          ${detailItem('Výbava / paket', packages.join(' + '))}
          ${detailItem('Objem', vehicle.objem ? `${vehicle.objem} cm³` : '')}
          ${detailItem('Výkon', vehicle.vykon ? `${vehicle.vykon} kW` : '')}
          ${detailItem('Karoséria', vehicle.karoseria)}
          ${detailItem('Farba', vehicle.farba)}
          ${detailItem('Pohon', vehicle.pohon)}
          ${clean(order.source) === 'stock' ? detailItem('Najazdené', vehicle.najazdene !== null && vehicle.najazdene !== undefined && vehicle.najazdene !== '' ? `${vehicle.najazdene} km` : '') : ''}
          ${detailItem('Metalíza', vehicle.metaliza ? 'Áno' : 'Nie')}
          ${clean(order.source) === 'stock' ? detailItem('Cena', vehicle.nova_cena || vehicle.stara_cena) : ''}
        </div>
      `)}

      ${clean(order.source) === 'custom' && legacyEquipmentHtml
        ? detailBlock('Doplnková výbava (staršia objednávka)', legacyEquipmentHtml)
        : ''}

      ${detailBlock('Preferencie', `
        <div class="order-detail-grid">
          ${detailItem('Termín', prefs.deliveryTime)}
          ${detailItem('Financovanie', prefs.financing)}
          ${detailItem('Protiúčet', prefs.tradeIn)}
        </div>
        <div class="order-detail-block">
          <h4>Ďalšia výbava</h4>
          <div class="order-detail-text">${esc(prefs.extraEquipmentNote || '-')}</div>
        </div>
        <div class="order-detail-block">
          <h4>Poznámka zákazníka</h4>
          <div class="order-detail-text">${esc(prefs.note || '-')}</div>
        </div>
      `)}

      ${detailBlock('Interné', `
        <div class="order-note-editor">
          <label>Pridelené zamestnancovi</label>
          <input id="orderAssignedTo" type="text" value="${esc(order.assignedTo || '')}">
          <label>Interná poznámka</label>
          <textarea id="orderEmployeeNote">${esc(order.employeeNote || '')}</textarea>
          <div class="order-detail-actions">
            <button class="btnx primary" type="button" data-order-save-note="${esc(order.id)}">Uložiť interné údaje</button>
          </div>
        </div>
      `)}

      ${detailBlock('História', historyHtml)}
    `;
  }

  async function loadOrders(preferredId = selectedId) {
    const generation = ++loadGeneration;
    const archivedView = archivedViewActive();
    setLive('Načítavam objednávky...');

    try {
      const query = archivedView ? '?archived_only=1' : '';
      const data = await requestOrders(`/api/orders${query}`);
      if (generation !== loadGeneration) return false;

      const visible = (Array.isArray(data) ? data : [])
        .filter(order => belongsToArchiveView(order, archivedView));
      applyOrders(visible, preferredId);
      setLive(`Načítané objednávky: ${visible.length}`);
      return true;
    } catch (error) {
      if (generation !== loadGeneration) return false;
      console.error(error);
      setLive(error?.message || 'Nepodarilo sa načítať objednávky.');
      return false;
    }
  }

  async function updateOrder(id, patch, options = {}) {
    if (!id) return false;
    if (mutationBusy) {
      setLive('Počkajte na dokončenie prebiehajúcej zmeny.');
      renderTable();
      return false;
    }
    mutationBusy = true;

    const progressText = clean(options.progressText);
    const successText = clean(options.successText) || 'Zmeny uložené';
    const withProgress = progressText ? showOrderProgress(2, progressText) : false;
    const previousSelectedId = selectedId;
    setLive('Ukladám objednávku...');

    try {
      const payload = await requestOrders(`/api/orders?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });

      const updatedOrder = payload?.order || null;
      const idx = orders.findIndex(order => clean(order?.id) === id);
      if (updatedOrder && idx >= 0) orders[idx] = updatedOrder;

      const archivedView = archivedViewActive();
      const localVisible = orders.filter(order => belongsToArchiveView(order, archivedView));
      let preferredId = previousSelectedId;
      if (previousSelectedId === id && (!updatedOrder || !belongsToArchiveView(updatedOrder, archivedView))) {
        preferredId = '';
      }
      applyOrders(localVisible, preferredId);

      if (withProgress) setOrderProgress(1, 'Aktualizujem zoznam...');
      const refreshed = await loadOrders(preferredId);
      if (withProgress) setOrderProgress(2, refreshed ? 'Hotovo' : 'Uložené');

      setLive(refreshed
        ? successText
        : `${successText}. Automatické obnovenie zoznamu zlyhalo.`);
      showSaveToast(successText);
      return true;
    } catch (error) {
      console.error(error);
      setLive(error?.message || 'Uloženie objednávky zlyhalo.');
      renderTable();
      return false;
    } finally {
      if (withProgress) hideOrderProgress();
      mutationBusy = false;
    }
  }

  async function deleteOrder(id) {
    if (mutationBusy) return;
    const order = orders.find(item => clean(item?.id) === id);
    if (!order) return;
    if (!confirm(`Naozaj zmazať objednávku ${vehicleTitle(order)}?`)) return;
    mutationBusy = true;
    setLive('Mažem objednávku...');

    try {
      await requestOrders(`/api/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadGeneration += 1;
      orders = orders.filter(item => clean(item?.id) !== id);
      if (selectedId === id) selectedId = clean(orders[0]?.id);
      renderTable();
      setLive('Objednávka zmazaná.');
    } catch (error) {
      console.error(error);
      setLive(error?.message || 'Zmazanie objednávky zlyhalo.');
    } finally {
      mutationBusy = false;
    }
  }

  els.search?.addEventListener('input', renderTable);
  els.status?.addEventListener('change', renderTable);
  els.source?.addEventListener('change', renderTable);
  els.showArchived?.addEventListener('change', () => loadOrders(''));

  els.table?.addEventListener('click', event => {
    const detail = event.target.closest('[data-order-detail]');
    const archive = event.target.closest('[data-order-archive]');
    const del = event.target.closest('[data-order-delete]');
    const row = event.target.closest('tr[data-order-id]');

    if (detail) {
      selectedId = clean(detail.dataset.orderDetail);
      renderTable();
      return;
    }
    if (archive) {
      const id = clean(archive.dataset.orderArchive);
      const order = orders.find(item => clean(item?.id) === id);
      if (order) {
        const archived = !order.archived;
        updateOrder(id, { archived }, {
          progressText: archived ? 'Archivujem objednávku...' : 'Obnovujem objednávku...',
          successText: archived ? 'Objednávka archivovaná' : 'Objednávka obnovená',
        });
      }
      return;
    }
    if (del) {
      deleteOrder(clean(del.dataset.orderDelete));
      return;
    }
    if (row && !event.target.closest('button, select, input, textarea, a')) {
      selectedId = clean(row.dataset.orderId);
      renderTable();
    }
  });

  els.table?.addEventListener('change', event => {
    const select = event.target.closest('[data-order-status]');
    if (!select) return;
    updateOrder(clean(select.dataset.orderStatus), { status: clean(select.value) });
  });

  els.detail?.addEventListener('click', event => {
    const save = event.target.closest('[data-order-save-note]');
    if (!save) return;
    const id = clean(save.dataset.orderSaveNote);
    updateOrder(id, {
      assignedTo: clean(document.getElementById('orderAssignedTo')?.value),
      employeeNote: clean(document.getElementById('orderEmployeeNote')?.value),
    }, {
      progressText: 'Ukladám interné údaje...',
      successText: 'Interné údaje uložené',
    });
  });

  loadOrders();
})();
