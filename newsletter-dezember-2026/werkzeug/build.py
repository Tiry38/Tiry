#!/usr/bin/env python3
"""Baut newsletter-dezember-2026.html (rapidmail, Tabellen-Layout, Inline-CSS).
Alle Links auf die NEUE Homepage (tiry38.github.io/velo-center-web) – nie velo-center.de / velocenter.de,
solange die Domain noch auf die alte Seite zeigt. Basis-URL nur hier ändern."""
import html, urllib.parse, sys, os
HP = 'https://tiry38.github.io/velo-center-web/'
WA = 'https://wa.me/491635343133?text='
def wa(t): return WA + urllib.parse.quote(t)
e = html.escape

RED='#C8102E'; RED_D='#8E0E26'; INK='#1B1E25'; MUT='#4A5161'; PAPER='#F4EFEA'; PAPER2='#FAF7F4'; LINE='#DDD3C8'
DISP="'Outfit',Arial,Helvetica,sans-serif"; BODY="'Sora',Arial,Helvetica,sans-serif"; HAND="'Caveat','Segoe Print','Comic Sans MS',cursive"

OFFERS = [
 dict(n='01', gif='x-o1.gif', marke='Stevens', modell='E-Antelao 29″', jahr='2022', motor='Bosch Performance CX', akku='625 Wh',
      schalt='Shimano 11-Gang', disp='Kiox', rahmen='Rahmen 22″', farbe='Arctic Grey', preis=2499, uvp=4099,
      link=HP+'#rad=stevens-e-antelao-29', knopf='Rad ansehen', why='E-MTB fürs Gelände, größte Ersparnis im Lager'),
 dict(n='02', gif='x-o3.gif', marke='Velo de Ville', modell='SEB890 SUV Smart 27,5″', jahr='2023', motor='Bosch Performance Line Smart System', akku='625 Wh',
      schalt='Shimano 9-Gang', disp='Intuvia 100', rahmen='45 cm · Trapez', farbe='Pure White', preis=2620, uvp=3745,
      link=wa('Hallo Velocenter, ich interessiere mich für das Velo de Ville SEB890 SUV Smart in Pure White (45 cm) für 2.620 €.'), knopf='Per WhatsApp anfragen', why=''),
 dict(n='03', gif='x-o2.gif', marke='i:SY', modell='Pop Art E5 ZR F', jahr='2023', motor='Bosch Performance Line', akku='545 Wh',
      schalt='Shimano Nexus 5-Gang, Freilauf', disp='Intuvia 100', rahmen='47 cm · Kompaktrad', farbe='Pop Art White', preis=3499, uvp=4599,
      link=HP+'#rad=i-sy-pop-art-e5-zr-f', knopf='Rad ansehen', why=''),
 dict(n='04', gif='x-o4.gif', marke='KTM', modell='Macina City P610 RT', jahr='2022', motor='Bosch Performance Line', akku='625 Wh',
      schalt='Shimano 5-Gang RT', disp='Intuvia', rahmen='56 cm · Tiefeinsteiger', farbe='Oak (Black + Orange)', preis=2799, uvp=3799,
      link=wa('Hallo Velocenter, ich interessiere mich für das KTM Macina City P610 RT (56 cm, Oak) für 2.799 €.'), knopf='Per WhatsApp anfragen', why=''),
 dict(n='05', gif='x-o5.gif', marke='i:SY', modell='E5 ZR F CX Century', jahr='2024', motor='Bosch Performance CX', akku='545 Wh',
      schalt='Shimano Nexus 5-Gang, Freilauf', disp='Kiox 500', rahmen='47 cm · Kompaktrad', farbe='Riviera Blue', preis=3999, uvp=4999,
      link=wa('Hallo Velocenter, ich interessiere mich für das i:SY E5 ZR F CX Century in Riviera Blue für 3.999 €.'), knopf='Per WhatsApp anfragen', why=''),
 dict(n='06', gif='x-o6.gif', marke='Velo de Ville', modell='AEB400 Allround 28″', jahr='2022', motor='Bosch Active Line Plus', akku='500 Wh',
      schalt='Shimano 8-Gang', disp='', rahmen='55 cm · Tiefeinsteiger', farbe='Wine Red', preis=2239, uvp=3199,
      link=HP+'#rad=velo-de-ville-aeb400-allround-28-8gg-nex', knopf='Rad ansehen', why=''),
]
def eur(x): return f'{x:,.0f}'.replace(',', '.') + ' €'
for o in OFFERS:
    o['spar'] = o['uvp'] - o['preis']; o['pct'] = round(100 * o['spar'] / o['uvp'])

