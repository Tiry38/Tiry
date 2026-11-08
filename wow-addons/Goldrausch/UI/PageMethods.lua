-- Goldrausch – Seite "Goldwege": alle Methoden als aufklappbare Karten mit Live-Werten
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market

local EFFORT = { "Einfach", "Mittel", "Aufwendig" }
local CAT_LABEL = {}
for _, c in ipairs(ns.METHOD_CATS) do CAT_LABEL[c.value] = c.label end

-- Kann der Spieler diese Methode jetzt nutzen?
function ns.MethodAvailable(m)
  if m.minLevel and ns.player.level < m.minLevel then return false, "ab Level " .. m.minLevel end
  if m.class and ns.player.class ~= m.class then return false, "nur für diese Klasse" end
  return true
end

-- Live-Wert: bestes Item (netto) × Stapelgröße
function ns.MethodValue(m)
  local best, bestID
  for _, id in ipairs(m.items or {}) do
    local price = M.Price(id)
    if price then
      local item = ns.Item(id)
      local stack = math.min(item.stack or 20, 20)
      local v = M.Net(price) * stack
      if not best or v > best then best, bestID = v, id end
    end
  end
  return best, bestID
end

local page = {
  title = "Goldwege",
  subtitle = "Alle Wege zu Gold – Schritt für Schritt, mit echten Preisen deines Servers.",
  icon = "compass", label = "Goldwege", order = 2,
}

local function profName(id)
  local p = ns.professions[id]
  if p then return p.name end
  for key, v in pairs(ns.PROF) do
    if v == id then
      local names = { HERBALISM = "Kräuterkunde", MINING = "Bergbau", SKINNING = "Kürschnerei", TAILORING = "Schneiderei",
        ALCHEMY = "Alchemie", BLACKSMITHING = "Schmiedekunst", LEATHERWORKING = "Lederverarbeitung", ENGINEERING = "Ingenieurskunst",
        ENCHANTING = "Verzauberkunst", COOKING = "Kochkunst", FIRST_AID = "Erste Hilfe", FISHING = "Angeln" }
      return names[key] or key
    end
  end
  return "Beruf"
end
ns.ProfName = profName

----------------------------------------------------------------------------
-- Karte für eine Methode
----------------------------------------------------------------------------
local function createCard(parent, width)
  local card = CreateFrame("Button", nil, parent)
  card:SetWidth(width)
  card.bg = UI.Round(card, 18, "BACKGROUND", 0)
  card.bg:SetColor(C.card)
  card.accent = CreateFrame("Frame", nil, card)
  card.accent:SetSize(5, 40)
  card.accent:SetPoint("TOPLEFT", 0, -18)
  card.accent.bg = UI.Round(card.accent, 2, "ARTWORK", 0)
  card.icon = UI.ItemIcon(card, 40)
  card.icon:SetPoint("TOPLEFT", 18, -16)
  card.title = UI.Text(card, 15, "bold", C.text)
  card.title:SetPoint("TOPLEFT", card.icon, "TOPRIGHT", 14, -1)
  card.title:SetWidth(width - 260)
  card.title:SetWordWrap(false)
  card.summary = UI.Para(card, 12, C.muted, width - 90)
  card.summary:SetPoint("TOPLEFT", card.title, "BOTTOMLEFT", 0, -6)
  card.value = UI.Text(card, 15, "bold", C.gold)
  card.value:SetPoint("TOPRIGHT", -46, -18)
  card.valueSub = UI.Text(card, 10, "semibold", C.dim)
  card.valueSub:SetPoint("TOPRIGHT", card.value, "BOTTOMRIGHT", 0, -3)
  card.chev = card:CreateTexture(nil, "ARTWORK")
  card.chev:SetTexture(UI.Icon("chevron"))
  card.chev:SetSize(16, 16)
  card.chev:SetPoint("TOPRIGHT", -18, -22)
  card.chips = {}
  card.detail = CreateFrame("Frame", nil, card)
  card.detail:SetPoint("TOPLEFT", 74, 0)
  card.detail:SetSize(width - 100, 10)
  card.detailTexts = {}
  card:SetScript("OnEnter", function(self) self.bg:SetColor(C.cardHi) end)
  card:SetScript("OnLeave", function(self) self.bg:SetColor(C.card) end)
  return card
end

local function chip(card, i)
  card.chips[i] = card.chips[i] or UI.Chip(card, "", C.gold)
  return card.chips[i]
end

local function detailText(card, i, size, color, weight)
  local fs = card.detailTexts[i]
  if not fs then
    fs = UI.Para(card.detail, size, color, card.detail:GetWidth(), weight)
    card.detailTexts[i] = fs
  end
  UI.SetFont(fs, size, weight or "regular")
  fs:SetTextColor(color[1], color[2], color[3], 1)
  fs:Show()
  return fs
end

