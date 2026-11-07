-- Goldrausch – Design-System: Farben, Schrift, runde Formen, Bausteine
local ADDON, ns = ...

local UI = {}
ns.UI = UI

local MEDIA = ns.MEDIA
local WHITE = "Interface\\Buttons\\WHITE8X8"
UI.TEX = {
  circle = MEDIA .. "circle", ring = MEDIA .. "ring", glow = MEDIA .. "glow",
  blob1 = MEDIA .. "blob1", blob2 = MEDIA .. "blob2", wave = MEDIA .. "wave",
  sparkle = MEDIA .. "sparkle", logo = MEDIA .. "logo", wordmark = MEDIA .. "wordmark",
}
function UI.Icon(name) return MEDIA .. "i_" .. name end

----------------------------------------------------------------------------
-- Farben (Kontrast der Texte auf den Karten >= 4.5:1)
----------------------------------------------------------------------------
local C = {
  bg     = { 0.055, 0.043, 0.102, 0.97 },
  side   = { 0.075, 0.060, 0.140, 0.92 },
  card   = { 0.125, 0.106, 0.216, 0.96 },
  cardHi = { 0.170, 0.145, 0.282, 0.98 },
  inset  = { 0.090, 0.075, 0.165, 0.95 },
  text   = { 0.965, 0.955, 1.000 },
  muted  = { 0.760, 0.730, 0.890 },
  dim    = { 0.600, 0.570, 0.745 },
  gold   = { 1.000, 0.840, 0.290 },
  amber  = { 1.000, 0.540, 0.000 },
  rose   = { 1.000, 0.240, 0.510 },
  teal   = { 0.180, 0.890, 0.770 },
  violet = { 0.560, 0.420, 1.000 },
  green  = { 0.380, 0.920, 0.560 },
  red    = { 1.000, 0.440, 0.520 },
  dark   = { 0.090, 0.050, 0.020 },
}
UI.C = C
UI.GRAD = { C.gold, C.amber, C.rose }        -- Haupt-Verlauf
UI.GRAD_COOL = { C.teal, C.violet, C.rose }  -- Zweit-Verlauf
UI.GRAD_FRESH = { C.green, C.teal, C.violet }

function UI.Hex(c)
  return string.format("|cff%02x%02x%02x", math.floor(c[1] * 255), math.floor(c[2] * 255), math.floor(c[3] * 255))
end

UI.QUALITY = {
  [0] = { 0.62, 0.62, 0.62 }, [1] = { 1, 1, 1 }, [2] = { 0.12, 1, 0 },
  [3] = { 0.0, 0.44, 0.87 }, [4] = { 0.64, 0.21, 0.93 }, [5] = { 1, 0.5, 0 },
}

----------------------------------------------------------------------------
-- Schrift (eigene Poppins-Schrift mit sicherem Rückfall auf die Spielschrift)
----------------------------------------------------------------------------
local FONT_FILES = {
  regular = MEDIA .. "Fonts\\Poppins-Regular.ttf",
  semibold = MEDIA .. "Fonts\\Poppins-SemiBold.ttf",
  bold = MEDIA .. "Fonts\\Poppins-ExtraBold.ttf",
}
local fallbackFont
local function gameFont()
  if fallbackFont then return fallbackFont end
  local f = GameFontNormal and GameFontNormal.GetFont and GameFontNormal:GetFont()
  fallbackFont = f or STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF"
  return fallbackFont
end

function UI.SetFont(fs, size, weight, flags)
  local file = FONT_FILES[weight or "regular"] or FONT_FILES.regular
  local ok, res = pcall(fs.SetFont, fs, file, size, flags or "")
  if not ok or res == false then
    pcall(fs.SetFont, fs, gameFont(), size, flags or "")
  end
end

