-- Tiry's Zentrale – Hauptfenster mit Menü, Seitenverwaltung, Minikarten-Knopf, Befehle
local _, ns = ...
local UI = ns.UI
local C = UI.C

local WIDTH, HEIGHT = 1140, 760 -- groß und luftig; passt sich kleinen Bildschirmen automatisch an
UI.WIDTH, UI.HEIGHT = WIDTH, HEIGHT
local PAD = 24
local HEADER_H = 104 -- Kopfzeile mit Marke, Dock und Schnellknöpfen
UI.CONTENT_W = WIDTH - PAD * 2 - 14 -- nutzbare Breite einer Seite (ohne Scrollleiste)

UI.pages = {}
UI.order = {}

-- Menü: 5 Bereiche im Dock entlang des Gold-Kreislaufs + 2 Schnellknöpfe (Lernen, Einstellungen).
-- Jeder Bereich hat Reiter (Ansichten); Ansichten, die es nicht gibt, werden übersprungen.
-- views: { Schlüssel, Reiter-Name, Symbol }. game = echtes Blizzard-Symbol im Dock (Rückfall: eigenes Symbol).
-- legacy = frühere Menü-Schlüssel (gespeicherter "zuletzt benutzter Reiter" bleibt erhalten).
UI.GROUPS = {
  { key = "start", label = "Start", icon = "home", game = "Interface\\Icons\\INV_Misc_Map_01",
    tip = "Dein Gold-Plan: der nächste Schritt und alle Goldwege auf einen Blick.",
    views = { { "home", "Goldplan", "home" }, { "methods", "Goldwege", "compass" } } },
  { key = "berufe", label = "Herstellen", icon = "flask", game = "Interface\\Icons\\Trade_BlackSmithing",
    tip = "Rezepte planen, Material günstig einkaufen und mit Gewinn herstellen.",
    views = { { "recipes", "Craft-Planer", "flask" }, { "advisor", "Was lernen?", "star" }, { "results", "Ergebnis", "chart" } } },
  { key = "farmen", label = "Farmen", icon = "pin", game = "Interface\\Icons\\INV_Misc_Pelt_Wolf_01",
    tip = "Wo du mit deinem Level am meisten Gold farmst – mit Kürschner-Guide und Live-Messung.",
    views = { { "farm", "Farm-Guide", "pin" }, { "skinning", "Kürschner", "paw" }, { "session", "Farm-Session", "bolt" } } },
  { key = "handel", label = "Handel", icon = "coins", game = "Interface\\Icons\\INV_Misc_Coin_02", legacy = { "auktionen", "markt" },
    tip = "Alles rund ums Auktionshaus: deine Auktionen, Preise, Preisalarm, Händler-Schnäppchen und Item-Suche.",
    views = { { "auctions", "Meine Auktionen", "receipt" }, { "market", "Preise", "coins" }, { "alerts", "Preisalarm", "warn" },
      { "scanner", "Taschen & Händler", "bag" }, { "database", "Item-Suche", "db" } } },
  { key = "gold", label = "Mein Gold", icon = "chart", game = "Interface\\Icons\\INV_Misc_Bag_10",
    tip = "Wie viel Gold du wirklich machst: Goldtagebuch und Verkaufsbuch.",
    views = { { "tracker", "Goldtagebuch", "chart" }, { "ledger", "Verkaufsbuch", "book" } } },
  { key = "lernen", label = "Lernen", icon = "help", util = true,
    tip = "AH-Schule und Glossar: Auktionshaus und alle Begriffe einfach erklärt.",
    views = { { "basics", "AH-Schule", "book" }, { "glossary", "Glossar", "info" } } },
  { key = "settings", label = "Einstellungen", icon = "gear", util = true,
    tip = "Fenster, Preise, Töne und Anzeige so einstellen, wie du es magst.",
    views = { { "settings", "Einstellungen", "gear" } } },
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
    local def = UI.pages[v[1]]
    if def then out[#out + 1] = { value = v[1], label = v[2], icon = v[3], tip = (def.subtitle or "") ~= "" and def.subtitle or nil } end
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

-- Zuletzt benutzter Reiter eines Bereichs (auch aus den früheren Menüpunkten Markt/Auktionen)
local function lastViewOf(g)
  local lv = ns.settings.lastView or {}
  local last = lv[g.key]
  if not (last and UI.pages[last] and UI.GroupOf(last) == g) then
    last = nil
    for _, old in ipairs(g.legacy or {}) do
      local v = lv[old]
      if v and UI.pages[v] and UI.GroupOf(v) == g then last = v break end
    end
  end
  local views = availableViews(g)
  return last or (views[1] and views[1].value)
end
UI.LastViewOf = lastViewOf

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
  -- Das ganze Fenster ist eine Neon-Glasfläche: Leuchtrand Neon-Grün -> Türkis -> Aqua, äußeres Leuchten, Glanz oben
  f.glass = UI.Glass(f, { radius = 26, edgeMode = "neon", edge = 0.85, halo = 0.26, haloPad = 44,
    body = UI.GLASS.window, sheen = 0.045, sheenH = 90, line = 0.55, sub = -6 })
  f.bg = f.glass.body

  -- Aurora: leuchtende, langsam treibende Farbflächen hinter dem Glas
  local clip = CreateFrame("Frame", nil, f)
  clip:SetPoint("TOPLEFT", 2, -2)
  clip:SetPoint("BOTTOMRIGHT", -2, 2)
  clip:SetClipsChildren(true)
  clip:SetFrameLevel(f:GetFrameLevel())
  f.aurora = clip
  local blobs = {
    { tex = UI.TEX.blob1, color = C.amber, size = 560, x = -120, y = 60, a = 0.11, dx = 70, dy = -40, d = 11 },
    { tex = UI.TEX.blob2, color = C.teal, size = 520, x = 700, y = -420, a = 0.09, dx = -60, dy = 50, d = 13 },
    { tex = UI.TEX.blob1, color = C.aqua, size = 600, x = 560, y = 120, a = 0.08, dx = -50, dy = -60, d = 15 },
    { tex = UI.TEX.blob2, color = C.rose, size = 420, x = 40, y = -480, a = 0.07, dx = 60, dy = 40, d = 12 },
  }
  -- Horde-Stil nur ganz dezent: feines Stammesmuster + Kriegsemblem unten rechts
  UI.Ornaments(f, { w = WIDTH, h = HEIGHT, pattern = 0.018, corners = 0, inset = 4 })
  local emblem = clip:CreateTexture(nil, "BACKGROUND", nil, -6)
  emblem:SetTexture(UI.TEX.emblem)
  emblem:SetSize(420, 420)
  emblem:SetPoint("CENTER", clip, "BOTTOMRIGHT", -200, 170)
  emblem:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 0.035)
  for _, b in ipairs(blobs) do
    local t = clip:CreateTexture(nil, "BACKGROUND", nil, -7)
    t:SetTexture(b.tex)
    t:SetBlendMode("ADD")
    t:SetVertexColor(b.color[1], b.color[2], b.color[3], b.a)
    t:SetSize(b.size, b.size)
    t:SetPoint("TOPLEFT", clip, "TOPLEFT", b.x, b.y)
    UI.Drift(t, b.dx, b.dy, b.d, 1, 0.55)
  end

  -- Kopfzeile: etwas dunklere Glasbahn + leuchtende Trennlinie darunter
  local band = clip:CreateTexture(nil, "BACKGROUND", nil, -5)
  band:SetTexture("Interface\\Buttons\\WHITE8X8")
  band:SetPoint("TOPLEFT", clip, "TOPLEFT", 0, 0)
  band:SetPoint("TOPRIGHT", clip, "TOPRIGHT", 0, 0)
  band:SetHeight(HEADER_H - 2)
  UI.SetGradV(band, { 0.0, 0.0, 0.0, 0.0 }, { 0.0, 0.0, 0.0, 0.22 }, 1)
  local sep = UI.Hairline(f, C.teal, 0.55, "ARTWORK", true)
  sep:SetPoint("TOPLEFT", f, "TOPLEFT", 30, -HEADER_H)
  sep:SetPoint("TOPRIGHT", f, "TOPRIGHT", -30, -HEADER_H)
  local sepGlow = UI.Hairline(f, C.amber, 0.22, "ARTWORK", true)
  sepGlow:SetHeight(6)
  sepGlow:SetPoint("TOPLEFT", f, "TOPLEFT", 120, -HEADER_H + 3)
  sepGlow:SetPoint("TOPRIGHT", f, "TOPRIGHT", -120, -HEADER_H + 3)

  -- Echtes Horde-Wappen aus dem Spiel (Atlas), ganz dezent unten links. Gibt es den Atlas nicht, bleibt es leer.
  if C_Texture and C_Texture.GetAtlasInfo then
    local ok, info = pcall(C_Texture.GetAtlasInfo, "charactercreate-icon-horde")
    if ok and info then
      local crest = clip:CreateTexture(nil, "BACKGROUND", nil, -4)
      crest:SetAtlas("charactercreate-icon-horde")
      crest:SetSize(150, 150)
      crest:SetPoint("BOTTOMLEFT", clip, "BOTTOMLEFT", -20, -24)
      crest:SetDesaturated(true)
      crest:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 0.07)
      f.hordeCrest = crest
    end
  end
