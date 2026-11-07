// GET /api/slots?start=YYYY-MM-DD (poniedziałek) — wolne terminy tygodnia dla klienta.
// Publiczne: zwraca tylko „wolny / niedostępny", bez powodu i bez danych innych osób.
import {
  ensureSchema, sql, getSchedule, startsFor, isValidDate, weekdayOf, weekDates,
  slotBookableOnline, minToHHMM, contactPhone, j,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return j(res, 405, { error: 'Method not allowed' });
  try {
    await ensureSchema();
    const { start } = req.query;
    if (!isValidDate(start) || weekdayOf(start) !== 1) {
      return j(res, 400, { error: 'Parametr start musi być poniedziałkiem (RRRR-MM-DD).' });
    }
    const dates = weekDates(start);
    const end = dates.at(-1);

    const [schedule, booked, blocked] = await Promise.all([
      getSchedule(),
      sql`SELECT slot_date::text AS slot_date, slot_min FROM bookings
        WHERE status = 'confirmed' AND slot_date BETWEEN ${start} AND ${end}`,
      sql`SELECT slot_date::text AS slot_date, slot_min FROM blocks
        WHERE slot_date BETWEEN ${start} AND ${end}`,
    ]);
    const taken = new Set([...booked, ...blocked].map((r) => `${r.slot_date}|${r.slot_min}`));

    const days = dates.map((date) => ({
      date,
      slots: startsFor(schedule, date).map((min) => ({
        min,
        time: minToHHMM(min),
        available: slotBookableOnline(date, min) && !taken.has(`${date}|${min}`),
      })),
    }));

    j(res, 200, { days, contactPhone: contactPhone() });
  } catch (err) {
    console.error('slots error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
