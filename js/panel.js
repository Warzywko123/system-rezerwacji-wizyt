// Panel personelu gabinetu: logowanie, kalendarz tygodnia, wpisywanie i odwoływanie wizyt,
// blokowanie terminów, najbliższe wizyty i grafik przyjęć.
import {
  DAY_NAMES, MONTHS, startOfWeek, toISO, parseISO, addDays, hhmm, humanDate, weekLabel, prettyPhone, api,
} from './dates.js';

const $ = (id) => document.getElementById(id);
const state = { monday: startOfWeek(new Date()), data: null };

const views = { boot: $('boot'), login: $('login-view'), app: $('app-view') };
function show(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
}

// Wizyta (lub termin) już minęła — w panelu tylko podgląd.
function isPast(dateStr, min) {
  const d = parseISO(dateStr);
  d.setHours(0, min + 50, 0, 0);
  return d <= new Date();
}

// ---------- Logowanie ----------
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  const res = await api('/api/admin/login', {
    method: 'POST',
    body: { password: $('login-password').value, totp: $('login-totp').value },
  });
  if (!res.ok) {
    $('login-error').textContent = res.body.error ?? 'Nie udało się zalogować.';
    return;
  }
  $('login-password').value = '';
  $('login-totp').value = '';
  load();
});

$('logout').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' });
  state.data = null;
  show('login');
  $('login-password').focus();
});

// ---------- Dane tygodnia ----------
async function load() {
  const res = await api(`/api/admin/data?start=${toISO(state.monday)}`);
  if (res.status === 401) {
    show('login');
    $('login-password').focus();
    return;
  }
  if (!res.ok) {
    views.boot.textContent = res.body.error ?? 'Błąd serwera.';
    show('boot');
    return;
  }
  state.data = res.body;
  show('app');
  render();
}

function chip(text, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `chip ${cls}`;
  b.textContent = text;
  if (onClick) b.addEventListener('click', onClick);
  else b.disabled = true;
  return b;
}

