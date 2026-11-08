-- Tiry's Zentrale – Ansicht "Berufe-Berater": beste Sammelberufe für dein Level + günstigster Skill-Plan
local _, ns = ...
local UI = ns.UI
local C = UI.C
local AD = ns.Advisor

local page = {
  title = "Berufe-Berater",
  subtitle = "Welche Berufe dir jetzt Gold bringen – und wie du am günstigsten skillst.",
  icon = "star", label = "Berufe-Berater", order = 12,
}

local STEPS = { { value = 10, label = "+10 Skill" }, { value = 25, label = "+25 Skill" }, { value = 50, label = "+50 Skill" } }

local function gatherCard(parent, w)
  local c = UI.Card(parent, 18, C.card)
  c:SetSize(w, 118)
  c.rank = UI.Chip(c, "", C.hi, true)
  c.rank:SetPoint("TOPLEFT", 16, -14)
  c.icon = UI.ItemIcon(c, 36)
  c.icon:SetPoint("TOPRIGHT", -14, -12)
  c.name = UI.Text(c, 15, "bold", C.text)
  c.name:SetPoint("TOPLEFT", 16, -48)
  c.value = UI.Text(c, 14, "bold", C.hi)
  c.value:SetPoint("TOPLEFT", c.name, "BOTTOMLEFT", 0, -6)
  c.have = UI.Text(c, 12, "semibold", C.dim)
  c.have:SetPoint("TOPLEFT", c.value, "BOTTOMLEFT", 0, -4)
  c.have:SetWidth(w - 32)
  c.have:SetWordWrap(false)
  return c
end

