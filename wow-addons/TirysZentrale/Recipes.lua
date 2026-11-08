-- Tiry's Zentrale – Rezept-Datenbank (alle Rezepte aus den Forever-Spieldaten) + automatische Erkennung,
-- was du gelernt hast (C_SpellBook.IsSpellKnown) und wie dein Skill dazu steht.
local ADDON, ns = ...

local R = {}
ns.Recipes = R

local byProf, bySpell

function R.Load()
  if byProf then return byProf end
  byProf, bySpell = {}, {}
  for prof, spell, name, out, qty, minSkill, yellow, grey, mats in
      (ns.RECIPES_RAW or ""):gmatch("(%u[%u_]*)\t(%d+)\t([^\t]+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t([^\n]+)") do
    local reagents = {}
    for id, n in mats:gmatch("(%d+)x(%d+)") do
      reagents[#reagents + 1] = { id = tonumber(id), n = tonumber(n) }
    end
    local r = {
      id = tonumber(spell), name = name, out = tonumber(out), qty = tonumber(qty),
      minSkill = tonumber(minSkill), yellow = tonumber(yellow), grey = tonumber(grey), reagents = reagents, prof = prof,
    }
    byProf[prof] = byProf[prof] or {}
    table.insert(byProf[prof], r)
    bySpell[r.id] = r
  end
  ns.RECIPES_RAW = nil
  return byProf
end

function R.Get(spellID)
  R.Load()
  return bySpell[spellID]
end

-- Schlüssel (z. B. "LEATHERWORKING") aus der Skill-ID
function R.ProfKey(skillID)
  for key, id in pairs(ns.PROF) do
    if id == skillID then return key end
  end
end

-- Gelernt? Zuerst der Client (Zauberbuch), sonst der letzte Scan des Berufsfensters
function R.IsKnown(r)
  if C_SpellBook and C_SpellBook.IsSpellKnown then
    local ok, known = pcall(C_SpellBook.IsSpellKnown, r.id)
    if ok and known then return true end
  end
  local scanned = ns.char and ns.char.learned
  return scanned and scanned[r.id] == true or false
end

-- Skill-Farbe wie im Spiel: 0 orange, 1 gelb, 2 grün, 3 grau
function R.Difficulty(r, rank)
  if not rank then return nil end
  if r.grey > 0 and rank >= r.grey then return 3 end
  if r.yellow > 0 then
    local mid = math.floor((r.yellow + r.grey) / 2)
    if rank >= mid then return 2 end
    if rank >= r.yellow then return 1 end
  end
  return 0
end

-- Rezeptliste eines Berufs mit Status für den Spieler
-- mode: "known" (gelernt) oder "learnable" (noch nicht gelernt, aber für deinen Skill in Reichweite)
function R.List(profKey, mode)
  R.Load()
  local skillID = ns.PROF[profKey]
  local rank = skillID and ns.ProfRank(skillID) or 0
  local out = {}
  for _, r in ipairs(byProf[profKey] or {}) do
    local known = R.IsKnown(r)
    if mode == "known" and known then
      out[#out + 1] = r
    elseif mode == "learnable" and not known then
      -- In Reichweite: noch nicht grau und höchstens ~40 Punkte über deinem Skill
      local reach = (r.yellow > 0 and r.yellow or r.minSkill) - 15
      if rank > 0 and reach <= rank + 40 and (r.grey == 0 or r.grey > rank) then
        out[#out + 1] = r
      end
    end
  end
  return out, rank
end

-- Herstellende Berufe des Spielers (Schlüssel)
local CRAFTING = { "ALCHEMY", "BLACKSMITHING", "ENCHANTING", "ENGINEERING", "LEATHERWORKING", "TAILORING", "COOKING", "FIRST_AID", "MINING" }
function R.MyProfessions()
  local list = {}
  for _, key in ipairs(CRAFTING) do
    if ns.HasProf(ns.PROF[key]) then list[#list + 1] = key end
  end
  return list
end

-- Neues Rezept gelernt -> sofort melden, ob es Gold bringt
ns.On("NEW_RECIPE_LEARNED", function(_, recipeID)
  local r = recipeID and R.Get(recipeID)
  ns.Fire("PROFESSIONS_CHANGED")
  if not r then return end
  local profit = ns.Scanner.RecipeProfit(r)
  if profit then
    ns.Print(string.format("Neues Rezept: |cffffd24a%s|r – Gewinn pro Craft laut AH: %s", r.name,
      (profit >= 0 and "|cff61eb8f+" or "|cffff6b81") .. ns.Money(profit) .. "|r"))
  end
end)

-- Beim Öffnen des Berufsfensters: gelernte Rezepte merken (Rückfall, falls der Client einen Zauber nicht meldet)
ns.Listen("RECIPES_SCANNED", function()
  if not (C_TradeSkillUI and C_TradeSkillUI.GetRecipeInfo) then return end
  ns.char.learned = ns.char.learned or {}
  for _, data in pairs(ns.char.recipes or {}) do
    for _, r in ipairs(data.list) do
      if r.learned then ns.char.learned[r.id] = true end
    end
  end
end)

-- Empfohlene Filter: wachsen mit JEDEM Level stufenlos mit.
-- Logik: Auf niedrigem Level kosten Rezepte nur Silber -> kleiner Mindestgewinn, dafür hoher Prozentwert
-- (sonst verbrennst du Material für ein paar Kupfer). Später geht es um Gold -> Mindestgewinn steigt,
-- Prozent darf sinken. Ankerpunkte, dazwischen wird pro Level gleitend gerechnet:
R.ANCHORS = {
  { level = 10, margin = 30, profit = 1000 },   -- 10 Silber
  { level = 20, margin = 30, profit = 2500 },   -- 25 Silber
  { level = 30, margin = 25, profit = 7500 },   -- 75 Silber
  { level = 40, margin = 25, profit = 20000 },  -- 2 Gold
  { level = 50, margin = 20, profit = 40000 },  -- 4 Gold
  { level = 60, margin = 20, profit = 80000 },  -- 8 Gold
}

local function niceCopper(c)
  if c < 10000 then return math.floor(c / 100 + 0.5) * 100 end        -- auf Silber
  if c < 100000 then return math.floor(c / 1000 + 0.5) * 1000 end     -- auf 10 Silber
  return math.floor(c / 10000 + 0.5) * 10000                          -- auf Gold
end

function R.Preset(level)
  level = ns.Clamp(level or ns.player.level or 1, R.ANCHORS[1].level, R.ANCHORS[#R.ANCHORS].level)
  for i = 1, #R.ANCHORS - 1 do
    local a, b = R.ANCHORS[i], R.ANCHORS[i + 1]
    if level <= b.level then
      local t = (level - a.level) / (b.level - a.level)
      return {
        margin = math.floor(a.margin + (b.margin - a.margin) * t + 0.5),
        profit = niceCopper(a.profit + (b.profit - a.profit) * t),
        level = level,
      }
    end
  end
  local last = R.ANCHORS[#R.ANCHORS]
  return { margin = last.margin, profit = last.profit, level = level }
end

-- Dein Stil: Faktor auf die Empfehlung (1 = Empfehlung). Wächst mit jedem Level mit.
local function style()
  local c = ns.settings.craft
  c.marginFactor = tonumber(c.marginFactor) or 1
  c.profitFactor = tonumber(c.profitFactor) or 1
  return c
end

function R.Filter()
  local p, c = R.Preset(), style()
  local margin = math.floor(p.margin * c.marginFactor + 0.5)
  local profit = niceCopper(p.profit * c.profitFactor)
  return margin, profit, (c.marginFactor == 1 and c.profitFactor == 1)
end

function R.SetMargin(v)
  local p = R.Preset()
  style().marginFactor = (p.margin > 0) and ns.Clamp(v / p.margin, 0, 20) or 1
end

function R.SetProfit(v)
  local p = R.Preset()
  style().profitFactor = (p.profit > 0) and ns.Clamp(v / p.profit, 0, 50) or 1
end

function R.ResetStyle()
  local c = style()
  c.marginFactor, c.profitFactor = 1, 1
end

-- Text "Dein Stil": wie weit du von der Empfehlung abweichst
function R.StyleText()
  local c = style()
  local function pct(f)
    local d = math.floor((f - 1) * 100 + 0.5)
    if d == 0 then return "wie empfohlen" end
    return (d > 0 and ("+" .. d .. " % strenger") or (d .. " % lockerer"))
  end
  return "Prozent " .. pct(c.marginFactor) .. ", Gold " .. pct(c.profitFactor)
end

-- Teure Items brauchen weniger Prozent: ab dem 5-fachen Mindestgewinn als Erlös sinkt die Hürde, höchstens auf die Hälfte
function R.RequiredMargin(margin, minProfit, revenue)
  if not revenue or revenue <= 0 or minProfit <= 0 then return margin end
  local scale = math.sqrt((minProfit * 5) / revenue)
  return margin * ns.Clamp(scale, 0.5, 1)
end

-- Levelaufstieg: Filter wachsen automatisch mit -> kurz Bescheid sagen
ns.Listen("PLAYER_CHANGED", function()
  if not ns.settings then return end
  local m, p = R.Filter()
  ns.Print(string.format("Level %d! Deine Craft-Filter sind mitgewachsen: mind. |cffffd24a%d %%|r und |cffffd24a%s|r Gewinn pro Craft.",
    ns.player.level, m, ns.Money(p)))
end)
