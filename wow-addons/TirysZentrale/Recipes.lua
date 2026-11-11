-- Tiry's Zentrale – Rezept-Datenbank (alle Rezepte aus den Forever-Spieldaten) + automatische Erkennung,
-- was du gelernt hast (C_SpellBook.IsSpellKnown) und wie dein Skill dazu steht.
local _, ns = ...

local R = {}
ns.Recipes = R

local byProf, bySpell, byOut, dupOut -- dupOut[item] = alle Rezepte, wenn mehrere Berufe dasselbe Item herstellen

function R.Load()
  if byProf then return byProf end
  byProf, bySpell, byOut, dupOut = {}, {}, {}, {}
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
    -- Blizzard-Hotfixes (serverseitig, nicht in den Spieldaten-Dateien) darüberlegen
    local hf = ns.HOTFIX and ns.HOTFIX.recipes and ns.HOTFIX.recipes[r.id]
    if hf then
      r.yellow, r.grey, r.learn = hf.yellow or r.yellow, hf.grey or r.grey, hf.learn
    end
    local y = ns.RECIPE_YIELD and ns.RECIPE_YIELD[r.id]
    if y then r.yieldLo, r.yieldHi = y[1], y[2] end
    byProf[prof] = byProf[prof] or {}
    table.insert(byProf[prof], r)
    bySpell[r.id] = r
    if not byOut[r.out] then
      byOut[r.out] = r
    else
      dupOut[r.out] = dupOut[r.out] or { byOut[r.out] }
      table.insert(dupOut[r.out], r)
    end
  end
  ns.RECIPES_RAW = nil
  return byProf
end

function R.Get(spellID)
  R.Load()
  return bySpell[spellID]
end

-- Rezept über das Ergebnis-Item finden (Berufsfenster-Nummern können von den Zauber-Nummern abweichen)
function R.ByOutput(itemID, profKey)
  R.Load()
  if not profKey then
    -- Index statt Volllauf (Tooltip, Rezept-Scan). Gibt es das Item in zwei Berufen (Goldbarren: Bergbau und
    -- Alchemie), zählt das Rezept, das du kannst – sonst das deines Berufs, sonst das erste.
    local dup = dupOut[itemID]
    if dup then
      for _, r in ipairs(dup) do if R.IsKnown(r) then return r end end
      for _, r in ipairs(dup) do if ns.HasProf(ns.PROF[r.prof]) then return r end end
    end
    return byOut[itemID]
  end
  for key, list in pairs(byProf) do
    if not profKey or key == profKey then
      for _, r in ipairs(list) do
        if r.out == itemID then return r end
      end
    end
  end
end

-- Nummer aus dem Berufsfenster -> unser Rezept (über das Ergebnis-Item)
-- Gleiches Ergebnis-Item in zwei Berufen (z. B. Goldbarren: Verhütten im Bergbau und Transmutation in der Alchemie):
-- erst die Zauber-Nummer mit passendem Ergebnis, dann der Beruf des offenen Berufsfensters, erst zuletzt irgendeiner.
function R.Match(recipeID, outputItemID, profKey)
  local r = recipeID and R.Get(recipeID)
  if r and r.out == outputItemID then return r end
  profKey = profKey or (ns.Scanner and ns.Scanner.openProfKey and ns.Scanner.openProfKey())
  return (profKey and R.ByOutput(outputItemID, profKey)) or R.ByOutput(outputItemID)
end

function R.FromLive(recipeID)
  if not (C_TradeSkillUI and C_TradeSkillUI.GetRecipeSchematic) then return nil end
  local ok, s = pcall(C_TradeSkillUI.GetRecipeSchematic, recipeID, false)
  if ok and s and s.outputItemID then return R.Match(recipeID, s.outputItemID) end
  return nil
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

-- Rezept-Item zum Kaufen (Muster, Pläne, Formel ...) – nil = lernt man beim Lehrer
function R.RecipeItem(r)
  local e = r and ns.RECIPE_ITEMS and ns.RECIPE_ITEMS[r.id]
  return e and e[1]
end

-- Braucht das Rezept Ruf bei einer Fraktion? (aus den Spieldaten: MinFactionID des Rezept-Items)
function R.NeedsRep(r)
  local e = ns.RECIPE_ITEMS and ns.RECIPE_ITEMS[r.id]
  return e and e[3] == 1 or false
end

