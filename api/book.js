// POST /api/book — rezerwacja wizyty przez klienta (potwierdzana automatycznie).
import {
  ensureSchema, sql, getSchedule, startsFor, isValidDate, slotBookableOnline,
  cleanName, cleanPhone, isValidPhone, ipHashOf, contactPhone, j, readBody,
  MAX_ACTIVE_PER_PHONE, MAX_PER_IP_DAILY,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  const phoneHint = `zadzwoń do gabinetu: ${contactPhone()}`;
  try {
    await ensureSchema();
    const b = readBody(req);

    // Ukryte pole — wypełniają je tylko boty. Udajemy sukces, niczego nie zapisujemy.
    if (b.website) return j(res, 200, { ok: true });

    if (b.rodo !== true) return j(res, 400, { error: 'Wymagana zgoda na przetwarzanie danych.' });

    const name = cleanName(b.name);
    if (name.error) return j(res, 400, { error: name.error });

    const phone = cleanPhone(b.phone);
    if (!isValidPhone(phone)) return j(res, 400, { error: 'Podaj poprawny 9-cyfrowy numer telefonu.' });

    const { date } = b;
    const min = Number(b.min);
    if (!isValidDate(date) || !Number.isInteger(min)) return j(res, 400, { error: 'Nieprawidłowy termin.' });

    const inSchedule = startsFor(await getSchedule(), date).includes(min);
    if (!inSchedule || !slotBookableOnline(date, min)) {
      return j(res, 400, { error: 'Ten termin nie jest dostępny do rezerwacji online.' });
    }

    const blocked = await sql`SELECT 1 FROM blocks WHERE slot_date = ${date} AND slot_min = ${min}`;
    if (blocked.length) return j(res, 409, { error: 'Ten termin został właśnie zajęty. Wybierz inny.' });

    const [{ count: active }] = await sql`SELECT count(*)::int AS count FROM bookings
      WHERE phone = ${phone} AND status = 'confirmed' AND slot_date >= CURRENT_DATE`;
    if (active >= MAX_ACTIVE_PER_PHONE) {
      return j(res, 429, { error: `Masz już ${MAX_ACTIVE_PER_PHONE} aktywne rezerwacje. W sprawie kolejnych ${phoneHint}.` });
    }

    // Ochrona przed zapchaniem kalendarza fałszywymi wpisami z różnych numerów.
    const ipHash = ipHashOf(req);
    const [{ count: fromIp }] = await sql`SELECT count(*)::int AS count FROM bookings
      WHERE ip_hash = ${ipHash} AND created_at > now() - INTERVAL '24 hours'`;
    if (fromIp >= MAX_PER_IP_DAILY) {
      return j(res, 429, { error: `Limit rezerwacji online na dziś został wyczerpany — ${phoneHint}.` });
    }

    try {
      await sql`INSERT INTO bookings (slot_date, slot_min, name, phone, source, ip_hash)
        VALUES (${date}, ${min}, ${name.value}, ${phone}, 'online', ${ipHash})`;
    } catch (err) {
      // Unikalny indeks: ktoś zajął ten termin ułamek sekundy wcześniej.
      if (err.code === '23505') return j(res, 409, { error: 'Ten termin został właśnie zajęty. Wybierz inny.' });
      throw err;
    }

    j(res, 200, { ok: true });
  } catch (err) {
    console.error('book error:', err);
    j(res, 500, { error: `Błąd serwera. Spróbuj ponownie lub ${phoneHint}.` });
  }
}
