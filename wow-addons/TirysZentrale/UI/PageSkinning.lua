-- Tiry's Zentrale – Seite "Kürschner": Häuten-Rechner, beste Spots für dein Level, Leder & Preise, Spezial-Leder, eigene Fundorte
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local K = ns.Skin

local page = {
  title = "Kürschner-Zentrale",
  subtitle = "Das beste Leder für dein Level – mit Kartenpunkt und Live-Preisen.",
  icon = "paw", label = "Kürschner", order = 2.6,
}

-- Zeile für eine Farm-Stelle (ganze Zeile klickbar = Wegpunkt)
local function spotRow(parent, width)
  local b = CreateFrame("Button", nil, parent)
  b:SetSize(width, 52)
  b.bg = UI.Round(b, 16, "BACKGROUND", 0)
  b.bg:SetColor(C.card)
  b.dot = CreateFrame("Frame", nil, b)
  b.dot:SetSize(36, 36)
  b.dot:SetPoint("LEFT", 10, 0)
  b.dot.bg = UI.Round(b.dot, 18, "ARTWORK", 0)
  b.dot.icon = b.dot:CreateTexture(nil, "OVERLAY")
  b.dot.icon:SetTexture(UI.Icon("pin"))
  b.dot.icon:SetSize(18, 18)
  b.dot.icon:SetPoint("CENTER")
  b.dot.icon:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
  b.title = UI.Text(b, 13, "bold", C.text)
  b.title:SetPoint("TOPLEFT", b.dot, "TOPRIGHT", 12, -1)
  b.sub = UI.Text(b, 11, "regular", C.muted)
  b.sub:SetPoint("TOPLEFT", b.title, "BOTTOMLEFT", 0, -3)
  b.sub:SetWidth(width - 190)
  b.sub:SetJustifyH("LEFT")
  b.sub:SetWordWrap(false)
  b.go = UI.Chip(b, "Wegpunkt", C.teal)
  b.go:SetPoint("RIGHT", -14, 0)
  b:SetScript("OnEnter", function(self) self.bg:SetColor(C.cardHi) end)
  b:SetScript("OnLeave", function(self) self.bg:SetColor(C.card) end)
  b:SetScript("OnClick", function(self) UI.PlayClick() ns.Maps.Show(self.spot, self.what) end)
  function b:Set(spot, title, sub, what, grad)
    self.spot, self.what = spot, what
    self.title:SetText(title)
    UI.FitText(self.sub, sub, width - 190)
    self.dot.bg:SetGradient(grad or UI.GRAD, 1)
  end
  return b
end

local function heroStat(parent, w, label)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(w, 70)
  f.label = UI.Text(f, 10, "semibold", C.gold)
  f.label:SetPoint("TOPLEFT", 0, 0)
  f.label:SetText(label:upper())
  f.value = UI.Text(f, 22, "bold", C.text)
  f.value:SetPoint("TOPLEFT", f.label, "BOTTOMLEFT", 0, -6)
  f.sub = UI.Text(f, 11, "regular", C.muted)
  f.sub:SetPoint("TOPLEFT", f.value, "BOTTOMLEFT", 0, -4)
  f.sub:SetWidth(w)
  f.sub:SetWordWrap(false)
  return f
end

