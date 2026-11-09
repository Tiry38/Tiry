---------------------------------------------------------------------------
-- EnhanceHUD 1.2.0 (Frost & Feuer, WoW Forever 16001) · HUD fuer Verstaerker-Schamanen (WoW Classic Era / TBC)
-- Swing-Timer · Windzorn-Procs · Totems · Abklingzeiten · Schild · Waffenbuffs
-- Warnungen · Unterbrechungs-Ansage · Kampf-Auswertung · Twist-Leiste
---------------------------------------------------------------------------
local ADDON = ...
local VERSION = "1.2.0"
local BT = BackdropTemplateMixin and "BackdropTemplate" or nil
local FONT = STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF"
local band = bit.band
local floor, max, min, sin, fmt = math.floor, math.max, math.min, math.sin, string.format
local GetTime = GetTime

local TITLE = "|cff4dd9ffEnhance|r|cffff6a14HUD|r"
local function P(msg) DEFAULT_CHAT_FRAME:AddMessage(TITLE .. " " .. msg) end

---------------------------------------------------------------------------
-- Einstellungen
---------------------------------------------------------------------------
local DEFAULTS = {
  point = "CENTER", x = 0, y = -210, scale = 1, locked = false,
  swing = true, totems = true, cds = true, status = true,
  warn = true, wfFlash = true, wfSound = false, twist = true,
  announce = true, summary = true, oocFade = true,
  life = { hits = 0, procs = 0, fights = 0, dmg = 0, time = 0 },
}
local DB

local function Merge(dst, src)
  for k, v in pairs(src) do
    if type(v) == "table" then
      if type(dst[k]) ~= "table" then dst[k] = {} end
      Merge(dst[k], v)
    elseif dst[k] == nil then
      dst[k] = v
    end
  end
end

---------------------------------------------------------------------------
-- API-Hilfen (laufen auf Era- und TBC-Client)
---------------------------------------------------------------------------
local function SpellInfo(id)
  if GetSpellInfo then
    local n, _, ic = GetSpellInfo(id)
    return n, ic
  elseif C_Spell and C_Spell.GetSpellInfo then
    local i = C_Spell.GetSpellInfo(id)
    if i then return i.name, i.iconID end
  end
end

local function SpellCD(name)
  if not name then return nil end
  if GetSpellCooldown then
    local s, d = GetSpellCooldown(name)
    return s, d
  elseif C_Spell and C_Spell.GetSpellCooldown then
    local i = C_Spell.GetSpellCooldown(name)
    if i then return i.startTime, i.duration end
  end
end

local function AuraAt(i)
  if UnitBuff then
    local name, icon, count, _, dur, exp = UnitBuff("player", i)
    return name, icon, count, dur, exp
  elseif C_UnitAuras and C_UnitAuras.GetBuffDataByIndex then
    local d = C_UnitAuras.GetBuffDataByIndex("player", i)
    if d then return d.name, d.icon, d.applications, d.duration, d.expirationTime end
  end
end

local ItemInstant = GetItemInfoInstant or (C_Item and C_Item.GetItemInfoInstant)

local function fmtT(t)
  if t >= 60 then return fmt("%dm", floor(t / 60 + 0.5)) end
  if t >= 10 then return fmt("%d", floor(t + 0.5)) end
  return fmt("%.1f", t)
end

local function fmtN(n)
  if n >= 1e6 then return fmt("%.1fM", n / 1e6) end
  if n >= 1e3 then return fmt("%.1fk", n / 1e3) end
  return tostring(floor(n + 0.5))
end

local function fmtDur(t)
  return fmt("%d:%02d", floor(t / 60), floor(t % 60))
end

---------------------------------------------------------------------------
-- Zauber (Namen kommen lokalisiert aus dem Client -> deDE/enUS egal)
---------------------------------------------------------------------------
local S = {}
local BOOK = {}          -- bekannte Zauber (Name -> true)
local CDL = {}           -- angezeigte Abklingzeiten
local CD_IDS = { 17364, 8042, 30823 } -- Sturmschlag, Erdschock (= alle Schocks), Schamanistische Wut (TBC)

local function InitSpells()
  S.LS,   S.LSi = SpellInfo(324)    -- Blitzschlagschild
  S.WS          = SpellInfo(24398)  -- Wasserschild (TBC)
  S.FLUR        = SpellInfo(16257)  -- Schlaghagel
  S.WFT         = SpellInfo(8512)   -- Totem des Windzorns
  S.ES          = SpellInfo(8042)   -- Erdschock
end

local function ScanBookModern()
  local SB = C_SpellBook
  if not (SB and SB.GetNumSpellBookSkillLines and SB.GetSpellBookSkillLineInfo and SB.GetSpellBookItemName) then return end
  local bank = (Enum and Enum.SpellBookSpellBank and Enum.SpellBookSpellBank.Player) or 0
  for l = 1, SB.GetNumSpellBookSkillLines() do
    local info = SB.GetSpellBookSkillLineInfo(l)
    if info and info.itemIndexOffset and info.numSpellBookItems then
      for i = info.itemIndexOffset + 1, info.itemIndexOffset + info.numSpellBookItems do
        local n = SB.GetSpellBookItemName(i, bank)
        if n then BOOK[n] = true end
      end
    end
  end
end

local function ScanBook()
  wipe(BOOK)
  if not GetNumSpellTabs then pcall(ScanBookModern); return end
  local getName = GetSpellBookItemName or GetSpellName
  if GetNumSpellTabs and GetSpellTabInfo and getName then
    for t = 1, GetNumSpellTabs() do
      local _, _, off, num = GetSpellTabInfo(t)
      if off and num then
        for i = off + 1, off + num do
          local n = getName(i, BOOKTYPE_SPELL or "spell")
          if n then BOOK[n] = true end
        end
      end
    end
  end
end

local function Known(name)
  if not name then return false end
  if next(BOOK) then return BOOK[name] == true end
  return SpellCD(name) ~= nil
end

---------------------------------------------------------------------------
-- Zustand
---------------------------------------------------------------------------
local PGUID
local inCombat = false
local A = { flurry = 0, shCount = 0 }                   -- Auren
local SW = { mh = { s = 0, d = 0 }, oh = { s = 0, d = 0 } } -- Swing
local SPD = { mh = 0, oh = 0 }
local OHW = false                                         -- Nebenhand-Waffe angelegt
local F = { on = false }                                  -- laufender Kampf
local SES = { hits = 0, procs = 0 }                       -- Sitzung
local flashT, flashTxt = 0, ""
local costES, costT = nil, 0
local NOLOG, cleuSeen, combatStart = false, false, 0 -- Forever: Kampflog fuer Addons gesperrt

local MINE  = COMBATLOG_OBJECT_AFFILIATION_MINE or 0x1
local GUARD = COMBATLOG_OBJECT_TYPE_GUARDIAN or 0x2000

---------------------------------------------------------------------------
-- Design: FROST (links/kalt) trifft FEUER (rechts/heiss)
---------------------------------------------------------------------------
local FROST  = { 0.30, 0.85, 1.00 }
local FROST2 = { 0.05, 0.35, 1.00 }
local FIRE   = { 1.00, 0.42, 0.08 }
local FIRE2  = { 1.00, 0.85, 0.25 }
local C_BG   = { 0.020, 0.024, 0.045 }
local C_ACC  = FROST
local EL_COL = { { 1.0, 0.38, 0.12 }, { 0.85, 0.62, 0.30 }, { 0.22, 0.62, 1.0 }, { 0.70, 0.92, 1.0 } }
local EL_ICON = {
  "Interface\\Icons\\Spell_Fire_SearingTotem",
  "Interface\\Icons\\Spell_Nature_StoneSkinTotem",
  "Interface\\Icons\\Spell_Nature_ManaRegenTotem",
  "Interface\\Icons\\Spell_Nature_Windfury",
}
local BAR_TEX = "Interface\\TargetingFrame\\UI-StatusBar"
local WHITE   = "Interface\\Buttons\\WHITE8X8"
local STAR    = "Interface\\Cooldown\\star4"
local SPARK   = "Interface\\CastingBar\\UI-CastingBar-Spark"
local RING    = "Interface\\Buttons\\UI-ActionButton-Border"
local W, PAD, GAP = 236, 7, 5

