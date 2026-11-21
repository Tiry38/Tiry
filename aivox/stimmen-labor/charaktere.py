"""Demo-Gespräche mit Charakter: Wortwahl, Pausen ([pause short]/[pause]), Sprechtempo je Person.
Erzeugt MP3s (Google Chirp 3 HD) + scn.json für die Website. Aufruf: python charaktere.py <ausgabeordner>"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chirp_gen import synth

# Szenario: (Titel, AIVOX-Stimme, Anrufer-Stimme, Anrufer-Beschreibung, Tempo AIVOX, Tempo Anrufer, Zeilen, Erkannt-Felder)
SCN = [
 ('Termin buchen', 'Leda', 'Achird', 'Herr Becker · entspannt', 1.0, 0.97, [
  ('ki', 'Fahrrad-Werkstatt am Markt, guten Tag! [pause short] Sie sprechen mit der digitalen Assistenz – ich bin eine künstliche Intelligenz. Was kann ich für Sie tun?'),
  ('an', 'Ja, hallo! [pause short] Mein E-Bike müsste mal wieder zur Inspektion. Geht diese Woche noch was?'),
  ('ki', 'Na klar, einen Moment … [pause short] ich schau kurz nach. [pause short] Am Donnerstag um halb elf wäre noch ein Platz frei. Passt Ihnen das?'),
  ('an', 'Donnerstag, halb elf … [pause short] ja, das passt super.'),
  ('ki', 'Wunderbar! Auf welchen Namen darf ich den Termin eintragen?'),
  ('an', 'Bitte auf den Namen Becker.'),
  ('ki', 'Danke, Herr Becker. [pause short] Ich schicke Ihnen die Bestätigung per Es-Em-Es an die Nummer, mit der Sie gerade anrufen. Ist das in Ordnung?'),
  ('an', 'Ja, gerne. Danke Ihnen!'),
  ('ki', 'Sehr gern! Dann bis Donnerstag – und gute Fahrt bis dahin.')],
  [['Anliegen', 'Inspektion E-Bike', 1], ['Freier Termin (aus deinem Kontingent)', 'Donnerstag, 10:30 Uhr', 2], ['Name (erfragt)', 'Becker', 5], ['Bestätigung', 'SMS an die Anrufnummer (zugestimmt)', 7], ['Ergebnis', 'Termin vergeben · SMS gesendet · Übergabe-Karte an dich', 8, 1]]),
 ('Ist mein Rad fertig?', 'Enceladus', 'Aoede', 'Frau Meier · neugierig', 1.0, 1.04, [
  ('an', 'Hallo! [pause short] Ich wollte nur mal kurz fragen, ob mein Fahrrad schon fertig ist?'),
  ('ki', 'Gern, ich schau sofort nach. [pause short] Sie rufen von der Nummer aus Ihrem Reparaturauftrag an – spreche ich mit Frau Meier?'),
  ('an', 'Ja, genau, das bin ich!'),
  ('ki', 'Gute Nachrichten, Frau Meier: [pause short] Ihr Rad ist fertig! Sie können es ab sechzehn Uhr abholen. Die Rechnung liegt bei neunundachtzig Euro.'),
  ('an', 'Oh, super! [pause short] Vielen Dank, dann komm ich nachher vorbei.'),
  ('ki', 'Sehr gern! Bis später – wir freuen uns.')],
  [['Anliegen', 'Abholstatus', 0], ['Erkannt über', 'Rufnummer im Reparaturauftrag', 1], ['Bestätigt', 'Frau Meier', 2], ['Auskunft (Status aus dem Cockpit)', 'Fertig ab 16:00 Uhr · 89 €', 3], ['Ergebnis', 'Erledigt, kein Rückruf nötig', 5, 1]]),
 ('Panne, eilig', 'Pulcherrima', 'Iapetus', 'Herr Schneider · gestresst', 0.97, 1.12, [
  ('an', 'Hallo, ja, [pause short] ich hab einen Platten, und ich brauch mein Rad eigentlich morgen früh für die Arbeit!'),
  ('ki', 'Oh je, das ist ärgerlich. [pause short] Aber keine Sorge – das kriegen wir hin. Wenn Sie das Rad heute bis achtzehn Uhr bringen, ist es morgen ab halb acht fertig. Wie ist Ihr Name?'),
  ('an', 'Schneider. [pause short] Ach, Gott sei Dank – das ist perfekt.'),
  ('ki', 'Sehr gern, Herr Schneider. [pause short] Ich habe es für die Werkstatt notiert. Bis nachher – und Kopf hoch!')],
  [['Anliegen', 'Platten · Rad morgen früh gebraucht', 0], ['Lösung (deine Regel: Express)', 'Abgabe bis 18:00 · fertig ab 7:30', 1], ['Name (erfragt)', 'Schneider', 2], ['Ergebnis', 'Auftrag für die Werkstatt notiert', 3, 1]]),
 ('Nach Feierabend', 'Algenib', 'Laomedeia', 'Anruferin · am Abend, müde', 1.0, 0.92, [
  ('an', 'Ähm, … guten Abend. [pause short] Haben Sie heute noch offen?'),
  ('ki', 'Guten Abend! [pause short] Heute haben wir leider schon geschlossen. Morgen früh sind wir ab neun Uhr wieder für Sie da. Soll Sie jemand aus dem Team zurückrufen?'),
  ('an', 'Ja … [pause short] das wäre nett, danke.'),
  ('ki', 'Gern geschehen. [pause short] Wir rufen Sie morgen früh an, unter der Nummer, mit der Sie gerade anrufen. Einen schönen Abend noch – und erholen Sie sich gut.')],
  [['Uhrzeit', 'Nach Ladenschluss', 0], ['Auskunft (aus deinem Profil)', 'Morgen ab 9:00 Uhr geöffnet', 1], ['Rückrufnummer', 'Übertragene Anrufnummer', 3], ['Ergebnis', 'Rückruf für morgen früh in deiner Liste', 3, 1]]),
]

TEL = 'adelay=150,highpass=f=170,lowpass=f=6500,equalizer=f=1800:t=q:w=1:g=2,acompressor=threshold=-22dB:ratio=3,loudnorm=I=-18:TP=-2'
KI = 'adelay=60,loudnorm=I=-16:TP=-1.5'

def clean(t):
    return t.replace('[pause short]', '').replace('[pause]', '').replace('  ', ' ').replace(' ,', ',').strip()

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    web = []
    for si, (title, ki, an, who, rki, ran, lines, fields) in enumerate(SCN, 1):
        L = []
        for li, (r, text) in enumerate(lines, 1):
            fid = f's{si}-{li}'
            voice = 'de-DE-Chirp3-HD-' + (ki if r == 'ki' else an)
            synth(text, voice, f'{out}/{fid}.raw.mp3', rate=rki if r == 'ki' else ran)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'{out}/{fid}.raw.mp3', '-af', KI if r == 'ki' else TEL,
                            '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '128k' if r == 'ki' else '96k', f'{out}/{fid}.mp3'], check=True)
            os.remove(f'{out}/{fid}.raw.mp3')
            L.append({'who': 'ki' if r == 'ki' else 'anrufer', 'src': fid, 'text': clean(text)})
            print('ok', fid, voice.split('-')[-1], flush=True)
        web.append({'title': title, 'voiceKi': ki, 'voiceAn': an, 'who': who, 'lines': L, 'fields': fields})
    json.dump(web, open(f'{out}/scn.json', 'w'), ensure_ascii=False, indent=1)
