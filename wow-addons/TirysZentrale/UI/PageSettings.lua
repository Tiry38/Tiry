-- Tiry's Zentrale – Seite "Einstellungen"
local _, ns = ...
local UI = ns.UI
local C = UI.C

local page = {
  title = "Einstellungen",
  subtitle = "Alles so, wie du es magst.",
  icon = "gear", label = "Einstellungen", order = 9,
}

-- fmt: Format-Text oder function(v) -> Text; step: Zahl oder function(v, richtung) -> Schrittweite
local function stepper(parent, label, desc, getter, setter, step, min, max, fmt, width, def)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(width, 54)
  f.label = UI.Text(f, 13, "semibold", C.text)
  f.label:SetPoint("TOPLEFT", 0, -4)
  f.label:SetText(label)
  f.desc = UI.Para(f, 12, C.dim, width - 200)
  f.desc:SetPoint("TOPLEFT", f.label, "BOTTOMLEFT", 0, -3)
  f.desc:SetText(desc)
  local plus = UI.IconButton(f, "plus", 30, "Mehr")
  plus:SetPoint("TOPRIGHT", 0, -2)
  local value = UI.Text(f, 14, "bold", C.gold)
  value:SetWidth(76)
  value:SetJustifyH("CENTER")
  value:SetPoint("RIGHT", plus, "LEFT", -4, 0)
  local minus = UI.IconButton(f, "minus", 30, "Weniger")
  minus:SetPoint("RIGHT", value, "LEFT", -4, 0)
  local undo = UI.IconButton(f, "close", 26, "Zurück auf Standard")
  undo:SetPoint("RIGHT", minus, "LEFT", -8, 0)
  undo:SetScript("OnClick", function() setter(def) f:Refresh() end)
  local function stepOf(v, dir) return type(step) == "function" and step(v, dir) or step end
  function f:Refresh()
    local v = getter()
    value:SetText(type(fmt) == "function" and fmt(v) or string.format(fmt, v))
    undo:SetShown(def ~= nil and v ~= def)
  end
  plus:SetScript("OnClick", function()
    local v = getter()
    setter(math.min(max, v + stepOf(v, 1)))
    f:Refresh()
  end)
  minus:SetScript("OnClick", function()
    local v = getter()
    setter(math.max(min, v - stepOf(v, -1)))
    f:Refresh()
  end)
  f:Refresh()
  return f
end

-- Einstellgebühr: feine Schritte bei kleinen Beträgen, größere ab 10 Silber
local function depositStep(v, dir)
  local x = dir > 0 and v or v - 1
  if x < 100 then return 10 elseif x < 1000 then return 50 end
  return 250
end

