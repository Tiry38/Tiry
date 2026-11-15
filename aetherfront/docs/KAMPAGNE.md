# Kampagne „Chronik des Risses“

## Die Welt: Aethra
Aethra ist eine Welt aus schwebenden Inseln über einem endlosen Wolkenmeer. Getragen werden sie vom **Ätherkristall**,
dem Herz der Welt. Sechs Völker leben auf den Inseln: der **Sonnenorden** (Ritter und Priester der Himmelsbastion),
das **Wildherz** (Hüter der Wälder), die **Ätherschmiede** (Erfinder aus den Wüstenschluchten), der **Abgrund**
(ein Volk, das einst in die Tiefe verbannt wurde), die **Schwarmbrut** (Insektenvölker der Steppen) und die
**Glutgeborenen** (Feuergeister der Vulkaninseln).

## Der Konflikt
**Vael’Thar**, einst oberster Hüter des Ätherkristalls, entdeckte, dass der Kristall stirbt. Statt es zu verkünden,
riss er den Himmel auf: Durch den **Riss** will er den Abgrund mit Aethra verschmelzen – er glaubt, nur die dunkle
Energie der Tiefe könne die Welt erhalten. Dass dabei alles Leben auf den Inseln vergeht, nimmt er in Kauf.

## Die Hauptfiguren (Erzählfiguren – nicht spielbar)
Aetherfront ist ein reines Lane-Defense-Spiel mit fester Draufsicht. Die Figuren tragen die Geschichte in Missionstexten
und Dialogen; gespielt wird ausschließlich über Bahn, Bauraster, Aufwertungen, Söldner, König und Missions-Aktionen.

| Figur | Rolle in der Geschichte | Motivation |
| --- | --- | --- |
| **Kael Sturmbrecher** | Hauptmann der Himmelsbastion | Will niemanden mehr verlieren – und verliert fast alles. |
| **Mira Lichtquell** | Priesterin des Leuchtturms | Glaubt, dass jeder gerettet werden kann – sogar Vael’Thar. |
| **Lyra Morgenfeder** | Jägerin des Himmelswalds | Ihre Heimat brennt als Erstes. Sie sucht Rache und findet Verantwortung. |
| **Selene Äthersang** | Kristallmagierin | Ihr Herz ist ein Splitter des Ätherkristalls. Vael’Thar braucht sie für sein Ritual. |
| **Brann Eisenfaust** | Schmied der Äthermaschinen | Sein Lehrmeister Orrik ist der Verräter. |
| **Varo Glutklinge** | Vael’Thars Klinge | Wechselt die Seite – aber erst in Akt IV erfährt man, warum. |

## Story-Bogen
- **Akt I – Das Erwachen (Himmelsinseln):** Der Riss öffnet sich. Kael und Mira halten die Himmelsbastion, retten
  Pilger und stellen sich dem Steintitan, dem ersten Wächter des Risses. Wendepunkt: Der Titan war einst ein Wächter
  des Kristalls – Vael’Thar hat ihn verdorben.
- **Akt II – Der grüne Zorn (Wildwald):** Lyra führt die Helden in den Himmelswald, der vom Rissbrand verzehrt wird.
  Verderbte Schamanen übernehmen Türme, Gefangene müssen befreit werden, der Dornenfürst flieht. Ende: Die Aschendrachin
  fällt – doch in ihrem Hort finden die Helden Pläne, die einen Verräter in der Ätherschmiede nennen.
- **Akt III – Eisen und Äther (Wüstenschmiede):** Brann führt nach Karrak. Sandstürme, brennende Schmieden – und
  **Verrat**: Meister Orrik öffnet dem Feind die Tore und lässt eigene Vasallen überlaufen. Brann muss seinen Lehrer
  im Kampf stellen. Wendepunkt: Orrik gesteht, dass Vael’Thar Selene sucht – ihr Kristallherz ist der Schlüssel.
- **Akt IV – Herz des Abgrunds (Schattenwelt):** Die Helden ziehen durch den Riss. Schatten, gespiegelte Feinde,
  zerfallende Zeit. Varo stellt sich ihnen in den Weg – und enthüllt im Duell, dass er Vael’Thars Sohn ist. Er wählt
  Aethra. Finale: Vael’Thar in vier Phasen. Selene gibt einen Teil ihres Herzens, um den Kristall neu zu entzünden.

## Missionen (jede mit eigener Mechanik)
Alle Spieler-Aktionen sind Befehle (`{ type: 'mission', … }` über `applyCommand`) – deterministisch und online-fähig.
Anklickbare Missionsobjekte leuchten mit einem goldenen Ring; Ziel und Aktionen stehen im Missionsfenster links oben.

