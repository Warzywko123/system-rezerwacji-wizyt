// GET /api/ochrona/today — lista dzisiejszych wizyt dla ochroniarza (wymaga sesji ochrony).
// Minimum danych (RODO): tylko godzina oraz imię i nazwisko — bez telefonu i sposobu umówienia.
import { ensureSchema, sql, warsawToday, minToHHMM, requireAuth, j } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return j(res, 405, { error: 'Method not allowed' });
  if (!requireAuth(req, res, 'guard')) return;
  try {
    await ensureSchema();
    const date = warsawToday();
    const rows = await sql`SELECT slot_min, name FROM bookings
      WHERE status = 'confirmed' AND slot_date = ${date} ORDER BY slot_min`;
    j(res, 200, { date, visits: rows.map((r) => ({ time: minToHHMM(r.slot_min), name: r.name })) });
  } catch (err) {
    console.error('ochrona/today error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
