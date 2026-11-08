-- Tiry's Zentrale – Meine Auktionen: was liegt im AH, was wurde verkauft, wurde ich unterboten?
-- * Am AH (automatisch beim Öffnen): eigene Auktionen lesen (C_AuctionHouse.QueryOwnedAuctions) und für jedes
--   Item die günstigsten FREMDEN Angebote abfragen -> "unterboten" erkennen. Danach (optional) Auctionator-Scan.
-- * Überall in der Welt: Blizzard meldet "Auktion verkauft/abgelaufen" (AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION)
--   -> der Eintrag wird sofort als verkauft markiert. Unterbieten erkennt man nur am AH (fremde Angebote sieht
--   man nur dort).
-- Nichts davon kauft, bietet oder stellt ein – es wird nur gelesen.
local _, ns = ...

local AW = {}
ns.AH = AW
local M = ns.Market

local E = Enum or {}
local SOLD = E.AuctionHouseNotification and E.AuctionHouseNotification.AuctionSold or 4
local EXPIRED = E.AuctionHouseNotification and E.AuctionHouseNotification.AuctionExpired or 5
local STATUS_SOLD = E.AuctionStatus and E.AuctionStatus.Sold or 1
local SORT_NAME = E.AuctionHouseSortOrder and E.AuctionHouseSortOrder.Name or 1
local SORT_PRICE = E.AuctionHouseSortOrder and E.AuctionHouseSortOrder.Price or 0

local function store()
  ns.char.auctions = ns.char.auctions or {}
  local s = ns.char.auctions
  s.list = s.list or {} -- { auctionID, id, key, qty, unit, status, expires, competitor, undercut, checked, soldTime }
  s.sold = s.sold or {} -- { id, name, qty, unit, time }
  return s
end
AW.Store = store

local CAH = function() return C_AuctionHouse end

----------------------------------------------------------------------------
-- Eigene Auktionen lesen
----------------------------------------------------------------------------
local function isCommodity(itemKey, id)
  local ah = CAH()
  if ah and ah.GetItemKeyInfo then
    local ok, info = pcall(ah.GetItemKeyInfo, itemKey)
    if ok and info then return info.isCommodity end
  end
  return (ns.Item(id).stack or 1) > 1 -- Rückfall: stapelbar = Stapelware
end

function AW.QueryOwned()
  local ah = CAH()
  if not (M.ahOpen and ah and ah.QueryOwnedAuctions) then return false end
  return pcall(ah.QueryOwnedAuctions, { { sortOrder = SORT_NAME, reverseSort = false } })
end

function AW.ReadOwned()
  local ah = CAH()
  if not (ah and ah.GetNumOwnedAuctions and ah.GetOwnedAuctionInfo) then return end
  local s = store()
  local old = {}
  for _, a in ipairs(s.list) do old[a.auctionID] = a end
  local list = {}
  for i = 1, ah.GetNumOwnedAuctions() or 0 do
    local info = ah.GetOwnedAuctionInfo(i)
    if info and info.itemKey and info.itemKey.itemID then
      local id = info.itemKey.itemID
      local qty = math.max(info.quantity or 1, 1)
      local commodity = isCommodity(info.itemKey, id)
      -- Stapelware: buyoutAmount = Stückpreis. Einzel-Items: buyoutAmount = Preis der ganzen Auktion.
      local unit = info.buyoutAmount and (commodity and info.buyoutAmount or math.floor(info.buyoutAmount / qty)) or nil
      local prev = old[info.auctionID]
      local k = info.itemKey
      list[#list + 1] = {
        auctionID = info.auctionID, id = id, qty = qty, unit = unit, commodity = commodity,
        key = { itemID = k.itemID, itemLevel = k.itemLevel or 0, itemSuffix = k.itemSuffix or 0, battlePetSpeciesID = k.battlePetSpeciesID or 0 },
        status = (info.status == STATUS_SOLD) and "sold" or "active",
        expires = info.timeLeftSeconds and (time() + info.timeLeftSeconds) or (prev and prev.expires),
        competitor = prev and prev.competitor, undercut = prev and prev.undercut, checked = prev and prev.checked,
      }
    end
  end
  s.list, s.time = list, time()
  ns.Fire("AUCTIONS_CHANGED")
end

