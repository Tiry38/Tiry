-- Tiry's Zentrale – Gold-Ziel: worauf du sparst, wie weit du bist, wann du es schaffst
-- und welche Schritte dich am schnellsten hinbringen (Taschen, Händler, Post, Craft-Liste, beste Farm-Runde).
-- Rechnet nur mit echten Daten: GetMoney, Gold-Tagebuch (Tracker), eigene Auktionen, Taschen-Check, Sessions.
local _, ns = ...
local GZ = {}
ns.Goal = GZ

local GOLD = 10000

-- Vorschläge. Beträge laut Forever-Guides (Stand 11/2026, Quellen in ZENTRALE.md) – Ruf und Patches ändern
-- den Preis, deshalb immer mit Hinweis "am Trainer prüfen" und frei änderbar.
GZ.PRESETS = {
  { key = "ride40", name = "Reiten lernen", level = 40, amount = 100 * GOLD,
    note = "Ab Stufe 40. Laut Guides ca. 100 Gold, mit Ruf „Wohlwollend“ weniger – am Trainer prüfen." },
  { key = "ride60", name = "Schnelles Reiten", level = 60, amount = 1000 * GOLD,
    note = "Ab Stufe 60. Laut Guides ca. 1.000 Gold – am Trainer prüfen." },
  { key = "skills", name = "Klassen-Fähigkeiten", level = 60, amount = 206 * GOLD,
    note = "Alle Fähigkeiten von 1 bis 60 zusammen etwa 206 Gold (Classic-Werte, in Forever nicht bestätigt)." },
  { key = "custom", name = "Eigenes Ziel", amount = 50 * GOLD, note = "Betrag frei wählbar." },
}
local BY_KEY = {}
for _, p in ipairs(GZ.PRESETS) do BY_KEY[p.key] = p end

local MIN_AMOUNT, MAX_AMOUNT = 1 * GOLD, 1000000 * GOLD

local function store()
  return ns.char
end

-- Vorschlag nach Stufe: unter 40 Reiten, unter 60 schnelles Reiten (nur ein Vorschlag, bis du selbst wählst)
function GZ.Suggest(level)
  level = level or (ns.player and ns.player.level) or 1
  if level < 40 then return BY_KEY.ride40 end
  return BY_KEY.ride60
end

-- Aktuelles Ziel: { key, name, amount, note, auto } – auto = Vorschlag (noch nicht selbst gewählt)
function GZ.Get()
  local g = store() and store().goal
  if type(g) == "table" and tonumber(g.amount) and g.amount > 0 then
    local p = BY_KEY[g.key] or BY_KEY.custom
    return { key = g.key or "custom", name = g.name or p.name, amount = math.floor(g.amount), note = p.note,
      level = p.level, set = g.set, reached = g.reached }
  end
  if store() and store().goalOff then return nil end
  local p = GZ.Suggest()
  return { key = p.key, name = p.name, amount = p.amount, note = p.note, level = p.level, auto = true }
end

-- Ziel wählen (Vorschlag übernehmen oder anderen Betrag). amount in Kupfer.
function GZ.Set(key, amount, name)
  local p = BY_KEY[key] or BY_KEY.custom
  amount = math.floor(ns.Clamp(tonumber(amount) or p.amount, MIN_AMOUNT, MAX_AMOUNT))
  local c = store()
  c.goal = { key = p.key, name = name or p.name, amount = amount, set = time() }
  c.goalOff = nil
  ns.Fire("GOAL_CHANGED")
end

-- Nur den Betrag ändern (Vorschlag wird dabei zum eigenen Ziel)
function GZ.SetAmount(amount)
  local g = GZ.Get() or BY_KEY.custom
  GZ.Set(g.key, amount, g.name)
end

-- Nächsten Vorschlag durchschalten (Knopf "Anderes Ziel")
function GZ.Cycle()
  local g = GZ.Get()
  local idx = 1
  for i, p in ipairs(GZ.PRESETS) do
    if g and p.key == g.key then idx = i % #GZ.PRESETS + 1 break end
  end
  local p = GZ.PRESETS[idx]
  GZ.Set(p.key, p.amount)
