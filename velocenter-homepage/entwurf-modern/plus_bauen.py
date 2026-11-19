#!/usr/bin/env python3
"""Vorlage „plus“: die AKTUELLE Homepage mit 5 Verbesserungen (Tiry 18.11.2026).

  1. Ein Design-System (Perlmutt-Glas, Radien, Elevation-Tokens, Karten, Knöpfe, Abschnitts-Köpfe, Abstände)
  2. Handy: niedriger Kopf (2×4 Reiter bleiben, Öffnungs-Zeile klappt beim Runterscrollen weg), Hero ohne Laufband
  3. Tiefe: Licht von oben, Glaskanten, mehrlagige Schatten, Rad mit Lichtkegel/Bodenschatten/Spiegelung
  4. Bilder: lazy/decoding/width/height überall (auch in JS-Vorlagen), kleine WebP-Varianten per srcset/PV()
  5. Kompakte, reiche Fußzeile

Aufruf:  python3 plus_bauen.py [<live-ordner>]
         (Standard: der gebaute Live-Stand im Scratchpad, live5/)
Liest   <live>/index.html (wird NICHT verändert)
Schreibt <live>/vorlage-plus.html  +  Kopie nach entwurf-modern/vorlage-plus.html
Erzeugt vorher die kleinen Bildvarianten (plus_varianten.py) in <live>/img UND im Repo-img.
Alle Ersetzungen prüfen ihre Trefferzahl (assert) – ändert sich die Quelle, bricht das Skript laut ab.
"""
import os, re, sys, json, shutil, subprocess
from PIL import Image

HIER = os.path.dirname(os.path.abspath(__file__))
REPO_IMG = os.path.normpath(os.path.join(HIER, '..', 'img'))
LIVE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-user/aa06df28-a730-5a50-9b3b-74be1455e397/scratchpad/live5'
LIMG = os.path.join(LIVE, 'img')

# ---------------------------------------------------------------- Bildvarianten
subprocess.run([sys.executable, os.path.join(HIER, 'plus_varianten.py'), REPO_IMG, LIMG], check=True)

VARW = re.compile(r'-(400|480|560|600|640|900|960|1200)\.webp$')
DIM, VARS = {}, {}
for dp, _, fs in os.walk(LIMG):
    for f in fs:
        p = os.path.join(dp, f)
        rel = 'img/' + os.path.relpath(p, LIMG).replace(os.sep, '/')
        m = VARW.search(rel)
        if m:
            base = rel[:m.start()] + '.webp'
            VARS.setdefault(base, []).append(int(m.group(1)))
            continue
        try:
            if f.endswith('.svg'):
                t = open(p, encoding='utf-8', errors='ignore').read(4000)
                w = re.search(r'<svg[^>]*\swidth="([\d.]+)(?:px)?"', t)
                h = re.search(r'<svg[^>]*\sheight="([\d.]+)(?:px)?"', t)
                vb = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"', t)
                if w and h:
                    DIM[rel] = (round(float(w.group(1))), round(float(h.group(1))))
                elif vb:  # nur Seitenverhältnis bekannt
                    DIM[rel] = (round(float(vb.group(1))), round(float(vb.group(2))))
            elif f.rsplit('.', 1)[-1].lower() in ('webp', 'png', 'jpg', 'jpeg'):
                with Image.open(p) as im:
                    DIM[rel] = im.size
        except Exception:
            pass
for k in VARS:
    VARS[k].sort()

src = open(os.path.join(LIVE, 'index.html'), encoding='utf-8').read()
s = src


def rep(old, new, n=1, text=None):
    """Ersetzt old durch new und prüft die Trefferzahl."""
    global s
    t = s if text is None else text
    c = t.count(old)
    assert c == n, 'Erwartet %d× %r, gefunden %d×' % (n, old[:90], c)
    t = t.replace(old, new)
    if text is None:
        s = t
    return t


def rrep(pat, new, n=1, flags=0):
    global s
    s, c = re.subn(pat, new, s, flags=flags)
    assert c == n, 'Erwartet %d× /%s/, gefunden %d×' % (n, pat[:90], c)


def var(path, w):
    """Pfad der kleinsten Variante >= w (sonst Original)."""
    for x in VARS.get(path, []):
        if x >= w:
            return path[:-5] + '-%d.webp' % x
    return path


def srcset(path):
    ws = VARS.get(path, [])
    ow = DIM[path][0]
    return ', '.join(['%s-%d.webp %dw' % (path[:-5], w, w) for w in ws] + ['%s %dw' % (path, ow)])


# ---------------------------------------------------------------- Kopf: Vorlage, nicht für Google
rep('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex">')
rep('<link rel="canonical" href="https://www.velo-center.de/">\n', '')