function page.build(self, content, width)
  self.width = width
  -- Kopf: Skill, Reichweite, Ziel
  local hero = CreateFrame("Frame", nil, content)
  hero:SetSize(width, 168)
  hero.bg = UI.Round(hero, 22, "BACKGROUND", 0)
  hero.bg:SetGradient({ { 0.10, 0.25, 0.15 }, { 0.08, 0.18, 0.15 }, { 0.12, 0.15, 0.17 } }, 0.97)
  local glow = UI.Glow(hero, C.teal, 320, 0.18, "BACKGROUND")
  glow:SetPoint("CENTER", hero, "RIGHT", -60, 0)
  UI.Drift(glow, -60, 10, 8, 0.2, 0.08)
  local cw = math.floor((width - 60) / 3)
  hero.skill = heroStat(hero, cw, "Dein Skill")
  hero.skill:SetPoint("TOPLEFT", 22, -20)
  hero.reach = heroStat(hero, cw, "Du häutest bis")
  hero.reach:SetPoint("TOPLEFT", hero.skill, "TOPRIGHT", 8, 0)
  hero.target = heroStat(hero, cw, "Ideal jetzt")
  hero.target:SetPoint("TOPLEFT", hero.reach, "TOPRIGHT", 8, 0)
  -- Fortschritt bis zur nächsten Lederstufe
  hero.bar = CreateFrame("Frame", nil, hero)
  hero.bar:SetSize(width - 44, 12)
  hero.bar:SetPoint("BOTTOMLEFT", 22, 40)
  hero.bar.bg = UI.Round(hero.bar, 6, "ARTWORK", 0)
  hero.bar.bg:SetColor(C.inset, 1)
  hero.bar.fill = CreateFrame("Frame", nil, hero.bar)
  hero.bar.fill:SetPoint("TOPLEFT")
  hero.bar.fill:SetHeight(12)
  hero.bar.fill.bg = UI.Round(hero.bar.fill, 6, "OVERLAY", 0)
  hero.bar.fill.bg:SetGradient(UI.GRAD_FRESH, 1)
  hero.next = UI.Text(hero, 11, "semibold", C.text)
  hero.next:SetPoint("BOTTOMLEFT", 22, 16)
  self.hero = hero

  self.spotTitle = UI.Text(content, 17, "bold", C.text)
  self.spotTitle:SetText("Deine besten Häut-Spots")
  self.spotHint = UI.Para(content, 11, C.dim, width)
  self.spotRows = {}
  self.leatherTitle = UI.Text(content, 17, "bold", C.text)
  self.leatherTitle:SetText("Leder & Preise für dich")
  self.leatherList = UI.ItemList(content, width, {
    { key = "lvl", label = "Tierlevel", width = 80 },
    { key = "ah", label = "AH-Preis", width = 88 },
    { key = "stack", label = "Stapel netto", width = 104, bold = true },
  })
  self.specialTitle = UI.Text(content, 17, "bold", C.text)
  self.specialTitle:SetText("Spezial-Leder (für Lederverarbeiter Gold wert)")
  self.specialRows = {}
  self.mineTitle = UI.Text(content, 17, "bold", C.text)
  self.mineTitle:SetText("Deine eigenen Fundorte")
  self.mineHint = UI.Para(content, 11, C.dim, width)
  self.mineRows = {}
  self.tips = UI.Para(content, 12, C.muted, width)
  self.craftBtn = UI.Button(content, "Leder zu Gold machen: Craft-Planer", "primary", 330, 36, "flask")
  self.craftBtn:SetScript("OnClick", function()
    UI.Show("recipes")
    local p = UI.pages.recipes
    if ns.HasProf(ns.PROF.LEATHERWORKING) then p.prof = "LEATHERWORKING" UI.RefreshPage("recipes") end
  end)
end

local function place(self, region, y, h)
  region:ClearAllPoints()
  region:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
  region:Show()
  return y + h
end