----------------------------------------------------------------------------
-- Unterboten? Für jedes eigene Item die günstigsten fremden Angebote abfragen (nur am AH, gedrosselt)
----------------------------------------------------------------------------
local queue, pending = {}, nil

local function setResult(id, best)
  for _, a in ipairs(store().list) do
    if a.id == id and a.status == "active" then
      a.competitor = best
      a.undercut = (best ~= nil and a.unit ~= nil and best < a.unit) or false
      a.checked = time()
    end
  end
end

function AW.Next()
  local ah = CAH()
  if not (M.ahOpen and ah and ah.SendSearchQuery) then wipe(queue) pending = nil AW.checking = false return end
  if pending then return end
  local a = queue[1]
  if not a then
    AW.checking = false
    AW.Report()
    if AW.afterCheck then local fn = AW.afterCheck AW.afterCheck = nil fn() end
    return
  end
  if ah.IsThrottledMessageSystemReady and not ah.IsThrottledMessageSystemReady() then return end -- wartet auf THROTTLED_SYSTEM_READY
  table.remove(queue, 1)
  pending = a.id
  local key = a.key
  if not key and ah.MakeItemKey then key = ah.MakeItemKey(a.id) end
  local ok = key and pcall(ah.SendSearchQuery, key, { { sortOrder = SORT_PRICE, reverseSort = false } }, true)
  if not ok then pending = nil return AW.Next() end
  local id, since = a.id, GetTime()
  AW.pendingSince = since
  -- keine Antwort nach 6 Sekunden -> nächstes Item
  C_Timer.After(6, function()
    if pending == id and AW.pendingSince == since and GetTime() - since >= 5 then pending = nil AW.Next() end
  end)
end

