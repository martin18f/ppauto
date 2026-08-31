(function () {
  'use strict';

  const ROOT_ID = 'ppautoSystemRoot';
  if (document.getElementById(ROOT_ID)) return;

  const SOURCE_LABELS = {
    testdrive: 'Testovacia jazda', contact: 'Kontakt', finance: 'Financovanie', tradein: 'Výkup vozidla',
    service: 'Servis', phone: 'Telefonát', visit: 'Osobná návšteva', email: 'E-mail'
  };
  const STATUS_LABELS = {
    new: 'Nový', assigned: 'Pridelený', contacted: 'Kontaktovaný', appointment: 'Dohodnutá návšteva',
    offer: 'Ponuka', negotiation: 'Rokovanie', won: 'Vyhrané', lost: 'Stratené'
  };
  const BRANDS = ['', 'Subaru', 'KGM', 'Jeep', 'Chery'];

  let state = { leads: [], customers: [], metrics: {}, selectedLeadId: '', busy: false };

  const root = document.createElement('section');
  root.id = ROOT_ID;
  root.className = 'pps-root';
  root.innerHTML = `
    <div class="pps-shell">
      <div class="pps-head">
        <div>
          <div class="pps-kicker">PP AUTO SYSTEM</div>
          <h2>Riadenie, monitoring a analytika</h2>
          <p>Nová systémová vrstva je oddelená od pôvodnej správy áut a objednávok.</p>
        </div>
        <div class="pps-status" id="ppsSystemStatus"><span class="pps-dot"></span><span>Načítavam systém…</span></div>
      </div>

      <div class="pps-tabs" role="tablist">
        ${tab('dashboard', 'Dashboard', true)}${tab('leads', 'Leady')}${tab('sales', 'Predaj')}${tab('service', 'Servis')}
        ${tab('monitoring', 'Monitoring')}${tab('reports', 'Reporty')}${tab('ai', 'PP AUTO AI')}
      </div>

      <div class="pps-panel is-active" data-pps-panel="dashboard">
        <div class="pps-grid">
          ${metric('ppsMetricLeads', 'Leady', '—', 'Načítavam CRM dáta')}
          ${metric('ppsMetricSales', 'Predané vozidlá', '—', 'Modul Predaj pripravíme následne')}
          ${metric('ppsMetricRevenue', 'Obrat', '—', 'Vrátane marže a zisku')}
          ${metric('ppsMetricService', 'Servisné zákazky', '—', 'Modul Servis pripravíme následne')}
        </div>
        <div class="pps-section pps-two">
          <div class="pps-card">
            <h3>System Health</h3>
            ${healthRow('Admin', 'ppsHealthAdmin')}${healthRow('Systémové dáta', 'ppsHealthDatabase')}
            ${healthRow('Website', 'ppsHealthWebsite')}${healthRow('Formuláre', 'ppsHealthForms')}
          </div>
          <div class="pps-card">
            <h3>CRM Attention</h3>
            <div class="pps-insight"><span>Otvorené leady</span><strong id="ppsOpenLeads">—</strong></div>
            <div class="pps-insight"><span>Bez prvej reakcie viac ako 1 h</span><strong id="ppsOverdueLeads">—</strong></div>
            <div class="pps-insight"><span>Zákazníci</span><strong id="ppsCustomers">—</strong></div>
          </div>
        </div>
      </div>

      <div class="pps-panel" data-pps-panel="leads">
        <div class="pps-toolbar">
          <div><h3>Leady / CRM</h3><div class="pps-muted">Webové aj manuálne leady, zákazníci, reakčný čas a konverzný workflow.</div></div>
          <div class="pps-actions"><button class="pps-btn" id="ppsReloadLeads" type="button">Obnoviť</button><button class="pps-btn primary" id="ppsToggleLeadForm" type="button">+ Pridať lead</button></div>
        </div>
        <div class="pps-lead-form-wrap" id="ppsLeadFormWrap" hidden>
          <form class="pps-lead-form" id="ppsLeadForm">
            <div class="pps-form-head"><strong>Nový lead</strong><span>Manuálne pridanie telefonátu, návštevy, e-mailu alebo iného kontaktu.</span></div>
            <div class="pps-form-grid">
              ${input('ppsLeadName','Meno zákazníka','text',true)}${input('ppsLeadEmail','E-mail','email')}${input('ppsLeadPhone','Telefón','tel')}
              ${select('ppsLeadSource','Zdroj leadu', Object.entries(SOURCE_LABELS), true)}
              ${select('ppsLeadBrand','Značka', BRANDS.map(v => [v, v || 'Bez značky']))}${input('ppsLeadModel','Model','text')}
              ${input('ppsLeadAssigned','Pridelené zamestnancovi','text')}${select('ppsLeadStatus','Status', Object.entries(STATUS_LABELS))}
              ${input('ppsLeadFollowUp','Follow-up','datetime-local')}
            </div>
            <label class="pps-field pps-field-wide"><span>Poznámka</span><textarea id="ppsLeadNote" rows="3"></textarea></label>
            <label class="pps-field pps-field-wide" id="ppsLostReasonField" hidden><span>Dôvod straty *</span><input id="ppsLeadLostReason" type="text" maxlength="300"></label>
            <div class="pps-form-actions"><button class="pps-btn" id="ppsCancelLead" type="button">Zrušiť</button><button class="pps-btn primary" type="submit">Uložiť lead</button></div>
            <div class="pps-form-message" id="ppsLeadFormMessage" role="status"></div>
          </form>
        </div>
        <div class="pps-lead-summary">
          <span>Spolu <strong id="ppsLeadCount">0</strong></span><span>Otvorené <strong id="ppsLeadOpenCount">0</strong></span><span class="pps-danger-text">SLA &gt; 1 h <strong id="ppsLeadOverdueCount">0</strong></span>
        </div>
        <div class="pps-table-wrap">
          <table class="pps-table" id="ppsLeadsTable">
            <thead><tr><th>Vytvorené</th><th>Zákazník</th><th>Zdroj</th><th>Vozidlo</th><th>Pridelené</th><th>Status</th><th>Reakcia</th><th></th></tr></thead>
            <tbody><tr><td colspan="8" class="pps-empty">Načítavam leady…</td></tr></tbody>
          </table>
        </div>
        <div id="ppsLeadDetail"></div>
      </div>

      ${placeholderPanel('sales','Predaj','Predaje previazané so zákazníkom, leadom a vozidlom. Cena, nákupná cena, marža, zľava, financovanie a protiúčet.')}
      ${placeholderPanel('service','Servis','Servisné zákazky, vozidlá, mechanici, poradcovia, práca, diely, trvanie, kapacita, obrat a marža.')}
      ${placeholderPanel('monitoring','Monitoring','5-minútová dostupnosť, hodinové testy formulárov, denný audit, incidenty a kritické e-mailové alerty.')}
      ${placeholderPanel('reports','Reporting & Analytics','Týždenné, mesačné, kvartálne, ročné a vlastné reporty s KPI a porovnávaním období.')}
      ${placeholderPanel('ai','PP AUTO AI','Chat nad firemnými dátami, automatické insights, detekcia anomálií a odporúčania.')}
    </div>`;

  const anchor = document.querySelector('body > script:last-of-type');
  if (anchor) document.body.insertBefore(root, anchor); else document.body.appendChild(root);

  function tab(id, label, active = false) { return `<button class="pps-tab${active ? ' is-active' : ''}" type="button" data-pps-tab="${id}">${label}</button>`; }
  function metric(id, label, value, sub) { return `<div class="pps-card"><div class="pps-metric-label">${label}</div><div class="pps-metric-value" id="${id}">${value}</div><div class="pps-metric-sub">${sub}</div></div>`; }
  function healthRow(label, id) { return `<div class="pps-health-row"><span class="pps-health-name">${label}</span><span class="pps-health-state" id="${id}">Čaká…</span></div>`; }
  function input(id, label, type, required = false) { return `<label class="pps-field"><span>${label}${required ? ' *' : ''}</span><input id="${id}" type="${type}"${required ? ' required' : ''}></label>`; }
  function select(id, label, options, required = false) { return `<label class="pps-field"><span>${label}${required ? ' *' : ''}</span><select id="${id}"${required ? ' required' : ''}>${options.map(([v,l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`; }
  function placeholderPanel(id, title, copy) { return `<div class="pps-panel" data-pps-panel="${id}"><div class="pps-toolbar"><h3>${title}</h3><span class="pps-badge">Nasledujúca fáza</span></div><div class="pps-placeholder">${copy}</div></div>`; }
  function esc(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function clean(value) { return String(value ?? '').trim(); }
  function formatDate(value) {
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('sk-SK',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }
  function apiUrl(resource, id) { return `/api/system?resource=${encodeURIComponent(resource)}${id ? `&id=${encodeURIComponent(id)}` : ''}`; }
  async function request(resource, options = {}, id = '') {
    const response = await fetch(apiUrl(resource, id), { cache: 'no-store', ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Požiadavka zlyhala (${response.status}).`);
    return payload;
  }

  root.querySelectorAll('[data-pps-tab]').forEach(btn => btn.addEventListener('click', () => {
    const name = btn.dataset.ppsTab;
    root.querySelectorAll('[data-pps-tab]').forEach(x => x.classList.toggle('is-active', x === btn));
    root.querySelectorAll('[data-pps-panel]').forEach(x => x.classList.toggle('is-active', x.dataset.ppsPanel === name));
  }));

  const formWrap = root.querySelector('#ppsLeadFormWrap');
  const form = root.querySelector('#ppsLeadForm');
  const formMessage = root.querySelector('#ppsLeadFormMessage');
  const lostField = root.querySelector('#ppsLostReasonField');
  const statusInput = root.querySelector('#ppsLeadStatus');

  root.querySelector('#ppsToggleLeadForm')?.addEventListener('click', () => { formWrap.hidden = !formWrap.hidden; if (!formWrap.hidden) root.querySelector('#ppsLeadName')?.focus(); });
  root.querySelector('#ppsCancelLead')?.addEventListener('click', () => { form.reset(); formWrap.hidden = true; syncLostField(); setFormMessage(''); });
  root.querySelector('#ppsReloadLeads')?.addEventListener('click', loadBootstrap);
  statusInput?.addEventListener('change', syncLostField);
  function syncLostField() { lostField.hidden = statusInput?.value !== 'lost'; root.querySelector('#ppsLeadLostReason').required = !lostField.hidden; }

  form?.addEventListener('submit', async event => {
    event.preventDefault(); if (state.busy) return;
    const customer = { name: clean(root.querySelector('#ppsLeadName').value), email: clean(root.querySelector('#ppsLeadEmail').value), phone: clean(root.querySelector('#ppsLeadPhone').value) };
    if (!customer.email && !customer.phone) return setFormMessage('Zadaj aspoň e-mail alebo telefón.', 'error');
    const payload = {
      customer,
      source: root.querySelector('#ppsLeadSource').value,
      brand: root.querySelector('#ppsLeadBrand').value,
      model: clean(root.querySelector('#ppsLeadModel').value),
      assignedTo: clean(root.querySelector('#ppsLeadAssigned').value),
      status: root.querySelector('#ppsLeadStatus').value,
      followUpAt: root.querySelector('#ppsLeadFollowUp').value,
      note: clean(root.querySelector('#ppsLeadNote').value),
      lostReason: clean(root.querySelector('#ppsLeadLostReason').value)
    };
    try {
      state.busy = true; setFormMessage('Ukladám lead…', 'working');
      await request('leads', { method: 'POST', body: JSON.stringify(payload) });
      form.reset(); syncLostField(); formWrap.hidden = true; setFormMessage('');
      await loadBootstrap();
    } catch (error) { setFormMessage(error.message, 'error'); }
    finally { state.busy = false; }
  });

  root.querySelector('#ppsLeadsTable')?.addEventListener('change', async event => {
    const select = event.target.closest('[data-lead-status]'); if (!select || state.busy) return;
    const lead = state.leads.find(x => x.id === select.dataset.leadStatus); if (!lead) return;
    const previous = lead.status; const next = select.value; let lostReason = lead.lostReason || '';
    if (next === 'lost' && !lostReason) { lostReason = prompt('Zadaj dôvod straty leadu:') || ''; if (!clean(lostReason)) { select.value = previous; return; } }
    try {
      state.busy = true;
      await request('leads', { method: 'PUT', body: JSON.stringify({ status: next, lostReason, historyNote: `Status: ${STATUS_LABELS[previous]} → ${STATUS_LABELS[next]}` }) }, lead.id);
      await loadBootstrap(lead.id);
    } catch (error) { alert(error.message); select.value = previous; }
    finally { state.busy = false; }
  });

  root.querySelector('#ppsLeadsTable')?.addEventListener('click', event => {
    const detail = event.target.closest('[data-lead-detail]'); if (!detail) return;
    state.selectedLeadId = detail.dataset.leadDetail; renderLeadDetail();
  });

  async function loadBootstrap(preferredLeadId = state.selectedLeadId) {
    setSystemStatus('Načítavam systém…', 'working');
    try {
      const data = await request('bootstrap');
      state.leads = Array.isArray(data.leads) ? data.leads : [];
      state.customers = Array.isArray(data.customers) ? data.customers : [];
      state.metrics = data.metrics || {};
      state.selectedLeadId = state.leads.some(x => x.id === preferredLeadId) ? preferredLeadId : '';
      renderMetrics(); renderLeads(); renderLeadDetail();
      setHealth('ppsHealthAdmin', 'Online', 'ok'); setHealth('ppsHealthDatabase', 'Online', 'ok');
      setHealth('ppsHealthWebsite', 'Monitoring ešte nie je aktívny', 'warning'); setHealth('ppsHealthForms', 'Test runner ešte nie je aktívny', 'warning');
      setSystemStatus('CRM aktívne', 'ok');
    } catch (error) {
      setSystemStatus(error.message, 'critical'); setHealth('ppsHealthDatabase', 'Nedostupné / nenakonfigurované', 'critical');
      root.querySelector('#ppsLeadsTable tbody').innerHTML = `<tr><td colspan="8" class="pps-empty pps-danger-text">${esc(error.message)}</td></tr>`;
    }
  }

  function renderMetrics() {
    const m = state.metrics || {};
    root.querySelector('#ppsMetricLeads').textContent = String(m.leads ?? 0);
    root.querySelector('#ppsOpenLeads').textContent = String(m.openLeads ?? 0);
    root.querySelector('#ppsOverdueLeads').textContent = String(m.overdueLeads ?? 0);
    root.querySelector('#ppsCustomers').textContent = String(m.customers ?? 0);
    root.querySelector('#ppsLeadCount').textContent = String(m.leads ?? 0);
    root.querySelector('#ppsLeadOpenCount').textContent = String(m.openLeads ?? 0);
    root.querySelector('#ppsLeadOverdueCount').textContent = String(m.overdueLeads ?? 0);
  }

  function reactionLabel(lead) {
    if (lead.reactionMinutes !== null && lead.reactionMinutes !== undefined) return `${lead.reactionMinutes} min`;
    if (lead.slaBreached) return '<span class="pps-sla-bad">&gt; 1 h</span>';
    return '<span class="pps-muted">čaká</span>';
  }
  function renderLeads() {
    const tbody = root.querySelector('#ppsLeadsTable tbody');
    if (!state.leads.length) { tbody.innerHTML = '<tr><td colspan="8" class="pps-empty">Zatiaľ tu nie sú žiadne leady.</td></tr>'; return; }
    tbody.innerHTML = state.leads.map(lead => {
      const customer = lead.customer || {};
      const statusOptions = Object.entries(STATUS_LABELS).map(([v,l]) => `<option value="${v}"${lead.status === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
      return `<tr class="${lead.slaBreached ? 'pps-row-alert' : ''}">
        <td>${esc(formatDate(lead.createdAt))}</td>
        <td><strong>${esc(customer.name || '—')}</strong><small>${esc(customer.email || customer.phone || '')}</small></td>
        <td>${esc(SOURCE_LABELS[lead.source] || lead.source)}</td>
        <td>${esc([lead.brand, lead.model].filter(Boolean).join(' ') || '—')}</td>
        <td>${esc(lead.assignedTo || '—')}</td>
        <td><select class="pps-status-select" data-lead-status="${esc(lead.id)}">${statusOptions}</select></td>
        <td>${reactionLabel(lead)}</td>
        <td><button class="pps-link-btn" type="button" data-lead-detail="${esc(lead.id)}">Detail</button></td>
      </tr>`;
    }).join('');
  }
  function renderLeadDetail() {
    const box = root.querySelector('#ppsLeadDetail');
    const lead = state.leads.find(x => x.id === state.selectedLeadId);
    if (!lead) { box.innerHTML = ''; return; }
    const c = lead.customer || {};
    const history = Array.isArray(lead.history) ? [...lead.history].reverse() : [];
    box.innerHTML = `<div class="pps-detail-card">
      <div class="pps-detail-head"><div><span class="pps-kicker">LEAD DETAIL</span><h3>${esc(c.name || 'Zákazník')}</h3></div><button class="pps-link-btn" type="button" id="ppsCloseLeadDetail">Zavrieť</button></div>
      <div class="pps-detail-grid">
        ${detailItem('E-mail', c.email)}${detailItem('Telefón', c.phone)}${detailItem('Zdroj', SOURCE_LABELS[lead.source])}${detailItem('Značka / model', [lead.brand, lead.model].filter(Boolean).join(' '))}
        ${detailItem('Pridelené', lead.assignedTo)}${detailItem('Status', STATUS_LABELS[lead.status])}${detailItem('Prvá reakcia', lead.reactionMinutes == null ? (lead.slaBreached ? '> 1 hodina' : 'Zatiaľ bez reakcie') : `${lead.reactionMinutes} min`)}${detailItem('Follow-up', lead.followUpAt ? formatDate(lead.followUpAt) : '')}
      </div>
      ${lead.note ? `<div class="pps-note"><strong>Poznámka</strong><p>${esc(lead.note)}</p></div>` : ''}
      ${lead.lostReason ? `<div class="pps-note pps-note-danger"><strong>Dôvod straty</strong><p>${esc(lead.lostReason)}</p></div>` : ''}
      <div class="pps-history"><strong>História</strong>${history.map(item => `<div><span>${esc(formatDate(item.at))}</span><b>${esc(STATUS_LABELS[item.status] || item.type || '')}</b><small>${esc(item.note || '')}</small></div>`).join('')}</div>
    </div>`;
    box.querySelector('#ppsCloseLeadDetail')?.addEventListener('click', () => { state.selectedLeadId = ''; renderLeadDetail(); });
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function detailItem(label, value) { return `<div><span>${label}</span><strong>${esc(value || '—')}</strong></div>`; }
  function setFormMessage(message, kind = '') { formMessage.textContent = message || ''; formMessage.dataset.kind = kind; }
  function setSystemStatus(message, kind) {
    const el = root.querySelector('#ppsSystemStatus'); el.querySelector('span:last-child').textContent = message;
    el.dataset.kind = kind || ''; el.querySelector('.pps-dot').className = `pps-dot pps-dot-${kind || 'working'}`;
  }
  function setHealth(id, text, kind) { const el = root.querySelector(`#${id}`); if (!el) return; el.textContent = text; el.className = `pps-health-state pps-${kind}`; }

  syncLostField();
  loadBootstrap();
})();