-- Farbverlauf auf Textur (alte + neue Client-API)
local function Grad(t, o, r1, g1, b1, a1, r2, g2, b2, a2)
  if not t then return end
  if t.SetGradientAlpha then
    pcall(t.SetGradientAlpha, t, o, r1, g1, b1, a1, r2, g2, b2, a2)
  elseif t.SetGradient and CreateColor then
    pcall(t.SetGradient, t, o, CreateColor(r1, g1, b1, a1), CreateColor(r2, g2, b2, a2))
  end
end

local function Tex(p, layer, sub, blend, file)
  local t = p:CreateTexture(nil, layer or "ARTWORK", nil, sub or 0)
  t:SetTexture(file or WHITE)
  if blend then t:SetBlendMode(blend) end
  return t
end

-- Text Buchstabe fuer Buchstabe von Frost nach Feuer einfaerben
local function GradText(s)
  local chars = {}
  for ch in s:gmatch("[%z\1-\127\194-\244][\128-\191]*") do chars[#chars + 1] = ch end
  local n, out = #chars, {}
  for i, ch in ipairs(chars) do
    local t = n > 1 and (i - 1) / (n - 1) or 0
    local r = FROST[1] + (FIRE[1] - FROST[1]) * t
    local g = FROST[2] + (FIRE[2] - FROST[2]) * t
    local b = FROST[3] + (FIRE[3] - FROST[3]) * t
    out[#out + 1] = fmt("|cff%02x%02x%02x%s|r", floor(r * 255), floor(g * 255), floor(b * 255), ch)
  end
  return table.concat(out)
end

local function Skin(f, a, r, g, b, ba)
  if not f.SetBackdrop then return end
  f:SetBackdrop({ bgFile = WHITE, edgeFile = WHITE, edgeSize = 1 })
  f:SetBackdropColor(C_BG[1], C_BG[2], C_BG[3], a or 0.85)
  f:SetBackdropBorderColor(r or 0, g or 0, b or 0, ba or 1)
end

local function SetBorder(f, r, g, b, a)
  if f.SetBackdropBorderColor then f:SetBackdropBorderColor(r, g, b, a or 0.9) end
end

-- Frost/Feuer-Rahmen: Kanten mit Verlauf, Eck-Klammern, Aussenglühen, Lichtlauf
local function FFFrame(f, thick, glow)
  local fr, fi = FROST, FIRE
  local function edge(p1, p2, w, h)
    local t = Tex(f, "OVERLAY", 6)
    t:SetPoint(p1); t:SetPoint(p2)
    if w then t:SetWidth(w) end
    if h then t:SetHeight(h) end
    return t
  end
  local top = edge("TOPLEFT", "TOPRIGHT", nil, thick)
  local bot = edge("BOTTOMLEFT", "BOTTOMRIGHT", nil, thick)
  Grad(top, "HORIZONTAL", fr[1], fr[2], fr[3], 1, fi[1], fi[2], fi[3], 1)
  Grad(bot, "HORIZONTAL", fr[1], fr[2], fr[3], 0.7, fi[1], fi[2], fi[3], 0.7)
  local l = edge("TOPLEFT", "BOTTOMLEFT", thick); l:SetVertexColor(fr[1], fr[2], fr[3], 0.85)
  local r = edge("TOPRIGHT", "BOTTOMRIGHT", thick); r:SetVertexColor(fi[1], fi[2], fi[3], 0.85)

  -- Eck-Klammern (heller, futuristisch)
  local function bracket(pt, c, sx, sy)
    local h = Tex(f, "OVERLAY", 7); h:SetSize(14, thick + 1); h:SetPoint(pt, sx, sy); h:SetVertexColor(c[1], c[2], c[3], 1)
    local v = Tex(f, "OVERLAY", 7); v:SetSize(thick + 1, 14); v:SetPoint(pt, sx, sy); v:SetVertexColor(c[1], c[2], c[3], 1)
  end
  bracket("TOPLEFT", { 0.75, 0.97, 1 }, -1, 1)
  bracket("BOTTOMLEFT", { 0.75, 0.97, 1 }, -1, -1)
  bracket("TOPRIGHT", FIRE2, 1, 1)
  bracket("BOTTOMRIGHT", FIRE2, 1, -1)

  -- Innen: Frost-Hauch links, Glut rechts, Glanz oben
  local tint = Tex(f, "BACKGROUND", 2)
  tint:SetPoint("TOPLEFT", thick, -thick); tint:SetPoint("BOTTOMRIGHT", -thick, thick)
  Grad(tint, "HORIZONTAL", fr[1], fr[2], fr[3], 0.13, fi[1], fi[2], fi[3], 0.13)
  local sheen = Tex(f, "BACKGROUND", 3)
  sheen:SetPoint("TOPLEFT", thick, -thick); sheen:SetPoint("TOPRIGHT", -thick, -thick); sheen:SetHeight(18)
  Grad(sheen, "VERTICAL", 1, 1, 1, 0, 1, 1, 1, 0.07)

  f.glows = {}
  if glow then
    local function g(p1, rel1, p2, rel2, c, o, aIn, aOut, w, h)
      local t = Tex(f, "BACKGROUND", -7, "ADD")
      t:SetPoint(p1, f, rel1); t:SetPoint(p2, f, rel2)
      if w then t:SetWidth(w) end
      if h then t:SetHeight(h) end
      Grad(t, o, c[1], c[2], c[3], aIn, c[1], c[2], c[3], aOut)
      f.glows[#f.glows + 1] = t
    end
    -- oben (Verlauf: unten kraeftig -> oben 0)
    g("BOTTOMLEFT", "TOPLEFT", "BOTTOMRIGHT", "TOP", fr, "VERTICAL", 0.45, 0, nil, glow)
    g("BOTTOMLEFT", "TOP", "BOTTOMRIGHT", "TOPRIGHT", fi, "VERTICAL", 0.45, 0, nil, glow)
    -- unten (oben kraeftig)
    g("TOPLEFT", "BOTTOMLEFT", "TOPRIGHT", "BOTTOM", fr, "VERTICAL", 0, 0.35, nil, glow)
    g("TOPLEFT", "BOTTOM", "TOPRIGHT", "BOTTOMRIGHT", fi, "VERTICAL", 0, 0.35, nil, glow)
    -- seitlich
    g("TOPRIGHT", "TOPLEFT", "BOTTOMRIGHT", "BOTTOMLEFT", fr, "HORIZONTAL", 0, 0.45, glow)
    g("TOPLEFT", "TOPRIGHT", "BOTTOMLEFT", "BOTTOMRIGHT", fi, "HORIZONTAL", 0.45, 0, glow)
  end

  -- Lichtlauf ueber die Oberkante
  f.shine = Tex(f, "OVERLAY", 7, "ADD", SPARK)
  f.shine:SetSize(26, thick * 9)
  f.shine:SetAlpha(0)
end

local function FS(p, size, layer)
  local f = p:CreateFontString(nil, layer or "OVERLAY")
  f:SetFont(FONT, size, "OUTLINE")
  f:SetShadowColor(0, 0, 0, 1)
  f:SetShadowOffset(1, -1)
  return f
end

local function SetBarGrad(bar, a, b)
  if bar.c1 == a and bar.c2 == b then return end
  bar.c1, bar.c2 = a, b
  Grad(bar:GetStatusBarTexture(), "HORIZONTAL", a[1], a[2], a[3], 1, b[1], b[2], b[3], 1)
  bar.spark:SetVertexColor(min(1, b[1] + 0.35), min(1, b[2] + 0.35), min(1, b[3] + 0.35), 1)
  bar.lead:SetVertexColor(b[1], b[2], b[3], 1)
end

local function Bar(p, h, a, b)
  local bar = CreateFrame("StatusBar", nil, p, BT)
  bar:SetHeight(h)
  bar:SetStatusBarTexture(BAR_TEX)
  bar:SetMinMaxValues(0, 1)
  bar:SetValue(0)
  Skin(bar, 0.85, 0, 0, 0, 1)
  local gloss = Tex(bar, "OVERLAY", 1)
  gloss:SetPoint("TOPLEFT", 1, -1); gloss:SetPoint("TOPRIGHT", -1, -1); gloss:SetHeight(h / 2)
  Grad(gloss, "VERTICAL", 1, 1, 1, 0, 1, 1, 1, 0.18)
  bar.spark = Tex(bar, "OVERLAY", 3, "ADD", SPARK)
  bar.spark:SetSize(16, h * 2.6)
  bar.lead = Tex(bar, "OVERLAY", 2, "ADD", SPARK) -- Glut hinter dem Funken
  bar.lead:SetSize(40, h * 1.6)
  bar.lead:SetAlpha(0.5)
  bar.l = FS(bar, h >= 14 and 11 or 9); bar.l:SetPoint("LEFT", 5, 0)
  bar.r = FS(bar, h >= 14 and 12 or 9); bar.r:SetPoint("RIGHT", -5, 0)
  SetBarGrad(bar, a, b)
  return bar
end

local function Icon(p, size, glowCol)
  local f = CreateFrame("Frame", nil, p, BT)
  f:SetSize(size, size)
  Skin(f, 0.95, 0, 0, 0, 1)
  f.glow = Tex(f, "BACKGROUND", -6, "ADD", RING)
  f.glow:SetPoint("CENTER")
  f.glow:SetSize(size * 1.85, size * 1.85)
  local c = glowCol or FROST
  f.glow:SetVertexColor(c[1], c[2], c[3], 1)
  f.glow:SetAlpha(0)
  f.tex = Tex(f, "ARTWORK", 0, nil, "Interface\\Icons\\INV_Misc_QuestionMark")
  f.tex:SetPoint("TOPLEFT", 1, -1)
  f.tex:SetPoint("BOTTOMRIGHT", -1, 1)
  f.tex:SetTexCoord(0.08, 0.92, 0.08, 0.92)
  local shade = Tex(f, "ARTWORK", 1)
  shade:SetPoint("BOTTOMLEFT", 1, 1); shade:SetPoint("BOTTOMRIGHT", -1, 1); shade:SetHeight(size * 0.5)
  Grad(shade, "VERTICAL", 0, 0, 0, 0.65, 0, 0, 0, 0)
  f.cd = FS(f, floor(size * 0.42)); f.cd:SetPoint("CENTER", 0, -1)
  f.cnt = FS(f, floor(size * 0.36)); f.cnt:SetPoint("BOTTOMRIGHT", -1, 2)
  f.cnt:SetTextColor(FIRE2[1], FIRE2[2], FIRE2[3])
  return f
end

local function GlowSet(f, a, r, g, b)
  if r then f.glow:SetVertexColor(r, g, b, 1) end
  f.glow:SetAlpha(a)
end

---------------------------------------------------------------------------
-- HUD
---------------------------------------------------------------------------
local HUD = CreateFrame("Frame", "EnhanceHUDFrame", UIParent, BT)
HUD:SetSize(W, 120)
HUD:SetClampedToScreen(true)
HUD:SetMovable(true)
HUD:RegisterForDrag("LeftButton")
HUD:Hide()
Skin(HUD, 0.86, 0, 0, 0, 0)
FFFrame(HUD, 2, 10)

HUD.drag = FS(HUD, 10); HUD.drag:SetPoint("BOTTOM", HUD, "TOP", 0, 13)
HUD.drag:SetText(GradText("EnhanceHUD") .. " |cffaaaaaa– ziehen zum Verschieben · /enh|r")

HUD:SetScript("OnDragStart", function(self) if not DB.locked then self:StartMoving() end end)
HUD:SetScript("OnDragStop", function(self)
  self:StopMovingOrSizing()
  local p, _, _, x, y = self:GetPoint()
  DB.point, DB.x, DB.y = p, x, y
end)

-- Kopf: Mana/Schocks links (Frost), Procs rechts (Feuer), Trennlinie
local head = CreateFrame("Frame", nil, HUD)
head.l = FS(head, 11); head.l:SetPoint("LEFT")
head.r = FS(head, 11); head.r:SetPoint("RIGHT")
head.line = Tex(head, "ARTWORK")
head.line:SetPoint("TOPLEFT", head, "BOTTOMLEFT", 0, -2)
head.line:SetPoint("TOPRIGHT", head, "BOTTOMRIGHT", 0, -2)
head.line:SetHeight(1)
Grad(head.line, "HORIZONTAL", FROST[1], FROST[2], FROST[3], 0.6, FIRE[1], FIRE[2], FIRE[3], 0.6)

-- Swing: Haupthand = Frost, Nebenhand = Feuer
local swingSec = CreateFrame("Frame", nil, HUD)
local MH_A, MH_B = FROST2, { 0.55, 0.97, 1.0 }
local OH_A, OH_B = { 0.85, 0.08, 0.04 }, FIRE2
local FL_A, FL_B = { 1.0, 0.25, 0.03 }, { 1.0, 0.92, 0.35 }
local mhBar = Bar(swingSec, 15, MH_A, MH_B)
mhBar:SetPoint("TOPLEFT"); mhBar:SetPoint("TOPRIGHT")
local ohBar = Bar(swingSec, 10, OH_A, OH_B)
ohBar:SetPoint("TOPLEFT", mhBar, "BOTTOMLEFT", 0, -3)
ohBar:SetPoint("TOPRIGHT", mhBar, "BOTTOMRIGHT", 0, -3)

-- Totems
local totSec = CreateFrame("Frame", nil, HUD)
local TT = {}
local TSZ = 36
for i = 1, 4 do
  local b = Icon(totSec, TSZ, EL_COL[i])
  local gap = (W - 2 * PAD - 4 * TSZ) / 3
  b:SetPoint("TOPLEFT", (i - 1) * (TSZ + gap), 0)
  SetBorder(b, EL_COL[i][1], EL_COL[i][2], EL_COL[i][3], 0.8)
  b.bar = CreateFrame("StatusBar", nil, totSec)
  b.bar:SetStatusBarTexture(WHITE)
  b.bar:SetMinMaxValues(0, 1)
  b.bar:SetPoint("TOPLEFT", b, "BOTTOMLEFT", 0, -2)
  b.bar:SetPoint("TOPRIGHT", b, "BOTTOMRIGHT", 0, -2)
  b.bar:SetHeight(3)
  local c = EL_COL[i]
  Grad(b.bar:GetStatusBarTexture(), "HORIZONTAL", c[1] * 0.5, c[2] * 0.5, c[3] * 0.5, 1, c[1], c[2], c[3], 1)
  b.bar.bg = Tex(b.bar, "BACKGROUND")
  b.bar.bg:SetAllPoints()
  b.bar.bg:SetVertexColor(0.08, 0.09, 0.14, 0.95)
  TT[i] = b
end

-- Zeile: Abklingzeiten links (Frost-Glühen), Schild/Waffenbuffs rechts
local rowSec = CreateFrame("Frame", nil, HUD)
local CI, STI = {}, {}
local ISZ = 30
for i = 1, 3 do
  CI[i] = Icon(rowSec, ISZ, FROST)
  CI[i]:SetPoint("LEFT", (i - 1) * (ISZ + 5), 0)
  STI[i] = Icon(rowSec, ISZ, FIRE)
  STI[i]:SetPoint("RIGHT", -(i - 1) * (ISZ + 5), 0)
end
-- STI[1] = Schild (ganz rechts), STI[2] = Nebenhand, STI[3] = Haupthand

-- Twist-Leiste (unter dem HUD, nur wenn Windzorn-Totem-Buff aktiv = TBC)
local twist = Bar(HUD, 12, { 0.2, 0.6, 1 }, { 0.8, 0.97, 1 })
twist:SetPoint("TOPLEFT", HUD, "BOTTOMLEFT", 0, -14)
twist:SetPoint("TOPRIGHT", HUD, "BOTTOMRIGHT", 0, -14)
twist:Hide()

-- Glut & Frostfunken (steigen hinter dem Inhalt auf)
local PART = {}
for i = 1, 22 do
  local t = Tex(HUD, "BORDER", 7, "ADD", STAR)
  t:Hide()
  PART[i] = { t = t, life = 0 }
end
local function Spawn(n, burst)
  for _, p in ipairs(PART) do
    if n <= 0 then break end
    if p.life <= 0 then
      n = n - 1
      p.x = math.random() * W
      p.y = burst and (HUD:GetHeight() * math.random()) or math.random() * 6
      p.vx = (math.random() - 0.5) * (burst and 60 or 10)
      p.vy = burst and (30 + math.random() * 60) or (10 + math.random() * 22)
      p.max = burst and (0.6 + math.random() * 0.5) or (1.2 + math.random() * 1.3)
      p.life = p.max
      local fire = p.x > W / 2
      if math.random() < 0.15 then fire = not fire end
      local s = burst and (8 + math.random() * 10) or (5 + math.random() * 7)
      p.t:SetSize(s, s)
      if fire then
        p.t:SetVertexColor(1, 0.35 + math.random() * 0.45, 0.05, 1)
      else
        p.t:SetVertexColor(0.45 + math.random() * 0.4, 0.88, 1, 1)
      end
      p.t:Show()
    end
  end
end
local function UpdParticles(el)
  for _, p in ipairs(PART) do
    if p.life > 0 then
      p.life = p.life - el
      if p.life <= 0 then
        p.t:Hide()
      else
        p.x = p.x + p.vx * el
        p.y = p.y + p.vy * el
        p.t:ClearAllPoints()
        p.t:SetPoint("CENTER", HUD, "BOTTOMLEFT", p.x, p.y)
        local k = p.life / p.max
        p.t:SetAlpha(min(1, k * 1.4) * 0.85)
      end
    end
  end
end

-- Proc-Anzeige: Text-Pop + doppelter Stern (Frost & Feuer, gegenläufig)
local flashF = CreateFrame("Frame", nil, HUD)
flashF:SetSize(300, 40)
flashF:SetPoint("BOTTOM", HUD, "TOP", 0, 20)
flashF:SetFrameStrata("HIGH")
local flash = FS(flashF, 22)
flash:SetPoint("CENTER")
flashF:SetAlpha(0)
local starA = Tex(flashF, "BACKGROUND", 0, "ADD", STAR); starA:SetPoint("CENTER"); starA:SetVertexColor(FROST[1], FROST[2], FROST[3], 1)
local starB = Tex(flashF, "BACKGROUND", 1, "ADD", STAR); starB:SetPoint("CENTER"); starB:SetVertexColor(FIRE[1], FIRE[2], FIRE[3], 1)

-- Warnung (Bildschirmmitte) mit Banner
local warnF = CreateFrame("Frame", nil, UIParent)
warnF:SetSize(520, 46)
warnF:SetPoint("CENTER", UIParent, "CENTER", 0, 190)
warnF:SetFrameStrata("HIGH")
warnF.bl = Tex(warnF, "BACKGROUND"); warnF.bl:SetPoint("TOPLEFT"); warnF.bl:SetPoint("BOTTOMRIGHT", warnF, "BOTTOM")
warnF.br = Tex(warnF, "BACKGROUND"); warnF.br:SetPoint("TOPLEFT", warnF, "TOP"); warnF.br:SetPoint("BOTTOMRIGHT")
warnF.tl = Tex(warnF, "ARTWORK"); warnF.tl:SetPoint("TOPLEFT"); warnF.tl:SetPoint("TOPRIGHT", warnF, "TOP"); warnF.tl:SetHeight(2)
warnF.tr = Tex(warnF, "ARTWORK"); warnF.tr:SetPoint("TOPLEFT", warnF, "TOP"); warnF.tr:SetPoint("TOPRIGHT"); warnF.tr:SetHeight(2)
warnF.ul = Tex(warnF, "ARTWORK"); warnF.ul:SetPoint("BOTTOMLEFT"); warnF.ul:SetPoint("BOTTOMRIGHT", warnF, "BOTTOM"); warnF.ul:SetHeight(2)
warnF.ur = Tex(warnF, "ARTWORK"); warnF.ur:SetPoint("BOTTOMLEFT", warnF, "BOTTOM"); warnF.ur:SetPoint("BOTTOMRIGHT"); warnF.ur:SetHeight(2)
local warnT = FS(warnF, 26)
warnT:SetPoint("CENTER", 0, 1)
warnF:Hide()

local function WarnStyle(r, g, b)
  if warnF.col == r .. g .. b then return end
  warnF.col = r .. g .. b
  local d = 0.35
  Grad(warnF.bl, "HORIZONTAL", r * d, g * d, b * d, 0, r * d, g * d, b * d, 0.75)
  Grad(warnF.br, "HORIZONTAL", r * d, g * d, b * d, 0.75, r * d, g * d, b * d, 0)
  Grad(warnF.tl, "HORIZONTAL", FROST[1], FROST[2], FROST[3], 0, r, g, b, 1)
  Grad(warnF.tr, "HORIZONTAL", r, g, b, 1, FIRE[1], FIRE[2], FIRE[3], 0)
  Grad(warnF.ul, "HORIZONTAL", FROST[1], FROST[2], FROST[3], 0, r, g, b, 1)
  Grad(warnF.ur, "HORIZONTAL", r, g, b, 1, FIRE[1], FIRE[2], FIRE[3], 0)
  warnT:SetTextColor(r, g, b)
end

local function Relayout()
  if not DB then return end
  local y = -PAD
  local function place(sec, show, h)
    if show then
      sec:ClearAllPoints()
      sec:SetPoint("TOPLEFT", HUD, "TOPLEFT", PAD, y)
      sec:SetPoint("TOPRIGHT", HUD, "TOPRIGHT", -PAD, y)
      sec:SetHeight(h)
      sec:Show()
      y = y - h - GAP
    else
      sec:Hide()
    end
  end
  place(head, true, 13)
  y = y - 3
  place(swingSec, DB.swing and not NOLOG, OHW and 28 or 15)
  ohBar:SetShown(OHW)
  place(totSec, DB.totems and GetTotemInfo ~= nil, TSZ + 6)
  place(rowSec, DB.cds or DB.status, ISZ)
  for i = 1, 3 do
    CI[i]:SetShown(DB.cds and CDL[i] ~= nil)
  end
  STI[1]:SetShown(DB.status)
  STI[2]:SetShown(DB.status and OHW)
  STI[3]:SetShown(DB.status)
  if OHW then
    STI[3]:ClearAllPoints(); STI[3]:SetPoint("RIGHT", -2 * (ISZ + 5), 0)
  else
    STI[3]:ClearAllPoints(); STI[3]:SetPoint("RIGHT", -(ISZ + 5), 0)
  end
  HUD:SetHeight(-y - GAP + PAD)
  HUD:SetScale(DB.scale)
  HUD:EnableMouse(not DB.locked)
  HUD.drag:SetShown(not DB.locked)
end

local function ApplyPos()
  HUD:ClearAllPoints()
  HUD:SetPoint(DB.point or "CENTER", UIParent, DB.point or "CENTER", DB.x or 0, DB.y or -210)
end

---------------------------------------------------------------------------
-- Logik
---------------------------------------------------------------------------
-- Forever/Midnight: im Kampf koennen Werte "geheim" sein -> erst sammeln,
-- nur bei fehlerfreiem Durchlauf uebernehmen (sonst alter Stand bleibt).
local function ScanAurasRaw()
  local N = { shCount = 0, flurry = 0 }
  for i = 1, 40 do
    local name, icon, count, dur, exp = AuraAt(i)
    if not name then break end
    if name == S.LS or (S.WS and name == S.WS) then
      N.shield, N.shIcon, N.shExp, N.shCount = name, icon, exp, count or 0
    elseif name == S.FLUR then
      N.flurry = (count and count > 0) and count or 1
    elseif S.WFT and name == S.WFT then
      N.wftExp, N.wftDur = exp, dur
    end
  end
  return N
end
local function ScanAuras()
  local ok, N = pcall(ScanAurasRaw)
  if not ok or type(N) ~= "table" then return end
  A.shield, A.shIcon, A.shExp, A.shCount = N.shield, N.shIcon, N.shExp, N.shCount
  A.flurry, A.wftExp, A.wftDur = N.flurry, N.wftExp, N.wftDur
end

local function CheckWeapons()
  local had = OHW
  OHW = false
  local link = GetInventoryItemLink("player", 17)
  if link and ItemInstant then
    local _, _, _, loc = ItemInstant(link)
    OHW = (loc == "INVTYPE_WEAPON" or loc == "INVTYPE_WEAPONOFFHAND")
  end
  if had ~= OHW then Relayout() end
end

local function ReadSpeed()
  local m, o = UnitAttackSpeed("player")
  SPD.mh, SPD.oh = m or 0, o or 0
end

local function SwingStart(hand)
  ReadSpeed()
  local d = SPD[hand]
  if d and d > 0 then SW[hand].s, SW[hand].d = GetTime(), d end
end

local function SwingRescale()
  local old = { mh = SPD.mh, oh = SPD.oh }
  ReadSpeed()
  local now = GetTime()
  for hand, st in pairs(SW) do
    local nd = SPD[hand]
    if st.d > 0 and nd and nd > 0 and old[hand] and old[hand] > 0 and nd ~= old[hand] then
      local p = (now - st.s) / st.d
      if p < 1 then st.d = nd; st.s = now - p * nd end
    end
  end
end

local function BuildCDs()
  wipe(CDL)
  for _, id in ipairs(CD_IDS) do
    local n, ic = SpellInfo(id)
    if n and Known(n) then CDL[#CDL + 1] = { name = n, icon = ic } end
  end
  for i = 1, 3 do
    if CDL[i] then CI[i].tex:SetTexture(CDL[i].icon) end
  end
  S.shieldKnown = Known(S.LS) or (S.WS and Known(S.WS)) or false
  costT = 0
  Relayout()
end

-- Kampf ------------------------------------------------------------------
local function FightStart()
  if F.on then return end
  F.on, F.t, F.fl, F.dmg, F.hits, F.crits, F.procs, F.src = true, 0, 0, 0, 0, 0, 0, {}
  F.start = GetTime()
end

local function FightEnd()
  if not F.on then return end
  F.on = false
  local t = GetTime() - F.start
  if t < 1 then return end
  local L = DB.life
  L.fights, L.dmg, L.time = L.fights + 1, L.dmg + F.dmg, L.time + t
  if not DB.summary or t < 6 or F.dmg <= 0 then return end
  local list = {}
  for k, v in pairs(F.src) do list[#list + 1] = { k, v } end
  table.sort(list, function(a, b) return a[2] > b[2] end)
  local top = {}
  for i = 1, min(3, #list) do top[i] = fmt("%s %d%%", list[i][1], floor(list[i][2] / F.dmg * 100 + 0.5)) end
  local crit = F.hits > 0 and floor(F.crits / F.hits * 100 + 0.5) or 0
  local fl = F.t > 0 and floor(F.fl / F.t * 100 + 0.5) or 0
  P(fmt("|cffffffffKampf %s|r · |cff00ff96%s DPS|r · %s Schaden · Krit %d%% · |cff8fe6ffProcs %d|r · Schlaghagel %d%%",
    fmtDur(t), fmtN(F.dmg / t), fmtN(F.dmg), crit, F.procs, fl))
  if #top > 0 then P("|cffaaaaaaTop:|r " .. table.concat(top, " · ")) end
end

local function AddDmg(src, amount, crit)
  if not amount or amount <= 0 then return end
  if not F.on then
    if UnitAffectingCombat("player") then FightStart() else return end
  end
  F.dmg = F.dmg + amount
  F.hits = F.hits + 1
  if crit then F.crits = F.crits + 1 end
  src = src or "?"
  F.src[src] = (F.src[src] or 0) + amount
end

local function OnProc(name, amount)
  SES.procs = SES.procs + 1
  DB.life.procs = DB.life.procs + 1
  if F.on then F.procs = F.procs + 1 end
  if DB.wfFlash then
    flashTxt = GradText(fmt("+%d  %s", amount or 1, name or "Extra-Angriff"))
    flash:SetText(flashTxt)
    flashT = 1.0
    Spawn(10, true)
  end
  if DB.wfSound then pcall(PlaySound, (SOUNDKIT and SOUNDKIT.TELL_MESSAGE) or 3081, "SFX") end
end

local function Announce(spell, target)
  if not DB.announce then return end
  local msg = fmt(">> Unterbrochen: %s (%s) <<", spell or "?", target or "?")
  local ch
  if LE_PARTY_CATEGORY_INSTANCE and IsInGroup and IsInGroup(LE_PARTY_CATEGORY_INSTANCE) then ch = "INSTANCE_CHAT"
  elseif IsInRaid and IsInRaid() then ch = "RAID"
  elseif IsInGroup and IsInGroup() then ch = "PARTY" end
  if ch then SendChatMessage(msg, ch) else P("|cffffd200" .. msg .. "|r") end
end

local function OnCLEU()
  cleuSeen = true
  local _, sub, _, sGUID, _, sFlags, _, _, dName, _, _,
        a1, a2, a3, a4, a5, a6, a7, a8, a9, a10 = CombatLogGetCurrentEventInfo()
  local mine = (sGUID == PGUID)
  local guard = (not mine) and sFlags and band(sFlags, MINE) > 0 and band(sFlags, GUARD) > 0
  if not mine and not guard then return end

  if sub == "SWING_DAMAGE" then
    if mine then
      SwingStart(a10 and "oh" or "mh")
      SES.hits = SES.hits + 1
      DB.life.hits = DB.life.hits + 1
    end
    AddDmg(mine and "Nahkampf" or "Totem", a1, a7)
  elseif sub == "SWING_MISSED" then
    if mine then SwingStart(a2 and "oh" or "mh") end
  elseif sub == "SPELL_DAMAGE" or sub == "SPELL_PERIODIC_DAMAGE" or sub == "RANGE_DAMAGE" then
    AddDmg(a2, a4, a10)
  elseif sub == "SPELL_EXTRA_ATTACKS" and mine then
    OnProc(a2, a4)
  elseif sub == "SPELL_INTERRUPT" and mine then
    Announce(a5, dName)
  end
end

-- Anzeige ----------------------------------------------------------------
local function UpdBar(bar, st, now)
  if st.d > 0 then
    local rem = st.s + st.d - now
    if rem < 0 then rem = 0 end
    local v = 1 - rem / st.d
    bar:SetValue(v)
    bar.r:SetText(rem > 0 and fmt("%.1f", rem) or "")
    local x = v * bar:GetWidth()
    bar.spark:ClearAllPoints()
    bar.spark:SetPoint("CENTER", bar, "LEFT", x, 0)
    bar.spark:SetShown(rem > 0)
    bar.lead:ClearAllPoints()
    bar.lead:SetPoint("RIGHT", bar, "LEFT", x + 4, 0)
    bar.lead:SetShown(rem > 0 and x > 30)
  else
    bar:SetValue(0)
    bar.r:SetText("")
    bar.spark:Hide()
    bar.lead:Hide()
  end
end

local function UpdateSwing(now)
  UpdBar(mhBar, SW.mh, now)
  if A.flurry > 0 then
    SetBarGrad(mhBar, FL_A, FL_B)
    mhBar.l:SetText(fmt("|cffffe066SCHLAGHAGEL %d|r", A.flurry))
  else
    SetBarGrad(mhBar, MH_A, MH_B)
    mhBar.l:SetText(SPD.mh > 0 and fmt("|cffd9f7ffHH|r %.2f", SPD.mh) or "HH")
  end
  if OHW then
    UpdBar(ohBar, SW.oh, now)
    ohBar.l:SetText(SPD.oh > 0 and fmt("|cffffe0b0NH|r %.2f", SPD.oh) or "NH")
  end
end

local function UpdateTotems(now)
  for i = 1, 4 do
    local b = TT[i]
    local have, name, start, dur, icon = GetTotemInfo(i)
    if have and name and name ~= "" and dur and dur > 0 then
      local rem = max(0, start + dur - now)
      b.tex:SetTexture(icon)
      b.tex:SetDesaturated(false)
      b:SetAlpha(1)
      b.cd:SetText(fmtT(rem))
      b.bar:SetValue(rem / dur)
      if rem < 5 then
        local p = 0.5 + 0.5 * sin(now * 10)
        SetBorder(b, 1, 0.15 + 0.3 * p, 0.15, 1)
        GlowSet(b, 0.4 + 0.6 * p, 1, 0.2, 0.1)
        b.cd:SetTextColor(1, 0.3, 0.3)
      else
        SetBorder(b, EL_COL[i][1], EL_COL[i][2], EL_COL[i][3], 0.9)
        GlowSet(b, 0.55, EL_COL[i][1], EL_COL[i][2], EL_COL[i][3])
        b.cd:SetTextColor(1, 1, 1)
      end
    else
      b.tex:SetTexture(EL_ICON[i])
      b.tex:SetDesaturated(true)
      b:SetAlpha(0.35)
      b.cd:SetText("")
      b.bar:SetValue(0)
      GlowSet(b, 0)
      SetBorder(b, EL_COL[i][1], EL_COL[i][2], EL_COL[i][3], 0.5)
    end
  end
end

local function UpdateCDs(now)
  for i = 1, 3 do
    local c, b = CDL[i], CI[i]
    if c and b:IsShown() then
      local s, d = SpellCD(c.name)
      local rem = (s and d and d > 1.6) and (s + d - now) or 0
      if rem > 0 then
        b.tex:SetDesaturated(true)
        b.tex:SetVertexColor(0.6, 0.6, 0.6)
        b.cd:SetText(fmtT(rem))
        SetBorder(b, 0.15, 0.17, 0.22, 1)
        GlowSet(b, 0)
      else
        b.tex:SetDesaturated(false)
        b.tex:SetVertexColor(1, 1, 1)
        b.cd:SetText("")
        if inCombat then
          local p = 0.6 + 0.4 * sin(now * 6)
          SetBorder(b, 0.2 * p, 0.85 * p + 0.15, 1, 1)
          GlowSet(b, 0.35 + 0.65 * p)
        else
          SetBorder(b, C_ACC[1], C_ACC[2], C_ACC[3], 0.6)
          GlowSet(b, 0.25)
        end
      end
    end
  end
end

local function EnchIcon(b, slot, has, expMs)
  local tex = GetInventoryItemTexture("player", slot)
  b.tex:SetTexture(tex or "Interface\\Icons\\INV_Misc_QuestionMark")
  if has then
    local rem = (expMs or 0) / 1000
    b.tex:SetDesaturated(false)
    b:SetAlpha(1)
    b.cd:SetText(fmtT(rem))
    if rem < 60 then SetBorder(b, 1, 0.8, 0.1, 1); GlowSet(b, 0.7, 1, 0.75, 0.1)
    else SetBorder(b, FIRE[1], FIRE[2], FIRE[3], 0.8); GlowSet(b, 0.3, FIRE[1], FIRE[2], FIRE[3]) end
  else
    b.tex:SetDesaturated(true)
    b:SetAlpha(tex and 0.8 or 0.3)
    b.cd:SetText(tex and "|cffff4040!|r" or "")
    SetBorder(b, 1, 0.2, 0.2, tex and 1 or 0.4)
    GlowSet(b, tex and 0.8 or 0, 1, 0.1, 0.05)
  end
end

local function UpdateStatus(now, hasMH, mhExp, hasOH, ohExp)
  local sh = STI[1]
  if A.shield then
    sh.tex:SetTexture(A.shIcon)
    sh.tex:SetDesaturated(false)
    sh:SetAlpha(1)
    sh.cnt:SetText((A.shCount or 0) > 0 and A.shCount or "")
    sh.cd:SetText((A.shExp and A.shExp > 0) and fmtT(max(0, A.shExp - now)) or "")
    SetBorder(sh, FROST[1], FROST[2], FROST[3], 0.9)
    GlowSet(sh, 0.45, FROST[1], FROST[2], FROST[3])
  else
    sh.tex:SetTexture(S.LSi or "Interface\\Icons\\Spell_Nature_LightningShield")
    sh.tex:SetDesaturated(true)
    sh:SetAlpha(S.shieldKnown and 0.8 or 0.3)
    sh.cnt:SetText("")
    sh.cd:SetText(S.shieldKnown and "|cffff4040!|r" or "")
    SetBorder(sh, 1, 0.2, 0.2, S.shieldKnown and 1 or 0.4)
    GlowSet(sh, S.shieldKnown and 0.8 or 0, 1, 0.1, 0.05)
  end
  EnchIcon(STI[3], 16, hasMH, mhExp)
  if OHW then EnchIcon(STI[2], 17, hasOH, ohExp) end
end

local function UpdateHead(now)
  local mana, mmax = UnitPower("player", 0), UnitPowerMax("player", 0)
  if now > costT then
    costT = now + 3
    costES = nil
    local gpc = GetSpellPowerCost or (C_Spell and C_Spell.GetSpellPowerCost)
    if gpc and S.ES and Known(S.ES) then
      local ok, t = pcall(gpc, S.ES)
      if ok and type(t) == "table" then
        for _, c in ipairs(t) do if c.type == 0 and (c.cost or 0) > 0 then costES = c.cost end end
      end
    end
  end
  local pct = mmax > 0 and floor(mana / mmax * 100 + 0.5) or 0
  local col = pct < 20 and "ff5050" or (pct < 45 and "ffd24d" or "6fdcff")
  local txt = fmt("|cff%sMana %d%%|r", col, pct)
  if costES then txt = txt .. fmt(" |cff888888·|r %d Schocks", floor(mana / costES)) end
  head.l:SetText(txt)
  local rate = SES.hits > 0 and (SES.procs / SES.hits * 100) or 0
  if NOLOG then
    head.r:SetText(A.flurry > 0 and fmt("|cffffe066SCHLAGHAGEL %d|r", A.flurry) or "|cff666666Schlaghagel –|r")
  else
    head.r:SetText(fmt("|cffff8a3dPROCS %d|r |cff888888%.0f%%|r", SES.procs, rate))
  end
end

local function UpdateTwist(now)
  if DB.twist and A.wftExp and A.wftExp > now then
    local dur = (A.wftDur and A.wftDur > 0) and A.wftDur or 10
    local rem = A.wftExp - now
    twist:SetValue(rem / dur)
    twist.l:SetText("Windzorn-Totem-Buff")
    twist.r:SetText(fmt("%.1f", rem))
    if rem < 3 then SetBarGrad(twist, OH_A, FIRE) else SetBarGrad(twist, MH_A, MH_B) end
    twist.spark:Hide()
    twist:Show()
  else
    twist:Hide()
  end
end

local function Warning(hasMH, mhExp, hasOH)
  if not DB.warn or UnitIsDeadOrGhost("player") or UnitOnTaxi("player") then return end
  if not inCombat and IsResting() then return end
  if GetInventoryItemLink("player", 16) and not hasMH then return "WAFFE VERZAUBERN!", 1, 0.25, 0.25 end
  if OHW and not hasOH then return "NEBENHAND VERZAUBERN!", 1, 0.25, 0.25 end
  if S.shieldKnown and not A.shield then return "SCHILD FEHLT!", 0.35, 0.85, 1 end
  if inCombat and GetTotemInfo and IsInGroup and IsInGroup() then
    local any = false
    for i = 1, 4 do local h, n = GetTotemInfo(i); if h and n and n ~= "" then any = true; break end end
    if not any then return "TOTEMS SETZEN!", 1, 0.6, 0.15 end
  end
  if not inCombat and hasMH and mhExp and mhExp < 60000 then return "Waffenbuff läuft ab", 1, 0.85, 0.2 end
end

local function UpdateSlow(now)
  -- Kein Kampflog nach 6 s Kampf -> Forever-Modus (Swing/Procs ausblenden)
  if inCombat and not cleuSeen and not NOLOG and now - combatStart > 6 then
    NOLOG = true; Relayout()
  end
  local okE, hasMH, mhExp, _, _, hasOH, ohExp = pcall(GetWeaponEnchantInfo)
  if not okE then hasMH, mhExp, hasOH, ohExp = true, nil, true, nil end
  pcall(UpdateHead, now)
  if DB.totems and GetTotemInfo then pcall(UpdateTotems, now) end
  if DB.cds then pcall(UpdateCDs, now) end
  if DB.status then pcall(UpdateStatus, now, hasMH, mhExp, hasOH, ohExp) end
  pcall(UpdateTwist, now)
  HUD:SetAlpha((DB.oocFade and not inCombat and DB.locked) and 0.55 or 1)
  local okW, w, r, g, b = pcall(Warning, hasMH, mhExp, hasOH)
  if not okW then w = nil end
  if w and not warnF.test then
    warnT:SetText(w); WarnStyle(r, g, b); warnF:Show()
  elseif not warnF.test then
    warnF:Hide()
  end
end

---------------------------------------------------------------------------
-- Takt
---------------------------------------------------------------------------
local EV = CreateFrame("Frame")
local acc = 0
EV:SetScript("OnUpdate", function(_, el)
  if not DB or not HUD:IsShown() then return end
  local now = GetTime()
  if F.on then
    F.t = F.t + el
    if A.flurry > 0 then F.fl = F.fl + el end
  end
  if DB.swing and not NOLOG then pcall(UpdateSwing, now) end
  -- Proc-Pop
  if flashT > 0 then
    flashT = flashT - el
    local k = max(0, flashT)
    local pop = 1 - k
    flashF:SetAlpha(min(1, k * 1.8))
    flashF:SetScale(max(0.01, 1 + 0.35 * k * k))
    local s1, s2 = 40 + 170 * pop, 30 + 130 * pop
    starA:SetSize(s1, s1); starB:SetSize(s2, s2)
    starA:SetAlpha(k * 0.9); starB:SetAlpha(k)
    if starA.SetRotation then starA:SetRotation(now * 2.5); starB:SetRotation(-now * 3.2) end
    for _, g in ipairs(HUD.glows) do g:SetAlpha(1 + 1.5 * k) end
  else
    -- ruhiges Atmen des Aussenglühens (im Kampf kraeftiger)
    local base = inCombat and 0.85 or 0.55
    local a = base + 0.25 * sin(now * 1.8)
    for _, g in ipairs(HUD.glows) do g:SetAlpha(a) end
  end
  -- Lichtlauf ueber die Oberkante (alle 4 s), Farbe Frost -> Feuer
  local ph = (now % 4) / 1.4
  if ph < 1 then
    HUD.shine:ClearAllPoints()
    HUD.shine:SetPoint("CENTER", HUD, "TOPLEFT", ph * W, -1)
    HUD.shine:SetVertexColor(FROST[1] + (FIRE[1] - FROST[1]) * ph, FROST[2] + (FIRE[2] - FROST[2]) * ph, FROST[3] + (FIRE[3] - FROST[3]) * ph, 1)
    HUD.shine:SetAlpha(sin(ph * math.pi))
  else
    HUD.shine:SetAlpha(0)
  end
  -- Funken
  local rate = inCombat and 9 or 2.5
  if math.random() < rate * el then Spawn(1) end
  UpdParticles(el)
  if warnF:IsShown() then
    local p = 0.5 + 0.5 * sin(now * 5)
    warnT:SetAlpha(0.65 + 0.35 * p)
    warnF:SetScale(1 + 0.03 * p)
  end
  acc = acc + el
  if acc >= 0.1 then acc = 0; UpdateSlow(now) end
end)

---------------------------------------------------------------------------
-- Einstellungsfenster (/enh)
---------------------------------------------------------------------------
local CFG
local OPTS = {
  { "swing",    "Swing-Timer (Haupt- & Nebenhand)" },
  { "totems",   "Totem-Leiste mit Restzeit" },
  { "cds",      "Abklingzeiten (Sturmschlag, Schocks, Wut)" },
  { "status",   "Schild-Aufladungen & Waffenbuffs" },
  { "warn",     "Warnungen in der Bildschirmmitte" },
  { "wfFlash",  "Windzorn-/Extra-Angriff-Anzeige" },
  { "wfSound",  "Ton bei Windzorn-Proc" },
  { "twist",    "Twist-Leiste Windzorn-Totem (TBC)" },
  { "announce", "Unterbrechungen in der Gruppe ansagen" },
  { "summary",  "Kampf-Auswertung im Chat" },
  { "oocFade",  "Außerhalb des Kampfes abdunkeln" },
}

local function Btn(p, txt, w, fn)
  local b = CreateFrame("Button", nil, p, "UIPanelButtonTemplate")
  b:SetSize(w, 22)
  b:SetText(txt)
  b:SetScript("OnClick", fn)
  return b
end

local function TestMode()
  HUD:Show()
  OnProc("Waffe des Windzorns (Test)", 1)
  warnF.test = true
  warnT:SetText("TEST – WARNUNGEN ERSCHEINEN HIER"); WarnStyle(1, 0.55, 0.15); warnF:Show()
  C_Timer.After(3, function() warnF.test = nil end)
end

local function BuildCfg()
  CFG = CreateFrame("Frame", "EnhanceHUDConfig", UIParent, BT)
  CFG:SetSize(320, 112 + #OPTS * 24)
  CFG:SetPoint("CENTER")
  CFG:SetFrameStrata("DIALOG")
  CFG:SetMovable(true); CFG:EnableMouse(true); CFG:RegisterForDrag("LeftButton")
  CFG:SetScript("OnDragStart", CFG.StartMoving)
  CFG:SetScript("OnDragStop", CFG.StopMovingOrSizing)
  Skin(CFG, 0.96, 0, 0, 0, 0)
  FFFrame(CFG, 2, 14)
  tinsert(UISpecialFrames, "EnhanceHUDConfig")

  local t = FS(CFG, 15); t:SetPoint("TOPLEFT", 12, -10)
  t:SetText(GradText("EnhanceHUD") .. " |cff888888" .. VERSION .. " · Frost & Feuer|r")
  local x = CreateFrame("Button", nil, CFG, "UIPanelCloseButton")
  x:SetPoint("TOPRIGHT", 2, 2)

  CFG.cb = {}
  for i, o in ipairs(OPTS) do
    local c = CreateFrame("CheckButton", nil, CFG, "UICheckButtonTemplate")
    c:SetSize(24, 24)
    c:SetPoint("TOPLEFT", 10, -32 - (i - 1) * 24)
    local l = FS(c, 12); l:SetPoint("LEFT", c, "RIGHT", 4, 1); l:SetText(o[2])
    c:SetScript("OnClick", function(self) DB[o[1]] = self:GetChecked() and true or false; Relayout() end)
    c.key = o[1]
    CFG.cb[i] = c
  end

  local by = -40 - #OPTS * 24
  CFG.lock = Btn(CFG, "", 96, function()
    DB.locked = not DB.locked; Relayout(); CFG.lock:SetText(DB.locked and "Entsperren" or "Sperren")
  end)
  CFG.lock:SetPoint("TOPLEFT", 12, by)
  Btn(CFG, "Größe −", 70, function() DB.scale = max(0.6, DB.scale - 0.1); Relayout() end):SetPoint("LEFT", CFG.lock, "RIGHT", 6, 0)
  Btn(CFG, "Größe +", 70, function() DB.scale = min(2.0, DB.scale + 0.1); Relayout() end):SetPoint("LEFT", CFG.lock, "RIGHT", 82, 0)
  local r = Btn(CFG, "Position zurück", 118, function()
    DB.point, DB.x, DB.y, DB.scale = "CENTER", 0, -210, 1; ApplyPos(); Relayout()
  end)
  r:SetPoint("TOPLEFT", 12, by - 28)
  Btn(CFG, "Test", 60, TestMode):SetPoint("LEFT", r, "RIGHT", 6, 0)
  Btn(CFG, "Statistik", 90, function() SlashCmdList.ENHANCEHUD("stats") end):SetPoint("LEFT", r, "RIGHT", 72, 0)
end

local function OpenCfg()
  if not CFG then BuildCfg() end
  for _, c in ipairs(CFG.cb) do c:SetChecked(DB[c.key]) end
  CFG.lock:SetText(DB.locked and "Entsperren" or "Sperren")
  CFG:Show()
end

---------------------------------------------------------------------------
-- Slash-Befehle
---------------------------------------------------------------------------
SLASH_ENHANCEHUD1 = "/enh"
SLASH_ENHANCEHUD2 = "/enhancehud"
SlashCmdList.ENHANCEHUD = function(msg)
  if not DB then return end
  local cmd, arg = (msg or ""):lower():match("^%s*(%S*)%s*(.-)%s*$")
  if cmd == "" or cmd == "config" or cmd == "optionen" then
    OpenCfg()
  elseif cmd == "lock" or cmd == "sperren" then
    DB.locked = true; Relayout(); P("gesperrt.")
  elseif cmd == "unlock" or cmd == "entsperren" then
    DB.locked = false; Relayout(); P("entsperrt – HUD mit Linksklick ziehen.")
  elseif cmd == "scale" or cmd == "größe" then
    local v = tonumber(arg)
    if v then DB.scale = max(0.6, min(2, v)); Relayout(); P("Größe " .. DB.scale) else P("z. B. /enh scale 1.2") end
  elseif cmd == "reset" then
    DB.point, DB.x, DB.y, DB.scale = "CENTER", 0, -210, 1; ApplyPos(); Relayout(); P("Position zurückgesetzt.")
  elseif cmd == "test" then
    TestMode()
  elseif cmd == "hide" then
    HUD:Hide(); warnF:Hide(); P("ausgeblendet – /enh show")
  elseif cmd == "show" then
    HUD:Show(); P("eingeblendet.")
  elseif cmd == "stats" then
    local L = DB.life
    local rate = L.hits > 0 and L.procs / L.hits * 100 or 0
    P(fmt("Gesamt: %d Kämpfe · %s Schaden · Ø %s DPS · %d Procs auf %d Treffer (%.1f%%)",
      L.fights, fmtN(L.dmg), fmtN(L.time > 0 and L.dmg / L.time or 0), L.procs, L.hits, rate))
    P(fmt("Sitzung: %d Procs auf %d Treffer", SES.procs, SES.hits))
  elseif cmd == "statsreset" then
    DB.life = { hits = 0, procs = 0, fights = 0, dmg = 0, time = 0 }
    SES.hits, SES.procs = 0, 0
    P("Statistik zurückgesetzt.")
  else
    P("Befehle: |cffffffff/enh|r (Optionen) · lock · unlock · scale 1.2 · reset · test · stats · statsreset · hide · show")
  end
end

---------------------------------------------------------------------------
-- Ereignisse
---------------------------------------------------------------------------
EV:RegisterEvent("PLAYER_LOGIN")
EV:SetScript("OnEvent", function(_, ev, a1)
  if ev == "PLAYER_LOGIN" then
    local _, class = UnitClass("player")
    if class ~= "SHAMAN" then return end
    EnhanceHUDDB = EnhanceHUDDB or {}
    DB = EnhanceHUDDB
    Merge(DB, DEFAULTS)
    PGUID = UnitGUID("player")
    InitSpells(); ScanBook(); CheckWeapons(); ReadSpeed(); ScanAuras(); BuildCDs()
    ApplyPos(); Relayout(); HUD:Show()
    for _, e in ipairs({ "COMBAT_LOG_EVENT_UNFILTERED", "PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED",
      "UNIT_AURA", "UNIT_ATTACK_SPEED", "PLAYER_EQUIPMENT_CHANGED", "SPELLS_CHANGED", "PLAYER_TOTEM_UPDATE",
      "PLAYER_ENTERING_WORLD" }) do
      local ok = pcall(EV.RegisterEvent, EV, e)
      if e == "COMBAT_LOG_EVENT_UNFILTERED" and (not ok or not CombatLogGetCurrentEventInfo) then NOLOG = true end
    end
    Relayout()
    P("geladen – |cffffffff/enh|r öffnet die Optionen. " .. (DB.locked and "" or "Linksklick-Ziehen verschiebt das HUD."))
  elseif ev == "COMBAT_LOG_EVENT_UNFILTERED" then
    pcall(OnCLEU)
  elseif ev == "UNIT_AURA" then
    if a1 == "player" then ScanAuras() end
  elseif ev == "UNIT_ATTACK_SPEED" then
    if a1 == "player" then SwingRescale() end
  elseif ev == "PLAYER_REGEN_DISABLED" then
    inCombat = true; combatStart = GetTime(); FightStart()
  elseif ev == "PLAYER_REGEN_ENABLED" then
    inCombat = false; FightEnd()
  elseif ev == "PLAYER_EQUIPMENT_CHANGED" then
    CheckWeapons(); ReadSpeed()
  elseif ev == "SPELLS_CHANGED" then
    ScanBook(); BuildCDs()
  elseif ev == "PLAYER_ENTERING_WORLD" then
    inCombat = UnitAffectingCombat("player") and true or false
    PGUID = UnitGUID("player"); CheckWeapons(); ScanAuras()
    C_Timer.After(2, CheckWeapons) -- Item-Cache nach Ladebildschirm
  end
end)
