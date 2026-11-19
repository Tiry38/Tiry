-- RezeptRadar 1.0 – das eine Fenster: lohnende Rezepte für Kochkunst und Lederverarbeitung
-- Kopf (Marke, Scan-Status, Scan-Knopf) · Filter (Beruf, Skill, nur mit Skillpunkten) · Liste (Gewinn zuerst)
local _, ns = ...
local UI = ns.UI
local C = UI.C

local WIDTH, HEIGHT = 860, 680
local PAD = 24
local ROW_H, ROW_GAP = 60, 8
UI.WIDTH, UI.HEIGHT = WIDTH, HEIGHT

local COLORS = {
  orange = { 1.00, 0.58, 0.22 }, yellow = { 1.00, 0.86, 0.28 }, green = { 0.36, 0.95, 0.45 }, grey = { 0.62, 0.66, 0.66 },
}
local COLOR_LABEL = { orange = "orange", yellow = "gelb", green = "grün", grey = "grau" }
UI.SKILL_COLORS = COLORS

local frame, rows = nil, {}

----------------------------------------------------------------------------
-- Hintergrund + Marke
----------------------------------------------------------------------------
local function buildBackground(f)
  f.glass = UI.Glass(f, { radius = 28, edgeMode = "neon", edge = 0.85, halo = 0.26, haloPad = 44,
    body = UI.GLASS.window, sheen = 0.045, sheenH = 90, line = 0.55, sub = -6 })
  local clip = CreateFrame("Frame", nil, f)
  clip:SetPoint("TOPLEFT", 2, -2)
  clip:SetPoint("BOTTOMRIGHT", -2, 2)
  clip:SetClipsChildren(true)
  clip:SetFrameLevel(f:GetFrameLevel())
  -- Aurora: langsam treibende Farbflächen hinter dem Glas (Neon-Grün, Türkis, Aqua)
  for _, b in ipairs({
    { UI.TEX.blob1, C.amber, 520, -140, 80, 0.11, 60, -40, 11 },
    { UI.TEX.blob2, C.teal, 480, 520, -380, 0.09, -60, 50, 13 },
    { UI.TEX.blob1, C.aqua, 520, 420, 140, 0.08, -50, -60, 15 },
  }) do
    local t = clip:CreateTexture(nil, "BACKGROUND", nil, -7)
    t:SetTexture(b[1])
    t:SetBlendMode("ADD")
    t:SetVertexColor(b[2][1], b[2][2], b[2][3], b[6])
    t:SetSize(b[3], b[3])
    t:SetPoint("TOPLEFT", clip, "TOPLEFT", b[4], b[5])
    UI.Drift(t, b[7], b[8], b[9], 1, 0.55)
  end
  UI.Ornaments(f, { w = WIDTH, h = HEIGHT, pattern = 0.016, corners = 0, inset = 4 })
end

local function buildBrand(f)
  local logo = f:CreateTexture(nil, "ARTWORK")
  logo:SetTexture(UI.TEX.logo)
  logo:SetSize(48, 48)
  logo:SetPoint("TOPLEFT", f, "TOPLEFT", PAD, -22)
  local glow = UI.Glow(f, C.amber, 124, 0.40, "BACKGROUND")
  glow:SetPoint("CENTER", logo, "CENTER")
  UI.Drift(glow, 0, 0, 3, 0.45, 0.15)
  local mark = f:CreateTexture(nil, "ARTWORK")
  mark:SetTexture(UI.TEX.wordmark)
  mark:SetSize(144, 36)
  mark:SetPoint("TOPLEFT", logo, "TOPRIGHT", 4, 2)
  local sub = UI.Text(f, 12, "semibold", C.muted)
  sub:SetPoint("TOPLEFT", mark, "BOTTOMLEFT", 8, 0)
  sub:SetText("Rezept-Berater · Kochkunst & Lederverarbeitung")
  f.close = UI.IconButton(f, "close", 34, "Schließen")
  f.close:SetPoint("TOPRIGHT", f, "TOPRIGHT", -PAD + 4, -26)
  f.close:SetScript("OnClick", function() f:Hide() end)
end

