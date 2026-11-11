-- Öffnet jede Seite mit realistischen Daten, meldet Layout-Probleme und exportiert Zeichendaten.
-- Aufruf: lua5.1 tests/check_layout.lua [ausgabeordner]   -> Bilder: python3 tools/render_pages.py <ordner>
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local ROOT = HERE .. "../TirysZentrale/"
local W = require("wow_mock")
local L = require("layout")

W.level, W.faction, W.class, W.money = 21, "Horde", "ROGUE", 523456
W.skills = {
  { name = "Berufe", isHeader = true, isCollapsed = false },
  { name = "Kürschnerei", skillID = 393, isHeader = false, rank = 102, maxRank = 150 },
  { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 110, maxRank = 150 },
  { name = "Kochkunst", skillID = 185, isHeader = false, rank = 60, maxRank = 75 },
}
W.known = { [2881] = true, [2152] = true, [2164] = true, [2158] = true, [3817] = true, [1229432] = true, [3816] = true }
W.itemInfo = {}
W.prices = { [4244] = 30000, [4243] = 500, [4231] = 300, [4293] = 9000, [2318] = 32, [783] = 45, [2319] = 120, [4232] = 160, [2304] = 900, [2312] = 9500, [2307] = 12000,
  [4233] = 900, [4231] = 280, [279978] = 196, [2589] = 60, [2592] = 120, [249427] = 4000, [2770] = 40, [2447] = 25 }
W.install({})
TirysZentraleDB, TirysZentraleCharDB = nil, nil
local ns = {}
for line in io.lines(ROOT .. "TirysZentrale.toc") do
  if not line:match("^##") and line:match("%S") then
    assert(loadfile(ROOT .. line:gsub("\\", "/"):gsub("%s+$", "")))("TirysZentrale", ns)
  end
end
W.fire("ADDON_LOADED", "TirysZentrale") ; W.fire("PLAYER_LOGIN") ; W.flush()
TirysZentraleDB.lastScan = W.now - 1200
TirysZentraleDB.vendorBuy[2320] = 10
TirysZentraleDB.vendorBuy[4289] = 50
for id, p in pairs(W.prices) do TirysZentraleDB.priceHistory = TirysZentraleDB.priceHistory or {} TirysZentraleDB.priceHistory[id] = { ["2026-11-06"] = p, ["2026-11-07"] = p } end
TirysZentraleCharDB.hiddenRecipes = { [2881] = true, [3816] = true }
TirysZentraleCharDB.auctions = {
  time = W.now - 600,
  list = {
    { auctionID = 1, id = 2318, qty = 20, unit = 40, status = "active", expires = W.now + 3600 * 20, competitor = 35, undercut = true, checked = W.now - 600 },
    { auctionID = 2, id = 249427, qty = 2, unit = 4200, status = "active", expires = W.now + 3600 * 8, competitor = 4500, undercut = false, checked = W.now - 600 },
    { auctionID = 3, id = 4238, qty = 1, unit = 950, status = "active", expires = W.now - 60 },
  },
  sold = { { id = 2319, name = "Mittleres Leder", qty = 10, unit = 120, amount = 1140, time = W.now - 1800, inMail = true },
           { id = 2589, name = "Leinenstoff", qty = 20, unit = 60, amount = 1140, time = W.now - 86400, inMail = false } },
  mail = { known = 0, pending = { { name = "Mittleres Leder", amount = 1140, time = W.now - 1800 } } },
}
TirysZentraleCharDB.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 2 }, { recipe = 2158, prof = "LEATHERWORKING", n = 1 } }
W.bags = { [0] = { { itemID = 2318, stackCount = 18, quality = 1 }, { itemID = 249427, stackCount = 2, quality = 2 }, { itemID = 3300, stackCount = 3, quality = 0 } } }

ns.UI.Show("home")
local frame = TirysZentraleMainFrame
local total = 0
-- Fensterhöhe für die komplette Seite: Inhalt + Abstand Fensteroberkante -> Seitenbereich + Rand unten
local function fullHeight(content)
  frame.__h = ns.UI.HEIGHT
  L.reset()
  local fr, br = L.rect(frame), L.rect(frame.body)
  return math.max(ns.UI.HEIGHT, (content.__h or 0) + (fr.t - br.t) + 24)
