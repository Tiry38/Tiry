---------------------------------------------------------------------------
-- LevelPilot · Routen-Engine 4
-- Waehlt die Route passend zu Fraktion + Level, ueberspringt Erledigtes und
-- Unpassendes, waehlt live den sinnvollsten naechsten Schritt (mit Hysterese)
-- und liefert Zielpunkte: Questgeber/Abgabe (Questie), Questziele = naechste
-- Gegner-/Objekt-Gruppe aus Questie, sonst Blizzards Questbereich.
---------------------------------------------------------------------------
LevelPilot_Routes = LevelPilot_Routes or {}
LP_Route = {}
local R = LP_Route
local QL = C_QuestLog

local TYPE = {
  accept = "Annehmen", complete = "Erledigen", turnin = "Abgeben", fly = "Fliegen nach",
  hearth = "Ruhestein nach", train = "Trainer", go = "Gehe zu", grind = "Grinden bis Stufe", note = "Hinweis",
}
R.TYPE = TYPE

---------------------------------------------------------------------------
-- Questie (nur lesen, alles abgesichert)
---------------------------------------------------------------------------
local QDB, ZDB
local function questie()
  if QDB then return QDB end
  if Questie and Questie.API and Questie.API.isReady == false then return nil end
  pcall(function()
    if QuestieLoader and QuestieLoader.ImportModule then
      local q = QuestieLoader:ImportModule("QuestieDB")
      local z = QuestieLoader:ImportModule("ZoneDB")
      if q and type(q.QueryQuestSingle) == "function" and type(q.QueryNPCSingle) == "function" then QDB = q end
      if z and type(z.GetUiMapIdByAreaId) == "function" then ZDB = z end
    end
  end)
  return QDB
end
function R.ResetQuestie() QDB = nil end
function R.HasQuestie() return questie() ~= nil and ZDB ~= nil end

local function qQuery(id, key)
  local db = questie(); if not db then return end
  local ok, v = pcall(function()
    if db.QueryQuestSingle then return db.QueryQuestSingle(id, key) end
    if db.QueryQuest then local t = db.QueryQuest(id, { key }); return t and t[1] end
  end)
  if ok then return v end
end
local function nQuery(id, key)
  local db = questie(); if not db then return end
  local ok, v = pcall(function() if db.QueryNPCSingle then return db.QueryNPCSingle(id, key) end end)
  if ok then return v end
end
local function oQuery(id, key)
  local db = questie(); if not db then return end
  local ok, v = pcall(function() if db.QueryObjectSingle then return db.QueryObjectSingle(id, key) end end)
  if ok then return v end
end
local function iQuery(id, key)
  local db = questie(); if not db then return end
  local ok, v = pcall(function() if db.QueryItemSingle then return db.QueryItemSingle(id, key) end end)
  if ok then return v end
end
local function uiMapOf(areaId)
  if not ZDB then return end
  local ok, m = pcall(function() if ZDB.GetUiMapIdByAreaId then return ZDB:GetUiMapIdByAreaId(areaId) end end)
  if ok then return m end
end
R.QQuery = qQuery

