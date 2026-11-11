-- Tiry's Zentrale – Craftfenster am Berufsfenster: Beruf öffnen, alles dort sehen und einstellen.
-- Oben am Berufsfenster schaltest du um: "WoW" = nur Blizzards Fenster, "TZ" = mit diesem Zentrale-Fenster daneben.
-- Reiter: Rezept (das links gewählte, mit Gewinn/Material/Absatz), Top-Rezepte (was Gold bringt), Liste
-- (Craft-Warteschlange), Optionen (Mindestgewinn, Filter, Menge). Alles nutzt dieselben Daten wie der Craft-Planer.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local S = ns.Scanner
local R = ns.Recipes

local P = {}
ns.CraftPanel = P

local W, PAD, HEAD, FOOT = 400, 18, 124, 70
local IW = W - 2 * PAD
local TABS = {
  { value = "recipe", label = "Rezept" },
  { value = "top", label = "Top-Rezepte" },
  { value = "queue", label = "Liste" },
  { value = "setup", label = "Optionen" },
}
local DEMAND_COL = {}
for k, l in pairs(ns.Demand.LABEL) do
  local h = l[2]
  DEMAND_COL[k] = { tonumber(h:sub(1, 2), 16) / 255, tonumber(h:sub(3, 4), 16) / 255, tonumber(h:sub(5, 6), 16) / 255 }
end
local DIFF = { [0] = { "orange", { 1, 0.5, 0.25 } }, [1] = { "gelb", { 1, 0.9, 0.2 } }, [2] = { "grün", { 0.3, 0.85, 0.35 } }, [3] = { "grau", { 0.6, 0.6, 0.6 } } }

local function cfg() return ns.settings.craftPanel end
local function craftCfg() return ns.settings.craft end
local function page() return UI.pages.recipes end
local function queue() ns.char.queue = ns.char.queue or {} return ns.char.queue end
local function hidden() ns.char.hiddenRecipes = ns.char.hiddenRecipes or {} return ns.char.hiddenRecipes end

-- Beruf des offenen Fensters (Schlüssel wie "LEATHERWORKING") + Anzeige
local function profKey() return S.openProfKey and S.openProfKey() end
local function profLine()
  local info
  if C_TradeSkillUI and C_TradeSkillUI.GetBaseProfessionInfo then
    local ok, i = pcall(C_TradeSkillUI.GetBaseProfessionInfo)
    if ok then info = i end
  end
  if not (info and info.professionName) then return "Berufsfenster" end
  local s = info.professionName
  if info.skillLevel and info.maxSkillLevel and info.maxSkillLevel > 0 then
    s = s .. "  ·  Skill " .. info.skillLevel .. "/" .. info.maxSkillLevel
  end
  return s
end

-- Das im Berufsfenster gewählte Rezept -> unsere Rezeptdaten
local function currentRecipe()
  local id = P.recipeID
  if not id then
    local PF = _G.ProfessionsFrame
    local form = PF and PF.CraftingPage and PF.CraftingPage.SchematicForm
    if form and form.GetRecipeInfo then
      local ok, info = pcall(form.GetRecipeInfo, form)
      if ok and type(info) == "table" then id = info.recipeID end
    end
  end
  if not id then return nil end
  return (R.FromLive and R.FromLive(id)) or R.Get(id), id
end

local function addToQueue(r, n)
  local pg = page()
  if pg and pg.AddToQueue then pg.AddToQueue(r, n) end
  UI.RefreshPage("recipes")
  ns.Fire("SHOP_CHANGED")
  P.Dirty()
end

local function plannedFor(r)
  for _, e in ipairs(queue()) do if e.recipe == r.id then return e.n end end
  return 0
end

-- Rezept im Berufsfenster anwählen (Klick in der Top-Liste)
local function selectInBlizzard(r)
  local pg = page()
  local live = pg and pg.ResolveLive and pg.ResolveLive(r)
  if live and C_TradeSkillUI and C_TradeSkillUI.OpenRecipe then pcall(C_TradeSkillUI.OpenRecipe, live) end
  P.recipeID = live or r.id
end

----------------------------------------------------------------------------
-- Bausteine
----------------------------------------------------------------------------
local function section(parent, text)
  local h = UI.Text(parent, 12, "semibold", C.muted)
  h:SetText(text)
  h.dot = parent:CreateTexture(nil, "ARTWORK")
  h.dot:SetTexture(UI.TEX.circle)
  h.dot:SetSize(7, 7)
  h.dot:SetPoint("LEFT", h, "LEFT", -14, 0)
  UI.SetGradV(h.dot, C.amber, C.teal, 1)
  h.line = UI.Hairline(parent, C.teal, 0.30)
  h.line:SetPoint("LEFT", h, "RIGHT", 10, 0)
  h.line:SetPoint("RIGHT", parent, "RIGHT", -2, 0)
  function h:Place(y)
    self:ClearAllPoints()
    self:SetPoint("TOPLEFT", parent, "TOPLEFT", 14, -y)
    self:Show() self.dot:Show() self.line:Show()
  end
  function h:Off() self:Hide() self.dot:Hide() self.line:Hide() end
  return h
end

-- Zeile mit weichem Glas (kein Kasten-Raster: runde Pille, Hover-Leuchten)
local function rowShape(row, h)
  local shape = UI.PillShape(row, h, 0, false)
  row.edge, row.bg = shape.edge, shape.body
  row.edge:SetGradientV({ 0.60, 1.00, 0.85, 0.14 }, { 0.20, 0.55, 0.65, 0.04 })
  row.bg:SetGradientV(UI.GLASS.pill[1], UI.GLASS.pill[2], 0.55)
  row.glow = UI.Glow(row, C.amber, 200, 0, "BACKGROUND")
  row.glow:SetPoint("CENTER")
  row.glow:SetHeight(h * 2)