# ---------------------------------------------------------------- Punkt 4: Bilder
# 4a) Hero: erstes Rad mit srcset + fetchpriority, weitere Räder als 900er-Variante (VM.run liest currentSrc/src → bleibt gleich)
rep('<img class="hb" src="img/p-isy.webp" alt="i:SY E-Kompaktrad" data-l="img/marke-isy.svg" width="1600" height="1104">',
    '<img class="hb" src="%s" srcset="%s" sizes="(max-width: 980px) 78vw, 560px" fetchpriority="high" decoding="async" '
    'alt="i:SY E-Kompaktrad" data-l="img/marke-isy.svg" width="1600" height="1104">' % (var('img/p-isy.webp', 900), srcset('img/p-isy.webp')))
for f in ('p-ktm', 'p-qio-eins-fineline', 'p-vdv-aebpro', 'p-vanraam', 'p-gudereit', 'p-victoria-veloa7'):
    rep('<img class="hb off" data-src="img/%s.webp"' % f, '<img class="hb off" decoding="async" data-src="%s"' % var('img/%s.webp' % f, 900))
rep('<img class="hlg" id="hlg" src="img/marke-isy.svg"', '<img class="hlg" id="hlg" fetchpriority="high" src="img/marke-isy.svg"')

# Marken-Showroom (statisch, wird von VM gemessen) und Besuch-Foto
rep('id="m-bk" src="img/p-isy.webp"', 'id="m-bk" src="%s"' % var('img/p-isy.webp', 900))
rep('id="m-brefl" src="img/p-isy.webp"', 'id="m-brefl" src="%s"' % var('img/p-isy.webp', 900))
rep('<img src="img/laden-eingang.webp" alt="Eingang des Velocenter Hessert',
    '<img src="img/laden-eingang.webp" srcset="%s" sizes="100vw" alt="Eingang des Velocenter Hessert' % srcset('img/laden-eingang.webp'))

# 4b) Schnellzugriff-Kacheln (CSS-Hintergründe): kleinere Fotos
rep('--img:url(img/laden-innen.webp)', '--img:url(%s)' % var('img/laden-innen.webp', 640))
rep('--img:url(img/laden-eingang.webp)', '--img:url(%s)' % var('img/laden-eingang.webp', 640))
# Rauch-Ebene: im Eis-Rot-Look nur noch 3 % Deckkraft → Bild (129 KB) entfällt, Fläche bleibt
rep('.smoke{position:fixed;inset:0;z-index:-2;pointer-events:none;background:url(img/rauch.webp) center/cover no-repeat;opacity:.4',
    '.smoke{position:fixed;inset:0;z-index:-2;pointer-events:none;background:none;opacity:.4')

# 4c) Statische <img> im Seitenkörper: width/height aus der echten Bildgröße, lazy + async unterhalb des ersten Bildschirms
a = s.index('<div class="sky">')
b = s.index('<script type="application/json" id="bestandData">')
body = s[a:b]
hdr_a, hdr_b = body.index('<header class="hdr">'), body.index('</header>')
cnt = {'wh': 0, 'lazy': 0, 'dec': 0}


def fix_static(m):
    t = m.group(0)
    pos = m.start()
    in_hdr = hdr_a <= pos <= hdr_b
    eager = in_hdr or 'fetchpriority' in t or 'class="wipe"' in body[max(0, pos - 120):pos]
    sm = re.search(r'\s(?:data-)?src="([^"]+)"', t)
    add = ''
    if sm and ' width=' not in t:
        p = VARW.sub('.webp', sm.group(1))
        if p in DIM:
            add += ' width="%d" height="%d"' % DIM[p]
            cnt['wh'] += 1
    if 'loading=' not in t and not eager:
        add += ' loading="lazy"'
        cnt['lazy'] += 1
    if 'decoding=' not in t:
        add += ' decoding="async"'
        cnt['dec'] += 1
    return '<img' + add + t[4:]


body = re.sub(r'<img\b[^>]*>', fix_static, body)
s = s[:a] + body + s[b:]
print('statische Bilder:', cnt)

# 4d) Helfer PV()/WH() für die JS-Vorlagen (vor dem Haupt-Skript)
pvjs = ('<script id="plusImg">/* Vorlage plus · Bilder: PV(pfad,cssBreite) = kleinste passende WebP-Variante, WH(pfad) = echte Bildmaße */\n'
        'window.PVV=%s;window.PVD=%s;\n'
        'window.PV=function(p,w){var v=PVV[p];if(!v||!p)return p;var n=Math.min(w,(window.innerWidth||w)*.86)*Math.min(window.devicePixelRatio||1,3)*.9;for(var i=0;i<v.length;i++)if(v[i]>=n)return p.slice(0,-5)+"-"+v[i]+".webp";return p};\n'
        'window.WH=function(p){var d=PVD[String(p||"").replace(/-(400|480|560|600|640|900|960|1200)\\.webp$/,".webp")];return d?\' width="\'+d[0]+\'" height="\'+d[1]+\'"\':""};\n'
        '</script>\n') % (json.dumps(VARS, separators=(',', ':')), json.dumps({k: list(v) for k, v in DIM.items()}, separators=(',', ':')))
rep('<script type="application/json" id="bestandData">', pvjs + '<script type="application/json" id="bestandData">')