----------------------------------------------------------------------------
-- Scan-Karte: Stand des letzten Scans, Fortschritt, Knopf
----------------------------------------------------------------------------
local function buildScanCard(f)
  local card = UI.Card(f, 26, nil, { hero = true })
  card:SetPoint("TOPLEFT", f, "TOPLEFT", PAD, -92)
  card:SetPoint("TOPRIGHT", f, "TOPRIGHT", -PAD, -92)
  card:SetHeight(88)
  card.orb = UI.Orb(card, 52, { glyph = "scan", active = true })
  card.orb:SetPoint("LEFT", card, "LEFT", 18, 0)
  card.title = UI.Text(card, 16, "bold", C.text)
  card.title:SetPoint("TOPLEFT", card, "TOPLEFT", 86, -18)
  card.title:SetWordWrap(false)
  card.sub = UI.Text(card, 12, "regular", C.muted)
  card.sub:SetPoint("TOPLEFT", card.title, "BOTTOMLEFT", 0, -5)
  card.sub:SetWordWrap(false)
  card.btn = UI.Button(card, "AH scannen", "primary", 176, 42, "scan")
  card.btn:SetPoint("RIGHT", card, "RIGHT", -20, 0)
  card.btn:SetScript("OnClick", function()
    local ok, why = ns.Scan.Start()
    if not ok then ns.Print(why) end
    UI.Refresh()
  end)
  UI.SetTooltip(card.btn, function()
    return "Komplett-Scan", "Liest das ganze Auktionshaus auf einmal (Blizzard erlaubt das alle 15 Minuten). "
      .. "Läuft auch mit, wenn Auctionator den Scan startet."
  end)
  local textW = WIDTH - PAD * 2 - 86 - 176 - 20 - 16
  card.title:SetWidth(textW)
  card.sub:SetWidth(textW)
  -- Fortschritt beim Lesen: Neon-Pille unter dem Text
  local bar = CreateFrame("Frame", nil, card)
  bar:SetHeight(6)
  bar:SetPoint("BOTTOMLEFT", card, "BOTTOMLEFT", 86, 14)
  bar:SetWidth(textW)
  bar.bg = UI.Round(bar, 3, "ARTWORK", 0)
  bar.bg:SetColor({ 1, 1, 1 }, 0.08)
  bar.fill = CreateFrame("Frame", nil, bar)
  bar.fill:SetPoint("TOPLEFT")
  bar.fill:SetPoint("BOTTOMLEFT")
  bar.fill:SetWidth(6)
  bar.fill.bg = UI.Round(bar.fill, 3, "ARTWORK", 1)
  bar.fill.bg:SetGradient(UI.GRAD, 1)
  bar:Hide()
  card.bar = bar
  f.scan = card
end

local function paintScan()
  local card, S, ah = frame.scan, ns.Scan, ns.db.ah
  local wait = S.Wait()
  if S.progress then
    card.title:SetText(string.format("Lese das Auktionshaus ... %d %%", math.floor(S.progress * 100)))
    card.sub:SetText("Gleich fertig – du kannst weiter im AH stöbern.")
    card.bar:Show()
    card.bar.fill:SetWidth(math.max(6, (card.bar:GetWidth() or 300) * S.progress))
  else
    card.bar:Hide()
    if ah.time then
      card.title:SetText(string.format("Letzter Scan %s · %s Angebote", ns.Ago(ah.time), (tostring(ah.total or 0):reverse():gsub("(%d%d%d)", "%1."):reverse():gsub("^%.", ""))))
    else
      card.title:SetText("Noch kein Scan")
    end
    if not S.ahOpen then
      card.sub:SetText("Am Auktionshaus „AH scannen“ klicken – dann siehst du hier, was sich lohnt.")
    elseif S.armed then
      card.sub:SetText("Scan gestartet – Blizzard schickt die Liste gleich.")
    elseif wait > 0 then
      card.sub:SetText(string.format("Nächster Komplett-Scan erlaubt in %d:%02d (Blizzard-Sperre 15 Min.).", math.floor(wait / 60), wait % 60))
    else
      card.sub:SetText("Auktionshaus offen – bereit zum Scannen.")
    end
  end
  card.btn:SetEnabled(S.ahOpen and wait <= 0 and not S.reading and not S.armed)
  card.btn:SetLabel(S.reading and "Liest ..." or (wait > 0 and S.ahOpen) and string.format("in %d:%02d", math.floor(wait / 60), wait % 60) or "AH scannen")
