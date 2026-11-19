-- RezeptRadar 1.0 – AH-Komplett-Scan lesen (eigener Knopf oder von Auctionator & Co. gestartet)
-- und Händlerpreise lernen. Gespeichert wird nur, was der Rezept-Berater braucht (Ergebnisse, Material, Rezepte).
-- Blizzard: C_AuctionHouse.ReplicateItems() -> REPLICATE_ITEM_LIST_UPDATE -> GetReplicateItemInfo(i), i ab 0.
-- Rückgabe 3 = Anzahl, 10 = Sofortkauf (ganze Auktion), 17 = itemID, 18 = hasAllInfo. Nur alle 15 Minuten erlaubt.
local _, ns = ...

local S = {}
ns.Scan = S

S.COOLDOWN = 15 * 60
S.BATCH = 1000          -- Zeilen je Bild (kein Ruckeln)
S.LEVELS = 12           -- günstigste Preisstufen je Item (für Materialkosten bei mehreren Stück)
S.MAX_RETRIES, S.RETRY_DELAY = 3, 4

S.ahOpen = false
S.armed = false         -- ein ReplicateItems-Aufruf (egal von wem) schaltet das Mitlesen für eine Liste scharf
S.reading = nil         -- Startzeit eines laufenden Lesevorgangs
S.progress = nil        -- 0..1 während des Lesens

local hooked = false
if hooksecurefunc and C_AuctionHouse and C_AuctionHouse.ReplicateItems then
  hooked = pcall(hooksecurefunc, C_AuctionHouse, "ReplicateItems", function()
    S.armed, S.retries = true, 0
    if ns.db then ns.db.ah.started = time() end
    ns.Fire("SCAN_STATE")
  end)
end

-- Sekunden bis der nächste Komplett-Scan erlaubt ist (0 = jetzt)
function S.Wait()
  local t = ns.db and ns.db.ah.started
  if not t then return 0 end
  return math.max(0, S.COOLDOWN - (time() - t))
end

function S.Start()
  if not S.ahOpen then return false, "Öffne zuerst das Auktionshaus." end
  if S.reading then return false, "Der Scan läuft schon." end
  local wait = S.Wait()
  if wait > 0 then
    return false, string.format("Blizzard erlaubt den Komplett-Scan nur alle 15 Minuten – wieder in %d:%02d.", math.floor(wait / 60), wait % 60)
  end
  local AH = C_AuctionHouse
  if not (AH and AH.ReplicateItems) then return false, "Komplett-Scan wird von diesem Client nicht unterstützt." end
  local ok = pcall(AH.ReplicateItems)
  if not ok then return false, "Das AH hat den Scan abgelehnt – gleich nochmal versuchen." end
  if not hooked then S.armed, S.retries = true, 0 ns.db.ah.started = time() end
  ns.Print("Komplett-Scan läuft – Blizzard schickt die Liste in ein paar Sekunden.")
  ns.Fire("SCAN_STATE")
  return true
end

-- Kosten für n Stück aus den Preisstufen { Preis1, Menge1, Preis2, Menge2, ... }; reicht das Angebot nicht,
-- zählt der Rest zum teuersten bekannten Preis. Rückgabe: Kosten gesamt, genug im AH (bool)
function S.BuyCost(e, n)
  local b = e and e.b
  if not b or #b < 2 then return nil end
  local left, cost, last = n, 0, b[1]
  for i = 1, #b, 2 do
    local take = math.min(left, b[i + 1])
    cost, left, last = cost + take * b[i], left - take, b[i]
    if left <= 0 then return cost, true end
  end
  return cost + left * last, false
end

function S.Entry(id)
  local items = ns.db and ns.db.ah.items
  return items and items[id]
end