-- Ab welchem Berufsskill lernbar? Rückgabe: Skill, exakt (true = aus dem Rezept-Item in den Spieldaten)
-- Lehrer-Rezepte: nicht in den Spieldaten -> Schätzung "gelb minus 20" (Median bei den 1.495 kaufbaren Rezepten)
R.TRAINER_GAP = 20
function R.LearnSkill(r)
  if r.learn then return r.learn, true end -- per Hotfix geändert
  local e = ns.RECIPE_ITEMS and ns.RECIPE_ITEMS[r.id]
  if e and e[2] and e[2] > 0 then return e[2], true end
  if r.yellow and r.yellow > 0 then return math.max(1, r.yellow - R.TRAINER_GAP), false end
  return r.minSkill or 1, false
end

-- Kann ich das Rezept jetzt lernen? "now" (sicher), "soon" (bis 10 Punkte fehlen) oder nil
function R.LearnState(r, rank)
  if not rank or rank <= 0 then return nil end
  if r.grey > 0 and rank >= r.grey then return nil end -- bringt keinen Skill mehr; Gold zählt trotzdem -> unten
  local req, exact = R.LearnSkill(r)
  if exact then
    if req <= rank then return "now", req, true end
    if req <= rank + 10 then return "soon", req, true end
    return nil
  end
  -- Lehrer: sicher, wenn das Rezept für dich schon gelb ist (Lernstufe liegt immer darunter)
  if r.yellow > 0 and r.yellow <= rank then return "now", req, false end
  if req <= rank then return "maybe", req, false end
  return nil
end

-- Rezept-Item: Herkunft und Bindung. src: "v" Händler, "d" Beute, "q" Quest (QuestieDB Forever), nil = unbekannt.
-- bop = seelengebunden beim Aufheben -> gibt es nie im AH (in Forever 798 von 1.496 Rezept-Items)
R.SRC_TEXT = { v = "beim Händler", d = "als Beute", q = "aus einer Quest" }
function R.ItemInfo(r)
  local item = R.RecipeItem(r)
  if not item then return nil end
  local db = ns.DB and ns.DB.Get and ns.DB.Get(item)
  return { item = item, src = ns.RECIPE_ITEM_SRC and ns.RECIPE_ITEM_SRC[item], bop = (db and db.bind == 1) or false }
end

-- Kurztext für seelengebundene Rezept-Items ("nur selbst finden – beim Händler"), nil wenn handelbar
function R.BopText(r)
  local info = R.ItemInfo(r)
  if not (info and info.bop) then return nil end
  return "Rezept nur selbst holen" .. (info.src and (" – " .. R.SRC_TEXT[info.src]) or "") .. " (seelengebunden, nicht im AH)"
end

-- Station (Amboss, Gerbrahmen …): { id, name, kind = "town"|"camp"|"place", kit = Bausatz-Rezept, canBuild }
function R.Station(r)
  local id = r and ns.RECIPE_STATION and ns.RECIPE_STATION[r.id]
  local s = id and ns.STATIONS and ns.STATIONS[id]
  if not s then return nil end
  local kit = s[3] and R.Get(s[3])
  return { id = id, name = s[1], kind = s[2], kit = kit, canBuild = (kit and R.IsKnown(kit)) or false }
end

-- Kurztext für Listen (nil bei Amboss/Schmiede/Kochstelle – die stehen in jeder Stadt)
function R.StationText(r)
  local s = R.Station(r)
  if not s or s.kind == "town" then return nil end
  if s.kind == "camp" then
    if s.canBuild then return "braucht " .. s.name .. " (stellst du selbst am Lagerfeuer auf)" end
    return "|cffff9929braucht " .. s.name .. "|r (Lager-Station am Lagerfeuer" .. (s.kit and (", Bauplan „" .. s.kit.name .. "“") or "") .. ")"
  end
  return "|cffff9929nur an: " .. s.name .. "|r"
end

-- Menge als Text: "3" bzw. "1–3" bei Zufallsmengen (Rechnung nutzt den Mittelwert r.qty)
function R.QtyText(r)
  if r.yieldLo then return r.yieldLo .. "–" .. r.yieldHi end
  return tostring(r.qty)
end

