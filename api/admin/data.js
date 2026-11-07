// GET /api/admin/data?start=YYYY-MM-DD — kalendarz tygodnia i najbliższe wizyty (wymaga sesji).
// GET /api/admin/data?cron=cleanup     — codzienne kasowanie starych danych (RODO).
import {
  ensureSchema, sql, getSchedule, isValidDate, weekdayOf, weekDates, requireAuth,
  purgeOldData, isCronAuthorized, j,
} from '../_lib.js';

const UPCOMING_LIMIT = 20;

export default async function handler(req, res) {
  if (req.method !== 'GET') return j(res, 405, { error: 'Method not allowed' });

  if (req.query.cron === 'cleanup') {
    if (!isCronAuthorized(req)) return j(res, 401, { error: 'Brak uprawnień' });
    try {
      await ensureSchema();
      const removed = await purgeOldData();
      console.log('cleanup RODO:', removed);
      return j(res, 200, { ok: true, removed });
    } catch (err) {
      console.error('cleanup error:', err);
      return j(res, 500, { error: 'Błąd serwera' });
    }
  }

  if (!requireAuth(req, res)) return;
  try {
    await ensureSchema();
    const { start } = req.query;
    if (!isValidDate(start) || weekdayOf(start) !== 1) {
      return j(res, 400, { error: 'Parametr start musi być poniedziałkiem.' });
    }
    const end = weekDates(start).at(-1);

    // Niezależne odczyty równolegle — sterownik Neon wysyła każde zapytanie osobnym żądaniem.
    const [schedule, bookings, blocks, upcoming] = await Promise.all([
      getSchedule(),
      sql`SELECT id, slot_date::text AS slot_date, slot_min, name, phone, source
        FROM bookings WHERE status = 'confirmed' AND slot_date BETWEEN ${start} AND ${end}
        ORDER BY slot_date, slot_min`,
      sql`SELECT slot_date::text AS slot_date, slot_min FROM blocks
        WHERE slot_date BETWEEN ${start} AND ${end}`,
      sql`SELECT id, slot_date::text AS slot_date, slot_min, name, phone, source
        FROM bookings WHERE status = 'confirmed' AND slot_date >= CURRENT_DATE
        ORDER BY slot_date, slot_min LIMIT ${UPCOMING_LIMIT}`,
    ]);

    j(res, 200, { schedule, bookings, blocks, upcoming });
  } catch (err) {
    console.error('admin/data error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
