-- Tiry's Zentrale – Hauptfenster mit Menü, Seitenverwaltung, Minikarten-Knopf, Befehle
local _, ns = ...
local UI = ns.UI
local C = UI.C

local WIDTH, HEIGHT = 1140, 720 -- groß und luftig; passt sich kleinen Bildschirmen automatisch an
UI.WIDTH, UI.HEIGHT = WIDTH, HEIGHT
local SIDE_W = 214
local PAD = 26
UI.CONTENT_W = WIDTH - SIDE_W - PAD * 2 - 14 -- nutzbare Breite einer Seite (ohne Scrollleiste)

UI.pages = {}
UI.order = {}

-- Menü: 7 Hauptpunkte, darunter Reiter (Ansichten). Ansichten, die es nicht gibt, werden übersprungen.
UI.GROUPS = {
  { key = "start", label = "Start", icon = "home", views = { { "home", "Goldplan" }, { "methods", "Goldwege" } } },
  { key = "farmen", label = "Farmen", icon = "pin", views = { { "farm", "Farm-Guide" }, { "skinning", "Kürschner" }, { "session", "Farm-Session" } } },
  { key = "berufe", label = "Berufe", icon = "flask", views = { { "recipes", "Craft-Planer" }, { "advisor", "Berufe-Berater" } } },
  { key = "markt", label = "Markt", icon = "coins", views = { { "market", "Preise" }, { "alerts", "Preisalarm" }, { "scanner", "Taschen & Händler" }, { "database", "Item-Suche" } } },
  { key = "gold", label = "Mein Gold", icon = "chart", views = { { "tracker", "Goldtagebuch" }, { "ledger", "Verkaufsbuch" } } },
  { key = "lernen", label = "Lernen", icon = "book", views = { { "basics", "AH-Schule" }, { "glossary", "Glossar" } } },
  { key = "settings", label = "Einstellungen", icon = "gear", views = { { "settings", "Einstellungen" } } },
}

-- Zu welchem Hauptpunkt gehört eine Ansicht?
function UI.GroupOf(viewKey)
  for _, g in ipairs(UI.GROUPS) do
    for _, v in ipairs(g.views) do
      if v[1] == viewKey then return g end
    end
  end
end