function AW.CheckUndercuts(afterwards)
  wipe(queue)
  pending = nil
  local seen = {}
  for _, a in ipairs(store().list) do
    if a.status == "active" and a.unit and not seen[a.id] then
      seen[a.id] = true
      queue[#queue + 1] = a
    end
  end
  AW.afterCheck = afterwards
  AW.checking = #queue > 0
  AW.Next()
end

local function cheapestOther(n, getInfo, field)
  local best
  for i = 1, math.min(n or 0, 60) do
    local r = getInfo(i)
    local p = r and r[field]
    if p and field == "buyoutAmount" then p = math.floor(p / math.max(r.quantity or 1, 1)) end
    if p and not r.containsOwnerItem and (not best or p < best) then best = p end
  end
  return best
end

ns.On("COMMODITY_SEARCH_RESULTS_UPDATED", function(_, itemID)
  if not itemID or pending ~= itemID then return end
  local ah = CAH()
  setResult(itemID, cheapestOther(ah.GetNumCommoditySearchResults(itemID),
    function(i) return ah.GetCommoditySearchResultInfo(itemID, i) end, "unitPrice"))
  pending = nil
  C_Timer.After(0.2, AW.Next)
end)

ns.On("ITEM_SEARCH_RESULTS_UPDATED", function(_, itemKey)
  local id = itemKey and itemKey.itemID
  if not id or pending ~= id then return end
  local ah = CAH()
  setResult(id, cheapestOther(ah.GetNumItemSearchResults(itemKey),
    function(i) return ah.GetItemSearchResultInfo(itemKey, i) end, "buyoutAmount"))
  pending = nil
  C_Timer.After(0.2, AW.Next)
end)

ns.On("AUCTION_HOUSE_THROTTLED_SYSTEM_READY", function()
  if AW.checking and not pending then AW.Next() end
end)

-- Wie viele eigene Auktionen sind unterboten?
function AW.UndercutList()
  local out = {}
  for _, a in ipairs(store().list) do
    if a.status == "active" and a.undercut then out[#out + 1] = a end
  end
  return out
end

function AW.Report()
  local list = AW.UndercutList()
  ns.Fire("AUCTIONS_CHANGED")
  if #list == 0 then
    if #store().list > 0 then ns.Print("Deine Auktionen sind alle |cffff9929am günstigsten|r – nichts unterboten.") end
    return
  end
  local names = {}
  for i = 1, math.min(#list, 4) do
    local a = list[i]
    names[#names + 1] = string.format("%s (du %s, jetzt %s)", ns.Item(a.id).name, ns.Money(a.unit), ns.Money(a.competitor))
  end
  ns.Print(string.format("|cffff6b81%d Auktion%s unterboten:|r %s%s. Neu einstellen: Auctionator > Reiter \"Unterboten\".",
    #list, #list == 1 and "" or "en", table.concat(names, ", "), #list > 4 and " ..." or ""))
end

----------------------------------------------------------------------------
-- Ablauf beim Öffnen des AH (ohne Klick): eigene Auktionen -> Unterboten-Prüfung -> Auctionator-Scan
----------------------------------------------------------------------------
local wantCheck = false
ns.Listen("AH_STATE", function()
  if not M.ahOpen then wipe(queue) pending = nil AW.checking = false return end
  C_Timer.After(1, function()
    if not M.ahOpen then return end
    wantCheck = true
    if not AW.QueryOwned() then
      wantCheck = false
      if ns.settings.ahAutoScan ~= false then M.StartScan({ quiet = true }) end
    end
  end)
end)

ns.On("OWNED_AUCTIONS_UPDATED", function()
  AW.ReadOwned()
  if wantCheck then
    wantCheck = false
    local scan = function() if ns.settings.ahAutoScan ~= false and M.ahOpen then M.StartScan({ quiet = true }) end end
    if ns.settings.ahUndercut ~= false then AW.CheckUndercuts(scan) else scan() end
  end
end)

-- Neue Auktion eingestellt / zurückgezogen -> Liste neu lesen
ns.On("AUCTION_HOUSE_AUCTION_CREATED", function() C_Timer.After(1, AW.QueryOwned) end)
ns.On("AUCTION_CANCELED", function(_, auctionID)
  local s = store()
  for i, a in ipairs(s.list) do
    if a.auctionID == auctionID then table.remove(s.list, i) break end
  end
  ns.Fire("AUCTIONS_CHANGED")
end)

----------------------------------------------------------------------------
-- Verkauft / abgelaufen: Blizzard meldet das überall (auch fern vom AH)
----------------------------------------------------------------------------
function AW.OnNotify(notification, name, auctionID)
  if notification ~= SOLD and notification ~= EXPIRED then return end
  local s = store()
  local found
  for _, a in ipairs(s.list) do
    if a.status == "active" and ((auctionID and a.auctionID == auctionID) or (not auctionID and name and ns.Item(a.id).name == name)) then
      found = a
      break
    end
  end
  if not found and name then
    for _, a in ipairs(s.list) do
      if a.status == "active" and ns.Item(a.id).name == name then found = a break end
    end
  end
  if notification == SOLD then
    if found then found.status, found.soldTime = "sold", time() end
    table.insert(s.sold, 1, { id = found and found.id or ns.DB.IDByName(name), name = name or (found and ns.Item(found.id).name) or "?",
      qty = found and found.qty, unit = found and found.unit, time = time() })
    while #s.sold > 40 do table.remove(s.sold) end
    if PlaySound and SOUNDKIT and SOUNDKIT.AUCTION_WINDOW_OPEN then pcall(PlaySound, SOUNDKIT.AUCTION_WINDOW_OPEN) end
  elseif found then
    found.status, found.soldTime = "expired", time()
  end
  ns.Fire("AUCTIONS_CHANGED")
end

ns.On("AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION", function(_, notification, text, auctionID)
  AW.OnNotify(notification, text, auctionID)
end)

-- Zusammenfassung für Anzeige und Startseite
function AW.Summary()
  local s = store()
  local active, value, undercut, expiredGuess = 0, 0, 0, 0
  for _, a in ipairs(s.list) do
    if a.status == "active" then
      if a.expires and a.expires < time() then
        expiredGuess = expiredGuess + 1
      else
        active = active + 1
        value = value + (a.unit or 0) * a.qty
        if a.undercut then undercut = undercut + 1 end
      end
    end
  end
  local today, soldToday = date("%Y-%m-%d", time()), 0
  for _, e in ipairs(s.sold) do if date("%Y-%m-%d", e.time) == today then soldToday = soldToday + 1 end end
  return { active = active, value = value, undercut = undercut, expired = expiredGuess, soldToday = soldToday, time = s.time }
end

ns.Listen("AUCTIONS_CHANGED", function()
  local n = AW.Summary().undercut
  if ns.UI and ns.UI.SetBadge then ns.UI.SetBadge("auctions", n > 0 and tostring(n) or nil) end
end)
