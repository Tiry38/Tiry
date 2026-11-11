---------------------------------------------------------------------------
-- LevelPilot 5 (Tiry) · Anthrazit & Neon-Gruen
-- Fester Plan mit Zeiger (Route.lua) · Einstieg erkennt deinen Stand · Questlog-Check
-- Pfeil ueber echte Laufwege · Flug-Rat · Auto-Annehmen/-Abgeben · XP-Cockpit
-- Datenquellen: Routen-Plan, Questie (Geber/Ziele), Blizzards Questlog.
---------------------------------------------------------------------------
local ADDON = ...
local VERSION = "5.0.0"
local time = time or (os and os.time)   -- Spielzeit-Uhr (Sekunden seit 1970)
local floor, max, min, abs, sqrt, atan2, pi, fmt = math.floor, math.max, math.min, math.abs, math.sqrt, math.atan2, math.pi, string.format
local BT = BackdropTemplateMixin and "BackdropTemplate" or nil
local FONT = STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF"
local WHITE = "Interface\\Buttons\\WHITE8X8"

local NEON  = { 0.22, 1.00, 0.42 }   -- Neon-Gruen #39FF6B
local TEAL  = { 0.15, 0.95, 0.85 }   -- Tuerkis
local AQUA  = { 0.16, 0.70, 1.00 }   -- Eisblau (dritte Verlaufsfarbe)

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
local DATA = { skipK = {}, skipLog = {}, nav = {}, ban = {}, qmem = { acc = {}, done = {}, at = {} }, plan = {} }
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

-- Abgerundetes Rechteck (9-Slice). inset = Abstand zum Rahmenrand (z. B. 1 fuer Kante + Koerper auf EINEM Frame)
local RoundOld
local function Round(parent, layer, sub, r, col, blend, inset)
  if SLICE then
    -- eine glatte, gerechnete Rundflaeche statt zusammengesetzter Teile
    local small = r <= 9
    local t = MT(parent, layer or "BACKGROUND", sub or 0, small and "card_s" or "card", blend)
    local i = inset or 0
    if i ~= 0 then t:SetPoint("TOPLEFT", i, -i); t:SetPoint("BOTTOMRIGHT", -i, i) else t:SetAllPoints() end
    Slice(t, small and 8 or 14)
    local o = { parts = { t }, tex = t }
    function o:SetColor(cr, cg, cb, ca)
      if t.SetGradient and CreateColor then pcall(t.SetGradient, t, "HORIZONTAL", CreateColor(cr, cg, cb, ca or 1), CreateColor(cr, cg, cb, ca or 1)) end
      t:SetVertexColor(cr, cg, cb, ca or 1)
    end
    function o:SetGradient(c1, c2) t:SetVertexColor(1, 1, 1, 1); Grad(t, "HORIZONTAL", c1[1], c1[2], c1[3], c1[4] or 1, c2[1], c2[2], c2[3], c2[4] or 1) end
    -- senkrechter Verlauf: oben -> unten
    function o:SetGradientV(top, bot) t:SetVertexColor(1, 1, 1, 1); Grad(t, "VERTICAL", bot[1], bot[2], bot[3], bot[4] or 1, top[1], top[2], top[3], top[4] or 1) end
    function o:SetShown(v) t:SetShown(v) end
    function o:SetAlpha(v) t:SetAlpha(v) end
    o:SetColor(col[1], col[2], col[3], col[4])
    return o
  end
  return RoundOld(parent, layer, sub, r, col, blend, inset)
