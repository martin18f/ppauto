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

  ensureMobileNavStyles();
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
