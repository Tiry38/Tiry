-- Tiry's Zentrale – Herstell-Buch: Was hat Herstellen WIRKLICH gebracht?
-- * Beim Herstellen merkt es sich die echten Materialkosten (Ø deiner AH-Einkäufe der letzten 30 Tage,
--   sonst der günstigere Weg aus Kaufen/Selbst-Herstellen).
-- * Beim Verkauf (Verkaufsbuch = AH-Briefe) wird der echte Erlös dagegen gerechnet.
-- * Empfohlene Menge pro Rezept: so viele, wie sich bei dir in einer Woche verkaufen – minus was schon in
--   Taschen/Bank und im AH liegt.
local _, ns = ...

local CB = {}
ns.CraftBook = CB

local KEEP_DAYS = 60

local function log()
  ns.char.craftLog = ns.char.craftLog or {}
  return ns.char.craftLog
end

----------------------------------------------------------------------------
-- Echte Materialpreise
----------------------------------------------------------------------------
-- Ø-Stückpreis deiner AH-Einkäufe (Verkaufsbuch) der letzten 30 Tage, sonst nil
function CB.PaidUnit(id)
  local b = ns.db and ns.db.ledger
  if not (b and b.buys) then return nil end
  local limit = time() - 30 * 86400
  local money, n = 0, 0
  for _, e in ipairs(b.buys) do
    if e.id == id and e.t >= limit and (e.money or 0) > 0 then
      money, n = money + e.money, n + (e.n or 1)
    end
  end
  if n == 0 then return nil end
  return money / n
end

-- Stückpreis fürs Herstell-Buch: bezahlt (falls bekannt), sonst günstigster Weg
function CB.RealUnit(id)
  return CB.PaidUnit(id) or (ns.Scanner.MatCost(id))
end

function CB.RealCost(r)
  local cost = 0
  for _, re in ipairs(r.reagents) do
    local u = CB.RealUnit(re.id)
    if not u then return nil end
    cost = cost + u * re.n
  end
  return math.floor(cost + 0.5)
end

----------------------------------------------------------------------------
-- Herstellen merken (aus der Craft-Erkennung im Craft-Planer)
----------------------------------------------------------------------------
function CB.Record(r, crafts)
  if not (r and crafts and crafts > 0) then return end
  local cost = CB.RealCost(r)
  local units = crafts * math.max(r.qty or 1, 1)
  local l = log()
  table.insert(l, { t = time(), recipe = r.id, out = r.out, units = units, cost = cost and cost * crafts or nil })
  local limit = time() - KEEP_DAYS * 86400
  while l[1] and l[1].t < limit do table.remove(l, 1) end
  ns.Fire("CRAFTBOOK_CHANGED")
end

-- Ø Herstellkosten pro Stück eines Items (aus allen gemerkten Herstellungen)
function CB.UnitCost(out)
  local cost, units = 0, 0
  for _, e in ipairs(log()) do
    if e.out == out and e.cost then cost, units = cost + e.cost, units + e.units end
  end
  if units == 0 then return nil end
  return cost / units
end

