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

local function loopRow(parent, width, i)
  local r = CreateFrame("Frame", nil, parent)
  r:SetSize(width - 40, 58)
  r.bg = UI.Round(r, 18, "BACKGROUND", 1)
  r.bg:SetColor(C.inset, 1)
  r.dot = CreateFrame("Frame", nil, r)
  r.dot:SetSize(38, 38)
  r.dot:SetPoint("LEFT", 12, 0)
  r.dot.bg = UI.Round(r.dot, 19, "ARTWORK", 0)
  r.dot.num = UI.Text(r.dot, 15, "bold", C.dark)
  r.dot.num:SetPoint("CENTER", 0, 0)
  r.dot.num:SetText(tostring(i))
  r.dot.check = r.dot:CreateTexture(nil, "OVERLAY")
  r.dot.check:SetTexture(UI.Icon("check"))
  r.dot.check:SetSize(18, 18)
  r.dot.check:SetPoint("CENTER")
  r.dot.check:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
  r.title = UI.Text(r, 15, "bold", C.text)
  r.title:SetPoint("TOPLEFT", r.dot, "TOPRIGHT", 14, -1)
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
  -- Begrüßung
  local hero = CreateFrame("Frame", nil, content)
  hero:SetSize(width, 118)
  hero.bg = UI.Round(hero, 22, "BACKGROUND", 0)
  hero.bg:SetGradient({ { 0.07, 0.27, 0.19 }, { 0.09, 0.18, 0.16 }, { 0.14, 0.16, 0.17 } }, 0.95)
  local shine = UI.Glow(hero, C.gold, 300, 0.25, "BACKGROUND")
  shine:SetPoint("CENTER", hero, "TOPLEFT", 80, -20)
  UI.Drift(shine, 120, -20, 7, 0.3, 0.12)
  hero.coin = hero:CreateTexture(nil, "ARTWORK")
  hero.coin:SetTexture(UI.TEX.logo)
  hero.coin:SetSize(80, 80)
  hero.coin:SetPoint("RIGHT", -26, 0)
  UI.Drift(hero.coin, 0, 6, 2.5)
  hero.hello = UI.Text(hero, 22, "bold", C.text)
  hero.hello:SetPoint("TOPLEFT", 24, -18)
  hero.info = UI.Text(hero, 12, "semibold", C.muted)
  hero.info:SetPoint("TOPLEFT", hero.hello, "BOTTOMLEFT", 0, -6)
  hero.money = UI.Text(hero, 20, "bold", C.hi)
  hero.money:SetPoint("TOPLEFT", hero.info, "BOTTOMLEFT", 0, -10)
  hero.profs = {}
  hero:SetPoint("TOPLEFT", content, "TOPLEFT", 0, 0)
  self.hero = hero

  -- Wichtiger Hinweis (nur wenn nötig: Auctionator fehlt, Gold im Briefkasten, alte Preise ...)
  local nx = CreateFrame("Frame", nil, content)
  nx:SetSize(width, 96)
  nx.bg = UI.Round(nx, 22, "BACKGROUND", 0)
  nx.bg:SetColor(C.cardHi, 1)
  nx.icon = CreateFrame("Frame", nil, nx)
  nx.icon:SetSize(48, 48)
  nx.icon:SetPoint("LEFT", 22, 0)
  nx.icon.bg = UI.Round(nx.icon, 24, "ARTWORK", 0)
  nx.icon.bg:SetGradient(UI.GRAD, 1)
  nx.icon.tex = nx.icon:CreateTexture(nil, "OVERLAY")
  nx.icon.tex:SetSize(24, 24)
  nx.icon.tex:SetPoint("CENTER")
  nx.icon.tex:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
  nx.title = UI.Text(nx, 16, "bold", C.text)
  nx.title:SetPoint("TOPLEFT", 88, -20)
  nx.title:SetWidth(width - 350)
  nx.title:SetWordWrap(false)
  nx.text = UI.Para(nx, 12, C.muted, width - 350)
  nx.text:SetPoint("TOPLEFT", nx.title, "BOTTOMLEFT", 0, -4)
  nx.btn = UI.Button(nx, "", "primary", 220, 40, "chevron")
  nx.btn:SetPoint("RIGHT", -22, 0)
  nx.btn:SetScript("OnClick", function() if self.nextAction then self.nextAction() end end)
  self.next = nx

  -- Der Gold-Kreislauf
  local loop = UI.Card(content, 22, C.card)
  loop:SetWidth(width)
  loop.title = UI.Text(loop, 18, "bold", C.text)
  loop.title:SetPoint("TOPLEFT", 20, -18)
  loop.title:SetText("So machst du Gold: kaufen, herstellen, teurer verkaufen")
  loop.sub = UI.Text(loop, 12, "regular", C.muted)
  loop.sub:SetPoint("TOPLEFT", loop.title, "BOTTOMLEFT", 0, -4)
  loop.sub:SetText("Immer der orange markierte Schritt ist dran. Ist er erledigt, kommt der nächste.")
  loop.rows = {}
  for i = 1, 4 do
    local r = loopRow(loop, width, i)
    r:SetPoint("TOPLEFT", 20, -70 - (i - 1) * 66)
    loop.rows[i] = r
  end
  loop:SetHeight(70 + 4 * 66 + 10)
  self.loop = loop

  -- Neu in Forever
  self.chanceTitle = UI.Text(content, 17, "bold", C.text)
  self.chanceTitle:SetText("Neu in Forever – deine Chancen")
  self.chanceHint = UI.Para(content, 12, C.dim, width)
  self.chanceHint:SetText("Seltene neue Materialien und neue Alchemie-Produkte. Deine Berufe stehen vorne. Klick = im AH suchen (AH muss offen sein).")
  local fw = math.floor((width - 36) / 4)
  local grid = CreateFrame("Frame", nil, content)
  grid:SetSize(width, 3 * 64 - 8)
  self.chances = {}
  for i = 1, 12 do
    local b = UI.SafeButton(grid)
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
  hero.hello:SetText("Hey " .. (p.name ~= "" and p.name or "Abenteurer") .. "!")
  hero.info:SetText("Level " .. p.level .. "  ·  " .. (FACTION[p.faction] or p.faction))
  hero.money:SetText(ns.Money(GetMoney()))
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
    if x > width - 420 then break end
  end
  if #ids == 0 then
    local c = hero.profs[1] or UI.Chip(hero, "", C.red)
    hero.profs[1] = c
    c:Set("Noch kein Beruf – lern einen Herstellungsberuf!", C.red)
    c:ClearAllPoints()
    c:SetPoint("TOPLEFT", hero.money, "TOPRIGHT", 18, -2)
    c:Show()
  end
  local y = 118 + 16

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
    y = y + 96 + 16
  else
    self.next:Hide()
    self.nextAction = nil
  end

  -- Kreislauf
  local loop = self.loop
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
    if st.state == "later" then
      r.dot.bg:SetColor(C.cardHi, 1)
      r.title:SetTextColor(C.dim[1], C.dim[2], C.dim[3], 1)
      r.bg:SetColor(C.inset, 0.6)
    elseif st.state == "done" then
      r.dot.bg:SetGradient(UI.GRAD_FRESH, 1)
      r.title:SetTextColor(C.muted[1], C.muted[2], C.muted[3], 1)
      r.bg:SetColor(C.inset, 1)
    else
      r.dot.bg:SetGradient(UI.GRAD, 1)
      r.title:SetTextColor(C.hi[1], C.hi[2], C.hi[3], 1)
      r.bg:SetColor(C.cardHi, 1)
    end
  end
  loop:ClearAllPoints()
  loop:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + loop:GetHeight() + 24

  -- Forever-Chancen
  self.chanceTitle:ClearAllPoints()
  self.chanceTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 30
  self.chanceHint:ClearAllPoints()
  self.chanceHint:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.chanceHint:GetStringHeight()) + 10
  for i, c in ipairs(ns.Guide.ForeverChances()) do
    local b = self.chances[i]
    if b then
      b.id, b.how = c.id, c.how .. (c.mine and " – passt zu deinem Beruf!" or "")
      b.icon:SetItem(c.id)
      UI.FitText(b.name, ns.Item(c.id).name, b:GetWidth() - 62)
      b.price:SetText((c.price and ns.Money(c.price) or "|cff8a9a94kein Preis|r") .. (c.mine and "  |cff61eb8f· dein Beruf|r" or ""))
    end
  end
  self.grid:ClearAllPoints()
  self.grid:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 3 * 64 - 8 + 20

  local goal
  for _, g in ipairs(ns.GOALS) do
    if p.level <= g.level then goal = g break end
  end
  self.goal:SetText(goal and ("|cffff9929Sparziel:|r " .. goal.text) or "")
  self.goal:ClearAllPoints()
  self.goal:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.goal:GetStringHeight()) + 30
  content:SetHeight(y)
end

UI.RegisterPage("home", page)
