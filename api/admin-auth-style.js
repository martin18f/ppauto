import { hasAdminSession } from '../lib/admin-session.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).send('');
  }

  let visible = false;
  try { visible = hasAdminSession(req); } catch (error) { console.error(error?.code || error?.message || error); }
  const css = visible
    ? ':root{--admin-auth-visibility:visible;}\n'
    : ':root{--admin-auth-visibility:hidden;}\n';
  return res.status(200).send(css);
}
