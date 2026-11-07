// POST /api/admin/hours — zapis tygodniowego grafiku przyjęć (wymaga sesji).
// Format: {"0": null, "1": [700, 770, ...], ...} — klucz = dzień tygodnia (0 = niedziela),
// wartość = początki wizyt w minutach od północy albo null (dzień bez przyjęć).
import { ensureSchema, sql, SLOT_MINUTES, requireAuth, j, readBody } from '../_lib.js';

const DAY_FROM = 6 * 60; // najwcześniejszy początek wizyty: 6:00
const DAY_TO = 21 * 60; // najpóźniejszy: 21:00

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;
  try {
    await ensureSchema();
    const input = readBody(req).schedule;
    if (!input || typeof input !== 'object') return j(res, 400, { error: 'Brak danych' });

    const clean = {};
    for (let d = 0; d <= 6; d++) {
      const v = input[d] ?? null;
      if (v === null || (Array.isArray(v) && v.length === 0)) {
        clean[d] = null;
        continue;
      }
      if (!Array.isArray(v) || v.length > 20) return j(res, 400, { error: `Nieprawidłowy grafik (dzień ${d})` });
      const mins = v.map(Number).sort((a, b) => a - b);
      for (const [i, m] of mins.entries()) {
        if (!Number.isInteger(m) || m < DAY_FROM || m > DAY_TO) {
          return j(res, 400, { error: `Godzina poza zakresem 6:00–21:00 (dzień ${d})` });
        }
        if (i > 0 && m - mins[i - 1] < SLOT_MINUTES) {
          return j(res, 400, { error: `Wizyty nakładają się (dzień ${d}) — odstęp min. ${SLOT_MINUTES} min` });
        }
      }
      clean[d] = mins;
    }

    await sql`INSERT INTO settings (key, value) VALUES ('schedule', ${JSON.stringify(clean)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    j(res, 200, { ok: true });
  } catch (err) {
    console.error('admin/hours error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
