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
      return { title = "Material kaufen", icon = "cart",
        text = "Deiner Craft-Liste fehlen noch " .. open .. " Materialien. Die Einkaufsliste zeigt genau, was – beim Händler oder im AH.",
        button = "Einkaufsliste öffnen", action = function() ns.Shop.Show() end }
    end
    return { title = "Jetzt craften", icon = "bolt",
      text = "Alles Material ist da. Öffne den Craft-Planer und klick auf \"Nächstes craften\".",
      button = "Zum Craft-Planer", action = function() UI.Show("recipes") end }
  end
  -- 6) Wertvolles in den Taschen
  ns.Scanner.ScanBags()
  local n, v = 0, 0
  for _, e in ipairs(ns.Scanner.bags.items) do if e.advice == "AH" then n = n + 1 v = v + (e.ah or 0) end end
  if n > 0 and v >= 2000 then
    return { title = n .. " Items ins AH stellen", icon = "bag",
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
      return { title = "Craft-Liste erstellen", icon = "flask",
        text = count .. " deiner Rezepte bringen gerade Gold. Ein Klick legt sie in die Liste, die Einkaufsliste macht den Rest.",
        button = "Zum Craft-Planer", action = function() UI.Show("recipes") end }
    end
  end
  -- 8) Noch kein Sammelberuf
  local gathering = ns.HasProf(ns.PROF.SKINNING) or ns.HasProf(ns.PROF.HERBALISM) or ns.HasProf(ns.PROF.MINING)
  if not gathering then
    return { title = "Zwei Sammelberufe lernen", icon = "star",
      text = "Das ist der einfachste Weg zu Gold: Jede Pflanze, jede Ader, jedes Tier wird zu Geld. Der Berater sagt dir, welche gerade am meisten bringen.",
      button = "Berufe-Berater", action = function() UI.Show("advisor") end }
  end
  -- 9) Farmen
  return { title = "Farm-Runde starten", icon = "pin",
    text = "Alles erledigt! Such dir einen Farm-Spot für dein Level und starte eine Farm-Session – so siehst du dein Gold pro Stunde.",
    button = "Farm-Spots", action = function() UI.Show(ns.HasProf(ns.PROF.SKINNING) and "skinning" or "farm") end }
end

-- Neu in Forever: seltene Materialien und neue Alchemie-Produkte (IDs aus der Forever-Datenbank 1.60.1.70862,
-- Zuordnung zu Berufen laut Wowhead Forever / Forever-Guides). Wert = Live-Preis aus Auctionator.
ns.FOREVER_CHANCES = {
  { id = 249427, prof = "SKINNING", how = "Seltener Fund beim Häuten" },
  { id = 249428, prof = "SKINNING", how = "Seltener Fund beim Häuten (höhere Level)" },
  { id = 249429, prof = "SKINNING", how = "Seltener Fund beim Häuten (Level 60)" },
  { id = 249399, prof = "HERBALISM", how = "Seltener Fund beim Kräutersammeln" },
  { id = 249424, prof = "HERBALISM", how = "Seltener Fund beim Kräutersammeln" },
  { id = 249274, prof = "HERBALISM", how = "Seltener Fund beim Kräutersammeln" },
  { id = 249391, prof = "MINING", how = "Seltener Fund beim Bergbau" },
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
