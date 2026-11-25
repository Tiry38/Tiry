# DREHBUCH.md aus den Ereignissen der Hauptfassung: python3 tools/drehbuch.py
import json, re
ev = json.load(open('build/ev_main.json')); D = open('data.js').read()
fmt = lambda s: f"{int(s // 60)}:{s % 60:04.1f}"
tabs = re.findall(r"\{ id: '([^']+)',(?: short: '[^']+',)? head: '([^']+)', was: '([^']+)',\s*warum: '([^']+)'", D)
rows = []
for s in ev['scenes']:
    t = s['t0']
    if s['k'] == 'intro': rows.append((t, 'Intro', 'AEB PRO', 'Modelljahr 2027 · Allround · Custom Made in Germany', 'Lichtlinie scannt, Rad (Tiefeinstieg, Poppy Red) entsteht als Kontur; Kennzeichnung „Konzeptfilm“'))
    if s['k'] == 'model': rows.append((t, 'Modellwahl', 'Allround. Neu gedacht.', 'Was: Modellreihe · Motorstufe / Warum: Ein Rahmen, vier Motoren – du wählst die Kraft für deine Wege.', 'Erklär-Tafel, Übersicht Allround, Klick auf AEB PRO, Motorliste klappt auf'))
    if s['k'] == 'motor': rows.append((t, 'Motorstufe', 'Vier Motoren. Deine Kraft.', '490 Active Line Plus 60 Nm · 890 Performance Line 75 Nm · 990PX Performance Line PX 90 Nm · 990CX Performance Line CX 120 Nm, je eine Zeile Einsatzzweck', 'Signatur: Motoren steigen mit Feder-Physik aus der Tiefe, Lichtscan, Nm-Skala; Klick 990CX, Motor morpht ins Tretlager, Rad baut sich aus Licht auf'))
    if s['k'] == 'tab':
        tb = tabs[s['ti']]; rows.append((t, tb[0], tb[1], f"Was: {tb[2]} / Warum: {tb[3]}", 'Erklär-Tafel: Lichtklinge, Tafel klappt auf, Buchstaben federn mit Gewichts-Morph ein'))
    if s['k'] == 'summary': rows.append((t, 'Zusammenfassung', 'AEB 990CX PRO', '120 Nm · 800 Wh · Automatik + Riemen · Kiox 500 · 450 Lux Fernlicht · Melon Yellow · 6.677 €', 'Panel fährt raus, Lichtlauf über das Rad'))
    if s['k'] == 'outro': rows.append((t, 'Outro / CTA', 'Dein AEB PRO.', 'Konfiguriere deins · konfigurator.velo-de-ville.com · Probefahrt bei deinem Fachhändler', 'Rad löst sich in Kontur auf, Freilauf-Ton'))
for c in ev['caps']: rows.append((c['t'], c['k'].title() + ' (Klick)', c['v'], c['s'], 'Option blinkt im Panel, Rad wechselt per Lichtkante, Kamera zoomt aufs Bauteil, Bauteil-Marker pulsiert orange'))
for n in ev['notes']: rows.append((n['t'], 'Hinweis (nur erklärt)', n['k'].title(), n['v'], 'Nicht gewählt, nur erklärt'))
rows.sort()
L = ['| Zeit | Reiter | Headline | Text | Aktion |', '|---|---|---|---|---|'] + [f"| {fmt(r[0])} | {r[1]} | {r[2]} | {r[3]} | {r[4]} |" for r in rows]
T = ev['T']; open('DREHBUCH.md', 'w').write(f"# Drehbuch – AEB PRO MY2027 Konfigurator-Film (Hauptfassung {int(T // 60)}:{int(T % 60):02d})\n\nZeiten = Hauptfassung (16:9, 4K/60). Kurzfassungen: nur Höhepunkte, der Rest wechselt in einer Lichtfahrt mit.\n\n" + '\n'.join(L) + '\n')
print(len(rows))
