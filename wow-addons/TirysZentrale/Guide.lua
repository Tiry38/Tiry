-- Tiry's Zentrale – "Nächster Schritt": genau EINE klare Handlung, die dir jetzt am meisten bringt.
-- Reihenfolge = was ohne die vorherige Sache nicht geht (Preise vor Crafts, Post bevor sie verfällt ...).
local _, ns = ...

local G = {}
ns.Guide = G
local M = ns.Market

-- Rückgabe: { title, text, button, action, icon }
function G.NextStep()
  local UI = ns.UI
  -- 1) Ohne Auctionator keine Preise
  if not M.HasAuctionator() then
    return { title = "Auctionator installieren", icon = "warn",
      text = "Ohne Preise rät man nur. Installiere das kostenlose Addon Auctionator (Version für WoW Forever) und lade neu (/reload).",
      button = "So geht's", action = function() UI.Show("basics") end }
  end
  -- 2) Post mit Gold/Items läuft bald ab
  local exp = ns.char and ns.char.mailExpires
  if exp and exp - time() < 3 * 86400 then
    return { title = "Post abholen", icon = "receipt",
      text = "Im Briefkasten liegt Post mit Gold oder Items, die in weniger als 3 Tagen verfällt. Geh zum nächsten Briefkasten.",
      button = "Verstanden", action = function() ns.char.mailExpires = nil UI.RefreshPage("home") end }
  end
  -- 2b) Gold aus Verkäufen liegt im Briefkasten
  local mailGold, est = 0, false
  if ns.AH then mailGold, est = ns.AH.MailGold() end
  if mailGold and mailGold > 0 then
    return { title = "Gold abholen: " .. (est and "ca. " or "") .. ns.Money(mailGold), icon = "receipt",
      text = "Deine Auktionen haben sich verkauft – das Gold liegt im Briefkasten. Sobald du es abholst, verschwindet dieser Hinweis von selbst.",
      button = "Meine Auktionen", action = function() UI.Show("auctions") end }
  end
  -- 3) Preise fehlen oder sind alt
  local scanAge = ns.db and ns.db.lastScan and (time() - ns.db.lastScan) or nil
  if M.Status() == "empty" or not scanAge or scanAge > 86400 then
    return { title = "Preise holen: AH scannen", icon = "scan",
      text = M.ahOpen and "Das Auktionshaus ist offen – ein Klick, und Tiry's Zentrale rechnet mit den Preisen von heute."
        or "Geh zum Auktionshaus und öffne es. Dann hier auf \"Jetzt scannen\" klicken (oder in Auctionator auf \"Scannen\").",
      button = "Jetzt scannen", action = function() M.StartScan() end }
  end
  -- 4) Preisalarm hat angeschlagen
  if ns.Alerts and ns.Alerts.ActiveCount() > 0 then
    return { title = "Preisalarm: jetzt günstig kaufen", icon = "warn",
      text = ns.Alerts.ActiveCount() .. " Item(s) liegen unter deinem Wunschpreis.",
      button = "Ansehen", action = function() UI.Show("alerts") end }
  end
  -- 4b) Eigene Auktionen unterboten
  local under = ns.AH and ns.AH.Summary().undercut or 0
  if under > 0 then
    return { title = under .. " Auktion" .. (under == 1 and "" or "en") .. " unterboten", icon = "receipt",
      text = "Jemand verkauft günstiger als du. Am schnellsten neu einstellen: Auctionator > Reiter \"Unterboten\".",
      button = "Meine Auktionen", action = function() UI.Show("auctions") end }
  end
  -- 5) Craft-Liste: einkaufen oder craften
  local queue = ns.char and ns.char.queue or {}
  if #queue > 0 then
    local _, open = ns.Shop.List()
    if open > 0 then
      return { kind = "craft", title = "Material kaufen", icon = "cart",
        text = "Deiner Craft-Liste fehlen noch " .. open .. " Materialien. Die Einkaufsliste zeigt genau, was – beim Händler oder im AH.",
        button = "Einkaufsliste öffnen", action = function() ns.Shop.Show() end }
    end
    return { kind = "craft", title = "Jetzt craften", icon = "bolt",
      text = "Alles Material ist da. Öffne den Craft-Planer und klick auf \"Nächstes craften\".",
      button = "Zum Craft-Planer", action = function() UI.Show("recipes") end }
  end
  -- 6) Wertvolles in den Taschen
  ns.Scanner.ScanBags()
  local n, v = 0, 0
  for _, e in ipairs(ns.Scanner.bags.items) do if e.advice == "AH" then n = n + 1 v = v + (e.ah or 0) end end
  if n > 0 and v >= 2000 then
    return { kind = "craft", title = n .. " Items ins AH stellen", icon = "bag",
      text = string.format("In deinen Taschen liegen Items für ca. %s, die im AH mehr bringen als beim Händler.", ns.Money(v)),
      button = "Liste ansehen", action = function() UI.Show("scanner") end }
  end
  -- 7) Lohnende Rezepte
  local rp = UI.pages.recipes
  if #ns.Recipes.MyProfessions() > 0 and rp and rp.frame then
    local saved, count = rp.prof, 0
    for _, key in ipairs(ns.Recipes.MyProfessions()) do
      rp.prof = key
      count = count + #rp.Entries(rp)
    end
    rp.prof = saved
    if count > 0 then
      return { kind = "craft", title = "Craft-Liste erstellen", icon = "flask",
        text = count .. " deiner Rezepte bringen gerade Gold. Ein Klick legt sie in die Liste, die Einkaufsliste macht den Rest.",
        button = "Zum Craft-Planer", action = function() UI.Show("recipes") end }
    end
  end
  -- 8a) Noch kein Herstellungsberuf (Hauptthema: herstellen und verkaufen)
  if #ns.Recipes.MyProfessions() == 0 then
    return { title = "Herstellungsberuf lernen", icon = "flask",
      text = "Mit einem Herstellungsberuf machst du aus billigem Material teure Items. Der Berater zeigt, welcher Beruf gerade am meisten bringt.",
      button = "Was lernen?", action = function() UI.Show("advisor") end }
  end
  -- 8) Noch kein Sammelberuf
  local gathering = ns.HasProf(ns.PROF.SKINNING) or ns.HasProf(ns.PROF.HERBALISM) or ns.HasProf(ns.PROF.MINING)
  if not gathering then
    return { title = "Zwei Sammelberufe lernen", icon = "star",
      text = "Das ist der einfachste Weg zu Gold: Jede Pflanze, jede Ader, jedes Tier wird zu Geld. Der Berater sagt dir, welche gerade am meisten bringen.",
      button = "Berufe-Berater", action = function() UI.Show("advisor") end }
  end
  -- 9) Farmen
  return { kind = "farm", title = "Farm-Runde starten", icon = "pin",
    text = "Alles erledigt! Such dir einen Farm-Spot für dein Level und starte eine Farm-Session – so siehst du dein Gold pro Stunde.",
    button = "Farm-Spots", action = function() UI.Show(ns.HasProf(ns.PROF.SKINNING) and "skinning" or "farm") end }