function UI.Text(parent, size, weight, color, layer)
  local fs = parent:CreateFontString(nil, layer or "OVERLAY")
  UI.SetFont(fs, size or 13, weight)
  local c = color or C.text
  fs:SetTextColor(c[1], c[2], c[3], c[4] or 1)
  fs:SetJustifyH("LEFT")
  fs:SetJustifyV("MIDDLE")
  fs:SetShadowColor(0, 0, 0, 0.35)
  fs:SetShadowOffset(0, -1)
  return fs
end

-- Mehrzeiliger Absatz mit fester Breite
function UI.Para(parent, size, color, width, weight)
  local fs = UI.Text(parent, size or 13, weight or "regular", color or C.muted)
  fs:SetJustifyV("TOP")
  fs:SetWordWrap(true)
  fs:SetSpacing(3)
  if width then fs:SetWidth(width) end
  return fs
end

----------------------------------------------------------------------------
-- Runde Formen: Ecken aus Kreis-Viertel + Flächen; Verläufe mit 3 Farben
----------------------------------------------------------------------------
local Round = {}
Round.__index = Round

local function tex(frame, layer, sub, file)
  local t = frame:CreateTexture(nil, layer or "BACKGROUND", nil, sub or 0)
  t:SetTexture(file or WHITE)
  return t
end

function UI.Round(frame, radius, layer, sub)
  local r = setmetatable({ frame = frame, radius = radius or 12, parts = {} }, Round)
  local p = r.parts
  p.tl = tex(frame, layer, sub, UI.TEX.circle); p.tl:SetTexCoord(0, 0.5, 0, 0.5)
  p.tr = tex(frame, layer, sub, UI.TEX.circle); p.tr:SetTexCoord(0.5, 1, 0, 0.5)
  p.bl = tex(frame, layer, sub, UI.TEX.circle); p.bl:SetTexCoord(0, 0.5, 0.5, 1)
  p.br = tex(frame, layer, sub, UI.TEX.circle); p.br:SetTexCoord(0.5, 1, 0.5, 1)
  p.l = tex(frame, layer, sub)
  p.rr = tex(frame, layer, sub)
  p.c1 = tex(frame, layer, sub)
  p.c2 = tex(frame, layer, sub)
  r:Layout()
  frame:HookScript("OnSizeChanged", function() r:Layout() end)
  return r
end

function Round:Layout()
  local f, p = self.frame, self.parts
  local w, h = f:GetWidth() or 0, f:GetHeight() or 0
  local rad = self.radius
  if w > 0 and h > 0 then rad = math.min(rad, w / 2, h / 2) end
  rad = math.max(math.floor(rad + 0.5), 1)
  self.r = rad
  for _, k in ipairs({ "tl", "tr", "bl", "br", "l", "rr", "c1", "c2" }) do p[k]:ClearAllPoints() end
  p.tl:SetSize(rad, rad); p.tl:SetPoint("TOPLEFT", f, "TOPLEFT", 0, 0)
  p.tr:SetSize(rad, rad); p.tr:SetPoint("TOPRIGHT", f, "TOPRIGHT", 0, 0)
  p.bl:SetSize(rad, rad); p.bl:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", 0, 0)
  p.br:SetSize(rad, rad); p.br:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", 0, 0)
  p.l:SetPoint("TOPLEFT", f, "TOPLEFT", 0, -rad); p.l:SetPoint("BOTTOMRIGHT", f, "BOTTOMLEFT", rad, rad)
  p.rr:SetPoint("TOPRIGHT", f, "TOPRIGHT", 0, -rad); p.rr:SetPoint("BOTTOMLEFT", f, "BOTTOMRIGHT", -rad, rad)
  p.c1:SetPoint("TOPLEFT", f, "TOPLEFT", rad, 0); p.c1:SetPoint("BOTTOMRIGHT", f, "BOTTOM", 0, 0)
  p.c2:SetPoint("TOPLEFT", f, "TOP", 0, 0); p.c2:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -rad, 0)
end

local function setColor(t, c, a)
  t:SetVertexColor(c[1], c[2], c[3], a or c[4] or 1)
