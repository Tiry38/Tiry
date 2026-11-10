-- Tiry's Zentrale – Seite "Item-Datenbank": alle Gegenstände von WoW Forever (deutsch), durchsuchbar
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local D = ns.DB

local PAGE_SIZE = 50

local CATS = {
  { value = "all", label = "Alle" },
  { value = 7, label = "Handwerkswaren" },
  { value = 0, label = "Verbrauchbar" },
  { value = 4, label = "Rüstung" },
  { value = 2, label = "Waffen" },
  { value = 9, label = "Rezepte" },
  { value = 1, label = "Taschen" },
  { value = 12, label = "Quest" },
  { value = 15, label = "Verschiedenes" },
  { value = "other", label = "Sonstige" },
  { value = "forever", label = "Neu in Forever" },
}
local MAIN = { [0] = true, [1] = true, [2] = true, [4] = true, [7] = true, [9] = true, [12] = true, [15] = true }

local QUAL = {
  { value = "all", label = "Jede Qualität" },
  { value = 0, label = "Grau" },
  { value = 1, label = "Weiß" },
  { value = 2, label = "Grün" },
  { value = 3, label = "Blau" },
  { value = 4, label = "Episch+" },
}

local SORTS = {
  { value = "name", label = "Name A-Z" },
  { value = "ah", label = "AH-Preis" },
  { value = "sell", label = "Händlerpreis" },
  { value = "level", label = "Level" },
}

local page = {
  title = "Item-Datenbank",
  subtitle = "", icon = "db", label = "Datenbank", order = 4,
}

local function filterFn(self)
  local cat, qual, usable = self.cat, self.qual, self.usable
  return function(e)
    if cat == "forever" then
      if e.id < 200000 then return false end
    elseif cat == "other" then
      if MAIN[e.class] then return false end
    elseif cat ~= "all" and e.class ~= cat then
      return false
    end
    if qual ~= "all" then
      if qual == 4 then
        if e.q < 4 then return false end
      elseif e.q ~= qual then
        return false
      end
    end
    if usable and e.req > ns.player.level then return false end
    return true
  end
end

