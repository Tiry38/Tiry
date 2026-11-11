-- Tiry's Zentrale – Verkaufsbuch (wie TSM Accounting / Journalator):
-- liest AH-Rechnungen aus der Post (verkauft, gekauft, abgelaufen) und berechnet daraus
-- deine EIGENE Verkaufsquote pro Item – der Ersatz für TSMs Region-Verkaufsquote.
local _, ns = ...

local L = {}
ns.Ledger = L

local KEEP_DAYS = 60
local MAIL_DAYS = 30 -- AH-Post bleibt 30 Tage im Briefkasten

local function book()
  ns.db.ledger = ns.db.ledger or {}
  local b = ns.db.ledger
  b.sales = b.sales or {}     -- { t, id, name, n, money }
  b.buys = b.buys or {}       -- { t, id, name, n, money }
  b.expired = b.expired or {} -- { t, id, name, n }
  b.seen = b.seen or {}       -- schon gezählte Briefe
  return b
end

-- Item-ID über den (deutschen) Namen aus der Datenbank; handelbare Items bevorzugt
function L.IDByName(name)
  return ns.DB.IDByName(name)
end

local function prune(list)
  local limit = time() - KEEP_DAYS * 86400
  local i = 1
  while list[i] do
    if list[i].t < limit then table.remove(list, i) else i = i + 1 end
  end
end

-- Betreff "Auktion abgelaufen: X" (lokalisiert über Blizzards Text, mit Rückfall)
local function expiredName(subject)
  if not subject then return nil end
  local pattern = AUCTION_EXPIRED_MAIL_SUBJECT and AUCTION_EXPIRED_MAIL_SUBJECT:gsub("([%(%)%.%+%-%*%?%[%]%^%$])", "%%%1"):gsub("%%s", "(.+)")
  if pattern then
    local name = subject:match("^" .. pattern .. "$")
    if name then return name end
  end
  return subject:match("^Auktion abgelaufen: (.+)$") or subject:match("^Auction expired: (.+)$")
end

function L.ScanInbox()
  if not (GetInboxNumItems and GetInboxHeaderInfo) then return 0 end
  local b = book()
  local added = 0
  local now = time()
  for i = 1, GetInboxNumItems() or 0 do
    local _, _, _, subject, money, _, daysLeft, itemCount = GetInboxHeaderInfo(i)
    local arrived = math.floor((now - (MAIL_DAYS - (daysLeft or MAIL_DAYS)) * 86400) / 3600) -- auf die Stunde
    local invoiceType, itemName, player, bid, count
    if GetInboxInvoiceInfo then
      local r = { GetInboxInvoiceInfo(i) }
      invoiceType, itemName, player, bid, count = r[1], r[2], r[3], r[4], r[11]
    end
    if invoiceType == "seller" or invoiceType == "buyer" then
      local key = invoiceType .. "|" .. tostring(itemName) .. "|" .. tostring(player) .. "|" .. tostring(bid) .. "|" .. arrived
      if not b.seen[key] then
        b.seen[key] = now
        local entry = { t = arrived * 3600, id = L.IDByName(itemName), name = itemName, n = count or 1 }
        if invoiceType == "seller" then
          entry.money = (money and money > 0) and money or bid -- ausgezahlt (nach Gebühr)
          table.insert(b.sales, entry)
        else
          entry.money = bid
          table.insert(b.buys, entry)
        end
        added = added + 1
      end
    else
      local name = expiredName(subject)
      if name then
        local key = "expired|" .. name .. "|" .. tostring(itemCount) .. "|" .. arrived
        if not b.seen[key] then
          b.seen[key] = now
          table.insert(b.expired, { t = arrived * 3600, id = L.IDByName(name), name = name, n = 1 })
          added = added + 1
        end
      end
    end
  end
  prune(b.sales) prune(b.buys) prune(b.expired)
  for k, t in pairs(b.seen) do if t < now - (KEEP_DAYS + MAIL_DAYS) * 86400 then b.seen[k] = nil end end
  if added > 0 then ns.Fire("LEDGER_CHANGED") end
  return added
end

ns.On("MAIL_INBOX_UPDATE", function() ns.Debounce("ledger", 0.5, L.ScanInbox) end)
ns.On("MAIL_SHOW", function() ns.Debounce("ledger", 1, L.ScanInbox) end)