end

local function setGrad(t, c1, c2, a)
  local ok = pcall(t.SetGradient, t, "HORIZONTAL",
    CreateColor(c1[1], c1[2], c1[3], a or c1[4] or 1), CreateColor(c2[1], c2[2], c2[3], a or c2[4] or 1))
  if not ok then setColor(t, c1, a) end
end

function Round:SetColor(c, a)
  for _, t in pairs(self.parts) do setColor(t, c, a) end
  self.mode = "solid"
end

-- Waagerechter Verlauf über drei Farben (links -> Mitte -> rechts)
function Round:SetGradient(stops, a)
  local c1, c2, c3 = stops[1], stops[2], stops[3] or stops[2]
  local p = self.parts
  setColor(p.tl, c1, a); setColor(p.bl, c1, a); setColor(p.l, c1, a)
  setColor(p.tr, c3, a); setColor(p.br, c3, a); setColor(p.rr, c3, a)
  setGrad(p.c1, c1, c2, a)
  setGrad(p.c2, c2, c3, a)
  self.mode = "grad"
end

function Round:SetAlpha(a)
  for _, t in pairs(self.parts) do t:SetAlpha(a) end
end

function Round:SetShown(shown)
  for _, t in pairs(self.parts) do t:SetShown(shown) end
end

function Round:SetBlendMode(mode)
  for _, t in pairs(self.parts) do t:SetBlendMode(mode) end
end

----------------------------------------------------------------------------
-- Weiches Leuchten
----------------------------------------------------------------------------
function UI.Glow(frame, color, size, alpha, layer)
  local g = frame:CreateTexture(nil, layer or "BACKGROUND", nil, -6)
  g:SetTexture(UI.TEX.glow)
  g:SetBlendMode("ADD")
  g:SetSize(size, size)
  g:SetVertexColor(color[1], color[2], color[3], alpha or 0.5)
  return g
end

-- Sanfte Endlos-Animation (Atmen/Treiben); respektiert die Einstellung "Animationen"
function UI.Drift(region, dx, dy, duration, alphaFrom, alphaTo)
  local ag = region:CreateAnimationGroup()
  ag:SetLooping("BOUNCE")
  local move = ag:CreateAnimation("Translation")
  move:SetOffset(dx or 0, dy or 0)
  move:SetDuration(duration or 6)
  move:SetSmoothing("IN_OUT")
  if alphaFrom and alphaTo then
    local fade = ag:CreateAnimation("Alpha")
    fade:SetFromAlpha(alphaFrom)
    fade:SetToAlpha(alphaTo)
    fade:SetDuration(duration or 6)
    fade:SetSmoothing("IN_OUT")
  end
  UI.animations = UI.animations or {}
  table.insert(UI.animations, ag)
  return ag
end

function UI.UpdateAnimations()
  local on = not ns.settings or ns.settings.animations ~= false
  for _, ag in ipairs(UI.animations or {}) do
    if on then
      if not ag:IsPlaying() then ag:Play() end
    else
      ag:Stop()
    end
  end
end

----------------------------------------------------------------------------
-- Tooltip-Helfer
----------------------------------------------------------------------------
function UI.SetTooltip(frame, title, body)
  frame:HookScript("OnEnter", function(self)
    local t, b = title, body
    if type(t) == "function" then t, b = t(self) end
    if not t then return end
    GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
    GameTooltip:SetText(t, 1, 0.84, 0.29)
    if b then GameTooltip:AddLine(b, 0.86, 0.84, 0.95, true) end
    GameTooltip:Show()
  end)
  frame:HookScript("OnLeave", function() GameTooltip:Hide() end)
end

----------------------------------------------------------------------------
-- Knöpfe
----------------------------------------------------------------------------
local function playClick()
  if PlaySound and SOUNDKIT and SOUNDKIT.U_CHAT_SCROLL_BUTTON then
    pcall(PlaySound, SOUNDKIT.U_CHAT_SCROLL_BUTTON)
  end