function page.build(self, content, width)
  self.cat, self.qual, self.sort, self.shown = "all", "all", "name", PAGE_SIZE
  self.text = ""
  page.subtitle = "Alle " .. ns.ALLDB_COUNT .. " Gegenstände von WoW Forever – auf Deutsch, mit AH-Preis."
  local st = UI.Stack(content)
  self.search = UI.SearchBox(content, width, "Name oder Item-ID eingeben, z. B. \"seide\" oder \"rote tasche\"", function(t)
    self.text = t
    ns.Debounce("dbsearch", 0.25, function() self.shown = PAGE_SIZE page.refresh(self) end)
  end)
  st:Add(self.search, 38, 12)
  local function seg(opts, key)
    local s = UI.Segments(content, opts, function(v)
      self[key] = v
      self.shown = PAGE_SIZE
      page.refresh(self)
      self.frame.scroll:ScrollToTop()
    end, width)
    st:Add(s, s:GetHeight(), 8)
    return s
  end
  self.segCat = seg(CATS, "cat")
  self.segQual = seg(QUAL, "qual")
  self.segSort = seg(SORTS, "sort")

  local opts = CreateFrame("Frame", nil, content)
  opts:SetSize(width, 34)
  self.usableBtn = UI.Button(opts, "Nur für mein Level", "soft", 180, 32, "check")
  self.usableBtn:SetPoint("LEFT")
  self.usableBtn:SetScript("OnClick", function(b)
    self.usable = not self.usable
    b.style = self.usable and "primary" or "soft"
    b:Paint()
    self.shown = PAGE_SIZE
    page.refresh(self)
  end)
  self.listBtn = UI.Button(opts, "Treffer als Einkaufsliste", "soft", 230, 32, "cart")
  self.listBtn:SetPoint("LEFT", self.usableBtn, "RIGHT", 10, 0)
  self.listBtn:SetScript("OnClick", function()
    local ids = {}
    for i = 1, math.min(#(self.results or {}), 100) do ids[#ids + 1] = self.results[i].id end
    local ok, n = M.CreateShoppingList("Zentrale: Datenbank-Suche", ids)
    if ok then
      ns.Print("Liste |cff39ff6bZentrale: Datenbank-Suche|r angelegt (" .. n .. " Items, max. 100).")
    else
      ns.Print("|cffff6b81" .. tostring(n) .. "|r")
    end
  end)
  UI.SetTooltip(self.listBtn, "Einkaufsliste", "Legt die ersten 100 Treffer als Auctionator-Einkaufsliste an – so scannst du ihre AH-Preise mit einem Klick.")
  st:Add(opts, 34, 10)

  self.count = UI.Para(content, 12, C.gold, width)
  st:Add(self.count, 18, 8)
  self.list = UI.ItemList(content, width, {
    { key = "ah", label = "AH-Preis", width = 92 },
    { key = "vendor", label = "Händler", width = 84 },
    { key = "stack", label = "Stapel", width = 54 },
  })
  st:Add(self.list, nil)
  self.listTop = st.y
  self.more = UI.Button(content, "50 weitere anzeigen", "cool", 220, 34, "chevron")
  self.more:SetScript("OnClick", function()
    self.shown = self.shown + PAGE_SIZE
    page.refresh(self)
  end)
end

function page.refresh(self)
  if self.frame and UI.frame then UI.frame.header.sub:SetText(page.subtitle) end
  -- Ohne Suchwort und ohne Kategorie: nicht alle 18.000 Items laden (spart Speicher und Ruckler)
  if (self.text or "") == "" and self.cat == "all" then
    self.results, self.total = {}, 0
    self.count:SetText("Tippe oben einen Namen ein (z. B. \"seide\") oder wähle eine Kategorie.")
  else
    -- Nur neu suchen, wenn sich Suche/Filter geändert haben (Preis-Updates sortieren nur neu)
    local key = table.concat({ self.text or "", tostring(self.cat), tostring(self.qual), tostring(self.sort), tostring(self.usable), ns.player.level }, "|")
    if key ~= self.lastKey or self.sort == "ah" then
      local all = D.Search(self.text, filterFn(self), self.sort)
      self.total = #all
      -- nur so viele behalten, wie angezeigt werden (Rest gibt der Speicher wieder frei)
      local keep = {}
      for i = 1, math.min(#all, math.max(self.shown, 100)) do keep[i] = all[i] end
      self.results, self.lastKey, self.lastShown = keep, key, self.shown
    elseif self.shown > (self.lastShown or 0) and self.shown > #self.results then
      self.lastKey = nil
      return page.refresh(self)
    end
    local n = self.total
    self.count:SetText(string.format("%s Treffer%s", n >= 1000 and (math.floor(n / 1000) .. "." .. string.format("%03d", n % 1000)) or n,
      n > self.shown and (" – zeige die ersten " .. self.shown) or ""))
  end
  local results = self.results
  self.listBtn:SetEnabled(M.HasAuctionator() and #results > 0)
  local entries = {}
  for i = 1, math.min(#results, self.shown) do
    local e = results[i]
    local price = M.Price(e.id)
    local parts = { D.ClassName(e) }
    local sub = D.SubName(e)
    if sub and sub ~= parts[1] then parts[#parts + 1] = sub end
    if e.req > 0 then parts[#parts + 1] = "ab Level " .. e.req end
    if e.ilvl > 0 then parts[#parts + 1] = "Stufe " .. e.ilvl end
    local tip = { "Item-ID: " .. e.id }
    local bind = D.BindText(e)
    if bind then tip[#tip + 1] = bind .. (e.bind == 1 and " – nicht im AH handelbar" or "") end
    if price then
      local best, unit = M.BestSale(e.id)
      tip[#tip + 1] = "Bester Verkauf: " .. (best == "AH" and "Auktionshaus" or "Händler") .. " (" .. ns.Money(unit) .. " netto)"
    end
    entries[#entries + 1] = {
      id = e.id, name = e.name,
      note = table.concat(parts, " · "),
      cells = {
        ah = price and ns.Money(price) or "|cff8a9a94–|r",
        vendor = e.sell > 0 and ns.Money(e.sell) or "|cff8a9a94–|r",
        stack = e.stack > 1 and tostring(e.stack) or "1",
      },
      tip = tip,
    }
  end
  local idle = (self.text or "") == "" and self.cat == "all"
  local h = self.list:SetEntries(entries, idle and "" or "Nichts gefunden. Tipp: Nur einen Wortteil eingeben, z. B. \"erz\".")
  local y = self.listTop + h + 12
  if (self.total or 0) > self.shown then
    self.more:ClearAllPoints()
    self.more:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
    self.more:Show()
    y = y + 46
  else
    self.more:Hide()
  end
  self.frame.content:SetHeight(y + 20)
end

UI.RegisterPage("database", page)
