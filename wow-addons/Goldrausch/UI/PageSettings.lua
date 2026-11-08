-- Goldrausch – Seite "Einstellungen"
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C

local page = {
  title = "Einstellungen",
  subtitle = "Alles so, wie du es magst.",
  icon = "gear", label = "Einstellungen", order = 9,
}

local function stepper(parent, label, desc, getter, setter, step, min, max, fmt, width)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(width, 54)
  f.label = UI.Text(f, 13, "semibold", C.text)
  f.label:SetPoint("TOPLEFT", 0, -4)
  f.label:SetText(label)
  f.desc = UI.Para(f, 11, C.dim, width - 190)
  f.desc:SetPoint("TOPLEFT", f.label, "BOTTOMLEFT", 0, -3)
  f.desc:SetText(desc)
  local plus = UI.IconButton(f, "plus", 28, "Mehr")
  plus:SetPoint("TOPRIGHT", 0, -4)
  local value = UI.Text(f, 13, "bold", C.gold)
  value:SetWidth(70)
  value:SetJustifyH("CENTER")
  value:SetPoint("RIGHT", plus, "LEFT", -6, 0)
  local minus = UI.IconButton(f, "minus", 28, "Weniger")
  minus:SetPoint("RIGHT", value, "LEFT", -6, 0)
  function f:Refresh() value:SetText(string.format(fmt, getter())) end
  plus:SetScript("OnClick", function()
    setter(math.min(max, getter() + step))
    f:Refresh()
  end)
  minus:SetScript("OnClick", function()
    setter(math.max(min, getter() - step))
    f:Refresh()
  end)
  f:Refresh()
  return f
end

function page.build(self, content, width)
  local st = UI.Stack(content)
  local s = ns.settings
  self.items = {}

  local function add(w, h)
    st:Add(w, h, 14)
    self.items[#self.items + 1] = w
  end

  add(UI.Toggle(content, "Minikarten-Knopf", function() return s.minimap.show end, function(v)
    s.minimap.show = v
    UI.UpdateMinimap()
  end, "Die Goldmünze an der Minikarte. Goldrausch ist zusätzlich immer im Addon-Menü der Minikarte und über /gold erreichbar.", width), 54)

  add(UI.Toggle(content, "Autopilot: Schrott automatisch verkaufen", function() return s.autoJunk end, function(v)
    s.autoJunk = v
  end, "Beim Händler wird alles Graue sofort verkauft (wie der Müll-Knopf, nur automatisch).", width), 54)

  add(UI.Toggle(content, "Händler-Panel", function() return s.merchantPanel end, function(v)
    s.merchantPanel = v
  end, "Zeigt neben dem Händlerfenster: Händler-Ware verkaufen und Flip-Schnäppchen kaufen mit einem Klick.", width), 54)

  add(UI.Toggle(content, "Beute-Radar", function() return s.lootAlerts end, function(v)
    s.lootAlerts = v
  end, "Meldet im Chat, wenn du etwas Wertvolles lootest (ab 50 Silber AH-Wert oder seltene Forever-Materialien).", width), 54)

  add(UI.Toggle(content, "AH-Hinweis", function() return s.ahHint end, function(v)
    s.ahHint = v
  end, "Sagt dir beim Öffnen des Auktionshauses, welche Items du einstellen solltest.", width), 54)

  add(UI.Toggle(content, "Händler-Hinweis im Chat", function() return s.merchantAlert end, function(v)
    s.merchantAlert = v
  end, "Meldet im Chat, wenn ein Händler etwas verkauft, das du im AH mit Gewinn weiterverkaufen kannst.", width), 54)

  add(UI.Toggle(content, "Animationen", function() return s.animations ~= false end, function(v)
    s.animations = v
    UI.UpdateAnimations()
  end, "Sanft treibende Farbflächen und Funkeln im Hintergrund. Aus = ruhiges Fenster.", width), 54)

  add(UI.Toggle(content, "Nur Wege für mein Level zeigen", function() return s.showOnlyMyLevel end, function(v)
    s.showOnlyMyLevel = v
  end, "Blendet auf der Seite \"Goldwege\" alles aus, wofür dein Level noch nicht reicht.", width), 54)

  add(stepper(content, "AH-Gebühr", "So viel Prozent behält das Auktionshaus vom Verkaufspreis ein. Standard: 5 %. Alle Gewinne werden damit berechnet.",
    function() return tonumber(s.ahCut) or 5 end, function(v) s.ahCut = v end, 1, 0, 30, "%d %%", width), 54)

  add(stepper(content, "Fenstergröße", "Skaliert das Goldrausch-Fenster.",
    function() return math.floor((tonumber(s.scale) or 1) * 100 + 0.5) end,
    function(v) s.scale = v / 100; UI.ApplyScale() end, 5, 70, 130, "%d %%", width), 54)

  st:Space(10)
  local reset = UI.Button(content, "Fensterposition zurücksetzen", "soft", 260, 34, "refresh")
  reset:SetScript("OnClick", function()
    s.point = nil
    UI.frame:ClearAllPoints()
    UI.frame:SetPoint("CENTER")
  end)
  st:Add(reset, 34, 24)

  st:Title("Befehle", 15, C.text, 2)
  st:Para("|cffffd24a/gold|r – Fenster öffnen/schließen\n"
    .. "|cffffd24a/gold wege|r · |cffffd24a/gold markt|r · |cffffd24a/gold scan|r · |cffffd24a/gold rezepte|r · |cffffd24a/gold tagebuch|r · |cffffd24a/gold ah|r\n"
    .. "|cffffd24a/gold minimap|r – Minikarten-Knopf an/aus\n"
    .. "|cffffd24a/gold reset|r – Fenster in die Mitte setzen", 12, C.muted, 16)
  st:Para("Goldrausch " .. tostring(ns.version) .. " · gebaut für WoW Forever (1.60.1). Preise kommen aus Auctionator – "
    .. "Goldrausch selbst liest nie etwas im Hintergrund aus und schickt keine Daten weg.", 11, C.dim, 10)
  st:Finish()
end

function page.refresh(self)
  for _, w in ipairs(self.items or {}) do
    if w.Refresh then w:Refresh() end
  end
end

UI.RegisterPage("settings", page)