function page.build(self, content, width)
  local st = UI.Stack(content)
  local s = ns.settings
  self.items = {}

  -- Gruppe = eine Glas-Karte, Zeilen durch feine Lichtlinien getrennt (wie die Einstellungen am Handy)
  local inner = width - 52
  local function group(title, rows)
    st:Title(title, 15, C.text, 8)
    local card = UI.Card(content, 26, C.card)
    local y = 18
    for i, make in ipairs(rows) do
      local w = make(card)
      w:ClearAllPoints()
      w:SetPoint("TOPLEFT", card, "TOPLEFT", 26, -y)
      self.items[#self.items + 1] = w
      y = y + 54
      if i < #rows then
        local line = UI.Hairline(card, C.teal, 0.18)
        line:SetPoint("TOPLEFT", card, "TOPLEFT", 26, -(y + 8))
        line:SetPoint("TOPRIGHT", card, "TOPRIGHT", -26, -(y + 8))
        y = y + 17
      end
    end
    y = y + 16
    card:SetSize(width, y)
    st:Add(card, y, 22)
  end
  local function toggle(label, getter, setter, desc)
    return function(parent) return UI.Toggle(parent, label, getter, setter, desc, inner) end
  end
  local function step(label, desc, getter, setter, by, min, max, fmt, def)
    return function(parent) return stepper(parent, label, desc, getter, setter, by, min, max, fmt, inner, def) end
  end

  group("Automatik", {
    toggle("Autopilot: Schrott automatisch verkaufen", function() return s.autoJunk end, function(v)
      s.autoJunk = v
    end, "Beim Händler wird alles Graue sofort verkauft (wie der Müll-Knopf, nur automatisch)."),
    toggle("Automatisch reparieren", function() return s.autoRepair end, function(v)
      s.autoRepair = v
    end, "Repariert deine Ausrüstung beim Händler sofort (wenn du genug Gold hast) – so musst du nie daran denken."),
    toggle("AH automatisch scannen", function() return s.ahAutoScan ~= false end, function(v)
      s.ahAutoScan = v
    end, "Beim Öffnen des Auktionshauses startet Tiry's Zentrale den Preis-Scan von Auctionator von selbst (Auctionator erlaubt ihn alle 15 Minuten)."),
    toggle("Eigene Auktionen auf Unterbieten prüfen", function() return s.ahUndercut ~= false end, function(v)
      s.ahUndercut = v
    end, "Beim Öffnen des Auktionshauses wird geprüft, ob jemand deine Auktionen unterboten hat – Ergebnis im Chat und unter Markt > Meine Auktionen."),
    step("AH-Scan höchstens alle", "Automatischer Scan und Unterboten-Prüfung beim Öffnen des AH – höchstens so oft. Standard: 30 Minuten. \"Jetzt prüfen\" unter Markt > Meine Auktionen geht immer.",
      function() return tonumber(s.ahScanInterval) or 30 end, function(v) s.ahScanInterval = v end, 5, 5, 240, "%d Min.", 30),
  })

  group("Hinweise & Radar", {
    toggle("Schnäppchen-Radar", function() return s.dealRadar ~= false end, function(v)
      s.dealRadar = v
    end, "Meldet beim Suchen im AH Angebote unter 65 % deines Marktwerts (nicht bei Ladenhütern)."),
    toggle("Schnäppchen-Scan melden", function() return s.snipeAlert ~= false end, function(v)
      s.snipeAlert = v
    end, "Meldet nach jedem kompletten AH-Scan im Chat, was unter dem Händlerpreis (sicherer Gewinn) oder deutlich unter dem Marktwert angeboten wird. Kaufen bleibt immer dein Klick."),
    toggle("Beute-Radar", function() return s.lootAlerts end, function(v)
      s.lootAlerts = v
    end, "Meldet im Chat, wenn du etwas Wertvolles lootest (ab 50 Silber AH-Wert oder seltene Forever-Materialien)."),
    toggle("AH-Hinweis", function() return s.ahHint end, function(v)
      s.ahHint = v
    end, "Sagt dir beim Öffnen des Auktionshauses, welche Items du einstellen solltest."),
    toggle("Händler-Hinweis im Chat", function() return s.merchantAlert end, function(v)
      s.merchantAlert = v
    end, "Meldet im Chat, wenn ein Händler etwas verkauft, das du im AH mit Gewinn weiterverkaufen kannst."),
    toggle("Händler-Panel", function() return s.merchantPanel end, function(v)
      s.merchantPanel = v
    end, "Zeigt neben dem Händlerfenster: Händler-Ware verkaufen und Flip-Schnäppchen kaufen mit einem Klick."),
    toggle("Infos im Item-Tooltip", function() return s.tooltipInfo end, function(v)
      s.tooltipInfo = v
    end, "Zeigt im Tooltip, in welchen deiner Rezepte ein Material steckt, wo du es für dein Level farmst und ob es neu in Forever ist."),
  })

  group("Gold-Rechnung", {
    step("AH-Gebühr", "So viel Prozent behält das Auktionshaus vom Verkaufspreis ein. Standard: 5 %. Alle Gewinne werden damit berechnet.",
      function() return tonumber(s.ahCut) or 5 end, function(v) s.ahCut = v end, 1, 0, 30, "%d %%", 5),
    step("Einstellgebühr je Angebot", "Gilt, bis das AH den exakten Wert liefert. Kommt bei Verkauf zurück – Tiry's Zentrale rechnet nur das Risiko ein, dass es nicht verkauft wird.",
      function() return tonumber(s.ahDeposit) or 100 end, function(v) s.ahDeposit = v end, depositStep, 0, 10000,
      function(v) return ns.Money(v) end, 100),
    toggle("Experten-Modus", function() return s.expertMode == true end, function(v)
      s.expertMode = v
    end, "Zeigt im Craft-Planer die Preisformeln (Materialpreis, Verkaufswert, Mindestgewinn) zum Selbst-Einstellen. Für Einsteiger nicht nötig."),
  })

  group("Ansicht", {
    toggle("Minikarten-Knopf", function() return s.minimap.show end, function(v)
      s.minimap.show = v
      UI.UpdateMinimap()
    end, "Die Goldmünze an der Minikarte. Tiry's Zentrale ist zusätzlich immer im Addon-Menü der Minikarte und über /tz erreichbar."),
    toggle("Animationen", function() return s.animations ~= false end, function(v)
      s.animations = v
      UI.UpdateAnimations()
    end, "Sanft treibende Farbflächen und Funkeln im Hintergrund. Aus = ruhiges Fenster."),
    toggle("Nur Wege für mein Level zeigen", function() return s.showOnlyMyLevel end, function(v)
      s.showOnlyMyLevel = v
    end, "Blendet auf der Seite \"Goldwege\" alles aus, wofür dein Level noch nicht reicht."),
    step("Fenstergröße", "Skaliert das Fenster. Geht auch direkt: unten rechts am Fenster ziehen.",
      function() return math.floor((tonumber(s.scale) or 1) * 100 + 0.5) end,
      function(v) s.scale = v / 100; UI.ApplyScale() end, 5, 70, 130, "%d %%", 100),
  })

  -- Aktionen nebeneinander statt gestapelt
  st:Space(4)
  local wiz = UI.Button(content, "Einsteiger-Assistent nochmal zeigen", "soft", 320, 38, "star")
  wiz:SetScript("OnClick", function() UI.Show("home") UI.Wizard.Show() end)
  st:Add(wiz, nil)
  local reset = UI.Button(content, "Fensterposition zurücksetzen", "soft", 262, 38, "refresh")
  reset:SetScript("OnClick", function()
    s.point = nil
    UI.frame:ClearAllPoints()
    UI.frame:SetPoint("CENTER")
  end)
  st:Add(reset, nil, nil, 332)

  -- Alles zurück auf Standard: zweiter Klick bestätigt (kein Versehen)
  local all = UI.Button(content, "Alle Einstellungen auf Standard", "danger", 300, 38, "close")
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
  if width >= 320 + 262 + 300 + 24 then
    st:Add(all, 38, 30, 606)
  else
    st:Add(wiz, 38, 12)
    st:Add(reset, 38, 12)
    st:Add(all, 38, 30)
  end

  st:Title("Befehle", 15, C.text, 2)
  st:Para("|cff39ff6b/tz|r – Fenster öffnen/schließen\n"
    .. "|cff39ff6b/tz leder|r · |cff39ff6b/tz farm|r · |cff39ff6b/tz craft|r · |cff39ff6b/tz suche|r · |cff39ff6b/tz wege|r · |cff39ff6b/tz markt|r · |cff39ff6b/tz scan|r · |cff39ff6b/tz rezepte|r · |cff39ff6b/tz tagebuch|r · |cff39ff6b/tz ah|r\n"
    .. "|cff39ff6b/tz minimap|r – Minikarten-Knopf an/aus\n"
    .. "|cff39ff6b/tz wegpunkt|r – gesetzten Kartenpunkt löschen · |cff39ff6b/tz leeren|r – Craft-Liste leeren\n"
    .. "|cff39ff6b/tz suche|r – alles durchsuchen · |cff39ff6b/tz assistent|r – Einsteiger-Assistent\n"
    .. "|cff39ff6b/tz reset|r – Fenster in die Mitte setzen\n"
    .. "Tastenkürzel: WoW-Menü > Optionen > Tastaturbelegung > \"Tiry's Zentrale\"", 12, C.muted, 16)
  st:Para("Tiry's Zentrale " .. tostring(ns.version) .. " · gebaut für WoW Forever (1.60.1). Preise kommen aus Auctionator – "
    .. "Tiry's Zentrale selbst liest nie etwas im Hintergrund aus und schickt keine Daten weg.", 12, C.dim, 10)
  st:Finish()
end

function page.refresh(self)
  for _, w in ipairs(self.items or {}) do
    if w.Refresh then w:Refresh() end
  end
end

UI.RegisterPage("settings", page)
