# Generuje punkt 6 sprawozdania (diagramy UML jako SVG) i wstawia go do sprawozdanie.html
# między znaczniki <!-- P6:START --> i <!-- P6:END -->.  Uruchom: python3 docs/sprawozdanie/punkt6.py
import html
import pathlib
import re

HERE = pathlib.Path(__file__).parent
FONT = 'font-family="Inter, sans-serif"'
INK = '#1f2933'
NAVY = '#1f3b5c'


def esc(s):
    return html.escape(s, quote=False)


def svg(w, h, body, author, tag):
    """Ramka diagramu: autor w lewym górnym rogu + znacznik ramy UML (pięciokąt)."""
    tw = 7.2 * len(tag) + 22
    return (
        f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" {FONT} font-size="12" fill="{INK}">'
        '<defs>'
        f'<marker id="f{{id}}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{INK}"/></marker>'
        f'<marker id="o{{id}}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11" fill="none" stroke="{INK}" stroke-width="1.3"/></marker>'
        f'<marker id="d{{id}}" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="14" markerHeight="9" orient="auto-start-reverse"><path d="M1 5 L8 1 L15 5 L8 9 z" fill="{INK}"/></marker>'
        '</defs>'
        f'<rect x="3" y="3" width="{w - 6}" height="{h - 6}" fill="#fff" stroke="#9aa5b1" stroke-width="1.2"/>'
        f'<text x="12" y="20" font-weight="700" font-size="12.5">Autor: {esc(author)}</text>'
        f'<path d="M3 30 H{tw} L{tw + 10} 40 V52 H3" fill="#f3f5f8" stroke="#9aa5b1"/>'
        f'<text x="10" y="46" font-size="11.5" font-weight="600">{esc(tag)}</text>'
        f'{body}</svg>'
    )


def line(x1, y1, x2, y2, *, dash=False, end=None, start=None, w=1.25):
    d = ' stroke-dasharray="6 4"' if dash else ''
    me = f' marker-end="url(#{end}{{id}})"' if end else ''
    ms = f' marker-start="url(#{start}{{id}})"' if start else ''
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" stroke-width="{w}"{d}{me}{ms}/>'


def path(d, *, dash=False, end=None, start=None):
    da = ' stroke-dasharray="6 4"' if dash else ''
    me = f' marker-end="url(#{end}{{id}})"' if end else ''
    ms = f' marker-start="url(#{start}{{id}})"' if start else ''
    return f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.25"{da}{me}{ms}/>'


def text(x, y, s, *, anchor='start', size=11.5, weight=None, italic=False, fill=None):
    lines = s.split('\n')
    a = f' text-anchor="{anchor}"' if anchor != 'start' else ''
    wt = f' font-weight="{weight}"' if weight else ''
    it = ' font-style="italic"' if italic else ''
    fl = f' fill="{fill}"' if fill else ''
    if len(lines) == 1:
        return f'<text x="{x}" y="{y}" font-size="{size}"{a}{wt}{it}{fl}>{esc(s)}</text>'
    spans = ''.join(f'<tspan x="{x}" dy="{0 if i == 0 else size * 1.3:.1f}">{esc(t)}</tspan>' for i, t in enumerate(lines))
    return f'<text x="{x}" y="{y}" font-size="{size}"{a}{wt}{it}{fl}>{spans}</text>'


# ---------------------------------------------------------------- diagram klas
def cls(x, y, w, name, attrs=(), ops=(), stereo=None):
    lh = 15
    head = 22 + (14 if stereo else 0)
    ha = max(len(attrs), 0) * lh + 10
    ho = len(ops) * lh + 14 if ops is not None else 0
    h = head + ha + ho
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="{INK}" stroke-width="1.3"/>']
    cy = y + 15
    if stereo:
        out.append(text(x + w / 2, cy, f'«{stereo}»', anchor='middle', size=10.5))
        cy += 14
    out.append(text(x + w / 2, cy + 1, name, anchor='middle', size=12.5, weight=700))
    out.append(line(x, y + head, x + w, y + head, w=1))
    for i, a in enumerate(attrs):
        out.append(text(x + 7, y + head + 15 + i * lh, a, size=11))
    if ops is not None:
        out.append(line(x, y + head + ha, x + w, y + head + ha, w=1))
        for i, o in enumerate(ops):
            out.append(text(x + 7, y + head + ha + 15 + i * lh, o, size=11))
    return ''.join(out), y + h


