function hasAdminSession(req) {
  return /(?:^|;\s*)admin=1(?:;|$)/.test(String(req.headers.cookie || ''));
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).send('');
  }

  // Fail closed: bez platnej admin session sa premenná nenastaví na visible.
  // admin-options.css používa fallback `hidden`, takže obsah adminu sa nikdy
  // nevykreslí ešte pred dokončením auth kontroly.
  const css = hasAdminSession(req)
    ? ':root{--admin-auth-visibility:visible;}\n'
    : ':root{--admin-auth-visibility:hidden;}\n';

  return res.status(200).send(css);
}
