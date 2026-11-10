-- Tiry's Zentrale – Seite "Scanner": Händler-Flips und Taschen-Check
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local S = ns.Scanner

local ADVICE = {
  AH = { "Ins AH", C.green },
  HAENDLER = { "Händler", C.aqua },
  SCHROTT = { "Schrott", C.dim },
  BEHALTEN = { "Behalten", C.violet },
}

local page = {
  title = "Scanner",
  subtitle = "Händler-Schnäppchen zum Weiterverkaufen – und wohin deine Beute gehört.",
  icon = "scan", label = "Scanner", order = 5,
}

local function statCard(parent, w, label, color)
  local card = UI.Card(parent, 16, C.card)
  card:SetSize(w, 70)
  card.label = UI.Text(card, 10, "semibold", C.dim)
  card.label:SetPoint("TOPLEFT", 16, -14)
  card.label:SetText(label:upper())
  card.value = UI.Text(card, 18, "bold", color or C.text)
  card.value:SetPoint("TOPLEFT", card.label, "BOTTOMLEFT", 0, -6)
  return card
end

function page.build(self, content, width)
  local st = UI.Stack(content)

  -- Bereich 1: Händler-Flips
  st:Title("Händler-Flips", 17, C.text, 2)
  st:Para("Sprich einen Händler an – Tiry's Zentrale vergleicht automatisch jedes Angebot mit dem AH-Preis. "
    .. "Lohnt sich ein Kauf zum Weiterverkaufen, siehst du ihn hier (und im Chat). "
    .. "Achte besonders auf Ware mit |cffff9929begrenztem Vorrat|r (z. B. Rezepte): die ist im AH oft viel mehr wert.", 12, C.muted, 12)
  self.merchantInfo = UI.Para(content, 12, C.muted, width)
  st:Add(self.merchantInfo, 18, 8)
  self.flipList = UI.ItemList(content, width, {
    { key = "buy", label = "Kaufpreis", width = 90 },
    { key = "ah", label = "AH netto", width = 90 },
    { key = "profit", label = "Gewinn/Stk", width = 96, bold = true },
    { key = "stock", label = "Vorrat", width = 66 },
  })
  st:Add(self.flipList, nil)
  self.flipTop = st.y

  -- Schnäppchen-Radar (wird beim Suchen im AH gefüllt)
  self.dealTitle = UI.Text(content, 17, "bold", C.text)
  self.dealTitle:SetText("Schnäppchen im AH")
  self.dealHint = UI.Para(content, 12, C.muted, width)
  self.dealHint:SetText("Läuft automatisch mit: Sobald du im AH etwas suchst (auch über Auctionator), meldet Tiry's Zentrale Angebote unter 65 % deines Marktwerts. "
    .. "Ladenhüter (deine Verkaufsquote unter 30 %) zählen nicht. Der Marktwert braucht Scans von mindestens 2 Tagen.")
  self.dealList = UI.ItemList(content, width, {
    { key = "price", label = "Ab", width = 84 },
    { key = "ref", label = "Marktwert", width = 90 },
    { key = "save", label = "Ersparnis", width = 96, bold = true },
  })

  -- Bereich 2: Taschen-Check (Position wird in refresh gesetzt)
  self.bagHead = CreateFrame("Frame", nil, content)
  self.bagHead:SetSize(width, 230)
  local head = self.bagHead
  head.title = UI.Text(head, 17, "bold", C.text)
  head.title:SetPoint("TOPLEFT", 0, 0)
  head.title:SetText("Taschen-Check")
  head.desc = UI.Para(head, 12, C.muted, width)
  head.desc:SetPoint("TOPLEFT", head.title, "BOTTOMLEFT", 0, -8)
  head.desc:SetText("Zeigt, was deine Taschen wert sind und wo du jedes Item am besten verkaufst. "
    .. "Grauer Schrott: beim Händler einfach auf den |cff39ff6bMüll-Knopf (\"Schrott verkaufen\")|r klicken.")
  local cw = math.floor((width - 30) / 4)
  head.cards = {
    statCard(head, cw, "Händlerwert", C.aqua),
    statCard(head, cw, "AH-Potenzial", C.green),
    statCard(head, cw, "Bester Mix", C.text),
    statCard(head, cw, "Grauer Schrott", C.muted),
  }
  for i, card in ipairs(head.cards) do
    card:SetPoint("TOPLEFT", head, "TOPLEFT", (i - 1) * (cw + 10), -70)
  end
  head.scan = UI.Button(head, "Taschen jetzt prüfen", "primary", 210, 34, "refresh")
  head.scan:SetPoint("TOPLEFT", 0, -156)
  head.scan:SetScript("OnClick", function()
    S.ScanBags()
    page.refresh(self)
  end)
  head.listBtn = UI.Button(head, "AH-Items als Einkaufsliste", "soft", 240, 34, "cart")
  head.listBtn:SetPoint("LEFT", head.scan, "RIGHT", 10, 0)
  head.listBtn:SetScript("OnClick", function()
    local ids = {}
    for _, e in ipairs(S.bags.items) do
      if e.advice == "AH" then ids[#ids + 1] = e.id end
    end
    if #ids == 0 then
      ns.Print("Keine Items mit Empfehlung 'Ins AH' in deinen Taschen.")
      return
    end
    local ok, n = M.CreateShoppingList("Zentrale: Meine Verkäufe", ids)
    if ok then
      ns.Print("Liste |cff39ff6bZentrale: Meine Verkäufe|r angelegt (" .. n .. " Items) – so prüfst du die aktuelle Konkurrenz vor dem Einstellen.")
    else
      ns.Print("|cffff6b81" .. tostring(n) .. "|r")
    end
  end)
  UI.SetTooltip(head.listBtn, "Konkurrenz prüfen", "Legt eine Auctionator-Liste mit allen Items an, die du ins AH stellen solltest. So siehst du vor dem Einstellen die aktuellen Preise.")
  self.bagList = UI.ItemList(content, width, {
    { key = "count", label = "Anzahl", width = 60 },
    { key = "vendor", label = "Händler", width = 86 },
    { key = "ah", label = "AH netto", width = 86 },
    { key = "advice", label = "Tipp", width = 84, bold = true },
  })
  self.stack = st
end

function page.refresh(self)
  local content = self.frame.content
  S.bagsWanted = true

  -- Händler
  local m = S.merchant
  if m.open then
    if #m.flips > 0 then
      self.merchantInfo:SetText(string.format("%s: %d %s gefunden (%d Angebote geprüft).",
        m.name or "Händler", #m.flips, ns.Plural(#m.flips, "Flip-Chance", "Flip-Chancen"), m.scanned))
    elseif not M.HasAuctionator() then
      self.merchantInfo:SetText("Ohne Auctionator keine AH-Preise – der Händler-Scan braucht Auctionator.")
    else
      self.merchantInfo:SetText((m.name or "Händler") .. ": nichts gefunden, das sich zum Weiterverkaufen lohnt (" .. m.scanned .. " Angebote geprüft).")
    end
  else
    self.merchantInfo:SetText("Kein Händler offen. Sprich einen Händler an – der Scan läuft automatisch.")
  end
  local entries = {}
  for _, f in ipairs(m.open and m.flips or {}) do
    entries[#entries + 1] = {
      id = f.id,
      note = (f.available > 0) and ("Begrenzter Vorrat: " .. f.available) or "Unbegrenzt beim Händler",
      cells = {
        buy = ns.Money(f.unit),
        ah = ns.Money(f.net),
        profit = "|cff39ff6b+|r" .. ns.Money(f.profit),
        stock = f.available > 0 and tostring(f.available) or "unbegr.",
      },
      tip = {
        "Kaufen beim Händler, im AH verkaufen.",
        "AH-Preis zuletzt gesehen: " .. M.AgeText(f.id),
        "Prüfe vor dem Kauf im AH, ob es noch genug Käufer gibt.",
      },
    }
  end
  local fh = self.flipList:SetEntries(entries, m.open and "Keine lohnenden Flips bei diesem Händler." or "Öffne einen Händler, um ihn zu scannen.")

  -- Taschen
  local y = self.flipTop + fh + 28
  self.dealTitle:ClearAllPoints() ; self.dealTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 28
  self.dealHint:ClearAllPoints() ; self.dealHint:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.dealHint:GetStringHeight()) + 10
  local deals = {}
  for _, d in ipairs(ns.Deals.List()) do
    deals[#deals + 1] = {
      id = d.id, note = d.qty .. " Stück unter 65 % des Marktwerts",
      cells = { price = ns.Money(d.price), ref = ns.Money(d.ref), save = "|cff39ff6b" .. ns.Money(d.save) .. "|r" },
      tip = { "Im AH kaufen, später zum Marktwert wieder einstellen.", "Shift-Klick: Link in den Chat" },
    }
  end
  self.dealList:ClearAllPoints() ; self.dealList:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + self.dealList:SetEntries(deals, "Noch keine Schnäppchen in dieser Sitzung – such im AH nach Items.") + 28
  self.bagHead:ClearAllPoints()
  self.bagHead:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  if (S.bags.time or 0) == 0 or (time() - S.bags.time) > 2 then
    S.ScanBags()
  end
  local b = S.bags
  local cards = self.bagHead.cards
  cards[1].value:SetText(ns.Money(b.vendorTotal))
  cards[2].value:SetText(ns.Money(b.ahTotal))
  cards[3].value:SetText(ns.Money(b.bestTotal))
  cards[4].value:SetText(ns.Money(b.junkTotal))
  self.bagHead.listBtn:SetEnabled(M.HasAuctionator())

  local bagEntries = {}
  for _, e in ipairs(b.items) do
    local adv = ADVICE[e.advice] or ADVICE.HAENDLER
    -- Rohstoff-Check: verarbeiten / Trend / behalten / Markt voll
    local tipCol = (e.process and UI.NEON_HEX) or (e.trend == "fällt" and "|cffff9929") or (e.trend == "steigt" and UI.TEAL_HEX)
      or (e.tip and e.tip:find("^Markt voll") and "|cffff9929") or (e.tip and UI.TEAL_HEX) or nil
    local chip = (e.process and { "verarbeiten", C.amber }) or (e.trend == "fällt" and { "Preis fällt", C.hi })
      or (e.trend == "steigt" and { "Preis steigt", C.teal }) or nil
    bagEntries[#bagEntries + 1] = {
      id = e.id,
      chip = chip,
      note = e.bound and "Seelengebunden – nur Händler" or (e.tip and (tipCol .. e.tip .. "|r")) or nil,
      cells = {
        count = tostring(e.count),
        vendor = e.vendor > 0 and ns.Money(e.vendor) or "–",
        ah = e.ah and ns.Money(e.ah) or "–",
        advice = UI.Hex(adv[2]) .. adv[1] .. "|r",
      },
      tip = { e.advice == "AH" and "Im AH bringt es deutlich mehr als beim Händler." or
        (e.advice == "SCHROTT" and "Grau = Schrott: beim Händler verkaufen." or
        (e.advice == "BEHALTEN" and "Kein Händlerwert – behalten oder für Berufe/Quests nutzen." or "Beim Händler verkaufen ist hier am besten.")),
        e.tip },
    }
  end
  local bagY = y + 214
  self.bagList:ClearAllPoints()
  self.bagList:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -bagY)
  local bh = self.bagList:SetEntries(bagEntries, "Deine Taschen sind leer – oder alles ist wertlos.")
  content:SetHeight(bagY + bh + 30)
end

UI.RegisterPage("scanner", page)
