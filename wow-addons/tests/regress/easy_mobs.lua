-- Tiry 11.11.: "Elixier der Schmerzen" – Berglöwenblut droppen hungernde Löwen (Stufe 23-24) UND Berglöwen (Stufe 32).
-- Der Pfeil nahm den naechsten Fundort, egal welche Stufe -> Tiry kaempfte mit Stufe 28 gegen Stufe-32-Loewen.
-- Erwartet: Pfeil fuehrt zu den schaffbaren (bis Stufe+1), auch wenn die starken naeher sind; ab Stufe 32 sind beide ok;
-- gibt es nur starke Quellen, bleiben die schwaechsten.
local ROUTE = arg[1] or "Route.lua"
local Tm, LVL = 1000, 28
function GetTime() return Tm end function time() return 1700000000 end
function UnitLevel() return LVL end
function UnitFactionGroup() return "Horde", "Horde" end
function CreateVector2D(x, y) return { x = x, y = y } end
C_Map = { GetBestMapForUnit = function() return 1424 end,
  GetPlayerMapPosition = function() return { x = 0.50, y = 0.50 } end,
  GetWorldPosFromMapPos = function(m, v) return 0, { x = v.x * 4000, y = v.y * 2700 } end,
  GetMapInfo = function() return { name = "Vorgebirge von Hillsbrad" } end }
local LOG = { [501] = true }
C_QuestLog = { GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, ReadyForTurnIn = function() return false end,
  IsQuestFlaggedCompleted = function() return false end, GetQuestObjectives = function() return { { type = "item", finished = false } } end,
  GetNumQuestLogEntries = function() return 1, 1 end, GetInfo = function() return nil end, GetTitleForQuestID = function() return nil end }
local NPC = {
  [2384] = { lv = 24, sp = { { 30, 70 }, { 31, 71 }, { 30.5, 70.5 } } },   -- hungernd, Stufe 23-24, weiter weg
  [2406] = { lv = 33, sp = { { 50.5, 50.5 }, { 51, 50 } } },               -- Berglöwe Stufe 32-33, direkt neben dir
  [2407] = { lv = 34, sp = { { 60, 40 } } },
  [2385] = { lv = 28, sp = { { 40, 62 }, { 40.5, 62 } } },                 -- wild, Stufe 27-28: passt genau
}
QuestieLoader = { ImportModule = function(_, n)
  if n == "QuestieDB" then return {
    QueryQuestSingle = function(id, k) if id == 501 and k == "objectives" then return { nil, nil, { { 3496 } } } end
      if id == 509 and k == "objectives" then return { nil, nil, { { 3497 } } } end
      if id == 510 and k == "objectives" then return { nil, nil, { { 3498 } } } end end,
    QueryNPCSingle = function(id, k) local n = NPC[id]; if not n then return end
      if k == "spawns" then return { [267] = n.sp } elseif k == "maxLevel" then return n.lv elseif k == "minLevel" then return n.lv - 1 end end,
    QueryItemSingle = function(id, k) if k == "npcDrops" then return (id == 3496 and { 2406, 2384, 2407, 2385 }) or (id == 3498 and { 2384 }) or { 2406, 2407 } end end,
    QueryObjectSingle = function() end }
  else return { GetUiMapIdByAreaId = function() return 1424 end } end end }
dofile(ROUTE)
local R = LP_Route
local function tgt(q) local t = R.StepTarget({ t = "complete", q = q }) return t end
local t = tgt(501)
print(string.format("St. 28: Ziel %.3f %.3f (wilde Loewen St. 28 bei 0.40/0.62, nicht St. 33 daneben, nicht St. 24) ok %s", t and t.x or -1, t and t.y or -1, tostring(t and t.x > 0.39 and t.x < 0.41)))
t = tgt(510)
print(string.format("nur leichte Quelle: Ziel %.3f (hungernde, St. 24) ok %s", t.x, tostring(t.x < 0.32)))
Tm = Tm + 10 LVL = 33
t = tgt(501)
print(string.format("St. 33: Ziel %.3f %.3f (Berglöwen St. 33 direkt daneben) ok %s", t.x, t.y, tostring(t.x > 0.49 and t.x < 0.52)))
LVL = 20 Tm = Tm + 10
t = tgt(509)
print(string.format("nur starke Quellen (St. 20): Ziel %.3f %.3f (schwaechste = 2406) ok %s", t.x, t.y, tostring(t.x > 0.49 and t.x < 0.52)))
