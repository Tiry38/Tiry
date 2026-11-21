-- ChatWerk: die Chatfenster. Glas-Flaeche, frei verschiebbar (Kopfleiste ziehen), Groesse an der Ecke ziehen,
-- Mausrad-Blaettern, anklickbare Links, "nach unten"-Knopf, optional Ausblenden nach x Sekunden.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local MEDIA = ns.MEDIA

ns.Windows = {}
local MIN_W, MIN_H, MAX_W, MAX_H = 200, 80, 1600, 1000
local HEAD = 24

local function fontFile()
  if ns.DB.font == "spiel" then return STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF" end
  return MEDIA .. "Fonts\\Poppins-Regular.ttf"
end

local Win = {}
Win.__index = Win

-- Text hinzufuegen (nicht geheim). Fehler im Fenster nie ins Spiel werfen.
function Win:Add(line, r, g, b)
  local ok = pcall(self.msg.AddMessage, self.msg, line, r or 1, g or 1, b or 1)
  if not ok then pcall(self.msg.AddMessage, self.msg, (tostring(line):gsub("|", "||")), r or 1, g or 1, b or 1) end
  self:Unread()
end

function Win:Unread()
  if not self.msg.AtBottom or self.msg:AtBottom() then return end
  self.down:Show()
end

function Win:Save()
  local f, d = self.frame, self.data
  local s = f:GetEffectiveScale() / UIParent:GetEffectiveScale()
  local l, b = f:GetLeft(), f:GetBottom()
  if l and b then d.x, d.y = math.floor(l * s + 0.5), math.floor(b * s + 0.5) end
  d.w, d.h = math.floor(f:GetWidth() + 0.5), math.floor(f:GetHeight() + 0.5)
end

function Win:Place()
  local f, d = self.frame, self.data
  f:ClearAllPoints()
  f:SetPoint("BOTTOMLEFT", UIParent, "BOTTOMLEFT", d.x or 20, d.y or 40)
  f:SetSize(ns.Clamp(d.w or 420, MIN_W, MAX_W), ns.Clamp(d.h or 200, MIN_H, MAX_H))
end

