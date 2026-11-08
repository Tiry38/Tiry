-- Tiry's Zentrale – Hauptfenster mit Menü, Seitenverwaltung, Minikarten-Knopf, Befehle
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C

local WIDTH, HEIGHT = 940, 600
local SIDE_W = 214
local PAD = 26
UI.CONTENT_W = WIDTH - SIDE_W - PAD * 2 - 14 -- nutzbare Breite einer Seite (ohne Scrollleiste)

UI.pages = {}
UI.order = {}

-- Seiten melden sich hier an: key, { title, subtitle, icon, label, build(page, content, width), refresh(page) }
function UI.RegisterPage(key, def)
  def.key = key
  UI.pages[key] = def
  table.insert(UI.order, def)
  table.sort(UI.order, function(a, b) return (a.order or 99) < (b.order or 99) end)
end

----------------------------------------------------------------------------
-- Fenster
----------------------------------------------------------------------------
local frame

local function savePosition()
  local point, _, relPoint, x, y = frame:GetPoint(1)
  ns.settings.point = { point, relPoint, x, y }
end

local function buildBackground(f)
  f.bg = UI.Round(f, 22, "BACKGROUND", -8)
  f.bg:SetColor(C.bg)

  -- Leuchtende, langsam treibende Farbflächen (Glas-Effekt)
  local clip = CreateFrame("Frame", nil, f)
  clip:SetPoint("TOPLEFT", 10, -10)
  clip:SetPoint("BOTTOMRIGHT", -10, 10)
  clip:SetClipsChildren(true)
  clip:SetFrameLevel(f:GetFrameLevel())
  local blobs = {
    { tex = UI.TEX.blob1, color = C.amber, size = 420, x = 120, y = -40, a = 0.16, dx = 60, dy = -30, d = 9 },
    { tex = UI.TEX.blob2, color = C.rose, size = 380, x = 640, y = -330, a = 0.13, dx = -50, dy = 40, d = 11 },
    { tex = UI.TEX.blob1, color = C.violet, size = 460, x = 520, y = 40, a = 0.14, dx = -40, dy = -50, d = 13 },
    { tex = UI.TEX.blob2, color = C.teal, size = 300, x = -60, y = -380, a = 0.10, dx = 50, dy = 30, d = 10 },
  }
  for _, b in ipairs(blobs) do
    local t = clip:CreateTexture(nil, "BACKGROUND", nil, -7)
    t:SetTexture(b.tex)
    t:SetBlendMode("ADD")
    t:SetVertexColor(b.color[1], b.color[2], b.color[3], b.a)
    t:SetSize(b.size, b.size)
    t:SetPoint("TOPLEFT", clip, "TOPLEFT", b.x, b.y)
    UI.Drift(t, b.dx, b.dy, b.d, 1, 0.55)
  end

  -- Seitenleiste als eigene Glasfläche
  local side = CreateFrame("Frame", nil, f)
  side:SetPoint("TOPLEFT", 10, -10)
  side:SetPoint("BOTTOMLEFT", 10, 10)
  side:SetWidth(SIDE_W - 10)
  side.bg = UI.Round(side, 18, "BACKGROUND", -5)
  side.bg:SetColor(C.side)
  f.side = side

  -- Welle als Zierde unten in der Seitenleiste
  local wave = side:CreateTexture(nil, "BACKGROUND", nil, -4)
  wave:SetTexture(UI.TEX.wave)
  wave:SetPoint("BOTTOMLEFT", 0, 0)
  wave:SetPoint("BOTTOMRIGHT", 0, 0)
  wave:SetHeight(56)
  pcall(wave.SetGradient, wave, "HORIZONTAL", CreateColor(C.gold[1], C.gold[2], C.gold[3], 0.22), CreateColor(C.rose[1], C.rose[2], C.rose[3], 0.22))
end

