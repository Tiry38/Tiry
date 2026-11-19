-- Tiry's Zentrale 7 – Szenario-Test gegen den strengen Forever-Nachbau (tests/wow_mock.lua).
-- Ablauf wie im Spiel: Fenster -> AH öffnen -> Komplett-Scan -> Liste -> Filter -> Händler -> Berufsfenster -> neu gelernt.
-- Aufruf (aus wow-addons/): lua5.1 tests/run_tests.lua
package.path = package.path .. ";tests/?.lua;spec/?.lua"
local E = require("addon_env")

local passed, failed = 0, 0
local function check(name, cond, msg)
  if cond then passed = passed + 1 else failed = failed + 1 print("FEHLER: " .. name .. (msg and (" – " .. tostring(msg)) or "")) end
end

local SKILLS = {
  { name = "Berufe", isHeader = true, isCollapsed = true },
  { name = "Kochkunst", skillID = 185, isHeader = false, rank = 60, maxRank = 75 },
  { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 110, maxRank = 150 },
  { name = "Kürschnerei", skillID = 393, isHeader = false, rank = 110, maxRank = 150 },
}

-- Komplett-Scan: { itemID, Anzahl, Sofortkauf gesamt }
local SCAN = {
  -- Kochkunst
  { 2889, 1, 5000 }, { 2888, 1, 900 }, { 2888, 2, 2000 }, { 2886, 10, 500 }, { 2894, 5, 400 },       -- Eberrippchen
  { 3679, 1, 3000 }, { 3220, 5, 2500 }, { 3173, 20, 1000 }, { 3172, 3, 300 }, { 3174, 10, 600 },     -- Blutwurst (knapp)
  { 6325, 1, 100 },                                                                                   -- schon gelernt
  { 728, 1, 2000 }, { 733, 1, 3000 }, { 729, 5, 50 }, { 730, 5, 50 }, { 731, 5, 50 },                -- Westfall (ab 75)
  { 7678, 1, 100 }, { 7676, 1, 10 }, { 2452, 5, 5000 },                                              -- Disteltee (Verlust)
  -- Lederverarbeitung
  { 7361, 1, 20000 }, { 7349, 1, 15000 }, { 2319, 40, 4000 }, { 3356, 20, 2000 },                   -- Kräuterkundigenhandschuhe
  { 7362, 1, 9000 }, { 7352, 1, 20000 },                                                             -- Irdene Schultern (Elementarerde fehlt)
  { 2407, 1, 800 }, { 2311, 1, 3000 }, { 2318, 50, 1500 },                                           -- Weißes Lederwams (grau)
  { 252797, 1, 1000 }, { 252503, 1, 30000 }, { 4231, 30, 3000 }, { 5498, 10, 2000 },                -- seelengebunden
  { 276935, 1, 500 },                                                                                 -- braucht Ruf
  { 4306, 200, 2000 },                                                                                -- fremdes Item (nicht beobachtet)
}

