-- TotemTakt-Uhr (Tiry): Restzeit deiner Totems als runde Symbole. Verschieben, vergroessern, verkleinern.
--
-- Funktioniert auch im Kampf: WoW Forever macht Totem-Daten im Kampf ggf. "geheim" (secret values).
-- Add-on-Code darf geheime Werte dann nicht vergleichen oder damit rechnen, aber an bestimmte
-- Anzeige-Funktionen weiterreichen (laut Forever-API-Doku "AllowedWhenTainted"):
--   Symbol     Texture:SetTexture(icon)
--   sichtbar   Frame:SetAlphaFromBoolean(haveTotem, 1, 0)      (SetShown waere gesperrt)
--   Ring       Cooldown:SetCooldownFromDurationObject(GetTotemDuration(slot))   (wie Blizzards Aura-Knoepfe)
--   Zahl       FontString:SetFormattedText("%d", GetTotemTimeLeft(slot))
-- Sind die Werte nicht geheim, zeigt die Uhr m:ss und faerbt die letzten 10 s rot.
--
-- Totem-Plaetze (Blizzard): 1 Feuer, 2 Erde, 3 Wasser, 4 Luft. Reihenfolge der Uhr = deine TotemTakt-Reihenfolge.

local TT = TotemTakt
if not TT or not TT.EL then return end
local EL, MEDIA = TT.EL, TT.MEDIA
local CIRCLE = "Interface\\CharacterFrame\\TempPortraitAlphaMask"
local FONT, FONT_UI = "Fonts\\FRIZQT__.TTF", "Fonts\\ARIALN.TTF"
local NEON, AQUA = { 0.22, 1.00, 0.42 }, { 0.16, 0.70, 1.00 }
local floor, max, min, sin = math.floor, math.max, math.min, math.sin
local fmt = string.format

local SLOT = {
  fire = FIRE_TOTEM_SLOT or 1, earth = EARTH_TOTEM_SLOT or 2,
  water = WATER_TOTEM_SLOT or 3, air = AIR_TOTEM_SLOT or 4,
}
local SIZE, GAP, PAD = 44, 10, 9        -- Symbol, Abstand, Rand (bei Groesse 1)
local SMIN, SMAX = 0.5, 2.5
local WARN = 10                          -- s: ab hier rot
local UDEF = { on = true, scale = 1, lock = false, vert = false, leer = 0.25, glas = true }

local U, B, grip
local slots = {}
local orderKey

local function P(msg) print("|cff39ff6bTotem|r|cff2de2e6Takt|r-Uhr: " .. msg) end

-- geheime Werte zuerst pruefen: Vergleiche (auch == nil) waeren damit nicht erlaubt
local function isSecret(v)
  if not issecretvalue then return false end
  local ok, s = pcall(issecretvalue, v)
  return not ok or s == true
end
local function plain(v) if isSecret(v) then return nil end return v end

local function Tex(p, layer, sub) return p:CreateTexture(nil, layer or "ARTWORK", nil, sub or 0) end
local function MT(p, layer, sub, name, blend)
  local t = Tex(p, layer, sub); t:SetTexture(MEDIA .. name); if blend then t:SetBlendMode(blend) end
  return t
end
local function Grad(t, orient, a, b)
  if t.SetGradient and CreateColor then
    pcall(t.SetGradient, t, orient, CreateColor(a[1], a[2], a[3], a[4] or 1), CreateColor(b[1], b[2], b[3], b[4] or 1))
  end
end

-- Masse der Leiste bei Groesse 1
local function dims()
  local n = #slots
  local long = PAD * 2 + n * SIZE + (n - 1) * GAP
  local short = PAD * 2 + SIZE
  if U.vert then return short, long end
  return long, short
end