end

function GZ.Clear()
  local c = store()
  c.goal, c.goalOff = nil, true
  ns.Fire("GOAL_CHANGED")
end

-- Betrag aus Eingabe: "250" = 250 Gold (beim Sparziel denkt man in Gold), sonst wie überall ("1g 20s", "80s")
function GZ.ParseAmount(text)
  text = tostring(text or "")
  if text:match("^%s*[%d%.,]+%s*$") then
    local v = tonumber((text:gsub(",", "."):gsub("%s", "")))
    return v and math.floor(v * GOLD + 0.5) or nil
  end
  return ns.ParseMoney(text)
end

----------------------------------------------------------------------------
-- Stand: Gold in der Tasche + was schon sicher unterwegs ist (Post, laufende Auktionen)
----------------------------------------------------------------------------
-- Rückgabe: { have, mail, auctions, onWay, total, pct, missing, allChars }
function GZ.Status(goal)
  goal = goal or GZ.Get()
  local have = GetMoney() or 0
  local mail, auctions = 0, 0
  local AW = ns.AH
  if AW and AW.Summary then
    local ok, s = pcall(AW.Summary)
    if ok and s then
      mail = (s.mailGold or 0) + (s.onWay or 0)
      -- eigene Auktionen zählen zur Hälfte: nicht alles verkauft sich (ehrlich statt geschönt)
      auctions = math.floor((s.value or 0) * (ns.Market.CutFactor and ns.Market.CutFactor() or 0.95) * 0.5)
    end
  end
  local allChars
  if ns.Inventory and ns.Inventory.Gold then
    local ok, list, total = pcall(ns.Inventory.Gold)
    if ok and type(list) == "table" and #list > 1 then allChars = total end
  end
  local total = have + mail + auctions
  local amount = goal and goal.amount or 0
  local pct = amount > 0 and math.min(1, total / amount) or 0
  return { have = have, mail = mail, auctions = auctions, onWay = mail + auctions, total = total, pct = pct,
    missing = math.max(0, amount - total), missingNow = math.max(0, amount - have), allChars = allChars }
end

-- Tempo: Ø Gewinn pro Tag aus dem Gold-Tagebuch. Nur Tage mit Bewegung zählen (sonst zieht ein
-- Ruhetag den Schnitt runter, obwohl du gar nicht gespielt hast). Mindestens 1 Tag Daten.
function GZ.Rate(days)
  days = days or 7
  local T = ns.Tracker
  if not (T and T.Days and ns.char and ns.char.days) then return nil end
  local sum, n = 0, 0
  for _, d in ipairs(T.Days(days)) do
    if (d.earned or 0) > 0 or (d.spent or 0) > 0 then
      sum, n = sum + d.net, n + 1
    end
  end
  if n == 0 then return nil end
  return sum / n, n
end

-- Prognose in Spieltagen (nil = nicht berechenbar, 0 = schon erreicht)
function GZ.Eta(missing, rate)
  if not missing then return nil end
  if missing <= 0 then return 0 end
  if not rate or rate <= 0 then return nil end
  return math.ceil(missing / rate)
end