end
-- Einsteiger-Assistent (modal über dem Fenster): einzeln prüfen und zeichnen, dann schließen
assert(ns.UI.Wizard.IsShown(), "Assistent beim ersten Öffnen")
for step = 1, 3 do
  ns.UI.Wizard.Go(step)
  for _, p in ipairs(L.problems(ns.UI.Wizard.frame)) do
    print("[assistent " .. step .. "] " .. p) total = total + 1
  end
  if OUT then L.dump(frame, OUT .. "/wizard" .. step .. ".tsv") end
end
ns.UI.Wizard.Finish()
for _, def in ipairs(ns.UI.order) do
  ns.UI.Show(def.key)
  W.flush()
  ns.UI.RefreshPage(def.key)
  -- volle Seitenhöhe anzeigen (Scroll-Inhalt komplett), damit alles geprüft/gezeichnet wird
  local content = def.frame.content
  local fullH = fullHeight(content)
  frame.__h = fullH
  local probs = L.problems(frame)
  for _, p in ipairs(probs) do print("[" .. def.key .. "] " .. p) end
  total = total + #probs
  if OUT then L.dump(frame, OUT .. "/" .. def.key .. ".tsv") end
  frame.__h = ns.UI.HEIGHT
end
-- Craft-Planer: "Lernen lohnt sich" (Rezept-Items)
do
  local rp = ns.UI.pages.recipes
  ns.UI.Show("recipes") ; rp.view = "learnable" ; ns.UI.RefreshPage("recipes")
  frame.__h = fullHeight(rp.frame.content)
  for _, p in ipairs(L.problems(frame)) do print("[recipes+lernen] " .. p) total = total + 1 end
  if OUT then L.dump(frame, OUT .. "/recipes_learn.tsv") end
  frame.__h = ns.UI.HEIGHT ; rp.view = "known" ; ns.UI.RefreshPage("recipes")
end
-- Handel > Preise: Ansicht "Schnäppchen" (Beispiel-Liste aus einem Komplett-Scan, über /tz schnapp)
do
  local saved, savedT = ns.Snipe.list, ns.Snipe.time
  ns.Snipe.list = {
    { id = 2318, kind = "haendler", count = 12, cost = 120, profit = 360, unit = 10, ref = 40 },
    { id = 2319, kind = "markt", count = 20, cost = 3000, profit = 2400, unit = 150, ref = 330 },
  }
  ns.Snipe.time = time() - 300
  SlashCmdList.TIRYSZENTRALE("schnapp")
  local mp = ns.UI.pages.market
  frame.__h = fullHeight(mp.frame.content)
  for _, p in ipairs(L.problems(frame)) do print("[market+schnapp] " .. p) total = total + 1 end
  if OUT then L.dump(frame, OUT .. "/market_snipe.tsv") end
  frame.__h = ns.UI.HEIGHT
  ns.Snipe.list, ns.Snipe.time = saved, savedT
  mp.segments:Select("all", true)
end
-- Craft-Planer mit aufgeklappten Optionen
do
  local rp = ns.UI.pages.recipes
  ns.UI.Show("recipes") ; rp.proOpen = true ; ns.UI.RefreshPage("recipes")
  frame.__h = fullHeight(rp.frame.content)
  for _, p in ipairs(L.problems(frame)) do print("[recipes+optionen] " .. p) total = total + 1 end
  if OUT then L.dump(frame, OUT .. "/recipes_open.tsv") end
  frame.__h = ns.UI.HEIGHT ; rp.proOpen = false
