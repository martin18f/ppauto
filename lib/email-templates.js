const COLORS = {
  background: '#0b0e13',
  elevated: '#11151b',
  card: '#151a22',
  line: '#232a35',
  muted: '#98a2b3',
  text: '#e8ecf2',
  strong: '#ffffff',
  accent: '#3b82f6',
  primary: '#0044d6',
  red: '#ff1616',
  success: '#22c55e',
};

function clean(value, max = 30000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, max);
}

function escapeText(value, max = 30000) {
  return clean(value, max)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeMultiline(value, max = 30000) {
  return escapeText(value, max).replace(/\n/g, '<br>');
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(hasValue);
  return clean(value).length > 0;
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item && hasValue(item.value))
    .map(item => ({
      label: clean(item.label, 180),
      value: Array.isArray(item.value) ? item.value.filter(hasValue).join('\n') : item.value,
    }));
}

function normalizeSections(sections) {
  return (Array.isArray(sections) ? sections : [])
    .map(section => ({
      title: clean(section?.title, 180),
      items: normalizeItems(section?.items),
    }))
    .filter(section => section.title && section.items.length);
}

function linkForValue(value) {
  const raw = clean(value, 30000);
  if (!raw || raw.includes('\n')) return null;

  if (/^https?:\/\/[^\s]+$/i.test(raw)) {
    return { href: raw, label: 'Otvoriť odkaz ↗' };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { href: `mailto:${raw}`, label: raw };
  }

  if (/^\+?[\d\s()./-]{7,}$/.test(raw)) {
    const phone = raw.replace(/(?!^)\+/g, '').replace(/[^\d+]/g, '');
    if (phone.replace(/\D/g, '').length >= 7) return { href: `tel:${phone}`, label: raw };
  }

  return null;
}

function renderValue(value) {
  const link = linkForValue(value);
  if (!link) return escapeMultiline(value);
  return `<a href="${escapeText(link.href)}" style="color:#9ec0ff;font-weight:700;text-decoration:none;">${escapeText(link.label)}</a>`;
}

function renderRows(items) {
  return normalizeItems(items).map((item, index) => `
    <tr>
      <td width="34%" valign="top" style="width:34%;padding:${index ? '14px' : '0'} 14px 14px 0;${index ? `border-top:1px solid ${COLORS.line};` : ''}font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;font-weight:700;letter-spacing:.65px;text-transform:uppercase;color:${COLORS.muted};">
        ${escapeText(item.label)}
      </td>
      <td valign="top" style="padding:${index ? '14px' : '0'} 0 14px 10px;${index ? `border-top:1px solid ${COLORS.line};` : ''}font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${COLORS.text};word-break:break-word;overflow-wrap:anywhere;">
        ${renderValue(item.value)}
      </td>
    </tr>`).join('');
}

