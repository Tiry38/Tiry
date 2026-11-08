-- Goldrausch – Rezept-Datenbank (alle Rezepte aus den Forever-Spieldaten) + automatische Erkennung,
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

-- Empfohlene Filter je Level (Logik: niedrige Level = billige Rezepte, darum kleiner Mindestgewinn;
-- der Prozentwert schützt davor, für ein paar Kupfer Material und Zeit zu verbrennen)
R.PRESETS = {
  { max = 19, margin = 30, profit = 1000, why = "Level 1–19: Rezepte kosten nur Silber. 30 % Gewinn und mind. 10 Silber pro Craft lohnen sich schon." },
  { max = 29, margin = 30, profit = 2500, why = "Level 20–29: Materialien werden teurer. 30 % und mind. 25 Silber filtern den Kleinkram raus." },
  { max = 39, margin = 25, profit = 7500, why = "Level 30–39: Mehr Umsatz pro Craft. 25 % und mind. 75 Silber." },
  { max = 49, margin = 25, profit = 20000, why = "Level 40–49: Es geht um Gold. 25 % und mind. 2 Gold pro Craft." },
  { max = 59, margin = 20, profit = 40000, why = "Level 50–59: Teure Materialien – schon 20 % sind viel Gold. Mind. 4 Gold." },
  { max = 99, margin = 20, profit = 80000, why = "Level 60: Endgame-Crafts. 20 % und mind. 8 Gold pro Craft." },
}

function R.Preset(level)
  level = level or ns.player.level
  for _, p in ipairs(R.PRESETS) do
    if level <= p.max then return p end
  end
  return R.PRESETS[#R.PRESETS]
end

-- Filter-Werte: automatisch nach Level, bis der Spieler selbst etwas einstellt
function R.Filter()
  local c = ns.settings.craft
  if c.auto ~= false then
    local p = R.Preset()
    return p.margin, p.profit, true
  end
  return c.minMargin, c.minProfit, false
end
