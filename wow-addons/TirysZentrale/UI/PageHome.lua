-- Tiry's Zentrale – Startseite: dein Gold-Kreislauf (Planen, Einkaufen, Herstellen, Verkaufen)
-- Bewusst schlank: Begrüßung, (nur wenn wichtig) ein Hinweis, der Kreislauf, Forever-Chancen.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market

local page = {
  title = "Dein Gold-Plan",
  subtitle = "Material kaufen, herstellen, teurer verkaufen – Schritt für Schritt.",
  icon = "home", label = "Start", order = 1,
}

local FACTION = { Alliance = "Allianz", Horde = "Horde" }

local LOOP_ROW_H, LOOP_GAP = 60, 8

-- Ein Schritt des Kreislaufs: Punkt auf der Zeitleiste, Titel + Satz, Knopf rechts.
-- Nur der aktuelle Schritt bekommt eine leuchtende Glas-Pille (kein Kasten pro Zeile).
local function loopRow(parent, width, i)
  local r = CreateFrame("Frame", nil, parent)
  r:SetSize(width - 32, LOOP_ROW_H)
  local shape = UI.PillShape(r, LOOP_ROW_H, 0, true)
  r.edge, r.bg, r.gloss = shape.edge, shape.body, shape.gloss
  r.glow = UI.Glow(r, C.hi, 120, 0, "BORDER")
  r.glow:SetPoint("CENTER", r, "LEFT", 32, 0)
  r.dot = CreateFrame("Frame", nil, r)
  r.dot:SetSize(40, 40)
  r.dot:SetPoint("LEFT", 12, 0)
  r.dot.bg = r.dot:CreateTexture(nil, "ARTWORK")
  r.dot.bg:SetTexture(UI.TEX.circle)
  r.dot.bg:SetAllPoints()
  r.dot.ring = r.dot:CreateTexture(nil, "OVERLAY")
  r.dot.ring:SetTexture(UI.TEX.ringthin)
  r.dot.ring:SetPoint("TOPLEFT", -3, 3)
  r.dot.ring:SetPoint("BOTTOMRIGHT", 3, -3)
  r.dot.gloss = r.dot:CreateTexture(nil, "OVERLAY", nil, 1)
  r.dot.gloss:SetTexture(UI.TEX.gloss)
  r.dot.gloss:SetAllPoints()
  r.dot.gloss:SetBlendMode("ADD")
  r.dot.gloss:SetVertexColor(1, 1, 1, 0.22)
  r.dot.num = UI.Text(r.dot, 15, "bold", C.dark)
  r.dot.num:SetPoint("CENTER", 0, 0)
  r.dot.num:SetText(tostring(i))
  r.dot.check = r.dot:CreateTexture(nil, "OVERLAY", nil, 2)
  r.dot.check:SetTexture(UI.Icon("check"))
  r.dot.check:SetSize(18, 18)
  r.dot.check:SetPoint("CENTER")
  r.dot.check:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
  r.title = UI.Text(r, 15, "bold", C.text)
  r.title:SetPoint("TOPLEFT", r.dot, "TOPRIGHT", 16, 0)
  r.text = UI.Text(r, 12, "regular", C.muted)
  r.text:SetPoint("TOPLEFT", r.title, "BOTTOMLEFT", 0, -3)
  r.text:SetWidth(width - 330)
  r.text:SetWordWrap(false)
  r.btn = UI.Button(r, "", "soft", 190, 36)
  r.btn:SetPoint("RIGHT", -12, 0)
  r.btn:SetScript("OnClick", function(b) if b.action then b.action() end end)
  return r
end