def class_diagram():
    b = []
    k, k_bot = cls(330, 70, 330, 'Kalendarz', (), (
        '+wolneTerminy(poniedziałek: Data): Termin[0..*]',
        '+zarezerwujOnline(t: Termin, k: DaneKlienta,',
        '      skrótIP: String): Wizyta',
        '+wpiszWizytę(t: Termin, k: DaneKlienta): Wizyta',
        '+odwołaj(w: Wizyta)',
        '+zablokuj(t: Termin)',
        '+odblokuj(t: Termin)',
        '+zablokujDzień(d: Data)',
        '+najbliższeWizyty(n: Integer): Wizyta[0..*]',
        '+wizytyNaDziś(): Wizyta[0..*]',
        '+usuńStareDane(): Integer',
    ))
    b.append(k)
    g, g_bot = cls(25, 74, 255, 'GrafikPrzyjęć', (
        '−godzinyStartu: Integer[0..*][7]',
    ), (
        '+godzinyDla(d: Data): Integer[0..*]',
        '+zapisz(godziny: Integer[0..*][7])',
        '−sprawdźOdstępy(): Boolean',
    ))
    b.append(g)
    t, t_bot = cls(25, 290, 255, 'Termin', (
        '+data: Data',
        '+godzinaStartu: Integer',
        '+/dostępnyOnline: Boolean',
    ), (
        '+wOknieOnline(): Boolean',
        '+minął(): Boolean',
    ))
    b.append(t)
    bl, bl_bot = cls(25, 490, 255, 'Blokada', (
        '−data: Data',
        '−godzinaStartu: Integer',
    ), ())
    b.append(bl)
    wz, wz_bot = cls(370, 350, 270, 'Wizyta', (
        '−id: Integer',
        '−źródło: ŹródłoWizyty',
        '−status: StatusWizyty',
        '−skrótIP: String [0..1]',
        '−utworzono: DataCzas',
    ), (
        '+odwołaj()',
        '+czyAktywna(): Boolean',
    ))
    b.append(wz)
    dk, _ = cls(370, 590, 270, 'DaneKlienta', (
        '+imięNazwisko: String',
        '+telefon: String [0..1]',
    ), ('+waliduj(): Boolean',), stereo='dataType')
    b.append(dk)
    kd, kd_bot = cls(705, 70, 225, 'KontoDostępu', (
        '−rola: Rola',
        '−skrótHasła: String',
        '−sekret2FA: String',
    ), (
        '+zaloguj(hasło: String,',
        '      kod: String): Sesja',
    ))
    b.append(kd)
    se, se_bot = cls(705, 300, 225, 'Sesja', (
        '−rola: Rola',
        '−wygasa: DataCzas',
    ), ('+ważna(): Boolean',))
    b.append(se)
    pl, pl_bot = cls(705, 450, 225, 'PróbaLogowania', (
        '−skrótIP: String',
        '−czas: DataCzas',
    ), ())
    b.append(pl)
    for (x, y, w, name, vals) in (
        (25, 640, 120, 'StatusWizyty', ('potwierdzona', 'odwołana')),
        (160, 640, 120, 'ŹródłoWizyty', ('online', 'telefon')),
        (705, 600, 225, 'Rola', ('personel', 'ochrona')),
    ):
        s, _ = cls(x, y, w, name, vals, None, stereo='enumeration')
        b.append(s)

    # Kalendarz ◆— GrafikPrzyjęć
    b.append(line(330, 86, 280, 86, start='d'))
    b.append(text(286, 80, '1', size=11))
    # GrafikPrzyjęć 1 — 0..* Termin  (wyznacza)
    b.append(line(150, g_bot, 150, 290))
    b.append(text(156, g_bot + 14, '1', size=11))
    b.append(text(156, 284, '0..*', size=11))
    b.append(text(160, (g_bot + 290) / 2 + 4, 'wyznacza ▼', size=11, italic=True))
    # Blokada 0..1 — 1 Termin  (wyłącza)
    b.append(line(150, t_bot, 150, 490))
    b.append(text(156, t_bot + 14, '1', size=11))
    b.append(text(156, 484, '0..1', size=11))
    b.append(text(160, (t_bot + 490) / 2 + 4, 'wyłącza ▲', size=11, italic=True))
    # Kalendarz ◆— 0..* Blokada
    b.append(path(f'M345 {k_bot} V520 H280', start='d'))
    b.append(text(286, 514, '0..*', size=11))
    # Kalendarz ◆— 0..* Wizyta
    b.append(line(505, k_bot, 505, 350, start='d'))
    b.append(text(511, 344, '0..*', size=11))
    # Wizyta 0..1 — 1 Termin (zajmuje)
    b.append(path('M370 400 H351 A6 6 0 0 0 339 400 H280'))
    b.append(text(284, 394, '1', size=11))
    b.append(text(349, 394, '0..1', size=10.5))
    b.append(text(284, 417, 'zajmuje ◀', size=11, italic=True))
    # Wizyta ◆— 1 DaneKlienta
    b.append(line(505, wz_bot, 505, 590, start='d'))
    b.append(text(511, 584, '1', size=11))
    # Kalendarz - - «use» - -> KontoDostępu
    b.append(line(660, 140, 705, 140, dash=True, end='o'))
    b.append(text(663, 133, '«use»', size=10.5))
    # KontoDostępu 1 — 0..* Sesja
    b.append(line(817, kd_bot, 817, 300))
    b.append(text(823, kd_bot + 14, '1', size=11))
    b.append(text(823, 294, '0..*', size=11))
    b.append(text(745, (kd_bot + 300) / 2 + 4, 'tworzy ▼', size=11, italic=True))
    # KontoDostępu 1 — 0..* PróbaLogowania
    b.append(path(f'M930 115 H950 V480 H930'))
    b.append(text(934, 109, '1', size=11))
    b.append(text(934, 474, '0..*', size=11))
    b.append(text(944, 300, 'rejestruje', size=11, italic=True, anchor='middle') .replace('<text ', '<text transform="rotate(90 944 300)" '))
    return svg(965, 730, ''.join(b), 'Tymon Grochowski', 'class Model systemu')


