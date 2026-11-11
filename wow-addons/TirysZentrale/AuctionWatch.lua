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
  s.sold = s.sold or {} -- { id, name, auctionID, qty, unit, time, amount, exact, state = way|mail|done, eta, offline }
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
        -- verkauft: Blizzard zeigt hier die Zeit bis das Gold verschickt wird
        sendIn = (info.status == STATUS_SOLD) and info.timeLeftSeconds or nil,
        competitor = prev and prev.competitor, undercut = prev and prev.undercut, checked = prev and prev.checked,
        viaScan = prev and prev.viaScan,
      }
    end
  end
  s.list, s.time = list, time()
  AW.SyncSoldFromOwned()
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

function AW.CheckUndercuts(afterwards, force)
  wipe(queue)
  pending = nil
  local seen = {}
  for _, a in ipairs(store().list) do
    -- Stapelware, die der Komplett-Scan gerade (< 10 Min.) geprüft hat, nicht nochmal einzeln suchen
    -- ("Jetzt prüfen" sucht trotzdem)
    local fresh = not force and a.commodity and a.viaScan and (time() - a.viaScan) < 600
    if a.status == "active" and a.unit and not seen[a.id] and not fresh then
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

-- Komplett-Scan: Für welche Items lohnt das Mitlesen? Deine aktive Stapelware (bei Einzel-Items unterscheiden
-- sich Varianten wie "des Affen"/"des Adlers" – die prüft weiter die Einzelsuche).
function AW.ReplicateTargets()
  local out = {}
  for _, a in ipairs(store().list) do
    if a.status == "active" and a.commodity and a.unit and not (a.expires and a.expires < time()) then out[a.id] = true end
  end
  return out
end

-- Ergebnis des Komplett-Scans übernehmen: günstigstes fremdes Angebot je Item (nil = keine Konkurrenz)
function AW.FromReplicate(targets, cheapest)
  local n, under = 0, 0
  for id in pairs(targets or {}) do
    setResult(id, cheapest and cheapest[id])
    n = n + 1
  end
  local now = time()
  for _, a in ipairs(store().list) do
    if targets[a.id] and a.status == "active" then a.viaScan = now end
  end
  if n == 0 then return 0 end
  for _, a in ipairs(store().list) do
    if a.status == "active" and a.undercut then under = under + 1 end
  end
  if under > 0 then AW.Report() else ns.Fire("AUCTIONS_CHANGED") end
  return n
end

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
-- Scan und Unterboten-Prüfung höchstens alle X Minuten (Einstellung, Standard 30) – wer oft am AH vorbeiläuft,
-- will einstellen und nicht jedes Mal warten. Eigene Auktionen lesen ist eine einzige Abfrage und läuft immer.
function AW.IntervalMinutes()
  return ns.Clamp(tonumber(ns.settings.ahScanInterval) or 30, 5, 240)
end

function AW.AutoDue()
  local last = ns.db and ns.db.lastAutoCheck
  return not last or (time() - last) >= AW.IntervalMinutes() * 60
end

-- Minuten bis zur nächsten automatischen Prüfung (0 = beim nächsten Öffnen)
function AW.NextAutoIn()
  local last = ns.db and ns.db.lastAutoCheck
  if not last then return 0 end
  return math.max(0, math.ceil((last + AW.IntervalMinutes() * 60 - time()) / 60))
end

local wantCheck, forced = false, false
local function runChecks()
  if ns.db then ns.db.lastAutoCheck = time() end
  local scan = function() if ns.settings.ahAutoScan ~= false and M.ahOpen then M.StartScan({ quiet = true }) end end
  local force = forced
  forced = false
  if ns.settings.ahUndercut ~= false or force then AW.CheckUndercuts(scan, force) else scan() end
end

ns.Listen("AH_STATE", function()
  if not M.ahOpen then wipe(queue) pending = nil AW.checking = false return end
  C_Timer.After(1, function()
    if not M.ahOpen then return end
    wantCheck = AW.AutoDue()
    if not AW.QueryOwned() and wantCheck then
      wantCheck = false
      if ns.db then ns.db.lastAutoCheck = time() end
      if ns.settings.ahAutoScan ~= false then M.StartScan({ quiet = true }) end
    end
  end)
end)

-- "Jetzt prüfen" (Knopf): sofort, unabhängig vom Zeitabstand
function AW.CheckNow()
  wantCheck, forced = true, true
  if not AW.QueryOwned() then wantCheck, forced = false, false return false end
  return true
end

