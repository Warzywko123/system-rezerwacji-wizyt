// POST /api/admin/login — hasło + kod z aplikacji uwierzytelniającej (2FA) → ciasteczko sesji.
// Limit: LOGIN_MAX_FAILS nieudanych prób z jednego IP w ciągu LOGIN_WINDOW_MIN minut.
import crypto from 'node:crypto';
import {
  ensureSchema, sql, makeSessionCookie, j, readBody, ipHashOf, verifyTOTP,
  LOGIN_MAX_FAILS, LOGIN_WINDOW_MIN,
} from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  try {
    await ensureSchema();
    const ipHash = ipHashOf(req);

    const [{ count }] = await sql`SELECT count(*)::int AS count FROM login_attempts
      WHERE ip_hash = ${ipHash} AND attempted_at > now() - make_interval(mins => ${LOGIN_WINDOW_MIN}::int)`;
    if (count >= LOGIN_MAX_FAILS) {
      return j(res, 429, { error: `Zbyt wiele prób logowania. Spróbuj za ${LOGIN_WINDOW_MIN} minut.` });
    }

    // 2FA jest obowiązkowe: bez sekretu panel nikogo nie wpuszcza (fail closed).
    const totpSecret = process.env.ADMIN_TOTP_SECRET ?? '';
    if (!totpSecret) {
      console.error('login: brak ADMIN_TOTP_SECRET — logowanie zablokowane');
      return j(res, 503, { error: 'Panel chwilowo niedostępny — brak konfiguracji 2FA.' });
    }

    const body = readBody(req);
    const good = process.env.ADMIN_PASSWORD ?? '';
    const hash = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest();
    const passOk = Boolean(good) && crypto.timingSafeEqual(hash(body.password), hash(good));
    const totpOk = verifyTOTP(totpSecret, body.totp);

    // Jeden ogólny komunikat — nie zdradzamy, czy pomylono hasło, czy kod.
    if (!passOk || !totpOk) {
      await sql`INSERT INTO login_attempts (ip_hash) VALUES (${ipHash})`;
      await new Promise((r) => setTimeout(r, 600));
      return j(res, 401, { error: 'Nieprawidłowe hasło lub kod.' });
    }

    res.setHeader('Set-Cookie', makeSessionCookie());
    j(res, 200, { ok: true });
  } catch (err) {
    console.error('login error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
