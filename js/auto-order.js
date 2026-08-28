// PP AUTO – objednávka konkrétneho skladového auta z detailu vozidla.
(function () {
  'use strict';

  const root = document.getElementById('carDetail');
  if (!root) return;

  let startedAt = Date.now();
  let submissionId = '';

  function clean(value) { return String(value ?? '').trim(); }
  function makeId() {
    try { if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch (_) {}
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
  function currentCarId() {
    const queryId = clean(new URLSearchParams(location.search).get('id'));
    if (queryId) return queryId;
    const parts = location.pathname.split('/').filter(Boolean);
    const index = parts.indexOf('auta');
    return index >= 0 ? clean(decodeURIComponent(parts[index + 1] || '')) : '';
  }
  function api(path) {
    return location.protocol === 'file:' ? `https://ppauto.sk${path}` : `${location.origin}${path}`;
  }

  function formMarkup(title) {
    return `
      <section class="car-card car-order-card" id="car-order" aria-labelledby="carOrderTitle">
        <div class="section-title car-order-head">
          <div>
            <span class="car-order-kicker">Online objednávka</span>
            <h3 id="carOrderTitle">Objednať toto vozidlo</h3>
          </div>
          <span class="car-order-pill">Nezáväzne</span>
        </div>
        <div class="section-body">
          <div class="car-order-selected">
            <strong>${title}</strong>
            <span>Vozidlo je už vybrané. Doplňte kontakt a preferencie; dostupnosť a cenu vám následne potvrdíme.</span>
          </div>

          <form id="carOrderForm" class="car-order-form">
            <input class="pp-hidden-field" type="text" name="website" tabindex="-1" autocomplete="off">
            <div class="car-order-grid">
              <div class="car-order-field">
                <label for="carOrderName">Meno a priezvisko</label>
                <input id="carOrderName" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="car-order-field">
                <label for="carOrderCompany">Firma</label>
                <input id="carOrderCompany" name="company" type="text" autocomplete="organization">
              </div>
              <div class="car-order-field">
                <label for="carOrderEmail">E-mail</label>
                <input id="carOrderEmail" name="email" type="email" autocomplete="email" required>
              </div>
              <div class="car-order-field">
                <label for="carOrderPhone">Telefón</label>
                <input id="carOrderPhone" name="phone" type="tel" autocomplete="tel" required>
              </div>
              <div class="car-order-field">
                <label for="carOrderPreferredContact">Preferovaný kontakt</label>
                <select id="carOrderPreferredContact" name="preferredContact">
                  <option value="">Bez preferencie</option>
                  <option value="Telefonicky">Telefonicky</option>
                  <option value="E-mailom">E-mailom</option>
                </select>
              </div>
              <div class="car-order-field">
                <label for="carOrderDelivery">Preferovaný termín</label>
                <select id="carOrderDelivery" name="deliveryTime">
                  <option value="">Bez preferencie</option>
                  <option value="Ihneď">Ihneď</option>
                  <option value="Do 1 mesiaca">Do 1 mesiaca</option>
                  <option value="Do 3 mesiacov">Do 3 mesiacov</option>
                  <option value="Do 6 mesiacov">Do 6 mesiacov</option>
                  <option value="Neponáhľa">Neponáhľa</option>
                </select>
              </div>
              <div class="car-order-field car-order-wide">
                <label for="carOrderFinancing">Financovanie</label>
                <select id="carOrderFinancing" name="financing">
                  <option value="">Neuvádza</option>
                  <option value="Hotovosť">Hotovosť</option>
                  <option value="Úver">Úver</option>
                  <option value="Finančný leasing">Finančný leasing</option>
                  <option value="Operatívny leasing">Operatívny leasing</option>
                  <option value="Chce poradiť">Chce poradiť</option>
                </select>
              </div>
              <div class="car-order-field car-order-wide">
                <label for="carOrderTradeIn">Protiúčet</label>
                <input id="carOrderTradeIn" name="tradeIn" type="text" placeholder="Značka, model, rok a orientačný nájazd aktuálneho auta">
              </div>
              <div class="car-order-field car-order-wide">
                <label for="carOrderNote">Poznámka</label>
                <textarea id="carOrderNote" name="note" rows="4" placeholder="Doplňujúce informácie k objednávke"></textarea>
              </div>
              <label class="car-order-consent car-order-wide">
                <input type="checkbox" name="consent" required>
                <span>Súhlasím so spracovaním osobných údajov za účelom vybavenia objednávkovej požiadavky. <a href="/gdpr.html" target="_blank" rel="noopener">Ochrana osobných údajov</a></span>
              </label>
            </div>
            <div class="car-order-actions">
              <button class="btn car-btn car-btn-primary" id="carOrderSubmit" type="submit">Odoslať objednávku</button>
              <small id="carOrderStatus" class="hint" role="status" aria-live="polite"></small>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  function install() {
    if (document.getElementById('carOrderForm')) return true;
    const sections = root.querySelector('.car-sections');
    const cta = root.querySelector('.car-top aside .car-cta');
    const title = clean(root.querySelector('.car-hero h2')?.textContent);
    const id = currentCarId();
    if (!sections || !cta || !title || !id) return false;

    const testdriveSection = sections.querySelector('#testdrive');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = formMarkup(title).trim();
    const section = wrapper.firstElementChild;
    if (testdriveSection) sections.insertBefore(section, testdriveSection);
    else sections.appendChild(section);

    const button = document.createElement('a');
    button.className = 'btn car-btn car-order-main-cta';
    button.href = '#car-order';
    button.textContent = 'Objednať toto auto';
    cta.insertBefore(button, cta.firstChild);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => document.getElementById('carOrderName')?.focus(), 350);
      history.replaceState(null, '', '#car-order');
    });

    const form = document.getElementById('carOrderForm');
    const submit = document.getElementById('carOrderSubmit');
    const status = document.getElementById('carOrderStatus');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      submissionId ||= makeId();

      if (clean(data.website)) {
        if (status) status.textContent = 'Ďakujeme, objednávková požiadavka bola prijatá.';
        form.reset();
        submissionId = '';
        startedAt = Date.now();
        return;
      }

      const payload = {
        source: 'stock',
        submissionId,
        formStartedAt: startedAt,
        website: clean(data.website),
        customer: {
          name: clean(data.name),
          company: clean(data.company),
          email: clean(data.email),
          phone: clean(data.phone),
          preferredContact: clean(data.preferredContact),
        },
        // Backend si podľa stockCarId načíta dôveryhodnú konfiguráciu aj cenu zo svojho katalógu.
        vehicle: { stockCarId: id },
        preferences: {
          deliveryTime: clean(data.deliveryTime),
          financing: clean(data.financing),
          tradeIn: clean(data.tradeIn),
          note: clean(data.note),
        },
        consent: data.consent === 'on',
        page: location.href,
      };

      if (submit) {
        submit.disabled = true;
        submit.dataset.originalText = submit.textContent || '';
        submit.textContent = 'Odosielam…';
      }
      if (status) status.textContent = 'Odosielam objednávku…';

      try {
        const response = await fetch(api('/api/orders'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(clean(result?.error) || 'Objednávku sa nepodarilo odoslať.');

        const number = Number(result.orderNumber);
        const reference = Number.isSafeInteger(number) && number > 0 ? ` #${number}` : '';
        const mail = result?.notifications?.customerSent ? ' Potvrdenie sme poslali na váš e-mail.' : '';
        if (status) status.textContent = `Ďakujeme, objednávková požiadavka${reference} bola prijatá.${mail}`;
        form.reset();
        submissionId = '';
        startedAt = Date.now();
      } catch (error) {
        console.error('[PP AUTO car order]', error);
        if (status) status.textContent = error?.message || 'Odoslanie zlyhalo. Skúste to znova alebo nám zavolajte.';
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = submit.dataset.originalText || 'Odoslať objednávku';
          delete submit.dataset.originalText;
        }
      }
    });

    return true;
  }

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(root, { childList: true, subtree: true });
})();
