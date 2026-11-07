// Wspólne narzędzia API systemu rezerwacji wizyt.
// Plik z prefiksem "_" — Vercel nie wystawia go jako endpointu.
import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

// Produkcja: Neon (Postgres przez HTTP). Lokalnie (PGLITE_DIR): PGlite — Postgres w procesie
// z tym samym interfejsem tagged-template. Specyfikator w zmiennej, żeby bundler Vercela
// nie pakował zależności deweloperskiej do funkcji produkcyjnych.
async function makeSql() {
  if (process.env.PGLITE_DIR) {
    const spec = '@electric-sql/pglite';
    const { PGlite } = await import(spec);
    const db = new PGlite(process.env.PGLITE_DIR);
    return async (strings, ...values) => {
      const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
      return (await db.query(text, values)).rows;
    };
  }
  return neon(process.env.DATABASE_URL);
}

export const sql = await makeSql();

// ---------- Reguły rezerwacji ----------
export const MIN_LEAD_HOURS = 24; // rezerwacja online najwcześniej 24 h przed wizytą
export const MAX_DAYS_AHEAD = 28; // i najpóźniej 28 dni przed nią
export const SLOT_MINUTES = 50; // długość sesji
export const MAX_ACTIVE_PER_PHONE = 2; // aktywne rezerwacje na jeden numer telefonu
export const MAX_PER_IP_DAILY = 3; // rezerwacje online z jednego adresu IP na dobę
export const LOGIN_MAX_FAILS = 8; // nieudane logowania z jednego IP...
export const LOGIN_WINDOW_MIN = 15; // ...w ciągu tylu minut
export const RETENTION_DAYS = 7; // dane wizyty kasowane tyle dni po terminie (RODO)

// Numer gabinetu pokazywany klientom (odwołania tylko telefonicznie). Z konfiguracji,
// żeby w kodzie nie było danych prawdziwego gabinetu.
export const contactPhone = () => process.env.GABINET_TELEFON || '000 000 000';

// Domyślny grafik: klucz = dzień tygodnia JS (0 = niedziela), wartość = lista początków
// wizyt w minutach od północy (700 = 11:40) albo null (dzień bez przyjęć).
const SESSIONS = [700, 770, 820, 870, 920];
const DEFAULT_SCHEDULE = { 0: null, 1: SESSIONS, 2: SESSIONS, 3: null, 4: SESSIONS, 5: null, 6: null };