end

-- Neu in Forever: seltene Materialien und neue Alchemie-Produkte (IDs aus der Forever-Datenbank 1.60.1.70862,
-- Zuordnung zu Berufen laut Wowhead Forever / Forever-Guides). Wert = Live-Preis aus Auctionator.
ns.FOREVER_CHANCES = {
  { id = 249427, prof = "SKINNING", how = "Seltener Fund beim Häuten" },
  { id = 249428, prof = "SKINNING", how = "Seltener Fund beim Häuten (höhere Level) – Preis fiel stark, nicht horten" },
  { id = 249429, prof = "SKINNING", how = "Seltener Fund beim Häuten (Level 60)" },
  { id = 249399, prof = "HERBALISM", how = "Selten an mittleren Kräutern (u. a. Wilddornrose, Beulengras, Königsblut) – Preis gestiegen" },
  { id = 249424, prof = "HERBALISM", how = "Seltener Fund beim Kräutersammeln" },
  { id = 249274, prof = "HERBALISM", how = "Seltener Fund beim Kräutersammeln" },
  { id = 249391, prof = "MINING", how = "Seltener Fund an Kupfer- und Zinnadern" },
  { id = 249425, prof = "MINING", how = "Seltener Fund beim Bergbau" },
  { id = 249426, prof = "MINING", how = "Seltener Fund beim Bergbau" },
  { id = 249409, prof = "ALCHEMY", how = "Neu: stellt die Alchemie her" },
  { id = 249410, prof = "ALCHEMY", how = "Neu: stellt die Alchemie her" },
  { id = 249430, prof = "ALCHEMY", how = "Neu: stellt die Alchemie her" },
}