def btn(href, label, bg=RED, cls='btn'):
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="{cls}" bgcolor="{bg}" style="background:{bg};border-radius:4px">'
            f'<a href="{e(href)}" target="_blank" style="display:inline-block;padding:15px 24px;font:700 14px/18px {BODY};letter-spacing:.06em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;border-radius:4px">{label}&nbsp;&rarr;</a></td></tr></table>')

def kick(t, col=RED): return f'<div style="font:700 11px/16px {BODY};letter-spacing:.2em;text-transform:uppercase;color:{col}">{t}</div>'
def p(t, size=15, col=INK, extra=''): return f'<p style="margin:0 0 14px;font:400 {size}px/1.6 {BODY};color:{col};{extra}">{t}</p>'
def h(t, size=34, extra=''): return f'<h2 style="margin:10px 0 16px;font:800 {size}px/1.08 {DISP};letter-spacing:-.02em;color:{INK};{extra}" class="h">{t}</h2>'
def sp(px): return f'<tr><td height="{px}" style="font-size:0;line-height:0;height:{px}px">&nbsp;</td></tr>'
def row(inner, pad='0 32px', bg=PAPER, cls='pad'): return f'<tr><td class="{cls}" bgcolor="{bg}" style="background:{bg};padding:{pad}">{inner}</td></tr>'
def rule(): return row(f'<div style="border-top:1px solid {LINE};font-size:0;line-height:0">&nbsp;</div>')
def img(src, alt, w=600, h=None, extra=''):
    hh = f' height="{h}"' if h else ''
    return f'<img src="{src}" width="{w}"{hh} alt="{e(alt)}" style="display:block;width:100%;max-width:{w}px;height:auto;border:0;outline:none;text-decoration:none;{extra}">'

PRE = 'Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.'

