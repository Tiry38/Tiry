-- LevelPilot · Szenario-Test Reisen (echte Kartengrenzen, echtes Wegenetz Walk.lua, echtes Flugnetz)
-- Tirys Fall (11.11.): am Zoram'gar-Flugpunkt, Steinkrallen-Quests im Log. Luftlinie zum Steinkrallengipfel
-- 830 Yards, echter Laufweg ueber 6.700 Yards durch den Talondeep-Pfad -> LevelPilot muss Fliegen
-- (Zoram'gar -> Sonnenfels) raten, der Pfeil darf nicht ueber die Berge zeigen, und Quests aus dem Log, die
-- direkt am Flugpunkt liegen, kommen zuerst.
-- Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/travel.lua   (muss "TRAVEL TESTS OK" melden)
local fails = 0
local function check(ok, msg) print((ok and "OK    " or "FEHLER") .. "  " .. msg); if not ok then fails = fails + 1 end end

local Tm = 1000
function GetTime() return Tm end function time() return 1700000000 + math.floor(Tm) end
local Obj = {}; Obj.__index = function() return function() end end
function CreateFrame() return setmetatable({}, Obj) end
function wipe(t) for k in pairs(t) do t[k] = nil end return t end
CreateVector2D = function(x, y) return { x = x, y = y } end
dofile("../../tests/zones_mock.lua")
-- Kontinentkarte Kalimdor (1414) fuer die Flugmeister-Positionen: beliebige, feste Grenzen
ZONES_MOCK[1414] = { 1, 12000, -10000, 12500, -12000 }
local PMAP, PX, PY = 1440, 0.1224, 0.338              -- Zoram'gar-Flugmeister (Andruk)
C_Map = MockCMap()
C_Map.GetBestMapForUnit = function() return PMAP end
C_Map.GetPlayerMapPosition = function() return { x = PX, y = PY } end
local SPEED = 7
function GetUnitSpeed() return SPEED end
function IsSwimming() return false end
function IsMounted() return false end
function UnitOnTaxi() return false end
function UnitFactionGroup() return "Horde", "Horde" end
function IsShiftKeyDown() return false end
local LOG = {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function() return nil end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, GetInfo = function() return nil end,
  GetQuestObjectives = function() return {} end, ReadyForTurnIn = function() return false end,
  IsQuestFlaggedCompleted = function() return false end, GetNumQuestLogEntries = function() return 0 end }

-- Flugmeister aus dem Flugnetz (Walk.lua) als C_TaxiMap-Attrappe
dofile("Route.lua") dofile("Nav.lua") dofile("Walk.lua") dofile("Travel.lua")
local NAMES = { [58] = "Zoram'gar-Außenposten, Eschental", [29] = "Sonnenfels, Steinkrallengebirge",
  [25] = "Das Wegekreuz, Brachland", [61] = "Splitterholzposten, Eschental", [23] = "Orgrimmar, Durotar",
  [22] = "Donnerfels, Mulgore", [55] = "Brackenwall, Düstermarschen" }
local function mapPos(X, Y)
  local _, v = C_Map.GetMapPosFromWorldPos(1, { x = X, y = Y }, 1414)
  return v
end
C_TaxiMap = { GetTaxiNodesForMap = function()
  local out = {}
  for id, nm in pairs(NAMES) do
    local t = LevelPilot_Taxi[1].t[id]
    out[#out + 1] = { nodeID = id, name = nm, position = mapPos(t[1], t[2]), faction = 1 }
  end
  return out
end, GetAllTaxiNodes = function() return {} end }
dofile("Fly.lua")
LevelPilotDB = { fp = {}, ft = {}, fpSeen = true }
for id in pairs(NAMES) do LevelPilotDB.fp[id] = true end

local W, R, F = LP_Walk, LP_Route, LP_Fly
local function P(m, x, y) return W.Point(m, x / 100, y / 100) end
local PEAK = { map = 1442, x = 0.371, y = 0.081 }       -- Keeper Albagorm, Steinkrallengipfel
local zor = W.Player()

print("== 1. Laufweg statt Luftlinie")
local straight = R.Dist(PEAK)
local g = W.Ground(W.Point(PEAK.map, PEAK.x, PEAK.y), zor)
print(string.format("   Zoram'gar -> Gipfel: Luftlinie %.0f yd, Laufweg %.0f yd", straight, g))
check(straight < 900, "Luftlinie Zoram'gar -> Gipfel ist kurz (~830 yd)")
check(g > 6000, "echter Laufweg Zoram'gar -> Gipfel > 6000 yd (durch den Talondeep-Pfad)")
local gs = W.Ground(P(1442, 37.1, 8.1), P(1442, 47.5, 61.0))
check(gs > 2000 and gs < 2600, string.format("Sonnenfels -> Gipfel %.0f yd (Navmesh exakt 2230)", gs))
check(W.Ground(P(1440, 12.2, 34.2), P(1442, 78.3, 42.5)) < 3500, "Zoram'gar -> Talondeep-Ausgang Steinkrallen unter 3500 yd")

print("== 2. Flug-Rat am Zoram'gar-Flugmeister")
local t, h = W.FlightTime(1, 58, 29)
check(t and t > 300 and t < 420, string.format("Flugnetz Zoram'gar -> Sonnenfels %s s, %s Fluege (Era-Daten 378 s)", tostring(t), tostring(h)))
for _, spd in ipairs({ 7, 9.8 }) do
  SPEED = spd; Tm = Tm + 30
  local a = F.Advice(PEAK, "peak" .. spd)
  print(string.format("   Tempo %.1f: %s", spd, a and string.format("%s -> %s, laufen %.0f s, fliegen %.0f s, spart %.0f s, am FM %s",
    a.from, a.to, a.run, a.fly, a.save, tostring(a.atFM)) or "kein Rat"))
  check(a and a.kind == "fly" and a.to == "Sonnenfels" and a.from == "Zoram'gar-Außenposten",
    string.format("Tempo %.1f: Flug Zoram'gar -> Sonnenfels empfohlen", spd))
  check(a and a.atFM, "  ... und du stehst schon am Flugmeister")
end
SPEED = 7
-- Gegenprobe: Ziel 600 yd weg auf freiem Feld -> kein Flug
Tm = Tm + 30
check(F.Advice({ map = 1440, x = 0.20, y = 0.38 }, "near") == nil, "nahes Ziel im Eschental: kein Flug-Rat")

print("== 3. Pfeil zeigt den Weg, nicht ueber die Berge")
local wp, len, rest = R.Route(PEAK)
check(wp ~= nil, "Pfeil bekommt einen Wegpunkt")
if wp then
  local e, n = R.Offset(wp)
  local te, tn = R.Offset(PEAK)
  print(string.format("   Wegpunkt: %.0f yd Ost, %.0f yd Nord  (Ziel: %.0f Ost, %.0f Nord), Restweg %.0f yd", e, n, te, tn, len))
  check(te < 0, "Gipfel liegt westlich (Luftlinie zeigt nach Suedwesten)")
  check(e > 0, "Pfeil zeigt nach Osten (Richtung Talondeep-Pfad), nicht ueber die Berge")
end
-- Laufen simulieren: immer zum Wegpunkt springen, bis der Pfeil direkt zum Ziel zeigt
local walked, steps, via = 0, 0, {}
local zw = W.Point(PMAP, PX, PY)
for i = 1, 400 do
  Tm = Tm + 1
  local w2 = R.Route(PEAK)
  if not w2 then break end
  if w2.via then via[w2.via.name] = true end
  local p0 = W.Point(PMAP, PX, PY)
  local q = W.Point(w2.map, w2.x, w2.y)
  walked = walked + math.sqrt((q.x - p0.x) ^ 2 + (q.y - p0.y) ^ 2)
  PMAP, PX, PY = w2.map, w2.x, w2.y
  local m, pos = C_Map.GetMapPosFromWorldPos(1, q, 1442)
  if pos.x >= 0 and pos.x <= 1 and pos.y >= 0 and pos.y <= 1 then PMAP, PX, PY = 1442, pos.x, pos.y end
  steps = i
end
local fin = R.Dist(PEAK)
walked = walked + (fin or 0)
print(string.format("   %d Wegpunkte, gelaufen %.0f yd, zuletzt %.0f yd direkt zum Ziel", steps, walked, fin or -1))
local vl = {} for k in pairs(via) do vl[#vl + 1] = k end
print("   Hinweise unterwegs: " .. (#vl > 0 and table.concat(vl, ", ") or "-"))
check(steps > 5 and steps < 400, "Pfeil fuehrt in Etappen bis ans Ziel (keine Endlosschleife)")
check(fin and fin < 400, "am Ende steht man vor dem Ziel")
check(via["Talondeep-Pfad"], "unterwegs: 'über Talondeep-Pfad'")
check(walked > 5500 and walked < 9000, string.format("gelaufene Strecke %.0f yd passt zum Laufweg (Navmesh 6747)", walked))

print("== 4. Fester Plan: Ziel = Plan-Schritt, Weg/Flug-Rat dafuer nach echtem Gelaende")
PMAP, PX, PY = 1440, 0.1224, 0.338
local function S(t, q, m, x, y, l) return { t = t, q = q, map = m, x = x / 100, y = y / 100, l = l or 24, ql = 23, rl = 20 } end
local steps2 = {
  S("complete", 1087, 1442, 36.3, 13.0), S("complete", 1058, 1442, 38.3, 16.5), S("complete", 6301, 1442, 48.8, 40.7),
}
for k = 1, 16 do steps2[#steps2 + 1] = S("accept", 9000 + k, 1413, 45 + k * 0.3, 59) end
steps2[#steps2 + 1] = S("complete", 216, 1440, 35.0, 37.9, 26)
steps2[#steps2 + 1] = S("complete", 6462, 1440, 40.7, 33.6, 26)
local route = { steps = steps2 }
LOG = { [1087] = true, [1058] = true, [6301] = true }
local PL = {}
local best = R.Plan(route, 24, {}, PL, 5)
print("   ohne Zoram'gar-Quests im Log -> Schritt " .. tostring(best) .. " (q " .. tostring(steps2[best] and steps2[best].q) .. ")")
check(best == 1 and steps2[best].q == 1087, "Plan beginnt mit dem ersten Steinkrallen-Schritt")
LOG[216], LOG[6462] = true, true
Tm = Tm + 10
best = R.Plan(route, 24, {}, PL, 5)
print("   mit Zoram'gar-Quests im Log -> Schritt " .. tostring(best) .. " (q " .. tostring(steps2[best] and steps2[best].q) .. ")")
check(best == 1, "Quests im Log werfen den Plan nicht um (Reihenfolge bleibt)")
PMAP, PX, PY = 1442, 0.475, 0.61
Tm = Tm + 10
best = R.Plan(route, 24, {}, PL, 5)
check(best == 1 and steps2[best].map == 1442, "in Sonnenfels: derselbe Plan-Schritt")
local cost, _, st = R.StepCost(steps2[3])
check(cost and st and cost > st, string.format("Sonnenfels -> Mirkfallonsee: Laufweg %.0f yd > Luftlinie %.0f yd", cost or -1, st or -1))
-- zurueck nach Zoram'gar ohne die Eschental-Quests: naechster Steinkrallen-Schritt + Flug-Rat dorthin
PMAP, PX, PY = 1440, 0.1224, 0.338
LOG[216], LOG[6462] = nil, nil
Tm = Tm + 10
best = R.Plan(route, 24, {}, PL, 5)
local tb = R.StepTarget(steps2[best])
local a = F.Advice(tb, "best")
print("   Ziel q " .. steps2[best].q .. ": " .. (a and string.format("Flug %s -> %s spart %.0f s", a.from, a.to, a.save) or "kein Flug-Rat"))
check(a and a.to == "Sonnenfels", "Flug-Rat fuer den Plan-Schritt: von Zoram'gar nach Sonnenfels fliegen")

print("== 5. Rechenzeit (Spieler laeuft 3 km durchs Eschental, Liste + Pfeil + Flug-Rat jede Sekunde)")
LOG[216], LOG[6462] = true, true
-- Kaltstart: alle Wegsuchen leer (wie nach dem Einloggen), eine komplette Aktualisierung
W.Flush(); R.ResetPath(); collectgarbage()
PMAP, PX, PY = 1440, 0.1224, 0.338
local tc = os.clock()
local PP = {}
do
  local b = R.Plan(route, 24, {}, PP, 5)
  local tb2 = b and R.StepTarget(steps2[b])
  if tb2 then R.Route(tb2); F.Advice(tb2, "kalt" .. b) end
  for j = 1, 5 do R.StepCost(steps2[j], nil, 2500) end
end
local cold = (os.clock() - tc) * 1000
print(string.format("   Kaltstart (alle Wegsuchen neu): %.1f ms, %d Suchen", cold, W.Stats()))
check(cold < 250, "Kaltstart unter 250 ms (einmalig nach Login/Kontinentwechsel)")
local c0, worst = os.clock(), 0
for k = 1, 150 do
  PMAP, PX, PY = 1440, 0.1224 + k * 0.0035, 0.338 + k * 0.0002
  Tm = Tm + 1
  local t1 = os.clock()
  local b = R.Plan(route, 24, {}, PP, 5)
  local tb2 = b and R.StepTarget(steps2[b])
  if tb2 then R.Route(tb2); F.Advice(tb2, "lauf" .. b) end
  for j = 1, 5 do R.StepCost(steps2[j], nil, 2500) end
  worst = math.max(worst, os.clock() - t1)
end
local avg = (os.clock() - c0) / 150 * 1000
print(string.format("   je Sekunde im Mittel %.1f ms, schlimmster Fall %.1f ms (Lua 5.1 ohne JIT)", avg, worst * 1000))
check(avg < 6, "mittlere Rechenzeit je Aktualisierung unter 6 ms")
check(worst < 0.06, "keine Aktualisierung ueber 60 ms")

collectgarbage()
print(string.format("Speicher nach allen Tests: %.1f MB", collectgarbage("count") / 1024))
if fails == 0 then print("TRAVEL TESTS OK") else print(fails .. " FEHLER"); os.exit(1) end
