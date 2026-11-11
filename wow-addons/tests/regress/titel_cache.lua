-- uniqueTitle cache: R.Plan runs at login (saved pointer) before Questie is ready -> title cached without the
-- duplicate-name check -> after Questie is ready, a chain part with the same title still counts as "in the log".
local ROUTE = arg[1] or "Route.lua"
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
function UnitClass() return "Schamane", "SHAMAN", 7 end
bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
C_Map = { GetBestMapForUnit = function() return 1424 end, GetPlayerMapPosition = function() return { x = 0.5, y = 0.5 } end,
  GetMapWorldSize = function() return 3000, 2000 end, GetMapInfo = function() return { parentMapID = 0 } end,
  GetWorldPosFromMapPos = function(m, v) return 1, v end, GetMapPosFromWorldPos = function(c, v, m) return m, v end }
CreateVector2D = function(x, y) return { x = x, y = y } end
-- Questlog: only 527 "Battle of Hillsbrad" part 1 (German client title). Chain parts 528/529/532/539 share the title.
local LOG = {}
local TITLE = "Schlacht (Testtitel, alle Kettenteile gleich)"
local HILL = { [527] = true, [528] = true, [529] = true, [532] = true, [539] = true }
C_QuestLog = {
  GetQuestsOnMap = function() return {} end,
  GetTitleForQuestID = function(id) if HILL[id] then return TITLE end return "Quest " .. id end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end,
  GetNumQuestLogEntries = function() local n = LOG[527] and 1 or 0 return n, n end,
  GetInfo = function(i) if i == 1 and LOG[527] then return { questID = 527, title = TITLE, isHeader = false } end end,
  GetQuestObjectives = function() return {} end, ReadyForTurnIn = function() return false end,
  IsQuestFlaggedCompleted = function() return false end }
-- Questie: loading at login (isReady = false), ready a few seconds later
Questie = { API = { isReady = false } }
QuestieLoader = { ImportModule = function(_, n)
  if n == "QuestieDB" then return {
    QueryQuestSingle = function(id, k)
      if k == "name" then return HILL[id] and "Battle of Hillsbrad" or ("Q" .. id) end
      if k == "startedBy" or k == "finishedBy" then return { { 2216 } } end
    end,
    QueryNPCSingle = function(id, k) if k == "spawns" then return { [267] = { { 62, 20 } } } end end } end
  return { GetUiMapIdByAreaId = function() return 1424 end }
end }
dofile(ROUTE) dofile("Routes/Horde_22_30.lua")
local R = LP_Route
local route = LevelPilot_Routes.horde_22_30
local function idx(t, q) for i, s in ipairs(route.steps) do if s.t == t and s.q == q then return i end end end
R.mem = { acc = {}, done = {}, at = {} }
R.ScanLog(true)
-- saved pointer from the last session (no entry wait): accept 527 is next in the plan
local plan = { k = "accept:527", i = idx("accept", 527) }
R.Plan(route, 26, {}, plan, 6, nil)                 -- login tick, Questie not ready yet (527 not in the log yet)
print("  after login tick: pointer at", plan.i, plan.k)
Questie.API.isReady = true                           -- Questie finished loading a few seconds later
Tm = Tm + 5
R.Plan(route, 26, {}, plan, 6, nil)
-- ... later the player accepts part 1 of the chain
LOG[527] = true R.OnAccepted(527) R.ScanLog(true)
Tm = Tm + 60
local hero = R.Plan(route, 26, {}, plan, 6, nil)
print(ROUTE .. ":")
print("  inLog(528) [chain part 2, NOT in the log] =", R.InLog(528))
print(string.format("  complete 527 (step %d) state = %s, turnin 527 (step %d) state = %s, accept 528 (step %d) state = %s",
  idx("complete", 527), R.state[idx("complete", 527)], idx("turnin", 527), R.state[idx("turnin", 527)], idx("accept", 528), R.state[idx("accept", 528)]))
print("  pointer/hero now at step", plan.i, route.steps[plan.i] and R.StepKey(route.steps[plan.i]), "hero", hero and R.StepKey(route.steps[hero]))
