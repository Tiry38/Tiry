-- Tiry's Zentrale – Seite "Farm-Guide": Wo farme ich mit meinem Level was – sortiert nach Live-Wert
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market

local page = {
  title = "Farm-Guide",
  subtitle = "Wo du mit deinem Level am meisten Gold farmst – mit echten Preisen.",
  icon = "pin", label = "Farm-Guide", order = 2.5,
}

local function bandFor(level)
  for _, b in ipairs(ns.FARM) do
    if level >= b.min and level < b.max then return b.key end
  end
  return ns.FARM[#ns.FARM].key
end

-- Wert einer Materialgruppe: bestes Item (netto) × Stapel (max. 20)
function ns.FarmGroupValue(ids)
  local best, bestID, list = nil, nil, {}
  for _, id in ipairs(ids) do
    local price = M.Price(id)
    local stack = math.min(ns.Item(id).stack or 20, 20)
    local v = price and M.Net(price) * stack or nil
    list[#list + 1] = { id = id, price = price, value = v }
    if v and (not best or v > best) then best, bestID = v, id end
  end
  table.sort(list, function(a, b) return (a.value or -1) > (b.value or -1) end)
  return best, bestID, list
end

local function groupCard(parent, width)
  local card = UI.Card(parent, 18, C.card)
  card:SetWidth(width)
  card.rank = UI.Chip(card, "", C.hi, true)
  card.rank:SetPoint("TOPLEFT", 16, -16)
  card.title = UI.Text(card, 15, "bold", C.text)
  card.title:SetPoint("LEFT", card.rank, "RIGHT", 10, 0)
  card.prof = UI.Chip(card, "", C.green)
  card.prof:SetPoint("LEFT", card.title, "RIGHT", 10, 0)
  card.value = UI.Text(card, 16, "bold", C.hi)
  card.value:SetPoint("TOPRIGHT", -18, -16)
  card.valueSub = UI.Text(card, 10, "semibold", C.dim)
  card.valueSub:SetPoint("TOPRIGHT", card.value, "BOTTOMRIGHT", 0, -3)
  card.how = UI.Para(card, 11, C.muted, width - 220)
  card.how:SetPoint("TOPLEFT", 16, -46)
  card.icons = {}
  card.spots = {}
  card.listBtn = UI.Button(card, "Einkaufsliste", "soft", 150, 28, "cart")
  card.listBtn:SetPoint("BOTTOMRIGHT", -16, 14)
  card.listBtn:SetScript("OnClick", function(self)
    local ok, n = M.CreateShoppingList("Zentrale: Farm " .. self.label, self.ids)
    ns.Print(ok and ("Liste |cffff9929Zentrale: Farm " .. self.label .. "|r angelegt (" .. n .. " Items).") or ("|cffff6b81" .. tostring(n) .. "|r"))
  end)
  return card
end

-- Knopf "Auf Karte": setzt den Wegpunkt zu einer berechneten Farm-Stelle
local function spotButton(card, i)
  local b = card.spots[i]
  if b then return b end
  b = UI.Button(card, "", "soft", 200, 30, "pin")
  UI.SetFont(b.text, 11, "semibold")
  b:SetScript("OnClick", function(self) ns.Maps.Show(self.spot, self.what) end)
  UI.SetTooltip(b, function(self)
    local s = self.spot
    if not s then return end
    return ns.Maps.ZoneName(s.map) .. string.format(" %.0f, %.0f", s.x, s.y),
      s.n .. " Fundpunkte in der Nähe (QuestieDB-Daten).\nZum Beispiel: " .. table.concat(s.names, ", ") .. "\n\nKlick = Wegpunkt mit Pfeil + Karte öffnen."
  end)
  card.spots[i] = b
  return b
end

local function itemChip(card, i)
  local c = card.icons[i]
  if c then return c end
  c = CreateFrame("Button", nil, card)
  c:SetSize(150, 34)
  c.icon = UI.ItemIcon(c, 28)
  c.icon:SetPoint("LEFT")
  c.name = UI.Text(c, 11, "semibold", C.text)
  c.name:SetPoint("TOPLEFT", c.icon, "TOPRIGHT", 6, -1)
  c.name:SetWidth(112)
  c.name:SetWordWrap(false)
  c.price = UI.Text(c, 10, "regular", C.muted)
  c.price:SetPoint("TOPLEFT", c.name, "BOTTOMLEFT", 0, -2)
  c:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
    pcall(GameTooltip.SetItemByID, GameTooltip, self.id)
    GameTooltip:Show()
  end)
  c:SetScript("OnLeave", function() GameTooltip:Hide() end)
  c:SetScript("OnClick", function(self) if IsShiftKeyDown() then ns.LinkItem(self.id) end end)
  card.icons[i] = c
  return c
end

function page.build(self, content, width)
  self.band = bandFor(ns.player.level)
  local opts = {}
  for _, b in ipairs(ns.FARM) do opts[#opts + 1] = { value = b.key, label = "Level " .. b.key } end
  local st = UI.Stack(content)
  self.segments = UI.Segments(content, opts, function(v)
    self.band = v
    page.refresh(self)
    self.frame.scroll:ScrollToTop()
  end, width)
  st:Add(self.segments, self.segments:GetHeight(), 12)
  self.best = UI.Card(content, 20, C.card)
  self.best:SetSize(width, 96)
  self.best.bg:SetGradient({ { 0.07, 0.27, 0.19 }, { 0.09, 0.18, 0.16 }, { 0.14, 0.16, 0.17 } }, 0.95)
  self.best.label = UI.Text(self.best, 10, "semibold", C.hi)
  self.best.label:SetPoint("TOPLEFT", 20, -16)
  self.best.text = UI.Para(self.best, 14, C.text, width - 40, "semibold")
  self.best.text:SetPoint("TOPLEFT", self.best.label, "BOTTOMLEFT", 0, -6)
  st:Add(self.best, 96, 14)
  self.zones = UI.Para(content, 12, C.muted, width)
  self.top = st.y
  self.cards = {}
end

function page.refresh(self)
  local width = UI.CONTENT_W
  local band
  for _, b in ipairs(ns.FARM) do if b.key == self.band then band = b end end
  band = band or ns.FARM[1]
  self.segments:Select(band.key)

  -- Gruppen bewerten
  local ranked = {}
  for _, key in ipairs(ns.FARM_ORDER) do
    local ids = band.groups[key]
    if ids then
      local g = ns.FARM_GROUPS[key]
      local value, bestID, list = ns.FarmGroupValue(ids)
      local can = (not g.prof) or ns.HasProf(g.prof)
      ranked[#ranked + 1] = { key = key, g = g, ids = ids, value = value, bestID = bestID, list = list, can = can }
    end
  end
  table.sort(ranked, function(a, b)
    if a.can ~= b.can then return a.can end
    return (a.value or -1) > (b.value or -1)
  end)

  -- Empfehlung
  local mine = ns.player.level >= band.min and ns.player.level < band.max
  local r1 = ranked[1]
  self.best.label:SetText(mine and "DEIN BESTER FARM JETZT (LEVEL " .. ns.player.level .. ")" or ("LEVEL " .. band.key))
  if r1 and r1.value then
    self.best.text:SetText(string.format("%s farmen – vor allem |cffff9929%s|r: %s pro Stapel im AH.%s",
      r1.g.label, ns.Item(r1.bestID).name, ns.Money(r1.value),
      (not r1.can) and ("\n|cffff6b81Dafür brauchst du " .. ns.ProfName(r1.g.prof) .. ".|r") or ""))
  else
    self.best.text:SetText("Noch keine AH-Preise für diesen Levelbereich. Öffne das AH und scanne mit Auctionator – dann steht hier, was sich am meisten lohnt.")
  end

  -- Gebiete
  local faction = ns.Faction()
  local zones, seen = {}, {}
  for _, key in ipairs(ns.FARM_ORDER) do
    for _, s in ipairs(ns.Maps.Spots(key, band.key)) do
      local name = ns.Maps.ZoneName(s.map)
      if not seen[name] then seen[name] = true zones[#zones + 1] = name end
    end
  end
  for _, z in ipairs(band.both or {}) do if z:find("Zephras") then zones[#zones + 1] = z end end
  self.zones:SetText("|cffff9929Gebiete (" .. (faction == "Horde" and "Horde" or "Allianz") .. "):|r " .. table.concat(zones, " · ")
    .. "\n|cffff9929Tipp:|r " .. (band.tip or "") .. "\n|cff93a39dStellen = dichteste Fundorte aus der Forever-Datenbank von QuestieDB. Preise = live von deinem Server.|r")
  self.zones:ClearAllPoints()
  self.zones:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -self.top)
  local y = self.top + math.ceil(self.zones:GetStringHeight()) + 16

  for i, r in ipairs(ranked) do
    local card = self.cards[i] or groupCard(self.frame.content, width)
    self.cards[i] = card
    card.rank:Set("#" .. i, i == 1 and C.hi or C.violet, true)
    card.title:SetText(r.g.label)
    if r.g.prof then
      card.prof:Set(r.can and (ns.ProfName(r.g.prof) .. " vorhanden") or (ns.ProfName(r.g.prof) .. " fehlt"), r.can and C.green or C.red)
      card.prof:Show()
    else
      card.prof:Set("kein Beruf nötig", C.teal)
      card.prof:Show()
    end
    card.value:SetText(r.value and ns.Money(r.value) or "|cff8a9a94kein Preis|r")
    card.valueSub:SetText(r.value and ("Stapel " .. ns.Item(r.bestID).name) or "AH scannen")
    card.how:SetText(r.g.how)
    local perRow = math.floor((width - 32) / 158)
    for j, e in ipairs(r.list) do
      local c = itemChip(card, j)
      c.id = e.id
      c.icon:SetItem(e.id)
      local item = ns.Item(e.id)
      local q = UI.QUALITY[item.quality or 1] or UI.QUALITY[1]
      UI.FitText(c.name, item.name, 112)
      c.name:SetTextColor(q[1], q[2], q[3], 1)
      c.price:SetText(e.price and (ns.Money(e.price) .. " / Stk.") or "kein AH-Preis")
      c:ClearAllPoints()
      c:SetPoint("TOPLEFT", card, "TOPLEFT", 16 + ((j - 1) % perRow) * 158, -78 - math.floor((j - 1) / perRow) * 40)
      c:Show()
    end
    for j = #r.list + 1, #card.icons do card.icons[j]:Hide() end
    local rows = math.ceil(#r.list / perRow)
    local spotY = 78 + rows * 40 + 6
    local spots = ns.Maps.Spots(r.key, band.key)
    local bw = math.floor((width - 32 - 16) / 3)
    for j = 1, 3 do
      local s = spots[j]
      local b = spotButton(card, j)
      if s then
        b.spot, b.what = s, r.g.label .. " (" .. table.concat(s.names, ", ") .. ")"
        b:SetSize(bw, 30)
        b:SetLabel(string.format("%s %.0f,%.0f", ns.Maps.ZoneName(s.map), s.x, s.y))
        b:ClearAllPoints()
        b:SetPoint("TOPLEFT", card, "TOPLEFT", 16 + (j - 1) * (bw + 8), -spotY)
        b:Show()
      else
        b:Hide()
      end
    end
    local h = spotY + (#spots > 0 and 40 or 0) + 50
    card:SetHeight(h)
    card.listBtn.ids, card.listBtn.label = r.ids, r.g.label
    card.listBtn:SetEnabled(M.HasAuctionator())
    card:ClearAllPoints()
    card:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
    card:Show()
    y = y + h + 12
  end
  for i = #ranked + 1, #self.cards do self.cards[i]:Hide() end
  self.frame.content:SetHeight(y + 20)
end

ns.Listen("PLAYER_CHANGED", function()
  local p = UI.pages.farm
  if p and p.frame then p.band = bandFor(ns.player.level) end
end)

UI.RegisterPage("farm", page)
