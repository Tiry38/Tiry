-- Tiry's Zentrale – Farm-Guide nach Level (Gebiete + Materialien je Levelbereich)
-- Gebiete und Fundorte = bewährtes Classic-Wissen (Forever baut auf derselben Welt auf, hat aber Inhalte überarbeitet).
-- Alle Item-IDs sind in der Forever-Datenbank (Build 1.60.1.70862) geprüft. Welche Gruppe sich lohnt, entscheiden die Live-Preise.
local _, ns = ...
local P = ns.PROF

ns.FARM_GROUPS = {
  herb = { label = "Kräuter", prof = P.HERBALISM, how = "Kräuterkunde: Kräutersuche an, Punkte auf der Minikarte abfliegen." },
  ore = { label = "Erz & Steine", prof = P.MINING, how = "Bergbau: Mineraliensuche an, Adern an Felswänden und in Höhlen abbauen." },
  leather = { label = "Leder", prof = P.SKINNING, how = "Kürschnerei: jedes erlegte Tier häuten." },
  cloth = { label = "Stoff", how = "Kein Beruf nötig: humanoide Gegner (Menschen, Orcs, Gnolle, Trolle, Kobolde …) looten." },
  special = { label = "Elemente & Besonderes", how = "Kein Beruf nötig: Elementare, Untote und Drachkin in diesem Levelbereich looten." },
}

ns.FARM = {
  {
    key = "1-10", min = 1, max = 10,
    Alliance = { "Wald von Elwynn", "Dun Morogh", "Teldrassil" },
    Horde = { "Durotar", "Mulgore", "Tirisfal" },
    both = { "Zephras Isle (nur Skyborne, Level 1–12, neu in Forever)" },
    groups = {
      herb = { 2447, 765, 2449 },
      ore = { 2770, 2835, 249391 },
      leather = { 2934, 2318, 783 },
      cloth = { 2589 },
    },
    tip = "Neu in Forever: \"Poor Copper Vein\" in Startgebieten – Bergbau ab Skill 1. Blizzard lässt in Startgebieten zum Start alles schneller nachwachsen.",
  },
  {
    key = "10-20", min = 10, max = 20,
    Alliance = { "Westfall", "Loch Modan", "Dunkelküste" },
    Horde = { "Brachland", "Silberwald" },
    groups = {
      herb = { 2449, 785, 2450, 2452, 249399 },
      ore = { 2770, 2771, 2775, 774, 818, 2835 },
      leather = { 2318, 783, 249427 },
      cloth = { 2589, 2592 },
    },
    tip = "Allianz: Defias in Westfall geben viel Leinen- und Wollstoff. Horde: Das Brachland ist voller häutbarer Tiere und Stacheleber.",
  },
  {
    key = "20-30", min = 20, max = 30,
    Alliance = { "Rotkammgebirge", "Dämmerwald", "Sumpfland" },
    Horde = { "Vorgebirge des Hügellands", "Brachland (Süden)" },
    both = { "Eschental", "Steinkrallengebirge" },
    groups = {
      herb = { 2453, 3355, 3820, 3369, 3356, 249399 },
      ore = { 2771, 2775, 2772, 2776, 2836, 1210, 1206 },
      leather = { 2319, 4232, 249427 },
      cloth = { 2592, 4306 },
    },
    tip = "Würgetang wächst im Wasser – viele übersehen es, darum oft teuer. Ab hier fällt Seidenstoff.",
  },
  {
    key = "30-40", min = 30, max = 40,
    both = { "Arathihochland", "Tausend Nadeln", "Desolace", "Alteracgebirge", "Schlingendorntal (Norden)", "Düstermarschen" },
    groups = {
      herb = { 3356, 3357, 3818, 3821, 3358 },
      ore = { 2772, 2776, 3858, 2838, 3864 },
      leather = { 4234, 4304 },
      cloth = { 4306, 4338 },
    },
    tip = "Golddorn und Khadgars Schnurrbart sind für Alchemisten wichtig – meist die wertvollsten Kräuter in diesem Bereich.",
  },
  {
    key = "40-50", min = 40, max = 50,
    both = { "Schlingendorntal (Süden)", "Tanaris", "Feralas", "Hinterland", "Ödland", "Sümpfe des Elends", "Sengende Schlucht" },
    groups = {
      herb = { 3821, 3358, 3819, 4625, 8831, 8836, 8838 },
      ore = { 3858, 7911, 12365, 7909 },
      leather = { 4304, 8167, 8154 },
      cloth = { 4338 },
      special = { 7067, 7068, 7069, 7070 },
    },
    tip = "Elementare (z. B. im Ödland) geben Elementarerde und Co. – ohne jeden Beruf verkaufbar.",
  },
  {
    key = "50-60", min = 50, max = 60,
    both = { "Krater von Un'Goro", "Teufelswald", "Azshara", "Winterquell", "Brennende Steppe", "Westliche Pestländer", "Östliche Pestländer", "Silithus" },
    groups = {
      herb = { 8838, 8846, 13464, 13463, 13465, 13466, 13467, 13468 },
      ore = { 10620, 7911, 12365, 12361, 12799 },
      leather = { 8170, 15412 },
      cloth = { 14047 },
      special = { 7078, 7082, 12803, 12808 },
    },
    tip = "Runenstoff ist der wichtigste Stoff auf Level 60. Schwarzer Lotus ist selten, aber das teuerste Kraut.",
  },
}

ns.FARM_ORDER = { "herb", "ore", "leather", "cloth", "special" }