parts = []
# ---------- Kopf ----------
parts.append(row(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding:26px 0 18px"><a href="{HP}" target="_blank"><img src="logo.png" width="150" alt="Velocenter Hessert" style="display:block;width:150px;height:auto;border:0"></a></td>
<td valign="middle" align="right" style="padding:26px 0 18px;font:700 11px/17px {BODY};letter-spacing:.18em;text-transform:uppercase;color:{MUT}">Dezember 2026<br><span style="color:{RED}">Wörth am Rhein</span></td></tr></table>'''))
parts.append(rule())
# ---------- Empfang ----------
parts.append(row(f'''{kick('Post aus der Hartmannstraße')}
<h1 class="h1" style="margin:12px 0 18px;font:800 46px/1.0 {DISP};letter-spacing:-.035em;color:{INK}">Bei uns wird umgebaut.<br><span style="color:{RED}">Bei den Preisen auch.</span></h1>
{p('Der Laden bekommt gerade ein neues Gesicht. Bis es fertig ist, haben wir zwei Dinge für dich: 20 € Rabatt auf die Winter-Inspektion und sechs E-Bikes, die deutlich unter UVP stehen. Alles Einzelstücke, alles ab Lager.')}''', pad='30px 32px 18px'))
# ---------- Winter-Aktion ----------
parts.append(f'<tr><td bgcolor="{PAPER}" style="background:{PAPER}">' + img('x-hero.gif', 'Werkstatt-Auftrag Winter-Inspektion mit Stempel: minus 20 Euro, dazu ein Sattelüberzug mit Velocenter-Logo geschenkt. Gültig bis 28.02.2027.', 600, 590) + '</td></tr>')
parts.append(row(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="4" bgcolor="{RED}" style="background:{RED};width:4px;font-size:0">&nbsp;</td><td style="padding:0 0 0 20px">
{kick('Winter-Inspektion 2026/27')}
{h('Im Winter hat die Werkstatt Zeit für dein Rad.')}
{p('Bis zum <b>28.02.2027</b> kostet jede Inspektion <b>20 € weniger</b>. Bei der Abholung bekommst du einen <b>Sattelüberzug mit Velocenter-Logo</b> geschenkt. Dabei sind die Checkliste und der Bosch Servicebericht: Wir lesen deinen Antrieb mit dem Bosch DiagnosticTool aus.')}
{p('Wer jetzt kommt, fährt im Frühjahr los, während andere noch auf einen Termin warten.')}
{p('Gilt nur für Marken-Fahrräder mit Bosch-Antrieb und nur, solange Termine frei sind.', 13, MUT)}
</td></tr></table>''', pad='26px 32px 6px'))
parts.append(row(f'''<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>{btn(HP+'#termin','Winter-Termin sichern')}</td>
<td style="padding-left:18px;font:400 14px/20px {BODY};color:{MUT};white-space:nowrap">oder anrufen:<br><a href="tel:+49727178033" style="color:{INK};font-weight:700;text-decoration:none">07271 78033</a></td></tr></table>''', pad='8px 32px 40px'))
# ---------- Angebote ----------
parts.append(row(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="bottom" width="120" class="six" style="font:800 150px/.78 {DISP};letter-spacing:-.06em;color:{RED}">6</td>
<td valign="bottom" style="padding:0 0 4px 12px">{kick('Ab Lager · Bestand vom 12.11.2026')}
<div class="h" style="margin-top:8px;font:800 30px/1.05 {DISP};letter-spacing:-.02em;color:{INK}">E-Bikes, bis zu<br>1.600 € unter UVP.</div></td></tr></table>
<div style="margin-top:18px;padding:10px 12px;border:1.5px dashed {RED};font:700 13px/1.5 {BODY};color:{RED}">[⚠ PRÜFEN: Sind alle 6 Räder noch da? Bestand vom 12.11.2026]</div>''', pad='34px 32px 18px', bg=PAPER2))
for i, o in enumerate(OFFERS):
    specs = ' · '.join(x for x in [o['jahr'], o['motor'], o['akku'], o['schalt'], o['disp'], o['rahmen'], o['farbe']] if x)
    parts.append(f'<tr><td bgcolor="{PAPER}" style="background:{PAPER};padding:{"0" if i else "0"} 0 0">' +
                 img(o['gif'], f"{o['marke']} {o['modell']}: {eur(o['preis'])} statt UVP {eur(o['uvp'])}, du sparst {eur(o['spar'])}", 600, 330) + '</td></tr>')
    parts.append(row(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" width="44" style="font:800 13px/22px {DISP};color:{RED};letter-spacing:.04em">{o['n']}</td>
<td valign="top"><div style="font:800 22px/1.15 {DISP};color:{INK};letter-spacing:-.01em">{o['marke']} {o['modell']}</div>
<div style="margin:6px 0 10px;font:400 13px/1.55 {BODY};color:{MUT}">{specs}</div>
<div style="margin:0 0 14px;font:400 15px/1.5 {BODY};color:{INK}"><b style="font:800 22px/1 {DISP};color:{RED}">{eur(o['preis'])}</b>&nbsp; statt UVP <s>{eur(o['uvp'])}</s> · du sparst <b>{eur(o['spar'])} ({o['pct']} %)</b> · Einzelstück</div>
{btn(o['link'], o['knopf'], INK, 'btn2')}</td></tr></table>''', pad='16px 32px 34px'))
parts.append(row(f'''{p('<b>Aus dem November noch da:</b> Stevens E-Juke 29″ (2023, 750 Wh, 16″ und 20″, Chrome Green) für <b>2.799 €</b> statt 4.399 € und Velo de Ville AEB490 Allround (2023, 630 Wh, 50 cm, Mocca Brown Matt) für <b>2.499 €</b> statt 3.599 €.', 14)}
<a href="{HP}#lager" target="_blank" style="font:700 14px/20px {BODY};color:{RED};text-decoration:underline">Alle Räder auf Lager ansehen&nbsp;&rarr;</a>''', pad='0 32px 40px'))
# ---------- Umbau ----------
parts.append(row(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" class="stk" width="230" style="font:800 84px/.86 {DISP};letter-spacing:-.05em;color:{RED}">bis<br>70&nbsp;%</td>
<td valign="top" class="stk" style="padding:6px 0 0 8px">{kick('Wir bauen um und räumen aus')}
<div style="margin:10px 0 12px;font:800 24px/1.12 {DISP};color:{INK};letter-spacing:-.01em">Kleine Geschenke für unter den Baum.</div>
{p('Ausgewählte Lenkertaschen, Fahrradtaschen, Gepäckträgerkörbe sowie i:SY- und QiO-Zubehör sind bis zu 70 % reduziert. Nur im Laden, solange der Vorrat reicht.', 14)}
<div style="padding:8px 10px;border:1.5px dashed {RED};font:700 12px/1.5 {BODY};color:{RED}">[⚠ PRÜFEN: Räumung im Dezember noch gültig?]</div></td></tr></table>''', pad='38px 32px 40px', bg=PAPER2))
# ---------- Van Raam ----------
parts.append(row(f'''{kick('Geschenkidee für die ganze Familie')}
{h('Schenk deinen Eltern ein Stück Freiheit zurück.', 34)}''', pad='42px 32px 6px'))
parts.append(f'<tr><td bgcolor="{PAPER}" style="background:{PAPER}">' + img('x-vr.gif', 'Van Raam Easy Rider Compact E-Dreirad in Weinrot mit Geschenkanhänger: Für Mama und Papa, du sparst 1.168 Euro.', 600, 400) + '</td></tr>')
vr_li = [('Drei Räder', 'Es steht von allein. An der Ampel muss niemand balancieren.'),
         ('Tiefer Einstieg', 'Kein Bein über die Stange schwingen.'),
         ('Sitz mit Rückenlehne', 'Bequem sitzen statt auf einem schmalen Sattel.'),
         ('Elektro-Unterstützung', 'Akku mit 880 Wh. Hilft am Berg und bei Gegenwind.'),
         ('Platz für den Einkauf', 'Eine Tasche lässt sich hinten an der Rückenlehne anbringen.')]
li = ''.join(f'<tr><td valign="top" width="22" style="padding:0 0 10px;font:800 15px/22px {DISP};color:{RED}">+</td><td style="padding:0 0 10px;font:400 14px/22px {BODY};color:{INK}"><b>{a}.</b> {b}</td></tr>' for a, b in vr_li)
parts.append(row(f'''{p('Zum Markt, zum Arzt, auf den Friedhof oder zu Freunden: selbst losfahren, wann man will, und niemanden fragen müssen, wer einen bringt. Und du musst dir weniger Sorgen machen, denn ein Dreirad kippt im Stand nicht um.')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px">{li}</table>
<div style="margin:0 0 6px;font:800 22px/1.15 {DISP};color:{INK}">Van Raam Easy Rider Compact</div>
<div style="margin:0 0 10px;font:400 13px/1.55 {BODY};color:{MUT}">Modell 2025 · Weinrot matt · Akku 880 Wh · 8-Gang · Einzelstück</div>
<div style="margin:0 0 14px;font:400 15px/1.5 {BODY};color:{INK}"><b style="font:800 22px/1 {DISP};color:{RED}">6.900 €</b>&nbsp; statt UVP <s>8.068 €</s> · du sparst <b>1.168 € (14 %)</b></div>
{p('Das Compact ist für kleinere Erwachsene gebaut. Ob es passt, zeigt die Probefahrt. Lieber in Raten? 0 % Finanzierung über die TARGOBANK, bis zu 24 Monate, mit Anzahlung, Bonität vorausgesetzt. Dafür gilt der reguläre Preis von 8.068 €, nicht der Aktionspreis.', 13, MUT)}
{btn(HP+'#termin', 'Probefahrt, gern mit deinen Eltern')}
<div style="height:14px;font-size:0">&nbsp;</div>
<a href="{HP}#dreirad" target="_blank" style="font:700 14px/20px {BODY};color:{RED};text-decoration:underline">Alle E-Dreiräder bei uns&nbsp;&rarr;</a>''', pad='22px 32px 46px'))
# ---------- Leasing / Finanzierung / Versicherung ----------
LEA = [('jr','JobRad','https://www.jobrad.org/'),('bl','Bikeleasing','https://www.bikeleasing.de/'),('bb','Business Bike','https://www.businessbike.de/'),
       ('dd','Deutsche Dienstrad','https://www.deutsche-dienstrad.de/'),('cb','Company Bike','https://company-bike.com/'),('km','Kazenmaier Leasing','https://www.kazenmaier.de/'),
       ('lb','Lease a Bike','https://www.lease-a-bike.de/'),('er','Eurorad','https://www.eurorad.de/'),('rd','RIDE Rad im Dienst','https://radimdienst.de/')]
cells = ''
for i, (k, n, u) in enumerate(LEA):
    if i % 3 == 0: cells += '<tr>'
    cells += f'<td class="lea" width="33%" align="center" style="padding:6px 4px"><a href="{u}" target="_blank" class="logo"><img src="lea-{k}.png" width="120" height="40" alt="{e(n)}" style="display:block;width:120px;max-width:100%;height:auto;border:0"></a></td>'
    if i % 3 == 2: cells += '</tr>'
parts.append(row(f'''<div style="border-top:2px solid {INK};font-size:0">&nbsp;</div>''', pad='0 32px', bg=PAPER2))
parts.append(row(f'''{kick('Dienstrad')}
<div style="margin:10px 0 10px;font:800 28px/1.08 {DISP};color:{INK};letter-spacing:-.02em">Wir machen Leasing.</div>
{p('Mach dein E-Bike zum Dienstrad. Die Rate läuft über deinen Arbeitgeber, wir kümmern uns um Angebot und Übergabe. Dein Anbieter ist nicht dabei? Frag einfach nach.', 14)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px">{cells}</table>
<a href="{HP}#leasing" target="_blank" style="font:700 14px/20px {BODY};color:{RED};text-decoration:underline">So funktioniert Dienstrad-Leasing&nbsp;&rarr;</a>''', pad='26px 32px 30px', bg=PAPER2))
parts.append(row(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" class="stk" width="50%" style="padding:0 14px 20px 0"><a href="https://www.targobank.de/" target="_blank"><img src="logo-targobank.png" width="140" height="40" alt="TARGOBANK" style="display:block;width:140px;height:auto;border:0;margin:0 0 10px -10px"></a>
<div style="font:800 17px/1.2 {DISP};color:{INK};margin-bottom:6px">0 % Finanzierung</div>
<div style="font:400 13px/1.55 {BODY};color:{MUT}">0 % Zinsen über die TARGOBANK (effektiver Jahreszins 0,00 %), bis zu 24 Monate, mit Anzahlung. Zum regulären Preis, nicht auf Aktionspreise. Bonität vorausgesetzt.</div></td>
<td valign="top" class="stk" width="50%" style="padding:0 0 20px 14px"><a href="https://www.enra.eu/?dealerid=10190" target="_blank"><img src="logo-enra.png" width="120" height="40" alt="ENRA Versicherung" style="display:block;width:120px;height:auto;border:0;margin:0 0 10px -10px"></a>
<div style="font:800 17px/1.2 {DISP};color:{INK};margin-bottom:6px">ENRA Versicherung</div>
<div style="font:400 13px/1.55 {BODY};color:{MUT}">Schutz gegen Diebstahl, dazu Vollkasko mit Verschleiß und Pick-up-Service. Machen wir direkt mit dir im Laden.</div></td></tr></table>''', pad='4px 32px 18px', bg=PAPER2))
# ---------- Besuch: Zeiten, Parken ----------
parts.append(row(f'''<div style="border-top:1px solid {LINE};font-size:0">&nbsp;</div>''', pad='0 32px', bg=PAPER2))
parts.append(row(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" class="stk" width="50%" style="padding:0 14px 18px 0">{kick('Öffnungszeiten', INK)}
<div style="margin-top:10px;font:400 14px/1.6 {BODY};color:{INK}">Mo, Di, Do, Fr<br>09:00–12:00 · 14:30–18:00<br>Sa 09:00–12:00<br>Mi &amp; So geschlossen</div>
<div style="margin-top:12px;font:700 14px/1.5 {BODY};color:{INK}">Weihnachten &amp; Neujahr:</div>
<div style="margin-top:4px;padding:8px 10px;border:1.5px dashed {RED};font:700 12px/1.5 {BODY};color:{RED}">[⚠ PRÜFEN: Öffnungszeiten 24.12.2026 bis 06.01.2027 eintragen]</div></td>
<td valign="top" class="stk" width="50%" style="padding:0 0 18px 14px">{kick('Parken', INK)}
<div style="margin-top:10px;font:400 14px/1.6 {BODY};color:{INK}">Zum Be- und Entladen darfst du kurz vor dem Geschäft halten. Parkplätze gibt es ca. 100 m entfernt am Friedhof.</div>
<a href="https://www.google.com/maps/search/?api=1&amp;query=Velocenter+Hessert+Hartmannstra%C3%9Fe+25+76744+W%C3%B6rth+am+Rhein" target="_blank" style="display:inline-block;margin-top:10px;font:700 14px/20px {BODY};color:{RED};text-decoration:underline">Route planen&nbsp;&rarr;</a></td></tr></table>''', pad='26px 32px 18px', bg=PAPER2))
# ---------- Social ----------
SOC = [('fb','Facebook','https://www.facebook.com/velocenterhessert'),('ig','Instagram','https://www.instagram.com/velocenterhessert/'),
       ('wa','WhatsApp-Kanal','https://whatsapp.com/channel/0029VaIekua60eBc6k2bMD0q'),('web','Homepage',HP)]
socs = [f'''<td class="stk2" style="padding:0 8px 8px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="soc" bgcolor="{INK}" style="background:{INK};border-radius:4px">
<a href="{u}" target="_blank" style="display:block;padding:12px 14px;text-decoration:none;font:700 13px/20px {BODY};color:#FFFFFF;white-space:nowrap"><img src="ic-{k}.png" width="20" height="20" alt="" style="display:inline-block;vertical-align:-5px;width:20px;height:20px;border:0;margin-right:8px">{n}</a></td></tr></table></td>''' for k, n, u in SOC]
soc = ''.join(socs[:2]) + '</tr><tr>' + ''.join(socs[2:])
parts.append(row(f'''{kick('Folg uns')}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px"><tr>{soc}</tr></table>''', pad='6px 32px 26px', bg=PAPER2))
# ---------- Fuss ----------
parts.append(row(f'''<div style="font:800 26px/1.1 {DISP};color:{INK};letter-spacing:-.02em">Frohe Weihnachten<br><span style="color:{RED}">und einen guten Rutsch.</span></div>
<div style="margin:8px 0 22px;font:400 14px/1.5 {BODY};color:{MUT}">Dein Team vom Velocenter Hessert. Familienbetrieb in Wörth am Rhein seit 1995.</div>
<div style="font:400 13px/1.7 {BODY};color:{INK}"><b>Velocenter Hessert</b> · Hartmannstraße 25 · 76744 Wörth am Rhein<br>
<a href="tel:+49727178033" style="color:{INK}">07271 78033</a> · <a href="https://wa.me/491635343133" style="color:{INK}">WhatsApp 0163 5343133</a> · <a href="mailto:info@velo-center.de" style="color:{INK}">info@velo-center.de</a></div>
<div style="margin-top:18px;padding-top:14px;border-top:1px solid {LINE};font:400 11px/1.6 {BODY};color:{MUT}">
Impressum: VELOCENTER Hessert, Inhaber Stefan Hessert, Hartmannstraße 25, 76744 Wörth am Rhein. Telefon 07271-78033, Fax 07271-78039, E-Mail info@velo-center.de. Umsatzsteuer-ID gemäß § 27 a UStG: DE171696150.<br><br>
Alle Preise inkl. MwSt. Angebote solange Vorrat reicht, Zwischenverkauf vorbehalten. Aktionspreise gelten nicht bei Leasing und Finanzierung, dafür gilt der reguläre Preis (UVP). Abbildungen ähnlich.<br><br>
Du bekommst diese E-Mail, weil du dich für den Newsletter vom Velocenter Hessert angemeldet hast. Keine Lust mehr? <a href="{{%link_unsubscribe}}" style="color:{INK};font-weight:700">Hier abmelden</a>.</div>''', pad='26px 32px 44px', bg=PAPER2))

body = '\n'.join(parts)
doc = f'''<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Velocenter Hessert · Dezember 2026</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&amp;family=Sora:wght@400;700&amp;display=swap" rel="stylesheet">
<style>
:root{{color-scheme:light;supported-color-schemes:light}}
body{{margin:0!important;padding:0!important;background:{PAPER};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}}
table{{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}} img{{-ms-interpolation-mode:bicubic}}
a{{color:{RED}}}
.btn,.btn2,.soc{{transition:background-color .2s ease,transform .2s ease}}
.btn:hover{{background:{RED_D}!important}} .btn2:hover{{background:{RED}!important}} .soc:hover{{background:{RED}!important}}
.logo img{{transition:opacity .2s}} .logo:hover img{{opacity:.6}}
@media screen and (max-width:620px){{
 .wrap{{width:100%!important}}
 .pad{{padding-left:20px!important;padding-right:20px!important}}
 .h1{{font-size:36px!important}} .h{{font-size:28px!important}}
 .six{{font-size:120px!important;width:90px!important}}
 .stk{{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important}}
 .stk2{{display:inline-block!important}}
}}
[data-ogsc] .h1,[data-ogsc] .h{{color:#FFFFFF!important}}
</style>
</head>
<body style="margin:0;padding:0;background:{PAPER}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{PAPER}">{PRE}{'&#847;&zwnj;&nbsp;' * 40}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{PAPER}" style="background:{PAPER}"><tr><td align="center">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:{PAPER}">
{body}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>'''
out = sys.argv[1] if len(sys.argv) > 1 else 'out/newsletter-dezember-2026.html'
open(out, 'w', encoding='utf-8').write(doc)
print('OK', out, len(doc) // 1024, 'KB')
for o in OFFERS: print(o['n'], o['marke'], o['modell'], eur(o['preis']), eur(o['uvp']), eur(o['spar']), o['pct'], '%')
