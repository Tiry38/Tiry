-- Tiry's Zentrale 7 – Rezept-Berater: Welche Rezepte, die du noch NICHT kannst, lohnen sich im AH zu kaufen,
-- weil das Hergestellte Gold bringt? Gewinn je Herstellung = Verkaufswert des Ergebnisses − Materialkosten.
--   Verkaufswert: günstigstes AH-Angebot des Ergebnisses × Menge × (1 − 5 % AH-Anteil), sonst Händler-Verkaufspreis
--                 (der höhere zählt; seelengebundene Ergebnisse nur Händler).
--   Material:     je Zutat das Günstigere aus Händler (unbegrenzter Vorrat, deine Fraktion) und AH, beim AH gerechnet
--                 für A.CRAFTS Herstellungen über die echten Preisstufen (nicht nur das billigste Einzelstück).
--   Rezept:       günstigstes Angebot des Rezept-Items im AH. Rückzahlung = Rezeptpreis / Gewinn je Herstellung.
local _, ns = ...

local A = {}
ns.Advisor = A

A.CRAFTS = 5      -- für so viele Herstellungen wird Material gekauft (Preisstufen im AH)
A.AH_CUT = 0.05   -- Anteil, den das AH beim Verkauf einbehält
A.SOON = 25       -- "bald lernbar": bis so viele Skillpunkte über deinem Stand

-- Stückpreis einer Zutat, Quelle ("vendor"/"ah") und ob das AH genug hat
function A.MatUnit(id, need)
  local vend = ns.db.vendor[id]
  local st = not vend and ns.VENDOR_MATS and ns.VENDOR_MATS[id]
  if st and st[2]:find(ns.Faction(), 1, true) then vend = st[1] end
  local cost, enough = ns.Scan.BuyCost(ns.Scan.Entry(id), need)
  local ah = cost and cost / need
  if vend and (not ah or vend <= ah) then return vend, "vendor", true end
  if ah then return ah, "ah", enough end
  return nil
end

function A.Evaluate(r)
  local e = { r = r }
  local rec = ns.Scan.Entry(r.item)
  e.recipe = rec and rec.p
  e.recipeCount = rec and rec.q or 0
  -- Verkaufswert
  local item = ns.Item(r.out)
  local out = ns.Scan.Entry(r.out)
  local vendorValue = (item.sell or 0) * r.qty
  local ahValue = (item.bind ~= 1 and out and out.p) and math.floor(out.p * r.qty * (1 - A.AH_CUT)) or nil
  if ahValue and ahValue >= vendorValue then e.value, e.valueSrc = ahValue, "ah" else e.value, e.valueSrc = vendorValue, "vendor" end
  e.listed = out and out.q or 0
  e.bop = item.bind == 1
  -- Material
  local cost, mats = 0, {}
  for _, re in ipairs(r.reagents) do
    local unit, src, enough = A.MatUnit(re.id, re.n * A.CRAFTS)
    mats[#mats + 1] = { id = re.id, n = re.n, unit = unit, src = src, thin = enough == false }
    if not unit then e.missing = true else cost = cost + unit * re.n end
  end
  e.mats = mats
  if not e.missing then
    e.cost = math.floor(cost + 0.5)
    e.profit = e.value - e.cost
    if e.recipe and e.profit > 0 then e.payback = math.ceil(e.recipe / e.profit) end
  end
  return e
end

-- opts: prof ("ALL"/"COOKING"/"LEATHERWORKING"), range ("now"/"soon"/"all"), skillOnly (bool)
-- Rückgabe: Liste (bester Gewinn zuerst), Zahlen zum Erklären leerer Listen
function A.List(opts)
  opts = opts or ns.settings
  local out = {}
  local stats = { recipes = 0, known = 0, notInAH = 0, missing = 0, loss = 0, skill = 0, rep = 0, noProf = {} }
  local ranks = {}
  for _, key in ipairs(ns.PROF_ORDER) do
    if opts.prof == "ALL" or opts.prof == key then
      if ns.HasProf(key) then ranks[key] = ns.ProfRank(key) else stats.noProf[#stats.noProf + 1] = key end
    end
  end
  for _, r in ipairs(ns.Craft.Load()) do
    local rank = ranks[r.prof]
    if rank then
      stats.recipes = stats.recipes + 1
      if ns.Craft.IsKnown(r) then
        stats.known = stats.known + 1
      elseif r.rep then
        stats.rep = stats.rep + 1
      elseif not ns.Scan.Entry(r.item) then
        stats.notInAH = stats.notInAH + 1
      else
        local color = ns.Craft.Color(r, rank)
        local learnable = r.learn <= rank
        local inRange = learnable or (opts.range == "soon" and r.learn <= rank + A.SOON) or opts.range == "all"
        if not inRange or (opts.skillOnly and not ns.Craft.SKILLUP[color]) then
          stats.skill = stats.skill + 1
        else
          local e = A.Evaluate(r)
          e.color, e.learnable, e.rank = color, learnable, rank
          if e.missing then stats.missing = stats.missing + 1
          elseif e.profit <= 0 then stats.loss = stats.loss + 1
          else out[#out + 1] = e end
        end
      end
    end
  end
  table.sort(out, function(a, b)
    if a.profit ~= b.profit then return a.profit > b.profit end
    return a.r.id < b.r.id
  end)
  return out, stats
end