end

-- Marke oben links: Logo-Kugel + Schriftzug + Live-Status
local function buildBrand(f)
  local logo = f:CreateTexture(nil, "ARTWORK")
  logo:SetTexture(UI.TEX.logo)
  logo:SetSize(50, 50)
  logo:SetPoint("TOPLEFT", f, "TOPLEFT", PAD, -27)
  local logoGlow = UI.Glow(f, C.amber, 130, 0.42, "BACKGROUND")
  logoGlow:SetPoint("CENTER", logo, "CENTER")
  UI.Drift(logoGlow, 0, 0, 3, 0.45, 0.15)
  local spark = f:CreateTexture(nil, "OVERLAY")
  spark:SetTexture(UI.TEX.sparkle)
  spark:SetSize(14, 14)
  spark:SetPoint("TOPRIGHT", logo, "TOPRIGHT", 4, 4)
  UI.Drift(spark, 0, 0, 1.6, 1, 0.1)

  local mark = f:CreateTexture(nil, "ARTWORK")
  mark:SetTexture(UI.TEX.wordmark)
  mark:SetSize(144, 36)
  mark:SetPoint("TOPLEFT", logo, "TOPRIGHT", 2, 3)

  -- Live-Status (Auctionator) unter dem Schriftzug
  local status = CreateFrame("Frame", nil, f)
  status:SetSize(150, 18)
  status:SetPoint("TOPLEFT", mark, "BOTTOMLEFT", 10, -1)
  status.dot = status:CreateTexture(nil, "ARTWORK")
  status.dot:SetTexture(UI.TEX.circle)
  status.dot:SetSize(8, 8)
  status.dot:SetPoint("LEFT", 0, 0)
  status.glow = UI.Glow(status, C.green, 26, 0.5, "BACKGROUND")
  status.glow:SetPoint("CENTER", status.dot, "CENTER")
  UI.Drift(status.glow, 0, 0, 1.4, 1, 0.25)
  status.text = UI.Text(status, 12, "semibold", C.muted)
  status.text:SetPoint("LEFT", status.dot, "RIGHT", 7, 0)
  status.text:SetWordWrap(false)
  status.text:SetWidth(134)
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

