-- Tiry 11.11. (6.0 Live-Modus): "beim Start aktualisieren, wo ich bin, welche Quest ich habe, was am praktischsten
-- waere – wo gleich auch andere Quests sind, nicht 1-2 Quests und wieder Gebietswechsel. Einfache Quests!"
-- Echte Kartengrenzen (zones_mock), echtes Wege-/Flugnetz, echter Quest-Pool mit festen Koordinaten.
-- Erwartet: Ziel = Schritt aus einem Quest-GEBIET (mehrere Quests nah beieinander), alle Quests einfach
-- (Quest/Gegner <= Stufe+1), Annehmen vor Erledigen vor Abgeben, kein Hin und Her zwischen Gebieten,
-- Quests im Log zaehlen mit (Questlog-Check: behalten), Abgabe fertiger Quests in der Naehe zuerst.
local ROUTE = arg[1] or "Route.lua"
local Tm = 1000
function GetTime() return Tm end function time() return 1700000000 + math.floor(Tm) end
local Obj = {}; Obj.__index = function() return function() end end
function CreateFrame() return setmetatable({}, Obj) end
function wipe(t) for k in pairs(t) do t[k] = nil end return t end
CreateVector2D = function(x, y) return { x = x, y = y } end
dofile("../../tests/zones_mock.lua")
ZONES_MOCK[1414] = { 1, 12000, -10000, 12500, -12000 }
local PMAP, PX, PY = 1441, 0.4567, 0.5074            -- Freiwindposten, Tausend Nadeln
C_Map = MockCMap()
C_Map.GetBestMapForUnit = function() return PMAP end
C_Map.GetPlayerMapPosition = function() return { x = PX, y = PY } end
local mi = C_Map.GetMapInfo
C_Map.GetMapInfo = function(m) local r = mi and mi(m) or {}; r.name = r.name or ("Karte " .. m); return r end
function GetUnitSpeed() return 7 end
function IsSwimming() return false end
function IsMounted() return false end
function UnitOnTaxi() return false end
function UnitFactionGroup() return "Horde", "Horde" end
function UnitClass() return "Schamane", "SHAMAN", 7 end
function IsShiftKeyDown() return false end
function UnitXP() return 34300 end
function UnitXPMax() return 38900 end
bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
local LOG, READY, DONE = {}, {}, {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function() return nil end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, GetInfo = function() return nil end,
  GetQuestObjectives = function() return {} end, ReadyForTurnIn = function(id) return READY[id] or false end,
  IsQuestFlaggedCompleted = function(id) return DONE[id] or false end, GetNumQuestLogEntries = function() return 0, 0 end }
