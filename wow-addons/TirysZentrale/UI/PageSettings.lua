-- Tiry's Zentrale – Seite "Einstellungen"
local _, ns = ...
local UI = ns.UI
local C = UI.C

local page = {
  title = "Einstellungen",
  subtitle = "Alles so, wie du es magst.",
  icon = "gear", label = "Einstellungen", order = 9,
}

local function stepper(parent, label, desc, getter, setter, step, min, max, fmt, width, def)
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
  local value = UI.Text(f, 13, "bold", C.hi)
  value:SetWidth(70)
  value:SetJustifyH("CENTER")
  value:SetPoint("RIGHT", plus, "LEFT", -6, 0)
  local minus = UI.IconButton(f, "minus", 28, "Weniger")
  minus:SetPoint("RIGHT", value, "LEFT", -6, 0)
  local undo = UI.IconButton(f, "close", 26, "Zurück auf Standard")
  undo:SetPoint("RIGHT", minus, "LEFT", -8, 0)
  undo:SetScript("OnClick", function() setter(def) f:Refresh() end)
  function f:Refresh()
    value:SetText(string.format(fmt, getter()))
    undo:SetShown(def ~= nil and getter() ~= def)
  end
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
  end, "Die Goldmünze an der Minikarte. Tiry's Zentrale ist zusätzlich immer im Addon-Menü der Minikarte und über /tz erreichbar.", width), 54)

  add(UI.Toggle(content, "Autopilot: Schrott automatisch verkaufen", function() return s.autoJunk end, function(v)
    s.autoJunk = v
  end, "Beim Händler wird alles Graue sofort verkauft (wie der Müll-Knopf, nur automatisch).", width), 54)

  add(UI.Toggle(content, "Schnäppchen-Radar", function() return s.dealRadar ~= false end, function(v)
    s.dealRadar = v
  end, "Meldet beim Suchen im AH Angebote unter 65 % deines Marktwerts (nicht bei Ladenhütern).", width), 54)

  add(UI.Toggle(content, "Automatisch reparieren", function() return s.autoRepair end, function(v)
    s.autoRepair = v
  end, "Repariert deine Ausrüstung beim Händler sofort (wenn du genug Gold hast) – so musst du nie daran denken.", width), 54)

  add(UI.Toggle(content, "Infos im Item-Tooltip", function() return s.tooltipInfo end, function(v)
    s.tooltipInfo = v
  end, "Zeigt im Tooltip, in welchen deiner Rezepte ein Material steckt, wo du es für dein Level farmst und ob es neu in Forever ist.", width), 54)

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

  add(UI.Toggle(content, "AH automatisch scannen", function() return s.ahAutoScan ~= false end, function(v)
    s.ahAutoScan = v
  end, "Beim Öffnen des Auktionshauses startet Tiry's Zentrale den Preis-Scan von Auctionator von selbst (Auctionator erlaubt ihn alle 15 Minuten).", width), 54)

  add(UI.Toggle(content, "Eigene Auktionen auf Unterbieten prüfen", function() return s.ahUndercut ~= false end, function(v)
    s.ahUndercut = v
  end, "Beim Öffnen des Auktionshauses wird geprüft, ob jemand deine Auktionen unterboten hat – Ergebnis im Chat und unter Markt > Meine Auktionen.", width), 54)

  add(UI.Toggle(content, "Experten-Modus", function() return s.expertMode == true end, function(v)
    s.expertMode = v
  end, "Zeigt im Craft-Planer die Preisformeln (Materialpreis, Verkaufswert, Mindestgewinn) zum Selbst-Einstellen. Für Einsteiger nicht nötig.", width), 54)

  add(stepper(content, "AH-Gebühr", "So viel Prozent behält das Auktionshaus vom Verkaufspreis ein. Standard: 5 %. Alle Gewinne werden damit berechnet.",
    function() return tonumber(s.ahCut) or 5 end, function(v) s.ahCut = v end, 1, 0, 30, "%d %%", width, 5), 54)

  add(stepper(content, "Fenstergröße", "Skaliert das Fenster. Geht auch direkt: unten rechts am Fenster ziehen.",
    function() return math.floor((tonumber(s.scale) or 1) * 100 + 0.5) end,
    function(v) s.scale = v / 100; UI.ApplyScale() end, 5, 70, 130, "%d %%", width, 100), 54)

  st:Space(10)
  local wiz = UI.Button(content, "Einsteiger-Assistent nochmal zeigen", "soft", 330, 34, "star")
  wiz:SetScript("OnClick", function() UI.Show("home") UI.Wizard.Show() end)
  st:Add(wiz, 34, 12)
  local reset = UI.Button(content, "Fensterposition zurücksetzen", "soft", 260, 34, "refresh")
  reset:SetScript("OnClick", function()
    s.point = nil
    UI.frame:ClearAllPoints()
    UI.frame:SetPoint("CENTER")
  end)
  st:Add(reset, 34, 12)

  -- Alles zurück auf Standard: zweiter Klick bestätigt (kein Versehen)
  local all = UI.Button(content, "Alle Einstellungen auf Standard", "danger", 300, 34, "close")
  all:SetScript("OnClick", function(b)
    if b.armed then
      b.armed = nil
      ns.ResetSettings()
      UI.ApplyScale()
      UI.UpdateMinimap()
      UI.UpdateAnimations()
      b:SetLabel("Alle Einstellungen auf Standard")
      ns.Print("Alle Einstellungen stehen wieder auf Standard (Craft-Liste und Daten bleiben erhalten).")
      page.refresh(self)
    else
      b.armed = true
      b:SetLabel("Sicher? Nochmal klicken")
      C_Timer.After(4, function() if b.armed then b.armed = nil b:SetLabel("Alle Einstellungen auf Standard") end end)
    end
  end)
  UI.SetTooltip(all, "Alles auf Standard", "Setzt alle Schalter, Regler, Filter und Profi-Strings zurück. Deine Craft-Liste, Preise und Verkaufsbuch bleiben.")
  self.resetAll = all
  st:Add(all, 34, 24)

  st:Title("Befehle", 15, C.text, 2)
  st:Para("|cffff9929/tz|r – Fenster öffnen/schließen\n"
    .. "|cffff9929/tz leder|r · |cffff9929/tz farm|r · |cffff9929/tz craft|r · |cffff9929/tz suche|r · |cffff9929/tz wege|r · |cffff9929/tz markt|r · |cffff9929/tz scan|r · |cffff9929/tz rezepte|r · |cffff9929/tz tagebuch|r · |cffff9929/tz ah|r\n"
    .. "|cffff9929/tz minimap|r – Minikarten-Knopf an/aus\n"
    .. "|cffff9929/tz wegpunkt|r – gesetzten Kartenpunkt löschen · |cffff9929/tz leeren|r – Craft-Liste leeren\n"
    .. "|cffff9929/tz suche|r – alles durchsuchen · |cffff9929/tz assistent|r – Einsteiger-Assistent\n"
    .. "|cffff9929/tz reset|r – Fenster in die Mitte setzen\n"
    .. "Tastenkürzel: WoW-Menü > Optionen > Tastaturbelegung > \"Tiry's Zentrale\"", 12, C.muted, 16)
  st:Para("Tiry's Zentrale " .. tostring(ns.version) .. " · gebaut für WoW Forever (1.60.1). Preise kommen aus Auctionator – "
    .. "Tiry's Zentrale selbst liest nie etwas im Hintergrund aus und schickt keine Daten weg.", 11, C.dim, 10)
  st:Finish()
end

function page.refresh(self)
  for _, w in ipairs(self.items or {}) do
    if w.Refresh then w:Refresh() end
  end
end

UI.RegisterPage("settings", page)