local function buildSidebar(f)
  local side = f.side
  local logo = side:CreateTexture(nil, "ARTWORK")
  logo:SetTexture(UI.TEX.logo)
  logo:SetSize(46, 46)
  logo:SetPoint("TOPLEFT", 16, -16)
  local logoGlow = UI.Glow(side, C.amber, 120, 0.45, "BACKGROUND")
  logoGlow:SetPoint("CENTER", logo, "CENTER")
  UI.Drift(logoGlow, 0, 0, 3, 0.45, 0.15)

  local spark = side:CreateTexture(nil, "OVERLAY")
  spark:SetTexture(UI.TEX.sparkle)
  spark:SetSize(14, 14)
  spark:SetPoint("TOPRIGHT", logo, "TOPRIGHT", 4, 4)
  UI.Drift(spark, 0, 0, 1.6, 1, 0.1)

  local mark = side:CreateTexture(nil, "ARTWORK")
  mark:SetTexture(UI.TEX.wordmark)
  mark:SetSize(136, 34)
  mark:SetPoint("LEFT", logo, "RIGHT", 4, 4)
  local sub = UI.Text(side, 10, "semibold", C.dim)
  sub:SetPoint("TOPLEFT", mark, "BOTTOMLEFT", 8, 4)
  sub:SetText("GOLD & BERUFE · WOW FOREVER")

  f.nav = {}
  local y = -86
  for _, def in ipairs(UI.order) do
    local b = CreateFrame("Button", nil, side)
    b:SetSize(SIDE_W - 34, 34)
    b:SetPoint("TOPLEFT", 12, y)
    b.key = def.key
    b.bg = UI.Round(b, 17, "BACKGROUND", 0)
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetTexture(UI.Icon(def.icon))
    b.icon:SetSize(18, 18)
    b.icon:SetPoint("LEFT", 16, 0)
    b.text = UI.Text(b, 13, "semibold", C.muted)
    b.text:SetPoint("LEFT", b.icon, "RIGHT", 12, 0)
    b.text:SetText(def.label or def.title)
    b.badge = UI.Chip(b, "", C.rose, true)
    b.badge:SetPoint("RIGHT", -10, 0)
    b.badge:Hide()
    function b:Paint()
      local active = (UI.current == self.key)
      if active then
        self.bg:SetGradient(UI.GRAD, 1)
        self.bg:SetShown(true)
        self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
        self.icon:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
      elseif self:IsMouseOver() then
        self.bg:SetColor(C.cardHi, 0.9)
        self.bg:SetShown(true)
        self.text:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
        self.icon:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], 1)
      else
        self.bg:SetShown(false)
        self.text:SetTextColor(C.muted[1], C.muted[2], C.muted[3], 1)
        self.icon:SetVertexColor(C.muted[1], C.muted[2], C.muted[3], 1)
      end
    end
    b:SetScript("OnEnter", b.Paint)
    b:SetScript("OnLeave", b.Paint)
    b:SetScript("OnClick", function(self)
      UI.PlayClick()
      UI.Show(self.key)
    end)
    f.nav[def.key] = b
    y = y - 37
  end

  -- Auctionator-Status unten
  local status = CreateFrame("Frame", nil, side)
  status:SetSize(SIDE_W - 34, 44)
  status:SetPoint("BOTTOMLEFT", 12, 16)
  status.bg = UI.Round(status, 14, "BACKGROUND", 1)
  status.bg:SetColor(C.inset, 0.95)
  status.dot = status:CreateTexture(nil, "ARTWORK")
  status.dot:SetTexture(UI.TEX.circle)
  status.dot:SetSize(10, 10)
  status.dot:SetPoint("LEFT", 12, 0)
  status.text = UI.Para(status, 10, C.muted, SIDE_W - 70, "semibold")
  status.text:SetPoint("LEFT", status.dot, "RIGHT", 9, 0)
  UI.SetTooltip(status, function()
    local state, text = ns.Market.Status()
    if state == "missing" then
      return "Auctionator fehlt", "Installiere Auctionator (Version für WoW Forever). Dann zeigt Tiry's Zentrale echte Preise deines Servers."
    elseif state == "empty" then
      return "Noch keine Preise", "Geh zum Auktionator (Auktionshaus), öffne den Reiter 'Auctionator' und klicke auf 'Vollständiger Scan'. Danach siehst du überall Live-Preise."
    end
    return "Alles bereit", text
  end)
  f.status = status
end

function UI.UpdateStatus()
  if not frame then return end
  local state, text = ns.Market.Status()
  local c = (state == "ok" and C.green) or (state == "empty" and C.gold) or C.red
  frame.status.dot:SetVertexColor(c[1], c[2], c[3], 1)
  frame.status.text:SetText(state == "ok" and "Live-Preise aktiv" or (state == "empty" and "AH einmal scannen" or "Auctionator fehlt"))
  frame.scanInfo:SetText(ns.Market.LastScanText())
end

