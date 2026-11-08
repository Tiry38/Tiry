-- Goldrausch – Seite "Craft-Planer" (wie TSM Crafting): Rezepte mit Gewinn-Filtern, Warteschlange, Materialliste
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local S = ns.Scanner

local DIFF = {
  [0] = { "orange", { 1, 0.5, 0.25 } }, [1] = { "gelb", { 1, 1, 0 } },
  [2] = { "grün", { 0.25, 0.75, 0.25 } }, [3] = { "grau", { 0.5, 0.5, 0.5 } },
}

local page = {
  title = "Craft-Planer",
  subtitle = "Was du mit deinen Berufen herstellen solltest – gefiltert nach Gewinn, wie bei TSM.",
  icon = "flask", label = "Craft-Planer", order = 6,
}

local function cfg() return ns.settings.craft end

local function itemCount(id)
  if C_Item and C_Item.GetItemCount then return C_Item.GetItemCount(id, false) or 0 end
  return 0
end

-- Wie oft kann ich das Rezept mit meinen Taschen herstellen?
local function craftable(r)
  local n
  for _, re in ipairs(r.reagents) do
    local k = math.floor(itemCount(re.id) / re.n)
    n = n and math.min(n, k) or k
  end
  return n or 0
end

local function queue() ns.char.queue = ns.char.queue or {} return ns.char.queue end

local function findRecipe(prof, id)
  local data = (ns.char.recipes or {})[prof]
  if not data then return nil end
  for _, r in ipairs(data.list) do if r.id == id then return r end end
end