# 4e) JS-Vorlagen: Quellen auf Varianten umstellen
for f in ('p-isy', 'p-ktm', 'p-qio-eins-fineline', 'p-vdv-aebpro', 'p-vanraam', 'p-gudereit', 'p-victoria-veloa7'):
    rep("img:'img/%s.webp'" % f, "img:PV('img/%s.webp',600)" % f)
rep("img:'img/show/'+fn,", "img:PV('img/show/'+fn,600),")
rep("img:'img/show/rest-05.webp'", "img:PV('img/show/rest-05.webp',600)")                       # Showroom-/Kopf-Pool
rep("im.src=src;o.classList.remove('qin')", "im.src=PV(src,Math.min(190,innerWidth*.34));o.classList.remove('qin')")  # Schnellzugriff „Auf Lager“
rep("e.alt='';e.decoding='async';box.appendChild(e)", "e.alt='';e.decoding='async';e.loading='lazy';e.width=400;e.height=260;box.appendChild(e)")  # Maße: CSS füllt die Kachel (object-fit)
rep("pre.src=src}", "pre.src=PV(src,Math.min(190,innerWidth*.34))}")
rep('<img class="bk" src="\'+im+\'" alt="" loading="lazy">', '<img class="bk" src="\'+PV(im,300)+\'" alt="" loading="lazy">')  # Lager-Karten
rep('<img src="img/laden-innen.webp" alt="">', '<img src="%s" alt="">' % var('img/laden-innen.webp', 640))
rep('<img src="img/isy-ausstellung.webp" alt="">', '<img src="%s" alt="">' % var('img/isy-ausstellung.webp', 640))
rep('<img src="img/treffen-luft.webp" alt="">', '<img src="%s" alt="">' % var('img/treffen-luft.webp', 640))
rep('<img class="lbp-cut" src="img/sattelueberzug.webp"', '<img class="lbp-cut" src="%s"' % var('img/sattelueberzug.webp', 560))
rep('<img class="lbp-cut" src="img/p-vanraam.webp"', '<img class="lbp-cut" src="%s"' % var('img/p-vanraam.webp', 600))

# 4f) JS-Vorlagen: jedes <img> bekommt decoding/lazy und – wo die Quelle bekannt ist – width/height
ja = s.index('<script>', s.index('id="bilderBericht"'))
jb = s.index('</script>', s.index('<script id="vMorphJs">'))
js = s[ja:jb]
jc = {'n': 0, 'wh': 0}


def fix_js(m):
    i = m.start()
    e = js.find('>', i)
    seg = js[i:e + 1]
    assert '=>' not in seg and len(seg) < 260, seg
    add = ''
    if ' width=' not in seg:
        q = re.search(r"""src="'\+(.+?)\+'"|src="([^"$']+)"|src="img/marke-\$\{m\}\.svg\"""", seg)
        q2 = re.search('src="([^"\'$]+)\'\\+(.+?)\\+\'([^"\'$]*)"', seg)
        if q2 and not (q and (q.group(1) or q.group(2))):
            add += "'+WH('%s'+%s+'%s')+'" % (q2.group(1), q2.group(2), q2.group(3))
            jc['wh'] += 1
        elif q and q.group(1):
            add += "'+WH(%s)+'" % q.group(1)
            jc['wh'] += 1
        elif q and q.group(2):
            p = VARW.sub('.webp', q.group(2))
            if p in DIM:
                add += ' width="%d" height="%d"' % DIM[p]
                jc['wh'] += 1
        elif q:
            add += '${WH(\'img/marke-\'+m+\'.svg\')}'
            jc['wh'] += 1
    if 'loading=' not in seg:
        add += ' loading="lazy"'
    if 'decoding=' not in seg:
        add += ' decoding="async"'
    jc['n'] += 1
    return '<img' + add


js = re.sub(r'<img(?=\s)', fix_js, js)
s = s[:ja] + js + s[jb:]
print('JS-Vorlagen:', jc)

# ================================================================ Design (Punkte 1, 2, 3, 5)
PLUS_CSS = open(os.path.join(HIER, 'plus.css'), encoding='utf-8').read()
PLUS_JS = open(os.path.join(HIER, 'plus.js'), encoding='utf-8').read()

# eigener Stil nach allen bestehenden Stilen (Ende des letzten Stil-Blocks „eisRot“)
ea = s.index('<style id="eisRot">')
eb = s.index('</style>', ea) + len('</style>')
s = s[:eb] + '\n<style id="plusCss">\n' + PLUS_CSS + '\n</style>' + s[eb:]

exec(open(os.path.join(HIER, 'plus_markup.py'), encoding='utf-8').read())  # Markup-Änderungen (rep/rrep)

# eigenes Skript ganz am Ende
rep('\n</html>', '\n<script id="plusJs">\n' + PLUS_JS + '\n</script>\n</html>')

out = os.path.join(LIVE, 'vorlage-plus.html')
open(out, 'w', encoding='utf-8').write(s)
shutil.copyfile(out, os.path.join(HIER, 'vorlage-plus.html'))
print('geschrieben:', out, len(s.encode()) // 1024, 'KB')
