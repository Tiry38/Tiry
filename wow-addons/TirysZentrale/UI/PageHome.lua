-- Tiry's Zentrale – Startseite: persönlicher Goldplan
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market

local page = {
  title = "Dein Goldplan",
  subtitle = "Die besten Goldwege für deinen Charakter – jetzt, mit echten Preisen.",
  icon = "home", label = "Start", order = 1,
}

local function topCard(parent, w)
  local card = CreateFrame("Button", nil, parent)
  card:SetSize(w, 176)
  card.bg = UI.Round(card, 20, "BACKGROUND", 0)
  card.bg:SetColor(C.card)
  card.glow = UI.Glow(card, C.amber, 220, 0, "BACKGROUND")
  card.glow:SetPoint("TOP", 0, 40)
  card.rank = UI.Chip(card, "", C.hi, true)
  card.rank:SetPoint("TOPLEFT", 16, -16)
  card.icon = UI.ItemIcon(card, 44)
  card.icon:SetPoint("TOPRIGHT", -16, -14)
  card.title = UI.Para(card, 14, C.text, w - 32, "bold")
  card.title:SetPoint("TOPLEFT", 16, -64)
  card.value = UI.Text(card, 17, "bold", C.hi)
  card.value:SetPoint("BOTTOMLEFT", 16, 40)
  card.sub = UI.Text(card, 10, "semibold", C.dim)
  card.sub:SetPoint("BOTTOMLEFT", 16, 22)
  card.sub:SetWidth(w - 70)
  card.sub:SetWordWrap(false)
  card.go = card:CreateTexture(nil, "ARTWORK")
  card.go:SetTexture(UI.Icon("chevron"))
  card.go:SetSize(16, 16)
  card.go:SetPoint("BOTTOMRIGHT", -18, 24)
  card:SetScript("OnEnter", function(self) self.bg:SetColor(C.cardHi) self.glow:SetAlpha(0.35) end)
  card:SetScript("OnLeave", function(self) self.bg:SetColor(C.card) self.glow:SetAlpha(0) end)
  card:SetScript("OnClick", function(self)
    if not self.method then return end
    UI.PlayClick()
    local methods = UI.pages.methods
    UI.Show("methods")
    methods.Focus(methods, self.method.key)
    UI.RefreshPage("methods")
  end)
  return card
end

