// POST /api/admin/book — wpisanie wizyty klienta umówionego telefonicznie (wymaga sesji).
// Tylko w godzinach grafiku, ale bez limitu 24 h (można wpisać wizytę nawet na dziś)
// i bez limitów numeru/IP — wpis tworzy personel gabinetu.
import {
  ensureSchema, sql, getSchedule, startsFor, isValidDate, slotIsOver,
  cleanName, cleanPhone, isValidPhone, requireAuth, j, readBody,
} from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;
  try {
    await ensureSchema();
    const b = readBody(req);

    const { date } = b;
    const min = Number(b.min);
    if (!isValidDate(date) || !Number.isInteger(min)) return j(res, 400, { error: 'Nieprawidłowy termin.' });
    if (!startsFor(await getSchedule(), date).includes(min)) {
      return j(res, 400, { error: 'Termin poza godzinami przyjęć.' });
    }
    if (slotIsOver(date, min)) return j(res, 400, { error: 'Ten termin już minął.' });

    const name = cleanName(b.name);
    if (name.error) return j(res, 400, { error: name.error });

    // Telefon opcjonalny — klient mógł go nie podać przez telefon.
    const phone = cleanPhone(b.phone);
    if (phone && !isValidPhone(phone)) return j(res, 400, { error: 'Telefon musi mieć 9 cyfr (albo zostaw puste).' });

    try {
      await sql`INSERT INTO bookings (slot_date, slot_min, name, phone, source)
        VALUES (${date}, ${min}, ${name.value}, ${phone}, 'telefon')`;
    } catch (err) {
      if (err.code === '23505') return j(res, 409, { error: 'Na ten termin jest już wizyta.' });
      throw err;
    }

    // Dopiero po udanym zapisie zdejmujemy ewentualną blokadę tego terminu.
    await sql`DELETE FROM blocks WHERE slot_date = ${date} AND slot_min = ${min}`;
    j(res, 200, { ok: true });
  } catch (err) {
    console.error('admin/book error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