end

----------------------------------------------------------------------------
-- Filter
----------------------------------------------------------------------------
local function buildFilters(f)
  local bar = CreateFrame("Frame", nil, f)
  bar:SetPoint("TOPLEFT", f, "TOPLEFT", PAD, -196)
  bar:SetPoint("TOPRIGHT", f, "TOPRIGHT", -PAD, -196)
  bar:SetHeight(34)
  f.profSeg = UI.Segments(bar, {
    { value = "ALL", label = "Beide" }, { value = "COOKING", label = "Kochkunst" }, { value = "LEATHERWORKING", label = "Leder" },
  }, function(v) ns.settings.prof = v UI.Refresh() end, 320)
  f.profSeg:SetPoint("TOPLEFT", bar, "TOPLEFT", 0, 0)
  f.rangeSeg = UI.Segments(bar, {
    { value = "now", label = "Jetzt lernbar" }, { value = "soon", label = "Bald (+25)" }, { value = "all", label = "Alle" },
  }, function(v) ns.settings.range = v UI.Refresh() end, 320)
  f.rangeSeg:SetPoint("TOPLEFT", f.profSeg.trackHolder or f.profSeg, "TOPRIGHT", 14, 0)
  f.skillToggle = UI.Toggle(bar, "Nur mit Skillpunkten", function() return ns.settings.skillOnly end,
    function(v) ns.settings.skillOnly = v UI.Refresh() end, nil, 214)
  f.skillToggle:SetPoint("TOPRIGHT", bar, "TOPRIGHT", 0, 2)
  f.skillToggle:SetHeight(32)
end

----------------------------------------------------------------------------
-- Liste
----------------------------------------------------------------------------
local function rowTooltip(row)
  local e = row.e
  if not e then return end
  local r = e.r
  GameTooltip:SetOwner(row, "ANCHOR_RIGHT")
  GameTooltip:SetText(r.name, 0.22, 1, 0.42)
  local rec = ns.Item(r.item)
  GameTooltip:AddDoubleLine("Rezept: " .. rec.name, ns.Money(e.recipe), 0.86, 0.92, 0.89, 1, 1, 1)
  GameTooltip:AddDoubleLine("  im AH", e.recipeCount .. " Stück", 0.6, 0.66, 0.64, 0.86, 0.92, 0.89)
  GameTooltip:AddLine(" ")
  local outName = (r.qty > 1 and (r.qty .. "× ") or "") .. ns.Item(r.out).name
  GameTooltip:AddDoubleLine("Verkauf: " .. outName, ns.Money(e.value), 0.86, 0.92, 0.89, 1, 1, 1)
  GameTooltip:AddLine(e.valueSrc == "ah" and string.format("  günstigstes AH-Angebot, minus 5 %% AH-Anteil · %d im AH", e.listed)
    or (e.bop and "  seelengebunden – nur an Händler verkaufbar" or "  Händlerpreis (im AH gerade nichts oder weniger wert)"), 0.6, 0.66, 0.64, true)
  GameTooltip:AddLine(" ")
  GameTooltip:AddLine("Material je Herstellung", 0.15, 0.95, 0.85)
  for _, m in ipairs(e.mats) do
    local src = m.src == "vendor" and "Händler" or (m.thin and "AH, knapp" or "AH")
    GameTooltip:AddDoubleLine(string.format("  %d× %s  |cff8a9a94(%s)|r", m.n, ns.Item(m.id).name, src), ns.Money(m.unit * m.n), 0.86, 0.92, 0.89, 1, 1, 1)
  end
  GameTooltip:AddDoubleLine("Material gesamt", ns.Money(e.cost), 0.86, 0.92, 0.89, 1, 1, 1)
  GameTooltip:AddDoubleLine("Gewinn je Herstellung", ns.Money(e.profit), 0.22, 1, 0.42, 0.22, 1, 0.42)
  GameTooltip:AddLine(" ")
  GameTooltip:AddLine(string.format("Lernbar ab %d · gelb ab %d · grau ab %d · du: %d", r.learn, r.yellow, r.grey, e.rank), 0.6, 0.66, 0.64, true)
  GameTooltip:AddLine("Klick: im AH suchen (Auctionator) · Shift-Klick: Rezept verlinken", 0.6, 0.66, 0.64, true)
  GameTooltip:Show()
