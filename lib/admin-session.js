import crypto from 'node:crypto';

const COOKIE_NAME = 'ppauto_admin_session';
const DEFAULT_TTL_SECONDS = 8 * 60 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(String(input || ''), 'base64url').toString('utf8');
}

function sessionSecret() {
  const value = String(process.env.ADMIN_SESSION_SECRET || '').trim();
  if (value.length < 32) {
    const error = new Error('ADMIN_SESSION_SECRET is not configured securely.');
    error.code = 'ADMIN_SESSION_SECRET_MISSING';
    throw error;
  }
  return value;
}

function ttlSeconds() {
  const requested = Number(process.env.ADMIN_SESSION_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.floor(requested), MAX_TTL_SECONDS);
}

function signature(payload) {
  return crypto
    .createHmac('sha256', sessionSecret())
    .update(payload)
    .digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function cookieSecure(req) {
  const rawHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const hostname = rawHost.startsWith('[')
    ? rawHost.slice(1, rawHost.indexOf(']'))
    : rawHost.split(':')[0];

  // Local Vercel development runs over plain HTTP. Never mark that cookie Secure,
  // even if a local proxy happens to provide an HTTPS-looking forwarded header.
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;

  return process.env.NODE_ENV === 'production' ||
    String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase() === 'https';
}

export function safeSecretEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a || '')).digest();
  const right = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(left, right);
}

export function createAdminSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payloadObject = {
    v: 1,
    iat: now,
    exp: now + ttlSeconds(),
  };
  const payload = base64url(JSON.stringify(payloadObject));
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSessionToken(token) {
  try {
    const [payload, suppliedSignature, extra] = String(token || '').split('.');
    if (!payload || !suppliedSignature || extra) return false;
    if (!safeEqual(signature(payload), suppliedSignature)) return false;

    const parsed = JSON.parse(fromBase64url(payload));
    const now = Math.floor(Date.now() / 1000);
    return parsed?.v === 1 &&
      Number.isSafeInteger(parsed?.iat) &&
      Number.isSafeInteger(parsed?.exp) &&
      parsed.iat <= now + 60 &&
      parsed.exp > now;
  } catch {
    return false;
  }
}

export function parseCookies(req) {
  const out = {};
  String(req?.headers?.cookie || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(part => {
      const idx = part.indexOf('=');
      if (idx <= 0) return;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    });
  return out;
}

export function hasAdminSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  return verifyAdminSessionToken(token);
}

export function adminSessionCookie(token, req) {
  const secure = cookieSecure(req);
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
    `Max-Age=${ttlSeconds()}`,
  ].filter(Boolean).join('; ');
}

export function clearLegacyAdminCookie(req) {
  const secure = cookieSecure(req);
  return [
    'admin=',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
}

export function clearAdminSessionCookie(req) {
  const secure = cookieSecure(req);
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
}