-- Aussehen + Verhalten aus den Einstellungen uebernehmen
function Win:Apply()
  local d, f, m = self.data, self.frame, self.msg
  self:Place()
  local a = ns.Clamp(d.alpha or 0.6, 0, 1)
  self.glass:SetBody({ 0.040, 0.050, 0.055, 0.96 }, { 0.070, 0.085, 0.090, 0.96 }, a)
  self.glass:SetShown(a > 0.01)
  self.glass:SetEdge("light", 0.05 + a * 0.28)
  local size = ns.Clamp(d.font or 13, 9, 24)
  local ok = pcall(m.SetFont, m, fontFile(), size, "")
  if not ok then pcall(m.SetFont, m, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", size, "") end
  m:SetShadowColor(0, 0, 0, 0.85)
  m:SetShadowOffset(1, -1)
  m:SetSpacing(ns.DB.spacing or 2)
  local fade = (d.fade or 0) > 0
  m:SetFading(fade)
  if fade then m:SetTimeVisible(d.fade) m:SetFadeDuration(2) end
  self.title:SetText(d.name or "Chat")
  self.lock.icon:SetTexture(UI.Icon(d.locked and "lock" or "unlock"))
  self.grip:SetShown(not d.locked)
  f:SetMovable(true)
  f:SetResizable(true)
  self:Hover(self.hover)
end

-- Kopfleiste + Griff nur beim Ueberfahren deutlich (Chat bleibt ruhig)
function Win:Hover(on)
  self.hover = on
  local d = self.data
  local show = on or ns.DB.alwaysHeader
  self.headBg:SetAlpha(show and 1 or 0)
  self.title:SetAlpha(show and 1 or (d.alpha or 0.6) > 0.15 and 0.55 or 0)
  self.dot:SetAlpha(show and 1 or 0.5)
  for _, b in ipairs(self.buttons) do b:SetAlpha(show and 1 or 0) b:EnableMouse(show) end
  self.grip:SetAlpha(show and 0.9 or 0)
  if ns.DB.mouseFade and (d.fade or 0) > 0 and on then pcall(self.msg.ResetAllFadeTimes, self.msg) end
end

local function iconButton(w, icon, tip, fn)
  local b = UI.IconButton(w.head, icon, 20, tip)
  b:SetScript("OnClick", function() UI.PlayClick() fn() end)
  w.buttons[#w.buttons + 1] = b
  return b
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

function ns.CreateWindow(data)
  local w = setmetatable({ data = data, buttons = {}, hover = false }, Win)
  local f = CreateFrame("Frame", "ChatWerkWindow" .. data.id, UIParent)
  w.frame = f
  f:SetFrameStrata("LOW")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:SetResizable(true)
  f:SetResizeBounds(MIN_W, MIN_H, MAX_W, MAX_H)
  f:EnableMouse(false)
  w.glass = UI.Glass(f, { radius = 16, sheen = 0.035, line = 0.18, edge = 0.2 })

  -- Kopfleiste: ziehen = verschieben, Rechtsklick = Einstellungen dieses Fensters
  local head = CreateFrame("Frame", nil, f)
  w.head = head
  head:SetPoint("TOPLEFT", 0, 0)
  head:SetPoint("TOPRIGHT", 0, 0)
  head:SetHeight(HEAD)
  head:EnableMouse(true)
  head:RegisterForDrag("LeftButton")
  w.headBg = UI.Round(head, 12, "BACKGROUND", 2, 3)
  w.headBg:SetGradient(UI.GRAD_EDGE or UI.GRAD, 0.10)
  w.dot = head:CreateTexture(nil, "ARTWORK")
  w.dot:SetTexture(UI.TEX.circle)
  w.dot:SetSize(7, 7)
  w.dot:SetPoint("LEFT", 12, 0)
  UI.SetGradV(w.dot, C.amber, C.teal, 1)
  w.title = UI.Text(head, 12, "semibold", C.text)
  w.title:SetPoint("LEFT", w.dot, "RIGHT", 7, 0)
  head:SetScript("OnDragStart", function()
    if not w.data.locked then f:StartMoving() end
  end)
  head:SetScript("OnDragStop", function()
    f:StopMovingOrSizing()
    w:Save()
    w:Place()
  end)
  head:SetScript("OnMouseUp", function(_, button)
    if button == "RightButton" and ns.Config then ns.Config.Open(w.data.id) end
  end)

  w.close = iconButton(w, "gear", "Einstellungen dieses Fensters", function() if ns.Config then ns.Config.Open(w.data.id) end end)
  w.close:SetPoint("RIGHT", head, "RIGHT", -6, -1)
  w.lock = iconButton(w, "unlock", "Fenster sperren / freigeben", function()
    w.data.locked = not w.data.locked
    w:Apply()
  end)
  w.lock:SetPoint("RIGHT", w.close, "LEFT", -4, 0)
  w.copy = iconButton(w, "copy", "Verlauf kopieren", function()
    if ns.Config and ns.Config.CopyHistory then ns.Config.CopyHistory(w.data.id) end
  end)
  w.copy:SetPoint("RIGHT", w.lock, "LEFT", -4, 0)

  -- Nachrichten
  local m = CreateFrame("ScrollingMessageFrame", nil, f)
  w.msg = m
  m:SetPoint("TOPLEFT", 12, -HEAD - 2)
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
    if IsControlKeyDown and IsControlKeyDown() then
      if delta > 0 then self:ScrollToTop() else self:ScrollToBottom() end
    elseif IsShiftKeyDown and IsShiftKeyDown() then
      if delta > 0 then self:PageUp() else self:PageDown() end
    else
      self:ScrollByAmount(delta * (ns.DB.wheelLines or 3))
    end
    if self:AtBottom() then w.down:Hide() else w.down:Show() end
  end)
  if m.SetOnScrollChangedCallback then
    m:SetOnScrollChangedCallback(function() if m:AtBottom() then w.down:Hide() end end)
  end

  -- "Neue Nachrichten unten": runde Neon-Kugel unten rechts
  local down = UI.IconButton(f, "down", 26, "Nach unten")
  w.down = down
  down:SetPoint("BOTTOMRIGHT", -18, 12)
  down:SetFrameLevel(m:GetFrameLevel() + 5)
  down:SetScript("OnClick", function() UI.PlayClick() m:ScrollToBottom() down:Hide() end)
  down:Hide()

  -- Groessen-Griff unten rechts
  local grip = UI.SafeButton(f)
  w.grip = grip
  grip:SetSize(18, 18)
  grip:SetPoint("BOTTOMRIGHT", -3, 3)
  grip:SetFrameLevel(m:GetFrameLevel() + 6)
  grip.tex = grip:CreateTexture(nil, "OVERLAY")
  grip.tex:SetTexture(MEDIA .. "grip")
  grip.tex:SetAllPoints()
  grip.tex:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 1)
  grip:SetScript("OnMouseDown", function()
    if not w.data.locked then f:StartSizing("BOTTOMRIGHT") end
  end)
  grip:SetScript("OnMouseUp", function()
    f:StopMovingOrSizing()
    w:Save()
    w:Place()
  end)
  UI.SetTooltip(grip, "Groesse aendern", "Ziehen, um das Fenster groesser oder kleiner zu machen.")

  f:SetScript("OnSizeChanged", function() if w.down:IsShown() and m:AtBottom() then w.down:Hide() end end)

  -- Verlauf zurueckholen
  local h = ns.DB.history and ns.CDB.hist[data.id]
  if h and #h > 0 then
    for _, e in ipairs(h) do pcall(m.AddMessage, m, e[1], e[2], e[3], e[4]) end
    pcall(m.AddMessage, m, "|cff4d5a57- - - - - - - -  Verlauf  - - - - - - - -|r", 1, 1, 1)
  end
  ns.Windows[data.id] = w
  w:Apply()
  return w
end

-- Ueberfahren erkennen (ein Takt fuer alle Fenster)
local function tick()
  for _, w in pairs(ns.Windows) do
    if w.frame:IsShown() then
      local over = w.frame:IsMouseOver() == true
      if over ~= w.hover then w:Hover(over) end
    end
  end
end

-- Alle Fenster an die Einstellungen anpassen: neue bauen, geloeschte verstecken
function ns.BuildWindows()
  local keep = {}
  for _, d in ipairs(ns.DB.windows) do
    keep[d.id] = true
    local w = ns.Windows[d.id]
    if w then
      w.data = d
      w.frame:Show()
      w:Apply()
    else
      ns.CreateWindow(d)
    end
  end
  for id, w in pairs(ns.Windows) do
    if not keep[id] then
      w.frame:Hide()
      ns.Windows[id] = nil
    end
  end
  if not ns.ticker and C_Timer and C_Timer.NewTicker then ns.ticker = C_Timer.NewTicker(0.12, function() ns.Safe(tick) end) end
  if ns.Blizzard and ns.Blizzard.Anchor then ns.Blizzard.Anchor() end
end
ns.WindowTick = tick