# ---------------------------------------------------------------- diagramy stanów
def state(x, y, w, h, name, internal=()):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#fff" stroke="{INK}" stroke-width="1.4"/>']
    if internal:
        out.append(text(x + w / 2, y + 20, name, anchor='middle', size=12.5, weight=700))
        out.append(line(x, y + 28, x + w, y + 28, w=1))
        for i, s in enumerate(internal):
            out.append(text(x + 8, y + 44 + i * 15, s, size=10.5))
    else:
        out.append(text(x + w / 2, y + h / 2 + 4, name, anchor='middle', size=12.5, weight=700))
    return ''.join(out)


def initial(x, y):
    return f'<circle cx="{x}" cy="{y}" r="7" fill="{INK}"/>'


def final(x, y):
    return f'<circle cx="{x}" cy="{y}" r="10" fill="#fff" stroke="{INK}" stroke-width="1.4"/><circle cx="{x}" cy="{y}" r="6" fill="{INK}"/>'


def choice(x, y):
    return f'<path d="M{x} {y - 14} L{x + 14} {y} L{x} {y + 14} L{x - 14} {y} z" fill="#fff" stroke="{INK}" stroke-width="1.4"/>'


def state_wizyta():
    b = [
        initial(40, 220),
        state(185, 180, 190, 80, 'Potwierdzona', ('entry / zajmij termin',)),
        state(560, 70, 190, 80, 'Odwołana', ('entry / zwolnij termin',)),
        state(560, 300, 190, 80, 'Zakończona', ('entry / pokaż w historii',)),
        final(860, 230),
        line(47, 220, 183, 220, end='f'),
        text(50, 192, 'rezerwacja online\n/ wpis telefoniczny', size=11),
        line(375, 200, 558, 118, end='f'),
        text(380, 112, 'odwołaj()\n[przed terminem wizyty]', size=11),
        line(375, 240, 558, 330, end='f'),
        text(250, 292, 'when(koniec czasu wizyty)', size=11),
        path('M750 110 Q820 120 852 220', end='f'),
        text(765, 90, 'czyszczenie danych\n[7 dni po terminie]', size=11),
        path('M750 340 Q820 330 852 240', end='f'),
        text(765, 380, 'czyszczenie danych\n[7 dni po terminie]', size=11),
    ]
    return svg(910, 420, ''.join(b), 'Tymon Grochowski', 'stm Wizyta')