local function buildHeader(f)
  local h = CreateFrame("Frame", nil, f)
  h:SetPoint("TOPLEFT", SIDE_W + PAD - 4, -18)
  h:SetPoint("TOPRIGHT", -PAD, -18)
  h:SetHeight(58)
  h.title = UI.Text(h, 24, "bold", C.text)
  h.title:SetPoint("TOPLEFT", 0, -2)
  h.sub = UI.Text(h, 12, "regular", C.muted)
  h.sub:SetPoint("TOPLEFT", h.title, "BOTTOMLEFT", 0, -5)
  h.sub:SetWidth(WIDTH - SIDE_W - PAD * 2 - 200)
  h.sub:SetWordWrap(false)
  f.header = h

  local close = UI.IconButton(f, "close", 30, "Schließen")
  close:SetPoint("TOPRIGHT", -18, -18)
  close:SetScript("OnClick", function() f:Hide() end)

  -- AH-Scan per Klick (startet Auctionators Scan) + Stand der Preise
  local scan = UI.Button(f, "AH scannen", "cool", 136, 30, "refresh")
  scan:SetPoint("RIGHT", close, "LEFT", -10, 0)
  scan:SetScript("OnClick", function() ns.Market.StartScan() end)
  UI.SetTooltip(scan, function()
    return "Preise aktualisieren", "Am offenen Auktionshaus: startet den Auctionator-Scan. Tiry's Zentrale erkennt jeden Scan automatisch – "
      .. "auch wenn du direkt in Auctionator scannst.\n\nStand: " .. ns.Market.LastScanText()
  end)
  f.scanBtn = scan
  f.scanInfo = UI.Text(f, 10, "semibold", C.dim)
  f.scanInfo:SetPoint("TOPRIGHT", scan, "BOTTOMRIGHT", -4, -6)

  -- Verlaufslinie unter der Überschrift
  local line = f:CreateTexture(nil, "ARTWORK")
  line:SetTexture("Interface\\Buttons\\WHITE8X8")
  line:SetHeight(2)
  line:SetPoint("TOPLEFT", h, "BOTTOMLEFT", 0, -2)
  line:SetWidth(120)
  pcall(line.SetGradient, line, "HORIZONTAL", CreateColor(C.gold[1], C.gold[2], C.gold[3], 1), CreateColor(C.rose[1], C.rose[2], C.rose[3], 0))
end

local function createFrame()
  local f = CreateFrame("Frame", "TirysZentraleMainFrame", UIParent)
  f:SetSize(WIDTH, HEIGHT)
  f:SetFrameStrata("HIGH")
  f:SetToplevel(true)
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    savePosition()
  end)
  f:SetScale(ns.Clamp(tonumber(ns.settings.scale) or 1, 0.7, 1.3))
  local p = ns.settings.point
  if type(p) == "table" and p[1] then
    f:SetPoint(p[1], UIParent, p[2] or p[1], p[3] or 0, p[4] or 0)
  else
    f:SetPoint("CENTER")
  end
  f:Hide()
  tinsert(UISpecialFrames, "TirysZentraleMainFrame") -- ESC schließt das Fenster

  buildBackground(f)
  buildSidebar(f)
  buildHeader(f)

  -- Inhaltsbereich
  local body = CreateFrame("Frame", nil, f)
  body:SetPoint("TOPLEFT", SIDE_W + PAD - 4, -92)
  body:SetPoint("BOTTOMRIGHT", -PAD + 10, 18)
  f.body = body

  f:SetScript("OnShow", function()
    if PlaySound and SOUNDKIT then pcall(PlaySound, SOUNDKIT.IG_MAINMENU_OPEN) end
    UI.UpdateAnimations()
    UI.UpdateStatus()
    if UI.current and UI.pages[UI.current] then UI.RefreshPage(UI.current) end
  end)
  f:SetScript("OnHide", function()
    if PlaySound and SOUNDKIT then pcall(PlaySound, SOUNDKIT.IG_MAINMENU_CLOSE) end
    ns.Scanner.bagsWanted = false
  end)
  frame = f
  UI.frame = f
  return f
end

----------------------------------------------------------------------------
-- Seiten
----------------------------------------------------------------------------
local function ensurePage(key)
  local def = UI.pages[key]
  if not def then return nil end
  if def.frame then return def end
  local page = CreateFrame("Frame", nil, frame.body)
  page:SetAllPoints()
  page:Hide()
  local scroll, content = UI.Scroll(page)
  scroll:SetAllPoints()
  content:SetWidth(UI.CONTENT_W)
  page.scroll, page.content = scroll, content
  def.frame = page
  ns.Safe(def.build, def, content, UI.CONTENT_W)
  return def
