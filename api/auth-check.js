import { hasAdminSession } from '../lib/admin-session.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');

  try {
    if (hasAdminSession(req)) return res.status(200).end();
    return res.status(401).end();
  } catch (error) {
    console.error(error?.code || error?.message || error);
    return res.status(500).end();
  }
}