----------------------------------------------------------------------------
-- Auswertung
----------------------------------------------------------------------------
-- Verkaufsquote eines Items (verkaufte Auktionen / (verkaufte + abgelaufene)) der letzten 30 Tage
-- Zusammenfassung pro Item für einen Zeitraum: { sold = Auktionen, units = Stück, expired = abgelaufen }.
-- Gemerkt, bis neue Einträge dazukommen oder eine Minute vergeht (Listen fragen hunderte Items ab).
local idxCache = {}
function L.Index(days)
  days = days or 30
  local b = book()
  local now = time()
  local stamp = #b.sales .. ":" .. #b.expired .. ":" .. math.floor(now / 60)
  local c = idxCache[days]
  if c and c.stamp == stamp and c.book == b then return c.items end
  local limit, items = now - days * 86400, {}
  local function get(id)
    local e = items[id]
    if not e then e = { sold = 0, units = 0, expired = 0 } items[id] = e end
    return e
  end
  for _, s in ipairs(b.sales) do
    if s.id and s.t >= limit then local e = get(s.id) e.sold, e.units = e.sold + 1, e.units + (s.n or 1) end
  end
  for _, x in ipairs(b.expired) do
    if x.id and x.t >= limit then local e = get(x.id) e.expired = e.expired + 1 end
  end
  idxCache[days] = { stamp = stamp, book = b, items = items }
  return items
end

function L.SaleRate(itemID, days)
  if not ns.db or not ns.db.ledger then return nil end
  local e = L.Index(days or 30)[itemID]
  if not e or e.sold + e.expired == 0 then return nil, 0 end
  return e.sold / (e.sold + e.expired), e.sold + e.expired
end

-- Dein Durchschnittserlös pro Stück (nach AH-Gebühr, aus den Verkaufsbriefen) und Anzahl verkaufter Stück
function L.AvgSale(itemID, days)
  if not ns.db or not ns.db.ledger then return nil, 0 end
  local b, limit = book(), time() - (days or 30) * 86400
  local money, n = 0, 0
  for _, s in ipairs(b.sales) do
    if s.id == itemID and s.t >= limit and (s.money or 0) > 0 then money, n = money + s.money, n + (s.n or 1) end
  end
  if n == 0 then return nil, 0 end
  return math.floor(money / n + 0.5), n
end

-- Summen eines Zeitraums
function L.Totals(days)
  local b, limit = book(), time() - (days or 30) * 86400
  local t = { income = 0, spent = 0, sold = 0, bought = 0, expired = 0 }
  for _, s in ipairs(b.sales) do if s.t >= limit then t.income = t.income + (s.money or 0) t.sold = t.sold + 1 end end
  for _, s in ipairs(b.buys) do if s.t >= limit then t.spent = t.spent + (s.money or 0) t.bought = t.bought + 1 end end
  for _, e in ipairs(b.expired) do if e.t >= limit then t.expired = t.expired + 1 end end
  t.profit = t.income - t.spent
  t.rate = (t.sold + t.expired > 0) and (t.sold / (t.sold + t.expired)) or nil
  return t
end

-- Pro Item: verkauft, Umsatz, abgelaufen, Quote – sortiert nach Umsatz
function L.ByItem(days)
  local b, limit = book(), time() - (days or 30) * 86400
  local items = {}
  local function get(e)
    local key = e.id or e.name
    items[key] = items[key] or { id = e.id, name = e.name, sold = 0, n = 0, money = 0, expired = 0 }
    return items[key]
  end
  for _, s in ipairs(b.sales) do if s.t >= limit then local x = get(s) x.sold = x.sold + 1 x.n = x.n + (s.n or 1) x.money = x.money + (s.money or 0) end end
  for _, e in ipairs(b.expired) do if e.t >= limit then local x = get(e) x.expired = x.expired + 1 end end
  local list = {}
  for _, x in pairs(items) do
    x.rate = (x.sold + x.expired > 0) and x.sold / (x.sold + x.expired) or nil
    list[#list + 1] = x
  end
  table.sort(list, function(a, c) return a.money > c.money end)
  return list
end
