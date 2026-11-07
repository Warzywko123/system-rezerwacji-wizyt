// Jednorazowa konfiguracja 2FA panelu: node scripts/gen-totp.js
// Generuje losowy sekret i link otpauth:// do dodania w aplikacji uwierzytelniającej
// (Google Authenticator, Authy…). Recepcjonista i doktor dodają TEN SAM sekret.
import crypto from 'node:crypto';

function base32Encode(buf) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...buf].map((b) => b.toString(2).padStart(8, '0')).join('');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

const secret = base32Encode(crypto.randomBytes(20));
const label = encodeURIComponent('Panel gabinetu');
const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${label}&digits=6&period=30&algorithm=SHA1`;

console.log(`
Sekret 2FA (wpisz ręcznie w aplikacji albo zamień link na kod QR):
  ${secret}

Link otpauth:
  ${uri}

Dodaj do .env.local (lokalnie) i do zmiennych środowiskowych Vercela:
  ADMIN_TOTP_SECRET=${secret}
`);
