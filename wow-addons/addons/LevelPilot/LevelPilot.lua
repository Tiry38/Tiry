---------------------------------------------------------------------------
-- LevelPilot 4.0.0 (Tiry) · Anthrazit & Neon-Gruen
-- Pfeil zum naechsten Questziel · Liste nach Entfernung · Abgeben-Hinweis
-- Auto-Annehmen/-Abgeben · XP-Cockpit (XP/h, Zeit bis Level, Erholt)
-- Datenquelle: Blizzards eigene Questmarkierungen (nur angenommene Quests).
---------------------------------------------------------------------------
local ADDON = ...
local VERSION = "4.0.0"
local floor, max, min, abs, sqrt, atan2, pi, fmt = math.floor, math.max, math.min, math.abs, math.sqrt, math.atan2, math.pi, string.format
local BT = BackdropTemplateMixin and "BackdropTemplate" or nil
local FONT = STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF"
local WHITE = "Interface\\Buttons\\WHITE8X8"

local NEON  = { 0.22, 1.00, 0.42 }
local NEON2 = { 0.10, 0.75, 0.55 }
local DARK  = { 0.09, 0.10, 0.11 }
local DARK2 = { 0.15, 0.16, 0.18 }
local REST  = { 0.20, 0.75, 1.00 }

local TITLE = "|cff39ff6bLevel|r|cffd8d8d8Pilot|r"
local function P(m) DEFAULT_CHAT_FRAME:AddMessage(TITLE .. " " .. m) end

local DB
local Quiet -- Ton-Sperre (weiter unten definiert)
local Toast -- Meldung oben (weiter unten definiert)
-- Layout/Schalter (werden bei /lp reset zurueckgesetzt)
local DEF = {
  x = -260, y = -120, point = "TOPRIGHT",
  ax = 0, ay = 230, apoint = "CENTER",
  locked = false, collapsed = false, auto = true, arrow = true, rows = 6, toast = true,
  mode = "route", route = nil, pin = true, wege = true, speed = true, beam = true, maxDiff = 5, fly = true,
  ton = "amboss", fade = true,
}
-- Daten (bleiben bei /lp reset erhalten)
local DATA = { skipK = {}, skipLog = {}, nav = {}, ban = {}, qmem = { acc = {}, done = {} } }
local function copy(v)
  if type(v) ~= "table" then return v end
  local o = {}; for k, x in pairs(v) do o[k] = copy(x) end; return o
end

---------------------------------------------------------------------------
-- Hilfen
---------------------------------------------------------------------------
local function Grad(t, o, r1, g1, b1, a1, r2, g2, b2, a2)
  if not t then return end
  if t.SetGradientAlpha then
    pcall(t.SetGradientAlpha, t, o, r1, g1, b1, a1, r2, g2, b2, a2)
  elseif t.SetGradient and CreateColor then
    pcall(t.SetGradient, t, o, CreateColor(r1, g1, b1, a1), CreateColor(r2, g2, b2, a2))
  end
end

local function Tex(p, layer, sub, file, blend)
  local t = p:CreateTexture(nil, layer or "ARTWORK", nil, sub or 0)
  t:SetTexture(file or WHITE)
  if blend then t:SetBlendMode(blend) end
  return t
end

local function FS(p, size, flags)
  local f = p:CreateFontString(nil, "OVERLAY")
  f:SetFont(FONT, size, flags or "OUTLINE")
  f:SetShadowColor(0, 0, 0, 1); f:SetShadowOffset(1, -1)
  return f
end

local CIRCLE = "Interface\\CharacterFrame\\TempPortraitAlphaMask"
local MEDIA = "Interface\\AddOns\\LevelPilot\\Media\\"
local function MT(p, layer, sub, name, blend)
  local t = p:CreateTexture(nil, layer or "ARTWORK", nil, sub or 0)
  t:SetTexture(MEDIA .. name); if blend then t:SetBlendMode(blend) end
  return t
end
-- Texture-Slicing (9-Slice aus einer Grafik) vorhanden?
local SLICE = UIParent.CreateTexture and (function()
  local t = UIParent:CreateTexture(); local ok = t.SetTextureSliceMargins ~= nil; t:Hide(); return ok end)()
local function Slice(t, m) if SLICE then pcall(t.SetTextureSliceMargins, t, m, m, m, m); pcall(t.SetTextureSliceMode, t, 0) end end
local FONT_UI = "Fonts\\ARIALN.TTF"

-- Schrift: modern & schlank (Arial Narrow), weicher Schatten statt dicker Kontur
local function UI(p, size, bold)
  local f = p:CreateFontString(nil, "OVERLAY")
  if not f:SetFont(FONT_UI, size, bold and "OUTLINE" or "") then f:SetFont(FONT, size, "") end
  f:SetShadowColor(0, 0, 0, 0.9); f:SetShadowOffset(1, -1)
  return f
end

-- Abgerundetes Rechteck aus 9 Teilen (Ecken = Viertelkreise)
local RoundOld
local function Round(parent, layer, sub, r, col, blend)
  if SLICE then
    -- eine glatte, gerechnete Rundflaeche statt zusammengesetzter Teile
    local small = r <= 9
    local t = MT(parent, layer or "BACKGROUND", sub or 0, small and "card_s" or "card", blend)
    t:SetAllPoints(); Slice(t, small and 8 or 14)
    local o = { parts = { t } }
    function o:SetColor(cr, cg, cb, ca)
      if t.SetGradient and CreateColor then pcall(t.SetGradient, t, "HORIZONTAL", CreateColor(cr, cg, cb, ca or 1), CreateColor(cr, cg, cb, ca or 1)) end
      t:SetVertexColor(cr, cg, cb, ca or 1)
    end
    function o:SetGradient(c1, c2) t:SetVertexColor(1, 1, 1, 1); Grad(t, "HORIZONTAL", c1[1], c1[2], c1[3], c1[4] or 1, c2[1], c2[2], c2[3], c2[4] or 1) end
    function o:SetShown(v) t:SetShown(v) end
    function o:SetAlpha(v) t:SetAlpha(v) end
    o:SetColor(col[1], col[2], col[3], col[4])
    return o
  end
  return RoundOld(parent, layer, sub, r, col, blend)
