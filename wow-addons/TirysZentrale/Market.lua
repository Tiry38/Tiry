-- Tiry's Zentrale – Markt: Brücke zu Auctionator (öffentliche API v1) und Wertberechnung
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

-- Auctionator meldet neue Preise (eigener Scan, Tiry's Zentrale-Knopf oder Auto-Scan) -> merken und anzeigen
ns.Listen("LOGIN", function()
  local a = api()
  if a and a.RegisterForDBUpdate then
    pcall(a.RegisterForDBUpdate, ADDON, function()
      ns.Debounce("prices", 1, function()
        if ns.db then ns.db.lastScan = time() end -- jede Preis-Aktualisierung (auch Suchen im AH)
        if M.scanRequested then
          M.scanRequested = nil
          if ns.db then ns.db.lastFullScan = time() end
          ns.Print("|cffff9929Scan fertig!|r Tiry's Zentrale rechnet jetzt mit den neuen Preisen.")
        end
        ns.Fire("PRICES_UPDATED")
      end)
    end)
  end
end)

-- Startet denselben Scan wie Auctionators eigener Knopf "Scannen" (Reiter Auctionator)
-- opts.quiet: automatischer Scan beim Öffnen des AH – keine Meldung, wenn er gerade nicht geht
function M.StartScan(opts)
  local quiet = opts and opts.quiet
  if not M.HasAuctionator() then
    if not quiet then ns.Print("|cffff6b81Auctionator fehlt|r – bitte die Forever-Version installieren.") end
    return false
  end
  if not M.ahOpen then
    if not quiet then ns.Print("Stell dich ans Auktionshaus und öffne es – dann scannt Tiry's Zentrale mit einem Klick.") end
    return false
  end
  -- Auctionator hat KEINE öffentliche Funktion zum Scan-Start. Wir nutzen seinen eigenen Scan-Knopf-Code nur,
  -- wenn er genau so vorhanden ist und Auctionator den Scan gerade zulässt (15-Minuten-Sperre, laufender Scan).
  -- Alles abgesichert: Fehlt etwas, kommt nur eine Anleitung – nie ein Fehler.
  local okCall, started, reason = pcall(function()
    local st, cfg = Auctionator.State, Auctionator.Config
    if type(st) ~= "table" then return false, "unknown" end
    local full = type(cfg) == "table" and type(cfg.Get) == "function" and type(cfg.Options) == "table"
      and cfg.Get(cfg.Options.REPLICATE_SCAN)
    local frame = (full and st.FullScanFrameRef) or st.IncrementalScanFrameRef or st.FullScanFrameRef
    if type(frame) ~= "table" or type(frame.InitiateScan) ~= "function" then return false, "unknown" end
    if frame.inProgress or frame.doingFullScan then return false, "running" end
    if type(frame.CanInitiate) == "function" and not frame:CanInitiate() then return false, "cooldown" end
    frame:InitiateScan()
    return true
  end)
  if okCall and started then
    M.scanRequested = true
    ns.Print(quiet and "Scanne das AH automatisch ... (abschaltbar in den Einstellungen)"
      or "Scan läuft ... Tiry's Zentrale meldet sich, sobald die Preise da sind.")
    return true
  end
  if quiet then return false end
  if okCall and reason == "running" then
    ns.Print("Auctionator scannt schon – einfach warten, die Preise kommen gleich.")
  elseif okCall and reason == "cooldown" then
    ns.Print("Auctionator erlaubt den Komplett-Scan nur alle 15 Minuten. Bitte kurz warten – deine Preise sind noch frisch.")
  else
    ns.Print("Bitte im AH den Reiter |cffff9929Auctionator|r öffnen und auf |cffff9929Scannen|r klicken – Tiry's Zentrale erkennt neue Preise automatisch.")
  end
  return false
end

function M.LastScanText()
  local t = ns.db and ns.db.lastScan
  if not t then return M.HasAuctionator() and "Auctionator-Daten (Scan-Zeit unbekannt)" or "keine (Auctionator fehlt)" end
  local mins = math.floor((time() - t) / 60)
  if mins < 2 then return "Preise gerade aktualisiert" end
  if mins < 120 then return "Preise von vor " .. mins .. " Min." end
  local h = math.floor(mins / 60)
  if h < 48 then return "Preise von vor " .. h .. " Std." end
  return "Preise von vor " .. math.floor(h / 24) .. " Tagen – bitte neu scannen"
end

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