function page.build(self, content, width)
  local st = UI.Stack(content)
  st:Title("Welche Sammelberufe bringen dir am meisten?", 17, C.text, 2)
  self.gHint = UI.Para(content, 12, C.muted, width)
  st:Add(self.gHint, 34, 10)
  local cw = math.floor((width - 24) / 3)
  local row = CreateFrame("Frame", nil, content)
  row:SetSize(width, 118)
  self.gCards = {}
  for i = 1, 3 do
    local c = gatherCard(row, cw)
    c:SetPoint("TOPLEFT", (i - 1) * (cw + 12), 0)
    self.gCards[i] = c
  end
  st:Add(row, 118, 12)
  self.advice = UI.Para(content, 13, C.text, width, "semibold")
  st:Add(self.advice, 40, 22)

  st:Title("Skill-Plan: am günstigsten hochskillen", 17, C.text, 2)
  self.pHint = UI.Para(content, 12, C.muted, width)
  self.pHint:SetText("Nur mit Rezepten, die du schon kannst. Kosten = Materialpreise (Händler oder AH, je nachdem was billiger ist). "
    .. "Gelbe Rezepte brauchen im Schnitt mehrere Versuche – das ist eingerechnet.")
  st:Add(self.pHint, 34, 10)
  self.profHolder = CreateFrame("Frame", nil, content)
  self.profHolder:SetSize(width, 30)
  st:Add(self.profHolder, 30, 8)
  self.stepSeg = UI.Segments(content, STEPS, function(v) self.steps = v page.refresh(self) end, width)
  st:Add(self.stepSeg, self.stepSeg:GetHeight(), 12)
  self.steps = 25
  self.stepSeg:Select(25)
  self.planText = UI.Para(content, 13, C.text, width)
  self.planTop = st.y
  -- Hol dir diese Rezepte (Position wird in refresh berechnet)
  self.tipTitle = UI.Text(content, 17, "bold", C.text)
  self.tipTitle:SetText("Hol dir diese Rezepte")
  self.tipHint = UI.Para(content, 12, C.muted, width)
  self.tipHint:SetText("Rezepte, die du noch nicht kannst, die dein Skill schafft und die pro Craft mindestens deinen Mindestgewinn bringen. "
    .. "Klick: im AH suchen · Shift-Klick: Rezept in die Auctionator-Suche legen (Suchfeld vorher anklicken).")
  self.tipList = UI.ItemList(content, width, {
    { key = "profit", label = "Gewinn/Craft", width = 110, bold = true },
    { key = "price", label = "Rezept im AH", width = 110 },
    { key = "back", label = "Bezahlt nach", width = 110 },
  })
  self.tipBtn = UI.Button(content, "Alle Rezepte im AH suchen", "cool", 280, 34, "scan")
  self.tipBtn:SetScript("OnClick", function()
    local ids = {}
    for _, t in ipairs(self.tips or {}) do if t.item then ids[#ids + 1] = t.item end end
    if #ids == 0 then ns.Print("Diese Rezepte lernst du alle beim Lehrer.") return end
    if ns.Market.ahOpen then
      local ok, err = ns.Market.SearchNow(ids)
      if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
    else
      local ok, n = ns.Market.CreateShoppingList("Zentrale: Rezepte", ids)
      ns.Print(ok and ("Liste |cffff9929Zentrale: Rezepte|r angelegt (" .. n .. "). Im AH: Auctionator > Einkaufen.") or ("|cffff6b81" .. tostring(n) .. "|r"))
    end
  end)

  self.queueBtn = UI.Button(content, "In die Craft-Liste + Einkaufsliste", "primary", 330, 36, "cart")
  self.queueBtn:SetScript("OnClick", function()
    local n = AD.ToQueue(self.plan)
    if n > 0 then
      ns.Print("Skill-Plan übernommen: " .. n .. " Rezepte in der Craft-Liste. Die Einkaufsliste zeigt dir, was du kaufen musst.")
      ns.Shop.Show()
      UI.RefreshPage("recipes")
    end
  end)
end

local function profSegments(self)
  local list = ns.Recipes.MyProfessions()
  local key = table.concat(list, ",")
  if self.segKey ~= key then
    self.segKey = key
    if self.profSeg then self.profSeg:Hide() end
    local opts = {}
    for _, k in ipairs(list) do opts[#opts + 1] = { value = k, label = ns.ProfName(ns.PROF[k]) } end
    if #opts > 0 then
      self.profSeg = UI.Segments(self.profHolder, opts, function(v) self.prof = v page.refresh(self) end, UI.CONTENT_W)
      self.profSeg:SetPoint("TOPLEFT")
      if not self.prof or not ns.PROF[self.prof] or not ns.HasProf(ns.PROF[self.prof]) then self.prof = list[1] end
      self.profSeg:Select(self.prof)
    else
      self.profSeg = nil
      self.prof = nil
    end
  end
  return list
end

function page.refresh(self)
  -- Sammelberufe
  local ranked, band = AD.Gathering(ns.player.level)
  local withPrice = 0
  for _, r in ipairs(ranked) do if r.value then withPrice = withPrice + 1 end end
  self.gHint:SetText(string.format("Gerechnet für deinen Levelbereich %s mit den Live-Preisen der wichtigsten Materialien (Durchschnitt der 3 teuersten, ein voller Stapel nach AH-Gebühr).", band.key))
  for i, c in ipairs(self.gCards) do
    local r = ranked[i]
    c.rank:Set("#" .. i, i == 1 and C.hi or C.teal, true)
    c.name:SetText(ns.ProfName(r.id))
    c.value:SetText(r.value and (ns.Money(r.value) .. " pro Stapel") or "noch kein Preis")
    if r.best then c.icon:SetItem(r.best) else c.icon:SetIcon(UI.Icon("star"), C.gold) end
    c.have:SetText(r.have and "|cff61eb8fhast du schon|r" or ("Beispiel: " .. (r.best and ns.Item(r.best).name or "AH scannen für Preise")))
  end
  local craft = AD.ClassCraft()
  local a, b = ranked[1], ranked[2]
  local text
  if withPrice >= 2 then
    text = string.format("Empfehlung: |cffff9929%s + %s|r – die beiden bringen dir auf Level %d gerade am meisten.", ns.ProfName(a.id), ns.ProfName(b.id), ns.player.level)
  else
    text = "Empfehlung: zwei Sammelberufe (z. B. Kürschnerei + Kräuterkunde). Für eine genaue Rangliste einmal im AH scannen."
  end
  if craft then
    text = text .. "\nSpäter passt zu deiner Klasse: |cffff9929" .. ns.ProfName(ns.PROF[craft[1]]) .. "|r – " .. craft[2] .. "."
  end
  self.advice:SetText(text)

  -- Skill-Plan
  local profs = profSegments(self)
  local content = self.frame.content
  local y = self.planTop
  local lines = {}
  self.plan = nil
  if #profs == 0 then
    lines[1] = "Du hast noch keinen Herstellungsberuf. Lern einen beim Lehrer – dann rechnet Tiry's Zentrale hier deinen günstigsten Skill-Weg aus."
  else
    local plan, err = AD.Plan(self.prof, self.steps)
    if not plan then
      lines[1] = err
    elseif #plan.steps == 0 then
      lines[1] = "Keins deiner gelernten Rezepte gibt gerade noch Skill (oder es fehlen Preise). Lern beim Lehrer neue Rezepte – Tipp: Craft-Planer > \"Lernen lohnt sich\"."
    else
      self.plan = plan
      for _, s in ipairs(plan.steps) do
        lines[#lines + 1] = string.format("|cffff9929Skill %d bis %d:|r %d× %s  |cff93a39d(%s)|r", s.from, s.to, s.crafts, s.recipe.name, ns.Money(s.cost))
      end
      local mats = {}
      for id, n in pairs(plan.mats) do mats[#mats + 1] = n .. "× " .. ns.Item(id).name end
      table.sort(mats)
      lines[#lines + 1] = ""
      lines[#lines + 1] = "|cffff9929Material zusammen:|r " .. table.concat(mats, ", ")
      lines[#lines + 1] = string.format("|cffff9929Kosten gesamt: %s|r%s", ns.Money(plan.total),
        plan.reached < plan.target and string.format("  |cff93a39d(reicht bis Skill %d – danach neue Rezepte lernen)|r", plan.reached) or "")
    end
  end
  self.planText:SetText(table.concat(lines, "\n"))
  self.planText:ClearAllPoints()
  self.planText:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.planText:GetStringHeight()) + 14
  self.queueBtn:ClearAllPoints()
  self.queueBtn:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  self.queueBtn:SetShown(self.plan ~= nil)
  if self.plan then y = y + 36 + 14 end

  -- Hol dir diese Rezepte
  y = y + 12
  self.tipTitle:ClearAllPoints()
  self.tipTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 30
  self.tipHint:ClearAllPoints()
  self.tipHint:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.tipHint:GetStringHeight()) + 10
  local tips = AD.RecipeTips(8)
  self.tips = tips
  local entries = {}
  for _, t in ipairs(tips) do
    local r = t.r
    local notes = { "macht " .. ns.Item(r.out).name, ns.ProfName(ns.PROF[t.prof]) }
    if t.skillUp then notes[#notes + 1] = "|cff61eb8fgibt dir Skill|r" end
    if not t.item then notes[#notes + 1] = "|cffff9929beim Lehrer lernen|r" end
    entries[#entries + 1] = {
      id = t.item or r.out,
      name = t.item and ns.Item(t.item).name or (r.name .. " (Lehrer)"),
      note = table.concat(notes, " · "),
      cells = {
        profit = "|cffff9929+|r" .. ns.Money(t.profit),
        price = t.item and (t.price and ns.Money(t.price) or "|cff8a9a94kein Angebot|r") or "|cff8a9a94Lehrer|r",
        back = t.payback and (t.payback .. " Crafts") or "–",
      },
      tip = { t.item and "Klick: im AH suchen · Shift-Klick: in die Auctionator-Suche legen" or "Lernst du beim Lehrer deines Berufs." },
      onClick = function()
        if not t.item then ns.Print(r.name .. " lernst du beim Lehrer für " .. ns.ProfName(ns.PROF[t.prof]) .. ".") return end
        local ok, err = ns.Market.SearchNow({ t.item })
        if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r Tipp: Shift-Klick legt das Rezept in die Auctionator-Suche.") end
      end,
    }
  end
  self.tipList:ClearAllPoints()
  self.tipList:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + self.tipList:SetEntries(entries, #profs == 0 and "Lern zuerst einen Herstellungsberuf – dann siehst du hier, welche Rezepte sich lohnen."
    or "Gerade bringt kein neues Rezept genug Gold (oder es fehlen AH-Preise). Tipp: einmal im AH scannen.") + 12
  self.tipBtn:ClearAllPoints()
  self.tipBtn:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  self.tipBtn:SetShown(#tips > 0)
  if #tips > 0 then y = y + 34 + 12 end
  content:SetHeight(y + 30)
end

ns.Listen("PROFESSIONS_CHANGED", function() local p = UI.pages.advisor if p then p.segKey = nil end end)

UI.RegisterPage("advisor", page)
