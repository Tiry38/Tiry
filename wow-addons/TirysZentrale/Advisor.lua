-- Tiry's Zentrale – Berufe-Berater
-- 1) Welche zwei Sammelberufe bringen in deinem Levelbereich gerade am meisten Gold? (Live-AH-Preise der Materialien)
-- 2) Skill-Plan für deine Herstellungsberufe: günstigster Weg zum nächsten Skill-Ziel – nur mit Rezepten,
--    die du schon gelernt hast, Kosten nach AH-/Händlerpreisen, Erfolgschance nach den Skill-Farben.
local _, ns = ...

local AD = {}
ns.Advisor = AD
local M = ns.Market
local R = ns.Recipes

local GATHER = {
  { key = "HERBALISM", group = "herb" }, { key = "MINING", group = "ore" }, { key = "SKINNING", group = "leather" },
}

-- Passender Herstellungsberuf zur Klasse (Rüstungsart/Nutzen; allgemeines Spielwissen)
local CLASS_CRAFT = {
  WARRIOR = { "BLACKSMITHING", "Schwere Rüstung und Waffen für dich selbst" },
  PALADIN = { "BLACKSMITHING", "Schwere Rüstung und Waffen für dich selbst" },
  HUNTER = { "LEATHERWORKING", "Leder-/Kettenrüstung für dich, Leder kommt aus der Kürschnerei" },
  SHAMAN = { "LEATHERWORKING", "Leder-/Kettenrüstung für dich, Leder kommt aus der Kürschnerei" },
  ROGUE = { "LEATHERWORKING", "Lederrüstung für dich, Leder kommt aus der Kürschnerei" },
  DRUID = { "LEATHERWORKING", "Lederrüstung für dich, Leder kommt aus der Kürschnerei" },
  MAGE = { "TAILORING", "Stoffrüstung und Taschen – Stoff findest du ohne Beruf" },
  PRIEST = { "TAILORING", "Stoffrüstung und Taschen – Stoff findest du ohne Beruf" },
  WARLOCK = { "TAILORING", "Stoffrüstung und Taschen – Stoff findest du ohne Beruf" },
}

