-- Goldrausch – Markt: Brücke zu Auctionator (öffentliche API v1) und Wertberechnung
local ADDON, ns = ...

local M = {}
ns.Market = M

local function api()
  return Auctionator and Auctionator.API and Auctionator.API.v1
end

-- Ist Auctionator geladen und bietet die Preis-API?
function M.HasAuctionator()
  local a = api()
  return a ~= nil and type(a.GetAuctionPriceByItemID) == "function"
end

-- Letzter von Auctionator gesehener AH-Preis (Kupfer pro Stück) oder nil
function M.Price(itemID)
  local a = api()
  if not (a and a.GetAuctionPriceByItemID and itemID) then return nil end
  local ok, price = pcall(a.GetAuctionPriceByItemID, ADDON, itemID)
  if ok and type(price) == "number" and price > 0 then return price end
  return nil
end

-- Tage seit dem letzten Scan (nil = nie gesehen oder älter als 21 Tage)
function M.Age(itemID)
  local a = api()
  if not (a and a.GetAuctionAgeByItemID and itemID) then return nil end
  local ok, age = pcall(a.GetAuctionAgeByItemID, ADDON, itemID)
  if ok and type(age) == "number" then return age end
  return nil
end

-- Einkaufspreis beim Händler (nur unbegrenzte Händlerware), aus eigenem Speicher oder Auctionator
function M.VendorBuy(itemID)
  local own = ns.db and ns.db.vendorBuy and ns.db.vendorBuy[itemID]
  if own then return own end
  local a = api()
  if a and a.GetVendorPriceByItemID then
    local ok, price = pcall(a.GetVendorPriceByItemID, ADDON, itemID)
    if ok and type(price) == "number" and price > 0 then return price end
  end
  return nil
end

-- Was der Händler beim Verkauf zahlt (Kupfer pro Stück)
function M.VendorSell(itemID)
  return ns.Item(itemID).sell or 0
end

function M.CutFactor()
  local cut = (ns.settings and tonumber(ns.settings.ahCut)) or 5
  return 1 - ns.Clamp(cut, 0, 50) / 100
end

-- Erlös nach AH-Gebühr
function M.Net(price)
  if not price then return nil end
  return math.floor(price * M.CutFactor())
end

-- Bester Verkaufsweg für ein Item: "AH" oder "HAENDLER", Wert pro Stück (netto)
function M.BestSale(itemID)
  local ah = M.Net(M.Price(itemID))
  local vendor = M.VendorSell(itemID)
  if ah and ah > vendor then
    return "AH", ah, vendor
  end
  return "HAENDLER", vendor, vendor
end

-- Günstigster bekannter Einkaufspreis (für Rezeptkosten): Händler oder AH
function M.BuyCost(itemID)
  local vendor = M.VendorBuy(itemID)
  local ah = M.Price(itemID)
  if vendor and ah then return math.min(vendor, ah), (vendor <= ah) and "HAENDLER" or "AH" end
  if vendor then return vendor, "HAENDLER" end
  if ah then return ah, "AH" end
  return nil
end

function M.AgeText(itemID)
  local age = M.Age(itemID)
  if age == nil then
    if M.Price(itemID) then return "älter als 3 Wochen" end
    return "noch nie gescannt"
  end
  if age == 0 then return "heute" end
  if age == 1 then return "gestern" end
  return "vor " .. age .. " Tagen"
end

-- Suchbegriff für Auctionator (lokalisierter Name, exakte Suche)
local function searchName(itemID)
  local item = ns.Item(itemID)
  if item.loaded then return item.name end
  local static = ns.ITEMS and ns.ITEMS[itemID]
  if static and static.de and GetLocale and GetLocale() == "deDE" then return static.de end
  return nil
end

-- Legt eine Auctionator-Einkaufsliste an (ersetzt eine gleichnamige Liste)
function M.CreateShoppingList(listName, itemIDs)
  local a = api()
  if not (a and a.CreateShoppingList and a.ConvertToSearchString) then
    return false, "Auctionator ist nicht geladen."
  end
  local terms, missing, seen = {}, 0, {}
  for _, id in ipairs(itemIDs) do
    local name = searchName(id)
    if name and not seen[name] then
      seen[name] = true
      local ok, term = pcall(a.ConvertToSearchString, ADDON, { searchString = name, isExact = true })
      if ok and term then terms[#terms + 1] = term end
    elseif not name then
      missing = missing + 1
    end
  end
  if #terms == 0 then
    return false, "Item-Namen werden noch geladen – bitte gleich nochmal klicken."
  end
  local ok, err = pcall(a.CreateShoppingList, ADDON, listName, terms)
  if not ok then return false, tostring(err) end
  return true, #terms, missing
end

-- Sofortsuche im offenen Auktionshaus
function M.SearchNow(itemIDs)
  local a = api()
  if not (a and a.MultiSearchExact) then return false, "Auctionator ist nicht geladen." end
  if not M.ahOpen then return false, "Öffne zuerst das Auktionshaus." end
  local names, seen = {}, {}
  for _, id in ipairs(itemIDs) do
    local name = searchName(id)
    if name and not seen[name] then
      seen[name] = true
      names[#names + 1] = name
    end
  end
  if #names == 0 then return false, "Item-Namen werden noch geladen." end
  local ok, err = pcall(a.MultiSearchExact, ADDON, names)
  if not ok then return false, tostring(err) end
  return true
end

ns.On("AUCTION_HOUSE_SHOW", function()
  M.ahOpen = true
  ns.Fire("AH_STATE")
end)
ns.On("AUCTION_HOUSE_CLOSED", function()
  M.ahOpen = false
  ns.Fire("AH_STATE")
end)

-- Auctionator meldet neue Preise -> Oberfläche aktualisieren
ns.Listen("LOGIN", function()
  local a = api()
  if a and a.RegisterForDBUpdate then
    pcall(a.RegisterForDBUpdate, ADDON, function()
      ns.Debounce("prices", 1, function() ns.Fire("PRICES_UPDATED") end)
    end)
  end
end)

-- Status für die Anzeige
function M.Status()
  if not M.HasAuctionator() then
    return "missing", "Auctionator nicht gefunden"
  end
  local probe = M.Price(2589) or M.Price(2592) or M.Price(2770) or M.Price(2318)
  if not probe then
    return "empty", "Auctionator aktiv – noch keine Preise. Öffne das AH und scanne."
  end
  return "ok", "Auctionator verbunden – Live-Preise aktiv"
end
