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

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-mail]');
    if (!link) return;

    const address = mailboxAddress(link.dataset.mail);
    if (!address) return;

    const subject = link.dataset.mailSubject ? '?subject=' + encodeURIComponent(link.dataset.mailSubject) : '';
    event.preventDefault();
    window.location.href = 'mai' + 'lto:' + address + subject;
  });
})();