def state_termin():
    b = [
        initial(40, 280),
        state(170, 250, 180, 60, 'Wolny'),
        state(580, 70, 180, 60, 'Zajęty'),
        state(580, 440, 180, 60, 'Zablokowany'),
        final(880, 285),
        line(47, 280, 168, 280, end='f'),
        text(48, 266, '[godzina w grafiku]', size=11),
        # Wolny -> Zajęty
        line(330, 250, 578, 88, end='f'),
        text(190, 150, 'rezerwacja online [od 24 h do 28 dni\nprzed terminem] / wpis telefoniczny', size=11),
        # Zajęty -> Wolny
        line(578, 112, 350, 262, end='f'),
        text(430, 258, 'odwołanie wizyty [nie wszystkie\ninne wolne terminy dnia zablokowane]', size=11),
        # Wolny -> Zablokowany
        line(350, 300, 578, 452, end='f'),
        text(440, 335, 'zablokuj termin\n/ zablokuj dzień', size=11),
        # Zablokowany -> Wolny
        line(578, 480, 300, 310, end='f'),
        text(300, 400, 'odblokuj termin\n/ odblokuj dzień', size=11),
        # Zajęty -> Zablokowany
        line(670, 130, 670, 438, end='f'),
        text(680, 250, 'odwołanie wizyty\n[pozostałe wolne\nterminy dnia\nzablokowane]', size=11),
        # -> final
        path('M760 100 Q860 120 878 273', end='f'),
        text(775, 84, 'when(termin minął)', size=11),
        path('M760 470 Q860 450 878 297', end='f'),
        text(775, 512, 'when(termin minął)', size=11),
        path('M260 310 V560 H905 V285 H892', end='f'),
        text(330, 553, 'when(termin minął) / usunięcie godziny z grafiku', size=11),
    ]
    return svg(930, 585, ''.join(b), 'Hubert Zduńczyk', 'stm Termin')


def state_sesja():
    b = [
        initial(55, 160),
        state(130, 130, 190, 60, 'Niezalogowany'),
        choice(440, 160),
        state(590, 120, 230, 80, 'Zalogowany', ('do / dostęp do panelu', '      lub do widoku ochrony')),
        state(345, 330, 190, 60, 'Zablokowany'),
        line(62, 160, 128, 160, end='f'),
        line(320, 160, 426, 160, end='f'),
        text(330, 150, 'hasło i kod 2FA', size=11),
        line(454, 160, 588, 160, end='f'),
        text(462, 150, '[poprawne]', size=11),
        text(462, 180, '/ utwórz sesję', size=11),
        # retry
        path('M440 146 V100 H250 V128', end='f'),
        text(258, 92, '[błędne, mniej niż 8 prób w 15 min] / zapisz próbę', size=11),
        # -> Zablokowany
        line(440, 174, 440, 328, end='f'),
        text(450, 240, '[8. nieudana próba\nw ciągu 15 min]', size=11),
        # Zablokowany -> Niezalogowany
        path('M345 360 H200 V192', end='f'),
        text(210, 380, 'after(15 min)', size=11),
        # Zalogowany -> Niezalogowany
        path('M705 120 V70 H170 V128', end='f'),
        text(330, 62, 'wyloguj() / after(30 dni; ochrona: 12 h)', size=11),
    ]
    return svg(860, 420, ''.join(b), 'Wojciech Czajkowski', 'stm Sesja logowania')


# ---------------------------------------------------------------- diagramy sekwencji
def actor_head(x, y, name):
    return (
        f'<g stroke="{INK}" stroke-width="1.4" fill="none"><circle cx="{x}" cy="{y}" r="9" fill="#fff"/>'
        f'<line x1="{x}" y1="{y + 9}" x2="{x}" y2="{y + 32}"/><line x1="{x - 14}" y1="{y + 17}" x2="{x + 14}" y2="{y + 17}"/>'
        f'<line x1="{x}" y1="{y + 32}" x2="{x - 11}" y2="{y + 50}"/><line x1="{x}" y1="{y + 32}" x2="{x + 11}" y2="{y + 50}"/></g>'
        + text(x, y + 66, name, anchor='middle', size=12, weight=600)
    )