----------------------------------------------------------------------------
-- Auswertung: pro Item hergestellt, verkauft, echter Gewinn
----------------------------------------------------------------------------
function CB.Report(days)
  local limit = time() - (days or 7) * 86400
  local items = {}
  local function get(out)
    items[out] = items[out] or { id = out, made = 0, sold = 0, income = 0, expired = 0 }
    return items[out]
  end
  for _, e in ipairs(log()) do
    if e.t >= limit then local x = get(e.out) x.made = x.made + e.units end
  end
  local crafted = {}
  for _, e in ipairs(log()) do crafted[e.out] = true end
  local b = ns.db and ns.db.ledger
  if b then
    for _, s in ipairs(b.sales or {}) do
      if s.id and crafted[s.id] and s.t >= limit then
        local x = get(s.id)
        x.sold = x.sold + (s.n or 1)
        x.income = x.income + (s.money or 0)
      end
    end
    for _, s in ipairs(b.expired or {}) do
      if s.id and crafted[s.id] and s.t >= limit then get(s.id).expired = get(s.id).expired + 1 end
    end
  end
  local list = {}
  local total = { profit = 0, income = 0, sold = 0, made = 0 }
  for _, x in pairs(items) do
    x.unitCost = CB.UnitCost(x.id)
    if x.sold > 0 and x.unitCost then
      x.profit = math.floor(x.income - x.unitCost * x.sold + 0.5)
      x.perUnit = math.floor(x.profit / x.sold + 0.5)
      total.profit = total.profit + x.profit
    end
    total.income = total.income + x.income
    total.sold = total.sold + x.sold
    total.made = total.made + x.made
    list[#list + 1] = x
  end
  table.sort(list, function(a, c)
    if (a.profit or -1e12) ~= (c.profit or -1e12) then return (a.profit or -1e12) > (c.profit or -1e12) end
    return a.made > c.made
  end)
  total.best = list[1] and list[1].profit and list[1].profit > 0 and list[1] or nil
  return list, total
end

-- Echter Gewinn pro Stück eines Items (30 Tage) – für den Hinweis im Craft-Planer
function CB.RealPerUnit(out)
  local list = CB.Report(30)
  for _, x in ipairs(list) do
    if x.id == out and x.perUnit then return x.perUnit, x.sold end
  end
end

----------------------------------------------------------------------------
-- Empfohlene Menge pro Rezept
----------------------------------------------------------------------------
-- Was liegt schon im Umlauf? Taschen + Bank + eigene laufende Auktionen
function CB.InStock(id)
  local n = (C_Item and C_Item.GetItemCount and C_Item.GetItemCount(id, true)) or 0
  local s = ns.char.auctions
  if s and s.list then
    for _, a in ipairs(s.list) do
      if a.id == id and a.status == "active" and not (a.expires and a.expires < time()) then n = n + (a.qty or 1) end
    end
  end
  return n
end

-- Rückgabe: Anzahl Crafts, Begründung
function CB.Suggest(r)
  local out = r.out
  local qty = math.max(r.qty or 1, 1)
  local stock = CB.InStock(out)
  local b = ns.db and ns.db.ledger
  local soldUnits, sales, expired = 0, 0, 0
  if b then
    local limit = time() - 14 * 86400
    for _, s in ipairs(b.sales or {}) do
      if s.id == out and s.t >= limit then soldUnits, sales = soldUnits + (s.n or 1), sales + 1 end
    end
    for _, s in ipairs(b.expired or {}) do
      if s.id == out and s.t >= limit then expired = expired + 1 end
    end
  end
  local want, why
  if sales + expired >= 2 then
    -- so viele, wie sich bei dir in einer Woche verkaufen
    want = math.ceil(soldUnits / 2)
    if sales / (sales + expired) < 0.5 then want = math.floor(want / 2) end
    why = string.format("verkauft ~%d/Woche", math.ceil(soldUnits / 2))
  else
    -- noch keine Erfahrung: vorsichtig starten
    local stack = (ns.Item(out).stack or 1) > 1
    want = stack and 5 or 2
    why = "noch keine Verkäufe – vorsichtig testen"
  end
  local units = math.max(0, want - stock)
  local crafts = math.min(10, math.ceil(units / qty))
  if crafts == 0 then why = stock > 0 and ("schon " .. stock .. " im Umlauf") or why end
  return crafts, why
end

----------------------------------------------------------------------------
-- Wochenbilanz (Startseite)
----------------------------------------------------------------------------
function CB.WeekLine()
  local _, t = CB.Report(7)
  if t.made == 0 and t.sold == 0 then return nil end
  local parts = {}
  if t.sold > 0 then
    parts[#parts + 1] = (t.profit >= 0 and "|cff61eb8f+" or "|cffff6b81") .. ns.Money(math.abs(t.profit)) .. "|r echt verdient"
    parts[#parts + 1] = t.sold .. " verkauft"
  end
  parts[#parts + 1] = t.made .. " hergestellt"
  if t.best then parts[#parts + 1] = "bestes: " .. (ns.Item(t.best.id).name or "?") end
  return "Diese Woche: " .. table.concat(parts, " · "), t
end

ns.Listen("LEDGER_CHANGED", function() ns.Fire("CRAFTBOOK_CHANGED") end)