----------------------------------------------------------------------------
-- Schneller ans Ziel: konkrete Schritte mit Goldbetrag, beste zuerst
----------------------------------------------------------------------------
-- Rückgabe: Liste { key, title, text, gold, button, page } (gold = was der Schritt etwa bringt)
function GZ.Boosts()
  local out = {}
  local S = ns.Scanner
  -- 1) Post abholen
  local st = GZ.Status()
  if st.mail > 0 then
    out[#out + 1] = { key = "mail", title = "Post abholen", gold = st.mail,
      text = "Gold aus Auktionsverkäufen liegt im Briefkasten bzw. ist unterwegs.", button = "Auktionen", page = "auctions" }
  end
  -- 2) Taschen: was ins AH gehört / was der Händler zahlt
  if S and S.ScanBags then
    -- frischer Taschen-Check (höchstens alle 30 s neu, die Startseite wird oft aktualisiert)
    if time() - (S.bags.time or 0) > 30 then ns.Safe(S.ScanBags) end
    local ah, ahN, junk = 0, 0, S.bags.junkTotal or 0
    for _, e in ipairs(S.bags.items or {}) do
      if e.advice == "AH" and not e.process and not (e.tip and e.tip:find("^Behalten")) then
        ah, ahN = ah + (e.ah or 0), ahN + 1
      end
    end
    if ah > 0 then
      out[#out + 1] = { key = "bags", title = "Taschen ins AH", gold = ah,
        text = string.format("%d %s in deinen Taschen bringen im AH mehr als beim Händler.", ahN, ns.Plural(ahN, "Sorte", "Sorten")),
        button = "Taschen-Check", page = "scanner" }
    end
    local vendor = 0
    if ns.Auto and ns.Auto.VendorCandidates then
      local ok, _, total = pcall(ns.Auto.VendorCandidates)
      if ok then vendor = total or 0 end
    end
    if junk + vendor > 0 then
      out[#out + 1] = { key = "vendor", title = "Beim Händler verkaufen", gold = junk + vendor,
        text = "Grauer Schrott und Waren, die im AH weniger bringen.", button = "Taschen-Check", page = "scanner" }
    end
  end
  -- 3) Craft-Liste: erwarteter Gewinn der geplanten Crafts
  local queue = ns.char and ns.char.queue
  if queue and #queue > 0 and S and S.RecipeProfit then
    local profit = 0
    for _, e in ipairs(queue) do
      local r = ns.Recipes.Get(e.recipe)
      if r then
        local ok, p = pcall(S.RecipeProfit, r)
        if ok and type(p) == "number" and p > 0 then profit = profit + p * (e.n or 1) end
      end
    end
    if profit > 0 then
      out[#out + 1] = { key = "craft", title = "Craft-Liste abarbeiten", gold = profit,
        text = string.format("%d %s auf deiner Liste – erwarteter Gewinn nach AH-Gebühr.", #queue, ns.Plural(#queue, "Rezept", "Rezepte")),
        button = "Craft-Planer", page = "recipes" }
    end
  end
  -- 4) Beste eigene Farm-Runde (Gold pro Stunde)
  local Sess = ns.Session
  if Sess and Sess.Best then
    local ok, best = pcall(Sess.Best)
    if ok and best and best.perHour and best.perHour > 0 then
      out[#out + 1] = { key = "farm", title = "Beste Farm-Runde wiederholen", gold = math.floor(best.perHour), perHour = true,
        text = (best.zone and best.zone ~= "" and ("Deine beste Runde: " .. best.zone .. ".") or "Deine beste Farm-Session bisher.") .. " Wert pro Stunde.",
        button = "Sessions", page = "session" }
    end
  end
  table.sort(out, function(a, b)
    if (a.perHour or false) ~= (b.perHour or false) then return not a.perHour end
    return a.gold > b.gold
  end)
  return out
end

----------------------------------------------------------------------------
-- Ziel erreicht -> einmal melden (pro Ziel)
----------------------------------------------------------------------------
function GZ.Check()
  local c = store()
  if not (c and type(c.goal) == "table") or c.goal.reached then return false end
  local g = GZ.Get()
  if not g or (GetMoney() or 0) < g.amount then return false end
  c.goal.reached = time()
  ns.Print(string.format("|cff39ff6bSparziel erreicht:|r %s – %s in der Tasche. Auf zum Trainer!", g.name, ns.Money(GetMoney())))
  if PlaySound and SOUNDKIT and SOUNDKIT.IG_QUEST_LIST_COMPLETE then
    pcall(PlaySound, SOUNDKIT.IG_QUEST_LIST_COMPLETE)
  elseif PlaySound and SOUNDKIT and SOUNDKIT.AUCTION_WINDOW_OPEN then
    pcall(PlaySound, SOUNDKIT.AUCTION_WINDOW_OPEN)
  end
  ns.Fire("GOAL_CHANGED")
  return true
end

ns.On("PLAYER_MONEY", function() ns.Debounce("goal", 1, function() ns.Safe(GZ.Check) end) end)
ns.Listen("LOGIN", function() ns.Safe(GZ.Check) end)