def seq(author, tag, lifelines, steps, height):
    """lifelines: [(x, nazwa, czy_aktor)]; steps: lista krotek opisujących komunikaty i fragmenty."""
    top, b = 70, []
    for x, name, is_actor in lifelines:
        if is_actor:
            b.append(actor_head(x, top, name))
            y0 = top + 74
        else:
            w = 7.0 * len(name) + 20
            b.append(f'<rect x="{x - w / 2}" y="{top + 18}" width="{w}" height="34" fill="#fff" stroke="{INK}" stroke-width="1.3"/>')
            b.append(text(x, top + 40, name, anchor='middle', size=12).replace('<text ', '<text text-decoration="underline" '))
            y0 = top + 52
        b.append(line(x, y0, x, height - 18, dash=True, w=1))
    xs = {name: x for x, name, _ in lifelines}
    for st in steps:
        kind = st[0]
        if kind in ('call', 'ret'):
            _, a, c, y, label = st
            x1, x2 = xs[a], xs[c]
            b.append(line(x1, y, x2 + (-2 if x2 > x1 else 2), y, dash=(kind == 'ret'), end=('f' if kind == 'call' else 'o')))
            lx = min(x1, x2) + 8
            b.append(text(lx, y - 6, label, size=11))
        elif kind == 'self':
            _, a, y, label = st
            x = xs[a]
            b.append(path(f'M{x} {y} H{x + 34} V{y + 20} H{x + 2}', end='f'))
            b.append(text(x + 40, y + 14, label, size=11))
        elif kind == 'frag':
            _, op, x1, y1, x2, y2, guards = st
            b.append(f'<rect x="{x1}" y="{y1}" width="{x2 - x1}" height="{y2 - y1}" fill="none" stroke="{INK}" stroke-width="1.2"/>')
            tw = 9 * len(op) + 18
            b.append(f'<path d="M{x1} {y1} H{x1 + tw} V{y1 + 12} L{x1 + tw - 8} {y1 + 20} H{x1} z" fill="#f3f5f8" stroke="{INK}" stroke-width="1.1"/>')
            b.append(text(x1 + 7, y1 + 15, op, size=11.5, weight=700))
            for gy, g, sep in guards:
                if sep:
                    b.append(line(x1, gy - 14, x2, gy - 14, dash=True, w=1))
                b.append(text(x1 + tw + 10 if not sep else x1 + 10, gy, g, size=11, weight=600))
    return svg(xs[lifelines[-1][1]] + 110, height, ''.join(b), author, tag)


def seq_uc2():
    L = [(80, 'Klient', True), (330, ':StronaRezerwacji', False), (575, ':FunkcjaRezerwacji', False), (800, ':BazaDanych', False)]
    K, S, F, B = 'Klient', ':StronaRezerwacji', ':FunkcjaRezerwacji', ':BazaDanych'
    st = [
        ('call', K, S, 175, '1: wybierzTermin(termin)'),
        ('call', K, S, 205, '2: podajDane(imięNazwisko, tel., zgoda)'),
        ('self', S, 220, '3: sprawdźDane()'),
        ('call', S, F, 275, '4: POST /api/book(termin, dane)'),
        ('self', F, 290, '5: waliduj(dane, termin)'),
        ('call', F, B, 345, '6: sprawdźGrafikIBlokadę(termin)'),
        ('ret', B, F, 375, '7: termin w grafiku, brak blokady'),
        ('call', F, B, 405, '8: policzAktywne(telefon)'),
        ('ret', B, F, 435, '9: liczba < 2'),
        ('call', F, B, 465, '10: policzZAdresu(skrótIP, 24 h)'),
        ('ret', B, F, 495, '11: liczba < 3'),
        ('call', F, B, 525, '12: zapisz(wizyta: potwierdzona)'),
        ('frag', 'alt', 25, 540, 870, 745, [(562, '[termin wolny]', False), (665, '[termin zajęty w międzyczasie]', True)]),
        ('ret', B, F, 585, '13: zapisano'),
        ('ret', F, S, 612, '14: 200 OK'),
        ('ret', S, K, 639, '15: potwierdzenie rezerwacji'),
        ('ret', B, F, 690, '13a: naruszenie unikalności terminu'),
        ('ret', F, S, 712, '14a: 409 — termin zajęty'),
        ('ret', S, K, 734, '15a: komunikat i aktualne terminy'),
    ]
    return seq('Tymon Grochowski', 'sd UC2: Rezerwowanie wizyty', L, st, 775)


