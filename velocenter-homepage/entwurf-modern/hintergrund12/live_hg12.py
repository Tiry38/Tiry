#!/usr/bin/env python3
"""Hintergrund „Herbstallee“ live (Tiry 22.11.2026: „so ist es nice … setze das alles genauso live auf die Homepage“).

Aufruf:  python3 live_hg12.py <live-ordner>      (von tools/live_bauen.py nach plus_design() aufgerufen)
Legt auf alle gebauten Seiten genau den Stand von Vorschau „Landschaften 3“:
  - hg12-Hintergrund NUR Herbstallee (HG12_FEST, kein Umschalter, Tiry 22.11.2026: „nur diese eine Vorlage“), nasse Straße beim Scrollen,
    Laub folgt dem Scrollen, kein Klick-Ring, kein Scan
  - Showroom-Verwandlung mit Blättern (vmorph-laub.js ersetzt den vMorphJs-Block)
  - Handy-Kopf: Öffnungsstatus, A+, roter Burger; Laufband auf dem Handy sichtbar (hgmob.css)
Bilder: img/hg12/ (Unsplash-Lizenz, siehe QUELLEN.md). Unterseiten haben <base href="../">, deshalb gilt img/hg12/ überall.
Bricht laut ab, wenn sich die Quelle geändert hat (dann geht nichts live)."""
import os, sys, shutil, hashlib

D = os.path.dirname(os.path.abspath(__file__))
SEITEN = ['index.html'] + [d + '/index.html' for d in ('service', 'hersteller', 'lager', 'isy-experte', 'isy-treffen',
                                                       'e-dreiraeder', 'kontakt', 'impressum', 'datenschutz')]
# Hash des vMorphJs-Blocks, auf dem vmorph-laub.js aufbaut. Ändert sich der Block im Prototyp,
# muss vmorph-laub.js nachgezogen werden (sonst würde die Änderung still überschrieben).
MORPH_BASIS = '955d9b7f6c01b62a'

rd = lambda n: open(os.path.join(D, n), encoding='utf-8').read()

# Standbild je Seite (Tiry 27.11.2026): erstes echtes Shader-Bild, steht schon im allerersten Paint; hg12.js übergibt deckungsgleich.
# Formate nach Seitenverhältnis des Fensters (gleiche Grenze 0,9 wie der Shader für Handy-Ausschnitt).
FORMATE = [('p', '(max-aspect-ratio:599/1000)'), ('t34', '(min-aspect-ratio:3/5) and (max-aspect-ratio:899/1000)'),
           ('w43', '(min-aspect-ratio:9/10) and (max-aspect-ratio:1449/1000)'), ('w1610', '(min-aspect-ratio:29/20) and (max-aspect-ratio:1689/1000)'),
           ('w169', '(min-aspect-ratio:169/100)')]


def fingerabdruck():
    """Ändert sich, sobald Shader/Szene (hg12.js) oder die Herbstallee-Bilder anders sind → Standbilder neu rechnen (standbild.py)."""
    h = hashlib.sha256(open(os.path.join(D, 'hg12.js'), 'rb').read())
    for f in sorted(os.listdir(os.path.join(D, 'img'))):
        if f.startswith('herbst'):
            h.update(open(os.path.join(D, 'img', f), 'rb').read())
    return h.hexdigest()[:16]


def standbild(sp, s):
    k = 'start' if sp == 'index.html' else sp.split('/')[0]
    u = lambda f: 'img/hg12/p/%s-%s.webp' % (k, f)
    for f, _ in FORMATE:
        assert os.path.exists(os.path.join(D, 'img', 'p', '%s-%s.webp' % (k, f))), (sp, 'Standbild fehlt – python3 standbild.py')
    pre = ''.join('<link rel="preload" as="image" href="%s" media="%s" fetchpriority="high">' % (u(f), m) for f, m in FORMATE)
    r = lambda f: 'html:not(.hgO){background:#E9EBEE url(%s) 50%% 50%%/cover no-repeat fixed!important}' % u(f)
    css = r('p') + ''.join('@media %s{%s}' % (m, r(f)) for f, m in FORMATE[1:])
    ein = '\n' + pre + '\n<style id="hgP">' + css + '</style>'
    # Unterseiten: hinter das Skript, das <base> entfernt (es löscht sein Vorgänger-Element); sonst direkt hinter <meta charset>
    m = '<script>history.replaceState('
    i = s.index('</script>', s.index(m)) + len('</script>') if m in s[:3000] else s.index('<meta charset="utf-8">') + len('<meta charset="utf-8">')
    return s[:i] + ein + s[i:]


