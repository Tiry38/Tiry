# RezeptRadar – Rezept-Berater für WoW Forever

Add-on für **World of Warcraft: Forever** (Interface 16001), Ordner `addons/RezeptRadar/` (vier TOCs). Bis 19.11. hieß es
**Tiry's Zentrale** (7.0.0, Ordner `TirysZentrale/`); 1.0.0 ist dieselbe Funktion unter neuem Namen. **Eine Funktion, ein Fenster:**
Nach einem AH-Scan zeigt es die Rezepte für **Kochkunst** und **Lederverarbeitung**, die du noch nicht kannst,
im AH kaufen kannst und deren Hergestelltes Gold bringt – sortiert nach Gewinn je Herstellung.

Anleitung: **`ANLEITUNG.md`** · Änderungen: **`CHANGELOG.md`** · Ingame-Checkliste: **`INGAME-TEST.md`** (Teil RezeptRadar)

## Aufbau (`addons/RezeptRadar/`)
| Datei | Inhalt |
|---|---|
| `Core.lua` | Namensraum, Ereignisse, Speicher (7.0 setzt alte 6.x-Daten zurück, behält Fensterposition und gelernte Rezepte), Berufe 185/165, Items, Geld, `/rr` (`/rezept`, `/tz`) |
| `Data_Craft.lua` | 503 kaufbare Rezepte (115 Kochkunst, 388 Leder) + 1.237 Items (Name, Qualität, Symbol, Händlerpreis, Bindung). Erzeugt von `tools/gen_zentrale7.py` aus `tools/zentrale_src/` |
| `Data_VendorMats.lua` | 28 Zutaten mit unbegrenztem Händlervorrat: Stückpreis + Fraktion. Erzeugt von `tools/gen_vendor_mats.py` |
| `Data_Hotfix.lua` | Blizzard-Hotfixes (Lernstufe Gerbrahmen, Lagerfeuer, Händlerpreise, Bindung) |
| `Craft.lua` | Rezepte laden, gelernt? (Zauberbuch + Berufsfenster + NEW_RECIPE_LEARNED), Skill-Farbe |
| `Scan.lua` | Komplett-Scan starten (15-Min.-Sperre), mitlesen per Haken auf `ReplicateItems` (auch Auctionator), in Blöcken lesen, bis 3× nachlesen bei fehlenden Item-Daten, 12 Preisstufen je Item; Händlerpreise lernen |
| `Advisor.lua` | Bewertung: Verkaufswert, Material (Händler/AH über Preisstufen für 5 Herstellungen), Gewinn, Rückzahlung, Filter |
| `UI/Widgets.lua` | Design-System Neon-Glas (unverändert aus 6.x) |
| `UI/Window.lua` | Das eine Fenster, Minikarten-Knopf, Addon-Fach |

## Tests
`bash tools/test_all.sh rezept`: `tests/run_tests.lua` (Szenario: Scan → Liste → Filter → Händler → Berufsfenster →
Sperre → Migration), `spec/rezeptradar_spec.lua` (Rechen-Regeln), luacheck, `tests/check_layout.lua` (6 Ansichten, Vorschau per
`tools/render_pages.py`). Vorschau: `previews/RezeptRadar_1.0.png`. Logo + Schriftzug: `tools/make_media.py` (`logo`, `wordmark`).

## Name und gespeicherte Daten
WoW speichert SavedVariables unter dem Ordnernamen: `RezeptRadarDB` / `RezeptRadarCharDB` starten leer. Gelernte Rezepte
kommen zurück, sobald Tiry die Berufsfenster einmal öffnet; Fensterposition ist neu. `/tz` bleibt als Alias.

## Daten neu erzeugen
```
python3 -I tools/gen_zentrale7.py
python3 -I tools/gen_vendor_mats.py <ordner mit ItemSparse.csv>
```
Die Rohdaten (`Data_Recipes.lua`, `Data_RecipeItems.lua`, `Data_AllItems.lua`) liegen seit 7.0 in `tools/zentrale_src/`
(nicht mehr im Add-on); `gen_recipes.py`, `gen_recipe_items.py`, `gen_alldb.py` schreiben dorthin.

Bis 6.4 war es als Tiry's Zentrale ein großes Gold-Add-on (Dock, 20 Seiten, Craft-Planer, Farm-Guide …). Das steht in der Git-Geschichte
(Stand 6.4.0 im Branch `claude/wow-addons`, Commit vor 7.0).