def seq_uc4():
    R, P, F, B = 'Recepcjonista', ':Panel', ':FunkcjaOdwołania', ':BazaDanych'
    L = [(80, R, True), (330, P, False), (575, F, False), (800, B, False)]
    st = [
        ('call', R, P, 175, '1: wskażWizytę(w)'),
        ('ret', P, R, 202, '2: szczegóły wizyty'),
        ('call', R, P, 229, '3: odwołaj()'),
        ('ret', P, R, 256, '4: pytanie + numer telefonu klienta'),
        ('call', R, P, 283, '5: potwierdź()'),
        ('call', P, F, 320, '6: POST /api/admin/cancel(id)'),
        ('self', F, 335, '7: sprawdźSesję()'),
        ('call', F, B, 390, '8: ustawStatus(id, odwołana)'),
        ('ret', B, F, 418, '9: telefon, data, godzina'),
        ('call', F, B, 446, '10: policzBlokadyIWizyty(data)'),
        ('ret', B, F, 474, '11: liczby'),
        ('frag', 'opt', 470, 488, 870, 548, [(510, '[pozostałe wolne terminy dnia zablokowane]', False)]),
        ('call', F, B, 538, '12: zablokuj(termin)'),
        ('ret', F, P, 580, '13: 200 OK (telefon)'),
        ('ret', P, R, 610, '14: kalendarz bez odwołanej wizyty'),
    ]
    return seq('Hubert Zduńczyk', 'sd UC4: Odwoływanie wizyty', L, st, 640)


def seq_uc3():
    R, P, F, B = 'Recepcjonista', ':Panel', ':FunkcjaWpisu', ':BazaDanych'
    L = [(80, R, True), (330, P, False), (575, F, False), (800, B, False)]
    st = [
        ('call', R, P, 175, '1: wskażWolnyTermin(t)'),
        ('ret', P, R, 202, '2: wybór: wpisz wizytę / zablokuj'),
        ('call', R, P, 229, '3: wpiszWizytę()'),
        ('call', R, P, 256, '4: podajDane(imięNazwisko, tel.)'),
        ('call', P, F, 295, '5: POST /api/admin/book(t, dane)'),
        ('self', F, 310, '6: sprawdźSesję(), waliduj(dane)'),
        ('call', F, B, 365, '7: pobierzGrafik()'),
        ('ret', B, F, 393, '8: grafik'),
        ('call', F, B, 421, '9: zapisz(wizyta, źródło = telefon)'),
        ('frag', 'alt', 25, 436, 870, 655, [(458, '[termin wolny]', False), (585, '[na termin jest już wizyta]', True)]),
        ('ret', B, F, 480, '10: zapisano'),
        ('call', F, B, 506, '11: usuńBlokadę(t)'),
        ('ret', F, P, 532, '12: 200 OK'),
        ('ret', P, R, 558, '13: kalendarz z nową wizytą'),
        ('ret', B, F, 610, '10a: naruszenie unikalności terminu'),
        ('ret', F, P, 630, '11a: 409 — termin zajęty'),
        ('ret', P, R, 648, '12a: komunikat o zajętym terminie'),
    ]
    return seq('Wojciech Czajkowski', 'sd UC3: Wpisywanie wizyty', L, st, 680)


# ---------------------------------------------------------------- diagram wdrożenia
def node(x, y, w, h, stereo, name, fill='#fff', d=12):
    return (
        f'<path d="M{x} {y} L{x + d} {y - d} H{x + w + d} L{x + w} {y} z" fill="#e9eef4" stroke="{INK}" stroke-width="1.3"/>'
        f'<path d="M{x + w} {y} L{x + w + d} {y - d} V{y + h - d} L{x + w} {y + h} z" fill="#dde4ec" stroke="{INK}" stroke-width="1.3"/>'
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{INK}" stroke-width="1.3"/>'
        + text(x + w / 2, y + 16, f'«{stereo}»', anchor='middle', size=10.5)
        + text(x + w / 2, y + 31, name, anchor='middle', size=12, weight=700)
    )


def env(x, y, w, h, name, artifacts):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#f7f9fb" stroke="{INK}" stroke-width="1.1"/>',
           text(x + w / 2, y + 14, '«executionEnvironment»', anchor='middle', size=10),
           text(x + w / 2, y + 28, name, anchor='middle', size=11.5, weight=600)]
    for i, a in enumerate(artifacts):
        ay = y + 38 + i * 24
        out.append(f'<rect x="{x + 10}" y="{ay}" width="{w - 20}" height="20" fill="#fff" stroke="{INK}" stroke-width="1"/>')
        out.append(f'<path d="M{x + w - 24} {ay + 4} h7 l4 4 v9 h-11 z" fill="none" stroke="{INK}" stroke-width=".9"/>')
        out.append(text(x + 16, ay + 14, a, size=10.5))
    return ''.join(out)