function page.build(self, content, width)
  local st = UI.Stack(content)

  -- Begrüßung mit Verlaufsfläche
  local hero = CreateFrame("Frame", nil, content)
  hero:SetSize(width, 132)
  hero.bg = UI.Round(hero, 22, "BACKGROUND", 0)
  hero.bg:SetGradient({ { 0.07, 0.27, 0.19 }, { 0.09, 0.18, 0.16 }, { 0.14, 0.16, 0.17 } }, 0.95)
  local shine = UI.Glow(hero, C.gold, 300, 0.25, "BACKGROUND")
  shine:SetPoint("CENTER", hero, "TOPLEFT", 80, -20)
  UI.Drift(shine, 120, -20, 7, 0.3, 0.12)
  hero.coin = hero:CreateTexture(nil, "ARTWORK")
  hero.coin:SetTexture(UI.TEX.logo)
  hero.coin:SetSize(88, 88)
  hero.coin:SetPoint("RIGHT", -26, 0)
  UI.Drift(hero.coin, 0, 6, 2.5)
  hero.hello = UI.Text(hero, 22, "bold", C.text)
  hero.hello:SetPoint("TOPLEFT", 24, -22)
  hero.info = UI.Text(hero, 12, "semibold", C.muted)
  hero.info:SetPoint("TOPLEFT", hero.hello, "BOTTOMLEFT", 0, -6)
  hero.money = UI.Text(hero, 20, "bold", C.hi)
  hero.money:SetPoint("TOPLEFT", hero.info, "BOTTOMLEFT", 0, -12)
  hero.profs = {}
  self.hero = hero
  st:Add(hero, 132, 16)

  -- Dein nächster Schritt: genau EINE Handlung
  local ns_ = CreateFrame("Frame", nil, content)
  ns_:SetSize(width, 112)
  ns_.bg = UI.Round(ns_, 22, "BACKGROUND", 0)
  ns_.bg:SetColor(C.cardHi, 1)
  ns_.glow = UI.Glow(ns_, C.hi, 260, 0.18, "BACKGROUND")
  ns_.glow:SetPoint("LEFT", 40, 0)
  ns_.icon = CreateFrame("Frame", nil, ns_)
  ns_.icon:SetSize(54, 54)
  ns_.icon:SetPoint("LEFT", 22, 0)
  ns_.icon.bg = UI.Round(ns_.icon, 27, "ARTWORK", 0)
  ns_.icon.bg:SetGradient(UI.GRAD, 1)
  ns_.icon.tex = ns_.icon:CreateTexture(nil, "OVERLAY")
  ns_.icon.tex:SetSize(26, 26)
  ns_.icon.tex:SetPoint("CENTER")
  ns_.icon.tex:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
  ns_.label = UI.Text(ns_, 12, "semibold", C.hi)
  ns_.label:SetPoint("TOPLEFT", 94, -20)
  ns_.label:SetText("DEIN NÄCHSTER SCHRITT")
  ns_.title = UI.Text(ns_, 17, "bold", C.text)
  ns_.title:SetPoint("TOPLEFT", ns_.label, "BOTTOMLEFT", 0, -4)
  ns_.title:SetWidth(width - 360)
  ns_.title:SetWordWrap(false)
  ns_.text = UI.Para(ns_, 12, C.muted, width - 360)
  ns_.text:SetPoint("TOPLEFT", ns_.title, "BOTTOMLEFT", 0, -4)
  ns_.btn = UI.Button(ns_, "", "primary", 220, 40, "chevron")
  ns_.btn:SetPoint("RIGHT", -22, 0)
  ns_.btn:SetScript("OnClick", function() if self.nextAction then self.nextAction() end end)
  self.next = ns_
  st:Add(ns_, 112, 20)

  -- Heute für dich: die 3 Aktionen mit dem meisten Gold (ohne Einrichtung)
  local today = UI.Card(content, 20, C.card)
  today:SetSize(width, 176)
  local tt = UI.Text(today, 16, "bold", C.text)
  tt:SetPoint("TOPLEFT", 20, -16)
  tt:SetText("Heute für dich")
  today.rows = {}
  for i = 1, 3 do
    local r = CreateFrame("Button", nil, today)
    r:SetSize(width - 40, 38)
    r:SetPoint("TOPLEFT", 20, -48 - (i - 1) * 42)
    r.bg = UI.Round(r, 19, "BACKGROUND", 1)
    r.bg:SetColor(C.inset, 1)
    r.num = UI.Chip(r, tostring(i), C.hi, true)
    r.num:SetPoint("LEFT", 10, 0)
    r.text = UI.Text(r, 12, "semibold", C.text)
    r.text:SetPoint("LEFT", r.num, "RIGHT", 10, 0)
    r.text:SetWidth(width - 160)
    r.text:SetWordWrap(false)
    r.go = r:CreateTexture(nil, "ARTWORK")
    r.go:SetTexture(UI.Icon("chevron"))
    r.go:SetSize(14, 14)
    r.go:SetPoint("RIGHT", -14, 0)
    r:SetScript("OnEnter", function(row) row.bg:SetColor(C.cardHi, 1) end)
    r:SetScript("OnLeave", function(row) row.bg:SetColor(C.inset, 1) end)
    r:SetScript("OnClick", function(row) UI.PlayClick() if row.action then row.action() end end)
    today.rows[i] = r
  end
  self.today = today
  st:Add(today, 176, 20)

  st:Title("Top 3 für dich – gerade jetzt", 17, C.text, 2)
  self.topHint = UI.Para(content, 11, C.dim, width)
  st:Add(self.topHint, 16, 10)
  local cw = math.floor((width - 24) / 3)
  self.tops = {}
  local row = CreateFrame("Frame", nil, content)
  row:SetSize(width, 176)
  for i = 1, 3 do
    local c = topCard(row, cw)
    c:SetPoint("TOPLEFT", (i - 1) * (cw + 12), 0)
    self.tops[i] = c
  end
  st:Add(row, 176, 22)

  st:Title("Neu in Forever – deine Chancen", 17, C.text, 2)
  st:Para("Seltene neue Materialien und neue Alchemie-Produkte. Deine Berufe stehen vorne. Klick = im AH suchen (AH muss offen sein).", 12, C.dim, 10)
  local fw = math.floor((width - 36) / 4)
  local grid = CreateFrame("Frame", nil, content)
  grid:SetSize(width, 3 * 64 - 8)
  self.chances = {}
  for i = 1, 12 do
    local b = CreateFrame("Button", nil, grid)
    b:SetSize(fw, 56)
    b:SetPoint("TOPLEFT", ((i - 1) % 4) * (fw + 12), -math.floor((i - 1) / 4) * 64)
    b.bg = UI.Round(b, 16, "BACKGROUND", 0)
    b.bg:SetColor(C.card, 1)
    b.icon = UI.ItemIcon(b, 34)
    b.icon:SetPoint("LEFT", 10, 0)
    b.name = UI.Text(b, 12, "semibold", C.text)
    b.name:SetPoint("TOPLEFT", b.icon, "TOPRIGHT", 8, 0)
    b.name:SetWidth(fw - 62)
    b.name:SetWordWrap(false)
    b.price = UI.Text(b, 12, "bold", C.hi)
    b.price:SetPoint("TOPLEFT", b.name, "BOTTOMLEFT", 0, -3)
    b:SetScript("OnEnter", function(btn)
      btn.bg:SetColor(C.cardHi, 1)
      GameTooltip:SetOwner(btn, "ANCHOR_RIGHT")
      pcall(GameTooltip.SetItemByID, GameTooltip, btn.id)
      GameTooltip:AddLine(" ")
      GameTooltip:AddLine(btn.how or "", 1, 0.6, 0.16, true)
      GameTooltip:Show()
    end)
    b:SetScript("OnLeave", function(btn) btn.bg:SetColor(C.card, 1) GameTooltip:Hide() end)
    b:SetScript("OnClick", function(btn)
      if IsShiftKeyDown() then ns.LinkItem(btn.id) return end
      local ok, err = M.SearchNow({ btn.id })
      if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
    end)
    self.chances[i] = b
  end
  st:Add(grid, 3 * 64 - 8, 22)

  st:Title("Schnellstart für Einsteiger", 17, C.text, 4)
  local steps = {
    { "Auctionator installieren und im AH einmal scannen", "Reiter \"Auctionator\" > \"Scannen\". Ohne Preise rät jeder – mit Preisen weißt du es.", "scan" },
    { "Zwei Sammelberufe lernen", "Kürschnerei + Kräuterkunde oder Bergbau. Jede Kreatur und jede Pflanze wird zu Gold.", "pin" },
    { "Nach jeder Runde: Taschen-Check", "Tiry's Zentrale sagt dir pro Item: Händler oder AH. Grauen Schrott mit einem Klick verkaufen.", "bag" },
    { "Händler ansprechen, wo du vorbeikommst", "Tiry's Zentrale meldet Schnäppchen zum Weiterverkaufen automatisch im Chat.", "cart" },
  }
  for i, s in ipairs(steps) do
    local f = UI.Card(content, 16, C.card)
    f:SetSize(width, 62)
    local num = CreateFrame("Frame", nil, f)
    num:SetSize(34, 34)
    num:SetPoint("LEFT", 14, 0)
    num.bg = UI.Round(num, 17, "ARTWORK", 0)
    num.bg:SetGradient(UI.GRAD, 1)
    local n = UI.Text(num, 14, "bold", C.dark)
    n:SetPoint("CENTER", 0, 0)
    n:SetText(tostring(i))
    local t = UI.Text(f, 13, "semibold", C.text)
    t:SetPoint("TOPLEFT", num, "TOPRIGHT", 14, 2)
    t:SetText(s[1])
    local d = UI.Text(f, 11, "regular", C.muted)
    d:SetPoint("TOPLEFT", t, "BOTTOMLEFT", 0, -4)
    d:SetWidth(width - 80)
    d:SetWordWrap(false)
    d:SetText(s[2])
    st:Add(f, 62, 8)
  end
  st:Space(10)

  local actions = CreateFrame("Frame", nil, content)
  actions:SetSize(width, 36)
  local b1 = UI.Button(actions, "Taschen checken", "primary", 180, 36, "bag")
  b1:SetPoint("LEFT")
  b1:SetScript("OnClick", function() UI.Show("scanner") end)
  local b2 = UI.Button(actions, "Marktpreise", "cool", 160, 36, "coins")
  b2:SetPoint("LEFT", b1, "RIGHT", 10, 0)
  b2:SetScript("OnClick", function() UI.Show("market") end)
  local b3 = UI.Button(actions, "AH-Schule", "soft", 150, 36, "book")
  b3:SetPoint("LEFT", b2, "RIGHT", 10, 0)
  b3:SetScript("OnClick", function() UI.Show("basics") end)
  st:Add(actions, 36, 18)

  self.goal = UI.Para(content, 12, C.muted, width)
  st:Add(self.goal, 20, 10)
  st:Finish(30)