function page.build(self, content, width)
  -- Held: Begrüßung, Gold, Berufe (Neon-Glas mit Halo)
  local hero = UI.Card(content, 26, nil, { hero = true })
  hero:SetSize(width, 132)
  -- weiche Lichtflecken IN der Karte (flach gedrückt, damit nichts über den Rand quillt)
  local shine = UI.Glow(hero, C.amber, 460, 0.20, "BORDER")
  shine:SetHeight(150)
  shine:SetPoint("CENTER", hero, "LEFT", 210, 0)
  UI.Drift(shine, 160, 0, 7, 0.3, 0.12)
  local shine2 = UI.Glow(hero, C.aqua, 380, 0.12, "BORDER")
  shine2:SetHeight(140)
  shine2:SetPoint("CENTER", hero, "RIGHT", -230, 0)
  UI.Drift(shine2, -110, 0, 9, 0.25, 0.10)
  hero.coinGlow = UI.Glow(hero, C.amber, 170, 0.32, "ARTWORK")
  hero.coinGlow:SetPoint("RIGHT", -6, 0)
  hero.coin = hero:CreateTexture(nil, "ARTWORK", nil, 2)
  hero.coin:SetTexture(UI.TEX.logo)
  hero.coin:SetSize(78, 78)
  hero.coin:SetPoint("RIGHT", -38, 0)
  hero.ring = hero:CreateTexture(nil, "OVERLAY")
  hero.ring:SetTexture(UI.TEX.ringgrad)
  hero.ring:SetSize(94, 94)
  hero.ring:SetPoint("CENTER", hero.coin, "CENTER")
  hero.ring:SetVertexColor(1, 1, 1, 0.75)
  UI.Drift(hero.coin, 0, 6, 2.5)
  hero.hello = UI.Text(hero, 26, "bold", C.text)
  hero.hello:SetPoint("TOPLEFT", 28, -20)
  hero.info = UI.Text(hero, 12, "semibold", C.muted)
  hero.info:SetPoint("TOPLEFT", hero.hello, "BOTTOMLEFT", 2, -4)
  hero.money = UI.Text(hero, 22, "bold", C.text)
  hero.money:SetPoint("TOPLEFT", hero.info, "BOTTOMLEFT", -2, -12)
  hero.profs = {}
  hero:SetPoint("TOPLEFT", content, "TOPLEFT", 0, 0)
  self.hero = hero

  -- Wichtiger Hinweis (nur wenn nötig: Auctionator fehlt, Gold im Briefkasten, alte Preise ...)
  local nx = UI.Card(content, 24, C.cardHi)
  nx:SetSize(width, 96)
  nx.glow = UI.Glow(nx, C.teal, 150, 0.30, "BORDER")
  nx.glow:SetPoint("CENTER", nx, "LEFT", 46, 0)
  nx.icon = CreateFrame("Frame", nil, nx)
  nx.icon:SetSize(50, 50)
  nx.icon:SetPoint("LEFT", 22, 0)
  nx.icon.bg = nx.icon:CreateTexture(nil, "ARTWORK")
  nx.icon.bg:SetTexture(UI.TEX.circle)
  nx.icon.bg:SetAllPoints()
  UI.SetGradV(nx.icon.bg, C.amber, C.aqua, 1)
  nx.icon.gloss = nx.icon:CreateTexture(nil, "ARTWORK", nil, 1)
  nx.icon.gloss:SetTexture(UI.TEX.gloss)
  nx.icon.gloss:SetAllPoints()
  nx.icon.gloss:SetBlendMode("ADD")
  nx.icon.gloss:SetVertexColor(1, 1, 1, 0.3)
  nx.icon.tex = nx.icon:CreateTexture(nil, "OVERLAY")
  nx.icon.tex:SetSize(24, 24)
  nx.icon.tex:SetPoint("CENTER")
  nx.icon.tex:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
  nx.title = UI.Text(nx, 16, "bold", C.text)
  nx.title:SetPoint("TOPLEFT", 90, -20)
  nx.title:SetWidth(width - 350)
  nx.title:SetWordWrap(false)
  nx.text = UI.Para(nx, 12, C.muted, width - 350)
  nx.text:SetPoint("TOPLEFT", nx.title, "BOTTOMLEFT", 0, -4)
  nx.btn = UI.Button(nx, "", "primary", 220, 40, "chevron")
  nx.btn:SetPoint("RIGHT", -24, 0)
  nx.btn:SetScript("OnClick", function() if self.nextAction then self.nextAction() end end)
  self.next = nx

  -- Der Gold-Kreislauf als Zeitleiste
  local loop = UI.Card(content, 26, C.card)
  loop:SetWidth(width)
  loop.title = UI.Text(loop, 18, "bold", C.text)
  loop.title:SetPoint("TOPLEFT", 24, -20)
  loop.title:SetText("So machst du Gold: kaufen, herstellen, teurer verkaufen")
  loop.sub = UI.Text(loop, 12, "regular", C.muted)
  loop.sub:SetPoint("TOPLEFT", loop.title, "BOTTOMLEFT", 0, -4)
  loop.sub:SetText("Immer der orange markierte Schritt ist dran. Ist er erledigt, kommt der nächste.")
  -- Leitlinie durch alle Punkte (Neon -> Türkis -> Aqua)
  local top = 74 + LOOP_ROW_H / 2
  local len = 3 * (LOOP_ROW_H + LOOP_GAP)
  loop.line1 = loop:CreateTexture(nil, "ARTWORK")
  loop.line1:SetTexture(UI.TEX.white)
  loop.line1:SetSize(2, len / 2)
  loop.line1:SetPoint("TOP", loop, "TOPLEFT", 16 + 12 + 20, -top)
  UI.SetGradV(loop.line1, C.amber, C.teal, 0.55)
  loop.line2 = loop:CreateTexture(nil, "ARTWORK")
  loop.line2:SetTexture(UI.TEX.white)
  loop.line2:SetSize(2, len / 2)
  loop.line2:SetPoint("TOP", loop.line1, "BOTTOM")
  UI.SetGradV(loop.line2, C.teal, C.aqua, 0.55)
  loop.rows = {}
  for i = 1, 4 do
    local r = loopRow(loop, width, i)
    r:SetPoint("TOPLEFT", 16, -74 - (i - 1) * (LOOP_ROW_H + LOOP_GAP))
    loop.rows[i] = r
  end
  loop:SetHeight(74 + 4 * (LOOP_ROW_H + LOOP_GAP) + 12)
  self.loop = loop

  -- Neu in Forever: Glas-Pillen mit Item-Kugel
  self.chanceTitle = UI.Text(content, 17, "bold", C.text)
  self.chanceTitle:SetText("Neu in Forever – deine Chancen")
  self.chanceDot = content:CreateTexture(nil, "ARTWORK")
  self.chanceDot:SetTexture(UI.TEX.circle)
  self.chanceDot:SetSize(7, 7)
  self.chanceDot:SetPoint("RIGHT", self.chanceTitle, "LEFT", -7, 0)
  UI.SetGradV(self.chanceDot, C.amber, C.teal, 1)
  self.chanceHint = UI.Para(content, 12, C.dim, width)
  self.chanceHint:SetText("Seltene neue Materialien und neue Alchemie-Produkte. Deine Berufe stehen vorne. Klick = im AH suchen (AH muss offen sein).")
  local fw = math.floor((width - 36) / 4)
  local grid = CreateFrame("Frame", nil, content)
  grid:SetSize(width, 3 * 64 - 8)
  self.chances = {}
  local function paintChance(b, hover)
    if hover then
      b.edge:SetGradient(UI.GRAD_EDGE, 0.7)
      b.bg:SetGradientV(UI.GLASS.pillHi[1], UI.GLASS.pillHi[2], 1)
    else
      b.edge:SetGradientV({ 0.60, 1.00, 0.85, 0.20 }, { 0.20, 0.55, 0.65, 0.06 })
      b.bg:SetGradientV(UI.GLASS.card[1], UI.GLASS.card[2], 0.9)
    end
  end
  for i = 1, 12 do
    local b = UI.SafeButton(grid)
    b:SetSize(fw, 56)
    -- gestaffelt: jede zweite Reihe leicht eingerückt
    b:SetPoint("TOPLEFT", ((i - 1) % 4) * (fw + 12), -math.floor((i - 1) / 4) * 64)
    local shape = UI.PillShape(b, 56, 0, true)
    b.edge, b.bg = shape.edge, shape.body
    b.icon = UI.ItemIcon(b, 40)
    b.icon:SetPoint("LEFT", 8, 0)
    b.name = UI.Text(b, 12, "semibold", C.text)
    b.name:SetPoint("TOPLEFT", b.icon, "TOPRIGHT", 10, -2)
    b.name:SetWidth(fw - 70)
    b.name:SetWordWrap(false)
    b.price = UI.Text(b, 12, "bold", C.gold)
    b.price:SetPoint("TOPLEFT", b.name, "BOTTOMLEFT", 0, -3)
    paintChance(b, false)
    b:SetScript("OnEnter", function(btn)
      paintChance(btn, true)
      GameTooltip:SetOwner(btn, "ANCHOR_RIGHT")
      pcall(GameTooltip.SetItemByID, GameTooltip, btn.id)
      GameTooltip:AddLine(" ")
      GameTooltip:AddLine(btn.how or "", 0.47, 1, 0.58, true)
      GameTooltip:Show()
    end)
    b:SetScript("OnLeave", function(btn) paintChance(btn, false) GameTooltip:Hide() end)
    b:SetScript("OnClick", function(btn)
      if IsShiftKeyDown() then ns.LinkItem(btn.id) return end
      local ok, err = M.SearchNow({ btn.id })
      if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
    end)
    self.chances[i] = b
  end
  self.grid = grid

  self.goal = UI.Para(content, 12, C.muted, width)