-- Dock: 5 große Glas-Kugeln mit echten Blizzard-Symbolen, entlang des Gold-Kreislaufs
local ITEM_W, DOCK_H, ORB, ORB_ACTIVE = 92, 94, 50, 58
local function buildDock(f)
  local list = {}
  for _, g in ipairs(UI.GROUPS) do
    if not g.util and #availableViews(g) > 0 then list[#list + 1] = g end
  end
  local dock = CreateFrame("Frame", nil, f)
  dock:SetSize(#list * ITEM_W + 20, DOCK_H)
  -- mittig zwischen Marke (links) und Schnellknöpfen (rechts)
  dock:SetPoint("TOP", f, "TOPLEFT", 520, -6)
  dock.glass = UI.Glass(dock, { radius = 30, body = { { 0.10, 0.13, 0.13, 0.80 }, { 0.035, 0.045, 0.052, 0.86 } },
    edge = 0.34, sheen = 0.06, sheenH = 36, line = 0.40 })
  f.dock = dock
  f.nav = {}
  for i, g in ipairs(list) do
    local b = UI.SafeButton(dock)
    b:SetSize(ITEM_W, DOCK_H - 6)
    b:SetPoint("TOPLEFT", 10 + (i - 1) * ITEM_W, -3)
    b.key = g.key
    b.first = availableViews(g)[1].value
    b.orb = UI.Orb(b, ORB)
    b.orb:SetPoint("TOP", b, "TOP", 0, -7)
    b.orb:SetGameIcon(g.game, g.icon)
    b.label = UI.Text(b, 12, "semibold", C.muted)
    b.label:SetPoint("TOP", b, "TOP", 0, -63)
    b.label:SetJustifyH("CENTER")
    b.label:SetWordWrap(false)
    b.label:SetText(g.label)
    b.dot = b:CreateTexture(nil, "OVERLAY")
    b.dot:SetTexture(UI.TEX.fade)
    b.dot:SetSize(26, 3)
    b.dot:SetPoint("TOP", b.label, "BOTTOM", 0, -3)
    b.dot:SetBlendMode("ADD")
    b.badge = UI.Chip(b, "", C.hi, true)
    b.badge:SetPoint("CENTER", b.orb, "TOPRIGHT", -4, -4)
    b.badge:SetFrameLevel(b:GetFrameLevel() + 5)
    b.badge:Hide()
    function b:Paint()
      local cg = UI.current and UI.GroupOf(UI.current)
      local active = (cg and cg.key == self.key)
      local hover = self:IsMouseOver()
      local s = active and ORB_ACTIVE or ORB
      self.orb:SetSize(s, s)
      self.orb:ClearAllPoints()
      self.orb:SetPoint("TOP", self, "TOP", 0, active and -3 or -7)
      self.orb:SetActive(active, hover)
      local c = active and C.amber or (hover and C.text or C.muted)
      self.label:SetTextColor(c[1], c[2], c[3], 1)
      self.dot:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], active and 1 or 0)
    end
    b:SetScript("OnEnter", b.Paint)
    b:SetScript("OnLeave", b.Paint)
    b:SetScript("OnClick", function(self)
      UI.PlayClick()
      -- zuletzt benutzten Reiter des Bereichs wieder öffnen
      UI.Show(lastViewOf(g) or self.first)
    end)
    UI.SetTooltip(b, g.label, g.tip)
    f.nav[g.key] = b
  end
