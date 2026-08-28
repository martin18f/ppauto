(function () {
  const BRAND_SESSION_KEY = 'ppauto.brandSession';
  const LEGACY_BRAND_KEY = 'ppauto.brand';
  const ALLOWED_BRANDS = new Set(['subaru', 'kgm', 'jeep', 'chery', 'all']);

  const MAILBOXES = {
    sales: ['predaj', 'ppauto.sk'],
    service: ['servis.ppauto', 'ppauto.sk'],
    tech: ['technik', 'ppauto.sk'],
    privacy: ['sulak', 'ppauto.sk'],
  };

  function isLocalRouteHost() {
    return location.protocol === 'file:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '::1';
  }

  function normalizedPath() {
    const path = String(location.pathname || '/').replace(/\/+$/, '').toLowerCase();
    return path || '/';
  }

  function isBrandProtectedPublicPage() {
    const path = normalizedPath();
    if (document.getElementById('carDetail')) return true;
    if (/\/auta\/[^/]+$/.test(path)) return true;
    if (path.endsWith('/auto.html') || path === '/auto.html') return true;
    if (path.endsWith('/index.html') || path === '/index.html') return true;
    return path === '/ponuka' || path === '/subaru' || path === '/kgm' || path === '/jeep' || path === '/chery';
  }

  function chooserHref() {
    const lang = new URLSearchParams(location.search).get('lang');
    const params = new URLSearchParams();
    if (String(lang || '').toLowerCase() === 'en') params.set('lang', 'en');
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return `${isLocalRouteHost() ? 'vyber-znacky.html' : '/vyber-znacky.html'}${suffix}`;
  }

  function readBrandSession() {
    try {
      const raw = sessionStorage.getItem(BRAND_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const brand = String(parsed?.brand || '').toLowerCase().trim();
      const expiresAt = Number(parsed?.expiresAt || 0);
      if (!ALLOWED_BRANDS.has(brand) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
      return { brand, expiresAt };
    } catch (e) {
      return null;
    }
  }

  function clearBrandSession() {
    try {
      sessionStorage.removeItem(BRAND_SESSION_KEY);
      sessionStorage.removeItem(LEGACY_BRAND_KEY);
      sessionStorage.removeItem('selected_brand');
    } catch (e) {}
    // Starý localStorage variant nesmie ovplyvniť novú návštevu.
    try {
      localStorage.removeItem(BRAND_SESSION_KEY);
      localStorage.removeItem(LEGACY_BRAND_KEY);
    } catch (e) {}
  }

  function isFreshBrandSession(session) {
    return !!session && session.expiresAt > Date.now();
  }

  function redirectToChooser() {
    document.documentElement.style.visibility = 'hidden';
    clearBrandSession();
    location.replace(chooserHref());
  }

  function startBrandSessionGuard() {
    if (!isBrandProtectedPublicPage()) return true;

    document.documentElement.style.visibility = 'hidden';
    const initial = readBrandSession();
    if (!isFreshBrandSession(initial)) {
      redirectToChooser();
      return false;
    }

    // Theme kompatibilita iba v sessionStorage; TTL sa pri pohybe po webe nepredlžuje.
    try {
      if (initial.brand === 'all') sessionStorage.removeItem(LEGACY_BRAND_KEY);
      else sessionStorage.setItem(LEGACY_BRAND_KEY, initial.brand);
    } catch (e) {}
    document.documentElement.style.visibility = '';

    const validateReturn = () => {
      const current = readBrandSession();
      if (!isFreshBrandSession(current)) {
        redirectToChooser();
        return false;
      }
      document.documentElement.style.visibility = '';
      return true;
    };

    // Po dvoch minútach výber iba zneplatníme. Aktuálnu stránku násilne
    // neprerušujeme; ďalšia navigácia/obnovenie už začne cez chooser.
    const remaining = Math.max(0, initial.expiresAt - Date.now());
    const expiryTimer = setTimeout(clearBrandSession, remaining + 10);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') validateReturn();
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) validateReturn();
    });
    window.addEventListener('unload', () => clearTimeout(expiryTimer), { once: true });

    // Pri skutočnom odchode na inú stránku/doménu vo rovnakom okne voľbu zabudni.
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || link.target === '_blank' || event.defaultPrevented) return;
      try {
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin) clearBrandSession();
      } catch (e) {}
    }, true);

    return true;
  }

  // Ak session expirovala, ďalej už nič na chránenej verejnej stránke neinicializujeme.
  if (!startBrandSessionGuard()) return;

  function mailboxAddress(key) {
    const parts = MAILBOXES[key];
    return parts ? parts[0] + '@' + parts[1] : '';
  }

  function mailboxHref(link) {
    const address = mailboxAddress(link?.dataset?.mail);
    if (!address) return '';

    const subject = link.dataset.mailSubject
      ? '?subject=' + encodeURIComponent(link.dataset.mailSubject)
      : '';
    return 'mailto:' + address + subject;
  }

  function hydrateMailLink(link) {
    const address = mailboxAddress(link?.dataset?.mail);
    const href = mailboxHref(link);
    if (!address || !href) return;

    if (link.textContent.trim() !== address) link.textContent = address;
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }

  function hydrateMailLinks(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE && root.matches('a[data-mail]')) {
      hydrateMailLink(root);
    }
    root.querySelectorAll?.('a[data-mail]').forEach(hydrateMailLink);
  }

  function ensureMobileNavStyles() {
    if (document.querySelector('link[data-mobile-nav-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/mobile-nav.css';
    link.dataset.mobileNavStyle = '1';
    document.head.appendChild(link);
  }

  function makeNavLink(label, href, className = '') {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (className) link.className = className;
    return link;
  }

  function syncVehicleDetailNavWithMain() {
    if (!document.getElementById('carDetail')) return;

    const header = document.querySelector('header');
    const navLinks = header?.querySelector('.nav-links');
    const navCta = header?.querySelector('.nav-cta');
    if (!header || !navLinks || !navCta) return;

    const brandTitle = header.querySelector('.brand h1');
    if (brandTitle) brandTitle.textContent = 'PP AUTO s.r.o.';

    // Zachovávame jazykový uzol, aby sa nestratil i18n listener.
    const navLang = navLinks.querySelector('.nav-lang') || makeNavLink('EN', '#', 'nav-lang');
    navLang.setAttribute('data-lang-switch', '');
    navLang.setAttribute('aria-label', 'Switch to English');


    const primaryLinks = [
      makeNavLink('Ponuka áut', '/ponuka#ponuka'),
      makeNavLink('Objednať auto', '/ponuka#objednat-auto'),
      makeNavLink('Servis', '/ponuka#servis'),
      makeNavLink('Tím', '/ponuka#tim'),
      makeNavLink('Kontakt', '/ponuka#kontakt'),
      makeNavLink('Zmeniť značku', '/vyber-znacky.html?choose=1', 'nav-brand'),
    ];

    navLinks.replaceChildren(...primaryLinks, navLang);

    const brandSwitch = navCta.querySelector('.brand-switch');
    const langSwitch = navCta.querySelector('.lang-switch');
    const loginLink = navCta.querySelector('.login-link');
    const mobileToggle = navCta.querySelector('#mobileMenuToggle, .mobile-toggle');

    if (loginLink) loginLink.remove();

    const orderedCta = [brandSwitch, langSwitch, mobileToggle].filter(Boolean);
    navCta.replaceChildren(...orderedCta);
  }

  function ensureMartinFooter() {
    if (document.querySelector('.ms-footer')) return;

    const ppFooter = document.querySelector('footer');
    if (!ppFooter) return;

    if (!document.querySelector('link[data-martin-footer-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = '/css/martin-footer.css';
      style.dataset.martinFooterStyle = '1';
      document.head.appendChild(style);
    }

    const technologies = [
      'HTML',
      'CSS',
      'JavaScript',
      'React',
      'Python',
      'Java',
      'C',
      'C#',
      '.NET',
      'MySQL',
      'MATLAB',
      'Simulink',
      'Git',
      'GitHub',
      'VS Code',
    ];

    const stack = technologies
      .map((technology) => `<div class="ms-tech">${technology}</div>`)
      .join('');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <section class="ms-footer" aria-label="Autor webu">
        <div class="ms-grid" aria-hidden="true"></div>
        <div class="ms-ambient ms-ambient-one" aria-hidden="true"></div>
        <div class="ms-ambient ms-ambient-two" aria-hidden="true"></div>

        <div class="ms-container">
          <div class="ms-main">
            <div class="ms-logo" aria-hidden="true">M</div>

            <div class="ms-identity">
              <div class="ms-overline">
                <span class="ms-dot" aria-hidden="true"></span>
                Tento web vytvoril
              </div>

              <a
                class="ms-name-link"
                href="https://martinsulak.dev"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Martin Šulák – osobné portfólio"
              >
                <span class="ms-name">Martin Šulák</span>
                <span class="ms-name-arrow" aria-hidden="true">↗</span>
              </a>

              <div class="ms-role">
                AI študent <span>•</span> Developer <span>•</span> Engineering
              </div>
            </div>

            <a
              class="ms-portfolio"
              href="https://martinsulak.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div class="ms-portfolio-content">
                <span class="ms-portfolio-label">Osobné portfólio</span>
                <span class="ms-portfolio-url">martinsulak.dev</span>
              </div>
              <div class="ms-portfolio-arrow" aria-hidden="true">↗</div>
            </a>
          </div>
        </div>

        <div class="ms-stack" aria-label="Technológie">
          <div class="ms-stack-track">
            <div class="ms-stack-set">${stack}</div>
            <div class="ms-stack-set" aria-hidden="true">${stack}</div>
          </div>
        </div>

        <div class="ms-container">
          <div class="ms-bottom">
            <div>© <span data-ms-year></span> Martin Šulák</div>

            <div class="ms-bottom-right">
              <span>Based in Slovakia</span>
              <span class="ms-bottom-separator" aria-hidden="true"></span>
              <span>Software Development</span>
              <span class="ms-bottom-separator" aria-hidden="true"></span>
              <span>AI / ML</span>
              <span class="ms-bottom-separator" aria-hidden="true"></span>
              <span>Engineering</span>
            </div>
          </div>
        </div>
      </section>
    `;

    const martinFooter = wrapper.firstElementChild;
    ppFooter.insertAdjacentElement('afterend', martinFooter);

    if (!document.querySelector('script[data-martin-footer-script]')) {
      const script = document.createElement('script');
      script.src = '/js/martin-footer.js';
      script.dataset.martinFooterScript = '1';
      document.body.appendChild(script);
    }
  }

  ensureMobileNavStyles();
  syncVehicleDetailNavWithMain();
  hydrateMailLinks(document);
  ensureMartinFooter();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(hydrateMailLinks);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-mail]');
    if (!link) return;
    hydrateMailLink(link);
  });

  // Plávajúce „Nastavenia cookies“ jemne schováme tak, aby nekolidovalo
  // s CTA testovacej jazdy. Na mobile sa po existujúcom/novom súhlase
  // automaticky odsunie; na desktope zmizne po otvorení nastavení.
  function dismissCookieLauncher(delay = 0) {
    window.setTimeout(() => {
      const launcher = document.getElementById('ppCookieOpenSettings');
      if (!launcher || launcher.classList.contains('is-dismissed')) return;
      launcher.classList.add('is-dismissing');
      window.setTimeout(() => launcher.classList.add('is-dismissed'), 230);
    }, delay);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.id === 'ppCookieOpenSettings') {
      dismissCookieLauncher();
      return;
    }

    if (window.matchMedia('(max-width: 680px)').matches &&
        button.matches('[data-cookie-save], [data-cookie-accept-all], [data-cookie-reject]')) {
      // Cookie modul najprv zobrazí launcher; potom ho necháme plynulo zmiznúť.
      dismissCookieLauncher(70);
    }
  }, true);

  if (window.matchMedia('(max-width: 680px)').matches) {
    // Ak už bol súhlas uložený z predchádzajúcej návštevy, cookie modul launcher
    // po inicializácii zobrazí automaticky. Krátke oneskorenie zachová jemnú animáciu.
    window.setTimeout(() => {
      const launcher = document.getElementById('ppCookieOpenSettings');
      if (launcher?.classList.contains('is-visible')) dismissCookieLauncher();
    }, 320);
  }

  // Promo + formulár testovacej jazdy iba na stránkach s financovaním.
  if (document.getElementById('financovanie') && !document.querySelector('script[data-testdrive-promo-script]')) {
    const script = document.createElement('script');
    script.src = '/js/testdrive-promo.js';
    script.dataset.testdrivePromoScript = '1';
    document.head.appendChild(script);
  }

  // Detail vozidla si načíta samostatný modul pre PDF dokumenty.
  if (document.getElementById('carDetail') && !document.querySelector('script[data-auto-documents-script]')) {
    const script = document.createElement('script');
    script.src = '/js/auto-documents.js';
    script.dataset.autoDocumentsScript = '1';
    document.head.appendChild(script);
  }
})();
