// Testy reguł systemu na lokalnej bazie PGlite: npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rezerwacje-test-'));
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret';
process.env.ADMIN_PASSWORD = 'haslo-testowe';
process.env.ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

const lib = await import('../api/_lib.js');
const call = async (file, { method = 'GET', query = {}, body, cookie, ip = '10.0.0.1' } = {}) => {
  const { default: handler } = await import(`../api/${file}.js`);
  const req = { method, query, body, headers: { cookie: cookie ?? '', 'x-real-ip': ip } };
  const res = {
    statusCode: 200, headers: {}, payload: null,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    json(o) { this.payload = o; return this; },
  };
  await handler(req, res);
  return res;
};

// Bieżący kod TOTP liczony tak jak aplikacja uwierzytelniająca.
function currentTOTP(secretB32) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secretB32].map((c) => A.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const o = h.at(-1) & 0x0f;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0');
}

// Najbliższe dni przyjęć (wg domyślnego grafiku pn/wt/czw) w oknie rezerwacji online.
function workdays(count, fromDays = 3) {
  const out = [];
  for (let i = fromDays; out.length < count && i < 27; i++) {
    const d = new Date(Date.now() + i * 86400e3).toISOString().slice(0, 10);
    if ([1, 2, 4].includes(lib.weekdayOf(d))) out.push(d);
  }
  return out;
}

const person = (n) => ({ name: 'Anna Testowa', phone: `60010020${n}`, rodo: true });
let cookie;

before(async () => {
  await lib.ensureSchema();
});

test('logowanie wymaga hasła i poprawnego kodu 2FA', async () => {
  const bad = await call('admin/login', { method: 'POST', body: { password: 'haslo-testowe', totp: '000000' }, ip: '10.9.9.9' });
  assert.equal(bad.statusCode, 401);
  const ok = await call('admin/login', { method: 'POST', body: { password: 'haslo-testowe', totp: currentTOTP(process.env.ADMIN_TOTP_SECRET) } });
  assert.equal(ok.statusCode, 200);
  cookie = ok.headers['set-cookie'].split(';')[0];
  assert.ok(lib.isAuthed({ headers: { cookie } }));
});

test('blokada logowania po 8 nieudanych próbach', async () => {
  const ip = '10.8.8.8';
  for (let i = 0; i < 8; i++) await call('admin/login', { method: 'POST', body: { password: 'x', totp: '1' }, ip });
  const res = await call('admin/login', { method: 'POST', body: { password: 'haslo-testowe', totp: currentTOTP(process.env.ADMIN_TOTP_SECRET) }, ip });
  assert.equal(res.statusCode, 429);
});

test('panel bez zalogowania odpowiada 401', async () => {
  const res = await call('admin/data', { query: { start: '2026-11-09' } });
  assert.equal(res.statusCode, 401);
});

test('rezerwacja online i ochrona przed podwójną rezerwacją', async () => {
  const [d] = workdays(1);
  const ok = await call('book', { method: 'POST', body: { ...person(1), date: d, min: 700 }, ip: '10.1.1.1' });
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.payload));
  const dup = await call('book', { method: 'POST', body: { ...person(2), date: d, min: 700 }, ip: '10.1.1.2' });
  assert.equal(dup.statusCode, 409);
});

test('termin bliżej niż 24 h i poza grafikiem jest odrzucany', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const r1 = await call('book', { method: 'POST', body: { ...person(3), date: today, min: 1200 }, ip: '10.1.1.3' });
  assert.equal(r1.statusCode, 400);
  const [d] = workdays(1);
  const r2 = await call('book', { method: 'POST', body: { ...person(3), date: d, min: 701 }, ip: '10.1.1.3' });
  assert.equal(r2.statusCode, 400);
});