local function names(list)
  local out = {}
  for _, e in ipairs(list) do out[#out + 1] = e.r.name end
  return table.concat(out, ", ")
end
local function find(list, spell)
  for i, e in ipairs(list) do if e.r.id == spell then return e, i end end
end

----------------------------------------------------------------------------
-- 1) Laden, Fenster, Leer-Zustand
----------------------------------------------------------------------------
local ns, W = E.load({ skills = SKILLS, faction = "Horde", known = { [7751] = true } })
check("ohne Fehler geladen", #W.errors == 0, W.errors[1])
check("Berufe erkannt", ns.ProfRank("COOKING") == 60 and ns.ProfRank("LEATHERWORKING") == 110 and not ns.professions[393])
check("503 kaufbare Rezepte geladen", #ns.Craft.Load() == 503, #ns.Craft.Load())
check("Hotfix Gerbrahmen (lernbar 125)", ns.Craft.Get(1263031).learn == 125 and ns.Craft.Get(1263031).grey == 130)
SlashCmdList.TIRYSZENTRALE("")
W.flush()
local F = TirysZentraleMainFrame
check("Fenster offen", F and F:IsShown())
check("Leer: noch kein Scan", F.empty:IsShown() and F.empty.title:GetText() == "Noch kein Scan", F.empty.title:GetText())
check("Scan-Knopf ohne AH gesperrt", not F.scan.btn:IsEnabled())
local ok, why = ns.Scan.Start()
check("Scan ohne AH abgelehnt", not ok and why:find("Auktionshaus"), why)

----------------------------------------------------------------------------
-- 2) AH öffnen, Komplett-Scan (mit nachladenden Item-Daten -> erneut lesen)
----------------------------------------------------------------------------
W.fire("AUCTION_HOUSE_SHOW")
W.flush()
ns.UI.Refresh()
check("Scan-Knopf mit AH frei", F.scan.btn:IsEnabled())
W.call(F.scan.btn, "OnClick")
check("ReplicateItems aufgerufen", W.replicated == 1, W.replicated)
check("Mitlesen scharf", ns.Scan.armed)
check("Knopf während Scan gesperrt", (ns.UI.Refresh() or true) and not F.scan.btn:IsEnabled())
W.replicate = {}
for _, r in ipairs(SCAN) do W.replicate[#W.replicate + 1] = r end
W.replicate[#W.replicate + 1] = { 5000, 1, 100, "X", false } -- Daten fehlen noch -> nochmal lesen
local reads = 0
local num = C_AuctionHouse.GetNumReplicateItems
C_AuctionHouse.GetNumReplicateItems = function() reads = reads + 1 return num() end
W.fire("REPLICATE_ITEM_LIST_UPDATE")
W.fire("REPLICATE_ITEM_LIST_UPDATE") -- doppelte Meldung
W.flush()
check("bis zu 3x nachgelesen (fehlende Item-Daten)", reads == 4, reads)
local ah = TirysZentraleDB.ah
check("Scan gespeichert", ah.time == W.now and ah.total == #SCAN + 1, tostring(ah.total))
check("nur beobachtete Items gespeichert", ah.items[2889] and not ah.items[4306] and not ah.items[5000])
check("Preisstufen sortiert", ah.items[2888].p == 900 and ah.items[2888].b[1] == 900 and ah.items[2888].b[3] == 1000 and ah.items[2888].q == 3)
W.fire("REPLICATE_ITEM_LIST_UPDATE") -- Nachzügler-Meldung ohne neuen Scan: nicht nochmal lesen
W.flush()
check("ohne neuen Scan nicht erneut gelesen", reads == 4, reads)

----------------------------------------------------------------------------
-- 3) Rechnung und Reihenfolge
----------------------------------------------------------------------------
ns.UI.Refresh()
local list, stats = F.list, F.stats
check("Liste nach Gewinn", names(list) == "Kräuterkundigenhandschuhe, Weißes Lederwams, Blutwurst, Eberrippchen in Biersauce", names(list))
local k = find(list, 9146)
check("Handschuhe: Wert 15000 × 0,95", k and k.value == 14250 and k.valueSrc == "ah", k and k.value)
check("Handschuhe: Material 8×Leder 100 + 4×Königsblut 100 + 2×Faden Händler 100", k and k.cost == 1400, k and k.cost)
check("Handschuhe: Gewinn und Rückzahlung", k and k.profit == 12850 and k.payback == 2)
local b = find(list, 3371)
check("Blutwurst: 2 Stück je Herstellung", b and b.value == 950, b and b.value)
check("Blutwurst: knappes Material zum letzten Preis", b and b.cost == 210 and b.mats[2].thin, b and b.cost)
local e = find(list, 2795)
check("Eberrippchen: Horde kauft Malz im AH (Allianz-Händler)", e and e.mats[2].src == "ah" and e.cost == 130 and e.profit == 725, e and e.cost)
check("Eberrippchen: Rückzahlung 5000/725 -> 7", e and e.payback == 7)
check("schon gelernt ausgeblendet", stats.known >= 1 and not find(list, 7751))
check("Ruf-Rezept ausgeblendet", stats.rep >= 1)
check("Verlust ausgeblendet (Disteltee, seelengebundene Hose)", stats.loss == 2 and not find(list, 9513) and not find(list, 1255110), stats.loss)
check("fehlendes Material gezählt (Elementarerde)", stats.missing == 1 and not find(list, 9147), stats.missing)
check("Rezepte ohne AH-Angebot gezählt", stats.notInAH > 400, stats.notInAH)
check("Westfall (ab 75) nicht jetzt", not find(list, 2543) and stats.skill >= 1)
check("Skillfarben", find(list, 2163).color == "grey" and k.color == "orange" and b.color == "orange", find(list, 2163).color)
check("Zeilen sichtbar", F.content:GetHeight() > 4 * 60)

----------------------------------------------------------------------------
-- 4) Filter
----------------------------------------------------------------------------
W.call(F.skillToggle, "OnClick")
check("nur mit Skillpunkten: graues Lederwams weg", ns.settings.skillOnly and not find(F.list, 2163), names(F.list))
W.call(F.skillToggle, "OnClick")
F.rangeSeg:Select("soon", true)
local wf, wfi = find(F.list, 2543)
check("bald lernbar: Westfall (ab 75) dabei", wf and wfi == 2 and wf.profit == 2820 and not wf.learnable, names(F.list))
F.profSeg:Select("COOKING", true)
check("nur Kochkunst", #F.list == 3 and F.list[1].r.prof == "COOKING", names(F.list))
F.profSeg:Select("ALL", true)
F.rangeSeg:Select("now", true)
check("Filter gespeichert", ns.settings.prof == "ALL" and ns.settings.range == "now")

----------------------------------------------------------------------------
-- 5) Zeile: Tooltip, Klick sucht im AH
----------------------------------------------------------------------------
local row
for _, r in ipairs(ns.UI.Rows()) do if r:IsShown() and r.e and r.e.r.id == 9146 then row = r end end
check("Zeile vorhanden", row ~= nil)
if row then
  W.call(row, "OnEnter")
  W.call(row, "OnLeave")
  W.call(row, "OnClick")
  check("Klick sucht Rezept per Auctionator", W.searched and W.searched[1] == "Muster: Kräuterkundigenhandschuhe", W.searched and W.searched[1])
  W.itemInfo[7361] = { name = "Muster: Kräuterkundigenhandschuhe", q = 2 }
  W.shift = true
  W.call(row, "OnClick")
  W.shift = false
  check("Shift-Klick verlinkt das Rezept", W.linked and tostring(W.linked):find("Hitem:7361"), W.linked)
end

----------------------------------------------------------------------------
-- 6) Händler: Malz mit unbegrenztem Vorrat -> Preis gelernt, Eberrippchen jetzt günstiger
----------------------------------------------------------------------------
W.merchant = { { id = 2894, name = "Rhapsodiemalz", price = 50, stack = 1, avail = -1 }, { id = 3356, name = "Königsblut", price = 100, stack = 1, avail = 2 } }
W.fire("MERCHANT_SHOW")
W.flush()
check("unbegrenzter Händlerpreis gelernt", TirysZentraleDB.vendor[2894] == 50)
check("begrenzter Vorrat nicht gelernt", TirysZentraleDB.vendor[3356] == nil)
ns.UI.Refresh()
e = find(F.list, 2795)
check("Eberrippchen mit Händler-Malz", e and e.mats[2].src == "vendor" and e.cost == 100 and e.profit == 755, e and e.cost)

----------------------------------------------------------------------------
-- 7) Berufsfenster: gelernte Rezepte erkennen; neues Rezept gelernt
----------------------------------------------------------------------------
W.recipes = { [2795] = { name = "Eberrippchen in Biersauce", learned = true, out = 2888, reagents = {} },
  [99001] = { name = "Andere Nummer", learned = true, out = 3220, reagents = {} } }
