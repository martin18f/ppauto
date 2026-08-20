(function () {
  const MAILBOXES = {
    sales: ['predaj', 'ppauto.sk'],
    service: ['servis.ppauto', 'ppauto.sk'],
    tech: ['technik', 'ppauto.sk'],
    privacy: ['sulak', 'ppauto.sk'],
  };

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

  ensureMobileNavStyles();
  syncVehicleDetailNavWithMain();
  hydrateMailLinks(document);

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

  // Detail vozidla si načíta samostatný modul pre PDF dokumenty.
  // Na ostatných stránkach sa nič navyše nenačítava.
  if (document.getElementById('carDetail') && !document.querySelector('script[data-auto-documents-script]')) {
    const script = document.createElement('script');
    script.src = '/js/auto-documents.js';
    script.dataset.autoDocumentsScript = '1';
    document.head.appendChild(script);
  }
})();
