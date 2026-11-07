// Lokalny serwer deweloperski: pliki statyczne + API z katalogu api/ (te same handlery co na Vercelu).
// Uruchomienie: npm run dev (zmienne w .env.local, wzór w .env.example). Nie działa na produkcji.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

// Wczytanie .env.local bez dodatkowej biblioteki.
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
if (process.env.PGLITE_DIR && !path.isAbsolute(process.env.PGLITE_DIR)) {
  process.env.PGLITE_DIR = path.join(ROOT, process.env.PGLITE_DIR);
}

// Ta sama polityka bezpieczeństwa treści co w vercel.json.
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Uzupełnia natywną odpowiedź Node o metody, które daje Vercel (status, json).
function shimRes(res) {
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (k, v) => {
    // Lokalnie działa http://, więc przeglądarka odrzuciłaby ciasteczko z flagą Secure.
    setHeader(k, String(k).toLowerCase() === 'set-cookie' ? String(v).replace('; Secure', '') : v);
    return res;
  };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
  return res;
}

async function readJSONBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return raw; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (pathname.startsWith('/api/')) {
    const modPath = path.join(ROOT, `${pathname.replace(/\/$/, '')}.js`);
    if (!modPath.startsWith(path.join(ROOT, 'api')) || path.basename(modPath).startsWith('_') || !fs.existsSync(modPath)) {
      shimRes(res).status(404).json({ error: 'Not found' });
      return;
    }
    try {
      // Jak proxy Vercela: x-real-ip zawsze nadpisywane prawdziwym adresem gniazda.
      req.headers['x-real-ip'] = req.socket.remoteAddress ?? '127.0.0.1';
      req.query = Object.fromEntries(url.searchParams);
      if (req.method !== 'GET' && req.method !== 'HEAD') req.body = await readJSONBody(req);
      const mod = await import(modPath);
      await mod.default(req, shimRes(res));
    } catch (err) {
      console.error(`[api] ${pathname}:`, err);
      if (!res.headersSent) shimRes(res).status(500).json({ error: `Dev server error: ${err.message}` });
    }
    return;
  }

  // Pliki statyczne; /panel → panel.html (jak cleanUrls na Vercelu).
  let rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!path.extname(rel)) rel += '.html';
  const filePath = path.normalize(path.join(ROOT, rel));
  const parts = path.relative(ROOT, filePath).split(path.sep);
  if (!filePath.startsWith(ROOT) || parts.some((p) => p.startsWith('.')) || ['api', 'node_modules', 'scripts', 'test'].includes(parts[0])) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.setHeader('Content-Type', MIME[path.extname(filePath)] ?? 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  res.statusCode = 404;
  res.end('404 — nie znaleziono');
});

server.listen(PORT, () => {
  console.log(`DEV: http://localhost:${PORT} (panel: /panel, baza: ${process.env.PGLITE_DIR ? `PGlite ${process.env.PGLITE_DIR}` : 'Neon'})`);
});
