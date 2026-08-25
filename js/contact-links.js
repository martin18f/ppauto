(function () {
  const BRAND_SESSION_KEY = 'ppauto.brandSession';
  const LEGACY_BRAND_KEY = 'ppauto.brand';
  const BRAND_SESSION_TTL_MS = 60 * 1000;
  const BRAND_HEARTBEAT_MS = 15 * 1000;
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
    return isLocalRouteHost() ? `vyber-znacky.html${suffix}` : `/${suffix}`;
  }

  function readBrandSession() {
    try {
      const raw = localStorage.getItem(BRAND_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const brand = String(parsed?.brand || '').toLowerCase().trim();
      const lastSeen = Number(parsed?.lastSeen || 0);
      if (!ALLOWED_BRANDS.has(brand) || !Number.isFinite(lastSeen) || lastSeen <= 0) return null;
      return { brand, lastSeen };
    } catch (e) {
      return null;
    }
  }

  function writeBrandSession(brand, now = Date.now()) {
    const normalized = String(brand || '').toLowerCase().trim();
    if (!ALLOWED_BRANDS.has(normalized)) return false;

    try {
      localStorage.setItem(BRAND_SESSION_KEY, JSON.stringify({ brand: normalized, lastSeen: now }));
      // Existujúci detail auta používa ppauto.brand na okamžité nastavenie témy.
      if (normalized === 'all') localStorage.removeItem(LEGACY_BRAND_KEY);
      else localStorage.setItem(LEGACY_BRAND_KEY, normalized);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearBrandSession() {
    try {
      localStorage.removeItem(BRAND_SESSION_KEY);
      localStorage.removeItem(LEGACY_BRAND_KEY);
    } catch (e) {}
  }

  function isFreshBrandSession(session, now = Date.now()) {
    return !!session && now - session.lastSeen <= BRAND_SESSION_TTL_MS;
  }

  function redirectToChooser() {
    document.documentElement.style.visibility = 'hidden';
    location.replace(chooserHref());
  }

  function startBrandSessionGuard() {
    if (!isBrandProtectedPublicPage()) return true;

    // Defer skript beží ešte pred DOMContentLoaded; obsah skryjeme počas kontroly.
    document.documentElement.style.visibility = 'hidden';

    const initial = readBrandSession();
    if (!isFreshBrandSession(initial)) {
      clearBrandSession();
      redirectToChooser();
      return false;
    }

    writeBrandSession(initial.brand);
    document.documentElement.style.visibility = '';

    const touch = () => {
      const current = readBrandSession();
      if (!current || !ALLOWED_BRANDS.has(current.brand)) return;
      writeBrandSession(current.brand);
    };

    const validateReturn = () => {
      const current = readBrandSession();
      if (!isFreshBrandSession(current)) {
        clearBrandSession();
        redirectToChooser();
        return false;
      }
      writeBrandSession(current.brand);
      document.documentElement.style.visibility = '';
      return true;
    };

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') touch();
    }, BRAND_HEARTBEAT_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        touch();
        return;
      }
      validateReturn();
    });

    window.addEventListener('pagehide', touch);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) validateReturn();
    });
    window.addEventListener('beforeunload', touch);

    window.addEventListener('unload', () => clearInterval(heartbeat), { once: true });
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

    // Zachovávame existujúce EN/login uzly, aby sa nestratili event listenery i18n.
    const navLang = navLinks.querySelector('.nav-lang') || makeNavLink('EN', '#', 'nav-lang');
    navLang.setAttribute('data-lang-switch', '');
    navLang.setAttribute('aria-label', 'Switch to English');

    const navLogin = navLinks.querySelector('.nav-login') || makeNavLink('Prihlásiť sa', 'https://ppauto.sk/admin.html', 'nav-login');

    const primaryLinks = [
      makeNavLink('Ponuka áut', '/ponuka#ponuka'),
      makeNavLink('Servis', '/ponuka#servis'),
      makeNavLink('Financovanie', '/ponuka#financovanie'),
      makeNavLink('Značky', '/ponuka#znacky'),
      makeNavLink('Tím', '/ponuka#tim'),
      makeNavLink('Kontakt', '/ponuka#kontakt'),
      makeNavLink('Zmeniť značku', '/vyber-znacky.html?choose=1', 'nav-brand'),
    ];

    navLinks.replaceChildren(...primaryLinks, navLang, navLogin);

    const brandSwitch = navCta.querySelector('.brand-switch');
    const langSwitch = navCta.querySelector('.lang-switch');
    const loginLink = navCta.querySelector('.login-link');
    const mobileToggle = navCta.querySelector('#mobileMenuToggle, .mobile-toggle');

    if (loginLink) {
      loginLink.className = 'user-profile login-link';
      loginLink.setAttribute('aria-label', 'Prihlásiť sa');
      loginLink.innerHTML = `
        <div class="user-profile-inner">
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <g data-name="Layer 2" id="Layer_2">
              <path d="m15.626 11.769a6 6 0 1 0 -7.252 0 9.008 9.008 0 0 0 -5.374 8.231 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 9.008 9.008 0 0 0 -5.374-8.231zm-7.626-4.769a4 4 0 1 1 4 4 4 4 0 0 1 -4-4zm10 14h-12a1 1 0 0 1 -1-1 7 7 0 0 1 14 0 1 1 0 0 1 -1 1z"></path>
            </g>
          </svg>
          <span>Prihlásiť sa</span>
        </div>
      `;
    }

    const orderedCta = [brandSwitch, langSwitch, loginLink, mobileToggle].filter(Boolean);
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
