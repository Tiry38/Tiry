-- Tiry's Zentrale – Blizzard-Hotfixes, die (noch) nicht in den Spieldaten-Dateien stehen (serverseitig).
-- Von Hand gepflegt, je Eintrag mit Datum und Quelle. Wird beim Laden über die erzeugten Daten gelegt.
-- Quelle: news.blizzard.com/en-us/article/24315281/wow-forever-hotfixes-november-10-2026 (Einträge 05.11. bis 10.11.)
-- Wirkt überall: Item-Datenbank (Händlerpreis, Bindung), ns.Item, Snipe-Scanner, Händler-Untergrenzen.
-- Nicht einzeln aufgeführt, weil Blizzard keine Items nennt: 10.11. "Reduced the price vendors pay for some crafted
-- armor items from Leatherworking, Tailoring, and Blacksmithing" – laut Blizzard nur seelengebundene Items; die
-- rechnet die Zentrale ohnehin nicht als Weiterverkauf (Wert 0), daher keine falschen Gewinne.
local _, ns = ...
ns.HOTFIX = {
  recipes = {
    -- 06.11.2026 Lederverarbeitung: "Tanning Rack skill requirement lowered to 125 (was 140)",
    -- Skill-Punkte 15 tiefer (gelb 140 -> 125, grau 145 -> 130)
    [1263031] = { learn = 125, yellow = 125, grey = 130 },
    -- 10.11.2026 Schmiedekunst: "Coarse Grinding Stone now provides skill-ups to 90 (was 75)"
    [3326] = { grey = 90 },
    -- 10.11.2026 Kochen: "Journeyman Campfire Kit now requires Cooking 90 to place, matching its recipe skill
    -- requirement (was Cooking 140)" – Lagerfeuer des Gesellen: Rezept und Aufstellen ab Kochen 90
    [1283400] = { learn = 90 },
  },
  sell = {
    [4390] = 125,  -- 10.11.2026: "Iron Grenades vendor price reduced to 1 silver 25 copper (was 5 silver)"
    [247754] = 5,  -- 10.11.2026: "Minor Arcane Elixir sell value reduced to 5 copper (was 25 copper)" (Schwaches Arkanelixier)
    [2678] = 1,    -- 05.11.2026: "Mild Spices now sell to vendors for 1 copper each (was 2 copper)" (Milde Gewürze)
  },
  -- Bindung: 0 = frei handelbar, 1 = beim Aufheben gebunden
  bind = {
    -- 10.11.2026: "Swiftstrike Shot and Swiftfeather Arrow are no longer Bind-on-Pickup"
    [274388] = 0, -- Flinkschlagschuss
    [274387] = 0, -- Flinkfederpfeil
  },
}
-- 10.11.2026: "All racial vendor mounts are now Bind-on-Pickup" – alle Reittiere, die laut QuestieDB ein Rassen-
-- Reittierhändler verkauft (47 Stück; neue Forever-Reittiere ohne Händler-Eintrag dort sind nicht dabei)
for _, id in ipairs({ 1132, 2411, 2414, 5655, 5656, 5665, 5668, 5864, 5872, 5873, 8563, 8588, 8591, 8592, 8595, 8629,
  8631, 8632, 13321, 13322, 13331, 13332, 13333, 13334, 15277, 15290, 18766, 18767, 18772, 18773, 18774, 18777, 18778,
  18785, 18786, 18787, 18788, 18789, 18790, 18791, 18793, 18794, 18795, 18796, 18797, 18798, 18902 }) do
  ns.HOTFIX.bind[id] = 1
end