-- Füllt die Karte; liefert die Höhe
local function fillCard(card, m, expanded, width)
  local available, why = ns.MethodAvailable(m)
  local firstItem = m.items and m.items[1]
  if firstItem then card.icon:SetItem(firstItem) else card.icon:SetIcon(UI.Icon(m.icon or "star"), C.gold) end
  card.title:SetText(m.title)
  card.title:SetTextColor(available and C.text[1] or C.dim[1], available and C.text[2] or C.dim[2], available and C.text[3] or C.dim[3], 1)
  card.summary:SetText(m.summary)
  card.accent.bg:SetGradient(m.source == "forever" and UI.GRAD or UI.GRAD_COOL, 1)

  local value, valueID = ns.MethodValue(m)
  if value then
    card.value:SetText(ns.Money(value))
    card.valueSub:SetText("1 Stapel " .. ns.Item(valueID).name)
  else
    card.value:SetText(m.items and "|cff8f88b3kein Preis|r" or "")
    card.valueSub:SetText(m.items and "AH einmal scannen" or "")
  end
  card.chev:SetRotation(expanded and (-math.pi / 2) or 0)

  -- Etiketten
  local tags = {}
  tags[#tags + 1] = { CAT_LABEL[m.cat] or "", C.violet }
  if m.minLevel and m.minLevel > 1 then tags[#tags + 1] = { "ab Level " .. m.minLevel, available and C.teal or C.red } end
  if m.prof then
    local has = ns.HasProf(m.prof)
    tags[#tags + 1] = { profName(m.prof) .. (has and " (" .. ns.ProfRank(m.prof) .. ")" or ""), has and C.green or C.gold }
  end
  tags[#tags + 1] = { EFFORT[m.effort or 1], C.muted }
  tags[#tags + 1] = { m.source == "forever" and "Forever bestätigt" or "Classic-Wissen", m.source == "forever" and C.gold or C.teal }
  if not available then tags[#tags + 1] = { why, C.red } end
  local y = 16 + 22 + 6 + math.ceil(card.summary:GetStringHeight()) + 10
  local x = 72
  for i, t in ipairs(tags) do
    local c = chip(card, i)
    c:Set(t[1], t[2])
    if x + c:GetWidth() > width - 20 then
      x = 72
      y = y + 26
    end
    c:ClearAllPoints()
    c:SetPoint("TOPLEFT", card, "TOPLEFT", x, -y)
    c:Show()
    x = x + c:GetWidth() + 6
  end
  for i = #tags + 1, #card.chips do card.chips[i]:Hide() end
  y = y + 20 + 16

  for _, fs in ipairs(card.detailTexts) do fs:Hide() end
  if card.itemLine then card.itemLine:Hide() end
  if card.listBtn then card.listBtn:Hide() end
  for _, b in ipairs(card.mapBtns or {}) do b:Hide() end
  if expanded then
    local dy = 0
    local n = 0
    local function add(text, size, color, weight, gap)
      n = n + 1
      local fs = detailText(card, n, size, color, weight)
      fs:SetText(text)
      fs:ClearAllPoints()
      fs:SetPoint("TOPLEFT", card.detail, "TOPLEFT", 0, -dy)
      dy = dy + math.ceil(fs:GetStringHeight()) + (gap or 6)
    end
    add("So geht's", 13, C.gold, "bold", 6)
    for i, step in ipairs(m.steps or {}) do
      add("|cffffd24a" .. i .. ".|r  " .. step, 12, C.text, "regular", 6)
    end
    local where = m.where and m.where[ns.Faction()]
    if where then
      dy = dy + 6
      add("Wo?", 13, C.gold, "bold", 4)
      add(where, 12, C.muted, "regular", 6)
    end
    if m.tips and #m.tips > 0 then
      dy = dy + 6
      add("Profi-Tipps", 13, C.gold, "bold", 4)
      for _, tip in ipairs(m.tips) do add("•  " .. tip, 12, C.muted, "regular", 5) end
    end
    if m.farm then
      local spots = ns.Maps.Spots(m.farm)
      if #spots > 0 then
        dy = dy + 6
        add("Wo genau? (dein Level " .. ns.player.level .. ")", 13, C.gold, "bold", 4)
        card.mapBtns = card.mapBtns or {}
        for j = 1, math.min(#spots, 3) do
          local s = spots[j]
          local b = card.mapBtns[j]
          if not b then
            b = UI.Button(card.detail, "", "cool", 200, 30, "pin")
            b:SetScript("OnClick", function(self) ns.Maps.Show(self.spot, self.what) end)
            card.mapBtns[j] = b
          end
          b.spot, b.what = s, m.title
          b:SetLabel(string.format("%s %.0f,%.0f", ns.Maps.ZoneName(s.map), s.x, s.y))
          b:ClearAllPoints()
          b:SetPoint("TOPLEFT", card.detail, "TOPLEFT", (j - 1) * 208, -dy)
          b:Show()
        end
        dy = dy + 38
        add("Klick = Wegpunkt mit Pfeil + Karte. Beispiele dort: " .. table.concat(spots[1].names, ", "), 11, C.dim, "regular", 6)
      end
    end
    if m.items and #m.items > 0 then
      dy = dy + 6
      local parts = {}
      for _, id in ipairs(m.items) do
        local price = M.Price(id)
        parts[#parts + 1] = ns.Item(id).name .. " " .. (price and ns.Money(price) or "|cff8f88b3–|r")
      end
      add("Live-Preise (pro Stück): " .. table.concat(parts, "  ·  "), 11, C.dim, "regular", 10)
      if not card.listBtn then
        card.listBtn = UI.Button(card.detail, "Als Einkaufsliste", "soft", 180, 30, "cart")
        card.listBtn:SetScript("OnClick", function(self)
          local meth = self.method
          local ok, n = M.CreateShoppingList("Goldrausch: " .. meth.title, meth.items)
          if ok then
            ns.Print("Liste |cffffd24aGoldrausch: " .. meth.title .. "|r angelegt (" .. n .. " Items). Im AH: Auctionator > Einkaufen.")
          else
            ns.Print("|cffff6b81" .. tostring(n) .. "|r")
          end
        end)
      end
      card.listBtn.method = m
      card.listBtn:ClearAllPoints()
      card.listBtn:SetPoint("TOPLEFT", card.detail, "TOPLEFT", 0, -dy)
      card.listBtn:SetEnabled(M.HasAuctionator())
      card.listBtn:Show()
      dy = dy + 40
    end
    card.detail:ClearAllPoints()
    card.detail:SetPoint("TOPLEFT", card, "TOPLEFT", 72, -y)
    card.detail:SetHeight(math.max(dy, 1))
    card.detail:Show()
    y = y + dy + 8
  else
    card.detail:Hide()
  end
  card:SetHeight(y)
  return y
end

function page.build(self, content, width)
  self.cat = "all"
  self.expanded = {}
  self.cards = {}
  local st = UI.Stack(content)
  self.segments = UI.Segments(content, ns.METHOD_CATS, function(v)
    self.cat = v
    page.refresh(self)
    self.frame.scroll:ScrollToTop()
  end, width)
  st:Add(self.segments, self.segments:GetHeight(), 10)
  self.hint = UI.Para(content, 11, C.dim, width)
  st:Add(self.hint, 16, 10)
  self.top = st.y
end

function page.Focus(self, key)
  self.cat = "all"
  if self.segments then self.segments:Select("all") end
  self.expanded = { [key] = true }
  self.focusKey = key
end

function page.refresh(self)
  local width = UI.CONTENT_W
  self.hint:SetText("Karte anklicken = Anleitung aufklappen. Gold-Streifen = für Forever bestätigt, Türkis = bewährtes Classic-Wissen. "
    .. "Wert rechts = ein Stapel des wertvollsten Materials nach AH-Gebühr.")
  local list = {}
  for _, m in ipairs(ns.METHODS) do
    local okCat = (self.cat == "all" or m.cat == self.cat)
    local okLevel = not (ns.settings.showOnlyMyLevel and not ns.MethodAvailable(m))
    if okCat and okLevel then list[#list + 1] = m end
  end
  -- Sortierung: verfügbar zuerst, dann nach Live-Wert
  table.sort(list, function(a, b)
    local aa, ba = ns.MethodAvailable(a) and 1 or 0, ns.MethodAvailable(b) and 1 or 0
    if aa ~= ba then return aa > ba end
    local av, bv = ns.MethodValue(a) or 0, ns.MethodValue(b) or 0
    if av ~= bv then return av > bv end
    return a.title < b.title
  end)
  local y = self.top
  local focusY
  for i, m in ipairs(list) do
    local card = self.cards[i]
    if not card then
      card = createCard(self.frame.content, width)
      card:SetScript("OnClick", function(me)
        UI.PlayClick()
        self.expanded[me.method.key] = not self.expanded[me.method.key]
        page.refresh(self)
      end)
      self.cards[i] = card
    end
    card.method = m
    card:ClearAllPoints()
    card:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
    local h = fillCard(card, m, self.expanded[m.key], width)
    card:Show()
    if self.focusKey == m.key then focusY = y end
    y = y + h + 12
  end
  for i = #list + 1, #self.cards do self.cards[i]:Hide() end
  self.frame.content:SetHeight(y + 20)
  if focusY then
    self.focusKey = nil
    C_Timer.After(0, function()
      local range = self.frame.scroll:GetVerticalScrollRange() or 0
      self.frame.scroll:SetVerticalScroll(math.min(focusY, range))
      self.frame.scroll.UpdateBar()
    end)
  end
end

UI.RegisterPage("methods", page)