end

local function rowClick(row)
  local e = row.e
  if not e then return end
  if IsShiftKeyDown and IsShiftKeyDown() then ns.LinkItem(e.r.item) return end
  local api = Auctionator and Auctionator.API and Auctionator.API.v1
  if not ns.Scan.ahOpen then ns.Print("Öffne das Auktionshaus, dann sucht ein Klick das Rezept dort.") return end
  if api and api.MultiSearchExact then
    local ok = pcall(api.MultiSearchExact, "RezeptRadar", { ns.Item(e.r.item).name })
    if ok then return end
  end
  ns.Print("Suche im AH nach: |cff39ff6b" .. ns.Item(e.r.item).name .. "|r")
end

local function makeRow(parent, i)
  local row = UI.SafeButton(parent)
  row:SetHeight(ROW_H)
  row.edge = UI.Round(row, ROW_H / 2, "BACKGROUND", 0)
  row.body = UI.Round(row, ROW_H / 2 - 1, "BACKGROUND", 1, 1)
  row.gloss = UI.Round(row, ROW_H / 2 - 1, "BACKGROUND", 2, 1, 26)
  row.gloss:SetGradientV({ 1, 1, 1, 0.10 }, { 1, 1, 1, 0 })
  row.glow = UI.Glow(row, C.amber, 600, 0, "BACKGROUND")
  row.glow:SetPoint("CENTER")
  row.glow:SetHeight(ROW_H * 2)
  row.icon = UI.ItemIcon(row, 42)
  row.icon:SetPoint("LEFT", row, "LEFT", 10, 0)
  row.rank = UI.Text(row, 12, "bold", C.dark)
  row.rank:SetPoint("CENTER", row.icon, "BOTTOMRIGHT", -3, 4)
  row.name = UI.Text(row, 14, "semibold", C.text)
  row.name:SetPoint("TOPLEFT", row, "TOPLEFT", 64, -11)
  row.name:SetWordWrap(false)
  row.dot = row:CreateTexture(nil, "ARTWORK")
  row.dot:SetTexture(UI.TEX.circle)
  row.dot:SetSize(9, 9)
  row.dot:SetPoint("TOPLEFT", row.name, "BOTTOMLEFT", 1, -7)
  row.info = UI.Text(row, 12, "regular", C.muted)
  row.info:SetPoint("LEFT", row.dot, "RIGHT", 6, 0)
  row.info:SetWordWrap(false)
  -- Spalten rechts: Rückzahlung · Gewinn · Rezeptpreis
  row.back = UI.Text(row, 15, "bold", C.text)
  row.back:SetPoint("RIGHT", row, "RIGHT", -22, 6)
  row.back:SetJustifyH("RIGHT")
  row.backL = UI.Text(row, 12, "regular", C.dim)
  row.backL:SetPoint("TOPRIGHT", row.back, "BOTTOMRIGHT", 0, -2)
  row.backL:SetJustifyH("RIGHT")
  row.backL:SetText("zurück")
  row.profit = UI.Text(row, 17, "bold", C.text)
  row.profit:SetPoint("RIGHT", row, "RIGHT", -104, 6)
  row.profit:SetJustifyH("RIGHT")
  row.profitL = UI.Text(row, 12, "regular", C.dim)
  row.profitL:SetPoint("TOPRIGHT", row.profit, "BOTTOMRIGHT", 0, -2)
  row.profitL:SetJustifyH("RIGHT")
  row.recipe = UI.Text(row, 14, "semibold", C.text)
  row.recipe:SetPoint("RIGHT", row, "RIGHT", -270, 6)
  row.recipe:SetJustifyH("RIGHT")
  row.recipeL = UI.Text(row, 12, "regular", C.dim)
  row.recipeL:SetPoint("TOPRIGHT", row.recipe, "BOTTOMRIGHT", 0, -2)
  row.recipeL:SetJustifyH("RIGHT")
  row.recipeL:SetText("Rezept")
  function row:Paint()
    local hover = self:IsMouseOver()
    local g = hover and UI.GLASS.pillHi or UI.GLASS.card
    self.edge:SetGradient(UI.GRAD_EDGE, hover and 0.70 or (self.top and 0.42 or 0.22))
    self.body:SetGradientV(g[1], g[2], 0.96)
    self.glow:SetAlpha(hover and 0.18 or 0)
  end
  row:SetScript("OnEnter", function(self) self:Paint() rowTooltip(self) end)
  row:SetScript("OnLeave", function(self) self:Paint() GameTooltip:Hide() end)
  row:SetScript("OnClick", rowClick)
  row.index = i
  return row