C_TradeSkillUI.GetBaseProfessionInfo = function() return { professionName = "Kochkunst", skillLevel = 60, maxSkillLevel = 75 } end
W.fire("TRADE_SKILL_SHOW")
W.flush()
check("Berufsfenster gelesen", TirysZentraleCharDB.seen.COOKING ~= nil and TirysZentraleCharDB.learned[2795])
check("über Ergebnis-Item zugeordnet", TirysZentraleCharDB.learned[3371])
ns.UI.Refresh()
check("gelernte Kochrezepte weg", not find(F.list, 2795) and not find(F.list, 3371), names(F.list))
check("Fußzeile: Kochkunst erkannt, Leder offen", F.foot:GetText():find("Kochkunst |cff39ff6berkannt") and F.foot:GetText():find("Berufsfenster einmal"), F.foot:GetText())
W.fire("NEW_RECIPE_LEARNED", 9146)
W.flush()
check("neu gelerntes Rezept sofort weg", not find(F.list, 9146), names(F.list))

----------------------------------------------------------------------------
-- 8) 15-Minuten-Sperre, AH zu während des Lesens
----------------------------------------------------------------------------
ok, why = ns.Scan.Start()
check("Sperre 15 Min.", not ok and why:find("15 Minuten"), why)
check("Knopf zeigt Wartezeit", F.scan.btn.text:GetText():find("^in %d+:%d%d$"), F.scan.btn.text:GetText())
W.now = W.now + 901
ok = ns.Scan.Start()
check("nach 15 Min. wieder erlaubt", ok and W.replicated == 2)
for i = 1, 2500 do W.replicate[#W.replicate + 1] = { 2318, 1, 30 + i } end
W.fire("REPLICATE_ITEM_LIST_UPDATE")
local timers = W.timers
W.timers = {}
for _, fn in ipairs(timers) do fn() end -- Entprellung läuft -> erster Block gelesen
check("liest in Blöcken", ns.Scan.reading and ns.Scan.progress and ns.Scan.progress < 1, ns.Scan.progress)
W.fire("AUCTION_HOUSE_CLOSED")
W.flush()
check("AH zu: Lesen abgebrochen, alter Scan bleibt", not ns.Scan.reading and TirysZentraleDB.ah.time == W.now - 901)

----------------------------------------------------------------------------
-- 9) Gespeicherte Daten aus 6.x: Neubau, Position und gelernte Rezepte bleiben
----------------------------------------------------------------------------
check("keine Fehler im Ablauf", #W.errors == 0, W.errors[1])
local ns2, W2 = E.load({ skills = SKILLS, db = { settings = { point = { "TOP", "TOP", 10, -40 }, craft = {} }, priceHistory = { [1] = 1 }, vendorBuy = {} } })
check("alte Daten verworfen", TirysZentraleDB.v == 7 and TirysZentraleDB.priceHistory == nil and TirysZentraleDB.vendorBuy == nil)
check("Fensterposition behalten", TirysZentraleDB.settings.point[1] == "TOP" and TirysZentraleDB.settings.point[3] == 10)
check("Standardfilter", ns2.settings.prof == "ALL" and ns2.settings.range == "now" and ns2.settings.skillOnly == false)
SlashCmdList.TIRYSZENTRALE("hilfe")
SlashCmdList.TIRYSZENTRALE("fehler")
SlashCmdList.TIRYSZENTRALE("scan")
SlashCmdList.TIRYSZENTRALE("reset")
check("Befehle ohne Fehler", #W2.errors == 0, W2.errors[1])

print(string.format("Zentrale 7: %d bestanden, %d fehlgeschlagen", passed, failed))
if failed > 0 then os.exit(1) end
