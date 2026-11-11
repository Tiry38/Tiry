-- Tiry's Zentrale – Ansicht "Glossar": Fachbegriffe in einfacher Sprache (max. 2 Zeilen pro Begriff)
local _, ns = ...
local UI = ns.UI
local C = UI.C

local page = {
  title = "Glossar",
  subtitle = "Alle Begriffe aus Tiry's Zentrale – kurz und einfach erklärt.",
  icon = "info", label = "Glossar", order = 61,
}

-- Begriffe: { Wort, Erklärung }. Nur allgemein gültiges Wissen; Forever-Besonderheiten mit Quelle/Hinweis.
ns.GLOSSARY = {
  { "AH (Auktionshaus)", "Marktplatz der Spieler. Du stellst Items ein, andere kaufen sie – das Geld kommt per Post." },
  { "AH-Gebühr", "Anteil, den das AH vom Verkaufspreis behält. Tiry's Zentrale rechnet mit deinem Wert aus den Einstellungen (Standard 5 %)." },
  { "Einstellgebühr (Kaution)", "Anzahlung beim Einstellen einer Auktion – in Forever mindestens 1 Kupfer pro Angebot (seit 10.11.2026, vorher 1 Silber), bei teurer Ware mehr. Bei Verkauf zurück, bei Ablauf oder Abbruch weg." },
  { "Auctionator", "Kostenloses Addon fürs AH. Es scannt die Preise; Tiry's Zentrale liest sie über Auctionators offizielle Schnittstelle." },
  { "Scan", "Knopf \"AH scannen\" (oben rechts): liest alle Angebote im AH ein – ein Scan für alle Reiter. Komplett-Scan alle 15 Min., dazwischen Schnell-Scan." },
  { "Stapel", "Mehrere gleiche Items auf einem Platz in der Tasche, z. B. 20 Leder. \"Stapel netto\" = Wert eines vollen Stapels nach AH-Gebühr." },
  { "Händlerpreis", "Was ein NPC-Händler dir für ein Item zahlt. Liegt der AH-Preis darunter, verkaufst du lieber beim Händler." },
  { "Marktwert", "Dein eigener Durchschnittspreis: Mittelwert (Median) der Tagespreise deiner Scans der letzten 14 Tage." },
  { "Mindestgewinn", "So viel Gold muss ein Rezept pro Herstellung mindestens bringen, damit es im Craft-Planer erscheint." },
  { "Flip", "Günstig kaufen (z. B. beim Händler) und teurer im AH verkaufen." },
  { "Schnäppchen", "Ein Angebot im AH, das deutlich unter deinem Marktwert liegt (Tiry's Zentrale: höchstens 65 %)." },
  { "Verkaufsquote", "Wie viele deiner Auktionen sich wirklich verkauft haben. Unter 25 % gilt ein Item als Ladenhüter." },
  { "Ladenhüter", "Ein Item, das sich bei dir kaum verkauft – lieber nicht herstellen, auch wenn der Preis gut aussieht." },
  { "Gebunden (BoP)", "\"Beim Aufheben gebunden\": Das Item gehört nur dir und kann nicht ins AH." },
  { "Sammelberuf", "Kräuterkunde, Bergbau, Kürschnerei: Du sammelst Rohstoffe, die andere zum Herstellen brauchen." },
  { "Herstellungsberuf", "Schneiderei, Lederverarbeitung, Alchemie usw.: Du machst aus Rohstoffen neue Items." },
  { "Skill-Farben", "Orange = sicher +1 Skill, Gelb = meistens, Grün = selten, Grau = nie." },
  { "Craft-Liste", "Deine Warteschlange im Craft-Planer: was du herstellen willst. Daraus entsteht die Einkaufsliste." },
  { "Wegpunkt", "Ein Kartenpunkt mit Pfeil, dem du folgen kannst. Entfernen: Knopf \"Wegpunkt ×\" oben im Fenster." },
  { "Selten (Forever)", "Neue seltene Materialien in Forever, z. B. Makelloses Leder – oft viel mehr wert als normales Material." },
}

function page.build(self, content, width)
  local st = UI.Stack(content)
  self.search = UI.SearchBox(content, width, "Begriff suchen, z. B. \"flip\" oder \"gebühr\"", function(t)
    self.text = ns.DB.Lower(t or "")
    page.refresh(self)
  end)
  st:Add(self.search, 38, 14)
  self.top = st.y
  self.cards = {}
  for i, g in ipairs(ns.GLOSSARY) do
    local card = UI.Card(content, 16, C.card)
    card:SetWidth(width)
    card.word = UI.Text(card, 14, "bold", C.gold)
    card.word:SetPoint("TOPLEFT", 18, -14)
    card.word:SetText(g[1])
    card.text = UI.Para(card, 12, C.muted, width - 36)
    card.text:SetPoint("TOPLEFT", card.word, "BOTTOMLEFT", 0, -6)
    card.text:SetText(g[2])
    card.h = 14 + 17 + 6 + math.ceil(card.text:GetStringHeight()) + 14
    card:SetHeight(card.h)
    card.key = ns.DB.Lower(g[1] .. " " .. g[2])
    self.cards[i] = card
  end
  self.empty = UI.Para(content, 12, C.muted, width)
  self.empty:SetText("Kein Begriff gefunden. Tipp: nur einen Wortteil eingeben.")
end

function page.refresh(self)
  local y = self.top
  local shown = 0
  for _, card in ipairs(self.cards) do
    local ok = not self.text or self.text == "" or card.key:find(self.text, 1, true)
    card:SetShown(ok and true or false)
    if ok then
      card:ClearAllPoints()
      card:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
      y = y + card.h + 10
      shown = shown + 1
    end
  end
  self.empty:ClearAllPoints()
  self.empty:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
  self.empty:SetShown(shown == 0)
  self.frame.content:SetHeight(y + 40)
end

UI.RegisterPage("glossary", page)
