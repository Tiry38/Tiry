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

----------------------------------------------------------------------------
-- Einstellgebühr (Kaution): In Forever kostet jedes Angebot mindestens 1 Silber (Wowhead-News vom 05.11.2026).
-- Sie kommt zurück, wenn das Item verkauft wird – verloren ist sie nur, wenn das Angebot abläuft oder du es
-- abbrichst. Echte Kosten pro Verkauf = Gebühr × erwartete Fehlversuche (aus deiner eigenen Verkaufsquote).
-- Den exakten Betrag rechnet Blizzard nur bei offenem AH aus -> er wird pro Item gemerkt.
----------------------------------------------------------------------------
-- Laufzeit-Stufe 1–3 (kurz/mittel/lang) wie in Blizzards Verkaufsfenster gewählt, sonst mittel
function M.Duration()
  local ok, d = pcall(function() return GetCVar and tonumber(GetCVar("auctionHouseDurationDropdown")) end)
  d = ok and tonumber(d) or nil
  if not d or d < 1 or d > 3 then return 2 end
  return math.floor(d)
end

-- Typische Angebotsgröße: Ausrüstung einzeln, Stapelware als Menge (deine Menge, sonst bis 20 Stück)
function M.ListSize(itemID, have)
  local stack = ns.Item(itemID).stack or 1
  if stack <= 1 then return 1 end
  return math.max(1, math.floor(have or math.min(stack, 20)))
end

-- Exakter Betrag von Blizzard (nur bei offenem AH). Ausrüstung braucht ein Item in der Tasche (ItemLocation).
local function exactDeposit(itemID, qty, loc, d)
  local AH = C_AuctionHouse
  if not (M.ahOpen and AH) then return nil end
  local ok, v
  if loc and AH.CalculateItemDeposit then
    ok, v = pcall(AH.CalculateItemDeposit, loc, d, qty)
  elseif AH.CalculateCommodityDeposit then
    ok, v = pcall(AH.CalculateCommodityDeposit, itemID, d, qty)
  end
  if ok and type(v) == "number" and v >= 0 then return v end
  return nil
end

-- Schätzung, solange Blizzard noch nichts gesagt hat: Forever-Berichte nennen 5 / 20 / 60 % des Händlerpreises
-- je Laufzeit (wowforever.be, 06.11.2026; Wowheads Beispiel passt zu 60 %) – nicht offiziell bestätigt.
M.DEPOSIT_SHARE = { 0.05, 0.20, 0.60 }

-- Einstellgebühr für EIN Angebot mit qty Stück (Kupfer). 2. Rückgabe: true = exakt von Blizzard
function M.Deposit(itemID, qty, loc)
  qty = math.max(math.floor(qty or 1), 1)
  local d = M.Duration()
  local cache = ns.db and ns.db.deposits
  local v = itemID and exactDeposit(itemID, qty, loc, d)
  if v then
    if cache then
      local c = type(cache[itemID]) == "table" and cache[itemID] or {}
      c[d] = { v = v, q = qty, t = time() }
      cache[itemID] = c
    end
    return v, true
  end
  local floor = math.max(tonumber(ns.settings and ns.settings.ahDeposit) or 100, 0)
  local c = cache and itemID and type(cache[itemID]) == "table" and cache[itemID][d]
  if type(c) == "table" and tonumber(c.v) and tonumber(c.q) and c.q > 0 then
    -- gemerkten Betrag auf die Menge umrechnen; das Minimum je Angebot bleibt bestehen
    return math.max(math.floor(c.v * qty / c.q + 0.5), math.min(floor, c.v)), false
  end
  local vendor = itemID and M.VendorSell(itemID) or 0
  return math.max(floor, math.floor(vendor * qty * M.DEPOSIT_SHARE[d] + 0.5)), false
end

