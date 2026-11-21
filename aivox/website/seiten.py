"""Erzeugt aus quelle.html die Einzelseiten der AIVOX-Website.
Bearbeitet wird nur quelle.html – danach: python3 seiten.py
Jeder Reiter = eigene Seite; Links auf Kapitel/Elemente werden automatisch zu Seiten-Links."""
import re, os
D = os.path.dirname(os.path.abspath(__file__)) + '/'
src = open(D + 'quelle.html', encoding='utf-8').read()

PAGES = [  # id, Datei, Titel, Menü-Untertitel
    ('start', 'index.html', 'Start'), ('ablauf', 'ablauf.html', 'So funktioniert’s'), ('live', 'live.html', 'Live-Demo'),
    ('einrichtung', 'einrichtung.html', 'Einrichtung'), ('cockpit', 'cockpit.html', 'Cockpit'),
    ('sicherheit', 'sicherheit.html', 'Sicherheit'), ('preise', 'preise.html', 'Preise'), ('fragen', 'fragen.html', 'Fragen'),
]
FILE = {p[0]: p[1] for p in PAGES}

m_main = re.search(r'<main id="inhalt" tabindex="-1">', src)
m_end = src.index('</main>')
prefix, body, suffix = src[:m_main.end()], src[m_main.end():m_end], src[m_end:]
secs = {}
for m in re.finditer(r'(<section class="view" id="([a-z]+)".*?</section>)', body, re.S):
    secs[m.group(2)] = m.group(1)
assert set(secs) == set(FILE), secs.keys()

# Welche Element-IDs liegen auf welcher Seite?
where = {}
for sid, html in secs.items():
    for i in re.findall(r'\sid="([^"]+)"', html):
        where[i] = sid

def relink(html):
    def fix(m):
        tag, target = m.group(0), m.group(1)
        if target in FILE:
            return tag.replace(f'href="#{target}"', f'href="{FILE[target]}"')
        if target in where:
            return tag.replace(f'href="#{target}"', f'href="{FILE[where[target]]}#{target}"')
        return tag
    return re.sub(r'<a\b[^>]*href="#([^"]+)"[^>]*>', fix, html)

intro_a = prefix.index('<!-- ================= BEGRÜSSUNG')
intro_b = prefix.index('<!-- ================= LEISTE')

for n, (sid, fname, title) in enumerate(PAGES):
    pre = prefix
    if sid != 'start':
        # Begrüßung bleibt verborgen (startet nur auf der Startseite; „Intro ansehen“ geht überall)
        pre = pre.replace('<div class="intro" role="dialog"', '<div class="intro" hidden role="dialog"', 1)
        pre = pre.replace('<body class="booting">', '<body>')
    pre = pre.replace('<body', f'<body data-page="{sid}"', 1)
    pre = re.sub(r'<title>[^<]*</title>', f'<title>{"AIVOX Voice" if sid == "start" else "AIVOX · " + title}</title>', pre, count=1)
    pre = pre.replace(' aria-current="page"', '')
    pre = relink(pre)
    pre = re.sub(rf'(<a class="tab" href="{re.escape(fname)}")', r'\1 aria-current="page"', pre)
    pre = re.sub(rf'(<div class="menu"[\s\S]*?<a href="{re.escape(fname)}")', r'\1 aria-current="page"', pre, count=1)
    sec = relink(secs[sid]).replace(f'<section class="view" id="{sid}"', f'<section class="view" id="{sid}" data-kap="{n + 1:02d}"', 1)
    nxt = PAGES[(n + 1) % len(PAGES)]
    prv = PAGES[n - 1]
    nav = (f'\n  <nav class="pager wrap" aria-label="Weitere Seiten">'
           f'<a class="pager-a prev" href="{prv[1]}"><span>Zurück</span><strong>{prv[2]}</strong></a>'
           f'<a class="pager-a next" href="{nxt[1]}"><span>Weiter</span><strong>{nxt[2]}</strong></a></nav>\n')
    out = pre + '\n' + sec + nav + relink(suffix)
    open(D + fname, 'w', encoding='utf-8').write(out)
    print(f'{fname:18} {len(out.encode()) / 1024:5.1f} KB')
