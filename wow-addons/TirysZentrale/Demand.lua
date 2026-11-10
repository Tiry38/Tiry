-- Tiry's Zentrale – Absatz: Wie oft verkauft sich ein Item im AH wirklich?
--
-- Messung: Bei jedem Komplett-Scan (Auctionator-Knopf "Scannen" oder Tiry's Zentrale) liefert Blizzard die
-- komplette Angebotsliste (C_AuctionHouse.GetReplicateItemInfo). Tiry's Zentrale merkt sich für deine
-- Herstell-Ergebnisse, Materialien und Sammelwaren, welche Angebote es gab (Preis, Verkäufer, Restlaufzeit).
-- Beim nächsten Scan gilt: Ein Angebot, das verschwunden ist, obwohl es laut Restlaufzeit noch NICHT
-- abgelaufen sein kann, wurde gekauft (oder selten: zurückgezogen). Stellt derselbe Verkäufer zeitgleich
-- neu ein, zählt das als Umstellen, nicht als Verkauf.
-- Ergebnis: geschätzte Verkäufe pro Tag (eher zu niedrig, weil Angebote, die zwischen zwei Scans eingestellt
-- UND gekauft werden, unsichtbar bleiben). Dazu kommen deine eigenen Verkäufe aus dem Verkaufsbuch.
local _, ns = ...

local D = {}
ns.Demand = D

local MAX_GAP = 12 * 3600   -- längere Abstände zwischen zwei Scans sagen nichts mehr aus
local MIN_GAP = 5 * 60
local HALF_LIFE = 7         -- Tage: ältere Messungen zählen halb so viel
local BATCH = 1000          -- Angebote pro Bildaufbau (kein Ruckeln)
D.SHARE = 0.3               -- Anteil der Tagesverkäufe, den du realistisch selbst verkaufst (wenn du günstig bist)

-- Restlaufzeit-Stufen (Enum.AuctionHouseTimeLeftBand 0–3): Mindest-Restzeit in Sekunden.
-- Blizzard liefert die Grenzen selbst (GetTimeLeftBandInfo); sonst die bekannten Retail-Grenzen.
local BAND_MIN = { [0] = 0, [1] = 1800, [2] = 7200, [3] = 43200 }
local function bandMin(band)
  if type(band) ~= "number" then return 0 end
  local AH = C_AuctionHouse
  if AH and AH.GetTimeLeftBandInfo then
    local ok, lo = pcall(AH.GetTimeLeftBandInfo, band)
    if ok and type(lo) == "number" then return lo end
  end
  return BAND_MIN[band] or 0
end

local function store()
  if not ns.db then return nil end
  local key = (ns.Faction and ns.Faction()) or "Horde"
  ns.db.demand = ns.db.demand or {}
  local s = ns.db.demand[key]
  if type(s) ~= "table" then
    s = { stats = {}, snap = nil }
    ns.db.demand[key] = s
  end
  s.stats = s.stats or {}
  return s
end
D.Store = store

----------------------------------------------------------------------------
-- Welche Items beobachten? Alles rund um deine Berufe + Sammelwaren + deine Auktionen
----------------------------------------------------------------------------
function D.Watchlist()
  local set = {}
  local R = ns.Recipes
  if R and R.Load and R.MyProfessions then
    local byProf = R.Load()
    for _, key in ipairs(R.MyProfessions()) do
      for _, r in ipairs(byProf[key] or {}) do
        if r.out then set[r.out] = true end
        for _, re in ipairs(r.reagents or {}) do set[re.id] = true end
      end
    end
  end
  local K = ns.Skin
  if K and K.GATHER then for id in pairs(K.GATHER) do set[id] = true end end
  local a = ns.char and ns.char.auctions
  if a and a.list then for _, e in ipairs(a.list) do if e.id then set[e.id] = true end end end
  for id in pairs(ns.char and ns.char.watch or {}) do if type(id) == "number" then set[id] = true end end
  return set
end

----------------------------------------------------------------------------
-- Zwei Momentaufnahmen vergleichen -> verkaufte Stück
-- snap.items[id] = { q = Stück gesamt, n = Angebote, k = Verkäufer, p = günstigster Stückpreis,
--                    b = { ["Preis|Verkäufer"] = { q = Stück, s = Mindest-Restzeit in Sekunden } } }
----------------------------------------------------------------------------
local function ownerOf(key) return key:match("|(.*)$") or "" end

-- Rückgabe: verkaufte Stück, beobachtbar (hatte das Item Angebote, die nicht ablaufen konnten?)
function D.Compare(a, b, gap)
  local sold, observable = 0, false
  local reposted = {}
  for key, bb in pairs(b.b or {}) do
    local old = a.b and a.b[key]
    local new = bb.q - (old and old.q or 0)
    local owner = ownerOf(key)
    if new > 0 and owner ~= "" then reposted[owner] = (reposted[owner] or 0) + new end
  end
  for key, ab in pairs(a.b or {}) do
    if ab.s > gap then
      observable = true
      local now = b.b and b.b[key]
      local gone = ab.q - (now and now.q or 0)
      if gone > 0 then
        local owner = ownerOf(key)
        local back = owner ~= "" and reposted[owner] or 0
        local used = math.min(back, gone)
        if used > 0 then reposted[owner] = back - used end
        sold = sold + gone - used
      end
    end
  end
  return sold, observable
end

-- Marktweites Kauf-Profil nach Uhrzeit: verkaufte Stück und Beobachtungsstunden je Stunde (0–23),
-- anteilig auf die Stunden zwischen zwei Scans verteilt
local function addHourly(s, from, to, sold)
  s.hourly = s.hourly or {}
  local span = to - from
  if span <= 0 then return end
  if s.hourlyT and to > s.hourlyT then
    local f = 0.5 ^ ((to - s.hourlyT) / 86400 / HALF_LIFE)
    for _, b in pairs(s.hourly) do b.s, b.h = b.s * f, b.h * f end
  end
  s.hourlyT = to
  local x = from
  while x < to do
    local nextHour = (math.floor(x / 3600) + 1) * 3600
    local stop = math.min(nextHour, to)
    local h = tonumber(date("%H", x)) or 0
    local b = s.hourly[h] or { s = 0, h = 0 }
    s.hourly[h] = b
    local part = (stop - x) / span
    b.s, b.h = b.s + sold * part, b.h + (stop - x) / 3600
    x = stop
  end
end

-- Neue Momentaufnahme verarbeiten (Zeit t). Gibt die Zahl der Items mit neuer Messung zurück.
function D.Ingest(items, t)
  local s = store()
  if not s then return 0 end
  local prev = s.snap
  local measured, totalSold = 0, 0
  local gap = prev and (t - (prev.t or 0)) or nil
  local usable = gap and gap >= MIN_GAP and gap <= MAX_GAP
  for id, now in pairs(items) do
    local st = s.stats[id] or { s = 0, h = 0 }
    s.stats[id] = st
    -- ältere Messungen verlieren mit der Zeit an Gewicht
    if st.t and t > st.t then
      local f = 0.5 ^ ((t - st.t) / 86400 / HALF_LIFE)
      st.s, st.h = st.s * f, st.h * f
    end
    st.t, st.q, st.n, st.k, st.p = t, now.q, now.n, now.k, now.p
    local old = usable and prev.items and prev.items[id]
    if old then
      local sold, observable = D.Compare(old, now, gap)
      if observable then
        st.s = st.s + sold
        st.h = st.h + gap / 3600
        measured = measured + 1
        totalSold = totalSold + sold
      end
    end
  end
  -- Items, die diesmal komplett fehlen (alles weg): gelten als ausverkauft, sofern nichts ablaufen konnte
  if usable and prev.items then
    for id, old in pairs(prev.items) do
      if not items[id] then
        local st = s.stats[id] or { s = 0, h = 0 }
        s.stats[id] = st
        if st.t and t > st.t then
          local f = 0.5 ^ ((t - st.t) / 86400 / HALF_LIFE)
          st.s, st.h = st.s * f, st.h * f
        end
        local sold, observable = D.Compare(old, { b = {} }, gap)
        st.t, st.q, st.n, st.k, st.p = t, 0, 0, 0, nil
        if observable then
          st.s = st.s + sold
          st.h = st.h + gap / 3600
          measured = measured + 1
          totalSold = totalSold + sold
        end
      end
    end
  end
  if usable and measured > 0 then addHourly(s, prev.t, t, totalSold) end
  s.snap = { t = t, items = items }
  s.scans = (s.scans or 0) + 1
  D.version = (D.version or 0) + 1
  if measured > 0 then s.measured = t end
  return measured
end

----------------------------------------------------------------------------
-- Komplett-Scan mitlesen (Blizzard schickt REPLICATE_ITEM_LIST_UPDATE, wenn die Liste da ist)
----------------------------------------------------------------------------
local reading
function D.ReadReplicate()
  local AH = C_AuctionHouse
  if reading or not (AH and AH.GetNumReplicateItems and AH.GetReplicateItemInfo) then return false end
  if ns.Market and not ns.Market.ahOpen then return false end
  local total = AH.GetNumReplicateItems() or 0
  if total <= 0 then return false end
  reading = true
  local watch = D.Watchlist()
  local snipe = ns.Snipe
  if snipe then snipe.Begin() end
  local items, sellers = {}, {}
  local t = time()
  local index = 0
  local function step()
    if ns.Market and not ns.Market.ahOpen then reading = nil return end -- AH zu: Liste ungültig
    local last = math.min(index + BATCH, total)
    for i = index, last - 1 do
      local ok, _, _, count, _, _, _, _, _, _, buyout, _, _, _, owner, _, _, itemID =
        pcall(AH.GetReplicateItemInfo, i)
      if ok and snipe then snipe.Collect(itemID, count, buyout, owner) end
      if ok and itemID and watch[itemID] and count and count > 0 and buyout and buyout > 0 then
        local unit = math.floor(buyout / count)
        local okT, band = pcall(AH.GetReplicateItemTimeLeft or function() return nil end, i)
        local e = items[itemID]
        if not e then
          e = { q = 0, n = 0, k = 0, b = {} }
          items[itemID] = e
          sellers[itemID] = {}
        end
        e.q, e.n = e.q + count, e.n + 1
        if not e.p or unit < e.p then e.p = unit end
        local who = type(owner) == "string" and owner or ""
        if who ~= "" and not sellers[itemID][who] then sellers[itemID][who] = true e.k = e.k + 1 end
        local key = unit .. "|" .. who
        local bk = e.b[key]
        local left = bandMin(okT and band or nil)
        if not bk then e.b[key] = { q = count, s = left }
        else bk.q = bk.q + count if left < bk.s then bk.s = left end end
      end
    end
    index = last
    if index < total then
      C_Timer.After(0, function() ns.Safe(step) end)
    else
      reading = nil
      local n = D.Ingest(items, t)
      ns.Fire("DEMAND_UPDATED", n)
      if snipe then ns.Safe(snipe.Finish) end
    end
  end
  ns.Safe(step)
  return true
end

ns.On("REPLICATE_ITEM_LIST_UPDATE", function()
  -- kurz warten, bis Blizzard die Liste fertig hat; doppelte Meldungen zusammenfassen
  ns.Debounce("replicate", 2, function() ns.Safe(D.ReadReplicate) end)
end)

----------------------------------------------------------------------------
-- Auswertung
----------------------------------------------------------------------------
-- Deine eigenen verkauften Stück pro Tag (Verkaufsbuch, 14 Tage)
local function ownPerDay(itemID)
  local L = ns.Ledger
  if not (ns.db and ns.db.ledger and L and L.Index) then return nil, 0 end
  local e = L.Index(14)[itemID]
  if not e or e.sold == 0 then return nil, 0 end
  return e.units / 14, e.sold
end

-- Verkäufe pro Tag (Stück). Rückgabe: perDay oder nil, Quelle "markt"|"eigene", Beobachtungsstunden, Angebot
function D.PerDay(itemID)
  local s = store()
  local st = s and s.stats[itemID]
  local market
  if st and st.h and st.h >= 2 then market = st.s / st.h * 24 end
  local own = ownPerDay(itemID)
  local supply = st and st.q
  if market and own then
    if own > market then return own, "eigene", st.h, supply end
    return market, "markt", st.h, supply
  end
  if market then return market, "markt", st.h, supply end
  if own then return own, "eigene", 0, supply end
  return nil, nil, st and st.h or 0, supply
end

local function stackable(itemID) return (ns.Item(itemID).stack or 1) > 1 end

-- Markt-Tiefe: Für wie viele Tage reicht das aktuelle Angebot beim gemessenen Absatz? (nil = unbekannt)
-- Über 14 Tage = "Markt voll": neue Angebote warten lange, Preise werden gedrückt.
function D.DaysOfSupply(itemID)
  local perDay, _, _, supply = D.PerDay(itemID)
  if not supply then return nil end
  if supply == 0 then return 0 end
  if not perDay then return nil end
  if perDay <= 0 then return math.huge end
  return supply / perDay
end

function D.Full(itemID)
  local d = D.DaysOfSupply(itemID)
  return d ~= nil and d > 14
end

-- Kauf-Profil des Marktes nach Uhrzeit: rates[0..23] = Stück pro Beobachtungsstunde, abgedeckte Stunden
function D.HourProfile()
  local s = store()
  local rates, covered = {}, 0
  for h = 0, 23 do
    local b = s and s.hourly and s.hourly[h]
    if b and b.h >= 0.5 then rates[h] = b.s / b.h covered = covered + 1 end
  end
  return rates, covered
end

-- Schwellen: Stapelware (Leder, Tränke, Stoff) verkauft sich in größeren Mengen als Ausrüstung
D.LIMITS = { stack = { fast = 20, ok = 4 }, single = { fast = 2, ok = 0.5 } }

-- Klasse: "fast" (Schnelldreher), "ok" (verkauft sich), "slow" (Ladenhüter), "unknown"
function D.Class(itemID)
  if not itemID then return "unknown" end
  local L = ns.Ledger
  local rate, n
  if L and L.SaleRate then rate, n = L.SaleRate(itemID) end
  if rate and n and n >= 4 and rate < 0.25 then return "slow" end
  local perDay, src, hours = D.PerDay(itemID)
  local lim = stackable(itemID) and D.LIMITS.stack or D.LIMITS.single
  if perDay then
    if perDay >= lim.fast then return "fast" end
    if perDay >= lim.ok then return "ok" end
    -- "langsam" erst nach genug Beobachtung (mind. 12 Stunden Markt) – sonst lieber "unbekannt"
    if src == "markt" and hours >= 12 then
      if rate and n and n >= 4 and rate >= 0.75 then return "ok" end
      return "slow"
    end
  end
  if rate and n and n >= 4 and rate >= 0.75 then return "ok" end
  return "unknown"
end

D.LABEL = {
  fast = { "Schnelldreher", "61eb8f" },
  ok = { "verkauft sich", "4fd1c5" },
  slow = { "Ladenhüter", "ff6b81" },
  unknown = { "Absatz unbekannt", "93a39d" },
}

local function fmt(x)
  if x >= 10 then return tostring(math.floor(x + 0.5)) end
  return (string.format("%.1f", x):gsub("%.", ","))
end

-- Kurztext, z. B. "Schnelldreher · ~35/Tag verkauft · 240 im Angebot"
function D.Text(itemID, plain)
  local c = D.Class(itemID)
  local perDay, src, _, supply = D.PerDay(itemID)
  local parts = {}
  local l = D.LABEL[c]
  parts[1] = plain and l[1] or ("|cff" .. l[2] .. l[1] .. "|r")
  if perDay then
    parts[#parts + 1] = "~" .. fmt(perDay) .. "/Tag verkauft" .. (src == "eigene" and " (deine Verkäufe)" or "")
  end
  if supply then parts[#parts + 1] = supply .. " im Angebot" end
  local days = D.DaysOfSupply(itemID)
  local function color(hex, text) return plain and text or ("|cff" .. hex .. text .. "|r") end
  if days and days > 0 and days < math.huge then
    local txt = "reicht für " .. fmt(days) .. " Tage"
    parts[#parts + 1] = days > 14 and color("ff6b81", txt .. " (Markt voll)") or txt
  elseif days == 0 then
    parts[#parts + 1] = color("61eb8f", "ausverkauft – gute Chance")
  end
  if c == "unknown" and not perDay then parts[#parts + 1] = "2 AH-Scans im Abstand von 15 Min.–12 Std. messen es" end
  return table.concat(parts, " · ")
end

-- Wahrscheinlichkeit, dass ein Angebot verkauft wird (für das Einstellgebühr-Risiko)
local SELL_CHANCE = { fast = 0.85, ok = 0.6, slow = 0.3 }
function D.SellChance(itemID)
  return SELL_CHANCE[D.Class(itemID)]
end

-- Realistischer Gewinn pro Tag: Gewinn pro Stück × (Tagesverkäufe × dein Anteil), mind. 1 Stück am Tag
-- Ohne Messung: nil (Rangfolge dann nach Gewinn pro Craft)
function D.GoldPerDay(itemID, profitPerUnit)
  if not profitPerUnit then return nil end
  local perDay = D.PerDay(itemID)
  if not perDay then return nil end
  local units = math.max(perDay * D.SHARE, math.min(perDay, 1))
  return math.floor(profitPerUnit * units + 0.5)
end

-- Wie viele Stück lohnt es sich herzustellen (nach Markt): Verkäufe von 3 Tagen × dein Anteil
function D.MarketBatch(itemID)
  local perDay = D.PerDay(itemID)
  if not perDay then return nil end
  local units = math.floor(perDay * D.SHARE * 3 + 0.5)
  local cap = stackable(itemID) and 60 or 6
  return math.max(1, math.min(units, cap))
end

-- Status für Anzeige: Wann zuletzt gemessen, wie viele Items haben Messwerte
function D.Status()
  local s = store()
  if not s then return 0, nil end
  local n = 0
  for _, st in pairs(s.stats) do if st.h and st.h >= 2 then n = n + 1 end end
  return n, s.measured, s.scans or 0
end

-- Rangfolge für Craft-Listen (Kleinvieh macht auch Mist):
--   1. was sich oft verkauft (Schnelldreher + verkauft sich) – sortiert nach realistischem Gold pro Tag
--   2. Absatz noch unbekannt – nach Gewinn pro Craft
--   3. Ladenhüter – ganz unten
D.GROUP = { fast = 1, ok = 1, unknown = 2, slow = 3 }

-- Einträge { id = Ergebnis-Item, qty = Stück pro Craft, profit = Gewinn pro Craft } bekommen
-- demand (Klasse), goldDay (Gold pro Tag oder nil) und werden sortiert. Werte einmal berechnen, dann sortieren
-- (stabile, widerspruchsfreie Reihenfolge).
function D.Sort(list)
  for _, e in ipairs(list) do
    e.demand = D.Class(e.id)
    e.goldDay = e.profit and D.GoldPerDay(e.id, e.profit / math.max(e.qty or 1, 1)) or nil
    e.demandGroup = D.GROUP[e.demand] or 2
  end
  table.sort(list, function(a, b)
    if a.demandGroup ~= b.demandGroup then return a.demandGroup < b.demandGroup end
    local ga, gb = a.goldDay or -1e15, b.goldDay or -1e15
    if a.demandGroup == 1 and ga ~= gb then return ga > gb end
    if (a.profit or 0) ~= (b.profit or 0) then return (a.profit or 0) > (b.profit or 0) end
    return (a.id or 0) < (b.id or 0)
  end)
  return list
end