end

function UI.UpdateStatus()
  if not frame then return end
  local state = ns.Market.Status()
  local c = (state == "ok" and C.green) or (state == "empty" and C.hi) or C.red
  frame.status.dot:SetVertexColor(c[1], c[2], c[3], 1)
  frame.status.glow:SetVertexColor(c[1], c[2], c[3], 0.5)
  frame.status.text:SetText(state == "ok" and "Live-Preise aktiv" or (state == "empty" and "AH einmal scannen" or "Auctionator fehlt"))
  frame.scanInfo:SetText("Stand: " .. ns.Market.LastScanText() .. " · gilt für alle Reiter")
end

-- Rechts oben: Suche · Lernen (?) · Einstellungen · AH scannen · Schließen
local function buildHeader(f)
  local close = UI.IconButton(f, "close", 32, "Schließen")
  close:SetPoint("TOPRIGHT", f, "TOPRIGHT", -18, -38)
  close:SetScript("OnClick", function() f:Hide() end)

  -- AH-Scan per Klick (startet Auctionators Scan) + Stand der Preise
  local scan = UI.Button(f, "AH scannen", "primary", 138, 34, "refresh")
  scan:SetPoint("RIGHT", close, "LEFT", -12, 0)
  scan:SetScript("OnClick", function() ns.Market.StartScan() end)
  UI.SetTooltip(scan, function()
    return "Preise aktualisieren – für alle Reiter", "Am offenen Auktionshaus: startet den Auctionator-Scan. Ein Scan aktualisiert alle Reiter "
      .. "(Preise, Absatz, Schnäppchen, Unterboten). Tiry's Zentrale erkennt jeden Scan automatisch – "
      .. "auch wenn du direkt in Auctionator scannst.\n\nStand: " .. ns.Market.LastScanText()
  end)
  f.scanBtn = scan
  f.scanInfo = UI.Text(f, 12, "semibold", C.dim)
  f.scanInfo:SetPoint("TOPRIGHT", close, "BOTTOMRIGHT", -2, -8)
  f.scanInfo:SetJustifyH("RIGHT")

  -- Schnellknöpfe: Einstellungen, Lernen, Suche (von rechts nach links)
  local function quick(key, icon, anchor, tipTitle, tipText, onClick)
    local b = UI.IconButton(f, icon, 36)
    b:SetPoint("RIGHT", anchor, "LEFT", -8, 0)
    b.key = key
    b.badge = UI.Chip(b, "", C.hi, true)
    b.badge:SetPoint("CENTER", b, "TOPRIGHT", -3, -3)
    b.badge:SetFrameLevel(b:GetFrameLevel() + 5)
    b.badge:Hide()
    b:SetScript("OnClick", onClick)
    UI.SetTooltip(b, tipTitle, tipText)
    local basePaint = b:GetScript("OnEnter")
    function b:Paint()
      local cg = key and UI.current and UI.GroupOf(UI.current)
      local active = cg and cg.key == key
      if basePaint then basePaint(self) end
      if active then
        UI.SetGradH(self.ring, C.amber, C.aqua, 1)
        self.icon:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 1)
        self.glow:SetAlpha(0.4)
      end
    end
    b:HookScript("OnEnter", function(self) self:Paint() end)
    b:HookScript("OnLeave", function(self) self:Paint() end)
    return b
  end
  local gear = quick("settings", "gear", scan, "Einstellungen", UI.GROUPS[7].tip, function()
    UI.Show("settings")
  end)
  local help = quick("lernen", "help", gear, "Lernen: AH-Schule & Glossar", UI.GROUPS[6].tip, function()
    UI.Show(lastViewOf(UI.GroupOf("basics")) or "basics")
  end)
  local search = quick(nil, "scan", help, "Alles durchsuchen",
    "Items, Rezepte, Goldwege und Begriffe auf einmal. Tipp: Tastenkürzel in den WoW-Tastaturbelegungen unter \"Tiry's Zentrale\".",
    function() UI.Search.Toggle() end)
  f.nav.settings, f.nav.lernen, f.searchBtn = gear, help, search

  -- Seitentitel groß + ein Satz "was du hier machst"
  local h = CreateFrame("Frame", nil, f)
  h:SetPoint("TOPLEFT", f, "TOPLEFT", PAD, -HEADER_H - 14)
  h:SetPoint("TOPRIGHT", f, "TOPRIGHT", -PAD, -HEADER_H - 14)
  h:SetHeight(58)
  h.title = UI.Text(h, 24, "bold", C.text)
  h.title:SetPoint("TOPLEFT", 0, -2)
  h.title:SetWordWrap(false)
  h.sub = UI.Text(h, 13, "regular", C.muted)
  h.sub:SetPoint("TOPLEFT", h.title, "BOTTOMLEFT", 0, -4)
  h.sub:SetWidth(UI.CONTENT_W - 200)
  h.sub:SetWordWrap(false)
  f.header = h

  -- Gesetzten Wegpunkt wieder entfernen (rechts neben dem Titel)
  local wp = UI.Button(f, "Wegpunkt löschen", "soft", 168, 32, "close")
  wp:SetPoint("TOPRIGHT", h, "TOPRIGHT", -12, -6)
  wp:SetScript("OnClick", function() ns.Maps.Clear() end)
  UI.SetTooltip(wp, "Wegpunkt entfernen", "Löscht den Kartenpunkt, den Tiry's Zentrale gesetzt hat.")
  wp:Hide()
  f.wpBtn = wp
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
  buildBrand(f)
  buildDock(f)
  buildHeader(f)

  -- Reiter des aktuellen Bereichs (große, gleich breite Glas-Pillen)
  local tabs = CreateFrame("Frame", nil, f)
  tabs:SetPoint("TOPLEFT", PAD, -HEADER_H - 12)
  tabs:SetSize(UI.CONTENT_W, 46)
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
  grip.tex:SetVertexColor(C.teal[1], C.teal[2], C.teal[3], 0.55)
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
  body:SetPoint("TOPLEFT", PAD, -HEADER_H - 82)
  body:SetPoint("BOTTOMRIGHT", -PAD + 10, 16)
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

