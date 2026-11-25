#!/usr/bin/env python3
import json, html
e=html.escape
rows=json.load(open('out/rows.json')); secs=json.load(open('out/secs.json'))
DEAL='Winter-Inspektion 2026/27: minus 20 Euro auf jede Inspektion, gültig nur für Marken-Fahrräder mit Bosch-Antrieb. Gratis dazu: Sattelüberzug mit Velocenter-Logo. Inklusive Checkliste und Bosch Servicebericht. Gültig vom 01.11.2026 bis 28.02.2027, nur solange Termine verfügbar sind.'
done=set(); out=[]
for r in rows:
    sec=next((s for s in secs if s['y0']<=r['y0']<s['y1']),None)
    cells=''
    for c in r['cells']:
        w=c['x1']-c['x0']; h=r['y1']-r['y0']
        alt=c['alt']
        if not alt and sec and sec['y0'] not in done:
            alt=DEAL if sec['id']=='s-deal' else sec['txt']; done.add(sec['y0'])
        im=f'<img src="{c["fn"]}" width="{w}" height="{h}" alt="{e(alt)}" style="display:block;width:100%;height:auto;border:0;outline:none;font:700 14px/1.4 Arial,sans-serif;color:#1B1E25">'
        if c['href']: im=f'<a href="{e(c["href"])}" target="_blank" class="hl" style="display:block">{im}</a>'
        cells+=f'<td width="{w}" style="width:{w/6.4:.4f}%;padding:0;font-size:0;line-height:0" valign="top">{im}</td>'
    out.append(f'<tr><td style="padding:0;font-size:0;line-height:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;border-collapse:collapse"><tr>{cells}</tr></table></td></tr>')
PRE='Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.'
FOOT='''<tr><td align="center" style="padding:4px 34px 44px;background:#E9E3DC;text-align:center">
<img src="fuss-logo.png" width="180" alt="Velocenter Hessert" style="display:block;margin:0 auto 14px;width:180px;height:auto;border:0">
<div style="font:700 11px/1.6 Arial,Helvetica,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#C8102E">Familienbetrieb seit 1995 · Wörth am Rhein</div>
<div style="margin:16px 0 0;font:400 14px/1.8 Arial,Helvetica,sans-serif;color:#1B1E25">Hartmannstraße 25 · 76744 Wörth am Rhein<br>
<a href="tel:+49727178033" style="color:#1B1E25;text-decoration:none;font-weight:700">07271 78033</a> &nbsp;·&nbsp; <a href="https://wa.me/491635343133" style="color:#1B1E25;text-decoration:none">WhatsApp 0163 5343133</a><br>
<a href="mailto:info@velo-center.de" style="color:#C8102E;text-decoration:none">info@velo-center.de</a> &nbsp;·&nbsp; <a href="https://tiry38.github.io/velo-center-web/" style="color:#C8102E;text-decoration:none">Homepage</a></div>
<div style="margin:22px 0 10px;font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#4A5161">Folge uns</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr>
<td style="padding:0 7px"><a href="https://www.facebook.com/velocenterhessert" target="_blank" class="hl"><img src="so-fb.png" width="52" height="52" alt="Facebook" style="display:block;width:52px;height:52px;border:0"></a></td>
<td style="padding:0 7px"><a href="https://www.instagram.com/velocenterhessert/" target="_blank" class="hl"><img src="so-ig.png" width="52" height="52" alt="Instagram" style="display:block;width:52px;height:52px;border:0"></a></td>
<td style="padding:0 7px"><a href="https://whatsapp.com/channel/0029VaIekua60eBc6k2bMD0q" target="_blank" class="hl"><img src="so-wa.png" width="52" height="52" alt="WhatsApp-Kanal" style="display:block;width:52px;height:52px;border:0"></a></td>
<td style="padding:0 7px"><a href="https://tiry38.github.io/velo-center-web/" target="_blank" class="hl"><img src="so-hp.png" width="52" height="52" alt="Homepage" style="display:block;width:52px;height:52px;border:0"></a></td>
</tr></table>
<div style="width:60px;height:2px;background:#B87333;margin:24px auto 20px;font-size:0;line-height:0">&nbsp;</div>
<div style="font:700 10px/1.6 Arial,Helvetica,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#4A5161">Impressum</div>
<div style="margin:6px auto 0;max-width:480px;font:400 12px/1.7 Arial,Helvetica,sans-serif;color:#3F4552">VELOCENTER Hessert · Inhaber Stefan Hessert · Einzelunternehmen<br>Hartmannstraße 25, 76744 Wörth am Rhein<br>Telefon 07271-78033 · Fax 07271-78039 · info@velo-center.de<br>USt-IdNr. gemäß § 27 a UStG: DE171696150</div>
<div style="margin:18px auto 0;max-width:480px;font:400 11px/1.65 Arial,Helvetica,sans-serif;color:#5A6070">Alle Preise inkl. MwSt. Angebote solange Vorrat reicht, Zwischenverkauf vorbehalten. Aktionspreise gelten nicht bei Leasing und Finanzierung, dafür gilt der reguläre Preis (UVP). Abbildungen ähnlich.<br><br>Du bekommst diese E-Mail, weil du dich für den Newsletter vom Velocenter Hessert angemeldet hast.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto 0"><tr><td style="border:1.5px solid #C8102E;border-radius:999px"><a href="{%link_unsubscribe}" style="display:inline-block;padding:9px 20px;font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#C8102E;text-decoration:none">Newsletter abmelden</a></td></tr></table>
</td></tr>'''
doc=f'''<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Velocenter Hessert · Dezember 2026</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{{margin:0!important;padding:0!important;background:#E9E3DC;-webkit-text-size-adjust:100%}}
table{{mso-table-lspace:0;mso-table-rspace:0}} img{{-ms-interpolation-mode:bicubic}}

@media screen and (max-width:640px){{.wrap{{width:100%!important}}}}
</style></head>
<body style="margin:0;padding:0;background:#E9E3DC">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#E9E3DC">{PRE}{'&#847;&zwnj;&nbsp;'*40}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E9E3DC" style="background:#E9E3DC"><tr><td align="center" style="padding:0">
<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px">
{chr(10).join(out)}
{FOOT}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>'''
open('mail/newsletter-dezember-2026.html','w',encoding='utf-8').write(doc); print('HTML',len(doc)//1024,'KB')
