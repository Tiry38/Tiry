-- Tiry 11.11.: Stufe 27 am Ende von Horde 22-30, naechste Quests (Gehaertete Schalen/Salziges Gift) erst ab 28
-- -> 5.1.0 zeigte "WARTET ab Stufe 28" und Grinden. Erwartet: Aufhol-Quests (fill) kommen dran;
-- mit Stufe 28 sind sie weg und der Plan geht normal weiter. Kontrolle: wer im Plan ist, sieht sie nie.
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

local function play(cap, stopKey)
  local lvl, plan, cur, fillSeen = 22, {}, nil, false
  local SK = {}   -- wie Tiry: "Stufe X vor der Weiterreise" uebersprungen, mit zu niedriger Stufe weitergezogen
  for _ = 1, 600 do
    local hero = R.Plan(route, lvl, SK, plan, 6, cur)
    if not hero then break end
    local s = steps[hero]
    if s.t == "grind" and s.check and (s.to or 0) > cap then SK[R.StepKey(s)] = true; hero = R.Plan(route, lvl, SK, plan, 6, cur); s = steps[hero] end
    if s.fill == 28 then fillSeen = true end   -- Block bis 28 (der Block bis 30 ersetzt den Schluss-Grind fuer alle)
    if plan.k == stopKey and steps[hero].fill then return lvl, plan, hero, fillSeen end
    if R.StepKey(s) == stopKey then return lvl, plan, hero, fillSeen end
    cur = { i = hero, since = GetTime() }
    local t = target(s); PX, PY = t.x, t.y
    Tm, CLOCK = Tm + 90, CLOCK + 90
    if s.t == "accept" then LOG[s.q] = true R.OnAccepted(s.q)
    elseif s.t == "complete" then READY[s.q] = true
    elseif s.t == "turnin" then LOG[s.q] = nil READY[s.q] = nil DONE[s.q] = true R.OnTurnedIn(s.q)
    elseif s.t == "grind" then lvl = math.max(lvl, math.min(s.to or lvl, cap))
    elseif s.t == "fly" then R.OnLanded() end
    if (s.l or 0) > lvl then lvl = math.min(s.l, cap) end
    R.ScanLog(true)
  end
  return lvl, plan, nil, fillSeen
end
XPCUR, XPMAX = 1200, 38900   -- Tirys Anzeige: 3 % von Stufe 27
function UnitXP() return XPCUR end
function UnitXPMax() return XPMAX end
-- 1. hinter dem Plan: nie ueber 27
local lvl, plan, hero = play(27, "accept:4904")
print(string.format("behind: level %d pointer %s hero %s fill=%s", lvl, tostring(plan.k), R.StepKey(steps[hero]), tostring(steps[hero].fill)))
local function openFill(F) local n = 0 for i, s in ipairs(steps) do if s.fill == F and s.t == "accept" and R.state[i] == "open" then n = n + 1 end end return n end
local fi = R.fillInfo[28]
print(string.format("xp 3%%: need %d cover %d rest %d open %d", fi.need, fi.cover, fi.rest, openFill(28)))
XPCUR = 36000 R.Plan(route, 27, {}, plan, 6, nil)
fi = R.fillInfo[28]
print(string.format("xp 93%%: need %d cover %d rest %d open %d", fi.need, fi.cover, fi.rest, openFill(28)))
XPCUR = 1200 R.Plan(route, 27, {}, plan, 6, nil)
-- alle Aufhol-Quests nacheinander abarbeiten
local got = {}
for _ = 1, 40 do
  local h = R.Plan(route, 27, {}, plan, 6, nil)
  local s = steps[h]
  if not s.fill or R.StepKey(s) == "complete:4770" then break end
  got[#got + 1] = R.StepKey(s)
  if s.t == "accept" then LOG[s.q] = true R.OnAccepted(s.q)
  elseif s.t == "complete" then READY[s.q] = true
  elseif s.t == "turnin" then LOG[s.q] = nil READY[s.q] = nil DONE[s.q] = true R.OnTurnedIn(s.q) end
  Tm, CLOCK = Tm + 90, CLOCK + 90
  R.ScanLog(true)
end
print("fill steps done: " .. #got)
-- 1b. Budget nach echtem XP-Stand (vor dem Abarbeiten gemessen in 1.: alle 5; hier: fast voll -> nur 2)
-- 2. Stufe 28 erreicht mitten im Block: Heimweg (4770) ist angenommen und bleibt im Plan
local h28 = R.Plan(route, 28, {}, plan, 6, nil)
local st = R.state or {}
local acc4904
for i, s in ipairs(steps) do if s.t == "accept" and s.q == 4904 then acc4904 = st[i] end end
print(string.format("level 28: hero %s | in-log fill 4770 complete open=%s", R.StepKey(steps[h28]), tostring((function()
  for i, s in ipairs(steps) do if s.t == "complete" and s.q == 4770 then return st[i] == "open" end end end)())))
-- 3. Kontrolle: im Plan (Stufe laeuft mit) -> Aufhol-Quests nie Ziel
for k in pairs(LOG) do LOG[k] = nil end for k in pairs(READY) do READY[k] = nil end for k in pairs(DONE) do DONE[k] = nil end
for _, s in ipairs(steps) do for _, p in ipairs(s.pre or {}) do if not inRoute[p] then DONE[p] = true end end
  for _, p in ipairs(s.pres or {}) do if not inRoute[p] then DONE[p] = true end end end
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
local _, _, _, seen = play(99, "END")
print("on plan: fill seen=" .. tostring(seen))