end
UI.PlayClick = playClick

-- style: "primary" (Verlauf), "soft" (Karte), "ghost" (nur Umriss-Wirkung)
function UI.Button(parent, label, style, width, height, icon)
  local b = CreateFrame("Button", nil, parent)
  b:SetSize(width or 140, height or 32)
  b.style = style or "primary"
  b.bg = UI.Round(b, (height or 32) / 2, "BACKGROUND", 1)
  b.glow = UI.Glow(b, C.amber, (width or 140) * 1.3, 0, "BACKGROUND")
  b.glow:SetPoint("CENTER")
  b.glow:SetHeight((height or 32) * 2.4)
  b.text = UI.Text(b, 13, "semibold", b.style == "primary" and C.dark or C.text)
  b.text:SetPoint("CENTER", icon and 9 or 0, 0)
  b.text:SetText(label or "")
  if icon then
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetTexture(UI.Icon(icon))
    b.icon:SetSize(15, 15)
    b.icon:SetPoint("RIGHT", b.text, "LEFT", -6, 0)
  end
  function b:Paint()
    local hover = self:IsMouseOver() and self:IsEnabled()
    if self.style == "primary" then
      self.bg:SetGradient(UI.GRAD, self:IsEnabled() and 1 or 0.35)
      self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], self:IsEnabled() and 1 or 0.6)
      if self.icon then self.icon:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1) end
      self.glow:SetAlpha(hover and 0.55 or 0)
    elseif self.style == "cool" then
      self.bg:SetGradient(UI.GRAD_COOL, self:IsEnabled() and (hover and 1 or 0.88) or 0.3)
      self.text:SetTextColor(1, 1, 1, self:IsEnabled() and 1 or 0.6)
      if self.icon then self.icon:SetVertexColor(1, 1, 1, 1) end
      self.glow:SetVertexColor(C.violet[1], C.violet[2], C.violet[3])
      self.glow:SetAlpha(hover and 0.5 or 0)
    else
      local base = hover and C.cardHi or C.card
      self.bg:SetColor(base, self.style == "ghost" and (hover and 0.9 or 0.55) or 1)
      self.text:SetTextColor(C.text[1], C.text[2], C.text[3], self:IsEnabled() and 1 or 0.45)
      if self.icon then self.icon:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], self:IsEnabled() and 1 or 0.45) end
      self.glow:SetAlpha(0)
    end
  end
  function b:SetLabel(s) self.text:SetText(s) end
  b:SetScript("OnEnter", function(self) self:Paint() end)
  b:SetScript("OnLeave", function(self) self:Paint() end)
  b:SetScript("OnMouseDown", function(self) if self:IsEnabled() then self.text:SetPoint("CENTER", self.icon and 9 or 0, -1) end end)
  b:SetScript("OnMouseUp", function(self) self.text:SetPoint("CENTER", self.icon and 9 or 0, 0) end)
  b:HookScript("OnClick", playClick)
  b:SetScript("OnEnable", function(self) self:Paint() end)
  b:SetScript("OnDisable", function(self) self:Paint() end)
  b:Paint()
  return b
end

-- Runder Symbol-Knopf (z. B. Schließen)
function UI.IconButton(parent, icon, size, tip)
  local b = CreateFrame("Button", nil, parent)
  b:SetSize(size or 28, size or 28)
  b.bg = b:CreateTexture(nil, "BACKGROUND")
  b.bg:SetTexture(UI.TEX.circle)
  b.bg:SetAllPoints()
  b.icon = b:CreateTexture(nil, "ARTWORK")
  b.icon:SetTexture(UI.Icon(icon))
  b.icon:SetPoint("CENTER")
  b.icon:SetSize((size or 28) * 0.5, (size or 28) * 0.5)
  local function paint(self)
    local hover = self:IsMouseOver()
    local c = hover and C.cardHi or C.card
    self.bg:SetVertexColor(c[1], c[2], c[3], 1)
    local ic = hover and C.gold or C.muted
    self.icon:SetVertexColor(ic[1], ic[2], ic[3], 1)
  end
  b:SetScript("OnEnter", paint)
  b:SetScript("OnLeave", paint)
  b:HookScript("OnClick", playClick)
  paint(b)
  if tip then UI.SetTooltip(b, tip) end
  return b