-- Deine Verkaufsquote über alle Items (ab 10 Angeboten in 30 Tagen), kurz gemerkt
local overall = { t = -100 }
local function overallRate()
  local now = GetTime and GetTime() or 0
  if now - overall.t > 60 then
    overall.t, overall.p = now, nil
    local L = ns.Ledger
    local ok, tot = pcall(function() return L and L.Totals and L.Totals(30) end)
    if ok and tot and tot.rate and (tot.sold + tot.expired) >= 10 then overall.p = tot.rate end
  end
  return overall.p
end
function M.ResetRateCache() overall.t = -100 end

-- Erwartete Fehlversuche (abgelaufene Angebote) bis zum Verkauf: (1 − Quote) / Quote, höchstens 4.
-- Quote: deine Quote für dieses Item (ab 4 Angeboten) > gemessener Absatz im AH > deine Gesamtquote > 50 %
-- Pro Bildaufbau gemerkt (Listen rechnen das für hunderte Rezepte); neu bei neuen Verkaufsbuch-Einträgen/Messungen
local relCache, relStamp = {}, nil
function M.ExpectedRelists(itemID)
  local b = ns.db and ns.db.ledger
  local stamp = tostring(GetTime and GetTime() or 0) .. ":" .. (b and (#(b.sales or {}) + #(b.expired or {})) or 0)
    .. ":" .. tostring(ns.Demand and ns.Demand.version or 0)
  if stamp ~= relStamp then relCache, relStamp = {}, stamp end
  if itemID and relCache[itemID] then return relCache[itemID] end
  local v = M.ComputeRelists(itemID)
  if itemID then relCache[itemID] = v end
  return v
end

function M.ComputeRelists(itemID)
  local L, p = ns.Ledger, nil
  if L and L.SaleRate and itemID then
    local rate, n = L.SaleRate(itemID)
    if rate and n and n >= 4 then p = rate end
  end
  if not p and itemID and ns.Demand then p = ns.Demand.SellChance(itemID) end
  p = ns.Clamp(p or overallRate() or 0.5, 0.2, 1)
  return (1 - p) / p
end

-- Erwarteter Gebühren-Verlust pro verkauftem Stück (Kupfer)
function M.DepositRisk(itemID, qty, loc)
  if not itemID then return 0 end
  qty = math.max(math.floor(qty or M.ListSize(itemID)), 1)
  local dep = M.Deposit(itemID, qty, loc)
  return math.floor(dep / qty * M.ExpectedRelists(itemID) + 0.5)
end

-- AH-Erlös pro Stück nach Gebühr UND Einstellgebühr-Risiko (nil ohne Preis)
function M.NetAfterDeposit(itemID, qty, price)
  local net = M.Net(price or M.Price(itemID))
  if not net then return nil end
  return net - M.DepositRisk(itemID, qty)
end

-- Bester Verkaufsweg für ein Item: "AH" oder "HAENDLER", Wert pro Stück (netto, inkl. Einstellgebühr-Risiko)
function M.BestSale(itemID, qty)
  local ah = M.NetAfterDeposit(itemID, qty)
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

-- Bei offenem AH die exakten Einstellgebühren für Taschen-Items und eigene Rezept-Ergebnisse merken
function M.LearnDeposits()
  if not (M.ahOpen and C_AuctionHouse) then return 0 end
  local n, seen = 0, {}
  if C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerItemInfo then
    for bag = 0, NUM_TOTAL_EQUIPPED_BAG_SLOTS or NUM_BAG_SLOTS or 4 do
      for slot = 1, C_Container.GetContainerNumSlots(bag) or 0 do
        local info = C_Container.GetContainerItemInfo(bag, slot)
        local id = info and info.itemID
        if id and not seen[id] and not info.isBound then
          seen[id] = true
          local loc
          if (ns.Item(id).stack or 1) <= 1 and ItemLocation and ItemLocation.CreateFromBagAndSlot then
            loc = ItemLocation:CreateFromBagAndSlot(bag, slot)
          end
          local _, exact = M.Deposit(id, loc and 1 or M.ListSize(id, info.stackCount), loc)
          if exact then n = n + 1 end
        end
      end
    end
  end
  local R = ns.Recipes
  if R and R.List and R.MyProfessions then
    for _, key in ipairs(R.MyProfessions()) do
      for _, r in ipairs(R.List(key, "known") or {}) do
        local id = r.out
        if id and not seen[id] and (ns.Item(id).stack or 1) > 1 then
          seen[id] = true
          local _, exact = M.Deposit(id, M.ListSize(id))
          if exact then n = n + 1 end
        end
      end
    end
  end
  return n
end

ns.On("AUCTION_HOUSE_SHOW", function()
  M.ahOpen = true
  ns.Fire("AH_STATE")
  if C_Timer and C_Timer.After then
    C_Timer.After(1.5, function()
      ns.Safe(function()
        if M.LearnDeposits() > 0 then ns.Fire("PRICES_UPDATED") end
      end)
    end)
  end
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
          ns.Print("|cffff9929Scan fertig!|r Alle Reiter rechnen jetzt mit den neuen Preisen.")
        end
        ns.Fire("PRICES_UPDATED")
      end)
    end)
  end
end)

