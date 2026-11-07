// Strona rezerwacji dla klienta: przeglądanie wolnych terminów i rezerwacja wizyty.
import { DAY_NAMES, MONTHS, startOfWeek, toISO, parseISO, addDays, humanDate, weekLabel, api } from './dates.js';

const $ = (id) => document.getElementById(id);
const thisWeek = startOfWeek(new Date());
const MAX_WEEKS_AHEAD = 5; // 28 dni naprzód mieści się w bieżącym i 4 kolejnych tygodniach

let monday = thisWeek;
let selected = null; // { date, min, time }

const weeksFromNow = () => Math.round((monday - thisWeek) / (7 * 86400e3));

function showPhone(phone) {
  for (const a of document.querySelectorAll('.js-phone')) {
    a.textContent = phone;
    a.href = `tel:${phone.replace(/\s/g, '')}`;
  }
}

// autoSkip: przy otwarciu strony przeskocz do pierwszego tygodnia, w którym są wolne terminy.
async function loadWeek({ autoSkip = false } = {}) {
  $('week-label').textContent = weekLabel(monday);
  $('week-prev').disabled = weeksFromNow() <= 0;
  $('week-next').disabled = weeksFromNow() >= MAX_WEEKS_AHEAD - 1;
  $('days').replaceChildren();
  $('status').textContent = 'Ładowanie terminów…';

  const res = await api(`/api/slots?start=${toISO(monday)}`);
  if (!res.ok) {
    $('status').textContent = res.body.error ?? 'Nie udało się pobrać terminów. Odśwież stronę.';
    return;
  }
  if (res.body.contactPhone) showPhone(res.body.contactPhone);
  const anyFree = res.body.days.some((d) => d.slots.some((s) => s.available));
  if (autoSkip && !anyFree && weeksFromNow() < MAX_WEEKS_AHEAD - 1) {
    monday = addDays(monday, 7);
    return loadWeek({ autoSkip: true });
  }
  renderDays(res.body.days);
}

function renderDays(days) {
  const anyFree = days.some((d) => d.slots.some((s) => s.available));
  $('status').textContent = anyFree ? 'Wybierz godzinę, która Ci odpowiada.' : 'W tym tygodniu nie ma wolnych terminów online. Sprawdź kolejny tydzień.';

  const cards = days.map(({ date, slots }) => {
    const d = parseISO(date);
    const card = document.createElement('div');
    card.className = 'day';
    card.innerHTML = `<p class="day__name">${DAY_NAMES[d.getDay()]}</p><p class="day__date">${d.getDate()} ${MONTHS[d.getMonth()]}</p>`;

    const list = document.createElement('div');
    list.className = 'day__slots';
    const free = slots.filter((s) => s.available);
    if (!free.length) {
      list.innerHTML = '<p class="day__empty">Brak wolnych terminów</p>';
    }
    for (const s of free) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      btn.textContent = s.time;
      btn.setAttribute('aria-pressed', String(selected?.date === date && selected?.min === s.min));
      btn.setAttribute('aria-label', `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, godzina ${s.time}`);
      btn.addEventListener('click', () => selectSlot({ date, min: s.min, time: s.time }, btn));
      list.append(btn);
    }
    card.append(list);
    return card;
  });
  $('days').replaceChildren(...cards);
}

function selectSlot(slot, btn) {
  selected = slot;
  for (const b of document.querySelectorAll('.slot[aria-pressed="true"]')) b.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-pressed', 'true');
  $('booking-slot').textContent = `${humanDate(slot.date)}, godz. ${slot.time}`;
  $('booking-error').textContent = '';
  $('booking').hidden = false;
  $('booking').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  $('f-name').focus({ preventScroll: true });
}

function validate() {
  const name = $('f-name').value.trim();
  const phone = $('f-phone').value.replace(/[\s\-().]/g, '').replace(/^\+?48/, '');
  if (!/\S+\s+\S+/.test(name)) return 'Podaj imię i nazwisko.';
  if (!/^\d{9}$/.test(phone)) return 'Podaj poprawny 9-cyfrowy numer telefonu.';
  if (!$('f-rodo').checked) return 'Zaznacz zgodę na przetwarzanie danych.';
  return '';
}

async function submit(e) {
  e.preventDefault();
  if (!selected) return;
  const problem = validate();
  $('booking-error').textContent = problem;
  if (problem) return;

  $('submit').disabled = true;
  $('submit').textContent = 'Rezerwuję…';
  const res = await api('/api/book', {
    method: 'POST',
    body: {
      date: selected.date,
      min: selected.min,
      name: $('f-name').value,
      phone: $('f-phone').value,
      website: $('f-website').value,
      rodo: $('f-rodo').checked,
    },
  });
  $('submit').disabled = false;
  $('submit').textContent = 'Rezerwuję termin';

  if (!res.ok) {
    $('booking-error').textContent = res.body.error ?? 'Nie udało się zarezerwować. Spróbuj ponownie.';
    if (res.status === 409) loadWeek(); // termin zajęty w międzyczasie — odśwież kalendarz
    return;
  }
  $('success-slot').textContent = `${humanDate(selected.date)}, godz. ${selected.time}`;
  $('calendar').hidden = true;
  $('booking').hidden = true;
  $('success').hidden = false;
  $('success').scrollIntoView({ block: 'start' });
}

$('week-prev').addEventListener('click', () => { monday = addDays(monday, -7); loadWeek(); });
$('week-next').addEventListener('click', () => { monday = addDays(monday, 7); loadWeek(); });
$('change-slot').addEventListener('click', () => {
  selected = null;
  $('booking').hidden = true;
  for (const b of document.querySelectorAll('.slot[aria-pressed="true"]')) b.setAttribute('aria-pressed', 'false');
  $('calendar').scrollIntoView({ block: 'start' });
});
$('booking-form').addEventListener('submit', submit);

loadWeek({ autoSkip: true });
