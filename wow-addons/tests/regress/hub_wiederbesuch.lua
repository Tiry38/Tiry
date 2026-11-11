-- Real route horde_22_30, geography as in tests/playthrough.lua (revisited hubs share one place).
-- Play the plan until the pointer is on step 66 (complete 1069 "Deepmoss Spider Eggs", Stonetalon, seg 3).
-- Then the player leaves Stonetalon, flies back to Camp Taurajo (seg 4) and accepts the seg-4 quests 874 + 846.
-- Expected: plan jumps to seg 4 (hero far away, later quests accepted right here).
local ROUTE, DROP1069 = arg[1] or "Route.lua", arg[2] == "drop1069"
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
dofile(ROUTE) dofile("Routes/Horde_30_40.lua")
local R = LP_Route
local route = LevelPilot_Routes.horde_30_40
local steps = route.steps
local HUB, nHub = {}, 0
local function hubPos(seg)
  local sd = route.segs[seg]; local key = sd.z .. "|" .. sd.hub
  if not HUB[key] then nHub = nHub + 1; HUB[key] = { x = 0.1 + ((nHub - 1) % 8) * 0.1, y = 0.1 + math.floor((nHub - 1) / 8) * 0.1 } end
  return HUB[key]
end
local function target(s)
  local h = hubPos(s.seg)
  if s.t == "complete" or s.t == "grind" then
    local a = ((s.q or 7) * 2.399) % (2 * math.pi)
    return { map = 9999, x = h.x + 0.02 * math.cos(a), y = h.y + 0.02 * math.sin(a) }
  end
  local j = ((s.q or s.npc or 3) % 7) * 0.0003
  return { map = 9999, x = h.x + j, y = h.y - j }
end
R.StepTarget = function(s) return target(s) end
local inRoute = {}
for _, s in ipairs(steps) do if s.q then inRoute[s.q] = true end end
for _, s in ipairs(steps) do for _, p in ipairs(s.pre or {}) do if not inRoute[p] then DONE[p] = true end end
  for _, p in ipairs(s.pres or {}) do if not inRoute[p] then DONE[p] = true end end end
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
-- (5.1.5: Route neu geplant -> Schritte ueber Abschnitte gesucht statt fester Nummern)
local f8 = 1 while steps[f8] and steps[f8].seg ~= 8 do f8 = f8 + 1 end
local q4                                 -- eine Quest vom 1. Grom'gol-Besuch (Abschnitt 4), bleibt im Log
for _, s in ipairs(steps) do if s.seg == 4 and s.t == "accept" and s.q then q4 = s.q break end end
local q8                                 -- erste Quest, die man beim 2. Besuch annimmt
for i = f8, #steps do if steps[i].t == "accept" and steps[i].q then q8 = steps[i].q break end end
local lvl, plan, cur = 30, {}, nil
for _ = 1, 400 do
  local hero = R.Plan(route, lvl, {}, plan, 6, cur)
  if not hero or steps[hero].seg >= 5 then break end
  cur = { i = hero, since = GetTime() }
  local s = steps[hero]; local t = target(s); PX, PY = t.x, t.y
  Tm, CLOCK = Tm + 90, CLOCK + 90
  if s.t == "accept" then LOG[s.q] = true R.OnAccepted(s.q)
  elseif s.t == "complete" then READY[s.q] = true
  elseif s.t == "turnin" then LOG[s.q] = nil READY[s.q] = nil DONE[s.q] = true R.OnTurnedIn(s.q)
  elseif s.t == "grind" then lvl = math.max(lvl, s.to or lvl)
  elseif s.t == "fly" then R.OnLanded() end
  if (s.l or 0) > lvl then lvl = s.l end
  R.ScanLog(true)
end
print(ROUTE .. (DROP1069 and "  (control: no old quest kept)" or "") .. ": pointer at", plan.i, plan.k, "| old quest " .. tostring(q4) .. " in log:", (not DROP1069) and true or false)
if not DROP1069 then LOG[q4] = true R.ScanLog(true) end
-- fly back to Camp Taurajo (seg 4) and accept 874 + 846 there
local ct = hubPos(8); PX, PY = ct.x, ct.y; lvl = 39
Tm, CLOCK = Tm + 600, CLOCK + 600
for _, q in ipairs({ q8 }) do LOG[q] = true R.OnAccepted(q) end
R.ScanLog(true)
local jumped
for k = 1, 4 do
  local h, _, info = R.Plan(route, lvl, {}, plan, 6, nil)
  if info.jumped then jumped = info.jumped.to end
  Tm = Tm + 4
end
print(string.format("   after 12 s at Grom'gol (seg 8) with %d accepted: pointer %d (%s), jump %s, into seg 8: %s", q8, plan.i, plan.k, tostring(jumped),
  tostring(jumped ~= nil and jumped >= f8)))