// Tworzy tabele przy pustej bazie (lokalny PGlite albo MIGRATE=1 przy pierwszym wdrożeniu).
let schemaReady;
export function ensureSchema() {
  schemaReady ??= (async () => {
    if (!process.env.PGLITE_DIR && process.env.MIGRATE !== '1') return;
    await sql`CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      slot_date DATE NOT NULL,
      slot_min INT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'online',
      status TEXT NOT NULL DEFAULT 'confirmed',
      ip_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    // Jeden termin = najwyżej jedna aktywna wizyta (ochrona przed podwójną rezerwacją).
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_slot
      ON bookings (slot_date, slot_min) WHERE status = 'confirmed'`;
    await sql`CREATE TABLE IF NOT EXISTS blocks (
      id SERIAL PRIMARY KEY,
      slot_date DATE NOT NULL,
      slot_min INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (slot_date, slot_min)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      ip_hash TEXT NOT NULL,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  })();
  return schemaReady;
}

// Retencja RODO: dane wizyty znikają RETENTION_DAYS dni po jej terminie. Przyszłe wizyty
// są nietknięte. Uruchamiane raz na dobę przez zaplanowane zadanie (vercel.json).
export async function purgeOldData() {
  const bookings = await sql`DELETE FROM bookings
    WHERE slot_date < CURRENT_DATE - ${RETENTION_DAYS}::int RETURNING id`;
  const blocks = await sql`DELETE FROM blocks WHERE slot_date < CURRENT_DATE RETURNING id`;
  const attempts = await sql`DELETE FROM login_attempts
    WHERE attempted_at < now() - INTERVAL '1 day' RETURNING id`;
  return { bookings: bookings.length, blocks: blocks.length, loginAttempts: attempts.length };
}

// Zaplanowane zadanie Vercela wysyła "Authorization: Bearer <CRON_SECRET>".
// Porównanie w stałym czasie; brak sekretu = odmowa.
export function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.authorization ?? '');
  const good = Buffer.from(`Bearer ${secret}`);
  return given.length === good.length && crypto.timingSafeEqual(given, good);
}

// ---------- Grafik i czas ----------
export async function getSchedule() {
  const rows = await sql`SELECT value FROM settings WHERE key = 'schedule'`;
  return rows[0]?.value ?? DEFAULT_SCHEDULE;
}

export const startsFor = (schedule, dateStr) => schedule[weekdayOf(dateStr)] ?? [];

// 700 -> "11:40"
export const minToHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// "Teraz" jako zegar ścienny Warszawy w polach UTC — prosta arytmetyka bez pułapek stref.
export function warsawNowAsUTC() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute);
}

export function slotAsUTC(dateStr, min) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 0, min);
}

export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Odrzuca też daty nieistniejące (2026-02-30), które przechodzą wyrażenie regularne.
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Siedem kolejnych dat od poniedziałku.
export function weekDates(monday) {
  const [y, m, d] = monday.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

// Czy termin mieści się w oknie rezerwacji online (od +24 h do +28 dni).
export function slotBookableOnline(dateStr, min) {
  const now = warsawNowAsUTC();
  const slot = slotAsUTC(dateStr, min);
  return slot >= now + MIN_LEAD_HOURS * 3600e3 && slot <= now + MAX_DAYS_AHEAD * 86400e3;
}

// Dzisiejsza data w Warszawie (RRRR-MM-DD).
export const warsawToday = () => new Date(warsawNowAsUTC()).toISOString().slice(0, 10);

// Czy wizyta całkowicie minęła (trwająca jeszcze się nie liczy).
export const slotIsOver = (dateStr, min) => slotAsUTC(dateStr, min) + SLOT_MINUTES * 60e3 <= warsawNowAsUTC();

// ---------- Walidacja danych klienta ----------
const NAME_CHARS = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s'-]+$/;

export function cleanName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 60 || !/\S+\s+\S+/.test(name)) return { error: 'Podaj imię i nazwisko.' };
  if (!NAME_CHARS.test(name)) return { error: 'Imię i nazwisko może zawierać tylko litery, spacje i myślnik.' };
  return { value: name };
}

// Zwraca 9 cyfr albo '' dla pustego pola.
export const cleanPhone = (raw) => String(raw ?? '').replace(/[\s\-().]/g, '').replace(/^\+?48/, '');
export const isValidPhone = (p) => /^\d{9}$/.test(p);

// ---------- Sesja panelu: token "wygaśnięcie.podpisHMAC" w ciasteczku httpOnly ----------
// Dwie role z osobnymi hasłami, sekretami 2FA i ciasteczkami:
//  - staff: recepcjonista i terapeuta (wspólne konto panelu), sesja 30 dni,
//  - guard: ochroniarz — widzi tylko listę dzisiejszych wizyt, sesja 12 godzin (jedna zmiana).
const ROLES = {
  staff: { cookie: 'panel_session', seconds: 30 * 86400, password: 'ADMIN_PASSWORD', totp: 'ADMIN_TOTP_SECRET' },
  guard: { cookie: 'ochrona_session', seconds: 12 * 3600, password: 'OCHRONA_PASSWORD', totp: 'OCHRONA_TOTP_SECRET' },
};

// Rola jest częścią podpisu, więc ciasteczka ochroniarza nie da się użyć w panelu.
const sign = (role, exp) =>
  crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`session:${role}:${exp}`).digest('base64url');

export function makeSessionCookie(role = 'staff') {
  const { cookie, seconds } = ROLES[role];
  const exp = Date.now() + seconds * 1000;
  return `${cookie}=${exp}.${sign(role, exp)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
}

export const clearSessionCookies = () =>
  Object.values(ROLES).map(({ cookie }) => `${cookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

export function isAuthed(req, role = 'staff') {
  const { cookie } = ROLES[role];
  const raw = (req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(`${cookie}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(cookie.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(role, exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export function requireAuth(req, res, role = 'staff') {
  if (isAuthed(req, role)) return true;
  j(res, 401, { error: 'Wymagane logowanie' });
  return false;
}

// Logowanie hasłem i kodem 2FA dla danej roli. Limit: LOGIN_MAX_FAILS nieudanych prób
// z jednego IP w ciągu LOGIN_WINDOW_MIN minut (wspólny dla obu ról).
export async function handleLogin(req, res, role) {
  const ipHash = ipHashOf(req);
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM login_attempts
    WHERE ip_hash = ${ipHash} AND attempted_at > now() - make_interval(mins => ${LOGIN_WINDOW_MIN}::int)`;
  if (count >= LOGIN_MAX_FAILS) {
    return j(res, 429, { error: `Zbyt wiele prób logowania. Spróbuj za ${LOGIN_WINDOW_MIN} minut.` });
  }

  // 2FA jest obowiązkowe: bez sekretu nikt nie wejdzie (fail closed).
  const totpSecret = process.env[ROLES[role].totp] ?? '';
  const good = process.env[ROLES[role].password] ?? '';
  if (!totpSecret || !good) {
    console.error(`login(${role}): brak hasła lub sekretu 2FA — logowanie zablokowane`);
    return j(res, 503, { error: 'Logowanie chwilowo niedostępne — brak konfiguracji.' });
  }

  const body = readBody(req);
  const hash = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest();
  const passOk = crypto.timingSafeEqual(hash(body.password), hash(good));
  const totpOk = verifyTOTP(totpSecret, body.totp);

  // Jeden ogólny komunikat — nie zdradzamy, czy pomylono hasło, czy kod.
  if (!passOk || !totpOk) {
    await sql`INSERT INTO login_attempts (ip_hash) VALUES (${ipHash})`;
    await new Promise((r) => setTimeout(r, 600));
    return j(res, 401, { error: 'Nieprawidłowe hasło lub kod.' });
  }

  res.setHeader('Set-Cookie', makeSessionCookie(role));
  return j(res, 200, { ok: true });
}

// ---------- HTTP ----------
export function j(res, code, obj) {
  res.status(code).setHeader('Cache-Control', 'no-store').json(obj);
}

// Zaufany adres klienta: Vercel nadpisuje x-real-ip prawdziwym IP. Pierwszej wartości
// X-Forwarded-For nie ufamy — klient może ją podrobić i obejść limity.
export function clientIP(req) {
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.at(-1) ?? req.socket?.remoteAddress ?? 'unknown';
}

// Pseudonimizacja IP (RODO): z HMAC nie da się odtworzyć adresu, ale można liczyć limity.
export const ipHashOf = (req) =>
  crypto.createHmac('sha256', process.env.SESSION_SECRET).update(`iphash:${clientIP(req)}`).digest('hex').slice(0, 32);

// req.body bywa getterem, który rzuca przy niepoprawnym JSON — stąd try.
export function readBody(req) {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

// ---------- 2FA: TOTP (RFC 6238), zgodne z Google Authenticator ----------
function base32Decode(str) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...String(str).toUpperCase().replace(/[^A-Z2-7]/g, '')]
    .map((ch) => A.indexOf(ch).toString(2).padStart(5, '0'))
    .join('');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpCode(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const off = h.at(-1) & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

// Kod sprawdzany z tolerancją ±30 s na rozjazd zegara telefonu.
export function verifyTOTP(secretB32, code) {
  const clean = String(code ?? '').replace(/\D/g, '');
  if (clean.length !== 6 || !secretB32) return false;
  const secret = base32Decode(secretB32);
  const counter = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((w) => crypto.timingSafeEqual(Buffer.from(totpCode(secret, counter + w)), Buffer.from(clean)));
}