----------------------------------------------------------------------------
-- Lesen
----------------------------------------------------------------------------
local function finish(books, total)
  local items = {}
  for id, levels in pairs(books) do
    local units = {}
    for u in pairs(levels) do units[#units + 1] = u end
    table.sort(units)
    local e = { p = units[1], q = 0, n = 0, b = {} }
    for i, u in ipairs(units) do
      local lv = levels[u]
      e.q, e.n = e.q + lv.q, e.n + lv.n
      if i <= S.LEVELS then e.b[#e.b + 1] = u e.b[#e.b + 1] = lv.q end
    end
    items[id] = e
  end
  local ah = ns.db.ah
  ah.items, ah.time, ah.total = items, time(), total
  local n = 0
  for _ in pairs(items) do n = n + 1 end
  ah.found = n
  S.progress = nil
  ns.Print(string.format("Scan fertig: %d Angebote gelesen – Rezept-Berater aktualisiert.", total))
  ns.Fire("SCAN_DONE")
end

function S.Read()
  local AH = C_AuctionHouse
  if (S.reading and GetTime() - S.reading < 60) or not (AH and AH.GetNumReplicateItems and AH.GetReplicateItemInfo) then return false end
  if not S.ahOpen then return false end
  local total = AH.GetNumReplicateItems() or 0
  if total <= 0 then return false end
  S.reading, S.armed = GetTime(), false
  local watch = ns.Craft.Watch()
  local books = {}       -- [itemID] = { [Stückpreis] = { q = Menge, n = Angebote } }
  local index, missing, missingIDs = 0, 0, {}
  S.progress = 0
  ns.Fire("SCAN_STATE")
  local function step()
    if not S.ahOpen then S.reading, S.progress = nil, nil ns.Fire("SCAN_STATE") return end -- AH zu: Liste ungültig
    local last = math.min(index + S.BATCH, total)
    for i = index, last - 1 do
      local ok, _, _, count, _, _, _, _, _, _, buyout, _, _, _, _, _, _, itemID, hasAll = pcall(AH.GetReplicateItemInfo, i)
      if ok and hasAll == false then
        missing = missing + 1
        if itemID and #missingIDs < 200 then missingIDs[#missingIDs + 1] = itemID end
      end
      if ok and itemID and watch[itemID] and count and count > 0 and buyout and buyout > 0 then
        local unit = math.floor(buyout / count + 0.5)
        local lv = books[itemID]
        if not lv then lv = {} books[itemID] = lv end
        local x = lv[unit]
        if x then x.q, x.n = x.q + count, x.n + 1 else lv[unit] = { q = count, n = 1 } end
      end
    end
    index = last
    S.progress = index / total
    if index < total then
      ns.Debounce("scanprogress", 0.25, function() ns.Fire("SCAN_STATE") end)
      C_Timer.After(0, function() ns.Safe(step) end)
      return
    end
    S.reading = nil
    -- Blizzard lädt Item-Daten nach: dann nochmal lesen (höchstens 3x), sonst fehlen Angebote zufällig
    if missing > 0 and (S.retries or 0) < S.MAX_RETRIES and S.ahOpen then
      S.retries = (S.retries or 0) + 1
      S.armed = true
      if C_Item and C_Item.RequestLoadItemDataByID then
        for _, id in ipairs(missingIDs) do pcall(C_Item.RequestLoadItemDataByID, id) end
      end
      C_Timer.After(S.RETRY_DELAY, function() if S.armed then ns.Safe(S.Read) end end)
      return
    end
    S.retries = 0
    finish(books, total)
  end
  ns.Safe(step)
  return true
end

-- Die Meldung kommt mehrfach (Item-Daten laden nach): nur nach einem neuen Scan lesen.
-- Ohne Haken (sehr alter Client): höchstens alle 10 Minuten.
function S.Wants()
  if hooked then return S.armed end
  local t = ns.db and ns.db.ah.time
  return not t or time() - t >= 600
end

ns.On("REPLICATE_ITEM_LIST_UPDATE", function()
  if not S.Wants() then return end
  ns.Debounce("replicate", 2, function() if S.Wants() then ns.Safe(S.Read) end end)
end)

ns.On("AUCTION_HOUSE_SHOW", function()
  S.ahOpen = true
  ns.Fire("SCAN_STATE")
end)
ns.On("AUCTION_HOUSE_CLOSED", function()
  S.ahOpen, S.armed = false, false
  if S.reading then S.reading, S.progress = nil, nil end
  ns.Fire("SCAN_STATE")
end)

----------------------------------------------------------------------------
-- Händler: Preise von Material mit unbegrenztem Vorrat lernen (Zutaten, Faden, Färbemittel, Salz ...)
----------------------------------------------------------------------------
function S.ReadMerchant()
  if not (GetMerchantNumItems and GetMerchantItemID and C_MerchantFrame and C_MerchantFrame.GetItemInfo) then return 0 end
  local watch, n = ns.Craft.Watch(), 0
  for i = 1, GetMerchantNumItems() or 0 do
    local id = GetMerchantItemID(i)
    if id and watch[id] then
      local ok, info = pcall(C_MerchantFrame.GetItemInfo, i)
      if ok and info and info.price and info.price > 0 and info.numAvailable == -1 and not info.hasExtendedCost then
        local unit = math.max(1, math.floor(info.price / math.max(1, info.stackCount or 1) + 0.5))
        if ns.db.vendor[id] ~= unit then ns.db.vendor[id] = unit n = n + 1 end
      end
    end
  end
  if n > 0 then ns.Fire("VENDOR_LEARNED", n) end
  return n
end
ns.On("MERCHANT_SHOW", function() C_Timer.After(0.3, function() ns.Safe(S.ReadMerchant) end) end)
ns.On("MERCHANT_UPDATE", function() ns.Debounce("merchant", 0.5, S.ReadMerchant) end)