end
local function rowHover(row, on)
  row.glow:SetAlpha(on and 0.10 or 0)
  row.edge:SetGradient(UI.GRAD_EDGE, on and 0.45 or 0.14)
end

----------------------------------------------------------------------------
-- Reiter "Rezept"
----------------------------------------------------------------------------
local function buildRecipe(t, cw)
  local hero = UI.Card(t, 22, nil, { hero = true })
  hero:SetSize(cw, 118)
  t.hero = hero
  hero.icon = UI.ItemIcon(hero, 46)
  hero.icon:SetPoint("TOPLEFT", 16, -16)
  hero.name = UI.Text(hero, 15, "bold", C.text)
  hero.name:SetPoint("TOPLEFT", 74, -18)
  hero.name:SetWidth(cw - 90)
  hero.name:SetWordWrap(false)
  hero.sub = UI.Text(hero, 12, "regular", C.muted)
  hero.sub:SetPoint("TOPLEFT", hero.name, "BOTTOMLEFT", 0, -5)
  hero.sub:SetWidth(cw - 90)
  hero.sub:SetWordWrap(false)
  hero.profit = UI.Text(hero, 22, "bold", C.text)
  hero.profit:SetPoint("BOTTOMLEFT", 18, 16)
  hero.plabel = UI.Text(hero, 12, "semibold", C.dim)
  hero.plabel:SetPoint("BOTTOMLEFT", hero.profit, "BOTTOMRIGHT", 10, 3)
  hero.plabel:SetText("pro Craft")
  hero.chip = UI.Chip(hero, "", C.gold)
  hero.chip:SetPoint("BOTTOMRIGHT", -16, 18)

  local pw = math.floor((cw - 8) / 2)
  t.pills = {
    UI.StatPill(t, pw, "Verkauf (nach Gebühr)", C.amber, 56),
    UI.StatPill(t, pw, "Material", C.aqua, 56),
    UI.StatPill(t, pw, "Gold pro Tag", C.teal, 56),
    UI.StatPill(t, pw, "Verkauft sich", C.green, 56),
  }
  t.matHead = section(t, "Material")
  t.mats = {}
  t.noteHead = section(t, "Empfehlung")
  t.note = UI.Para(t, 12, C.muted, cw - 14)
  t.rec = UI.Button(t, "Einplanen", "primary", 186, 34, "star")
  t.rec:SetScript("OnClick", function(b) if b.r and (b.n or 0) > 0 then addToQueue(b.r, b.n) ns.Print(b.n .. "× " .. b.r.name .. " auf die Craft-Liste.") end end)
  UI.SetTooltip(t.rec, "Empfohlene Menge einplanen", "So viele, wie sich bei dir verkaufen – minus was schon in Taschen, Bank und im AH liegt.")
  t.plus = UI.Button(t, "+1", "soft", 76, 34, "plus")
  t.plus:SetScript("OnClick", function(b) if b.r then addToQueue(b.r, 1) end end)
  UI.SetTooltip(t.plus, "1× auf die Craft-Liste")
  t.hide = UI.IconButton(t, "close", 34, "Rezept ausblenden (in Top-Rezepten und im Craft-Planer)")
  t.hide:SetScript("OnClick", function(b)
    if b.r then hidden()[b.r.id] = true ns.Print(b.r.name .. " ausgeblendet – zurückholen unter Optionen.") UI.RefreshPage("recipes") P.Dirty() end
  end)
  t.empty = UI.Para(t, 13, C.muted, cw - 20)
end

local function matRow(t, i, cw)
  local row = t.mats[i]
  if row then return row end
  row = CreateFrame("Frame", nil, t)
  row:SetSize(cw, 40)
  row.icon = UI.ItemIcon(row, 28)
  row.icon:SetPoint("LEFT", 4, 0)
  row.name = UI.Text(row, 12, "semibold", C.text)
  row.name:SetPoint("TOPLEFT", 42, -4)
  row.name:SetWidth(cw - 42 - 92)
  row.name:SetWordWrap(false)
  row.have = UI.Text(row, 12, "regular", C.muted)
  row.have:SetPoint("TOPLEFT", row.name, "BOTTOMLEFT", 0, -3)
  row.have:SetWidth(cw - 42 - 92)
  row.have:SetWordWrap(false)
  row.price = UI.Text(row, 12, "semibold", C.text)
  row.price:SetPoint("RIGHT", -4, 0)
  row.price:SetJustifyH("RIGHT")
  row.line = UI.Hairline(row, C.teal, 0.16)
  row.line:SetPoint("BOTTOMLEFT", 42, -1)
  row.line:SetPoint("BOTTOMRIGHT", 0, -1)
  t.mats[i] = row
  return row
end