end
function RoundOld(parent, layer, sub, r, col, blend, inset)
  local o = { parts = {} }
  local i = inset or 0
  local function T(file)
    local t = parent:CreateTexture(nil, layer or "BACKGROUND", nil, sub or 0)
    t:SetTexture(file or WHITE); if blend then t:SetBlendMode(blend) end
    o.parts[#o.parts + 1] = t; return t
  end
  for _, c in ipairs({ { 0, .5, 0, .5, "TOPLEFT", i, -i }, { .5, 1, 0, .5, "TOPRIGHT", -i, -i }, { 0, .5, .5, 1, "BOTTOMLEFT", i, i }, { .5, 1, .5, 1, "BOTTOMRIGHT", -i, i } }) do
    local t = T(CIRCLE); t:SetTexCoord(c[1], c[2], c[3], c[4]); t:SetSize(r, r); t:SetPoint(c[5], c[6], c[7])
  end
  local top = T(); top:SetPoint("TOPLEFT", r + i, -i); top:SetPoint("TOPRIGHT", -r - i, -i); top:SetHeight(r)
  local bot = T(); bot:SetPoint("BOTTOMLEFT", r + i, i); bot:SetPoint("BOTTOMRIGHT", -r - i, i); bot:SetHeight(r)
  local mid = T(); mid:SetPoint("TOPLEFT", i, -r - i); mid:SetPoint("BOTTOMRIGHT", -i, r + i)
  o.left = { o.parts[1], o.parts[3] }; o.right = { o.parts[2], o.parts[4] }; o.span = { top, bot, mid }
  o.topP = { o.parts[1], o.parts[2], top }; o.botP = { o.parts[3], o.parts[4], bot }; o.mid = mid
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
  -- Farbverlauf oben -> unten (bei Kapseln exakt: obere Haelfte c1 -> Mitte, untere Mitte -> c2)
  function o:SetGradientV(c1, c2)
    local a1, a2 = c1[4] or 1, c2[4] or 1
    if self.capsule then
      local m = { (c1[1] + c2[1]) / 2, (c1[2] + c2[2]) / 2, (c1[3] + c2[3]) / 2, (a1 + a2) / 2 }
      for _, t in ipairs(self.topP) do t:SetVertexColor(1, 1, 1, 1); Grad(t, "VERTICAL", m[1], m[2], m[3], m[4], c1[1], c1[2], c1[3], a1) end
      for _, t in ipairs(self.botP) do t:SetVertexColor(1, 1, 1, 1); Grad(t, "VERTICAL", c2[1], c2[2], c2[3], a2, m[1], m[2], m[3], m[4]) end
      return
    end
    for _, t in ipairs(self.topP) do t:SetVertexColor(c1[1], c1[2], c1[3], a1) end
    for _, t in ipairs(self.botP) do t:SetVertexColor(c2[1], c2[2], c2[3], a2) end
    self.mid:SetVertexColor(1, 1, 1, 1); Grad(self.mid, "VERTICAL", c2[1], c2[2], c2[3], a2, c1[1], c1[2], c1[3], a1)
  end
  function o:SetShown(v) for _, t in ipairs(self.parts) do t:SetShown(v) end end
  function o:SetAlpha(v) for _, t in ipairs(self.parts) do t:SetAlpha(v) end end
  o:SetColor(col[1], col[2], col[3], col[4])
  return o
end
-- Kapsel (Pille) mit exakt halbrunden Enden – fuer duenne Leisten, Schalter, Knoepfe
local function Capsule(parent, layer, sub, h, col, blend, inset)
  local o = RoundOld(parent, layer, sub, h / 2 - (inset or 0), col, blend, inset)
  o.capsule = true
  return o
end

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
-- setzt das Symbol; true = Blizzard-Atlas, false = eigene Grafik (weiss bzw. in r,g,b eingefaerbt)
local function SetIcon(tex, typ, r, g, b)
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
  tex:SetTexture(MEDIA .. "i_" .. typ); tex:SetTexCoord(0, 1, 0, 1); tex:SetVertexColor(r or 1, g or 1, b or 1, 1); return false
end

-- Text Buchstabe fuer Buchstabe einfaerben (2 oder 3 Farben)
local function GradText(txt, c1, c2, c3)
  local chars = {}
  for ch in txt:gmatch("[%z\1-\127\194-\244][\128-\191]*") do chars[#chars + 1] = ch end
  local out = {}
  for i, ch in ipairs(chars) do
    local t = #chars > 1 and (i - 1) / (#chars - 1) or 0
    local a, b = c1, c2
    if c3 then if t < 0.5 then t = t * 2 else a, b, t = c2, c3, (t - 0.5) * 2 end end
    out[#out + 1] = fmt("|cff%02x%02x%02x%s|r", floor((a[1] + (b[1] - a[1]) * t) * 255), floor((a[2] + (b[2] - a[2]) * t) * 255), floor((a[3] + (b[3] - a[3]) * t) * 255), ch)
  end
  return table.concat(out)
end

-- Haarlinie, die zu beiden Enden ausblendet (zwei Verlaufs-Haelften)
local function Hairline(p, layer, sub, vertical, a, cr, cg, cb)
  cr, cg, cb = cr or 1, cg or 1, cb or 1
  local h1, h2 = Tex(p, layer, sub), Tex(p, layer, sub)
  local o = { h1, h2, h1 = h1, h2 = h2 }
  function o:Place(rel, x1, y1, x2, y2)
    for _, t in ipairs(self) do t:ClearAllPoints() end
    if vertical then
      local mid = (y1 + y2) / 2
      h1:SetPoint("TOPLEFT", rel, "TOPLEFT", x1, y1); h1:SetSize(1, max(1, y1 - mid))
      h2:SetPoint("TOPLEFT", rel, "TOPLEFT", x1, mid); h2:SetSize(1, max(1, mid - y2))
      Grad(h1, "VERTICAL", cr, cg, cb, a, cr, cg, cb, 0); Grad(h2, "VERTICAL", cr, cg, cb, 0, cr, cg, cb, a)
    else
      local mid = (x1 + x2) / 2
      h1:SetPoint("TOPLEFT", rel, "TOPLEFT", x1, y1); h1:SetSize(max(1, mid - x1), 1)
      h2:SetPoint("TOPLEFT", rel, "TOPLEFT", mid, y1); h2:SetSize(max(1, x2 - mid), 1)
      Grad(h1, "HORIZONTAL", cr, cg, cb, 0, cr, cg, cb, a); Grad(h2, "HORIZONTAL", cr, cg, cb, a, cr, cg, cb, 0)
    end
  end
  function o:SetShown(v) h1:SetShown(v); h2:SetShown(v) end
  return o
end

-- Lichtkante oben: blendet links und rechts weich aus
local function TopLine(f, inset, a, layer, sub, y)
  y = y or 0
  local h1, h2 = Tex(f, layer or "BORDER", sub or 0), Tex(f, layer or "BORDER", sub or 0)
  h1:SetPoint("TOPLEFT", f, "TOPLEFT", inset, y); h1:SetPoint("TOPRIGHT", f, "TOP", 0, y); h1:SetHeight(1)
  h2:SetPoint("TOPLEFT", f, "TOP", 0, y); h2:SetPoint("TOPRIGHT", f, "TOPRIGHT", -inset, y); h2:SetHeight(1)
  Grad(h1, "HORIZONTAL", 1, 1, 1, 0, 1, 1, 1, a); Grad(h2, "HORIZONTAL", 1, 1, 1, a, 1, 1, 1, 0)
  local o = { h1 = h1, h2 = h2 }
  function o:SetShown(v) h1:SetShown(v); h2:SetShown(v) end
  return o
end

---------------------------------------------------------------------------
-- Neon-Glas: schwebende Flaeche mit Aussen-Leuchten, Verlaufskante, tiefem
-- Anthrazit-Koerper, Lichtkante oben und langsam treibenden Farbwolken (Aurora)
---------------------------------------------------------------------------
local AURORA = {}
local function Glass(f, o)
  o = o or {}
  local r = o.r or 14
  local pad = o.pad or 36
  local gl = CreateFrame("Frame", nil, f); gl:SetPoint("TOPLEFT", -pad, pad); gl:SetPoint("BOTTOMRIGHT", pad, -pad)
  gl:SetFrameLevel(max(0, (f:GetFrameLevel() or 1) - 1))
  local g
  if SLICE then
    g = MT(gl, "BACKGROUND", 0, "glow", "ADD"); g:SetAllPoints(); Slice(g, 60)
    g:SetVertexColor(1, 1, 1, 1); Grad(g, "HORIZONTAL", NEON[1], NEON[2], NEON[3], o.glowA or 0.30, AQUA[1], AQUA[2], AQUA[3], (o.glowA or 0.30) * 0.75)
  else
    g = Round(gl, "BACKGROUND", 0, 22, { NEON[1], NEON[2], NEON[3], 0.07 }, nil, 28)
  end
  -- Verlaufskante (1 px sichtbar) + Koerper darauf
  f.edge = Round(f, "BACKGROUND", 0, r, { 1, 1, 1, 1 })
  f.edge:SetGradient({ NEON[1], NEON[2], NEON[3], 0.80 }, { AQUA[1], AQUA[2], AQUA[3], 0.50 })
  f.body = Round(f, "BACKGROUND", 1, r, { 1, 1, 1, 1 }, nil, 1)
  f.body:SetGradientV({ 0.072, 0.092, 0.088, 0.96 }, { 0.030, 0.034, 0.048, 0.97 })
  -- feiner Farbschleier (gruen -> blau) ueber den ganzen Koerper
  f.tint = Round(f, "BACKGROUND", 2, r, { 1, 1, 1, 1 }, "ADD", 1)
  f.tint:SetGradient({ NEON[1], NEON[2], NEON[3], 0.05 }, { AQUA[1], AQUA[2], AQUA[3], 0.035 })
  -- Aurora: drei weiche Farbwolken, die langsam treiben
  if o.aurora then
    f.aur = {}
    for k, d in ipairs({ { NEON, 0.10, 240, 170, 0.11, 0.13, 0 }, { TEAL, 0.07, 200, 150, 0.09, 0.12, 2.1 }, { AQUA, 0.09, 220, 160, 0.13, 0.08, 4.2 } }) do
      local t = MT(f, "BORDER", k - 1, "dot", "ADD"); t:SetVertexColor(d[1][1], d[1][2], d[1][3], d[2])
      t:SetPoint("CENTER", f, "TOPLEFT", 60 * k, -40); t:SetSize(40, 40)
      f.aur[k] = { t = t, w = d[3], h = d[4], sx = d[5], sy = d[6], ph = d[7] }
    end
    AURORA[f] = true
  end
  -- Lichtschein + Lichtkante oben (innerhalb der Rundung)
  local sheen = Tex(f, "BORDER", 4); sheen:SetPoint("TOPLEFT", r, -1); sheen:SetPoint("TOPRIGHT", -r, -1); sheen:SetHeight(o.sheenH or 34)
  Grad(sheen, "VERTICAL", 1, 1, 1, 0, 1, 1, 1, 0.045)
  f.topLine = TopLine(f, r, 0.30, "BORDER", 5, -1)
  f.glow = { SetAlpha = function(_, a) g:SetAlpha(a) end }
end
local Panel = function(f) Glass(f) end   -- alter Name, gleiche Optik

local function GlassTick(f, now)
  local w, h = f:GetWidth() or 0, f:GetHeight() or 0
  if w < 40 or h < 40 then return end
  for _, b in ipairs(f.aur) do
    local bw, bh = min(w * 0.85, b.w), min(h * 0.85, b.h)
    b.t:SetSize(bw, bh)
    local cx = w * (0.5 + 0.34 * math.sin(now * b.sx + b.ph))
    local cy = h * (0.5 + 0.32 * math.cos(now * b.sy + b.ph * 1.7))
    cx = max(bw / 2, min(w - bw / 2, cx)); cy = max(bh / 2, min(h - bh / 2, cy))
    b.t:SetPoint("CENTER", f, "TOPLEFT", cx, -cy)
  end
end

---------------------------------------------------------------------------
-- Leucht-Kugel: Halo, Verlaufsring, dunkle Glasscheibe, Glanz, Spielsymbol
---------------------------------------------------------------------------
local function OrbBadge(p, size)
  local o = {}
  o.halo  = MT(p, "BORDER", 6, "dot", "ADD")
  o.ring  = MT(p, "ARTWORK", 0, "ctx_ring", "ADD")
  o.disc  = MT(p, "ARTWORK", 1, "ctx_disc"); o.disc:SetVertexColor(0.032, 0.042, 0.048, 0.97)
  o.gloss = MT(p, "ARTWORK", 2, "ctx_gloss", "ADD"); o.gloss:SetVertexColor(1, 1, 1, 0.22)
  o.icon  = p:CreateTexture(nil, "ARTWORK", nil, 3)
  o.halo:SetAlpha(0.3)
  for _, t in ipairs({ o.halo, o.ring, o.gloss, o.icon }) do t:SetPoint("CENTER", o.disc, "CENTER") end
  function o:SetSize(s)
    self.size = s
    self.halo:SetSize(s * 2.2, s * 2.2); self.ring:SetSize(s * 1.62, s * 1.62)
    self.disc:SetSize(s * 1.49, s * 1.49); self.gloss:SetSize(s * 1.49, s * 1.49)
    local k = self.atlas and 0.80 or 0.54; self.icon:SetSize(s * k, s * k)
  end
  function o:SetPoint(...) self.disc:ClearAllPoints(); self.disc:SetPoint(...) end
  -- Ring: eine Farbe oder Verlauf (c unten -> c2 oben)
  function o:Tint(c, c2, a)
    self.ring:SetVertexColor(1, 1, 1, 1)
    if c2 then Grad(self.ring, "VERTICAL", c[1], c[2], c[3], a or 1, c2[1], c2[2], c2[3], a or 1)
    else self.ring:SetVertexColor(c[1], c[2], c[3], a or 1) end
    self.halo:SetVertexColor(c[1], c[2], c[3], 1)
  end
  function o:Icon(typ, r, g, b)
    self.atlas = SetIcon(self.icon, typ or "note", r, g, b)
    self:SetSize(self.size or size)
    return self.atlas
  end
  function o:SetShown(v) for _, t in ipairs({ self.halo, self.ring, self.disc, self.gloss, self.icon }) do t:SetShown(v) end end
  o:SetSize(size)
  return o
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

-- Routen-Zustand: Plan-Zeiger (gespeichert je Route in DB.plan), aktuelles Ziel, Liste
local RT = { key = nil, idx = nil, list = {}, cur = nil, ptr = nil, info = nil, logReady = false, loginT = nil, wait = false }
local announce -- weiter unten (Meldung bei Einstieg/Sprung)
local function routeUpdate()
  if not (DB and LP_Route) then return end
  local R = LP_Route
  local faction = UnitFactionGroup("player")   -- englisches Kürzel ("Horde"/"Alliance"), nicht der übersetzte Name
  local lvl = UnitLevel("player")
  RT.key = R.Pick(faction, lvl, DB.route)
  local route = RT.key and LevelPilot_Routes[RT.key]
  local rk = RT.key or "-"
  DB.skipK[rk] = DB.skipK[rk] or {}
  DB.plan[rk] = DB.plan[rk] or {}
  local plan = DB.plan[rk]
  -- Einstieg erst, wenn Questlog und Questie-Daten da sind (sonst falscher Stand), spaetestens nach 20 s
  RT.wait = false
  if route and not plan.k then
    local ready = RT.logReady and (R.HasQuestie() or (RT.loginT and GetTime() - RT.loginT > 20))
    if not ready then RT.wait = true; RT.idx, RT.list, RT.info, RT.ptr = nil, {}, nil, nil; return end
  end
  local idx, list, info = R.Plan(route, lvl, DB.skipK[rk], plan, DB.rows or 6, RT.cur)
  if idx ~= RT.idx then RT.cur = idx and { i = idx, since = GetTime() } or nil end
  RT.idx, RT.list, RT.info, RT.ptr = idx, list or {}, info, info and info.ptr
  if info and (info.entry or info.jumped) and announce then announce(route, info) end
end

-- Schritt ueberspringen / zurueckholen (ueber stabilen Schluessel, nicht ueber die Nummer)
local function SkipStep(i)
  local route = RT.key and LevelPilot_Routes[RT.key]
  local s = route and i and route.steps[i]
  if not s then return end
  local k = LP_Route.StepKey(s)
  DB.skipK[RT.key] = DB.skipK[RT.key] or {}
  DB.skipK[RT.key][k] = true
  table.insert(DB.skipLog, { r = RT.key, k = k, t = time() })
  while #DB.skipLog > 50 do table.remove(DB.skipLog, 1) end
end

local function routeTarget()
  local route = RT.key and LevelPilot_Routes[RT.key]
  local s = route and RT.idx and route.steps[RT.idx]
  if not s then return end
  local t, first = LP_Route.GoalTarget(s)
  if not t then return { title = LP_Route.StepTitle(s), step = s } end
  t = { map = t.map, x = t.x, y = t.y, npc = t.npc, spot = t.spot, count = t.count }
  t.title = LP_Route.StepTitle(s); t.step = s; t.turnin = (s.t == "turnin") and not first; t.first = first
  return t
end

local function baseTarget()
  if DB and DB.mode == "route" and RT.key then return routeTarget() end
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
-- Hauptfenster · Design 4.1 "Neon Glass"
-- Kopf (Stufen-Kugel, Titel, Glasknoepfe) · fluessige XP-Leiste · Kennzahlen-Band
-- Hero-Karte + Zeitleiste · Flug-Kapsel · Bedienleiste (Segment + Schalter)
---------------------------------------------------------------------------
local W = 340
local HEAD_Q, HEAD_R = 128, 188   -- Kopf + XP + Kennzahlen (+ Plan-Band im Routen-Modus) = Hoehe eingeklappt
local HEAD_H = HEAD_R
local listTop = -(HEAD_H + 4)
local DOCK_H = 44         -- Bedienleiste unten inkl. Rand
local TLX = 44            -- x der Zeitleiste (Mitte aller Kugeln)
local COL = { accept = "ffd24d", turnin = "39ff6b", complete = "3ee8d0", fly = "4fd2ff", hearth = "4fd2ff",
  train = "c78bff", go = "4fd2ff", grind = "ff8a3d", note = "aaaaaa" }
local function hex(col) return tonumber(col:sub(1, 2), 16) / 255, tonumber(col:sub(3, 4), 16) / 255, tonumber(col:sub(5, 6), 16) / 255 end
local function lighten(r, g, b, k) k = k or 0.45; return { r + (1 - r) * k, g + (1 - g) * k, b + (1 - b) * k } end

local M = CreateFrame("Frame", "LevelPilotFrame", UIParent)
M:SetSize(W, 160)
M:SetClampedToScreen(true)
M:SetMovable(true); M:EnableMouse(true); M:RegisterForDrag("LeftButton")
M:SetScript("OnDragStart", function(s) if not DB.locked then s:StartMoving() end end)
M:SetScript("OnDragStop", function(s)
  s:StopMovingOrSizing()
  local p, _, _, x, y = s:GetPoint(); DB.point, DB.x, DB.y = p, x, y
end)
Glass(M, { aurora = true })

local Refresh      -- vorab
local OpenSettings -- vorab
local LOGP         -- Questlog-Check (vorab, damit Einstellungen es schliessen koennen)

---------------------------------------------------------------------------
-- Glas-Tooltip (ersetzt den grauen Standard-Tooltip)
---------------------------------------------------------------------------
local TIP = CreateFrame("Frame", "LevelPilotTip", UIParent)
TIP:SetFrameStrata("TOOLTIP"); TIP:SetClampedToScreen(true); TIP:SetSize(200, 60); TIP:Hide()
Glass(TIP, { r = 12, glowA = 0.22, sheenH = 22, pad = 42 })
TIP.lines, TIP.n = {}, 0
function TIP:Begin(owner, side)
  self.owner, self.side, self.n = owner, side, 0
  for _, l in ipairs(self.lines) do l:Hide() end
  return self
end
function TIP:Line(txt, r, g, b, big)
  if not txt or txt == "" then return end
  self.n = self.n + 1
  local l = self.lines[self.n]
  if not l then l = UI(self, 11); l:SetJustifyH("LEFT"); l:SetWordWrap(true); self.lines[self.n] = l end
  l:SetFont(FONT_UI, big and 13 or 11, big and "OUTLINE" or "")
  l:SetTextColor(r or 0.82, g or 0.87, b or 0.88); l:SetWidth(0); l:SetText(txt); l:Show()
end
function TIP:Open()
  local wmax = 0
  for i = 1, self.n do
    local l = self.lines[i]
    local w = (l.GetUnboundedStringWidth and l:GetUnboundedStringWidth()) or l:GetStringWidth() or 0
    if w > wmax then wmax = w end
  end
  local w = max(150, min(290, wmax + 2))
  local y = -12
  for i = 1, self.n do
    local l = self.lines[i]
    l:ClearAllPoints(); l:SetWidth(w); l:SetPoint("TOPLEFT", 14, y)
    y = y - (l:GetStringHeight() or 12) - (i == 1 and 6 or 3)
  end
  self:SetSize(w + 28, -y + 9)
  -- links neben das Fenster, sonst rechts daneben
  self:ClearAllPoints()
  local o, s = self.owner, self.side or self.owner
  local sl, ol = s:GetLeft(), o:GetLeft()
  if sl and ol and sl > w + 70 then
    self:SetPoint("TOPRIGHT", o, "TOPLEFT", -(ol - sl) - 14, 0)
  else
    local sr, orr = s:GetRight(), o:GetRight()
    self:SetPoint("TOPLEFT", o, "TOPRIGHT", (sr and orr) and (sr - orr + 14) or 14, 0)
  end
  self:Show()
end
local function TipLeave() TIP:Hide() end

---------------------------------------------------------------------------
-- Kopf
---------------------------------------------------------------------------
local lvlTxt, subHead, bColIc, LO
do
  local lvlOrb = CreateFrame("Button", nil, M); lvlOrb:SetSize(40, 40); lvlOrb:SetPoint("TOPLEFT", 14, -12)
  LO = OrbBadge(lvlOrb, 36); LO:SetPoint("CENTER"); LO:Tint(NEON, AQUA); LO.icon:Hide()
  lvlTxt = UI(lvlOrb, 15, true); lvlTxt:SetPoint("CENTER", 0, 0)
  lvlOrb:SetScript("OnEnter", function(self)
    local x = M.xi; if not x then return end
    TIP:Begin(self, M):Line("Stufe " .. x.lvl, NEON[1], NEON[2], NEON[3], true)
    TIP:Line(fmt("%s / %s XP  ·  %.1f %%", fmtNum(x.cur), fmtNum(x.mx), x.cur / x.mx * 100), 1, 1, 1)
    if x.rest > 0 then TIP:Line(fmt("Erholt: %s XP (%d %%)", fmtNum(x.rest), floor(x.rest / x.mx * 100 + 0.5)), 0.25, 0.71, 1) end
    TIP:Line(x.xph > 0 and ("XP pro Stunde: " .. fmtNum(x.xph)) or "XP pro Stunde: wird gemessen …", 0.75, 0.8, 0.82)
    TIP:Line("/lp xp startet die Messung neu", 0.5, 0.55, 0.58)
    TIP:Open()
  end)
  lvlOrb:SetScript("OnLeave", TipLeave)

  local head = UI(M, 16, true); head:SetPoint("TOPLEFT", lvlOrb, "TOPRIGHT", 10, -5)
  head:SetText(GradText("LEVELPILOT", NEON, TEAL, AQUA))
  subHead = UI(M, 10); subHead:SetPoint("TOPLEFT", head, "BOTTOMLEFT", 0, -3); subHead:SetWidth(W - 64 - 84)
  subHead:SetJustifyH("LEFT"); subHead:SetWordWrap(false); subHead:SetTextColor(0.58, 0.63, 0.66)

  -- runde Glasknoepfe (Scheibe, feiner Ring, Neon beim Ueberfahren)
  local function GlassButton(size, fn, tip)
    local b = CreateFrame("Button", nil, M); b:SetSize(size, size)
    local d = MT(b, "BACKGROUND", 0, "ctx_disc"); d:SetPoint("CENTER"); d:SetSize(size * 1.49, size * 1.49); d:SetVertexColor(1, 1, 1, 0.07)
    local rg = MT(b, "BORDER", 0, "ctx_ring", "ADD"); rg:SetPoint("CENTER"); rg:SetSize(size * 1.47, size * 1.47); rg:SetVertexColor(1, 1, 1, 0.13)
    local h1 = MT(b, "HIGHLIGHT", 0, "ctx_disc", "ADD"); h1:SetPoint("CENTER"); h1:SetSize(size * 1.49, size * 1.49); h1:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.16)
    local h2 = MT(b, "HIGHLIGHT", 1, "ctx_ring", "ADD"); h2:SetPoint("CENTER"); h2:SetSize(size * 1.47, size * 1.47); h2:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.9)
    b:SetScript("OnClick", fn)
    b:SetScript("OnEnter", function(self) TIP:Begin(self, M):Line(type(tip) == "function" and tip() or tip, 0.85, 0.9, 0.9); TIP:Open() end)
    b:SetScript("OnLeave", TipLeave)
    return b
  end
  local bCol = GlassButton(26, function() DB.collapsed = not DB.collapsed; Refresh(true) end,
    function() return DB and DB.collapsed and "Ausklappen" or "Einklappen" end)
  bCol:SetPoint("TOPRIGHT", -14, -17)
  bColIc = MT(bCol, "ARTWORK", 0, "i_arrow"); bColIc:SetPoint("CENTER"); bColIc:SetSize(11, 11); bColIc:SetVertexColor(0.85, 0.9, 0.9, 1)
  local bMenu = GlassButton(26, function() OpenSettings() end, "Einstellungen")
  bMenu:SetPoint("RIGHT", bCol, "LEFT", -7, 0)
  for k = -1, 1 do local d = Tex(bMenu, "ARTWORK", 0, CIRCLE); d:SetSize(3.5, 3.5); d:SetPoint("CENTER", k * 5.5, 0); d:SetVertexColor(0.85, 0.9, 0.9, 1) end
end

---------------------------------------------------------------------------
-- XP: fluessige Leiste mit Leuchten, Funke und Lichtlauf
---------------------------------------------------------------------------
local X = { W = W - 28, fw = 8 }   -- XP-Leiste
do
  X.L = UI(M, 10); X.L:SetPoint("TOPLEFT", 16, -61); X.L:SetTextColor(0.62, 0.67, 0.7)
  X.txt = UI(M, 10, true); X.txt:SetPoint("TOPRIGHT", -16, -61)
  local xpFrame = CreateFrame("Frame", nil, M); xpFrame:SetPoint("TOPLEFT", 14, -76); xpFrame:SetSize(X.W, 8)
  Capsule(xpFrame, "BACKGROUND", 0, 8, { 1, 1, 1, 1 }):SetGradientV({ 0, 0, 0, 0.75 }, { 1, 1, 1, 0.07 })
  X.restF = CreateFrame("Frame", nil, xpFrame); X.restF:SetPoint("TOPLEFT"); X.restF:SetSize(8, 8)
  Capsule(X.restF, "BORDER", 0, 8, { 1, 1, 1, 1 }):SetGradient({ AQUA[1], AQUA[2], AQUA[3], 0.18 }, { AQUA[1], AQUA[2], AQUA[3], 0.55 })
  X.fill = CreateFrame("Frame", nil, xpFrame); X.fill:SetPoint("TOPLEFT"); X.fill:SetSize(8, 8)
  X.fill:SetFrameLevel(X.restF:GetFrameLevel() + 1)
  local xpGlow = MT(X.fill, "BACKGROUND", 0, "dot", "ADD"); xpGlow:SetPoint("TOPLEFT", -10, 9); xpGlow:SetPoint("BOTTOMRIGHT", 10, -9)
  xpGlow:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.22)
  Capsule(X.fill, "ARTWORK", 0, 8, { 1, 1, 1, 1 }):SetGradient({ 0.10, 0.78, 0.80, 1 }, { NEON[1], NEON[2], NEON[3], 1 })
  local xpGloss = Tex(X.fill, "ARTWORK", 1); xpGloss:SetPoint("TOPLEFT", 4, -1); xpGloss:SetPoint("TOPRIGHT", -4, -1); xpGloss:SetHeight(3)
  Grad(xpGloss, "VERTICAL", 1, 1, 1, 0, 1, 1, 1, 0.38)
  X.shine = MT(X.fill, "OVERLAY", 0, "dot", "ADD"); X.shine:SetSize(46, 10); X.shine:SetVertexColor(1, 1, 1, 1); X.shine:Hide()
  local xpSpark = MT(X.fill, "OVERLAY", 1, "dot", "ADD"); xpSpark:SetSize(20, 20); xpSpark:SetPoint("CENTER", X.fill, "RIGHT", -3, 0)
  xpSpark:SetVertexColor(0.8, 1, 0.88, 0.95)