dofile(ROUTE) dofile("Nav.lua") dofile("Walk.lua") dofile("Travel.lua")
C_TaxiMap = { GetTaxiNodesForMap = function() return {} end, GetAllTaxiNodes = function() return {} end }
dofile("Fly.lua")
LevelPilotDB = { fp = {}, ft = {}, fpSeen = true }
dofile("Routes/Horde_22_30.lua") dofile("Routes/Pool_Horde.lua")
local R = LP_Route
local route = LevelPilot_Routes.horde_22_30
local steps = route.steps
local POOLQ = {}
for _, e in ipairs(LevelPilot_Pool.Horde) do POOLQ[e.q] = e end
-- Stand wie Tiry: Route bis Tausend Nadeln komplett, dazu alle Pool-Quests unter Stufe 22 erledigt
for _, s in ipairs(steps) do if s.q then DONE[s.q] = true end end
for _, e in ipairs(LevelPilot_Pool.Horde) do if e.ql < 22 then DONE[e.q] = true end end
local function fresh() R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true) end
fresh()
local plan = { k = "accept:1110" }
local LVL = 27
local function run() Tm = Tm + 1 return R.Plan(route, LVL, {}, plan, 6, nil) end
local h, list, info = run()
local li = info and info.live
print(string.format("live: %s hero %s pool=%s", tostring(li ~= nil), h and R.StepKey(steps[h]) or "nil", tostring(h and steps[h].pool)))
if not li then print("LIVE FEHLT") os.exit(1) end
local names, hard = {}, 0
for q in pairs(li.qs) do
  local e = POOLQ[q]
  names[#names + 1] = e.n .. " (" .. e.ql .. ")"
  if e.ql > LVL + 1 or (e.ml or 0) > LVL + 1 or e.rl > LVL or e.ql < LVL - 3 then hard = hard + 1 end   -- zu schwer oder zu leicht
end
table.sort(names)
print(string.format("area: %s · %d Quests · %d XP · %.0f XP/Min · Weg %.1f Min", tostring(li.zone), li.n, li.xp, li.rate, li.trip or -1))
print("  " .. table.concat(names, ", "))
print(string.format("cluster>=2 %s too hard %d", tostring(li.n >= 2), hard))
-- Reihenfolge: jeder Schritt erst nach seinem Vorgaenger
local okOrder, seen = true, {}
for _, i in ipairs(list) do
  local s = steps[i]
  if s.t == "complete" and not seen["accept:" .. s.q] and not LOG[s.q] then okOrder = false end
  if s.t == "turnin" and not seen["accept:" .. s.q] and not LOG[s.q] then okOrder = false end
  seen[R.StepKey(s)] = true
end
print("order ok " .. tostring(okOrder) .. " list " .. #list)
-- Auto-Annehmen: Quests des Gebiets ja, andere nein
local first = steps[h].q
local other
for _, e in ipairs(LevelPilot_Pool.Horde) do if not li.qs[e.q] and not DONE[e.q] then other = e.q break end end
print("wants area " .. tostring(R.Wants(route, first, plan.i)) .. " wants other " .. tostring(R.Wants(route, other, plan.i)))
-- Annehmen -> Gebiet bleibt, Ziel bleibt im Gebiet
LOG[first] = true fresh()
local h2, _, info2 = run()
print(string.format("after accept: same area %s hero in area %s", tostring(info2.live and info2.live.qs[first] == true),
  tostring(info2.live and info2.live.qs[steps[h2].q] == true)))
-- Questlog-Check: Quest des Gebiets wird behalten
local adv = nil
-- Fertig -> Abgabe in der Naehe kommt frueh
READY[first] = true fresh()
local h3, l3 = run()
local tinPos
for k, i in ipairs(l3) do if steps[i].t == "turnin" and steps[i].q == first then tinPos = k end end
print("ready: turnin in list at " .. tostring(tinPos))
-- Kein Hin und Her: 10 Sekunden spaeter, minimal versetzt -> gleiches Gebiet
local before = {}
for q in pairs(R.info.live.qs) do before[q] = true end
PX = PX + 0.002 Tm = Tm + 40
local _, _, info4 = run()
local same = true
for q in pairs(before) do if not info4.live.qs[q] and q ~= first then same = false end end
print("sticky " .. tostring(same))
-- Abgegeben -> Gebiet arbeitet weiter, die Quest ist raus
LOG[first], READY[first], DONE[first] = nil, nil, true fresh()
local h5, _, info5 = run()
print(string.format("turned in: hero %s in area %s gone %s", R.StepKey(steps[h5]), tostring(info5.live and info5.live.qs[steps[h5].q] == true),
  tostring(not (info5.live and info5.live.qs[first]))))
-- Aus: fester Plan wie bisher
R.live = false R.LiveReset()
local h6, _, info6 = run()
print("live off: live " .. tostring(info6.live ~= nil))
-- B: Stufe 24 am Wegekreuz (Brachland), nur Quests unter 20 erledigt -> ein Gebiet mit MEHREREN Quests
R.live = true R.LiveReset()
for k in pairs(DONE) do DONE[k] = nil end for k in pairs(LOG) do LOG[k] = nil end for k in pairs(READY) do READY[k] = nil end
for _, e in ipairs(LevelPilot_Pool.Horde) do if e.ql < 20 then DONE[e.q] = true end
  for _, p in ipairs(e.pre or {}) do if POOLQ[p] == nil then DONE[p] = true end end
  for _, p in ipairs(e.pres or {}) do if POOLQ[p] == nil then DONE[p] = true end end end
PMAP, PX, PY, LVL = 1413, 0.5194, 0.3017, 24
plan = { k = "accept:1110" } fresh() Tm = Tm + 100
local hb, lb, ib = run()
local lv = ib.live
local nb, hardB = {}, 0
for q in pairs(lv and lv.qs or {}) do local e = POOLQ[q] nb[#nb + 1] = e.n .. " (" .. e.ql .. ")"
  if e.ql > LVL + 1 or (e.ml or 0) > LVL + 1 or e.rl > LVL or e.ql < LVL - 3 then hardB = hardB + 1 end end
table.sort(nb)
print(string.format("B area: %s · %d Quests · %d XP · %.0f XP/Min · Weg %.1f Min · hero %s", tostring(lv and lv.zone), lv and lv.n or 0, lv and lv.xp or 0, lv and lv.rate or 0, lv and lv.trip or -1, R.StepKey(steps[hb])))
print("  " .. table.concat(nb, ", "))
print(string.format("B cluster>=3 %s too hard %d", tostring((lv and lv.n or 0) >= 3), hardB))
local seq = {}
for _, i in ipairs(lb) do seq[#seq + 1] = R.StepKey(steps[i]) end
print("B tour: " .. table.concat(seq, " "))