local function fillRecipe(t, cw)
  local r, liveID = currentRecipe()
  local y = 0
  local show = r ~= nil
  t.hero:SetShown(show)
  for _, p in ipairs(t.pills) do p:SetShown(show) end
  t.rec:SetShown(show) t.plus:SetShown(show) t.hide:SetShown(show)
  t.note:SetShown(show)
  t.empty:SetShown(not show)
  if not show then
    t.matHead:Off() t.noteHead:Off()
    for _, row in ipairs(t.mats) do row:Hide() end
    t.empty:ClearAllPoints()
    t.empty:SetPoint("TOPLEFT", 10, -10)
    t.empty:SetText(liveID and "Für dieses Rezept hat die Zentrale keine Daten (z. B. Verzauberungen ohne Gegenstand)."
      or "Wähle links im Berufsfenster ein Rezept – hier siehst du dann Gewinn, Material und Absatz.")
    return math.ceil(t.empty:GetStringHeight()) + 20
  end
  local profit, revenue, cost, unknown = S.RecipeProfit(r)
  local item = ns.Item(r.out)
  local h = t.hero
  h:ClearAllPoints() h:SetPoint("TOPLEFT", 0, -y)
  h.icon:SetItem(r.out)
  local q = UI.QUALITY[item.quality or 1] or UI.QUALITY[1]
  h.name:SetText(UI.Hex(q) .. r.name .. "|r")
  local pg = page()
  local can = pg and pg.Craftable and pg.Craftable(r) or 0
  local d = DIFF[R.Difficulty(r) or 3] or DIFF[3]
  h.sub:SetText(string.format("ergibt %s×  ·  herstellbar: %d  ·  %s%s|r", R.QtyText(r), can, UI.Hex(d[2]), d[1]))
  if profit then
    h.profit:SetText((profit >= 0 and (UI.NEON_HEX .. "+|r") or "") .. ns.Money(profit))
  else
    h.profit:SetText("|cff8a9a94kein AH-Preis|r")
  end
  h.plabel:SetShown(profit ~= nil)
  local cls = ns.Demand.Class(r.out)
  local lab = ns.Demand.LABEL[cls] or ns.Demand.LABEL.unknown
  h.chip:Set(lab[1], DEMAND_COL[cls] or C.dim)
  y = y + 118 + 12

  -- Kennzahlen als Glas-Pillen
  local perDay = ns.Demand.PerDay(r.out)
  local gd = profit and ns.Demand.GoldPerDay(r.out, profit / math.max(r.qty, 1))
  local vals = {
    revenue and ns.Money(revenue) or "|cff8a9a94–|r",
    ((unknown or 0) > 0 and "|cffff9929min. |r" or "") .. ns.Money(cost),
    gd and ("~" .. ns.Money(gd)) or "|cff8a9a94–|r",
    perDay and (string.format("~%s/Tag", perDay >= 10 and math.floor(perDay + 0.5) or (string.format("%.1f", perDay):gsub("%.", ",")))) or "|cff8a9a94unbekannt|r",
  }
  local pw = t.pills[1]:GetWidth()
  for i, p in ipairs(t.pills) do
    p:ClearAllPoints()
    p:SetPoint("TOPLEFT", ((i - 1) % 2) * (pw + 8), -(y + math.floor((i - 1) / 2) * 64))
    p.value:SetText(vals[i])
  end
  y = y + 2 * 64 + 10

  -- Material: hast / brauchst, Preis, selbst herstellen
  t.matHead:Place(y)
  y = y + 24
  local n = 0
  for i, re in ipairs(r.reagents) do
    n = i
    local row = matRow(t, i, cw)
    row:ClearAllPoints() row:SetPoint("TOPLEFT", 0, -y) row:Show()
    row.icon:SetItem(re.id)
    local unit, how = S.MatCost(re.id)
    UI.FitText(row.name, re.n .. "× " .. ns.Item(re.id).name, row.name:GetWidth())
    local have = ns.Shop.Have(re.id) or 0
    row.have:SetText((have >= re.n and "|cff61eb8f" or "|cffff9929") .. "hast " .. have .. "|r"
      .. (how == "make" and "  ·  |cff7fc8ffselbst herstellen|r" or ""))
    row.price:SetText(unit and ns.Money(math.floor(unit * re.n + 0.5)) or "|cff8a9a94kein Preis|r")
    y = y + 42
  end
  for i = n + 1, #t.mats do t.mats[i]:Hide() end
  y = y + 8

  -- Empfehlung: Menge, echter Gewinn, Station, geplant
  t.noteHead:Place(y)
  y = y + 24
  local sug, why = ns.CraftBook.Suggest(r)
  local notes = {}
  notes[#notes + 1] = sug > 0 and (UI.NEON_HEX .. "Mach " .. sug .. "×|r – " .. why) or ("|cff93a39d" .. why .. "|r")
  local real, nSold = ns.CraftBook.RealPerUnit(r.out)
  if real then
    notes[#notes + 1] = (real >= 0 and "|cff61eb8fEchter Gewinn " or "|cffff6b81Echter Verlust ") .. ns.Money(math.abs(real)) .. "/Stück|r (" .. nSold .. " verkauft)"
  end
  local rate = ns.Ledger.SaleRate(r.out)
  if rate then notes[#notes + 1] = "Deine Verkaufsquote: " .. math.floor(rate * 100 + 0.5) .. " %" end
  local st = R.StationText(r)
  if st then notes[#notes + 1] = st end
  local planned = plannedFor(r)
  if planned > 0 then notes[#notes + 1] = UI.NEON_HEX .. planned .. "× schon auf der Craft-Liste|r" end
  if hidden()[r.id] then notes[#notes + 1] = "|cffff9929In den Top-Rezepten ausgeblendet.|r" end
  t.note:ClearAllPoints() t.note:SetPoint("TOPLEFT", 0, -y)
  t.note:SetText(table.concat(notes, "\n"))
  y = y + math.ceil(t.note:GetStringHeight()) + 14

  t.rec.r, t.rec.n = r, sug
  t.rec:SetLabel(sug > 0 and ("Einplanen: " .. sug .. "×") or "Einplanen")
  t.rec:SetEnabled(sug > 0)
  t.plus.r, t.hide.r = r, r
  t.rec:ClearAllPoints() t.rec:SetPoint("TOPLEFT", 0, -y)
  t.plus:ClearAllPoints() t.plus:SetPoint("LEFT", t.rec, "RIGHT", 8, 0)
  t.hide:ClearAllPoints() t.hide:SetPoint("LEFT", t.plus, "RIGHT", 8, 0)
  return y + 34 + 10
end

----------------------------------------------------------------------------
-- Reiter "Top-Rezepte"
----------------------------------------------------------------------------
local function buildTop(t, cw)
  t.info = UI.Para(t, 12, C.muted, cw)
  t.all = UI.Button(t, "Alle in die Liste", "primary", 180, 34, "star")
  t.all:SetScript("OnClick", function() P.MakeList() end)
  UI.SetTooltip(t.all, "Alle in die Craft-Liste", "Legt alle gezeigten Rezepte dieses Berufs in empfohlener Menge auf die Craft-Liste und öffnet das Einkaufsfenster.")
  t.rows = {}
  t.empty = UI.Para(t, 13, C.muted, cw - 20)
end

local function topRow(t, i, cw)
  local row = t.rows[i]
  if row then return row end
  row = UI.SafeButton(t)
  row:SetSize(cw, 48)
  rowShape(row, 48)
  row.icon = UI.ItemIcon(row, 32)
  row.icon:SetPoint("LEFT", 8, 0)
  row.name = UI.Text(row, 13, "semibold", C.text)
  row.name:SetPoint("TOPLEFT", 48, -8)
  row.name:SetWidth(cw - 48 - 44)
  row.name:SetWordWrap(false)
  row.sub = UI.Text(row, 12, "regular", C.muted)
  row.sub:SetPoint("TOPLEFT", row.name, "BOTTOMLEFT", 0, -3)
  row.sub:SetWidth(cw - 48 - 44)
  row.sub:SetWordWrap(false)
  row.dot = row:CreateTexture(nil, "ARTWORK", nil, 2)
  row.dot:SetTexture(UI.TEX.circle)
  row.dot:SetSize(9, 9)
  row.dot:SetPoint("CENTER", row.icon, "BOTTOMRIGHT", -3, 3)
  row.add = UI.IconButton(row, "plus", 30, "1× auf die Craft-Liste")
  row.add:SetPoint("RIGHT", -9, 0)
  row.add:SetScript("OnClick", function(b) if row.r then addToQueue(row.r, 1) end end)
  row:SetScript("OnEnter", function(self) rowHover(self, true) end)
  row:SetScript("OnLeave", function(self) rowHover(self, false) end)
  row:SetScript("OnClick", function(self)
    if not self.r then return end
    selectInBlizzard(self.r)
    UI.PlayClick()
    P.SetTab("recipe")
  end)
  UI.SetTooltip(row, function(self) return self.r and self.r.name, "Klick: im Berufsfenster anwählen und Details zeigen.\nPlus: 1× auf die Craft-Liste." end)
  t.rows[i] = row
  return row
end

local function fillTop(t, cw)
  local key = profKey()
  local y = 0
  local list, st = {}, nil
  local pg = page()
  if key and pg and pg.Entries then
    local l, _, s = pg.Entries({ prof = key, view = "known" })
    list, st = l, s
  end
  P.topList = list
  local _, minProfit = R.Filter()
  local why = {}
  if st then
    if st.tooLow > 0 then why[#why + 1] = st.tooLow .. " unter Mindestgewinn" end
    if st.noPrice > 0 then why[#why + 1] = st.noPrice .. " ohne Preis" end
    if (st.old or 0) > 0 then why[#why + 1] = st.old .. " mit altem Preis" end
    if (st.slow or 0) > 0 then why[#why + 1] = st.slow .. " Ladenhüter" end
    if st.hidden > 0 then why[#why + 1] = st.hidden .. " ausgeblendet" end
  end
  t.info:ClearAllPoints() t.info:SetPoint("TOPLEFT", 0, -y)
  t.info:SetText(string.format("%s%d %s bringen Gold|r  ·  ab %s pro Craft\n%s%s", UI.NEON_HEX, #list,
    #list == 1 and "Rezept" or "Rezepte", minProfit > 0 and ns.Money(minProfit) or "1 Kupfer", M.LastScanText(),
    #why > 0 and ("\n|cff93a39dNicht gezeigt: " .. table.concat(why, ", ") .. "|r") or ""))
  y = y + math.ceil(t.info:GetStringHeight()) + 12
  t.all:ClearAllPoints() t.all:SetPoint("TOPLEFT", 0, -y)
  t.all:SetShown(#list > 0)
  if #list > 0 then y = y + 34 + 12 end
  local shown = math.min(#list, 40)
  for i = 1, shown do
    local e = list[i]
    local row = topRow(t, i, cw)
    row.r = e.r
    row:ClearAllPoints() row:SetPoint("TOPLEFT", 0, -y) row:Show()
    rowHover(row, false)
    row.icon:SetItem(e.r.out)
    local planned = plannedFor(e.r)
    row.name:SetText(e.r.name .. (planned > 0 and ("  " .. UI.NEON_HEX .. planned .. "× geplant|r") or ""))
    row.sub:SetText(UI.NEON_HEX .. "+" .. "|r" .. ns.Money(e.profit) .. "  ·  " .. (e.goldDay and ("~" .. ns.Money(e.goldDay) .. "/Tag") or "Absatz unbekannt"))
    local c = DEMAND_COL[e.demand or "unknown"] or C.dim
    row.dot:SetVertexColor(c[1], c[2], c[3], 1)
    y = y + 48 + 6
  end
  for i = shown + 1, #t.rows do t.rows[i]:Hide() end
  t.empty:SetShown(#list == 0)
  if #list == 0 then
    t.empty:ClearAllPoints() t.empty:SetPoint("TOPLEFT", 10, -y)
    t.empty:SetText(not key and "Beruf wird gelesen …" or (not M.HasAuctionator() and "Ohne Auctionator kennt die Zentrale keine AH-Preise. Auctionator installieren und einmal im AH scannen."
      or "Gerade bringt kein Rezept genug Gold. Unter |cff39ff6bOptionen|r den Mindestgewinn senken oder im AH neu scannen."))
    y = y + math.ceil(t.empty:GetStringHeight()) + 10
  end
  return y + 6
end

----------------------------------------------------------------------------
-- Reiter "Liste" (Craft-Warteschlange)
----------------------------------------------------------------------------
local function buildQueue(t, cw)
  t.info = UI.Para(t, 12, C.muted, cw)
  t.rows = {}
  t.clear = UI.Button(t, "Alles leeren", "danger", 150, 32, "close")
  t.clear:SetScript("OnClick", function()
    local pg = page()
    if not pg then return end
    if #queue() == 0 and pg.undoQueue then pg.UndoClear() else pg.ClearQueue() end
    ns.Fire("SHOP_CHANGED")
    P.Dirty()
  end)
  t.empty = UI.Para(t, 13, C.muted, cw - 20)
end

local function queueRow(t, i, cw)
  local row = t.rows[i]
  if row then return row end
  row = CreateFrame("Frame", nil, t)
  row:SetSize(cw, 44)
  rowShape(row, 44)
  row.icon = UI.ItemIcon(row, 28)
  row.icon:SetPoint("LEFT", 8, 0)
  row.name = UI.Text(row, 13, "semibold", C.text)
  row.name:SetPoint("TOPLEFT", 44, -7)
  row.name:SetWidth(cw - 44 - 110)
  row.name:SetWordWrap(false)
  row.sub = UI.Text(row, 12, "regular", C.muted)
  row.sub:SetPoint("TOPLEFT", row.name, "BOTTOMLEFT", 0, -2)
  row.sub:SetWidth(cw - 44 - 110)
  row.sub:SetWordWrap(false)
  row.del = UI.IconButton(row, "close", 28, "Entfernen")
  row.del:SetPoint("RIGHT", -8, 0)
  row.plus = UI.IconButton(row, "plus", 28, "Einmal mehr")
  row.plus:SetPoint("RIGHT", row.del, "LEFT", -4, 0)
  row.minus = UI.IconButton(row, "minus", 28, "Einmal weniger")
  row.minus:SetPoint("RIGHT", row.plus, "LEFT", -4, 0)
  row.minus:SetScript("OnClick", function() if row.r then addToQueue(row.r, -1) end end)
  row.plus:SetScript("OnClick", function() if row.r then addToQueue(row.r, 1) end end)
  row.del:SetScript("OnClick", function() if row.r then addToQueue(row.r, -999) end end)
  t.rows[i] = row
  return row
end

local function fillQueue(t, cw)
  local y = 0
  local key = profKey()
  local q = queue()
  local mats, cost, profit, crafts = ns.QueueMaterials()
  local pg = page()
  -- dieser Beruf zuerst, dann die anderen
  local order = {}
  for _, e in ipairs(q) do if e.prof == key then order[#order + 1] = e end end
  for _, e in ipairs(q) do if e.prof ~= key then order[#order + 1] = e end end
  t.info:ClearAllPoints() t.info:SetPoint("TOPLEFT", 0, -y)
  if #q == 0 then
    t.info:SetText("Die Craft-Liste ist leer.")
  else
    t.info:SetText(string.format("%s%d Crafts geplant|r  ·  Gewinn ~%s\n%s", UI.NEON_HEX, crafts, ns.Money(profit),
      #mats > 0 and ("Material fehlt: " .. #mats .. " " .. (#mats == 1 and "Sorte" or "Sorten") .. " für ~" .. ns.Money(cost) .. " – Knopf |cff26f2d9Einkauf|r unten.")
        or "|cff61eb8fAlles Material ist da – unten auf Nächstes craften.|r"))
  end
  y = y + math.ceil(t.info:GetStringHeight()) + 12
  local n = 0
  for _, e in ipairs(order) do
    local r = R.Get(e.recipe)
    if r then
      n = n + 1
      local row = queueRow(t, n, cw)
      row.r = r
      row:ClearAllPoints() row:SetPoint("TOPLEFT", 0, -y) row:Show()
      row.icon:SetItem(r.out)
      row.name:SetText(e.n .. "× " .. r.name)
      local can = pg and pg.Craftable and pg.Craftable(r) or 0
      local other = e.prof ~= key and ("  ·  " .. ns.ProfName(ns.PROF[e.prof])) or ""
      row.sub:SetText((can >= e.n and "|cff61eb8f" or (can > 0 and "|cffffd24a" or "|cffff9929")) .. "herstellbar: " .. can .. "|r" .. other)
      row:SetAlpha(e.prof == key and 1 or 0.6)
      y = y + 44 + 6
    end
  end
  for i = n + 1, #t.rows do t.rows[i]:Hide() end
  local undo = #q == 0 and pg and pg.undoQueue
  t.clear:SetShown(#q > 0 or undo and true or false)
  t.clear:SetLabel(undo and "Rückgängig" or "Alles leeren")
  t.empty:SetShown(#q == 0)
  if #q == 0 then
    t.empty:ClearAllPoints() t.empty:SetPoint("TOPLEFT", 10, -y)
    t.empty:SetText("Unter |cff39ff6bTop-Rezepte|r mit + oder „Alle in die Liste“ füllen – oder beim gewählten Rezept „Einplanen“.")
    y = y + math.ceil(t.empty:GetStringHeight()) + 14
  end
  if t.clear:IsShown() then
    t.clear:ClearAllPoints() t.clear:SetPoint("TOPLEFT", 0, -(y + 4))
    y = y + 4 + 32
  end
  return y + 10
end

----------------------------------------------------------------------------
-- Reiter "Optionen"
----------------------------------------------------------------------------
local function buildSetup(t, cw)
  local refresh = function() UI.RefreshPage("recipes") P.Dirty() end
  t.h1 = section(t, "Gewinn pro Craft mindestens")
  t.profit = UI.Stepper(t, "Mindestgewinn", cw, function() return (select(2, R.Filter())) end,
    function(v) R.SetProfit(v) end,
    function(v, dir)
      local base = (dir > 0) and v or v - 1
      if base < 10000 then return 500 elseif base < 100000 then return 5000 end
      return 50000
    end, 0, 10000000, function(v) return v == 0 and "alles" or ns.Money(v) end, ns.ParseMoney,
    "Auf die Zahl klicken und selbst eintragen: 45 = 45 Silber, 1g 20s, 1,5g. Enter übernimmt.")
  t.profit.onChange = refresh
  t.profit:SetDefault(function() return R.Preset().profit end, function() R.ResetStyle() end)
  t.recBtn = UI.Button(t, "Empfehlung für mein Level", "primary", 240, 32, "star")
  t.recBtn:SetScript("OnClick", function() R.ResetStyle() refresh() end)
  t.recText = UI.Para(t, 12, C.muted, cw)
  t.h2 = section(t, "Menge je Rezept")
  t.per = UI.Stepper(t, "Je Rezept", cw, function() return craftCfg().perRecipe or 0 end,
    function(v) craftCfg().perRecipe = v end, 1, 0, 50, function(v) return v == 0 and "auto" or (v .. "×") end,
    function(txt) if (txt or ""):lower():find("auto") then return 0 end return tonumber((txt or ""):match("%d+")) end,
    "„auto“ = so viele, wie sich bei dir in einer Woche verkaufen, minus was schon in Taschen, Bank und im AH liegt.")
  t.per.onChange = refresh
  t.per:SetDefault(0)
  t.h3 = section(t, "Filter")
  t.pills = {
    UI.Pill(t, "Nur bekannte Preise", function() return craftCfg().onlySafe end, function(v) craftCfg().onlySafe = v end, refresh),
    UI.Pill(t, "Nur frische Preise", function() return craftCfg().freshOnly ~= false end, function(v) craftCfg().freshOnly = v end, refresh),
    UI.Pill(t, "Ladenhüter ausblenden", function() return craftCfg().skipSlow ~= false end, function(v) craftCfg().skipSlow = v end, refresh),
  }
  UI.SetTooltip(t.pills[2], "Nur frische Preise", "Nur Rezepte, deren AH-Preis höchstens 3 Tage alt ist.")
  UI.SetTooltip(t.pills[3], "Ladenhüter ausblenden", "Blendet Rezepte aus, deren Ergebnis sich laut Absatz-Messung kaum verkauft.")
  t.unhide = UI.Button(t, "Ausgeblendete (0)", "soft", 190, 32, "refresh")
  t.unhide:SetScript("OnClick", function() ns.char.hiddenRecipes = {} refresh() end)
  t.h4 = section(t, "Ansicht")
  t.view = UI.Para(t, 12, C.muted, cw)
  t.view:SetText("Oben am Berufsfenster umschalten: |cff39ff6bWoW|r = nur Blizzards Fenster, |cff39ff6bTZ|r = mit diesem Fenster. Die Wahl bleibt gespeichert.")
  t.open = UI.Button(t, "Ganze Zentrale öffnen", "soft", 220, 32, "home")
  t.open:SetScript("OnClick", function() UI.Show("recipes") end)
end

local function fillSetup(t, cw)
  local y = 0
  local _, _, auto = R.Filter()
  local preset = R.Preset()
  t.h1:Place(y) y = y + 26
  t.profit:ClearAllPoints() t.profit:SetPoint("TOPLEFT", 0, -y) t.profit:Refresh()
  y = y + 34 + 10
  t.recBtn:ClearAllPoints() t.recBtn:SetPoint("TOPLEFT", 0, -y)
  t.recBtn:SetEnabled(not auto)
  t.recBtn:SetLabel(auto and "Empfehlung aktiv" or "Zurück zur Empfehlung")
  y = y + 32 + 8
  t.recText:ClearAllPoints() t.recText:SetPoint("TOPLEFT", 0, -y)
  t.recText:SetText((auto and UI.NEON_HEX .. "Empfehlung für Level " .. ns.player.level .. ": " .. ns.Money(preset.profit) .. "|r – wächst mit."
    or ("Eigener Wert. Empfehlung für Level " .. ns.player.level .. ": " .. ns.Money(preset.profit) .. ".")) .. " Gewinn = AH-Verkauf nach Gebühr minus Material.")
  y = y + math.ceil(t.recText:GetStringHeight()) + 16
  t.h2:Place(y) y = y + 26
  t.per:ClearAllPoints() t.per:SetPoint("TOPLEFT", 0, -y) t.per:Refresh()
  y = y + 34 + 16
  t.h3:Place(y) y = y + 26
  local x = 0
  for _, p in ipairs(t.pills) do
    p:Refresh()
    local w = p:GetWidth()
    if x > 0 and x + w > cw then x = 0 y = y + 30 + 8 end
    p:ClearAllPoints() p:SetPoint("TOPLEFT", x, -y)
    x = x + w + 8
  end
  y = y + 30 + 10
  local nh = 0
  for _ in pairs(hidden()) do nh = nh + 1 end
  t.unhide:SetLabel("Ausgeblendete (" .. nh .. ")")
  t.unhide:SetEnabled(nh > 0)
  t.unhide:ClearAllPoints() t.unhide:SetPoint("TOPLEFT", 0, -y)
  y = y + 32 + 16
  t.h4:Place(y) y = y + 26
  t.view:ClearAllPoints() t.view:SetPoint("TOPLEFT", 0, -y)
  y = y + math.ceil(t.view:GetStringHeight()) + 10
  t.open:ClearAllPoints() t.open:SetPoint("TOPLEFT", 0, -y)
  return y + 32 + 10
end

local BUILD = { recipe = buildRecipe, top = buildTop, queue = buildQueue, setup = buildSetup }
local FILL = { recipe = fillRecipe, top = fillTop, queue = fillQueue, setup = fillSetup }

----------------------------------------------------------------------------
-- Fenster
----------------------------------------------------------------------------
local function build(PF)
  local f = CreateFrame("Frame", "TirysZentraleCraftPanel", PF)
  P.frame = f
  f:SetWidth(W)
  -- rechts neben dem Berufsfenster, hinter Blizzards Reitern (die ragen ~44 px heraus)
  f:SetPoint("TOPLEFT", PF, "TOPRIGHT", 48, 0)
  f:SetPoint("BOTTOMLEFT", PF, "BOTTOMRIGHT", 48, 0)
  f:EnableMouse(true)
  f.glass = UI.Glass(f, { radius = 26, edgeMode = "neon", edge = 0.72, halo = 0.22, haloPad = 24,
    body = UI.GLASS.window, sheen = 0.05, sheenH = 70, line = 0.5 })
  UI.Ornaments(f, { w = W, h = 900, pattern = 0.04, corners = 0.30, cornerSize = 44, inset = 4 })
  local glow = UI.Glow(f, C.amber, 340, 0.13, "BORDER")
  glow:SetHeight(150)
  glow:SetPoint("TOP", f, "TOPLEFT", 130, 10)
  UI.Drift(glow, 120, 0, 9, 0.35, 0.10)
  local glow2 = UI.Glow(f, C.aqua, 300, 0.10, "BORDER")
  glow2:SetHeight(140)
  glow2:SetPoint("BOTTOM", f, "BOTTOMRIGHT", -110, -6)

  -- Kopf: Verlaufs-Kugel mit Kolben, Titel, Beruf + Skill
  local orb = f:CreateTexture(nil, "ARTWORK")
  orb:SetTexture(UI.TEX.circle)
  orb:SetSize(36, 36)
  orb:SetPoint("TOPLEFT", 18, -16)
  UI.SetGradV(orb, C.amber, C.teal, 1)
  local orbGlow = UI.Glow(f, C.amber, 72, 0.30, "BORDER")
  orbGlow:SetPoint("CENTER", orb, "CENTER")
  local gloss = f:CreateTexture(nil, "ARTWORK", nil, 2)
  gloss:SetTexture(UI.TEX.gloss)
  gloss:SetAllPoints(orb)
  gloss:SetBlendMode("ADD")
  gloss:SetVertexColor(1, 1, 1, 0.30)
  local icon = f:CreateTexture(nil, "OVERLAY")
  icon:SetTexture(UI.Icon("flask"))
  icon:SetSize(19, 19)
  icon:SetPoint("CENTER", orb, "CENTER")
  icon:SetVertexColor(0.03, 0.07, 0.06, 1)
  f.title = UI.Text(f, 17, "bold", C.text)
  f.title:SetPoint("TOPLEFT", orb, "TOPRIGHT", 12, -1)
  f.title:SetText(UI.GradText("Zentrale-Craft", C.amber, C.teal))
  f.sub = UI.Text(f, 12, "regular", C.muted)
  f.sub:SetPoint("TOPLEFT", f.title, "BOTTOMLEFT", 0, -3)
  f.sub:SetWidth(W - 18 - 36 - 12 - 60)
  f.sub:SetWordWrap(false)
  f.close = UI.IconButton(f, "close", 30, "Zentrale hier ausblenden (oben auf TZ wieder an)")
  f.close:SetPoint("TOPRIGHT", -16, -18)
  f.close:SetScript("OnClick", function() P.SetMode("wow") end)
  f.tabs = UI.Segments(f, TABS, function(v) P.SetTab(v) end, IW)
  f.tabs:SetPoint("TOPLEFT", PAD, -76)

  -- Inhalt (scrollbar)
  local sf, content = UI.Scroll(f)
  sf:SetPoint("TOPLEFT", PAD, -HEAD)
  sf:SetPoint("BOTTOMRIGHT", -PAD + 12, FOOT)
  f.scroll, f.content = sf, content
  content:SetWidth(IW - 2)
  f.pages = {}
  for _, tab in ipairs(TABS) do
    local t = CreateFrame("Frame", nil, content)
    t:SetPoint("TOPLEFT", 0, 0)
    t:SetSize(IW - 2, 10)
    BUILD[tab.value](t, IW - 2)
    t:Hide()
    f.pages[tab.value] = t
  end

  -- Fuß: die drei Dinge, die man am Berufsfenster immer braucht
  f.craft = UI.Button(f, "Nächstes craften", "primary", 176, 38, "bolt")
  f.craft:SetPoint("BOTTOMLEFT", PAD, 18)
  f.craft:SetScript("OnClick", function() local pg = page() if pg then pg.CraftNext(pg) end end)
  UI.SetTooltip(f.craft, "Nächstes craften", "Stellt den ersten Eintrag der Craft-Liste her, für den dein Material reicht – erst Zwischenprodukte, dann den Rest.")
  f.shop = UI.Button(f, "Einkauf", "cool", 126, 38, "cart")
  f.shop:SetPoint("LEFT", f.craft, "RIGHT", 8, 0)
  f.shop:SetScript("OnClick", function() ns.Shop.Toggle() end)
  UI.SetTooltip(f.shop, "Einkaufsfenster", "Zeigt, was für die Craft-Liste noch fehlt – mit Kaufen beim Händler und Suche im AH.")
  f.home = UI.IconButton(f, "home", 38, "Ganze Zentrale (Craft-Planer) öffnen")
  f.home:SetPoint("BOTTOMRIGHT", -PAD, 18)
  f.home:SetScript("OnClick", function() UI.Show("recipes") end)

  -- Umschalter WoW | TZ oben am Berufsfenster (wie TSM)
  local sw = CreateFrame("Frame", "TirysZentraleCraftSwitch", PF)
  P.switch = sw
  sw.label = UI.Text(sw, 12, "semibold", C.muted)
  sw.label:SetPoint("LEFT", 0, 0)
  sw.label:SetText("Ansicht")
  sw.seg = UI.Segments(sw, { { value = "wow", label = "WoW" }, { value = "tz", label = "TZ" } }, function(v) P.SetMode(v) end, 160)
  sw.seg:SetPoint("LEFT", sw.label, "RIGHT", 10, 0)
  local segW = sw.seg.trackHolder and sw.seg.trackHolder:GetWidth() or 120
  sw:SetSize(math.ceil(sw.label:GetStringWidth()) + 10 + segW, 30)
  sw:SetPoint("BOTTOMRIGHT", PF, "TOPRIGHT", -8, 6)
  UI.SetTooltip(sw.seg.buttons[1], "WoW", "Nur Blizzards Berufsfenster.")
  UI.SetTooltip(sw.seg.buttons[2], "TZ – Tiry's Zentrale", "Berufsfenster mit Zentrale-Fenster daneben: Gewinn, Material, Absatz, Top-Rezepte, Craft-Liste und Optionen.")

  P.SetTab(cfg().tab or "recipe", true)
end

function P.SetTab(v, silent)
  local f = P.frame
  if not f or not f.pages[v] then v = "recipe" end
  cfg().tab = v
  f.tabs:Select(v)
  for k, t in pairs(f.pages) do t:SetShown(k == v) end
  if f.scroll.ScrollToTop then f.scroll:ScrollToTop() end
  if not silent then P.Refresh() end
end

function P.Refresh()
  local f = P.frame
  if not (f and f:IsShown()) then return end
  f.sub:SetText(profLine())
  local v = cfg().tab or "recipe"
  local t = f.pages[v]
  local h = ns.Safe(FILL[v], t, IW - 2) or 10
  t:SetHeight(h)
  f.content:SetHeight(h + 4)
  if f.scroll.UpdateBar then f.scroll.UpdateBar() end
end

function P.Dirty()
  if P.frame and P.frame:IsShown() then ns.Debounce("craftpanel", 0.15, P.Refresh) end
end

function P.SetMode(m)
  cfg().mode = (m == "wow") and "wow" or "tz"
  local PF = _G.ProfessionsFrame
  if P.switch then P.switch.seg:Select(cfg().mode) end
  if P.frame then
    P.frame:SetShown(cfg().mode == "tz" and PF and PF:IsShown() or false)
    P.Refresh()
  end
end

-- Alle gezeigten Top-Rezepte dieses Berufs in die Craft-Liste (wie "Liste erstellen" im Craft-Planer)
function P.MakeList()
  local pg = page()
  local key = profKey()
  local list = P.topList or {}
  if not (pg and key) or #list == 0 then ns.Print("Gerade bringt kein Rezept genug Gold – Mindestgewinn senken oder im AH scannen.") return end
  local q = queue()
  for i = #q, 1, -1 do if q[i].prof == key then table.remove(q, i) end end
  local added, skipped = pg.FillQueue(list)
  ns.Shop.ResetSkips()
  ns.Print(pg.ListText(added, skipped, ""))
  ns.Shop.Show()
  UI.RefreshPage("recipes")
  ns.Fire("SHOP_CHANGED")
  P.SetTab("queue")
end

----------------------------------------------------------------------------
-- An Blizzards Berufsfenster andocken (lädt erst beim ersten Öffnen: Blizzard_Professions)
----------------------------------------------------------------------------
local function onRecipeSelected(_, info)
  P.recipeID = type(info) == "table" and info.recipeID or nil
  P.Dirty()
end

function P.Attach()
  local PF = _G.ProfessionsFrame
  if P.frame or not PF then return P.frame ~= nil end
  build(PF)
  PF:HookScript("OnShow", function() P.SetMode(cfg().mode) end)
  PF:HookScript("OnHide", function() P.recipeID = nil end)
  if EventRegistry and EventRegistry.RegisterCallback then
    pcall(EventRegistry.RegisterCallback, EventRegistry, "ProfessionsRecipeListMixin.Event.OnRecipeSelected", onRecipeSelected, P)
  end
  P.SetMode(cfg().mode)
  return true
end

ns.On("ADDON_LOADED", function(_, name)
  if name == "Blizzard_Professions" then ns.Safe(P.Attach) end
end)
ns.On("TRADE_SKILL_SHOW", function()
  if not P.Attach() then C_Timer.After(0, function() ns.Safe(P.Attach) end) end
  P.Dirty()
end)
ns.On("TRADE_SKILL_LIST_UPDATE", function() P.Dirty() end)
ns.On("BAG_UPDATE_DELAYED", function() P.Dirty() end)
for _, msg in ipairs({ "RECIPES_SCANNED", "SHOP_CHANGED", "PRICES_UPDATED", "DEMAND_UPDATED", "CRAFTBOOK_CHANGED", "PROFESSIONS_CHANGED" }) do
  ns.Listen(msg, function() P.Dirty() end)
end
-- Craft-Planer ändert die Liste/Filter -> hier mitziehen
hooksecurefunc(UI, "RefreshPage", function(key) if key == "recipes" then P.Dirty() end end)