end

-- Kennzahlen-Band: Symbol mit Leuchten, grosse Zahl, kleine Beschriftung – ohne Kaesten
local CHIPS = {}
do
  local SW = (W - 28) / 3
  for i = 1, 3 do
    local c = CreateFrame("Frame", nil, M); c:SetSize(SW, 30); c:SetPoint("TOPLEFT", 14 + (i - 1) * SW, -94)
    local col = ({ NEON, TEAL, AQUA })[i]
    c.ic = MT(c, "ARTWORK", 0, ({ "i_xph", "i_need", "i_time" })[i]); c.ic:SetSize(15, 15); c.ic:SetPoint("LEFT", i == 1 and 4 or 14, 0)
    c.ic:SetVertexColor(col[1], col[2], col[3], 1)
    c.g = MT(c, "BACKGROUND", 0, "dot", "ADD"); c.g:SetSize(34, 34); c.g:SetPoint("CENTER", c.ic, "CENTER"); c.g:SetVertexColor(col[1], col[2], col[3], 0.30)
    c.v = UI(c, 15, true); c.v:SetPoint("TOPLEFT", c.ic, "TOPRIGHT", 8, 9)
    c.l = UI(c, 8); c.l:SetPoint("BOTTOMLEFT", c, "BOTTOMLEFT", (i == 1 and 4 or 14) + 23, 1); c.l:SetTextColor(0.5, 0.55, 0.58)
    CHIPS[i] = c
  end
  CHIPS[1].l:SetText("XP / STUNDE"); CHIPS[2].l:SetText("FEHLENDE XP"); CHIPS[3].l:SetText("BIS LEVEL-UP")
  for i = 2, 3 do Hairline(M, "BORDER", 2, true, 0.16):Place(M, 14 + (i - 1) * SW, -94, 0, -124) end
end
local divider = Hairline(M, "BORDER", 2, false, 0.13); divider:Place(M, 14, -(HEAD_H - 1), W - 14, 0)

---------------------------------------------------------------------------
-- Lagebild: Plan-Band (Abschnitte als Kapseln, leuchtender Zeiger) + Status-Pillen
---------------------------------------------------------------------------
local BAND = {}
local OpenLog   -- Questlog-Check (weiter unten)
do
  local BW = W - 28
  local B = CreateFrame("Button", nil, M); B:SetPoint("TOPLEFT", 14, -128); B:SetSize(BW, 30)
  BAND.f = B
  BAND.ic = MT(B, "ARTWORK", 0, "i_flag"); BAND.ic:SetSize(11, 11); BAND.ic:SetPoint("TOPLEFT", 1, -6)
  BAND.icG = MT(B, "BACKGROUND", 0, "dot", "ADD"); BAND.icG:SetSize(26, 26); BAND.icG:SetPoint("CENTER", BAND.ic, "CENTER")
  BAND.lbl = UI(B, 10.5); BAND.lbl:SetPoint("TOPLEFT", 18, -5); BAND.lbl:SetWidth(BW - 18 - 86)
  BAND.lbl:SetJustifyH("LEFT"); BAND.lbl:SetWordWrap(false)
  BAND.step = UI(B, 10, true); BAND.step:SetPoint("TOPRIGHT", 0, -5); BAND.step:SetJustifyH("RIGHT")
  -- Spur: eine Kapsel je Abschnitt, Fuellung mit Verlauf, Zeiger als Leuchtpunkt
  BAND.track = CreateFrame("Frame", nil, B); BAND.track:SetPoint("TOPLEFT", 0, -22); BAND.track:SetSize(BW, 6)
  BAND.segs = {}
  for k = 1, 12 do
    local g = CreateFrame("Frame", nil, BAND.track); g:SetHeight(6); g:SetWidth(10)
    g.bg = Capsule(g, "BACKGROUND", 0, 6, { 1, 1, 1, 0.08 })
    g.fill = CreateFrame("Frame", nil, g); g.fill:SetPoint("TOPLEFT"); g.fill:SetSize(6, 6)
    g.fg = Capsule(g.fill, "ARTWORK", 0, 6, { 1, 1, 1, 1 })
    g:Hide(); BAND.segs[k] = g
  end
  local mk = CreateFrame("Frame", nil, BAND.track); mk:SetSize(14, 14); mk:SetFrameLevel(BAND.track:GetFrameLevel() + 6)
  BAND.mk = mk
  BAND.mkG = MT(mk, "BACKGROUND", 0, "dot", "ADD"); BAND.mkG:SetSize(34, 34); BAND.mkG:SetPoint("CENTER"); BAND.mkG:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.9)
  BAND.mkR = MT(mk, "ARTWORK", 0, "ctx_ring", "ADD"); BAND.mkR:SetSize(15, 15); BAND.mkR:SetPoint("CENTER"); BAND.mkR:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
  BAND.mkD = MT(mk, "ARTWORK", 1, "ctx_disc"); BAND.mkD:SetSize(9, 9); BAND.mkD:SetPoint("CENTER"); BAND.mkD:SetVertexColor(1, 1, 1, 1)
  B:SetScript("OnClick", function() SlashCmdList.LEVELPILOT("einstieg") end)
  B:SetScript("OnEnter", function(self) if BAND.tip then TIP:Begin(self, M); for _, l in ipairs(BAND.tip) do TIP:Line(l[1], l[2], l[3], l[4], l[5]) end; TIP:Open() end end)
  B:SetScript("OnLeave", TipLeave)

  -- Status-Pillen: Glas-Kapsel mit Farbschleier, Leuchtsymbol, Text
  local function Pill(anchor, x)
    local b = CreateFrame("Button", nil, M); b:SetHeight(22); b:SetWidth(120)
    b:SetPoint(anchor, M, anchor, x, -160)
    b.glow = MT(b, "BACKGROUND", 0, "glow", "ADD"); b.glow:SetPoint("TOPLEFT", -16, 16); b.glow:SetPoint("BOTTOMRIGHT", 16, -16)
    if SLICE then Slice(b.glow, 60) else b.glow:Hide() end
    b.bg = Capsule(b, "BACKGROUND", 1, 22, { 1, 1, 1, 1 })
    b.sh = Capsule(b, "BORDER", 0, 22, { 1, 1, 1, 1 }, nil, 1); b.sh:SetGradientV({ 1, 1, 1, 0.07 }, { 1, 1, 1, 0.0 })
    Capsule(b, "HIGHLIGHT", 0, 22, { 1, 1, 1, 1 }, "ADD"):SetGradient({ 1, 1, 1, 0.08 }, { 1, 1, 1, 0.02 })
    b.ic = MT(b, "ARTWORK", 0, "i_flag"); b.ic:SetSize(11, 11); b.ic:SetPoint("LEFT", 9, 0)
    b.t = UI(b, 9.5, true); b.t:SetPoint("LEFT", 25, 0); b.t:SetJustifyH("LEFT"); b.t:SetWordWrap(false)
    function b:Set(txt, c, icon)
      self.t:SetText(txt)
      self.ic:SetTexture(MEDIA .. icon); self.ic:SetVertexColor(c[1], c[2], c[3], 1)
      self.bg:SetGradient({ c[1], c[2], c[3], 0.22 }, { c[1], c[2], c[3], 0.06 })
      self.glow:SetVertexColor(1, 1, 1, 1); Grad(self.glow, "HORIZONTAL", c[1], c[2], c[3], 0.16, c[1], c[2], c[3], 0.03)
      self:SetWidth(min(BW / 2 - 4, (self.t:GetStringWidth() or 60) + 36))
    end
    b:SetScript("OnEnter", function(self) if self.tip then TIP:Begin(self, M); for _, l in ipairs(self.tip) do TIP:Line(l[1], l[2], l[3], l[4], l[5]) end; TIP:Open() end end)
    b:SetScript("OnLeave", TipLeave)
    return b
  end
  BAND.pLvl = Pill("TOPLEFT", 14)
  BAND.pLog = Pill("TOPRIGHT", -14)
  BAND.pLog:SetScript("OnClick", function() if OpenLog then OpenLog() end end)
  BAND.pLvl:SetScript("OnClick", function() SlashCmdList.LEVELPILOT("plan") end)
  function BAND:SetShown(v) self.f:SetShown(v); self.pLvl:SetShown(v); self.pLog:SetShown(v) end
end

