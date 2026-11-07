// Widok ochroniarza: logowanie i lista dzisiejszych wizyt (godzina, imię i nazwisko).
import { humanDate, api } from './dates.js';

const $ = (id) => document.getElementById(id);
const REFRESH_MS = 5 * 60 * 1000;
let timer = null;

function show(name) {
  $('boot').hidden = name !== 'boot';
  $('login-view').hidden = name !== 'login';
  $('app-view').hidden = name !== 'app';
}

async function load() {
  const res = await api('/api/ochrona/today');
  if (res.status === 401) {
    clearInterval(timer);
    show('login');
    $('login-password').focus();
    return;
  }
  if (!res.ok) {
    $('updated').textContent = res.body.error ?? 'Nie udało się pobrać listy.';
    return;
  }
  const { date, visits } = res.body;
  $('today-title').textContent = `Wizyty na dziś — ${humanDate(date)}`;
  const items = visits.map(({ time, name }) => {
    const li = document.createElement('li');
    li.innerHTML = '<strong></strong> · <span></span>';
    li.querySelector('strong').textContent = time;
    li.querySelector('span').textContent = name;
    return li;
  });
  $('visits').replaceChildren(...(items.length ? items : [Object.assign(document.createElement('li'), { className: 'hint', textContent: 'Na dziś nie ma umówionych wizyt.' })]));
  $('updated').textContent = `Stan na ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
  show('app');
  clearInterval(timer);
  timer = setInterval(load, REFRESH_MS);
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  const res = await api('/api/ochrona/login', {
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

$('refresh').addEventListener('click', load);
$('logout').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' });
  clearInterval(timer);
  show('login');
});

load();
