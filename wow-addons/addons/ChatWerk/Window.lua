-- ChatWerk: EIN grosses Chatfenster mit Reitern oben. Jeder Reiter ist ein eigener "Chat" (Name + Auswahl, was er
-- zeigt, in den Einstellungen). Glas-Flaeche, an Reiterleiste ziehen = verschieben, Ecke ziehen = Groesse,
-- Mausrad-Blaettern, anklickbare Links, "nach unten"-Knopf, Ungelesen-Zaehler auf inaktiven Reitern.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local MEDIA = ns.MEDIA

ns.Windows = {}         -- Reiter-ID -> Reiter-Objekt (eigene Nachrichtenflaeche)
local MIN_W, MIN_H, MAX_W, MAX_H = 260, 100, 1600, 1000
local HEAD = 30         -- Hoehe der Reiterleiste
local TAB_H = 22
local Main = { tabs = {}, buttons = {}, hover = false }
ns.Main = Main

-- Chat-Schrift: "tech" (Rajdhani, 2045-Look, etwas groesser gesetzt), "poppins", "spiel"
local function fontFile()
  if ns.DB.font == "spiel" then return STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", 1 end
  if ns.DB.font == "poppins" then return MEDIA .. "Fonts\\Poppins-Regular.ttf", 1 end
  return MEDIA .. "Fonts\\Rajdhani-SemiBold.ttf", 1.15
end
ns.ChatFont = fontFile
local function FD() return ns.DB.frame end

----------------------------------------------------------------------------
-- Reiter (Nachrichten)
----------------------------------------------------------------------------
local Tab = {}
Tab.__index = Tab

function Tab:IsActive() return ns.DB.active == self.data.id end

-- Text hinzufuegen. secret = Text ist geheim (Chat-Lockdown): nur durchreichen, nie anfassen.
function Tab:Add(line, r, g, b, secret)
  local m = self.msg
  local ok = pcall(m.AddMessage, m, line, r or 1, g or 1, b or 1)
  if not ok and not secret then pcall(m.AddMessage, m, (tostring(line):gsub("|", "||")), r or 1, g or 1, b or 1) end
  if self:IsActive() then
    if m.AtBottom and not m:AtBottom() then Main.down:Show() end
  else
    self.unread = (self.unread or 0) + 1
    Main:Badge(self)
  end
end

local function onHyperlink(self, link, text, button)
  if type(link) ~= "string" then return end
  local url = link:match("^cwurl:(.*)$")
  if url then
    if ns.Config and ns.Config.Copy then ns.Config.Copy("Link kopieren", url) end
    return
  end
  if SetItemRef then SetItemRef(link, text, button, DEFAULT_CHAT_FRAME) end
end

local function onHyperlinkEnter(self, link)
  if type(link) ~= "string" then return end
  local kind = link:match("^(%a+):")
  if kind == "item" or kind == "spell" or kind == "achievement" or kind == "quest" or kind == "currency"
    or kind == "enchant" or kind == "talent" then
    GameTooltip:SetOwner(self, "ANCHOR_CURSOR")
    if GameTooltip.SetHyperlink then pcall(GameTooltip.SetHyperlink, GameTooltip, link) end
    GameTooltip:Show()
  end
end