test('najwyżej 2 aktywne rezerwacje na jeden numer', async () => {
  const days = workdays(3, 4);
  const p = { name: 'Jan Limitowy', phone: '700800900', rodo: true };
  assert.equal((await call('book', { method: 'POST', body: { ...p, date: days[0], min: 770 }, ip: '10.2.0.1' })).statusCode, 200);
  assert.equal((await call('book', { method: 'POST', body: { ...p, date: days[1], min: 770 }, ip: '10.2.0.2' })).statusCode, 200);
  assert.equal((await call('book', { method: 'POST', body: { ...p, date: days[2], min: 770 }, ip: '10.2.0.3' })).statusCode, 429);
});

test('najwyżej 3 rezerwacje online na dobę z jednego IP', async () => {
  const days = workdays(4, 5);
  const ip = '10.3.0.1';
  for (let i = 0; i < 3; i++) {
    const r = await call('book', { method: 'POST', body: { name: 'Ewa Ipowa', phone: `51100000${i}`, rodo: true, date: days[i], min: 820 }, ip });
    assert.equal(r.statusCode, 200, JSON.stringify(r.payload));
  }
  const r = await call('book', { method: 'POST', body: { name: 'Ewa Ipowa', phone: '511000009', rodo: true, date: days[3], min: 820 }, ip });
  assert.equal(r.statusCode, 429);
});

test('wolne terminy nie pokazują zajętych i zablokowanych', async () => {
  const [d] = workdays(1);
  await call('admin/block', { method: 'POST', body: { date: d, min: 920, action: 'block' }, cookie });
  const wd = lib.weekdayOf(d);
  const monday = new Date(Date.parse(d) - ((wd + 6) % 7) * 86400e3).toISOString().slice(0, 10);
  const res = await call('slots', { query: { start: monday } });
  const day = res.payload.days.find((x) => x.date === d);
  assert.equal(day.slots.find((s) => s.min === 700).available, false);
  assert.equal(day.slots.find((s) => s.min === 920).available, false);
  assert.equal(day.slots.find((s) => s.min === 870).available, true);
});

test('wpisanie wizyty telefonicznej i odwołanie zwalnia termin', async () => {
  const [, d] = workdays(2);
  const add = await call('admin/book', { method: 'POST', body: { date: d, min: 870, name: 'Piotr Telefoniczny', phone: '' }, cookie });
  assert.equal(add.statusCode, 200, JSON.stringify(add.payload));
  const [row] = await lib.sql`SELECT id, source FROM bookings WHERE slot_date = ${d} AND slot_min = 870 AND status = 'confirmed'`;
  assert.equal(row.source, 'telefon');
  const cancel = await call('admin/cancel', { method: 'POST', body: { id: row.id }, cookie });
  assert.equal(cancel.statusCode, 200);
  const again = await call('book', { method: 'POST', body: { name: 'Nowa Osoba', phone: '799111222', rodo: true, date: d, min: 870 }, ip: '10.4.0.1' });
  assert.equal(again.statusCode, 200);
});

test('grafik odrzuca nakładające się wizyty i zapisuje poprawny', async () => {
  const bad = await call('admin/hours', { method: 'POST', body: { schedule: { 1: [600, 620] } }, cookie });
  assert.equal(bad.statusCode, 400);
  const good = await call('admin/hours', { method: 'POST', body: { schedule: { 0: null, 1: [600, 660], 2: [700, 770, 820, 870, 920], 3: null, 4: [700, 770, 820, 870, 920], 5: [540], 6: null } }, cookie });
  assert.equal(good.statusCode, 200);
  assert.deepEqual((await lib.getSchedule())[5], [540]);
});

test('czyszczenie RODO usuwa wizyty starsze niż 7 dni po terminie', async () => {
  const old = new Date(Date.now() - 10 * 86400e3).toISOString().slice(0, 10);
  await lib.sql`INSERT INTO bookings (slot_date, slot_min, name, phone) VALUES (${old}, 700, 'Stary Wpis', '600600600')`;
  const removed = await lib.purgeOldData();
  assert.ok(removed.bookings >= 1);
  const left = await lib.sql`SELECT 1 FROM bookings WHERE name = 'Stary Wpis'`;
  assert.equal(left.length, 0);
});