end

local FACTION = { Alliance = "Allianz", Horde = "Horde" }

function page.refresh(self)
  local p = ns.player
  ns.UpdatePlayer()
  -- Einsteiger-Assistent beim allerersten Öffnen
  if not ns.settings.wizardDone and UI.Wizard and not UI.Wizard.IsShown() and not self.wizardTried then
    self.wizardTried = true
    UI.Wizard.Show()
  end
  -- Nächster Schritt
  local step = ns.Guide.NextStep()
  self.next.title:SetText(step.title)
  self.next.text:SetText(step.text)
  self.next.btn:SetLabel(step.button)
  self.next.icon.tex:SetTexture(UI.Icon(step.icon or "star"))
  self.nextAction = step.action
  -- Forever-Chancen
  for i, c in ipairs(ns.Guide.ForeverChances()) do
    local b = self.chances[i]
    if b then
      b.id, b.how = c.id, c.how .. (c.mine and " – passt zu deinem Beruf!" or "")
      b.icon:SetItem(c.id)
      UI.FitText(b.name, ns.Item(c.id).name, b:GetWidth() - 62)
      b.price:SetText((c.price and ns.Money(c.price) or "|cff8a9a94kein Preis|r") .. (c.mine and "  |cff61eb8f· dein Beruf|r" or ""))
    end
  end
  local hero = self.hero
  hero.hello:SetText("Hey " .. (p.name ~= "" and p.name or "Abenteurer") .. "!")
  hero.info:SetText("Level " .. p.level .. "  ·  " .. (FACTION[p.faction] or p.faction))
  hero.money:SetText(ns.Money(GetMoney()))

  -- Berufe als Etiketten
  for _, c in ipairs(hero.profs) do c:Hide() end
  local ids = {}
  for id in pairs(ns.professions) do ids[#ids + 1] = id end
  table.sort(ids)
  local x = 0
  for i, id in ipairs(ids) do
    local c = hero.profs[i] or UI.Chip(hero, "", C.hi)
    hero.profs[i] = c
    local pr = ns.professions[id]
    c:Set(pr.name .. " " .. pr.rank .. "/" .. pr.maxRank, C.hi)
    c:ClearAllPoints()
    c:SetPoint("TOPLEFT", hero.money, "TOPRIGHT", 18 + x, -2)
    c:Show()
    x = x + c:GetWidth() + 6
    if x > UI.CONTENT_W - 420 then break end
  end
  if #ids == 0 then
    local c = hero.profs[1] or UI.Chip(hero, "", C.rose)
    hero.profs[1] = c
    c:Set("Noch keine Berufe – lern zwei Sammelberufe!", C.red)
    c:ClearAllPoints()
    c:SetPoint("TOPLEFT", hero.money, "TOPRIGHT", 18, -2)
    c:Show()
  end

  -- Top 3: verfügbar, eigene Berufe bevorzugt, dann nach Live-Wert
  local ranked = {}
  for _, m in ipairs(ns.METHODS) do
    if ns.MethodAvailable(m) then
      local value = ns.MethodValue(m) or 0
      local own = (m.prof and ns.HasProf(m.prof)) and 1 or 0
      local needsProf = (m.prof and not ns.HasProf(m.prof)) and 1 or 0
      ranked[#ranked + 1] = { m = m, value = value, own = own, needs = needsProf }
    end
  end
  table.sort(ranked, function(a, b)
    if a.own ~= b.own then return a.own > b.own end
    if a.needs ~= b.needs then return a.needs < b.needs end
    if a.value ~= b.value then return a.value > b.value end
    return (a.m.effort or 1) < (b.m.effort or 1)
  end)
  local state = M.Status()
  self.topHint:SetText(state == "ok" and "Sortiert nach deinen Berufen und den aktuellen AH-Preisen deines Servers. Klick = Anleitung."
    or "Tipp: Mit Auctionator-Preisen wird diese Rangliste viel genauer. Klick = Anleitung.")
  for i, card in ipairs(self.tops) do
    local r = ranked[i]
    card.method = r and r.m
    if r then
      card.rank:Set("#" .. i, i == 1 and C.hi or (i == 2 and C.teal or C.violet), true)
      card.title:SetText(r.m.title)
      if r.m.items and r.m.items[1] then card.icon:SetItem(r.m.items[1]) else card.icon:SetIcon(UI.Icon(r.m.icon or "star"), C.gold) end
      local value, id = ns.MethodValue(r.m)
      if value then
        card.value:SetText(ns.Money(value))
        card.sub:SetText("pro Stapel " .. ns.Item(id).name)
      else
        card.value:SetText(r.m.items and "Preis offen" or "Sofort-Gold")
        card.sub:SetText(r.m.prof and not ns.HasProf(r.m.prof) and ("Beruf lernen: " .. ns.ProfName(r.m.prof)) or "Anleitung öffnen")
      end
      card:Show()
    else
      card:Hide()
    end
  end

  -- Heute für dich
  local acts = {}
  local scanAge = ns.db.lastScan and (time() - ns.db.lastScan) or nil
  if M.HasAuctionator() and (not scanAge or scanAge > 86400) then
    acts[#acts + 1] = { "AH scannen – deine Preise sind " .. (scanAge and "älter als 1 Tag" or "noch nicht erfasst"), function() M.StartScan() end }
  end
  if ns.Deals and #ns.Deals.List() > 0 then
    local d = ns.Deals.List()[1]
    acts[#acts + 1] = { string.format("Schnäppchen kaufen: %s (spart %s)", ns.Item(d.id).name, ns.Money(d.save)), function() UI.Show("scanner") end }
  end
  ns.Scanner.ScanBags()
  local ahN, ahV = 0, 0
  for _, e in ipairs(ns.Scanner.bags.items) do if e.advice == "AH" then ahN = ahN + 1 ahV = ahV + (e.ah or 0) end end
  if ahN > 0 then acts[#acts + 1] = { string.format("%d Items für ca. %s ins AH stellen", ahN, ns.Money(ahV)), function() UI.Show("scanner") end } end
  local rp = UI.pages.recipes
  if rp and rp.frame and #ns.Recipes.MyProfessions() > 0 then
    local n, sum = 0, 0
    local savedProf = rp.prof
    for _, key in ipairs(ns.Recipes.MyProfessions()) do
      rp.prof = key
      local list = rp.Entries(rp)
      n = n + #list
      for _, e in ipairs(list) do sum = sum + e.profit end
    end
    rp.prof = savedProf
    if n > 0 then acts[#acts + 1] = { string.format("%d Rezepte bringen Gold – zusammen ca. %s pro Durchgang", n, ns.Money(sum)), function() UI.Show("recipes") end } end
  elseif #ns.Recipes.MyProfessions() > 0 then
    acts[#acts + 1] = { "Craft-Planer öffnen: deine Rezepte nach Gewinn", function() UI.Show("recipes") end }
  end
  acts[#acts + 1] = { "Farm-Spot für dein Level ansehen", function() UI.Show(ns.HasProf(ns.PROF.SKINNING) and "skinning" or "farm") end }
  acts[#acts + 1] = { "Verkaufsbuch: was sich wirklich verkauft", function() UI.Show("ledger") end }
  for i, r in ipairs(self.today.rows) do
    local a = acts[i]
    r.text:SetText(a and a[1] or "")
    r.action = a and a[2]
    r:SetShown(a ~= nil)
  end

  local goal
  for _, g in ipairs(ns.GOALS) do
    if p.level <= g.level then goal = g break end
  end
  self.goal:SetText(goal and ("|cffff9929Sparziel:|r " .. goal.text) or "")
end

UI.RegisterPage("home", page)