---------------------------------------------------------------------------
-- Position: TOPLEFT in UIParent-Einheiten (unabhaengig von der Groesse gespeichert)
---------------------------------------------------------------------------
local function place()
  local s = U.scale
  B:SetScale(s)
  B:ClearAllPoints()
  if U.x and U.y then
    B:SetPoint("TOPLEFT", UIParent, "BOTTOMLEFT", U.x / s, U.y / s)
  else
    B:SetPoint("CENTER", UIParent, "CENTER", 0, -170 / s)
  end
end

local function savePos()
  local l, t = B:GetLeft(), B:GetTop()
  if l and t then
    local s = B:GetScale() or U.scale
    U.x, U.y = floor(l * s + 0.5), floor(t * s + 0.5)
  end
end

function TT.UhrScale(v)
  if not (U and B) then return end
  v = tonumber(v)
  if not v then return end
  v = max(SMIN, min(SMAX, floor(v * 100 + 0.5) / 100))
  if not (U.x and U.y) then savePos() end   -- obere linke Ecke bleibt stehen
  U.scale = v
  place()
end

---------------------------------------------------------------------------
-- Aufbau
---------------------------------------------------------------------------
local function tipSlot(s)
  if not GameTooltip then return end
  GameTooltip:SetOwner(s, "ANCHOR_TOP")
  local ok = pcall(GameTooltip.SetTotem, GameTooltip, s.slot)
  if not ok then GameTooltip:SetText(EL[s.el].name) end
  GameTooltip:AddLine("Ziehen: verschieben · Mausrad: Größe", 0.6, 0.85, 0.78)
  GameTooltip:AddLine("/takt uhr fest – Leiste fixieren (durchklickbar)", 0.6, 0.85, 0.78)
  GameTooltip:Show()
end
local function noTip() if GameTooltip then GameTooltip:Hide() end end

local function wheel(_, d)
  if U.lock then return end
  TT.UhrScale(U.scale + (d > 0 and 0.05 or -0.05))
end

