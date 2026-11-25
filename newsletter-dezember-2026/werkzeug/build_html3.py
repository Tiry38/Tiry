# Newsletter Dezember 2026 – Version 2 "Winternacht": dunkel, animiert, kompakt
from urllib.parse import quote
O = '/home/user/Tiry/newsletter-dezember-2026/'
BG = '#F7F1E8'; PANEL = '#FFFFFF'; LINE = '#E3D9CB'; TXT = '#1B1E25'; MUT = '#5F5A53'
RED = '#CF1A2C'; REDL = '#CF1A2C'
H = "Sora,'Arial Black',Arial,Helvetica,sans-serif"
T = "Outfit,Arial,Helvetica,sans-serif"
WA = 'https://wa.me/491635343133'
def wa(t): return WA + '?text=' + quote(t)

def btn(label, href, cls='cta', ghost=False):
    bg = 'transparent' if ghost else RED
    border = f'border:2px solid {TXT};' if ghost else f'border:2px solid {RED};'
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>
<td class="{cls}" bgcolor="{'' if ghost else RED}" style="background:{bg};{border}">
<a href="{href}" style="display:inline-block;padding:14px 24px;font-family:{H};font-size:15px;font-weight:700;line-height:18px;color:{TXT if ghost else '#FFFFFF'};text-decoration:none;">{label}&nbsp;&nbsp;&rarr;</a>
</td></tr></table>'''

def kick(t, c=REDL):
    return f'<p style="margin:0 0 12px;font-family:{H};font-size:12px;line-height:16px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:{c};">{t}</p>'

def h2(t):
    return f'<h2 class="h2" style="margin:0;font-family:{H};font-size:32px;line-height:36px;font-weight:800;letter-spacing:-1.1px;color:{TXT};">{t}</h2>'

def bike(img, alt, brand, model, specs, uvp, jetzt, pct):
    return f'''<tr><td class="px" style="padding:18px 20px;border-top:1px solid {LINE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="168" valign="middle" class="thumb" style="width:168px;vertical-align:middle;padding-right:16px;"><img src="{img}" width="168" alt="{alt}" style="display:block;width:100%;max-width:168px;height:auto;border:0;"></td>
<td valign="middle" style="vertical-align:middle;">
<p style="margin:0;font-family:{H};font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:{REDL};">{brand}</p>
<p style="margin:3px 0 0;font-family:{H};font-size:18px;line-height:22px;font-weight:700;color:{TXT};">{model}</p>
<p style="margin:4px 0 8px;font-family:{T};font-size:13px;line-height:18px;color:{MUT};">{specs}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:{H};font-size:24px;line-height:26px;font-weight:800;color:{TXT};padding-right:10px;white-space:nowrap;">{jetzt}</td>
<td style="background:{RED};padding:4px 7px;font-family:{H};font-size:12px;line-height:14px;font-weight:800;color:#fff;white-space:nowrap;">{pct}</td>
</tr></table>
<p style="margin:4px 0 0;font-family:{T};font-size:13px;line-height:16px;color:{MUT};">UVP <span style="text-decoration:line-through;">{uvp}</span></p>
</td></tr></table></td></tr>'''

bikes = (
    bike('l-ejuke.jpg', 'Stevens E-Juke 29 Zoll, Chrome Green', 'Stevens · 2023', 'E-Juke 29&#8243;',
         'Bosch Performance Line CX · 750 Wh · Shimano XT 12-fach · Kiox 300 · 16&#8243; und 20&#8243; · Chrome Green',
         '4.399 €', '2.799 €', '&minus;1.600 € · &minus;36 %')
  + bike('l-aeb490.jpg', 'Velo de Ville AEB490 Allround, Mocca Brown matt', 'Velo de Ville · 2023', 'AEB490 Allround 28&#8243;',
         'Bosch Active Line Plus · 630 Wh · Shimano Nexus 8-Gang · 50 cm · Mocca Brown matt',
         '3.599 €', '2.499 €', '&minus;1.100 € · &minus;31 %')
  + bike('l-seb890.png', 'Velo de Ville SEB890 SUV Smart, Foto folgt', 'Velo de Ville · 2023', 'SEB890 SUV Smart 27,5&#8243;',
         'Bosch Performance Line Smart System · 625 Wh · Shimano 9-Gang · Intuvia 100 · 45 cm · Pure White',
         '3.745 €', '2.620 €', '&minus;1.125 € · &minus;30 %')
  + bike('l-ktm.jpg', 'KTM Macina City P610 RT, oak', 'KTM · 2022', 'Macina City P610 RT',
         'Bosch Performance Line · 625 Wh · Shimano 5-Gang RT · Intuvia · 56 cm · oak (black+orange)',
         '3.799 €', '2.799 €', '&minus;1.000 € · &minus;26 %')
)

def soc(img, label, href):
    return f'''<td class="socw" style="padding:0 10px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="soc" width="56" height="56" align="center" valign="middle" bgcolor="#1B1E25" style="width:56px;height:56px;background:#1B1E25;border:1px solid #1B1E25;">