end

function UI.RefreshPage(key)
  local def = UI.pages[key]
  if def and def.frame and def.refresh then
    ns.Safe(def.refresh, def)
    if def.frame.scroll.UpdateBar then def.frame.scroll.UpdateBar() end
  end
end

function UI.Show(key)
  if not frame then createFrame() end
  if not UI.pages[key] then key = "home" end
  for k, def in pairs(UI.pages) do
    if def.frame then def.frame:SetShown(k == key) end
  end
  UI.current = key
  local def = ensurePage(key)
  if def then
    def.frame:Show()
    frame.header.title:SetText(def.title)
    frame.header.sub:SetText(def.subtitle or "")
    UI.RefreshPage(key)
  end
  for _, b in pairs(frame.nav) do b:Paint() end
  ns.settings.lastPage = key
  if not frame:IsShown() then frame:Show() end
end

function UI.ToggleWindow()
  if frame and frame:IsShown() then
    frame:Hide()
  else
    UI.Show(ns.settings.lastPage or "home")
  end
end

function UI.IsShown(key)
  return frame and frame:IsShown() and UI.current == key
end

function UI.SetBadge(key, text)
  if not frame or not frame.nav[key] then return end
  local badge = frame.nav[key].badge
  if text and text ~= "" then
    badge:Set(text, C.rose, true)
    badge:Show()
  else
    badge:Hide()
  end
end

function UI.ApplyScale()
  if frame then frame:SetScale(ns.Clamp(tonumber(ns.settings.scale) or 1, 0.7, 1.3)) end
end

-- Seiten bei neuen Daten aktualisieren (nur die sichtbare)
local function refreshVisible()
  if frame and frame:IsShown() and UI.current then
    UI.RefreshPage(UI.current)
    UI.UpdateStatus()
  end
end
for _, msg in ipairs({ "PRICES_UPDATED", "ITEMS_UPDATED", "PROFESSIONS_CHANGED", "PLAYER_CHANGED",
  "MERCHANT_SCANNED", "BAGS_SCANNED", "RECIPES_SCANNED", "AH_STATE", "LOOT_VALUED" }) do
  ns.Listen(msg, function() ns.Debounce("refresh", 0.15, refreshVisible) end)
end
ns.Listen("MONEY_CHANGED", function()
  if UI.IsShown("tracker") or UI.IsShown("home") then ns.Debounce("refresh", 0.3, refreshVisible) end
end)
ns.Listen("MERCHANT_SCANNED", function()
  local n = #ns.Scanner.merchant.flips
  UI.SetBadge("scanner", (ns.Scanner.merchant.open and n > 0) and tostring(n) or nil)
end)

----------------------------------------------------------------------------
-- Minikarten-Knopf (rund, frei um die Karte ziehbar)
----------------------------------------------------------------------------
local mini
local function placeMini()
  local angle = math.rad(ns.settings.minimap.angle or 205)
  local radius = (Minimap:GetWidth() or 140) / 2 + 6
  mini:ClearAllPoints()
  mini:SetPoint("CENTER", Minimap, "CENTER", math.cos(angle) * radius, math.sin(angle) * radius)
end

local function createMini()
  if mini or not Minimap then return end
  mini = CreateFrame("Button", "TirysZentraleMinimapButton", Minimap)
  mini:SetSize(34, 34)
  mini:SetFrameStrata("MEDIUM")
  mini:SetFrameLevel(Minimap:GetFrameLevel() + 8)
  mini:RegisterForClicks("LeftButtonUp", "RightButtonUp")
  mini:RegisterForDrag("LeftButton")
  local bg = mini:CreateTexture(nil, "BACKGROUND")
  bg:SetTexture(UI.TEX.circle)
  bg:SetAllPoints()
  bg:SetVertexColor(C.bg[1], C.bg[2], C.bg[3], 0.95)
  local icon = mini:CreateTexture(nil, "ARTWORK")
  icon:SetTexture(UI.TEX.logo)
  icon:SetPoint("TOPLEFT", 3, -3)
  icon:SetPoint("BOTTOMRIGHT", -3, 3)
  local hl = UI.Glow(mini, C.gold, 64, 0, "OVERLAY")
  hl:SetPoint("CENTER")
  mini:SetScript("OnEnter", function(self)
    hl:SetAlpha(0.55)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:SetText("Tiry's Zentrale", 1, 0.84, 0.29)
    GameTooltip:AddLine("Linksklick: Gold-Guide öffnen", 0.9, 0.9, 1)
    GameTooltip:AddLine("Rechtsklick: Scanner (Händler & Taschen)", 0.9, 0.9, 1)
    GameTooltip:AddLine("Ziehen: Knopf verschieben", 0.7, 0.7, 0.85)
    GameTooltip:Show()
  end)
  mini:SetScript("OnLeave", function()
    hl:SetAlpha(0)
    GameTooltip:Hide()
  end)
  mini:SetScript("OnClick", function(_, button)
    if button == "RightButton" then
      UI.Show("scanner")
    else
      UI.ToggleWindow()
    end
  end)
  mini:SetScript("OnDragStart", function(self)
    self:SetScript("OnUpdate", function()
      local mx, my = Minimap:GetCenter()
      local cx, cy = GetCursorPosition()
      local scale = Minimap:GetEffectiveScale() or 1
      cx, cy = cx / scale, cy / scale
      ns.settings.minimap.angle = math.deg(math.atan2(cy - my, cx - mx))
      placeMini()
    end)
  end)
  mini:SetScript("OnDragStop", function(self) self:SetScript("OnUpdate", nil) end)
  placeMini()