-- Chancen sortiert: deine Berufe zuerst, dann nach Preis
function G.ForeverChances()
  local list = {}
  for _, c in ipairs(ns.FOREVER_CHANCES) do
    list[#list + 1] = { id = c.id, how = c.how, mine = ns.HasProf(ns.PROF[c.prof]), price = M.Price(c.id) }
  end
  table.sort(list, function(a, b)
    if a.mine ~= b.mine then return a.mine end
    return (a.price or 0) > (b.price or 0)
  end)
  return list
end

----------------------------------------------------------------------------
-- Der Craft-Kreislauf (Hauptthema): Planen -> Einkaufen -> Herstellen -> Verkaufen
----------------------------------------------------------------------------

-- Hergestellte Items in den Taschen, die man verkaufen sollte (Ergebnis eines gelernten Rezepts deiner Berufe)
function G.ReadyToSell()
  local R, S = ns.Recipes, ns.Scanner
  -- Nur was du wirklich hergestellt hast (beim Abhaken gemerkt) + Ergebnisse der Rezepte auf deiner Craft-Liste.
  -- Nichts, was auf der Liste als MATERIAL gebraucht wird (z. B. Leichtes Leder).
  ns.char.craftedOut = ns.char.craftedOut or {}
  local outs, needed = {}, {}
  for _, e in ipairs(ns.char.queue or {}) do
    local r = R.Get(e.recipe)
    if r then
      outs[r.out] = r
      for _, re in ipairs(r.reagents) do needed[re.id] = true end
    end
  end
  for id in pairs(ns.char.craftedOut) do
    if not outs[id] then outs[id] = R.ByOutput(id) end
  end
  for id in pairs(needed) do outs[id] = nil end
  local counts, slots = {}, 0
  if C_Container and C_Container.GetContainerNumSlots then
    for bag = 0, (NUM_TOTAL_EQUIPPED_BAG_SLOTS or NUM_BAG_SLOTS or 4) do
      slots = slots + (C_Container.GetContainerNumSlots(bag) or 0)
      for slot = 1, C_Container.GetContainerNumSlots(bag) or 0 do
        local info = C_Container.GetContainerItemInfo(bag, slot)
        if info and info.itemID and outs[info.itemID] and not info.isBound then
          counts[info.itemID] = (counts[info.itemID] or 0) + (info.stackCount or 1)
        end
      end
    end
  end
  -- Verkauft/aufgebraucht: nicht mehr in der Tasche -> vergessen
  if slots > 0 then -- nur wenn die Taschen schon geladen sind
    for id in pairs(ns.char.craftedOut) do
      if not counts[id] then ns.char.craftedOut[id] = nil end
    end
  end
  local list, value = {}, 0
  for id, n in pairs(counts) do
    local r = outs[id]
    local e = ns.DB.Get(id)
    if not (e and (e.bind == 1 or e.bind == 4)) then
      local price = M.Price(id)
      -- nie unter: dieselbe Rechnung wie beim Neu-Einstellen (Kosten bzw. Händlerpreis nach AH-Gebühr und
      -- Einstellgebühr-Risiko), damit Craft-Planer und Auktionen denselben Preis zeigen
      local floor = ns.AH and ns.AH.Floor and ns.AH.Floor(id)
      if not floor then
        local _, _, cost, unknown = S.RecipeProfit(r)
        floor = (cost and unknown == 0 and r.qty > 0) and math.ceil(cost / r.qty / M.CutFactor()) or nil
        if floor then floor = math.max(floor, M.VendorSell(id)) end
      end
      list[#list + 1] = { id = id, n = n, price = price, floor = floor, below = price and floor and price < floor }
      value = value + (price or 0) * n
    end
  end
  table.sort(list, function(a, b) return (a.price or 0) * a.n > (b.price or 0) * b.n end)
  return list, value
end

-- Alle lohnenden Rezepte aller Berufe (für "Planen" und "Liste für alle Berufe")
function G.Profitable()
  local UI = ns.UI
  local rp = UI and UI.pages and UI.pages.recipes
  if not (rp and rp.Entries) then return {}, 0 end
  local savedProf, savedView = rp.prof, rp.view
  local all, best = {}, 0
  -- leiht sich kurz Beruf/Ansicht des Craft-Planers; bei einem Fehler mittendrin trotzdem zurücksetzen
  pcall(function()
    for _, key in ipairs(ns.Recipes.MyProfessions()) do
      rp.prof, rp.view = key, "known"
      for _, e in ipairs((rp.Entries(rp))) do
        all[#all + 1] = e
        best = math.max(best, e.profit or 0)
      end
    end
  end)
  rp.prof, rp.view = savedProf, savedView
  table.sort(all, function(a, b)
    if a.profit ~= b.profit then return a.profit > b.profit end
    return (a.r and a.r.id or 0) < (b.r and b.r.id or 0)
  end)
  return all, best
end

-- Die vier Schritte mit Zustand: "done" (erledigt), "now" (dran) oder "later"
function G.CraftLoop()
  local UI = ns.UI
  local queue = ns.char and ns.char.queue or {}
  local profitable, best = G.Profitable()
  local _, open, cost = ns.Shop.List()
  local ready = 0
  for _, c in ipairs(ns.Shop.Crafts()) do if c.status == "bereit" then ready = ready + c.n end end
  local sell, sellValue = G.ReadyToSell()
  local sellN = 0
  for _, e in ipairs(sell) do sellN = sellN + e.n end
  local hasProf = #ns.Recipes.MyProfessions() > 0
  local steps = {
    { key = "plan", title = "Planen",
      text = not hasProf and "Lern zuerst einen Herstellungsberuf (z. B. Lederverarbeitung)."
        or (#queue > 0 and string.format("%d Rezepte auf deiner Craft-Liste.", #queue))
        or (#profitable > 0 and string.format("%d Rezepte bringen gerade Gold – bis zu %s pro Stück.", #profitable, ns.Money(best)))
        or "Gerade lohnt sich nichts – einmal im AH scannen hilft oft.",
      button = #queue > 0 and "Ansehen" or "Liste erstellen",
      action = function()
        if #queue > 0 or #profitable == 0 then UI.Show("recipes") else UI.pages.recipes.MakeListAll() end
      end,
      done = #queue > 0 },
    { key = "buy", title = "Einkaufen",
      text = #queue == 0 and "Kommt nach dem Planen."
        or (open > 0 and string.format("%d Materialien fehlen noch, ca. %s.", open, ns.Money(cost)))
        or "Alles Material ist da.",
      button = "Einkaufsliste", action = function() ns.Shop.Show() end,
      done = #queue > 0 and open == 0 },
    { key = "craft", title = "Herstellen",
      text = #queue == 0 and (sellN > 0 and "Alles hergestellt." or "Kommt nach dem Einkaufen.")
        or (ready > 0 and string.format("%d Stück kannst du jetzt herstellen.", ready))
        or "Erst das Material besorgen (oder Post holen).",
      button = "Nächstes craften", action = function() UI.pages.recipes.CraftNext(UI.pages.recipes) end,
      done = #queue == 0 and sellN > 0 },
    { key = "sell", title = "Verkaufen",
      text = sellN > 0 and string.format("%d hergestellte Items in der Tasche, ca. %s im AH.", sellN, ns.Money(sellValue))
        or "Nichts zu verkaufen – stell zuerst etwas her.",
      button = "Verkaufsliste", action = function() UI.Show("recipes") UI.pages.recipes.ScrollToSell() end,
      done = false },
  }
  -- welcher Schritt ist dran?
  local nowSet = false
  for _, st in ipairs(steps) do
    if st.done then st.state = "done"
    elseif not nowSet then st.state, nowSet = "now", true
    else st.state = "later" end
  end
  if sellN > 0 and steps[4].state == "later" then steps[4].state = "now" end
  return steps
end
