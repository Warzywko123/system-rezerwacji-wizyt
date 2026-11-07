// POST /api/ochrona/login — logowanie ochroniarza: własne hasło + własny kod 2FA → sesja na 12 godzin.
import { ensureSchema, handleLogin, j } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  try {
    await ensureSchema();
    await handleLogin(req, res, 'guard');
  } catch (err) {
    console.error('ochrona/login error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
