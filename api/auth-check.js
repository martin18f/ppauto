function hasAdminSession(req) {
  return /(?:^|;\s*)admin=1(?:;|$)/.test(String(req.headers.cookie || ''));
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');

  if (hasAdminSession(req)) {
    return res.status(200).end();
  }
  return res.status(401).end();
}
