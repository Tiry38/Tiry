-- Tiry's Zentrale – Seite "Craft-Planer" (wie TSM Crafting): erkennt deine Berufe und gelernten Rezepte automatisch,
-- zwei einfache Gold-Filter mit Level-Empfehlung, Warteschlange, fehlendes Material, Craften per Knopf.
local ADDON, ns = ...
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
    local missing = math.max(0, n - itemCount(id))
    if missing > 0 then
      local unit, where = M.BuyCost(id)
      list[#list + 1] = { id = id, n = missing, unit = unit, where = where }
      cost = cost + (unit or 0) * missing
    end
  end
  table.sort(list, function(a, b) return (a.unit or 0) * a.n > (b.unit or 0) * b.n end)
  return list, cost, profit, crafts
end

----------------------------------------------------------------------------
function page.build(self, content, width)
  self.view = "known"
  local st = UI.Stack(content)

  -- Filterkarte: EIN Regler (Mindestgewinn in Gold), Empfehlung wächst mit deinem Level
  local fc = CreateFrame("Frame", nil, content)
  fc:SetSize(width, 128)
  fc.bg = UI.Round(fc, 22, "BACKGROUND", 0)
  fc.bg:SetGradient({ { 0.26, 0.15, 0.06 }, { 0.22, 0.09, 0.20 }, { 0.12, 0.10, 0.30 } }, 0.95)
  local title = UI.Text(fc, 15, "bold", C.text)
  title:SetPoint("TOPLEFT", 20, -16)
  title:SetText("Zeig mir Rezepte mit mindestens so viel Gewinn pro Craft:")
  local refresh = function() page.refresh(self) end
  self.profit = UI.Stepper(fc, "Mindestgewinn", 340, function() return (select(2, R.Filter())) end,
    function(v) R.SetProfit(v) end,
    function(v, dir)
      local base = (dir > 0) and v or v - 1
      if base < 10000 then return 500 elseif base < 100000 then return 5000 end
      return 50000
    end, 0, 10000000, function(v) return v == 0 and "alles" or ns.Money(v) end)
  self.profit:SetPoint("TOPLEFT", 20, -44)
  self.profit.onChange = refresh
  self.recBtn = UI.Button(fc, "Empfehlung für mein Level", "primary", 240, 34, "star")
  self.recBtn:SetPoint("TOPRIGHT", -20, -44)
  self.recBtn:SetScript("OnClick", function() R.ResetStyle() page.refresh(self) end)
  self.recText = UI.Para(fc, 11, C.muted, width - 40)
  self.recText:SetPoint("TOPLEFT", 20, -88)
  st:Add(fc, 128, 14)

  self.segHolder = CreateFrame("Frame", nil, content)
  self.segHolder:SetSize(width, 30)
  st:Add(self.segHolder, 30, 8)
  self.viewSeg = UI.Segments(content, VIEWS, function(v) self.view = v page.refresh(self) end, width)
  st:Add(self.viewSeg, self.viewSeg:GetHeight(), 8)
  local pills = CreateFrame("Frame", nil, content)
  pills:SetSize(width, 30)
  self.pills = {}
  local p = UI.Pill(pills, "Nur mit bekannten Preisen", function() return cfg().onlySafe end, function(v) cfg().onlySafe = v end, refresh)
  p:SetPoint("TOPLEFT", 0, 0)
  self.pills[1] = p
  self.unhideBtn = UI.Button(pills, "Ausgeblendete zurückholen", "soft", 230, 30, "refresh")
  self.unhideBtn:SetPoint("LEFT", p, "RIGHT", 8, 0)
  self.unhideBtn:SetScript("OnClick", function() ns.char.hiddenRecipes = {} page.refresh(self) end)
  self.scanBtn = UI.Button(pills, "AH scannen", "cool", 140, 30, "refresh")
  self.scanBtn:SetPoint("TOPRIGHT")
  self.scanBtn:SetScript("OnClick", function() M.StartScan() end)
  st:Add(pills, 30, 12)

  self.info = UI.Para(content, 12, C.gold, width)
  st:Add(self.info, 34, 8)
  self.list = UI.ItemList(content, width, {
    { key = "cost", label = "Material", width = 84 },
    { key = "revenue", label = "Verkauf", width = 84 },
    { key = "profit", label = "Gewinn", width = 96, bold = true },
  })
  st:Add(self.list, nil)
  self.listTop = st.y

  -- Warteschlange
  local qc = UI.Card(content, 20, C.card)
  qc:SetWidth(width)
  self.queueCard = qc
  qc.title = UI.Text(qc, 16, "bold", C.text)
  qc.title:SetPoint("TOPLEFT", 20, -18)
  qc.title:SetText("Craft-Warteschlange")
  qc.text = UI.Para(qc, 12, C.muted, width - 40)
  qc.text:SetPoint("TOPLEFT", qc.title, "BOTTOMLEFT", 0, -8)
  qc.buy = UI.Button(qc, "Fehlendes Material als Einkaufsliste", "primary", 300, 34, "cart")
  qc.buy:SetScript("OnClick", function()
    local mats = ns.QueueMaterials()
    local ids = {}
    for _, m in ipairs(mats) do ids[#ids + 1] = m.id end
    if #ids == 0 then ns.Print("Du hast schon alles Material in den Taschen.") return end
    local ok, n = M.CreateShoppingList("Zentrale: Craft-Material", ids)
    ns.Print(ok and ("Liste |cffffd24aTiry's Zentrale: Craft-Material|r angelegt (" .. n .. " Items). Im AH: Auctionator > Einkaufen > Suche alles.") or ("|cffff6b81" .. tostring(n) .. "|r"))
  end)
  qc.craft = UI.Button(qc, "Nächstes craften", "cool", 190, 34, "bolt")
  qc.craft:SetScript("OnClick", function() page.CraftNext(self) end)
  UI.SetTooltip(qc.craft, "Craften", "Bei offenem Berufsfenster: stellt den ersten passenden Eintrag her – so oft dein Material reicht.")
  qc.clear = UI.Button(qc, "Alles leeren", "danger", 150, 34, "close")
  qc.clear:SetScript("OnClick", function() page.ClearQueue() end)
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
  if C_TradeSkillUI.GetAllRecipeIDs then ids = C_TradeSkillUI.GetAllRecipeIDs() or {} end
  if #ids == 0 and C_TradeSkillUI.GetFilteredRecipeIDs then ids = C_TradeSkillUI.GetFilteredRecipeIDs() or {} end
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

function page.ClearQueue()
  wipe(queue())
  pendingCraft = nil
  ns.Print("Craft-Warteschlange geleert.")
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
  if not (S.tradeOpen and C_TradeSkillUI and C_TradeSkillUI.CraftRecipe) then
    ns.Print("Öffne zuerst das Berufsfenster.")
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
        ns.Print(string.format("Stelle |cffffd24a%d× %s|r her.", n, r.name))
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
    elseif not profit or profit < math.max(minProfit, 1) then
      stats.tooLow = stats.tooLow + 1
    else
      out[#out + 1] = { r = r, profit = profit, revenue = revenue, cost = cost, unknown = unknown }
    end
  end
  table.sort(out, function(x, y) return x.profit > y.profit end)
  return out, rank, stats
end

function page.refresh(self)
  local _, minProfit, auto = R.Filter()
  local preset = R.Preset()
  self.profit:Refresh()
  for _, p in ipairs(self.pills) do p:Refresh() end
  self.viewSeg:Select(self.view)
  self.recText:SetText((auto and ("|cff61eb8fEmpfehlung für Level " .. ns.player.level .. ": " .. ns.Money(preset.profit) .. "|r – wächst mit jedem Level mit.")
    or ("|cffffd24aEigener Wert.|r Empfehlung für Level " .. ns.player.level .. ": " .. ns.Money(preset.profit) .. "."))
    .. " Gewinn = Verkauf im AH (nach Gebühr) minus Materialwert. Oben steht immer, was am meisten Gold bringt.")
  self.recBtn:SetEnabled(not auto)
  self.scanBtn:SetEnabled(M.ahOpen == true and M.HasAuctionator())
  local hiddenCount = 0
  for _ in pairs(hidden()) do hiddenCount = hiddenCount + 1 end
  self.unhideBtn:SetLabel("Ausgeblendete zurückholen (" .. hiddenCount .. ")")
  self.unhideBtn:SetEnabled(hiddenCount > 0)

  local profs = buildSegments(self)
  local entries = {}
  if #profs == 0 then
    self.info:SetText("Du hast noch keinen Herstellungsberuf (z. B. Lederverarbeitung, Schneiderei, Alchemie). Lern einen beim Lehrer – dann erscheint er hier automatisch.")
  else
    local list, rank, st = page.Entries(self)
    for _, e in ipairs(list) do
      local r = e.r
      local notes = {}
      if self.view == "learnable" then
        notes[#notes + 1] = "|cffff6b81noch nicht gelernt|r"
        if r.yellow > 0 then notes[#notes + 1] = "gelb ab Skill " .. r.yellow end
      else
        local d = DIFF[R.Difficulty(r, rank) or 3]
        notes[#notes + 1] = UI.Hex(d[2]) .. d[1] .. "|r"
        notes[#notes + 1] = "herstellbar: " .. craftable(r)
      end
      for _, q in ipairs(queue()) do
        if q.recipe == r.id then notes[#notes + 1] = "|cffffd24a" .. q.n .. "× geplant|r" end
      end
      local mats = {}
      for _, re in ipairs(r.reagents) do
        local unit = M.BuyCost(re.id)
        mats[#mats + 1] = re.n .. "× " .. ns.Item(re.id).name .. " (" .. (unit and ns.Money(unit * re.n) or "kein Preis") .. ")"
      end
      entries[#entries + 1] = {
        id = r.out, name = r.name .. (r.qty > 1 and (" (" .. r.qty .. "×)") or ""),
        note = table.concat(notes, " · "),
        cells = {
          cost = (e.unknown > 0 and "|cffffd24amin.|r " or "") .. ns.Money(e.cost),
          revenue = ns.Money(e.revenue),
          profit = "|cff61eb8f+|r" .. ns.Money(e.profit),
        },
        tip = { "Material: " .. (#mats > 0 and table.concat(mats, ", ") or "keins"),
          "Verkauf: " .. ns.Money(e.revenue) .. " (AH-Preis nach Gebühr) · Gewinn " .. ns.Money(e.profit),
          "Linksklick: in die Warteschlange · Rechtsklick: Rezept ausblenden" },
        onClick = function(_, button)
          if button == "RightButton" then
            hidden()[r.id] = true
            ns.Print(r.name .. " ausgeblendet. Zurückholen: Knopf \"Ausgeblendete zurückholen\".")
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
    if st.hidden > 0 then why[#why + 1] = st.hidden .. " ausgeblendet" end
    self.info:SetText(string.format("%s (Skill %d): |cff61eb8f%d Rezepte bringen Gold.|r %s\nPreise: %s",
      ns.ProfName(ns.PROF[self.prof]), rank, #list, #why > 0 and ("Nicht gezeigt: " .. table.concat(why, ", ") .. ".") or "", M.LastScanText()))
  end
  local empty = (#profs == 0) and "" or (not M.HasAuctionator() and "Ohne Auctionator kennt Tiry's Zentrale keine AH-Preise – und ohne Preise lässt sich kein Gewinn berechnen. Installiere Auctionator für WoW Forever und scanne einmal im AH."
    or "Gerade bringt kein Rezept genug Gold. Tipp: Mindestgewinn senken oder im AH scannen (alte Preise).")
  local h = self.list:SetEntries(entries, empty)

  -- Warteschlange
  local qc = self.queueCard
  local y = self.listTop + h + 20
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
    qc.text:SetText(string.format("%d Crafts geplant · erwarteter Gewinn |cff61eb8f%s|r · Material-Einkauf %s", crafts, ns.Money(profit), ns.Money(cost)))
  end
  local qy = 56 + math.ceil(qc.text:GetStringHeight()) + 10
  for i, l in ipairs(lines) do
    local row = qc.rows[i] or queueRow(qc, width)
    qc.rows[i] = row
    row.recipe = l.r
    row.text:SetText("|cffffd24a" .. l.n .. "×|r  " .. l.r.name .. "  |cff9a93bd" .. ns.ProfName(ns.PROF[l.r.prof]) .. "|r")
    row:ClearAllPoints()
    row:SetPoint("TOPLEFT", qc, "TOPLEFT", 20, -qy)
    row:Show()
    qy = qy + 34
  end
  for i = #lines + 1, #qc.rows do qc.rows[i]:Hide() end
  if #lines > 0 then
    qc.mats:SetText("|cffffd24aFehlt noch:|r " .. (#matLines > 0 and ("\n" .. table.concat(matLines, "\n")) or "nichts – alles in den Taschen!"))
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
  qc.clear:SetEnabled(#queue() > 0)
  local qh = qy + 34 + 20
  qc:SetHeight(qh)
  self.frame.content:SetHeight(y + qh + 30)
end

ns.Listen("PROFESSIONS_CHANGED", function() local p = UI.pages.recipes if p then p.segKey = nil end end)

UI.RegisterPage("recipes", page)
