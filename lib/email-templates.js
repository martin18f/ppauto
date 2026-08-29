const COLORS = {
  accent: '#d5aa45',
  adminBackground: '#080b0f',
  adminPanel: '#111820',
  adminSection: '#17202a',
  adminBorder: '#2a3542',
  adminText: '#f4f6f8',
  adminMuted: '#aab4bf',
  customerBackground: '#edf0f3',
  customerText: '#18202a',
  customerMuted: '#65707c',
  customerBorder: '#dfe4e9',
  white: '#ffffff',
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

function renderAdminRows(items) {
  return normalizeItems(items).map((item, index) => `
    <tr>
      <td width="34%" valign="top" style="width:34%;padding:${index ? '14px' : '0'} 14px ${index ? '14px' : '14px'} 0;${index ? `border-top:1px solid ${COLORS.adminBorder};` : ''}font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;color:${COLORS.adminMuted};">
        ${escapeText(item.label)}
      </td>
      <td valign="top" style="padding:${index ? '14px' : '0'} 0 ${index ? '14px' : '14px'} 10px;${index ? `border-top:1px solid ${COLORS.adminBorder};` : ''}font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${COLORS.adminText};word-break:break-word;overflow-wrap:anywhere;">
        ${escapeMultiline(item.value)}
      </td>
    </tr>`).join('');
}

function renderCustomerRows(items) {
  return normalizeItems(items).map((item, index) => `
    <tr>
      <td width="34%" valign="top" style="width:34%;padding:${index ? '13px' : '0'} 14px ${index ? '13px' : '13px'} 0;${index ? `border-top:1px solid ${COLORS.customerBorder};` : ''}font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${COLORS.customerMuted};">
        ${escapeText(item.label)}
      </td>
      <td valign="top" style="padding:${index ? '13px' : '0'} 0 ${index ? '13px' : '13px'} 10px;${index ? `border-top:1px solid ${COLORS.customerBorder};` : ''}font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${COLORS.customerText};word-break:break-word;overflow-wrap:anywhere;">
        ${escapeMultiline(item.value)}
      </td>
    </tr>`).join('');
}

function renderAdminContacts(contacts) {
  return normalizeItems(contacts).map(item => `
    <tr>
      <td style="padding:0 0 9px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.adminSection}" style="width:100%;border-collapse:separate;background-color:${COLORS.adminSection};border:1px solid ${COLORS.adminBorder};border-left:4px solid ${COLORS.accent};border-radius:5px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td style="padding:15px 17px;">
              <div style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${COLORS.adminMuted};">${escapeText(item.label)}</div>
              <div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.35;font-weight:700;color:${COLORS.white};word-break:break-word;overflow-wrap:anywhere;">${escapeMultiline(item.value)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');
}

function renderAdminSections(sections) {
  return normalizeSections(sections).map(section => `
    <tr>
      <td style="padding:0 28px 18px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.adminSection}" style="width:100%;border-collapse:separate;background-color:${COLORS.adminSection};border:1px solid ${COLORS.adminBorder};border-radius:6px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td style="padding:18px 20px 4px 20px;">
              <div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${COLORS.accent};">${escapeText(section.title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px 5px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                ${renderAdminRows(section.items)}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');
}

function renderCustomerSections(sections) {
  return normalizeSections(sections).map(section => `
    <tr>
      <td style="padding:0 28px 18px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f8fa" style="width:100%;border-collapse:separate;background-color:#f7f8fa;border:1px solid ${COLORS.customerBorder};border-radius:6px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td style="padding:18px 20px 4px 20px;">
              <div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;color:#9a7120;">${escapeText(section.title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px 5px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                ${renderCustomerRows(section.items)}
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

export function renderAdminRequestEmail({
  preheader = 'Nová požiadavka z webu PP AUTO.',
  typeLabel = 'Nová požiadavka',
  title = 'Nová požiadavka',
  reference = '',
  intro = '',
  contacts = [],
  sections = [],
} = {}) {
  const safePreheader = escapeText(preheader, 500);
  const safeType = escapeText(typeLabel, 180);
  const safeReference = escapeText(reference, 100);
  const contactMarkup = renderAdminContacts(contacts);

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeText(title, 300)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${COLORS.adminBackground};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">${safePreheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <center style="width:100%;background-color:${COLORS.adminBackground};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.adminBackground}" style="width:100%;border-collapse:collapse;background-color:${COLORS.adminBackground};mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td align="center" style="padding:24px 10px;">
          ${outlookOpen(COLORS.adminPanel)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.adminPanel}" style="width:100%;max-width:640px;border-collapse:separate;background-color:${COLORS.adminPanel};border:1px solid #242e39;border-radius:8px;overflow:hidden;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>
              <td bgcolor="#0d131a" style="padding:28px;border-bottom:3px solid ${COLORS.accent};background-color:#0d131a;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                  <tr>
                    <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1;font-weight:800;letter-spacing:2px;color:${COLORS.white};">PP <span style="color:${COLORS.accent};">AUTO</span></td>
                    <td align="right" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.accent};">${safeType}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 20px 28px;">
                ${safeReference ? `<div style="display:inline-block;margin:0 0 12px 0;padding:6px 10px;border:1px solid #735f2f;border-radius:3px;background-color:#211d14;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1;font-weight:700;letter-spacing:0.8px;color:${COLORS.accent};">${safeReference}</div>` : ''}
                <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.2;font-weight:700;color:${COLORS.white};">${escapeText(title, 300)}</h1>
                ${hasValue(intro) ? `<p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${COLORS.adminMuted};">${escapeMultiline(intro, 1500)}</p>` : ''}
              </td>
            </tr>
            ${contactMarkup ? `
            <tr>
              <td style="padding:0 28px 18px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                  ${contactMarkup}
                </table>
              </td>
            </tr>` : ''}
            ${renderAdminSections(sections)}
            <tr>
              <td bgcolor="#0d131a" style="padding:20px 28px;background-color:#0d131a;border-top:1px solid ${COLORS.adminBorder};font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#7f8b97;">
                Automatické oznámenie z webu PP AUTO. Na požiadavku môžete odpovedať priamo cez tlačidlo Odpovedať.
              </td>
            </tr>
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
} = {}) {
  const safeReference = escapeText(reference, 100);
  const hasSummary = hasValue(summaryLabel) && hasValue(summaryValue);

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeText(title, 300)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${COLORS.customerBackground};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">${escapeText(preheader, 500)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <center style="width:100%;background-color:${COLORS.customerBackground};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.customerBackground}" style="width:100%;border-collapse:collapse;background-color:${COLORS.customerBackground};mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td align="center" style="padding:24px 10px;">
          ${outlookOpen(COLORS.white)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.white}" style="width:100%;max-width:640px;border-collapse:separate;background-color:${COLORS.white};border:1px solid #d9dee4;border-radius:8px;overflow:hidden;mso-table-lspace:0pt;mso-table-rspace:0pt;">
            <tr>
              <td bgcolor="#0d131a" style="padding:28px;background-color:#0d131a;border-bottom:3px solid ${COLORS.accent};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                  <tr>
                    <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1;font-weight:800;letter-spacing:2px;color:${COLORS.white};">PP <span style="color:${COLORS.accent};">AUTO</span></td>
                    <td align="right" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#d9e0e7;">${escapeText(typeLabel, 180)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 22px 28px;">
                ${safeReference ? `<div style="display:inline-block;margin:0 0 13px 0;padding:6px 10px;border:1px solid #e1cc99;border-radius:3px;background-color:#fbf7ec;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1;font-weight:700;letter-spacing:0.8px;color:#84621b;">${safeReference}</div>` : ''}
                <h1 style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:27px;line-height:1.25;font-weight:700;color:${COLORS.customerText};">${escapeText(title, 300)}</h1>
                <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;font-weight:700;color:${COLORS.customerText};">${escapeText(greeting, 300)}</p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${COLORS.customerMuted};">${escapeMultiline(intro, 3000)}</p>
              </td>
            </tr>
            ${hasSummary ? `
            <tr>
              <td style="padding:0 28px 18px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#171f28" style="width:100%;border-collapse:separate;background-color:#171f28;border-left:4px solid ${COLORS.accent};border-radius:6px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="margin:0 0 5px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.3;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#adb7c1;">${escapeText(summaryLabel, 180)}</div>
                      <div style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.35;font-weight:700;color:${COLORS.white};word-break:break-word;overflow-wrap:anywhere;">${escapeMultiline(summaryValue, 1000)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>` : ''}
            ${renderCustomerSections(sections)}
            ${hasValue(nextStep) ? `
            <tr>
              <td style="padding:2px 28px 26px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                  <tr>
                    <td width="4" bgcolor="${COLORS.accent}" style="width:4px;background-color:${COLORS.accent};font-size:1px;line-height:1px;">&nbsp;</td>
                    <td style="padding:2px 0 2px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${COLORS.customerText};">${escapeMultiline(nextStep, 2000)}</td>
                  </tr>
                </table>
              </td>
            </tr>` : ''}
            <tr>
              <td align="center" style="padding:0 28px 30px 28px;">
                <a href="https://ppauto.sk" target="_blank" style="display:inline-block;padding:13px 22px;border-radius:4px;background-color:#111820;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1;font-weight:700;letter-spacing:0.5px;text-decoration:none;color:${COLORS.white};">Navštíviť PP AUTO</a>
              </td>
            </tr>
            <tr>
              <td bgcolor="#0d131a" style="padding:22px 28px;background-color:#0d131a;border-top:3px solid ${COLORS.accent};">
                <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;font-weight:700;color:${COLORS.white};">PP AUTO s.r.o.</p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8e99a5;">${escapeMultiline(disclaimer, 1500)}<br>Na tento e-mail môžete odpovedať, ak potrebujete doplniť informácie.</p>
              </td>
            </tr>
          </table>
          ${OUTLOOK_CLOSE}
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}