end
-- Einkaufsfenster und Händler-Panel
ns.Shop.Show()
local shopProbs = L.problems(TirysZentraleShopWindow)
for _, p in ipairs(shopProbs) do print("[shop] " .. p) end
total = total + #shopProbs
if OUT then L.dump(TirysZentraleShopWindow, OUT .. "/shop.tsv") end
-- Einkaufsliste mit laufendem Herstellungs-Balken
W.casting = { name = "Feine Lederhandschuhe", start = W.now * 1000 - 1200, stop = W.now * 1000 + 1800 }
W.fire("UNIT_SPELLCAST_START", "player", "guid", 2164) W.flush()
W.call(TirysZentraleShopWindow.cast, "OnUpdate", 0.1)
for _, p in ipairs(L.problems(TirysZentraleShopWindow)) do print("[shop+balken] " .. p) total = total + 1 end
if OUT then L.dump(TirysZentraleShopWindow, OUT .. "/shop_cast.tsv") end
W.casting = nil
-- Eigenes Berufsfenster (TZ-Modus ersetzt Blizzards Fenster) + Umschalter WoW | TZ
do
  local UIP = UIParent
  UIP:SetSize(1920, 1080)
  local PF = CreateFrame("Frame", "ProfessionsFrame", UIP)
  PF:SetSize(673, 594) PF:SetPoint("TOPLEFT", UIP, "TOPLEFT", 60, -120) PF:Hide()
  local bg = PF:CreateTexture(nil, "BACKGROUND") bg:SetAllPoints() bg:SetColorTexture(0.10, 0.09, 0.08, 1)
  local lbl = PF:CreateFontString(nil, "OVERLAY") lbl:SetFont("Fonts\\FRIZQT__.TTF", 16, "") lbl:SetPoint("CENTER") lbl:SetText("Blizzard-Berufsfenster")
  -- wie Blizzard: Fenster zu = Beruf zu
  PF:SetScript("OnHide", function() W.fire("TRADE_SKILL_CLOSE") end)
  _G.HideUIPanel = function(f) f:Hide() end
  local selected = 2164
  PF.CraftingPage = { SchematicForm = { GetRecipeInfo = function() return { recipeID = selected } end } }
  local cbs = {}
  _G.EventRegistry = { RegisterCallback = function(self, ev, fn, owner) assert(type(ev) == "string" and type(fn) == "function") cbs[ev] = { fn, owner } end }
  W.recipes = {}
  local CAT = { [2164] = 11, [2158] = 11, [2152] = 12, [3816] = 12, [3817] = 12 }
  local DIFFS = { [2164] = 0, [2158] = 1, [2152] = 3, [3816] = 2, [3817] = 1 }
  for _, id in ipairs({ 2164, 2158, 2152, 3816, 3817 }) do
    local r = ns.Recipes.Get(id)
    if r then
      local re = {}
      for _, x in ipairs(r.reagents) do re[#re + 1] = { x.id, x.n } end
      W.recipes[id] = { name = r.name, out = r.out, reagents = re, diff = DIFFS[id] }
    end
  end
  local TS = C_TradeSkillUI
  local favs, cooldown = { [2152] = true }, {}
  local baseInfo = TS.GetRecipeInfo
  TS.GetRecipeInfo = function(id)
    local i = baseInfo(id)
    if i then i.categoryID = CAT[id] i.icon = 134400 i.favorite = favs[id] or false end
    return i
  end
  TS.GetCategoryInfo = function(id)
    assert(type(id) == "number")
    return ({ [11] = { name = "Handschuhe", uiOrder = 2 }, [12] = { name = "Leder & Teile", uiOrder = 1 } })[id]
  end
  TS.GetCraftableCount = function(id) assert(type(id) == "number") return id == 2164 and 3 or (id == 2152 and 7 or 0) end
  TS.GetRecipeRequirements = function(id) return id == 2164 and { { name = "Schmiede", met = false } } or {} end
  TS.GetRecipeCooldown = function(id) return cooldown[id] end
  TS.GetRecipeLink = function(id) return "|cffffffff|Henchant:" .. id .. "|h[Rezept]|h|r" end
  TS.SetRecipeFavorite = function(id, on) assert(type(id) == "number" and type(on) == "boolean") favs[id] = on or nil end
  TS.GetTradeSkillTexture = function() return 133611 end
  TS.GetBaseProfessionInfo = function() return { professionName = "Lederverarbeitung", skillLevel = 110, maxSkillLevel = 150 } end
  W.fire("ADDON_LOADED", "Blizzard_Professions")
  local P = ns.CraftPanel
  assert(TirysZentraleCraftSwitch, "Umschalter an ProfessionsFrame gebaut")
  assert(cbs["ProfessionsRecipeListMixin.Event.OnRecipeSelected"], "Rezept-Auswahl abonniert")
  PF:Show() W.fire("TRADE_SKILL_SHOW") W.flush()
  local CW = TirysZentraleCraftWindow
  assert(CW and CW:IsShown(), "TZ-Modus: eigenes Fenster sichtbar")
  assert(PF:IsShown() and PF:GetAlpha() == 0 and PF:GetScale() < 0.01, "Blizzards Fenster unsichtbar, aber offen (sonst bricht der Beruf ab)")
  PF:SetScale(1) PF:SetAlpha(1)
  assert(PF:GetAlpha() == 0 and PF:GetScale() < 0.01, "Blizzard setzt Größe/Deckkraft nicht zurück")
  assert(ns.Scanner.openProfKey() == "LEATHERWORKING", "Beruf erkannt: " .. tostring(ns.Scanner.openProfKey()))
  local function dumpWin(name)
    W.flush() P.Reload()
    local listNeed = CW.listContent:GetHeight() + 330
    local need = math.max(640, CW.content:GetHeight() + 112 + 6 + 42 + 66 + 12, listNeed)
    CW:SetHeight(need) L.reset()
    for _, p in ipairs(L.problems(CW)) do print("[berufsfenster " .. name .. "] " .. p) total = total + 1 end
    if OUT then L.dump(CW, OUT .. "/craft_" .. name .. ".tsv") end
    CW:SetHeight(640) L.reset()
  end
  -- Liste: Kategorien, Farben, Favorit, Anzahl
  dumpWin("rezept")
  local function findRow(id)
    for _, row in ipairs(P._rows()) do if row:IsShown() and row.e and row.e.id == id then return row end end
  end
  assert(findRow(2164) and findRow(2152), "Rezepte in der Liste")
  assert(P.recipeID == 2164 or P.recipeID == 2152, "Startrezept gewählt: " .. tostring(P.recipeID))
  -- Auswahl per Klick
  W.call(findRow(2158), "OnClick", "LeftButton")
  assert(P.recipeID == 2158 and W.opened == 2158, "Klick wählt Rezept + öffnet es bei Blizzard")
  -- Favorit per Rechtsklick
  W.call(findRow(2158), "OnClick", "RightButton")
  assert(favs[2158], "Rechtsklick = Favorit")
  -- Shift-Klick = Link in den Chat
  local linked
  _G.ChatEdit_InsertLink = function(l) linked = l return true end
  W.shift = true W.call(findRow(2164), "OnClick", "LeftButton") W.shift = false
  assert(linked and linked:find("2164"), "Shift-Klick verlinkt")
  -- Herstellen: Menge + Herstellen + Alle
  W.call(findRow(2164), "OnClick", "LeftButton")
  local cb = CW.craftBar
  W.call(cb.plus, "OnClick") W.call(cb.plus, "OnClick")
  assert(cb.count == 3, "Menge 3")
  W.call(cb.plus, "OnClick")
  assert(cb.count == 3, "Menge begrenzt auf herstellbar")
  W.crafted = 0
  W.call(cb.make, "OnClick")
  assert(W.crafted == 3 and W.craftedID == 2164, "Herstellen ruft CraftRecipe")
  W.crafted = 0
  W.call(cb.all, "OnClick")
  assert(W.crafted == 3, "Alle herstellen")
  assert(P.ReqText(2164):find("Schmiede"), "Voraussetzung angezeigt")
  cooldown[2164] = 7200
  assert(P.ReqText(2164):find("Abklingzeit 2 Std"), "Abklingzeit angezeigt")
  cooldown[2164] = nil
  -- Filter + Sortierung + Suche
  ns.settings.craftPanel.filter.can = true
  P.RefreshList()
  assert(not findRow(2158) and findRow(2164), "Filter Herstellbar")
  ns.settings.craftPanel.filter.can = nil
  W.call(CW.sort.buttons[2], "OnClick") assert(ns.settings.craftPanel.sort == "profit", "Sortierung Gewinn")
  dumpWin("gewinn")
  W.call(CW.sort.buttons[1], "OnClick")
  P.RefreshList()
  -- Kategorie einklappen
  local catBtn
  for _, c in ipairs(P._cats()) do if c:IsShown() and c.key == "Handschuhe" then catBtn = c end end
  assert(catBtn, "Kategorie-Kopf da")
  W.call(catBtn, "OnClick")
  assert(not findRow(2164), "Kategorie eingeklappt")
  W.call(catBtn, "OnClick")
  assert(findRow(2164), "Kategorie aufgeklappt")
  -- Skill-Tipp: orange (sicher +1) zuerst
  assert(CW.tip:IsShown() and CW.tip.e and CW.tip.e.diff == 0, "Skill-Tipp zeigt orange Rezept")
  -- Menü-Verknüpfungen öffnen die Zentrale
  for i, b in ipairs(CW.links) do
    W.call(b, "OnClick")
    assert(TirysZentraleMainFrame:IsShown(), "Link " .. i .. " öffnet Zentrale")
  end
  TirysZentraleMainFrame:Hide()
  -- Reiter
  W.call(findRow(2158), "OnClick", "LeftButton")
  dumpWin("rezept2")
  P.SetTab("top") dumpWin("top")
  P.SetTab("queue") dumpWin("liste")
  P.SetTab("setup") dumpWin("optionen")
  P.SetTab("recipe")
  -- Umschalter: WoW = Blizzard zurück, TZ = eigenes Fenster
  W.call(CW.mode.buttons[1], "OnClick")
  assert(ns.settings.craftPanel.mode == "wow" and not CW:IsShown(), "WoW-Modus: eigenes Fenster weg")
  assert(PF:IsShown() and PF:GetAlpha() == 1 and PF:GetScale() == 1, "WoW-Modus: Blizzards Fenster wieder da")
  if OUT then L.dump(PF, OUT .. "/craft_wow.tsv") end
  W.call(TirysZentraleCraftSwitch.seg.buttons[2], "OnClick")
  assert(ns.settings.craftPanel.mode == "tz" and CW:IsShown() and PF:GetAlpha() == 0, "TZ-Modus zeigt wieder")
  SlashCmdList.TIRYSZENTRALE("craftfenster")
  assert(ns.settings.craftPanel.mode == "wow" and not CW:IsShown(), "/tz craftfenster schaltet aus")
  SlashCmdList.TIRYSZENTRALE("cf")
  assert(ns.settings.craftPanel.mode == "tz" and CW:IsShown(), "/tz cf schaltet an")
  -- Schließen (×) beendet den Beruf wie bei Blizzard, Blizzards Fenster ist danach wieder normal
  W.call(CW.close, "OnClick")
  assert(not CW:IsShown() and not PF:IsShown() and not ns.Scanner.tradeOpen, "× schließt den Beruf")
  assert(PF:GetAlpha() == 1 and PF:GetScale() == 1, "Blizzards Fenster nach Schließen zurückgesetzt")
  assert(ns.settings.craftPanel.mode == "tz", "Modus bleibt TZ")
  -- Verzaubern: nur für diesen Besuch Blizzards Fenster, TZ bleibt gespeichert
  PF:Show() W.fire("TRADE_SKILL_SHOW") W.flush()
  local gi = TS.GetRecipeInfo
  TS.GetRecipeInfo = function(id) local i = gi(id) if i and id == 2152 then i.isEnchantingRecipe = true end return i end
  P.Reload()
  W.call(findRow(2152), "OnClick", "LeftButton")
  assert(CW.craftBar.make.text:GetText():find("verzaubern"), "Verzaubern-Knopf")
  W.call(CW.craftBar.make, "OnClick")
  assert(not CW:IsShown() and PF:GetAlpha() == 1 and W.opened == 2152, "Verzaubern -> Blizzard-Fenster mit Rezept")
  assert(ns.settings.craftPanel.mode == "tz", "Modus bleibt TZ")
  PF:Hide()
  TS.GetRecipeInfo = gi
  PF:Show() W.fire("TRADE_SKILL_SHOW") W.flush()
  assert(CW:IsShown(), "nächstes Öffnen wieder TZ")
  PF:Hide()
  -- Fremder Beruf (Link): Blizzard-Fenster
  TS.IsTradeSkillLinked = function() return true end
  PF:Show() W.fire("TRADE_SKILL_SHOW") W.flush()
  assert(not CW:IsShown() and PF:GetAlpha() == 1, "verlinkter Beruf: Blizzard-Fenster")
  TS.IsTradeSkillLinked = nil
  PF:Hide()
  PF:Show() W.fire("TRADE_SKILL_SHOW") W.flush()
  assert(CW:IsShown(), "eigener Beruf: wieder TZ")
  for _, e in ipairs(W.errors) do print("[berufsfenster fehler] " .. tostring(e)) total = total + 1 end
end
print(string.format("%d Layout-Probleme gefunden", total))
os.exit(total == 0 and 0 or 1)