local function band(level)
  for _, b in ipairs(ns.FARM) do
    if level >= b.min and level <= b.max then return b end
  end
  return ns.FARM[#ns.FARM]
end

-- Wert eines vollen Stapels (netto) der 3 wertvollsten Materialien der Gruppe; nil ohne Preise
local function groupValue(ids)
  local vals = {}
  for _, id in ipairs(ids or {}) do
    local p = M.Price(id)
    if p then
      local stack = ns.Item(id).stack or 20
      vals[#vals + 1] = { id = id, stack = M.NetAfterDeposit(id, stack, p) * stack }
    end
  end
  if #vals == 0 then return nil end
  table.sort(vals, function(a, b) return a.stack > b.stack end)
  local sum, n = 0, math.min(#vals, 3)
  for i = 1, n do sum = sum + vals[i].stack end
  return sum / n, vals[1].id
end

-- Rangliste der Sammelberufe für dein Level
function AD.Gathering(level)
  local b = band(level or ns.player.level)
  local out = {}
  for _, g in ipairs(GATHER) do
    local value, best = groupValue(b.groups[g.group])
    out[#out + 1] = { key = g.key, id = ns.PROF[g.key], value = value, best = best, have = ns.HasProf(ns.PROF[g.key]), band = b.key }
  end
  table.sort(out, function(a, b2)
    if (a.value ~= nil) ~= (b2.value ~= nil) then return a.value ~= nil end
    return (a.value or 0) > (b2.value or 0)
  end)
  return out, b
end

function AD.ClassCraft()
  return CLASS_CRAFT[ns.player.class or ""]
end

-- Erfolgschance auf +1 Skill (Classic-Formel: orange 100 %, danach linear bis grau 0 %)
function AD.Chance(r, skill)
  if r.grey > 0 and skill >= r.grey then return 0 end
  if r.yellow <= 0 or skill < r.yellow then return 1 end
  local span = r.grey - r.yellow
  if span <= 0 then return 0 end
  return ns.Clamp((r.grey - skill) / span, 0, 1)
end

local function craftCost(r)
  local cost = 0
  for _, re in ipairs(r.reagents) do
    local unit = ns.Scanner.MatCost(re.id) -- günstigster Weg: kaufen oder (mit eigenem Rezept) selbst herstellen
    if not unit then return nil end
    cost = cost + unit * re.n
  end
  return cost
end

-- Was bringt das Ergebnis im AH zurück? (nur verkäuflich, frischer Preis, kein Ladenhüter) – sonst 0
-- Netto nach AH-Gebühr und Einstellgebühr-Risiko
local function resale(r)
  local e = ns.DB.Get(r.out)
  if e and (e.bind == 1 or e.bind == 4) then return 0 end
  local age = M.Age(r.out)
  local price = M.Price(r.out)
  if not price or not age or age > 3 then return 0 end
  if ns.Demand.Class(r.out) == "slow" then return 0 end
  return math.max(0, math.floor(M.NetAfterDeposit(r.out, nil, price) * math.max(r.qty or 1, 1)))
end
AD.Resale = resale

-- Skill-Plan: von deinem Skill bis zum Ziel (Standard +25, höchstens bis zum Maximum)
-- Rückgabe: steps { recipe, from, to, crafts, cost }, mats { [id] = n }, total, reached
function AD.Plan(profKey, steps)
  local skillID = ns.PROF[profKey]
  local p = skillID and ns.professions[skillID]
  if not p then return nil, "Diesen Beruf hast du nicht gelernt." end
  local start = p.rank or 0
  local target = math.min(start + (steps or 25), (p.maxRank and p.maxRank > 0) and p.maxRank or start + (steps or 25))
  if target <= start then return nil, "Du bist am Maximum – beim Lehrer die nächste Stufe lernen." end
  local known = R.List(profKey, "known")
  -- Skillen mit Gewinn: gezählt wird, was ein Craft NETTO kostet (Material minus AH-Verkauf des Ergebnisses).
  -- So gewinnen Rezepte, die beim Skillen sogar Gold bringen.
  local costs, nets = {}, {}
  for _, r in ipairs(known) do
    costs[r] = craftCost(r)
    if costs[r] then nets[r] = costs[r] - resale(r) end
  end
  local plan, mats, total, netTotal = {}, {}, 0, 0
  local skill = start
  while skill < target do
    local best, bestPer, bestCrafts
    for _, r in ipairs(known) do
      local c = nets[r]
      local chance = AD.Chance(r, skill)
      if c and chance >= 0.2 then -- unter 20 % ist zu teuer/unsicher
        local crafts = 1 / chance
        local per = c * crafts
        if not best or per < bestPer then best, bestPer, bestCrafts = r, per, crafts end
      end
    end
    if not best then break end
    local last = plan[#plan]
    if last and last.recipe == best then
      last.to = skill + 1
      last.exp = last.exp + bestCrafts
    else
      plan[#plan + 1] = { recipe = best, from = skill, to = skill + 1, exp = bestCrafts }
    end
    skill = skill + 1
  end
  for _, s in ipairs(plan) do
    s.crafts = math.ceil(s.exp - 0.001)
    s.cost = costs[s.recipe] * s.crafts
    s.net = nets[s.recipe] * s.crafts -- negativ = du verdienst beim Skillen
    total = total + s.cost
    netTotal = netTotal + s.net
    for _, re in ipairs(s.recipe.reagents) do mats[re.id] = (mats[re.id] or 0) + re.n * s.crafts end
  end
  return { steps = plan, mats = mats, total = total, net = netTotal, start = start, reached = skill, target = target }
end

-- Plan in die Craft-Liste übernehmen (dann zeigt die Einkaufsliste das Material)
function AD.ToQueue(plan)
  if not plan or #plan.steps == 0 then return 0 end
  ns.char.queue = ns.char.queue or {}
  local q = ns.char.queue
  for _, s in ipairs(plan.steps) do
    local found
    for _, e in ipairs(q) do if e.recipe == s.recipe.id then found = e end end
    if found then found.n = found.n + s.crafts else q[#q + 1] = { recipe = s.recipe.id, prof = s.recipe.prof, n = s.crafts } end
  end
  return #plan.steps
end

-- Rezept-Tipps für DEINE Berufe und DEINEN Skill: Rezepte, die du noch nicht kannst, jetzt (oder in bis zu
-- 10 Skillpunkten) lernen kannst und die sich lohnen: Mindestgewinn pro Craft, frischer Preis (max. 3 Tage),
-- kein Ladenhüter, Rezept nach höchstens 30 Crafts bezahlt. Jetzt lernbare zuerst.
function AD.RecipeTips(limit)
  local _, minProfit = R.Filter()
  local out = {}
  for _, key in ipairs(R.MyProfessions()) do
    local list, rank = R.List(key, "learnable")
    for _, r in ipairs(list) do
      local profit, revenue, _, unknown = ns.Scanner.RecipeProfit(r)
      local e = ns.DB.Get(r.out)
      local bound = e and (e.bind == 1 or e.bind == 4)
      local age = M.Age(r.out)
      local slow = ns.Demand.Class(r.out) == "slow"
      if profit and revenue and unknown == 0 and not bound and not slow and age and age <= 3
          and profit >= math.max(minProfit, 1) then
        local item, price, payback = R.Payback(r, profit)
        if not payback or payback <= 30 then -- Rezept muss sich in höchstens 30 Crafts bezahlt machen
          local state, req, exact = R.LearnState(r, rank)
          local d = R.Difficulty(r, rank)
          out[#out + 1] = { r = r, id = r.out, qty = r.qty, profit = profit, item = item, price = price, payback = payback,
            skillUp = d ~= nil and d <= 1, prof = key, state = state or "now", req = req, exact = exact,
            learnText = R.LearnText(r, rank) }
        end
      end
    end
  end
  local ORDER = { now = 1, soon = 2, maybe = 3 }
  -- Jetzt lernbar zuerst; dann was sich oft verkauft und am Tag am meisten bringt (Kleinvieh macht auch Mist)
  ns.Demand.Sort(out)
  for i, e in ipairs(out) do e.pos = i end
  table.sort(out, function(a, b)
    if ORDER[a.state] ~= ORDER[b.state] then return ORDER[a.state] < ORDER[b.state] end
    return a.pos < b.pos
  end)
  while #out > (limit or 8) do table.remove(out) end
  return out
end
