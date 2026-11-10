-- Tiry's Zentrale – Seite "Marktpreise": Live-Preise wichtiger Materialien (Auctionator)
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market

local FILTERS = {
  { value = "all", label = "Alle" },
  { value = "snipe", label = "Schnäppchen" },
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
  ns.DB.Each(function(e)
    if e.id >= 200000 and e.class == 7 and e.bind ~= 1 and not ns.DB.IsJunk(e.name) then
      foreverIDs[#foreverIDs + 1] = e.id
    end
  end)
  return foreverIDs
end

-- Absatz-Chip (schnell/normal/langsam ...) aus dem Absatz-Modul
local function hexColor(hex)
  local r, g, b = tostring(hex or ""):match("^(%x%x)(%x%x)(%x%x)$")
  if not r then return C.muted end
  return { tonumber(r, 16) / 255, tonumber(g, 16) / 255, tonumber(b, 16) / 255 }
end
local function demandChip(id)
  local D = ns.Demand
  local c = D and D.Class and D.Class(id)
  local l = c and c ~= "unknown" and D.LABEL and D.LABEL[c]
  if not l then return nil end
  return { l[1], hexColor(l[2]) }
end

local function currentIDs()
  if page.filter == "forever" then return foreverMaterials() end
  if page.filter == "snipe" then
    local ids = {}
    for _, e in ipairs(ns.Snipe and ns.Snipe.list or {}) do ids[#ids + 1] = e.id end
    return ids
  end
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

  st:Para("Tipp: Fahr mit der Maus über ein Item für Details. |cff39ff6bShift-Klick|r legt den Link in den Chat. "
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
      ns.Print(string.format("Einkaufsliste |cff39ff6b%s|r mit %d Einträgen angelegt. Im AH: Reiter 'Auctionator' > 'Einkaufen'.", name, n))
      if missing and missing > 0 then ns.Print(missing .. " Item(s) lädt der Client noch – Klick später nochmal für die komplette Liste.") end
    else
      ns.Print("|cffff6b81" .. tostring(n) .. "|r")
    end
  end)
  UI.SetTooltip(self.listBtn, "Einkaufsliste anlegen", "Legt in Auctionator eine Liste mit allen Items dieser Kategorie an. Damit scannst du im AH alle Preise mit einem Klick.")

  self.searchBtn = UI.Button(actions, "Angebote zeigen", "soft", 190, 34, "scan")
  self.searchBtn:SetPoint("LEFT", self.listBtn, "RIGHT", 10, 0)
  self.searchBtn:SetScript("OnClick", function()
    local ok, err
    if page.filter == "snipe" and ns.Snipe then
      ok, err = ns.Snipe.SearchAll() -- merkt Händler-Schnäppchen für den Verkaufen-Knopf beim Händler
    else
      ok, err = M.SearchNow(currentIDs())
    end
    if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
  end)
  UI.SetTooltip(self.searchBtn, "Angebote zeigen", "Nur zum Kaufen – die Preise aktualisiert der Scan oben für alle Reiter.\n\nFunktioniert, während das Auktionshaus offen ist: Auctionator sucht alle Items dieser Liste und zeigt dir die günstigsten Angebote.")
  st:Add(actions, 34, 16)

  self.status = UI.Para(content, 12, C.muted, width)
  st:Add(self.status, 18, 8)

  self.list = UI.ItemList(content, width, {
    { key = "ah", label = "AH-Preis", width = 92 },
    { key = "vendor", label = "Händler", width = 78 },
    { key = "stack", label = "Stapel netto", width = 104, bold = true },
    { key = "perday", label = "Pro Tag", width = 70 },
    { key = "age", label = "Stand", width = 96 },
  })
  st:Add(self.list, nil)
  -- Schnäppchen aus dem letzten Komplett-Scan
  self.snipeList = UI.ItemList(content, width, {
    { key = "count", label = "Menge", width = 60 },
    { key = "unit", label = "Preis/Stück", width = 100 },
    { key = "ref", label = "Händler/Markt", width = 110 },
    { key = "profit", label = "Gewinn", width = 100, bold = true },
  })
  st:Add(self.snipeList, nil)
  self.snipeList:Hide()
  self.listTop = st.y
  self.stack = st
end

local function snipeEntries()
  local S = ns.Snipe
  local out = {}
  for _, e in ipairs(S and S.list or {}) do
    local vendor = e.kind == "haendler"
    out[#out + 1] = {
      id = e.id,
      chip = vendor and { "sicher", C.green } or { "unter Marktwert", C.teal },
      note = vendor and "Kaufen und beim Händler verkaufen – sicherer Gewinn"
        or "Kaufen und im AH zum Marktwert wieder einstellen",
      cells = { count = tostring(e.count), unit = ns.Money(e.unit), ref = ns.Money(e.ref),
        profit = UI.NEON_HEX .. "+|r" .. ns.Money(e.profit) },
      tip = vendor and { "Sofortkauf unter dem Händler-Verkaufspreis: kaufen, beim Händler verkaufen.",
          "Gewinn = Händlerpreis × Menge minus Kaufpreis. Kaufen bleibt immer dein Klick." }
        or { "Deutlich unter deinem Marktwert (Median deiner Scans, mind. 3 Tage) und kein Ladenhüter.",
          "Gewinn nach AH-Gebühr und Einstellgebühr-Risiko." },
    }
  end
  return out
end

function page.refresh(self)
  if self.filter == "snipe" then
    local S = ns.Snipe
    local t = S and S.Totals() or { vendor = 0, market = 0, vendorProfit = 0, marketProfit = 0 }
    if S and S.time then
      self.status:SetText(string.format("|cff39ff6b•|r Letzter Komplett-Scan vor %d Min. · %d unter Händlerpreis (+%s sicher) · %d unter Marktwert (+%s)",
        math.floor((time() - S.time) / 60), t.vendor, ns.Money(t.vendorProfit), t.market, ns.Money(t.marketProfit)))
    else
      self.status:SetText("|cff39ff6b•|r Schnäppchen kommen aus dem Komplett-Scan – oben auf \"AH scannen\" klicken (AH muss offen sein).")
    end
    self.searchBtn:SetEnabled(M.ahOpen == true and M.HasAuctionator() and #(S and S.list or {}) > 0)
    self.listBtn:SetEnabled(M.HasAuctionator() and #(S and S.list or {}) > 0)
    self.list:Hide()
    self.snipeList:Show()
    local h = self.snipeList:SetEntries(snipeEntries(), S and S.time and "Beim letzten Komplett-Scan war nichts unter Händler- oder Marktwert."
      or "Noch kein Komplett-Scan – danach stehen hier die Schnäppchen.")
    self.frame.content:SetHeight(self.listTop + h + 30)
    return
  end
  self.snipeList:Hide()
  self.list:Show()
  local state, text = M.Status()
  if state == "ok" then
    self.status:SetText("|cff39ff6b•|r " .. text .. "  ·  AH-Gebühr: " .. (ns.settings.ahCut or 5) .. " %")
  elseif state == "empty" then
    self.status:SetText("|cff39ff6b•|r " .. text)
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
    local perDay = ns.Demand and ns.Demand.PerDay and ns.Demand.PerDay(id)
    if ns.Demand and ns.Demand.Text then tip[#tip + 1] = "Absatz: " .. ns.Demand.Text(id) end
    entries[#entries + 1] = {
      id = id,
      note = (static.cat == "forever") and ("Neu in Forever · " .. (ns.DB.SubName(ns.DB.Get(id)) or "Handwerkswaren")) or (FILTER_NAMES[static.cat] or ""),
      sortValue = net and net * stack or -1,
      chip = demandChip(id),
      cells = {
        ah = price and ns.Money(price) or "|cff8a9a94–|r",
        vendor = vendor > 0 and ns.Money(vendor) or "|cff8a9a94–|r",
        stack = net and ns.Money(net * stack) or (vendor > 0 and ("|cff93a39d" .. ns.Money(vendor * stack) .. "|r") or "|cff8a9a94–|r"),
        perday = perDay and ("~" .. (perDay >= 10 and tostring(math.floor(perDay + 0.5)) or (string.format("%.1f", perDay):gsub("%.", ",")))) or "|cff8a9a94–|r",
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
