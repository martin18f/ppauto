export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();
  const { key } = req.body || {};

  if (!ADMIN_KEY) {
    console.error('ADMIN_KEY is not configured.');
    return res.status(500).end();
  }

  if (typeof key === 'string' && key === ADMIN_KEY) {
    res.setHeader(
      'Set-Cookie',
      'admin=1; HttpOnly; Path=/; SameSite=Strict'
    );
    return res.status(200).end();
  }

  return res.status(401).end();
}