local function newTab(data)
  local t = setmetatable({ data = data, unread = 0 }, Tab)
  t.frame = Main.frame
  local m = CreateFrame("ScrollingMessageFrame", nil, Main.frame)
  t.msg = m
  m:SetPoint("TOPLEFT", 12, -HEAD - 4)
  m:SetPoint("BOTTOMRIGHT", -12, 9)
  m:SetJustifyH("LEFT")
  m:SetIndentedWordWrap(true)
  m:SetMaxLines(ns.DB.maxLines or 600)
  m:SetInsertMode(SCROLLING_MESSAGE_FRAME_INSERT_MODE_BOTTOM or 2)
  m:SetHyperlinksEnabled(true)
  m:EnableMouse(true)
  m:EnableMouseWheel(true)
  m:SetScript("OnHyperlinkClick", function(self, link, text, button) ns.Safe(onHyperlink, self, link, text, button) end)
  m:SetScript("OnHyperlinkEnter", function(self, link) ns.Safe(onHyperlinkEnter, self, link) end)
  m:SetScript("OnHyperlinkLeave", function() GameTooltip:Hide() end)
  m:SetScript("OnMouseWheel", function(self, delta)
    if (FD().fade or 0) > 0 then pcall(self.ResetAllFadeTimes, self) end -- beim Blaettern alte Zeilen wieder zeigen
    if IsControlKeyDown and IsControlKeyDown() then
      if delta > 0 then self:ScrollToTop() else self:ScrollToBottom() end
    elseif IsShiftKeyDown and IsShiftKeyDown() then
      if delta > 0 then self:PageUp() else self:PageDown() end
    else
      self:ScrollByAmount(delta * (ns.DB.wheelLines or 3))
    end
    Main.down:SetShown(not self:AtBottom())
  end)
  if m.SetOnScrollChangedCallback then
    m:SetOnScrollChangedCallback(function() if t:IsActive() and m:AtBottom() then Main.down:Hide() end end)
  end
  -- Verlauf zurueckholen
  local h = ns.DB.history and ns.CDB.hist[data.id]
  if h and #h > 0 then
    for _, e in ipairs(h) do pcall(m.AddMessage, m, e[1], e[2], e[3], e[4]) end
    pcall(m.AddMessage, m, "|cff4d5a57- - - - - - - -  Verlauf  - - - - - - - -|r", 1, 1, 1)
  end
  ns.Windows[data.id] = t
  return t
end

