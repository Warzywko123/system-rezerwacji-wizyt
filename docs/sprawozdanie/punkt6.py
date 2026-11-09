# Generuje punkt 6 sprawozdania (diagramy UML jako SVG) i wstawia go do sprawozdanie.html
# między znaczniki <!-- P6:START --> i <!-- P6:END -->.  Uruchom: python3 docs/sprawozdanie/punkt6.py
#
# Szerokości diagramów (viewBox) dobrano tak, żeby po wstawieniu na stronę A4 (172 mm szerokości
# treści) najmniejsze napisy miały co najmniej ok. 7 pkt — schemat sprawozdania wymaga czytelności.
import html
import pathlib
import re

HERE = pathlib.Path(__file__).parent
FONT = 'font-family="Inter, sans-serif"'
INK = '#1f2933'


def esc(s):
    return html.escape(s, quote=False)


def svg(w, h, body, author, tag):
    """Ramka diagramu: autor w lewym górnym rogu + znacznik ramy UML (pięciokąt z rodzajem diagramu)."""
    tw = 7.4 * len(tag) + 22
    return (
        f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" {FONT} font-size="12" fill="{INK}">'
        '<defs>'
        f'<marker id="f{{id}}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{INK}"/></marker>'
        f'<marker id="o{{id}}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11" fill="none" stroke="{INK}" stroke-width="1.3"/></marker>'
        f'<marker id="d{{id}}" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="14" markerHeight="9" orient="auto-start-reverse"><path d="M1 5 L8 1 L15 5 L8 9 z" fill="{INK}"/></marker>'
        '</defs>'
        f'<rect x="3" y="3" width="{w - 6}" height="{h - 6}" fill="#fff" stroke="#9aa5b1" stroke-width="1.2"/>'
        f'<text x="12" y="21" font-weight="700" font-size="13">Autor: {esc(author)}</text>'
        f'<path d="M3 30 H{tw} L{tw + 10} 40 V52 H3" fill="#f3f5f8" stroke="#9aa5b1"/>'
        f'<text x="10" y="46" font-size="12" font-weight="600">{esc(tag)}</text>'
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


def text(x, y, s, *, anchor='start', size=12, weight=None, italic=False, fill=None, rotate=None):
    lines = s.split('\n')
    a = f' text-anchor="{anchor}"' if anchor != 'start' else ''
    wt = f' font-weight="{weight}"' if weight else ''
    it = ' font-style="italic"' if italic else ''
    fl = f' fill="{fill}"' if fill else ''
    tr = f' transform="rotate({rotate} {x} {y})"' if rotate is not None else ''
    sp = ' xml:space="preserve"' if s.startswith(' ') else ''
    if len(lines) == 1:
        return f'<text x="{x}" y="{y}" font-size="{size}"{a}{wt}{it}{fl}{tr}{sp}>{esc(s)}</text>'
    spans = ''.join(f'<tspan x="{x}" dy="{0 if i == 0 else size * 1.3:.1f}">{esc(t)}</tspan>' for i, t in enumerate(lines))
    return f'<text x="{x}" y="{y}" font-size="{size}"{a}{wt}{it}{fl}{tr}>{spans}</text>'


# ---------------------------------------------------------------- diagram klas
def cls(x, y, w, name, attrs=(), ops=(), stereo=None):
    """Klasa UML. ops=None — bez przedziału operacji (np. wyliczenie, typ danych)."""
    lh = 15
    head = 22 + (14 if stereo else 0)
    ha = len(attrs) * lh + 10
    ho = len(ops) * lh + 14 if ops is not None else 0
    h = head + ha + ho
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="{INK}" stroke-width="1.3"/>']
    cy = y + 15
    if stereo:
        out.append(text(x + w / 2, cy, f'«{stereo}»', anchor='middle', size=11))
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
    k, k_bot = cls(340, 60, 350, 'Kalendarz', (), (
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
    g, g_bot = cls(15, 60, 265, 'GrafikPrzyjęć', ('−dniPrzyjęć: DzieńPrzyjęć[7]',), (
        '+godzinyDla(d: Data): Integer[0..*]',
        '+zapisz(dni: DzieńPrzyjęć[7])',
        '−sprawdźOdstępy(): Boolean',
    ))
    dz, dz_bot = cls(15, 215, 265, 'DzieńPrzyjęć', ('+dzieńTygodnia: Integer', '+godzinyStartu: Integer[0..*]'), None, stereo='dataType')
    t, t_bot = cls(15, 345, 265, 'Termin', ('+data: Data', '+godzinaStartu: Integer', '+/dostępnyOnline: Boolean'),
                   ('+wOknieOnline(): Boolean', '+minął(): Boolean'))
    bl, bl_bot = cls(15, 520, 265, 'Blokada', ('−data: Data', '−godzinaStartu: Integer'), ())
    wz, wz_bot = cls(380, 330, 310, 'Wizyta', ('−id: Integer', '−źródło: ŹródłoWizyty', '−status: StatusWizyty',
                                              '−skrótIP: String [0..1]', '−utworzono: DataCzas'),
                     ('+odwołaj()', '+czyAktywna(): Boolean'))
    dk, _ = cls(380, 535, 310, 'DaneKlienta', ('+imięNazwisko: String', '+telefon: String [0..1]'),
                ('+waliduj(): Boolean',), stereo='dataType')
    kd, kd_bot = cls(380, 700, 180, 'KontoDostępu', ('−rola: Rola', '−skrótHasła: String', '−sekret2FA: String'),
                     ('+zaloguj(hasło: String,', '      kod: String): Sesja'))
    se, _ = cls(600, 700, 120, 'Sesja', ('−rola: Rola', '−wygasa: DataCzas'), ('+ważna(): Boolean',))
    pl, _ = cls(155, 770, 125, 'PróbaLogowania', ('−skrótIP: String', '−czas: DataCzas'), ())
    b += [k, g, dz, t, bl, wz, dk, kd, se, pl]
    for (x, y, w, name, vals) in (
        (15, 650, 125, 'StatusWizyty', ('potwierdzona', 'odwołana')),
        (155, 650, 125, 'ŹródłoWizyty', ('online', 'telefon')),
        (15, 770, 125, 'Rola', ('personel', 'ochrona')),
    ):
        b.append(cls(x, y, w, name, vals, None, stereo='enumeration')[0])

    # Kalendarz ◆— 1 GrafikPrzyjęć
    b.append(line(340, 86, 280, 86, start='d'))
    b.append(text(284, 80, '1', size=11))
    # GrafikPrzyjęć ◆— 7 DzieńPrzyjęć
    b.append(line(147, g_bot, 147, 215, start='d'))
    b.append(text(153, 209, '7', size=11))
    # DzieńPrzyjęć 1 — 0..* Termin (wyznacza)
    b.append(line(147, dz_bot, 147, 345))
    b.append(text(153, dz_bot + 14, '1', size=11))
    b.append(text(153, 339, '0..*', size=11))
    b.append(text(185, (dz_bot + 345) / 2 + 4, 'wyznacza ▼', size=11, italic=True))
    # Termin 1 — 0..1 Blokada (wyłącza)
    b.append(line(147, t_bot, 147, 520))
    b.append(text(153, t_bot + 14, '1', size=11))
    b.append(text(153, 514, '0..1', size=11))
    b.append(text(185, (t_bot + 520) / 2 + 4, 'wyłącza ▲', size=11, italic=True))
    # Kalendarz ◆— 0..* Blokada
    b.append(path('M340 250 H305 V558 H280', start='d'))
    b.append(text(284, 552, '0..*', size=11))
    # Kalendarz ◆— 0..* Wizyta
    b.append(line(535, k_bot, 535, 330, start='d'))
    b.append(text(541, 324, '0..*', size=11))
    # Wizyta 0..1 — 1 Termin (zajmuje), z mostkiem nad linią kompozycji Blokady
    b.append(path('M380 400 H311 A6 6 0 0 0 299 400 H280'))
    b.append(text(284, 394, '1', size=11))
    b.append(text(350, 394, '0..1', size=11))
    b.append(text(312, 418, 'zajmuje ◀', size=11, italic=True))
    # Wizyta ◆— 1 DaneKlienta
    b.append(line(535, wz_bot, 535, 535, start='d'))
    b.append(text(541, 529, '1', size=11))
    # KontoDostępu 1 — 0..* PróbaLogowania
    b.append(line(380, 808, 280, 808))
    b.append(text(366, 802, '1', size=11))
    b.append(text(284, 802, '0..*', size=11))
    # KontoDostępu 1 — 0..* Sesja
    b.append(line(560, 730, 600, 730))
    b.append(text(564, 724, '1', size=11))
    b.append(text(572, 746, '0..*', size=11))
    # Kalendarz - - «use» - -> KontoDostępu
    b.append(path('M690 150 H712 V680 H470 V698', dash=True, end='o'))
    b.append(text(693, 142, '«use»', size=11))
    return svg(730, 870, ''.join(b), 'Tymon Grochowski', 'class Model systemu')


# ---------------------------------------------------------------- diagramy stanów
def state(x, y, w, h, name, internal=()):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#fff" stroke="{INK}" stroke-width="1.4"/>']
    if internal:
        out.append(text(x + w / 2, y + 20, name, anchor='middle', size=13, weight=700))
        out.append(line(x, y + 28, x + w, y + 28, w=1))
        for i, s in enumerate(internal):
            out.append(text(x + 8, y + 45 + i * 16, s, size=12))
    else:
        out.append(text(x + w / 2, y + h / 2 + 5, name, anchor='middle', size=13, weight=700))
    return ''.join(out)


def initial(x, y):
    return f'<circle cx="{x}" cy="{y}" r="7" fill="{INK}"/>'


def final(x, y):
    return f'<circle cx="{x}" cy="{y}" r="10" fill="#fff" stroke="{INK}" stroke-width="1.4"/><circle cx="{x}" cy="{y}" r="6" fill="{INK}"/>'


def choice(x, y):
    return f'<path d="M{x} {y - 14} L{x + 14} {y} L{x} {y + 14} L{x - 14} {y} z" fill="#fff" stroke="{INK}" stroke-width="1.4"/>'


def state_wizyta():
    b = [
        initial(35, 215),
        state(130, 175, 200, 80, 'Potwierdzona', ('entry / zajmij termin',)),
        state(470, 60, 200, 80, 'Odwołana', ('entry / zwolnij termin',)),
        state(470, 300, 200, 80, 'Zakończona', ('entry / pokaż w historii',)),
        final(775, 220),
        line(42, 215, 128, 215, end='f'),
        line(330, 195, 468, 110, end='f'),
        text(255, 92, 'odwołaj()\n[przed terminem wizyty]'),
        line(330, 235, 468, 330, end='f'),
        text(185, 300, 'when(koniec czasu wizyty)'),
        path('M670 100 Q760 110 769 208', end='f'),
        text(680, 52, 'czyszczenie danych\n[7 dni po terminie]\n/ usuń dane'),
        path('M670 340 Q760 330 769 232', end='f'),
        text(680, 365, 'czyszczenie danych\n[7 dni po terminie]\n/ usuń dane'),
    ]
    return svg(820, 440, ''.join(b), 'Tymon Grochowski', 'stm Wizyta')


def state_termin():
    b = [
        initial(30, 268),
        state(120, 250, 170, 60, 'Wolny'),
        state(540, 250, 170, 60, 'Zajęty'),
        state(120, 470, 170, 60, 'Zablokowany'),
        final(790, 500),
        line(37, 268, 118, 268, end='f'),
        # Wolny -> Zajęty (dwa niezależne zdarzenia = dwa przejścia)
        path('M230 250 Q415 140 600 248', end='f'),
        text(415, 163, 'rezerwacja online\n[od 24 h do 28 dni przed terminem]', anchor='middle'),
        line(290, 270, 538, 270, end='f'),
        text(300, 262, 'wpisanie wizyty przez personel'),
        # Zajęty -> Wolny
        line(540, 292, 292, 292, end='f'),
        text(300, 310, 'odwołanie wizyty [nie wszystkie\ninne wolne terminy dnia zablokowane]'),
        # Wolny <-> Zablokowany
        line(165, 310, 165, 468, end='f'),
        text(160, 385, 'zablokuj termin,\nzablokuj dzień', anchor='end'),
        line(245, 470, 245, 312, end='f'),
        text(253, 385, 'odblokuj termin,\nodblokuj dzień'),
        # Zajęty -> Zablokowany
        line(590, 310, 282, 468, end='f'),
        text(440, 440, 'odwołanie wizyty [pozostałe\nwolne terminy dnia zablokowane]'),
        # -> stan końcowy
        path('M710 280 Q790 300 790 488', end='f'),
        text(760, 400, 'when(termin minął)', anchor='end'),
        line(290, 500, 778, 500, end='f'),
        text(520, 492, 'when(termin minął)'),
        path('M120 300 H45 V575 H790 V512', end='f'),
        text(300, 568, 'when(termin minął), usunięcie godziny z grafiku'),
    ]
    return svg(830, 600, ''.join(b), 'Hubert Zduńczyk', 'stm Termin')


def state_sesja():
    b = [
        initial(40, 210),
        state(110, 180, 170, 60, 'Niezalogowany'),
        choice(400, 210),
        state(518, 160, 292, 104, 'Zalogowany', ('entry / ustaw ważność: 30 dni', '      (ochrona: 12 godzin)',
                                                'do / dostęp do panelu lub widoku ochrony')),
        state(315, 360, 170, 60, 'Zablokowany'),
        line(47, 210, 108, 210, end='f'),
        line(280, 210, 386, 210, end='f'),
        text(288, 202, 'hasło i kod 2FA'),
        line(414, 210, 518, 210, end='f'),
        text(420, 202, '[poprawne]'),
        text(420, 230, '/ utwórz sesję'),
        path('M400 196 V130 H230 V178', end='f'),
        text(236, 122, '[błędne, mniej niż 8 prób w 15 min] / zapisz próbę'),
        path('M650 160 V75 H160 V178', end='f'),
        text(300, 67, 'wyloguj(), after(czas ważności)'),
        line(400, 224, 400, 358, end='f'),
        text(410, 285, '[8. nieudana próba\nw ciągu 15 min]'),
        path('M315 390 H195 V242', end='f'),
        text(205, 412, 'after(15 min)'),
    ]
    return svg(820, 450, ''.join(b), 'Wojciech Czajkowski', 'stm Sesja logowania')


# ---------------------------------------------------------------- diagramy sekwencji
LX = (65, 290, 510, 715)  # osie linii życia


def actor_head(x, y, name):
    return (
        f'<g stroke="{INK}" stroke-width="1.4" fill="none"><circle cx="{x}" cy="{y}" r="9" fill="#fff"/>'
        f'<line x1="{x}" y1="{y + 9}" x2="{x}" y2="{y + 32}"/><line x1="{x - 14}" y1="{y + 17}" x2="{x + 14}" y2="{y + 17}"/>'
        f'<line x1="{x}" y1="{y + 32}" x2="{x - 11}" y2="{y + 50}"/><line x1="{x}" y1="{y + 32}" x2="{x + 11}" y2="{y + 50}"/></g>'
        + text(x, y + 67, name, anchor='middle', size=12.5, weight=600)
    )


def seq(author, tag, names, steps, height, width=790):
    """names: nazwy linii życia (pierwsza = aktor); steps: komunikaty i fragmenty wyznaczone w kolejności rysowania."""
    top, b = 70, []
    xs = dict(zip(names, LX))
    for i, name in enumerate(names):
        x = xs[name]
        if i == 0:
            b.append(actor_head(x, top, name))
            y0 = top + 74
        else:
            w = 7.2 * len(name) + 22
            b.append(f'<rect x="{x - w / 2}" y="{top + 18}" width="{w}" height="34" fill="#fff" stroke="{INK}" stroke-width="1.3"/>')
            b.append(text(x, top + 40, name, anchor='middle', size=12.5))
            y0 = top + 52
        b.append(line(x, y0, x, height - 18, dash=True, w=1))
    for st in steps:
        kind = st[0]
        if kind in ('call', 'ret'):
            _, a, c, y, label = st
            x1, x2 = xs[a], xs[c]
            b.append(line(x1, y, x2 + (-2 if x2 > x1 else 2), y, dash=(kind == 'ret'), end=('f' if kind == 'call' else 'o')))
            b.append(text(min(x1, x2) + 8, y - 6, label, size=11.5))
        elif kind == 'self':
            _, a, y, label = st
            x = xs[a]
            b.append(path(f'M{x} {y} H{x + 34} V{y + 20} H{x + 2}', end='f'))
            b.append(text(x + 40, y + 14, label, size=11.5))
        elif kind == 'frag':
            _, op, x1, y1, x2, y2, guards = st
            b.append(f'<rect x="{x1}" y="{y1}" width="{x2 - x1}" height="{y2 - y1}" fill="none" stroke="{INK}" stroke-width="1.2"/>')
            tw = 9 * len(op) + 18
            b.append(f'<path d="M{x1} {y1} H{x1 + tw} V{y1 + 12} L{x1 + tw - 8} {y1 + 20} H{x1} z" fill="#f3f5f8" stroke="{INK}" stroke-width="1.1"/>')
            b.append(text(x1 + 7, y1 + 15, op, size=12, weight=700))
            for gy, g, sep in guards:
                if sep:
                    b.append(line(x1, gy - 16, x2, gy - 16, dash=True, w=1))
                b.append(text(x1 + tw + 10 if not sep else x1 + 10, gy, g, size=11.5, weight=600))
    return svg(width, height, ''.join(b), author, tag)


def seq_uc2():
    K, S, C, B = 'Klient', ':StronaRezerwacji', ':Kalendarz', ':BazaDanych'
    st = [
        ('call', K, S, 175, '1: wybierzTermin(termin)'),
        ('call', K, S, 203, '2: podajDane(dane, zgoda)'),
        ('self', S, 218, '3: sprawdźDane()'),
        ('call', S, C, 270, '4: zarezerwujOnline(t, dane)'),
        ('self', C, 285, '5: waliduj(dane)'),
        ('call', C, B, 337, '6: sprawdźGrafikIBlokadę(t)'),
        ('ret', B, C, 365, '7: termin wolny w grafiku'),
        ('call', C, B, 393, '8: policzAktywne(telefon)'),
        ('ret', B, C, 421, '9: liczba < 2'),
        ('call', C, B, 449, '10: policzZAdresu(skrótIP)'),
        ('ret', B, C, 477, '11: liczba < 3'),
        ('call', C, B, 505, '12: zapisz(wizyta)'),
        ('frag', 'alt', 22, 520, 772, 742, [(542, '[termin wolny]', False), (652, '[termin zajęty w międzyczasie]', True)]),
        ('ret', B, C, 568, '13: zapisano'),
        ('ret', C, S, 596, '14: wizyta potwierdzona'),
        ('ret', S, K, 624, '15: potwierdzenie rezerwacji'),
        ('ret', B, C, 678, '13a: termin już zajęty'),
        ('ret', C, S, 704, '14a: błąd: termin zajęty'),
        ('ret', S, K, 730, '15a: komunikat, aktualne terminy'),
    ]
    return seq('Tymon Grochowski', 'sd UC2: Rezerwowanie wizyty', [K, S, C, B], st, 775)


def seq_uc4():
    R, P, C, B = 'Recepcjonista', ':Panel', ':Kalendarz', ':BazaDanych'
    st = [
        ('call', R, P, 175, '1: wskażWizytę(w)'),
        ('ret', P, R, 203, '2: szczegóły wizyty'),
        ('call', R, P, 231, '3: odwołaj()'),
        ('ret', P, R, 259, '4: pytanie i telefon klienta'),
        ('call', R, P, 287, '5: potwierdź()'),
        ('call', P, C, 322, '6: odwołaj(w)'),
        ('self', C, 337, '7: sprawdźSesję()'),
        ('call', C, B, 389, '8: ustawStatus(w, odwołana)'),
        ('ret', B, C, 417, '9: data i godzina wizyty'),
        ('call', C, B, 445, '10: policzBlokadyIWizyty(d)'),
        ('ret', B, C, 473, '11: liczby'),
        ('frag', 'opt', 270, 488, 772, 550, [(510, '[pozostałe wolne terminy dnia zablokowane]', False)]),
        ('call', C, B, 540, '12: zablokuj(termin)'),
        ('ret', C, P, 582, '13: odwołano'),
        ('ret', P, R, 610, '14: odświeżony kalendarz'),
    ]
    return seq('Hubert Zduńczyk', 'sd UC4: Odwoływanie wizyty', [R, P, C, B], st, 645)


def seq_uc3():
    R, P, C, B = 'Recepcjonista', ':Panel', ':Kalendarz', ':BazaDanych'
    st = [
        ('call', R, P, 175, '1: wskażWolnyTermin(t)'),
        ('ret', P, R, 203, '2: wybór akcji'),
        ('call', R, P, 231, '3: wpiszWizytę()'),
        ('call', R, P, 259, '4: podajDane(dane)'),
        ('call', P, C, 294, '5: wpiszWizytę(t, dane)'),
        ('self', C, 309, '6: sprawdźSesję()'),
        ('self', C, 354, '7: waliduj(dane)'),
        ('call', C, B, 406, '8: pobierzGrafik()'),
        ('ret', B, C, 434, '9: grafik'),
        ('call', C, B, 462, '10: zapisz(wizyta)'),
        ('frag', 'alt', 22, 477, 772, 712, [(499, '[termin wolny]', False), (627, '[na termin jest już wizyta]', True)]),
        ('ret', B, C, 521, '11: zapisano'),
        ('call', C, B, 547, '12: usuńBlokadę(t)'),
        ('ret', C, P, 573, '13: wizyta zapisana'),
        ('ret', P, R, 599, '14: kalendarz z nową wizytą'),
        ('ret', B, C, 649, '11a: termin już zajęty'),
        ('ret', C, P, 673, '12a: błąd: termin zajęty'),
        ('ret', P, R, 699, '13a: komunikat: termin zajęty'),
    ]
    return seq('Wojciech Czajkowski', 'sd UC3: Wpisywanie wizyty', [R, P, C, B], st, 745)


# ---------------------------------------------------------------- diagram wdrożenia
def node(x, y, w, h, stereo, name, d=12):
    return (
        f'<path d="M{x} {y} L{x + d} {y - d} H{x + w + d} L{x + w} {y} z" fill="#e9eef4" stroke="{INK}" stroke-width="1.3"/>'
        f'<path d="M{x + w} {y} L{x + w + d} {y - d} V{y + h - d} L{x + w} {y + h} z" fill="#dde4ec" stroke="{INK}" stroke-width="1.3"/>'
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="{INK}" stroke-width="1.3"/>'
        + text(x + w / 2, y + 16, f'«{stereo}»', anchor='middle', size=11)
        + text(x + w / 2, y + 32, name, anchor='middle', size=12.5, weight=700)
    )


def env(x, y, w, h, name, artifacts):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#f7f9fb" stroke="{INK}" stroke-width="1.1"/>',
           text(x + w / 2, y + 14, '«executionEnvironment»', anchor='middle', size=10.5),
           text(x + w / 2, y + 28, name, anchor='middle', size=12, weight=600)]
    for i, a in enumerate(artifacts):
        ay = y + 38 + i * 24
        out.append(f'<rect x="{x + 10}" y="{ay}" width="{w - 20}" height="20" fill="#fff" stroke="{INK}" stroke-width="1"/>')
        out.append(f'<path d="M{x + w - 24} {ay + 4} h7 l4 4 v9 h-11 z" fill="none" stroke="{INK}" stroke-width=".9"/>')
        out.append(text(x + 16, ay + 14, a, size=11))
    return ''.join(out)


def deployment():
    b = []
    devices = [
        (75, 'Telefon / komputer klienta', ['«artifact» index.html', '«artifact» rezerwacja.js']),
        (255, 'Urządzenie personelu', ['«artifact» panel.html', '«artifact» panel.js']),
        (435, 'Urządzenie ochrony', ['«artifact» ochrona.html', '«artifact» ochrona.js']),
    ]
    for y, name, arts in devices:
        b.append(node(15, y, 230, 146, 'device', name))
        b.append(env(27, y + 44, 206, 92, 'Przeglądarka internetowa', arts))
    b.append(node(300, 75, 340, 470, 'node', 'Platforma Vercel (chmura)'))
    b.append(env(313, 115, 314, 92, 'Sieć CDN — pliki statyczne',
                 ['«artifact» *.html, js/, css/, fonts/', '«artifact» vercel.json (nagłówki, CSP)']))
    b.append(env(313, 220, 314, 188, 'Node.js — funkcje serverless',
                 ['«artifact» api/slots.js, api/book.js', '«artifact» api/admin/*.js', '«artifact» api/ochrona/*.js',
                  '«artifact» api/_lib.js (reguły, 2FA)', '«artifact» @neondatabase/serverless',
                  '«artifact» zmienne środowiskowe']))
    b.append(env(313, 462, 314, 68, 'Vercel Cron', ['«artifact» harmonogram „0 3 * * *”']))
    b.append(node(345, 595, 250, 188, 'node', 'Neon (chmura)'))
    b.append(env(357, 635, 226, 140, 'PostgreSQL',
                 ['«artifact» bookings', '«artifact» blocks', '«artifact» settings', '«artifact» login_attempts']))
    # ścieżki komunikacji
    for (y1, y2) in ((150, 155), (330, 330), (510, 500)):
        b.append(line(245, y1, 300, y2))
        b.append(text(250, min(y1, y2) - 7, 'HTTPS', size=11.5, weight=600))
    b.append(line(470, 462, 470, 410, end='f'))
    b.append(text(478, 442, 'HTTPS, codziennie 3:00', size=11.5))
    b.append(line(470, 545, 470, 595))
    b.append(text(478, 575, 'HTTPS (TLS, port 443)', size=11.5, weight=600))
    return svg(680, 800, ''.join(b), 'Wojciech Czajkowski', 'deployment Wdrożenie')


# ---------------------------------------------------------------- treść punktu 6
FIG = [0]


def figure(svg_code, caption):
    FIG[0] += 1
    n = FIG[0] + 2  # rysunki 1–2 są w punktach 2 i 4.1
    return f'<figure>\n{svg_code.replace("{id}", str(n))}\n<figcaption>Rysunek {n}. {esc(caption)}</figcaption>\n</figure>\n'


def build():
    p = []
    p.append('<h2 class="newpage">6. Model systemu</h2>\n')
    p.append('<p>Model systemu opisano ośmioma diagramami UML. Razem z diagramem przypadków użycia (punkt 4.1) każdy członek zespołu opracował trzy diagramy UML różnych typów. Imię i nazwisko autora jest w lewym górnym rogu każdego diagramu. Linia życia <i>:Kalendarz</i> na diagramach sekwencji jest obiektem klasy <i>Kalendarz</i> z diagramu klas, a <i>:BazaDanych</i> — bazą PostgreSQL z diagramu wdrożenia.</p>\n')
    p.append('<table class="keep">\n  <thead><tr><th style="width:36mm">Autor</th><th>Diagramy UML</th></tr></thead>\n  <tbody>\n'
             '  <tr><td class="id">Tymon Grochowski</td><td>diagram klas (6.1), diagram stanów „Wizyta” (6.2), diagram sekwencji UC2 (6.3); ponadto wymagania pozafunkcjonalne (punkt 5)</td></tr>\n'
             '  <tr><td class="id">Hubert Zduńczyk</td><td>diagram przypadków użycia (4.1), diagram stanów „Termin” (6.2), diagram sekwencji UC4 (6.3)</td></tr>\n'
             '  <tr><td class="id">Wojciech Czajkowski</td><td>diagram stanów „Sesja logowania” (6.2), diagram sekwencji UC3 (6.3), diagram wdrożenia (6.4)</td></tr>\n'
             '  </tbody>\n</table>\n')

    p.append('<h3>6.1. Diagram klas</h3>\n')
    p.append('<p>Centralną klasą jest <i>Kalendarz</i>, który udostępnia operacje przypadków użycia i jest właścicielem grafiku przyjęć, wizyt i blokad. Grafik składa się z siedmiu dni przyjęć (typ danych <i>DzieńPrzyjęć</i>), a każdy dzień wyznacza terminy. <i>Termin</i> nie jest przechowywany w bazie: powstaje z grafiku dla konkretnej daty, a jego dostępność online wynika z okna od 24 godzin do 28 dni i z tego, czy termin nie jest zajęty ani zablokowany (atrybut pochodny <i>/dostępnyOnline</i>). Dane klienta są częścią wizyty i znikają razem z nią 7 dni po terminie. <i>KontoDostępu</i> ma dwie instancje: wspólne konto personelu (rola <i>personel</i>) i konto ochroniarza (rola <i>ochrona</i>).</p>\n')
    p.append(figure(class_diagram(), 'Diagram klas'))

    p.append('<h3>6.2. Diagram stanów</h3>\n')
    p.append(figure(state_wizyta(), 'Diagram stanów wizyty'))
    p.append('<p>Wizyta powstaje od razu jako potwierdzona, zarówno przy rezerwacji online, jak i przy wpisie telefonicznym. Może zostać odwołana tylko przed swoim terminem; po upływie czasu wizyty przechodzi w stan „Zakończona”. Niezależnie od stanu dane wizyty są usuwane przez codzienne czyszczenie 7 dni po terminie.</p>\n')
    p.append(figure(state_termin(), 'Diagram stanów terminu'))
    p.append('<p>Termin wynika z grafiku przyjęć. Wolny termin klient może zarezerwować online (od 24 godzin do 28 dni przed nim), a personel może wpisać na niego wizytę lub go zablokować. Odwołanie wizyty zwalnia termin, chyba że wszystkie pozostałe wolne terminy tego dnia są zablokowane (np. urlop) — wtedy zwolniony termin również zostaje zablokowany.</p>\n')
    p.append(figure(state_sesja(), 'Diagram stanów sesji logowania'))
    p.append('<p>Logowanie wymaga hasła i kodu z aplikacji uwierzytelniającej. Po ośmiu nieudanych próbach z jednego adresu w ciągu 15 minut logowanie jest blokowane na 15 minut. Zalogowanie personelu jest ważne 30 dni, a ochroniarza 12 godzin.</p>\n')

    p.append('<h3>6.3. Diagram sekwencji</h3>\n')
    p.append(figure(seq_uc2(), 'Diagram sekwencji przypadku UC2: Rezerwowanie wizyty'))
    p.append('<p>Strona rezerwacji wywołuje operację <i>zarezerwujOnline</i> (funkcja serwera <i>/api/book</i>). Kalendarz sprawdza kolejno grafik i blokady, limit dwóch aktywnych rezerwacji na numer telefonu i limit trzech rezerwacji na dobę z jednego adresu. Gdy dwie osoby wybiorą ten sam termin jednocześnie, baza danych przyjmuje tylko pierwszy zapis dzięki unikalności aktywnej wizyty w danym terminie.</p>\n')
    p.append(figure(seq_uc4(), 'Diagram sekwencji przypadku UC4: Odwoływanie wizyty'))
    p.append('<p>Przed odwołaniem panel przypomina numer telefonu klienta. Operacja <i>odwołaj</i> (funkcja <i>/api/admin/cancel</i>) zmienia status wizyty, a jeśli pozostałe wolne terminy dnia są zablokowane, blokuje też zwolniony termin, aby nie wrócił do rezerwacji online.</p>\n')
    p.append(figure(seq_uc3(), 'Diagram sekwencji przypadku UC3: Wpisywanie wizyty umówionej telefonicznie'))
    p.append('<p>Wizyta wpisana przez recepcjonistę (operacja <i>wpiszWizytę</i>, funkcja <i>/api/admin/book</i>) ma źródło „telefon” i nie podlega limitom rezerwacji online. Po udanym zapisie kalendarz usuwa ewentualną blokadę terminu.</p>\n')

    p.append('<h3>6.4. Diagram wdrożenia</h3>\n')
    p.append(figure(deployment(), 'Diagram wdrożenia'))
    p.append('<p>Pliki strony serwuje sieć CDN platformy Vercel, a logika działa w funkcjach serverless Node.js, które odczytują hasła i sekrety 2FA ze zmiennych środowiskowych. Dane przechowuje baza PostgreSQL w usłudze Neon, a codzienne czyszczenie uruchamia Vercel Cron. Cała komunikacja odbywa się przez HTTPS; obie usługi działają na darmowych planach.</p>\n')
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