function renderContacts(contacts) {
  return normalizeItems(contacts).map(item => `
    <tr>
      <td style="padding:0 0 9px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.card}" style="width:100%;border-collapse:separate;background-color:${COLORS.card};border:1px solid ${COLORS.line};border-left:3px solid ${COLORS.accent};border-radius:12px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td style="padding:15px 17px;">
              <div style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${COLORS.muted};">${escapeText(item.label)}</div>
              <div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.35;font-weight:700;color:${COLORS.strong};word-break:break-word;overflow-wrap:anywhere;">${renderValue(item.value)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');
}

function renderSections(sections) {
  return normalizeSections(sections).map(section => `
    <tr>
      <td style="padding:0 28px 16px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.card}" style="width:100%;border-collapse:separate;background-color:${COLORS.card};border:1px solid ${COLORS.line};border-radius:14px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td style="padding:17px 20px 3px 20px;">
              <div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.85px;text-transform:uppercase;color:#a9c5ff;">${escapeText(section.title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px 5px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                ${renderRows(section.items)}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');
}

function outlookOpen(background) {
  return `<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${background}"><tr><td><![endif]-->`;
}

const OUTLOOK_CLOSE = '<!--[if mso]></td></tr></table><![endif]-->';

function emailHead(title) {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${escapeText(title, 300)}</title>
</head>`;
}

function hiddenPreheader(text) {
  return `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">${escapeText(text, 500)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;
}

function headerMarkup(typeLabel) {
  return `<tr>
    <td bgcolor="${COLORS.elevated}" style="padding:24px 28px;background-color:${COLORS.elevated};border-bottom:1px solid ${COLORS.line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td valign="middle">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:23px;line-height:1;font-weight:800;letter-spacing:1.5px;color:${COLORS.strong};">PP AUTO</div>
            <div style="width:58px;height:2px;margin-top:8px;background-color:${COLORS.red};font-size:1px;line-height:1px;">&nbsp;</div>
          </td>
          <td align="right" valign="middle">
            <span style="display:inline-block;padding:7px 10px;border:1px solid #2a4f8d;border-radius:10px;background-color:#101b2d;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#b8cefa;">${escapeText(typeLabel, 180)}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function footerMarkup(disclaimer) {
  return `<tr>
    <td bgcolor="${COLORS.elevated}" style="padding:22px 28px;background-color:${COLORS.elevated};border-top:1px solid ${COLORS.line};">
      <p style="margin:0 0 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;font-weight:700;color:${COLORS.strong};">PP AUTO s.r.o.</p>
      <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.65;color:#a9b3c1;">Partizánska 5660/107 · 058 01 Poprad<br><a href="tel:+421903905280" style="color:#cdd7e5;text-decoration:none;">+421 903 905 280</a> · <a href="mailto:predaj@ppauto.sk" style="color:#cdd7e5;text-decoration:none;">predaj@ppauto.sk</a></p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;line-height:1.6;color:#7f8a9a;">${escapeMultiline(disclaimer, 1500)}</p>
    </td>
  </tr>`;
}

export function renderAdminRequestEmail({
  preheader = 'Nová požiadavka z webu PP AUTO.',
  typeLabel = 'Nová požiadavka',
  title = 'Nová požiadavka',
  reference = '',
  intro = '',
  contacts = [],
  sections = [],
} = {}) {
  const contactMarkup = renderContacts(contacts);

  return `<!doctype html>
<html lang="sk">
${emailHead(title)}
<body style="margin:0;padding:0;width:100%;background-color:${COLORS.background};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${hiddenPreheader(preheader)}
  <center style="width:100%;background-color:${COLORS.background};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.background}" style="width:100%;border-collapse:collapse;background-color:${COLORS.background};mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td align="center" style="padding:24px 10px;">
          ${outlookOpen(COLORS.elevated)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.elevated}" style="width:100%;max-width:640px;border-collapse:separate;background-color:${COLORS.elevated};border:1px solid ${COLORS.line};border-radius:18px;overflow:hidden;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            ${headerMarkup(typeLabel)}
            <tr>
              <td style="padding:28px 28px 20px 28px;">
                ${hasValue(reference) ? `<div style="display:inline-block;margin:0 0 12px 0;padding:6px 10px;border:1px solid #294f8e;border-radius:999px;background-color:#101b2d;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1;font-weight:700;letter-spacing:.65px;color:#b8cefa;">${escapeText(reference, 100)}</div>` : ''}
                <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:27px;line-height:1.22;font-weight:750;letter-spacing:-.4px;color:${COLORS.strong};">${escapeText(title, 300)}</h1>
                ${hasValue(intro) ? `<p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.muted};">${escapeMultiline(intro, 1500)}</p>` : ''}
              </td>
            </tr>
            ${contactMarkup ? `<tr><td style="padding:0 28px 16px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">${contactMarkup}</table></td></tr>` : ''}
            ${renderSections(sections)}
            ${footerMarkup('Automatické oznámenie z webu PP AUTO. Na požiadavku môžete odpovedať priamo cez tlačidlo Odpovedať.')}
          </table>
          ${OUTLOOK_CLOSE}
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

export function renderCustomerConfirmationEmail({
  preheader = 'Potvrdenie prijatia vašej požiadavky v PP AUTO.',
  typeLabel = 'Potvrdenie požiadavky',
  title = 'Ďakujeme za vašu požiadavku',
  greeting = 'Dobrý deň,',
  intro = 'Vašu požiadavku sme úspešne prijali.',
  reference = '',
  summaryLabel = '',
  summaryValue = '',
  sections = [],
  nextStep = 'Náš tím vás bude kontaktovať čo najskôr.',
  disclaimer = 'Tento e-mail je automatické potvrdenie prijatia vašej požiadavky.',
  primaryHref = 'https://ppauto.sk',
  primaryLabel = 'Navštíviť PP AUTO',
} = {}) {
  const hasSummary = hasValue(summaryLabel) && hasValue(summaryValue);
  const safePrimaryHref = /^https?:\/\/[^\s]+$/i.test(clean(primaryHref, 1000)) ? clean(primaryHref, 1000) : 'https://ppauto.sk';

  return `<!doctype html>
<html lang="sk">
${emailHead(title)}
<body style="margin:0;padding:0;width:100%;background-color:${COLORS.background};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${hiddenPreheader(preheader)}
  <center style="width:100%;background-color:${COLORS.background};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.background}" style="width:100%;border-collapse:collapse;background-color:${COLORS.background};mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td align="center" style="padding:24px 10px;">
          ${outlookOpen(COLORS.elevated)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.elevated}" style="width:100%;max-width:640px;border-collapse:separate;background-color:${COLORS.elevated};border:1px solid ${COLORS.line};border-radius:18px;overflow:hidden;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            ${headerMarkup(typeLabel)}
            <tr>
              <td style="padding:29px 28px 21px 28px;">
                ${hasValue(reference) ? `<div style="display:inline-block;margin:0 0 12px 0;padding:6px 10px;border:1px solid #294f8e;border-radius:999px;background-color:#101b2d;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1;font-weight:700;letter-spacing:.65px;color:#b8cefa;">${escapeText(reference, 100)}</div>` : ''}
                <h1 style="margin:0 0 17px 0;font-family:Arial,Helvetica,sans-serif;font-size:27px;line-height:1.23;font-weight:750;letter-spacing:-.35px;color:${COLORS.strong};">${escapeText(title, 300)}</h1>
                <p style="margin:0 0 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;font-weight:700;color:${COLORS.text};">${escapeText(greeting, 300)}</p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${COLORS.muted};">${escapeMultiline(intro, 3000)}</p>
              </td>
            </tr>
            ${hasSummary ? `<tr><td style="padding:0 28px 16px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#101b2d" style="width:100%;border-collapse:separate;background-color:#101b2d;border:1px solid #294f8e;border-radius:14px;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="padding:17px 19px;"><div style="margin:0 0 5px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#9fb8e6;">${escapeText(summaryLabel, 180)}</div><div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.35;font-weight:750;color:${COLORS.strong};word-break:break-word;overflow-wrap:anywhere;">${escapeMultiline(summaryValue, 1000)}</div></td></tr></table></td></tr>` : ''}
            ${renderSections(sections)}
            ${hasValue(nextStep) ? `<tr><td style="padding:0 28px 24px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#101722" style="width:100%;border-collapse:separate;background-color:#101722;border:1px solid ${COLORS.line};border-radius:12px;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td width="4" bgcolor="${COLORS.accent}" style="width:4px;background-color:${COLORS.accent};font-size:1px;line-height:1px;">&nbsp;</td><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.text};">${escapeMultiline(nextStep, 2000)}</td></tr></table></td></tr>` : ''}
            <tr>
              <td align="left" style="padding:0 28px 30px 28px;">
                <a href="${escapeText(safePrimaryHref)}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 19px;border-radius:12px;background-color:${COLORS.primary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1;font-weight:700;text-decoration:none;color:${COLORS.strong};">${escapeText(primaryLabel, 100)} →</a>
              </td>
            </tr>
            ${footerMarkup(`${disclaimer}\nNa tento e-mail môžete odpovedať, ak potrebujete doplniť informácie.`)}
          </table>
          ${OUTLOOK_CLOSE}
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}