end
function RoundOld(parent, layer, sub, r, col, blend)
  local o = { parts = {} }
  local function T(file)
    local t = parent:CreateTexture(nil, layer or "BACKGROUND", nil, sub or 0)
    t:SetTexture(file or WHITE); if blend then t:SetBlendMode(blend) end
    o.parts[#o.parts + 1] = t; return t
  end
  for _, c in ipairs({ { 0, .5, 0, .5, "TOPLEFT" }, { .5, 1, 0, .5, "TOPRIGHT" }, { 0, .5, .5, 1, "BOTTOMLEFT" }, { .5, 1, .5, 1, "BOTTOMRIGHT" } }) do
    local t = T(CIRCLE); t:SetTexCoord(c[1], c[2], c[3], c[4]); t:SetSize(r, r); t:SetPoint(c[5])
  end
  local top = T(); top:SetPoint("TOPLEFT", r, 0); top:SetPoint("TOPRIGHT", -r, 0); top:SetHeight(r)
  local bot = T(); bot:SetPoint("BOTTOMLEFT", r, 0); bot:SetPoint("BOTTOMRIGHT", -r, 0); bot:SetHeight(r)
  local mid = T(); mid:SetPoint("TOPLEFT", 0, -r); mid:SetPoint("BOTTOMRIGHT", 0, r)
  o.left = { o.parts[1], o.parts[3] }; o.right = { o.parts[2], o.parts[4] }; o.span = { top, bot, mid }
  function o:SetColor(cr, cg, cb, ca)
    for _, t in ipairs(self.parts) do
      if t.SetGradient and CreateColor then pcall(t.SetGradient, t, "HORIZONTAL", CreateColor(cr, cg, cb, ca or 1), CreateColor(cr, cg, cb, ca or 1)) end
      t:SetVertexColor(cr, cg, cb, ca or 1)
    end
  end
  -- Farbverlauf links -> rechts ueber die ganze Rundform
  function o:SetGradient(c1, c2)
    for _, t in ipairs(self.left) do t:SetVertexColor(c1[1], c1[2], c1[3], c1[4] or 1) end
    for _, t in ipairs(self.right) do t:SetVertexColor(c2[1], c2[2], c2[3], c2[4] or 1) end
    for _, t in ipairs(self.span) do t:SetVertexColor(1, 1, 1, 1); Grad(t, "HORIZONTAL", c1[1], c1[2], c1[3], c1[4] or 1, c2[1], c2[2], c2[3], c2[4] or 1) end
  end
  function o:SetShown(v) for _, t in ipairs(self.parts) do t:SetShown(v) end end
  function o:SetAlpha(v) for _, t in ipairs(self.parts) do t:SetAlpha(v) end end
  o:SetColor(col[1], col[2], col[3], col[4])
  return o
end

-- Text Buchstabe fuer Buchstabe einfaerben (Neon -> Tuerkis)
-- Blizzards eigene Spielsymbole (Atlas). Mehrere Namen je Typ, der erste vorhandene gewinnt.
local ATLAS = {
  accept   = { "QuestNormal", "Quest-Campaign-Available" },
  turnin   = { "QuestTurnin", "Quest-Campaign-TurnIn" },
  complete = { "QuestObjective", "Crosshair_Quest_48", "Crosshair_questturnin_48" },
  fly      = { "FlightMaster", "TaxiNode_Neutral", "Taxi_Frame_Yellow" },
  hearth   = { "Innkeeper", "poi-town" },
  go       = { "Waypoint-MapPin-Tracked", "Waypoint-MapPin-Untracked", "poi-door" },
  train    = { "Profession", "Class", "trainer" },
  grind    = { "Crosshair_Attack_48", "ShipMissionIcon-Combat-Map" },
  note     = { "poi-workorders", "Crosshair_unableinteract_48" },
}
local atlasOK = {}
-- setzt das Symbol; true = Blizzard-Atlas, false = eigene Grafik
local function SetIcon(tex, typ)
  local hit = atlasOK[typ]
  if hit == nil then
    hit = false
    for _, name in ipairs(ATLAS[typ] or {}) do
      local ok, res = pcall(tex.SetAtlas, tex, name)
      if ok and res ~= false and (not C_Texture or not C_Texture.GetAtlasInfo or C_Texture.GetAtlasInfo(name)) then hit = name; break end
    end
    atlasOK[typ] = hit
  end
  if hit then
    tex:SetAtlas(hit); tex:SetVertexColor(1, 1, 1, 1); return true
  end
  tex:SetTexture(MEDIA .. "i_" .. typ); tex:SetVertexColor(0.04, 0.05, 0.06, 0.92); return false
end

local function GradText(txt, c1, c2)
  local chars = {}
  for ch in txt:gmatch("[%z\1-\127\194-\244][\128-\191]*") do chars[#chars + 1] = ch end
  local out = {}
  for i, ch in ipairs(chars) do
    local t = #chars > 1 and (i - 1) / (#chars - 1) or 0
    out[#out + 1] = fmt("|cff%02x%02x%02x%s|r", floor((c1[1] + (c2[1] - c1[1]) * t) * 255), floor((c1[2] + (c2[2] - c1[2]) * t) * 255), floor((c1[3] + (c2[3] - c1[3]) * t) * 255), ch)
  end
  return table.concat(out)
end
local TEAL = { 0.15, 0.95, 0.85 }

-- Schwebendes Glas-Panel: Neon-Halo, feine Leuchtkante, Anthrazit-Koerper
local function Panel(f, glow)
  if SLICE then
    local gl = CreateFrame("Frame", nil, f); gl:SetPoint("TOPLEFT", -40, 40); gl:SetPoint("BOTTOMRIGHT", 40, -40)
    gl:SetFrameLevel(math.max(0, f:GetFrameLevel() - 1))
    local g = MT(gl, "BACKGROUND", 0, "glow", "ADD"); g:SetAllPoints(); Slice(g, 60)
    g:SetVertexColor(1, 1, 1, 1); Grad(g, "HORIZONTAL", NEON[1], NEON[2], NEON[3], 0.30, TEAL[1], TEAL[2], TEAL[3], 0.18)
    local b = MT(f, "BACKGROUND", 0, "panel"); b:SetAllPoints(); Slice(b, 30)
    f.glow = { SetAlpha = function(_, a) g:SetAlpha(a) end }
    return
  end
  local halo = CreateFrame("Frame", nil, f)
  halo:SetPoint("TOPLEFT", -10, 10); halo:SetPoint("BOTTOMRIGHT", 10, -10); halo:SetFrameLevel(math.max(0, f:GetFrameLevel() - 1))
  f.halo = { Round(halo, "BACKGROUND", 0, 22, { NEON[1], NEON[2], NEON[3], 0.05 }), }
  local h2 = CreateFrame("Frame", nil, f)
  h2:SetPoint("TOPLEFT", -5, 5); h2:SetPoint("BOTTOMRIGHT", 5, -5); h2:SetFrameLevel(math.max(0, f:GetFrameLevel() - 1))
  f.halo[2] = Round(h2, "BACKGROUND", 1, 17, { NEON[1], NEON[2], NEON[3], 0.08 })
  f.edge = Round(f, "BACKGROUND", 2, 14, { NEON[1], NEON[2], NEON[3], 0.45 })
  f.edge:SetGradient({ NEON[1], NEON[2], NEON[3], 0.75 }, { TEAL[1], TEAL[2], TEAL[3], 0.35 })
  local body = CreateFrame("Frame", nil, f)
  body:SetPoint("TOPLEFT", 1, -1); body:SetPoint("BOTTOMRIGHT", -1, 1); body:SetFrameLevel(f:GetFrameLevel())
  f.body = Round(body, "BACKGROUND", 3, 13, { 0.055, 0.063, 0.072, 0.97 })
  f.body:SetGradient({ 0.035, 0.075, 0.06, 0.97 }, { 0.05, 0.055, 0.075, 0.97 })   -- tiefes Gruen -> Nachtblau
  local depth = Tex(body, "BACKGROUND", 5); depth:SetPoint("BOTTOMLEFT", 13, 1); depth:SetPoint("BOTTOMRIGHT", -13, 1); depth:SetHeight(60)
  Grad(depth, "VERTICAL", 0, 0, 0, 0.35, 0, 0, 0, 0)
  -- weicher Lichtschein oben (innerhalb der Rundung)
  local sheen = Tex(body, "BACKGROUND", 4); sheen:SetPoint("TOPLEFT", 13, -1); sheen:SetPoint("TOPRIGHT", -13, -1); sheen:SetHeight(40)
  Grad(sheen, "VERTICAL", 1, 1, 1, 0, NEON[1], NEON[2], NEON[3], 0.07)
  if glow then f.glow = f.halo[2] end
end

local function fmtNum(n)
  if n >= 1e6 then return fmt("%.1fM", n / 1e6) end
  if n >= 1e3 then return fmt("%.1fk", n / 1e3) end
  return tostring(floor(n + 0.5))
end

local function fmtTime(s)
  if not s or s <= 0 or s ~= s or s == math.huge then return "–" end
  if s >= 3600 then return fmt("%d h %02d min", floor(s / 3600), floor((s % 3600) / 60)) end
  if s >= 60 then return fmt("%d min", floor(s / 60 + 0.5)) end
  return fmt("%d s", floor(s))
end

local function fmtDist(y)
  if not y then return "" end
  local m = y * 0.9144
  if m >= 1000 then return fmt("%.1f km", m / 1000) end
  return fmt("%d m", floor(m + 0.5))
end

---------------------------------------------------------------------------
-- Questdaten (Blizzard)
---------------------------------------------------------------------------
local QL = C_QuestLog
local function posOn(mapID)
  local okP, pos = pcall(C_Map.GetPlayerMapPosition, mapID, "player")
  if not okP or not pos then return end
  local x, y = pos.x, pos.y
  if pos.GetXY then x, y = pos:GetXY() end
  return x, y
end

local function playerPos()
  local okM, mapID = pcall(C_Map.GetBestMapForUnit, "player")
  if not okM or not mapID then return end
  return mapID, posOn(mapID)
end

local function mapSize(mapID)
  local ok, w, h = pcall(C_Map.GetMapWorldSize, mapID)
  if ok and w and h and w > 0 and h > 0 then return w, h end
end

local function questLevel(qid)
  local lvl
  pcall(function()
    local idx = QL.GetLogIndexForQuestID(qid)
    local info = idx and QL.GetInfo(idx)
    lvl = info and (info.level or info.difficultyLevel)
  end)
  return lvl
end

local function questProgress(qid)
  local parts, done = {}, true
  pcall(function()
    local objs = QL.GetQuestObjectives(qid)
    for _, o in ipairs(objs or {}) do
      if not o.finished then
        done = false
        if o.numRequired and o.numRequired > 0 then
          parts[#parts + 1] = fmt("%d/%d %s", o.numFulfilled or 0, o.numRequired, (o.text or ""):gsub("^[%d/%s]+", ""):gsub(":.*$", ""))
        else
          parts[#parts + 1] = o.text or ""
        end
      end
    end
  end)
  return table.concat(parts, " · "), done
end

local function readyForTurnIn(qid)
  local r = false
  pcall(function()
    if QL.ReadyForTurnIn then r = QL.ReadyForTurnIn(qid) end
    if not r and QL.IsComplete then r = QL.IsComplete(qid) end
  end)
  return r and true or false
end

local function questXP(qid)
  local ok, xp = pcall(GetQuestLogRewardXP, qid)
  if ok and xp and xp > 0 then return xp end
end

-- Liste: Questziele auf der aktuellen Karte, nach Entfernung
local TARGETS, PIN = {}, nil
local function scanTargets()
  wipe(TARGETS)
  local mapID = playerPos()
  if not mapID then return end
  -- in Staedten/Unterkarten stehen die Quests oft auf der uebergeordneten Zone
  local list
  for _ = 1, 3 do
    local ok, l = pcall(QL.GetQuestsOnMap, mapID)
    if ok and type(l) == "table" and #l > 0 then list = l; break end
    local okI, info = pcall(C_Map.GetMapInfo, mapID)
    if not okI or not info or not info.parentMapID or info.parentMapID == 0 then break end
    if info.mapType and Enum and Enum.UIMapType and info.mapType <= Enum.UIMapType.Continent then break end
    mapID = info.parentMapID
  end
  if not list then return end
  local px, py = posOn(mapID)
  local w, h = mapSize(mapID)
  for _, q in ipairs(list) do
    if q.questID and q.x and q.y then
      local title = QL.GetTitleForQuestID and QL.GetTitleForQuestID(q.questID) or ("Quest " .. q.questID)
      local prog, alldone = questProgress(q.questID)
      local t = {
        id = q.questID, x = q.x, y = q.y, map = mapID, title = title or "?",
        lvl = questLevel(q.questID), prog = prog, turnin = readyForTurnIn(q.questID) or alldone,
        xp = questXP(q.questID),
      }
      if px and w then
        local dx, dy = (q.x - px) * w, (q.y - py) * h
        t.dist = sqrt(dx * dx + dy * dy)
        t.east, t.north = dx, -dy
      end
      TARGETS[#TARGETS + 1] = t
    end
  end
  table.sort(TARGETS, function(a, b)
    if (a.dist ~= nil) ~= (b.dist ~= nil) then return a.dist ~= nil end
    return (a.dist or 0) < (b.dist or 0)
  end)
end

-- Routen-Zustand
local RT = { key = nil, idx = nil, list = {}, cur = nil }
local function routeUpdate()
  if not (DB and LP_Route) then return end
  local R = LP_Route
  local _, faction = UnitFactionGroup("player")
  local lvl = UnitLevel("player")
  RT.key = R.Pick(faction, lvl, DB.route)
  local route = RT.key and LevelPilot_Routes[RT.key]
  DB.skipK[RT.key or "-"] = DB.skipK[RT.key or "-"] or {}
  local idx, list = R.Current(route, lvl, DB.skipK[RT.key or "-"], DB.rows or 6, RT.cur)
  if idx ~= RT.idx then RT.cur = idx and { i = idx, since = GetTime() } or nil end
  RT.idx, RT.list = idx, list or {}
end

-- Schritt ueberspringen / zurueckholen (ueber stabilen Schluessel, nicht ueber die Nummer)
local function SkipStep(i)
  local route = RT.key and LevelPilot_Routes[RT.key]
  local s = route and i and route.steps[i]
  if not s then return end
  local k = LP_Route.StepKey(s)
  DB.skipK[RT.key] = DB.skipK[RT.key] or {}
  DB.skipK[RT.key][k] = true
  table.insert(DB.skipLog, { r = RT.key, k = k })
  while #DB.skipLog > 50 do table.remove(DB.skipLog, 1) end
end

local function routeTarget()
  local route = RT.key and LevelPilot_Routes[RT.key]
  local s = route and RT.idx and route.steps[RT.idx]
  if not s then return end
  local t = LP_Route.StepTarget(s)
  if not t then return { title = LP_Route.StepTitle(s), step = s } end
  t.title = LP_Route.StepTitle(s); t.step = s; t.turnin = (s.t == "turnin")
  return t
end

local function baseTarget()
  if DB and DB.mode == "route" then return routeTarget() end
  if PIN then
    for _, t in ipairs(TARGETS) do if t.id == PIN then return t end end
    PIN = nil
  end
  return TARGETS[1]
end

-- Fliegen schneller als Laufen? Dann fuehrt der Pfeil zuerst zum Flugmeister.
local FLYIGN, FLYADV = {}, nil
local function currentTarget()
  local t = baseTarget()
  FLYADV = nil
  if LP_Fly then LP_Fly.want = nil end
  if not t or not t.map or not (DB and DB.fly ~= false) or not LP_Fly then return t end
  local key = tostring(t.title) .. ":" .. t.map
  local ok, adv = pcall(LP_Fly.Advice, t, key)
  if not ok or not adv then return t end
  adv.key = key; FLYADV = adv
  if FLYIGN[key] or adv.kind == "hearth" then return t end   -- Ruhestein: Pfeil bleibt beim Ziel
  LP_Fly.want = adv.to
  return { title = "Flugmeister " .. adv.from, map = adv.fmap, x = adv.fx, y = adv.fy,
    step = { t = "fly", note = "Flug nach " .. adv.to }, fly = adv }
end

---------------------------------------------------------------------------
-- XP-Cockpit
---------------------------------------------------------------------------
local XPS = { start = nil, gained = 0, lastXP = nil, lastMax = nil }
local function xpTrack()
  local cur, mx = UnitXP("player"), UnitXPMax("player")
  if not XPS.start then XPS.start = GetTime() end
  if XPS.lastXP then
    if cur >= XPS.lastXP then XPS.gained = XPS.gained + (cur - XPS.lastXP)
    else XPS.gained = XPS.gained + ((XPS.lastMax or 0) - XPS.lastXP) + cur end -- Levelaufstieg
  end
  XPS.lastXP, XPS.lastMax = cur, mx
end
local function xpPerHour()
  if not XPS.start then return 0 end
  local t = GetTime() - XPS.start
  if t < 60 then return 0 end
  return XPS.gained / t * 3600
end

---------------------------------------------------------------------------
-- Hauptfenster
---------------------------------------------------------------------------
local W, ROWH = 336, 34
local M = CreateFrame("Frame", "LevelPilotFrame", UIParent)
M:SetSize(W, 120)
M:SetClampedToScreen(true)
M:SetMovable(true); M:EnableMouse(true); M:RegisterForDrag("LeftButton")
M:SetScript("OnDragStart", function(s) if not DB.locked then s:StartMoving() end end)
M:SetScript("OnDragStop", function(s)
  s:StopMovingOrSizing()
  local p, _, _, x, y = s:GetPoint(); DB.point, DB.x, DB.y = p, x, y
end)
Panel(M, true)

local head = UI(M, 17, true); head:SetPoint("TOPLEFT", 14, -11)
head:SetText(GradText("LEVELPILOT", NEON, TEAL))
local subHead = UI(M, 10); subHead:SetPoint("TOPLEFT", head, "BOTTOMLEFT", 1, -1); subHead:SetTextColor(0.55, 0.6, 0.62)

local function Pill(txt, w, fn)
  local b = CreateFrame("Button", nil, M)
  b:SetSize(w, 18)
  b.bg = Round(b, "BACKGROUND", 0, 9, { 1, 1, 1, 0.06 })
  b.on = Round(b, "BORDER", 0, 9, { NEON[1], NEON[2], NEON[3], 0.18 })
  b.on:SetGradient({ NEON[1], NEON[2], NEON[3], 0.32 }, { TEAL[1], TEAL[2], TEAL[3], 0.14 })
  b.hl = Round(b, "HIGHLIGHT", 0, 9, { NEON[1], NEON[2], NEON[3], 0.15 })
  b.t = UI(b, 10, true); b.t:SetPoint("CENTER", 0, 0); b.t:SetText(txt)
  b:SetScript("OnClick", fn)
  function b:Set(active, label)
    self.on:SetShown(active)
    self.t:SetText(label or self.t:GetText())
    self.t:SetTextColor(active and NEON[1] or 0.62, active and NEON[2] or 0.65, active and NEON[3] or 0.68)
  end
  return b
end

local Refresh -- vorab
local bCol = Pill("–", 22, function() DB.collapsed = not DB.collapsed; Refresh(true) end)
bCol:SetPoint("TOPRIGHT", -12, -12)
local bAuto = Pill("AUTO", 44, function()
  DB.auto = not DB.auto; P("Auto-Annehmen/-Abgeben: " .. (DB.auto and "|cff39ff6ban|r" or "|cffff5050aus|r")); Refresh(true)
end)
bAuto:SetPoint("RIGHT", bCol, "LEFT", -5, 0)
local bArrow = Pill("PFEIL", 44, function() DB.arrow = not DB.arrow; Refresh(true) end)
bArrow:SetPoint("RIGHT", bAuto, "LEFT", -5, 0)
local bMode = Pill("ROUTE", 54, function()
  DB.mode = (DB.mode == "route") and "quests" or "route"; Refresh(true)
end)
bMode:SetPoint("RIGHT", bArrow, "LEFT", -5, 0)

-- XP-Kapsel
local XPW = W - 28
local xpFrame = CreateFrame("Frame", nil, M)
xpFrame:SetPoint("TOPLEFT", 14, -50); xpFrame:SetSize(XPW, 12)
Round(xpFrame, "BACKGROUND", 0, 6, { 0, 0, 0, 0.55 })
local xpRestF = CreateFrame("Frame", nil, xpFrame); xpRestF:SetPoint("TOPLEFT"); xpRestF:SetHeight(12); xpRestF:SetWidth(12)
local xpRestR = Round(xpRestF, "BORDER", 0, 6, { REST[1], REST[2], REST[3], 0.35 })
xpRestR:SetGradient({ REST[1], REST[2], REST[3], 0.15 }, { REST[1], REST[2], REST[3], 0.45 })
local xpFill = CreateFrame("Frame", nil, xpFrame); xpFill:SetPoint("TOPLEFT"); xpFill:SetHeight(12); xpFill:SetWidth(12)
xpFill:SetFrameLevel(xpRestF:GetFrameLevel() + 1)
local xpFillR = Round(xpFill, "ARTWORK", 0, 6, { NEON[1], NEON[2], NEON[3], 1 })
xpFillR:SetGradient({ 0.05, 0.62, 0.55, 1 }, { NEON[1], NEON[2], NEON[3], 1 })
local xpGrad = Tex(xpFill, "ARTWORK", 1); xpGrad:SetPoint("TOPLEFT", 6, 0); xpGrad:SetPoint("BOTTOMRIGHT", -6, 0)
Grad(xpGrad, "HORIZONTAL", NEON2[1], NEON2[2], NEON2[3], 1, NEON[1], NEON[2], NEON[3], 1)
local xpGloss = Tex(xpFill, "OVERLAY", 0); xpGloss:SetPoint("TOPLEFT", 6, -1); xpGloss:SetPoint("TOPRIGHT", -6, -1); xpGloss:SetHeight(4)
xpGloss:SetVertexColor(1, 1, 1, 0.22)
local xpSpark = MT(xpFrame, "OVERLAY", 2, "dot", "ADD"); xpSpark:SetSize(22, 22); xpSpark:SetVertexColor(0.75, 1, 0.85, 0.9)
local xpTxt = UI(M, 10); xpTxt:SetPoint("BOTTOMRIGHT", xpFrame, "TOPRIGHT", 0, 3); xpTxt:SetTextColor(0.75, 0.8, 0.82)
local xpRestFrame, xpBar = xpRestF, xpFrame -- Kompatibilitaet

-- Info-Chips
local CHIPS = {}
for i = 1, 3 do
  local c = CreateFrame("Frame", nil, M)
  c:SetSize((W - 28 - 12) / 3, 34)
  c:SetPoint("TOPLEFT", xpFrame, "BOTTOMLEFT", (i - 1) * ((W - 28 - 12) / 3 + 6), -8)
  Round(c, "BACKGROUND", 0, 10, { 1, 1, 1, 0.045 }):SetGradient({ 1, 1, 1, 0.075 }, { NEON[1], NEON[2], NEON[3], 0.035 })
  c.ic = MT(c, "ARTWORK", 0, ({ "i_xph", "i_need", "i_time" })[i]); c.ic:SetSize(14, 14); c.ic:SetPoint("TOPLEFT", 8, -6)
  c.ic:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.9)
  c.v = UI(c, 14, true); c.v:SetPoint("TOP", 6, -4)
  c.l = UI(c, 9); c.l:SetPoint("BOTTOM", 0, 4); c.l:SetTextColor(0.5, 0.55, 0.58)
  CHIPS[i] = c
end
CHIPS[1].l:SetText("XP / STUNDE"); CHIPS[2].l:SetText("FEHLENDE XP"); CHIPS[3].l:SetText("BIS LEVEL UP")
local stat = UI(M, 1) -- alte Statuszeile (unsichtbar)

-- Karten (Schritte / Quests)
local ROWS = {}
local listTop = -116
local SYM = { accept = "!", turnin = "?", complete = "×", fly = "»", hearth = "»", go = "»", train = "+", grind = "×", note = "i" }
for i = 1, 10 do
  local r = CreateFrame("Button", nil, M)
  r:SetHeight(30)
  r.bgR = Round(r, "BACKGROUND", 0, 10, { 1, 1, 1, 0.04 })
  r.bgR:SetGradient({ 1, 1, 1, 0.065 }, { 1, 1, 1, 0.015 })
  r.sel = Round(r, "BORDER", 0, 10, { NEON[1], NEON[2], NEON[3], 0.10 })
  r.sel:SetGradient({ NEON[1], NEON[2], NEON[3], 0.26 }, { TEAL[1], TEAL[2], TEAL[3], 0.03 })
  r.selEdge = Tex(r, "BORDER", 1); r.selEdge:SetPoint("TOPLEFT", 10, 0); r.selEdge:SetPoint("TOPRIGHT", -10, 0); r.selEdge:SetHeight(1)
  Grad(r.selEdge, "HORIZONTAL", NEON[1], NEON[2], NEON[3], 0.8, TEAL[1], TEAL[2], TEAL[3], 0)
  Round(r, "HIGHLIGHT", 0, 10, { NEON[1], NEON[2], NEON[3], 0.08 })
  r.halo = MT(r, "ARTWORK", 0, "dot", "ADD"); r.halo:SetSize(40, 40)
  r.bar = MT(r, "ARTWORK", 1, "orb"); r.bar:SetSize(22, 22)            -- leuchtende Kugel in Typ-Farbe
  r.icon = MT(r, "ARTWORK", 2, "i_note"); r.icon:SetPoint("CENTER", r.bar, "CENTER"); r.icon:SetVertexColor(0.04, 0.05, 0.06, 0.92)
  r.sym = UI(r, 13, true); r.sym:SetPoint("CENTER", r.bar, "CENTER", 0, 0); r.sym:SetTextColor(0.05, 0.06, 0.07)
  r.title = UI(r, 12, true); r.title:SetJustifyH("LEFT"); r.title:SetWordWrap(false)
  r.sub = UI(r, 10); r.sub:SetJustifyH("LEFT"); r.sub:SetWordWrap(false); r.sub:SetTextColor(0.55, 0.6, 0.62)
  r.dist = UI(r, 13, true); r.dist:SetJustifyH("RIGHT")
  r.tag = UI(r, 9, true); r.tag:SetJustifyH("RIGHT")
  r.kind = UI(r, 10, true); r.kind:SetJustifyH("LEFT"); r.kind:SetWordWrap(false)
  r.eta = UI(r, 10); r.eta:SetJustifyH("RIGHT"); r.eta:SetTextColor(0.62, 0.68, 0.7)
  function r:Style(kind)
    local hero = kind == "hero"
    self:SetHeight(hero and 68 or (kind == "quest" and 40 or 26))
    local bs = hero and 32 or (kind == "quest" and 20 or 16)
    self.bar:ClearAllPoints(); self.bar:SetPoint("LEFT", hero and 12 or 9, 0); self.bar:SetSize(bs, bs)
    self.halo:ClearAllPoints(); self.halo:SetPoint("CENTER", self.bar, "CENTER"); self.halo:SetSize(bs * 2.2, bs * 2.2)
    self.halo:SetShown(hero); self.sym:Hide()
    self.icon:SetSize(bs * 0.62, bs * 0.62)
    local tx = (hero and 12 or 9) + bs + 10
    for _, f in ipairs({ self.title, self.sub, self.dist, self.tag, self.kind, self.eta }) do f:ClearAllPoints() end
    if hero then
      self.kind:Show(); self.eta:Show(); self.sub:Show(); self.tag:Hide()
      self.kind:SetPoint("TOPLEFT", tx, -9); self.kind:SetPoint("RIGHT", -72, 0)
      self.title:SetFont(FONT_UI, 14, "OUTLINE"); self.title:SetPoint("TOPLEFT", self.kind, "BOTTOMLEFT", 0, -3); self.title:SetPoint("RIGHT", -72, 0)
      self.sub:SetPoint("TOPLEFT", self.title, "BOTTOMLEFT", 0, -4); self.sub:SetPoint("RIGHT", -10, 0)
      self.dist:SetFont(FONT_UI, 17, "OUTLINE"); self.dist:SetPoint("TOPRIGHT", -12, -9)
      self.eta:SetPoint("TOPRIGHT", self.dist, "BOTTOMRIGHT", 0, -4)
    elseif kind == "compact" then
      self.kind:Hide(); self.eta:Hide(); self.sub:Hide(); self.tag:Show()
      self.title:SetFont(FONT_UI, 12, ""); self.title:SetPoint("LEFT", tx, 0); self.title:SetPoint("RIGHT", -66, 0)
      self.dist:SetFont(FONT_UI, 11, ""); self.dist:SetPoint("RIGHT", -10, 0)
      self.tag:SetPoint("RIGHT", -10, 0)
    else
      self.kind:Hide(); self.eta:Hide(); self.sub:Show(); self.tag:Show()
      self.title:SetFont(FONT_UI, 12, ""); self.title:SetPoint("TOPLEFT", tx, -6); self.title:SetPoint("RIGHT", -74, 0)
      self.sub:SetPoint("TOPLEFT", self.title, "BOTTOMLEFT", 0, -3); self.sub:SetPoint("RIGHT", -74, 0)
      self.dist:SetFont(FONT_UI, 12, "OUTLINE"); self.dist:SetPoint("TOPRIGHT", -12, -6)
      self.tag:SetPoint("TOPRIGHT", self.dist, "BOTTOMRIGHT", 0, -4)
    end
  end
  r:Style("compact")
  r:RegisterForClicks("LeftButtonUp", "RightButtonUp")
  r:SetScript("OnClick", function(self, btn)
    if DB.mode == "route" then
      if btn == "RightButton" and self.stepIdx and RT.key then
        local st = LevelPilot_Routes[RT.key].steps[self.stepIdx]
        if st and st.q then
          -- Quest komplett sperren: annehmen, erledigen und abgeben fallen weg
          DB.ban[st.q] = true; LP_Route.ban = DB.ban
          P("|cffff5050Gesperrt:|r " .. LP_Route.StepTitle(st) .. " – kommt nie wieder. Hast du sie schon, im Questlog abbrechen.  |cff8a8f93(/lp entsperren)|r")
          Toast("|cffff5050GESPERRT|r  ·  " .. LP_Route.StepTitle(st))
        else
          SkipStep(self.stepIdx)
          P("Schritt übersprungen. Zurückholen: /lp zurueck")
        end
        Refresh(true)
      end
      return
    end
    if not self.qid then return end
    if btn == "RightButton" or PIN == self.qid then PIN = nil else PIN = self.qid end
    Refresh(true)
  end)
  r:SetScript("OnEnter", function(self)
    if DB.mode == "route" and self.stepIdx then
      GameTooltip:SetOwner(self, "ANCHOR_LEFT")
      GameTooltip:AddLine(self.tTitle or "", NEON[1], NEON[2], NEON[3])
      if self.tProg and self.tProg ~= "" then GameTooltip:AddLine(self.tProg, 1, 1, 1, true) end
      if self.group and #self.group > 1 then
        local route = LevelPilot_Routes[RT.key]
        for _, gi in ipairs(self.group) do GameTooltip:AddLine("· " .. LP_Route.StepTitle(route.steps[gi]), 0.85, 0.9, 0.9) end
      end
      GameTooltip:AddLine("Rechtsklick: " .. ((self.group and #self.group > 1) and "erste Quest sperren" or "Quest sperren (kommt nie wieder)"), 0.55, 0.58, 0.6)
      GameTooltip:Show()
      return
    end
    if not self.qid then return end
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:AddLine(self.tTitle or "", NEON[1], NEON[2], NEON[3])
    if self.tProg and self.tProg ~= "" then GameTooltip:AddLine(self.tProg, 1, 1, 1, true) end
    if self.tXP then GameTooltip:AddLine("Belohnung: " .. fmtNum(self.tXP) .. " XP", 0.6, 0.9, 1) end
    GameTooltip:AddLine("Linksklick: Pfeil festhalten · Rechtsklick: lösen", 0.55, 0.58, 0.6)
    GameTooltip:Show()
  end)
  r:SetScript("OnLeave", function() GameTooltip:Hide() end)
  r:Hide()
  ROWS[i] = r
end

-- Karten untereinander anordnen, liefert Gesamthoehe der Liste
local function LayoutRows(n, mode)
  local y = listTop
  for i = 1, n do
    local r = ROWS[i]
    r:Style(mode == "route" and (i == 1 and "hero" or "compact") or "quest")
    r:ClearAllPoints()
    r:SetPoint("TOPLEFT", 12, y); r:SetPoint("TOPRIGHT", -12, y)
    y = y - r:GetHeight() - (i == 1 and mode == "route" and 8 or 4)
  end
  return -y
end
local empty = UI(M, 11); empty:SetPoint("TOPLEFT", 16, listTop - 6); empty:SetTextColor(0.6, 0.65, 0.68)
empty:SetText("Keine angenommenen Quests auf dieser Karte.\nNeue Quests zeigt dir Questie (gelbes !).")
empty:SetJustifyH("LEFT")

-- Flug-Hinweis (Karte unter der Liste)
local FB = CreateFrame("Button", nil, M); FB:SetHeight(46); FB:Hide()
local fbEdge = Round(FB, "BACKGROUND", 0, 12, { 1, 1, 1, 1 })
fbEdge:SetGradient({ 0.31, 0.82, 1, 0.85 }, { 0.22, 1, 0.42, 0.55 })
local fbBody = CreateFrame("Frame", nil, FB); fbBody:SetPoint("TOPLEFT", 1, -1); fbBody:SetPoint("BOTTOMRIGHT", -1, 1)
Round(fbBody, "BACKGROUND", 1, 11, { 1, 1, 1, 1 }):SetGradient({ 0.03, 0.09, 0.13, 0.97 }, { 0.04, 0.06, 0.07, 0.97 })
local fbIcon = fbBody:CreateTexture(nil, "ARTWORK"); fbIcon:SetSize(28, 28); fbIcon:SetPoint("LEFT", 9, 0)
local fbT = UI(fbBody, 14, true); fbT:SetPoint("TOPLEFT", 46, -7); fbT:SetPoint("RIGHT", -8, 0); fbT:SetJustifyH("LEFT"); fbT:SetWordWrap(false)
local fbS = UI(fbBody, 11); fbS:SetPoint("TOPLEFT", fbT, "BOTTOMLEFT", 0, -4); fbS:SetPoint("RIGHT", -8, 0); fbS:SetJustifyH("LEFT"); fbS:SetWordWrap(false)
fbS:SetTextColor(0.78, 0.84, 0.88)
FB:SetScript("OnClick", function()
  if FLYADV then FLYIGN[FLYADV.key] = (not FLYIGN[FLYADV.key]) or nil; if Refresh then Refresh() end end
end)
FB:SetScript("OnEnter", function(self)
  local a = FLYADV; if not a then return end
  GameTooltip:SetOwner(self, "ANCHOR_LEFT")
  GameTooltip:AddLine("Fliegen oder laufen?", 0.31, 0.82, 1)
  GameTooltip:AddLine(fmt("Laufen: ca. %s  ·  Fliegen: ca. %s (inkl. Weg zum Flugmeister)", fmtTime(a.run), fmtTime(a.fly)), 1, 1, 1, true)
  GameTooltip:AddLine("Flug: " .. a.from .. "  →  " .. a.to, 0.8, 0.85, 0.9, true)
  if not a.sure then GameTooltip:AddLine("Sprich einmal einen Flugmeister an – dann kenne ich deine entdeckten Flugpunkte genau.", 1, 0.82, 0.3, true) end
  if DB.auto then GameTooltip:AddLine("Am Flugmeister wird der Flug automatisch gewählt (Umschalt halten = nicht).", 0.6, 0.9, 1, true) end
  GameTooltip:AddLine("Klick: " .. (FLYIGN[a.key] and "doch fliegen" or "lieber laufen"), 0.55, 0.58, 0.6)
  GameTooltip:Show()
end)
FB:SetScript("OnLeave", function() GameTooltip:Hide() end)
-- y = Unterkante der Liste (negativ); liefert die Zusatzhoehe
local function FlyBanner(y)
  pcall(currentTarget)
  local a = FLYADV
  if not DB or DB.collapsed or not a then FB:Hide(); return 0 end
  if not SetIcon(fbIcon, "fly") then fbIcon:SetVertexColor(0.31, 0.82, 1, 1) end
  if a.kind == "hearth" then
    SetIcon(fbIcon, "hearth")
    fbT:SetText(fmt("|cff4fd2ffRUHESTEIN SPART CA. %s|r", fmtTime(a.save):upper()))
    fbS:SetText(fmt("Nach %s  ·  Laufen %s, Ruhestein %s", a.to, fmtTime(a.run), fmtTime(a.fly)))
  elseif FLYIGN[a.key] then
    fbT:SetText("|cff8a8f93LAUFEN GEWÄHLT|r")
    fbS:SetText(fmt("Fliegen wäre ca. %s schneller  ·  Klick: doch fliegen", fmtTime(a.save)))
  elseif a.atFM then
    fbT:SetText("|cff4fd2ffJETZT FLIEGEN|r  |cffffffff→ " .. a.to .. "|r")
    fbS:SetText(DB.auto and "Flugmeister ansprechen – Flug wird automatisch gewählt" or "Flugmeister ansprechen")
  else
    fbT:SetText(fmt("|cff4fd2ffFLIEGEN SPART CA. %s|r", fmtTime(a.save):upper()))
    fbS:SetText(fmt("%s → %s  ·  Laufen %s · Fliegen %s%s", a.from, a.to, fmtTime(a.run), fmtTime(a.fly), a.sure and "" or "  ·  |cffffd24d?|r"))
  end
  FB:ClearAllPoints(); FB:SetPoint("TOPLEFT", 12, y - 6); FB:SetPoint("TOPRIGHT", -12, y - 6)
  FB:Show()
  return 56
end

---------------------------------------------------------------------------
-- Pfeil
---------------------------------------------------------------------------
local A = CreateFrame("Frame", "LevelPilotArrow", UIParent)
A:SetSize(64, 64)
A:SetClampedToScreen(true)
A:SetMovable(true); A:EnableMouse(true); A:RegisterForDrag("LeftButton")
A:SetScript("OnDragStart", function(s) if not DB.locked then s:StartMoving() end end)
A:SetScript("OnDragStop", function(s)
  s:StopMovingOrSizing()
  local p, _, _, x, y = s:GetPoint(); DB.apoint, DB.ax, DB.ay = p, x, y
end)
A:SetSize(96, 96)
local ring = MT(A, "BACKGROUND", 0, "dot", "ADD")                    -- weiches Neon-Leuchten
ring:SetPoint("CENTER"); ring:SetSize(190, 190); ring:SetVertexColor(NEON[1], NEON[2], NEON[3], 1); ring:SetAlpha(0.3)
local compass = MT(A, "BACKGROUND", 1, "compass")                    -- Glas-Kompass mit Skala
compass:SetPoint("CENTER"); compass:SetSize(96, 96)
local arrowGlow = MT(A, "ARTWORK", 0, "arrow_glow", "ADD"); arrowGlow:SetPoint("CENTER"); arrowGlow:SetSize(70, 70)
arrowGlow:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.9)
local arrow = MT(A, "ARTWORK", 1, "arrow"); arrow:SetPoint("CENTER"); arrow:SetSize(52, 52)
local rim = arrowGlow
local disc, discSheen = compass, compass
local aPill = CreateFrame("Frame", nil, A); aPill:SetSize(168, 28); aPill:SetPoint("TOP", A, "BOTTOM", 0, -6)
local aPillEdge = Round(aPill, "BACKGROUND", 0, 14, { 1, 1, 1, 1 })
aPillEdge:SetGradient({ NEON[1], NEON[2], NEON[3], 0.8 }, { TEAL[1], TEAL[2], TEAL[3], 0.5 })
local aPillBody = CreateFrame("Frame", nil, aPill); aPillBody:SetPoint("TOPLEFT", 1, -1); aPillBody:SetPoint("BOTTOMRIGHT", -1, 1)
Round(aPillBody, "BACKGROUND", 1, 13, { 1, 1, 1, 1 }):SetGradient({ 0.03, 0.07, 0.06, 0.95 }, { 0.05, 0.055, 0.08, 0.95 })
local aIcon = MT(aPillBody, "ARTWORK", 0, "i_go"); aIcon:SetSize(14, 14); aIcon:SetPoint("LEFT", 9, 0); aIcon:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
local aDist = UI(aPillBody, 14, true); aDist:SetPoint("CENTER", 6, 0)
local aName = UI(A, 12, true); aName:SetPoint("TOP", aPill, "BOTTOM", 0, -4); aName:SetWidth(280); aName:SetWordWrap(false)
local aHere = UI(A, 20, true); aHere:SetPoint("CENTER"); aHere:SetText("|cff39ff6bDA!|r"); aHere:Hide()

-- Fertig-Meldung: schwebende Neon-Pille
local T = CreateFrame("Frame", nil, UIParent)
T:SetSize(440, 44); T:SetPoint("CENTER", UIParent, "CENTER", 0, 160); T:SetFrameStrata("HIGH"); T:Hide()
local tGlow = CreateFrame("Frame", nil, T); tGlow:SetPoint("TOPLEFT", -8, 8); tGlow:SetPoint("BOTTOMRIGHT", 8, -8)
Round(tGlow, "BACKGROUND", 0, 30, { NEON[1], NEON[2], NEON[3], 0.12 })
Round(T, "BACKGROUND", 1, 22, { NEON[1], NEON[2], NEON[3], 0.55 })
local tBody = CreateFrame("Frame", nil, T); tBody:SetPoint("TOPLEFT", 1, -1); tBody:SetPoint("BOTTOMRIGHT", -1, 1)
Round(tBody, "BACKGROUND", 2, 21, { 0.045, 0.05, 0.058, 0.95 })
local tTxt = UI(tBody, 17, true); tTxt:SetPoint("CENTER")
local toastT = 0
function Toast(msg)
  if not DB.toast then return end
  tTxt:SetText(msg); toastT = 3; T:SetAlpha(1); T:Show()
  pcall(PlaySound, (SOUNDKIT and SOUNDKIT.UI_QUEST_COMPLETE) or 878, "SFX")
end

---------------------------------------------------------------------------
-- Zeichnen
---------------------------------------------------------------------------
local function levelColor(lvl)
  if lvl and GetQuestDifficultyColor then
    local ok, c = pcall(GetQuestDifficultyColor, lvl)
    if ok and c then return c.r, c.g, c.b end
  end
  return 0.8, 0.8, 0.8
end

local function hex(col) return tonumber(col:sub(1, 2), 16) / 255, tonumber(col:sub(3, 4), 16) / 255, tonumber(col:sub(5, 6), 16) / 255 end

function Refresh(rescan)
  if not DB then return end
  if rescan then scanTargets() end
  bAuto:Set(DB.auto); bArrow:Set(DB.arrow)
  bCol:Set(false, DB.collapsed and "+" or "–")
  bMode:Set(true, DB.mode == "route" and "ROUTE" or "QUESTS")

  -- XP-Kapsel
  local cur, mx = UnitXP("player"), max(1, UnitXPMax("player"))
  local rest = GetXPExhaustion() or 0
  local pct = cur / mx
  local fw = max(12, XPW * pct)
  xpFill:SetWidth(fw)
  xpSpark:ClearAllPoints(); xpSpark:SetPoint("CENTER", xpFrame, "LEFT", fw - 4, 0)
  xpRestF:SetWidth(min(XPW, max(12, XPW * (cur + rest) / mx))); xpRestF:SetShown(rest > 0)
  local lvl = UnitLevel("player")
  xpTxt:SetText(fmt("|cffffffffStufe %d|r  ·  %.1f%%%s", lvl, pct * 100, rest > 0 and fmt("  ·  |cff66ccffErholt %d%%|r", floor(rest / mx * 100 + 0.5)) or ""))
  local xph = xpPerHour()
  local need = mx - cur
  CHIPS[1].v:SetText(xph > 0 and ("|cff39ff6b" .. fmtNum(xph) .. "|r") or "|cff6b7076–|r")
  CHIPS[2].v:SetText("|cffffffff" .. fmtNum(need) .. "|r")
  CHIPS[3].v:SetText(xph > 0 and ("|cff39ff6b" .. fmtTime(need / xph * 3600) .. "|r") or "|cff6b7076–|r")

  local COL = { accept = "ffd24d", turnin = "39ff6b", complete = "e8eef0", fly = "4fd2ff", hearth = "4fd2ff",
    train = "c78bff", go = "4fd2ff", grind = "ff8a3d", note = "aaaaaa" }

  if DB.mode == "route" then
    routeUpdate()
    local route = RT.key and LevelPilot_Routes[RT.key]
    -- Eintraege bilden: gleiche Aufgabe beim gleichen NPC wird EIN Eintrag ("3 Quests annehmen")
    local items, byKey = {}, {}
    for _, si in ipairs(RT.list) do
      local st = route and route.steps[si]
      if st then
        local gk
        local stt = LP_Route.state and LP_Route.state[si]
        if stt == "open" and (st.t == "accept" or (st.t == "turnin" and st.q and LP_Route.Ready(st.q))) then
          local tg = LP_Route.StepTarget(st)
          if tg and tg.npc then gk = st.t .. ":" .. tg.npc end
        end
        local it = gk and byKey[gk]
        if it then table.insert(it.steps, si)
        else
          it = { steps = { si }, key = gk }; items[#items + 1] = it
          if gk then byKey[gk] = it end
        end
      end
    end
    RT.items = items
    local heroStep = route and RT.idx and route.steps[RT.idx]
    subHead:SetText(route and ((DB.speed and "|cff39ff6bSPEED|r  ·  " or "") .. ((heroStep and heroStep.z) and ("|cffd8dde0" .. heroStep.z .. "|r  ·  ") or "") .. (route.name or "")) or "keine Route")
    local n = DB.collapsed and 0 or math.min(#items, DB.rows or 6)
    local listH = LayoutRows(n, "route")
    local heroT = heroStep and LP_Route.StepTarget(heroStep)
    for i, r in ipairs(ROWS) do
      local it = items[i]
      local si = it and it.steps[1]
      local st = si and route and route.steps[si]
      if i <= n and st then
        local cnt = #it.steps
        local titles = {}
        for _, gi in ipairs(it.steps) do titles[#titles + 1] = LP_Route.StepTitle(route.steps[gi]) end
        local title = cnt > 1 and table.concat(titles, "  ·  ") or titles[1]
        local col = COL[st.t] or "ffffff"
        local cr, cg, cb = hex(col)
        local label = (LP_Route.TYPE[st.t] or st.t)
        r.stepIdx, r.qid, r.group = si, st.q, it.steps
        r.tTitle = (cnt > 1 and (cnt .. " Quests " .. label:lower()) or label) .. (cnt > 1 and "" or (": " .. title))
        local sub = {}
        if st.t == "complete" and st.q then
          local pr = questProgress(st.q); if pr ~= "" then sub[#sub + 1] = pr end
        end
        if st.t == "grind" then sub[#sub + 1] = "Stufe " .. (st.to or "?") .. " erreichen" end
        if st.note then sub[#sub + 1] = st.note end
        r.tProg = table.concat(sub, " · ") .. ((st.z and ("  |cff8a8f93" .. st.z .. "|r")) or "")
        r.bar:SetVertexColor(cr, cg, cb, 1)
        r.halo:SetVertexColor(cr, cg, cb, 0.35)
        local atlas = SetIcon(r.icon, st.t or "note")
        r.bar:SetShown(not atlas)
        local bs = r.bar:GetWidth(); r.icon:SetSize(atlas and bs * 1.05 or bs * 0.62, atlas and bs * 1.05 or bs * 0.62)
        local later = LP_Route.state and LP_Route.state[si] == "later"
        local d = LP_Route.StepDist(st)
        if i == 1 then
          r.kind:SetText(fmt("|cff%s%s|r", col, (cnt > 1 and (cnt .. " QUESTS " .. label:upper()) or label:upper())))
          -- Gruppe: erster Name gross, die anderen in der Zeile darunter (nichts wird abgeschnitten)
          r.title:SetText("|cffffffff" .. titles[1] .. "|r" .. (cnt > 1 and ("  |cff8a9396+" .. (cnt - 1) .. "|r") or ""))
          if cnt > 1 then table.insert(sub, 1, "|cffd8dde0auch:|r " .. table.concat(titles, ", ", 2)) end
          -- Was liegt direkt daneben? (andere offene Schritte im Umkreis von ~110 m)
          local near = {}
          if heroT then
            for k = 2, #items do
              local o = route.steps[items[k].steps[1]]
              if o and o.q and LP_Route.state[items[k].steps[1]] == "open" then
                local ot = LP_Route.StepTarget(o)
                local dd = ot and LP_Route.Between(heroT, ot)
                if dd and dd < 120 then near[#near + 1] = LP_Route.StepTitle(o) end
              end
              if #near >= 2 then break end
            end
          end
          local line = sub
          if #near > 0 then line = { (#sub > 0 and table.concat(sub, " · ") .. "   " or "") .. "|cff39ff6bNebenbei:|r " .. table.concat(near, ", ") } end
          r.sub:SetText(#line > 0 and table.concat(line, " · ") or (st.z or " "))
          r.dist:SetText(d and ("|cffffffff" .. fmtDist(d) .. "|r") or "")
          local spd = (LP_Fly and LP_Fly.Speed and LP_Fly.Speed()) or 7
          r.eta:SetText((d and d > 25) and ("ca. " .. fmtTime(d * 1.15 / spd)) or (d and "|cff39ff6bhier|r" or ""))
        else
          local pre = cnt > 1 and fmt("|cff%s%d×|r ", col, cnt) or ""
          r.title:SetText(pre .. (later and "|cff8a8f93" or "|cffd8dde0") .. title .. "|r")
          if later then
            r.dist:SetText(""); r.tag:SetText("|cffff8a3dab Stufe " .. math.max(st.rl or 0, (st.ql or 0) - 3) .. "|r")
            r.bar:SetVertexColor(0.35, 0.37, 0.4, 1)
          else
            r.tag:SetText(""); r.dist:SetText(d and ("|cff8a9396" .. fmtDist(d) .. "|r") or "")
          end
        end
        r.sel:SetShown(i == 1); r.selEdge:SetShown(i == 1)
        r:Show()
      else
        r.stepIdx, r.qid, r.group = nil, nil, nil; r:Hide()
      end
    end
    if not route then
      empty:SetText("Keine Route für deine Fraktion/Stufe gefunden.\nOben auf QUESTS umschalten.")
    elseif n == 0 and not DB.collapsed then
      empty:SetText("Route " .. (route.name or "") .. " erledigt – nächster Abschnitt folgt.")
    end
    empty:SetShown(not DB.collapsed and n == 0)
    local flyH = FlyBanner(n > 0 and -listH or (listTop - 36))
    M:SetHeight(DB.collapsed and 108 or ((n > 0 and listH + 8 or -listTop + 40) + flyH))
    A:SetShown(DB.arrow and RT.idx ~= nil and M:IsShown())
    return
  end

  -- Quest-Ansicht
  subHead:SetText("Angenommene Quests · nach Entfernung")
  empty:SetText("Keine angenommenen Quests auf dieser Karte.\nNeue Quests zeigt dir Questie (gelbes !).")
  local tgt = currentTarget()
  local n = DB.collapsed and 0 or min(#TARGETS, DB.rows or 6)
  local listH = LayoutRows(n, "quests")
  for i, r in ipairs(ROWS) do
    local t = TARGETS[i]
    if i <= n and t then
      r.qid, r.tTitle, r.tProg, r.tXP = t.id, t.title, t.prog, t.xp
      local cr, cg, cb = levelColor(t.lvl)
      if t.turnin then cr, cg, cb = NEON[1], NEON[2], NEON[3] end
      r.bar:SetVertexColor(cr, cg, cb, 1)
      r.sym:SetText("")
      local atlas = SetIcon(r.icon, t.turnin and "turnin" or "complete")
      r.bar:SetShown(not atlas)
      local bs = r.bar:GetWidth(); r.icon:SetSize(atlas and bs * 1.05 or bs * 0.62, atlas and bs * 1.05 or bs * 0.62)
      r.title:SetText("|cffffffff" .. t.title .. "|r")
      r.sub:SetText(t.turnin and "|cff39ff6bAlles erledigt – zum Abgeben|r" or (t.prog ~= "" and t.prog or "Ziel auf der Karte"))
      r.dist:SetText("|cffffffff" .. fmtDist(t.dist) .. "|r")
      local tags = {}
      if t.xp then tags[#tags + 1] = "|cff66ccff+" .. fmtNum(t.xp) .. " XP|r" end
      if PIN == t.id then tags[#tags + 1] = "|cffffd24dFIX|r" end
      r.tag:SetText(table.concat(tags, " "))
      local sel = tgt and tgt.id == t.id
      r.sel:SetShown(sel); r.selEdge:SetShown(sel)
      r:Show()
    else
      r.qid = nil; r:Hide()
    end
  end
  empty:SetShown(not DB.collapsed and #TARGETS == 0)
  local flyH = FlyBanner(n > 0 and -listH or (listTop - 36))
  M:SetHeight(DB.collapsed and 108 or ((n > 0 and listH + 8 or -listTop + 40) + flyH))
  A:SetShown(DB.arrow and tgt ~= nil and M:IsShown())
end

local lastPin
local function SetBlizzPin(tgt)
  if not (DB and DB.pin) or not tgt or not tgt.map or not tgt.x then return end
  if LP_ManualWay and LP_ManualWay() then return end
  local key = tgt.map .. ":" .. floor(tgt.x * 1000) .. ":" .. floor(tgt.y * 1000)
  if key == lastPin then return end
  lastPin = key
  pcall(function()
    if C_Map.CanSetUserWaypointOnMap and not C_Map.CanSetUserWaypointOnMap(tgt.map) then return end
    local pt = UiMapPoint and UiMapPoint.CreateFromCoordinates(tgt.map, tgt.x, tgt.y)
    if pt and C_Map.SetUserWaypoint then
      C_Map.SetUserWaypoint(pt)
      if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then C_SuperTrack.SetSuperTrackedUserWaypoint(true) end
    end
  end)
end
local function ClearBlizzPin()
  lastPin = nil
  pcall(function() if C_Map.ClearUserWaypoint then C_Map.ClearUserWaypoint() end end)
end

local lastArrow = 0
local function UpdateArrow(now)
  if not A:IsShown() then return end
  local tgt = currentTarget()
  if not tgt then A:Hide(); return end
  local east, north, viaLen
  SetBlizzPin(tgt)
  local aim = tgt
  if DB.wege and tgt.map and LP_Route then
    local okR, wp, len = pcall(LP_Route.Route, tgt)
    if okR and wp then aim, viaLen = wp, len end
  end
  if aim.map and LP_Route then east, north = LP_Route.Offset(aim) end
  if not east then
    arrow:SetRotation(0); arrowGlow:SetRotation(0)
    aHere:Hide(); arrow:Show()
    aDist:SetText("|cff888888" .. (tgt.step and (LP_Route.TYPE[tgt.step.t] or "") or "–") .. "|r"); aName:SetText(tgt.title or ""); return
  end
  local d = sqrt(east * east + north * north)
  local okF, facing = pcall(GetPlayerFacing)
  local here = (not viaLen) and d < 12
  aHere:SetShown(here); arrow:SetShown(not here); arrowGlow:SetShown(not here)
  if okF and facing then
    local bearing = atan2(-east, north)
    local rot = bearing - facing
    arrow:SetRotation(rot); arrowGlow:SetRotation(rot)
    compass:SetRotation(-facing)
  end
  local beamOn = LevelPilotBeam and LevelPilotBeam:IsShown()
  A:SetAlpha(beamOn and 0.7 or 1)
  local pulse = 0.35 + 0.25 * math.sin(now * 3)
  ring:SetAlpha(here and (0.5 + 0.4 * math.sin(now * 8)) or pulse)
  rim:SetAlpha(0.6 + 0.35 * math.sin(now * 2.4))
  if viaLen then
    aDist:SetText((tgt.turnin and "|cff39ff6b" or "|cffffffff") .. fmtDist(viaLen) .. "|r  |cff39ff6bWeg|r")
  else
    local e2, n2 = LP_Route.Offset(tgt)
    local dd = e2 and sqrt(e2 * e2 + n2 * n2) or d
    aDist:SetText((tgt.turnin and "|cff39ff6b" or "|cffffffff") .. fmtDist(dd) .. "|r  |cff6b7076Luftlinie|r")
  end
  aName:SetText((tgt.turnin and "|cff39ff6bAbgeben: |r" or "") .. tgt.title)
end

---------------------------------------------------------------------------
-- Auto-Annehmen / Abgeben (Umschalt gedrueckt = Pause)
---------------------------------------------------------------------------
local function autoOK() return DB and DB.auto and not IsShiftKeyDown() end

-- Im Routen-Modus nur Quests annehmen, die zur Route gehoeren (und nicht aussortiert/gesperrt sind).
-- Im Quest-Modus wie gewohnt alles.
local function routeWants(qid)
  if not (DB and DB.mode == "route" and RT.key) then return true end
  if not qid then return false end
  if DB.ban[qid] then return false end
  local route = LevelPilot_Routes[RT.key]; if not route then return true end
  for i, st in ipairs(route.steps) do
    if st.t == "accept" and (st.q == qid) then
      local stt = LP_Route.state and LP_Route.state[i]
      return stt ~= "skip"
    end
    if st.t == "accept" and st.alt then
      for _, a in ipairs(st.alt) do if a == qid then return true end end
    end
  end
  return false
end
local function routeWantsTitle(title)
  if not (DB and DB.mode == "route" and RT.key) then return true end
  local route = LevelPilot_Routes[RT.key]; if not (route and title) then return false end
  for i, st in ipairs(route.steps) do
    if st.t == "accept" and st.q and LP_Route.state and LP_Route.state[i] == "open" and LP_Route.StepTitle(st) == title then return true end
  end
  return false
end
local notWanted = {}
local function hintNotWanted(qid, title)
  local k = qid or title
  if not k or notWanted[k] then return end
  notWanted[k] = true
  P("|cffffd24d" .. (title or ("Quest " .. tostring(qid))) .. "|r ist nicht in der Route (langsam/unnötig) – nicht automatisch angenommen.")
end

local function gossipAuto()
  if not autoOK() or not C_GossipInfo then return end
  pcall(function()
    for _, q in ipairs(C_GossipInfo.GetActiveQuests() or {}) do
      if q.isComplete and q.questID then C_GossipInfo.SelectActiveQuest(q.questID); return end
    end
    for _, q in ipairs(C_GossipInfo.GetAvailableQuests() or {}) do
      if q.questID and not q.isTrivial then
        if routeWants(q.questID) then C_GossipInfo.SelectAvailableQuest(q.questID); return end
        hintNotWanted(q.questID, q.title)
      end
    end
  end)
end

-- Am NPC pruefen: bietet er die Quest der Route ueberhaupt (noch) an? Sonst Schritt ueberspringen.
local function npcIdOf(unit)
  local ok, g = pcall(UnitGUID, unit)
  if not ok or type(g) ~= "string" then return end
  local okS, id = pcall(function() return tonumber((select(6, strsplit("-", g)))) end)
  return okS and id or nil
end
local function offerCheck(kind)
  if not (DB and DB.mode == "route" and RT.key and LP_Route and LP_Route.Givers and LP_Route.state) then return end
  local route = LevelPilot_Routes[RT.key]; if not route then return end
  local npc = npcIdOf("npc"); if not npc then return end
  local offered, any, okRead = {}, false, false
  okRead = pcall(function()
    if kind == "gossip" then
      for _, q in ipairs(C_GossipInfo.GetAvailableQuests() or {}) do any = true; if q.questID then offered[q.questID] = true end end
    else
      any = (GetNumAvailableQuests() or 0) > 0
    end
  end)
  if not okRead then return end
  local names = {}
  -- nur die naechsten Schritte (nicht die ganze Route) - konservativ
  for _, i in ipairs(RT.list or {}) do
    local st, s_ = LP_Route.state[i], route.steps[i]
    if st == "open" and s_ and s_.t == "accept" and s_.q and LP_Route.Givers(s_.q)[npc] then
      -- Gossip: per Quest-ID sicher; Begruessungsfenster: nur wenn der NPC gar nichts anbietet
      local gone = (kind == "gossip" and not offered[s_.q]) or (kind ~= "gossip" and not any)
      if gone then SkipStep(i); names[#names + 1] = LP_Route.StepTitle(s_) end
    end
  end
  if #names > 0 then
    Toast("|cffffd24dNICHT MEHR DA|r  ·  " .. names[1] .. (#names > 1 and (" +" .. (#names - 1)) or ""))
    P("Quest hier nicht verfügbar – übersprungen: " .. table.concat(names, ", ") .. "  |cff8a8f93(/lp zurueck holt sie wieder)|r")
    Refresh(true)
  end
end

local function greetingAuto()
  if not autoOK() then return end
  pcall(function()
    for i = 1, (GetNumActiveQuests() or 0) do
      local _, complete = GetActiveTitle(i)
      if complete then SelectActiveQuest(i); return end
    end
    for i = 1, (GetNumAvailableQuests() or 0) do
      local okT, trivial, _, _, _, qid = pcall(GetAvailableQuestInfo, i)
      local title = GetAvailableTitle and GetAvailableTitle(i)
      if not (okT and trivial) then
        local want = (type(qid) == "number" and routeWants(qid)) or (type(qid) ~= "number" and routeWantsTitle(title))
        if want then SelectAvailableQuest(i); return end
        hintNotWanted(type(qid) == "number" and qid or nil, title)
      end
    end
  end)
end

---------------------------------------------------------------------------
-- Ereignisse
---------------------------------------------------------------------------
local DONE = {}
local function checkCompleted(silent)
  pcall(function()
    for i = 1, (QL.GetNumQuestLogEntries() or 0) do
      local info = QL.GetInfo(i)
      if info and info.questID and not info.isHeader then
        local c = readyForTurnIn(info.questID)
        if c and not DONE[info.questID] and not silent then
          Toast("|cff39ff6bQUEST FERTIG|r  ·  " .. (info.title or ""))
        end
        DONE[info.questID] = c or nil
      end
    end
  end)
end

local E = CreateFrame("Frame")
E:RegisterEvent("PLAYER_LOGIN")
E:SetScript("OnEvent", function(_, ev, a1, ...)
  if ev == "PLAYER_LOGIN" then
    LevelPilotDB = LevelPilotDB or {}
    DB = LevelPilotDB
    for k, v in pairs(DEF) do if DB[k] == nil then DB[k] = copy(v) end end
    for k, v in pairs(DATA) do if DB[k] == nil then DB[k] = copy(v) end end
    -- alte Sprungliste war an Schritt-NUMMERN gebunden; seit dem Routen-Neubau zeigen die auf falsche Schritte
    local oldSkip = DB.skip ~= nil
    DB.skip = nil
    M:ClearAllPoints(); M:SetPoint(DB.point, UIParent, DB.point, DB.x, DB.y)
    A:ClearAllPoints(); A:SetPoint(DB.apoint, UIParent, DB.apoint, DB.ax, DB.ay)
    for _, e in ipairs({ "QUEST_LOG_UPDATE", "QUEST_ACCEPTED", "QUEST_TURNED_IN", "QUEST_REMOVED",
      "ZONE_CHANGED", "ZONE_CHANGED_NEW_AREA", "ZONE_CHANGED_INDOORS", "PLAYER_ENTERING_WORLD",
      "PLAYER_XP_UPDATE", "PLAYER_LEVEL_UP", "UPDATE_EXHAUSTION",
      "GOSSIP_SHOW", "QUEST_GREETING", "QUEST_DETAIL", "QUEST_PROGRESS", "QUEST_COMPLETE",
      "UNIT_SPELLCAST_SUCCEEDED", "PLAYER_CONTROL_GAINED", "QUEST_DATA_LOAD_RESULT",
      "PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED", "PLAYER_CONTROL_LOST" }) do
      pcall(E.RegisterEvent, E, e)
    end
    if not DB.maxDiffUser then DB.maxDiff = 5 end   -- Standard: 100 % XP
    if LP_Route then LP_Route.mem = DB.qmem; LP_Route.ScanLog(false); LP_Route.ban = DB.ban; LP_Route.UserNav = DB.nav; LP_Route.speed = DB.speed; LP_Route.maxDiff = DB.maxDiff end
    if Quiet then Quiet(8) end
    xpTrack(); checkCompleted(true); Refresh(true)
    P("v" .. VERSION .. " bereit – /lp für Befehle. Umschalt halten = Auto-Quest kurz aus.")
    if oldSkip then P("Hinweis: alte übersprungene Schritte wurden zurückgesetzt (sie passten nicht mehr zur neuen Route).") end
    return
  end
  if LP_Route and LP_Route.OnAccepted then
    if ev == "QUEST_ACCEPTED" then LP_Route.OnAccepted((... and type(...) == "number") and ... or a1)
    elseif ev == "QUEST_TURNED_IN" then LP_Route.OnTurnedIn(a1)
    elseif ev == "QUEST_LOG_UPDATE" then LP_Route.ScanLog(true)
    elseif ev == "PLAYER_ENTERING_WORLD" then LP_Route.ScanLog(false)
    elseif ev == "QUEST_REMOVED" then LP_Route.ScanLog(false); LP_Route.OnRemoved(a1) end
  end
  -- Kampf: Fenster dezent, kein Ton; nach dem Kampf / Landen / Ladebildschirm kurz Ruhe
  if ev == "PLAYER_REGEN_DISABLED" then
    if DB.fade then M:SetAlpha(0.35) end
    return
  end
  if ev == "PLAYER_REGEN_ENABLED" then
    M:SetAlpha(1); if Quiet then Quiet(3) end
    return
  end
  if ev == "PLAYER_CONTROL_LOST" then return end
  if ev == "PLAYER_ENTERING_WORLD" and Quiet then Quiet(6) end
  if ev == "UNIT_SPELLCAST_SUCCEEDED" then
    local _, _, spell = ...
    if a1 == "player" and (spell == 8690 or spell == 556) and LP_Route then LP_Route.OnHearth(); Refresh(true) end
    return
  end
  if ev == "PLAYER_CONTROL_GAINED" then
    if Quiet then Quiet(4) end
    if E.onTaxi and LP_Route then E.onTaxi = false; LP_Route.OnLanded(); Refresh(true) end
    return
  end
  if ev == "GOSSIP_SHOW" then pcall(offerCheck, "gossip"); gossipAuto(); return end
  if ev == "QUEST_GREETING" then pcall(offerCheck, "greeting"); greetingAuto(); return end
  if ev == "QUEST_DETAIL" then
    if autoOK() then
      local okQ, qid = pcall(GetQuestID)
      qid = okQ and qid or nil
      if not qid or qid == 0 or routeWants(qid) then pcall(AcceptQuest)
      else hintNotWanted(qid, GetTitleText and GetTitleText() or nil) end
    end
    return
  end
  if ev == "QUEST_PROGRESS" then
    if autoOK() then pcall(function() if IsQuestCompletable() then CompleteQuest() end end) end
    return
  end
  if ev == "QUEST_COMPLETE" then
    if autoOK() then
      pcall(function()
        if (GetNumQuestChoices() or 0) <= 1 then GetQuestReward(1)
        else P("|cffffd24dBelohnung auswählen|r – das entscheidest du.") end
      end)
    end
    return
  end
  if ev == "PLAYER_XP_UPDATE" or ev == "PLAYER_LEVEL_UP" or ev == "UPDATE_EXHAUSTION" then
    xpTrack(); Refresh(false); return
  end
  if ev == "QUEST_LOG_UPDATE" then checkCompleted(false) end
  Refresh(true)
end)

local acc, accScan = 0, 0
local UpdateBeam -- wird weiter unten definiert
E:SetScript("OnUpdate", function(_, el)
  if not DB then return end
  local now = GetTime()
  acc = acc + el; accScan = accScan + el
  if toastT > 0 then
    toastT = toastT - el
    T:SetAlpha(min(1, toastT * 1.5))
    if toastT <= 0 then T:Hide() end
  end
  if acc >= 0.05 then acc = 0; pcall(UpdateArrow, now) end
  pcall(UpdateBeam, now, el)
  if UnitOnTaxi("player") then E.onTaxi = true end
  if accScan >= 1 then
    accScan = 0; pcall(Refresh, true) -- Entfernungen nachfuehren
    -- alter Kartenpin bleibt nie stehen, wenn das Ziel keine Koordinaten mehr hat
    pcall(function() local t = currentTarget(); if (not t or not t.map) then if lastPin then ClearBlizzPin() end else SetBlizzPin(t) end end)
  end
  if M.glow then M.glow:SetAlpha(0.7 + 0.3 * math.sin(now * 1.5)) end
end)

---------------------------------------------------------------------------
-- Lichtstrahl am Ziel (nach Waypoint-UI-Art): schlanke Saeule, Kontext-Symbol,
-- Entfernung darunter. Haengt an Blizzards Navigations-Rahmen.
---------------------------------------------------------------------------
local B = CreateFrame("Frame", "LevelPilotBeam", UIParent)
B:SetSize(10, 10); B:SetFrameStrata("BACKGROUND"); B:Hide()
local function BT_(layer, sub, name, blend)
  local t = B:CreateTexture(nil, layer, nil, sub); t:SetTexture(MEDIA .. name); t:SetBlendMode(blend or "ADD")
  return t
end
local BEAM_H, BEAM_W = 640, 30
local bBase  = BT_("BACKGROUND", 0, "wb_base");  bBase:SetPoint("CENTER", B, "CENTER", 0, -2)
local bGlow  = BT_("BACKGROUND", 1, "wb_glow");  bGlow:SetPoint("BOTTOM", B, "CENTER", 0, 0)
local bCore  = BT_("BORDER", 0, "wb_core");      bCore:SetPoint("BOTTOM", B, "CENTER", 0, 0)
local bShine = BT_("BORDER", 1, "wb_shine")
bBase:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
bGlow:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
bCore:SetVertexColor(0.80, 1.00, 0.88, 1)
bShine:SetVertexColor(0.85, 1.00, 0.92, 1)

-- Kontext-Symbol: dunkle Glasscheibe, Leuchtring, Spielsymbol der Aufgabe
local CX = CreateFrame("Frame", nil, UIParent); CX:SetSize(40, 40); CX:SetFrameStrata("LOW"); CX:Hide()
local cxDisc = MT(CX, "BACKGROUND", 0, "ctx_disc"); cxDisc:SetPoint("CENTER"); cxDisc:SetSize(37, 37); cxDisc:SetVertexColor(0.025, 0.045, 0.04, 0.9)
local cxGloss = MT(CX, "BACKGROUND", 1, "ctx_gloss", "ADD"); cxGloss:SetPoint("CENTER"); cxGloss:SetSize(37, 37); cxGloss:SetVertexColor(1, 1, 1, 0.16)
local cxRing = MT(CX, "BORDER", 0, "ctx_ring", "ADD"); cxRing:SetPoint("CENTER"); cxRing:SetSize(42, 42); cxRing:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
local cxIcon = CX:CreateTexture(nil, "ARTWORK"); cxIcon:SetPoint("CENTER"); cxIcon:SetSize(22, 22)
local cxD = UI(CX, 14, true); cxD:SetPoint("TOP", CX, "BOTTOM", 0, -3)
local cxT = UI(CX, 11, true); cxT:SetPoint("TOP", cxD, "BOTTOM", 0, -2); cxT:SetTextColor(0.62, 1, 0.74); cxT:SetWidth(240); cxT:SetWordWrap(false)

-- Pinpoint (nah): ruhige Glas-Pille ueber dem Ziel mit Aufgabe + Pfeil nach unten
local PP = CreateFrame("Frame", nil, UIParent); PP:SetSize(240, 44); PP:SetFrameStrata("LOW"); PP:Hide()
local ppEdge = Round(PP, "BACKGROUND", 0, 14, { 1, 1, 1, 1 })
ppEdge:SetGradient({ NEON[1], NEON[2], NEON[3], 0.7 }, { TEAL[1], TEAL[2], TEAL[3], 0.35 })
local ppBody = CreateFrame("Frame", nil, PP); ppBody:SetPoint("TOPLEFT", 1, -1); ppBody:SetPoint("BOTTOMRIGHT", -1, 1)
Round(ppBody, "BACKGROUND", 1, 13, { 1, 1, 1, 1 }):SetGradient({ 0.03, 0.065, 0.055, 0.95 }, { 0.045, 0.05, 0.07, 0.95 })
local ppIcon = ppBody:CreateTexture(nil, "ARTWORK"); ppIcon:SetSize(22, 22); ppIcon:SetPoint("LEFT", 10, 0)
local ppT = UI(ppBody, 13, true); ppT:SetPoint("TOPLEFT", 40, -8); ppT:SetPoint("RIGHT", -10, 0); ppT:SetJustifyH("LEFT"); ppT:SetWordWrap(false)
local ppS = UI(ppBody, 11); ppS:SetPoint("BOTTOMLEFT", 40, 8); ppS:SetPoint("RIGHT", -10, 0); ppS:SetJustifyH("LEFT"); ppS:SetWordWrap(false); ppS:SetTextColor(0.66, 0.9, 0.76)
local ppArrow = MT(PP, "OVERLAY", 0, "arrow"); ppArrow:SetSize(20, 20); ppArrow:SetRotation(math.pi)

-- Navigator (Ziel ausserhalb des Bildes): kleines Symbol am Rand + Richtungspfeil
local NV = CreateFrame("Frame", "LevelPilotNavigator", UIParent); NV:SetSize(44, 44); NV:SetFrameStrata("HIGH"); NV:Hide()
local nvDisc = MT(NV, "BACKGROUND", 0, "ctx_disc"); nvDisc:SetPoint("CENTER"); nvDisc:SetSize(37, 37); nvDisc:SetVertexColor(0.025, 0.045, 0.04, 0.9)
local nvRing = MT(NV, "BORDER", 0, "ctx_ring", "ADD"); nvRing:SetPoint("CENTER"); nvRing:SetSize(42, 42); nvRing:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
local nvIcon = NV:CreateTexture(nil, "ARTWORK"); nvIcon:SetPoint("CENTER"); nvIcon:SetSize(20, 20)
local nvArrow = MT(NV, "OVERLAY", 0, "arrow"); nvArrow:SetSize(18, 18); nvArrow:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
local nvD = UI(NV, 11, true); nvD:SetPoint("TOP", NV, "BOTTOM", 0, -2)

-- Ziel-Infos (gleiches Ziel wie der Pfeil; stabiler Schluessel statt Titel)
local MANUALWAY
local function TargetInfo()
  local title, sub, key, typ = nil, nil, nil, "go"
  pcall(function()
    local qid = C_SuperTrack.GetSuperTrackedQuestID and C_SuperTrack.GetSuperTrackedQuestID()
    if qid and qid > 0 and not (C_SuperTrack.IsSuperTrackingUserWaypoint and C_SuperTrack.IsSuperTrackingUserWaypoint()) then
      title = C_QuestLog.GetTitleForQuestID(qid); key = "q" .. qid; typ = "complete"
      for _, o in ipairs(C_QuestLog.GetQuestObjectives(qid) or {}) do if not o.finished then sub = o.text; break end end
      if (C_QuestLog.ReadyForTurnIn and C_QuestLog.ReadyForTurnIn(qid)) then sub = "Abgeben"; typ = "turnin" end
    end
  end)
  if not title then
    if MANUALWAY then title, key, typ = MANUALWAY.title, "w" .. MANUALWAY.key, "go"
    else
      local tgt = currentTarget()
      if tgt then
        title = tgt.title
        typ = tgt.step and tgt.step.t or (tgt.turnin and "turnin" or "complete")
        if tgt.fly then key = "fly:" .. tostring(tgt.fly.from)
        elseif tgt.step and tgt.step.t and LP_Route.StepKey and tgt.step.q ~= nil then key = "s" .. LP_Route.StepKey(tgt.step)
        elseif tgt.step then key = "s" .. tostring(tgt.step.t) .. tostring(tgt.step.npc or tgt.title)
        elseif tgt.id then key = "q" .. tgt.id end
        if tgt.step then
          if tgt.step.t == "complete" and tgt.step.q then
            local pr = questProgress(tgt.step.q); sub = pr ~= "" and pr or nil
          end
          sub = sub or ((LP_Route.TYPE[tgt.step.t] or "") .. (tgt.step.note and (" · " .. tgt.step.note) or ""))
        end
      end
    end
  end
  return title or "Kartenmarkierung", sub or "", key or "pin", typ
end

local lastKey, arrivedKey = nil, nil
function LP_StepType()
  local tgt = currentTarget()
  return tgt and tgt.step and tgt.step.t or "go"
end
function LP_ManualWay() return MANUALWAY ~= nil end

-- Ton-Regeln: nur bei einem wirklich NEUEN Ziel, nie im Kampf, nie im Flug, nicht direkt
-- nach Kampfende/Landung/Ladebildschirm, jeder Ton je Ziel nur einmal, mindestens 4 s Abstand.
local SND = { last = 0, played = {}, quietUntil = 0 }
function Quiet(sec) SND.quietUntil = math.max(SND.quietUntil, GetTime() + sec) end
local function Sound(file, key)
  if not DB or DB.sound == false then return end
  local now = GetTime()
  if now < SND.quietUntil or now - SND.last < 4 then return end
  if (UnitAffectingCombat and UnitAffectingCombat("player")) or (UnitOnTaxi and UnitOnTaxi("player")) then return end
  if key then
    local k = file .. "|" .. key
    if SND.played[k] and now - SND.played[k] < 900 then return end
    SND.played[k] = now
  end
  SND.last = now
  pcall(PlaySoundFile, MEDIA .. file .. ".ogg", "Master")
end
local function ease(x) x = math.max(0, math.min(1, x)); return 1 - (1 - x) ^ 3 end

local stfHidden = false
local function HideBeamParts() B:Hide(); CX:Hide(); PP:Hide(); NV:Hide() end
function UpdateBeam(now, el)
  if not (DB and DB.beam) then
    HideBeamParts()
    if stfHidden and SuperTrackedFrame then pcall(SuperTrackedFrame.SetAlpha, SuperTrackedFrame, 1); stfHidden = false end
    return
  end
  local nav, active
  pcall(function()
    active = (C_SuperTrack.IsSuperTrackingAnything and C_SuperTrack.IsSuperTrackingAnything())
      or (C_SuperTrack.IsSuperTrackingUserWaypoint and C_SuperTrack.IsSuperTrackingUserWaypoint())
    if active and C_Navigation and C_Navigation.GetFrame then nav = C_Navigation.GetFrame() end
  end)
  if SuperTrackedFrame then pcall(SuperTrackedFrame.SetAlpha, SuperTrackedFrame, 0); stfHidden = true end
  if not nav or (UnitOnTaxi and UnitOnTaxi("player")) then HideBeamParts(); return end
  local d, clamped
  pcall(function() d = C_Navigation.GetDistance and C_Navigation.GetDistance() end)
  pcall(function() clamped = C_Navigation.WasClampedToScreen and C_Navigation.WasClampedToScreen() end)
  local title, sub, key, typ = TargetInfo()

  -- neues Ziel? (stabiler Schluessel: Wiedererscheinen nach Kampf/Flug ist KEIN neues Ziel)
  if key ~= lastKey then
    lastKey = key; arrivedKey = nil
    B.born = now
    Sound(DB.ton == "schloss" and "lock" or "beam", key)
  end
  if d and d < 8 and arrivedKey ~= key then
    arrivedKey = key; Sound("arrive", key)
    if MANUALWAY then MANUALWAY = nil end
  end
  local okI = SetIcon(cxIcon, typ or "go"); if not okI then cxIcon:SetVertexColor(NEON[1], NEON[2], NEON[3], 1) end

  if clamped then
    B:Hide(); CX:Hide(); PP:Hide()
    local nx, ny = nav:GetCenter(); local cx, cy = UIParent:GetCenter()
    if nx and cx then
      local sc = UIParent:GetEffectiveScale() / NV:GetEffectiveScale()
      NV:ClearAllPoints(); NV:SetPoint("CENTER", UIParent, "BOTTOMLEFT", nx * sc, ny * sc)
      local r = atan2(ny - cy, nx - cx)
      nvArrow:ClearAllPoints(); nvArrow:SetPoint("CENTER", NV, "CENTER", math.cos(r) * 27, math.sin(r) * 27)
      nvArrow:SetRotation(r - math.pi / 2)
    end
    SetIcon(nvIcon, typ or "go")
    nvRing:SetAlpha(0.75 + 0.25 * math.sin(now * 3))
    nvD:SetText(d and ("|cffffffff" .. fmtDist(d) .. "|r") or "")
    NV:Show()
    return
  end
  NV:Hide()
  B:ClearAllPoints(); B:SetPoint("CENTER", nav, "CENTER", 0, 0); B:Show()

  -- Je naeher, desto groesser: fern = schlanker, leichter Strahl; nah = breite, hohe Lichtsaeule.
  -- Erscheinen weich in 0.4 s. Ganz nah (< 10 m) wird er durchsichtiger, damit das Ziel frei bleibt.
  local k = d and math.max(0, math.min(1, (1000 - d) / 970)) or 0.5
  k = k ^ 0.8
  local age = now - (B.born or 0)
  local grow = ease(age / 0.4)
  local near = d and d < 30
  local fadeNear = (d and d < 10) and math.max(0.35, d / 10) or 1
  local h = BEAM_H * (0.3 + 0.7 * k) * grow
  local wk = 0.55 + 0.7 * k
  bCore:SetSize(BEAM_W * wk, math.max(1, h)); bGlow:SetSize(150 * wk, math.max(1, h))
  bBase:SetSize(230 * wk, 58 * wk)
  local breathe = 0.85 + 0.15 * math.sin(now * 1.6)
  local power = 0.55 + 0.45 * k
  bCore:SetAlpha(power * grow * fadeNear); bGlow:SetAlpha(0.8 * power * breathe * grow * fadeNear); bBase:SetAlpha(0.55 * breathe * grow)
  -- ein ruhiger Lichtpuls wandert die Saeule hinauf (alle 2.6 s)
  local f = (now / 2.6) % 1
  bShine:ClearAllPoints(); bShine:SetPoint("CENTER", B, "CENTER", 0, f * h)
  bShine:SetSize(40 * wk, 110 * wk); bShine:SetAlpha(0.32 * power * math.sin(f * math.pi) * grow * fadeNear)

  -- Symbol + Entfernung (feste, gut lesbare Groesse)
  CX:ClearAllPoints(); CX:SetPoint("CENTER", B, "CENTER", 0, 0)
  cxRing:SetAlpha(0.8 + 0.2 * math.sin(now * 2.2))
  cxD:SetText(d and ("|cffffffff" .. fmtDist(d) .. "|r") or "")
  cxT:SetText(title or "")
  CX:SetAlpha(grow)
  CX:Show()

  PP:SetShown(near and true or false)
  if near then
    PP:ClearAllPoints(); PP:SetPoint("BOTTOM", CX, "TOP", 0, 22 + 4 * math.abs(math.sin(now * 2.5)))
    SetIcon(ppIcon, typ or "go")
    ppT:SetText("|cffffffff" .. (title or "") .. "|r"); ppS:SetText(sub ~= "" and sub or fmtDist(d))
    ppArrow:ClearAllPoints(); ppArrow:SetPoint("TOP", PP, "BOTTOM", 0, -1)
    ppArrow:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
  end
end

-- /way  x y [Titel]   bzw.  /way #KartenID x y [Titel]   ·  /way aus
SLASH_LEVELPILOTWAY1 = "/way"
SLASH_LEVELPILOTWAY2 = "/lpway"
SlashCmdList.LEVELPILOTWAY = function(msg)
  msg = msg or ""
  if msg:lower():match("^%s*aus") or msg:lower():match("^%s*clear") then
    MANUALWAY = nil; pcall(C_Map.ClearUserWaypoint); P("Wegpunkt gelöscht."); return
  end
  local map, rest = msg:match("^%s*#(%d+)%s+(.*)$")
  map = tonumber(map) or LP_Route.PlayerMapPos()
  rest = rest or msg
  local x, y, title = rest:gsub(",", "."):match("^%s*([%d%.]+)%s+([%d%.]+)%s*(.*)$")
  x, y = tonumber(x), tonumber(y)
  if not (map and x and y) then P("Benutzung: /way 45.2 61.0 Titel  ·  /way #1440 45 61  ·  /way aus"); return end
  local ok = pcall(function()
    C_Map.SetUserWaypoint(UiMapPoint.CreateFromCoordinates(map, x / 100, y / 100))
    C_SuperTrack.SetSuperTrackedUserWaypoint(true)
  end)
  MANUALWAY = { title = (title ~= "" and title) or fmt("%.1f, %.1f", x, y), key = map .. ":" .. x .. ":" .. y }
  P(ok and ("Wegpunkt gesetzt: |cff39ff6b" .. MANUALWAY.title .. "|r") or "Wegpunkt konnte nicht gesetzt werden.")
end

---------------------------------------------------------------------------
-- Textfenster (Export/Import)
---------------------------------------------------------------------------
local TW
function LP_ShowText(text, title, onOk)
  if not TW then
    TW = CreateFrame("Frame", "LevelPilotText", UIParent)
    TW:SetSize(480, 270); TW:SetPoint("CENTER"); TW:SetFrameStrata("DIALOG")
    TW:EnableMouse(true); TW:SetMovable(true); TW:RegisterForDrag("LeftButton")
    TW:SetScript("OnDragStart", TW.StartMoving); TW:SetScript("OnDragStop", TW.StopMovingOrSizing)
    Panel(TW, true)
    TW.title = UI(TW, 13, true); TW.title:SetPoint("TOPLEFT", 16, -14)
    -- Eingabefeld: glatte, abgerundete Flaeche, mausrad-scrollbar, ohne Standard-Rahmen
    local box = CreateFrame("Frame", nil, TW); box:SetPoint("TOPLEFT", 14, -36); box:SetPoint("BOTTOMRIGHT", -14, 50)
    Round(box, "BACKGROUND", 0, 10, { 0, 0, 0, 0.45 }):SetGradient({ 0, 0, 0, 0.55 }, { 0.02, 0.06, 0.05, 0.45 })
    local sf = CreateFrame("ScrollFrame", nil, box); sf:SetPoint("TOPLEFT", 10, -8); sf:SetPoint("BOTTOMRIGHT", -10, 8)
    local eb = CreateFrame("EditBox", nil, sf)
    eb:SetMultiLine(true); eb:SetAutoFocus(true); eb:SetFont(FONT_UI, 12, ""); eb:SetTextColor(0.85, 1, 0.9); eb:SetWidth(430)
    eb:SetScript("OnEscapePressed", function() TW:Hide() end)
    sf:SetScrollChild(eb); TW.eb = eb
    sf:EnableMouseWheel(true)
    sf:SetScript("OnMouseWheel", function(self, d) self:SetVerticalScroll(math.max(0, self:GetVerticalScroll() - d * 30)) end)
    local function NeonBtn(txt, w, primary)
      local b = CreateFrame("Button", nil, TW); b:SetSize(w, 26)
      local bg = Round(b, "BACKGROUND", 0, 13, { 1, 1, 1, 0.08 })
      if primary then bg:SetGradient({ NEON[1], NEON[2], NEON[3], 0.85 }, { TEAL[1], TEAL[2], TEAL[3], 0.75 }) else bg:SetGradient({ 1, 1, 1, 0.10 }, { 1, 1, 1, 0.04 }) end
      Round(b, "HIGHLIGHT", 0, 13, { 1, 1, 1, 0.12 })
      b.t = UI(b, 12, true); b.t:SetPoint("CENTER"); b.t:SetText(txt)
      b.t:SetTextColor(primary and 0.03 or 0.85, primary and 0.08 or 0.9, primary and 0.05 or 0.9)
      return b
    end
    TW.ok = NeonBtn("Übernehmen", 120, true); TW.ok:SetPoint("BOTTOMRIGHT", -14, 14)
    TW.close = NeonBtn("Schließen", 100, false); TW.close:SetPoint("RIGHT", TW.ok, "LEFT", -8, 0)
    TW.close:SetScript("OnClick", function() TW:Hide() end)
    tinsert(UISpecialFrames, "LevelPilotText")
  end
  TW.title:SetText("|cff39ff6b" .. (title or "") .. "|r")
  TW.eb:SetText(text or ""); TW.eb:HighlightText(); TW.eb:SetFocus()
  TW.ok:SetShown(onOk ~= nil)
  TW.ok:SetScript("OnClick", function() if onOk then onOk(TW.eb:GetText() or "") end; TW:Hide() end)
  TW:Show()
end

---------------------------------------------------------------------------
-- /lp
---------------------------------------------------------------------------
SLASH_LEVELPILOT1 = "/lp"
SLASH_LEVELPILOT2 = "/levelpilot"
SlashCmdList.LEVELPILOT = function(msg)
  if not DB then return end
  local c = (msg or ""):lower():match("^%s*(%S*)")
  if c == "" or c == "an" or c == "aus" then
    M:SetShown(not M:IsShown()); if not M:IsShown() then A:Hide() else Refresh(true) end
  elseif c == "auto" then DB.auto = not DB.auto; P("Auto: " .. tostring(DB.auto)); Refresh(true)
  elseif c == "pfeil" then DB.arrow = not DB.arrow; Refresh(true)
  elseif c == "punkt" then
    local arg = (msg or ""):lower():match("^%s*%S+%s+(%S+)")
    local map, x, y = LP_Route.PlayerMapPos()
    if not (map and x) then P("Position hier nicht lesbar."); return end
    DB.nav[map] = DB.nav[map] or { n = {}, e = {} }
    local g = DB.nav[map]
    if arg == "weg" then
      local cnt = #g.n / 2
      if cnt > 0 then
        g.n[#g.n] = nil; g.n[#g.n] = nil
        for k = #g.e - 1, 1, -2 do if g.e[k] == cnt or g.e[k + 1] == cnt then table.remove(g.e, k + 1); table.remove(g.e, k) end end
        P("Letzten Punkt gelöscht.")
      end
      E.lastPt = nil
    else
      g.n[#g.n + 1] = floor(x * 10000 + 0.5) / 10000; g.n[#g.n + 1] = floor(y * 10000 + 0.5) / 10000
      local idx = #g.n / 2
      local L = E.lastPt
      if arg ~= "neu" and L and L.map == map and GetTime() - L.t < 900 then g.e[#g.e + 1] = L.i; g.e[#g.e + 1] = idx end
      E.lastPt = { map = map, i = idx, t = GetTime() }
      P(fmt("Punkt %d gesetzt%s.", idx, (arg == "neu" or not L) and " (neue Kette)" or ", mit vorherigem verbunden"))
    end
    LP_Route.UserNav = DB.nav; LP_Route.BuildNav(true); LP_Route.ResetPath()
  elseif c == "export" then
    local parts = {}
    for map, g in pairs(DB.nav) do
      if #g.n > 0 then parts[#parts + 1] = map .. ":" .. table.concat(g.n, ",") .. ":" .. table.concat(g.e, ",") end
    end
    LP_ShowText("LPNAV1|" .. table.concat(parts, "|"), "Export – Text markieren (Strg+A) und kopieren (Strg+C)")
  elseif c == "import" then
    LP_ShowText("", "Import – Text einfügen (Strg+V), dann „Übernehmen“", function(txt)
      local okI, added = pcall(function()
        local cnt = 0
        local body = txt:match("LPNAV1|(.*)")
        if not body then return 0 end
        for chunk in body:gmatch("[^|]+") do
          local map, ns, es = chunk:match("^(%d+):([^:]*):?(.*)$")
          map = tonumber(map)
          if map and ns then
            DB.nav[map] = DB.nav[map] or { n = {}, e = {} }
            local g = DB.nav[map]
            local base = #g.n / 2
            for v in ns:gmatch("[^,]+") do g.n[#g.n + 1] = tonumber(v); end
            for v in (es or ""):gmatch("[^,]+") do g.e[#g.e + 1] = tonumber(v) + base end
            cnt = cnt + (#g.n / 2 - base)
          end
        end
        return cnt
      end)
      LP_Route.UserNav = DB.nav; LP_Route.BuildNav(true); LP_Route.ResetPath()
      P(okI and ("Import: " .. added .. " Punkte übernommen.") or "Import fehlgeschlagen – Text vollständig?")
    end)
  elseif c == "speed" then
    DB.speed = not DB.speed; LP_Route.speed = DB.speed
    P("Speed-Modus (Zeitfresser weglassen): " .. (DB.speed and "|cff39ff6ban|r" or "|cffff8a3daus|r")); Refresh(true)
  elseif c == "wege" then
    DB.wege = not DB.wege; LP_Route.ResetPath()
    local m, n = LP_Route.NavStats()
    P("Wegenetz-Führung: " .. (DB.wege and "|cff39ff6ban|r" or "|cffff5050aus|r") .. fmt(" · %d Karten, %d Knoten", m, n))
  elseif c == "gruen" or c == "grün" then
    local arg = tonumber((msg or ""):match("%d+"))
    if arg then DB.maxDiff = math.max(0, math.min(9, arg)) else DB.maxDiff = (DB.maxDiff == 6) and 9 or 6 end
    LP_Route.maxDiff = DB.maxDiff; DB.maxDiffUser = (DB.maxDiff ~= 5)
    local pct = ({ [5] = 100, [6] = 80, [7] = 60, [8] = 40, [9] = 20 })[DB.maxDiff] or 100
    P(fmt("Quests bis %d Stufen unter dir (mind. %d %% XP).", DB.maxDiff, pct)); Refresh(true)
  elseif c == "sound" then
    DB.sound = (DB.sound == false); P("Sounds: " .. (DB.sound ~= false and "|cff39ff6ban|r" or "|cffff5050aus|r"))
  elseif c == "entsperren" then
    local n = 0; for _ in pairs(DB.ban) do n = n + 1 end
    wipe(DB.ban); LP_Route.ban = DB.ban; P(n .. " gesperrte Quest(s) wieder frei."); Refresh(true)
  elseif c == "flug" then
    DB.fly = not DB.fly
    P("Flug-Hinweis (Fliegen statt Laufen): " .. (DB.fly and "|cff39ff6ban|r" or "|cffff5050aus|r")); Refresh(true)
  elseif c == "strahl" then
    DB.beam = not DB.beam
    P("Neon-Strahl am Ziel: " .. (DB.beam and "|cff39ff6ban|r" or "|cffff5050aus|r"))
  elseif c == "marker" then
    DB.pin = not DB.pin
    if not DB.pin then ClearBlizzPin() end
    P("Blizzard-Wegpunkt (Karte + Spielwelt): " .. (DB.pin and "|cff39ff6ban|r" or "|cffff5050aus|r"))
  elseif c == "lock" then DB.locked = true; P("gesperrt.")
  elseif c == "unlock" then DB.locked = false; P("entsperrt – Fenster und Pfeil ziehen.")
  elseif c == "toast" then DB.toast = not DB.toast; P("Fertig-Meldung: " .. tostring(DB.toast))
  elseif c == "ton" then
    DB.ton = (DB.ton == "schloss") and "amboss" or "schloss"
    P("Ton bei neuem Ziel: |cff39ff6b" .. (DB.ton == "schloss" and "Schloss verriegelt" or "Hammer auf Amboss") .. "|r")
    pcall(PlaySoundFile, MEDIA .. (DB.ton == "schloss" and "lock" or "beam") .. ".ogg", "Master")
  elseif c == "kampf" then
    DB.fade = not DB.fade; if not DB.fade then M:SetAlpha(1) end
    P("Fenster im Kampf abdunkeln: " .. (DB.fade and "|cff39ff6ban|r" or "|cffff5050aus|r"))
  elseif c == "reset" then
    for k, v in pairs(DEF) do DB[k] = copy(v) end
    M:ClearAllPoints(); M:SetPoint(DB.point, UIParent, DB.point, DB.x, DB.y)
    A:ClearAllPoints(); A:SetPoint(DB.apoint, UIParent, DB.apoint, DB.ax, DB.ay)
    Refresh(true); P("zurückgesetzt.")
  elseif c == "xp" then XPS.start, XPS.gained = GetTime(), 0; P("XP/h neu gestartet.")
  elseif c == "weiter" then
    if RT.key and RT.idx then SkipStep(RT.idx); P("Schritt übersprungen. Zurückholen: /lp zurueck") end; Refresh(true)
  elseif c == "zurueck" or c == "zurück" then
    local last = table.remove(DB.skipLog)
    if last and DB.skipK[last.r] then DB.skipK[last.r][last.k] = nil; P("Schritt zurückgeholt.") else P("Nichts übersprungen.") end
    Refresh(true)
  elseif c == "neu" then
    if RT.key then DB.skipK[RT.key] = {} end; wipe(DB.skipLog); P("Übersprungene Schritte zurückgesetzt."); Refresh(true)
  elseif c == "route" then
    local R = LP_Route
    P("Route: " .. tostring(RT.key and LevelPilot_Routes[RT.key].name) .. " · Schritt " .. tostring(RT.idx) .. " · Questie-Daten: " .. ((R and R.HasQuestie()) and "|cff39ff6bja|r" or "|cffff5050nein|r"))
  else
    P("/lp (an/aus) · /lp weiter · /lp zurueck · /lp neu · /lp route · /lp punkt (neu|weg) · /lp export · /lp import · /lp wege · /lp speed · /lp strahl · /lp ton · /lp kampf · /lp flug · /lp entsperren · /lp sound · /lp gruen · /way x y · /lp auto · /lp pfeil · /lp marker · /lp lock · /lp unlock · /lp toast · /lp xp · /lp reset")
  end
end
