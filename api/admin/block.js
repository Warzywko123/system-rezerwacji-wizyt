// POST /api/admin/block — wyłączanie terminów z rezerwacji (wymaga sesji), np. na urlop.
// action: 'block' | 'unblock' (jeden termin, z min) | 'block-day' | 'unblock-day'
import { ensureSchema, sql, getSchedule, startsFor, isValidDate, requireAuth, j, readBody } from '../_lib.js';

const isBooked = async (date, min) =>
  (await sql`SELECT 1 FROM bookings
    WHERE slot_date = ${date} AND slot_min = ${min} AND status = 'confirmed'`).length > 0;

const addBlock = (date, min) => sql`INSERT INTO blocks (slot_date, slot_min) VALUES (${date}, ${min})
  ON CONFLICT (slot_date, slot_min) DO NOTHING`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;
  try {
    await ensureSchema();
    const { date, min, action } = readBody(req);
    if (!isValidDate(date)) return j(res, 400, { error: 'Nieprawidłowa data' });
    const starts = startsFor(await getSchedule(), date);

    if (action === 'block' || action === 'unblock') {
      const m = Number(min);
      if (!Number.isInteger(m)) return j(res, 400, { error: 'Nieprawidłowa godzina' });
      // Odblokować można też termin, którego po zmianie grafiku już w nim nie ma.
      if (action === 'unblock') {
        await sql`DELETE FROM blocks WHERE slot_date = ${date} AND slot_min = ${m}`;
        return j(res, 200, { ok: true });
      }
      if (!starts.includes(m)) return j(res, 400, { error: 'Termin poza godzinami przyjęć.' });
      if (await isBooked(date, m)) return j(res, 409, { error: 'Na ten termin jest wizyta — najpierw ją odwołaj.' });
      await addBlock(date, m);
      return j(res, 200, { ok: true });
    }

    if (action === 'block-day') {
      // Wizyt już umówionych nie ruszamy — blokujemy tylko wolne terminy.
      for (const m of starts) {
        if (!(await isBooked(date, m))) await addBlock(date, m);
      }
      return j(res, 200, { ok: true });
    }

    if (action === 'unblock-day') {
      await sql`DELETE FROM blocks WHERE slot_date = ${date}`;
      return j(res, 200, { ok: true });
    }

    j(res, 400, { error: 'Nieznana akcja' });
  } catch (err) {
    console.error('admin/block error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
