// POST /api/admin/logout — wylogowanie (usuwa sesję panelu i sesję ochrony).
import { clearSessionCookies, j } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  res.setHeader('Set-Cookie', clearSessionCookies());
  j(res, 200, { ok: true });
}