local badgeValues = {}

function UI.Show(key)
  if not frame then createFrame() end
  if not UI.pages[key] then key = "home" end
  for k, def in pairs(UI.pages) do
    if def.frame then def.frame:SetShown(k == key) end
  end
  UI.current = key
  ns.Scanner.bagsWanted = false -- nur die Scanner-Ansicht schaltet den Taschen-Scan wieder ein
  -- Reiter zeigen/verstecken; Titel + Satz darunter, Inhalt darunter
  local g = UI.GroupOf(key)
  local views = g and availableViews(g) or {}
  local hasTabs = g and #views > 1
  for gk, bar in pairs(frame.tabs.bars) do bar:SetShown(hasTabs and gk == g.key) end
  if hasTabs then
    local bar = frame.tabs.bars[g.key]
    if not bar then
      bar = UI.Tabs(frame.tabs, views, function(v) UI.Show(v) end, UI.CONTENT_W, 36)
      bar:SetPoint("TOPLEFT")
      frame.tabs.bars[g.key] = bar
      for _, v in ipairs(views) do
        local val = badgeValues[v.value]
        if val then bar:SetBadge(v.value, tostring(val)) end
      end
    end
    bar:Select(key)
    bar:Show()
    ns.settings.lastView = ns.settings.lastView or {}
    ns.settings.lastView[g.key] = key
  end
  local top = HEADER_H + (hasTabs and 58 or 12)
  frame.header:ClearAllPoints()
  frame.header:SetPoint("TOPLEFT", frame, "TOPLEFT", PAD, -top - 4)
  frame.header:SetPoint("TOPRIGHT", frame, "TOPRIGHT", -PAD, -top - 4)
  frame.body:ClearAllPoints()
  frame.body:SetPoint("TOPLEFT", PAD, -top - 70)
  frame.body:SetPoint("BOTTOMRIGHT", -PAD + 10, 16)
  local def = ensurePage(key)
  if def then
    def.frame:Show()
    frame.header.title:SetText(UI.GradText(def.title, { 0.86, 1.0, 0.90 }, C.amber))
    UI.FitText(frame.header.sub, def.subtitle or "", UI.CONTENT_W - 200)
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