function Tab:Style()
  local m, d = self.msg, FD()
  local file, k = fontFile()
  local size = math.floor(ns.Clamp(d.font or 13, 9, 24) * k + 0.5)
  local ok = pcall(m.SetFont, m, file, size, "")
  if not ok then pcall(m.SetFont, m, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", size, "") end
  m:SetShadowColor(0, 0, 0, 0.85)
  m:SetShadowOffset(1, -1)
  m:SetSpacing(ns.DB.spacing or 2)
  local fade = (d.fade or 0) > 0
  m:SetFading(fade)
  if fade then m:SetTimeVisible(d.fade) m:SetFadeDuration(2) end
end

----------------------------------------------------------------------------
-- Reiter-Knoepfe oben (Glas-Pillen, aktiver Reiter im Neon-Verlauf, Zaehler fuer Ungelesenes)
----------------------------------------------------------------------------
local function theme() return ns.Theme() end

local function paintTab(b)
  local t = theme()
  local on = ns.DB.active == b.id
  local hover = b:IsMouseOver()
  local show = Main.hover or ns.DB.alwaysHeader
  if on then
    b.edge:SetGradientV({ 1, 1, 1, 0.65 }, { 1, 1, 1, 0.12 })
    b.bg:SetGradient({ t[1], t[2], t[3] }, 1)
    b.gloss:SetAlpha(1)
    b.glow:SetVertexColor(t[1][1], t[1][2], t[1][3], 1)
    b.glow:SetAlpha(show and 0.32 or 0.18)
    b.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
    b:SetAlpha(1)
  else
    local g = hover and UI.GLASS.pillHi or UI.GLASS.pill
    b.edge:SetGradient({ t[1], t[2], t[3] }, hover and 0.6 or 0.22)
    b.bg:SetGradientV(g[1], g[2], hover and 0.95 or 0.75)
    b.gloss:SetAlpha(0.35)
    b.glow:SetAlpha(0)
    local c = hover and C.text or C.muted
    b.text:SetTextColor(c[1], c[2], c[3], 1)
    b:SetAlpha((show or (b.unread or 0) > 0) and 1 or 0.6)
  end
end

local function tabButton(i)
  local b = Main.tabs[i]
  if b then return b end
  b = UI.SafeButton(Main.head)
  b:SetHeight(TAB_H)
  b:RegisterForClicks("LeftButtonUp", "RightButtonUp")
  b:RegisterForDrag("LeftButton")
  b.glow = UI.Glow(b, C.amber, 90, 0, "BACKGROUND")
  b.glow:SetPoint("CENTER", 0, -2)
  local shape = UI.PillShape(b, TAB_H, 1, true)
  b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
  b.text = UI.Text(b, 12, "bold", C.text)
  b.text:SetWordWrap(false)
  -- Zaehler: kleine Neon-Pille mit dunkler Zahl
  local bd = CreateFrame("Frame", nil, b)
  bd:SetHeight(16)
  local s = UI.PillShape(bd, 16, 3, false)
  s.edge:SetGradientV({ 1, 1, 1, 0.6 }, { 1, 1, 1, 0.1 })
  s.body:SetGradient(UI.GRAD, 1)
  bd.body = s.body
  bd.text = UI.Text(bd, 12, "bold", C.dark)
  bd.text:SetPoint("CENTER", 0, 0)
  function bd:Set(t)
    self.text:SetText(t)
    self:SetWidth(math.max(16, math.ceil(self.text:GetStringWidth()) + 10))
  end
  bd:Hide()
  b.badge = bd
  b:SetScript("OnClick", function(self, button)
    UI.PlayClick()
    if button == "RightButton" then
      if ns.Config then ns.Config.Open(self.id) end
    else
      Main:Select(self.id)
    end
  end)
  b:SetScript("OnDragStart", function() if not FD().locked then Main.frame:StartMoving() end end)
  b:SetScript("OnDragStop", function() Main:StopMove() end)
  b:SetScript("OnEnter", function(self)
    paintTab(self)
    if GameTooltip then
      GameTooltip:SetOwner(self, "ANCHOR_TOP")
      local d = ns.WindowById(self.id)
      GameTooltip:SetText(d and d.name or "Chat", 1, 1, 1)
      GameTooltip:AddLine("Linksklick: anzeigen · Rechtsklick: einstellen, was hier steht · ziehen: Fenster verschieben", 0.75, 0.8, 0.78, true)
      GameTooltip:Show()
    end
  end)
  b:SetScript("OnLeave", function(self) paintTab(self) if GameTooltip then GameTooltip:Hide() end end)
  Main.tabs[i] = b
  return b
end

function Main:Badge(t)
  for _, b in ipairs(self.tabs) do
    if b.id == t.data.id and b:IsShown() then
      local n = t.unread or 0
      b.unread = n
      if n > 0 then
        b.badge:Set(n > 99 and "99+" or tostring(n))
        b.badge:Show()
      else
        b.badge:Hide()
      end
      paintTab(b)
      self:LayoutTabs()
      return
    end
  end
end

-- Reiter nebeneinander; reicht der Platz nicht, werden alle gleich schmal und die Namen gekuerzt
function Main:LayoutTabs()
  local list = ns.DB.windows
  local avail = self.frame:GetWidth() - 28 - (#self.buttons * 24 + 8) - 28
  local gap = 4
  local wants, total = {}, 0
  for i, d in ipairs(list) do
    local b = tabButton(i)
    b.id, b.name = d.id, UI.Upper(d.name or "Chat")
    b.text:SetText(b.name)
    local bw = b.badge:IsShown() and (b.badge:GetWidth() + 4) or 0
    wants[i] = math.ceil(b.text:GetUnboundedStringWidth()) + 26 + bw
    total = total + wants[i] + gap
  end
  local cap = (total > avail and #list > 0) and math.max(math.floor((avail - gap * #list) / #list), 40) or nil
  local x = 26
  for i = 1, #list do
    local b = self.tabs[i]
    local bw = b.badge:IsShown() and (b.badge:GetWidth() + 4) or 0
    local w = cap and math.min(wants[i], cap) or wants[i]
    b:SetWidth(w)
    UI.FitText(b.text, b.name, w - 22 - bw)
    if b.text:GetUnboundedStringWidth() > w - 22 - bw then
      -- ein langes Wort: hart kuerzen
      local s = b.name
      while #s > 1 and b.text:GetUnboundedStringWidth() > w - 22 - bw do s = s:sub(1, -2) b.text:SetText(s .. "..") end
    end
    b.text:ClearAllPoints()
    b.text:SetPoint("LEFT", b, "LEFT", 11, 0)
    b.text:SetPoint("RIGHT", b, "RIGHT", -11 - bw, 0)
    b.badge:ClearAllPoints()
    b.badge:SetPoint("RIGHT", b, "RIGHT", -4, 0)
    b:ClearAllPoints()
    b:SetPoint("LEFT", self.head, "LEFT", x, 0)
    b:Show()
    paintTab(b)
    if b.id == ns.DB.active then
      -- Neon-Unterstrich + Lichtpunkt unter dem aktiven Reiter
      self.under:ClearAllPoints()
      self.under:SetPoint("TOPLEFT", b, "BOTTOMLEFT", 10, -3)
      self.under:SetPoint("TOPRIGHT", b, "BOTTOMRIGHT", -10, -3)
      self.underGlow:ClearAllPoints()
      self.underGlow:SetPoint("CENTER", self.under, "CENTER", 0, 0)
      self.underGlow:SetWidth(w + 30)
    end
    x = x + w + gap
  end
  for i = #list + 1, #self.tabs do self.tabs[i]:Hide() end
  self.add:ClearAllPoints()
  self.add:SetPoint("LEFT", self.head, "LEFT", x + 2, 0)
end

function Main:Select(id)
  if not ns.WindowById(id) then id = ns.DB.windows[1] and ns.DB.windows[1].id end
  ns.DB.active = id
  for tid, t in pairs(ns.Windows) do
    local on = tid == id
    t.msg:SetShown(on)
    if on then
      t.unread = 0
      self.down:SetShown(not t.msg:AtBottom())
    end
  end
  for _, b in ipairs(self.tabs) do
    if b.id == id then b.unread = 0 b.badge:Hide() end
    if b:IsShown() then paintTab(b) end
  end
  self:LayoutTabs()
end

function Main:Active() return ns.Windows[ns.DB.active] end

function Main:Save()
  local f, d = self.frame, FD()
  local s = f:GetEffectiveScale() / UIParent:GetEffectiveScale()
  local l, b = f:GetLeft(), f:GetBottom()
  if l and b then d.x, d.y = math.floor(l * s + 0.5), math.floor(b * s + 0.5) end
  d.w, d.h = math.floor(f:GetWidth() + 0.5), math.floor(f:GetHeight() + 0.5)
end

function Main:Place()
  local f, d = self.frame, FD()
  f:ClearAllPoints()
  f:SetPoint("BOTTOMLEFT", UIParent, "BOTTOMLEFT", d.x or 16, d.y or 40)
  f:SetSize(ns.Clamp(d.w or 520, MIN_W, MAX_W), ns.Clamp(d.h or 230, MIN_H, MAX_H))
end

-- WoW-Kacheltexturen wiederholen statt strecken

-- Bild mit Motiv (cover = Seitenverhaeltnis Breite/Hoehe): fuellt die Flaeche ohne Verzerren, Motiv bleibt in der Mitte
local function coverCoords(tex, ratio, w, h)
  local fr = w / h
  if fr >= ratio then
    local span = ratio / fr
    tex:SetTexCoord(0, 1, 0, span) -- oben bleibt (Kopf des Motivs), unten wird abgeschnitten
  else
    local span = fr / ratio
    local u0 = (1 - span) / 2
    tex:SetTexCoord(u0, u0 + span, 0, 1)
  end
end

function Main:TileBg()
  local b = self.bgDef
  if not b or not (b.tile or b.cover) then return end
  local w, h = self.frame:GetWidth() or 0, self.frame:GetHeight() or 0
  if w <= 0 or h <= 0 then return end
  if b.cover then coverCoords(self.bg, b.cover, w, h) else self.bg:SetTexCoord(0, w / b.tile, 0, h / b.tile) end
end

function Main:StopMove()
  self.frame:StopMovingOrSizing()
  self:Save()
  self:Place()
  self:LayoutTabs()
end

-- Aussehen + Verhalten aus den Einstellungen uebernehmen
function Main:Apply()
  local d = FD()
  self:Place()
  local a = ns.Clamp(d.alpha or 0.62, 0, 1)
  local t = theme()
  self.glass.opts.edgeStops = t
  self.glass:SetBody({ 0.028, 0.040, 0.046, 0.96 }, { 0.055, 0.070, 0.078, 0.96 }, a)
  self.glass:SetShown(a > 0.01)
  self.glass:SetEdge("neon", 0.18 + a * 0.45)
  self.hud.flow.alpha = 0.18 + a * 0.45
  self.hud.flow.colors = { t[1], t[2], t[3], t[2] }
  local b = ns.BG[d.bg] or ns.BG.glas
  self.bgDef = b
  if b.file then
    if b.tile then self.bg:SetTexture(b.file, "REPEAT", "REPEAT") else self.bg:SetTexture(b.file) self.bg:SetTexCoord(0, 1, 0, 1) end
    self.bg:SetVertexColor(1, 1, 1, ns.Clamp(d.bgAlpha or 0.55, 0, 1))
    self.bg:Show()
    self:TileBg()
  else
    self.bg:Hide()
  end
  if self.hud.grid then self.hud.grid:SetShown(a > 0.05 and not b.file) end
  local cols = { t[1], t[3], t[2], t[3] }
  for i, c in ipairs(self.hud.corners or {}) do c:SetVertexColor(cols[i][1], cols[i][2], cols[i][3], 0.85) end
  if self.hud.streak then self.hud.streak:SetVertexColor(t[2][1], t[2][2], t[2][3], 1) end
  self.headBg:SetGradient({ t[1], t[2], t[3] }, 0.08)
  self.sep:SetVertexColor(t[2][1], t[2][2], t[2][3], 0.35)
  UI.SetGradV(self.orb, t[1], t[2], 1)
  self.orbGlow:SetVertexColor(t[1][1], t[1][2], t[1][3], 0.55)
  UI.SetGradH(self.under, t[1], t[3], 1)
  self.underGlow:SetVertexColor(t[2][1], t[2][2], t[2][3], 0.9)
  self.grip.tex:SetVertexColor(t[1][1], t[1][2], t[1][3], 1)
  for _, tb in ipairs(self.tabs) do if tb.badge and tb.badge.body then tb.badge.body:SetGradient({ t[1], t[2], t[3] }, 1) end end
  if ns.Blizzard and ns.Blizzard.Theme then ns.Blizzard.Theme() end
  for _, t in pairs(ns.Windows) do t:Style() end
  self.lock.icon:SetTexture(UI.Icon(d.locked and "lock" or "unlock"))
  self.grip:SetShown(not d.locked)
  self:Hover(self.hover)
end

-- Knoepfe + Griff nur beim Ueberfahren deutlich (Chat bleibt ruhig); die Reiter bleiben immer sichtbar
function Main:Hover(on)
  self.hover = on
  local show = on or ns.DB.alwaysHeader
  self.headBg:SetAlpha(show and 1 or 0)
  for _, b in ipairs(self.buttons) do b:SetAlpha(show and 1 or 0) b:EnableMouse(show) end
  self.add:SetAlpha(show and 1 or 0)
  self.add:EnableMouse(show)
  self.grip:SetAlpha(show and 0.9 or 0)
  for _, b in ipairs(self.tabs) do if b:IsShown() then paintTab(b) end end
  local t = self:Active()
  if t and ns.DB.mouseFade and (FD().fade or 0) > 0 and on then pcall(t.msg.ResetAllFadeTimes, t.msg) end
end

local function iconButton(icon, tip, fn)
  local b = UI.IconButton(Main.head, icon, 20, tip)
  b:SetScript("OnClick", function() UI.PlayClick() fn() end)
  Main.buttons[#Main.buttons + 1] = b
  return b
end

local function build()
  local f = CreateFrame("Frame", "ChatWerkFrame", UIParent)
  Main.frame = f
  f:SetFrameStrata("LOW")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:SetResizable(true)
  f:SetResizeBounds(MIN_W, MIN_H, MAX_W, MAX_H)
  f:EnableMouse(false)
  Main.glass = UI.Glass(f, { radius = 16, sheen = 0.035, line = 0.18, edge = 0.2 })
  -- Hintergrund-Bild (wie KampfWerk): unter dem Glas-Rand, mit runder Maske
  Main.bg = f:CreateTexture(nil, "BORDER", nil, -8)
  Main.bg:SetPoint("TOPLEFT", 1, -1)
  Main.bg:SetPoint("BOTTOMRIGHT", -1, 1)
  local mask = f:CreateMaskTexture()
  mask:SetTexture(MEDIA .. "mask_round", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
  pcall(mask.SetTextureSliceMargins, mask, 16, 16, 16, 16)
  pcall(mask.SetTextureSliceMode, mask, 0)
  mask:SetAllPoints(Main.bg)
  Main.bg:AddMaskTexture(mask)
  Main.bg:Hide()
  Main.hud = UI.HUD(f, { radius = 16, flow = Main.glass.edge, flowAlpha = 0.45, grid = 0.05 })

  -- Reiterleiste: ziehen = verschieben
  local head = CreateFrame("Frame", nil, f)
  Main.head = head
  head:SetPoint("TOPLEFT", 0, 0)
  head:SetPoint("TOPRIGHT", 0, 0)
  head:SetHeight(HEAD)
  head:EnableMouse(true)
  head:RegisterForDrag("LeftButton")
  Main.headBg = UI.Round(head, 14, "BACKGROUND", 2, 3)
  Main.headBg:SetGradient(UI.GRAD_EDGE or UI.GRAD, 0.08)
  -- feine Neon-Linie unter der Reiterleiste
  local sep = UI.Hairline(head, C.teal, 0.35, "ARTWORK", true)
  Main.sep = sep
  sep:SetPoint("BOTTOMLEFT", head, "BOTTOMLEFT", 14, -1)
  sep:SetPoint("BOTTOMRIGHT", head, "BOTTOMRIGHT", -14, -1)
  -- pulsierende Status-Kugel links ("live")
  local orb = head:CreateTexture(nil, "ARTWORK", nil, 2)
  orb:SetTexture(UI.TEX.circle)
  orb:SetSize(7, 7)
  orb:SetPoint("LEFT", 12, 0)
  UI.SetGradV(orb, C.amber, C.teal, 1)
  local og = UI.Glow(head, C.amber, 26, 0.55, "ARTWORK")
  Main.orbGlow = og
  og:SetPoint("CENTER", orb, "CENTER")
  og:SetBlendMode("ADD")
  local pulse = og:CreateAnimationGroup()
  pulse:SetLooping("BOUNCE")
  local pa = pulse:CreateAnimation("Alpha")
  pa:SetFromAlpha(1) pa:SetToAlpha(0.25) pa:SetDuration(1.1) pa:SetSmoothing("IN_OUT")
  local ps = pulse:CreateAnimation("Scale")
  ps:SetScaleFrom(1, 1) ps:SetScaleTo(1.35, 1.35) ps:SetDuration(1.1) ps:SetSmoothing("IN_OUT")
  UI.animations = UI.animations or {}
  table.insert(UI.animations, pulse)
  if UI.AnimationsOn() then pulse:Play() end
  Main.orb = orb
  -- Unterstrich unter dem aktiven Reiter
  Main.under = head:CreateTexture(nil, "OVERLAY", nil, 3)
  Main.under:SetTexture(UI.TEX.white)
  Main.under:SetHeight(2)
  UI.SetGradH(Main.under, C.amber, C.aqua, 1)
  Main.underGlow = head:CreateTexture(nil, "OVERLAY", nil, 2)
  Main.underGlow:SetTexture(MEDIA .. "streak")
  Main.underGlow:SetHeight(14)
  Main.underGlow:SetBlendMode("ADD")
  Main.underGlow:SetVertexColor(C.teal[1], C.teal[2], C.teal[3], 0.9)
  head:SetScript("OnDragStart", function() if not FD().locked then f:StartMoving() end end)
  head:SetScript("OnDragStop", function() Main:StopMove() end)
  head:SetScript("OnMouseUp", function(_, button)
    if button == "RightButton" and ns.Config then ns.Config.Open(ns.DB.active) end
  end)

  local gear = iconButton("gear", "Einstellungen", function() if ns.Config then ns.Config.Open(ns.DB.active) end end)
  gear:SetPoint("RIGHT", head, "RIGHT", -6, 0)
  Main.lock = iconButton("unlock", "Fenster sperren / freigeben", function()
    FD().locked = not FD().locked
    Main:Apply()
  end)
  Main.lock:SetPoint("RIGHT", gear, "LEFT", -4, 0)
  local copy = iconButton("copy", "Verlauf dieses Reiters kopieren", function()
    if ns.Config and ns.Config.CopyHistory then ns.Config.CopyHistory(ns.DB.active) end
  end)
  copy:SetPoint("RIGHT", Main.lock, "LEFT", -4, 0)

  -- "+" direkt hinter dem letzten Reiter: neuer Chat
  Main.add = UI.IconButton(head, "plus", 20, "Neuer Reiter")
  Main.add:SetScript("OnClick", function()
    UI.PlayClick()
    local d = ns.NewWindow(nil, {})
    ns.BuildWindows()
    Main:Select(d.id)
    if ns.Config then ns.Config.Open(d.id) end
  end)

  -- "Neue Nachrichten unten": runde Neon-Kugel unten rechts
  local down = UI.IconButton(f, "down", 26, "Nach unten")
  Main.down = down
  down:SetPoint("BOTTOMRIGHT", -18, 12)
  down:SetFrameLevel(f:GetFrameLevel() + 10)
  down:SetScript("OnClick", function()
    UI.PlayClick()
    local t = Main:Active()
    if t then t.msg:ScrollToBottom() end
    down:Hide()
  end)
  down:Hide()

  -- Groessen-Griff unten rechts
  local grip = UI.SafeButton(f)
  Main.grip = grip
  grip:SetSize(18, 18)
  grip:SetPoint("BOTTOMRIGHT", -3, 3)
  grip:SetFrameLevel(f:GetFrameLevel() + 11)
  grip.tex = grip:CreateTexture(nil, "OVERLAY")
  grip.tex:SetTexture(MEDIA .. "grip")
  grip.tex:SetAllPoints()
  grip.tex:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 1)
  grip:SetScript("OnMouseDown", function() if not FD().locked then f:StartSizing("BOTTOMRIGHT") end end)
  grip:SetScript("OnMouseUp", function() Main:StopMove() end)
  UI.SetTooltip(grip, "Groesse aendern", "Ziehen, um das Fenster groesser oder kleiner zu machen.")

  f:SetScript("OnSizeChanged", function()
    Main:TileBg()
    local t = Main:Active()
    if t and down:IsShown() and t.msg:AtBottom() then down:Hide() end
    if Main.ready then Main:LayoutTabs() end
  end)
end

-- Ueberfahren erkennen
-- Reiterleiste: x Sekunden nach dem Wegziehen der Maus weich ausblenden, beim Drueberfahren sofort wieder da
local STEP = 0.12
function Main:BarTick(over)
  local d = FD()
  local after = d.barFade or 5
  local now = GetTime()
  if over or after <= 0 or ns.DB.alwaysHeader then
    self.lastOver = now
    self.barAlpha = 1
  elseif now - (self.lastOver or now) >= after then
    self.barAlpha = math.max(0, (self.barAlpha or 1) - STEP / 0.5)
  end
  self.head:SetAlpha(self.barAlpha or 1)
end

local function tick()
  local f = Main.frame
  if f and f:IsShown() then
    local over = f:IsMouseOver() == true
    if over ~= Main.hover then Main:Hover(over) end
    Main:BarTick(over)
  end
end
ns.WindowTick = tick

-- Fenster + Reiter an die Einstellungen anpassen: neue Reiter bauen, geloeschte entfernen
function ns.BuildWindows()
  if not Main.frame then build() end
  local keep = {}
  for _, d in ipairs(ns.DB.windows) do
    keep[d.id] = true
    local t = ns.Windows[d.id]
    if t then t.data = d else newTab(d) end
  end
  for id, t in pairs(ns.Windows) do
    if not keep[id] then
      t.msg:Hide()
      ns.Windows[id] = nil
    end
  end
  Main.ready = true
  Main.frame:Show()
  Main:Apply()
  Main:Select(ns.DB.active)
  if not ns.ticker and C_Timer and C_Timer.NewTicker then ns.ticker = C_Timer.NewTicker(0.12, function() ns.Safe(tick) end) end
  if ns.Blizzard and ns.Blizzard.Anchor then ns.Blizzard.Anchor() end
end