function render() {
  const { schedule, bookings, blocks, upcoming } = state.data;
  $('week-label').textContent = weekLabel(state.monday);

  const byKey = new Map(bookings.map((b) => [`${b.slot_date}|${b.slot_min}`, b]));
  const blocked = new Set(blocks.map((b) => `${b.slot_date}|${b.slot_min}`));

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(state.monday, i);
    const date = toISO(day);
    const starts = schedule[day.getDay()] ?? [];

    const card = document.createElement('div');
    card.className = 'adm-day';
    card.innerHTML = `<p class="adm-day__head"><strong>${DAY_NAMES[day.getDay()]}</strong><span>${day.getDate()} ${MONTHS[day.getMonth()]}</span></p>`;

    if (!starts.length) {
      card.insertAdjacentHTML('beforeend', '<p class="adm-day__off">Brak przyjęć</p>');
      return card;
    }

    const list = document.createElement('div');
    list.className = 'adm-day__slots';
    let freeLeft = 0;
    for (const min of starts) {
      const key = `${date}|${min}`;
      const time = hhmm(min);
      const past = isPast(date, min);
      if (byKey.has(key)) {
        const b = byKey.get(key);
        list.append(chip(`${time} · ${b.name.split(' ')[0]}`, 'chip--booked', () => openBooking(b)));
      } else if (blocked.has(key)) {
        list.append(chip(`${time} · blokada`, 'chip--blocked', past ? null : () => blockAction(date, min, 'unblock')));
      } else if (past) {
        list.append(chip(time, 'chip--past', null));
      } else {
        freeLeft += 1;
        list.append(chip(`${time} · wolny`, 'chip--free', () => openSlot(date, min)));
      }
    }
    card.append(list);

    if (!isPast(date, starts.at(-1))) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'day-toggle';
      t.textContent = freeLeft > 0 ? 'Zablokuj dzień' : 'Odblokuj dzień';
      t.addEventListener('click', () => blockAction(date, null, freeLeft > 0 ? 'block-day' : 'unblock-day'));
      card.append(t);
    }
    return card;
  });
  $('grid').replaceChildren(...days);

  const items = upcoming.map((b) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<strong>${humanDate(b.slot_date)}, ${hhmm(b.slot_min)}</strong> · ${escapeHTML(b.name)}`
      + `${b.phone ? ` · ${prettyPhone(b.phone)}` : ''}<span class="tag">${b.source === 'telefon' ? 'telefonicznie' : 'online'}</span>`;
    btn.addEventListener('click', () => openBooking(b));
    li.append(btn);
    return li;
  });
  $('upcoming').replaceChildren(...(items.length ? items : [Object.assign(document.createElement('li'), { className: 'hint', textContent: 'Brak nadchodzących wizyt.' })]));

  renderHours(schedule);
}

const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function blockAction(date, min, action) {
  const res = await api('/api/admin/block', { method: 'POST', body: { date, min, action } });
  if (!res.ok) alert(res.body.error ?? 'Błąd');
  load();
}

$('week-prev').addEventListener('click', () => { state.monday = addDays(state.monday, -7); load(); });
$('week-next').addEventListener('click', () => { state.monday = addDays(state.monday, 7); load(); });

// ---------- Okna dialogowe ----------
for (const btn of document.querySelectorAll('.js-close')) {
  btn.addEventListener('click', () => btn.closest('dialog').close());
}

let pendingSlot = null;
function openSlot(date, min) {
  pendingSlot = { date, min };
  $('slot-title').textContent = `${humanDate(date)}, godz. ${hhmm(min)}`;
  $('slot-choice').hidden = false;
  $('slot-form').hidden = true;
  $('sf-name').value = '';
  $('sf-phone').value = '';
  $('sf-error').textContent = '';
  $('slot-dialog').showModal();
}

$('slot-add').addEventListener('click', () => {
  $('slot-choice').hidden = true;
  $('slot-form').hidden = false;
  $('sf-name').focus();
});

$('slot-block').addEventListener('click', async () => {
  $('slot-dialog').close();
  await blockAction(pendingSlot.date, pendingSlot.min, 'block');
});

$('slot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await api('/api/admin/book', {
    method: 'POST',
    body: { ...pendingSlot, name: $('sf-name').value, phone: $('sf-phone').value },
  });
  if (!res.ok) {
    $('sf-error').textContent = res.body.error ?? 'Błąd zapisu';
    return;
  }
  $('slot-dialog').close();
  load();
});

function openBooking(b) {
  $('bd-title').textContent = `${humanDate(b.slot_date)}, godz. ${hhmm(b.slot_min)}`;
  $('bd-name').textContent = b.name;
  $('bd-source').textContent = b.source === 'telefon' ? 'umówiona telefonicznie' : 'rezerwacja online';
  $('bd-phone').innerHTML = b.phone
    ? `<a href="tel:+48${b.phone}">${prettyPhone(b.phone)}</a>`
    : '<span class="hint">Brak zapisanego numeru telefonu.</span>';
  const past = isPast(b.slot_date, b.slot_min);
  $('bd-cancel').hidden = past;
  $('bd-cancel').onclick = async () => {
    const reminder = b.phone
      ? `Po odwołaniu zadzwoń do klienta: ${prettyPhone(b.phone)}.`
      : 'Ta wizyta nie ma numeru telefonu — klienta trzeba powiadomić inną drogą.';
    if (!confirm(`Odwołać tę wizytę?\n\n${reminder}`)) return;
    const res = await api('/api/admin/cancel', { method: 'POST', body: { id: b.id } });
    $('booking-dialog').close();
    if (!res.ok) alert(res.body.error ?? 'Błąd');
    load();
  };
  $('booking-dialog').showModal();
}

// ---------- Grafik przyjęć ----------
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function renderHours(schedule) {
  const rows = ORDER.map((dow) => {
    const v = schedule[dow];
    const closed = !v?.length;
    const row = document.createElement('div');
    row.className = 'hours-row';
    row.innerHTML = `<span class="hours-row__day" id="hd-${dow}">${DAY_NAMES[dow]}</span>`
      + `<label><input type="checkbox" data-dow="${dow}" data-kind="closed"${closed ? ' checked' : ''}> brak przyjęć</label>`
      + `<input type="text" class="hours-row__times" data-dow="${dow}" data-kind="times" aria-labelledby="hd-${dow}"`
      + ` placeholder="np. 11:40, 12:50" value="${closed ? '' : v.map(hhmm).join(', ')}"${closed ? ' disabled' : ''}>`;
    row.querySelector('[data-kind="closed"]').addEventListener('change', (e) => {
      row.querySelector('[data-kind="times"]').disabled = e.target.checked;
    });
    return row;
  });
  $('hours').replaceChildren(...rows);
}

$('hours-save').addEventListener('click', async () => {
  const schedule = {};
  for (const dow of ORDER) {
    const closed = document.querySelector(`[data-dow="${dow}"][data-kind="closed"]`).checked;
    const raw = closed ? '' : document.querySelector(`[data-dow="${dow}"][data-kind="times"]`).value;
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const mins = [];
    for (const p of parts) {
      const m = p.match(/^(\d{1,2})[:.](\d{2})$/);
      if (!m || +m[2] > 59) {
        alert(`${DAY_NAMES[dow]}: nie rozumiem godziny „${p}” — użyj formatu 11:40 i oddzielaj przecinkami.`);
        return;
      }
      mins.push(+m[1] * 60 + +m[2]);
    }
    schedule[dow] = mins.length ? mins.sort((a, b) => a - b) : null;
  }
  const res = await api('/api/admin/hours', { method: 'POST', body: { schedule } });
  if (!res.ok) {
    alert(res.body.error ?? 'Błąd zapisu');
    return;
  }
  $('hours-status').textContent = 'Zapisano';
  setTimeout(() => { $('hours-status').textContent = ''; }, 3000);
  load();
});

load();
