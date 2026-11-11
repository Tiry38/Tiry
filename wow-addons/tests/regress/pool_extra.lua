-- Tiry 11.11. (Screenshot 5.1.5): Stufe 27 bei 69 %, Tausend Nadeln komplett, Route sagt "Grinden bis 28".
-- Erwartet (5.1.6): der Plan holt eine passende Extra-Quest aus dem Quest-Pool (Quest + Gegner hoechstens Stufe +1,
-- Vorquest erledigt, nah genug), zeigt sie als Ziel, nimmt sie automatisch an und geht danach weiter.
-- Nie: Quest ueber Stufe +1, Gegner ueber Stufe +1, fehlende Vorquest, ferne Quest vor naher.
local ROUTE = arg[1] or "Route.lua"
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
function UnitClass() return "Klasse", "X", 7 end
function UnitOnTaxi() return false end
function UnitFactionGroup() return "Horde" end
bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
local PX, PY = 0.5, 0.5
C_Map = { GetBestMapForUnit = function() return 9999 end, GetPlayerMapPosition = function() return { x = PX, y = PY } end,
  GetMapWorldSize = function() return 30000, 30000 end, GetMapInfo = function() return { parentMapID = 0 } end,
  GetWorldPosFromMapPos = function(m, v) return 1, v end, GetMapPosFromWorldPos = function(c, v, m) return m, v end }
CreateVector2D = function(x, y) return { x = x, y = y } end
local LOG, READY, DONE = {}, {}, {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function() return nil end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, GetInfo = function() return nil end,
  GetNumQuestLogEntries = function() return 0, 0 end, GetQuestObjectives = function() return {} end,
  ReadyForTurnIn = function(id) return READY[id] or false end, IsQuestFlaggedCompleted = function(id) return DONE[id] or false end }
dofile(ROUTE) dofile("Routes/Horde_22_30.lua") dofile("Routes/Pool_Horde.lua")
local R = LP_Route
local route = LevelPilot_Routes.horde_22_30
local steps = route.steps
-- Spieler am Freiwindposten (0.5/0.5). Nah: Sacred Fire (5062, Ql 27, Vorquest 4865 aus der Route),
-- 1 km: Gerenzo (1096, Vorquest 1095 fehlt -> nie). Alles andere im Pool weit weg (> 20 km).
local NEAR = { [5062] = { 0.505, 0.5, 0.52, 0.5, 0.5, 0.505 }, [1096] = { 0.51, 0.5, 0.51, 0.51, 0.51, 0.5 },
  [5881] = { 0.52, 0.5, 0.53, 0.5, 0.56, 0.5 } }
local K = { accept = 1, complete = 3, turnin = 5 }
R.StepTarget = function(s)
  local n = s.q and NEAR[s.q]
  if n then local k = K[s.t] or 1 return { map = 9999, x = n[k], y = n[k + 1] } end
  if s.pool then return { map = 9999, x = 0.02 + (s.q % 97) / 400, y = 0.95 } end
  return { map = 9999, x = 0.1, y = 0.1 }
end
for _, s in ipairs(steps) do if s.q then DONE[s.q] = true end end      -- Route bis hier komplett (inkl. 4865)
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
function UnitXP() return 27000 end
function UnitXPMax() return 38900 end
local plan = { k = "accept:1110" }
local h = R.Plan(route, 27, {}, plan, 6, nil)
local s = steps[h]
print(string.format("level 27: hero %s pool=%s detour %s auto=%s", R.StepKey(s), tostring(s.pool), tostring(R.info.detour), tostring(R.info.detourAuto)))
print("wants5062 " .. tostring(R.Wants(route, 5062, plan.i)))
-- angenommen -> Ziel = Erledigen, dann fertig -> Abgabe, dann abgegeben -> naechste Extra-Quest (5881, Lieferung)
LOG[5062] = true R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
h = R.Plan(route, 27, {}, plan, 6, nil) local a = R.StepKey(steps[h])
READY[5062] = true
h = R.Plan(route, 27, {}, plan, 6, nil) local b = R.StepKey(steps[h])
LOG[5062], READY[5062], DONE[5062] = nil, nil, true R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
Tm, CLOCK = Tm + 30, CLOCK + 30
h = R.Plan(route, 27, {}, plan, 6, nil)
print(string.format("steps: %s %s | next %s", a, b, R.StepKey(steps[h])))
-- Gegner zu stark: Pool-Quest mit Gegnern ueber Stufe +1 nie (Stufe 25 -> nur bis 26)
local over = 0
for _, e in ipairs(LevelPilot_Pool.Horde) do
  if (e.ml or 0) > 26 or e.ql > 26 then NEAR[e.q] = NEAR[e.q] or { 0.501, 0.5, 0.502, 0.5, 0.503, 0.5 } end
end
DONE[5062] = nil DONE[5881] = nil
local b2 = R.PoolBest(R.QuestIndex(route), 25, 26)
if b2 then local e for _, x in ipairs(LevelPilot_Pool.Horde) do if x.q == b2.q then e = x end end
  if (e.ml or 0) > 26 or e.ql > 26 then over = 1 end end
print("level 25 best " .. tostring(b2 and b2.q) .. " too hard " .. over)