def deployment():
    b = []
    devs = [
        (80, 'Telefon / komputer klienta', ['«artifact» index.html', '«artifact» rezerwacja.js']),
        (250, 'Urządzenie personelu gabinetu', ['«artifact» panel.html', '«artifact» panel.js']),
        (420, 'Urządzenie ochrony budynku', ['«artifact» ochrona.html', '«artifact» ochrona.js']),
    ]
    for y, name, arts in devs:
        b.append(node(20, y, 250, 140, 'device', name))
        b.append(env(35, y + 40, 220, 88, 'Przeglądarka internetowa', arts))
    b.append(node(370, 80, 300, 480, 'node', 'Platforma Vercel (chmura)'))
    b.append(env(385, 120, 270, 112, 'Sieć CDN — pliki statyczne', ['«artifact» *.html, js/, css/, fonts/', '«artifact» vercel.json (nagłówki, CSP)', '«artifact» .env (konfiguracja)']))
    b.append(env(385, 255, 270, 160, 'Node.js 20 — funkcje serverless', ['«artifact» api/slots.js, api/book.js', '«artifact» api/admin/*.js', '«artifact» api/ochrona/*.js', '«artifact» api/_lib.js (reguły, 2FA)', '«artifact» @neondatabase/serverless']))
    b.append(env(385, 440, 270, 64, 'Vercel Cron', ['«artifact» harmonogram „0 3 * * *”']))
    b.append(node(745, 200, 200, 190, 'node', 'Neon (chmura)'))
    b.append(env(757, 240, 176, 136, 'PostgreSQL', ['«artifact» bookings', '«artifact» blocks', '«artifact» settings', '«artifact» login_attempts']))
    # ścieżki komunikacji
    for y in (150, 320, 490):
        b.append(line(270, y, 370, 160 if y == 150 else (300 if y == 320 else 340)))
    b.append(text(282, 138, 'HTTPS', size=11, weight=600))
    b.append(text(282, 312, 'HTTPS', size=11, weight=600))
    b.append(text(282, 455, 'HTTPS', size=11, weight=600))
    b.append(line(670, 300, 745, 300))
    b.append(text(676, 292, 'HTTPS', size=11, weight=600))
    b.append(text(676, 318, '(TLS, 443)', size=10.5))
    b.append(line(520, 440, 520, 415, end='f'))
    b.append(text(528, 432, 'HTTPS, codziennie 3:00', size=10.5))
    return svg(975, 580, ''.join(b), 'Wojciech Czajkowski', 'deployment Wdrożenie')


# ---------------------------------------------------------------- treść punktu 6
FIG = [0]


def figure(svg_code, caption):
    FIG[0] += 1
    n = FIG[0] + 2  # rysunki 1–2 są w punktach 2 i 4.1
    return f'<figure>\n{svg_code.replace("{id}", str(n))}\n<figcaption>Rysunek {n}. {esc(caption)}</figcaption>\n</figure>\n'