def main(ZIEL):
    CSS, JS, MORPH, MOB = rd('hg12.css'), rd('hg12.js'), rd('vmorph-laub.js'), rd('hgmob.css')
    mit = not os.environ.get('HG12_OHNE_STANDBILD')
    if mit:
        st = open(os.path.join(D, 'img', 'p', 'stand.txt')).read().strip()
        assert st == fingerabdruck(), 'hg12.js oder Herbstallee-Bilder geändert – erst „python3 standbild.py“ (Standbilder neu rechnen)'
    for sp in SEITEN:
        p = os.path.join(ZIEL, sp)
        s = open(p, encoding='utf-8').read()
        assert 'id="vHg"' not in s, sp + ': schon eingebaut'
        o = '<script id="vMorphJs">'
        a = s.index(o) + len(o)
        b = s.index('</script>', a)
        h = hashlib.sha256(s[a:b].encode()).hexdigest()[:16]
        assert h == MORPH_BASIS, (sp, 'vMorphJs im Prototyp geändert – vmorph-laub.js nachziehen', h)
        s = s[:a] + MORPH + s[b:]
        i = s.index('</style>') + len('</style>')
        # Handy-Kopf zusätzlich schon im Kopf der Seite (Tiry 28.11.2026: sonst stand der Kopf beim ersten Bild anders und alles sprang ~90 px);
        # die Kopie am Seitenende bleibt, damit das fertige Aussehen exakt gleich bleibt
        s = s[:i] + '\n<style id="vHg">\n' + CSS + '</style>\n<style id="hgMobKopf0">' + MOB + '</style>\n<script>document.documentElement.classList.add("hg3")</script>' + s[i:]
        # zweite Kopie direkt hinter plusCss (Tiry 28.11.2026: plusCss blendet das Laufband am Handy aus, die Kopie im Kopf verlor
        # gegen diese spätere Regel -> Laufband kam erst mit der Kopie am Seitenende, alles sprang 88 px)
        if '<style id="plusCss">' in s:
            j = s.index('</style>', s.index('<style id="plusCss">')) + len('</style>')
            s = s[:j] + '\n<style id="hgMobKopf1">' + MOB + '</style>' + s[j:]
        k = s.rindex('</html>')
        s = (s[:k] + '<script id="vHg11Js">window.HG12_FEST=\'herbst\';\n' + JS + '</script>\n'
             + '<style id="hgMobKopf">' + MOB + '</style>\n' + s[k:])
        if mit:
            s = standbild(sp, s)
        open(p, 'w', encoding='utf-8').write(s)
        print('hg12:', sp, len(s.encode()) // 1024, 'KB')

    zi = os.path.join(ZIEL, 'img', 'hg12')
    os.makedirs(zi, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(D, 'img'))):
        if not f.startswith('herbst'):
            continue  # nur die Herbstallee ist live
        shutil.copy2(os.path.join(D, 'img', f), os.path.join(zi, f))
    if mit:
        os.makedirs(os.path.join(zi, 'p'), exist_ok=True)
        for f in sorted(os.listdir(os.path.join(D, 'img', 'p'))):
            if f.endswith('.webp'):
                shutil.copy2(os.path.join(D, 'img', 'p', f), os.path.join(zi, 'p', f))
    print('hg12: Bilder', len(os.listdir(zi)))


if __name__ == '__main__':
    main(sys.argv[1])