ns.On("OWNED_AUCTIONS_UPDATED", function()
  AW.ReadOwned()
  if wantCheck then
    wantCheck = false
    runChecks()
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
-- Verkauft -> Gold UNTERWEGS -> IM BRIEFKASTEN -> ABGEHOLT
-- So läuft es im Spiel (Blizzard-Code, Forever-Build): Nach dem Verkauf bleibt die Auktion mit Status
-- "Verkauft" in der eigenen Auktionsliste, bis das Gold verschickt ist (Blizzard zeigt dort "Eingehend" + Restzeit).
-- Erst dann kommt der Brief "Auktion erfolgreich" mit dem Gold. Darum zeigt die Zentrale nach dem Verkauf
-- zuerst "unterwegs" – und erst "im Briefkasten", wenn der Brief wirklich da ist:
--   * Briefkasten geöffnet und Verkaufsbrief gefunden (genau, mit exaktem Betrag), oder
--   * Blizzard meldet neue Post vom Auktionshaus (UPDATE_PENDING_MAIL + Absender), oder
--   * die gemessene/gemeldete Lieferzeit ist abgelaufen ("sollte da sein").
-- Die Lieferzeit misst die Zentrale selbst (Verkauf -> Brief) und merkt sie sich.
----------------------------------------------------------------------------
local WAY, MAIL, DONE = "way", "mail", "done"

local function nameOf(e) return e.name or (e.id and ns.Item(e.id).name) end

-- alte Einträge (bis 5.5.0: inMail) umstellen
local function migrate(s)
  for _, e in ipairs(s.sold) do
    if not e.state then e.state = e.inMail and MAIL or DONE end
    e.inMail = nil
  end
  if s.mail then s.mail.pending, s.mail.known = nil, nil end
end

-- gemessene Lieferzeiten (Sekunden), Mittelwert der letzten 10
local function delays()
  ns.db.ahMailDelays = ns.db.ahMailDelays or {}
  return ns.db.ahMailDelays
end
function AW.LearnDelay(sec)
  if not sec or sec < 0 or sec > 3 * 3600 then return end
  local d = delays()
  table.insert(d, math.floor(sec))
  while #d > 10 do table.remove(d, 1) end
end
function AW.TypicalDelay()
  local d = delays()
  if #d == 0 then return nil end
  local t = {}
  for i, v in ipairs(d) do t[i] = v end
  table.sort(t)
  return t[math.ceil(#t / 2)] -- Median
end

-- Absender der Verkaufsbriefe (lernt die Zentrale beim Öffnen des Briefkastens)
local function senders()
  ns.db.ahSenders = ns.db.ahSenders or {}
  return ns.db.ahSenders
end

local function eta(e)
  if e.eta then return e.eta end
  local d = AW.TypicalDelay()
  return d and (e.time + d) or nil
end
AW.ETA = eta

-- Zustand eines Verkaufs für die Anzeige: "way" | "mail" | "done"; arrivedGuess = nur über die Zeit geschätzt
function AW.SoldState(e)
  if e.state == WAY then
    local t = eta(e)
    if t and time() >= t then return MAIL, true end
  end
  return e.state, false
end

local function addSold(entry)
  local s = store()
  table.insert(s.sold, 1, entry)
  while #s.sold > 40 do table.remove(s.sold) end
  return entry
end

function AW.OnNotify(notification, name, auctionID)
  if notification ~= SOLD and notification ~= EXPIRED then return end
  local s = store()
  migrate(s)
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
    local itemName = name or (found and ns.Item(found.id).name) or "?"
    -- erwartetes Gold (nach AH-Gebühr); genau wird es mit dem Brief
    local amount = (found and found.unit) and math.floor(found.unit * found.qty * M.CutFactor()) or nil
    addSold({ id = found and found.id or ns.DB.IDByName(name), name = itemName, auctionID = auctionID or (found and found.auctionID),
      qty = found and found.qty, unit = found and found.unit, time = time(), amount = amount, state = WAY })
    local d = AW.TypicalDelay()
    ns.Print(string.format("|cffff9929Verkauft:|r %s%s – %s. Das Gold ist unterwegs zu deinem Briefkasten%s.", itemName,
      (found and found.qty and found.qty > 1) and (" (" .. found.qty .. "×)") or "", amount and ("ca. " .. ns.Money(amount)) or "Erlös",
      d and (" (kommt meist nach ca. " .. math.max(1, math.floor(d / 60 + 0.5)) .. " Min.)") or ""))
    if PlaySound and SOUNDKIT and SOUNDKIT.AUCTION_WINDOW_OPEN then pcall(PlaySound, SOUNDKIT.AUCTION_WINDOW_OPEN) end
  elseif found then
    found.status, found.soldTime = "expired", time()
  end
  ns.Fire("AUCTIONS_CHANGED")
end

ns.On("AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION", function(_, notification, text, auctionID)
  AW.OnNotify(notification, text, auctionID)
end)

-- Am AH: verkaufte Auktionen stehen dort mit Restzeit bis zum Versand -> genaue Ankunftszeit.
-- Verkäufe, die passiert sind, während du offline warst, tauchen nur hier auf -> nachtragen.
function AW.SyncSoldFromOwned()
  local s = store()
  migrate(s)
  for _, a in ipairs(s.list) do
    if a.status == "sold" then
      local e
      for _, x in ipairs(s.sold) do
        if x.auctionID and x.auctionID == a.auctionID then e = x break end
      end
      if not e then
        e = addSold({ id = a.id, name = ns.Item(a.id).name, auctionID = a.auctionID, qty = a.qty, unit = a.unit, time = time(),
          amount = a.unit and math.floor(a.unit * a.qty * M.CutFactor()) or nil, state = WAY, offline = true })
      end
      if e.state == WAY and a.sendIn then e.eta = time() + a.sendIn end
    end
  end
end

----------------------------------------------------------------------------
-- Briefkasten
----------------------------------------------------------------------------
-- Gold aus Verkäufen: im Briefkasten (genau oder geschätzt) und noch unterwegs
function AW.MailGold()
  local s = store()
  migrate(s)
  local inBox, estimated, onWay = 0, false, 0
  for _, e in ipairs(s.sold) do
    local st, guess = AW.SoldState(e)
    if st == MAIL then
      inBox = inBox + (e.amount or 0)
      if guess or not e.exact then estimated = true end
    elseif st == WAY then
      onWay = onWay + (e.amount or 0)
    end
  end
  return inBox, estimated, onWay
end

-- Briefe lesen: Verkaufsbriefe (Rechnung "seller" mit Gold) den Verkäufen zuordnen.
function AW.ScanMailbox()
  if not (GetInboxNumItems and GetInboxHeaderInfo and GetInboxInvoiceInfo) then return end
  local s = store()
  migrate(s)
  local letters = {}
  for i = 1, GetInboxNumItems() or 0 do
    local _, _, sender, _, money = GetInboxHeaderInfo(i)
    local invoiceType, itemName = GetInboxInvoiceInfo(i)
    if invoiceType == "seller" and (money or 0) > 0 and itemName then
      letters[#letters + 1] = { name = itemName, money = money }
      if sender and sender ~= "" then senders()[sender] = true end
    end
  end
  -- 1) Briefe den Verkäufen zuordnen (älteste zuerst)
  local used = {}
  for li, l in ipairs(letters) do
    local best
    for _, e in ipairs(s.sold) do
      if not used[e] and e.state ~= DONE and nameOf(e) == l.name then best = e end -- letzte Treffer = ältester
    end
    if best then
      used[best] = true
      if best.state == WAY and not best.offline then AW.LearnDelay(time() - best.time) end
      best.state, best.amount, best.exact = MAIL, l.money, true
    else
      -- Verkauf, den die Zentrale nicht mitbekommen hat (z. B. offline verkauft)
      local e = addSold({ id = ns.DB.IDByName(l.name), name = l.name, time = time(), amount = l.money, exact = true, state = MAIL, offline = true })
      used[e] = true
    end
    letters[li].matched = true
  end
  -- 2) Was als "im Briefkasten" galt, aber keinen Brief mehr hat -> abgeholt
  for _, e in ipairs(s.sold) do
    if e.state == MAIL and not used[e] then e.state = DONE end
  end
  s.mailScanned = time()
  ns.Fire("AUCTIONS_CHANGED")
end

ns.On("MAIL_SHOW", function() ns.Debounce("ahmail", 0.6, AW.ScanMailbox) end)
ns.On("MAIL_INBOX_UPDATE", function() ns.Debounce("ahmail", 0.4, AW.ScanMailbox) end)
ns.On("MAIL_CLOSED", function() AW.ScanMailbox() end)

-- Fern vom Briefkasten: Blizzard meldet neue Post. Ist der Absender das Auktionshaus (oder noch unbekannt),
-- ist der älteste unterwegs befindliche Verkauf angekommen.
function AW.OnNewMail()
  if not (HasNewMail and HasNewMail()) then return end
  local s = store()
  migrate(s)
  local oldest
  for _, e in ipairs(s.sold) do if e.state == WAY then oldest = e end end
  if not oldest then return end
  local known = senders()
  if next(known) and GetLatestThreeSenders then
    local hit = false
    for _, name in ipairs({ GetLatestThreeSenders() }) do if known[name] then hit = true end end
    if not hit then return end
  end
  if not oldest.offline then AW.LearnDelay(time() - oldest.time) end
  oldest.state = MAIL
  ns.Print(string.format("|cff61eb8fIm Briefkasten:|r Gold für %s%s ist angekommen.", nameOf(oldest) or "deinen Verkauf",
    oldest.amount and (" (ca. " .. ns.Money(oldest.amount) .. ")") or ""))
  ns.Fire("AUCTIONS_CHANGED")
end
ns.On("UPDATE_PENDING_MAIL", function() if not AW.mailOpen then ns.Debounce("ahnewmail", 0.5, AW.OnNewMail) end end)
ns.On("MAIL_SHOW", function() AW.mailOpen = true end)
ns.On("MAIL_CLOSED", function() AW.mailOpen = false end)

-- Lieferzeit abgelaufen -> Anzeige aktualisieren (auch ohne Ereignis)
C_Timer.NewTicker(30, function()
  local s = ns.char and ns.char.auctions
  if not s or not s.sold then return end
  for _, e in ipairs(s.sold) do
    if e.state == WAY then
      local t = eta(e)
      if t and time() >= t and not e.dueShown then e.dueShown = true ns.Fire("AUCTIONS_CHANGED") end
    end
  end
end)

-- Beim Einloggen erinnern
ns.Listen("LOGIN", function()
  C_Timer.After(12, function()
    local gold, estimated, onWay = AW.MailGold()
    if gold and gold > 0 then
      ns.Print(string.format("Im Briefkasten liegen %s%s aus Auktionsverkäufen – hol es dir ab!", estimated and "ca. " or "", ns.Money(gold)))
    elseif onWay and onWay > 0 then
      ns.Print(string.format("Unterwegs zu deinem Briefkasten: ca. %s aus Auktionsverkäufen.", ns.Money(onWay)))
    end
  end)
end)

-- Zusammenfassung für Anzeige und Startseite
function AW.Summary()
  local s = store()
  local active, value, undercut, expiredGuess, items = 0, 0, 0, 0, 0
  for _, a in ipairs(s.list) do
    if a.status == "active" then
      if a.expires and a.expires < time() then
        expiredGuess = expiredGuess + 1
      else
        active = active + 1
        items = items + a.qty
        value = value + (a.unit or 0) * a.qty
        if a.undercut then undercut = undercut + 1 end
      end
    end
  end
  local today, soldToday = date("%Y-%m-%d", time()), 0
  for _, e in ipairs(s.sold) do if date("%Y-%m-%d", e.time) == today then soldToday = soldToday + 1 end end
  local mailGold, mailEstimated, onWay = AW.MailGold()
  return { active = active, items = items, value = value, undercut = undercut, expired = expiredGuess, soldToday = soldToday, time = s.time,
    mailGold = mailGold, mailEstimated = mailEstimated, onWay = onWay }
end

ns.Listen("AUCTIONS_CHANGED", function()
  local n = AW.Summary().undercut
  if ns.UI and ns.UI.SetBadge then ns.UI.SetBadge("auctions", n > 0 and tostring(n) or nil) end
end)

----------------------------------------------------------------------------
-- Neu einstellen: unterboten, abgelaufen (zurück in der Tasche) oder frisch hergestellt
-- Preisvorschlag = günstigstes Angebot minus 1 Kupfer (Einzel-Items: ganze Silber), aber NIE unter "Nicht unter" (AW.Floor).
-- Einstellen selbst machst du in Auctionator (Blizzard erlaubt Addons kein Einstellen ohne Klick).
----------------------------------------------------------------------------
-- "Nicht unter": Materialkosten (falls selbst hergestellt) UND Händlerpreis – jeweils so, dass nach AH-Gebühr und
-- erwartetem Einstellgebühr-Verlust (Forever: Gebühr weg bei Ablauf) mehr übrig bleibt. Unter dem Händlerpreis
-- einzustellen lohnt nie: Dann direkt zum Händler.
function AW.VendorFloor(id)
  local risk = M.DepositRisk and M.DepositRisk(id) or 0
  local vendor = M.VendorSell(id) or 0
  return vendor > 0 and math.ceil((vendor + risk) / M.CutFactor()) or nil, risk
end

function AW.Floor(id)
  local vfloor, risk = AW.VendorFloor(id)
  local unit = ns.CraftBook.UnitCost(id) -- wirklich selbst hergestellt (Herstell-Buch)
  if not unit then
    -- Rezept-Kosten nur für EIGENE Rezepte und nie für Sammelware: gehäutetes Leder, Kräuter, Erz haben keine
    -- Herstellkosten (gleiche Regel wie der Item-Tooltip)
    local r = ns.Recipes.ByOutput(id)
    local gathered = ns.Skin and ns.Skin.GATHER and ns.Skin.GATHER[id]
    if not r or gathered or not ns.Recipes.IsKnown(r) then return vfloor end
    local _, _, cost, unknown = ns.Scanner.RecipeProfit(r)
    if not cost or unknown > 0 or (r.qty or 0) <= 0 then return vfloor end
    unit = cost / r.qty
  end
  return math.max(math.ceil((unit + risk) / M.CutFactor()), vfloor or 0)
end

-- Ausrüstung und andere Einzel-Items: ganze Silberbeträge. Blizzard (Forum, 09.11.2026): "Kupfer weglassen hilft"
-- gegen den "Internen Auktionsfehler" – Stapelware ist nicht betroffen und bleibt bei 1 Kupfer darunter.
function AW.WholeSilver(id)
  return (ns.Item(id).stack or 1) <= 1
end

local function suggest(id, competitor)
  local base = competitor or M.Price(id)
  local floor = AW.Floor(id)
  local silver = AW.WholeSilver(id)
  local function up(v) return (silver and v and v >= 100) and math.ceil(v / 100) * 100 or v end
  if not base then return up(floor), floor, false end
  local s = math.max(base - 1, 1)
  if silver and base > 100 then s = math.floor((base - 1) / 100) * 100 end -- 3g 45s 27c -> 3g 45s, 3g 45s -> 3g 44s
  if floor and s < floor then return up(floor), floor, true end -- Markt liegt unter deinen Kosten: lieber warten
  return s, floor, false
end
AW.Suggest = suggest

function AW.RelistList()
  local s = store()
  local list, seen = {}, {}
  local function bagCount(id) return (C_Item and C_Item.GetItemCount and C_Item.GetItemCount(id, false)) or 0 end
  -- a) unterboten (liegt noch im AH)
  for _, a in ipairs(s.list) do
    if a.status == "active" and a.undercut and not (a.expires and a.expires < time()) then
      local price, floor, wait = suggest(a.id, a.competitor)
      list[#list + 1] = { id = a.id, qty = a.qty, where = "unterboten", price = price, floor = floor, wait = wait, mine = a.unit }
      seen[a.id .. "|ah"] = true
    end
  end
  -- b) abgelaufen und zurück in der Tasche
  for _, a in ipairs(s.list) do
    local expired = a.status == "expired" or (a.status == "active" and a.expires and a.expires < time())
    if expired and not seen[a.id] and bagCount(a.id) > 0 then
      local price, floor, wait = suggest(a.id)
      list[#list + 1] = { id = a.id, qty = bagCount(a.id), where = "abgelaufen", price = price, floor = floor, wait = wait }
      seen[a.id] = true
    end
  end
  -- c) frisch hergestellt, noch nicht eingestellt
  for _, e in ipairs((ns.Guide.ReadyToSell())) do
    if not seen[e.id] then
      local price, floor, wait = suggest(e.id)
      list[#list + 1] = { id = e.id, qty = e.n, where = "hergestellt", price = price, floor = floor, wait = wait }
      seen[e.id] = true
    end
  end
  -- Goldmacher-Regel "nicht den Markt fluten": nur so viele einstellen, wie in ~3 Tagen weggehen
  -- (post = empfohlene Menge, full = Angebot reicht für über 2 Wochen -> Preise gedrückt, lieber halten)
  -- stale = in 14 Tagen mind. 2× abgelaufen und nie verkauft: jedes Einstellen kostet Gebühr ->
  -- billiger einstellen oder zum Händler (vendor = Händlerpreis pro Stück, falls er etwas zahlt)
  local D = ns.Demand
  local idx = ns.Ledger and ns.Ledger.Index and ns.Ledger.Index(14) or {}
  local listed = {}
  for _, a in ipairs(s.list) do
    if a.status == "active" and not a.undercut and not (a.expires and a.expires < time()) then
      listed[a.id] = (listed[a.id] or 0) + (a.qty or 1)
    end
  end
  for _, e in ipairs(list) do
    local batch = D and D.MarketBatch(e.id)
    e.post = (batch and e.where ~= "unterboten") and math.max(0, math.min(e.qty, batch - (listed[e.id] or 0))) or e.qty
    e.full = D and D.Full(e.id) or nil
    local x = idx[e.id]
    if x and x.expired >= 2 and x.sold == 0 then
      e.stale, e.expired = true, x.expired
      local v = M.VendorSell(e.id) or 0
      e.vendor = v > 0 and v or nil
    end
  end
  return list
end