end

local function fillRow(row, e, i)
  row.e, row.top = e, i <= 3
  row.icon:SetItem(e.r.out)
  row.rank:SetText("")
  local nameW = WIDTH - PAD * 2 - 14 - 64 - 300
  UI.FitText(row.name, (e.r.qty > 1 and (e.r.qty .. "× ") or "") .. e.r.name, nameW)
  local c = COLORS[e.color]
  row.dot:SetVertexColor(c[1], c[2], c[3], 1)
  local parts = { UI.Hex(c) .. COLOR_LABEL[e.color] .. "|r" }
  parts[#parts + 1] = e.learnable and "lernbar" or ("ab " .. e.r.learn)
  parts[#parts + 1] = ns.PROF_LABEL[e.r.prof]
  if e.valueSrc == "ah" then parts[#parts + 1] = e.listed .. " im AH" else parts[#parts + 1] = "Händler" end
  UI.FitText(row.info, table.concat(parts, "  ·  "), nameW - 16)
  row.recipe:SetText(ns.Money(e.recipe))
  row.profit:SetText(UI.NEON_HEX .. "+|r" .. ns.Money(e.profit))
  row.profitL:SetText("je Herstellung")
  row.back:SetText((e.payback or 0) .. "×")
  row:Paint()
end

local function buildList(f)
  local head = CreateFrame("Frame", nil, f)
  head:SetPoint("TOPLEFT", f, "TOPLEFT", PAD, -244)
  head:SetPoint("TOPRIGHT", f, "TOPRIGHT", -PAD, -244)
  head:SetHeight(22)
  f.count = UI.Text(head, 13, "semibold", C.text)
  f.count:SetPoint("LEFT", head, "LEFT", 6, 0)
  f.count:SetWordWrap(false)
  local sf, content = UI.Scroll(f)
  sf:SetPoint("TOPLEFT", f, "TOPLEFT", PAD, -272)
  sf:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -PAD + 6, 58)
  f.scroll, f.content = sf, content
  -- Leer-Zustand
  local empty = CreateFrame("Frame", nil, f)
  empty:SetPoint("TOPLEFT", sf, "TOPLEFT", 0, -10)
  empty:SetPoint("TOPRIGHT", sf, "TOPRIGHT", -14, -10)
  empty:SetHeight(220)
  empty.orb = UI.Orb(empty, 72, { glyph = "star", active = true })
  empty.orb:SetPoint("TOP", empty, "TOP", 0, -14)
  empty.title = UI.Text(empty, 17, "bold", C.text)
  empty.title:SetPoint("TOP", empty.orb, "BOTTOM", 0, -16)
  empty.title:SetJustifyH("CENTER")
  empty.text = UI.Para(empty, 13, C.muted, 560)
  empty.text:SetPoint("TOP", empty.title, "BOTTOM", 0, -8)
  empty.text:SetJustifyH("CENTER")
  f.empty = empty
  -- Fußzeile: Hinweis zu gelernten Rezepten + Rechenweg
  f.foot = UI.Para(f, 12, C.dim, WIDTH - PAD * 2 - 20)
  f.foot:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", PAD + 6, 18)
end

local function emptyText(stats)
  if not ns.db.ah.time then
    return "Noch kein Scan", "Öffne das Auktionshaus und klick oben auf „AH scannen“. Danach zeigt die Liste die Rezepte, "
      .. "die du noch nicht kannst und deren Hergestelltes Gold bringt – bester Gewinn zuerst."
  end
  if #stats.noProf > 0 and stats.recipes == 0 then
    local names = {}
    for _, k in ipairs(stats.noProf) do names[#names + 1] = ns.PROF_LABEL[k] end
    return "Beruf nicht gelernt", "Dein Charakter hat " .. table.concat(names, " und ") .. " nicht."
  end
  local hint = {}
  if stats.skill > 0 then hint[#hint + 1] = stats.skill .. " weitere mit „Bald“/„Alle“ oder ohne „Nur mit Skillpunkten“" end
  if stats.loss > 0 then hint[#hint + 1] = stats.loss .. " machen gerade Verlust" end
  if stats.missing > 0 then hint[#hint + 1] = stats.missing .. " ohne Materialpreis" end
  return "Gerade nichts mit Gewinn", (#hint > 0 and (table.concat(hint, " · ") .. ". ") or "")
    .. "Neue Angebote kommen ständig – in 15 Minuten nochmal scannen."
end

local function footText(stats)
  local seen = {}
  for _, key in ipairs(ns.PROF_ORDER) do
    if ns.HasProf(key) then
      local ok = ns.char.seen[key] ~= nil
      seen[#seen + 1] = ns.PROF_LABEL[key] .. (ok and " |cff39ff6berkannt|r" or " |cffff9a3c– Berufsfenster einmal öffnen|r")
    end
  end
  local known = #seen > 0 and ("Gelernte Rezepte: " .. table.concat(seen, "   ·   ") .. "\n") or ""
  return known .. string.format("|cff8a9a94Gewinn je Herstellung = AH-Preis − 5 %% − Material (Händler oder AH, gerechnet für %d Herstellungen) · Klick sucht das Rezept im AH|r", ns.Advisor.CRAFTS)
end

function UI.Refresh()
  if not (frame and frame:IsShown()) then return end
  paintScan()
  frame.profSeg:Select(ns.settings.prof)
  frame.rangeSeg:Select(ns.settings.range)
  frame.skillToggle:Refresh()
  local list, stats = ns.Advisor.List(ns.settings)
  frame.list, frame.stats = list, stats
  local w = WIDTH - PAD * 2 - 14
  for i, e in ipairs(list) do
    local row = rows[i] or makeRow(frame.content, i)
    rows[i] = row
    row:ClearAllPoints()
    row:SetPoint("TOPLEFT", frame.content, "TOPLEFT", 0, -(i - 1) * (ROW_H + ROW_GAP) - 4)
    row:SetWidth(w)
    fillRow(row, e, i)
    row:Show()
  end
  for i = #list + 1, #rows do rows[i]:Hide() rows[i].e = nil end
  frame.content:SetHeight(math.max(10, #list * (ROW_H + ROW_GAP) + 8))
  if frame.scroll.UpdateBar then frame.scroll.UpdateBar() end
  if #list == 0 then
    local t, b = emptyText(stats)
    frame.empty.title:SetText(t)
    frame.empty.text:SetText(b)
    frame.empty:Show()
    frame.count:SetText("")
  else
    frame.empty:Hide()
    local best = list[1]
    frame.count:SetText(string.format("%d lohnende Rezepte  ·  bestes: %s je Herstellung", #list, ns.Money(best.profit)))
  end
  frame.foot:SetText(footText(stats))
end

----------------------------------------------------------------------------
-- Fenster
----------------------------------------------------------------------------
local function create()
  if frame then return frame end
  local f = CreateFrame("Frame", "RezeptRadarMainFrame", UIParent)
  frame = f
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
    local point, _, relPoint, x, y = self:GetPoint(1)
    ns.settings.point = { point, relPoint, x, y }
  end)
  local p = ns.settings.point
  if type(p) == "table" and p[1] then f:SetPoint(p[1], UIParent, p[2] or p[1], p[3] or 0, p[4] or 0) else f:SetPoint("CENTER") end
  f:SetScale(ns.settings.scale or 1)
  f:Hide()
  tinsert(UISpecialFrames, "RezeptRadarMainFrame") -- ESC schließt
  buildBackground(f)
  buildBrand(f)
  buildScanCard(f)
  buildFilters(f)
  buildList(f)
  f:SetScript("OnShow", function() UI.UpdateAnimations() UI.Refresh() end)
  -- Wartezeit-Anzeige am Knopf: jede Sekunde neu, solange das Fenster offen ist
  local acc = 0
  f:SetScript("OnUpdate", function(_, dt)
    acc = acc + (dt or 0)
    if acc >= 1 then acc = 0 ns.Safe(paintScan) end
  end)
  return f
end

function UI.Show() create():Show() UI.Refresh() end
function UI.Hide() if frame then frame:Hide() end end
function UI.ToggleWindow()
  if frame and frame:IsShown() then frame:Hide() else UI.Show() end
end
function UI.ResetPosition()
  if frame then frame:ClearAllPoints() frame:SetPoint("CENTER") end
end
function UI.Frame() return frame end
function UI.Rows() return rows end

local function refreshSoon() ns.Debounce("refresh", 0.2, UI.Refresh) end
for _, msg in ipairs({ "SCAN_DONE", "SCAN_STATE", "KNOWN_CHANGED", "PROFESSIONS_CHANGED", "VENDOR_LEARNED", "ITEMS_UPDATED" }) do
  ns.Listen(msg, refreshSoon)
end

----------------------------------------------------------------------------
-- Minikarten-Knopf, Addon-Fach, Tastenbelegung
----------------------------------------------------------------------------
local mini
local function placeMini()
  local angle = math.rad(ns.settings.minimap.angle or 205)
  local radius = (Minimap:GetWidth() or 140) / 2 + 6
  mini:ClearAllPoints()
  mini:SetPoint("CENTER", Minimap, "CENTER", math.cos(angle) * radius, math.sin(angle) * radius)
end

function UI.UpdateMinimap()
  if not Minimap then return end
  if not ns.settings.minimap.show then if mini then mini:Hide() end return end
  if not mini then
    mini = UI.SafeButton(Minimap, "RezeptRadarMinimapButton")
    mini:SetSize(34, 34)
    mini:SetFrameStrata("MEDIUM")
    mini:SetFrameLevel(Minimap:GetFrameLevel() + 8)
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
    local hl = UI.Glow(mini, C.amber, 70, 0, "BACKGROUND")
    hl:SetPoint("CENTER")
    mini:SetScript("OnEnter", function(self)
      hl:SetAlpha(0.55)
      GameTooltip:SetOwner(self, "ANCHOR_LEFT")
      GameTooltip:SetText("RezeptRadar", 0.22, 1, 0.42)
      GameTooltip:AddLine("Klick: lohnende Rezepte (Kochkunst & Leder)", 0.9, 0.9, 1)
      GameTooltip:AddLine("Ziehen: Knopf verschieben", 0.7, 0.7, 0.85)
      GameTooltip:Show()
    end)
    mini:SetScript("OnLeave", function() hl:SetAlpha(0) GameTooltip:Hide() end)
    mini:SetScript("OnClick", function() UI.ToggleWindow() end)
    mini:SetScript("OnDragStart", function(self)
      self:SetScript("OnUpdate", function()
        local mx, my = Minimap:GetCenter()
        local cx, cy = GetCursorPosition()
        local scale = Minimap:GetEffectiveScale() or 1
        ns.settings.minimap.angle = math.deg(math.atan2(cy / scale - my, cx / scale - mx))
        placeMini()
      end)
    end)
    mini:SetScript("OnDragStop", function(self) self:SetScript("OnUpdate", nil) end)
  end
  placeMini()
  mini:Show()
end

ns.Listen("LOGIN", function() ns.Safe(UI.UpdateMinimap) end)

BINDING_HEADER_REZEPTRADAR = "RezeptRadar"
BINDING_NAME_REZEPTRADAR_TOGGLE = "Rezept-Berater öffnen/schließen"

function RezeptRadar_OnAddonCompartmentClick() UI.ToggleWindow() end
function RezeptRadar_OnAddonCompartmentEnter(_, menuButton)
  GameTooltip:SetOwner(menuButton or UIParent, "ANCHOR_LEFT")
  GameTooltip:SetText("RezeptRadar", 0.22, 1, 0.42)
  GameTooltip:AddLine("Lohnende Rezepte für Kochkunst & Lederverarbeitung", 0.9, 0.9, 1)
  GameTooltip:Show()
end
function RezeptRadar_OnAddonCompartmentLeave() GameTooltip:Hide() end