end

-- Nur Hinweise außerhalb des Kreislaufs kommen darüber (alles rund ums Craften zeigt der Kreislauf selbst)
local function isUrgent(step)
  if not step then return false end
  if step.kind == "craft" or step.kind == "farm" then return false end
  return true
end

function page.refresh(self)
  local p = ns.player
  ns.UpdatePlayer()
  local content = self.frame.content
  local width = UI.CONTENT_W
  -- Einsteiger-Assistent beim allerersten Öffnen
  if not ns.settings.wizardDone and UI.Wizard and not UI.Wizard.IsShown() and not self.wizardTried then
    self.wizardTried = true
    UI.Wizard.Show()
  end

  -- Begrüßung
  local hero = self.hero
  hero.hello:SetText(UI.GradText("Hey " .. (p.name ~= "" and p.name or "Abenteurer") .. "!", { 0.86, 1.0, 0.90 }, C.amber))
  hero.info:SetText("Level " .. p.level .. "  ·  " .. (FACTION[p.faction] or p.faction))
  hero.money:SetText(ns.Money(GetMoney()))
  for _, c in ipairs(hero.profs) do c:Hide() end
  local ids = {}
  for id in pairs(ns.professions) do ids[#ids + 1] = id end
  table.sort(ids)
  local x = 0
  for i, id in ipairs(ids) do
    local c = hero.profs[i] or UI.Chip(hero, "", C.teal)
    hero.profs[i] = c
    local pr = ns.professions[id]
    c:Set(pr.name .. " " .. pr.rank .. "/" .. pr.maxRank, i % 2 == 1 and C.gold or C.teal)
    c:ClearAllPoints()
    c:SetPoint("LEFT", hero.money, "RIGHT", 18 + x, 0)
    c:Show()
    x = x + c:GetWidth() + 6
    if x > width - 420 then break end
  end
  if #ids == 0 then
    local c = hero.profs[1] or UI.Chip(hero, "", C.red)
    hero.profs[1] = c
    c:Set("Noch kein Beruf – lern einen Herstellungsberuf!", C.red)
    c:ClearAllPoints()
    c:SetPoint("LEFT", hero.money, "RIGHT", 18, 0)
    c:Show()
  end
  local y = 132 + 18

  -- Wichtiger Hinweis (nur wenn es etwas außerhalb des Kreislaufs gibt)
  local step = ns.Guide.NextStep()
  if isUrgent(step) then
    self.next.title:SetText(step.title)
    self.next.text:SetText(step.text)
    self.next.btn:SetLabel(step.button)
    self.next.icon.tex:SetTexture(UI.Icon(step.icon or "star"))
    self.nextAction = step.action
    self.next:ClearAllPoints()
    self.next:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
    self.next:Show()
    y = y + 96 + 18
  else
    self.next:Hide()
    self.nextAction = nil
  end

  -- Kreislauf
  local loop = self.loop
  -- Wochenbilanz (echter Gewinn aus dem Herstell-Buch) statt Erklärtext, sobald es Daten gibt
  local week = ns.CraftBook.WeekLine()
  UI.FitText(loop.sub, week or "Immer der orange markierte Schritt ist dran. Ist er erledigt, kommt der nächste.", loop:GetWidth() - 40)
  for i, st in ipairs(ns.Guide.CraftLoop()) do
    local r = loop.rows[i]
    r.title:SetText(st.title)
    UI.FitText(r.text, st.text, width - 330)
    r.btn:SetLabel(st.button)
    r.btn.action = st.action
    r.btn.style = st.state == "now" and "primary" or "soft"
    r.btn:Paint()
    r.dot.num:SetShown(st.state ~= "done")
    r.dot.check:SetShown(st.state == "done")
    -- nur der aktuelle Schritt bekommt die leuchtende Pille; erledigt = Neon-Haken, später = gedämpft
    local now = st.state ~= "later" and st.state ~= "done"
    r.edge:SetShown(now)
    r.bg:SetShown(now)
    r.gloss:SetShown(now)
    r.glow:SetAlpha(now and 0.30 or 0)
    if now then
      r.edge:SetGradient({ C.hi, { 1, 0.80, 0.42 }, C.amber }, 0.55)
      r.bg:SetGradientV(UI.GLASS.pillHi[1], UI.GLASS.pillHi[2], 0.95)
      r.gloss:SetAlpha(0.45)
    end
    if st.state == "later" then
      UI.SetGradV(r.dot.bg, { 0.20, 0.24, 0.24 }, { 0.10, 0.12, 0.13 }, 1)
      r.dot.ring:SetVertexColor(C.dim[1], C.dim[2], C.dim[3], 0.35)
      r.dot.num:SetTextColor(C.muted[1], C.muted[2], C.muted[3], 1)
      r.title:SetTextColor(C.dim[1], C.dim[2], C.dim[3], 1)
    elseif st.state == "done" then
      UI.SetGradV(r.dot.bg, { 0.62, 1.00, 0.36 }, C.teal, 1)
      r.dot.ring:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 0.55)
      r.title:SetTextColor(C.muted[1], C.muted[2], C.muted[3], 1)
    else
      UI.SetGradV(r.dot.bg, { 1, 0.80, 0.42 }, C.hi, 1)
      r.dot.ring:SetVertexColor(C.hi[1], C.hi[2], C.hi[3], 0.9)
      r.dot.num:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
      r.title:SetTextColor(C.hi[1], C.hi[2], C.hi[3], 1)
    end
  end
  loop:ClearAllPoints()
  loop:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + loop:GetHeight() + 24

  -- Forever-Chancen
  self.chanceTitle:ClearAllPoints()
  self.chanceTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 14, -y)
  y = y + 30
  self.chanceHint:ClearAllPoints()
  self.chanceHint:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.chanceHint:GetStringHeight()) + 10
  for i, c in ipairs(ns.Guide.ForeverChances()) do
    local b = self.chances[i]
    if b then
      b.id, b.how = c.id, c.how .. (c.mine and " – passt zu deinem Beruf!" or "")
      b.icon:SetItem(c.id)
      UI.FitText(b.name, ns.Item(c.id).name, b:GetWidth() - 70)
      b.price:SetText((c.price and ns.Money(c.price) or "|cff9aa8a2kein Preis|r") .. (c.mine and ("  " .. UI.TEAL_HEX .. "· dein Beruf|r") or ""))
    end
  end
  self.grid:ClearAllPoints()
  self.grid:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 3 * 64 - 8 + 20

  local goal
  for _, g in ipairs(ns.GOALS) do
    if p.level <= g.level then goal = g break end
  end
  self.goal:SetText(goal and ("|cff39ff6bSparziel:|r " .. goal.text) or "")
  self.goal:ClearAllPoints()
  self.goal:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.goal:GetStringHeight()) + 30
  content:SetHeight(y)
end

UI.RegisterPage("home", page)