function page.refresh(self)
  local width = self.width
  local hero = self.hero
  local has = ns.HasProf(ns.PROF.SKINNING)
  local rank = ns.ProfRank(ns.PROF.SKINNING)
  local maxRank = has and ns.professions[ns.PROF.SKINNING].maxRank or 0
  local target, maxSkin = K.TargetLevel()
  local tier = K.TierFor(target)

  if has then
    hero.skill.value:SetText(rank .. " / " .. maxRank)
    hero.skill.sub:SetText(rank >= maxRank and "|cffff6b81Maximum – beim Lehrer die nächste Stufe lernen!|r" or "Kürschnerei")
    hero.reach.value:SetText("Level " .. maxSkin)
    hero.reach.sub:SetText("höchstes häutbares Tier")
  else
    hero.skill.value:SetText("–")
    hero.skill.sub:SetText("|cffff6b81Noch keine Kürschnerei gelernt|r")
    hero.reach.value:SetText("–")
    hero.reach.sub:SetText("Lehrer in jeder Hauptstadt")
  end
  hero.target.value:SetText("Tiere Level " .. target)
  hero.target.sub:SetText(tier.label)

  -- Fortschritt bis zur nächsten Lederstufe
  local nextTier
  for _, t in ipairs(K.TIERS) do if t.from > tier.from then nextTier = t break end end
  if has and nextTier then
    local need = K.SkillFor(nextTier.from)
    local prev = K.SkillFor(tier.from)
    local frac = ns.Clamp((rank - prev) / math.max(need - prev, 1), 0, 1)
    hero.bar.fill:SetWidth(math.max((width - 44) * frac, 12))
    if rank >= need then
      hero.next:SetText("Skill reicht für " .. nextTier.label .. " – dir fehlt nur noch Level " .. nextTier.from .. ".")
    else
      hero.next:SetText(string.format("Noch |cff8cff4d%d Skillpunkte|r bis %s (Tiere ab Level %d, Skill %d).", need - rank, nextTier.label, nextTier.from, need))
    end
  else
    hero.bar.fill:SetWidth(width - 44)
    hero.next:SetText(has and "Höchste Lederstufe erreicht – jetzt zählen Spezial-Leder!" or "Kürschnermesser kaufst du beim Handwerkswarenhändler. Jedes Tier, das du besiegst, wird zu Gold.")
  end
  local y = place(self, hero, 0, 168) + 20

  -- Häut-Spots
  y = place(self, self.spotTitle, y, 26)
  local spots = K.Spots(target)
  self.spotHint:SetText(#spots > 0 and string.format("Tiere passend zu deinem Ziel-Level %d (dein Level + Skill). Klick = Wegpunkt mit Pfeil. Daten: Fundorte aus QuestieDB (Forever).", target)
    or "Für dieses Level sind keine Häut-Spots hinterlegt.")
  y = place(self, self.spotHint, y, math.ceil(self.spotHint:GetStringHeight()) + 10)
  for i = 1, 6 do
    local s = spots[i]
    local row = self.spotRows[i] or spotRow(self.frame.content, width)
    self.spotRows[i] = row
    if s then
      local t = K.TierFor(s.hi)
      row:Set(s, string.format("%s  %.0f, %.0f", ns.Maps.ZoneName(s.map), s.x, s.y),
        string.format("Level %d–%d · %d Tiere · %s · %s", s.lo, s.hi, s.n, t.label, table.concat(s.names, ", ")),
        "Häuten: " .. table.concat(s.names, ", "), i == 1 and UI.GRAD or UI.GRAD_COOL)
      y = place(self, row, y, 52) + 8
    else
      row:Hide()
    end
  end
  y = y + 14

  -- Leder & Preise: aktuelle + nächste Stufe + Forever-Neuheiten
  y = place(self, self.leatherTitle, y, 30)
  local entries, seen = {}, {}
  local function add(id, lvl, note)
    if seen[id] then return end
    seen[id] = true
    local price = M.Price(id)
    local stack = math.min(ns.Item(id).stack or 20, 20)
    entries[#entries + 1] = {
      id = id, note = note,
      cells = {
        lvl = lvl,
        ah = price and ns.Money(price) or "|cff8a9a94–|r",
        stack = price and ns.Money(M.Net(price) * stack) or "|cff8a9a94–|r",
      },
      tip = { price and ("Bester Verkauf: " .. ((select(1, M.BestSale(id)) == "AH") and "Auktionshaus" or "Händler")) or "Noch kein AH-Preis – oben auf \"AH scannen\"." },
    }
  end
  for _, id in ipairs(tier.items) do add(id, tier.from .. "–" .. (tier.to - 1), "Deine Stufe jetzt") end
  if nextTier then for _, id in ipairs(nextTier.items) do add(id, nextTier.from .. "–" .. (nextTier.to - 1), "Nächste Stufe") end end
  for _, id in ipairs(K.FOREVER) do add(id, "alle", "|cff8cff4dNeu in Forever|r · selten, von jedem häutbaren Tier") end
  local h = self.leatherList:SetEntries(entries)
  y = place(self, self.leatherList, y, h) + 20

  -- Spezial-Leder
  y = place(self, self.specialTitle, y, 30)
  local enemy = (ns.Faction() == "Horde") and "Alliance" or "Horde"
  for i, sp in ipairs(K.SPECIAL) do
    local row = self.specialRows[i] or spotRow(self.frame.content, width)
    self.specialRows[i] = row
    local spot
    for _, s in ipairs((ns.SKIN_SPOTS or {})[sp.id] or {}) do
      if ns.ZONE_FACTION[s.map] ~= enemy then spot = s break end
    end
    local price = M.Price(sp.id)
    local item = ns.Item(sp.id)
    row:Set(spot, item.name .. "  ·  " .. (price and ns.Money(price) or "kein AH-Preis"),
      sp.who .. " · ab Tierlevel " .. sp.lvl .. " (Skill " .. K.SkillFor(sp.lvl) .. ")"
        .. (spot and string.format(" · %s %.0f, %.0f", ns.Maps.ZoneName(spot.map), spot.x, spot.y) or " · keine Fundorte hinterlegt"),
      "Spezial-Leder: " .. item.name, (target >= sp.lvl) and UI.GRAD_FRESH or UI.GRAD_COOL)
    row.go:SetShown(spot ~= nil)
    row:SetEnabled(spot ~= nil)
    y = place(self, row, y, 52) + 8
  end
  y = y + 14

  -- Eigene Fundorte (wie GatherMate)
  y = place(self, self.mineTitle, y, 26)
  local mine, total = K.MySpots("leather", 3)
  self.mineHint:SetText(total > 0 and ("Tiry's Zentrale merkt sich automatisch, wo du Leder bekommst (" .. total .. " Fundpunkte). Deine ergiebigsten Stellen:")
    or "Noch nichts gemerkt. Sobald du häutest, speichert Tiry's Zentrale automatisch deine Fundorte – hier erscheinen dann deine besten Stellen.")
  y = place(self, self.mineHint, y, math.ceil(self.mineHint:GetStringHeight()) + 10)
  for i = 1, 3 do
    local s = mine[i]
    local row = self.mineRows[i] or spotRow(self.frame.content, width)
    self.mineRows[i] = row
    if s then
      row:Set(s, string.format("%s  %.0f, %.0f", ns.Maps.ZoneName(s.map), s.x, s.y),
        s.n .. "× gehäutet · " .. table.concat(s.names, ", "), "Dein Fundort", UI.GRAD)
      y = place(self, row, y, 52) + 8
    else
      row:Hide()
    end
  end
  y = y + 10

  self.tips:SetText("|cff8cff4dProfi-Tipps|r\n"
    .. "•  Häute auch Tiere, die andere Spieler erlegt haben – das kostet nichts und bringt Skill.\n"
    .. "•  Orange und gelbe Tiere (im Tooltip) bringen Skillpunkte, grüne seltener, graue nie.\n"
    .. "•  Makelloses Leder & Co. nie zum Händler – der Beute-Radar warnt dich.\n"
    .. "•  Mit Lederverarbeitung wird aus Leder oft mehr Gold: der Craft-Planer zeigt dir, welche Rezepte sich lohnen.")
  y = place(self, self.tips, y, math.ceil(self.tips:GetStringHeight()) + 14)
  y = place(self, self.craftBtn, y, 36) + 10
  self.frame.content:SetHeight(y + 20)
end

ns.Listen("LOOT_VALUED", function()
  if UI.IsShown("skinning") then ns.Debounce("skinpage", 0.5, function() UI.RefreshPage("skinning") end) end
end)

UI.RegisterPage("skinning", page)
