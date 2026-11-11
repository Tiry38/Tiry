---------------------------------------------------------------------------
-- LevelPilot · Routen-Engine 5 (fester Plan)
-- Waehlt die Route passend zu Fraktion + Level, fuehrt einen Plan-Zeiger, der nur vorwaerts
-- ueber Erledigtes laeuft (Reihenfolge des Planers gilt), erkennt beim Einstieg deinen Stand
-- (Questlog + Ort + Stufe), springt mit, wenn du nachweislich weiter bist, prueft das Questlog
-- (behalten / abgeben / loeschen) und liefert Zielpunkte: Questgeber/Abgabe (Questie),
-- Questziele = naechste Gegner-/Objekt-Gruppe aus Questie, sonst Blizzards Questbereich.
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
local function stamp(q) R.mem.at = R.mem.at or {}; R.mem.at[q] = (time and time()) or os.time() end
function R.OnAccepted(q) if q then R.mem.acc[q] = true; R.mem.done[q] = nil; stamp(q); memoReset() end end
function R.OnTurnedIn(q) if q then R.mem.done[q] = true; R.mem.acc[q] = nil; stamp(q); memoReset() end end
-- Zeitstempel aelter als 3 Tage vergessen (SavedVariables klein halten)
function R.PruneStamps()
  local at = R.mem.at; if not at then return end
  local t0 = ((time and time()) or os.time()) - 3 * 86400
  for q, t in pairs(at) do if t < t0 then at[q] = nil end end
end
function R.OnRemoved(q)
  if q and not LOGC.ids[q] then R.mem.acc[q] = nil end
  memoReset()
end

-- Questnamen, die in der Route mehrfach vorkommen (Kettenteile), nie per Name abgleichen
local dupName
local titleC, dupC = {}, {}
local function uniqueTitle(q)
  local c = titleC[q]
  if c ~= nil then return c or nil end
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
  -- Doppelname? (Questie-Name aendert sich nie – einmal fragen, sobald Questie geladen ist)
  local d = dupC[q]
  if d == nil then
    local en = qQuery(q, "name")
    d = (en and dupName[en]) and true or false
    if questie() then dupC[q] = d end
  end
  if d then titleC[q] = false; return nil end
  local t
  pcall(function() t = QL.GetTitleForQuestID(q) end)
  -- erst merken, wenn auch die Doppelnamen-Pruefung lief (Questie geladen); leer = Titel noch nicht geliefert
  if t and t ~= "" and dupC[q] ~= nil then titleC[q] = t end
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
R.maxAbove = 2   -- Questlevel hoechstens Stufe+2 (5.1.5: vorher 3)
R.mobAbove = 1   -- Gegner der Questziele (ml = Mittel ihres Stufenbereichs) hoechstens Stufe+1 (Tiry 11.11.)
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
  -- Aufhol-Quest (fill = Stufe): nur fuer Spieler hinter dem Plan; ab dieser Stufe uebersprungen (ausser im Log)
  if s.fill and lvl >= s.fill and not (s.q and inLog(s.q)) then
    if s.q and flagged(s.q) then return true end
    return "skip"
  end
  if s.cls then
    local _, _, cid = UnitClass("player")
    if cid and bit and bit.band(s.cls, 2 ^ (cid - 1)) == 0 then return "skip" end
  end
  if s.t == "accept" then
    if flagged(s.q) or inLog(s.q) then return true end
    if s.alt then for _, a in ipairs(s.alt) do if flagged(a) or inLog(a) then return true end end end
    if s.pre then for _, p in ipairs(s.pre) do if not flagged(p) then return "skip" end end end
    if s.pres then
      local any = false
      for _, p in ipairs(s.pres) do if flagged(p) then any = true; break end end
      if not any then return "skip" end
    end
    if greyFor(s.ql, lvl) then return "skip" end
    if s.rl and lvl < s.rl then return "later" end
    if s.ql and R.maxAbove and s.ql > lvl + R.maxAbove then return "later" end
    if s.ml and R.mobAbove and s.ml > lvl + R.mobAbove then return "later" end   -- Gegner zu stark
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
    -- Flugziel = Flugmeister am Ziel-Hub: wer im Hub steht (Questgeber daneben), ist angekommen
    if d and d < (s.r or (s.t == "fly" and 120 or 45)) then return true end
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