def build():
    p = []
    p.append('<h2 class="newpage">6. Model systemu</h2>\n')
    p.append('<p>Model systemu opisano ośmioma diagramami UML. Razem z diagramem przypadków użycia (punkt 4.1) każdy członek zespołu opracował trzy diagramy UML różnych typów. Imię i nazwisko autora jest w lewym górnym rogu każdego diagramu.</p>\n')
    p.append('<table class="keep">\n  <thead><tr><th style="width:36mm">Autor</th><th>Diagramy UML</th></tr></thead>\n  <tbody>\n'
             '  <tr><td class="id">Tymon Grochowski</td><td>diagram klas (6.1), diagram stanów „Wizyta” (6.2), diagram sekwencji UC2 (6.3); ponadto wymagania pozafunkcjonalne (punkt 5)</td></tr>\n'
             '  <tr><td class="id">Hubert Zduńczyk</td><td>diagram przypadków użycia (4.1), diagram stanów „Termin” (6.2), diagram sekwencji UC4 (6.3)</td></tr>\n'
             '  <tr><td class="id">Wojciech Czajkowski</td><td>diagram stanów „Sesja logowania” (6.2), diagram sekwencji UC3 (6.3), diagram wdrożenia (6.4)</td></tr>\n'
             '  </tbody>\n</table>\n')

    p.append('<h3>6.1. Diagram klas</h3>\n')
    p.append(figure(class_diagram(), 'Diagram klas'))
    p.append('<p>Centralną klasą jest <i>Kalendarz</i>, który udostępnia operacje przypadków użycia i jest właścicielem grafiku przyjęć, wizyt i blokad. <i>Termin</i> nie jest przechowywany w bazie: powstaje z grafiku dla konkretnej daty, a jego dostępność online wynika z okna od 24 godzin do 28 dni i z tego, czy termin nie jest zajęty ani zablokowany (atrybut pochodny <i>/dostępnyOnline</i>). Dane klienta są częścią wizyty i znikają razem z nią po 7 dniach od terminu. <i>KontoDostępu</i> ma dwie instancje: wspólne konto personelu (rola <i>personel</i>) i konto ochroniarza (rola <i>ochrona</i>).</p>\n')

    p.append('<h3>6.2. Diagram stanów</h3>\n')
    p.append(figure(state_wizyta(), 'Diagram stanów wizyty'))
    p.append('<p>Wizyta powstaje od razu jako potwierdzona, zarówno przy rezerwacji online, jak i przy wpisie telefonicznym. Może zostać odwołana tylko przed swoim terminem; po upływie czasu wizyty przechodzi w stan „Zakończona”. Niezależnie od stanu końcowego dane wizyty są usuwane przez codzienne czyszczenie 7 dni po terminie.</p>\n')
    p.append(figure(state_termin(), 'Diagram stanów terminu'))
    p.append('<p>Termin wynika z grafiku przyjęć. Wolny termin można zarezerwować online (od 24 godzin do 28 dni przed nim) albo wpisać telefonicznie, a także zablokować. Odwołanie wizyty zwalnia termin, chyba że wszystkie pozostałe wolne terminy tego dnia są zablokowane (np. urlop) — wtedy zwolniony termin również zostaje zablokowany.</p>\n')
    p.append(figure(state_sesja(), 'Diagram stanów sesji logowania'))
    p.append('<p>Logowanie wymaga hasła i kodu z aplikacji uwierzytelniającej. Po ośmiu nieudanych próbach z jednego adresu w ciągu 15 minut logowanie jest blokowane na 15 minut. Sesja personelu wygasa po 30 dniach, a sesja ochroniarza po 12 godzinach.</p>\n')

    p.append('<h3>6.3. Diagram sekwencji</h3>\n')
    p.append(figure(seq_uc2(), 'Diagram sekwencji przypadku UC2: Rezerwowanie wizyty'))
    p.append('<p>Funkcja rezerwacji sprawdza kolejno grafik i blokady, limit dwóch aktywnych rezerwacji na numer telefonu i limit trzech rezerwacji na dobę z jednego adresu. Gdy dwie osoby wybiorą ten sam termin jednocześnie, baza danych przyjmuje tylko pierwszy zapis dzięki unikalności aktywnej wizyty w danym terminie.</p>\n')
    p.append(figure(seq_uc4(), 'Diagram sekwencji przypadku UC4: Odwoływanie wizyty'))
    p.append('<p>Przed odwołaniem panel przypomina numer telefonu klienta. Jeśli pozostałe wolne terminy dnia są zablokowane, funkcja blokuje też zwolniony termin, aby nie wrócił do rezerwacji online.</p>\n')
    p.append(figure(seq_uc3(), 'Diagram sekwencji przypadku UC3: Wpisywanie wizyty umówionej telefonicznie'))
    p.append('<p>Wizyta wpisana przez recepcjonistę ma źródło „telefon” i nie podlega limitom rezerwacji online. Po udanym zapisie funkcja usuwa ewentualną blokadę terminu.</p>\n')

    p.append('<h3>6.4. Diagram wdrożenia</h3>\n')
    p.append(figure(deployment(), 'Diagram wdrożenia'))
    p.append('<p>Klient, personel i ochroniarz korzystają z systemu przez przeglądarkę. Pliki strony są serwowane z sieci CDN platformy Vercel, a logika działa w funkcjach serverless Node.js. Dane są przechowywane w bazie PostgreSQL w usłudze Neon. Codzienne czyszczenie danych uruchamia Vercel Cron. Cała komunikacja odbywa się przez HTTPS, a obie usługi działają na darmowych planach.</p>\n')
    return ''.join(p)


def main():
    f = HERE / 'sprawozdanie.html'
    s = f.read_text(encoding='utf8')
    block = '<!-- P6:START -->\n' + build() + '<!-- P6:END -->'
    if '<!-- P6:START -->' in s:
        s = re.sub(r'<!-- P6:START -->.*?<!-- P6:END -->', lambda m: block, s, flags=re.S)
    else:
        s = s.replace('</body>', block + '\n\n</body>')
    f.write_text(s, encoding='utf8')
    print('punkt 6 wstawiony, rysunków:', FIG[0])


if __name__ == '__main__':
    main()
