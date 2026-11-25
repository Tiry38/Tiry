#!/usr/bin/env python3
"""Newsletter Dezember 2026 · Velocenter Hessert · Fassung „Herbstallee“
Kopf = echte Homepage-Szene (WebGL-Laub) als GIF, darunter laeuft dasselbe Bild als ein durchgehender Hintergrund
(hintergrund.jpg, Breite = Mailbreite, nach unten Herbstnebel) – ohne Schnitt. Alle Links auf die Homepage HP."""
import html, urllib.parse, sys
HP = 'https://tiry38.github.io/velo-center-web/'
def wa(t): return 'https://wa.me/491635343133?text=' + urllib.parse.quote(t)
e = html.escape
FOG = '#D3C2B1'                      # Farbe am unteren Bildende = Rueckfall-Flaeche
CREAM = '#FAF7F4'; INK = '#1B1E25'; MUT = '#4A5161'; RED = '#C8102E'; RED2 = '#E2232D'; CH = '#F2D4B0'; DARK = '#121318'
DISP = "'Outfit',Arial,Helvetica,sans-serif"; BODY = "'Sora',Arial,Helvetica,sans-serif"
def eur(x): return f'{x:,.0f}'.replace(',', '.') + ' €'

def kick(t, c=RED): return f'<div class="kk" style="font:700 11px/16px {BODY};letter-spacing:.22em;text-transform:uppercase;color:{c}"><span class="kl" style="display:inline-block;width:26px;height:2px;background:{c};vertical-align:4px;margin-right:10px"></span>{t}</div>'
def h2(t, s=32, c=INK): return f'<h2 class="h2" style="margin:10px 0 14px;font:800 {s}px/1.04 {DISP};letter-spacing:-.025em;color:{c}">{t}</h2>'
def p(t, s=15, c=INK, ex=''): return f'<p style="margin:0 0 14px;font:400 {s}px/1.62 {BODY};color:{c};{ex}">{t}</p>'
def chk(t): return f'<div style="margin:0 0 14px;padding:9px 12px;border:1.5px dashed {RED};font:700 12px/1.5 {BODY};color:{RED}">{t}</div>'
def btn(href, label, kind='p', icon=None):
    bg, cls = (RED, 'b1') if kind == 'p' else (INK, 'b2') if kind == 's' else ('#FFFFFF', 'b3')
    col = INK if kind == 'w' else '#FFFFFF'
    ic = f'<img src="{icon}" width="18" height="18" alt="" style="display:inline-block;vertical-align:-4px;width:18px;height:18px;border:0;margin-right:9px">' if icon else ''
    return (f'<td class="{cls}" bgcolor="{bg}" style="border-radius:4px;background-color:{bg}">'
            f'<a class="ba" href="{e(href)}" target="_blank" style="display:inline-block;padding:13px 18px;font:700 12px/18px {BODY};letter-spacing:.08em;text-transform:uppercase;color:{col};text-decoration:none;white-space:nowrap">{ic}{label}<span class="ar" style="display:inline-block;margin-left:8px">&rarr;</span></a></td>')
def btns(*bs):
    cells = ''.join(f'<td class="bw" style="display:inline-block;padding:0 10px 10px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>{b}</tr></table></td>' for b in bs)
    return f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>{cells}</tr></table>'
def gap(h=30): return f'<tr><td height="{h}" style="height:{h}px;font-size:0;line-height:0">&nbsp;</td></tr>'
def img(src, alt, w, h, link=None, ex='', cls=''):
    i = f'<img class="{cls}" src="{src}" width="{w}" height="{h}" alt="{e(alt)}" style="display:block;width:100%;max-width:{w}px;height:auto;border:0;{ex}">'
    return f'<a href="{e(link)}" target="_blank" style="display:block;overflow:hidden">{i}</a>' if link else i
def edge(src):  # schraege Kante (PNG mit Transparenz)
    return f'<tr><td class="gut" style="padding:0 20px;font-size:0;line-height:0"><img src="{src}" width="600" height="22" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>'
def panel(inner, pad='22px 30px 24px', top='k-o1.png', bottom=None):
    r = edge(top) if top else ''
    r += (f'<tr><td class="gut" style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
          f'<tr><td class="pp" bgcolor="{CREAM}" style="background-color:{CREAM};padding:{pad}">{inner}</td></tr></table></td></tr>')
    if bottom: r += edge(bottom)
    return r

