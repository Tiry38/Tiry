-- KampfWerk: das Meter-Fenster. Ein grosses Glasfenster, in der Mitte geteilt (Teiler ziehen = Breite aendern).
-- Jeder Teil zeigt eine Ansicht (Titel anklicken) und einen Kampf-Abschnitt (Kapsel anklicken). Teile lassen sich
-- loesen (eigenes Fenster, frei schieben, Ecke ziehen) und wieder andocken. Reihenfolge in den Einstellungen.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local MEDIA = ns.MEDIA
local Data = ns.Data
local secret = ns.IsSecret

local Meter = {}
ns.Meter = Meter
local Panes = {}
Meter.Panes = Panes
local Group = {}
Meter.Group = Group

local HEAD = 28
local MIN_W, MIN_H = 150, 90
local MAX_W, MAX_H = 1800, 1100
local DIV = 12            -- Breite der Teiler-Zone zwischen zwei Teilen
local RADIUS = 16

local function L() return ns.DB.look end
local function theme() return ns.Theme() end

----------------------------------------------------------------------------
-- Glas-Haut eines Fensters: Glas, Hintergrund (maskiert, runde Ecken), HUD
----------------------------------------------------------------------------
local Skin = {}
Skin.__index = Skin

local function makeSkin(frame)
  local s = setmetatable({ frame = frame }, Skin)
  s.glass = UI.Glass(frame, { radius = RADIUS, sheen = 0.035, line = 0.18, edge = 0.2 })
  s.bg = frame:CreateTexture(nil, "BORDER", nil, -8)
  s.bg:SetPoint("TOPLEFT", 1, -1)
  s.bg:SetPoint("BOTTOMRIGHT", -1, 1)
  s.mask = frame:CreateMaskTexture()
  s.mask:SetTexture(MEDIA .. "mask_round", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
  pcall(s.mask.SetTextureSliceMargins, s.mask, 16, 16, 16, 16)
  pcall(s.mask.SetTextureSliceMode, s.mask, 0)
  s.mask:SetAllPoints(s.bg)
  s.bg:AddMaskTexture(s.mask)
  s.hud = UI.HUD(frame, { radius = RADIUS, flow = s.glass.edge, flowAlpha = 0.45, grid = 0.05 })
  frame:HookScript("OnSizeChanged", function() s:Tile() end)
  return s
end

function Skin:Tile()
  local b = self.bgDef
  if not b or not b.tile then return end
  local w, h = self.frame:GetWidth() or 0, self.frame:GetHeight() or 0
  if w > 0 and h > 0 then self.bg:SetTexCoord(0, w / b.tile, 0, h / b.tile) end
end

function Skin:Apply()
  local look = L()
  local a = ns.Clamp(look.alpha or 0.78, 0, 1)
  local t = theme()
  self.glass.opts.edgeStops = t
  self.glass:SetBody({ 0.028, 0.040, 0.046, 0.96 }, { 0.055, 0.070, 0.078, 0.96 }, a)
  self.glass:SetShown(a > 0.01)
  self.glass:SetEdge("neon", 0.18 + a * 0.45)
  self.hud.flow.alpha = 0.18 + a * 0.45
  self.hud.flow.colors = { t[1], t[2], t[3], t[2] }
  local b = ns.BG[look.bg] or ns.BG.glas
  self.bgDef = b
  if b.file then
    if b.tile then self.bg:SetTexture(b.file, "REPEAT", "REPEAT") else self.bg:SetTexture(b.file) self.bg:SetTexCoord(0, 1, 0, 1) end
    self.bg:SetVertexColor(1, 1, 1, ns.Clamp(look.bgAlpha or 0.55, 0, 1))
    self.bg:Show()
    self:Tile()
  else
    self.bg:Hide()
  end
  if self.hud.grid then self.hud.grid:SetShown(a > 0.05 and not b.file) end
  local cols = { t[1], t[3], t[2], t[3] }
  for i, c in ipairs(self.hud.corners or {}) do c:SetVertexColor(cols[i][1], cols[i][2], cols[i][3], 0.85) end
  if self.hud.streak then self.hud.streak:SetVertexColor(t[2][1], t[2][2], t[2][3], 1) end
end

function Skin:SetShown(on)
  self.glass:SetShown(on)
  if not on then self.bg:Hide() end
  if self.hud.grid then self.hud.grid:SetShown(on) end
  for _, c in ipairs(self.hud.corners or {}) do c:SetShown(on) end
  if self.hud.streak then self.hud.streak:SetShown(on) end
  self.hidden = not on
end

----------------------------------------------------------------------------
-- Auswahl-Liste (Ansicht / Kampf-Abschnitt)
----------------------------------------------------------------------------
local picker
local function buildPicker()
  local f = CreateFrame("Frame", "KampfWerkPicker", UIParent)
  f:SetFrameStrata("DIALOG")
  f:SetClampedToScreen(true)
  f:EnableMouse(true)
  f:SetSize(236, 100)
  f.glass = UI.Glass(f, { radius = 14, body = UI.GLASS.window, edgeMode = "neon", edge = 0.6, halo = 0.12, haloPad = 18 })
  f.items = {}
  f:Hide()
  tinsert(UISpecialFrames, "KampfWerkPicker")
  f:SetScript("OnUpdate", function(self)
    if self:IsMouseOver() or (self.anchor and self.anchor:IsMouseOver()) then self.away = nil return end
    self.away = self.away or GetTime()
    if GetTime() - self.away > 1.2 then self:Hide() end
  end)
  return f
end

local function pickItem(i)
  local b = picker.items[i]
  if b then return b end
  b = UI.SafeButton(picker)
  b:SetHeight(26)
  b.hl = UI.Round(b, 13, "BACKGROUND", 3)
  b.text = UI.Text(b, 13, "semibold", C.text)
  b.text:SetPoint("LEFT", 14, 0)
  b.text:SetPoint("RIGHT", -26, 0)
  b.text:SetWordWrap(false)
  b.check = b:CreateTexture(nil, "ARTWORK")
  b.check:SetTexture(UI.Icon("check"))
  b.check:SetSize(12, 12)
  b.check:SetPoint("RIGHT", -10, 0)
  local function paint(self)
    local t = theme()
    if self:IsMouseOver() then
      self.hl:SetGradient({ t[1], t[2], t[3] }, 0.9)
      self.hl:SetShown(true)
      self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
    else
      self.hl:SetShown(self.selected == true)
      if self.selected then self.hl:SetGradient({ t[1], t[2], t[3] }, 0.18) end
      self.text:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
    end
    self.check:SetVertexColor(t[1][1], t[1][2], t[1][3], 1)
  end
  b.Paint = paint
  b:SetScript("OnEnter", paint)
  b:SetScript("OnLeave", paint)
  b:SetScript("OnClick", function(self)
    UI.PlayClick()
    picker:Hide()
    if picker.onPick then picker.onPick(self.value) end
  end)
  picker.items[i] = b
  return b
end

function Meter.Pick(anchor, items, current, onPick)
  picker = picker or buildPicker()
  if picker:IsShown() and picker.anchor == anchor then picker:Hide() return end
  picker.anchor, picker.onPick, picker.away = anchor, onPick, nil
  for _, b in ipairs(picker.items) do b:Hide() end
  for i, it in ipairs(items) do
    local b = pickItem(i)
    b.value = it.value
    b.selected = it.value == current
    b.text:SetText(it.label)
    b.check:SetShown(b.selected)
    b:ClearAllPoints()
    b:SetPoint("TOPLEFT", 8, -8 - (i - 1) * 28)
    b:SetPoint("TOPRIGHT", -8, -8 - (i - 1) * 28)
    b:Show()
    b:Paint()
  end
  picker:SetHeight(16 + #items * 28)
  picker.glass.opts.edgeStops = theme()
  picker.glass:SetEdge("neon", 0.6)
  picker:ClearAllPoints()
  picker:SetPoint("TOPLEFT", anchor, "BOTTOMLEFT", -6, -4)
  picker:Show()
end

----------------------------------------------------------------------------
-- Zeilen
----------------------------------------------------------------------------
local function barTexture()
  return L().barStyle == "flach" and "Interface\\Buttons\\WHITE8X8" or (MEDIA .. "bar")
end

local function newRow(pane)
  local r = CreateFrame("Button", nil, pane.body)
  r.mask = r:CreateMaskTexture()
  r.mask:SetTexture(MEDIA .. "mask_round8", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
  pcall(r.mask.SetTextureSliceMargins, r.mask, 8, 8, 8, 8)
  pcall(r.mask.SetTextureSliceMode, r.mask, 0)
  r.mask:SetAllPoints(r)
  r.track = r:CreateTexture(nil, "BACKGROUND")
  r.track:SetTexture("Interface\\Buttons\\WHITE8X8")
  r.track:SetAllPoints()
  r.track:AddMaskTexture(r.mask)
  r.sb = CreateFrame("StatusBar", nil, r)
  r.sb:SetAllPoints()
  r.sb:SetStatusBarTexture(barTexture())
  r.fill = r.sb:GetStatusBarTexture()
  r.fill:AddMaskTexture(r.mask)
  -- Neon-Funke am Ende des Balkens
  r.spark = r.sb:CreateTexture(nil, "OVERLAY")
  r.spark:SetTexture(UI.TEX.glow)
  r.spark:SetBlendMode("ADD")
  r.spark:SetPoint("CENTER", r.fill, "RIGHT", 0, 0)
  r.text = CreateFrame("Frame", nil, r)
  r.text:SetAllPoints()
  r.text:SetFrameLevel(r.sb:GetFrameLevel() + 2)
  r.rank = UI.Text(r.text, 12, "bold", C.muted)
  r.name = UI.Text(r.text, 13, "semibold", C.text)
  r.name:SetWordWrap(false)
  r.value = UI.Text(r.text, 13, "bold", C.text)
  r.value:SetJustifyH("RIGHT")
  r.unit = UI.Text(r.text, 12, "semibold", C.muted)
  r.sub = UI.Text(r.text, 12, "semibold", C.muted)
  r.sub:SetJustifyH("RIGHT")
  r.pct = UI.Text(r.text, 12, "semibold", C.muted)
  r.pct:SetJustifyH("RIGHT")
  r:SetScript("OnEnter", function(self) Meter.RowTooltip(pane, self) end)
  r:SetScript("OnLeave", function() GameTooltip:Hide() end)
  r:SetScript("OnMouseWheel", function(_, d) Meter.Scroll(pane, d) end)
  r:EnableMouseWheel(true)
  return r
end

local function styleRow(r)
  local look = L()
  local h = look.barH or 20
  local fs = look.font or 13
  r:SetHeight(h)
  r.sb:SetStatusBarTexture(barTexture())
  r.fill = r.sb:GetStatusBarTexture()
  r.fill:AddMaskTexture(r.mask)
  r.track:SetVertexColor(1, 1, 1, 0.06)
  r.spark:SetSize(h * 1.4, h * 1.6)
  r.spark:SetShown(look.barStyle == "neon")
  UI.SetFont(r.rank, fs - 1, "bold")
  UI.SetFont(r.name, fs, "semibold")
  UI.SetFont(r.value, fs, "bold")
  UI.SetFont(r.unit, fs - 2, "semibold")
  UI.SetFont(r.sub, fs - 1, "semibold")
  UI.SetFont(r.pct, fs - 1, "semibold")
  r.rank:ClearAllPoints()
  r.rank:SetPoint("LEFT", 7, 0)
  r.rank:SetWidth(18)
  r.pct:ClearAllPoints()
  r.pct:SetPoint("RIGHT", -8, 0)
  r.pct:SetWidth(36)
  r.sub:ClearAllPoints()
  r.sub:SetPoint("RIGHT", r.pct, "LEFT", -4, 0)
  r.unit:ClearAllPoints()
  r.unit:SetPoint("LEFT", r.sub, "RIGHT", 0, 0)
  r.value:ClearAllPoints()
  r.value:SetPoint("RIGHT", r.sub, "LEFT", -6, 0)
  r.name:ClearAllPoints()
  r.name:SetPoint("LEFT", r.rank, "RIGHT", 2, 0)
  r.name:SetPoint("RIGHT", r.value, "LEFT", -6, 0)
end

local function classColor(cls)
  local c = cls and not secret(cls) and RAID_CLASS_COLORS and RAID_CLASS_COLORS[cls]
  if c then return { c.r, c.g, c.b } end
end

local function lerp(a, b, t) return { a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t } end

local function fillRow(pane, r, row, i, n, wide)
  local t = theme()
  local col = (L().barColor == "klasse" and classColor(row.class)) or lerp(t[1], t[3], n > 1 and (i - 1) / (n - 1) or 0)
  local base = row.isSelf and 1 or 0.82
  r.sb:SetStatusBarColor(col[1] * base, col[2] * base, col[3] * base, 0.88)
  r.spark:SetVertexColor(col[1], col[2], col[3], 0.9)
  r.sb:SetMinMaxValues(0, row.barMax or 1)
  r.sb:SetValue(row.bar or 0)
  r.rank:SetText(tostring(row.index or i))
  r.name:SetText(row.name or "?")
  if row.isSelf then r.name:SetTextColor(1, 1, 1, 1) else r.name:SetTextColor(C.text[1], C.text[2], C.text[3], 1) end
  r.value:SetText(row.valueText or "")
  local showSub = wide and row.subText ~= nil
  r.sub:SetText(showSub and row.subText or "")
  r.unit:SetText(showSub and row.unit or (not showSub and row.unit == "%" and "%" or ""))
  if row.unit == "%" and not showSub then
    -- Aggro im Kampf: Prozentzeichen direkt hinter der (geheimen) Zahl
    r.unit:ClearAllPoints()
    r.unit:SetPoint("LEFT", r.value, "RIGHT", 1, 0)
  else
    r.unit:ClearAllPoints()
    r.unit:SetPoint("LEFT", r.sub, "RIGHT", 0, 0)
  end
  r.sub:SetWidth(showSub and 46 or 1)
  r.pct:SetText(wide and row.pctText or "")
  r.pct:SetWidth((wide and row.pctText) and 36 or 1)
  r.data = row
  r:Show()
end

----------------------------------------------------------------------------
-- Teil (Pane)
----------------------------------------------------------------------------
local Pane = {}
Pane.__index = Pane

local function iconButton(pane, icon, tip, fn)
  local b = UI.IconButton(pane.head, icon, 18, tip)
  b:SetScript("OnClick", function() UI.PlayClick() fn() end)
  pane.buttons[#pane.buttons + 1] = b
  return b
end

local function newPane(data)
  local p = setmetatable({ data = data, rows = {}, buttons = {}, offset = 0 }, Pane)
  local f = CreateFrame("Frame", "KampfWerkTeil" .. data.id, Group.frame)
  p.frame = f
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:SetResizable(true)
  f:SetResizeBounds(MIN_W, MIN_H, MAX_W, MAX_H)
  p.skin = makeSkin(f)

  local head = CreateFrame("Frame", nil, f)
  p.head = head
  head:SetPoint("TOPLEFT", 0, 0)
  head:SetPoint("TOPRIGHT", 0, 0)
  head:SetHeight(HEAD)
  head:EnableMouse(true)
  head:RegisterForDrag("LeftButton")
  head:SetScript("OnDragStart", function() p:StartMove() end)
  head:SetScript("OnDragStop", function() p:StopMove() end)
  head:SetScript("OnMouseUp", function(_, button)
    if button == "RightButton" and ns.Config then ns.Config.Open("teil" .. p.data.id) end
  end)
  p.sep = UI.Hairline(head, C.teal, 0.3, "ARTWORK", true)
  p.sep:SetPoint("BOTTOMLEFT", head, "BOTTOMLEFT", 12, 0)
  p.sep:SetPoint("BOTTOMRIGHT", head, "BOTTOMRIGHT", -12, 0)

  -- Titel = Ansicht waehlen
  p.titleBtn = UI.SafeButton(head)
  p.titleBtn:SetPoint("LEFT", 12, 0)
  p.titleBtn:SetHeight(HEAD)
  p.title = UI.Text(p.titleBtn, 11, "display", C.text)
  p.title:SetPoint("LEFT", 0, 0)
  p.title:SetWordWrap(false)
  p.chev = p.titleBtn:CreateTexture(nil, "ARTWORK")
  p.chev:SetTexture(UI.Icon("chevron"))
  p.chev:SetSize(10, 10)
  p.chev:SetRotation(-math.pi / 2)
  p.chev:SetPoint("LEFT", p.title, "RIGHT", 5, 0)
  p.titleBtn:SetScript("OnClick", function(self)
    UI.PlayClick()
    local items = {}
    for _, v in ipairs(Data.VIEWS) do items[#items + 1] = { value = v.key, label = v.label } end
    Meter.Pick(self, items, p.data.view, function(v) p.data.view = v p.offset = 0 Meter.Refresh(true) if ns.Config then ns.Config.Refresh() end end)
  end)
  UI.SetTooltip(p.titleBtn, "Ansicht waehlen", "Klick: Schaden, Heilung, Kicks, Aggro ... fuer diesen Teil.")

  -- Kampf-Abschnitt (Kapsel)
  p.sess = UI.SafeButton(head)
  p.sess:SetHeight(18)
  local shape = UI.PillShape(p.sess, 18, 2, false)
  p.sess.edge, p.sess.body = shape.edge, shape.body
  p.sess.text = UI.Text(p.sess, 11, "bold", C.text)
  p.sess.text:SetPoint("CENTER", 0, 0)
  p.sess:SetScript("OnClick", function(self)
    UI.PlayClick()
    Meter.Pick(self, Data.Sessions(), p.data.session, function(v) p.data.session = v p.offset = 0 Meter.Refresh(true) end)
  end)
  UI.SetTooltip(p.sess, "Kampf-Abschnitt", "Aktueller Kampf, Gesamt oder ein frueherer Kampf.")

  p.timer = UI.Text(head, 12, "semibold", C.muted)

  p.gear = iconButton(p, "gear", "Einstellungen", function() if ns.Config then ns.Config.Open("teil" .. p.data.id) end end)
  p.gear:SetPoint("RIGHT", head, "RIGHT", -8, 0)
  p.dock = iconButton(p, "detach", "Loesen / andocken", function() Meter.ToggleDock(p.data.id) end)
  p.dock:SetPoint("RIGHT", p.gear, "LEFT", -4, 0)
  p.reset = iconButton(p, "refresh", "Kampfdaten leeren", function() Data.Reset() end)
  p.reset:SetPoint("RIGHT", p.dock, "LEFT", -4, 0)
  p.timer:SetPoint("RIGHT", p.reset, "LEFT", -8, 0)
  p.sess:SetPoint("LEFT", p.chev, "RIGHT", 8, 0)

  -- Balken-Bereich
  p.body = CreateFrame("Frame", nil, f)
  p.body:SetPoint("TOPLEFT", 6, -HEAD - 4)
  p.body:SetPoint("BOTTOMRIGHT", -6, 6)
  p.body:EnableMouseWheel(true)
  p.body:SetScript("OnMouseWheel", function(_, d) Meter.Scroll(p, d) end)
  p.empty = UI.Text(p.body, 12, "semibold", C.dim)
  p.empty:SetPoint("TOPLEFT", 8, -6)
  p.empty:SetPoint("TOPRIGHT", -8, -6)
  p.empty:SetJustifyH("LEFT")
  p.empty:SetWordWrap(true)

  -- Groessen-Griff (nur geloest)
  p.grip = UI.SafeButton(f)
  p.grip:SetSize(18, 18)
  p.grip:SetPoint("BOTTOMRIGHT", -3, 3)
  p.grip.tex = p.grip:CreateTexture(nil, "OVERLAY")
  p.grip.tex:SetTexture(MEDIA .. "grip")
  p.grip.tex:SetAllPoints()
  p.grip:SetScript("OnMouseDown", function() if not ns.DB.frame.locked then f:StartSizing("BOTTOMRIGHT") end end)
  p.grip:SetScript("OnMouseUp", function() p:StopMove() end)
  UI.SetTooltip(p.grip, "Groesse aendern", "Ziehen, um diesen Teil groesser oder kleiner zu machen.")

  f:SetScript("OnSizeChanged", function() if Meter.ready then p:Draw() end end)
  Panes[data.id] = p
  return p
end

function Pane:StartMove()
  if ns.DB.frame.locked then return end
  if self.data.docked then Group.frame:StartMoving() else self.frame:StartMoving() end
  self.moving = true
end

function Pane:StopMove()
  self.moving = nil
  if self.data.docked then
    Group.frame:StopMovingOrSizing()
    Meter.SaveGroup()
  else
    self.frame:StopMovingOrSizing()
    local f, d = self.frame, self.data
    d.x, d.y = f:GetLeft(), f:GetBottom()
    d.w, d.h = f:GetWidth(), f:GetHeight()
    Meter.PlacePane(self)
  end
  Meter.Layout()
end

function Pane:Style()
  local t = theme()
  local view = Data.VIEW[self.data.view] or Data.VIEWS[1]
  self.viewDef = view
  local w = self.frame:GetWidth() or 300
  -- Platz: links 12, Pfeil 17, rechts drei Knoepfe 82, Uhr 44 (nur breit)
  local avail = w - 12 - 17 - 82 - (w > 340 and 44 or 0)
  local full = UI.Upper(view.label)
  -- Titel in Orbitron; passt er nicht, in der schmalen Rajdhani (gleiches Gross-Schrift-Bild)
  UI.SetFont(self.title, 12, "display")
  self.title:SetText(full)
  local tw = self.title:GetUnboundedStringWidth() or 0
  if tw > avail then
    UI.SetFont(self.title, 14, "bold")
    self.title:SetText(full)
    tw = self.title:GetUnboundedStringWidth() or 0
  end
  self.sess.text:SetText(UI.Upper(Data.SessionLabel(self.data.session)))
  local sw = math.max(54, (self.sess.text:GetUnboundedStringWidth() or 40) + 18)
  self.sess:SetWidth(sw)
  local chip = not view.threat and tw + sw + 10 <= avail
  UI.FitText(self.title, full, math.max(30, avail))
  self.title:SetText(UI.GradText(self.title:GetText() or "", t[1], t[3]))
  self.titleBtn:SetWidth(math.min(tw, avail) + 18)
  self.chev:SetVertexColor(t[2][1], t[2][2], t[2][3], 1)
  self.sess.edge:SetGradient({ t[1], t[2], t[3] }, 0.5)
  self.sess.body:SetGradientV({ 0.08, 0.10, 0.10, 0.9 }, { 0.04, 0.05, 0.05, 0.9 })
  self.sess:SetShown(chip)
  self.dock.icon:SetTexture(UI.Icon(self.data.docked and "detach" or "dock"))
  self.grip:SetShown(not self.data.docked and not ns.DB.frame.locked)
  self.grip.tex:SetVertexColor(t[1][1], t[1][2], t[1][3], 1)
  self.skin:SetShown(not self.data.docked)
  if not self.data.docked then self.skin:Apply() end
  for _, r in ipairs(self.rows) do styleRow(r) end
end

-- Balken zeichnen
function Pane:Draw()
  local look = L()
  local h = look.barH or 20
  local gap = look.gap or 3
  local bodyH = (self.frame:GetHeight() or 0) - HEAD - 10
  local count = math.max(0, math.floor((bodyH + gap) / (h + gap)))
  local res = Data.Get(self.data.view, self.data.session)
  self.res = res
  local rows = res.rows or {}
  local n = #rows
  self.offset = ns.Clamp(self.offset or 0, 0, math.max(0, n - count))
  -- eigene Zeile immer sichtbar (ersetzt die letzte sichtbare, wenn man weiter unten steht)
  local selfIdx
  if ns.DB.showSelf then
    for i, r in ipairs(rows) do if r.isSelf then selfIdx = i break end end
  end
  local wide = (self.frame:GetWidth() or 0) >= 230
  local shown = 0
  for slot = 1, count do
    local idx = slot + self.offset
    if slot == count and selfIdx and selfIdx > count + self.offset then idx = selfIdx end
    local row = rows[idx]
    local r = self.rows[slot]
    if row then
      if not r then
        r = newRow(self)
        styleRow(r)
        self.rows[slot] = r
      end
      r:ClearAllPoints()
      r:SetPoint("TOPLEFT", self.body, "TOPLEFT", 0, -(slot - 1) * (h + gap))
      r:SetPoint("TOPRIGHT", self.body, "TOPRIGHT", 0, -(slot - 1) * (h + gap))
      fillRow(self, r, row, idx, n, wide)
      shown = shown + 1
    elseif r then
      r:Hide()
    end
  end
  for i = count + 1, #self.rows do self.rows[i]:Hide() end
  if shown == 0 then
    self.empty:SetText(res.empty or "Noch keine Daten - los geht's!")
    self.empty:Show()
  else
    self.empty:Hide()
  end
  -- Uhr: eigene Kampfzeit (nie geheim) bzw. Dauer des gewaehlten Abschnitts
  local clock
  if self.viewDef and self.viewDef.threat then clock = nil
  elseif self.data.session == "current" then clock = Data.CombatClock()
  else clock = Data.Clock(res.duration) end
  self.timer:SetText(clock or "")
  self.timer:SetShown((self.frame:GetWidth() or 0) > 340)
end

function Meter.Scroll(p, delta)
  p.offset = (p.offset or 0) - delta
  p:Draw()
end

function Meter.RowTooltip(p, r)
  local row = r.data
  if not row then return end
  GameTooltip:SetOwner(r, "ANCHOR_LEFT")
  if secret(row.name) then
    GameTooltip:SetText("Kampf laeuft", 0.22, 1, 0.42)
    GameTooltip:AddLine("Details zu den Zaubern gibt es nach dem Kampf.", 0.8, 0.86, 0.84, true)
    GameTooltip:Show()
    return
  end
  GameTooltip:SetText(tostring(row.name or "?"), 0.22, 1, 0.42)
  local spells = Data.Spells(p.data.view, p.data.session, row)
  if spells then
    for i = 1, math.min(10, #spells) do
      local s = spells[i]
      GameTooltip:AddDoubleLine(s.name, Data.Num(s.amount) .. string.format("  (%d%%)", math.floor(s.pct + 0.5)), 1, 1, 1, 0.75, 1, 0.85)
    end
  elseif p.viewDef and p.viewDef.threat then
    GameTooltip:AddLine("Bedrohung auf dein aktuelles Ziel.", 0.8, 0.86, 0.84, true)
  else
    GameTooltip:AddLine("Details zu den Zaubern gibt es nach dem Kampf.", 0.8, 0.86, 0.84, true)
  end
  GameTooltip:Show()
end

----------------------------------------------------------------------------
-- Gruppe (das grosse, geteilte Fenster)
----------------------------------------------------------------------------
local function docked()
  local out = {}
  for _, d in ipairs(ns.DB.panes) do if d.docked and Panes[d.id] then out[#out + 1] = Panes[d.id] end end
  return out
end
Meter.Docked = docked

function Meter.SaveGroup()
  local f, d = Group.frame, ns.DB.frame
  d.x, d.y = f:GetLeft(), f:GetBottom()
  d.w, d.h = f:GetWidth(), f:GetHeight()
  Meter.PlaceGroup()
end

function Meter.PlaceGroup()
  local f, d = Group.frame, ns.DB.frame
  f:ClearAllPoints()
  f:SetPoint("BOTTOMLEFT", UIParent, "BOTTOMLEFT", d.x or 420, d.y or 40)
  f:SetSize(ns.Clamp(d.w or 560, MIN_W, MAX_W), ns.Clamp(d.h or 210, MIN_H, MAX_H))
end

function Meter.PlacePane(p)
  local f, d = p.frame, p.data
  f:SetParent(UIParent)
  f:ClearAllPoints()
  f:SetPoint("BOTTOMLEFT", UIParent, "BOTTOMLEFT", d.x or 600, d.y or 300)
  f:SetSize(ns.Clamp(d.w or 280, MIN_W, MAX_W), ns.Clamp(d.h or 200, MIN_H, MAX_H))
end

local function divider(i)
  local dv = Group.dividers[i]
  if dv then return dv end
  dv = UI.SafeButton(Group.frame)
  dv:SetWidth(DIV)
  dv.line = dv:CreateTexture(nil, "ARTWORK")
  dv.line:SetTexture(UI.TEX.fade)
  dv.line:SetWidth(1)
  dv.line:SetPoint("TOP", 0, -10)
  dv.line:SetPoint("BOTTOM", 0, 10)
  dv.line:SetBlendMode("ADD")
  dv.knob = dv:CreateTexture(nil, "OVERLAY")
  dv.knob:SetTexture(UI.TEX.circle)
  dv.knob:SetSize(6, 22)
  dv.knob:SetPoint("CENTER")
  dv:SetScript("OnEnter", function(self) self.hover = true Meter.PaintDividers() end)
  dv:SetScript("OnLeave", function(self) self.hover = nil Meter.PaintDividers() end)
  dv:SetScript("OnMouseDown", function(self)
    if ns.DB.frame.locked then return end
    local list = docked()
    local a, b = list[self.index], list[self.index + 1]
    if not a or not b then return end
    local scale = UIParent:GetEffectiveScale()
    self.drag = { x = GetCursorPosition() / scale, a = a, b = b, wa = a.frame:GetWidth(), wb = b.frame:GetWidth() }
    self:SetScript("OnUpdate", function(s)
      local dr = s.drag
      if not dr then return end
      local dx = GetCursorPosition() / scale - dr.x
      local total = dr.wa + dr.wb
      local wa = ns.Clamp(dr.wa + dx, MIN_W - 20, total - (MIN_W - 20))
      local sum = dr.a.data.share + dr.b.data.share
      dr.a.data.share = sum * wa / total
      dr.b.data.share = sum - dr.a.data.share
      Meter.Layout()
    end)
  end)
  dv:SetScript("OnMouseUp", function(self) self.drag = nil self:SetScript("OnUpdate", nil) Meter.Refresh(true) end)
  UI.SetTooltip(dv, "Teiler", "Ziehen: Breite der beiden Teile aendern.")
  Group.dividers[i] = dv
  return dv
end

function Meter.PaintDividers()
  local t = theme()
  for _, dv in ipairs(Group.dividers) do
    dv.line:SetVertexColor(t[2][1], t[2][2], t[2][3], dv.hover and 0.9 or 0.4)
    dv.knob:SetVertexColor(t[1][1], t[1][2], t[1][3], dv.hover and 0.95 or (Group.hover and 0.45 or 0))
  end
end

-- Teile im grossen Fenster nebeneinander anordnen
function Meter.Layout()
  if not Group.frame then return end
  local list = docked()
  local f = Group.frame
  local hidden = ns.DB.hidden
  f:SetShown(#list > 0 and not hidden)
  local W, H = f:GetWidth() or 0, f:GetHeight() or 0
  local sum = 0
  for _, p in ipairs(list) do sum = sum + (p.data.share or 1) end
  local avail = W - DIV * (#list - 1)
  local x = 0
  for i, p in ipairs(list) do
    local w = (i == #list) and (W - x) or math.floor(avail * (p.data.share or 1) / math.max(sum, 0.001) + 0.5)
    p.frame:SetParent(f)
    p.frame:ClearAllPoints()
    p.frame:SetPoint("TOPLEFT", f, "TOPLEFT", x, 0)
    p.frame:SetSize(math.max(w, 1), H)
    p.frame:SetShown(not hidden)
    x = x + w + DIV
    if i < #list then
      local dv = divider(i)
      dv.index = i
      dv:ClearAllPoints()
      dv:SetPoint("TOPLEFT", f, "TOPLEFT", x - DIV, 0)
      dv:SetHeight(H)
      dv:Show()
    end
  end
  for i = math.max(#list, 1), #Group.dividers do Group.dividers[i]:Hide() end
  for _, d in ipairs(ns.DB.panes) do
    local p = Panes[d.id]
    if p and not d.docked then
      if p.frame:GetParent() ~= UIParent or not p.placed then Meter.PlacePane(p) p.placed = true end
      p.frame:SetShown(not hidden)
    elseif p then
      p.placed = nil
    end
  end
  Group.grip:SetShown(not ns.DB.frame.locked and #list > 0)
  Meter.PaintDividers()
end

function Meter.ToggleDock(id)
  local p = Panes[id]
  if not p then return end
  local d = p.data
  if d.docked then
    -- loesen: bleibt genau dort, wo er gerade ist
    d.x, d.y = p.frame:GetLeft(), p.frame:GetBottom()
    d.w, d.h = p.frame:GetWidth(), p.frame:GetHeight()
    d.docked = false
    p.placed = nil
  else
    d.docked = true
    d.share = 1
  end
  Meter.Apply()
end

local function buildGroup()
  local f = CreateFrame("Frame", "KampfWerkFrame", UIParent)
  Group.frame = f
  Group.dividers = {}
  f:SetFrameStrata("LOW")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:SetResizable(true)
  f:SetResizeBounds(MIN_W, MIN_H, MAX_W, MAX_H)
  Group.skin = makeSkin(f)
  local grip = UI.SafeButton(f)
  Group.grip = grip
  grip:SetSize(18, 18)
  grip:SetPoint("BOTTOMRIGHT", -3, 3)
  grip:SetFrameLevel(f:GetFrameLevel() + 20)
  grip.tex = grip:CreateTexture(nil, "OVERLAY")
  grip.tex:SetTexture(MEDIA .. "grip")
  grip.tex:SetAllPoints()
  grip:SetScript("OnMouseDown", function() if not ns.DB.frame.locked then f:StartSizing("BOTTOMRIGHT") end end)
  grip:SetScript("OnMouseUp", function() f:StopMovingOrSizing() Meter.SaveGroup() Meter.Layout() Meter.Refresh(true) end)
  UI.SetTooltip(grip, "Groesse aendern", "Ziehen, um das ganze Fenster groesser oder kleiner zu machen.")
  f:SetScript("OnSizeChanged", function() if Meter.ready then Meter.Layout() end end)
end

----------------------------------------------------------------------------
-- Aufbau, Aussehen, Aktualisierung
----------------------------------------------------------------------------
function Meter.Rebuild()
  if not Group.frame then buildGroup() end
  local keep = {}
  for _, d in ipairs(ns.DB.panes) do
    keep[d.id] = true
    local p = Panes[d.id]
    if p then p.data = d else newPane(d) end
  end
  for id, p in pairs(Panes) do
    if not keep[id] then p.frame:Hide() Panes[id] = nil end
  end
  Meter.Apply()
end

-- Aufteilung: 1, 2 oder 3 Teile im Fenster (Tiry: "nur ein Fenster, nur Damage").
-- Beim Verkleinern bleibt ein Schaden-Teil zuerst erhalten; beim Vergroessern kommen Heilung, dann Kicks dazu.
local FILL = { "damage", "heal", "kicks", "dps", "hps" }
function Meter.SetCount(n)
  local list = ns.DB.panes
  local old = #list
  n = ns.Clamp(math.floor(n or 1), 1, 6)
  while #list > n do
    local drop = #list
    for i = #list, 1, -1 do if list[i].view ~= "damage" then drop = i break end end
    table.remove(list, drop)
  end
  while #list < n do
    local have = {}
    for _, d in ipairs(list) do have[d.view] = true end
    local view = "kicks"
    for _, v in ipairs(FILL) do if not have[v] then view = v break end end
    ns.NewPane(view)
  end
  -- Gesamtbreite mitziehen, damit ein einzelner Teil nicht riesig breit wird
  local docked = 0
  for _, d in ipairs(list) do if d.docked then docked = docked + 1 end end
  if old > 0 and n ~= old and docked > 0 then
    local f = ns.DB.frame
    f.w = ns.Clamp(math.floor((f.w or 600) * n / old + 0.5), 300, MAX_W)
  end
  Meter.Rebuild()
end

function Meter.Apply()
  if not Group.frame then return end
  Meter.PlaceGroup()
  Group.skin:Apply()
  local t = theme()
  Group.grip.tex:SetVertexColor(t[1][1], t[1][2], t[1][3], 1)
  Meter.Layout()
  for _, p in pairs(Panes) do p:Style() end
  Meter.Hover()
  Meter.Refresh(true)
end

function Meter.Refresh(force)
  if not Meter.ready then return end
  for _, d in ipairs(ns.DB.panes) do
    local p = Panes[d.id]
    if p and p.frame:IsShown() then
      if force then p:Style() end
      p:Draw()
    end
  end
  Data.dirty = false
end

-- Knoepfe nur bei Maus ueber dem Teil deutlich
function Meter.Hover()
  local always = ns.DB.alwaysHeader
  Group.hover = Group.frame and Group.frame:IsMouseOver() == true
  for _, p in pairs(Panes) do
    local on = always or p.frame:IsMouseOver() == true
    if on ~= p.hover or p.hover == nil then
      p.hover = on
      for _, b in ipairs(p.buttons) do b:SetAlpha(on and 1 or 0) b:EnableMouse(on) end
    end
  end
  Meter.PaintDividers()
end

local function tick()
  if not Meter.ready then return end
  Meter.Hover()
  local live = Data.dirty or (InCombatLockdown and InCombatLockdown())
  if not live then
    for _, p in pairs(Panes) do if p.data.view == "threat" and p.frame:IsShown() then live = true break end end
  end
  if live then Meter.Refresh(false) end
end
Meter.Tick = tick

function Meter.Build()
  Meter.Rebuild()
  Meter.ready = true
  Meter.Apply()
  if not Meter.ticker and C_Timer and C_Timer.NewTicker then
    Meter.ticker = C_Timer.NewTicker(0.25, function() ns.Safe(tick) end)
  end
end