local function addToQueue(prof, r, delta)
  local q = queue()
  for i, e in ipairs(q) do
    if e.prof == prof and e.recipe == r.id then
      e.n = e.n + delta
      if e.n <= 0 then table.remove(q, i) end
      return
    end
  end
  if delta > 0 then q[#q + 1] = { prof = prof, recipe = r.id, n = delta } end
end

-- Benötigte Materialien der Warteschlange minus Taschen
function ns.QueueMaterials()
  local need, profit, crafts = {}, 0, 0
  for _, e in ipairs(queue()) do
    local r = findRecipe(e.prof, e.recipe)
    if r then
      crafts = crafts + e.n
      local p = S.RecipeProfit(r)
      profit = profit + (p or 0) * e.n
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

function page.build(self, content, width)
  local st = UI.Stack(content)
  st:Para("Öffne jedes Berufsfenster einmal – Goldrausch kennt dann alle deine Rezepte (auch nicht gelernte, wenn das Berufsfenster sie zeigt). "
    .. "|cffffd24aLinksklick|r = 1× in die Warteschlange, |cffffd24aRechtsklick|r = 1× raus. Gewinn = AH-Erlös nach Gebühr − Materialwert.", 12, C.muted, 12)
  self.segHolder = CreateFrame("Frame", nil, content)
  self.segHolder:SetSize(width, 30)
  st:Add(self.segHolder, 30, 12)

  -- Filter (wie TSM-Gruppen-Einstellungen)
  local f = CreateFrame("Frame", nil, content)
  f:SetSize(width, 76)
  local half = math.floor((width - 10) / 2)
  local refresh = function() page.refresh(self) end
  self.margin = UI.Stepper(f, "Min. Gewinn in %", half, function() return cfg().minMargin end, function(v) cfg().minMargin = v end,
    10, 0, 500, function(v) return v .. " %" end)
  self.margin:SetPoint("TOPLEFT")
  self.margin.onChange = refresh
  self.minProfit = UI.Stepper(f, "Min. Gewinn pro Craft", half, function() return cfg().minProfit end, function(v) cfg().minProfit = v end,
    function(v, dir) if v + dir * 1 < 10000 then return 1000 end return 10000 end, 0, 10000000, function(v) return v == 0 and "egal" or ns.Money(v) end)
  self.minProfit:SetPoint("TOPRIGHT")
  self.minProfit.onChange = refresh
  local x = 0
  self.pills = {}
  for _, def in ipairs({
    { "Nur gelernte", "onlyLearned" }, { "Nur sichere Preise", "onlySafe" }, { "Nur mit Skill-Up", "onlySkill" },
  }) do
    local p = UI.Pill(f, def[1], function() return cfg()[def[2]] end, function(v) cfg()[def[2]] = v end, refresh)
    p:SetPoint("TOPLEFT", x, -44)
    x = x + p:GetWidth() + 8
    self.pills[#self.pills + 1] = p
  end
  st:Add(f, 76, 12)

  self.info = UI.Para(content, 12, C.gold, width)
  st:Add(self.info, 18, 8)
  self.list = UI.ItemList(content, width, {
    { key = "cost", label = "Material", width = 82 },
    { key = "revenue", label = "Erlös", width = 82 },
    { key = "profit", label = "Gewinn", width = 92, bold = true },
    { key = "margin", label = "in %", width = 56 },
  })
  st:Add(self.list, nil)
  self.listTop = st.y

  -- Warteschlange
  self.queueCard = UI.Card(content, 20, C.card)
  self.queueCard:SetWidth(width)
  local qc = self.queueCard
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
    local ok, n = M.CreateShoppingList("Goldrausch: Craft-Material", ids)
    ns.Print(ok and ("Liste |cffffd24aGoldrausch: Craft-Material|r angelegt (" .. n .. " Items). Im AH: Auctionator > Einkaufen.") or ("|cffff6b81" .. tostring(n) .. "|r"))
  end)
  qc.craft = UI.Button(qc, "Nächstes craften", "cool", 190, 34, "bolt")
  qc.craft:SetScript("OnClick", function() page.CraftNext(self) end)
  UI.SetTooltip(qc.craft, "Craften", "Funktioniert, während das passende Berufsfenster offen ist: stellt den ersten Eintrag der Warteschlange her (so oft dein Material reicht).")
  qc.clear = UI.Button(qc, "Leeren", "soft", 100, 34, "close")
  qc.clear:SetScript("OnClick", function() ns.char.queue = {} page.refresh(self) end)
end

function page.CraftNext(self)
  if not (S.tradeOpen and C_TradeSkillUI and C_TradeSkillUI.CraftRecipe) then
    ns.Print("Öffne zuerst das Berufsfenster.")
    return
  end
  for _, e in ipairs(queue()) do
    if e.prof == S.openProf then
      local r = findRecipe(e.prof, e.recipe)
      local n = r and math.min(e.n, craftable(r)) or 0
      if r and n > 0 then
        C_TradeSkillUI.CraftRecipe(r.id, n)
        addToQueue(e.prof, r, -n)
        ns.Print(string.format("Stelle %d× %s her.", n, r.name))
        page.refresh(self)
        return
      end
    end
  end
  ns.Print("Nichts in der Warteschlange für " .. (S.openProf or "diesen Beruf") .. ", das du mit deinem Material herstellen kannst.")
end

local function buildSegments(self)
  local names = {}
  for name in pairs(ns.char.recipes or {}) do names[#names + 1] = name end
  table.sort(names)
  local key = table.concat(names, "|")
  if self.segKey ~= key then
    self.segKey = key
    if self.segments then self.segments:Hide() end
    self.segments = nil
    if #names > 0 then
      local opts = {}
      for _, n in ipairs(names) do opts[#opts + 1] = { value = n, label = n } end
      self.segments = UI.Segments(self.segHolder, opts, function(v) self.prof = v page.refresh(self) end, UI.CONTENT_W)
      self.segments:SetPoint("TOPLEFT")
    end
  end
  if not self.prof or not (ns.char.recipes or {})[self.prof] then self.prof = names[1] end
  if self.segments and self.prof then self.segments:Select(self.prof) end
  return names
end

function page.refresh(self)
  local c = cfg()
  self.margin:Refresh()
  self.minProfit:Refresh()
  for _, p in ipairs(self.pills) do p:Refresh() end
  local names = buildSegments(self)
  local data = self.prof and (ns.char.recipes or {})[self.prof]
  local entries, total, shown = {}, 0, 0
  if data then
    for _, r in ipairs(data.list) do
      total = total + 1
      local profit, revenue, cost, unknown = S.RecipeProfit(r)
      local margin = (profit and cost and cost > 0) and (profit / cost * 100) or nil
      local pass = true
      if c.onlyLearned and r.learned == false then pass = false end
      if c.onlySafe and (unknown > 0 or not revenue) then pass = false end
      if c.onlySkill and not (r.difficulty == 0 or r.difficulty == 1) then pass = false end
      if pass and c.minMargin > 0 and not (margin and margin >= c.minMargin) then pass = false end
      if pass and c.minProfit > 0 and not (profit and profit >= c.minProfit) then pass = false end
      if pass then
        shown = shown + 1
        local d = DIFF[r.difficulty or 3]
        local can = r.learned ~= false and craftable(r) or 0
        local notes = {}
        if r.learned == false then notes[#notes + 1] = "|cffff6b81nicht gelernt – beim Lehrer/Händler holen|r" end
        if d and r.learned ~= false then notes[#notes + 1] = UI.Hex(d[2]) .. d[1] .. "|r" end
        notes[#notes + 1] = "herstellbar: " .. can
        local inQueue = 0
        for _, e in ipairs(queue()) do if e.prof == self.prof and e.recipe == r.id then inQueue = e.n end end
        if inQueue > 0 then notes[#notes + 1] = "|cffffd24a" .. inQueue .. "× in Warteschlange|r" end
        local mats = {}
        for _, re in ipairs(r.reagents) do
          local unit = M.BuyCost(re.id)
          mats[#mats + 1] = re.n .. "× " .. ns.Item(re.id).name .. " (" .. (unit and ns.Money(unit * re.n) or "kein Preis") .. ")"
        end
        entries[#entries + 1] = {
          id = r.out, name = r.name, sortValue = profit or -math.huge,
          note = table.concat(notes, " · "),
          cells = {
            cost = (unknown > 0 and "|cffffd24amin.|r " or "") .. ns.Money(cost),
            revenue = revenue and ns.Money(revenue) or "–",
            profit = profit and ((profit >= 0 and "|cff61eb8f+|r" or "") .. ns.Money(profit)) or "–",
            margin = margin and ((margin >= 0 and "|cff61eb8f" or "|cffff6b81") .. math.floor(margin + 0.5) .. "|r") or "–",
          },
          tip = { "Material: " .. (#mats > 0 and table.concat(mats, ", ") or "keins"), "Linksklick: +1 Warteschlange · Rechtsklick: -1" },
          onClick = function(_, button)
            addToQueue(self.prof, r, button == "RightButton" and -1 or 1)
            UI.PlayClick()
            page.refresh(self)
          end,
        }
      end
    end
    table.sort(entries, function(a, b) return a.sortValue > b.sortValue end)
    self.info:SetText(string.format("%s%s: %d von %d Rezepten erfüllen deine Filter.",
      self.prof, data.rank and (" (" .. data.rank .. "/" .. (data.maxRank or "?") .. ")") or "", shown, total))
  else
    self.info:SetText(#names == 0 and "Noch keine Rezepte bekannt – öffne dein Berufsfenster (z. B. Lederverarbeitung)." or "")
  end
  local h = self.list:SetEntries(entries, data and "Kein Rezept erfüllt die Filter. Tipp: \"Min. Gewinn in %\" senken oder \"Nur sichere Preise\" ausschalten." or "Öffne dein Berufsfenster, damit Goldrausch deine Rezepte kennt.")

  -- Warteschlange
  local qc = self.queueCard
  local y = self.listTop + h + 20
  qc:ClearAllPoints()
  qc:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
  local mats, cost, profit, crafts = ns.QueueMaterials()
  local lines = {}
  for _, e in ipairs(queue()) do
    local r = findRecipe(e.prof, e.recipe)
    if r then lines[#lines + 1] = "|cffffd24a" .. e.n .. "×|r " .. r.name .. " |cff9a93bd(" .. e.prof .. ")|r" end
  end
  local matLines = {}
  for i = 1, math.min(#mats, 12) do
    local m = mats[i]
    matLines[#matLines + 1] = m.n .. "× " .. ns.Item(m.id).name .. " " .. (m.unit and ("(" .. ns.Money(m.unit * m.n) .. (m.where == "HAENDLER" and ", Händler" or ", AH") .. ")") or "(kein Preis)")
  end
  if #lines == 0 then
    qc.text:SetText("Leer. Klick oben auf ein Rezept, um es einzuplanen.")
  else
    qc.text:SetText(string.format("%d Crafts geplant · erwarteter Gewinn |cff61eb8f%s|r · Material-Einkauf %s\n\n%s\n\n|cffffd24aFehlt noch:|r %s",
      crafts, ns.Money(profit), ns.Money(cost), table.concat(lines, "\n"),
      #matLines > 0 and ("\n" .. table.concat(matLines, "\n")) or "nichts – alles in den Taschen!"))
  end
  local th = math.ceil(qc.text:GetStringHeight())
  qc.buy:ClearAllPoints(); qc.buy:SetPoint("TOPLEFT", 20, -(56 + th + 12))
  qc.craft:ClearAllPoints(); qc.craft:SetPoint("LEFT", qc.buy, "RIGHT", 10, 0)
  qc.clear:ClearAllPoints(); qc.clear:SetPoint("LEFT", qc.craft, "RIGHT", 10, 0)
  qc.buy:SetEnabled(#mats > 0 and M.HasAuctionator())
  qc.craft:SetEnabled(#lines > 0 and S.tradeOpen == true)
  qc.clear:SetEnabled(#lines > 0)
  local qh = 56 + th + 12 + 34 + 20
  qc:SetHeight(qh)
  self.frame.content:SetHeight(y + qh + 30)
end

UI.RegisterPage("recipes", page)
