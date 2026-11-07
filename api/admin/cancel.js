// POST /api/admin/cancel — odwołanie wizyty (wymaga sesji). System nie wysyła SMS-ów
// ani e-maili: panel przypomina, żeby zadzwonić do klienta.
import { ensureSchema, sql, getSchedule, startsFor, requireAuth, j, readBody } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;
  try {
    await ensureSchema();
    const id = Number(readBody(req).id);
    if (!Number.isInteger(id)) return j(res, 400, { error: 'Nieprawidłowe id' });

    const rows = await sql`UPDATE bookings SET status = 'cancelled'
      WHERE id = ${id} AND status = 'confirmed'
      RETURNING phone, slot_date::text AS slot_date, slot_min`;
    if (!rows.length) return j(res, 404, { error: 'Nie znaleziono wizyty.' });

    // Jeśli wszystkie pozostałe wolne terminy tego dnia są zablokowane (np. urlop),
    // blokujemy też zwolniony termin, żeby nie wrócił po cichu do rezerwacji online.
    const { slot_date: date, slot_min: min, phone } = rows[0];
    const starts = startsFor(await getSchedule(), date);
    if (starts.length) {
      const [{ bl }] = await sql`SELECT count(*)::int AS bl FROM blocks
        WHERE slot_date = ${date} AND slot_min = ANY(${starts})`;
      const [{ bk }] = await sql`SELECT count(*)::int AS bk FROM bookings
        WHERE slot_date = ${date} AND status = 'confirmed' AND slot_min = ANY(${starts})`;
      if (bl > 0 && bl === starts.length - bk - 1) {
        await sql`INSERT INTO blocks (slot_date, slot_min) VALUES (${date}, ${min})
          ON CONFLICT (slot_date, slot_min) DO NOTHING`;
      }
    }

    j(res, 200, { ok: true, phone });
  } catch (err) {
    console.error('admin/cancel error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
