export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const ADMIN_KEY = 'adminppauto123';
  const { key } = req.body || {};

  if (key === ADMIN_KEY) {
    res.setHeader(
      'Set-Cookie',
      'admin=1; HttpOnly; Path=/; SameSite=Strict'
    );
    return res.status(200).end();
  }

  return res.status(401).end();
}