local function buildSlot(el)
  local e = EL[el]
  local s = CreateFrame("Button", nil, B)
  s.el, s.slot = el, SLOT[el]
  s:SetSize(SIZE, SIZE)
  -- Grundring (immer da, leer = blass)
  s.base = CreateFrame("Frame", nil, s); s.base:SetAllPoints()
  s.halo = MT(s.base, "BACKGROUND", 0, "dot", "ADD"); s.halo:SetPoint("CENTER"); s.halo:SetSize(SIZE * 1.7, SIZE * 1.7)
  s.halo:SetVertexColor(e.c1[1], e.c1[2], e.c1[3], 0.22)
  s.disc = MT(s.base, "BORDER", 0, "ctx_disc"); s.disc:SetPoint("CENTER"); s.disc:SetSize(SIZE, SIZE)
  s.disc:SetVertexColor(0.03, 0.05, 0.05, 0.92)
  s.core = MT(s.base, "ARTWORK", 0, "dot", "ADD"); s.core:SetPoint("CENTER"); s.core:SetSize(SIZE * 0.6, SIZE * 0.6)
  s.core:SetVertexColor(e.c1[1], e.c1[2], e.c1[3], 0.35)
  s.ring = MT(s.base, "OVERLAY", 0, "ctx_ring", "ADD"); s.ring:SetPoint("CENTER"); s.ring:SetSize(SIZE + 6, SIZE + 6)
  Grad(s.ring, "VERTICAL", { e.c2[1], e.c2[2], e.c2[3], 0.95 }, { e.c1[1], e.c1[2], e.c1[3], 0.95 })
  -- aktives Totem: Symbol, Ablauf-Ring, Restzeit
  s.live = CreateFrame("Frame", nil, s); s.live:SetAllPoints()
  s.icon = Tex(s.live, "ARTWORK", 1); s.icon:SetSize(SIZE - 8, SIZE - 8); s.icon:SetPoint("CENTER")
  s.icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
  pcall(function()
    local m = s.live:CreateMaskTexture()
    m:SetTexture(CIRCLE, "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    m:SetAllPoints(s.icon)
    s.icon:AddMaskTexture(m)
  end)
  s.gloss = MT(s.live, "ARTWORK", 3, "ctx_gloss", "ADD"); s.gloss:SetPoint("CENTER"); s.gloss:SetSize(SIZE - 8, SIZE - 8)
  s.gloss:SetVertexColor(1, 1, 1, 0.16)
  s.cd = CreateFrame("Cooldown", nil, s.live)
  s.cd:SetPoint("CENTER"); s.cd:SetSize(SIZE - 8, SIZE - 8)
  pcall(s.cd.SetSwipeTexture, s.cd, MEDIA .. "ctx_disc")
  pcall(s.cd.SetSwipeColor, s.cd, 0, 0, 0, 0.62)
  pcall(s.cd.SetReverse, s.cd, true)            -- wie Blizzards Totem-Leiste
  pcall(s.cd.SetDrawEdge, s.cd, false)
  pcall(s.cd.SetDrawBling, s.cd, false)
  pcall(s.cd.SetUseCircularEdge, s.cd, true)
  pcall(s.cd.SetHideCountdownNumbers, s.cd, true) -- eigene Zahl (unabhaengig von der Spiel-Option)
  -- Zahl ueber dem Ablauf-Ring
  s.top = CreateFrame("Frame", nil, s.live); s.top:SetAllPoints()
  s.top:SetFrameLevel((s.cd:GetFrameLevel() or 1) + 2)
  s.warn = MT(s.top, "BACKGROUND", 0, "ctx_ring", "ADD"); s.warn:SetPoint("CENTER"); s.warn:SetSize(SIZE + 10, SIZE + 10)
  s.warn:SetVertexColor(1, 0.30, 0.25, 0)
  s.txt = s.top:CreateFontString(nil, "OVERLAY")
  if not s.txt:SetFont(FONT_UI, 15, "OUTLINE") then s.txt:SetFont(FONT, 14, "OUTLINE") end
  s.txt:SetShadowColor(0, 0, 0, 1); s.txt:SetShadowOffset(1, -1)
  s.txt:SetPoint("CENTER", 0, 0); s.txt:SetWidth(SIZE + 12); s.txt:SetJustifyH("CENTER")
  s.txt:SetTextColor(0.94, 1, 0.96)
  s.txt:SetText("")
  -- Maus: ziehen = ganze Leiste, Mausrad = Groesse, Tooltip
  s:RegisterForDrag("LeftButton")
  s:SetScript("OnDragStart", function() if not U.lock then B:StartMoving() end end)
  s:SetScript("OnDragStop", function() B:StopMovingOrSizing(); savePos(); place() end)
  s:EnableMouseWheel(true)
  s:SetScript("OnMouseWheel", wheel)
  s:SetScript("OnEnter", tipSlot)
  s:SetScript("OnLeave", noTip)
  return s
end

local function buildGrip()
  grip = CreateFrame("Button", nil, B)
  grip:SetSize(20, 20); grip:SetPoint("BOTTOMRIGHT", 4, -4)
  grip:SetFrameLevel((B:GetFrameLevel() or 1) + 20)
  grip:RegisterForClicks("RightButtonUp")
  grip.d = {}
  for _, o in ipairs({ { 12, 0 }, { 6, 6 }, { 12, 6 }, { 0, 12 }, { 6, 12 }, { 12, 12 } }) do   -- Dreieck unten rechts
    local t = MT(grip, "OVERLAY", 0, "dot")
    t:SetSize(5, 5); t:SetPoint("TOPLEFT", o[1] + 1, -(o[2] + 1))
    t:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.9)
    grip.d[#grip.d + 1] = t
  end
  grip.hl = MT(grip, "HIGHLIGHT", 0, "dot", "ADD"); grip.hl:SetPoint("CENTER"); grip.hl:SetSize(30, 30)
  grip.hl:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.35)
  -- Ziehen an der Ecke: Groesse folgt der Maus, obere linke Ecke bleibt
  grip:SetScript("OnMouseDown", function(self, btn)
    if btn ~= "LeftButton" or U.lock then return end
    savePos()
    self.sizing = true
  end)
  grip:SetScript("OnMouseUp", function(self) self.sizing = false end)
  grip:SetScript("OnUpdate", function(self)
    if not self.sizing or not (U.x and U.y) then return end
    local cx, cy = GetCursorPosition()
    local es = UIParent:GetEffectiveScale() or 1
    cx, cy = cx / es, cy / es
    local w, h = dims()
    local v = max((cx - U.x) / w, (U.y - cy) / h)
    if v == v then TT.UhrScale(v) end
  end)
  grip:SetScript("OnClick", function() TT.UhrScale(1); P("Größe 1") end)   -- Rechtsklick
  grip:SetScript("OnEnter", function(self)
    if not GameTooltip then return end
    GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
    GameTooltip:SetText("Größe ändern")
    GameTooltip:AddLine("Ziehen · Mausrad · Rechtsklick = normal", 0.6, 0.85, 0.78)
    GameTooltip:Show()
  end)
  grip:SetScript("OnLeave", noTip)