<a href="{href}" title="{label}" style="display:block;width:56px;height:56px;"><img src="{img}" width="48" height="48" alt="{label}" style="display:block;width:48px;height:48px;margin:4px;border:0;"></a></td></tr>
<tr><td align="center" style="padding-top:6px;font-family:{T};font-size:11px;line-height:14px;color:{MUT};">{label}</td></tr></table></td>'''

html = f'''<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Velocenter Hessert · Dezember 2026</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&family=Sora:wght@700;800&display=swap" rel="stylesheet">
<style>
body{{margin:0;padding:0;background:{BG};}}
a{{color:{REDL};}}
/* Interaktion: Knöpfe reagieren auf Maus/Finger (Apple Mail, iOS, Gmail Web, Outlook.com) */
.cta,.soc{{transition:background-color .2s ease,transform .2s ease;}}
.cta:hover{{background:#FFFFFF!important;}}
.cta:hover a{{color:{RED}!important;}}
.ghost:hover{{background:{TXT}!important;}}
.ghost:hover a{{color:#FFFFFF!important;}}
.soc:hover{{background:{RED}!important;border-color:{RED}!important;transform:translateY(-3px) rotate(-3deg);}}
/* Animation (Apple Mail / iOS Mail): Haupt-Knopf pulsiert, WhatsApp-Knopf wackelt */
@keyframes puls{{0%,100%{{box-shadow:0 0 0 0 rgba(207,26,44,.55);}}60%{{box-shadow:0 0 0 12px rgba(207,26,44,0);}}}}
@keyframes wackel{{0%,86%,100%{{transform:rotate(0)}}90%{{transform:rotate(-8deg)}}94%{{transform:rotate(8deg)}}}}
.puls{{animation:puls 2.2s ease-out infinite;}}
.wa{{animation:wackel 3.5s ease-in-out infinite;}}
@media (prefers-reduced-motion:reduce){{.puls,.wa{{animation:none!important;}}}}
@media only screen and (max-width:620px){{
 .wrap{{width:100%!important;}}
 .px{{padding-left:18px!important;padding-right:18px!important;}}
 .h1{{font-size:30px!important;line-height:34px!important;}}
 .h2{{font-size:26px!important;line-height:30px!important;}}
 .thumb{{width:118px!important;padding-right:12px!important;}}
 .num{{font-size:38px!important;line-height:38px!important;}}
 img.fluid{{width:100%!important;height:auto!important;}}
}}
</style>
</head>
<body style="margin:0;padding:0;background:{BG};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{BG};">20 &euro; weniger auf jede Winter-Inspektion + Sattelüberzug geschenkt. Dazu fünf E-Bikes bis &minus;39 %.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{BG}" style="background:{BG};">
<tr><td align="center" background="x-wald.jpg" style="background:{BG} url(x-wald.jpg) center top repeat-y;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:{BG};">

<!-- Kopf -->
<tr><td class="px" style="padding:18px 20px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><a href="https://www.velo-center.de/"><img src="logo.png" width="120" alt="Velocenter Hessert" style="display:block;width:120px;height:auto;border:0;"></a></td>
<td valign="middle" align="right" style="font-family:{H};font-size:11px;line-height:15px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:{MUT};">Wörth am Rhein<br><span style="color:{TXT};">Dezember 2026</span></td>
</tr></table></td></tr>

<!-- 1 Aufmacher: Schnee-Animation -->
<tr><td style="padding:0;"><a href="{wa('Hallo Velocenter, ich möchte einen Termin für die Winter-Inspektion.')}"><img src="x-hero.gif" width="600" alt="Winter-Inspektion: 20 Euro Rabatt auf jede Inspektion plus Sattelüberzug geschenkt, bis 28.02.2027" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></a></td></tr>
<tr><td class="px" style="padding:6px 20px 34px;">
<h1 class="h1" style="margin:0;font-family:{H};font-size:36px;line-height:40px;font-weight:800;letter-spacing:-1.3px;color:{TXT};">Dein Rad hat Pause. <span style="color:{REDL};">Wir nutzen sie.</span></h1>
<p style="margin:12px 0 20px;font-family:{T};font-size:16px;line-height:24px;color:{TXT};">Bis 28.02.2027: <strong>20&nbsp;&euro; Rabatt auf jede Inspektion</strong> und ein <strong>Sattelüberzug geschenkt</strong> &ndash; für Fahrräder, E-Bikes, E-Dreiräder und Cargo-E-Räder. Wer jetzt kommt, wartet im Frühjahr nicht.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="puls" style="padding:0;">{btn('Termin sichern', wa('Hallo Velocenter, ich möchte einen Termin für die Winter-Inspektion.'))}</td>
<td style="padding-left:16px;font-family:{T};font-size:14px;line-height:18px;color:{MUT};">oder <a href="tel:+49727178033" style="color:{TXT};font-weight:600;text-decoration:none;">07271&nbsp;78033</a></td>
</tr></table>
</td></tr>

<!-- 2 Werkstatt direkt dahinter (Auslastung) -->
<tr><td style="padding:0;border-top:1px solid {LINE};"><a href="tel:+49727178033"><img src="x-werkstatt.gif" width="600" alt="Bosch-Werkstatt im Haus: E-Bike-Inspektion inklusive Softwareupdate" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></a></td></tr>
<tr><td class="px" style="padding:18px 20px 34px;">
<p style="margin:0 0 16px;font-family:{T};font-size:16px;line-height:24px;color:{TXT};"><strong>E-Bike-Inspektion inklusive Softwareupdate</strong> &ndash; direkt in unserer Werkstatt. Kein Einschicken, kein Umweg.</p>
{btn('Werkstatt anrufen', 'tel:+49727178033', cls='ghost', ghost=True)}
</td></tr>

<!-- 3 Aktionsraeder: Signatur-Animation -->
<tr><td class="px" style="padding:40px 20px 14px;">
{kick('Einzelstücke · ab Lager · Bestand 23.11.')}
{h2('Fünf E-Bikes. Bis &minus;39&nbsp;%.')}
</td></tr>
<tr><td style="padding:0;"><img src="x-antelao.gif" width="600" alt="Stevens E-Antelao 29 Zoll rollt durch eine riesige rote Zahl: minus 39 Prozent" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td class="px" style="padding:16px 20px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="bottom" style="vertical-align:bottom;">
<p style="margin:0;font-family:{H};font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:{REDL};">Stevens · 2022</p>
<p style="margin:3px 0 0;font-family:{H};font-size:22px;line-height:26px;font-weight:800;color:{TXT};">E-Antelao 29&#8243;</p>
<p style="margin:4px 0 0;font-family:{T};font-size:13px;line-height:18px;color:{MUT};">Bosch Performance CX · 625 Wh · Shimano 11-Gang · Kiox · 22&#8243; · Arctic Grey</p>
</td>
<td valign="bottom" align="right" style="vertical-align:bottom;padding-left:12px;white-space:nowrap;">
<p style="margin:0;font-family:{T};font-size:13px;line-height:16px;color:{MUT};">UVP <span style="text-decoration:line-through;">4.099 €</span></p>
<p class="num" style="margin:0;font-family:{H};font-size:44px;line-height:46px;font-weight:800;letter-spacing:-1.5px;color:{REDL};">2.499&nbsp;€</p>
</td></tr></table>
</td></tr>
{bikes}
<tr><td class="px" style="padding:22px 20px 44px;border-top:1px solid {LINE};">
{btn('Probefahrt vereinbaren', wa('Hallo Velocenter, ich möchte eine Probefahrt mit einem der Dezember-Angebote vereinbaren.'))}
<p style="margin:10px 0 0;font-family:{T};font-size:13px;line-height:18px;color:{MUT};">Nur solange Vorrat reicht &ndash; alles Einzelstücke.</p>
</td></tr>

<!-- 4 Unterm Baum -->
<tr><td class="px" style="padding:6px 20px 10px;">
{kick('Unterm Baum')}
{h2('Schenk deinen Eltern ein Stück Freiheit zurück.')}
</td></tr>
<tr><td style="padding:0;"><img src="x-vanraam.gif" width="600" alt="Van Raam Easy Rider Compact in Weinrot mit Geschenkanhänger: Für Mama und Papa" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td class="px" style="padding:4px 20px 28px;">
<p style="margin:0 0 6px;font-family:{T};font-size:16px;line-height:24px;color:{TXT};">Ein Van Raam E-Dreirad: <strong>stabil auf drei Rädern</strong>, <strong>tiefer Einstieg</strong>, <strong>Elektro-Unterstützung für jeden Weg</strong>.</p>
<p style="margin:12px 0 0;font-family:{H};font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:{RED};">Auf Lager · Einzelstück</p>
<p style="margin:3px 0 0;font-family:{H};font-size:18px;line-height:22px;font-weight:700;color:{TXT};">Van Raam Easy Rider Compact</p>
<p style="margin:3px 0 8px;font-family:{T};font-size:13px;line-height:18px;color:{MUT};">Modell 2025 · weinrot-matt · Akku 880 Wh · 8-Gang</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;"><tr>
<td style="font-family:{H};font-size:30px;line-height:32px;font-weight:800;color:{RED};padding-right:12px;white-space:nowrap;">6.900&nbsp;€</td>
<td style="font-family:{T};font-size:13px;line-height:16px;color:{MUT};">UVP <span style="text-decoration:line-through;">8.068 €</span><br>du sparst 1.168 €</td></tr></table>
{btn('Probefahrt – gern mit deinen Eltern', wa('Hallo Velocenter, wir möchten eine Probefahrt mit einem Van Raam E-Dreirad vereinbaren.'), cls='ghost', ghost=True)}
</td></tr>
<tr><td style="padding:0;border-top:1px solid {LINE};"><a href="{wa('Hallo Velocenter, ich interessiere mich für ein E-Bike als Weihnachtsgeschenk.')}"><img src="x-ebike.gif" width="600" alt="Das E-Bike unterm Baum: ab 2.239 Euro statt UVP 3.199 Euro" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></a></td></tr>
<tr><td class="px" style="padding:8px 20px 30px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:8px 0;border-top:1px solid {LINE};font-family:{T};font-size:14px;line-height:19px;color:{TXT};"><strong>Velo de Ville AEB400 Allround 28&#8243;</strong> &ndash; Tiefeinsteiger · 55 cm · wine red · 2022 · Bosch Active Line Plus · 500 Wh · Shimano 8-Gang<br><span style="color:{MUT};">UVP <span style="text-decoration:line-through;">3.199 €</span></span></td><td align="right" valign="top" style="padding:8px 0 8px 10px;border-top:1px solid {LINE};font-family:{H};font-size:17px;font-weight:800;color:{RED};white-space:nowrap;">2.239&nbsp;€</td></tr>
<tr><td style="padding:8px 0;border-top:1px solid {LINE};border-bottom:1px solid {LINE};font-family:{T};font-size:14px;line-height:19px;color:{TXT};"><strong>Velo de Ville AEB800 Allround 28&#8243;</strong> &ndash; Tiefeinsteiger · 55 cm · stone basalt matt · 2021 · Bosch Performance Line · 500 Wh · Shimano 9-Gang · Purion<br><span style="color:{MUT};">UVP <span style="text-decoration:line-through;">3.034 €</span></span></td><td align="right" valign="top" style="padding:8px 0 8px 10px;border-top:1px solid {LINE};border-bottom:1px solid {LINE};font-family:{H};font-size:17px;font-weight:800;color:{RED};white-space:nowrap;">2.399&nbsp;€</td></tr>
</table>
<div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
{btn('Fürs Fest reservieren – anfragen', wa('Hallo Velocenter, ich möchte ein E-Bike als Weihnachtsgeschenk reservieren.'))}
</td></tr>
<tr><td style="padding:0;border-top:1px solid {LINE};"><a href="{wa('Hallo Velocenter, ich interessiere mich für die Klingel mit GPS.')}"><img src="x-klingel.gif" width="600" alt="Neu bei uns: Klingel mit GPS, AirBell Pro, 39,95 Euro einmalig" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></a></td></tr>
<tr><td class="px" style="padding:2px 20px 26px;"><p style="margin:0;font-family:{T};font-size:15px;line-height:22px;color:{TXT};"><strong>Neu bei uns: Klingel mit GPS (AirBell Pro) &ndash; 39,95&nbsp;€ einmalig.</strong> Sieht aus wie eine normale Klingel und findet dein Rad wieder. Für Apple und Android, keine Abokosten. Das Geschenk unter 40&nbsp;€.</p></td></tr>
<tr><td style="padding:0;border-top:1px solid {LINE};"><img src="x-umbau.gif" width="600" alt="Umbau-Räumung: bis zu 70 Prozent auf Zubehör" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td class="px" style="padding:4px 20px 40px;">
<p style="margin:0;font-family:{T};font-size:15px;line-height:22px;color:{TXT};"><strong>Umbau-Räumung:</strong> Lenkertaschen, Fahrradtaschen, Gepäckträgerkörbe sowie i:SY- und QiO-Zubehör bis zu 70&nbsp;% reduziert &ndash; solange der Vorrat reicht. Perfekt als kleines Geschenk.</p>
</td></tr>

<!-- 5 Geld -->
<tr><td style="padding:0;border-top:1px solid {LINE};"><img src="x-geld.gif" width="600" alt="0 Prozent Finanzierung, 0 Euro Anzahlung" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td class="px" style="padding:4px 20px 30px;">
<p style="margin:0;font-family:{T};font-size:15px;line-height:22px;color:{TXT};"><strong>0&nbsp;% Finanzierung, 0&nbsp;€ Anzahlung</strong> mit der TARGOBANK &ndash; die Rate rechnen wir dir im Laden aus. <strong>Versicherung mit ENRA:</strong> neues E-Bike ab ca. 129&nbsp;€/Jahr.</p>
<p style="margin:10px 0 0;font-family:{T};font-size:13px;line-height:20px;color:{MUT};">Gebrauchtes E-Bike versichern: ca. 70&ndash;80&nbsp;€/Jahr, je nach Wert. Leasing über den Arbeitgeber mit JobRad, Bikeleasing, Business Bike, Deutsche Dienstrad, Company Bike, Kazenmaier, Lease a Bike, Eurorad, mein-dienstrad.de.<br>
<a href="https://www.enra.eu/fahrrad-diebstahlversicherung#tarifrechner" style="color:{TXT};font-weight:600;">ENRA-Tarif</a> · <a href="https://www.jobrad.org/arbeitnehmer/ersparnis-berechnen" style="color:{TXT};font-weight:600;">JobRad-Rechner</a> · <a href="https://bikeleasing.de/leasingrechner/arbeitnehmer" style="color:{TXT};font-weight:600;">Bikeleasing</a> · <a href="https://www.businessbike.de/leasing-rechner/" style="color:{TXT};font-weight:600;">Business Bike</a> · <a href="https://www.deutsche-dienstrad.de/jetzt-berechnen" style="color:{TXT};font-weight:600;">Deutsche Dienstrad</a></p>
</td></tr>

<!-- 6 Hinweise -->
<tr><td class="px" style="padding:30px 20px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="4" style="width:4px;background:{RED};font-size:0;">&nbsp;</td>
<td style="padding:2px 0 2px 14px;">
<p style="margin:0;font-family:{H};font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:{REDL};">Weihnachten &amp; Silvester</p>
<p style="margin:4px 0 0;font-family:{H};font-size:16px;line-height:22px;font-weight:700;color:{TXT};">[&#9888; PLATZHALTER &ndash; Öffnungszeiten 24.12.&ndash;06.01. eintragen]</p>
</td></tr></table></td></tr>
<tr><td class="px" style="padding:16px 20px 34px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="4" style="width:4px;background:#B9AE9F;font-size:0;">&nbsp;</td>
<td style="padding:2px 0 2px 14px;">
<p style="margin:0;font-family:{H};font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:{MUT};">Bitte beachten</p>
<p style="margin:4px 0 0;font-family:{T};font-size:14px;line-height:21px;color:{TXT};"><strong>Be- und Entladen vor dem Laden ist erlaubt</strong> &ndash; trotz der weißen Sperrlinien. Parken: Friedhofparkplatz, 100&nbsp;m weiter oben.</p>
</td></tr></table></td></tr>

<!-- 7 Abschluss -->
<tr><td style="padding:0;border-top:1px solid {LINE};"><img src="marken.jpg" width="600" alt="Unsere Marken: i:SY, QiO, KTM, Gudereit, Van Raam, Velo de Ville, Victoria, Stevens" class="fluid" style="display:block;width:600px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td class="px" style="padding:22px 20px 8px;border-top:1px solid {LINE};">
<p style="margin:0;font-family:{H};font-size:28px;line-height:32px;font-weight:800;letter-spacing:-.9px;color:{TXT};">Frohe Weihnachten <span style="color:{REDL};">&amp; guten Rutsch.</span></p>
<p style="margin:8px 0 20px;font-family:{T};font-size:14px;line-height:20px;color:{MUT};">Dein Team vom Velocenter Hessert, Wörth am Rhein &ndash; seit 1995.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
{soc('ic-facebook.png', 'Facebook', 'https://www.facebook.com/velocenterhessert')}
{soc('ic-instagram.png', 'Instagram', 'https://www.instagram.com/velocenterhessert/')}
{soc('ic-whatsapp.png', 'WhatsApp', WA).replace('class="soc"', 'class="soc wa"', 1)}
{soc('ic-web.png', 'Homepage', 'https://www.velo-center.de/')}
</tr></table>
</td></tr>
<tr><td class="px" style="padding:22px 20px 10px;">
<p style="margin:0;font-family:{T};font-size:13px;line-height:20px;color:{TXT};"><strong style="font-family:{H};">Velocenter Hessert</strong> · Hartmannstr. 25 · 76744 Wörth am Rhein<br>
<a href="tel:+49727178033" style="color:{TXT};text-decoration:none;">07271 78033</a> · <a href="{WA}" style="color:{TXT};text-decoration:none;">WhatsApp 0163 5343133</a> · <a href="mailto:info@velo-center.de" style="color:{TXT};text-decoration:none;">info@velo-center.de</a><br>
<span style="color:{MUT};">Mo, Di, Do, Fr 09:00&ndash;12:00 &amp; 14:30&ndash;18:00 · Sa 09:00&ndash;12:00 · Mi geschlossen</span></p>
</td></tr>
<tr><td class="px" style="padding:12px 20px 34px;">
<p style="margin:0;font-family:{T};font-size:11px;line-height:17px;color:{MUT};">Impressum: VELOCENTER Hessert · Inhaber: Stefan Hessert · Hartmannstraße 25 · 76744 Wörth am Rhein · Telefon 07271 78033 · info@velo-center.de · USt-IdNr. DE171696150. Du bekommst diese E-Mail, weil du dich für unseren Newsletter angemeldet hast. Angebote solange Vorrat reicht. <a href="{{%link_unsubscribe}}" style="color:{TXT};">Abmelden</a></p>
</td></tr>

</table>
</td></tr></table>
</body>
</html>
'''
open(O + 'newsletter-dezember-2026.html', 'w', encoding='utf-8').write(html)
print('ok', len(html))