-- Startet denselben Scan wie Auctionators eigener Knopf "Scannen" (Reiter Auctionator)
-- opts.quiet: automatischer Scan beim Öffnen des AH – keine Meldung, wenn er gerade nicht geht
-- EIN Scan für alle Reiter: Bevorzugt der Komplett-Scan (Blizzard-Liste aller Angebote, alle 15 Min. erlaubt).
-- Er liefert in einem Durchgang die Preise (Auctionator), Absatz/Markt-Tiefe, Schnäppchen und den Unterboten-Check
-- deiner Stapelware. Ist er gesperrt, aktualisiert der Schnell-Scan von Auctionator wenigstens alle Preise.
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
    local full, inc = st.FullScanFrameRef, st.IncrementalScanFrameRef
    local function usable(f) return type(f) == "table" and type(f.InitiateScan) == "function" end
    local order
    if ns.settings.ahFullScan ~= false then
      order = { { full, "komplett" }, { inc, "schnell" } }
    else
      local cfgFull = type(cfg) == "table" and type(cfg.Get) == "function" and type(cfg.Options) == "table"
        and cfg.Get(cfg.Options.REPLICATE_SCAN)
      order = cfgFull and { { full, "komplett" }, { inc, "schnell" } } or { { inc, "schnell" }, { full, "komplett" } }
    end
    local any, cooldown = false, false
    for _, o in ipairs(order) do
      local f = o[1]
      if usable(f) then
        any = true
        if f.inProgress or f.doingFullScan then return false, "running" end
      end
    end
    for _, o in ipairs(order) do
      local f, kind = o[1], o[2]
      if usable(f) then
        if type(f.CanInitiate) == "function" and not f:CanInitiate() then
          cooldown = true
        else
          f:InitiateScan()
          return true, kind, cooldown
        end
      end
    end
    if not any then return false, "unknown" end
    return false, "cooldown"
  end)
  if okCall and started then
    M.scanRequested = true
    M.scanKind = reason
    if quiet then
      ns.Print("Scanne das AH automatisch ... (abschaltbar in den Einstellungen)")
    elseif reason == "komplett" then
      ns.Print("Komplett-Scan läuft ... Preise, Absatz, Schnäppchen und Unterboten – für alle Reiter auf einmal.")
    else
      ns.Print("Schnell-Scan läuft (Komplett-Scan erst in ein paar Minuten wieder erlaubt) – alle Preise werden aktualisiert.")
    end
    return true
  end
  if quiet then return false end
  if okCall and reason == "running" then
    ns.Print("Auctionator scannt schon – einfach warten, die Preise kommen gleich.")
  elseif okCall and reason == "cooldown" then
    ns.Print("Blizzard erlaubt den Komplett-Scan nur alle 15 Minuten. Bitte kurz warten – deine Preise sind noch frisch.")
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