end

local function build()
  B = CreateFrame("Frame", "TotemTaktUhr", UIParent)
  B:SetFrameStrata("MEDIUM")
  B:SetClampedToScreen(true)
  B:SetMovable(true)
  B:RegisterForDrag("LeftButton")
  B:SetScript("OnDragStart", function(self) if not U.lock then self:StartMoving() end end)
  B:SetScript("OnDragStop", function(self) self:StopMovingOrSizing(); savePos(); place() end)
  B:SetScript("OnMouseWheel", wheel)
  -- Glas-Pille: Neon-Kante, dunkler Koerper, Farbschleier
  B.edge = MT(B, "BACKGROUND", 0, "card_s")
  B.edge:SetAllPoints()
  B.body = MT(B, "BACKGROUND", 1, "card_s")
  B.body:SetPoint("TOPLEFT", 1, -1); B.body:SetPoint("BOTTOMRIGHT", -1, 1)
  B.tint = MT(B, "BACKGROUND", 2, "card_s", "ADD")
  B.tint:SetPoint("TOPLEFT", 1, -1); B.tint:SetPoint("BOTTOMRIGHT", -1, 1)
  for _, t in ipairs({ B.edge, B.body, B.tint }) do
    if t.SetTextureSliceMargins then pcall(t.SetTextureSliceMargins, t, 8, 8, 8, 8); pcall(t.SetTextureSliceMode, t, 0) end
  end
  for _, el in ipairs(TT.ELS) do slots[#slots + 1] = buildSlot(el) end
  buildGrip()
end

local function paintGlass()
  local h = U.vert and "VERTICAL" or "HORIZONTAL"
  local a = U.glas and 1 or 0
  Grad(B.edge, h, { NEON[1], NEON[2], NEON[3], 0.55 * a }, { AQUA[1], AQUA[2], AQUA[3], 0.40 * a })
  Grad(B.body, "VERTICAL", { 0.030, 0.034, 0.048, 0.80 * a }, { 0.072, 0.092, 0.088, 0.78 * a })
  Grad(B.tint, h, { NEON[1], NEON[2], NEON[3], 0.05 * a }, { AQUA[1], AQUA[2], AQUA[3], 0.035 * a })
end

-- Reihenfolge, Ausrichtung, Sperre
local function layout()
  local DB = TT.GetDB()
  local order = (DB and DB.order) or TT.ELS
  orderKey = table.concat(order, ",")
  local byEl = {}
  for _, s in ipairs(slots) do byEl[s.el] = s end
  local i = 0
  for _, el in ipairs(order) do
    local s = byEl[el]
    if s then
      local off = PAD + i * (SIZE + GAP)
      s:ClearAllPoints()
      if U.vert then s:SetPoint("TOPLEFT", B, "TOPLEFT", PAD, -off) else s:SetPoint("TOPLEFT", B, "TOPLEFT", off, -PAD) end
      i = i + 1
    end
  end
  B:SetSize(dims())
  paintGlass()
  local free = not U.lock
  B:EnableMouse(free)
  B:EnableMouseWheel(free)
  for _, s in ipairs(slots) do s:EnableMouse(free); s:EnableMouseWheel(free) end
  grip:SetShown(free)
  B:SetShown(U.on)
  place()
end

---------------------------------------------------------------------------
-- Anzeige
---------------------------------------------------------------------------
local function fmtLeft(t)
  if t >= 60 then
    local c = math.ceil(t)
    return fmt("%d:%02d", floor(c / 60), c % 60)
  end
  return fmt("%d", math.ceil(t))
end

-- Symbol, Sichtbarkeit, Ablauf-Ring (bei Totem-Ereignissen)
local function paintSlot(s)
  local ok, have, _, start, dur, icon = pcall(GetTotemInfo, s.slot)
  if not ok then return end
  local sec = isSecret(have)
  if not sec then have = have == true end
  -- geheim oder nicht: SetAlphaFromBoolean darf beides (SetShown/Vergleiche waeren gesperrt)
  local a1 = pcall(s.base.SetAlphaFromBoolean, s.base, have, 1, U.leer)
  local a2 = pcall(s.live.SetAlphaFromBoolean, s.live, have, 1, 0)
  if not (a1 and a2) and not sec then
    s.base:SetAlpha(have and 1 or U.leer); s.live:SetAlpha(have and 1 or 0)
  end
  if isSecret(icon) or plain(icon) then pcall(s.icon.SetTexture, s.icon, icon) end
  local done = false
  if GetTotemDuration then
    local okd, d = pcall(GetTotemDuration, s.slot)
    if okd and d then done = pcall(s.cd.SetCooldownFromDurationObject, s.cd, d, true) end
  end
  if not done then
    local st, du = plain(start), plain(dur)
    if plain(have) and st and du and du > 0 then pcall(s.cd.SetCooldown, s.cd, st, du)
    else pcall(s.cd.Clear, s.cd) end
  end
end

-- Restzeit-Zahl (laufend)
local function tickSlot(s, now)
  local ok, tl = pcall(GetTotemTimeLeft, s.slot)
  if not ok then tl = nil end
  if isSecret(tl) then
    -- im Kampf geheim: Zahl ans Spiel durchreichen (Sekunden), keine eigene Rechnung moeglich
    if not pcall(s.txt.SetFormattedText, s.txt, "%d", tl) then s.txt:SetText("") end
    s.txt:SetTextColor(0.94, 1, 0.96)
    s.warn:SetVertexColor(1, 0.30, 0.25, 0)
    return
  end
  if type(tl) ~= "number" or tl <= 0 then
    s.txt:SetText("")
    s.warn:SetVertexColor(1, 0.30, 0.25, 0)
    return
  end
  s.txt:SetText(fmtLeft(tl))
  if tl <= WARN then
    s.txt:SetTextColor(1, 0.40, 0.32)
    s.warn:SetVertexColor(1, 0.30, 0.25, 0.45 + 0.35 * sin(now * 6))
  else
    s.txt:SetTextColor(0.94, 1, 0.96)
    s.warn:SetVertexColor(1, 0.30, 0.25, 0)
  end
end

function TT.UhrUpdate()
  if not B then return end
  for _, s in ipairs(slots) do paintSlot(s) end
  local now = GetTime and GetTime() or 0
  for _, s in ipairs(slots) do tickSlot(s, now) end
end

---------------------------------------------------------------------------
-- Ereignisse
---------------------------------------------------------------------------
local E = CreateFrame("Frame")
E:RegisterEvent("PLAYER_LOGIN")
local acc, accOrder = 0, 0
local function onUpdate(_, el)
  if not U.on then return end
  acc = acc + el
  accOrder = accOrder + el
  if accOrder >= 0.5 then
    accOrder = 0
    local DB = TT.GetDB()
    if DB and DB.order and table.concat(DB.order, ",") ~= orderKey then layout() end
  end
  if acc < 0.1 then return end
  acc = 0
  local now = GetTime and GetTime() or 0
  for _, s in ipairs(slots) do tickSlot(s, now) end
end

E:SetScript("OnEvent", function(_, ev)
  if ev == "PLAYER_LOGIN" then
    local DB = TT.GetDB()
    local _, cls = UnitClass("player")
    if not DB or cls ~= "SHAMAN" then return end
    DB.uhr = type(DB.uhr) == "table" and DB.uhr or {}
    U = DB.uhr
    for k, v in pairs(UDEF) do if U[k] == nil then U[k] = v end end
    U.scale = max(SMIN, min(SMAX, tonumber(U.scale) or 1))
    U.leer = max(0, min(1, tonumber(U.leer) or UDEF.leer))
    build()
    layout()
    TT.UhrUpdate()
    E:RegisterEvent("PLAYER_TOTEM_UPDATE")
    E:RegisterEvent("PLAYER_ENTERING_WORLD")
    E:SetScript("OnUpdate", onUpdate)
    return
  end
  if U and U.on then TT.UhrUpdate() end
end)

---------------------------------------------------------------------------
-- /takt uhr ...
---------------------------------------------------------------------------
local HELP = {
  "|cffffffff/takt uhr|r – Uhr ein/aus",
  "|cffffffff/takt uhr fest|r / |cfffffffffrei|r – fixieren (durchklickbar) / verschiebbar",
  "|cffffffff/takt uhr groesse 0.5-2.5|r – Größe (oder Mausrad / Ecke ziehen)",
  "|cffffffff/takt uhr senkrecht|r / |cffffffffwaagerecht|r – Ausrichtung",
  "|cffffffff/takt uhr leer|r – leere Plätze blass zeigen oder ganz ausblenden",
  "|cffffffff/takt uhr glas|r – Glas-Hintergrund an/aus",
  "|cffffffff/takt uhr reset|r – Position und Größe zurück",
}

function TT.UhrCmd(arg)
  if not (U and B) then P("nur für Schamanen.") return end
  arg = (arg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  local cmd, val = arg:match("^(%S*)%s*(.-)$")
  if cmd == "" then
    U.on = not U.on; layout(); if U.on then TT.UhrUpdate() end
    P(U.on and "an" or "aus")
  elseif cmd == "fest" or cmd == "frei" then
    U.lock = (cmd == "fest"); layout()
    P(U.lock and "fixiert – Klicks gehen durch (/takt uhr frei zum Verschieben)" or "frei – ziehen zum Verschieben, Mausrad/Ecke für die Größe")
  elseif cmd == "groesse" or cmd == "größe" or cmd == "gr" or cmd == "size" then
    local n = tonumber((val:gsub(",", ".")))
    if n then TT.UhrScale(n); P(fmt("Größe %.2f", U.scale)) else P("/takt uhr groesse 0.5-2.5") end
  elseif cmd == "senkrecht" or cmd == "waagerecht" then
    U.vert = (cmd == "senkrecht"); layout()
    P(U.vert and "senkrecht" or "waagerecht")
  elseif cmd == "leer" then
    U.leer = (U.leer > 0) and 0 or UDEF.leer; TT.UhrUpdate()
    P(U.leer > 0 and "leere Plätze: blass sichtbar" or "leere Plätze: ausgeblendet")
  elseif cmd == "glas" then
    U.glas = not U.glas; paintGlass()
    P(U.glas and "Glas an" or "Glas aus")
  elseif cmd == "reset" then
    U.x, U.y, U.scale = nil, nil, 1; layout()
    P("Position und Größe zurückgesetzt")
  else
    P("Restzeit deiner Totems – auch im Kampf:")
    for _, l in ipairs(HELP) do print("   " .. l) end
  end
end

function TT.UhrFrame() return B end
