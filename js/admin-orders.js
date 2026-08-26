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
    reload: document.getElementById('ordersReloadBtn'),
    table: document.getElementById('ordersTable'),
    tbody: document.querySelector('#ordersTable tbody'),
    detail: document.getElementById('orderDetail'),
    live: document.getElementById('ordersStatus'),
  };

  let orders = [];
  let selectedId = '';
  let busy = false;

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

  function arrayText(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);
    return clean(value).split(/\s*\+\s*|\s*,\s*/g).map(clean).filter(Boolean);
  }

  function vehicleTitle(order) {
    const vehicle = order?.vehicle || {};
    return `${clean(vehicle.znacka)} ${clean(vehicle.model)}`.replace(/\s+/g, ' ').trim() || 'Bez vozidla';
  }

  function vehicleSubtitle(order) {
    const vehicle = order?.vehicle || {};
    return [
      vehicle.rok ? `Rok ${vehicle.rok}` : '',
      vehicle.palivo,
      vehicle.typ_prevodovky || vehicle.prevodovka,
      vehicle.farba,
    ].map(clean).filter(Boolean).join(' · ') || '-';
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

  function setLive(message) {
    if (!els.live) return;
    els.live.textContent = '';
    requestAnimationFrame(() => {
      els.live.textContent = message || '';
    });
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
          <td>${index + 1}</td>
          <td>
            <div class="order-cell-main">${esc(formatDate(order?.createdAt))}</div>
            <div class="order-cell-sub">${esc(id)}</div>
          </td>
          <td>
            <div class="order-cell-main">${esc(customer.name || '-')}</div>
            <div class="order-cell-sub">${esc([customer.phone, customer.email].filter(Boolean).join(' · ') || '-')}</div>
          </td>
          <td><span class="order-source-pill order-source-pill--${esc(source)}">${esc(sourceLabel(source))}</span></td>
          <td>
            <div class="order-cell-main">${esc(vehicleTitle(order))}</div>
            <div class="order-cell-sub">${esc(vehicleSubtitle(order))}</div>
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
    const equipment = arrayText(vehicle.vybava);
    const packages = arrayText(vehicle.vybava_paket);
    const history = Array.isArray(order.history) ? order.history : [];

    const equipmentHtml = equipment.length
      ? `<div class="order-detail-list">${equipment.map(item => `<span>${esc(item)}</span>`).join('')}</div>`
      : '<div class="order-detail-text">-</div>';

    const historyHtml = history.length
      ? `<div class="order-detail-list">${history.map(item => `<span>${esc(statusLabel(item.status))} · ${esc(formatDate(item.at))}</span>`).join('')}</div>`
      : '<div class="order-detail-text">-</div>';

    els.detail.innerHTML = `
      <h3>${esc(vehicleTitle(order))}</h3>
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
          ${detailItem('Skladové ID', vehicle.stockCarId)}
          ${detailItem('Značka', vehicle.znacka)}
          ${detailItem('Model', vehicle.model)}
          ${detailItem('Rok', vehicle.rok)}
          ${detailItem('Palivo', vehicle.palivo)}
          ${detailItem('Prevodovka', vehicle.typ_prevodovky || vehicle.prevodovka)}
          ${detailItem('Výbava / paket', packages.join(' + '))}
          ${detailItem('Objem', vehicle.objem ? `${vehicle.objem} cm³` : '')}
          ${detailItem('Výkon', vehicle.vykon ? `${vehicle.vykon} kW` : '')}
          ${detailItem('Najazdené', vehicle.najazdene ? `${vehicle.najazdene} km` : '')}
          ${detailItem('Karoséria', vehicle.karoseria)}
          ${detailItem('Pohon', vehicle.pohon)}
          ${detailItem('Farba', vehicle.farba)}
          ${detailItem('Metalíza', vehicle.metaliza ? 'Áno' : 'Nie')}
          ${detailItem('Cena', vehicle.nova_cena || vehicle.stara_cena)}
        </div>
      `)}

      ${detailBlock('Výbava', equipmentHtml)}

      ${detailBlock('Preferencie', `
        <div class="order-detail-grid">
          ${detailItem('Rozpočet', prefs.budget)}
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

  async function loadOrders() {
    if (busy) return;
    busy = true;
    setLive('Načítavam objednávky...');
    if (els.reload) els.reload.disabled = true;

    try {
      const include = els.showArchived?.checked ? '?include_archived=1' : '';
      const data = await requestOrders(`/api/orders${include}`);
      orders = Array.isArray(data) ? data : [];
      if (!orders.some(order => clean(order?.id) === selectedId)) selectedId = clean(orders[0]?.id);
      renderTable();
      setLive(`Načítané objednávky: ${orders.length}`);
    } catch (error) {
      console.error(error);
      orders = [];
      selectedId = '';
      renderTable();
      setLive(error?.message || 'Nepodarilo sa načítať objednávky.');
    } finally {
      busy = false;
      if (els.reload) els.reload.disabled = false;
    }
  }

  async function updateOrder(id, patch) {
    if (!id) return;
    setLive('Ukladám objednávku...');
    try {
      const payload = await requestOrders(`/api/orders?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      const idx = orders.findIndex(order => clean(order?.id) === id);
      if (idx >= 0 && payload.order) orders[idx] = payload.order;
      await loadOrders();
      selectedId = id;
      renderTable();
      setLive('Objednávka uložená.');
    } catch (error) {
      console.error(error);
      setLive(error?.message || 'Uloženie objednávky zlyhalo.');
      renderTable();
    }
  }

  async function deleteOrder(id) {
    const order = orders.find(item => clean(item?.id) === id);
    if (!order) return;
    if (!confirm(`Naozaj zmazať objednávku ${vehicleTitle(order)}?`)) return;
    setLive('Mažem objednávku...');

    try {
      await requestOrders(`/api/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      orders = orders.filter(item => clean(item?.id) !== id);
      if (selectedId === id) selectedId = clean(orders[0]?.id);
      renderTable();
      setLive('Objednávka zmazaná.');
    } catch (error) {
      console.error(error);
      setLive(error?.message || 'Zmazanie objednávky zlyhalo.');
    }
  }

  els.search?.addEventListener('input', renderTable);
  els.status?.addEventListener('change', renderTable);
  els.source?.addEventListener('change', renderTable);
  els.showArchived?.addEventListener('change', loadOrders);
  els.reload?.addEventListener('click', loadOrders);

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
      if (order) updateOrder(id, { archived: !order.archived });
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
    });
  });

  loadOrders();
})();
