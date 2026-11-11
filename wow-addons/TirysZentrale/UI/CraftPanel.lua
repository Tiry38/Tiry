-- Tiry's Zentrale – eigenes Berufsfenster (TZ-Modus): ersetzt Blizzards Berufsfenster, solange ein Beruf offen ist.
-- Umschalter "WoW | TZ": WoW = Blizzards Fenster, TZ = dieses Fenster. Blizzards Fenster bleibt dabei offen, aber
-- unsichtbar (Alpha 0, winzig) – sonst schließt das Spiel den Beruf. Links: Rezeptliste (Kategorien, Suche, Filter,
-- Sortierung, Favoriten, Gewinn je Rezept), rechts: Rezept (Gewinn/Material/Absatz), Top-Rezepte, Liste, Optionen,
-- unten Herstellen. Knöpfe springen direkt in die Menüs der Zentrale. Alle Zahlen wie im Craft-Planer.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local S = ns.Scanner
local R = ns.Recipes

local P = {}
ns.CraftPanel = P

local PAD = 18
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

-- Blizzard-Berufs-API abgesichert: fehlt eine Funktion im Client, fällt nur das Detail weg
local TS = function(fn, ...)
  local f = C_TradeSkillUI and C_TradeSkillUI[fn]
  if not f then return nil end
  local ok, a, b, c = pcall(f, ...)
  if ok then return a, b, c end
end
local function cfg() return ns.settings.craftPanel end
local function craftCfg() return ns.settings.craft end
local function page() return UI.pages.recipes end
local function queue() ns.char.queue = ns.char.queue or {} return ns.char.queue end
local function hidden() ns.char.hiddenRecipes = ns.char.hiddenRecipes or {} return ns.char.hiddenRecipes end

-- Beruf des offenen Fensters (Schlüssel wie "LEATHERWORKING")
local function profKey() return S.openProfKey and S.openProfKey() end

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
  hero.req = UI.Text(hero, 12, "regular", C.muted)
  hero.req:SetPoint("TOPLEFT", hero.sub, "BOTTOMLEFT", 0, -4)
  hero.req:SetWidth(cw - 90)
  hero.req:SetWordWrap(false)
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
      or "Wähle links ein Rezept – hier siehst du dann Gewinn, Material und Absatz.")
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
  local can = liveID and TS("GetCraftableCount", liveID)
  if type(can) ~= "number" then can = pg and pg.Craftable and pg.Craftable(r) or 0 end
  local li = liveID and TS("GetRecipeInfo", liveID)
  local d = DIFF[(li and li.relativeDifficulty) or R.Difficulty(r) or 3] or DIFF[3]
  h.sub:SetText(string.format("ergibt %s×  ·  herstellbar: %d  ·  %s%s|r", R.QtyText(r), can, UI.Hex(d[2]), d[1]))
  if profit then
    h.profit:SetText((profit >= 0 and (UI.NEON_HEX .. "+|r") or "") .. ns.Money(profit))
  else
    h.profit:SetText("|cff8a9a94kein AH-Preis|r")
  end
  h.plabel:SetShown(profit ~= nil)
  local req = P.ReqText(liveID)
  h.req:SetText(req or "")
  local hh = req and 136 or 118
  h:SetHeight(hh)
  local cls = ns.Demand.Class(r.out)
  local lab = ns.Demand.LABEL[cls] or ns.Demand.LABEL.unknown
  h.chip:Set(lab[1], DEMAND_COL[cls] or C.dim)
  y = y + hh + 12

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
  t.view:SetText("Oben am Berufsfenster umschalten: |cff39ff6bWoW|r = nur Blizzards Fenster, |cff39ff6bTZ|r = eigenes Fenster der Zentrale statt Blizzards. Die Wahl bleibt gespeichert.")
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
-- Daten aus dem offenen Beruf (alles abgesichert: fehlt eine Funktion im Client, fällt nur das Detail weg)
----------------------------------------------------------------------------

local function baseInfo() return TS("GetBaseProfessionInfo") end

