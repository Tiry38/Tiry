-- Tiry 11.11. (6.0.2): "ich soll wo ne Quest erledigen, obwohl ich diese noch nicht mal habe".
-- Elixier der Schmerzen Teil 1 (501, Berglöwenblut) im Log; Teil 2 (502, Lieferung, gleicher Name) galt per Namensvergleich
-- als angenommen -> "ERST ERLEDIGEN" + 1.4k XP. Erwartet: Teil 2 nicht im Log, kein Schritt einer Quest, die nicht im Log ist.
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
local PMAP, PX, PY = 1424, 0.55, 0.38                -- Vorgebirge von Hillsbrad, bei den Berglöwen
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
function UnitXP() return 90 end
function UnitXPMax() return 41400 end
bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
local LOG, READY, DONE = {}, {}, {}
local TITLE = { [501] = "Elixier der Schmerzen", [502] = "Elixier der Schmerzen", [509] = "Elixier der Pein" }
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function() return nil end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end,
  GetInfo = function(i) local k = 0 for q in pairs(LOG) do k = k + 1 if k == i then return { questID = q, title = TITLE[q] or ("Q" .. q) } end end end,
  GetQuestObjectives = function() return {} end, ReadyForTurnIn = function(id) return READY[id] or false end,
  IsQuestFlaggedCompleted = function(id) return DONE[id] or false end, GetNumQuestLogEntries = function() local n = 0 for _ in pairs(LOG) do n = n + 1 end return n, n end,
  GetTitleForQuestID = function(id) return TITLE[id] end }
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
-- Stand wie Tiry: Stufe 28, alles bis Questlevel 22 erledigt, Teil 1 + Elixier der Pein im Log
for _, e in ipairs(LevelPilot_Pool.Horde) do if e.ql <= 22 then DONE[e.q] = true end end
for _, s in ipairs(steps) do if s.q and (s.ql or 99) <= 22 then DONE[s.q] = true end end
LOG[501], LOG[509] = true, true
DONE[501], DONE[509] = nil, nil
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
print("inLog 501 " .. tostring(R.InLog(501)) .. " inLog 502 " .. tostring(R.InLog(502)))
local bad, n = 0, 0
for k = 1, 3 do
  Tm = Tm + 40
  local h, list, info = R.Plan(route, 28, {}, { k = "accept:1110" }, 6, nil)
  for _, i in ipairs(list or {}) do
    local s = steps[i]
    n = n + 1
    if (s.t == "complete" or s.t == "turnin") and not LOG[s.q] and not (list and (function() for _, j in ipairs(list) do if steps[j].t == "accept" and steps[j].q == s.q then return true end end end)()) then
      bad = bad + 1; print("  FALSCH: " .. R.StepKey(s) .. " (" .. tostring(s.n) .. ") nicht im Log und nicht vorher angenommen")
    end
  end
  if k == 1 then
    print(string.format("hero %s %s · live %s", h and R.StepKey(steps[h]) or "nil", h and tostring(steps[h].n) or "", tostring(info and info.live and info.live.zone)))
  end
end
print("Schritte ohne Quest im Log: " .. bad .. " (von " .. n .. ")")
