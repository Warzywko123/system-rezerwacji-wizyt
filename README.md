# System rezerwacji wizyt online dla gabinetu psychoterapii

Projekt zespołowy z przedmiotu **Inżynieria oprogramowania** (grupa L1, zespół 5).
Autorzy: Tymon Grochowski, Hubert Zduńczyk, Wojciech Czajkowski.

To uproszczona wersja systemu działającego w prawdziwym gabinecie. Klient bez zakładania
konta sprawdza wolne terminy i rezerwuje wizytę. Recepcjonista i terapeuta korzystają ze
wspólnego panelu chronionego hasłem i kodem z aplikacji uwierzytelniającej (2FA), a ochroniarz
budynku widzi listę wizyt na dany dzień.

## Funkcje

**Klient** (`/`):
- przegląda wolne terminy tydzień po tygodniu,
- rezerwuje wizytę, podając imię i nazwisko oraz numer telefonu.

Reguły rezerwacji online:
- najwcześniej 24 godziny i najpóźniej 28 dni przed wizytą,
- najwyżej 2 aktywne rezerwacje na jeden numer telefonu,
- najwyżej 3 rezerwacje na dobę z jednego adresu IP,
- rezerwacja jest potwierdzana automatycznie.

Odwołanie wizyty przez klienta jest możliwe tylko telefonicznie, bo klienci nie mają kont.

**Personel** (`/panel`):
- logowanie hasłem i kodem 2FA, blokada po 8 nieudanych próbach w ciągu 15 minut,
- kalendarz tygodnia i lista najbliższych wizyt,
- wpisywanie wizyt umówionych telefonicznie,
- odwoływanie wizyt; panel przypomina, żeby zadzwonić do klienta,
- blokowanie pojedynczych terminów i całych dni, np. na urlop,
- tygodniowy grafik przyjęć.

**Ochroniarz** (`/ochrona`):
- osobne hasło i osobny sekret 2FA, sesja na 12 godzin (jedna zmiana),
- lista dzisiejszych wizyt: tylko godzina oraz imię i nazwisko (bez telefonu), odświeżana co 5 minut,
- brak dostępu do panelu personelu.

**RODO:**
- zbierane jest tylko imię i nazwisko oraz telefon,
- adres IP jest zapisywany wyłącznie jako skrót HMAC (pseudonimizacja),
- dane wizyty są automatycznie usuwane 7 dni po jej terminie (zadanie uruchamiane codziennie o 3:00).

## Technologia

| Warstwa | Technologia |
|---|---|
| Interfejs | HTML, CSS, JavaScript (moduły ES), bez frameworków |
| Serwer | funkcje serverless Vercel (Node.js 20+) w katalogu `api/` |
| Baza danych | PostgreSQL w Neon (darmowy plan); lokalnie PGlite |
| Zadanie okresowe | Vercel Cron (`vercel.json`) |

Koszt utrzymania: 0 zł (darmowe plany Vercel i Neon, bez płatnych SMS-ów i e-maili).

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local   # uzupełnij hasło i sekrety
npm run totp                 # sekret 2FA panelu; uruchom drugi raz dla ochrony
npm run dev                  # http://localhost:3000, /panel oraz /ochrona
```

Lokalnie baza działa w PGlite (katalog `.pglite`), bez instalowania Postgresa.

## Testy

```bash
npm test
```

Testy sprawdzają reguły systemu na tymczasowej bazie:
- logowanie z 2FA i blokadę po nieudanych próbach,
- widok ochrony (tylko dzisiejsze wizyty, bez telefonów, brak dostępu do panelu),
- okno 24 godziny–28 dni,
- limity na numer telefonu i adres IP,
- ochronę przed podwójną rezerwacją,
- blokady terminów,
- wpisywanie i odwoływanie wizyt,
- walidację grafiku,
- usuwanie starych danych.

## Wdrożenie na Vercel

1. Utwórz bazę w Neon i projekt w Vercel połączony z tym repozytorium.
2. Ustaw zmienne środowiskowe z `.env.example`: `DATABASE_URL` zamiast `PGLITE_DIR`, a do pierwszego wdrożenia także `MIGRATE=1`, które tworzy tabele.
3. Po pierwszym wejściu do panelu usuń `MIGRATE`.

## Struktura

```
index.html, js/rezerwacja.js   strona rezerwacji dla klienta
panel.html, js/panel.js        panel personelu
ochrona.html, js/ochrona.js    lista wizyt na dziś dla ochroniarza
js/dates.js                    wspólne funkcje dat i wywołań API
css/style.css, fonts/          wygląd i fonty hostowane lokalnie (Inter, Lora — licencja OFL)
api/_lib.js                    reguły rezerwacji, baza, sesja, 2FA, RODO
api/slots.js, api/book.js      API dla klienta
api/admin/*.js                 API panelu (logowanie, dane, wizyty, blokady, grafik)
api/ochrona/*.js               API ochrony (logowanie, lista wizyt na dziś)
test/api.test.js               testy automatyczne
dev-server.js                  serwer lokalny
```