OFFERS = [
 dict(gif='x-o1.gif', marke='Stevens', modell='E-Antelao 29″', jahr='2022', motor='Bosch Performance CX', akku='625 Wh', schalt='Shimano 11-Gang', disp='Kiox', gr='22″', farbe='Arctic Grey', preis=2499, uvp=4099, link=HP+'#rad=stevens-e-antelao-29', knopf='Rad ansehen'),
 dict(gif='x-o2.gif', marke='Velo de Ville', modell='SEB890 SUV Smart 27,5″', jahr='2023', motor='Bosch Performance Line Smart System', akku='625 Wh', schalt='Shimano 9-Gang', disp='Intuvia 100', gr='45 cm · Trapez', farbe='Pure White', preis=2620, uvp=3745, link=wa('Hallo Velocenter, ich interessiere mich für das Velo de Ville SEB890 SUV Smart in Pure White (45 cm) für 2.620 €.'), knopf='Anfragen', wa=True),
 dict(gif='x-o3.gif', marke='i:SY', modell='Pop Art E5 ZR F', jahr='2023', motor='Bosch Performance Line', akku='545 Wh', schalt='Shimano Nexus 5-Gang', disp='Intuvia 100', gr='47 cm · Kompakt', farbe='Pop Art White', preis=3499, uvp=4599, link=HP+'#rad=i-sy-pop-art-e5-zr-f', knopf='Rad ansehen'),
 dict(gif='x-o4.gif', marke='KTM', modell='Macina City P610 RT', jahr='2022', motor='Bosch Performance Line', akku='625 Wh', schalt='Shimano 5-Gang RT', disp='Intuvia', gr='56 cm · Tiefeinsteiger', farbe='Oak (Black + Orange)', preis=2799, uvp=3799, link=wa('Hallo Velocenter, ich interessiere mich für das KTM Macina City P610 RT (56 cm, Oak) für 2.799 €.'), knopf='Anfragen', wa=True),
 dict(gif='x-o5.gif', marke='i:SY', modell='E5 ZR F CX Century', jahr='2024', motor='Bosch Performance CX', akku='545 Wh', schalt='Shimano Nexus 5-Gang', disp='Kiox 500', gr='47 cm · Kompakt', farbe='Riviera Blue', preis=3999, uvp=4999, link=wa('Hallo Velocenter, ich interessiere mich für das i:SY E5 ZR F CX Century in Riviera Blue für 3.999 €.'), knopf='Anfragen', wa=True),
 dict(gif='x-o6.gif', marke='Velo de Ville', modell='AEB400 Allround 28″', jahr='2022', motor='Bosch Active Line Plus', akku='500 Wh', schalt='Shimano 8-Gang', disp='', gr='55 cm · Tiefeinsteiger', farbe='Wine Red', preis=2239, uvp=3199, link=HP+'#rad=velo-de-ville-aeb400-allround-28-8gg-nex', knopf='Rad ansehen'),
]
for o in OFFERS:
    o['spar'] = o['uvp'] - o['preis']; o['pct'] = round(100 * o['spar'] / o['uvp'])

def specs(pairs):
    rows = ''
    for i in range(0, len(pairs), 2):
        rows += '<tr>' + ''.join(f'<td class="sp" width="50%" valign="top" style="padding:10px 12px 0 0;border-top:1px solid rgba(27,30,37,.10)"><div style="font:700 10px/14px {BODY};letter-spacing:.18em;text-transform:uppercase;color:{RED}">{a}</div><div style="font:400 14px/1.45 {BODY};color:{INK};padding-bottom:6px">{b}</div></td>' for a, b in pairs[i:i+2]) + '</tr>'
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{rows}</table>'
def details(summary, inner):   # Apple Mail/iOS/Browser: aufklappbar · Gmail/Outlook: Inhalt steht offen da
    return (f'<details class="dt" style="margin:0 0 14px"><summary class="sm" style="cursor:pointer;list-style:none;font:700 12px/18px {BODY};letter-spacing:.14em;text-transform:uppercase;color:{INK};padding:10px 0;border-top:2px solid {INK}">'
            f'{summary}<span class="pl" style="float:right;font:800 18px/18px {DISP};color:{RED}">+</span></summary>{inner}</details>')

