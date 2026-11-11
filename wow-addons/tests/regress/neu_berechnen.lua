-- Tiry 11.11.: Menue "Neu berechnen" – lohnt gerade eine andere Quest mehr (Weg + Arbeit)?
-- Nie schwerer als das Plan-Ziel (Tiry: "nicht schwerer nur weil sie naeher ist"), keine Elite.
local ROUTE = arg[1] or "Route.lua"
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
function UnitClass() return "Klasse", "X", 7 end
function UnitOnTaxi() return false end
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
dofile(ROUTE)
local R = LP_Route
-- Plan-Ziel 101 weit weg (6000 yd); 102 gleich schwer und nah; 103 naeher, aber schwerer; 104 Elite direkt daneben
local POS = { [101] = { 0.70, 0.5 }, [102] = { 0.51, 0.5 }, [103] = { 0.505, 0.5 }, [104] = { 0.502, 0.5 } }
local function S(t, q, ex) local s = { t = t, q = q, seg = 1, l = 26, z = "Testgebiet", rl = 20, ql = 26 } for k, v in pairs(ex or {}) do s[k] = v end return s end
local steps = {
  S("accept", 101, { xp = 2000, wm = 3 }), S("complete", 101), S("turnin", 101),
  S("accept", 102, { xp = 2500, wm = 3 }), S("complete", 102), S("turnin", 102),
  S("accept", 103, { xp = 6000, wm = 3, ql = 29, rl = 24 }), S("complete", 103), S("turnin", 103),
  S("accept", 104, { xp = 9000, wm = 3, hard = 1 }), S("complete", 104), S("turnin", 104),
}
local route = { key = "test", steps = steps, segs = { { z = "Testgebiet", hub = "Mitte" } } }
R.StepTarget = function(s) local p = POS[s.q] return p and { map = 9999, x = p[1], y = p[2] } end
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
local plan = {}
local h = R.Plan(route, 26, {}, plan, 6, nil)
print("plan hero " .. R.StepKey(steps[h]))
local r = R.Rethink(route, 26, plan, {})
print(string.format("rethink: switched=%s best=%s refQl=%d", tostring(r.switched), tostring(r.best and r.best.q), r.refQl))
h = R.Plan(route, 26, {}, plan, 6, nil)
print("after: hero " .. R.StepKey(steps[h]) .. " detour " .. tostring(R.info.detour) .. " wants102 " .. tostring(R.Wants(route, 102, plan.i)))
-- Abstecher abarbeiten: annehmen -> erledigen -> abgeben, dann zurueck zum Plan
LOG[102] = true R.OnAccepted(102) R.ScanLog(true)
h = R.Plan(route, 26, {}, plan, 6, nil) local k1 = R.StepKey(steps[h])
READY[102] = true R.ScanLog(true)
h = R.Plan(route, 26, {}, plan, 6, nil) local k2 = R.StepKey(steps[h])
LOG[102] = nil READY[102] = nil DONE[102] = true R.OnTurnedIn(102) R.ScanLog(true)
h = R.Plan(route, 26, {}, plan, 6, nil)
print("detour steps: " .. k1 .. " " .. k2 .. " | back to plan: " .. R.StepKey(steps[h]) .. " detour " .. tostring(plan.detour))
-- Nichts lohnt mehr: Spieler steht beim Plan-Ziel -> Plan bleibt
PX = 0.70
r = R.Rethink(route, 26, plan, {})
print(string.format("at plan target: switched=%s", tostring(r.switched)))
