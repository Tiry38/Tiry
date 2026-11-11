-- Plan pointer on an accept step of an item-started quest (Questie startedBy = {nil, nil, {item}} -> no coordinates).
-- The player never looted the item and moved on to the next hub, accepted quests there (evidence).
local ROUTE = arg[1] or "Route.lua"
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
function UnitClass() return "Schamane", "SHAMAN", 7 end
function UnitOnTaxi() return false end
bit = { band = function(a, b) return 1 end }
local PX, PY = 0.20, 0.20
C_Map = { GetBestMapForUnit = function() return 1440 end, GetPlayerMapPosition = function() return { x = PX, y = PY } end,
  GetMapWorldSize = function() return 3000, 2000 end, GetMapInfo = function() return { parentMapID = 0 } end,
  GetWorldPosFromMapPos = function(m, v) return 1, v end, GetMapPosFromWorldPos = function(c, v, m) return m, v end }
CreateVector2D = function(x, y) return { x = x, y = y } end
local LOG, READY, DONE = {}, {}, {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function(id) return "Q" .. id end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, GetInfo = function() return nil end,
  GetNumQuestLogEntries = function() return 0, 0 end, GetQuestObjectives = function() return {} end,
  ReadyForTurnIn = function(id) return READY[id] or false end, IsQuestFlaggedCompleted = function(id) return DONE[id] or false end }
-- hub A at (20,20), hub B at (80,80) (~2000 yd apart). Quest 885: started by an ITEM (like "Washte Pawne").
local NPC = { [701] = { 20, 20 }, [702] = { 80, 80 }, [801] = { 25, 30 }, [802] = { 85, 75 } }
local START = { [101] = { { 701 } }, [885] = { nil, nil, { 5103 } }, [201] = { { 702 } }, [202] = { { 702 } } }
local FIN = { [101] = { { 701 } }, [885] = { { 701 } }, [201] = { { 702 } }, [202] = { { 702 } } }
local OBJ = { [101] = 801, [885] = 801, [201] = 802, [202] = 802 }
QuestieLoader = { ImportModule = function(_, n)
  if n == "QuestieDB" then return {
    QueryQuestSingle = function(id, k)
      if k == "startedBy" then return START[id] end
      if k == "finishedBy" then return FIN[id] end
      if k == "name" then return "Q" .. id end
      if k == "objectives" then return OBJ[id] and { { { OBJ[id] } } } or {} end
    end,
    QueryNPCSingle = function(id, k) if k == "spawns" then local p = NPC[id]; return p and { [331] = { p } } or nil end end } end
  return { GetUiMapIdByAreaId = function() return 1440 end }
end }
dofile(ROUTE)
local R = LP_Route
local function S(t, q, seg) return { t = t, q = q, seg = seg, l = 22, ql = 22, z = "X", n = "Q" .. q } end
local route = { name = "T", faction = "Horde", min = 1, max = 99, steps = {
  S("accept", 101, 1), S("complete", 101, 1), S("turnin", 101, 1),
  S("accept", 885, 1), S("complete", 885, 1), S("turnin", 885, 1),        -- item-started quest
  S("accept", 201, 2), S("accept", 202, 2), S("complete", 201, 2), S("complete", 202, 2), S("turnin", 201, 2), S("turnin", 202, 2) } }
R.mem = { acc = {}, done = {}, at = {} }
DONE[101] = true
R.ScanLog(true)
local plan = { k = "accept:885", i = 4, since = CLOCK - 600 }
-- player is at hub B and accepted both hub-B quests
PX, PY = 0.80, 0.80
LOG[201], LOG[202] = true, true R.ScanLog(true)
print(ROUTE .. ":  hero target of accept:885 =", tostring(R.StepTarget(route.steps[4])))
for t = 1, 3 do
  local h, _, info = R.Plan(route, 22, {}, plan, 6, nil)
  print(string.format("  t=%d s: pointer %d (%s), hero %s, jumped %s", (t - 1) * 4, plan.i, plan.k, tostring(h), tostring(info.jumped and info.jumped.to)))
  Tm = Tm + 4
end
