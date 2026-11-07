-- Goldrausch – Seite "Rezepte": Gewinn jedes gelernten Rezepts mit aktuellen Preisen
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local S = ns.Scanner

local page = {
  title = "Rezept-Gewinne",
  subtitle = "Welche deiner Rezepte gerade Gold bringen – Materialkosten gegen AH-Preis.",
  icon = "flask", label = "Rezepte", order = 6,
}

function page.build(self, content, width)
  local st = UI.Stack(content)
  st:Para("So geht's: Öffne einmal dein |cffffd24aBerufsfenster|r (z. B. Schneiderei oder Alchemie). Goldrausch merkt sich alle Rezepte "
    .. "und rechnet ab dann immer mit den neuesten AH-Preisen: |cffffd24aGewinn = AH-Erlös nach Gebühr − Materialkosten|r. "
    .. "Materialien zählen mit dem günstigeren Preis: Händler (z. B. Faden, Phiolen) oder AH.", 12, C.muted, 12)
  st:Para("Wichtig: Selbst gesammelte Materialien kosten dich nichts – aber du könntest sie auch direkt verkaufen. "
    .. "Darum rechnet Goldrausch mit ihrem Marktwert. Nur Rezepte mit grünem Gewinn lohnen sich wirklich.", 11, C.dim, 14)

  self.segHolder = CreateFrame("Frame", nil, content)
  self.segHolder:SetSize(width, 30)
  st:Add(self.segHolder, 30, 14)
  self.info = UI.Para(content, 12, C.gold, width)
  st:Add(self.info, 18, 8)
  self.list = UI.ItemList(content, width, {
    { key = "cost", label = "Material", width = 88 },
    { key = "revenue", label = "Erlös", width = 88 },
    { key = "profit", label = "Gewinn", width = 96, bold = true },
    { key = "margin", label = "Marge", width = 62 },
  })
  st:Add(self.list, nil)
  self.listTop = st.y
end

local function buildSegments(self)
  local recipes = ns.char.recipes or {}
  local names = {}
  for name in pairs(recipes) do names[#names + 1] = name end
  table.sort(names)
  local key = table.concat(names, "|")
  if self.segKey == key then return names end
  self.segKey = key
  if self.segments then self.segments:Hide() end
  if #names == 0 then
    self.segments = nil
    return names
  end
  local opts = {}
  for _, n in ipairs(names) do opts[#opts + 1] = { value = n, label = n } end
  self.segments = UI.Segments(self.segHolder, opts, function(v)
    self.prof = v
    page.refresh(self)
  end, UI.CONTENT_W)
  self.segments:SetPoint("TOPLEFT")
  if not self.prof or not recipes[self.prof] then self.prof = names[1] end
  self.segments:Select(self.prof)
  return names
end

function page.refresh(self)
  local names = buildSegments(self)
  local recipes = ns.char.recipes or {}
  local data = self.prof and recipes[self.prof]
  local entries = {}
  if not data then
    self.info:SetText(#names == 0 and "Noch keine Rezepte gespeichert – öffne dein Berufsfenster." or "")
  else
    local profitable = 0
    for _, r in ipairs(data.list) do
      local profit, revenue, cost, unknown = S.RecipeProfit(r)
      local margin = (profit and cost and cost > 0) and math.floor(profit / cost * 100 + 0.5) or nil
      if profit and profit > 0 and unknown == 0 then profitable = profitable + 1 end
      local reagentText = {}
      for _, reagent in ipairs(r.reagents) do
        reagentText[#reagentText + 1] = reagent.n .. "× " .. ns.Item(reagent.id).name
      end
      local tip = { "Material: " .. (#reagentText > 0 and table.concat(reagentText, ", ") or "keins") }
      if unknown > 0 then tip[#tip + 1] = unknown .. " Material(ien) ohne bekannten Preis – Gewinn ist unsicher." end
      if not revenue then tip[#tip + 1] = "Für das Ergebnis gibt es noch keinen AH-Preis." end
      entries[#entries + 1] = {
        id = r.out,
        name = r.name,
        note = (r.qty and r.qty > 1) and (string.format("ergibt %s Stück", r.qty % 1 == 0 and tostring(r.qty) or string.format("%.1f", r.qty))) or nil,
        sortValue = profit or -math.huge,
        cells = {
          cost = (unknown > 0 and "|cffffd24amin.|r " or "") .. ns.Money(cost),
          revenue = revenue and ns.Money(revenue) or "–",
          profit = profit and ((profit >= 0 and "|cff61eb8f+|r" or "") .. ns.Money(profit)) or "–",
          margin = margin and ((margin >= 0 and "|cff61eb8f" or "|cffff6b81") .. margin .. " %|r") or "–",
        },
        tip = tip,
      }
    end
    table.sort(entries, function(a, b) return a.sortValue > b.sortValue end)
    self.info:SetText(string.format("%s: %d Rezepte, davon %d mit sicherem Gewinn. Stand der Rezeptliste: %s.",
      self.prof, #data.list, profitable, date("%d.%m. %H:%M", data.time or time())))
  end
  local h = self.list:SetEntries(entries, "Öffne dein Berufsfenster, damit Goldrausch deine Rezepte lesen kann.")
  self.frame.content:SetHeight(self.listTop + h + 30)
end

UI.RegisterPage("recipes", page)