R = []
# ---------- Kopf: echte Homepage-Szene + Laufband (pixelgenau auf dem Hintergrund) ----------
R.append(f'<tr><td style="font-size:0;line-height:0"><a href="{HP}" target="_blank" style="display:block"><img src="kopf.gif" width="640" height="600" alt="Velocenter Hessert, Newsletter Dezember 2026: Herbstallee mit fallendem Laub, Wörth am Rhein seit 1995" style="display:block;width:100%;max-width:640px;height:auto;border:0"></a></td></tr>')
R.append(f'<tr><td style="font-size:0;line-height:0"><img src="band.gif" width="640" height="96" alt="250+ E-Bikes · 4,8 Sterne bei Google · Bosch Service Center · i:SY Experte · Familienbetrieb seit 1995" style="display:block;width:100%;max-width:640px;height:auto;border:0"></td></tr>')
# ---------- Einstieg auf der Strasse ----------
R.append(f'''<tr><td class="gut" style="padding:10px 20px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#2B2C30" style="background-color:rgba(18,19,24,.62);padding:26px 26px 22px">
{kick('Winter · Umbau · Angebote', CH)}
<h1 class="h1" style="margin:12px 0 14px;font:800 44px/1.0 {DISP};letter-spacing:-.035em;color:#FFFFFF">Winter-Inspektion:<br><span style="color:{CH}">jetzt 20 € sparen.</span></h1>
<p style="margin:0;font:400 15px/1.62 {BODY};color:#FFFFFF">Die Tage sind kurz, das Rad steht öfter in der Garage. Jetzt ist die richtige Zeit für die Inspektion. Außerdem bauen wir den Laden um und räumen aus: Zubehör bis zu 70 % reduziert und sechs E-Bikes weit unter UVP.</p>
</td></tr></table></td></tr>''')
R.append(gap(34))
# ---------- Winter-Aktion = Karte der Homepage (mit Schnee), schraeg wie auf der Homepage ----------
R.append(edge('k-d1.png').replace('height="22"', 'height="26"'))
R.append(f'''<tr><td class="gut" style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#4C515B" style="font-size:0;line-height:0">
{img('deal.gif','Winter-Inspektion 2026/27: minus 20 Euro auf jede Inspektion, gültig nur für Marken-Fahrräder mit Bosch-Antrieb. Gratis dazu: Sattelüberzug mit Velocenter-Logo. Inklusive Checkliste und Bosch Servicebericht. Gültig vom 01.11.2026 bis 28.02.2027, nur solange Termine verfügbar sind.',600,730,HP+'#termin')}
</td></tr><tr><td bgcolor="#494250" style="background-color:#494250;padding:4px 18px 8px">
{btns(btn(HP+'#termin','Winter-Termin sichern','p','i-cal.png'), btn(wa('Hallo Velocenter, ich möchte einen Termin für die Winter-Inspektion.'),'WhatsApp','w','d-wa.png'), btn('tel:+49727178033','Anrufen','w','d-tel.png'))}
</td></tr></table></td></tr>''')
R.append(edge('k-d2.png').replace('height="22"', 'height="26"'))
R.append(gap(30))
# ---------- Umbau ----------
R.append(panel(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="stk" valign="top" width="220" style="font:800 100px/.82 {DISP};letter-spacing:-.06em;color:{RED}"><span class="pulse" style="display:inline-block">bis<br>70&nbsp;%</span></td>
<td class="stk" valign="bottom" style="padding:0 0 4px 10px">{kick('Umbau')}{h2('Wir bauen um und räumen aus.', 28)}</td></tr></table>
<div style="height:14px;font-size:0">&nbsp;</div>
{p('Ausgewählte Lenkertaschen, Fahrradtaschen, Gepäckträgerkörbe sowie i:SY- und QiO-Zubehör sind bis zu 70 % reduziert. Zum Beispiel die Racktime Agnetha 2.0 in verschiedenen Farben, Ortlieb Packtaschen und der Akku-Kontaktschutz von QiO und i:SY. Nur im Laden, solange der Vorrat reicht.')}
{chk('[⚠ PRÜFEN: Räumung im Dezember noch gültig?]')}
{btns(btn(HP+'#kontakt','Öffnungszeiten & Anfahrt','s','i-map.png'))}''', top='k-o1.png', bottom='k-u2.png'))
R.append(gap(30))
# ---------- Abfahrtstafel ----------
R.append(edge('k-b1.png'))
R.append(f'''<tr><td class="gut" style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="{DARK}" style="font-size:0;line-height:0">
{img('tafel.gif','Abfahrtstafel Umbau-Angebote: 01 Stevens E-Antelao 2.499 € statt 4.099 €, 02 Velo de Ville SEB890 2.620 € statt 3.745 €, 03 i:SY Pop Art E5 3.499 € statt 4.599 €, 04 KTM Macina City 2.799 € statt 3.799 €, 05 i:SY E5 CX Century 3.999 € statt 4.999 €, 06 Velo de Ville AEB400 2.239 € statt 3.199 €',600,480,HP+'#lager')}
</td></tr><tr><td bgcolor="{DARK}" style="background-color:{DARK};padding:0 26px 18px">
<div style="margin:0 0 12px;font:400 13px/1.6 {BODY};color:#B9BDC6">Alles Bosch-Antrieb, alles Einzelstücke, sofort fahrbereit. Bestand vom 12.11.2026.</div>
<div style="padding:8px 10px;border:1.5px dashed {CH};font:700 12px/1.5 {BODY};color:{CH}">[⚠ PRÜFEN: Sind alle 6 Räder noch da?]</div>
</td></tr></table></td></tr>''')
for i, o in enumerate(OFFERS):
    R.append(gap(26) if i == 0 else gap(22))
    sp = specs([('Baujahr', o['jahr']), ('Akku', o['akku']), ('Motor', o['motor']), ('Schaltung', o['schalt']), ('Größe', o['gr']), ('Farbe', o['farbe'])] + ([('Display', o['disp']), ('Antrieb', 'Bosch')] if o['disp'] else []))
    R.append(edge('k-o1.png' if i % 2 == 0 else 'k-o2.png'))
    R.append(f'''<tr><td class="gut" style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td bgcolor="{CREAM}" class="card" style="background-color:{CREAM};font-size:0;line-height:0">{img(o['gif'], f"{o['marke']} {o['modell']}: {eur(o['preis'])} statt UVP {eur(o['uvp'])}, du sparst {eur(o['spar'])} ({o['pct']} %)", 600, 330, o['link'], cls='zi')}</td></tr>
<tr><td class="pp" bgcolor="{CREAM}" style="background-color:{CREAM};padding:6px 30px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" width="78" style="font:800 56px/.9 {DISP};letter-spacing:-.05em;color:{RED}">0{i+1}</td>
<td valign="top"><div style="font:700 11px/16px {BODY};letter-spacing:.2em;text-transform:uppercase;color:{MUT}">{o['marke']} · {o['jahr']}</div>
<div class="h3" style="margin:4px 0 0;font:800 24px/1.1 {DISP};letter-spacing:-.02em;color:{INK}">{o['modell']}</div>
<div style="margin:6px 0 0;font:400 13px/1.5 {BODY};color:{MUT}"><b style="color:{INK};font:800 18px/1 {DISP}">{eur(o['preis'])}</b> &nbsp;statt <s>{eur(o['uvp'])}</s> · <b style="color:{RED}">−{eur(o['spar'])}</b></div></td></tr></table>
<div style="height:14px;font-size:0">&nbsp;</div>
{details('Technische Daten', sp)}
{btns(btn(o['link'], o['knopf'], 'p', 'i-wa.png' if o.get('wa') else None), btn(HP+'#termin', 'Probefahrt', 's', 'i-cal.png'))}</td></tr></table></td></tr>''')
R.append(gap(22))
R.append(panel(f'''{p('<b>Aus dem November noch da:</b> Stevens E-Juke 29″ (2023, 750 Wh, 16″ und 20″, Chrome Green) für <b>2.799 €</b> statt 4.399 € und Velo de Ville AEB490 Allround (2023, 630 Wh, 50 cm, Mocca Brown Matt) für <b>2.499 €</b> statt 3.599 €.', 14)}
{btns(btn(HP+'#lager','Alle Räder auf Lager','s','i-web.png'))}''', pad='20px 30px 14px', top='k-o2.png'))
R.append(gap(30))
# ---------- Van Raam ----------
vr = ''.join(f'<tr><td valign="top" width="22" style="padding:0 0 8px;font:800 15px/22px {DISP};color:{RED}">+</td><td style="padding:0 0 8px;font:400 14px/22px {BODY};color:{INK}"><b>{a}.</b> {b}</td></tr>' for a, b in [
    ('Drei Räder', 'Es steht von allein, an der Ampel muss niemand balancieren.'), ('Tiefer Einstieg', 'Kein Bein über die Stange schwingen.'),
    ('Sitz mit Rückenlehne', 'Bequem sitzen statt auf einem schmalen Sattel.'), ('Elektro-Unterstützung', 'Akku mit 880 Wh, hilft am Berg und bei Gegenwind.'),
    ('Platz für den Einkauf', 'Eine Tasche lässt sich hinten an der Rückenlehne anbringen.')])
R.append(edge('k-o1.png'))
R.append(f'''<tr><td class="gut" style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="pp" bgcolor="{CREAM}" style="background-color:{CREAM};padding:20px 30px 6px">{kick('Geschenkidee')}{h2('Schenk deinen Eltern ein Stück Freiheit zurück.', 30)}
{p('Zum Markt, zum Arzt, auf den Friedhof oder zu Freunden: selbst losfahren, wann man will, und niemanden fragen müssen, wer einen bringt. Und du musst dir weniger Sorgen machen, denn ein Dreirad kippt im Stand nicht um.')}</td></tr>
<tr><td bgcolor="{CREAM}" style="font-size:0;line-height:0">{img('x-vr.gif','Van Raam Easy Rider Compact E-Dreirad in Weinrot matt: 6.900 Euro statt UVP 8.068 Euro, du sparst 1.168 Euro.',600,330,HP+'#dreirad', cls='zi')}</td></tr>
<tr><td class="pp" bgcolor="{CREAM}" style="background-color:{CREAM};padding:10px 30px 16px">
<div style="font:700 11px/16px {BODY};letter-spacing:.2em;text-transform:uppercase;color:{MUT}">Van Raam · Modell 2025</div>
<div class="h3" style="margin:4px 0 6px;font:800 24px/1.1 {DISP};color:{INK}">Easy Rider Compact</div>
<div style="margin:0 0 14px;font:400 13px/1.5 {BODY};color:{MUT}">Weinrot matt · Akku 880 Wh · 8-Gang · Einzelstück · <b style="color:{INK};font:800 18px/1 {DISP}">6.900 €</b> statt <s>8.068 €</s></div>
{details('Was das Dreirad kann', '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 6px">'+vr+'</table>')}
{p('Das Compact ist für kleinere Erwachsene gebaut. Ob es passt, zeigt die Probefahrt. Lieber in Raten? 0 % über die TARGOBANK, bis zu 24 Monate, mit Anzahlung, Bonität vorausgesetzt. Dafür gilt der reguläre Preis von 8.068 €, nicht der Aktionspreis.', 13, MUT)}
{btns(btn(HP+'#termin','Probefahrt mit deinen Eltern','p','i-cal.png'), btn(HP+'#dreirad','Alle E-Dreiräder','s'))}</td></tr></table></td></tr>''')
R.append(gap(30))
# ---------- E-Bike-Service ----------
feat = ''.join(f'<td class="stk" valign="top" width="33%" style="padding:0 12px 14px 0"><div style="border-top:2px solid {INK};padding-top:12px"><img src="{i}" width="30" height="30" alt="" style="display:block;width:30px;height:30px;border:0;margin-bottom:10px"><div style="font:700 13px/1.4 {BODY};color:{INK}">{t}</div></div></td>' for i, t in [
    ('f-chip.png', 'E-Bike-Inspektion inkl. Softwareupdate'), ('f-house.png', 'Werkstatt im eigenen Haus'), ('f-bolt.png', 'Bosch Service Center')])
R.append(panel(f'''{kick('E-Bike-Service')}{h2('Die Werkstatt ist bei uns im Haus.')}
{p('Wir arbeiten an E-Bikes mit Bosch-Antrieb und machen die E-Bike-Inspektion inklusive Softwareupdate. Wer sie jetzt einplant, fährt im Frühjahr mit einem geprüften Rad los.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px"><tr>{feat}</tr></table>
{btns(btn(HP+'#termin','Termin buchen','p','i-cal.png'), btn(wa('Hallo Velocenter, ich habe eine Frage zu meinem E-Bike.'),'Schreib uns','s','i-wa.png'))}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;border-top:1px solid rgba(27,30,37,.12)"><tr>
<td class="stk" style="padding:14px 0 0;font:400 14px/2 {BODY};color:{INK}"><img src="d-tel.png" width="16" height="16" alt="" style="vertical-align:-3px;margin-right:8px"><a href="tel:+49727178033" style="color:{INK};text-decoration:none">07271 78033</a><br>
<img src="d-wa.png" width="16" height="16" alt="" style="vertical-align:-3px;margin-right:8px"><a href="https://wa.me/491635343133" target="_blank" style="color:{INK};text-decoration:none">0163 5343133</a></td>
<td class="stk" style="padding:14px 0 0;font:400 14px/2 {BODY};color:{INK}"><img src="d-web.png" width="16" height="16" alt="" style="vertical-align:-3px;margin-right:8px"><a href="{HP}" target="_blank" style="color:{INK};text-decoration:none">Unsere Homepage</a><br>
<img src="d-mail.png" width="16" height="16" alt="" style="vertical-align:-3px;margin-right:8px"><a href="mailto:info@velo-center.de" style="color:{INK};text-decoration:none">info@velo-center.de</a></td></tr></table>''', top='k-o2.png', bottom='k-u1.png'))
R.append(gap(30))
# ---------- Finanzierung ----------
R.append(panel(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="stk" valign="top" width="300" style="font-size:0;line-height:0"><img src="null.gif" width="300" height="150" alt="0,00 % effektiver Jahreszins" style="display:block;width:300px;max-width:100%;height:auto;border:0"></td>
<td class="stk" valign="top" style="padding:8px 0 0 6px">{kick('Finanzierung')}{h2('Dein Traumrad in Raten.', 26)}</td></tr></table>
{p('0 % Zinsen über die TARGOBANK (effektiver Jahreszins 0,00 %), bis zu 24 Monate, mit Anzahlung. Zum regulären Preis, nicht auf Aktionspreise. Bonität vorausgesetzt. Die Rate rechnen wir dir direkt im Laden aus.')}
<a href="https://www.targobank.de/" target="_blank" class="logo" style="display:inline-block"><img src="logo-targobank.png" width="180" height="52" alt="TARGOBANK" style="display:block;width:180px;height:auto;border:0;margin:0 0 16px -14px"></a>
{btns(btn(HP+'#finanzierung','Mehr zur Finanzierung','s','i-web.png'))}''', top='k-o1.png'))
R.append(gap(30))
# ---------- Versicherung ----------
cov = ''.join(f'<tr><td valign="top" width="22" style="padding:0 0 6px;font:800 14px/21px {DISP};color:{RED}">✓</td><td style="padding:0 0 6px;font:400 14px/21px {BODY};color:{INK}">{t}</td></tr>' for t in [
    'Diebstahl, Teilediebstahl, Raub und Vandalismus', 'Reparatur nach Unfall, Sturz und Panne', 'Akku-Defekt und Elektronikschäden',
    'Pick-up-Service europaweit, Hotline rund um die Uhr', 'Neues E-Bike: Verschleiß ab dem 7. Monat und Akku-Verschleiß unter 50 % Kapazität'])
R.append(panel(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top">{kick('Versicherung')}</td>
<td align="right" valign="top"><a href="https://www.enra.eu/?dealerid=10190" target="_blank" class="logo"><img src="logo-enra.png" width="150" height="43" alt="ENRA Versicherung" style="display:block;width:150px;height:auto;border:0"></a></td></tr></table>
{h2('Gut versichert vom ersten Tag an.')}
{p('Wir versichern dein E-Bike direkt bei uns im Laden mit ENRA. Neue E-Bikes bis 6 Monate nach dem Kauf, gebrauchte vom Fachhandel nach einer Prüfung.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr>
<td class="stk" width="50%" style="padding:0 8px 8px 0"><div style="border-left:4px solid {RED};padding:6px 0 6px 14px"><div style="font:700 10px/14px {BODY};letter-spacing:.18em;text-transform:uppercase;color:{MUT}">Neues E-Bike</div><div style="font:800 30px/1.2 {DISP};color:{INK}">ab ca. 120 €</div><div style="font:400 12px/1.4 {BODY};color:{MUT}">im Jahr, je nach Wert</div></div></td>
<td class="stk" width="50%" style="padding:0 0 8px 8px"><div style="border-left:4px solid {INK};padding:6px 0 6px 14px"><div style="font:700 10px/14px {BODY};letter-spacing:.18em;text-transform:uppercase;color:{MUT}">Gebrauchtes E-Bike</div><div style="font:800 30px/1.2 {DISP};color:{INK}">ab ca. 70 €</div><div style="font:400 12px/1.4 {BODY};color:{MUT}">im Jahr, je nach Wert</div></div></td></tr></table>
{details('Was ist versichert?', '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 4px">'+cov+'</table>')}
{btns(btn('https://www.enra.eu/?dealerid=10190','Tarif bei ENRA','p','i-web.png'), btn(HP+'#versicherung','Mehr zur Versicherung','s'))}''', top='k-o2.png'))
R.append(gap(30))
# ---------- Leasing ----------
LEA = [('jr','JobRad','https://www.jobrad.org/'),('bl','Bikeleasing','https://www.bikeleasing.de/'),('bb','Business Bike','https://www.businessbike.de/'),
       ('dd','Deutsche Dienstrad','https://www.deutsche-dienstrad.de/'),('cb','Company Bike','https://company-bike.com/'),('km','Kazenmaier Leasing','https://www.kazenmaier.de/'),
       ('lb','Lease a Bike','https://www.lease-a-bike.de/'),('er','Eurorad','https://www.eurorad.de/'),('rd','RIDE Rad im Dienst','https://radimdienst.de/')]
cells = ''
for i, (k, n, u) in enumerate(LEA):
    if i % 3 == 0: cells += '<tr>'
    cells += f'<td width="33%" align="center" style="padding:0;border-right:{"1px solid rgba(27,30,37,.10)" if i%3<2 else "0"};border-bottom:{"1px solid rgba(27,30,37,.10)" if i<6 else "0"}"><a href="{u}" target="_blank" class="logo" style="display:block"><img src="lea-{k}.png" width="168" height="52" alt="{e(n)}" style="display:block;width:100%;max-width:168px;height:auto;border:0"></a></td>'
    if i % 3 == 2: cells += '</tr>'
R.append(panel(f'''{kick('Leasing')}{h2('Dein E-Bike als Dienstrad.')}
{p('Die Rate läuft über deinen Arbeitgeber, wir kümmern uns um Angebot und Übergabe. Wir arbeiten mit fast allen Leasing-Firmen zusammen. Dein Anbieter ist nicht dabei? Frag einfach nach.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4EFEA" style="margin:4px 0 14px;background-color:#F4EFEA">{cells}</table>
{p('Rate ausrechnen: <a href="https://www.jobrad.org/arbeitnehmer/ersparnis-berechnen" target="_blank" style="color:'+RED+'">JobRad</a> · <a href="https://bikeleasing.de/leasingrechner/arbeitnehmer" target="_blank" style="color:'+RED+'">Bikeleasing</a> · <a href="https://www.businessbike.de/leasing-rechner/" target="_blank" style="color:'+RED+'">Business Bike</a> · <a href="https://www.deutsche-dienstrad.de/jetzt-berechnen" target="_blank" style="color:'+RED+'">Deutsche Dienstrad</a>', 13, MUT)}
{btns(btn(HP+'#leasing','Unser Dienstrad-Rechner','p','i-web.png'))}
{p('Leasing zum regulären Preis, Aktions- und Angebotspreise gelten nicht.', 12, MUT)}''', top='k-o1.png', bottom='k-u2.png'))
R.append(gap(30))
# ---------- Parken + Marken ----------
R.append(panel(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" width="112"><img src="parken.png" width="92" height="92" alt="Parken" style="display:block;width:92px;height:92px;border:0"></td>
<td valign="top">{kick('Bitte beachten')}<div style="margin:8px 0 8px;font:800 22px/1.15 {DISP};color:{INK}">Be- und Entladen ist erlaubt.</div>
{p('Zum Be- und Entladen darfst du kurz vor dem Geschäft halten. Parkplätze gibt es ca. 100 m entfernt am Friedhof.', 14)}</td></tr></table>
{btns(btn('https://www.google.com/maps/search/?api=1&query=Velocenter+Hessert+Hartmannstra%C3%9Fe+25+76744+W%C3%B6rth+am+Rhein','Route planen','s','i-map.png'))}
<div style="height:16px;border-bottom:1px solid rgba(27,30,37,.12);font-size:0">&nbsp;</div><div style="height:18px;font-size:0">&nbsp;</div>
{kick('Unsere Marken')}<div style="margin:8px 0 14px;font:800 22px/1.15 {DISP};color:{INK}">Über 250 E-Bikes zum Probefahren.</div>
{img('marken.png','Unsere Marken: i:SY, QiO, KTM, Stevens, Velo de Ville, Van Raam, Gudereit, Victoria',560,118,HP+'#marken')}''', top='k-o2.png'))
R.append(gap(30))
# ---------- Besuch + Social ----------
oh = ''.join(f'<tr><td style="padding:3px 14px 3px 0;font:700 13px/1.5 {BODY};color:{RED}">{d}</td><td style="padding:3px 0;font:400 13px/1.5 {BODY};color:{INK}">{z}</td></tr>' for d, z in [
    ('Mo', '09:00–12:00 · 14:30–18:00'), ('Di', '09:00–12:00 · 14:30–18:00'), ('Mi', 'geschlossen'), ('Do', '09:00–12:00 · 14:30–18:00'), ('Fr', '09:00–12:00 · 14:30–18:00'), ('Sa', '09:00–12:00'), ('So', 'geschlossen')])
SOC = [('fb','Facebook','https://www.facebook.com/velocenterhessert'),('ig','Instagram','https://www.instagram.com/velocenterhessert/'),
       ('wa','WhatsApp-Kanal','https://whatsapp.com/channel/0029VaIekua60eBc6k2bMD0q'),('web','Homepage',HP)]
soc = [f'<td class="sw" style="padding:0 8px 8px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="so so-{k}" bgcolor="{INK}" style="border-radius:4px;background-color:{INK}"><a href="{u}" target="_blank" style="display:block;padding:12px 16px;font:700 13px/20px {BODY};color:#FFFFFF;text-decoration:none;white-space:nowrap"><img src="i-{k}.png" width="18" height="18" alt="" style="display:inline-block;vertical-align:-4px;width:18px;height:18px;border:0;margin-right:9px">{n}</a></td></tr></table></td>' for k, n, u in SOC]
R.append(panel(f'''{kick('So findest du uns')}{h2('Besuch uns im Laden.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="stk" valign="top" width="48%" style="padding:0 12px 16px 0"><div style="font:400 14px/1.75 {BODY};color:{INK}"><b>Velocenter Hessert</b><br>Hartmannstraße 25<br>76744 Wörth am Rhein<br><a href="tel:+49727178033" style="color:{INK}">07271 78033</a><br><a href="https://wa.me/491635343133" target="_blank" style="color:{INK}">WhatsApp 0163 5343133</a><br><a href="mailto:info@velo-center.de" style="color:{INK}">info@velo-center.de</a></div></td>
<td class="stk" valign="top" style="padding:0 0 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0">{oh}</table>
<div style="margin-top:10px">{chk('[⚠ PRÜFEN: Öffnungszeiten 24.12.2026 bis 06.01.2027 eintragen]')}</div></td></tr></table>
<div style="font:800 26px/1.1 {DISP};letter-spacing:-.02em;color:{INK};margin:6px 0 6px">Wir freuen uns auf deinen Besuch.</div>
<div style="margin:0 0 16px;font:400 14px/1.5 {BODY};color:{MUT}">Dein Team vom Velocenter Hessert, Wörth am Rhein. Familienbetrieb seit 1995.</div>
{btns(btn(HP,'Zur Homepage','p','i-web.png'))}
<div style="margin:10px 0 10px">{kick('Folge uns und schreib uns')}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>{soc[0]}{soc[1]}</tr><tr>{soc[2]}{soc[3]}</tr></table>''', top='k-o1.png', bottom='k-u1.png'))
R.append(gap(22))
R.append(f'''<tr><td class="gut" style="padding:0 20px 40px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="{CREAM}" style="background-color:rgba(250,247,244,.86);padding:20px 24px;font:400 11px/1.65 {BODY};color:{MUT}">
Impressum: VELOCENTER Hessert, Inhaber Stefan Hessert, Hartmannstraße 25, 76744 Wörth am Rhein. Telefon 07271-78033, Fax 07271-78039, E-Mail info@velo-center.de. Umsatzsteuer-ID gemäß § 27 a UStG: DE171696150.<br><br>
Alle Preise inkl. MwSt. Angebote solange Vorrat reicht, Zwischenverkauf vorbehalten. Aktionspreise gelten nicht bei Leasing und Finanzierung, dafür gilt der reguläre Preis (UVP). Abbildungen ähnlich.<br><br>
Du bekommst diese E-Mail, weil du dich für den Newsletter vom Velocenter Hessert angemeldet hast. Keine Lust mehr? <a href="{{%link_unsubscribe}}" style="color:{INK};font-weight:700">Hier abmelden</a>.</td></tr></table></td></tr>''')

PRE = 'Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.'
body = '\n'.join(R)
doc = f'''<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Velocenter Hessert · Dezember 2026</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&amp;family=Sora:wght@400;700&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0!important;padding:0!important;background:{FOG};-webkit-text-size-adjust:100%}}
table{{border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0}} img{{-ms-interpolation-mode:bicubic}}
a{{color:{RED}}}
/* Knoepfe: Glanz laeuft durch, Pfeil schiebt, Hover hebt an, Tippen drueckt (Apple Mail, iOS, Browser) */
.b1,.b2,.b3,.so{{transition:background-color .2s ease,transform .18s ease,box-shadow .2s ease}}
.b1{{background-image:linear-gradient(110deg,transparent 0%,transparent 40%,rgba(255,255,255,.28) 50%,transparent 60%,transparent 100%);background-size:250% 100%;background-repeat:no-repeat;animation:glanz 3.2s ease-in-out infinite}}
@keyframes glanz{{0%{{background-position:130% 0}}55%,100%{{background-position:-60% 0}}}}
.b1:hover{{background-color:{RED2}!important;transform:translateY(-2px);box-shadow:0 10px 22px -10px rgba(200,16,46,.8)}}
.b2:hover{{background-color:#3A3E49!important;transform:translateY(-2px)}} .b3:hover{{background-color:#F2D4B0!important;transform:translateY(-2px)}}
.b1:active,.b2:active,.b3:active,.so:active{{transform:translateY(1px) scale(.98)}}
.ba .ar{{transition:transform .2s ease}} .ba:hover .ar{{transform:translateX(5px)}}
.so:hover{{transform:translateY(-2px)}} .so-fb:hover{{background-color:#1877F2!important}} .so-ig:hover{{background-color:#C13584!important}} .so-wa:hover{{background-color:#1FA855!important}} .so-web:hover{{background-color:{RED}!important}}
.zi{{transition:transform .5s cubic-bezier(.2,.8,.2,1)}} a:hover .zi{{transform:scale(1.035)}}
.logo img{{transition:transform .25s ease,filter .25s}} .logo:hover img{{transform:scale(1.06)}}
.kl{{animation:linie 2.6s ease-in-out infinite;transform-origin:0 50%}} @keyframes linie{{0%,100%{{transform:scaleX(.4)}}50%{{transform:scaleX(1)}}}}
.pulse{{animation:puls 2.4s ease-in-out infinite;transform-origin:0 60%}} @keyframes puls{{0%,100%{{transform:scale(1)}}50%{{transform:scale(1.04)}}}}
details.dt summary::-webkit-details-marker{{display:none}} details.dt[open] .pl{{transform:rotate(45deg)}} .pl{{transition:transform .25s ease;display:inline-block}}
details.dt summary:hover{{color:{RED}!important}}
@media (prefers-reduced-motion:reduce){{.b1,.kl,.pulse{{animation:none!important}}}}
@media screen and (max-width:620px){{
 .wrap{{width:100%!important}} .gut{{padding-left:12px!important;padding-right:12px!important}}
 .pp{{padding-left:18px!important;padding-right:18px!important}}
 .h1{{font-size:36px!important}} .h2{{font-size:26px!important}} .h3{{font-size:21px!important}}
 .stk{{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important}}
}}
</style>
</head>
<body style="margin:0;padding:0;background:{FOG}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{FOG}">{PRE}{'&#847;&zwnj;&nbsp;' * 40}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{FOG}" style="background:{FOG}"><tr><td align="center">
<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px">
<tr><td class="bgx" background="hintergrund.jpg" bgcolor="{FOG}" valign="top" style="background-color:{FOG};background-image:url('hintergrund.jpg');background-position:center top;background-size:100% auto;background-repeat:no-repeat">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top" background="laub.gif" style="background-image:url('laub.gif');background-repeat:repeat-y;background-position:center 696px;background-size:100% auto">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
{body}
</table>
</td></tr></table>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>'''
out = sys.argv[1] if len(sys.argv) > 1 else 'out/newsletter-dezember-2026.html'
open(out, 'w', encoding='utf-8').write(doc)
print('OK', out, len(doc) // 1024, 'KB')
