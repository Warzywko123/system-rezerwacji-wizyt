// POST /api/admin/login — logowanie recepcjonisty lub terapeuty: hasło + kod 2FA → sesja panelu.
import { ensureSchema, handleLogin, j } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return j(res, 405, { error: 'Method not allowed' });
  try {
    await ensureSchema();
    await handleLogin(req, res, 'staff');
  } catch (err) {
    console.error('login error:', err);
    j(res, 500, { error: 'Błąd serwera' });
  }
}
