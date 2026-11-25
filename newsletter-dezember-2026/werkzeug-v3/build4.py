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
FOOT='''<tr><td style="padding:22px 26px 36px;font:400 12px/1.65 Arial,Helvetica,sans-serif;color:#3F4552;background:#E9E3DC">
Impressum: VELOCENTER Hessert, Inhaber Stefan Hessert, Hartmannstraße 25, 76744 Wörth am Rhein. Telefon 07271-78033, Fax 07271-78039, E-Mail info@velo-center.de. Umsatzsteuer-ID gemäß § 27 a UStG: DE171696150.<br><br>
Alle Preise inkl. MwSt. Angebote solange Vorrat reicht, Zwischenverkauf vorbehalten. Aktionspreise gelten nicht bei Leasing und Finanzierung, dafür gilt der reguläre Preis (UVP). Abbildungen ähnlich.<br><br>
Du bekommst diese E-Mail, weil du dich für den Newsletter vom Velocenter Hessert angemeldet hast. Keine Lust mehr? <a href="{%link_unsubscribe}" style="color:#C8102E;font-weight:700">Hier abmelden</a>.</td></tr>'''
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
.hl img{{transition:filter .2s ease,transform .2s ease}} .hl:hover img{{filter:brightness(1.07) saturate(1.08)}} .hl:active img{{filter:brightness(.92)}}
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
