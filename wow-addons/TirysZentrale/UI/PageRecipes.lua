-- Tiry's Zentrale – Seite "Craft-Planer": erkennt deine Berufe und gelernten Rezepte automatisch,
-- zwei einfache Gold-Filter mit Level-Empfehlung, Warteschlange, fehlendes Material, Craften per Knopf.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local S = ns.Scanner
local R = ns.Recipes

local DIFF = {
  [0] = { "orange", { 1, 0.5, 0.25 } }, [1] = { "gelb", { 1, 1, 0 } },
  [2] = { "grün", { 0.25, 0.75, 0.25 } }, [3] = { "grau", { 0.5, 0.5, 0.5 } },
}
local VIEWS = {
  { value = "known", label = "Meine Rezepte" },
  { value = "learnable", label = "Lernen lohnt sich" },
}

local page = {
  title = "Craft-Planer",
  subtitle = "Erkennt deine Berufe und Rezepte automatisch – und zeigt, was dir Gold bringt.",
  icon = "flask", label = "Craft-Planer", order = 6,
}

local function cfg() return ns.settings.craft end

local function itemCount(id)
  if C_Item and C_Item.GetItemCount then return C_Item.GetItemCount(id, false) or 0 end
  return 0
end

local function craftable(r)
  local n
  for _, re in ipairs(r.reagents) do
    local k = math.floor(itemCount(re.id) / re.n)
    n = n and math.min(n, k) or k
  end
  return n or 0
end

local function queue() ns.char.queue = ns.char.queue or {} return ns.char.queue end