| # | Akt | Mission | Mechanik (nur hier) | Spieler wirkt über | Ziel |
| --- | --- | --- | --- | --- | --- |
| 1 | I | Der erste Riss | `tutorial` – Einführung Schritt für Schritt | Bauen, Bereit, Aufwerten (C/V), Söldner | 5 Wellen halten |
| 2 | I | Funken im Wind | `shards` – Ätherfunken verglühen nach Sekunden | Klick auf Funken (+15 Äther) | 8 Funken + alle Wellen |
| 3 | I | Die bröckelnde Brücke | `collapse` – vorderste Baureihe stürzt ab (Erstattung) | Bau-Entscheidung: weiter hinten bauen | alle Wellen |
| 4 | I | Leuchtfeuer | `night` – Vasallen sehen nur im Licht | Klick entzündet Leuchtfeuer für 12 s (immer wieder) | alle Wellen |
| 5 | I | Die Pilgerkarawane | `escort` – Pilger laufen durch die Bahn | Spott-Vasallen und Heiler schützen sie | höchstens 2 verloren |
| 6 | I | Der Steintitan | `titan` – Runensteine schwächen den Boss | Klick + Äther: je Rune −7 % Titan-Leben | Titan (Welle 10) überstehen |
| 7 | II | Wurzelnetz | `nodes` – Kraftknoten +50 % Schaden, wandern | Umbauen in der Bauphase | alle Wellen |
| 8 | II | Sporenregen | `weather` – Wetter ändert Angriffsarten | Vorhersage lesen, passend bauen | alle Wellen |
| 9 | II | Verderbte Wächter | `corrupt` – Verderber übernehmen Vasallen | Betäubende/Fernkampf-Vasallen | alle Wellen |
| 10 | II | Die Gefangenen | `rescue` – Käfige stürzen nach 9 s ab | schneller Klick (+20 Gold) | 8 Gefangene |
| 11 | II | Jagd auf den Dornenfürsten | `chase` – Fürst flieht zum Portal | Klick = Wurzelfalle (2,5 s, alle 10 s), Verlangsamung | 4× stellen |
| 12 | II | Die Aschendrachin | `drake` – Feueratem trifft die dichteste Rasterspalte | Bau-Entscheidung: breit verteilen | Drachin (Welle 20) überstehen |
| 13 | III | Sandsturm | `sandstorm` – Fernkampf −40 %, Gegner schneller | Nahkampf-Aufstellung | alle Wellen |
| 14 | III | Die Schmiede brennt | `lava` – Lavaschlote treffen alle | Aufstellung, Heiler | alle Wellen |
| 15 | III | Verrat am Tor | `betrayal` – Vasallen laufen über | Treueschwur (Vasall anklicken, 40 Gold, max. 4) | alle Wellen |
| 16 | III | Kristallpfeiler | `pylons` – geladene Pfeiler +40 % Angriffstempo | Klick + 25 Äther, bis Wellenende | alle Wellen |
| 17 | III | Belagerung von Karrak | `ram` – Rammböcke gegen die Feste | Rammbock bauen (Gold, 1 je Welle) + Söldner | Feste zerstören |
| 18 | III | Orrik, der Verräter | `colossus` – Dampfventile platzen | Klick lässt Ventil ab → Koloss −1 Rüstung | Koloss (Welle 20) überstehen |
| 19 | IV | Schatten im Licht | `shadows` – Gegner unsichtbar | Heiler/Unterstützer tragen Licht, Leuchtkugel (Ziel-Klick) | alle Wellen |
| 20 | IV | Spiegelwelt | `mirror` – Wellen kopieren deine Vasallen | gemischte Armee | alle Wellen |
| 21 | IV | Zerfallende Zeit | `timedecay` – Bauzeit schrumpft, Einkommen doppelt | schnelles Bauen | alle Wellen |
| 22 | IV | Letzte Bastion | `lastbastion` – keine König-Verbesserungen, 2 Heilungen | Heilungen klug einsetzen | alle Wellen |
| 23 | IV | Varos Wahl | `duel` – Varos Pakte, Varo führt die letzte Welle | Pakt annehmen (Gold jetzt, Welle +20 %) oder ablehnen | Varo bezwingen |
| 24 | IV | Vael’Thar | `riftlord` – Risskerne schirmen Gegner ab, Lava im Finale | Klick + 30 Äther zerschlägt Kerne | Vael’Thar (Welle 30) überstehen |

## Belohnungen
- 3 Sterne je Mission: Sieg · König ≥ 50 % · Missions-Herausforderung. Sterne schalten Talente frei.
- Jeder Akt schaltet ein Volk frei. Schwierigkeit: Entspannt, Normal, Legendär.
- Jede Mission zählt ins Meta-Profil (Erfahrung, Völker-Meisterschaft, Erfolge – „Chronist“ für den Abschluss).
