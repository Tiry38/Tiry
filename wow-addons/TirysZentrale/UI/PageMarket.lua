-- Tiry's Zentrale – Seite "Marktpreise": Live-Preise wichtiger Materialien (Auctionator)
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market

local FILTERS = {
  { value = "all", label = "Alle" },
  { value = "forever", label = "Neu in Forever" },
  { value = "cloth", label = "Stoff" },
  { value = "leather", label = "Leder" },
  { value = "ore", label = "Erz & Steine" },
  { value = "herb", label = "Kräuter" },
  { value = "scarce", label = "Selten (Forever)" },
  { value = "enchant", label = "Verzauberung" },
  { value = "fish", label = "Fisch" },
  { value = "meat", label = "Fleisch" },
  { value = "crafted", label = "Hergestelltes" },
  { value = "vendor", label = "Händlerware" },
}
local FILTER_NAMES = {}
for _, f in ipairs(FILTERS) do FILTER_NAMES[f.value] = f.label end

local page = {
  title = "Marktpreise",
  subtitle = "Was deine Beute gerade im Auktionshaus wert ist – live aus Auctionator.",
  icon = "coins", label = "Marktpreise", order = 3,
}

-- Alle handelbaren neuen Forever-Materialien direkt aus der Spieldaten-Datenbank
local foreverIDs
local function foreverMaterials()
  if foreverIDs then return foreverIDs end
  foreverIDs = {}
  for _, e in ipairs(ns.DB.Load()) do
    if e.id >= 200000 and e.class == 7 and e.bind ~= 1 and not e.name:find("NYI") then
      foreverIDs[#foreverIDs + 1] = e.id
    end
  end
  return foreverIDs
end

local function currentIDs()
  if page.filter == "forever" then return foreverMaterials() end
  local ids = {}
  for _, id in ipairs(ns.ITEM_ORDER) do
    local cat = ns.ITEMS[id].cat
    if (page.filter == "all" and cat ~= "vendor" and cat ~= "other") or cat == page.filter then
      ids[#ids + 1] = id
    end
  end
  return ids
end

function page.build(self, content, width)
  self.filter = "all"
  local st = UI.Stack(content)

  local intro = st:Para("Tipp: Fahr mit der Maus über ein Item für Details. |cff8cff4dShift-Klick|r legt den Link in den Chat. "
    .. "\"Stapel netto\" = Wert von einem vollen Stapel nach Abzug der AH-Gebühr.", 12, C.muted, 14)

  self.segments = UI.Segments(content, FILTERS, function(v)
    self.filter = v
    page.refresh(self)
  end, width)
  st:Add(self.segments, self.segments:GetHeight(), 14)

  -- Aktionen
  local actions = CreateFrame("Frame", nil, content)
  actions:SetSize(width, 34)
  self.listBtn = UI.Button(actions, "Als Auctionator-Einkaufsliste", "primary", 250, 34, "cart")
  self.listBtn:SetPoint("LEFT")
  self.listBtn:SetScript("OnClick", function()
    local ids = currentIDs()
    local name = "Zentrale: " .. (FILTER_NAMES[self.filter] or "Alle")
    local ok, n, missing = M.CreateShoppingList(name, ids)
    if ok then
      ns.Print(string.format("Einkaufsliste |cff8cff4d%s|r mit %d Einträgen angelegt. Im AH: Reiter 'Auctionator' > 'Einkaufen'.", name, n))
      if missing and missing > 0 then ns.Print(missing .. " Item(s) lädt der Client noch – Klick später nochmal für die komplette Liste.") end
    else
      ns.Print("|cffff6b81" .. tostring(n) .. "|r")
    end
  end)
  UI.SetTooltip(self.listBtn, "Einkaufsliste anlegen", "Legt in Auctionator eine Liste mit allen Items dieser Kategorie an. Damit scannst du im AH alle Preise mit einem Klick.")

  self.searchBtn = UI.Button(actions, "Jetzt im AH suchen", "soft", 190, 34, "scan")
  self.searchBtn:SetPoint("LEFT", self.listBtn, "RIGHT", 10, 0)
  self.searchBtn:SetScript("OnClick", function()
    local ok, err = M.SearchNow(currentIDs())
    if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
  end)
  UI.SetTooltip(self.searchBtn, "Sofort-Suche", "Funktioniert, während das Auktionshaus offen ist: Auctionator sucht alle Items dieser Liste und zeigt dir die günstigsten Angebote.")
  st:Add(actions, 34, 16)

  self.status = UI.Para(content, 12, C.gold, width)
  st:Add(self.status, 18, 8)

  self.list = UI.ItemList(content, width, {
    { key = "ah", label = "AH-Preis", width = 92 },
    { key = "vendor", label = "Händler", width = 78 },
    { key = "stack", label = "Stapel netto", width = 104, bold = true },
    { key = "age", label = "Stand", width = 96 },
  })
  st:Add(self.list, nil)
  self.listTop = st.y
  self.stack = st
end

function page.refresh(self)
  local state, text = M.Status()
  if state == "ok" then
    self.status:SetText("|cff61eb8f•|r " .. text .. "  ·  AH-Gebühr: " .. (ns.settings.ahCut or 5) .. " %")
  elseif state == "empty" then
    self.status:SetText("|cff8cff4d•|r " .. text)
  else
    self.status:SetText("|cffff6b81•|r Auctionator nicht gefunden – es werden nur Händlerpreise gezeigt. Installiere Auctionator für WoW Forever.")
  end
  self.searchBtn:SetEnabled(M.ahOpen == true and M.HasAuctionator())
  self.listBtn:SetEnabled(M.HasAuctionator())

  local entries = {}
  for _, id in ipairs(currentIDs()) do
    local static = ns.ITEMS[id] or { cat = "forever", stack = 20 }
    local item = ns.Item(id)
    local price = M.Price(id)
    local net = price and M.Net(price)
    local stack = item.stack or static.stack or 1
    local vendor = M.VendorSell(id)
    local best, unit = M.BestSale(id)
    local tip = {}
    if price then
      tip[#tip + 1] = string.format("Bester Verkauf: %s (%s pro Stück netto)", best == "AH" and "Auktionshaus" or "Händler", ns.Money(unit))
    else
      tip[#tip + 1] = "Noch kein AH-Preis bekannt – einmal im AH scannen."
    end
    entries[#entries + 1] = {
      id = id,
      note = (static.cat == "forever") and ("Neu in Forever · " .. (ns.DB.SubName(ns.DB.Get(id)) or "Handwerkswaren")) or (FILTER_NAMES[static.cat] or ""),
      sortValue = net and net * stack or -1,
      cells = {
        ah = price and ns.Money(price) or "|cff8a9a94–|r",
        vendor = vendor > 0 and ns.Money(vendor) or "|cff8a9a94–|r",
        stack = net and ns.Money(net * stack) or (vendor > 0 and ("|cff93a39d" .. ns.Money(vendor * stack) .. "|r") or "|cff8a9a94–|r"),
        age = price and M.AgeText(id) or "|cff8a9a94–|r",
      },
      tip = tip,
    }
  end
  table.sort(entries, function(a, b)
    if a.sortValue ~= b.sortValue then return a.sortValue > b.sortValue end
    return a.id < b.id
  end)
  local h = self.list:SetEntries(entries, "Keine Items in dieser Kategorie.")
  self.frame.content:SetHeight(self.listTop + h + 30)
end

UI.RegisterPage("market", page)