local function addToQueue(r, delta)
  local q = queue()
  for i, e in ipairs(q) do
    if e.recipe == r.id then
      e.n = e.n + delta
      if e.n <= 0 then table.remove(q, i) end
      return
    end
  end
  if delta > 0 then q[#q + 1] = { recipe = r.id, prof = r.prof, n = delta } end
end

-- Benötigtes Material der Warteschlange minus Taschen
function ns.QueueMaterials()
  local need, profit, crafts = {}, 0, 0
  for _, e in ipairs(queue()) do
    local r = R.Get(e.recipe)
    if r then
      crafts = crafts + e.n
      profit = profit + (S.RecipeProfit(r) or 0) * e.n
      for _, re in ipairs(r.reagents) do need[re.id] = (need[re.id] or 0) + re.n * e.n end
    end
  end
  local list, cost = {}, 0
  for id, n in pairs(need) do
    local missing = math.max(0, n - ns.Shop.Have(id))
    if missing > 0 then
      local unit, where = M.BuyCost(id)
      list[#list + 1] = { id = id, n = missing, unit = unit, where = where }
      cost = cost + (unit or 0) * missing
    end
  end
  table.sort(list, function(a, b) return (a.unit or 0) * a.n > (b.unit or 0) * b.n end)
  return list, cost, profit, crafts
end

-- Schritt-Überschrift: Kreis mit Nummer + Text (macht die Seite in 3 Schritten lesbar)
local function stepHead(parent, n, text, width)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(width, 28)
  local dot = CreateFrame("Frame", nil, f)
  dot:SetSize(26, 26)
  dot:SetPoint("LEFT")
  dot.bg = UI.Round(dot, 13, "ARTWORK", 0)
  dot.bg:SetGradient(UI.GRAD, 1)
  local num = UI.Text(dot, 13, "bold", C.dark)
  num:SetPoint("CENTER", 0, 0)
  num:SetText(n)
  f.text = UI.Text(f, 15, "bold", C.text)
  f.text:SetPoint("LEFT", dot, "RIGHT", 10, 0)
  f.text:SetText(text)
  return f
end

----------------------------------------------------------------------------
function page.build(self, content, width)
  self.view = "known"
  local st = UI.Stack(content)

  local refresh = function() page.refresh(self) end

  -- Schritt 1: Beruf + Ansicht
  st:Add(stepHead(content, 1, "Beruf wählen", width), 28, 10)
  self.segHolder = CreateFrame("Frame", nil, content)
  self.segHolder:SetSize(width, 30)
  st:Add(self.segHolder, 30, 8)
  self.viewSeg = UI.Segments(content, VIEWS, function(v) self.view = v page.refresh(self) end, width)
  st:Add(self.viewSeg, self.viewSeg:GetHeight(), 18)

  -- Schritt 2: EIN Regler (Mindestgewinn), Empfehlung wächst mit deinem Level
  st:Add(stepHead(content, 2, "Wie viel Gewinn pro Craft mindestens?", width), 28, 10)
  local fc = CreateFrame("Frame", nil, content)
  fc:SetSize(width, 92)
  fc.bg = UI.Round(fc, 22, "BACKGROUND", 0)
  fc.bg:SetGradient({ { 0.07, 0.27, 0.19 }, { 0.09, 0.18, 0.16 }, { 0.14, 0.16, 0.17 } }, 0.95)
  self.profit = UI.Stepper(fc, "Mindestgewinn", 340, function() return (select(2, R.Filter())) end,
    function(v) R.SetProfit(v) end,
    function(v, dir)
      local base = (dir > 0) and v or v - 1
      if base < 10000 then return 500 elseif base < 100000 then return 5000 end
      return 50000
    end, 0, 10000000, function(v) return v == 0 and "alles" or ns.Money(v) end, ns.ParseMoney,
    "Auf die Zahl klicken und selbst eintragen: 45 = 45 Silber, 1g 20s, 1,5g. Enter übernimmt.")
  self.profit:SetPoint("TOPLEFT", 20, -16)
  self.profit.onChange = refresh
  self.profit:SetDefault(function() return R.Preset().profit end, function() R.ResetStyle() end)
  self.recBtn = UI.Button(fc, "Empfehlung für mein Level", "primary", 240, 34, "star")
  self.recBtn:SetPoint("TOPRIGHT", -20, -16)
  UI.SetTooltip(self.recBtn, "Zurück zur Empfehlung", "Setzt den Mindestgewinn wieder auf die Empfehlung für dein Level. Die wächst dann automatisch mit.")
  self.recBtn:SetScript("OnClick", function() R.ResetStyle() page.refresh(self) end)
  self.recText = UI.Para(fc, 11, C.muted, width - 40)
  self.recText:SetPoint("TOPLEFT", 20, -60)
  st:Add(fc, 92, 18)

  -- Filter (stecken in "Mehr Optionen", damit die Seite übersichtlich bleibt)
  self.pills = {}
  -- "Mehr Optionen" – einklappbar am Seitenende (Positionen werden in refresh berechnet)
  local PS = ns.PriceString
  self.proToggle = UI.Button(content, "Mehr Optionen: Filter", "soft", 330, 32, "gear")
  self.proToggle:SetScript("OnClick", function() self.proOpen = not self.proOpen page.refresh(self) end)
  local sc = CreateFrame("Frame", nil, content)
  sc:SetWidth(width)
  sc.bg = UI.Round(sc, 18, "BACKGROUND", 0)
  sc.bg:SetColor(C.card, 1)
  local fh = UI.Text(sc, 14, "bold", C.text)
  fh:SetPoint("TOPLEFT", 18, -18)
  fh:SetText("Filter")
  local p = UI.Pill(sc, "Nur mit bekannten Preisen", function() return cfg().onlySafe end, function(v) cfg().onlySafe = v end, refresh)
  p:SetPoint("TOPLEFT", 18, -48)
  self.pills[1] = p
  self.fresh = UI.Pill(sc, "Nur frische Preise", function() return cfg().freshOnly ~= false end,
    function(v) cfg().freshOnly = v end, refresh)
  self.fresh:SetPoint("LEFT", p, "RIGHT", 8, 0)
  UI.SetTooltip(self.fresh, "Nur frische Preise", "Nur Rezepte, deren AH-Preis höchstens 3 Tage alt ist – alte Preise führen zu falschen Gewinnen.")
  self.pills[2] = self.fresh
  self.unhideBtn = UI.Button(sc, "Ausgeblendete (0)", "soft", 170, 30, "refresh")
  self.unhideBtn:SetPoint("TOPRIGHT", -14, -48)
  self.unhideBtn:SetScript("OnClick", function() ns.char.hiddenRecipes = {} page.refresh(self) end)
  UI.SetTooltip(self.unhideBtn, "Ausgeblendete zurückholen", "Holt alle Rezepte zurück, die du mit × ausgeblendet hast.")
  self.filterReset = UI.Button(sc, "Filter: Standard", "soft", 160, 30, "close")
  self.filterReset:SetPoint("RIGHT", self.unhideBtn, "LEFT", -8, 0)
  self.filterReset:SetScript("OnClick", function() cfg().onlySafe = true cfg().freshOnly = true page.refresh(self) end)
  UI.SetTooltip(self.filterReset, "Filter zurücksetzen", "Beide Filter wieder an: nur Rezepte mit bekannten und frischen Preisen.")
  local OFF = 84
  -- Preisformeln: nur im Experten-Modus (Einstellungen) sichtbar
  local fx = CreateFrame("Frame", nil, sc)
  fx:SetPoint("TOPLEFT", 0, -OFF)
  fx:SetWidth(width)
  self.formulaFrame = fx
  local st1 = UI.Text(fx, 14, "bold", C.text)
  st1:SetPoint("TOPLEFT", 18, -18)
  st1:SetText("Preisformeln (Experten)")
  local reset = UI.Button(fx, "Empfohlene Formeln", "soft", 190, 30, "star")
  reset:SetPoint("TOPRIGHT", -14, -12)
  reset:SetScript("OnClick", function() PS.Reset() page.refresh(self) end)
  local st2 = UI.Para(fx, 11, C.dim, width - 36)
  st2:SetPoint("TOPLEFT", 18, -52)
  st2:SetText("Quellen: ahprice, market (dein 14-Tage-Marktwert), vendorbuy, vendorsell, crafting, levelgold. Bekannte Kurznamen wie dbmarket gehen auch. Enter übernimmt, fehlerhafte Formeln werden nicht gespeichert.")
  local y = 52 + math.ceil(st2:GetStringHeight()) + 14
  self.strings = {}
  local defs = {
    { "matPrice", "Materialpreis" }, { "craftValue", "Verkaufswert" }, { "minProfit", "Mindestgewinn" },
  }
  for _, d in ipairs(defs) do
    local lab = UI.Text(fx, 12, "semibold", C.muted)
    lab:SetPoint("TOPLEFT", 18, -y - 9)
    lab:SetText(d[2])
    local box = CreateFrame("EditBox", nil, fx)
    box:SetSize(width - 150 - 18 - 140, 32)
    box:SetPoint("TOPLEFT", 150, -y)
    box:SetAutoFocus(false)
    box:SetMaxLetters(200)
    box:SetTextInsets(12, 12, 0, 0)
    local ok, res = pcall(box.SetFont, box, ns.MEDIA .. "Fonts\\Poppins-Regular.ttf", 12, "")
    if not ok or res == false then pcall(box.SetFont, box, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", 12, "") end
    box:SetTextColor(1, 1, 1, 1)
    box.bg = UI.Round(box, 16, "BACKGROUND", 2)
    box.bg:SetColor(C.inset, 1)
    local status = UI.Text(fx, 11, "semibold", C.green)
    status:SetPoint("LEFT", box, "RIGHT", 10, 0)
    status:SetWidth(96)
    status:SetWordWrap(false)
    local undo = UI.IconButton(fx, "close", 26, "Zurück zur empfohlenen Formel")
    undo:SetPoint("LEFT", status, "RIGHT", 2, 0)
    undo:SetScript("OnClick", function()
      if ns.settings.priceStrings then ns.settings.priceStrings[d[1]] = nil end
      box:ClearFocus()
      page.refresh(self)
    end)
    box:SetScript("OnEnterPressed", function(b)
      local okSet, err = PS.Set(d[1], b:GetText())
      b:ClearFocus()
      if not okSet then ns.Print("|cffff6b81Formel-Fehler (" .. d[2] .. "):|r " .. tostring(err)) end
      page.refresh(self)
    end)
    box:SetScript("OnEscapePressed", function(b) b:ClearFocus() page.refresh(self) end)
    box:SetScript("OnEditFocusGained", function(b) b.bg:SetColor(C.cardHi, 1) end)
    box:SetScript("OnEditFocusLost", function(b) b.bg:SetColor(C.inset, 1) end)
    self.strings[d[1]] = { box = box, status = status, undo = undo }
    y = y + 44
  end
  fx:SetHeight(y)
  self.proFullH, self.proFilterH = OFF + y + 8, OFF + 4
  sc:SetHeight(self.proFullH)
  self.proCard = sc

  -- Schritt 3: alle lohnenden Rezepte auf einen Klick in die Liste, Einkaufsfenster dazu
  st:Add(stepHead(content, 3, "Liste erstellen, einkaufen, craften", width), 28, 10)
  local mk = CreateFrame("Frame", nil, content)
  mk:SetSize(width, 36)
  self.perRecipe = UI.Stepper(mk, "Je Rezept", 230, function() return cfg().perRecipe or 2 end,
    function(v) cfg().perRecipe = v end, 1, 1, 50, function(v) return v .. "×" end,
    function(t) return tonumber((t or ""):match("%d+")) end, "Wie oft jedes lohnende Rezept auf die Liste soll. Auf die Zahl klicken zum Eintragen.")
  self.perRecipe:SetPoint("LEFT")
  self.perRecipe:SetDefault(2)
  self.makeBtn = UI.Button(mk, "Liste erstellen", "primary", 170, 34, "star")
  self.makeBtn:SetPoint("LEFT", self.perRecipe, "RIGHT", 40, 0)
  self.makeBtn:SetScript("OnClick", function() page.MakeList(self) end)
  UI.SetTooltip(self.makeBtn, function()
    if self.view == "learnable" then
      return "Rezepte suchen", "Sucht die angezeigten Rezepte (Muster, Pläne, Formeln ...) im AH. Ist das AH zu, wird eine Auctionator-Einkaufsliste \"Zentrale: Rezepte\" angelegt."
    end
    return "Liste erstellen", "Legt alle Rezepte, die gerade angezeigt werden (also Gold bringen), in die Craft-Liste und öffnet das Einkaufsfenster mit den Materialien."
  end)
  self.shopBtn = UI.Button(mk, "Einkaufsfenster", "cool", 170, 34, "cart")
  self.shopBtn:SetPoint("LEFT", self.makeBtn, "RIGHT", 10, 0)
  self.shopBtn:SetScript("OnClick", function() ns.Shop.Toggle() end)
  -- Liste neu berechnen: Berufe/Rezepte neu lesen, mit aktuellen Preisen rechnen (am AH zusätzlich scannen)
  self.refreshBtn = UI.Button(mk, "Aktualisieren", "soft", 170, 34, "refresh")
  self.refreshBtn:SetPoint("LEFT", self.shopBtn, "RIGHT", 10, 0)
  self.refreshBtn:SetScript("OnClick", function() page.Reload(self) end)
  UI.SetTooltip(self.refreshBtn, "Aktualisieren", "Liest deine Berufe und Rezepte neu und rechnet alles mit den aktuellen Preisen. "
    .. "Ist das Auktionshaus offen, werden auch neue Preise gescannt. Ist das Berufsfenster offen, werden neu gelernte Rezepte sofort erkannt.")
  st:Add(mk, 36, 12)

  self.info = UI.Para(content, 12, C.hi, width)
  self.infoTop = st.y
  self.list = UI.ItemList(content, width, {
    { key = "cost", label = "Material", width = 84 },
    { key = "revenue", label = "Verkauf", width = 84 },
    { key = "profit", label = "Gewinn", width = 96, bold = true },
  }, { action = true })
  self.listTop = st.y

  -- Ausgeblendete Rezepte einzeln zurückholen (Klick auf den Chip)
  self.hiddenRow = CreateFrame("Frame", nil, content)
  self.hiddenRow:SetWidth(width)
  self.hiddenRow.label = UI.Text(self.hiddenRow, 11, "semibold", C.dim)
  self.hiddenRow.label:SetPoint("TOPLEFT", 0, -8)
  self.hiddenRow.label:SetText("Gerade ausgeblendet:")
  self.hiddenRow.chips = {}

  -- Warteschlange
  local qc = UI.Card(content, 20, C.card)
  qc:SetWidth(width)
  self.queueCard = qc
  qc.title = UI.Text(qc, 16, "bold", C.text)
  qc.title:SetPoint("TOPLEFT", 20, -18)
  qc.title:SetText("Craft-Warteschlange")
  qc.text = UI.Para(qc, 12, C.muted, width - 40)
  qc.text:SetPoint("TOPLEFT", qc.title, "BOTTOMLEFT", 0, -8)
  qc.buy = UI.Button(qc, "Als Auctionator-Liste", "primary", 220, 34, "cart")
  qc.buy:SetScript("OnClick", function()
    local mats = ns.QueueMaterials()
    local ids = {}
    for _, m in ipairs(mats) do ids[#ids + 1] = m.id end
    if #ids == 0 then ns.Print("Du hast schon alles Material in den Taschen.") return end
    local ok, n = M.CreateShoppingList("Zentrale: Craft-Material", ids)
    ns.Print(ok and ("Liste |cffff9929Zentrale: Craft-Material|r angelegt (" .. n .. " Items). Im AH: Auctionator > Einkaufen > Suche alles.") or ("|cffff6b81" .. tostring(n) .. "|r"))
  end)
  qc.craft = UI.Button(qc, "Nächstes craften", "cool", 180, 34, "bolt")
  qc.craft:SetScript("OnClick", function() page.CraftNext(self) end)
  UI.SetTooltip(qc.craft, "Craften", "Bei offenem Berufsfenster: stellt den ersten passenden Eintrag her – so oft dein Material reicht.")
  qc.clear = UI.Button(qc, "Alles leeren", "danger", 150, 34, "close")
  qc.clear:SetScript("OnClick", function()
    if #queue() == 0 and page.undoQueue then page.UndoClear() else page.ClearQueue() end
  end)
  qc.rows = {}
  qc.mats = UI.Para(qc, 12, C.muted, width - 40)
end

local function openProfKey()
  if not S.tradeOpen or not S.openProf then return nil end
  for key, id in pairs(ns.PROF) do
    local p = ns.professions[id]
    if p and p.name == S.openProf then return key end
  end
end

-- Rezept im OFFENEN Berufsfenster finden: Nummer muss gelernt sein UND genau unser Ergebnis-Item herstellen
local function liveIDs()
  local ids = {}
  if C_TradeSkillUI.GetFilteredRecipeIDs then ids = C_TradeSkillUI.GetFilteredRecipeIDs() or {} end
  return ids
end

local function producesOutput(id, out)
  local ok, s = pcall(C_TradeSkillUI.GetRecipeSchematic, id, false)
  return ok and s and s.outputItemID == out
end

local function isLearned(id)
  local ok, info = pcall(C_TradeSkillUI.GetRecipeInfo, id)
  return ok and info and info.learned
end

function page.ResolveLive(r)
  if isLearned(r.id) and producesOutput(r.id, r.out) then return r.id, "direkt" end
  for _, id in ipairs(liveIDs()) do
    if isLearned(id) and producesOutput(id, r.out) then return id, "über Berufsfenster" end
  end
  return nil
end

-- Wartet auf das hergestellte Item: erst wenn es in der Tasche liegt, wird die Warteschlange verringert
local pendingCraft
ns.Listen("LOOT_GAINED", function(_, itemID, gained)
  if not pendingCraft or pendingCraft.out ~= itemID then return end
  local r = R.Get(pendingCraft.recipe)
  if r then
    local crafts = math.max(1, math.floor(gained / math.max(r.qty, 1) + 0.5))
    addToQueue(r, -math.min(crafts, pendingCraft.left))
    pendingCraft.left = pendingCraft.left - crafts
    if pendingCraft.left <= 0 then pendingCraft = nil end
    UI.RefreshPage("recipes")
  end
end)

function page.Reload(self)
  ns.UpdateProfessions()
  self.segKey = nil
  if S.tradeOpen and S.ScanRecipes then
    local n = S.ScanRecipes()
    if n and n > 0 then ns.Fire("RECIPES_SCANNED") end
  end
  if M.ahOpen then M.StartScan() end
  page.refresh(self)
  ns.Print("Craft-Planer aktualisiert – " .. M.LastScanText() .. ".")
end

-- "Lernen lohnt sich": alle gezeigten Rezept-Items im AH suchen (bzw. als Auctionator-Liste anlegen)
function page.SearchRecipes(self)
  local ids = {}
  for i = 1, math.min(#(self.learnIDs or {}), 20) do ids[i] = self.learnIDs[i] end
  if #ids == 0 then ns.Print("Gerade ist kein lohnendes Rezept zum Kaufen dabei (die übrigen lernst du beim Lehrer).") return end
  if M.ahOpen then
    local ok, err = M.SearchNow(ids)
    if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
  else
    local ok, n = M.CreateShoppingList("Zentrale: Rezepte", ids)
    ns.Print(ok and ("Liste |cffff9929Zentrale: Rezepte|r angelegt (" .. n .. " Rezepte). Im AH: Auctionator > Einkaufen.") or ("|cffff6b81" .. tostring(n) .. "|r"))
  end
end

function page.MakeList(self)
  if self.view == "learnable" then return page.SearchRecipes(self) end
  local list = page.Entries(self)
  if #list == 0 then
    ns.Print("Gerade bringt kein Rezept genug Gold – Mindestgewinn senken oder im AH scannen.")
    return
  end
  local per = cfg().perRecipe or 2
  local q = queue()
  for i = #q, 1, -1 do
    if q[i].prof == self.prof then table.remove(q, i) end
  end
  for _, e in ipairs(list) do q[#q + 1] = { recipe = e.r.id, prof = e.r.prof, n = per } end
  ns.Shop.ResetSkips()
  ns.Print(string.format("Craft-Liste erstellt: %d Rezepte je %d×. Das Einkaufsfenster zeigt dir, was du noch kaufen musst.", #list, per))
  ns.Shop.Show()
  page.refresh(self)
end

function page.ClearQueue()
  if #queue() > 0 then
    page.undoQueue = {}
    for i, e in ipairs(queue()) do page.undoQueue[i] = { recipe = e.recipe, prof = e.prof, n = e.n } end
  end
  wipe(queue())
  pendingCraft = nil
  ns.Print("Craft-Warteschlange geleert. Aus Versehen? Knopf |cffff9929Rückgängig|r in der Warteschlange.")
  UI.RefreshPage("recipes")
end

function page.UndoClear()
  if not page.undoQueue then return end
  local q = queue()
  for _, e in ipairs(page.undoQueue) do q[#q + 1] = e end
  page.undoQueue = nil
  ns.Print("Craft-Warteschlange wiederhergestellt.")
  UI.RefreshPage("recipes")
end

-- Zeile in der Warteschlange: Name + Knöpfe -1, +1, entfernen
local function queueRow(qc, width)
  local row = CreateFrame("Frame", nil, qc)
  row:SetSize(width - 40, 30)
  row.bg = UI.Round(row, 15, "BACKGROUND", 1)
  row.bg:SetColor(C.inset, 0.9)
  row.text = UI.Text(row, 12, "semibold", C.text)
  row.text:SetPoint("LEFT", 14, 0)
  row.text:SetWidth(width - 200)
  row.text:SetWordWrap(false)
  row.del = UI.IconButton(row, "close", 24, "Entfernen")
  row.del:SetPoint("RIGHT", -4, 0)
  row.plus = UI.IconButton(row, "plus", 24, "Einmal mehr")
  row.plus:SetPoint("RIGHT", row.del, "LEFT", -4, 0)
  row.minus = UI.IconButton(row, "minus", 24, "Einmal weniger")
  row.minus:SetPoint("RIGHT", row.plus, "LEFT", -4, 0)
  row.minus:SetScript("OnClick", function(b) addToQueue(row.recipe, -1) UI.RefreshPage("recipes") end)
  row.plus:SetScript("OnClick", function(b) addToQueue(row.recipe, 1) UI.RefreshPage("recipes") end)
  row.del:SetScript("OnClick", function(b) addToQueue(row.recipe, -999) UI.RefreshPage("recipes") end)
  return row
end

function page.CraftNext(self)
  if ns.CombatBlocked() then return end
  if not (C_TradeSkillUI and C_TradeSkillUI.CraftRecipe) then return end
  if not S.tradeOpen then
    -- Berufsfenster für den ersten Eintrag öffnen, für den du Material hast
    for _, e in ipairs(queue()) do
      local r = R.Get(e.recipe)
      if r and craftable(r) > 0 and C_TradeSkillUI.OpenTradeSkill then
        local okCall, opened = pcall(C_TradeSkillUI.OpenTradeSkill, ns.PROF[r.prof])
        local ok = okCall and opened ~= false
        ns.Print(ok and ("Berufsfenster " .. ns.ProfName(ns.PROF[r.prof]) .. " geöffnet – klick nochmal auf |cffff9929Nächstes craften|r.")
          or "Öffne bitte das Berufsfenster und klick dann nochmal.")
        return
      end
    end
    ns.Print("Für nichts in der Craft-Liste hast du schon alles Material. Erst einkaufen bzw. Post holen.")
    return
  end
  local key = openProfKey()
  for _, e in ipairs(queue()) do
    local r = R.Get(e.recipe)
    if r and (not key or r.prof == key) then
      local n = math.min(e.n, craftable(r))
      if n > 0 then
        local liveID = page.ResolveLive(r)
        if not liveID then
          ns.Print("|cffff6b81" .. r.name .. "|r ist im offenen Berufsfenster nicht als gelerntes Rezept zu finden – bitte dort direkt herstellen.")
          return
        end
        -- Rezept im Berufsfenster markieren, damit du siehst, was hergestellt wird
        if C_TradeSkillUI.OpenRecipe then pcall(C_TradeSkillUI.OpenRecipe, liveID) end
        -- Exakt wie Blizzards eigener Herstellen-Knopf: leere Materialliste (Grundmaterial nimmt das Spiel selbst)
        C_TradeSkillUI.CraftRecipe(liveID, n, {}, nil, nil, false)
        pendingCraft = { recipe = r.id, out = r.out, left = n }
        ns.Print(string.format("Stelle |cffff9929%d× %s|r her.", n, r.name))
        return
      end
    end
  end
  ns.Print("Nichts in der Warteschlange, das du mit deinem Material in diesem Beruf herstellen kannst.")
end

-- Prüfbefehl /tz craftcheck: zeigt je Eintrag, welches Rezept im Berufsfenster benutzt würde
function page.CraftCheck()
  if not (S.tradeOpen and C_TradeSkillUI) then ns.Print("Öffne zuerst das Berufsfenster.") return end
  if #queue() == 0 then ns.Print("Warteschlange ist leer.") return end
  for _, e in ipairs(queue()) do
    local r = R.Get(e.recipe)
    if r then
      local liveID, how = page.ResolveLive(r)
      ns.Print(string.format("%s: Datenbank %d -> Berufsfenster %s (%s), Ergebnis-Item %d",
        r.name, r.id, tostring(liveID or "nicht gefunden"), how or "-", r.out))
    end
  end
end

local function buildSegments(self)
  local profs = R.MyProfessions()
  local key = table.concat(profs, "|")
  if self.segKey ~= key then
    self.segKey = key
    if self.segments then self.segments:Hide() end
    self.segments = nil
    if #profs > 0 then
      local opts = {}
      for _, p in ipairs(profs) do opts[#opts + 1] = { value = p, label = ns.ProfName(ns.PROF[p]) } end
      self.segments = UI.Segments(self.segHolder, opts, function(v) self.prof = v page.refresh(self) end, UI.CONTENT_W)
      self.segments:SetPoint("TOPLEFT")
    end
  end
  local valid = false
  for _, p in ipairs(profs) do if p == self.prof then valid = true end end
  if not valid then self.prof = profs[1] end
  if self.segments and self.prof then self.segments:Select(self.prof) end
  return profs
end

-- Kann das Ergebnis im AH verkauft werden? (beim Aufheben gebunden / Quest = nein)
local function sellable(itemID)
  local e = ns.DB.Get(itemID)
  return not (e and (e.bind == 1 or e.bind == 4))
end
page.Sellable = sellable

local function hidden() ns.char.hiddenRecipes = ns.char.hiddenRecipes or {} return ns.char.hiddenRecipes end

-- Alle Rezepte, die der Spieler sehen soll – sortiert nach Gold-Gewinn pro Craft (oben = am meisten Gold)
function page.Entries(self)
  local c = cfg()
  local _, minProfit = R.Filter()
  local list, rank = R.List(self.prof, self.view)
  local out, stats = {}, { total = #list, unsellable = 0, noPrice = 0, tooLow = 0, hidden = 0 }
  for _, r in ipairs(list) do
    local profit, revenue, cost, unknown = S.RecipeProfit(r)
    if hidden()[r.id] then
      stats.hidden = stats.hidden + 1
    elseif not sellable(r.out) then
      stats.unsellable = stats.unsellable + 1
    elseif c.onlySafe and (unknown > 0 or not revenue) then
      stats.noPrice = stats.noPrice + 1
    elseif c.skipSlow ~= false and (function() local rt, n = ns.Ledger.SaleRate(r.out) return rt and n >= 4 and rt < 0.25 end)() then
      stats.slow = (stats.slow or 0) + 1
    elseif c.freshOnly ~= false and not (M.Age(r.out) and M.Age(r.out) <= 3) then
      stats.old = (stats.old or 0) + 1
    else
      -- Mindestgewinn aus dem Profi-String (Standard: max(15% crafting, levelgold))
      local need = ns.PriceString.Eval("minProfit", r.out, { crafting = cost }) or minProfit
      need = math.max(need, 1)
      if not profit or profit < need then
        stats.tooLow = stats.tooLow + 1
      else
        out[#out + 1] = { r = r, profit = profit, revenue = revenue, cost = cost, unknown = unknown, need = need }
      end
    end
  end
  table.sort(out, function(x, y) return x.profit > y.profit end)
  return out, rank, stats
end

function page.refresh(self)
  local _, _, auto = R.Filter()
  local preset = R.Preset()
  self.profit:Refresh()
  for _, p in ipairs(self.pills) do p:Refresh() end
  self.viewSeg:Select(self.view)
  self.makeBtn:SetLabel(self.view == "learnable" and "Rezepte suchen" or "Liste erstellen")
  self.recText:SetText((auto and ("|cffff9929Empfehlung für Level " .. ns.player.level .. ": " .. ns.Money(preset.profit) .. "|r – wächst mit jedem Level mit.")
    or ("|cffff9929Eigener Wert.|r Empfehlung für Level " .. ns.player.level .. ": " .. ns.Money(preset.profit) .. "."))
    .. " Gewinn = AH-Verkauf nach Gebühr minus Material.")
  self.recBtn:SetEnabled(not auto)
  self.recBtn:SetLabel(auto and "Empfehlung aktiv" or "Zurück zur Empfehlung")
  self.filterReset:SetShown(not (cfg().onlySafe and cfg().freshOnly ~= false))
  local hiddenCount = 0
  for _ in pairs(hidden()) do hiddenCount = hiddenCount + 1 end
  self.unhideBtn:SetLabel("Ausgeblendete (" .. hiddenCount .. ")")
  self.unhideBtn:SetEnabled(hiddenCount > 0)
  self.perRecipe:Refresh()
  for key, w in pairs(self.strings) do
    if not w.box:HasFocus() then w.box:SetText(ns.PriceString.Get(key)) end
    local custom = ns.settings.priceStrings and ns.settings.priceStrings[key]
    local isCustom = custom and custom ~= ns.PriceString.DEFAULTS[key]
    w.status:SetText(isCustom and "|cffff9929eigener String|r" or "|cffff9929empfohlen|r")
    w.undo:SetShown(isCustom and true or false)
  end

  local profs = buildSegments(self)
  local entries = {}
  ns.Debounce("shopwin", 0.2, ns.Shop.Refresh)
  if #profs == 0 then
    self.info:SetText("Du hast noch keinen Herstellungsberuf (z. B. Lederverarbeitung, Schneiderei, Alchemie). Lern einen beim Lehrer – dann erscheint er hier automatisch.")
  else
    local list, rank, st = page.Entries(self)
    local learnIDs = {}
    self.learnIDs = learnIDs
    for _, e in ipairs(list) do
      local r = e.r
      local notes = {}
      local learn = self.view == "learnable"
      local ri, riPrice, payback
      if learn then
        ri, riPrice, payback = R.Payback(r, e.profit)
        local lt = R.LearnText(r, rank)
        if lt then notes[#notes + 1] = lt end
        notes[#notes + 1] = "macht " .. ns.Item(r.out).name
        if not ri then
          notes[#notes + 1] = "|cffff9929beim Lehrer lernen|r"
        elseif riPrice then
          notes[#notes + 1] = "Rezept im AH: " .. ns.Money(riPrice) .. (payback and (" – nach " .. payback .. " Crafts bezahlt") or "")
        else
          notes[#notes + 1] = "Rezept: noch kein AH-Preis"
        end
        local d = R.Difficulty(r, rank)
        if d and d <= 1 then notes[#notes + 1] = "|cff61eb8fgibt dir Skill|r" end
        if ri then learnIDs[#learnIDs + 1] = ri end
      else
        local d = DIFF[R.Difficulty(r, rank) or 3]
        notes[#notes + 1] = UI.Hex(d[2]) .. d[1] .. "|r"
        notes[#notes + 1] = "herstellbar: " .. craftable(r)
      end
      local rate = ns.Ledger.SaleRate(r.out)
      if rate then notes[#notes + 1] = "verkauft sich: " .. math.floor(rate * 100 + 0.5) .. " %" end
      for _, q in ipairs(queue()) do
        if q.recipe == r.id then notes[#notes + 1] = "|cffff9929" .. q.n .. "× geplant|r" end
      end
      local mats = {}
      for _, re in ipairs(r.reagents) do
        local unit = M.BuyCost(re.id)
        mats[#mats + 1] = re.n .. "× " .. ns.Item(re.id).name .. " (" .. (unit and ns.Money(unit * re.n) or "kein Preis") .. ")"
      end
      entries[#entries + 1] = {
        id = learn and (ri or r.out) or r.out,
        name = learn and (ri and ns.Item(ri).name or (r.name .. " (Lehrer)")) or (r.name .. (r.qty > 1 and (" (" .. r.qty .. "×)") or "")),
        note = table.concat(notes, " · "),
        cells = {
          cost = (e.unknown > 0 and "|cffff9929min.|r " or "") .. ns.Money(e.cost),
          revenue = ns.Money(e.revenue),
          profit = "|cffff9929+|r" .. ns.Money(e.profit),
        },
        tip = { "Material: " .. (#mats > 0 and table.concat(mats, ", ") or "keins"),
          "Verkauf: " .. ns.Money(e.revenue) .. " (Verkaufswert nach Gebühr) · Gewinn " .. ns.Money(e.profit) .. " · nötig: " .. ns.Money(e.need),
          learn and (ri and "Linksklick: Rezept im AH suchen · Shift-Klick: Rezept in die Auctionator-Suche legen · Rechtsklick: ausblenden"
            or "Lernst du beim Lehrer deines Berufs · Rechtsklick: ausblenden")
            or "Linksklick: 1× in die Craft-Liste · × oder Rechtsklick: Rezept ausblenden" },
        action = function()
          hidden()[r.id] = true
          self.lastHidden = r.id
          page.refresh(self)
        end,
        actionTip = "Weg damit (Rezept ausblenden)",
        onClick = function(_, button)
          if button == "RightButton" then
            hidden()[r.id] = true
            self.lastHidden = r.id
          elseif learn then
            if ri then
              local ok, err = M.SearchNow({ ri })
              if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r Tipp: Shift-Klick legt das Rezept in die Auctionator-Suche.") end
            else
              ns.Print(r.name .. " lernst du beim Lehrer für " .. ns.ProfName(ns.PROF[r.prof]) .. ".")
            end
            return
          else
            addToQueue(r, 1)
          end
          UI.PlayClick()
          page.refresh(self)
        end,
      }
    end
    local why = {}
    if st.tooLow > 0 then why[#why + 1] = st.tooLow .. " unter deinem Mindestgewinn" end
    if st.noPrice > 0 then why[#why + 1] = st.noPrice .. " ohne AH-Preis" end
    if st.unsellable > 0 then why[#why + 1] = st.unsellable .. " nicht verkäuflich (gebunden)" end
    if (st.old or 0) > 0 then why[#why + 1] = st.old .. " mit altem Preis (über 3 Tage)" end
    if (st.slow or 0) > 0 then why[#why + 1] = st.slow .. " Ladenhüter (deine Verkaufsquote unter 25 %)" end
    if st.hidden > 0 then why[#why + 1] = st.hidden .. " ausgeblendet" end
    self.info:SetText(string.format("|cffff9929%d %s bringen Gold|r  ·  Skill %d  ·  Preise: %s%s",
      #list, #list == 1 and "Rezept" or "Rezepte", rank, M.LastScanText(),
      #why > 0 and ("\n|cff93a39dNicht gezeigt: " .. table.concat(why, ", ") .. ".|r") or ""))
  end
  local empty = (#profs == 0) and "" or (not M.HasAuctionator() and "Ohne Auctionator kennt Tiry's Zentrale keine AH-Preise – und ohne Preise lässt sich kein Gewinn berechnen. Installiere Auctionator für WoW Forever und scanne einmal im AH."
    or "Gerade bringt kein Rezept genug Gold. Tipp: Mindestgewinn senken oder im AH scannen (alte Preise).")
  -- Info-Text messen, Liste direkt darunter (nichts kann sich mehr überlappen)
  local content = self.frame.content
  self.info:ClearAllPoints()
  self.info:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -self.infoTop)
  local infoH = (#profs == 0 and #entries == 0 and self.info:GetText() == "") and 0 or math.ceil(self.info:GetStringHeight())
  local listTop = self.infoTop + infoH + 12
  self.list:ClearAllPoints()
  self.list:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -listTop)
  local h = self.list:SetEntries(entries, empty)

  local y = listTop + h + 14
  -- Nur das ZULETZT ausgeblendete Rezept als kleines "Rückgängig" (alle anderen: Mehr Optionen > Ausgeblendete)
  local hr = self.hiddenRow
  for _, c in ipairs(hr.chips) do c:Hide() end
  local last = self.lastHidden and hidden()[self.lastHidden] and R.Get(self.lastHidden)
  if last then
    local c = hr.chips[1]
    if not c then
      c = UI.Button(hr, "", "ghost", 100, 28, "refresh")
      c:SetScript("OnClick", function()
        if self.lastHidden then hidden()[self.lastHidden] = nil end
        self.lastHidden = nil
        page.refresh(self)
      end)
      UI.SetTooltip(c, "Rückgängig", "Holt das gerade ausgeblendete Rezept zurück.")
      hr.chips[1] = c
    end
    UI.FitText(c.text, "Rückgängig: " .. last.name, UI.CONTENT_W - 220)
    c:SetWidth(math.ceil(c.text:GetStringWidth()) + 48)
    c:ClearAllPoints()
    c:SetPoint("TOPLEFT", hr, "TOPLEFT", 150, 0)
    c:Show()
    hr:SetHeight(28)
    hr:ClearAllPoints()
    hr:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
    hr:Show()
    y = y + 28 + 14
  else
    hr:Hide()
  end
  y = y + 6

  -- Warteschlange
  local qc = self.queueCard
  qc:ClearAllPoints()
  qc:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
  local mats, cost, profit, crafts = ns.QueueMaterials()
  local width = UI.CONTENT_W
  local lines = {}
  for _, e in ipairs(queue()) do
    local r = R.Get(e.recipe)
    if r then lines[#lines + 1] = { r = r, n = e.n } end
  end
  local matLines = {}
  for i = 1, math.min(#mats, 12) do
    local m = mats[i]
    matLines[#matLines + 1] = m.n .. "× " .. ns.Item(m.id).name .. " " .. (m.unit and ("(" .. ns.Money(m.unit * m.n) .. (m.where == "HAENDLER" and ", Händler" or ", AH") .. ")") or "(kein Preis)")
  end
  if #lines == 0 then
    qc.text:SetText("Leer. Klick oben auf ein Rezept, um es einzuplanen (Rechtsklick nimmt es wieder raus).")
  else
    qc.text:SetText(string.format("%d Crafts geplant · erwarteter Gewinn |cffff9929%s|r · Material-Einkauf %s", crafts, ns.Money(profit), ns.Money(cost)))
  end
  local qy = 56 + math.ceil(qc.text:GetStringHeight()) + 10
  for i, l in ipairs(lines) do
    local row = qc.rows[i] or queueRow(qc, width)
    qc.rows[i] = row
    row.recipe = l.r
    row.text:SetText("|cffff9929" .. l.n .. "×|r  " .. l.r.name)
    row:ClearAllPoints()
    row:SetPoint("TOPLEFT", qc, "TOPLEFT", 20, -qy)
    row:Show()
    qy = qy + 34
  end
  for i = #lines + 1, #qc.rows do qc.rows[i]:Hide() end
  if #lines > 0 then
    qc.mats:SetText("|cffff9929Fehlt noch:|r " .. (#matLines > 0 and ("\n" .. table.concat(matLines, "\n")) or "nichts – alles in den Taschen!"))
    qc.mats:ClearAllPoints()
    qc.mats:SetPoint("TOPLEFT", qc, "TOPLEFT", 20, -(qy + 6))
    qc.mats:Show()
    qy = qy + 6 + math.ceil(qc.mats:GetStringHeight()) + 12
  else
    qc.mats:Hide()
  end
  qc.buy:ClearAllPoints(); qc.buy:SetPoint("TOPLEFT", 20, -qy)
  qc.craft:ClearAllPoints(); qc.craft:SetPoint("LEFT", qc.buy, "RIGHT", 10, 0)
  qc.clear:ClearAllPoints(); qc.clear:SetPoint("LEFT", qc.craft, "RIGHT", 10, 0)
  qc.buy:SetEnabled(#mats > 0 and M.HasAuctionator())
  qc.craft:SetEnabled(#lines > 0 and S.tradeOpen == true)
  if #queue() == 0 and page.undoQueue then
    qc.clear:SetLabel("Rückgängig")
    qc.clear:SetEnabled(true)
  else
    qc.clear:SetLabel("Alles leeren")
    qc.clear:SetEnabled(#queue() > 0)
  end
  local qh = qy + 34 + 20
  qc:SetHeight(qh)
  y = y + qh + 20

  -- Profi-Strings (eingeklappt, damit die Seite übersichtlich bleibt)
  self.proToggle:ClearAllPoints()
  self.proToggle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  local expert = ns.settings.expertMode == true
  self.proToggle:SetLabel(self.proOpen and "Mehr Optionen ausblenden" or (expert and "Mehr Optionen: Filter & Preisformeln" or "Mehr Optionen: Filter"))
  self.formulaFrame:SetShown(expert)
  self.proCard:SetHeight(expert and self.proFullH or self.proFilterH)
  y = y + 32 + 12
  self.proCard:ClearAllPoints()
  if self.proOpen then
    self.proCard:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
    self.proCard:Show()
    y = y + self.proCard:GetHeight() + 12
  else
    self.proCard:Hide()
  end
  content:SetHeight(y + 20)
end

ns.Listen("PROFESSIONS_CHANGED", function() local p = UI.pages.recipes if p then p.segKey = nil end end)

UI.RegisterPage("recipes", page)