local function availableViews(g)
  local out = {}
  for _, v in ipairs(g.views) do
    if UI.pages[v[1]] then out[#out + 1] = { value = v[1], label = v[2] } end
  end
  return out
end
UI.AvailableViews = availableViews

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

-- Andocken: liegt das Fenster nach dem Ziehen nah (< 30 px) an einem Bildschirmrand oder der Mitte, rastet es dort ein
local SNAP = 30
local function snap(f)
  local s = f:GetEffectiveScale() / UIParent:GetEffectiveScale()
  local l, t = f:GetLeft() * s, f:GetTop() * s
  local w, h = f:GetWidth() * s, f:GetHeight() * s
  local sw, sh = UIParent:GetWidth(), UIParent:GetHeight()
  if not (l and t and sw and sh) then return end
  local x, y = l, t
  if math.abs(l) < SNAP then x = 0 elseif math.abs(sw - (l + w)) < SNAP then x = sw - w
  elseif math.abs((l + w / 2) - sw / 2) < SNAP then x = (sw - w) / 2 end
  if math.abs(sh - t) < SNAP then y = sh elseif math.abs(t - h) < SNAP then y = h
  elseif math.abs((t - h / 2) - sh / 2) < SNAP then y = (sh + h) / 2 end
  if x ~= l or y ~= t then
    f:ClearAllPoints()
    f:SetPoint("TOPLEFT", UIParent, "BOTTOMLEFT", x / s, y / s)
  end
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
  -- Horde-Stil: Stammesmuster, Zacken-Ecken, großes Kriegsemblem unten rechts (alles sehr dezent)
  UI.Ornaments(f, { w = WIDTH, h = HEIGHT, pattern = 0.045, corners = 0.32, cornerSize = 84, inset = 6 })
  local emblem = clip:CreateTexture(nil, "BACKGROUND", nil, -6)
  emblem:SetTexture(UI.TEX.emblem)
  emblem:SetSize(440, 440)
  emblem:SetPoint("CENTER", clip, "BOTTOMRIGHT", -260, 250)
  emblem:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 0.07)
  UI.Drift(emblem, 0, 0, 7, 1, 0.6)
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
  sub:SetPoint("TOPLEFT", logo, "BOTTOMLEFT", 2, -6)
  sub:SetWidth(SIDE_W - 44)
  sub:SetJustifyH("LEFT")
  sub:SetWordWrap(false)
  sub:SetText("GOLD · BERUFE · FOREVER")

  -- Globale Suche (auch per Tastenkürzel)
  local search = UI.SafeButton(side)
  search:SetSize(SIDE_W - 34, 34)
  search:SetPoint("TOPLEFT", 12, -88)
  search.bg = UI.Round(search, 17, "BACKGROUND", 0)
  search.bg:SetColor(C.inset, 1)
  search.icon = search:CreateTexture(nil, "ARTWORK")
  search.icon:SetTexture(UI.Icon("scan"))
  search.icon:SetSize(15, 15)
  search.icon:SetPoint("LEFT", 16, 0)
  search.icon:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], 1)
  search.text = UI.Text(search, 13, "regular", C.dim)
  search.text:SetPoint("LEFT", search.icon, "RIGHT", 10, 0)
  search.text:SetText("Suchen ...")
  search:SetScript("OnEnter", function(self) self.bg:SetColor(C.cardHi, 1) end)
  search:SetScript("OnLeave", function(self) self.bg:SetColor(C.inset, 1) end)
  search:SetScript("OnClick", function() UI.PlayClick() UI.Search.Toggle() end)
  UI.SetTooltip(search, "Alles durchsuchen", "Items, Rezepte, Goldwege und Begriffe auf einmal. Tipp: Tastenkürzel in den WoW-Tastaturbelegungen unter \"Tiry's Zentrale\".")

  f.nav = {}
  local y = -134
  for _, g in ipairs(UI.GROUPS) do
    local views = availableViews(g)
    if #views > 0 then
    local b = UI.SafeButton(side)
    b:SetSize(SIDE_W - 34, 38)
    b:SetPoint("TOPLEFT", 12, y)
    b.key = g.key
    b.first = views[1].value
    b.bg = UI.Round(b, 19, "BACKGROUND", 0)
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetTexture(UI.Icon(g.icon))
    b.icon:SetSize(18, 18)
    b.icon:SetPoint("LEFT", 16, 0)
    b.text = UI.Text(b, 14, "semibold", C.muted)
    b.text:SetPoint("LEFT", b.icon, "RIGHT", 12, 0)
    b.text:SetText(g.label)
    b.badge = UI.Chip(b, "", C.rose, true)
    b.badge:SetPoint("RIGHT", -10, 0)
    b.badge:Hide()
    function b:Paint()
      local cg = UI.current and UI.GroupOf(UI.current)
      local active = (cg and cg.key == self.key)
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
      -- zuletzt benutzten Reiter des Hauptpunkts wieder öffnen
      local last = ns.settings.lastView and ns.settings.lastView[self.key]
      UI.Show((last and UI.pages[last]) and last or self.first)
    end)
    f.nav[g.key] = b
    y = y - 44
    end
  end

  -- Echtes Horde-Wappen aus dem Spiel (Atlas aus der Charaktererstellung), ganz dezent über dem Status.
  -- Gibt es den Atlas im Client nicht, wird einfach nichts gezeigt.
  if C_Texture and C_Texture.GetAtlasInfo then
    local ok, info = pcall(C_Texture.GetAtlasInfo, "charactercreate-icon-horde")
    if ok and info then
      local crest = side:CreateTexture(nil, "BACKGROUND", nil, -3)
      crest:SetAtlas("charactercreate-icon-horde")
      crest:SetSize(120, 120)
      crest:SetPoint("BOTTOM", side, "BOTTOM", 0, 116)
      crest:SetDesaturated(true)
      crest:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 0.22)
      f.hordeCrest = crest
    end
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
  local state = ns.Market.Status()
  local c = (state == "ok" and C.green) or (state == "empty" and C.hi) or C.red
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
  -- Gesetzten Wegpunkt wieder entfernen (unten in der Seitenleiste, über dem Status)
  local wp = UI.Button(f.side, "Wegpunkt löschen", "soft", SIDE_W - 34, 32, "close")
  wp:SetPoint("BOTTOMLEFT", f.side, "BOTTOMLEFT", 12, 70)
  wp:SetScript("OnClick", function() ns.Maps.Clear() end)
  UI.SetTooltip(wp, "Wegpunkt entfernen", "Löscht den Kartenpunkt, den Tiry's Zentrale gesetzt hat.")
  wp:Hide()
  f.wpBtn = wp
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
    ns.Safe(snap, self)
    savePosition()
  end)
  f:SetScale(UI.FitScale())
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

  -- Reiter des aktuellen Hauptpunkts (nur wenn er mehrere Ansichten hat)
  local tabs = CreateFrame("Frame", nil, f)
  tabs:SetPoint("TOPLEFT", SIDE_W + PAD - 4, -92)
  tabs:SetSize(UI.CONTENT_W, 30)
  tabs.bars = {}
  f.tabs = tabs

  -- Größe per Ziehgriff unten rechts (ändert die Fenstergröße stufenlos, wie in den Einstellungen)
  local grip = UI.SafeButton(f)
  grip:SetSize(22, 22)
  grip:SetPoint("BOTTOMRIGHT", -6, 6)
  grip:SetFrameLevel(f:GetFrameLevel() + 20)
  grip.tex = grip:CreateTexture(nil, "OVERLAY")
  grip.tex:SetTexture(UI.TEX.corner)
  grip.tex:SetAllPoints()
  grip.tex:SetTexCoord(1, 0, 1, 0)
  grip.tex:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], 0.8)
  UI.SetTooltip(grip, "Fenstergröße", "Ziehen: Fenster größer oder kleiner machen. Zurücksetzen: Einstellungen > Fenstergröße ×.")
  grip:SetScript("OnMouseDown", function(self)
    local startX = GetCursorPosition()
    local startScale = tonumber(ns.settings.scale) or 1
    self:SetScript("OnUpdate", function()
      local x = GetCursorPosition()
      local delta = (x - startX) / (UIParent:GetEffectiveScale() * WIDTH)
      ns.settings.scale = math.floor(ns.Clamp(startScale + delta, 0.7, 1.3) * 100 + 0.5) / 100
      UI.ApplyScale()
    end)
  end)
  grip:SetScript("OnMouseUp", function(self)
    self:SetScript("OnUpdate", nil)
    savePosition()
    if UI.IsShown("settings") then UI.RefreshPage("settings") end
  end)
  f.grip = grip

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
  -- Reiter zeigen/verstecken und Inhalt darunter schieben
  local g = UI.GroupOf(key)
  local views = g and availableViews(g) or {}
  for gk, bar in pairs(frame.tabs.bars) do bar:SetShown(g and gk == g.key and #views > 1) end
  if g and #views > 1 then
    local bar = frame.tabs.bars[g.key]
    if not bar then
      bar = UI.Segments(frame.tabs, views, function(v) UI.PlayClick() UI.Show(v) end, UI.CONTENT_W)
      bar:SetPoint("TOPLEFT")
      frame.tabs.bars[g.key] = bar
    end
    bar:Select(key)
    bar:Show()
    ns.settings.lastView = ns.settings.lastView or {}
    ns.settings.lastView[g.key] = key
  end
  frame.body:ClearAllPoints()
  frame.body:SetPoint("TOPLEFT", SIDE_W + PAD - 4, (g and #views > 1) and -134 or -92)
  frame.body:SetPoint("BOTTOMRIGHT", -PAD + 10, 18)
  local def = ensurePage(key)
  if def then
    def.frame:Show()
    frame.header.title:SetText(def.title)
    frame.header.sub:SetText(def.subtitle or "")
    UI.RefreshPage(key)
  end
  for _, b in pairs(frame.nav) do b:Paint() end
  frame.wpBtn:SetShown(ns.Maps.HasWaypoint())
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
  local g = UI.GroupOf(key)
  if not frame or not g or not frame.nav[g.key] then return end
  local badge = frame.nav[g.key].badge
  if text and text ~= "" then
    badge:Set(text, C.rose, true)
    badge:Show()
  else
    badge:Hide()
  end
end

-- Eigene Fenstergröße (Einstellungen) × automatische Anpassung, damit das Fenster immer ganz auf den Bildschirm passt
function UI.FitScale()
  local user = ns.Clamp(tonumber(ns.settings.scale) or 1, 0.7, 1.3)
  local sw, sh = UIParent:GetWidth() or 0, UIParent:GetHeight() or 0
  local fit = 1
  if sw > 0 and sh > 0 then fit = math.min(1, (sw - 40) / (WIDTH * user), (sh - 40) / (HEIGHT * user)) end
  return user * fit
end

function UI.ApplyScale()
  if frame then frame:SetScale(UI.FitScale()) end
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
ns.Listen("WAYPOINT_CHANGED", function()
  if frame then frame.wpBtn:SetShown(ns.Maps.HasWaypoint()) end
end)
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
  mini = UI.SafeButton(Minimap, "TirysZentraleMinimapButton")
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
    GameTooltip:SetText("Tiry's Zentrale", 1, 0.6, 0.16)
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
      ns.Print("Willkommen! Tippe |cffff9929/tz|r oder klick auf die Goldmünze an der Minikarte.")
    end)
  end
end)

-- Namen für die Tastaturbelegung (Bindings.xml)
BINDING_HEADER_TIRYSZENTRALE = "Tiry's Zentrale"
BINDING_NAME_TIRYSZENTRALE_TOGGLE = "Fenster öffnen/schließen"
BINDING_NAME_TIRYSZENTRALE_SEARCH = "Suche öffnen"
BINDING_NAME_TIRYSZENTRALE_SHOP = "Einkaufsliste öffnen/schließen"
BINDING_NAME_TIRYSZENTRALE_CRAFTNEXT = "Nächstes craften"

SLASH_TIRYSZENTRALE1 = "/tz"
SLASH_TIRYSZENTRALE2 = "/zentrale"
SLASH_TIRYSZENTRALE3 = "/gold"
SlashCmdList.TIRYSZENTRALE = function(msg)
  msg = strtrim and strtrim((msg or ""):lower()) or (msg or ""):lower()
  local map = {
    [""] = nil, start = "home", home = "home", wege = "methods", methoden = "methods", guide = "methods",
    markt = "market", preise = "market", db = "database", datenbank = "database", items = "database", scan = "scanner", scanner = "scanner", taschen = "scanner",
    rezepte = "recipes", craft = "recipes", crafting = "recipes", farm = "farm", farmen = "farm", buch = "ledger", verkaeufe = "ledger", ["verkäufe"] = "ledger", kuerschner = "skinning", ["kürschner"] = "skinning", leder = "skinning", skin = "skinning", tagebuch = "tracker", tracker = "tracker",
    schule = "basics", ah = "basics", hilfe = "basics", optionen = "settings", einstellungen = "settings",
  }
  if msg == "fehler" then
    local list = ns.ErrorLog()
    if #list == 0 then
      ns.Print("Keine Fehler gespeichert – alles läuft.")
    else
      ns.Print(#list .. " gespeicherte Fehler (neueste zuerst):")
      for i = 1, math.min(#list, 10) do
        local e = list[i]
        DEFAULT_CHAT_FRAME:AddMessage(string.format("|cffff6b81%d.|r %s |cff93a39d(%dx, %s, v%s)|r", i, e.msg:sub(1, 200), e.count or 1,
          date("%d.%m. %H:%M", e.time or 0), tostring(e.version or "?")))
      end
      ns.Print("Leeren: |cffff9929/tz fehler leeren|r")
    end
    return
  end
  if msg == "fehler leeren" then
    wipe(ns.ErrorLog())
    ns.Print("Fehlerliste geleert.")
    return
  end
  if msg == "fehlertest" then
    ns.Print("Löse einen Test-Fehler aus ...")
    -- läuft wie ein echter Klick/Timer durch die eigene Absicherung
    C_Timer.After(0.1, function() ns.Safe(function() error("Testfehler – die Fehleranzeige funktioniert, alles gut!") end) end)
    return
  end
  if msg == "suche" or msg == "suchen" or msg == "s" then
    UI.Search.Show()
    return
  end
  if msg == "assistent" then
    UI.Show("home")
    UI.Wizard.Show()
    return
  end
  if msg == "wegpunkt" or msg == "wp" then
    ns.Maps.Clear()
    return
  end
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
  GameTooltip:SetText("Tiry's Zentrale", 1, 0.6, 0.16)
  GameTooltip:AddLine("Linksklick: Gold-Guide · Rechtsklick: Scanner", 0.9, 0.9, 1)
  GameTooltip:Show()
end

function TirysZentrale_OnAddonCompartmentLeave()
  GameTooltip:Hide()
end