---------------------------------------------------------------------------
-- Schritte: Hero-Karte (aktueller Schritt) + Zeitleiste (naechste Schritte)
---------------------------------------------------------------------------
local ROWS = {}
local TL = Tex(M, "BORDER", 3)                       -- Zeitachse hinter den Kugeln
TL:SetWidth(2); Grad(TL, "VERTICAL", TEAL[1], TEAL[2], TEAL[3], 0.04, NEON[1], NEON[2], NEON[3], 0.55); TL:Hide()
local ETA_W = 58                                      -- Platz fuer "ca. 2 min" rechts neben der Linie
local PW = W - 24 - 66 - 14 - ETA_W                   -- Breite der Fortschrittslinie
for i = 1, 10 do
  local r = CreateFrame("Button", nil, M)
  r:SetHeight(26); r.h = 26
  r.hero = {}
  if SLICE then
    r.glow = MT(r, "BACKGROUND", -8, "glow", "ADD"); r.glow:SetPoint("TOPLEFT", -30, 30); r.glow:SetPoint("BOTTOMRIGHT", 30, -30); Slice(r.glow, 60)
    r.hero[#r.hero + 1] = r.glow
  end
  r.wash = Round(r, "BACKGROUND", 0, 14, { 1, 1, 1, 1 })
  r.base = Round(r, "BACKGROUND", 1, 14, { 1, 1, 1, 1 }); r.base:SetGradientV({ 1, 1, 1, 0.07 }, { 1, 1, 1, 0.012 })
  r.edge = TopLine(r, 14, 0.28, "BORDER", 0)
  r.hero[#r.hero + 1] = r.wash; r.hero[#r.hero + 1] = r.base; r.hero[#r.hero + 1] = r.edge
  Round(r, "HIGHLIGHT", 0, 8, { 1, 1, 1, 1 }, "ADD"):SetGradient({ NEON[1], NEON[2], NEON[3], 0.10 }, { AQUA[1], AQUA[2], AQUA[3], 0.02 })
  r.orb = OrbBadge(r, 20)
  r.title = UI(r, 12); r.title:SetJustifyH("LEFT"); r.title:SetWordWrap(false)
  r.sub = UI(r, 10); r.sub:SetJustifyH("LEFT"); r.sub:SetWordWrap(false); r.sub:SetTextColor(0.6, 0.65, 0.67)
  r.dist = UI(r, 13, true); r.dist:SetJustifyH("RIGHT")
  r.kind = UI(r, 10, true); r.kind:SetJustifyH("LEFT"); r.kind:SetWordWrap(false)
  r.eta = UI(r, 10); r.eta:SetJustifyH("RIGHT"); r.eta:SetTextColor(0.62, 0.68, 0.7)
  -- Etikett als Pille (z. B. "ab St. 26", "+1.4k XP")
  r.tagF = CreateFrame("Frame", nil, r); r.tagF:SetSize(50, 16); r.tagF:Hide()
  r.tagBg = Capsule(r.tagF, "BACKGROUND", 0, 16, { 1, 1, 1, 0.08 })
  r.tag = UI(r.tagF, 9, true); r.tag:SetPoint("CENTER", 0, 0)
  -- Fortschritt (nur Hero): Questziele bzw. XP beim Grinden
  r.pf = CreateFrame("Frame", nil, r); r.pf:SetHeight(4); r.pf:SetPoint("BOTTOMLEFT", 66, 10); r.pf:SetPoint("BOTTOMRIGHT", -14 - ETA_W, 10); r.pf:Hide()
  Capsule(r.pf, "BACKGROUND", 0, 4, { 1, 1, 1, 0.09 })
  r.pff = CreateFrame("Frame", nil, r.pf); r.pff:SetPoint("TOPLEFT"); r.pff:SetSize(4, 4)
  r.pfg = MT(r.pff, "BACKGROUND", 0, "dot", "ADD"); r.pfg:SetPoint("TOPLEFT", -8, 8); r.pfg:SetPoint("BOTTOMRIGHT", 8, -8)
  r.pfr = Capsule(r.pff, "ARTWORK", 0, 4, { 1, 1, 1, 1 })

  function r:SetTag(txt, cr, cg, cb)
    if not txt then self.tagF:Hide(); return end
    self.tag:SetText(txt)
    if cr then self.tag:SetTextColor(cr, cg, cb); self.tagBg:SetColor(cr, cg, cb, 0.16)
    else self.tag:SetTextColor(0.85, 0.9, 0.92); self.tagBg:SetColor(1, 1, 1, 0.08) end
    self.tagF:SetWidth(max(30, (self.tag:GetStringWidth() or 36) + 14)); self.tagF:Show()
  end
  function r:SetProgress(frac, cr, cg, cb)
    if not frac then self.pf:Hide(); return end
    frac = max(0, min(1, frac))
    self.pff:SetWidth(max(4, PW * frac))
    self.pfr:SetGradient({ cr, cg, cb, 1 }, { NEON[1], NEON[2], NEON[3], 1 })
    self.pfg:SetVertexColor(cr, cg, cb, 0.35); self.pf:Show()
  end
  function r:SetWash(cr, cg, cb, a)
    a = a or 0.24
    self.wash:SetGradient({ cr, cg, cb, a }, { cr, cg, cb, a * 0.12 })
    if self.glow then self.glow:SetVertexColor(1, 1, 1, 1); Grad(self.glow, "HORIZONTAL", cr, cg, cb, a * 0.9, cr, cg, cb, a * 0.2) end
  end
  function r:Style(kind)
    local hero, quest = kind == "hero", kind == "quest"
    self.h = hero and 80 or (quest and 42 or 26)
    self:SetHeight(self.h); self:SetAlpha(1)
    for _, p in ipairs(self.hero) do p:SetShown(hero) end
    self.orb:SetSize(hero and 44 or (quest and 26 or 20)); self.orb:SetPoint("CENTER", self, "LEFT", 32, 0)
    self.orb.halo:SetShown(hero); self.orb.icon:SetDesaturated(false)
    self.tagF:Hide(); self.pf:Hide()
    for _, f in ipairs({ self.title, self.sub, self.dist, self.kind, self.eta, self.tagF }) do f:ClearAllPoints() end
    local rw = W - 24
    if hero then
      self.kind:Show(); self.eta:Show(); self.sub:Show()
      -- Entfernung oben rechts auf der Art-Zeile, Titel ueber die volle Breite, Zeit am Ende der Fortschrittslinie
      self.kind:SetPoint("TOPLEFT", 66, -12); self.kind:SetWidth(rw - 66 - 14 - 72)
      self.dist:SetFont(FONT_UI, 15, "OUTLINE"); self.dist:SetPoint("TOPRIGHT", -14, -8)
      self.title:SetFont(FONT_UI, 15, "OUTLINE"); self.title:SetPoint("TOPLEFT", self.kind, "BOTTOMLEFT", 0, -3); self.title:SetWidth(rw - 66 - 14)
      self.sub:SetFont(FONT_UI, 10.5, ""); self.sub:SetPoint("TOPLEFT", self.title, "BOTTOMLEFT", 0, -5); self.sub:SetWidth(rw - 66 - 14)
      self.eta:SetPoint("RIGHT", self, "BOTTOMRIGHT", -14, 12)
    elseif kind == "compact" then
      self.kind:Hide(); self.eta:Hide(); self.sub:Hide()
      self.title:SetFont(FONT_UI, 12, ""); self.title:SetPoint("LEFT", 52, 0); self.title:SetWidth(rw - 52 - 78)
      self.dist:SetFont(FONT_UI, 11, ""); self.dist:SetPoint("RIGHT", -12, 0)
      self.tagF:SetPoint("RIGHT", -10, 0)
    else
      self.kind:Hide(); self.eta:Hide(); self.sub:Show()
      self.title:SetFont(FONT_UI, 12.5, ""); self.title:SetPoint("TOPLEFT", 56, -7); self.title:SetWidth(rw - 56 - 86)
      self.sub:SetFont(FONT_UI, 10, ""); self.sub:SetPoint("TOPLEFT", self.title, "BOTTOMLEFT", 0, -3); self.sub:SetWidth(rw - 56 - 86)
      self.dist:SetFont(FONT_UI, 12, "OUTLINE"); self.dist:SetPoint("TOPRIGHT", -12, -7)
      self.tagF:SetPoint("TOPRIGHT", -10, -22)
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
    if not self.tip then return end
    TIP:Begin(self, M)
    for _, l in ipairs(self.tip) do TIP:Line(l[1], l[2], l[3], l[4], l[5]) end
    TIP:Open()
  end)
  r:SetScript("OnLeave", TipLeave)
  r:Hide()
  ROWS[i] = r
end

-- Karten anordnen + Zeitachse ziehen; liefert die Unterkante der Liste (positiv)
local function LayoutRows(n, mode)
  local y = listTop
  local tlTop, tlBot
  for i = 1, n do
    local r = ROWS[i]
    local kind = mode == "route" and (i == 1 and "hero" or "compact") or "quest"
    r:Style(kind)
    r:ClearAllPoints(); r:SetPoint("TOPLEFT", 12, y); r:SetPoint("TOPRIGHT", -12, y)
    if kind == "hero" then tlTop = y - r.h + 2
    else tlTop = tlTop or (y - r.h / 2); tlBot = y - r.h / 2 end
    y = y - r.h - (kind == "hero" and 10 or (kind == "quest" and 4 or 2))
  end
  if tlTop and tlBot and tlTop > tlBot then
    TL:ClearAllPoints(); TL:SetPoint("TOP", M, "TOPLEFT", TLX, tlTop); TL:SetHeight(tlTop - tlBot); TL:Show()
  else
    TL:Hide()
  end
  return -y
end
local empty = UI(M, 11); empty:SetPoint("TOPLEFT", 18, listTop - 8); empty:SetWidth(W - 36); empty:SetTextColor(0.6, 0.65, 0.68)
empty:SetText("Keine angenommenen Quests auf dieser Karte.\nNeue Quests zeigt dir Questie (gelbes !).")
empty:SetJustifyH("LEFT")

---------------------------------------------------------------------------
-- Flug-Kapsel (Fliegen / Ruhestein spart Zeit)
---------------------------------------------------------------------------
local FlyBanner
do
  local FB = CreateFrame("Button", nil, M); FB:SetHeight(50); FB:Hide()
  if SLICE then
    local g = MT(FB, "BACKGROUND", -8, "glow", "ADD"); g:SetPoint("TOPLEFT", -36, 36); g:SetPoint("BOTTOMRIGHT", 36, -36); Slice(g, 60)
    g:SetVertexColor(1, 1, 1, 1); Grad(g, "HORIZONTAL", AQUA[1], AQUA[2], AQUA[3], 0.22, TEAL[1], TEAL[2], TEAL[3], 0.05)
  end
  Round(FB, "BACKGROUND", 0, 14, { 1, 1, 1, 1 }):SetGradient({ AQUA[1], AQUA[2], AQUA[3], 0.26 }, { TEAL[1], TEAL[2], TEAL[3], 0.04 })
  Round(FB, "BACKGROUND", 1, 14, { 1, 1, 1, 1 }):SetGradientV({ 1, 1, 1, 0.07 }, { 1, 1, 1, 0.01 })
  TopLine(FB, 14, 0.30, "BORDER", 0)
  Round(FB, "HIGHLIGHT", 0, 14, { 1, 1, 1, 1 }, "ADD"):SetGradient({ AQUA[1], AQUA[2], AQUA[3], 0.12 }, { AQUA[1], AQUA[2], AQUA[3], 0.02 })
  local fbOrb = OrbBadge(FB, 30); fbOrb:SetPoint("CENTER", FB, "LEFT", 32, 0); fbOrb:Tint(AQUA, TEAL); fbOrb.halo:SetAlpha(0.35)
  local fbT = UI(FB, 13, true); fbT:SetPoint("TOPLEFT", 56, -9); fbT:SetWidth(W - 24 - 56 - 12); fbT:SetJustifyH("LEFT"); fbT:SetWordWrap(false)
  local fbS = UI(FB, 10.5); fbS:SetPoint("TOPLEFT", fbT, "BOTTOMLEFT", 0, -4); fbS:SetWidth(W - 24 - 56 - 12); fbS:SetJustifyH("LEFT"); fbS:SetWordWrap(false)
  fbS:SetTextColor(0.78, 0.84, 0.88)
  FB:SetScript("OnClick", function()
    if FLYADV then FLYIGN[FLYADV.key] = (not FLYIGN[FLYADV.key]) or nil; if Refresh then Refresh() end end
  end)
  FB:SetScript("OnEnter", function(self)
    local a = FLYADV; if not a then return end
    TIP:Begin(self, M):Line("Fliegen oder laufen?", AQUA[1], AQUA[2], AQUA[3], true)
    TIP:Line(fmt("Laufen: ca. %s  ·  Fliegen: ca. %s (inkl. Weg zum Flugmeister)", fmtTime(a.run), fmtTime(a.fly)), 1, 1, 1)
    if a.runYd then TIP:Line(fmt("Laufweg %s (echter Weg über Pässe/Tunnel, nicht Luftlinie)", fmtDist(a.runYd)), 0.8, 0.85, 0.9) end
    TIP:Line("Flug: " .. a.from .. "  →  " .. a.to .. ((a.hops and a.hops > 1) and fmt("  (%d Zwischenlandung%s)", a.hops - 1, a.hops > 2 and "en" or "") or ""), 0.8, 0.85, 0.9)
    if a.walk2 then TIP:Line(fmt("Nach der Landung noch %s zu Fuß", fmtDist(a.walk2)), 0.8, 0.85, 0.9) end
    if not a.sure then TIP:Line("Sprich einmal einen Flugmeister an – dann kenne ich deine entdeckten Flugpunkte genau.", 1, 0.82, 0.3) end
    if DB.auto then TIP:Line("Am Flugmeister wird der Flug automatisch gewählt (Umschalt halten = nicht).", 0.6, 0.9, 1) end
    TIP:Line("Klick: " .. (FLYIGN[a.key] and "doch fliegen" or "lieber laufen"), 0.5, 0.55, 0.58)
    TIP:Open()
  end)
  FB:SetScript("OnLeave", TipLeave)
  -- y = Unterkante der Liste (negativ); liefert die Zusatzhoehe
  function FlyBanner(y)
    pcall(currentTarget)
    local a = FLYADV
    if not DB or DB.collapsed or not a then FB:Hide(); return 0 end
    fbOrb:Icon(a.kind == "hearth" and "hearth" or "fly", AQUA[1], AQUA[2], AQUA[3])
    if a.kind == "hearth" then
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
    FB:ClearAllPoints(); FB:SetPoint("TOPLEFT", 12, y - 4); FB:SetPoint("TOPRIGHT", -12, y - 4)
    FB:Show()
    return 58
  end
end

---------------------------------------------------------------------------
-- Bedienleiste: Segment ROUTE | QUESTS + Schalter PFEIL / AUTO
---------------------------------------------------------------------------
local DK, Switch, SyncDock, DockTick, SET
do
  local SWITCHES = {}
  -- iOS-artiger Schalter: Kapsel (Neon-Verlauf wenn an), weisser Knopf mit Schatten, gleitet weich
  function Switch(parent, label, get, fn, w, tip)
    local b = CreateFrame("Button", nil, parent); b:SetSize(w or 66, 24)
    b.l = UI(b, 9, true); b.l:SetPoint("RIGHT", b, "RIGHT", -36, 0); b.l:SetText(label)
    local tr = CreateFrame("Frame", nil, b); tr:SetSize(30, 16); tr:SetPoint("RIGHT", 0, 0)
    b.off = Capsule(tr, "BACKGROUND", 0, 16, { 1, 1, 1, 1 }); b.off:SetGradientV({ 0, 0, 0, 0.5 }, { 1, 1, 1, 0.10 })
    b.glow = MT(tr, "BACKGROUND", 1, "dot", "ADD"); b.glow:SetPoint("TOPLEFT", -12, 9); b.glow:SetPoint("BOTTOMRIGHT", 12, -9)
    b.glow:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.28)
    b.on = Capsule(tr, "BORDER", 0, 16, { 1, 1, 1, 1 }); b.on:SetGradient({ NEON[1], NEON[2], NEON[3], 1 }, { TEAL[1], TEAL[2], TEAL[3], 1 })
    b.sh = MT(tr, "ARTWORK", 0, "dot"); b.sh:SetSize(20, 20); b.sh:SetVertexColor(0, 0, 0, 0.55)
    b.knob = MT(tr, "ARTWORK", 1, "ctx_disc"); b.knob:SetSize(18, 18); b.knob:SetVertexColor(1, 1, 1, 1)
    if (w or 66) > 100 then Capsule(b, "HIGHLIGHT", 0, 24, { 1, 1, 1, 1 }, "ADD"):SetGradient({ NEON[1], NEON[2], NEON[3], 0.07 }, { AQUA[1], AQUA[2], AQUA[3], 0.02 }) end
    b.tr, b.get = tr, get
    function b:Place()
      self.knob:SetPoint("CENTER", self.tr, "LEFT", self.x, 0); self.sh:SetPoint("CENTER", self.tr, "LEFT", self.x, -1)
    end
    function b:Sync(instant)
      local v = self.get() and true or false
      self.on:SetShown(v); self.glow:SetShown(v)
      self.l:SetTextColor(v and 0.85 or 0.5, v and 0.95 or 0.55, v and 0.88 or 0.58)
      self.tx = v and 22 or 8
      if instant or not self.x then self.x = self.tx end
      self:Place()
    end
    function b:Tick(el)
      if self.x and self.tx and abs(self.x - self.tx) > 0.2 then self.x = self.x + (self.tx - self.x) * min(1, el * 14); self:Place() end
    end
    b:SetScript("OnClick", function() fn(); b:Sync() end)
    if tip then
      b:SetScript("OnEnter", function(self) TIP:Begin(self, M):Line(tip, 0.85, 0.9, 0.9); TIP:Open() end)
      b:SetScript("OnLeave", TipLeave)
    end
    SWITCHES[#SWITCHES + 1] = b
    return b
  end

  DK = CreateFrame("Frame", nil, M); DK:SetHeight(26); DK:SetPoint("BOTTOMLEFT", 14, 12); DK:SetPoint("BOTTOMRIGHT", -14, 12)
  local seg = CreateFrame("Frame", nil, DK); seg:SetSize(150, 26); seg:SetPoint("LEFT", 0, 0)
  Capsule(seg, "BACKGROUND", 0, 26, { 1, 1, 1, 1 }):SetGradientV({ 0, 0, 0, 0.55 }, { 1, 1, 1, 0.05 })
  local thumb = CreateFrame("Frame", nil, seg); thumb:SetSize(72, 22); thumb:SetPoint("LEFT", 2, 0)
  local thG = MT(thumb, "BACKGROUND", 0, "dot", "ADD"); thG:SetPoint("TOPLEFT", -14, 10); thG:SetPoint("BOTTOMRIGHT", 14, -10)
  thG:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.30)
  Capsule(thumb, "BORDER", 0, 22, { 1, 1, 1, 1 }):SetGradient({ NEON[1], NEON[2], NEON[3], 1 }, { TEAL[1], TEAL[2], TEAL[3], 1 })
  local thGl = Tex(thumb, "ARTWORK", 0); thGl:SetPoint("TOPLEFT", 8, -1); thGl:SetPoint("TOPRIGHT", -8, -1); thGl:SetHeight(9)
  Grad(thGl, "VERTICAL", 1, 1, 1, 0, 1, 1, 1, 0.32)
  local segL = CreateFrame("Frame", nil, seg); segL:SetAllPoints(); segL:SetFrameLevel(thumb:GetFrameLevel() + 1)
  local SEG = {}
  for k, def in ipairs({ { "ROUTE", "route" }, { "QUESTS", "quests" } }) do
    local b = CreateFrame("Button", nil, segL); b:SetSize(75, 26); b:SetPoint("LEFT", (k - 1) * 75, 0)
    b.t = UI(b, 10, true); b.t:SetPoint("CENTER", 0, 0); b.t:SetText(def[1])
    b:SetScript("OnClick", function() if DB.mode ~= def[2] then DB.mode = def[2]; Refresh(true) end end)
    b.mode = def[2]; SEG[k] = b
  end
  local segX, segTX = 2, 2
  local swAuto = Switch(DK, "AUTO", function() return DB.auto end, function()
    DB.auto = not DB.auto; P("Auto-Annehmen/-Abgeben: " .. (DB.auto and "|cff39ff6ban|r" or "|cffff5050aus|r")); Refresh(true)
  end, 66, "Quests der Route automatisch annehmen und abgeben (Umschalt halten = kurz aus)")
  swAuto:SetPoint("RIGHT", DK, "RIGHT", 0, 0)
  local swArrow = Switch(DK, "PFEIL", function() return DB.arrow end, function() DB.arrow = not DB.arrow; Refresh(true) end, 66, "Pfeil mit Kompass ein-/ausblenden")
  swArrow:SetPoint("RIGHT", swAuto, "LEFT", -6, 0)
  function SyncDock()
    segTX = (DB.mode == "quests") and 76 or 2
    for _, b in ipairs(SEG) do
      local on = b.mode == DB.mode
      b.t:SetTextColor(on and 0.03 or 0.6, on and 0.09 or 0.65, on and 0.06 or 0.68)
    end
    swAuto:Sync(); swArrow:Sync()
    if SET and SET:IsShown() then for _, s in ipairs(SET.sw) do s:Sync() end end
  end
  function DockTick(el)
    for _, s in ipairs(SWITCHES) do s:Tick(el) end
    if abs(segX - segTX) > 0.2 then segX = segX + (segTX - segX) * min(1, el * 12); thumb:SetPoint("LEFT", seg, "LEFT", segX, 0) end
  end