-- Lohnt sich das Rezept? Rückgabe: Rezept-Item, Preis im AH (oder nil), Crafts bis es bezahlt ist (oder nil)
function R.Payback(r, profitPerCraft)
  local item = R.RecipeItem(r)
  local info = item and R.ItemInfo(r)
  if info and info.bop then return item, nil, nil end -- seelengebunden: kein AH-Preis möglich
  local price = item and ns.Market.Price(item)
  local crafts = (price and profitPerCraft and profitPerCraft > 0) and math.ceil(price / profitPerCraft) or nil
  return item, price, crafts
end

-- Text: wann lernbar
function R.LearnText(r, rank)
  local state, req, exact = R.LearnState(r, rank)
  if not state then
    local q, ex = R.LearnSkill(r)
    if ex and q <= (rank or 0) then return "|cff61eb8fjetzt lernbar|r" end
    return nil
  end
  if state == "now" then return "|cff61eb8fjetzt lernbar|r" .. (exact and (" (ab Skill " .. req .. ")") or "") end
  if state == "soon" then return "|cffff9929ab Skill " .. req .. "|r (noch " .. (req - rank) .. " Punkte)" end
  return "|cffff9929Lehrer: ab ca. Skill " .. req .. "|r"
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
    elseif mode == "learnable" and not known and not R.NeedsRep(r) then -- Ruf-Rezepte erstmal komplett draußen
      -- Für DEINEN Skill: kaufbare Rezepte mit exakter Anforderung (jetzt oder in bis zu 10 Punkten),
      -- Lehrer-Rezepte nur, wenn sie für dich schon gelb sind oder die Schätzung passt
      local state = R.LearnState(r, rank)
      if not state and rank > 0 and r.grey > 0 and rank >= r.grey then
        local req, exact = R.LearnSkill(r)
        if exact and req <= rank then state = "now" end -- grau, aber lernbar: bringt Gold, nur keinen Skill
      end
      if state then out[#out + 1] = r end
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
  local r = recipeID and (R.FromLive(recipeID) or R.Get(recipeID))
  ns.Fire("PROFESSIONS_CHANGED")
  if not r then return end
  local profit = ns.Scanner.RecipeProfit(r)
  if profit then
    ns.Print(string.format("Neues Rezept: |cffff9929%s|r – Gewinn pro Craft laut AH: %s", r.name,
      (profit >= 0 and "|cffff9929+" or "|cffff6b81") .. ns.Money(profit) .. "|r"))
  end
  -- Preis fehlt oder ist alt? Beim nächsten AH-Besuch sofort scannen (nicht erst nach 30 Min.)
  local age = ns.Market.Age(r.out)
  if not profit or not age or age > 3 then
    ns.db.lastAutoCheck = nil
    ns.Print("Für " .. r.name .. " fehlt ein aktueller AH-Preis – beim nächsten Öffnen des Auktionshauses wird automatisch gescannt, dann steht es im Craft-Planer.")
  end
end)

-- Beim Öffnen des Berufsfensters: gelernte Rezepte merken (Rückfall, falls der Client einen Zauber nicht meldet)
ns.Listen("RECIPES_SCANNED", function()
  if not (C_TradeSkillUI and C_TradeSkillUI.GetRecipeInfo) then return end
  ns.char.learned = ns.char.learned or {}
  for profName, data in pairs(ns.char.recipes or {}) do
    -- Beruf dieses Fensters (über den Namen), damit Goldbarren nicht als Alchemie-Transmutation zählt
    local key
    for k, id in pairs(ns.PROF) do
      local p = ns.professions[id]
      if p and p.name == profName then key = k end
    end
    for _, r in ipairs(data.list) do
      if r.learned then
        local own = R.Match(r.id, r.out, key or "?")
        ns.char.learned[own and own.id or r.id] = true
      end
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

function R.SetProfit(v)
  local p = R.Preset()
  style().profitFactor = (p.profit > 0) and ns.Clamp(v / p.profit, 0, 50) or 1
end

function R.ResetStyle()
  local c = style()
  c.marginFactor, c.profitFactor = 1, 1
end

-- Levelaufstieg: Filter wachsen automatisch mit -> kurz Bescheid sagen
ns.Listen("PLAYER_CHANGED", function()
  if not ns.settings then return end
  local _, p = R.Filter()
  ns.Print(string.format("Level %d! Dein Mindestgewinn im Craft-Planer ist mitgewachsen: |cffff9929%s|r pro Craft.",
    ns.player.level, ns.Money(p)))
end)
