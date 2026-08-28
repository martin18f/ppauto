import nodemailer from 'nodemailer';

let transporter = null;

function clean(value, max = 5000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, max);
}

function boolEnv(name, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function html(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function smtpConfig() {
  const host = clean(process.env.SMTP_HOST || 'smtp.gmail.com', 200);
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = boolEnv('SMTP_SECURE', port === 465);
  const user = clean(process.env.SMTP_USER, 300);
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!host || !Number.isInteger(port) || port <= 0 || !user || !pass) {
    const error = new Error('SMTP is not configured.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  return { host, port, secure, user, pass };
}

function getTransporter() {
  if (transporter) return transporter;
  const cfg = smtpConfig();
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
}

function sender() {
  const fallback = clean(process.env.SMTP_USER, 300);
  const address = clean(process.env.MAIL_FROM_ADDRESS || fallback, 300);
  const name = clean(process.env.MAIL_FROM_NAME || 'PP AUTO', 150);
  if (!address) throw new Error('MAIL_FROM_ADDRESS is not configured.');
  return name ? `"${name.replace(/"/g, '')}" <${address}>` : address;
}

function destination(kind) {
  const map = {
    orders: 'MAIL_TO_ORDERS',
    contact: 'MAIL_TO_CONTACT',
    finance: 'MAIL_TO_FINANCE',
    testdrive: 'MAIL_TO_TESTDRIVE',
  };
  return clean(process.env[map[kind]] || process.env.MAIL_TO_DEFAULT, 500);
}

function customerConfirmationsEnabled() {
  return boolEnv('MAIL_SEND_CUSTOMER_CONFIRMATIONS', true);
}

function mailEnabled() {
  return boolEnv('MAIL_ENABLED', true);
}

export function smtpPublicStatus() {
  return {
    enabled: mailEnabled(),
    configured: !!(
      clean(process.env.SMTP_HOST || 'smtp.gmail.com') &&
      clean(process.env.SMTP_USER) &&
      String(process.env.SMTP_PASS || '').trim() &&
      clean(process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER)
    ),
  };
}

export async function sendAdminMail({ kind, subject, text, htmlBody, replyTo }) {
  if (!mailEnabled()) return { sent: false, skipped: true };
  const to = destination(kind);
  if (!to) return { sent: false, skipped: true };

  const info = await getTransporter().sendMail({
    from: sender(),
    to,
    replyTo: clean(replyTo || process.env.MAIL_REPLY_TO, 300) || undefined,
    subject: clean(subject, 300),
    text: clean(text, 20000),
    html: htmlBody || `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111">${html(text)}</div>`,
  });
  return { sent: true, messageId: clean(info?.messageId, 300) };
}

export async function sendCustomerMail({ to, subject, text, htmlBody }) {
  const address = clean(to, 300);
  if (!mailEnabled() || !customerConfirmationsEnabled() || !address) {
    return { sent: false, skipped: true };
  }

  const info = await getTransporter().sendMail({
    from: sender(),
    to: address,
    replyTo: clean(process.env.MAIL_REPLY_TO || process.env.MAIL_TO_DEFAULT, 300) || undefined,
    subject: clean(subject, 300),
    text: clean(text, 20000),
    html: htmlBody || `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111">${html(text)}</div>`,
  });
  return { sent: true, messageId: clean(info?.messageId, 300) };
}