-- Questgebiet = Spawnpunkte der noch offenen Questziele (Gegner, Objekte, Beute) bzw. der Grind-Gegner.
-- Orte ("event") gehoeren nicht dazu: dort fuehrt der Strahl bis auf den Punkt.
-- Drin ab AREA_IN Yards zum naechsten Punkt, wieder draussen erst ab AREA_OUT (Puffer: kein Flackern am Rand).
R.AREA_IN, R.AREA_OUT = 60, 120
local apCache = {}
local function areaPoints(q)
  local open = openTypes(q)
  local sig = {}
  for typ in pairs(open) do sig[#sig + 1] = typ end
  table.sort(sig); sig = table.concat(sig, ",")
  local c = apCache[q]
  if c and c.sig == sig then return c.pts end
  local G = objectiveGroups(q)
  local pts = {}
  for typ in pairs(open) do
    if typ ~= "event" and G[typ] then addPts(pts, G[typ], 2400) end
  end
  -- Blizzard nennt keine passende Art (oder noch keine Ziele): alle Gegner/Objekte/Beute der Quest
  if #pts == 0 and not open.event then
    for typ, g in pairs(G) do if typ ~= "event" then addPts(pts, g, 2400) end end
  end
  if objCache[q] then apCache[q] = { sig = sig, pts = pts } end
  return pts
end
-- a = { q = QuestID } oder { npc = NPC-ID }; wasIn = vorher drin? -> true/false (+ Yards) oder nil (kein Gebiet bekannt)
function R.InArea(a, wasIn)
  if not a then return nil end
  local pts
  if a.npc then pts = spawnsOf("npc", a.npc) elseif a.q then pts = areaPoints(a.q) end
  if not pts or #pts == 0 then return nil end
  local _, d = nearestFast(pts)
  if not d then return nil end
  return d <= (wasIn and R.AREA_OUT or R.AREA_IN), d
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

-- Ziel fuer den Pfeil: wie StepTarget, aber eine Abgabe, deren Quest noch nicht fertig ist,
-- fuehrt zuerst zu den Questzielen (zweites Ergebnis true = "erst erledigen")
local gcache = setmetatable({}, { __mode = "k" })
function R.GoalTarget(s)
  if s and s.t == "turnin" and s.q and inLog(s.q) and not ready(s.q) then
    local now = GetTime()
    local c = gcache[s]
    if c and now - c.t < 1.5 then
      if c.v then return c.v, true end
      return R.StepTarget(s)
    end
    local v = objectiveTarget(s.q)
    if v then v = { map = v.map, x = v.x, y = v.y, spot = v.spot, count = v.count } end
    gcache[s] = { t = now, v = v }
    if v then return v, true end
  end
  return R.StepTarget(s)
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

-- Index je Quest: in welchen Schritten der Route kommt sie vor? (gepuffert je Route)
local QIDX = setmetatable({}, { __mode = "k" })
local function questIndex(route)
  local ix = QIDX[route]
  if ix then return ix end
  ix = {}
  for i, s in ipairs(route.steps or {}) do
    if s.q then
      local e = ix[s.q]; if not e then e = {}; ix[s.q] = e end
      if s.t == "accept" and not e.acc then e.acc = i
      elseif s.t == "complete" and not e.cmp then e.cmp = i
      elseif s.t == "turnin" and not e.tin then e.tin = i end
    end
  end
  QIDX[route] = ix
  return ix
end
R.QuestIndex = questIndex

local function now() if time then return time() end return os.time() end
R.Now = now

-- Aufhol-Quests nach echtem XP-Stand: nur so viele, wie dir bis zur Stufe des Blocks fehlen.
-- Gedeckt wird mit: Quests des Abschnitts im Log + offene (annehmbare) Quests des Abschnitts + Aufhol-Quests
-- in Reihenfolge. Was dann noch fehlt, steht in R.fillInfo[stufe].rest (Anzeige: "~N Mobs").
-- XP je Stufe: Forever-Tabelle (QuestieDB support/Forever, wie tools/xpmodel.py)
R.XP_LEVEL = { [20] = 23200, [21] = 25200, [22] = 27300, [23] = 29400, [24] = 31700, [25] = 34000, [26] = 36400, [27] = 38900,
  [28] = 41400, [29] = 44300, [30] = 47400, [31] = 50800, [32] = 54500, [33] = 58600, [34] = 62800, [35] = 67100, [36] = 71600,
  [37] = 76100, [38] = 80800, [39] = 85700, [40] = 90700 }
R.fillInfo = {}
function R.XPNeed(lvl, to)
  if not (UnitXP and UnitXPMax) then return nil end
  local ok, cur, mx = pcall(function() return UnitXP("player"), UnitXPMax("player") end)
  if not ok or type(cur) ~= "number" or type(mx) ~= "number" or mx <= 0 then return nil end
  local need = mx - cur
  for l = lvl + 1, to - 1 do need = need + (R.XP_LEVEL[l] or mx) end
  return math.max(0, need)
end
function R.FillBudget(steps, state, lvl, from)
  local blocks = {}
  for i, s in ipairs(steps) do
    if s.fill and s.t == "accept" and lvl < s.fill then
      local b = blocks[s.fill]
      if not b then b = { seg = s.seg, list = {} }; blocks[s.fill] = b end
      b.list[#b.list + 1] = i
    end
  end
  R.fillInfo = {}
  for F, b in pairs(blocks) do
    local need = R.XPNeed(lvl, F)
    local cover, total = 0, 0
    for i, s in ipairs(steps) do
      if s.t == "accept" and s.q and s.xp and s.seg == b.seg and not s.fill then
        -- offene Quests hinter dem Plan-Zeiger zaehlen nicht (der Plan schickt dich nicht mehr hin)
        if inLog(s.q) or (state[i] == "open" and (not from or i >= from)) then cover = cover + s.xp end
      elseif s.t == "accept" and s.q and s.xp and s.fill == F and inLog(s.q) then
        cover = cover + s.xp
      end
    end
    for _, i in ipairs(b.list) do
      local s = steps[i]
      if state[i] == "open" then
        if need and cover >= need then state[i] = "skip" else cover = cover + (s.xp or 0) end
      end
      if state[i] ~= "skip" then total = total + 1 end
    end
    R.fillInfo[F] = { need = need, cover = cover, rest = need and math.max(0, need - cover) or nil, n = total,
      mob = lvl * 5 + 45 }
  end
end

-- Zustand aller Schritte: done / skip / later / open (Reise-Schritte nach "warst du schon da / brauchst du es noch")
local function computeState(steps, lvl, skipped, cur, from)
  local state = {}
  for i, s in ipairs(steps) do
    if skipped and skipped[R.StepKey(s)] then state[i] = "skip"
    elseif s.q then
      local d = R.StepDone(s, lvl, (cur and cur.i == i) and cur or nil)
      state[i] = (d == true) and "done" or (d == "skip" and "skip") or (d == "later" and "later") or "open"
    elseif s.t == "grind" then
      state[i] = (lvl >= (s.to or 0)) and "done" or "open"
    end
  end
  R.FillBudget(steps, state, lvl, from)
  -- Reisen/Trainer: noetig, wenn im folgenden Abschnitt noch etwas offen ist; erledigt, sobald dort
  -- schon etwas angenommen/abgegeben wurde (du warst also schon da)
  for i, s in ipairs(steps) do
    if not state[i] then
      local d = R.StepDone(s, lvl, (cur and cur.i == i) and cur or nil)
      if d == true then state[i] = "done"
      elseif d == "skip" then state[i] = "skip"   -- z. B. Klassenlehrer einer anderen Klasse
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
  return state
end
R.ComputeState = computeState

---------------------------------------------------------------------------
-- Plan-Engine 5: fester Plan mit Zeiger
-- Der Zeiger steht auf deinem Platz in der Route und laeuft nur VORWAERTS ueber Erledigtes und
-- Unpassendes. Keine Umsortierung nach Entfernung: die Reihenfolge des Plans gilt. Offenes VOR dem
-- Zeiger ist "verpasst" und wird nicht mehr angesteuert (der Questlog-Check sagt, was davon weg kann).
-- Einstieg (noch kein Zeiger, neue Route, /lp einstieg): Stand aus Questlog + Ort + Stufe erkennen.
-- Sprung: machst du nachweislich spaetere Schritte und das Plan-Ziel ist weit weg, zieht der Zeiger
-- nach (umkehrbar mit /lp zurueck). Nie automatisch rueckwaerts.
---------------------------------------------------------------------------
R.ENTRY_NEAR = 600     -- Einstieg: Geber/Abgabe einer Quest im Log so nah = "hier stehst du im Plan"
R.JUMP_FAR = 900       -- Sprung nur, wenn das Plan-Ziel weiter weg ist (Luftlinie, Yards)
R.JUMP_NEAR = 450      -- ... und ein Beweis-Schritt so nah bei dir liegt
R.JUMP_SPAN = 150      -- so weit voraus wird nach Beweisen gesucht
R.JUMP_DWELL = 3       -- Sekunden, die derselbe Beweis bestehen muss (kein Sprung im Vorbeifliegen)
R.FRESH = 7200         -- "frisch" = in den letzten 2 h abgegeben
R.LATER_SPAN = 30      -- Schritt mit fehlender Stufe wartet so lange im Plan (gleicher Abschnitt)
R.WANT_SPAN = 60       -- Auto-Annehmen nur fuer Quests, die bald dran sind

local JC = setmetatable({}, { __mode = "k" })   -- Sprung-Kandidat je Plan (nur im Speicher)
local function findKey(steps, k, hint)
  if not k then return end
  if k == "END" then return #steps + 1 end
  if hint and steps[hint] and R.StepKey(steps[hint]) == k then return hint end
  local best, bd
  for i, s in ipairs(steps) do
    if R.StepKey(s) == k then
      local d = hint and math.abs(i - hint) or i
      if not bd or d < bd then best, bd = i, d end
    end
  end
  return best
end

local function nextOpen(state, from, to)
  for i = from, to do
    local st = state[i]
    if st == nil then return end
    if st == "open" then return i end
  end
end

-- Zeiger vorwaerts: ueber Erledigtes/Unpassendes; ein Schritt mit fehlender Stufe wartet,
-- solange der naechste offene Schritt im selben Abschnitt und nah im Plan liegt
local function advance(steps, state, p)
  local N = #steps
  while p <= N do
    local st = state[p]
    if st == "done" or st == "skip" then p = p + 1
    elseif st == "later" then
      local h = nextOpen(state, p + 1, N)
      if h and (h - p > R.LATER_SPAN or steps[h].seg ~= steps[p].seg) then p = p + 1 else break end
    else break end
  end
  return p
end

-- Einstieg: wo stehst du im Plan?
-- Fortschritt zeigen ANGENOMMENE Quests (eine spaetere Quest kann man nicht ohne den Weg dorthin haben).
-- Abgaben zaehlen nur im selben Abschnitt mit – sonst zoege eine Quest, die der Plan erst viel spaeter
-- abgibt, den Einstieg weit nach vorn. Reihenfolge:
-- 1. angenommene Quests, deren Geber bei dir ist  2. Abgaben bei dir (fruehester Abschnitt)
-- 3. frisch abgegeben/angenommen  4. angenommene Quests im Log  5. Abgaben im Log  6. Stufe
local function cluster(steps, list)
  local top = list[#list]
  local a = top
  for k = #list, 1, -1 do
    local i = list[k]
    if steps[i].seg == steps[top].seg and top - i <= 80 then a = i end
  end
  return a
end
-- Anfang des Abschnitts (hoechstens 80 Schritte zurueck); Erledigtes ueberspringt danach advance()
local function segStart(steps, i)
  local j = i
  while j > 1 and steps[j - 1].seg == steps[i].seg and i - (j - 1) <= 80 do j = j - 1 end
  return j
end
R.SegStart = segStart
local function pickSeg(steps, list, lvl)
  local cnt, best, bc, bd = {}, nil, -1, nil
  for _, i in ipairs(list) do local g = steps[i].seg or 0; cnt[g] = (cnt[g] or 0) + 1 end
  for _, i in ipairs(list) do
    local g = steps[i].seg or 0
    local dl = math.abs((steps[i].l or lvl or 0) - (lvl or 0))
    if cnt[g] > bc or (cnt[g] == bc and dl < bd) then best, bc, bd = g, cnt[g], dl end
  end
  local out = {}
  for _, i in ipairs(list) do if (steps[i].seg or 0) == best then out[#out + 1] = i end end
  return out
end
-- Log-Einstieg: spaetester Abschnitt zaehlt (alte Reste ziehen nicht zurueck), aber ein einzelner Ausreisser
-- weit ueber der Stufe (frueh mitgenommen) zieht nicht nach vorn
local function nearLvl(steps, list, lvl)
  if not lvl then return list end
  local out = {}
  for _, i in ipairs(list) do if (steps[i].l or lvl) <= lvl + 3 then out[#out + 1] = i end end
  return #out > 0 and out or list
end
local function withSeg(steps, acc, tin)
  local top = acc[#acc]
  local out = {}
  for _, i in ipairs(acc) do out[#out + 1] = i end
  for _, i in ipairs(tin) do if i < top and steps[i].seg == steps[top].seg then out[#out + 1] = i end end
  table.sort(out)
  return out
end
function R.Entry(route, state, lvl)
  local steps = route.steps
  local nearA, nearT, allA, allT = {}, {}, {}, {}
  for i, s in ipairs(steps) do
    local acc = s.t == "accept" and state[i] == "done"
    local tin = s.t == "turnin" and state[i] == "open"
    if s.q and (acc or tin) and inLog(s.q) then
      local t = R.StepTarget(s)
      local d = t and distTo(t)
      local near = d and d <= R.ENTRY_NEAR
      if acc then
        allA[#allA + 1] = i
        if near then nearA[#nearA + 1] = i end
      else
        allT[#allT + 1] = i
        if near then nearT[#nearT + 1] = i end
      end
    end
  end
  if #nearA > 0 then return cluster(steps, withSeg(steps, pickSeg(steps, nearA, lvl), nearT)), "hier" end
  if #nearT > 0 then return segStart(steps, nearT[1]), "hier" end
  local at = R.mem.at
  if at then
    local bi, bt
    local t0 = now() - R.FRESH
    for i, s in ipairs(steps) do
      if s.q and (s.t == "accept" or s.t == "turnin") and state[i] == "done" and at[s.q] and at[s.q] >= t0 then
        if not bt or at[s.q] > bt or (at[s.q] == bt and i > bi) then bi, bt = i, at[s.q] end
      end
    end
    if bi then return bi, "frisch" end
  end
  if #allA > 0 then return cluster(steps, nearLvl(steps, allA, lvl)), "log" end
  if #allT > 0 then return segStart(steps, allT[1]), "log" end
  for i, s in ipairs(steps) do
    if (s.l or 0) >= lvl - 1 and state[i] ~= "done" and state[i] ~= "skip" then return i, "stufe" end
  end
  return 1, "start"
end

-- Beweis, dass du schon weiter bist (kleinster Index): Quest im Log, deren Geber bei dir steht,
-- oder eine frisch abgegebene Quest, deren Abgabe bei dir ist.
-- Kein Beweis ist ein Ort, an dem du Quests angenommen hast, die der Plan VOR dem Beweis noch braucht:
-- das ist dein aktueller Hub (Auto-Annehmen nimmt dort auch spaetere Hub-Quests mit).
local function evidence(route, steps, state, p, plan)
  local N = #steps
  local at = R.mem.at or {}
  local t0 = math.max(plan.since or 0, now() - R.FRESH)
  local qx = questIndex(route)
  local pend
  for j = p + 1, math.min(N, p + R.JUMP_SPAN) do
    local s = steps[j]
    if s.q and state[j] == "done" and (s.t == "accept" or s.t == "turnin") then
      local ok
      if s.t == "accept" then ok = inLog(s.q)
      else ok = at[s.q] and at[s.q] >= t0 end
      if ok then
        local t = R.StepTarget(s)
        local d = t and distTo(t)
        if d and d <= R.JUMP_NEAR then
          if not pend then
            pend = {}
            for i = p, math.min(N, p + R.JUMP_SPAN) do
              local o = steps[i]
              if state[i] == "open" and o.q and (o.t == "complete" or o.t == "turnin") and inLog(o.q) then
                local a = qx[o.q] and qx[o.q].acc
                local gt = a and steps[a].seg == steps[p].seg and R.StepTarget(steps[a])   -- nur Quests dieses Hub-Besuchs
                if gt then pend[#pend + 1] = { i = i, t = gt } end
              end
            end
          end
          local home = false
          for _, e in ipairs(pend) do
            if e.i < j then
              local b = R.Between(e.t, t)
              if b and b <= R.JUMP_FAR then home = true; break end
            end
          end
          if not home then return j end
        end
      end
    end
  end
end

-- route, lvl, skipped (StepKey -> true), plan (gespeicherter Zeiger, wird fortgeschrieben),
-- n (Listenlaenge), cur ({ i, since } = aktuelles Ziel seit)
-- Rueckgabe: Ziel-Index, Liste der naechsten Schritte, info { ptr, hero, n, entry, jumped }
-- "Neu berechnen" (Tiry 11.11.): lohnt gerade eine andere Quest mehr? XP gegen Weg + Arbeit.
-- Nie schwerer als der Plan: Questlevel hoechstens wie das Plan-Ziel (sonst Stufe+1, max. Stufe+2),
-- keine Elite-/Gruppenquest, nur was du jetzt annehmen kannst (oder schon im Log hast).
R.DETOUR_GAIN = 1.15   -- erst ab 15 % mehr XP/Min wird umgeplant (sonst bleibt der Plan)
R.WALK_YPM = 7 * 60    -- Yards je Minute zu Fuss (Reittier erst ab 40)
local function questRate(steps, ix, state, q)
  local e = ix[q]; if not (e and e.acc) then return end
  local a = steps[e.acc]
  if not (a.xp and a.xp > 0) or a.hard or flagged(q) then return end
  if a.note and (a.note:find("starker Gegner", 1, true) or a.note:find("Gruppe", 1, true)) then return end
  local pts, first, wm = {}, nil, a.wm or 2
  if not inLog(q) then
    local st = state[e.acc]
    if st ~= "open" and st ~= "missed" then return end   -- Stufe zu niedrig / passt nicht / gesperrt
    first = e.acc; pts[#pts + 1] = R.StepTarget(a) or false
  end
  if ready(q) then wm = 0
  elseif e.cmp then first = first or e.cmp; pts[#pts + 1] = R.StepTarget(steps[e.cmp]) or false end
  if e.tin then first = first or e.tin; pts[#pts + 1] = R.StepTarget(steps[e.tin]) or false end
  if not first then return end
  local yd, prev = 0, nil
  for _, pt in ipairs(pts) do
    if not pt then return end
    local d = prev and R.Between(prev, pt) or distTo(pt)
    if not d then return end
    yd, prev = yd + d, pt
  end
  local min = yd * 1.25 / R.WALK_YPM + wm + 0.3 * #pts   -- Luftlinie * 1.25 (Umwege), je Station 18 s Gespraech
  return a.xp / min, first, a.ql, min, yd
end
-- Beste machbare Alternative (Quest, die du jetzt annehmen kannst oder im Log hast; nie ueber refQl, keine Elite)
local function bestAlt(steps, ix, state, refQl, skipQ, maxYd)
  local seen, best = {}, nil
  for _, s in ipairs(steps) do
    local q = s.q
    if q and s.t == "accept" and not seen[q] and q ~= skipQ then
      seen[q] = true
      local r, first, ql, min, yd = questRate(steps, ix, state, q)
      if r and (not ql or ql <= refQl) and (not maxYd or yd <= maxYd) and (not best or r > best.rate) then
        best = { q = q, rate = r, first = first, ql = ql, min = min, yd = yd, name = R.StepTitle(s) }
      end
    end
  end
  return best
end
R.GRIND_MIN = 0.8      -- Minuten je Gegner beim Grinden (wie tools/xpmodel.py T_GRIND)
R.AUTO_EVERY = 20      -- Sekunden: so oft sucht der Plan beim Warten/Grinden nach einer machbaren Quest
R.AUTO_YD = 2500       -- automatisch nur Quests in der Naehe (ganzer Weg hoechstens ~2,5 km); weiter weg nur per Knopf
local function grindRate(lvl) return (lvl * 5 + 45) / R.GRIND_MIN end

-- Quest-Pool (5.1.6, Tiry 11.11.: "immer ganz genau auf mein Level"): alle Solo-Quests im Freien aus Questies
-- Forever-Datenbank (Routes/Pool_Horde.lua, tools/pool.py). Hat die Route an deiner Stufe nichts Machbares
-- (warten/grinden), sucht der Plan dort die Quest mit den meisten XP pro Minute – Weg zu Fuss oder per Flug
-- eingerechnet, Quest UND Gegner hoechstens deine Stufe +1, keine Elite. Pool-Schritte haengen ueber einen
-- Index ab R.POOL0 an der Route (Metatabelle: #steps/ipairs sehen sie nicht).
R.POOL0 = 100000
R.QUEST_PREF = 0.65    -- Quest statt Grinden, solange Grinden nicht >1,5x schneller waere: Tiry will Quests, und das
                       -- Grind-Tempo des Modells (0,8 Min./Gegner) ist eher optimistisch (volle Gebiete, Pausen)
R.POOL_TOP = 12        -- so viele Kandidaten (nach bestmoeglicher Rate vorsortiert) bekommen eine echte Wegrechnung
local POOL = {}
local function poolLoad()
  if POOL.ix then return POOL end
  local f = UnitFactionGroup and UnitFactionGroup("player")
  local src = LevelPilot_Pool and f and LevelPilot_Pool[f]
  if type(src) ~= "table" then return end
  POOL.steps, POOL.ix, POOL.list = {}, {}, {}
  for k, e in ipairs(src) do
    local b = R.POOL0 + (k - 1) * 3
    for j, t in ipairs({ "accept", "complete", "turnin" }) do
      POOL.steps[b + j] = { t = t, q = e.q, n = e.n, ql = e.ql, rl = e.rl, ml = e.ml, pool = true, pxp = e.xp,
        xp = (t == "accept") and e.xp or nil, wm = (t == "accept") and e.wm or nil,
        pre = (t == "accept") and e.pre or nil, pres = (t == "accept") and e.pres or nil }
    end
    POOL.ix[e.q] = { acc = b + 1, cmp = b + 2, tin = b + 3 }
    POOL.list[#POOL.list + 1] = e
  end
  return POOL
end
R.PoolLoad = poolLoad
local function poolAttach(steps)
  local P = poolLoad()
  if P and steps and getmetatable(steps) == nil then setmetatable(steps, { __index = P.steps }) end
  return P
end
-- XP sinkt, wenn die Quest unter deiner Stufe liegt (Classic: ab 6 Stufen darunter)
local function xpAt(xp, ql, lvl)
  local d = lvl - (ql or lvl)
  if d <= 5 then return xp end
  return xp * math.max(0.1, 1 - (d - 5) * 0.2)
end
R.XPAt = xpAt
-- Reisezeit (Minuten) zwischen zwei Zielen: Flug ueber bekannte Flugpunkte, wenn schneller (Fly.lua)
local function tripMin(a, b)
  local ok, sec = pcall(function() return LP_Fly and LP_Fly.TripSec and LP_Fly.TripSec(a, b) end)
  if ok and sec then return sec / 60 end
  local d = R.Between(a, b)
  if d then return d * 1.25 / R.WALK_YPM end
end
local function poolBest(mainIx, lvl, refQl, skipQ)
  local P = poolLoad()
  if not P then return end
  local pm, px, py = R.PlayerMapPos()
  if not px then return end
  local me = { map = pm, x = px, y = py }
  local cand = {}
  for _, e in ipairs(P.list) do
    local q = e.q
    if q ~= skipQ and not (mainIx and mainIx[q]) and (e.ql or 0) <= refQl and (e.ml or 0) <= lvl + (R.mobAbove or 1)
      and (e.rl or 0) <= lvl and not greyFor(e.ql, lvl) and not flagged(q) and not (R.ban and R.ban[q]) then
      local x = P.ix[q]
      local log = inLog(q)
      if log or R.StepDone(P.steps[x.acc], lvl) == false then
        local xp = xpAt(e.xp or 0, e.ql, lvl)
        local wm = (log and ready(q)) and 0 or (e.wm or 2)
        cand[#cand + 1] = { e = e, x = x, log = log, xp = xp, wm = wm, bound = xp / (wm + 0.6) }
      end
    end
  end
  table.sort(cand, function(a, b) return a.bound > b.bound end)
  local best
  for k = 1, math.min(#cand, R.POOL_TOP) do
    local c = cand[k]
    local q = c.e.q
    local pts = {}
    if not c.log then pts[#pts + 1] = R.StepTarget(P.steps[c.x.acc]) or false end
    if not (c.log and ready(q)) then
      local ct = R.StepTarget(P.steps[c.x.cmp])
      if ct then pts[#pts + 1] = ct end          -- Lieferquest: kein eigenes Ziel
    end
    pts[#pts + 1] = R.StepTarget(P.steps[c.x.tin]) or false
    local min, prev, ok = c.wm + 0.3 * #pts, me, true
    for _, pt in ipairs(pts) do
      local m = pt and tripMin(prev, pt)
      if not m then ok = false; break end
      min, prev = min + m, pt
    end
    if ok then
      local r = c.xp / min
      if not best or r > best.rate then
        local first = c.log and (ready(q) and c.x.tin or c.x.cmp) or c.x.acc
        best = { q = q, rate = r, first = first, ql = c.e.ql, min = min, name = R.StepTitle(P.steps[c.x.acc]), pool = true, xp = c.xp }
      end
    end
  end
  return best
end
R.PoolBest = poolBest

function R.Plan(route, lvl, skipped, plan, n, cur)
  memoReset()
  local steps = route and route.steps or {}
  local N = #steps
  local PL = poolAttach(route and route.steps)
  plan = plan or {}
  plan.hist = plan.hist or {}
  local state = computeState(steps, lvl, skipped, cur, findKey(steps, plan.k, plan.i))
  R.state = state
  local info = { n = N }
  R.info = info
  if N == 0 then return nil, {}, info end
  -- 1. Zeiger holen oder einsteigen
  local p = findKey(steps, plan.k, plan.i)
  if not p then
    local why
    p, why = R.Entry(route, state, lvl)
    info.entry = why
    plan.since = now()
    JC[plan] = nil
  end
  p = advance(steps, state, p)
  -- 2. Sprung nach vorn: Plan-Ziel weit weg + Beweis bei dir
  local hero = nextOpen(state, p, N)
  -- (nach /lp zurueck oder /lp schritt haelt der Zeiger 30 min still: deine Wahl gilt)
  if not (UnitOnTaxi and UnitOnTaxi("player")) and p <= N and not (plan.hold and now() < plan.hold) then
    local ht = hero and R.StepTarget(steps[hero])
    local hd = ht and distTo(ht)
    local j
    -- Ziel ohne Koordinaten: "weit weg" ist nicht beurteilbar -> kein Sprung
    -- Ausnahme: Annehmen ohne Koordinaten = Quest startet per Gegenstand (oft seltene Beute) -> Beweise zaehlen
    if not hero or (not ht and steps[hero].t == "accept") or (ht and (not hd or hd > R.JUMP_FAR)) then j = evidence(route, steps, state, p, plan) end
    if j then
      local gt = GetTime()
      local jc = JC[plan]
      if not jc or jc.j ~= j then jc = { j = j, t = gt }; JC[plan] = jc end
      if gt - jc.t >= R.JUMP_DWELL then
        local from = p
        table.insert(plan.hist, { k = R.StepKey(steps[p]), i = p, t = now() })
        while #plan.hist > 20 do table.remove(plan.hist, 1) end
        p = advance(steps, state, j)
        local skippedN = 0
        for i = from, p - 1 do if state[i] == "open" or state[i] == "later" then skippedN = skippedN + 1 end end
        info.jumped = { from = from, to = p, n = skippedN }
        plan.since = now()
        JC[plan] = nil
      end
    else
      JC[plan] = nil
    end
  else
    JC[plan] = nil   -- im Flug / waehrend der Haltezeit beginnt die Beweis-Wartezeit danach neu
  end
  -- 3. verpasst: Offenes vor dem Zeiger; Abgaben, deren Erledigen-Schritt verpasst wurde (und nicht fertig).
  -- Steht der Zeiger danach auf etwas Verpasstem, laeuft er weiter (sonst klebt er dort fest).
  local qx = questIndex(route)
  local from = 1
  for _ = 1, N do
    for i = from, math.min(p - 1, N) do
      if state[i] == "open" or state[i] == "later" then state[i] = "missed" end
    end
    for i = p, N do
      local s = steps[i]
      if s.t == "turnin" and state[i] == "open" and s.q and not ready(s.q) then
        local c = qx[s.q] and qx[s.q].cmp
        if c and c < p and state[c] == "missed" then state[i] = "missed"
        elseif c and c < i and state[c] == "skip" then state[i] = "skip" end   -- Erledigen uebersprungen -> Abgabe auch
      end
    end
    local q2 = p
    while q2 <= N and state[q2] == "missed" do q2 = q2 + 1 end
    q2 = advance(steps, state, q2)
    if q2 == p then break end
    from, p = p, q2
  end
  plan.i = p
  plan.k = (p <= N) and R.StepKey(steps[p]) or "END"
  if info.jumped then info.jumped.to = p end
  hero = nextOpen(state, p, N)
  -- Aufhol-Quests gehen nie verloren: musst du am Zeiger auf eine Stufe warten (oder grinden), holt der Plan
  -- Aufhol-Schritte desselben Abschnitts zurueck, die der Zeiger schon hinter sich gelassen hat (Tiry 11.11.)
  local back = {}
  local ps = steps[math.min(p, N)]
  if ps and (state[p] == "later" or not hero or steps[hero].t == "grind") then
    for i = 1, math.min(p - 1, N) do
      local s = steps[i]
      if s.fill and lvl < s.fill and state[i] == "missed" and s.seg == ps.seg then
        local d = R.StepDone(s, lvl)
        if d == "later" then state[i] = "later"          -- Gegner/Questlevel noch zu hoch: bleibt sichtbar, kein Ziel
        elseif d ~= true and d ~= "skip" then state[i] = "open"; back[#back + 1] = i end
      end
    end
    if back[1] then hero = back[1]
    elseif state[p] == "later" and (not hero or (steps[hero].t == "grind" and (steps[hero].to or 0) > (steps[p].rl or 0))) then
      hero = p   -- ehrlich: "WARTET ab Stufe X · noch N XP" statt "Grinden bis 30"
    end
  end
  -- Immer passend zu DEINER Stufe (Tiry 11.11.): muesstest du warten oder grinden, sucht der Plan selbst die
  -- schnellste machbare Quest (Weg + Arbeit, nie schwerer als Stufe+1, keine Elite). Nur wenn sie mehr XP/Min
  -- bringt als Grinden; sonst bleibt "Grinden bis X" mit Mob-Zahl.
  if plan.detour and plan.detour.q and flagged(plan.detour.q) then plan.detour, plan.autoT = nil, nil end   -- abgegeben: gleich weiter
  if not plan.detour and hero and (state[hero] == "later" or steps[hero].t == "grind") then
    local t = now()
    if t - (plan.autoT or 0) >= R.AUTO_EVERY then
      plan.autoT = t
      local b = bestAlt(steps, qx, state, lvl + 1, nil, R.AUTO_YD)
      local pb = PL and poolBest(qx, lvl, lvl + 1)
      if pb and (not b or pb.rate > b.rate) then b = pb end
      if b and b.rate > grindRate(lvl) * R.QUEST_PREF then plan.detour = { q = b.q, t = t, auto = true, pool = b.pool } end
    end
  end
  -- Abstecher aus "Neu berechnen": bis die Quest abgegeben ist (hoechstens 1 Stunde)
  local dt = plan.detour
  if dt then
    local e, idx = dt.q and (dt.pool and PL and PL.ix or qx)[dt.q], nil
    if e and not flagged(dt.q) and now() - (dt.t or 0) < 3600 then
      if not inLog(dt.q) then
        idx = e.acc
        if dt.pool then
          if R.StepDone(steps[idx], lvl) ~= false then idx = nil end
        elseif idx and state[idx] ~= "open" and state[idx] ~= "missed" then idx = nil end
      elseif ready(dt.q) then idx = e.tin
      else idx = e.cmp or e.tin end
    end
    if idx then state[idx] = "open"; hero = idx; info.detour, info.detourAuto, info.detourPool = dt.q, dt.auto, dt.pool else plan.detour = nil end
  end
  info.ptr, info.hero, info.back = p, hero, back[1] and #back or nil
  -- 4. Liste: Ziel + naechste offene (oder wartende) Schritte in Plan-Reihenfolge.
  -- Erledigen/Abgeben einer Quest, die der Plan vorher noch annimmt, ist "geplant" (sichtbar, aber erst
  -- nach der Annahme ansteuerbar) – so steht der ganze Ablauf in der Liste.
  local list = {}
  if hero then list[1] = hero end
  for k = 2, #back do if #list < (n or 5) then list[#list + 1] = back[k] end end
  local accAhead = {}
  for i = p, N do
    local s, st = steps[i], state[i]
    if s.t == "accept" and s.q and (st == "open" or st == "later") then accAhead[s.q] = true end
    if st == "skip" and s.q and (s.t == "complete" or s.t == "turnin") and accAhead[s.q] then st = "planned"; state[i] = st end
    if i ~= hero and (st == "open" or st == "later" or st == "planned") then
      list[#list + 1] = i
      if #list >= (n or 5) then break end
    end
  end
  return hero, list, info
end

function R.Rethink(route, lvl, plan, skipped)
  local steps = route and route.steps
  if not (steps and plan) then return end
  plan.detour = nil
  local hero = R.Plan(route, lvl, skipped, plan, 6, nil)
  local state, ix = R.state or {}, questIndex(route)
  local hs = hero and steps[hero]
  local res = { hero = hero, grind = grindRate(lvl) }
  local refQl = lvl + 1
  if hs and hs.q and state[hero] == "open" then
    local r, _, ql = questRate(steps, ix, state, hs.q)
    if r then res.heroRate = r end
    local e = ix[hs.q]; ql = ql or (e and e.acc and steps[e.acc].ql)
    if ql then refQl = math.max(lvl, ql) end
  end
  refQl = math.min(refQl, lvl + 2)
  res.base = res.heroRate or res.grind * R.QUEST_PREF / R.DETOUR_GAIN   -- statt Grinden/Warten: wie der Auto-Vorschlag
  local best = bestAlt(steps, ix, state, refQl, hs and hs.q)
  local pb = poolBest(ix, lvl, math.min(refQl, lvl + 1), hs and hs.q)   -- Pool: nie ueber Stufe +1
  if pb and (not best or pb.rate > best.rate) then best = pb end
  res.best, res.refQl = best, refQl
  if best and best.rate > res.base * R.DETOUR_GAIN then
    plan.detour = { q = best.q, t = now(), pool = best.pool }
    res.switched = true
  end
  return res
end

-- Plan-Fortschritt: erledigte/uebersprungene Schritte bis zum Zeiger (fuer das Plan-Band)
function R.Progress(route, p)
  local segs = {}
  for i, s in ipairs(route.steps or {}) do
    local k = s.seg or 1
    local g = segs[k]; if not g then g = { n = 0, first = i }; segs[k] = g end
    g.n = g.n + 1
    if i < (p or 1) then g.done = (g.done or 0) + 1 end
  end
  return segs
end

-- Soll diese Quest automatisch angenommen werden? Nur Annehmen-Schritte ab dem Zeiger, die bald dran sind
function R.Wants(route, qid, p)
  if not (route and qid) then return false end
  local state = R.state or {}
  p = p or 1
  if R.info and R.info.detour == qid then return true end   -- Abstecher aus "Neu berechnen"
  for i, s in ipairs(route.steps) do
    if s.t == "accept" and (s.q == qid or (s.alt and (function() for _, a in ipairs(s.alt) do if a == qid then return true end end end)())) then
      local st = state[i]
      if i >= p and i <= p + R.WANT_SPAN and st ~= "skip" and st ~= "missed" then return true end
    end
  end
  return false
end

---------------------------------------------------------------------------
-- Questlog-Check: was behalten, abgeben, loeschen? (mit Grund)
-- keep = gehoert in den Plan · turnin = jetzt abgeben lohnt · delete = raus damit · check = selbst entscheiden
---------------------------------------------------------------------------
R.TURNIN_NEAR = 350    -- Abgabe so nah = immer mitnehmen
R.OBJ_NEAR = 350       -- Questziel so nah = noch mitnehmen
local GROUP_TAG = { [1] = "Gruppenquest", [41] = "PvP", [62] = "Schlachtzug", [81] = "Dungeon", [85] = "Heroisch", [88] = "Schlachtzug", [89] = "Schlachtzug" }

local function classQuest(q, steps, ix)
  local e = ix and ix[q]
  local i = e and (e.acc or e.cmp or e.tin)
  if i and steps[i].cls then return true end
  local rc = qQuery(q, "requiredClasses")
  return type(rc) == "number" and rc > 0
end

local function otherRoute(q, curKey, cur)
  local m0 = cur and cur.min or 0
  for key, r in pairs(LevelPilot_Routes or {}) do
    if key ~= curKey and (r.min or 0) > m0 and (not cur or r.faction == cur.faction) then
      local e = questIndex(r)[q]
      if e then return key, r, (e.acc or e.cmp or e.tin) end
    end
  end
end

local function turninDist(q)
  local pts = questPoints(q, "finishedBy")
  local best, d = nearestFast(pts)
  if best and not d then d = distTo(best) end
  return d, best
end

-- Rueckgabe: { list = { {q, title, cat, why, step, xp} }, used, max, del, tin, chk, keep, peak, peakAt }
function R.LogAdvice(route, routeKey, lvl, p, hero, opt)
  opt = opt or {}
  local steps = route and route.steps or {}
  local ix = route and questIndex(route) or {}
  local state = R.state or {}
  local out = { list = {}, used = 0, max = 25, del = 0, tin = 0, chk = 0, keep = 0 }
  local entries = {}
  pcall(function()
    for i = 1, (QL.GetNumQuestLogEntries() or 0) do
      local info = QL.GetInfo(i)
      if info and not info.isHeader and info.questID and info.questID > 0 and not info.isHidden then entries[#entries + 1] = info end
    end
  end)
  out.used = #entries
  pcall(function() if QL.GetMaxNumQuestsCanAccept then local m = QL.GetMaxNumQuestsCanAccept(); if type(m) == "number" and m > 0 then out.max = m end end end)
  if not route then out.noRoute = true; return out end   -- ohne Route kein Plan-Urteil: nur Plaetze zaehlen
  local spd = opt.speed or 7
  local xpm = math.max(opt.xpm or 0, (opt.xph or 0) / 60)
  for _, e in ipairs(entries) do
    local q = e.questID
    local a = { q = q, title = e.title or ("Quest " .. q), lvl = e.level }
    local rdy = ready(q)
    local okX, xp = pcall(GetQuestLogRewardXP, q)
    a.xp = (okX and type(xp) == "number" and xp > 0) and xp or nil
    local ex = ix[q]
    local tag
    pcall(function()
      local ti = QL.GetQuestTagInfo and QL.GetQuestTagInfo(q)
      if ti and ti.tagID and GROUP_TAG[ti.tagID] then tag = ti.tagName or GROUP_TAG[ti.tagID] end
    end)
    local function detour()
      local d = turninDist(q)
      if not d then return nil end
      if d <= R.TURNIN_NEAR then return "near", d end
      local mins = (2 * d * 1.25 / spd) / 60
      if a.xp and xpm > 0 and a.xp / math.max(0.5, mins) >= xpm then return "worth", d, mins end
      return "far", d, mins
    end
    if R.ban and R.ban[q] then
      a.cat, a.why = "delete", "von dir gesperrt"
    elseif R.info and R.info.detour == q then
      a.cat, a.why = "keep", R.info.detourPool and "Extra-Quest passend zu deiner Stufe – ist dran" or "Abstecher – ist dran"
    elseif classQuest(q, steps, ix) then
      a.cat, a.why = "keep", "Klassenquest"
      local k = ex and ((not rdy and ex.cmp) or ex.tin)
      if k and state[k] ~= "missed" and k >= (p or 1) then a.step = k end
    elseif ex then
      local cmpI, tinI = ex.cmp, ex.tin
      local cmpLive = cmpI and cmpI >= (p or 1) and state[cmpI] ~= "missed"
      local tinLive = tinI and tinI >= (p or 1) and state[tinI] ~= "missed"
      if rdy then
        if tinLive then
          a.cat, a.step = "keep", tinI
          a.why = (tinI == hero) and "jetzt abgeben – ist dran" or ("Abgabe in Schritt " .. tinI)
        else
          local how, _, mins = detour()
          if how == "near" then a.cat, a.why = "turnin", "fertig – Abgabe ganz nah"
          elseif how == "worth" then a.cat, a.why = "turnin", string.format("fertig – Umweg %d min lohnt sich", math.floor(mins + 0.5))
          else a.cat, a.why = "delete", how == "far" and string.format("fertig, aber Abgabe zu weit (%d min Umweg)", math.floor((mins or 0) + 0.5)) or "fertig, Abgabe nicht im Plan" end
        end
      elseif cmpLive or (not cmpI and tinLive) then
        -- der Plan entscheidet: auch eine graue Quest bleibt, wenn ihre Abgabe auf dem Weg liegt
        a.cat = "keep"; a.step = cmpLive and cmpI or tinI
        a.why = (a.step == hero) and "ist jetzt dran" or ("im Plan · Schritt " .. a.step)
      elseif R.Grey(e.level or (cmpI and steps[cmpI].ql) or (tinI and steps[tinI].ql), lvl) then
        a.cat, a.why = "delete", "grau – bringt kaum noch XP"
      else
        local ot = objectiveTarget(q)
        local d = ot and distTo(ot)
        if d and d <= R.OBJ_NEAR then a.cat, a.why = "check", "Ziel ist hier – mitnehmen oder löschen"
        else a.cat, a.why = "delete", "übersprungener Teil des Plans" end
      end
    else
      local okey, oroute, oi = otherRoute(q, routeKey, route)
      if rdy then
        local how, _, mins = detour()
        if okey and oi then a.cat, a.why = "keep", "später im Plan (" .. (oroute.name or okey) .. ")"
        elseif how == "near" then a.cat, a.why = "turnin", "fertig – Abgabe ganz nah"
        elseif how == "worth" then a.cat, a.why = "turnin", string.format("fertig – Umweg %d min lohnt sich", math.floor(mins + 0.5))
        else a.cat, a.why = "delete", "fertig, aber nicht im Plan und Abgabe weit weg" end
      elseif R.Grey(e.level, lvl) then a.cat, a.why = "delete", "grau – bringt kaum noch XP"
      elseif okey then
        local minL = oroute.min or 0
        a.cat, a.why = "keep", "später im Plan (" .. (oroute.name or okey) .. (minL > lvl and (", ab St. " .. minL) or "") .. ")"
      elseif tag then a.cat, a.why = "check", tag .. " – nicht im Plan"
      else
        local early = false
        for key, r in pairs(LevelPilot_Routes or {}) do
          if key ~= routeKey and questIndex(r)[q] then early = true; break end
        end
        a.cat, a.why = "delete", early and "aus der vorigen Route – nicht mehr im Plan" or "nicht im Plan"
      end
    end
    if a.cat == "delete" then out.del = out.del + 1
    elseif a.cat == "turnin" then out.tin = out.tin + 1
    elseif a.cat == "check" then out.chk = out.chk + 1
    else out.keep = out.keep + 1 end
    out.list[#out.list + 1] = a
  end
  local ORDER = { delete = 1, turnin = 2, check = 3, keep = 4 }
  table.sort(out.list, function(x, y)
    if ORDER[x.cat] ~= ORDER[y.cat] then return ORDER[x.cat] < ORDER[y.cat] end
    if (x.step or 1e9) ~= (y.step or 1e9) then return (x.step or 1e9) < (y.step or 1e9) end
    return x.q < y.q
  end)
  -- Platzbedarf: wie voll wird das Log auf den naechsten Schritten?
  local cnt = out.used - out.del - out.tin
  local peak, peakAt = cnt, nil
  if p then
    local sim = {}
    for i = p, math.min(#steps, p + 80) do
      local s, st = steps[i], state[i]
      if s.q then
        if s.t == "accept" and (st == "open" or st == "later") then
          cnt = cnt + 1; sim[s.q] = true
          if cnt > peak then peak, peakAt = cnt, i end
        elseif s.t == "turnin" and (st == "open" or sim[s.q]) then cnt = cnt - 1 end
      end
    end
  end
  out.peak, out.peakAt = peak, peakAt
  out.full = peak > out.max
  return out
end

-- Quest im Blizzard-Dialog abbrechen lassen (du bestaetigst selbst)
function R.Abandon(q)
  local okC, can = pcall(function() return not QL.CanAbandonQuest or QL.CanAbandonQuest(q) end)
  if okC and can == false then return false, "kann nicht abgebrochen werden" end
  if QuestMapQuestOptions_AbandonQuest then
    local ok = pcall(QuestMapQuestOptions_AbandonQuest, q)
    if ok then return true end
  end
  local ok = pcall(function()
    local old = QL.GetSelectedQuest and QL.GetSelectedQuest()
    QL.SetSelectedQuest(q)
    QL.SetAbandonQuest()
    local title = QL.GetTitleForQuestID and QL.GetTitleForQuestID(q) or ("Quest " .. q)
    StaticPopup_Show("ABANDON_QUEST", title)
    if old then QL.SetSelectedQuest(old) end
  end)
  return ok, (not ok) and "Blizzard-Dialog nicht verfügbar" or nil
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
