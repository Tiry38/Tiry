-- Regressionstests aus Prüfrunde 2 (5.0.2): jeder Fall lief in 5.0.1 falsch.
-- Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/regress.lua   (meldet "REGRESS OK", Exit 0)
-- Jeder Fall laeuft als eigener Prozess (eigene Attrappen), Ergebnis wird an der Ausgabe geprueft.
local dir = "../../tests/regress/"
local cases = {
  { "titel_cache", "Route.lua", "Questie lädt beim Login: Kettenteil mit gleichem Titel zählt NICHT als im Log",
    function(o) return o:find("state = open, turnin 527 %(step %d+%) state = open") ~= nil end },
  { "hub_wiederbesuch", "Route.lua", "Hub-Wiederbesuch (Grom'gol): alte Quest vom 1. Besuch blockiert den Sprung nicht",
    function(o) return o:find("jump 203", 1, true) ~= nil end },
  { "item_quest", "Route.lua", "Annehmen per Gegenstand (ohne Koordinaten): Zeiger klebt nicht fest",
    function(o) return o:find("t=4 s: pointer 9", 1, true) ~= nil end },
  { "einstieg_log", "Route.lua", "Log-Einstieg: alte Brachland-Reste ziehen nicht zurück (Schritt 114, nicht 16)",
    function(o) return o:find("pointer 114", 1, true) ~= nil end },
  { "einstieg_ausreisser", "Route.lua", "Log-Einstieg: eine Quest weit über der Stufe zieht nicht nach vorn (Abschnitt 2)",
    function(o) local i = tonumber(o:match("pointer (%d+)")) return i ~= nil and i >= 4 and i <= 60 end },
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