end

---------------------------------------------------------------------------
-- Einstellungen (Glas-Popover neben dem Fenster)
---------------------------------------------------------------------------
do
  local SETDEF = {
    { "Auto-Annehmen / -Abgeben", "auto", function() return DB.auto end },
    { "Pfeil mit Kompass", "pfeil", function() return DB.arrow end },
    { "Neon-Strahl am Ziel", "strahl", function() return DB.beam end },
    { "Blizzard-Wegpunkt", "marker", function() return DB.pin end },
    { "Flug-Tipp (Fliegen statt Laufen)", "flug", function() return DB.fly ~= false end },
    { "Wegenetz-Führung", "wege", function() return DB.wege end },
    { "Speed-Modus", "speed", function() return DB.speed end },
    { "Fertig-Meldung", "toast", function() return DB.toast end },
    { "Im Kampf abdunkeln", "kampf", function() return DB.fade end },
    { "Töne", "sound", function() return DB.sound ~= false end },
    { "Fenster & Pfeil gesperrt", function() return DB.locked and "unlock" or "lock" end, function() return DB.locked end },
  }
  function OpenSettings(force)
    if not DB then return end
    if not SET then
      SET = CreateFrame("Frame", "LevelPilotSettings", M)
      SET:SetFrameStrata("DIALOG"); SET:SetSize(276, 44 + #SETDEF * 27 + 100); SET:EnableMouse(true); SET:SetClampedToScreen(true); SET:Hide()
      Glass(SET, { aurora = true })
      local h = UI(SET, 13, true); h:SetPoint("TOPLEFT", 18, -17); h:SetText(GradText("EINSTELLUNGEN", NEON, TEAL, AQUA))
      -- Schliessen: X aus zwei gedrehten Linien auf einer Glasscheibe
      local x = CreateFrame("Button", nil, SET); x:SetSize(22, 22); x:SetPoint("TOPRIGHT", -12, -11)
      local xd = MT(x, "BACKGROUND", 0, "ctx_disc"); xd:SetPoint("CENTER"); xd:SetSize(33, 33); xd:SetVertexColor(1, 1, 1, 0.06)
      local xh = MT(x, "HIGHLIGHT", 0, "ctx_disc", "ADD"); xh:SetPoint("CENTER"); xh:SetSize(33, 33); xh:SetVertexColor(1, 0.35, 0.35, 0.25)
      for _, rot in ipairs({ pi / 4, -pi / 4 }) do
        local l = Tex(x, "ARTWORK", 0); l:SetSize(10, 1.6); l:SetPoint("CENTER"); l:SetVertexColor(0.85, 0.9, 0.9, 1); pcall(l.SetRotation, l, rot)
      end
      x:SetScript("OnClick", function() SET:Hide() end)
      SET.sw = {}
      for k, d in ipairs(SETDEF) do
        local y = -44 - (k - 1) * 27
        if k > 1 then Hairline(SET, "BORDER", 6, false, 0.07):Place(SET, 22, y, 254, 0) end
        local sw = Switch(SET, "", d[3], function()
          SlashCmdList.LEVELPILOT(type(d[2]) == "function" and d[2]() or d[2])
          for _, s in ipairs(SET.sw) do s:Sync() end
          SyncDock()
        end, 252)
        sw:SetPoint("TOPLEFT", 12, y - 1)
        local l = UI(sw, 11.5); l:SetPoint("LEFT", 10, 0); l:SetText(d[1]); l:SetTextColor(0.82, 0.87, 0.88)
        SET.sw[#SET.sw + 1] = sw
      end
      -- Ton bei neuem Ziel: Segment AMBOSS | SCHLOSS
      local ty = -44 - #SETDEF * 27 - 10
      local tl = UI(SET, 11.5); tl:SetPoint("TOPLEFT", 22, ty - 5); tl:SetText("Ton bei neuem Ziel"); tl:SetTextColor(0.82, 0.87, 0.88)
      local ts = CreateFrame("Frame", nil, SET); ts:SetSize(126, 22); ts:SetPoint("TOPRIGHT", -20, ty)
      Capsule(ts, "BACKGROUND", 0, 22, { 1, 1, 1, 1 }):SetGradientV({ 0, 0, 0, 0.55 }, { 1, 1, 1, 0.05 })
      local tth = CreateFrame("Frame", nil, ts); tth:SetSize(60, 18); tth:SetPoint("LEFT", 2, 0)
      Capsule(tth, "BORDER", 0, 18, { 1, 1, 1, 1 }):SetGradient({ NEON[1], NEON[2], NEON[3], 1 }, { TEAL[1], TEAL[2], TEAL[3], 1 })
      local tlb = CreateFrame("Frame", nil, ts); tlb:SetAllPoints(); tlb:SetFrameLevel(tth:GetFrameLevel() + 1)
      SET.ton = {}
      for k, d in ipairs({ { "AMBOSS", "amboss" }, { "SCHLOSS", "schloss" } }) do
        local b = CreateFrame("Button", nil, tlb); b:SetSize(63, 22); b:SetPoint("LEFT", (k - 1) * 63, 0)
        b.t = UI(b, 9, true); b.t:SetPoint("CENTER", 0, 0); b.t:SetText(d[1]); b.v = d[2]
        b:SetScript("OnClick", function() if (DB.ton or "amboss") ~= d[2] then SlashCmdList.LEVELPILOT("ton") end; SET:Sync() end)
        SET.ton[k] = b
      end
      -- Zuruecksetzen (Geister-Knopf, rot beim Ueberfahren)
      local rb = CreateFrame("Button", nil, SET); rb:SetSize(240, 26); rb:SetPoint("BOTTOM", 0, 30)
      Capsule(rb, "BACKGROUND", 0, 26, { 1, 1, 1, 1 }):SetGradient({ 1, 1, 1, 0.09 }, { 1, 1, 1, 0.04 })
      Capsule(rb, "HIGHLIGHT", 0, 26, { 1, 1, 1, 1 }, "ADD"):SetGradient({ 1, 0.35, 0.35, 0.18 }, { 1, 0.55, 0.24, 0.10 })
      rb.t = UI(rb, 10.5, true); rb.t:SetPoint("CENTER", 0, 0); rb.t:SetText("Layout & Schalter zurücksetzen"); rb.t:SetTextColor(0.85, 0.88, 0.9)
      rb:SetScript("OnClick", function() SlashCmdList.LEVELPILOT("reset"); SET:Sync() end)
      local ft = UI(SET, 9); ft:SetPoint("BOTTOM", 0, 12); ft:SetText("Alle Befehle: /lp hilfe"); ft:SetTextColor(0.45, 0.5, 0.52)
      function SET:Sync()
        for _, s in ipairs(self.sw) do s:Sync() end
        local cur = DB.ton or "amboss"
        for k, b in ipairs(self.ton) do
          local on = b.v == cur
          b.t:SetTextColor(on and 0.03 or 0.6, on and 0.09 or 0.65, on and 0.06 or 0.68)
          if on then tth:SetPoint("LEFT", 2 + (k - 1) * 62, 0) end
        end
        SyncDock()
      end
      if UISpecialFrames then tinsert(UISpecialFrames, "LevelPilotSettings") end
    end
    if SET:IsShown() and not force then SET:Hide(); return end
    if LOGP and LOGP:IsShown() then LOGP:Hide() end
    SET:ClearAllPoints()
    local l = M:GetLeft()
    if l and l > 300 then SET:SetPoint("TOPRIGHT", M, "TOPLEFT", -16, 0) else SET:SetPoint("TOPLEFT", M, "TOPRIGHT", 16, 0) end
    SET:Show(); SET:Sync()
  end
end


---------------------------------------------------------------------------
-- Questlog-Check (Glas-Popover): was behalten, abgeben, loeschen – mit Grund
---------------------------------------------------------------------------
local LOGADV = nil          -- letztes Ergebnis von LP_Route.LogAdvice
local CAT = {
  delete = { c = { 1.00, 0.36, 0.36 }, c2 = { 1.00, 0.55, 0.24 }, icon = "trash",  label = "LÖSCHEN" },
  turnin = { c = NEON,                 c2 = TEAL,                 icon = "turnin", label = "ABGEBEN" },
  check  = { c = { 1.00, 0.78, 0.30 }, c2 = { 1.00, 0.55, 0.24 }, icon = "note",   label = "PRÜFEN" },
  keep   = { c = AQUA,                 c2 = TEAL,                 icon = "flag",   label = "BEHALTEN" },
}
local function CloseX(parent, fn)
  local x = CreateFrame("Button", nil, parent); x:SetSize(22, 22); x:SetPoint("TOPRIGHT", -12, -11)
  local xd = MT(x, "BACKGROUND", 0, "ctx_disc"); xd:SetPoint("CENTER"); xd:SetSize(33, 33); xd:SetVertexColor(1, 1, 1, 0.06)
  local xh = MT(x, "HIGHLIGHT", 0, "ctx_disc", "ADD"); xh:SetPoint("CENTER"); xh:SetSize(33, 33); xh:SetVertexColor(1, 0.35, 0.35, 0.25)
  for _, rot in ipairs({ pi / 4, -pi / 4 }) do
    local l = Tex(x, "ARTWORK", 0); l:SetSize(10, 1.6); l:SetPoint("CENTER"); l:SetVertexColor(0.85, 0.9, 0.9, 1); pcall(l.SetRotation, l, rot)
  end
  x:SetScript("OnClick", fn)
  return x
end
local LW = 312
local function LogRow(i)
  local r = CreateFrame("Button", nil, LOGP); r:SetHeight(36)
  r.wash = Round(r, "BACKGROUND", 0, 12, { 1, 1, 1, 1 })
  Round(r, "HIGHLIGHT", 0, 12, { 1, 1, 1, 1 }, "ADD"):SetGradient({ 1, 1, 1, 0.06 }, { 1, 1, 1, 0.01 })
  r.orb = OrbBadge(r, 14); r.orb:SetPoint("CENTER", r, "LEFT", 20, 0)
  r.title = UI(r, 11.5); r.title:SetJustifyH("LEFT"); r.title:SetWordWrap(false)
  r.why = UI(r, 9.5); r.why:SetJustifyH("LEFT"); r.why:SetWordWrap(false)
  r.right = UI(r, 9.5, true); r.right:SetJustifyH("RIGHT")
  -- Knopf "LOESCHEN": rote Verlaufs-Kapsel, oeffnet Blizzards Abbrechen-Dialog
  local b = CreateFrame("Button", nil, r); b:SetSize(70, 22); b:SetPoint("RIGHT", -8, 0)
  b.g = MT(b, "BACKGROUND", 0, "dot", "ADD"); b.g:SetPoint("TOPLEFT", -12, 9); b.g:SetPoint("BOTTOMRIGHT", 12, -9); b.g:SetVertexColor(1, 0.36, 0.36, 0.25)
  b.bg = Capsule(b, "BORDER", 0, 22, { 1, 1, 1, 1 }); b.bg:SetGradient({ 1, 0.30, 0.34, 0.95 }, { 1, 0.52, 0.22, 0.95 })
  Capsule(b, "HIGHLIGHT", 0, 22, { 1, 1, 1, 1 }, "ADD"):SetGradient({ 1, 1, 1, 0.22 }, { 1, 1, 1, 0.08 })
  b.ic = MT(b, "ARTWORK", 0, "i_trash"); b.ic:SetSize(10, 10); b.ic:SetPoint("LEFT", 9, 0); b.ic:SetVertexColor(0.12, 0.02, 0.02, 1)
  b.t = UI(b, 9, true); b.t:SetPoint("LEFT", 22, 0); b.t:SetText("|cff1e0505LÖSCHEN|r"); b.t:SetShadowColor(0, 0, 0, 0)
  b:SetScript("OnClick", function()
    local q = r.q; if not q then return end
    local ok, why = LP_Route.Abandon(q)
    if not ok then P("|cffff5050Konnte nicht abbrechen:|r " .. tostring(why)) end
  end)
  r.del = b
  r:SetScript("OnEnter", function(self) if self.tip then TIP:Begin(self, LOGP); for _, l in ipairs(self.tip) do TIP:Line(l[1], l[2], l[3], l[4], l[5]) end; TIP:Open() end end)
  r:SetScript("OnLeave", TipLeave)
  return r
end

local function LogFill()
  if not (LOGP and LOGP:IsShown()) then return end
  local a = LOGADV
  local used, mx = a and a.used or 0, a and a.max or 25
  LOGP.num:SetText(fmt("|cffffffff%d|r|cff6b7076 / %d|r", used, mx))
  local frac = max(0, min(1, used / max(1, mx)))
  local hot = frac >= 0.9 and { 1, 0.36, 0.36 } or (frac >= 0.75 and { 1, 0.78, 0.30 } or NEON)
  LOGP.mfill:SetWidth(max(8, (LW - 36) * frac))
  LOGP.mfg:SetGradient({ TEAL[1], TEAL[2], TEAL[3], 1 }, { hot[1], hot[2], hot[3], 1 })
  local sum = {}
  if a then
    if a.del > 0 then sum[#sum + 1] = fmt("|cffff5c5c%d löschen|r", a.del) end
    if a.tin > 0 then sum[#sum + 1] = fmt("|cff39ff6b%d abgeben|r", a.tin) end
    if a.chk > 0 then sum[#sum + 1] = fmt("|cffffc84d%d prüfen|r", a.chk) end
    sum[#sum + 1] = fmt("|cff4fd2ff%d behalten|r", a.keep)
  end
  LOGP.sum:SetText(#sum > 0 and table.concat(sum, "  ·  ") or "Questlog wird gelesen …")
  local warn
  if a and a.full then
    warn = fmt("|cffffc84dLog wird voll|r: bis Schritt %d brauchst du %d Plätze – lösche die roten.", a.peakAt or 0, a.peak)
  elseif a and a.del == 0 and a.tin == 0 and a.chk == 0 and used > 0 then
    warn = "|cff39ff6bAlles sauber|r – jede Quest gehört in deinen Plan."
  end
  LOGP.warn:SetText(warn or ""); LOGP.warn:SetShown(warn ~= nil)
  local y = warn and -112 or -96
  local shown, keepHead = 0, false
  for i = 1, #LOGP.rows do LOGP.rows[i]:Hide() end
  LOGP.kh:Hide(); LOGP.more:Hide()
  local list = a and a.list or {}
  local MAXH = 560
  for i, e in ipairs(list) do
    local def = CAT[e.cat] or CAT.keep
    local compact = e.cat == "keep"
    if compact and not keepHead then
      keepHead = true
      LOGP.kh:ClearAllPoints(); LOGP.kh:SetPoint("TOPLEFT", 22, y - 6); LOGP.kh:Show()
      y = y - 22
    end
    if -y > MAXH then
      LOGP.more:ClearAllPoints(); LOGP.more:SetPoint("TOPLEFT", 22, y - 4)
      LOGP.more:SetText(fmt("+ %d weitere", #list - i + 1)); LOGP.more:Show(); y = y - 20
      break
    end
    shown = shown + 1
    local r = LOGP.rows[shown]; if not r then r = LogRow(shown); LOGP.rows[shown] = r end
    r.q = e.q
    local h = compact and 26 or 38
    r:SetHeight(h); r:ClearAllPoints(); r:SetPoint("TOPLEFT", 12, y); r:SetPoint("TOPRIGHT", -12, y)
    r.orb:SetSize(compact and 10 or 14); r.orb:Tint(def.c, def.c2, compact and 0.7 or 1); r.orb:Icon(def.icon, def.c[1], def.c[2], def.c[3])
    r.orb.halo:SetShown(not compact)
    r.wash:SetShown(not compact)
    if not compact then r.wash:SetGradient({ def.c[1], def.c[2], def.c[3], 0.13 }, { def.c[1], def.c[2], def.c[3], 0.01 }) end
    r.title:ClearAllPoints(); r.why:ClearAllPoints(); r.right:ClearAllPoints()
    local action = e.cat == "delete" or e.cat == "check"
    r.del:SetShown(action)
    if action then r.del.bg:SetGradient(e.cat == "delete" and { 1, 0.30, 0.34, 0.95 } or { 1, 0.70, 0.28, 0.55 }, e.cat == "delete" and { 1, 0.52, 0.22, 0.95 } or { 1, 0.52, 0.22, 0.45 }) end
    if compact then
      r.title:SetFont(FONT_UI, 11, ""); r.title:SetPoint("LEFT", 36, 0); r.title:SetWidth(LW - 24 - 36 - 96)
      r.title:SetText("|cffc6ccd0" .. e.title .. "|r")
      r.right:SetPoint("RIGHT", -10, 0); r.right:SetWidth(92); r.right:SetFont(FONT_UI, 9.5, "")
      local fertig = LP_Route.Ready and LP_Route.Ready(e.q) and "|cff39ff6bfertig|r |cff6b7076·|r " or ""
      r.right:SetText(fertig .. (e.step and (e.step == (RT.idx or -1) and "|cff39ff6bJETZT|r" or ("|cff8a9396Schritt " .. e.step .. "|r")) or ("|cff8a9396" .. (e.why:match("^später") and "später" or e.why) .. "|r")))
      r.why:Hide(); r.right:Show()
    else
      r.title:SetFont(FONT_UI, 12, ""); r.title:SetPoint("TOPLEFT", 40, -6); r.title:SetWidth(LW - 24 - 40 - (action and 86 or 70))
      r.title:SetText("|cffffffff" .. e.title .. "|r")
      r.why:SetPoint("TOPLEFT", r.title, "BOTTOMLEFT", 0, -3); r.why:SetWidth(LW - 24 - 40 - (action and 86 or 70))
      r.why:SetText(e.why); r.why:SetTextColor(def.c[1] * 0.55 + 0.4, def.c[2] * 0.55 + 0.4, def.c[3] * 0.55 + 0.4); r.why:Show()
      if e.cat == "turnin" then
        r.right:SetPoint("RIGHT", -12, 0); r.right:SetWidth(70); r.right:SetFont(FONT_UI, 9.5, "OUTLINE")
        r.right:SetText("|cff39ff6bABGEBEN|r"); r.right:Show()
      else r.right:Hide() end
    end
    local tip = { { e.title, def.c[1], def.c[2], def.c[3], true }, { def.label .. " – " .. e.why, 1, 1, 1 } }
    if e.xp then tip[#tip + 1] = { "Belohnung: " .. fmtNum(e.xp) .. " XP", 0.4, 0.8, 1 } end
    if e.step then tip[#tip + 1] = { "Im Plan: Schritt " .. e.step, 0.75, 0.8, 0.82 } end
    if action then tip[#tip + 1] = { "LÖSCHEN öffnet Blizzards Abbrechen-Dialog – du bestätigst selbst.", 0.5, 0.55, 0.58 } end
    r.tip = tip
    r:Show()
    y = y - h - (compact and 1 or 4)
  end
  if #list == 0 then
    LOGP.more:ClearAllPoints(); LOGP.more:SetPoint("TOPLEFT", 22, y - 4); LOGP.more:SetText("Keine Quests im Log."); LOGP.more:Show(); y = y - 22
  end
  LOGP:SetHeight(-y + 40)
end

function OpenLog(force)
  if not DB then return end
  if not LOGP then
    LOGP = CreateFrame("Frame", "LevelPilotLog", M)
    LOGP:SetFrameStrata("DIALOG"); LOGP:SetSize(LW, 200); LOGP:EnableMouse(true); LOGP:SetClampedToScreen(true); LOGP:Hide()
    Glass(LOGP, { aurora = true })
    local ic = MT(LOGP, "ARTWORK", 0, "i_log"); ic:SetSize(14, 14); ic:SetPoint("TOPLEFT", 18, -17); ic:SetVertexColor(NEON[1], NEON[2], NEON[3], 1)
    local icg = MT(LOGP, "BACKGROUND", 3, "dot", "ADD"); icg:SetSize(34, 34); icg:SetPoint("CENTER", ic, "CENTER"); icg:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.35)
    local h = UI(LOGP, 13, true); h:SetPoint("LEFT", ic, "RIGHT", 8, 0); h:SetText(GradText("QUESTLOG-CHECK", NEON, TEAL, AQUA))
    CloseX(LOGP, function() LOGP:Hide() end)
    LOGP.num = UI(LOGP, 20, true); LOGP.num:SetPoint("TOPLEFT", 20, -44)
    local nl = UI(LOGP, 8.5); nl:SetPoint("BOTTOMLEFT", LOGP.num, "BOTTOMRIGHT", 8, 3); nl:SetText("QUESTS IM LOG"); nl:SetTextColor(0.5, 0.55, 0.58)
    local meter = CreateFrame("Frame", nil, LOGP); meter:SetPoint("TOPLEFT", 18, -70); meter:SetSize(LW - 36, 8)
    Capsule(meter, "BACKGROUND", 0, 8, { 1, 1, 1, 1 }):SetGradientV({ 0, 0, 0, 0.7 }, { 1, 1, 1, 0.07 })
    LOGP.mfill = CreateFrame("Frame", nil, meter); LOGP.mfill:SetPoint("TOPLEFT"); LOGP.mfill:SetSize(8, 8)
    local mg = MT(LOGP.mfill, "BACKGROUND", 0, "dot", "ADD"); mg:SetPoint("TOPLEFT", -10, 9); mg:SetPoint("BOTTOMRIGHT", 10, -9); mg:SetVertexColor(TEAL[1], TEAL[2], TEAL[3], 0.25)
    LOGP.mfg = Capsule(LOGP.mfill, "ARTWORK", 0, 8, { 1, 1, 1, 1 })
    LOGP.sum = UI(LOGP, 10); LOGP.sum:SetPoint("TOPLEFT", 20, -84); LOGP.sum:SetWidth(LW - 40); LOGP.sum:SetJustifyH("LEFT"); LOGP.sum:SetWordWrap(false)
    LOGP.warn = UI(LOGP, 9.5); LOGP.warn:SetPoint("TOPLEFT", 20, -99); LOGP.warn:SetWidth(LW - 40); LOGP.warn:SetJustifyH("LEFT"); LOGP.warn:SetWordWrap(false)
    LOGP.warn:SetTextColor(0.78, 0.83, 0.86)
    LOGP.kh = UI(LOGP, 8.5, true); LOGP.kh:SetText("BEHALTEN  ·  GEHÖRT IN DEINEN PLAN"); LOGP.kh:SetTextColor(0.31, 0.82, 1)
    LOGP.more = UI(LOGP, 9.5); LOGP.more:SetTextColor(0.55, 0.6, 0.62)
    local ft = UI(LOGP, 9); ft:SetPoint("BOTTOM", 0, 14); ft:SetText("Rot = raus damit · Grün = abgeben · Blau = gehört in den Plan"); ft:SetTextColor(0.45, 0.5, 0.52)
    LOGP.rows = {}
    if UISpecialFrames then tinsert(UISpecialFrames, "LevelPilotLog") end
  end
  if LOGP:IsShown() and not force then LOGP:Hide(); return end
  if SET and SET:IsShown() then SET:Hide() end
  LOGP:ClearAllPoints()
  local l = M:GetLeft()
  if l and l > LW + 30 then LOGP:SetPoint("TOPRIGHT", M, "TOPLEFT", -16, 0) else LOGP:SetPoint("TOPLEFT", M, "TOPRIGHT", 16, 0) end
  LOGP:Show()
  if Refresh then Refresh(true) end
  LogFill()
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
-- Glas-Pille unter dem Kompass: Spielsymbol der Aufgabe + Entfernung
local aIcon, aDist, aName
do
  local aPill = CreateFrame("Frame", nil, A); aPill:SetSize(176, 30); aPill:SetPoint("TOP", A, "BOTTOM", 0, -4)
  Glass(aPill, { glowA = 0.26, sheenH = 14, pad = 46 })
  aIcon = aPill:CreateTexture(nil, "ARTWORK"); aIcon:SetSize(18, 18); aIcon:SetPoint("LEFT", 9, 0)
  aDist = UI(aPill, 14, true); aDist:SetPoint("CENTER", 8, 0)
  aName = UI(A, 12, true); aName:SetPoint("TOP", aPill, "BOTTOM", 0, -6); aName:SetWidth(280); aName:SetWordWrap(false)
end
local aHere = UI(A, 20, true); aHere:SetPoint("CENTER"); aHere:SetText("|cff39ff6bDA!|r"); aHere:Hide()
local aTyp

---------------------------------------------------------------------------
-- Fertig-Meldung: Glas-Kapsel mit Leucht-Kugel, gleitet weich herein
---------------------------------------------------------------------------
local ToastTick
do
  local T = CreateFrame("Frame", nil, UIParent)
  T:SetSize(320, 50); T:SetPoint("CENTER", UIParent, "CENTER", 0, 158); T:SetFrameStrata("HIGH"); T:Hide()
  Glass(T, { glowA = 0.40, sheenH = 22 })
  local tOrb = OrbBadge(T, 30); tOrb:SetPoint("CENTER", T, "LEFT", 31, 0); tOrb.halo:SetAlpha(0.4)
  local tTxt = UI(T, 15, true); tTxt:SetPoint("LEFT", 56, 0); tTxt:SetJustifyH("LEFT")
  local toastT, toastAge = 0, 0
  function Toast(msg, typ)
    if not DB.toast then return end
    local bad = msg:find("GESPERRT") ~= nil
    typ = typ or ((bad or msg:find("NICHT MEHR DA")) and "note" or "turnin")
    local c = bad and { 1, 0.32, 0.32 } or (typ == "note" and { 1, 0.82, 0.30 } or NEON)
    tOrb:Tint(c, typ == "turnin" and TEAL or nil); tOrb:Icon(typ, c[1], c[2], c[3])
    tTxt:SetText(msg)
    T:SetWidth(max(260, min(560, (tTxt:GetStringWidth() or 0) + 86)))
    toastT, toastAge = 3.2, 0; T:SetAlpha(0); T:Show()
    pcall(PlaySound, (SOUNDKIT and SOUNDKIT.UI_QUEST_COMPLETE) or 878, "SFX")
  end
  function ToastTick(el)
    if toastT <= 0 then return end
    toastT = toastT - el; toastAge = toastAge + el
    local k = min(1, toastAge * 4)
    T:SetPoint("CENTER", UIParent, "CENTER", 0, 140 + 18 * (1 - (1 - k) ^ 3))
    T:SetAlpha(max(0, min(1, toastAge * 5, toastT * 1.5)))
    if toastT <= 0 then T:Hide() end
  end
end

-- Animationen (pro Bild): Aurora, XP-Lichtlauf, atmende Kugeln, gleitende Schalter, Meldung
local function Glow(now)
  for f in pairs(AURORA) do if f:IsVisible() then GlassTick(f, now) end end
  local ph = (now % 3.4) / 3.4
  if ph < 0.5 and M:IsVisible() then
    local k = ph / 0.5
    X.shine:SetPoint("CENTER", X.fill, "LEFT", X.fw * k, 0); X.shine:SetAlpha(0.55 * math.sin(k * pi)); X.shine:Show()
  else
    X.shine:Hide()
  end
  LO.halo:SetAlpha(0.20 + 0.12 * math.sin(now * 1.7))
  if BAND.mk:IsShown() then
    BAND.mkG:SetAlpha(0.55 + 0.35 * math.sin(now * 2.6)); BAND.mkR:SetAlpha(0.75 + 0.25 * math.sin(now * 2.6))
  end
  ROWS[1].orb.halo:SetAlpha(0.28 + 0.16 * math.sin(now * 2.2))
end
local function Animate(now, el)
  pcall(ToastTick, el)          -- zuerst: Meldung muss immer verschwinden
  pcall(DockTick, el)
  pcall(Glow, now)
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

-- Anteil erledigter Questziele (0..1), nil = unbekannt
local function questFrac(qid)
  local sum, n = 0, 0
  pcall(function()
    for _, o in ipairs(QL.GetQuestObjectives(qid) or {}) do
      n = n + 1
      if o.finished then sum = sum + 1
      elseif o.numRequired and o.numRequired > 0 then sum = sum + min(1, (o.numFulfilled or 0) / o.numRequired) end
    end
  end)
  if n == 0 then return nil end
  return sum / n
end

-- Grinden: Unterzeile + Fortschritt (nur wenn das Ziel die naechste Stufe ist)
local function grindInfo(st)
  local lvl, cur, mx = UnitLevel("player"), UnitXP("player"), max(1, UnitXPMax("player"))
  local to = st.to or (lvl + 1)
  if lvl >= to then return "Stufe " .. to .. " erreicht", 1 end
  if to == lvl + 1 then return "Stufe " .. to .. " erreichen  ·  noch " .. fmtNum(mx - cur) .. " XP", cur / mx end
  return "Stufe " .. to .. " erreichen  ·  noch " .. (to - lvl) .. " Stufen", nil
end

-- Lagebild fuellen: Abschnitt, Schritt x/y, Kapseln je Abschnitt, Zeiger, Stufen- und Log-Pille
local LOGT = 0
local function UpdateLog(force)
  if not (LP_Route and LP_Route.LogAdvice) then return end
  local t = GetTime()
  if not force and t - LOGT < 2 then return end
  LOGT = t
  local route = RT.key and LevelPilot_Routes[RT.key]
  local x = M.xi
  local ok, a = pcall(LP_Route.LogAdvice, route, RT.key, UnitLevel("player"), RT.ptr, RT.idx,
    { xpm = route and route.xpm, xph = x and x.xph, speed = (LP_Fly and LP_Fly.Speed and LP_Fly.Speed()) or 7 })
  if ok then LOGADV = a end
  pcall(LogFill)
end

local function DrawBand(route)
  local p, N = RT.ptr or 1, #route.steps
  local hero = RT.idx and route.steps[RT.idx]
  local here = route.steps[math.min(p, N)]
  local segs = route.segs or {}
  local si = (hero and hero.seg) or (here and here.seg) or 1
  local sd = segs[si]
  local nSeg = math.max(#segs, 1)
  BAND.lbl:SetText(sd and fmt("|cff39ff6b%d/%d|r  |cffffffff%s|r |cff8a9396·|r |cffd8dde0%s|r", si, nSeg, sd.z, sd.hub) or (route.name or ""))
  BAND.step:SetText(RT.wait and "|cff8a9396…|r" or fmt("|cff8a9396SCHRITT|r |cffffffff%d|r|cff6b7076/%d|r", math.min(RT.idx or p, N), N))
  -- Kapseln: Breite nach Schrittzahl des Abschnitts
  local prog = LP_Route.Progress(route, p)
  local BW = W - 28
  local GAP = 4
  local cnt = 0
  for k = 1, #BAND.segs do if prog[k] then cnt = k end end
  local x, mkX = 0, nil
  local usable = BW - GAP * math.max(0, cnt - 1)
  -- Breite nach Schrittzahl, kleine Abschnitte mindestens 10 px – die Summe passt exakt in die Spur
  local MINW, small, bigN = 10, 0, 0
  for k = 1, cnt do local pg = prog[k]; if pg then if usable * pg.n / N < MINW then small = small + 1 else bigN = bigN + pg.n end end end
  local rest = usable - small * MINW
  for k, g in ipairs(BAND.segs) do
    local pg = prog[k]
    if pg and k <= cnt then
      local w = (usable * pg.n / N < MINW) and MINW or rest * pg.n / math.max(bigN, 1)
      g:ClearAllPoints(); g:SetPoint("LEFT", BAND.track, "LEFT", x, 0); g:SetWidth(w)
      local frac = (pg.done or 0) / pg.n
      local cur = k == si
      g.bg:SetColor(1, 1, 1, cur and 0.16 or 0.07)
      if frac > 0 then
        g.fill:SetWidth(math.max(6, w * frac)); g.fill:Show()
        if frac >= 1 then g.fg:SetGradient({ TEAL[1], TEAL[2], TEAL[3], 0.55 }, { NEON[1], NEON[2], NEON[3], 0.55 })
        else g.fg:SetGradient({ TEAL[1], TEAL[2], TEAL[3], 1 }, { NEON[1], NEON[2], NEON[3], 1 }) end
      else g.fill:Hide() end
      if cur then mkX = x + w * frac end
      g:Show()
      x = x + w + GAP
    else
      g:Hide()
    end
  end
  BAND.mk:SetShown(mkX ~= nil and not RT.wait)
  if mkX then BAND.mk:ClearAllPoints(); BAND.mk:SetPoint("CENTER", BAND.track, "LEFT", math.max(5, math.min(BW - 5, mkX)), 0) end
  BAND.ic:SetVertexColor(TEAL[1], TEAL[2], TEAL[3], 1); BAND.icG:SetVertexColor(TEAL[1], TEAL[2], TEAL[3], 0.35)
  -- Tooltip des Bandes
  local tip = { { "Dein Plan  ·  Schritt " .. math.min(RT.idx or p, N) .. " von " .. N, NEON[1], NEON[2], NEON[3], true } }
  if sd then tip[#tip + 1] = { fmt("Abschnitt %d/%d: %s · %s (Stufe %d–%d)", si, nSeg, sd.z, sd.hub, sd.l0, sd.l1), 1, 1, 1 } end
  local nx = segs[si + 1]
  if nx then tip[#tip + 1] = { fmt("Danach: %s · %s", nx.z, nx.hub), 0.75, 0.8, 0.82 } end
  local missed = 0
  for _, st in pairs(LP_Route.state or {}) do if st == "missed" then missed = missed + 1 end end
  if missed > 0 then tip[#tip + 1] = { missed .. " Schritte hinter dir übersprungen (werden nicht mehr angesteuert)", 1, 0.78, 0.3 } end
  tip[#tip + 1] = { "Die Reihenfolge ist fest – erledigst du etwas früher, rückt der Plan von selbst weiter.", 0.62, 0.68, 0.7 }
  tip[#tip + 1] = { "Klick: Einstieg neu suchen  ·  /lp schritt <Nr> setzt ihn von Hand", 0.5, 0.55, 0.58 }
  BAND.tip = tip
  -- Stufen-Pille: Stufe gegen Plan-Stufe des aktuellen Schritts (mit XP-Anteil)
  local lvl, xi = UnitLevel("player"), M.xi
  local exact = lvl + ((xi and xi.mx > 0) and xi.cur / xi.mx or 0)
  local planL = hero and hero.l or (here and here.l) or lvl
  local diff = exact - (planL + 0.5)
  local ltip = { { "Stufe gegen Plan", AQUA[1], AQUA[2], AQUA[3], true },
    { fmt("Du: Stufe %.1f  ·  Plan rechnet hier mit Stufe %d", exact, planL), 1, 1, 1 } }
  if diff >= 0.9 then
    BAND.pLvl:Set(fmt("VORAUS  +%.1f", diff), AQUA, "i_xph")
    ltip[#ltip + 1] = { "Du bist schneller als geplant – Quests bleiben grün, alles gut.", 0.75, 0.8, 0.82 }
    if diff >= 3 then ltip[#ltip + 1] = { "Weit voraus? Klick aufs Plan-Band sucht den passenden Einstieg neu.", 0.31, 0.82, 1 } end
  elseif diff <= -0.9 then
    BAND.pLvl:Set(fmt("HINTER PLAN  %.1f", diff), { 1, 0.54, 0.24 }, "i_xph")
    ltip[#ltip + 1] = { "Etwas langsamer als geplant. Der Plan enthält Grind-Schritte, die das auffangen;", 0.75, 0.8, 0.82 }
    ltip[#ltip + 1] = { "Quests mit fehlender Stufe warten im Plan (\"ab St. X\").", 0.75, 0.8, 0.82 }
  else
    BAND.pLvl:Set("IM PLAN  ·  ST. " .. planL, NEON, "i_flag")
    ltip[#ltip + 1] = { "Stufe passt genau zum Plan.", 0.75, 0.8, 0.82 }
  end
  ltip[#ltip + 1] = { "Klick: Plan-Stand im Chat", 0.5, 0.55, 0.58 }
  BAND.pLvl.tip = ltip
  -- Log-Pille
  local a = LOGADV
  if a then
    local txt = fmt("LOG %d/%d", a.used, a.max)
    local c = TEAL
    if a.del > 0 then txt = txt .. fmt("  ·  |cffff6b6b%d LÖSCHEN|r", a.del); c = { 1, 0.36, 0.36 }
    elseif a.full then txt = txt .. "  ·  |cffffc84dWIRD VOLL|r"; c = { 1, 0.78, 0.30 }
    elseif a.tin > 0 then txt = txt .. fmt("  ·  |cff39ff6b%d ABGEBEN|r", a.tin); c = NEON
    elseif a.chk > 0 then txt = txt .. fmt("  ·  |cffffc84d%d PRÜFEN|r", a.chk); c = { 1, 0.78, 0.30 } end
    BAND.pLog:Set(txt, c, "i_log")
    local tt = { { "Questlog-Check", c[1], c[2], c[3], true }, { fmt("%d von %d Plätzen belegt", a.used, a.max), 1, 1, 1 } }
    if a.del > 0 then tt[#tt + 1] = { a.del .. " Quests stören den Plan – löschen", 1, 0.42, 0.42 } end
    if a.tin > 0 then tt[#tt + 1] = { a.tin .. " fertige Quests lohnen die Abgabe", NEON[1], NEON[2], NEON[3] } end
    if a.full then tt[#tt + 1] = { fmt("Bis Schritt %d brauchst du %d Plätze", a.peakAt or 0, a.peak), 1, 0.78, 0.3 } end
    tt[#tt + 1] = { "Klick: Liste mit Grund je Quest + Löschen-Knopf", 0.5, 0.55, 0.58 }
    BAND.pLog.tip = tt
  else
    BAND.pLog:Set("LOG  …", TEAL, "i_log"); BAND.pLog.tip = nil
  end
end

function Refresh(rescan)
  if not DB then return end
  if rescan then scanTargets() end
  local collapsed = DB.collapsed
  pcall(bColIc.SetRotation, bColIc, collapsed and pi or 0)
  DK:SetShown(not collapsed); divider:SetShown(not collapsed)
  if collapsed then TL:Hide() end
  SyncDock()

  -- XP
  local lvl = UnitLevel("player")
  local cur, mx = UnitXP("player"), max(1, UnitXPMax("player"))
  local rest = GetXPExhaustion() or 0
  local pct = cur / mx
  X.fw = max(8, X.W * pct)
  X.fill:SetWidth(X.fw)
  X.restF:SetWidth(min(X.W, max(8, X.W * (cur + rest) / mx))); X.restF:SetShown(rest > 0)
  lvlTxt:SetText("|cffffffff" .. lvl .. "|r")
  X.L:SetText(fmt("|cffd8dde0%s|r  |cff6b7076/ %s XP|r", fmtNum(cur), fmtNum(mx)))
  X.txt:SetText(fmt("|cffffffff%.1f %%|r%s", pct * 100, rest > 0 and fmt("   |cff3fb6ffErholt %d %%|r", floor(rest / mx * 100 + 0.5)) or ""))
  local xph = xpPerHour()
  local need = mx - cur
  CHIPS[1].v:SetText(xph > 0 and ("|cffffffff" .. fmtNum(xph) .. "|r") or "|cff6b7076–|r")
  CHIPS[2].v:SetText("|cffffffff" .. fmtNum(need) .. "|r")
  CHIPS[3].v:SetText(xph > 0 and ("|cffffffff" .. fmtTime(need / xph * 3600) .. "|r") or "|cff6b7076–|r")
  M.xi = { lvl = lvl, cur = cur, mx = mx, rest = rest, xph = xph }

  if DB.mode == "route" then routeUpdate() end
  -- Kopf: im Routen-Modus mit Plan-Band (Lagebild)
  local band = DB.mode == "route" and RT.key ~= nil
  HEAD_H = band and HEAD_R or HEAD_Q
  listTop = -(HEAD_H + 4)
  divider:Place(M, 14, -(HEAD_H - 1), W - 14, 0)
  empty:ClearAllPoints(); empty:SetPoint("TOPLEFT", 18, listTop - 8)
  BAND:SetShown(band)
  if band then UpdateLog(RT.logDirty); RT.logDirty = false end
  if DB.mode == "route" and RT.key then      -- ohne passende Route (z. B. ab 40): Quest-Ansicht
    local route = RT.key and LevelPilot_Routes[RT.key]
    DrawBand(route)
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
    subHead:SetText(route and ((DB.speed and "|cff39ff6bSPEED|r  ·  " or "") .. "|cffd8dde0FESTER PLAN|r  ·  " .. (route.name or ""):gsub("%s*·%s*Speedrun$", "")) or "keine Route")
    local n = collapsed and 0 or math.min(#items, DB.rows or 6)
    local bottom = LayoutRows(n, "route")
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
        local grind = st.t == "grind"
        local later = LP_Route.state and LP_Route.state[si] == "later"
        -- Laufweg ueber das Wegenetz (aktuelles Ziel bis 8 km, Listenzeilen bis 2,5 km; weiter: Luftlinie)
        local d
        if i == 1 and st.t == "turnin" and st.q and not LP_Route.Ready(st.q) then
          local gt = LP_Route.GoalTarget(st); d = gt and LP_Route.Dist(gt)
        else
          d = LP_Route.StepCost and LP_Route.StepCost(st, nil, i == 1 and 8000 or 2500) or LP_Route.StepDist(st)
        end
        r.stepIdx, r.qid, r.group = si, st.q, it.steps
        local sub, gfrac = {}, nil
        if st.t == "complete" and st.q then
          local pr = questProgress(st.q); if pr ~= "" then sub[#sub + 1] = pr end
        end
        if grind then local gt; gt, gfrac = grindInfo(st); sub[#sub + 1] = gt end
        if st.note then sub[#sub + 1] = st.note end
        -- Tooltip-Inhalt
        local tip = { { grind and ("Grinden bis Stufe " .. (st.to or "?")) or ((cnt > 1 and (cnt .. " Quests " .. label:lower())) or (label .. ": " .. title)), cr, cg, cb, true } }
        if grind then tip[#tip + 1] = { (title:gsub("^Grinden:%s*", "")), 1, 1, 1 } end
        if #sub > 0 then tip[#tip + 1] = { table.concat(sub, " · "), 1, 1, 1 } end
        if cnt > 1 then for _, gi in ipairs(it.steps) do tip[#tip + 1] = { "· " .. LP_Route.StepTitle(route.steps[gi]), 0.85, 0.9, 0.9 } end end
        if st.z then tip[#tip + 1] = { st.z, 0.55, 0.6, 0.62 } end
        if later then tip[#tip + 1] = { "Freigeschaltet ab Stufe " .. math.max(st.rl or 0, (st.ql or 0) - 3), 1, 0.54, 0.24 } end
        tip[#tip + 1] = { "Rechtsklick: " .. (st.q and ((cnt > 1) and "erste Quest sperren" or "Quest sperren (kommt nie wieder)") or "Schritt überspringen"), 0.5, 0.55, 0.58 }
        r.tip = tip
        if i == 1 then
          -- Hero-Karte: Typ-Farbe als Lichtschleier, grosse Kugel, Fortschrittslinie
          r:SetWash(cr, cg, cb)
          r.orb:Tint({ cr, cg, cb }, lighten(cr, cg, cb)); r.orb:Icon(st.t or "note", cr, cg, cb)
          local notReady = st.t == "turnin" and st.q and not LP_Route.Ready(st.q)
          local kindTxt = grind and ("GRINDEN  ·  BIS STUFE " .. (st.to or "?")) or (notReady and "ERST ERLEDIGEN, DANN ABGEBEN") or (cnt > 1 and (cnt .. " QUESTS " .. label:upper()) or label:upper())
          r.kind:SetText(fmt("|cff%s%s|r  |cff8a9396·|r  |cffb8c2c6SCHRITT %d|r", col, kindTxt, si))
          local ht = grind and (titles[1]:gsub("^Grinden:%s*", "")) or titles[1]
          -- Gruppe: erster Name gross, die anderen in der Zeile darunter (nichts wird abgeschnitten)
          r.title:SetText("|cffffffff" .. ht .. "|r" .. (cnt > 1 and ("  |cff8a9396+" .. (cnt - 1) .. "|r") or ""))
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
          if #near < 2 and LP_Route.state then
            for k = (RT.ptr or 1), #route.steps do
              local o = route.steps[k]
              if k ~= si and o.t == "complete" and o.q and LP_Route.state[k] == "open" and LP_Route.InLog(o.q) then
                local ot = LP_Route.StepTarget(o)
                local dd = ot and LP_Route.Dist(ot)
                if dd and dd < 150 then
                  local nm = LP_Route.StepTitle(o)
                  local dup = false
                  for _, x in ipairs(near) do if x == nm then dup = true end end
                  if not dup then near[#near + 1] = nm end
                end
              end
              if #near >= 2 or k > (RT.ptr or 1) + 40 then break end
            end
          end
          local line = sub
          if #near > 0 then line = { (#sub > 0 and table.concat(sub, " · ") .. "   " or "") .. "|cff39ff6bNebenbei:|r " .. table.concat(near, ", ") } end
          r.sub:SetText(#line > 0 and table.concat(line, " · ") or (st.z or " "))
          r.dist:SetText(d and ("|cffffffff" .. fmtDist(d) .. "|r") or "")
          local spd = (LP_Fly and LP_Fly.Speed and LP_Fly.Speed()) or 7
          r.eta:SetText((d and d > 25) and ("ca. " .. fmtTime(d * 1.05 / spd)) or (d and "|cff39ff6bhier|r" or ""))
          local frac = grind and gfrac or ((st.t == "complete" and st.q) and questFrac(st.q) or nil)
          r:SetProgress(frac, cr, cg, cb)
        else
          -- Zeitleiste: kleine Kugel, Titel, Entfernung oder Etikett
          local pre = cnt > 1 and fmt("|cff%s%d×|r ", col, cnt) or ""
          r.title:SetText(pre .. (later and "|cff7d8388" or "|cffd8dde0") .. title .. "|r")
          if later then
            r.orb:Tint({ 0.42, 0.45, 0.48 }); r.orb:Icon(st.t or "note", 0.55, 0.58, 0.6); r.orb.icon:SetDesaturated(true)
            r.dist:SetText(""); r:SetTag("ab St. " .. math.max(st.rl or 0, (st.ql or 0) - 3), 1, 0.54, 0.24)
          else
            r.orb:Tint({ cr, cg, cb }, nil, 0.85); r.orb:Icon(st.t or "note", cr, cg, cb)
            if grind then r.dist:SetText(""); r:SetTag("bis St. " .. (st.to or "?"), 1, 0.54, 0.24)
            else r.dist:SetText(d and ("|cff8a9396" .. fmtDist(d) .. "|r") or "") end
          end
          r:SetAlpha(max(0.5, 1 - (i - 2) * 0.09))
        end
        r:Show()
      else
        r.stepIdx, r.qid, r.group, r.tip = nil, nil, nil, nil; r:Hide()
      end
    end
    if not route then
      empty:SetText("Keine Route für deine Fraktion/Stufe gefunden.\nUnten auf QUESTS umschalten.")
    elseif RT.wait then
      empty:SetText("Lese Questlog und Questie-Daten …\nDann erkenne ich, wo du im Plan stehst.")
    elseif n == 0 and not collapsed then
      empty:SetText("Route " .. (route.name or "") .. " erledigt – nächster Abschnitt folgt.")
    end
    empty:SetShown(not collapsed and n == 0)
    local flyH = FlyBanner(n > 0 and -bottom or (listTop - 40))
    M:SetHeight(collapsed and HEAD_H or ((n > 0 and bottom or (-listTop + 40)) + flyH + DOCK_H))
    A:SetShown(DB.arrow and RT.idx ~= nil and M:IsShown())
    return
  end

  -- Quest-Ansicht
  subHead:SetText(DB.mode == "route" and ("Keine Route für Stufe " .. lvl .. "  ·  angenommene Quests")
    or "Angenommene Quests  ·  nach Entfernung")
  empty:SetText("Keine angenommenen Quests auf dieser Karte.\nNeue Quests zeigt dir Questie (gelbes !).")
  local tgt = currentTarget()
  local n = collapsed and 0 or min(#TARGETS, DB.rows or 6)
  local bottom = LayoutRows(n, "quests")
  for i, r in ipairs(ROWS) do
    local t = TARGETS[i]
    if i <= n and t then
      r.qid, r.stepIdx, r.group = t.id, nil, nil
      local cr, cg, cb = levelColor(t.lvl)
      if t.turnin then cr, cg, cb = NEON[1], NEON[2], NEON[3] end
      r.orb:Tint({ cr, cg, cb }, nil, 0.9); r.orb:Icon(t.turnin and "turnin" or "complete", cr, cg, cb)
      r.title:SetText("|cffffffff" .. t.title .. "|r")
      r.sub:SetText(t.turnin and "|cff39ff6bAlles erledigt – zum Abgeben|r" or (t.prog ~= "" and t.prog or "Ziel auf der Karte"))
      r.dist:SetText("|cffffffff" .. fmtDist(t.dist) .. "|r")
      local tags = {}
      if t.xp then tags[#tags + 1] = "|cff66ccff+" .. fmtNum(t.xp) .. " XP|r" end
      if PIN == t.id then tags[#tags + 1] = "|cffffd24dFIX|r" end
      r:SetTag(#tags > 0 and table.concat(tags, "  ") or nil)
      local sel = (tgt and tgt.id == t.id) and true or false
      if sel then r:SetWash(NEON[1], NEON[2], NEON[3], 0.20) end
      r.wash:SetShown(sel); r.base:SetShown(sel); r.edge:SetShown(sel)
      local tip = { { t.title, NEON[1], NEON[2], NEON[3], true } }
      if t.prog and t.prog ~= "" then tip[#tip + 1] = { t.prog, 1, 1, 1 } end
      if t.xp then tip[#tip + 1] = { "Belohnung: " .. fmtNum(t.xp) .. " XP", 0.4, 0.8, 1 } end
      tip[#tip + 1] = { "Linksklick: Pfeil festhalten · Rechtsklick: lösen", 0.5, 0.55, 0.58 }
      r.tip = tip
      r:Show()
    else
      r.qid, r.tip = nil, nil; r:Hide()
    end
  end
  empty:SetShown(not collapsed and #TARGETS == 0)
  local flyH = FlyBanner(n > 0 and -bottom or (listTop - 40))
  M:SetHeight(collapsed and HEAD_H or ((n > 0 and bottom or (-listTop + 40)) + flyH + DOCK_H))
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
  local typ = tgt.step and tgt.step.t or (tgt.turnin and "turnin" or "complete")
  if typ ~= aTyp then
    aTyp = typ
    local at = SetIcon(aIcon, typ, NEON[1], NEON[2], NEON[3]); aIcon:SetSize(at and 20 or 14, at and 20 or 14)
  end
  local east, north, viaLen, walkLen, via
  SetBlizzPin(tgt)
  local aim = tgt
  if DB.wege and tgt.map and LP_Route then
    local okR, wp, len, rest = pcall(LP_Route.Route, tgt)
    if okR then
      if wp then aim, viaLen, via = wp, len, wp.via end
      walkLen = rest
    end
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
  local e2, n2 = LP_Route.Offset(tgt)
  local straight = e2 and sqrt(e2 * e2 + n2 * n2) or d
  local walk = viaLen or walkLen
  if walk and walk > straight * 1.15 + 30 then
    -- echter Laufweg deutlich laenger als die Luftlinie (Berge, Schlucht, Tunnel): Weg anzeigen
    aDist:SetText((tgt.turnin and "|cff39ff6b" or "|cffffffff") .. fmtDist(walk) .. "|r  |cff39ff6bWeg|r")
  elseif viaLen then
    aDist:SetText((tgt.turnin and "|cff39ff6b" or "|cffffffff") .. fmtDist(viaLen) .. "|r  |cff39ff6bWeg|r")
  else
    aDist:SetText((tgt.turnin and "|cff39ff6b" or "|cffffffff") .. fmtDist(walk or straight) .. "|r  |cff6b7076" .. (walk and "direkt" or "Luftlinie") .. "|r")
  end
  local viaTxt = via and via.name and ("  |cff4fd2ffüber " .. via.name .. "|r") or ""
  aName:SetText((tgt.turnin and "|cff39ff6bAbgeben: |r" or "") .. tgt.title .. viaTxt)
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
  return LP_Route.Wants(route, qid, RT.ptr)
end
local function routeWantsTitle(title)
  if not (DB and DB.mode == "route" and RT.key) then return true end
  local route = LevelPilot_Routes[RT.key]; if not (route and title) then return false end
  local p = RT.ptr or 1
  for i = p, math.min(#route.steps, p + LP_Route.WANT_SPAN) do
    local st = route.steps[i]
    if st.t == "accept" and st.q and LP_Route.state and LP_Route.state[i] == "open" and LP_Route.StepTitle(st) == title then return true end
  end
  return false
end
local notWanted = {}
local function hintNotWanted(qid, title)
  local k = qid or title
  if not k or notWanted[k] then return end
  notWanted[k] = true
  P("|cffffd24d" .. (title or ("Quest " .. tostring(qid))) .. "|r ist gerade nicht in deinem Plan – nicht automatisch angenommen.")
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
-- Einstieg/Sprung melden (Fenster-Meldung + Chat mit Grund und Rueckweg)
local WHY = { hier = "an deinen Quests hier vor Ort", frisch = "an deinen zuletzt angenommenen/abgegebenen Quests",
  log = "an den Quests in deinem Log", stufe = "an deiner Stufe", start = "Routenanfang" }
function announce(route, info)
  local p = info.jumped and info.jumped.to or info.ptr
  local s = route.steps[math.min(p or 1, #route.steps)]
  local sd = s and route.segs and route.segs[s.seg or 1]
  local where = sd and (sd.z .. " · " .. sd.hub) or (s and s.z or "")
  if info.jumped then
    Toast(fmt("|cff4fd2ffPLAN SPRINGT MIT|r  ·  Schritt %d  ·  %s", p, where), "go")
    P(fmt("Plan: Sprung von Schritt %d auf |cff39ff6b%d|r (%s) – du machst schon Quests von dort. %d offene Schritte dazwischen übersprungen.  |cff8a8f93Rückgängig: /lp zurueck|r",
      info.jumped.from, p, where, info.jumped.n))
  elseif info.entry then
    Toast(fmt("|cff39ff6bEINSTIEG|r  ·  Schritt %d  ·  %s", p or 1, where), "go")
    P(fmt("Plan: Einstieg bei Schritt |cff39ff6b%d|r von %d (%s) – erkannt %s.  |cff8a8f93Falsch? /lp schritt <Nr> oder /lp einstieg|r",
      p or 1, #route.steps, where, WHY[info.entry] or ""))
  end
end

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
    DB.qmem.at = DB.qmem.at or {}
    RT.loginT = GetTime()
    if LP_Route then LP_Route.mem = DB.qmem; LP_Route.PruneStamps(); LP_Route.ScanLog(false); LP_Route.ban = DB.ban; LP_Route.UserNav = DB.nav; LP_Route.speed = DB.speed; LP_Route.maxDiff = DB.maxDiff end
    if Quiet then Quiet(8) end
    xpTrack(); checkCompleted(true); Refresh(true)
    P("v" .. VERSION .. " bereit – /lp für Befehle. Umschalt halten = Auto-Quest kurz aus.")
    if oldSkip then P("Hinweis: alte übersprungene Schritte wurden zurückgesetzt (sie passten nicht mehr zur neuen Route).") end
    return
  end
  if ev == "QUEST_ACCEPTED" or ev == "QUEST_TURNED_IN" or ev == "QUEST_REMOVED" or ev == "QUEST_LOG_UPDATE" then RT.logDirty = true end
  if LP_Route and LP_Route.OnAccepted then
    if ev == "QUEST_ACCEPTED" then LP_Route.OnAccepted((... and type(...) == "number") and ... or a1)
    elseif ev == "QUEST_TURNED_IN" then LP_Route.OnTurnedIn(a1)
    elseif ev == "QUEST_LOG_UPDATE" then LP_Route.ScanLog(true); RT.logReady = true
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
  pcall(Animate, now, el)
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
Glass(PP, { glowA = 0.24, sheenH = 18, pad = 40 })
local ppIcon = PP:CreateTexture(nil, "ARTWORK"); ppIcon:SetSize(22, 22); ppIcon:SetPoint("LEFT", 10, 0)
local ppT = UI(PP, 13, true); ppT:SetPoint("TOPLEFT", 40, -8); ppT:SetWidth(190); ppT:SetJustifyH("LEFT"); ppT:SetWordWrap(false)
local ppS = UI(PP, 11); ppS:SetPoint("BOTTOMLEFT", 40, 8); ppS:SetWidth(190); ppS:SetJustifyH("LEFT"); ppS:SetWordWrap(false); ppS:SetTextColor(0.66, 0.9, 0.76)
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
      local bg = Capsule(b, "BACKGROUND", 0, 26, { 1, 1, 1, 0.08 })
      if primary then bg:SetGradient({ NEON[1], NEON[2], NEON[3], 1 }, { TEAL[1], TEAL[2], TEAL[3], 1 }) else bg:SetGradient({ 1, 1, 1, 0.10 }, { 1, 1, 1, 0.04 }) end
      Capsule(b, "HIGHLIGHT", 0, 26, { 1, 1, 1, 0.14 }, "ADD")
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
  elseif c == "menu" or c == "menü" or c == "einstellungen" or c == "optionen" then OpenSettings(true)
  elseif c == "xp" then XPS.start, XPS.gained = GetTime(), 0; P("XP/h neu gestartet.")
  elseif c == "weiter" then
    if RT.key and RT.idx then SkipStep(RT.idx); P("Schritt " .. RT.idx .. " übersprungen. Zurückholen: /lp zurueck") end; Refresh(true)
  elseif c == "zurueck" or c == "zurück" then
    -- das Letzte rueckgaengig: Sprung des Plans oder uebersprungener Schritt
    local plan = RT.key and DB.plan[RT.key]
    local lastJ = plan and plan.hist and plan.hist[#plan.hist]
    local lastS = DB.skipLog[#DB.skipLog]
    if lastJ and (not lastS or (lastJ.t or 0) >= (lastS.t or 0)) then
      table.remove(plan.hist)
      plan.k, plan.i, plan.hold = lastJ.k, lastJ.i, time() + 1800
      P("Sprung rückgängig – Plan wieder bei Schritt " .. tostring(lastJ.i) .. ". (30 min kein automatischer Sprung)")
    elseif lastS then
      table.remove(DB.skipLog)
      if DB.skipK[lastS.r] then DB.skipK[lastS.r][lastS.k] = nil end
      P("Schritt zurückgeholt.")
    else P("Nichts zum Zurücknehmen.") end
    Refresh(true)
  elseif c == "einstieg" then
    local plan = RT.key and DB.plan[RT.key]
    if plan then plan.k, plan.i, plan.hold = nil, nil, nil end
    P("Suche deinen Einstieg neu (Questlog + Ort + Stufe) …"); Refresh(true)
  elseif c == "schritt" then
    local n = tonumber((msg or ""):match("(%d+)"))
    local route = RT.key and LevelPilot_Routes[RT.key]
    if route and n and route.steps[n] then
      local plan = DB.plan[RT.key]
      plan.hist = plan.hist or {}
      if plan.k then table.insert(plan.hist, { k = plan.k, i = plan.i, t = time() }) end
      plan.k, plan.i, plan.hold = LP_Route.StepKey(route.steps[n]), n, time() + 1800
      P("Plan auf Schritt " .. n .. " gesetzt (erledigte Schritte danach werden übersprungen). Rückgängig: /lp zurueck"); Refresh(true)
    else P("Benutzung: /lp schritt <Nummer>  (1–" .. (route and #route.steps or "?") .. ")") end
  elseif c == "log" or c == "questlog" then OpenLog(true)
  elseif c == "plan" then
    local route = RT.key and LevelPilot_Routes[RT.key]
    if not route then P("Keine Route für deine Stufe.") return end
    local s = RT.idx and route.steps[RT.idx]
    local sd = s and route.segs and route.segs[s.seg or 1]
    local missed = 0
    for _, st in pairs(LP_Route.state or {}) do if st == "missed" then missed = missed + 1 end end
    P(fmt("Plan %s: Schritt |cff39ff6b%s|r von %d%s · Ziel: %s%s", route.name or RT.key, tostring(RT.idx or "–"), #route.steps,
      sd and (" · " .. sd.z .. " · " .. sd.hub) or "", s and ((LP_Route.TYPE[s.t] or s.t) .. " " .. LP_Route.StepTitle(s)) or "–",
      missed > 0 and fmt(" · %d hinter dir übersprungen", missed) or ""))
  elseif c == "neu" then
    if RT.key then DB.skipK[RT.key] = {}; DB.plan[RT.key] = {} end; wipe(DB.skipLog)
    P("Übersprungene Schritte zurückgesetzt, Einstieg wird neu gesucht."); Refresh(true)
  elseif c == "route" then
    local R = LP_Route
    P("Route: " .. tostring(RT.key and LevelPilot_Routes[RT.key].name) .. " · Schritt " .. tostring(RT.idx) .. " · Questie-Daten: " .. ((R and R.HasQuestie()) and "|cff39ff6bja|r" or "|cffff5050nein|r"))
  else
    P("/lp (an/aus) · /lp menu · /lp plan · /lp log · /lp weiter · /lp zurueck · /lp einstieg · /lp schritt <Nr> · /lp neu · /lp route · /lp punkt (neu|weg) · /lp export · /lp import · /lp wege · /lp speed · /lp strahl · /lp ton · /lp kampf · /lp flug · /lp entsperren · /lp sound · /lp gruen · /way x y · /lp auto · /lp pfeil · /lp marker · /lp lock · /lp unlock · /lp toast · /lp xp · /lp reset")
  end
end
