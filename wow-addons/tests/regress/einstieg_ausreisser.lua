-- Einstieg ("log"-Regel) mit Ausreisser: Stufe 22, zwei Quests aus Abschnitt 2 und eine weit voraus (Stufe 27).
-- Der Ausreisser darf den Einstieg nicht nach vorn ziehen (sonst waeren 170 Schritte "verpasst").
local ROUTE = arg[1] or "Route.lua"
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
function UnitClass() return "Klasse", "X", 7 end
function UnitOnTaxi() return false end
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
dofile(ROUTE) dofile("Routes/Horde_22_30.lua")
local R = LP_Route
local route = LevelPilot_Routes.horde_22_30
local steps = route.steps
local HUB = {}
local function hubPos(seg) local sd = route.segs[seg]; local key = sd.z .. "|" .. sd.hub
  if not HUB[key] then local n = 0 for _ in pairs(HUB) do n = n + 1 end HUB[key] = { x = 0.1 + (n % 8) * 0.1, y = 0.1 } end return HUB[key] end
for s = 1, #route.segs do hubPos(s) end
R.StepTarget = function(s) local h = hubPos(s.seg) if s.t == "complete" then return { map = 9999, x = h.x + 0.02, y = h.y + 0.02 } end return { map = 9999, x = h.x, y = h.y } end
-- Stufe 22 im Brachland (Abschnitt 2): 878 + 882 von dort im Log, dazu 4821 (Tausend Nadeln, Stufe 27) frueh mitgenommen
for i = 1, 3 do local s = steps[i] if s.q and s.t == "turnin" then DONE[s.q] = true end end
LOG[878], LOG[882], LOG[4821] = true, true, true
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
local h2 = hubPos(2); PX, PY = h2.x, h2.y + 0.03     -- 900 yd vor Camp Taurajo, im Feld
local plan = {}
local hero, _, info = R.Plan(route, 22, {}, plan, 6, nil)
print(string.format("%s: entry '%s' -> pointer %d (%s, seg %d), hero %s", ROUTE, tostring(info.entry), plan.i, plan.k, steps[plan.i].seg, hero and (R.StepKey(steps[hero]) .. " seg " .. steps[hero].seg) or "-"))
