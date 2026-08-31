import {
  adminSessionCookie,
  clearAdminSessionCookie,
  clearLegacyAdminCookie,
  createAdminSessionToken,
  safeSecretEqual,
} from '../lib/admin-session.js';

function parseLoginBody(body) {
  if (!body) return {};
  if (Buffer.isBuffer(body)) {
    try { return JSON.parse(body.toString('utf8')); } catch { return {}; }
  }
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  if (typeof body === 'object' && !Array.isArray(body)) return body;
  return {};
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [clearAdminSessionCookie(req), clearLegacyAdminCookie(req)]);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).end();
  }

  const adminKey = String(process.env.ADMIN_KEY || '').trim();
  const body = parseLoginBody(req.body);
  const supplied = String(body.key || '').trim();

  if (!adminKey) {
    console.error('ADMIN_KEY is not configured.');
    return res.status(500).json({ error: 'Administrácia nie je nakonfigurovaná.' });
  }

  try {
    if (!safeSecretEqual(supplied, adminKey)) {
      res.setHeader('Set-Cookie', [clearAdminSessionCookie(req), clearLegacyAdminCookie(req)]);
      return res.status(401).json({ error: 'Neplatné prihlasovacie údaje.' });
    }

    const token = createAdminSessionToken();
    res.setHeader('Set-Cookie', [adminSessionCookie(token, req), clearLegacyAdminCookie(req)]);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error?.code || error?.message || error);
    return res.status(500).json({ error: 'Administrácia nie je bezpečne nakonfigurovaná.' });
  }
}
