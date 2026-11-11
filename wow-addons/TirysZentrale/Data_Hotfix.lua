-- Tiry's Zentrale – Blizzard-Hotfixes, die (noch) nicht in den Spieldaten-Dateien stehen (serverseitig).
-- Von Hand gepflegt, je Eintrag mit Datum und Quelle. Wird beim Laden über die erzeugten Daten gelegt.
-- Quelle: news.blizzard.com/en-us/article/24315281/wow-forever-hotfixes-november-10-2026 (Einträge 06.11. und 10.11.)
local _, ns = ...
ns.HOTFIX = {
  recipes = {
    -- 06.11.2026 Lederverarbeitung: "Tanning Rack skill requirement lowered to 125 (was 140)",
    -- Skill-Punkte 15 tiefer (gelb 140 -> 125, grau 145 -> 130)
    [1263031] = { learn = 125, yellow = 125, grey = 130 },
    -- 10.11.2026 Schmiedekunst: "Coarse Grinding Stone now provides skill-ups to 90 (was 75)"
    [3326] = { grey = 90 },
  },
  sell = {
    [4390] = 125, -- 10.11.2026: Eisengranate Händlerpreis 1 Silber 25 Kupfer (vorher 5 Silber)
  },
}
