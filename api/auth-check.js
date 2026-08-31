import { hasAdminSession } from '../lib/admin-session.js';
import { handlePpAutoSystem, handlePublicPpAutoLead } from '../lib/ppauto-system.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');

  try {
    const mode = String(req.query?.mode || '').toLowerCase();
    if (mode === 'system') return handlePpAutoSystem(req, res);
    if (mode === 'system-public') return handlePublicPpAutoLead(req, res);

    if (hasAdminSession(req)) return res.status(200).end();
    return res.status(401).end();
  } catch (error) {
    console.error(error?.code || error?.message || error);
    return res.status(500).end();
  }
}
