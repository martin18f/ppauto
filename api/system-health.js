import { hasAdminSession } from '../lib/admin-session.js';

function json(res, status, payload) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie');
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  try {
    if (!hasAdminSession(req)) return json(res, 401, { error: 'Unauthorized' });
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

    const now = new Date().toISOString();
    return json(res, 200, {
      status: 'ok',
      checkedAt: now,
      services: {
        admin: { status: 'ok', checkedAt: now },
        website: { status: 'pending', checkedAt: null },
        database: { status: 'pending', checkedAt: null },
        forms: { status: 'pending', checkedAt: null }
      },
      monitoring: {
        availabilityIntervalMinutes: 5,
        formsIntervalMinutes: 60,
        fullAuditIntervalHours: 24
      },
      criticalAlertEmail: 'adminppauto@gmail.com'
    });
  } catch (error) {
    console.error('system-health:', error?.code || error?.message || error);
    return json(res, 500, { error: 'System health check failed' });
  }
}