-- alle Spawn-Punkte eines NPCs/Objekts als {map,x,y} (0..1); gepuffert, sobald Questie liefert
local spawnCache = {}
local function spawnsOf(kind, id)
  if not id then return {} end
  local ck = kind .. id
  if spawnCache[ck] then return spawnCache[ck] end
  local sp = (kind == "npc") and nQuery(id, "spawns") or oQuery(id, "spawns")
  local out = {}
  if type(sp) ~= "table" then return out end
  for areaId, list in pairs(sp) do
    local map = uiMapOf(areaId)
    if map and type(list) == "table" then
      for _, c in ipairs(list) do
        if type(c) == "table" and c[1] and c[2] and c[1] >= 0 then
          out[#out + 1] = { map = map, x = c[1] / 100, y = c[2] / 100, npc = (kind == "npc") and id or nil }
        end
      end
    end
  end
  if #out > 0 then spawnCache[ck] = out end
  return out
end

-- Questgeber / Abgabe einer Quest (Punkte tragen die NPC-ID)
local qpCache = {}
local function questPoints(qid, which)
  local ck = which .. qid
  if qpCache[ck] then return qpCache[ck] end
  local by = qQuery(qid, which) -- {npcIds, objectIds, itemIds}
  local pts = {}
  if type(by) ~= "table" then return pts end
  if type(by[1]) == "table" then for _, id in ipairs(by[1]) do for _, p in ipairs(spawnsOf("npc", id)) do pts[#pts + 1] = p end end end
  if type(by[2]) == "table" then for _, id in ipairs(by[2]) do for _, p in ipairs(spawnsOf("obj", id)) do pts[#pts + 1] = p end end end
  if #pts > 0 then qpCache[ck] = pts end
  return pts
end

function R.NpcName(id)
  local n = nQuery(id, "name")
  return type(n) == "string" and n or nil
end

---------------------------------------------------------------------------
-- Geometrie
---------------------------------------------------------------------------
local function vec(x, y) if CreateVector2D then return CreateVector2D(x, y) end return { x = x, y = y } end
local function xy(v) if not v then return end if v.GetXY then return v:GetXY() end return v.x, v.y end

function R.PlayerMapPos()
  local okM, map = pcall(C_Map.GetBestMapForUnit, "player")
  if not okM or not map then return end
  local okP, p = pcall(C_Map.GetPlayerMapPosition, map, "player")
  if not okP or not p then return map end
  local x, y = xy(p)
  return map, x, y
end

local sizeCache = {}
local function mapSize(map)
  local c = sizeCache[map]
  if c then return c[1], c[2] end
  local ok, w, h = pcall(C_Map.GetMapWorldSize, map)
  if ok and w and w > 0 and h and h > 0 then sizeCache[map] = { w, h }; return w, h end
end
R.MapSize = mapSize

-- liefert east, north (Yards) vom Spieler zum Ziel, oder nil
function R.Offset(t)
  if not t or not t.map then return end
  local pmap, px, py = R.PlayerMapPos()
  if not (pmap and px) then return end
  local tx, ty
  if t.map == pmap then
    tx, ty = t.x, t.y
  else
    local ok = pcall(function()
      local cont, wpos = C_Map.GetWorldPosFromMapPos(t.map, vec(t.x, t.y))
      local _, mpos = C_Map.GetMapPosFromWorldPos(cont, wpos, pmap)
      tx, ty = xy(mpos)
    end)
    if not ok or not tx then return end
  end
  local w, h = mapSize(pmap)
  if not w then return end
  return (tx - px) * w, -(ty - py) * h
end

local function distTo(p)
  local e, n = R.Offset(p)
  if e then return math.sqrt(e * e + n * n) end
end
R.Dist = distTo

-- Abstand zweier Ziele (Yards), ueber die Spieler-Versaetze
function R.Between(a, b)
  local ea, na = R.Offset(a); local eb, nb = R.Offset(b)
  if ea and eb then return math.sqrt((ea - eb) ^ 2 + (na - nb) ^ 2) end
end

-- naechster Punkt; gleiche Karte rein rechnerisch, andere Karten nur stichprobenartig umrechnen
local function nearestFast(pts)
  if not pts or #pts == 0 then return nil end
  local pmap, px, py = R.PlayerMapPos()
  if not px then return pts[1] end
  local w, h = mapSize(pmap)
  local best, bd
  if w then
    for _, p in ipairs(pts) do
      if p.map == pmap then
        local dx, dy = (p.x - px) * w, (p.y - py) * h
        local d = dx * dx + dy * dy
        if not bd or d < bd then best, bd = p, d end
      end
    end
  end
  if best then return best, math.sqrt(bd) end
  local stepN = math.max(1, math.floor(#pts / 40))
  for i = 1, #pts, stepN do
    local d = distTo(pts[i])
    if d and (not bd or d < bd) then best, bd = pts[i], d end
  end
  return best or pts[1], bd
end
R.Nearest = nearestFast

---------------------------------------------------------------------------
-- Status (mit Zwischenspeicher pro Durchlauf)
---------------------------------------------------------------------------
R.mem = { acc = {}, done = {} }        -- wird aus LevelPilot mit dem gespeicherten Gedaechtnis ersetzt
local LOGC = { ids = {}, titles = {} }
local MEMO = { f = {}, l = {}, r = {} }
local function memoReset() MEMO.f, MEMO.l, MEMO.r = {}, {}, {} end
R.Invalidate = memoReset

local expandedOnce = false
-- trusted = nach QUEST_LOG_UPDATE (Log ist geladen); dann darf das Gedaechtnis abgeglichen werden
function R.ScanLog(trusted)
  if not expandedOnce then
    expandedOnce = true
    pcall(function() if ExpandQuestHeader then ExpandQuestHeader(0) end end)
  end
  local ids, titles, numQuests = {}, {}, nil
  pcall(function()
    local n, nq = QL.GetNumQuestLogEntries()
    numQuests = nq
    for i = 1, (type(n) == "number" and n or 0) do
      local info = QL.GetInfo(i)
      if info and not info.isHeader then
        if info.questID then ids[info.questID] = true end
        if info.title then titles[info.title] = true end
      end
    end
  end)
  pcall(function()
    if GetNumQuestLogEntries and GetQuestLogTitle then
      local n, nq = GetNumQuestLogEntries()
      numQuests = numQuests or nq
      for i = 1, (n or 0) do
        local title, _, _, isHeader, _, _, _, qid = GetQuestLogTitle(i)
        if title and not isHeader then titles[title] = true; if qid then ids[qid] = true end end
      end
    end
  end)
  local found = 0
  for _ in pairs(ids) do found = found + 1 end
  LOGC.ids, LOGC.titles = ids, titles
  -- Liste vollstaendig gelesen? Dann ist das Log die Wahrheit (abgebrochene Quests fallen raus)
  if trusted and type(numQuests) == "number" and found >= numQuests then
    for q in pairs(R.mem.acc) do if not ids[q] then R.mem.acc[q] = nil end end
  end
  for q in pairs(ids) do R.mem.acc[q] = true end
  memoReset()
end
function R.OnAccepted(q) if q then R.mem.acc[q] = true; R.mem.done[q] = nil; memoReset() end end
function R.OnTurnedIn(q) if q then R.mem.done[q] = true; R.mem.acc[q] = nil; memoReset() end end
function R.OnRemoved(q)
  if q and not LOGC.ids[q] then R.mem.acc[q] = nil end
  memoReset()
end

-- Questnamen, die in der Route mehrfach vorkommen (Kettenteile), nie per Name abgleichen
local dupName
local function uniqueTitle(q)
  if not dupName then
    dupName = {}
    local seen = {}
    for _, r in pairs(LevelPilot_Routes or {}) do
      for _, st in ipairs(r.steps or {}) do
        if st.q and st.n then
          if seen[st.n] and seen[st.n] ~= st.q then dupName[st.n] = true end
          seen[st.n] = seen[st.n] or st.q
        end
      end
    end
  end
  local t
  pcall(function() t = QL.GetTitleForQuestID(q) end)
  local en = qQuery(q, "name")
  if en and dupName[en] then return nil end
  return t
end

local function flagged(q)
  local m = MEMO.f[q]; if m ~= nil then return m end
  local r = R.mem.done[q] and true or false
  if not r then
    local ok, v = pcall(function()
      if QL.IsQuestFlaggedCompleted then return QL.IsQuestFlaggedCompleted(q) end
      return IsQuestFlaggedCompleted and IsQuestFlaggedCompleted(q)
    end)
    r = (ok and v) and true or false
  end
  MEMO.f[q] = r
  return r
end
local function inLog(q)
  local m = MEMO.l[q]; if m ~= nil then return m end
  local r = (R.mem.acc[q] or LOGC.ids[q]) and true or false
  if not r then
    local ok, idx = pcall(QL.GetLogIndexForQuestID, q)
    r = ok and type(idx) == "number" and idx > 0
  end
  if not r then
    local okO, on = pcall(function() return QL.IsOnQuest and QL.IsOnQuest(q) end)
    r = (okO and on) and true or false
  end
  if not r then
    local t = uniqueTitle(q)
    r = (t and LOGC.titles[t]) and true or false
  end
  MEMO.l[q] = r
  return r
end
local function ready(q)
  local m = MEMO.r[q]; if m ~= nil then return m end
  local ok, v = pcall(function()
    return (QL.ReadyForTurnIn and QL.ReadyForTurnIn(q)) or (QL.IsComplete and QL.IsComplete(q))
  end)
  local r = (ok and v) and true or false
  MEMO.r[q] = r
  return r
end
R.InLog, R.Ready, R.Flagged = inLog, ready, flagged

local STATE = { hearthAt = 0, landedAt = 0 }
function R.OnHearth() STATE.hearthAt = GetTime() end
function R.OnLanded() STATE.landedAt = GetTime() end

-- Quest grau? Classic-Quest-XP: volle XP bis 5 Stufen unter dir, dann 80/60/40/20/10 %
R.maxDiff = 5
R.maxAbove = 3
R.EXTRA_YD = 1800   -- Quest aus dem Log mitnehmen, wenn der echte Laufweg hoechstens so lang ist ...
R.EXTRA_PEN = 120   -- ... mit diesem Aufschlag gegenueber der Routen-Reihenfolge (Yards)
R.ahead = 2         -- Annehmen ueberspringen, wenn du 2+ Stufen ueber der Planung bist UND die Route dort schon weiter ist
local function greyFor(ql, lvl)
  if not ql then return false end
  if R.maxDiff and (lvl - ql) > R.maxDiff then return true end
  local range = 7
  pcall(function() if GetQuestGreenRange then range = GetQuestGreenRange() or range end end)
  return ql < lvl - range
end
R.Grey = greyFor

local function chainDone(s)
  if s.nxt then
    for _, n in ipairs(s.nxt) do if flagged(n) or inLog(n) then return true end end
  end
  return false
end

-- stabiler Schluessel je Schritt (bleibt gleich, auch wenn die Route neu erzeugt wird)
function R.StepKey(s)
  if s.q then return s.t .. ":" .. s.q end
  return s.t .. ":" .. tostring(s.npc or s.to or "") .. ":" .. tostring(s.l or "") .. ":" .. tostring(s.z or "")
end

-- true = erledigt, "skip" = passt nicht, "later" = Stufe zu niedrig
R.speed = true
function R.StepDone(s, lvl, cur)
  if s.q and R.ban and R.ban[s.q] then return "skip" end
  if s.slow and R.speed and not (s.q and inLog(s.q)) then return "skip" end
  if s.q and chainDone(s) then return true end
  if s.cls then
    local _, _, cid = UnitClass("player")
    if cid and bit and bit.band(s.cls, 2 ^ (cid - 1)) == 0 then return "skip" end
  end
  if s.t == "accept" then
    if flagged(s.q) or inLog(s.q) then return true end
    if greyFor(s.ql, lvl) then return "skip" end
    if s.rl and lvl < s.rl then return "later" end
    if s.ql and R.maxAbove and s.ql > lvl + R.maxAbove then return "later" end
    if s.alt then for _, a in ipairs(s.alt) do if flagged(a) or inLog(a) then return true end end end
    if s.pre then for _, p in ipairs(s.pre) do if not flagged(p) then return "skip" end end end
    if s.pres then
      local any = false
      for _, p in ipairs(s.pres) do if flagged(p) then any = true; break end end
      if not any then return "skip" end
    end
    return false
  elseif s.t == "complete" then
    if flagged(s.q) or ready(s.q) then return true end
    if not inLog(s.q) then return "skip" end
    return false
  elseif s.t == "turnin" then
    if flagged(s.q) then return true end
    if not inLog(s.q) then return "skip" end
    return false
  elseif s.t == "grind" then
    return lvl >= (s.to or 0)
  elseif s.t == "hearth" then
    return cur and STATE.hearthAt > (cur.since or 0)
  end
  -- Ortsschritte: erledigt, wenn angekommen (Radius grosszuegig: Hub = Ort, nicht Zentimeter)
  if s.t == "go" or s.t == "train" or s.t == "fly" then
    local tgt = R.StepTarget(s)
    local d = tgt and distTo(tgt)
    if d and d < (s.r or 45) then return true end
    if s.t == "fly" and cur and STATE.landedAt > (cur.since or 0) and d and d < 400 then return true end
  end
  return false
end

---------------------------------------------------------------------------
-- Zielpunkte
---------------------------------------------------------------------------
-- Blizzards Questbereich (Questbereich auf der Karte)
local function blizzPOI(q)
  local pmap = R.PlayerMapPos()
  local hit
  pcall(function()
    for _, e in ipairs(QL.GetQuestsOnMap(pmap) or {}) do
      if e.questID == q then hit = { map = pmap, x = e.x, y = e.y } end
    end
  end)
  if hit then return hit end
  pcall(function()
    if QL.GetNextWaypoint then
      local m, x, y = QL.GetNextWaypoint(q)
      if m and x then hit = { map = m, x = x, y = y } end
    end
  end)
  return hit
end

-- Questziele aus Questie nach Art getrennt (Gegner / Objekte / Items / Orte)
local objCache = {}
local function addPts(dst, src, cap)
  for _, p in ipairs(src) do
    if #dst >= cap then return end
    dst[#dst + 1] = p
  end
end
local function objectiveGroups(q)
  if objCache[q] then return objCache[q] end
  local G = { monster = {}, object = {}, item = {}, event = {} }
  local ob = qQuery(q, "objectives")
  if type(ob) == "table" then
    for _, o in ipairs(type(ob[1]) == "table" and ob[1] or {}) do
      if type(o) == "table" and o[1] then addPts(G.monster, spawnsOf("npc", o[1]), 600) end
    end
    for _, o in ipairs(type(ob[2]) == "table" and ob[2] or {}) do
      if type(o) == "table" and o[1] then addPts(G.object, spawnsOf("obj", o[1]), 600) end
    end
    for _, o in ipairs(type(ob[3]) == "table" and ob[3] or {}) do
      if type(o) == "table" and o[1] then
        local nd, od = iQuery(o[1], "npcDrops"), iQuery(o[1], "objectDrops")
        for _, n in ipairs(type(nd) == "table" and nd or {}) do addPts(G.item, spawnsOf("npc", n), 600) end
        for _, n in ipairs(type(od) == "table" and od or {}) do addPts(G.item, spawnsOf("obj", n), 600) end
      end
    end
    for _, o in ipairs(type(ob[5]) == "table" and ob[5] or {}) do
      if type(o) == "table" and type(o[1]) == "table" then
        for _, n in ipairs(o[1]) do addPts(G.monster, spawnsOf("npc", n), 600) end
      end
    end
  end
  local te = qQuery(q, "triggerEnd")
  if type(te) == "table" and type(te[2]) == "table" then
    for areaId, list in pairs(te[2]) do
      local map = uiMapOf(areaId)
      if map and type(list) == "table" then
        for _, c in ipairs(list) do
          if type(c) == "table" and c[1] and c[1] >= 0 then G.event[#G.event + 1] = { map = map, x = c[1] / 100, y = c[2] / 100 } end
        end
      end
    end
  end
  local any = #G.monster + #G.object + #G.item + #G.event > 0
  if any then objCache[q] = G end
  return G
end

-- welche Ziel-Arten sind noch offen? (Blizzard)
local function openTypes(q)
  local open, n = {}, 0
  pcall(function()
    for _, o in ipairs(QL.GetQuestObjectives(q) or {}) do
      if not o.finished then n = n + 1; open[o.type or "?"] = true end
    end
  end)
  return open, n
end

-- Ziel fuer "Erledigen": Mitte der naechsten Gegner-/Objektgruppe, die noch gebraucht wird
local function objectiveTarget(q)
  local G = objectiveGroups(q)
  local open = openTypes(q)
  local pts, used = {}, false
  for typ in pairs(open) do
    local g = G[typ]
    if g and #g > 0 then used = true; addPts(pts, g, 2400) end
  end
  if not used then for _, g in pairs(G) do addPts(pts, g, 2400) end end
  local poi = blizzPOI(q)
  if #pts == 0 then return poi end
  local best = nearestFast(pts)
  if not best then return poi end
  -- Gruppe um den naechsten Punkt mitteln -> ruhiger Zielpunkt, kein Springen zwischen Einzelspawns
  local w, h = mapSize(best.map)
  if not w then return best end
  local sx, sy, n = 0, 0, 0
  for _, p in ipairs(pts) do
    if p.map == best.map then
      local dx, dy = (p.x - best.x) * w, (p.y - best.y) * h
      if dx * dx + dy * dy < 55 * 55 then sx, sy, n = sx + p.x, sy + p.y, n + 1 end
    end
  end
  if n == 0 then return best end
  return { map = best.map, x = sx / n, y = sy / n, spot = true, count = n }
end

-- Zielpunkt eines Schritts (gepuffert: Questgeber 4 s, Questziele 1.5 s)
local tcache = setmetatable({}, { __mode = "k" })
function R.StepTarget(s)
  if s.map and s.x then return { map = s.map, x = s.x, y = s.y } end
  local now = GetTime()
  local pmap = R.PlayerMapPos()
  local c = tcache[s]
  local ttl = (s.t == "complete") and 1.5 or 4
  if c and now - c.t < ttl and c.pmap == pmap then return c.v end
  local v
  if s.npc then v = nearestFast(spawnsOf("npc", s.npc)) end
  if not v then
    if s.t == "accept" then v = nearestFast(questPoints(s.q, "startedBy"))
    elseif s.t == "turnin" then v = nearestFast(questPoints(s.q, "finishedBy"))
    elseif s.t == "complete" then v = objectiveTarget(s.q) end
  end
  if v then v = { map = v.map, x = v.x, y = v.y, npc = v.npc, spot = v.spot, count = v.count } end
  tcache[s] = { t = now, pmap = pmap, v = v }
  return v
end
function R.StepDist(s)
  local t = R.StepTarget(s)
  return t and distTo(t), t
end

-- Weltpunkt eines Ziels { map, x, y } (Travel.lua) – nil ohne Wegenetz
function R.WorldOf(t)
  if t and t.map and t.x and LP_Walk and LP_Walk.Point then return LP_Walk.Point(t.map, t.x, t.y) end
end

-- Echter Laufweg Spieler -> Schritt in Yards (Wegenetz aus der Spielgeometrie), sonst Luftlinie.
-- Der Spieler ist das stabile Ende: eine Wegsuche reicht fuer alle Schritte der Liste.
-- cap: weiter (Luftlinie) als das -> nur Luftlinie (spart Rechenzeit bei fernen Listenzeilen).
-- Rueckgabe: Yards, Ziel, Luftlinie
function R.StepCost(s, pw, cap)
  local d, t = R.StepDist(s)
  if not d then return nil, t end
  if d < 120 or not LP_Walk or (cap and d > cap) then return d, t, d end
  pw = pw or LP_Walk.Player()
  local tw = R.WorldOf(t)
  if pw and tw then
    local ok, g = pcall(LP_Walk.Ground, pw, tw)   -- Ziel = Quelle der Suche (bleibt gespeichert)
    if ok and g then return math.max(d, g), t, d end
  end
  return d, t, d
end

-- NPC-IDs, die eine Quest vergeben (fuer die Pruefung direkt am NPC)
function R.Givers(q)
  local set = {}
  local by = qQuery(q, "startedBy")
  if type(by) == "table" and type(by[1]) == "table" then for _, id in ipairs(by[1]) do set[id] = true end end
  return set
end

local requested = {}
function R.StepTitle(s)
  if s.q then
    local t
    pcall(function() t = QL.GetTitleForQuestID(s.q) end)
    if (not t or t == "") and not requested[s.q] and QL.RequestLoadQuestByID then
      requested[s.q] = true
      pcall(QL.RequestLoadQuestByID, s.q)
    end
    if not t or t == "" then
      local qn = qQuery(s.q, "name"); if type(qn) == "string" then t = qn end
    end
    return t or s.n or ("Quest " .. s.q)
  end
  return s.n or s.to or ""
end

---------------------------------------------------------------------------
-- Route waehlen + aktuellen Schritt bestimmen
---------------------------------------------------------------------------
function R.Pick(faction, lvl, wanted)
  if wanted and LevelPilot_Routes[wanted] then return wanted end
  local best, bmin
  for key, r in pairs(LevelPilot_Routes) do
    if (not r.faction or r.faction == faction) and lvl >= (r.min or 1) and lvl < (r.max or 99) then
      if not bmin or (r.min or 1) > bmin then best, bmin = key, (r.min or 1) end   -- passendste (hoechster Start)
    end
  end
  if not best then
    -- keine Route fuer diese Stufe: nur eine knapp darunter beginnende nehmen (max. 2 Stufen frueher),
    -- nie eine Route, aus der du rausgewachsen bist (die schickt dich nur zurueck in alte Gebiete)
    local bd
    for key, r in pairs(LevelPilot_Routes) do
      if (not r.faction or r.faction == faction) then
        local d = (r.min or 1) - lvl
        if d > 0 and d <= 2 and (not bd or d < bd) then best, bd = key, d end
      end
    end
  end
  return best
end

-- Index des aktuellen Schritts + Liste der naechsten n
-- skipped: Tabelle StepKey -> true
function R.Current(route, lvl, skipped, n, cur)
  memoReset()
  local steps = route and route.steps or {}
  local state = {}
  for i, s in ipairs(steps) do
    if skipped and skipped[R.StepKey(s)] then state[i] = "skip"
    elseif s.q then
      local d = R.StepDone(s, lvl, (cur and cur.i == i) and cur or nil)
      state[i] = (d == true) and "done" or (d == "skip" and "skip") or (d == "later" and "later") or "open"
    end
  end
  -- Rausgewachsen: Route ist schon weiter (spaeterer Schritt erledigt) und du bist 2+ Stufen ueber der
  -- Planung eines alten Annehmen-Schritts -> nicht zurueckschicken. Nur rueckwaerts: ein Gebiet, in das du
  -- erst kommst, wird nie uebersprungen, auch wenn du ueber Plan bist.
  if R.ahead then
    local progI
    for i = #steps, 1, -1 do
      local s = steps[i]
      if state[i] == "done" and s.q and (s.t == "accept" or s.t == "turnin") then progI = i; break end
    end
    local progL = progI and steps[progI].l
    if progL then
      for i = 1, progI - 1 do
        local s = steps[i]
        if s.t == "accept" and s.l and s.l < progL and lvl >= s.l + R.ahead
           and (state[i] == "open" or state[i] == "later") then state[i] = "skip" end
      end
    end
  end
  -- Reisen/Trainer: nur noetig, wenn im folgenden Abschnitt noch etwas offen ist,
  -- und erledigt, sobald dort schon etwas angenommen/abgegeben wurde (du warst also schon da)
  for i, s in ipairs(steps) do
    if s.t == "grind" and not state[i] then
      -- Grinden/Stufen-Kontrolle: offen nur, solange die Stufe fehlt und vorher nichts mehr offen ist
      state[i] = (lvl >= (s.to or 0)) and "done" or "open"
    end
  end
  for i, s in ipairs(steps) do
    if not s.q and not state[i] then
      local d = R.StepDone(s, lvl, (cur and cur.i == i) and cur or nil)
      if d == true then state[i] = "done"
      else
        local need, been = false, false
        for j = i + 1, math.min(#steps, i + 60) do
          local t = steps[j]
          if not t.q then break end
          if state[j] == "open" or state[j] == "later" then need = true end
          if state[j] == "done" and (t.t == "accept" or t.t == "turnin") then been = true end
        end
        if s.t == "train" then
          need = (s.l and s.l >= lvl - 1) and true or false
          been = false
        end
        state[i] = (been and "done") or (need and "open") or "skip"
      end
    end
  end
  local out, first = {}, nil
  for i = 1, #steps do
    local st = state[i]
    if st == "open" or st == "later" then
      out[#out + 1] = i
      if not first and st == "open" then first = i end
      if #out >= math.max(n or 5, 14) and first then break end
    end
  end
  -- Live-Auswahl: unter den naechsten offenen Schritten den sinnvollsten waehlen.
  -- Echter Laufweg (Wegenetz, nicht Luftlinie) + leichte Strafe je Position (Grundreihenfolge bleibt),
  -- Abgaben nur, wenn fertig.
  local pw = LP_Walk and LP_Walk.Player and LP_Walk.Player() or nil
  local best, bestScore, rank, scores = nil, nil, 0, {}
  local inOut = {}
  for _, i in ipairs(out) do inOut[i] = true end
  -- 1. machbare Kandidaten mit Untergrenze (Luftlinie ist nie laenger als der Laufweg)
  local cands = {}
  for _, i in ipairs(out) do
    if state[i] == "open" then
      local s = steps[i]
      local ok = true
      if s.t == "turnin" and s.q and not (ready(s.q) or flagged(s.q)) then ok = false end
      if s.t == "complete" and s.q and not inLog(s.q) then ok = false end
      if s.t == "grind" and i ~= first then ok = false end     -- erst Quests, dann (falls noetig) grinden
      if ok then
        local d0
        pcall(function() d0 = R.StepDist(s) end)
        local base = rank * 20 - ((s.t == "turnin") and 15 or 0)  -- Abgabe raeumt das Log, schaltet Folgequests frei
        cands[#cands + 1] = { i = i, lb = (d0 or 1e6) + base, base = base, far = not d0 }
        rank = rank + 1                                        -- nur machbare Schritte zaehlen als "Position"
      end
      if rank >= 12 then break end
    end
  end
  -- Mitnehmen: Quests, die schon im Log sind und deren Ziel/Abgabe ganz in der Naehe liegt, auch wenn die
  -- Route sie erst spaeter vorsieht (z. B. am Flugpunkt angenommen). Nur echter Laufweg bis EXTRA_YD.
  local extras = {}
  if pw and first then
    local n = 0
    for i = first + 1, #steps do
      local s = steps[i]
      if not inOut[i] and state[i] == "open" and s.q and (s.t == "complete" or s.t == "turnin") and inLog(s.q)
         and (s.t == "complete" or ready(s.q)) then
        local d0
        pcall(function() d0 = R.StepDist(s) end)
        if d0 and d0 <= R.EXTRA_YD then
          local base = 12 * 20 + R.EXTRA_PEN - ((s.t == "turnin") and 15 or 0)
          cands[#cands + 1] = { i = i, lb = d0 + base, base = base, extra = true }
        end
        n = n + 1
        if n >= 30 then break end
      end
    end
  end
  -- 2. echter Laufweg (Wegenetz) in Reihenfolge der Untergrenze; was schon schlechter ist als das Beste,
  --    braucht keine Wegsuche (exakt dasselbe Ergebnis, viel weniger Rechnen)
  table.sort(cands, function(a, b) return a.lb < b.lb end)
  local curI = cur and cur.i
  for _, c in ipairs(cands) do
    local score = c.lb
    if not c.far and (not bestScore or c.lb < bestScore or c.i == curI) then
      local d
      pcall(function() d = R.StepCost(steps[c.i], pw) end)
      if d then score = d + c.base end
    end
    if c.extra then
      if score - c.base <= R.EXTRA_YD then scores[c.i] = score; extras[#extras + 1] = c.i else score = nil end
    else
      scores[c.i] = score
    end
    if score and (not bestScore or score < bestScore) then best, bestScore = c.i, score end
  end
  R.extras = extras
  if not best then best = first end
  -- Hysterese: das aktuelle Ziel nur wechseln, wenn das neue klar besser ist (kein Hin-und-her)
  if cur and cur.i and scores[cur.i] and best ~= cur.i and bestScore then
    local cs = scores[cur.i]
    if bestScore > cs - 40 and bestScore > cs * 0.75 then best = cur.i end
  end
  local ordered = {}
  if best then ordered[1] = best end
  for _, i in ipairs(out) do if i ~= best then ordered[#ordered + 1] = i end end
  for _, i in ipairs(extras) do if i ~= best and #ordered < (n or 5) then ordered[#ordered + 1] = i end end
  while #ordered > (n or 5) do table.remove(ordered) end
  R.state = state
  return best, ordered
end

---------------------------------------------------------------------------
-- Wegenetz: Pfeil fuehrt ueber begehbare Knoten (NPC-Laufwege + eigene Punkte)
---------------------------------------------------------------------------
local AREA_FALLBACK = { [1637] = 85, [1638] = 88, [1497] = 90, [14] = 1411, [17] = 1413, [406] = 1442,
  [331] = 1440, [267] = 1424, [400] = 1441, [130] = 1421, [215] = 1412, [85] = 1420 }
local NAV = {}
local navBuilt = false
R.UserNav = nil

local function addGraph(map, nodes, edges, scale)
  local g = NAV[map]
  if not g then g = { x = {}, y = {}, adj = {} }; NAV[map] = g end
  local base = #g.x
  for k = 1, #nodes, 2 do
    g.x[#g.x + 1] = nodes[k] / scale; g.y[#g.y + 1] = nodes[k + 1] / scale
    g.adj[#g.x] = {}
  end
  for k = 1, #edges, 2 do
    local a, b = base + edges[k], base + edges[k + 1]
    if g.adj[a] and g.adj[b] then
      g.adj[a][#g.adj[a] + 1] = b; g.adj[b][#g.adj[b] + 1] = a
    end
  end
end

function R.BuildNav(force)
  if navBuilt and not force then return end
  wipe(NAV)
  questie()
  for area, d in pairs(LevelPilot_Nav or {}) do
    local map = uiMapOf(area) or AREA_FALLBACK[area]
    if map then addGraph(map, d.n, d.e, 100) end
  end
  for map, d in pairs(R.UserNav or {}) do
    if d.n and #d.n > 0 then addGraph(map, d.n, d.e or {}, 1) end
  end
  for map, d in pairs(R.UserNav or {}) do
    local g = NAV[map]
    if g and d.n then
      local w, h = mapSize(map)
      if w then
        local total = #g.x
        local userStart = total - (#d.n / 2) + 1
        for u = userStart, total do
          for v = 1, userStart - 1 do
            local dx, dy = (g.x[u] - g.x[v]) * w, (g.y[u] - g.y[v]) * h
            if dx * dx + dy * dy < 25 * 25 then
              g.adj[u][#g.adj[u] + 1] = v; g.adj[v][#g.adj[v] + 1] = u
            end
          end
        end
      end
    end
  end
  navBuilt = true
end
function R.NavStats()
  local maps, nodes = 0, 0
  for _, g in pairs(NAV) do maps = maps + 1; nodes = nodes + #g.x end
  return maps, nodes
end

-- Abstand Punkt P zur Strecke A-B (Kartenkoordinaten, Ergebnis in Yards)
local function segDist(px, py, ax, ay, bx, by, w, h)
  local ux, uy = (bx - ax) * w, (by - ay) * h
  local vx, vy = (px - ax) * w, (py - ay) * h
  local L = ux * ux + uy * uy
  local t = L > 0 and math.max(0, math.min(1, (vx * ux + vy * uy) / L)) or 0
  local dx, dy = vx - t * ux, vy - t * uy
  return math.sqrt(dx * dx + dy * dy)
end

-- Wegglaettung: Zwischenpunkte weglassen, wenn sie kaum vom direkten Weg abweichen
-- (Pfeil schaut voraus statt auf jeden Knick)
local function smooth(seq, px, py, w, h)
  while #seq >= 2 do
    local a, b = seq[1], seq[2]
    local dB = math.sqrt(((b.x - px) * w) ^ 2 + ((b.y - py) * h) ^ 2)
    if dB < 140 and segDist(a.x, a.y, px, py, b.x, b.y, w, h) < 7 then table.remove(seq, 1) else break end
  end
end

local CITY = { [85] = true, [86] = true, [88] = true, [90] = true, [1454] = true, [1456] = true, [1458] = true }
local pathCache = { key = nil, t = 0, pts = nil }
local function cityRoute(tgt)
  if not tgt or not tgt.map then return end
  R.BuildNav()
  local pmap, px, py = R.PlayerMapPos()
  if not (pmap and px) then return end
  local own = R.UserNav and R.UserNav[pmap] and R.UserNav[pmap].n and #R.UserNav[pmap].n > 0
  local wild = not CITY[pmap] and not own
  local g = NAV[pmap]
  if not g or #g.x < 2 then return end
  local w, h = mapSize(pmap)
  if not w then return end
  local e, n = R.Offset(tgt)
  if not e then return end
  local tx, ty = px + e / w, py - n / h
  local direct = math.sqrt(e * e + n * n)
  if direct < 45 or (wild and direct < 150) then return end

  local now = GetTime()
  local key = pmap .. ":" .. math.floor(tx * 2000) .. ":" .. math.floor(ty * 2000)
  if pathCache.key == key and now - pathCache.t < 3 then
    if not pathCache.pts then return end
    while pathCache.pts[1] do
      local q = pathCache.pts[1]
      local dx, dy = (q.x - px) * w, (q.y - py) * h
      if dx * dx + dy * dy < 12 * 12 then table.remove(pathCache.pts, 1) else break end
    end
    smooth(pathCache.pts, px, py, w, h)
    if pathCache.pts[1] then
      local rest = pathCache.tail or 0
      local prev = { x = px, y = py }
      for _, q in ipairs(pathCache.pts) do
        local dx, dy = (q.x - prev.x) * w, (q.y - prev.y) * h
        rest = rest + math.sqrt(dx * dx + dy * dy); prev = q
      end
      return pathCache.pts[1], rest
    end
    return
  end

  local function dyd(ax, ay, bx, by) local dx, dy = (ax - bx) * w, (ay - by) * h; return math.sqrt(dx * dx + dy * dy) end
  local function nearestNodes(x, y, k, maxd)
    local list = {}
    for i = 1, #g.x do
      local d = dyd(g.x[i], g.y[i], x, y)
      if d <= maxd then list[#list + 1] = { i = i, d = d } end
    end
    table.sort(list, function(a, b) return a.d < b.d end)
    while #list > k do table.remove(list) end
    return list
  end
  local reach = wild and 90 or 140
  local starts = nearestNodes(px, py, 6, reach)
  local ends = nearestNodes(tx, ty, 6, reach)
  if #starts == 0 or #ends == 0 then pathCache.key, pathCache.t, pathCache.pts = key, now, nil; return end
  local endCost = {}
  for _, c in ipairs(ends) do endCost[c.i] = c.d end

  local INF = math.huge
  local gs, came, open, inOpen = {}, {}, {}, {}
  for _, c in ipairs(starts) do gs[c.i] = c.d; open[#open + 1] = c.i; inOpen[c.i] = true end
  local best, bestCost
  local guard = 0
  while #open > 0 and guard < 20000 do
    guard = guard + 1
    local bi, bf = 1, INF
    for k, i in ipairs(open) do
      local f = gs[i] + dyd(g.x[i], g.y[i], tx, ty)
      if f < bf then bi, bf = k, f end
    end
    local cur = table.remove(open, bi); inOpen[cur] = nil
    if bestCost and bf >= bestCost then break end
    if endCost[cur] then
      local tot = gs[cur] + endCost[cur]
      if not bestCost or tot < bestCost then best, bestCost = cur, tot end
    end
    for _, nb in ipairs(g.adj[cur] or {}) do
      local ng = gs[cur] + dyd(g.x[cur], g.y[cur], g.x[nb], g.y[nb])
      if ng < (gs[nb] or INF) then
        gs[nb] = ng; came[nb] = cur
        if not inOpen[nb] then open[#open + 1] = nb; inOpen[nb] = true end
      end
    end
  end
  -- Stadt: Umweg bis 2.4x erlaubt (Mauern, Ebenen). Gelaende: nur Wege, die kaum Umweg sind
  -- (Strassen/Paesse), sonst Luftlinie.
  local limit = wild and (direct * 1.2 + 30) or (direct * 2.4 + 80)
  if not best or bestCost > limit then
    pathCache.key, pathCache.t, pathCache.pts = key, now, nil
    return
  end
  local seq = {}
  local c = best
  while c do table.insert(seq, 1, { map = pmap, x = g.x[c], y = g.y[c] }); c = came[c] end
  while #seq > 0 and dyd(seq[1].x, seq[1].y, px, py) < 15 do table.remove(seq, 1) end
  smooth(seq, px, py, w, h)
  pathCache.key, pathCache.t, pathCache.pts = key, now, seq
  pathCache.tail = endCost[best]
  if #seq == 0 then pathCache.pts = nil; return end
  return seq[1], bestCost
end

-- Pfeil-Wegpunkt. In Staedten und mit eigenen Wegen das Stadtnetz (NPC-Laufwege), draussen das Wegenetz aus
-- der Spielgeometrie (Travel.lua). Rueckgabe: Wegpunkt { map, x, y, via } oder nil (gerade drauf zu),
-- Restweg (Yards, nur mit Wegpunkt), Laufweg gesamt (Yards, auch ohne Wegpunkt).
local walkCache = { key = nil, t = 0 }
function R.Route(tgt)
  if not tgt or not tgt.map then return end
  local pmap, px, py = R.PlayerMapPos()
  if not (pmap and px) then return end
  local own = R.UserNav and R.UserNav[pmap] and R.UserNav[pmap].n and #R.UserNav[pmap].n > 0
  if CITY[pmap] or own or not (LP_Walk and LP_Walk.Aim) then
    local wp, len = cityRoute(tgt)
    return wp, len, len
  end
  local now = GetTime()
  local key = pmap .. ":" .. math.floor(px * 600) .. ":" .. math.floor(py * 600) .. ">" .. tgt.map .. ":"
    .. math.floor(tgt.x * 4000) .. ":" .. math.floor(tgt.y * 4000)
  if walkCache.key == key and now - walkCache.t < 0.5 then return walkCache.wp, walkCache.len, walkCache.rest end
  local wp, len, rest
  pcall(function()
    local p = LP_Walk.Point(pmap, px, py)
    local q = LP_Walk.Point(tgt.map, tgt.x, tgt.y)
    if not (p and q) then return end
    local a, r = LP_Walk.Aim(p, q)
    rest = r
    if not a then return end
    local _, pos = C_Map.GetMapPosFromWorldPos(p.c, vec(a.x, a.y), pmap)
    local x, y = xy(pos)
    if x then wp, len = { map = pmap, x = x, y = y, via = a.via }, a.rest end
  end)
  walkCache.key, walkCache.t, walkCache.wp, walkCache.len, walkCache.rest = key, now, wp, len, rest
  return wp, len, rest
end
function R.ResetPath() pathCache.key = nil; walkCache.key = nil end