-- Zahl am Dock-Symbol (Summe aller Reiter eines Bereichs) und am jeweiligen Reiter
function UI.SetBadge(key, text)
  local g = UI.GroupOf(key)
  badgeValues[key] = tonumber(text) or (text and text ~= "" and text) or nil
  if not frame or not g then return end
  local bar = frame.tabs.bars[g.key]
  if bar then bar:SetBadge(key, badgeValues[key] and tostring(badgeValues[key]) or nil) end
  if not frame.nav[g.key] then return end
  local sum, other = 0, nil
  for _, v in ipairs(g.views) do
    local val = badgeValues[v[1]]
    if type(val) == "number" then sum = sum + val elseif val then other = val end
  end
  text = sum > 0 and tostring(sum) or other
  local badge = frame.nav[g.key].badge
  if text and text ~= "" then
    badge:Set(text, C.hi, true)
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
  "MERCHANT_SCANNED", "RECIPES_SCANNED", "AH_STATE", "CRAFTBOOK_CHANGED", "AUCTIONS_CHANGED", "GOAL_CHANGED",
  "DEMAND_UPDATED", "SNIPES_CHANGED" }) do
  ns.Listen(msg, function() ns.Debounce("refresh", 0.15, refreshVisible) end)
end
-- Taschen-Änderungen (jede Beute) nur für Ansichten, die Tascheninhalt zeigen
local BAG_PAGES = { home = true, recipes = true, tracker = true, scanner = true, session = true }
for _, msg in ipairs({ "BAGS_SCANNED", "LOOT_VALUED" }) do
  ns.Listen(msg, function()
    if frame and frame:IsShown() and BAG_PAGES[UI.current] then ns.Debounce("refresh", 0.15, refreshVisible) end
  end)
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
  UI.SetGradV(bg, { 0.10, 0.13, 0.13 }, { 0.03, 0.04, 0.05 }, 0.96)
  local icon = mini:CreateTexture(nil, "ARTWORK")
  icon:SetTexture(UI.TEX.logo)
  icon:SetPoint("TOPLEFT", 4, -4)
  icon:SetPoint("BOTTOMRIGHT", -4, 4)
  local ring = mini:CreateTexture(nil, "OVERLAY")
  ring:SetTexture(UI.TEX.ringgrad)
  ring:SetAllPoints()
  ring:SetVertexColor(1, 1, 1, 0.85)
  local hl = UI.Glow(mini, C.amber, 70, 0, "BACKGROUND")
  hl:SetPoint("CENTER")
  mini:SetScript("OnEnter", function(self)
    hl:SetAlpha(0.55)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:SetText("Tiry's Zentrale", 0.22, 1, 0.42)
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
  local lower = (ns.DB and ns.DB.Lower) or string.lower
  msg = lower(msg or "")
  msg = strtrim and strtrim(msg) or msg:match("^%s*(.-)%s*$")
  local map = {
    [""] = nil, start = "home", home = "home", wege = "methods", methoden = "methods", guide = "methods",
    markt = "market", preise = "market", db = "database", datenbank = "database", items = "database", scan = "scanner", scanner = "scanner", taschen = "scanner",
    rezepte = "recipes", craft = "recipes", crafting = "recipes", farm = "farm", farmen = "farm", buch = "ledger", verkaeufe = "ledger", ["verkäufe"] = "ledger", kuerschner = "skinning", ["kürschner"] = "skinning", leder = "skinning", skin = "skinning", tagebuch = "tracker", tracker = "tracker",
    schule = "basics", ah = "basics", hilfe = "basics", optionen = "settings", einstellungen = "settings",
    -- Namen der neuen Bereiche
    handel = "auctions", auktionen = "auctions", herstellen = "recipes", lernen = "basics", glossar = "glossary",
    alarm = "alerts", preisalarm = "alerts", ergebnis = "results", session = "session", verkaufsbuch = "ledger",
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
  if msg == "schnapp" or msg == "schnäppchen" or msg == "schnaeppchen" or msg == "snipe" then
    -- Schnäppchen-Liste aus dem letzten Komplett-Scan (Handel > Preise > Schnäppchen)
    UI.Show("market")
    local p = UI.pages.market
    if p and p.segments then p.segments:Select("snipe", true) end
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
  GameTooltip:SetText("Tiry's Zentrale", 0.22, 1, 0.42)
  GameTooltip:AddLine("Linksklick: Gold-Guide · Rechtsklick: Scanner", 0.9, 0.9, 1)
  GameTooltip:Show()
end

function TirysZentrale_OnAddonCompartmentLeave()
  GameTooltip:Hide()
end