end

function UI.UpdateMinimap()
  if ns.settings.minimap.show then
    createMini()
    if mini then mini:Show() end
  elseif mini then
    mini:Hide()
  end
end

----------------------------------------------------------------------------
-- Start, Befehle, Addon-Menü (Minikarte)
----------------------------------------------------------------------------
ns.Listen("LOGIN", function()
  ns.Safe(UI.UpdateMinimap)
  if not ns.settings.welcomeShown then
    ns.settings.welcomeShown = true
    C_Timer.After(6, function()
      ns.Print("Willkommen! Tippe |cffffd24a/tz|r oder klick auf die Goldmünze an der Minikarte.")
    end)
  end
end)

SLASH_TIRYSZENTRALE1 = "/tz"
SLASH_TIRYSZENTRALE2 = "/zentrale"
SLASH_TIRYSZENTRALE3 = "/gold"
SlashCmdList.TIRYSZENTRALE = function(msg)
  msg = strtrim and strtrim((msg or ""):lower()) or (msg or ""):lower()
  local map = {
    [""] = nil, start = "home", home = "home", wege = "methods", methoden = "methods", guide = "methods",
    markt = "market", preise = "market", db = "database", datenbank = "database", suche = "database", items = "database", scan = "scanner", scanner = "scanner", taschen = "scanner",
    rezepte = "recipes", craft = "recipes", crafting = "recipes", farm = "farm", farmen = "farm", kuerschner = "skinning", ["kürschner"] = "skinning", leder = "skinning", skin = "skinning", tagebuch = "tracker", tracker = "tracker",
    schule = "basics", ah = "basics", hilfe = "basics", optionen = "settings", einstellungen = "settings",
  }
  if msg == "leeren" then
    UI.pages.recipes.ClearQueue()
    return
  end
  if msg == "craftcheck" then
    UI.pages.recipes.CraftCheck()
    return
  end
  if msg == "minimap" then
    ns.settings.minimap.show = not ns.settings.minimap.show
    UI.UpdateMinimap()
    ns.Print("Minikarten-Knopf " .. (ns.settings.minimap.show and "an." or "aus."))
    return
  elseif msg == "reset" then
    ns.settings.point = nil
    if frame then
      frame:ClearAllPoints()
      frame:SetPoint("CENTER")
    end
    ns.Print("Fensterposition zurückgesetzt.")
    return
  end
  if msg == "" then
    UI.ToggleWindow()
  else
    UI.Show(map[msg] or "home")
  end
end

-- Eintrag im Addon-Menü der Minikarte (Forever hat das moderne Addon-Fach)
function TirysZentrale_OnAddonCompartmentClick(_, button)
  if button == "RightButton" then
    UI.Show("scanner")
  else
    UI.ToggleWindow()
  end
end

function TirysZentrale_OnAddonCompartmentEnter(_, menuButton)
  GameTooltip:SetOwner(menuButton or UIParent, "ANCHOR_LEFT")
  GameTooltip:SetText("Tiry's Zentrale", 1, 0.84, 0.29)
  GameTooltip:AddLine("Linksklick: Gold-Guide · Rechtsklick: Scanner", 0.9, 0.9, 1)
  GameTooltip:Show()
end

function TirysZentrale_OnAddonCompartmentLeave()
  GameTooltip:Hide()
end