end

----------------------------------------------------------------------------
-- Karte (abgerundete Fläche)
----------------------------------------------------------------------------
function UI.Card(parent, radius, color)
  local f = CreateFrame("Frame", nil, parent)
  f.bg = UI.Round(f, radius or 16, "BACKGROUND", 0)
  f.bg:SetColor(color or C.card)
  return f
end

-- Kleine Pille als Etikett ("Level 10+", "AH", ...)
function UI.Chip(parent, text, color, filled)
  local f = CreateFrame("Frame", nil, parent)
  f.bg = UI.Round(f, 10, "BACKGROUND", 2)
  f.text = UI.Text(f, 11, "semibold", color or C.gold)
  f.text:SetPoint("CENTER", 0, 0)
  function f:Set(t, c, isFilled)
    c = c or C.gold
    self.text:SetText(t)
    if isFilled then
      self.bg:SetColor(c, 1)
      self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
    else
      self.bg:SetColor(c, 0.16)
      self.text:SetTextColor(c[1], c[2], c[3], 1)
    end
    self:SetSize(math.ceil(self.text:GetStringWidth()) + 18, 20)
  end
  f:Set(text or "", color, filled)
  return f
end

----------------------------------------------------------------------------
-- Rundes Item-Symbol mit Qualitäts-Ring
----------------------------------------------------------------------------
function UI.ItemIcon(parent, size)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(size, size)
  f.icon = f:CreateTexture(nil, "ARTWORK")
  f.icon:SetPoint("TOPLEFT", 2, -2)
  f.icon:SetPoint("BOTTOMRIGHT", -2, 2)
  f.icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
  if f.CreateMaskTexture then
    local mask = f:CreateMaskTexture()
    mask:SetTexture(UI.TEX.circle, "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    mask:SetAllPoints(f.icon)
    f.icon:AddMaskTexture(mask)
  end
  f.ring = f:CreateTexture(nil, "OVERLAY")
  f.ring:SetTexture(UI.TEX.ring)
  f.ring:SetAllPoints()
  function f:SetItem(id)
    local item = ns.Item(id)
    self.icon:SetTexture(item.icon)
    local q = UI.QUALITY[item.quality or 1] or UI.QUALITY[1]
    self.ring:SetVertexColor(q[1], q[2], q[3], 0.9)
  end
  function f:SetIcon(file, color)
    self.icon:SetTexture(file)
    local c = color or C.gold
    self.ring:SetVertexColor(c[1], c[2], c[3], 0.9)
  end
  return f
end

----------------------------------------------------------------------------
-- Scrollbereich mit schlanker, runder Leiste
----------------------------------------------------------------------------
function UI.Scroll(parent)
  local sf = CreateFrame("ScrollFrame", nil, parent)
  local content = CreateFrame("Frame", nil, sf)
  content:SetSize(10, 10)
  sf:SetScrollChild(content)
  sf:EnableMouseWheel(true)

  local track = CreateFrame("Frame", nil, sf)
  track:SetPoint("TOPRIGHT", sf, "TOPRIGHT", -2, -4)
  track:SetPoint("BOTTOMRIGHT", sf, "BOTTOMRIGHT", -2, 4)
  track:SetWidth(6)
  track.bg = UI.Round(track, 3, "BACKGROUND", 0)
  track.bg:SetColor(C.card, 0.8)

  local thumb = CreateFrame("Frame", nil, track)
  thumb:SetWidth(6)
  thumb.bg = UI.Round(thumb, 3, "ARTWORK", 0)
  thumb.bg:SetColor(C.gold, 0.85)
  thumb:EnableMouse(true)

  local function update()
    local range = sf:GetVerticalScrollRange() or 0
    local h = track:GetHeight() or 1
    if range <= 1 then
      track:Hide()
      return
    end
    track:Show()
    local view = sf:GetHeight() or 1
    local th = math.max(h * view / (view + range), 24)
    thumb:SetHeight(th)
    local pos = (sf:GetVerticalScroll() or 0) / range
    thumb:ClearAllPoints()
    thumb:SetPoint("TOP", track, "TOP", 0, -(h - th) * pos)
  end
  sf.UpdateBar = update

  sf:SetScript("OnMouseWheel", function(self, delta)
    local range = self:GetVerticalScrollRange() or 0
    local cur = self:GetVerticalScroll() or 0
    self:SetVerticalScroll(ns.Clamp(cur - delta * 48, 0, range))
    update()
  end)
  sf:SetScript("OnScrollRangeChanged", function(self)
    local range = self:GetVerticalScrollRange() or 0
    if (self:GetVerticalScroll() or 0) > range then self:SetVerticalScroll(range) end
    update()
  end)
  sf:SetScript("OnSizeChanged", function(self, w)
    content:SetWidth(math.max((w or self:GetWidth() or 10) - 14, 10))
    update()
  end)

  -- Ziehen am Griff
  thumb:SetScript("OnMouseDown", function(self)
    local _, cy = GetCursorPosition()
    self.dragStart = cy / (self:GetEffectiveScale() or 1)
    self.scrollStart = sf:GetVerticalScroll() or 0
    self:SetScript("OnUpdate", function(me)
      local _, y = GetCursorPosition()
      y = y / (me:GetEffectiveScale() or 1)
      local range = sf:GetVerticalScrollRange() or 0
      local free = (track:GetHeight() or 1) - (me:GetHeight() or 1)
      if free > 0 then
        local newScroll = me.scrollStart + (me.dragStart - y) / free * range
        sf:SetVerticalScroll(ns.Clamp(newScroll, 0, range))
        update()
      end
    end)
  end)
  thumb:SetScript("OnMouseUp", function(self) self:SetScript("OnUpdate", nil) end)
  thumb:SetScript("OnHide", function(self) self:SetScript("OnUpdate", nil) end)

  function sf:ScrollToTop()
    self:SetVerticalScroll(0)
    update()
  end
  return sf, content
end

----------------------------------------------------------------------------
-- Schalter (Ein/Aus)
----------------------------------------------------------------------------
function UI.Toggle(parent, label, getter, setter, desc, width)
  local f = CreateFrame("Button", nil, parent)
  f:SetSize(width or 520, desc and 54 or 36)
  f.label = UI.Text(f, 13, "semibold", C.text)
  f.label:SetPoint("TOPLEFT", 0, desc and -4 or -10)
  f.label:SetText(label)
  if desc then
    f.desc = UI.Para(f, 11, C.dim, (width or 520) - 70)
    f.desc:SetPoint("TOPLEFT", f.label, "BOTTOMLEFT", 0, -3)
    f.desc:SetText(desc)
  end
  local sw = CreateFrame("Frame", nil, f)
  sw:SetSize(44, 24)
  sw:SetPoint("TOPRIGHT", 0, desc and -6 or -6)
  sw.bg = UI.Round(sw, 12, "BACKGROUND", 0)
  sw.knob = sw:CreateTexture(nil, "ARTWORK")
  sw.knob:SetTexture(UI.TEX.circle)
  sw.knob:SetSize(18, 18)
  function f:Refresh()
    local on = getter()
    if on then
      sw.bg:SetGradient(UI.GRAD, 1)
      sw.knob:ClearAllPoints(); sw.knob:SetPoint("RIGHT", -3, 0)
      sw.knob:SetVertexColor(1, 1, 1, 1)
    else
      sw.bg:SetColor(C.cardHi, 1)
      sw.knob:ClearAllPoints(); sw.knob:SetPoint("LEFT", 3, 0)
      sw.knob:SetVertexColor(C.muted[1], C.muted[2], C.muted[3], 1)
    end
  end
  f:SetScript("OnClick", function(self)
    setter(not getter())
    playClick()
    self:Refresh()
  end)
  f:Refresh()
  return f
end

----------------------------------------------------------------------------
-- Segment-Auswahl (Filter-Pillen nebeneinander, mit Umbruch)
----------------------------------------------------------------------------
function UI.Segments(parent, options, onChange, width)
  local f = CreateFrame("Frame", nil, parent)
  f.buttons = {}
  f.value = options[1] and options[1].value
  local maxW = width or 600
  local x, y, rowH = 0, 0, 30
  for i, opt in ipairs(options) do
    local b = CreateFrame("Button", nil, f)
    b.value = opt.value
    b.bg = UI.Round(b, 14, "BACKGROUND", 0)
    b.text = UI.Text(b, 12, "semibold", C.muted)
    b.text:SetPoint("CENTER")
    b.text:SetText(opt.label)
    local w = math.ceil(b.text:GetStringWidth()) + 28
    b:SetSize(w, 28)
    if x + w > maxW and x > 0 then
      x = 0
      y = y + rowH + 6
    end
    b:SetPoint("TOPLEFT", x, -y)
    x = x + w + 8
    b:SetScript("OnClick", function(self)
      f:Select(self.value, true)
      playClick()
    end)
    b:SetScript("OnEnter", function() f:Paint() end)
    b:SetScript("OnLeave", function() f:Paint() end)
    f.buttons[i] = b
  end
  f:SetSize(maxW, y + rowH)
  function f:Paint()
    for _, b in ipairs(self.buttons) do
      if b.value == self.value then
        b.bg:SetGradient(UI.GRAD, 1)
        b.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
      else
        b.bg:SetColor(b:IsMouseOver() and C.cardHi or C.card, 1)
        b.text:SetTextColor(C.muted[1], C.muted[2], C.muted[3], 1)
      end
    end
  end
  function f:Select(value, fire)
    self.value = value
    self:Paint()
    if fire and onChange then onChange(value) end
  end
  f:Paint()
  return f
end

----------------------------------------------------------------------------
-- Senkrechter Stapel-Layouter für Seiten
----------------------------------------------------------------------------
local Stack = {}
Stack.__index = Stack

function UI.Stack(content, padX)
  return setmetatable({ content = content, y = 0, pad = padX or 0 }, Stack)
end

function Stack:Width()
  return math.max((self.content:GetWidth() or 600) - self.pad * 2, 100)
end

function Stack:Add(region, height, gap, x)
  region:ClearAllPoints()
  region:SetPoint("TOPLEFT", self.content, "TOPLEFT", self.pad + (x or 0), -self.y)
  if height then
    self.y = self.y + height + (gap or 12)
  end
  return region
end

function Stack:Space(h)
  self.y = self.y + h
end

-- Fügt einen Textabsatz ein und rückt um seine echte Höhe vor
function Stack:Para(text, size, color, gap, weight)
  local fs = UI.Para(self.content, size or 13, color, self:Width(), weight)
  fs:SetText(text)
  self:Add(fs, nil)
  self.y = self.y + math.ceil(fs:GetStringHeight()) + (gap or 10)
  return fs
end

function Stack:Title(text, size, color, gap)
  local fs = UI.Text(self.content, size or 17, "bold", color or C.text)
  fs:SetText(text)
  self:Add(fs, nil)
  self.y = self.y + (size or 17) + 6 + (gap or 8)
  return fs
end

function Stack:Finish(extra)
  self.content:SetHeight(self.y + (extra or 20))
end
