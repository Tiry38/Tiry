-- Regressionstests aus Prüfrunde 2 (5.0.2) und Spielberichten: jeder Fall lief in einer älteren Version falsch.
-- Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/regress.lua   (meldet "REGRESS OK", Exit 0)
-- Jeder Fall laeuft als eigener Prozess (eigene Attrappen), Ergebnis wird an der Ausgabe geprueft.
local dir = "../../tests/regress/"
local cases = {
  { "titel_cache", "Route.lua", "Questie lädt beim Login: Kettenteil mit gleichem Titel zählt NICHT als im Log",
    function(o) return o:find("state = open, turnin 527 %(step %d+%) state = open") ~= nil end },
  { "hub_wiederbesuch", "Route.lua", "Hub-Wiederbesuch (Grom'gol): alte Quest vom 1. Besuch blockiert den Sprung nicht",
    function(o) return o:find("into seg 8: true", 1, true) ~= nil end },
  { "item_quest", "Route.lua", "Annehmen per Gegenstand (ohne Koordinaten): Zeiger klebt nicht fest",
    function(o) return o:find("t=4 s: pointer 9", 1, true) ~= nil end },
  { "einstieg_log", "Route.lua", "Log-Einstieg: alte Brachland-Reste ziehen nicht zurück (Zeiger bleibt im Eschental)",
    function(o) return o:find(", seg 5), hero", 1, true) ~= nil end },
  { "einstieg_ausreisser", "Route.lua", "Log-Einstieg: eine Quest weit über der Stufe zieht nicht nach vorn (Abschnitt 2)",
    function(o) local i = tonumber(o:match("pointer (%d+)")) return i ~= nil and i >= 4 and i <= 60 end },
  { "aufhol_quests", "Route.lua", "Hinter dem Plan (Stufe 27, Tiry 11.11.): Aufhol-Quests statt Grinden; ab 28 weg; im Plan nie",
    function(o) return o:find("behind: level 27 pointer accept:5147 hero accept:4904 fill=28", 1, true) ~= nil and o:find("fill steps done: 6", 1, true) ~= nil
      and o:find("level 28: hero complete:4770 | in-log fill 4770 complete open=true", 1, true) ~= nil and o:find("on plan: fill seen=false", 1, true) ~= nil
      and o:find("xp 3%: need 37700 cover 7000 rest 30700 open 3", 1, true) ~= nil and o:find("xp 93%: need 2900 cover 4650 rest 0 open 2", 1, true) ~= nil end },
  { "aufhol_zurueck", "Route.lua", "Zeiger hinter dem Aufhol-Block (Tiry 11.11.): machbare Aufhol-Quests kommen zurueck (Gegner zu stark -> nicht); alles erledigt -> Grinden bis 28 mit XP bis 28",
    function(o) return o:find("past block: pointer accept:1110 hero accept:4966", 1, true) ~= nil
      and o:find("all done: pointer accept:1110 hero grind:4124:27:Tausend Nadeln need28 14900", 1, true) ~= nil end },
  { "neu_berechnen", "Route.lua", "Neu berechnen: nahe gleich schwere Quest als Abstecher, nie schwerere/Elite; danach Plan weiter",
    function(o) return o:find("rethink: switched=true best=102 refQl=26", 1, true) ~= nil
      and o:find("after: hero accept:102 detour 102 wants102 true", 1, true) ~= nil
      and o:find("detour steps: complete:102 turnin:102 | back to plan: accept:101 detour nil", 1, true) ~= nil
      and o:find("at plan target: switched=nil", 1, true) ~= nil end },
  { "grind_weg", "Route.lua", "Stufe 27 in Donnerfels, Grind-Ziel weit weg (Tiry 11.11.): verpasste Route-Quest wird Extra-Quest; Weg zum Grind-Platz zaehlt mit",
    function(o) return o:find("missed route quest: hero accept:6462 pool=true detour 6462", 1, true) ~= nil
      and o:find("grind travel: far accept:6621 detour=6621 | near grind:4124:27:Tausend Nadeln detour=nil", 1, true) ~= nil
      and o:find("crowd: 6621", 1, true) ~= nil end },
  { "live", "Route.lua", "Live-Modus (Tiry 11.11.): Quest-Gebiet nach Ort + Questlog, nur einfache Quests, Reihenfolge Annehmen/Erledigen/Abgeben, kein Hin und Her",
    function(o) return o:find("live: true", 1, true) ~= nil and o:find("too hard 0", 1, true) ~= nil and o:find("order ok true", 1, true) ~= nil
      and o:find("wants area true wants other false", 1, true) ~= nil and o:find("after accept: same area true hero in area true", 1, true) ~= nil
      and o:find("ready: turnin in list at 1", 1, true) ~= nil and o:find("sticky true", 1, true) ~= nil
      and o:find("turned in: hero accept:%d+ in area true gone true") ~= nil and o:find("live off: live false", 1, true) ~= nil
      and o:find("B cluster>=3 true too hard 0", 1, true) ~= nil and select(2, o:gsub("too hard 0", "")) == 2 end },
  { "pool_extra", "Route.lua", "Stufe 27, Route sagt Grinden (Tiry 11.11.): passende Extra-Quest aus dem Pool (Vorquest da, Quest/Gegner <= Stufe+1), danach die naechste",
    function(o) return o:find("level 27: hero accept:5062 pool=true detour 5062 auto=true", 1, true) ~= nil
      and o:find("wants5062 true", 1, true) ~= nil
      and o:find("steps: complete:5062 turnin:5062 | next accept:5881", 1, true) ~= nil
      and o:find("too hard 0", 1, true) ~= nil end },
  { "netz_anbindung", "Travel.lua", "Splitter (Dach/Fels) neben dem Spieler: Hauptnetz bleibt angebunden (0 Verluste)",
    function(o) return o:find("cont 0: 0 of", 1, true) ~= nil and o:find("cont 1: 0 of", 1, true) ~= nil end },
  { "aufzug_hinweis", "Travel.lua", "Donnerfels-Aufzug: Hinweis an allen 5 Stellen davor",
    function(o) local n = 0 for _ in o:gmatch("via Aufzug") do n = n + 1 end return n == 5 end },
}
local fails = 0
for _, c in ipairs(cases) do
  local p = io.popen("lua5.1 " .. dir .. c[1] .. ".lua " .. c[2] .. " 2>&1")
  local o = p:read("*a") p:close()
  local ok = c[4](o)
  print((ok and "  ok   " or "  FAIL ") .. c[3])
  if not ok then fails = fails + 1 print(o) end
end
if fails > 0 then print(fails .. " FEHLER") os.exit(1) end
print("REGRESS OK")