-- "Erfordert: Kochstelle" (grün = da, rot = fehlt) + Abklingzeit
function P.ReqText(liveID)
  if not liveID then return nil end
  local parts = {}
  local req = TS("GetRecipeRequirements", liveID)
  if type(req) == "table" then
    for _, q in ipairs(req) do
      if q.name then parts[#parts + 1] = (q.met and "|cff61eb8f" or "|cffff6b81") .. q.name .. "|r" end
    end
  end
  local s = #parts > 0 and ("Erfordert: " .. table.concat(parts, ", ")) or nil
  local cd = TS("GetRecipeCooldown", liveID)
  if type(cd) == "number" and cd > 0 then
    local t = cd >= 3600 and string.format("%d Std.", math.floor(cd / 3600 + 0.5)) or string.format("%d Min.", math.ceil(cd / 60))
    s = (s and (s .. "  ·  ") or "") .. "|cffffd24aAbklingzeit " .. t .. "|r"
  end
  return s
end

-- Rezeptliste des offenen Berufs: gelernt, mit Kategorie, Farbe, herstellbar, Gewinn
local function liveIDs()
  local ids = TS("GetAllRecipeIDs") or TS("GetFilteredRecipeIDs") or {}
  return ids
end

local function readEntries()
  local list, cats, catOrder = {}, {}, {}
  for _, id in ipairs(liveIDs()) do
    local info = TS("GetRecipeInfo", id)
    if info and info.learned ~= false and not info.isRecraft and info.name then
      local catID = info.categoryID or 0
      local cat = cats[catID]
      if not cat then
        local ci = catID ~= 0 and TS("GetCategoryInfo", catID)
        cat = { id = catID, name = (ci and ci.name) or "Rezepte", order = (ci and ci.uiOrder) or (#catOrder + 1000), first = #catOrder + 1 }
        cats[catID] = cat
        catOrder[#catOrder + 1] = cat
      end
      local r = R.FromLive and R.FromLive(id) or R.Get(id)
      local profit = r and S.RecipeProfit(r)
      local can = TS("GetCraftableCount", id)
      if type(can) ~= "number" then
        local pg = page()
        can = (r and pg and pg.Craftable) and pg.Craftable(r) or (info.numAvailable or 0)
      end
      list[#list + 1] = {
        id = id, name = info.name, icon = info.icon, diff = info.relativeDifficulty or 3, cat = cat,
        skillUp = (info.relativeDifficulty or 3) <= 1 and info.canSkillUp ~= false,
        fav = info.favorite or TS("IsRecipeFavorite", id) or false, enchant = info.isEnchantingRecipe and true or false,
        r = r, profit = profit, can = can, pos = #list + 1,
      }
    end
  end
  table.sort(catOrder, function(a, b)
    if a.order ~= b.order then return a.order < b.order end
    return a.first < b.first
  end)
  return list, catOrder
end

-- Billigster Skill-Punkt: orange = sicher +1, gelb = meistens. Bevorzugt orange, dann geringste Nettokosten.
local function skillTip(list)
  local best, bestScore
  for _, e in ipairs(list) do
    if e.diff <= 1 and e.skillUp then
      local net = e.profit and -e.profit or (e.r and select(3, S.RecipeProfit(e.r))) or 1e9
      local score = (e.diff == 0 and 0 or 1e8) + net
      if not bestScore or score < bestScore then best, bestScore = e, score end
    end
  end
  return best
end

----------------------------------------------------------------------------
-- Fenster
----------------------------------------------------------------------------
local WW, WH = 960, 640
local LW = 330                     -- linke Spalte (Rezeptliste)
local RX = PAD + LW + 22           -- rechte Spalte
local RW = WW - RX - PAD           -- Breite rechts
local HEADH, FOOTH = 112, 66
local ROWH, CATH = 32, 28
local LINKS = {
  { "recipes", "Craft-Planer", "flask", "Alle Berufe planen, Liste erstellen", "Planer" },
  { "advisor", "Was lernen?", "star", "Welche Rezepte sich zu lernen lohnen", "Lernen?" },
  { "results", "Ergebnis", "chart", "Was deine Crafts wirklich gebracht haben", "Ergebnis" },
  { "market", "Preise", "coins", "Preise, Schnäppchen, Markt", "Preise" },
  { "ledger", "Verkaufsbuch", "book", "Was du verkauft hast", "Verkäufe" },
  { "auctions", "Meine Auktionen", "receipt", "Deine Auktionen im AH", "Auktionen" },
}

local function autoWidth(b, pad)
  local w = math.ceil(b.text:GetStringWidth()) + (b.icon and 46 or 30) + (pad or 0)
  b:SetWidth(w)
  if b.glow then b.glow:SetWidth(w * 1.25) end
  return w
end

local function special()
  return TS("IsTradeSkillLinked") or TS("IsTradeSkillGuild") or TS("IsNPCCrafting")
end

-- Blizzards Fenster unsichtbar machen, ohne es zu schließen (Schließen beendet den Beruf)
local hideBlizz, guard = false, false
local function blizzVisible(show)
  local PF = _G.ProfessionsFrame
  if not PF then return end
  if show == not hideBlizz then return end
  hideBlizz = not show
  guard = true
  if show then
    PF:SetAlpha(1)
    PF:SetScale(P.pfScale or 1)
  else
    P.pfScale = PF:GetScale() or 1
    PF:SetAlpha(0)
    PF:SetScale(0.001)
  end
  guard = false
end

local list -- Rezeptliste-Zustand

local function rowTip(row)
  local e = row.e
  if not e then return end
  GameTooltip:SetOwner(row, "ANCHOR_RIGHT")
  local out = e.r and e.r.out
  if out and GameTooltip.SetItemByID then pcall(GameTooltip.SetItemByID, GameTooltip, out) else GameTooltip:AddLine(e.name) end
  GameTooltip:AddLine(" ")
  GameTooltip:AddLine("Klick: anzeigen  ·  Rechtsklick: Favorit  ·  Shift-Klick: in den Chat", 0.6, 0.67, 0.64, true)
  GameTooltip:Show()
end

local function listRow(holder, i)
  local row = list.rows[i]
  if row then return row end
  row = UI.SafeButton(holder)
  row:SetSize(LW - 14, ROWH)
  row:RegisterForClicks("LeftButtonUp", "RightButtonUp")
  row.sel = UI.PillShape(row, ROWH, 0, false)
  row.sel.edge:SetGradient(UI.GRAD_EDGE, 0.95)
  row.sel.body:SetGradientV(UI.GLASS.pillHi[1], UI.GLASS.pillHi[2], 1)
  row.hl = row:CreateTexture(nil, "BACKGROUND")
  row.hl:SetTexture(UI.TEX.glow)
  row.hl:SetAllPoints()
  row.hl:SetBlendMode("ADD")
  row.hl:SetVertexColor(C.teal[1], C.teal[2], C.teal[3], 0)
  row.icon = UI.ItemIcon(row, 24)
  row.icon:SetPoint("LEFT", 6, 0)
  row.name = UI.Text(row, 12, "semibold", C.text)
  row.name:SetPoint("LEFT", 38, 0)
  row.name:SetWordWrap(false)
  row.profit = UI.Text(row, 11, "semibold", C.muted)
  row.profit:SetPoint("RIGHT", -10, 0)
  row.profit:SetJustifyH("RIGHT")
  row.star = row:CreateTexture(nil, "OVERLAY")
  row.star:SetTexture(UI.Icon("star"))
  row.star:SetSize(11, 11)
  row.star:SetPoint("CENTER", row.icon, "TOPRIGHT", -1, -1)
  row.star:SetVertexColor(1, 0.85, 0.3, 1)
  row:SetScript("OnEnter", function(self) self.hl:SetAlpha(0.10) rowTip(self) end)
  row:SetScript("OnLeave", function(self) self.hl:SetAlpha(0) GameTooltip:Hide() end)
  row:SetScript("OnClick", function(self, button)
    local e = self.e
    if not e then return end
    if button == "RightButton" then
      if C_TradeSkillUI and C_TradeSkillUI.SetRecipeFavorite then pcall(C_TradeSkillUI.SetRecipeFavorite, e.id, not e.fav) end
      e.fav = not e.fav
      P.RefreshList()
      return
    end
    if IsShiftKeyDown() then
      local link = TS("GetRecipeLink", e.id) or (e.r and ns.Item(e.r.out).link)
      if link and ChatEdit_InsertLink then ChatEdit_InsertLink(link) end
      return
    end
    P.Select(e.id)
  end)
  list.rows[i] = row
  return row
end

local function catRow(holder, i)
  local c = list.cats[i]
  if c then return c end
  c = UI.SafeButton(holder)
  c:SetSize(LW - 14, CATH)
  c.text = UI.Text(c, 12, "bold", C.amber)
  c.text:SetPoint("LEFT", 22, -2)
  c.arrow = UI.Text(c, 13, "bold", C.teal)
  c.arrow:SetPoint("LEFT", 6, -2)
  c.count = UI.Text(c, 11, "regular", C.dim)
  c.count:SetPoint("LEFT", c.text, "RIGHT", 8, 0)
  c.line = UI.Hairline(c, C.teal, 0.28)
  c.line:SetPoint("LEFT", c.count, "RIGHT", 10, 0)
  c.line:SetPoint("RIGHT", c, "RIGHT", -6, -2)
  c:SetScript("OnClick", function(self)
    local col = cfg().collapsed
    col[self.key] = not col[self.key] or nil
    P.RefreshList()
  end)
  list.cats[i] = c
  return c
end

local function matchesFilter(e, q)
  local f = cfg().filter
  if q ~= "" and not e.name:lower():find(q, 1, true) then return false end
  if f.can and (e.can or 0) <= 0 then return false end
  if f.skill and not e.skillUp then return false end
  if f.profit and not (e.profit and e.profit > 0) then return false end
  if f.fav and not e.fav then return false end
  return true
end

-- für Tests: die gebauten Listenzeilen
function P._rows() return list and list.rows or {} end
function P._cats() return list and list.cats or {} end

function P.RefreshList()
  local win = P.win
  if not (win and win:IsShown()) then return end
  local q = (list.query or ""):lower()
  local sort = cfg().sort or "cat"
  local holder = win.listContent
  local y, nr, nc = 0, 0, 0
  local shown = {}
  for _, e in ipairs(list.entries) do if matchesFilter(e, q) then shown[#shown + 1] = e end end
  local function placeRow(e)
    nr = nr + 1
    local row = listRow(holder, nr)
    row.e = e
    row:ClearAllPoints() row:SetPoint("TOPLEFT", 0, -y) row:Show()
    local d = DIFF[e.diff] or DIFF[3]
    row.icon:SetItem(e.r and e.r.out or 0)
    if e.icon and row.icon.icon then row.icon.icon:SetTexture(e.icon) end
    local pl = e.r and plannedFor(e.r) or 0
    local tail = ((e.can or 0) > 0 and ("  |cff9fb0aa[" .. e.can .. "]|r") or "") .. (pl > 0 and ("  " .. UI.NEON_HEX .. pl .. "×|r") or "")
    local pw = 0
    if e.profit then
      row.profit:SetText((e.profit >= 0 and "|cff61eb8f+" or "|cffff6b81-") .. ns.Money(math.abs(e.profit)) .. "|r")
      pw = math.ceil(row.profit:GetStringWidth()) + 14
    else
      row.profit:SetText("")
    end
    UI.FitText(row.name, UI.Hex(d[2]) .. e.name .. "|r" .. tail, LW - 14 - 38 - 10 - pw)
    row.name:SetWidth(LW - 14 - 38 - 10 - pw)
    row.star:SetShown(e.fav and true or false)
    local sel = e.id == P.recipeID
    row.sel.edge:SetShown(sel) row.sel.body:SetShown(sel)
    y = y + ROWH + 2
  end
  if sort == "cat" and q == "" then
    local byCat = {}
    for _, e in ipairs(shown) do byCat[e.cat] = byCat[e.cat] or {} table.insert(byCat[e.cat], e) end
    for _, cat in ipairs(list.catOrder) do
      local es = byCat[cat]
      if es then
        nc = nc + 1
        local c = catRow(holder, nc)
        c.key = cat.name
        local closed = cfg().collapsed[cat.name]
        c.text:SetText(cat.name)
        c.arrow:SetText(closed and "+" or "–")
        c.count:SetText(#es)
        c:ClearAllPoints() c:SetPoint("TOPLEFT", 0, -y) c:Show()
        y = y + CATH + 2
        if not closed then for _, e in ipairs(es) do placeRow(e) end end
        y = y + 4
      end
    end
  else
    if sort == "profit" then
      table.sort(shown, function(a, b)
        local pa, pb = a.profit or -1e12, b.profit or -1e12
        if pa ~= pb then return pa > pb end
        return a.pos < b.pos
      end)
    elseif sort == "skill" then
      table.sort(shown, function(a, b)
        if a.diff ~= b.diff then return a.diff < b.diff end
        return a.pos < b.pos
      end)
    end
    for _, e in ipairs(shown) do placeRow(e) end
  end
  for i = nr + 1, #list.rows do list.rows[i]:Hide() end
  for i = nc + 1, #list.cats do list.cats[i]:Hide() end
  win.listEmpty:SetShown(#shown == 0)
  if #shown == 0 then
    win.listEmpty:SetText(#list.entries == 0 and "Beruf wird gelesen …" or "Kein Rezept passt zu Suche/Filter.")
    y = 40
  end
  holder:SetHeight(y + 6)
  if win.listScroll.UpdateBar then win.listScroll.UpdateBar() end
  win.listInfo:SetText(string.format("%d Rezepte%s", #shown, #shown ~= #list.entries and (" von " .. #list.entries) or ""))
end

-- Kopf: Beruf, Skill-Balken, Skill-Tipp
local function refreshHead()
  local win = P.win
  local info = baseInfo()
  local name = info and info.professionName or "Beruf"
  win.title:SetText(UI.GradText(name, C.amber, C.teal))
  local tex = TS("GetTradeSkillTexture") or (info and info.icon)
  if tex then win.picon.icon:SetTexture(tex) end
  local lvl, max = info and info.skillLevel, info and info.maxSkillLevel
  if lvl and max and max > 0 then
    win.skill:SetText(string.format("Skill |cffffffff%d|r / %d", lvl, max))
    win.bar.fill:SetWidth(math.max(2, win.bar:GetWidth() * math.min(lvl / max, 1)))
    win.bar:Show()
  else
    win.skill:SetText("") win.bar:Hide()
  end
  local tip = skillTip(list.entries)
  win.tip.e = tip
  if tip then
    local d = DIFF[tip.diff] or DIFF[1]
    UI.FitText(win.tip.text, "Skill-Tipp: " .. UI.Hex(d[2]) .. tip.name .. "|r", 300)
    win.tip:SetWidth(math.ceil(win.tip.text:GetStringWidth()) + 30)
    win.tip:Show()
  else
    win.tip:Hide()
  end
  -- Berufe umschalten (nur, wenn du mehrere Herstellungsberufe hast)
  local key = profKey()
  if win.profSeg then win.profSeg:Select(key) end
end

-- Herstellen-Leiste unten rechts
local function refreshCraft()
  local win = P.win
  local id = P.recipeID
  local e
  for _, x in ipairs(list.entries) do if x.id == id then e = x break end end
  local can = e and e.can or 0
  local cb = win.craftBar
  cb.count = math.max(1, math.min(cb.count or 1, math.max(can, 1)))
  cb.num:SetText(cb.count)
  local enchant = e and e.enchant
  cb.make:SetLabel(enchant and "Im WoW-Fenster verzaubern" or "Herstellen")
  autoWidth(cb.make)
  cb.make:SetEnabled(e ~= nil and (enchant or can > 0))
  cb.all:SetLabel("Alle (" .. can .. ")")
  autoWidth(cb.all)
  cb.all:SetEnabled(e ~= nil and can > 0 and not enchant)
  cb.all:SetShown(not enchant)
  cb.minus:SetShown(not enchant) cb.plus:SetShown(not enchant) cb.num:SetShown(not enchant) cb.numBg:SetShown(not enchant)
end

function P.Craft(n)
  if ns.CombatBlocked and ns.CombatBlocked() then return end
  local id = P.recipeID
  if not id then return end
  local info = TS("GetRecipeInfo", id)
  if info and info.isEnchantingRecipe then
    -- Verzaubern braucht Blizzards Gegenstands-Auswahl: nur für diesen Besuch Blizzards Fenster (TZ bleibt gespeichert)
    P.tempWow = true
    P.Apply()
    if C_TradeSkillUI.OpenRecipe then pcall(C_TradeSkillUI.OpenRecipe, id) end
    ns.Print("Verzaubern geht im Blizzard-Fenster (Gegenstand wählen). Zurück mit |cff39ff6bTZ|r oben.")
    return
  end
  if not (C_TradeSkillUI and C_TradeSkillUI.CraftRecipe) then return end
  if C_TradeSkillUI.OpenRecipe then pcall(C_TradeSkillUI.OpenRecipe, id) end
  -- wie Blizzards Herstellen-Knopf: Grundmaterial nimmt das Spiel selbst
  C_TradeSkillUI.CraftRecipe(id, n, {}, nil, nil, false)
  ns.Print(string.format("Stelle |cff39ff6b%d× %s|r her.", n, info and info.name or "?"))
end

function P.Select(id)
  P.recipeID = id
  cfg().last = id
  if C_TradeSkillUI and C_TradeSkillUI.OpenRecipe then pcall(C_TradeSkillUI.OpenRecipe, id) end
  if P.win then P.win.craftBar.count = 1 end
  if cfg().tab ~= "recipe" then P.SetTab("recipe", true) end
  P.RefreshList()
  P.Refresh()
end

local function buildWindow()
  local f = CreateFrame("Frame", "TirysZentraleCraftWindow", UIParent)
  P.win = f
  list = { rows = {}, cats = {}, entries = {}, catOrder = {}, query = "" }
  f:SetSize(WW, WH)
  f:SetFrameStrata("HIGH")
  f:SetToplevel(true)
  f:SetClampedToScreen(true)
  f:EnableMouse(true)
  f:SetMovable(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    local p, _, rp, x, y = self:GetPoint()
    cfg().point = { p, rp, x, y }
  end)
  local pt = cfg().point
  if pt then f:SetPoint(pt[1], UIParent, pt[2], pt[3], pt[4]) else f:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 20, -110) end
  f:SetScale(ns.settings.scale or 1)
  f:Hide()
  if UISpecialFrames then tinsert(UISpecialFrames, "TirysZentraleCraftWindow") end

  f.glass = UI.Glass(f, { radius = 28, edgeMode = "neon", edge = 0.72, halo = 0.22, haloPad = 26,
    body = UI.GLASS.window, sheen = 0.05, sheenH = 90, line = 0.5 })
  UI.Ornaments(f, { w = WW, h = WH, pattern = 0.03, corners = 0.30, cornerSize = 48, inset = 4 })
  local g1 = UI.Glow(f, C.amber, 420, 0.12, "BORDER")
  g1:SetHeight(170) g1:SetPoint("TOP", f, "TOPLEFT", 190, 16)
  UI.Drift(g1, 140, 0, 10, 0.35, 0.10)
  local g2 = UI.Glow(f, C.aqua, 420, 0.10, "BORDER")
  g2:SetHeight(170) g2:SetPoint("BOTTOM", f, "BOTTOMRIGHT", -200, -8)
  -- Trennlinie zwischen Liste und Details (weicher Verlauf, kein Kasten)
  local sep = UI.Hairline(f, C.teal, 0.22)
  sep:SetWidth(1)
  sep:SetPoint("TOPLEFT", f, "TOPLEFT", RX - 12, -(HEADH + 6))
  sep:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", RX - 12, FOOTH + 6)

  -- Kopf: Berufs-Symbol in Glaskugel, Name als Verlauf, Skill-Balken, Skill-Tipp
  f.picon = UI.ItemIcon(f, 50)
  f.picon:SetPoint("TOPLEFT", 20, -16)
  local pg = UI.Glow(f, C.amber, 96, 0.28, "BORDER")
  pg:SetPoint("CENTER", f.picon, "CENTER")
  f.title = UI.Text(f, 20, "bold", C.text)
  f.title:SetPoint("TOPLEFT", f.picon, "TOPRIGHT", 14, -2)
  f.skill = UI.Text(f, 12, "semibold", C.muted)
  f.skill:SetPoint("TOPLEFT", f.title, "BOTTOMLEFT", 0, -6)
  f.bar = CreateFrame("Frame", nil, f)
  f.bar:SetSize(150, 8)
  f.bar:SetPoint("LEFT", f.skill, "RIGHT", 12, 0)
  local track = UI.PillShape(f.bar, 8, 0, false)
  track.body:SetGradientV({ 0.03, 0.04, 0.045, 0.9 }, { 0.08, 0.09, 0.10, 0.9 })
  track.edge:SetGradient(UI.GRAD_EDGE, 0.25)
  f.bar.fill = f.bar:CreateTexture(nil, "ARTWORK")
  f.bar.fill:SetTexture(UI.TEX.white)
  f.bar.fill:SetPoint("TOPLEFT", 1, -1)
  f.bar.fill:SetHeight(6)
  if f.bar.fill.SetGradient and CreateColor then
    pcall(f.bar.fill.SetGradient, f.bar.fill, "HORIZONTAL", CreateColor(C.amber[1], C.amber[2], C.amber[3], 1), CreateColor(C.aqua[1], C.aqua[2], C.aqua[3], 1))
  end
  f.tip = UI.SafeButton(f)
  f.tip:SetHeight(24)
  f.tip:SetPoint("LEFT", f.bar, "RIGHT", 14, 0)
  local ts = UI.PillShape(f.tip, 24, 0, false)
  ts.edge:SetGradient(UI.GRAD_EDGE, 0.4)
  ts.body:SetGradientV(UI.GLASS.pill[1], UI.GLASS.pill[2], 0.9)
  f.tip.text = UI.Text(f.tip, 11, "semibold", C.text)
  f.tip.text:SetPoint("CENTER")
  f.tip:SetScript("OnClick", function(self) if self.e then P.Select(self.e.id) end end)
  UI.SetTooltip(f.tip, "Skill-Tipp", "Das günstigste Rezept, das dir noch einen Skillpunkt gibt (orange = sicher +1, gelb = meistens). Klick zeigt es.")

  -- rechts oben: WoW | TZ, Zentrale, Schließen
  f.close = UI.IconButton(f, "close", 32, "Beruf schließen")
  f.close:SetPoint("TOPRIGHT", -18, -18)
  f.close:SetScript("OnClick", function() f:Hide() end)
  f.home = UI.IconButton(f, "home", 32, "Ganze Zentrale öffnen")
  f.home:SetPoint("RIGHT", f.close, "LEFT", -8, 0)
  f.home:SetScript("OnClick", function() UI.Show("recipes") end)
  f.mode = UI.Segments(f, { { value = "wow", label = "WoW" }, { value = "tz", label = "TZ" } }, function(v) P.SetMode(v) end, 160)
  local mw = f.mode.trackHolder and f.mode.trackHolder:GetWidth() or 110
  f.mode:SetPoint("TOPRIGHT", f.home, "TOPLEFT", -14 - (160 - mw), 1)
  UI.SetTooltip(f.mode.buttons[1], "WoW", "Blizzards Berufsfenster.")
  UI.SetTooltip(f.mode.buttons[2], "TZ", "Dieses Fenster.")

  -- Zeile 2: Berufe umschalten (links) + Sprung in die Zentrale (rechts)
  local profs = {}
  for _, key in ipairs(R.MyProfessions()) do profs[#profs + 1] = { value = key, label = ns.ProfName(ns.PROF[key]) } end
  if #profs > 1 then
    f.profSeg = UI.Segments(f, profs, function(key)
      if key ~= profKey() and C_TradeSkillUI and C_TradeSkillUI.OpenTradeSkill then pcall(C_TradeSkillUI.OpenTradeSkill, ns.PROF[key]) end
    end, LW + 40)
    f.profSeg:SetPoint("TOPLEFT", PAD, -74)
  end
  local leftEnd = PAD + (f.profSeg and (f.profSeg.trackHolder and f.profSeg.trackHolder:GetWidth() or LW) or 0) + 18
  local function tryRow(withIcon)
    local btns, w = {}, 0
    for i, l in ipairs(LINKS) do
      local b = UI.Button(f, l[5], "ghost", 100, 30, withIcon and l[3] or nil)
      btns[i] = b
      w = w + autoWidth(b) + (i > 1 and 6 or 0)
    end
    return btns, w
  end
  local avail = WW - PAD - leftEnd
  local btns, w = tryRow(true)
  if w > avail then
    for _, b in ipairs(btns) do b:Hide() end
    btns, w = tryRow(false)
  end
  if w > avail then
    for _, b in ipairs(btns) do b:Hide() end
    btns = {}
    for i, l in ipairs(LINKS) do btns[i] = UI.IconButton(f, l[3], 32) end
  end
  f.links = btns
  local x = WW - PAD
  for i = #LINKS, 1, -1 do
    local l, b = LINKS[i], btns[i]
    b:SetScript("OnClick", function() UI.PlayClick() UI.Show(l[1]) end)
    UI.SetTooltip(b, l[2] .. " (Zentrale)", l[4])
    b:ClearAllPoints()
    b:SetPoint("TOPRIGHT", f, "TOPLEFT", x, -74)
    x = x - b:GetWidth() - 6
  end

  -- linke Spalte: Suche, Filter, Sortierung, Liste
  local y0 = HEADH + 6
  f.search = UI.SearchBox(f, LW, "Rezept suchen …", function(t) list.query = t P.RefreshList() end)
  f.search:SetPoint("TOPLEFT", PAD, -y0)
  local fl = cfg().filter
  local pills = {
    UI.Pill(f, "Herstellbar", function() return fl.can end, function(v) fl.can = v end, P.RefreshList),
    UI.Pill(f, "Skill-Up", function() return fl.skill end, function(v) fl.skill = v end, P.RefreshList),
    UI.Pill(f, "Gewinn", function() return fl.profit end, function(v) fl.profit = v end, P.RefreshList),
    UI.Pill(f, "Favoriten", function() return fl.fav end, function(v) fl.fav = v end, P.RefreshList),
  }
  f.pills = pills
  local px, py = 0, y0 + 46
  for _, p in ipairs(pills) do
    p:Refresh()
    local pw = p:GetWidth()
    if px > 0 and px + pw > LW then px = 0 py = py + 36 end
    p:ClearAllPoints() p:SetPoint("TOPLEFT", f, "TOPLEFT", PAD + px, -py)
    px = px + pw + 6
  end
  UI.SetTooltip(pills[2], "Skill-Up", "Nur Rezepte, die dir noch Skillpunkte geben (orange/gelb).")
  UI.SetTooltip(pills[3], "Gewinn", "Nur Rezepte mit Gewinn laut AH-Preis (nach Gebühr, minus Material).")
  UI.SetTooltip(pills[4], "Favoriten", "Rechtsklick auf ein Rezept macht es zum Favoriten (wie bei Blizzard).")
  py = py + 36
  f.sort = UI.Segments(f, { { value = "cat", label = "Kategorie" }, { value = "profit", label = "Gewinn" }, { value = "skill", label = "Skill" } },
    function(v) cfg().sort = v P.RefreshList() end, LW)
  f.sort:SetPoint("TOPLEFT", PAD, -py)
  f.sort:Select(cfg().sort or "cat")
  f.listInfo = UI.Text(f, 11, "regular", C.dim)
  f.listInfo:SetPoint("TOPRIGHT", f, "TOPLEFT", PAD + LW, -(py + 8))
  f.listInfo:SetJustifyH("RIGHT")
  py = py + 38
  local lsf, lc = UI.Scroll(f)
  lsf:SetPoint("TOPLEFT", PAD, -py)
  lsf:SetPoint("BOTTOMLEFT", PAD, FOOTH + 8)
  lsf:SetWidth(LW + 2)
  lc:SetWidth(LW - 12)
  f.listScroll, f.listContent = lsf, lc
  f.listEmpty = UI.Para(lc, 12, C.muted, LW - 30)
  f.listEmpty:SetPoint("TOPLEFT", 8, -8)

  -- rechte Spalte: Reiter + Inhalt
  f.tabs = UI.Segments(f, TABS, function(v) P.SetTab(v) end, RW)
  f.tabs:SetPoint("TOPLEFT", RX, -y0)
  local th = math.max(f.tabs:GetHeight() or 30, 30)
  local sf, content = UI.Scroll(f)
  sf:SetPoint("TOPLEFT", RX, -(y0 + th + 12))
  sf:SetPoint("BOTTOMRIGHT", -PAD + 12, FOOTH + 8)
  f.scroll, f.content = sf, content
  content:SetWidth(RW - 2)
  f.pages = {}
  for _, tab in ipairs(TABS) do
    local t = CreateFrame("Frame", nil, content)
    t:SetPoint("TOPLEFT", 0, 0)
    t:SetSize(RW - 2, 10)
    BUILD[tab.value](t, RW - 2)
    t:Hide()
    f.pages[tab.value] = t
  end

  -- Fuß links: Nächstes craften + Einkauf
  f.next = UI.Button(f, "Nächstes craften", "primary", 168, 38, "bolt")
  f.next:SetPoint("BOTTOMLEFT", PAD, 16)
  f.next:SetScript("OnClick", function() local pgx = page() if pgx then pgx.CraftNext(pgx) end end)
  UI.SetTooltip(f.next, "Nächstes craften", "Stellt den ersten Eintrag der Craft-Liste her, für den dein Material reicht – erst Zwischenprodukte, dann den Rest.")
  f.shop = UI.Button(f, "Einkauf", "cool", 120, 38, "cart")
  f.shop:SetPoint("LEFT", f.next, "RIGHT", 8, 0)
  f.shop:SetScript("OnClick", function() ns.Shop.Toggle() end)
  UI.SetTooltip(f.shop, "Einkaufsfenster", "Was für die Craft-Liste noch fehlt – mit Händler-Kauf und AH-Suche.")
  -- Fuß rechts: Menge + Herstellen + Alle
  local cb = CreateFrame("Frame", nil, f)
  f.craftBar = cb
  cb:SetSize(RW, 38)
  cb:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", RX, 16)
  cb.minus = UI.IconButton(cb, "minus", 32, "Einmal weniger")
  cb.minus:SetPoint("LEFT", 0, 0)
  cb.numBg = CreateFrame("Frame", nil, cb)
  cb.numBg:SetSize(56, 32)
  cb.numBg:SetPoint("LEFT", cb.minus, "RIGHT", 4, 0)
  local nb = UI.PillShape(cb.numBg, 32, 0, false)
  nb.body:SetGradientV({ 0.04, 0.05, 0.055, 0.95 }, { 0.09, 0.10, 0.11, 0.95 })
  nb.edge:SetGradient(UI.GRAD_EDGE, 0.35)
  cb.num = UI.Text(cb.numBg, 15, "bold", C.text)
  cb.num:SetPoint("CENTER")
  cb.plus = UI.IconButton(cb, "plus", 32, "Einmal mehr")
  cb.plus:SetPoint("LEFT", cb.numBg, "RIGHT", 4, 0)
  cb.minus:SetScript("OnClick", function() cb.count = math.max(1, (cb.count or 1) - 1) refreshCraft() end)
  cb.plus:SetScript("OnClick", function() cb.count = (cb.count or 1) + 1 refreshCraft() end)
  cb.numBg:EnableMouseWheel(true)
  cb.numBg:SetScript("OnMouseWheel", function(_, d) cb.count = math.max(1, (cb.count or 1) + d) refreshCraft() end)
  cb.make = UI.Button(cb, "Herstellen", "primary", 140, 38, "flask")
  cb.make:SetPoint("LEFT", cb.plus, "RIGHT", 12, 0)
  cb.make:SetScript("OnClick", function() P.Craft(cb.count or 1) end)
  cb.all = UI.Button(cb, "Alle", "soft", 110, 38, "bolt")
  cb.all:SetPoint("LEFT", cb.make, "RIGHT", 8, 0)
  cb.all:SetScript("OnClick", function()
    local id = P.recipeID
    local n = id and TS("GetCraftableCount", id)
    if type(n) ~= "number" then for _, e in ipairs(list.entries) do if e.id == id then n = e.can end end end
    if (n or 0) > 0 then P.Craft(n) end
  end)
  UI.SetTooltip(cb.all, "Alle herstellen", "So viele, wie dein Material in den Taschen hergibt.")

  f:SetScript("OnHide", function()
    GameTooltip:Hide()
    -- Fenster zu (× oder ESC) = Beruf schließen, wie bei Blizzard
    if P.closing or not S.tradeOpen or cfg().mode ~= "tz" then return end
    P.closing = true
    local PF = _G.ProfessionsFrame
    if PF and PF:IsShown() and HideUIPanel then HideUIPanel(PF) elseif C_TradeSkillUI and C_TradeSkillUI.CloseTradeSkill then pcall(C_TradeSkillUI.CloseTradeSkill) end
    P.closing = false
  end)
  P.SetTab(cfg().tab or "recipe", true)
end

function P.SetTab(v, silent)
  local f = P.win
  if not f or not f.pages[v] then v = "recipe" end
  cfg().tab = v
  if not f then return end
  f.tabs:Select(v)
  for k, t in pairs(f.pages) do t:SetShown(k == v) end
  if f.scroll.ScrollToTop then f.scroll:ScrollToTop() end
  if not silent then P.Refresh() end
end

-- Liste neu lesen (Beruf gewechselt, Rezept gelernt, Taschen geändert, neue Preise)
function P.Reload()
  if not (P.win and P.win:IsShown()) then return end
  list.entries, list.catOrder = readEntries()
  local found
  for _, e in ipairs(list.entries) do if e.id == P.recipeID then found = true break end end
  if not found then
    P.recipeID = nil
    local want = cfg().last
    for _, e in ipairs(list.entries) do if e.id == want then P.recipeID = want break end end
    if not P.recipeID then
      local best
      for _, e in ipairs(list.entries) do
        if (e.can or 0) > 0 and (not best or (e.profit or -1e12) > (best.profit or -1e12)) then best = e end
      end
      best = best or list.entries[1]
      P.recipeID = best and best.id
    end
  end
  P.RefreshList()
  P.Refresh()
end

function P.Refresh()
  local f = P.win
  if not (f and f:IsShown()) then return end
  refreshHead()
  refreshCraft()
  local v = cfg().tab or "recipe"
  local t = f.pages[v]
  local h = ns.Safe(FILL[v], t, RW - 2) or 10
  t:SetHeight(h)
  f.content:SetHeight(h + 4)
  if f.scroll.UpdateBar then f.scroll.UpdateBar() end
end

function P.Dirty()
  if P.win and P.win:IsShown() then ns.Debounce("craftwin", 0.2, P.Reload) end
end

-- Modus anwenden: TZ = eigenes Fenster statt Blizzards (nur bei eigenem, offenem Beruf)
function P.Apply()
  local want = cfg().mode == "tz" and not P.tempWow and S.tradeOpen and not special()
  if want then
    if not P.win then buildWindow() end
    blizzVisible(false)
    if not P.win:IsShown() then
      P.win:SetScale(ns.settings.scale or 1)
      P.win:Show()
    end
    P.win.mode:Select("tz")
    P.Reload()
  else
    if P.win and P.win:IsShown() then P.closing = true P.win:Hide() P.closing = false end
    blizzVisible(true)
  end
  if P.switch then P.switch.seg:Select(P.tempWow and "wow" or cfg().mode) end
end

function P.SetMode(m)
  P.tempWow = nil
  cfg().mode = (m == "wow") and "wow" or "tz"
  P.Apply()
end

-- Alle gezeigten Top-Rezepte dieses Berufs in die Craft-Liste (wie "Liste erstellen" im Craft-Planer)
function P.MakeList()
  local pg = page()
  local key = profKey()
  local tl = P.topList or {}
  if not (pg and key) or #tl == 0 then ns.Print("Gerade bringt kein Rezept genug Gold – Mindestgewinn senken oder im AH scannen.") return end
  local q = queue()
  for i = #q, 1, -1 do if q[i].prof == key then table.remove(q, i) end end
  local added, skipped = pg.FillQueue(tl)
  ns.Shop.ResetSkips()
  ns.Print(pg.ListText(added, skipped, ""))
  ns.Shop.Show()
  UI.RefreshPage("recipes")
  ns.Fire("SHOP_CHANGED")
  P.SetTab("queue")
end

----------------------------------------------------------------------------
-- An Blizzards Berufsfenster andocken (Blizzard_Professions lädt erst beim ersten Öffnen)
----------------------------------------------------------------------------
local function onRecipeSelected(_, info)
  -- nur im WoW-Modus relevant (Auswahl in Blizzards Liste merken, damit TZ dort weitermacht)
  if type(info) == "table" and info.recipeID and not (P.win and P.win:IsShown()) then P.recipeID = info.recipeID end
end

function P.Attach()
  local PF = _G.ProfessionsFrame
  if P.attached or not PF then return P.attached or false end
  P.attached = true
  -- Umschalter über Blizzards Fenster (sichtbar im WoW-Modus)
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
  UI.SetTooltip(sw.seg.buttons[1], "WoW", "Blizzards Berufsfenster.")
  UI.SetTooltip(sw.seg.buttons[2], "TZ – Tiry's Zentrale", "Eigenes Berufsfenster der Zentrale: Rezepte mit Gewinn, Material, Absatz, Skill-Tipp, Craft-Liste und Knöpfe in die Zentrale.")
  sw.seg:Select(cfg().mode)
  -- Blizzard darf Größe/Deckkraft nicht zurücksetzen, solange TZ läuft
  hooksecurefunc(PF, "SetScale", function(self, s)
    if hideBlizz and not guard then
      P.pfScale = s
      guard = true self:SetScale(0.001) guard = false
    end
  end)
  hooksecurefunc(PF, "SetAlpha", function(self)
    if hideBlizz and not guard then guard = true self:SetAlpha(0) guard = false end
  end)
  PF:HookScript("OnShow", function() P.Apply() end)
  if EventRegistry and EventRegistry.RegisterCallback then
    pcall(EventRegistry.RegisterCallback, EventRegistry, "ProfessionsRecipeListMixin.Event.OnRecipeSelected", onRecipeSelected, P)
  end
  return true
end

ns.On("ADDON_LOADED", function(_, name)
  if name == "Blizzard_Professions" then ns.Safe(P.Attach) end
end)
ns.On("TRADE_SKILL_SHOW", function()
  if not P.Attach() then C_Timer.After(0, function() ns.Safe(P.Attach) ns.Safe(P.Apply) end) end
  P.Apply()
end)
ns.On("TRADE_SKILL_CLOSE", function()
  P.tempWow = nil
  P.Apply()
end)
ns.On("TRADE_SKILL_LIST_UPDATE", function() P.Dirty() end)
ns.On("TRADE_SKILL_DATA_SOURCE_CHANGED", function() P.Dirty() end)
ns.On("BAG_UPDATE_DELAYED", function() P.Dirty() end)
for _, msg in ipairs({ "RECIPES_SCANNED", "SHOP_CHANGED", "PRICES_UPDATED", "DEMAND_UPDATED", "CRAFTBOOK_CHANGED", "PROFESSIONS_CHANGED",
  "HISTORY_UPDATED", "DEPOSITS_LEARNED", "SNIPES_CHANGED" }) do
  ns.Listen(msg, function() P.Dirty() end)
end
-- Craft-Planer ändert die Liste/Filter -> hier mitziehen
hooksecurefunc(UI, "RefreshPage", function(key) if key == "recipes" then P.Dirty() end end)
