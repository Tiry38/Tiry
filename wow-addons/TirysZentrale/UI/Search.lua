-- Tiry's Zentrale – globale Suche (Knopf "Suchen" oben oder Tastenkürzel): Items, Rezepte, Goldwege, Glossar
local _, ns = ...
local UI = ns.UI
local C = UI.C

local SR = {}
UI.Search = SR
local panel
local MAX_ROWS = 14

local KIND = {
  method = { "Goldweg", "compass" }, recipe = { "Rezept", "flask" }, item = { "Item", "db" }, term = { "Begriff", "info" },
}

-- Treffer sammeln (je Art begrenzt, damit alles auf einen Blick passt)
function SR.Find(text)
  local q = ns.DB.Lower(text or "")
  local out = {}
  if #q < 2 then return out end
  for _, m in ipairs(ns.METHODS or {}) do
    if ns.DB.Lower(m.title .. " " .. (m.summary or "")):find(q, 1, true) then
      out[#out + 1] = { kind = "method", label = m.title, key = m.key }
      if #out >= 3 then break end
    end
  end
  local n = 0
  for _, list in pairs(ns.Recipes.Load()) do
    for _, r in ipairs(list) do
      if n < 4 and ns.DB.Lower(r.name):find(q, 1, true) then
        n = n + 1
        out[#out + 1] = { kind = "recipe", label = r.name .. "  |cff93a39d· " .. ns.ProfName(ns.PROF[r.prof]) .. (ns.Recipes.IsKnown(r) and " (gelernt)" or "") .. "|r", recipe = r }
      end
    end
  end
  for _, g in ipairs(ns.GLOSSARY or {}) do
    if ns.DB.Lower(g[1]):find(q, 1, true) then out[#out + 1] = { kind = "term", label = g[1], term = g[1] } end
  end
  local items = ns.DB.Search(text)
  for i = 1, math.min(#items, MAX_ROWS - #out) do
    local e = items[i]
    local price = ns.Market.Price(e.id)
    out[#out + 1] = { kind = "item", label = e.name .. (price and ("  |cff93a39d· " .. ns.Money(price) .. "|r") or ""), id = e.id, name = e.name }
  end
  return out
end

local function open(hit)
  SR.Hide()
  if hit.kind == "method" then
    UI.Show("methods")
    local mp = UI.pages.methods
    if mp.Focus then mp.Focus(mp, hit.key) UI.RefreshPage("methods") end
  elseif hit.kind == "recipe" then
    UI.Show("recipes")
    local rp = UI.pages.recipes
    if ns.HasProf(ns.PROF[hit.recipe.prof]) then
      rp.prof = hit.recipe.prof
      rp.view = ns.Recipes.IsKnown(hit.recipe) and "known" or "learnable"
      UI.RefreshPage("recipes")
    else
      ns.Print(hit.recipe.name .. " gehört zu " .. ns.ProfName(ns.PROF[hit.recipe.prof]) .. " – den Beruf hast du (noch) nicht.")
    end
  elseif hit.kind == "term" then
    UI.Show("glossary")
    local gp = UI.pages.glossary
    if gp.search then gp.search.edit:SetText(hit.term) end
  else
    UI.Show("database")
    local dp = UI.pages.database
    if dp.search then dp.search.edit:SetText(hit.name) end
  end
end

local function create()
  local f = UI.frame
  local p = CreateFrame("Frame", nil, f)
  p:SetSize(620, 520)
  p:SetPoint("TOP", f, "TOP", 107, -64)
  p:SetFrameLevel(f:GetFrameLevel() + 30)
  p:EnableMouse(true)
  p.bg = UI.Round(p, 22, "BACKGROUND", 1)
  p.bg:SetColor(C.side, 1)
  p.box = UI.SearchBox(p, 580, "Alles durchsuchen: Item, Rezept, Goldweg, Begriff ...", function(t)
    p.text = t
    ns.Debounce("globalsearch", 0.2, SR.Refresh)
  end)
  p.box:SetPoint("TOP", 0, -20)
  p.box.edit:SetScript("OnEscapePressed", function() SR.Hide() end)
  p.box.edit:SetScript("OnEnterPressed", function() if p.hits and p.hits[1] then open(p.hits[1]) end end)
  p.rows = {}
  for i = 1, MAX_ROWS do
    local b = UI.SafeButton(p)
    b:SetSize(580, 30)
    b:SetPoint("TOP", 0, -66 - (i - 1) * 31)
    b.bg = UI.Round(b, 15, "BACKGROUND", 2)
    b.bg:SetColor(C.card, 1)
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetSize(16, 16)
    b.icon:SetPoint("LEFT", 14, 0)
    b.kind = UI.Text(b, 12, "semibold", C.hi)
    b.kind:SetPoint("LEFT", 38, 0)
    b.kind:SetWidth(80)
    b.text = UI.Text(b, 13, "semibold", C.text)
    b.text:SetPoint("LEFT", 124, 0)
    b.text:SetWidth(440)
    b.text:SetWordWrap(false)
    b:SetScript("OnEnter", function(self) self.bg:SetColor(C.cardHi, 1) end)
    b:SetScript("OnLeave", function(self) self.bg:SetColor(C.card, 1) end)
    b:SetScript("OnClick", function(self) if self.hit then open(self.hit) end end)
    b:Hide()
    p.rows[i] = b
  end
  p.empty = UI.Para(p, 12, C.muted, 560)
  p.empty:SetPoint("TOP", 0, -72)
  local close = UI.IconButton(p, "close", 26, "Schließen")
  close:SetPoint("TOPRIGHT", -8, -8)
  close:SetScript("OnClick", function() SR.Hide() end)
  p:Hide()
  return p
end

function SR.Refresh()
  if not panel or not panel:IsShown() then return end
  local hits = SR.Find(panel.text)
  panel.hits = hits
  for i, b in ipairs(panel.rows) do
    local h = hits[i]
    b.hit = h
    if h then
      b.icon:SetTexture(UI.Icon(KIND[h.kind][2]))
      b.icon:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], 1)
      b.kind:SetText(KIND[h.kind][1])
      UI.FitText(b.text, h.label, 440)
      b:Show()
    else
      b:Hide()
    end
  end
  local short = not panel.text or #panel.text < 2
  panel.empty:SetText(short and "Mindestens 2 Buchstaben eingeben. Enter öffnet den ersten Treffer, Esc schließt."
    or (#hits == 0 and "Nichts gefunden. Tipp: nur einen Wortteil eingeben, z. B. \"leder\"." or ""))
  panel.empty:SetShown(short or #hits == 0)
  panel:SetHeight(short and 110 or math.max(110, 76 + #hits * 31 + 14))
end

function SR.Show()
  if not (UI.frame and UI.frame:IsShown()) then UI.Show(ns.settings.lastPage or "home") end
  panel = panel or create()
  panel:Show()
  panel.box.edit:SetText("")
  panel.text = ""
  panel.box.edit:SetFocus()
  SR.Refresh()
end

function SR.Hide()
  if panel then panel.box.edit:ClearFocus() panel:Hide() end
end

function SR.Toggle()
  if panel and panel:IsShown() then SR.Hide() else SR.Show() end
end
