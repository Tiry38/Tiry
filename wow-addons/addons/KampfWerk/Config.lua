-- KampfWerk: Einstellungen. Links: Fenster, Aussehen, Zahlen-Studio und jeder Teil des Meters. Rechts die Seite.
-- Alles mit grossen Glas-Pillen, Vorschau-Kacheln (Hintergruende) und Schrift-Proben.
local _, ns = ...
local UI = ns.UI
local C = UI.C
local MEDIA = ns.MEDIA
local Data = ns.Data
local Numbers = ns.Numbers
local Config = {}
ns.Config = Config

local W, H, SIDE = 900, 640, 210
local frame, side, body, sf, content
local current = "fenster"
local sideButtons = {}
local page
local editKind = "damage"

local function DB() return ns.DB end
local function theme() return ns.Theme() end
local function refreshMeter() if ns.Meter and ns.Meter.ready then ns.Meter.Apply() end end

----------------------------------------------------------------------------
-- Bausteine
----------------------------------------------------------------------------
local function label(parent, text, size, color, weight)
  local fs = UI.Text(parent, size or 12, weight or "semibold", color or C.dim)
  fs:SetText(text)
  return fs
end

-- Auswahl-Pille (Radio): optional Vorschau-Textur, Verlauf oder eigene Schrift
local function choice(parent, w, h, item, onPick)
  local b = UI.SafeButton(parent)
  b:SetSize(w, h)
  b.item = item
  b.glow = UI.Glow(b, C.amber, w * 1.2, 0, "BACKGROUND")
  b.glow:SetPoint("CENTER")
  b.glow:SetHeight(h * 2)
  local shape = UI.PillShape(b, math.min(h, 34), 0, true)
  b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
  if item.tex then
    b.prev = b:CreateTexture(nil, "BORDER")
    b.prev:SetPoint("TOPLEFT", 2, -2)
    b.prev:SetPoint("BOTTOMRIGHT", -2, 2)
    if item.tile then b.prev:SetTexture(item.tex, "REPEAT", "REPEAT") b.prev:SetTexCoord(0, (w - 4) / item.tile, 0, (h - 4) / item.tile)
    else b.prev:SetTexture(item.tex) end
    b.mask = b:CreateMaskTexture()
    b.mask:SetTexture(MEDIA .. "mask_round", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    pcall(b.mask.SetTextureSliceMargins, b.mask, 16, 16, 16, 16)
    pcall(b.mask.SetTextureSliceMode, b.mask, 0)
    b.mask:SetAllPoints(b.prev)
    b.prev:AddMaskTexture(b.mask)
  end
  if item.grad then
    b.swf = CreateFrame("Frame", nil, b)
    b.swf:SetSize(44, 18)
    b.swf:SetPoint("LEFT", 10, 0)
    b.sw = UI.Round(b.swf, 9, "ARTWORK", 0)
    b.sw:SetGradient(item.grad, 1)
  end
  if item.font then
    b.sample = b:CreateFontString(nil, "OVERLAY")
    if not pcall(b.sample.SetFont, b.sample, item.font, item.fontSize or 18, "OUTLINE") then
      pcall(b.sample.SetFont, b.sample, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", item.fontSize or 18, "OUTLINE")
    end
    b.sample:SetPoint("LEFT", 14, 0)
    b.sample:SetText(item.sample or "12.345")
    b.text = UI.Text(b, 12, "semibold", C.muted)
    b.text:SetPoint("RIGHT", -12, 0)
    b.text:SetJustifyH("RIGHT")
    b.sample:SetPoint("RIGHT", b.text, "LEFT", -6, 0)
    b.sample:SetJustifyH("LEFT")
    b.sample:SetWordWrap(false)
  else
    b.text = UI.Text(b, 12, "bold", C.text)
    if item.tex then
      b.text:SetPoint("BOTTOMLEFT", 12, 6)
      b.text:SetShadowColor(0, 0, 0, 1)
      b.text:SetShadowOffset(1, -1)
    elseif item.grad then
      b.text:SetPoint("LEFT", b.swf, "RIGHT", 8, 0)
    else
      b.text:SetPoint("CENTER")
    end
  end
  b.text:SetText(item.label or "")
  b.check = b:CreateTexture(nil, "OVERLAY")
  b.check:SetTexture(UI.Icon("check"))
  b.check:SetSize(12, 12)
  b.check:SetPoint("TOPRIGHT", -9, -7)
  function b:Paint()
    local t = theme()
    local hover = self:IsMouseOver()
    local sel = self.isSel and self.isSel() or false
    if sel then
      self.edge:SetGradient({ t[1], t[2], t[3] }, 1)
    else
      self.edge:SetGradient({ t[1], t[2], t[3] }, hover and 0.55 or 0.16)
    end
    local g = hover and UI.GLASS.pillHi or UI.GLASS.pill
    self.bg:SetGradientV(g[1], g[2], (item.tex and 0) or (hover and 0.95 or 0.75))
    self.gloss:SetAlpha(item.tex and 0 or 0.35)
    self.glow:SetVertexColor(t[1][1], t[1][2], t[1][3], sel and 0.22 or 0)
    self.check:SetShown(sel and not item.font) -- Schrift-Pillen: Auswahl zeigt der Leuchtrand, der Haken laege auf dem Namen
    self.check:SetVertexColor(t[1][1], t[1][2], t[1][3], 1)
    if self.sample and item.color then self.sample:SetTextColor(item.color()[1], item.color()[2], item.color()[3], 1) end
  end
  b:SetScript("OnEnter", function(self) self:Paint() end)
  b:SetScript("OnLeave", function(self) self:Paint() end)
  b:SetScript("OnClick", function(self)
    UI.PlayClick()
    onPick(self.item.value)
    for _, o in ipairs(self.group or {}) do o:Paint() end
  end)
  return b
end

-- Raster aus Auswahl-Pillen; gibt die Hoehe zurueck
local function grid(p, st, items, isSel, onPick, cols, h, gap)
  gap = gap or 10
  local w = st:Width()
  local cw = math.floor((w - gap * (cols - 1)) / cols)
  local group = {}
  local y0 = st.y
  for i, it in ipairs(items) do
    local b = choice(p, cw, h, it, onPick)
    b.isSel = function() return isSel(it.value) end
    b.group = group
    group[#group + 1] = b
    local col, row = (i - 1) % cols, math.floor((i - 1) / cols)
    b:SetPoint("TOPLEFT", p, "TOPLEFT", st.pad + col * (cw + gap), -(y0 + row * (h + gap)))
    b:Paint()
  end
  local rows = math.ceil(#items / cols)
  st.y = y0 + rows * (h + gap) + 6
  return group
end

-- Farbfelder (runde Glas-Kugeln)
local function swatches(p, st, get, set)
  local size, gap = 26, 8
  local dots = {}
  for i, c in ipairs(Numbers.SWATCHES) do
    local b = UI.SafeButton(p)
    b:SetSize(size, size)
    b.ring = b:CreateTexture(nil, "BACKGROUND")
    b.ring:SetTexture(UI.TEX.ringthin)
    b.ring:SetPoint("TOPLEFT", -4, 4)
    b.ring:SetPoint("BOTTOMRIGHT", 4, -4)
    b.dot = b:CreateTexture(nil, "ARTWORK")
    b.dot:SetTexture(UI.TEX.circle)
    b.dot:SetAllPoints()
    b.dot:SetVertexColor(c[1], c[2], c[3], 1)
    b.gloss = b:CreateTexture(nil, "OVERLAY")
    b.gloss:SetTexture(UI.TEX.gloss)
    b.gloss:SetAllPoints()
    b.gloss:SetBlendMode("ADD")
    b.gloss:SetVertexColor(1, 1, 1, 0.2)
    function b:Paint()
      local cur = get()
      local sel = math.abs(cur[1] - c[1]) + math.abs(cur[2] - c[2]) + math.abs(cur[3] - c[3]) < 0.02
      self.ring:SetVertexColor(1, 1, 1, sel and 0.95 or (self:IsMouseOver() and 0.4 or 0))
    end
    b:SetScript("OnEnter", function(self) self:Paint() end)
    b:SetScript("OnLeave", function(self) self:Paint() end)
    b:SetScript("OnClick", function()
      UI.PlayClick()
      set({ c[1], c[2], c[3] })
      for _, d in ipairs(dots) do d:Paint() end
    end)
    b:SetPoint("TOPLEFT", p, "TOPLEFT", st.pad + 6 + (i - 1) * (size + gap), -(st.y + 4))
    b:Paint()
    dots[#dots + 1] = b
  end
  st.y = st.y + size + 18
end

local function segRow(p, st, text, options, get, set)
  local l = label(p, text)
  st:Add(l, 18, 6, 14)
  local s = UI.Segments(p, options, function(v) set(v) end, st:Width())
  s:Select(get())
  st:Add(s, s:GetHeight(), 16)
  return s
end

local function newPage()
  if page then page:Hide() end
  page = CreateFrame("Frame", nil, content)
  page:SetPoint("TOPLEFT", 0, 0)
  page:SetSize(content:GetWidth(), 10)
  return page, UI.Stack(page, 0)
end

local function finish(st)
  st:Finish(20)
  page:SetHeight(st.y + 20)
  content:SetHeight(st.y + 30)
  if sf.UpdateBar then sf.UpdateBar() end
end

----------------------------------------------------------------------------
-- Seite: Fenster (Teile, Reihenfolge, Verhalten)
----------------------------------------------------------------------------
local function moveOrder(idx, dir)
  local list = DB().panes
  local j = idx + dir
  if j < 1 or j > #list then return end
  list[idx], list[j] = list[j], list[idx]
  refreshMeter()
  Config.Show(current)
end

local function windowPage()
  local p, st = newPage()
  local w = st:Width()
  local half = math.floor((w - 24) / 2)
  st:Title("Aufteilung")
  segRow(p, st, "Wie viele Teile im Fenster?", { { label = "Ein Fenster", value = 1 }, { label = "Zwei geteilt", value = 2 },
    { label = "Drei geteilt", value = 3 } }, function() return #DB().panes end,
    function(v) ns.Meter.SetCount(v) Config.Sidebar() Config.Show(current) end)
  st:Para("Ein Fenster = nur ein Teil, z. B. nur Schaden. Was er zeigt: Titel im Fenster anklicken oder Teil unten anklicken.", 12, C.dim)
  st:Space(6)
  st:Title("Teile im Fenster")
  st:Para("Von links nach rechts. Pfeile = Reihenfolge, Teil anklicken = seine Seite. Geloeste Teile schweben frei "
    .. "(eigenes Fenster, Ecke ziehen = Groesse).", 12, C.muted)
  for i, d in ipairs(DB().panes) do
    local row = CreateFrame("Frame", nil, p)
    row:SetSize(w, 40)
    local shape = UI.PillShape(row, 40, 0, true)
    shape.edge:SetGradient(theme(), d.docked and 0.35 or 0.15)
    shape.body:SetGradientV(UI.GLASS.pill[1], UI.GLASS.pill[2], 0.8)
    local num = UI.Text(row, 14, "display", C.text)
    num:SetPoint("LEFT", 16, 0)
    num:SetText(UI.GradText(tostring(i), theme()[1], theme()[3]))
    local v = Data.VIEW[d.view] or Data.VIEWS[1]
    local name = UI.Text(row, 13, "bold", C.text)
    name:SetPoint("LEFT", 42, 0)
    name:SetText(v.label .. (d.docked and "" or "  |cff9fb3aa(geloest)|r"))
    local open = UI.SafeButton(row)
    open:SetPoint("TOPLEFT", 0, 0)
    open:SetPoint("BOTTOMRIGHT", -180, 0)
    open:SetScript("OnClick", function() UI.PlayClick() Config.Show("teil" .. d.id) end)
    local right = UI.IconButton(row, "chevron", 26, "Nach rechts")
    right:SetPoint("RIGHT", -8, 0)
    right.icon:SetRotation(-math.pi / 2)
    right:SetScript("OnClick", function() moveOrder(i, 1) end)
    local left = UI.IconButton(row, "chevron", 26, "Nach links")
    left:SetPoint("RIGHT", right, "LEFT", -4, 0)
    left.icon:SetRotation(math.pi / 2)
    left:SetScript("OnClick", function() moveOrder(i, -1) end)
    local dock = UI.IconButton(row, d.docked and "detach" or "dock", 26, d.docked and "Loesen" or "Andocken")
    dock:SetPoint("RIGHT", left, "LEFT", -4, 0)
    local trash = UI.IconButton(row, "trash", 26, "Teil loeschen")
    trash:SetPoint("RIGHT", dock, "LEFT", -4, 0)
    trash:SetShown(#DB().panes > 1)
    trash:SetScript("OnClick", function()
      if #DB().panes <= 1 then return end
      table.remove(DB().panes, i)
      ns.Meter.Rebuild()
      Config.Sidebar()
      Config.Show(current)
    end)
    dock:SetScript("OnClick", function() ns.Meter.ToggleDock(d.id) Config.Show(current) end)
    st:Add(row, 40, 8)
  end
  local add = UI.Button(p, "Teil hinzufuegen", "primary", 200, 34, "plus")
  add:SetScript("OnClick", function()
    local d = ns.NewPane("kicks")
    ns.Meter.Rebuild()
    Config.Show("teil" .. d.id)
  end)
  st:Add(add, 34, 18)

  st:Title("Verhalten")
  local toggles = {
    { "Fenster sperren", function() return DB().frame.locked end, function(v) DB().frame.locked = v end,
      "Nichts laesst sich mehr verschieben oder in der Groesse aendern." },
    { "Eigene Zeile immer zeigen", function() return DB().showSelf end, function(v) DB().showSelf = v end,
      "Stehst du weiter unten, ersetzt deine Zeile die letzte sichtbare." },
    { "Knoepfe immer zeigen", function() return DB().alwaysHeader end, function(v) DB().alwaysHeader = v end,
      "Leeren, Loesen und Zahnrad nicht nur bei Maus ueber dem Teil." },
    { "Blizzard-Meter verstecken", function() return DB().hideBlizzard end,
      function(v) DB().hideBlizzard = v if ns.Blizzard then ns.Blizzard.Apply() end end,
      "Versteckt Blizzards eigenes Schadensmeter-Fenster. Es bleibt im Spiel eingeschaltet - KampfWerk liest seine Daten." },
    { "Animationen", function() return DB().animations end, function(v) DB().animations = v UI.UpdateAnimations() end,
      "Fliessender Neon-Rand, Lauflicht und atmende Eckklammern." },
  }
  for _, t in ipairs(toggles) do
    local tg = UI.Toggle(p, t[1], t[2], function(v) t[3](v) refreshMeter() end, t[4], w)
    st:Add(tg, tg:GetHeight(), 6)
  end
  st:Space(8)
  local reset = UI.Button(p, "Kampfdaten leeren", "danger", half, 34, "refresh")
  reset:SetScript("OnClick", function() Data.Reset() end)
  st:Add(reset, 34, 16)
  st:Para("|cff39ff6b/kw|r Einstellungen · |cff39ff6b/kw zahlen|r Zahlen-Studio · |cff39ff6b/kw reset|r leeren · "
    .. "|cff39ff6b/kw sperren|r sperren/frei · |cff39ff6b/kw aus|r / |cff39ff6ban|r verstecken/zeigen · "
    .. "|cff39ff6b/kw eins|r / |cff39ff6bzwei|r / |cff39ff6bdrei|r Aufteilung", 12, C.dim)
  finish(st)
end

----------------------------------------------------------------------------
-- Seite: Aussehen
----------------------------------------------------------------------------
local function lookPage()
  local p, st = newPage()
  local w = st:Width()
  local half = math.floor((w - 24) / 2)
  local look = DB().look
  st:Title("Hintergrund")
  local items = {}
  for _, b in ipairs(ns.BACKGROUNDS) do
    items[#items + 1] = { value = b.key, label = b.label, tex = b.file, tile = b.tile }
  end
  grid(p, st, items, function(v) return look.bg == v end, function(v) look.bg = v refreshMeter() end, 4, 56, 10)
  st:Para("Die drei WoW-Hintergruende kommen direkt aus dem Spiel. Fehlt einer in Forever, bleibt die Flaeche leer - "
    .. "dann einfach einen anderen waehlen.", 12, C.dim)
  local ba = UI.Stepper(p, "Hintergrund", half, function() return math.floor((look.bgAlpha or 0.55) * 100 + 0.5) end,
    function(v) look.bgAlpha = v / 100 refreshMeter() end, 5, 0, 100, function(v) return v .. " %" end)
  local ga = UI.Stepper(p, "Glas", half, function() return math.floor((look.alpha or 0.78) * 100 + 0.5) end,
    function(v) look.alpha = v / 100 refreshMeter() end, 5, 0, 100, function(v) return v .. " %" end)
  st:Add(ba, 34, 0)
  ga:SetPoint("LEFT", ba, "RIGHT", 24, 0)
  st:Space(18)

  st:Title("Farbthema")
  local th = {}
  for _, t in ipairs(ns.THEMES) do th[#th + 1] = { value = t.key, label = t.label, grad = t.c } end
  grid(p, st, th, function(v) return look.theme == v end, function(v) look.theme = v refreshMeter() Config.Show(current) end, 3, 38, 10)

  st:Title("Balken")
  local bh = UI.Stepper(p, "Hoehe", half, function() return look.barH or 20 end,
    function(v) look.barH = v refreshMeter() end, 1, 14, 40, function(v) return v .. " px" end)
  local gp = UI.Stepper(p, "Abstand", half, function() return look.gap or 3 end,
    function(v) look.gap = v refreshMeter() end, 1, 0, 12, function(v) return v .. " px" end)
  st:Add(bh, 34, 0)
  gp:SetPoint("LEFT", bh, "RIGHT", 24, 0)
  st:Space(10)
  local fz = UI.Stepper(p, "Schrift", half, function() return look.font or 13 end,
    function(v) look.font = v refreshMeter() end, 1, 11, 22, function(v) return v .. " px" end)
  st:Add(fz, 34, 16)
  segRow(p, st, "Balkenfarbe", { { label = "Klassenfarben", value = "klasse" }, { label = "Farbthema", value = "thema" } },
    function() return look.barColor end, function(v) look.barColor = v refreshMeter() end)
  segRow(p, st, "Balkenstil", { { label = "Glanz", value = "glanz" }, { label = "Neon-Funke", value = "neon" }, { label = "Flach", value = "flach" } },
    function() return look.barStyle end, function(v) look.barStyle = v refreshMeter() end)
  segRow(p, st, "Zahlen", { { label = "Kurz (12,3K)", value = "kurz" }, { label = "Voll (12.345)", value = "voll" } },
    function() return look.numbers end, function(v) look.numbers = v refreshMeter() end)
  st:Para("Im Kampf zeigt WoW die Werte nur verschluesselt an Add-ons weiter - dann immer kurz und ohne Prozent. "
    .. "Prozent und Zauber-Details (Maus ueber einen Balken) erscheinen nach dem Kampf.", 12, C.dim)
  finish(st)
end

----------------------------------------------------------------------------
-- Seite: Zahlen-Studio
----------------------------------------------------------------------------
local function fontItems(o, sample)
  local items = {}
  for _, f in ipairs(Numbers.FONTS) do
    items[#items + 1] = { value = f.key, label = f.label, font = Numbers.FontFile(f.key), sample = sample, fontSize = (f.key == "pixel" and 13) or 19,
      color = function() return o and o.color or { 1, 1, 1 } end }
  end
  return items
end

local function numbersPage()
  local p, st = newPage()
  local w = st:Width()
  local half = math.floor((w - 24) / 2)
  local n = DB().numbers
  st:Title("Eigene Neon-Zahlen")
  st:Para("KampfWerk zeichnet Schaden und Heilung selbst ueber Gegner (Namensplakette) bzw. ueber dich - "
    .. "Schrift, Farbe, Groesse und Rand fuer beides getrennt.", 12, C.muted)
  local own = UI.Toggle(p, "Eigene Zahlen anzeigen", function() return n.own end, function(v) n.own = v end,
    "Tipp: dazu unten die Blizzard-Zahlen ausschalten, sonst stehen beide da.", w)
  st:Add(own, own:GetHeight(), 12)
  local seg = segRow(p, st, "Bearbeiten", { { label = "Schaden", value = "damage" }, { label = "Heilung", value = "heal" } },
    function() return editKind end, function(v) editKind = v Config.Show(current) end)
  local o = n[editKind]
  local on = UI.Toggle(p, editKind == "damage" and "Schadenszahlen" or "Heilzahlen", function() return o.on end,
    function(v) o.on = v end, nil, w)
  st:Add(on, on:GetHeight(), 12)

  -- Vorschau-Band
  local pv = CreateFrame("Frame", nil, p)
  pv:SetSize(w, 92)
  local pg = UI.Glass(pv, { radius = 20, body = UI.GLASS.window, edgeMode = "neon", edge = 0.35 })
  pg.opts.edgeStops = theme()
  pg:SetEdge("neon", 0.35)
  local sampleA = pv:CreateFontString(nil, "OVERLAY")
  local sampleB = pv:CreateFontString(nil, "OVERLAY")
  local pglow = pv:CreateTexture(nil, "ARTWORK")
  pglow:SetTexture(UI.TEX.glow)
  pglow:SetBlendMode("ADD")
  pglow:SetPoint("CENTER", -w * 0.18, -8)
  local function preview()
    local file = Numbers.FontFile(o.font)
    for i, fs in ipairs({ sampleA, sampleB }) do
      local crit = i == 2
      local size = math.floor(o.size * (crit and o.critScale or 1) + 0.5)
      if not pcall(fs.SetFont, fs, file, size, Numbers.Flags(o.style)) then pcall(fs.SetFont, fs, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", size, "") end
      local c = crit and o.crit or o.color
      fs:SetTextColor(c[1], c[2], c[3], 1)
      fs:SetShadowColor(0, 0, 0, o.style == "schatten" and 0.9 or 0)
      fs:SetShadowOffset(o.style == "schatten" and 2 or 0, o.style == "schatten" and -2 or 0)
    end
    local pre = editKind == "heal" and "+" or ""
    sampleA:SetText(pre .. "8.421")
    sampleB:SetText(pre .. "24.680")
    pglow:SetShown(o.style == "neon")
    pglow:SetSize(o.size * 5, o.size * 2.2)
    pglow:SetVertexColor(o.color[1], o.color[2], o.color[3], 0.45)
  end
  sampleA:SetPoint("CENTER", pv, "CENTER", -w * 0.18, -8)
  sampleB:SetPoint("CENTER", pv, "CENTER", w * 0.18, -8)
  local hint = label(pv, "NORMAL", 11, C.dim)
  hint:SetPoint("TOP", pv, "TOP", -w * 0.18, -8)
  local hint2 = label(pv, "KRITISCH", 11, C.dim)
  hint2:SetPoint("TOP", pv, "TOP", w * 0.18, -8)
  preview()
  st:Add(pv, 92, 14)

  local l = label(p, "Schrift (" .. #Numbers.FONTS .. " zur Wahl)")
  st:Add(l, 18, 8, 14)
  grid(p, st, fontItems(o, editKind == "heal" and "+8.421" or "8.421"), function(v) return o.font == v end,
    function(v) o.font = v preview() end, 3, 40, 8)
  local l2 = label(p, "Farbe")
  st:Add(l2, 18, 4, 14)
  swatches(p, st, function() return o.color end, function(c) o.color = c preview() end)
  local l3 = label(p, "Farbe bei kritischen Treffern")
  st:Add(l3, 18, 4, 14)
  swatches(p, st, function() return o.crit end, function(c) o.crit = c preview() end)
  local sz = UI.Stepper(p, "Groesse", half, function() return o.size end,
    function(v) o.size = v preview() end, 1, 12, 64, function(v) return v .. " px" end)
  local cs = UI.Stepper(p, "Krit groesser", half, function() return math.floor(o.critScale * 100 + 0.5) end,
    function(v) o.critScale = v / 100 preview() end, 5, 100, 250, function(v) return v .. " %" end)
  st:Add(sz, 34, 0)
  cs:SetPoint("LEFT", sz, "RIGHT", 24, 0)
  st:Space(14)
  segRow(p, st, "Rand", Numbers.STYLES, function() return o.style end, function(v) o.style = v preview() end)
  segRow(p, st, "Bewegung (Schaden + Heilung)", Numbers.ANIMS, function() return n.anim end, function(v) n.anim = v end)
  local test = UI.Button(p, "Probe in der Bildschirmmitte", "primary", 280, 34, "star")
  test:SetScript("OnClick", function() Numbers.Test() end)
  st:Add(test, 34, 20)

  st:Title("Blizzard-Kampfzahlen")
  st:Para("Die Zahlen des Spiels selbst. WoW erlaubt hier nur EINE Schrift fuer Schaden und Heilung zusammen; die Farben "
    .. "legt das Spiel fest. |cffffd34dWirkt erst nach dem naechsten Einloggen|r (Charakterauswahl und zurueck).", 12, C.muted)
  grid(p, st, fontItems(nil, "12.345"), function(v) return (n.blizzFont or "spiel") == v end,
    function(v) n.blizzFont = v ns.Print("Schrift der Blizzard-Kampfzahlen gespeichert - wirkt nach dem naechsten Einloggen.") end, 3, 40, 8)
  local t1 = UI.Toggle(p, "Blizzard-Schadenszahlen ausblenden", function() return n.hideBlizzDamage end,
    function(v) n.hideBlizzDamage = v n.blizzDamageSet = true Numbers.ApplyBlizzard() end, nil, w)
  st:Add(t1, t1:GetHeight(), 6)
  local t2 = UI.Toggle(p, "Blizzard-Heilzahlen ausblenden", function() return n.hideBlizzHeal end,
    function(v) n.hideBlizzHeal = v n.blizzHealSet = true Numbers.ApplyBlizzard() end, nil, w)
  st:Add(t2, t2:GetHeight(), 10)
  if Numbers.CVarExists("WorldTextScale") then
    local ws = UI.Stepper(p, "Groesse Blizzard-Zahlen", w, function() return math.floor((n.worldScale or 1) * 100 + 0.5) end,
      function(v) n.worldScale = v / 100 Numbers.ApplyBlizzard() end, 10, 50, 300, function(v) return v .. " %" end)
    st:Add(ws, 34, 14)
  end
  finish(st)
end

----------------------------------------------------------------------------
-- Seite: ein Teil
----------------------------------------------------------------------------
local function panePage(id)
  local d, idx = ns.PaneById(id)
  if not d then return Config.Show("fenster") end
  local p, st = newPage()
  local w = st:Width()
  local half = math.floor((w - 24) / 2)
  st:Title("Was zeigt dieser Teil?")
  local items = {}
  for _, v in ipairs(Data.VIEWS) do items[#items + 1] = { value = v.key, label = v.label } end
  grid(p, st, items, function(v) return d.view == v end, function(v)
    d.view = v
    refreshMeter()
    frame.sub:SetText("Teil " .. idx .. ": " .. (Data.VIEW[v] and Data.VIEW[v].label or ""))
    Config.Sidebar()
  end, 2, 38, 8)
  st:Para("Aggro zeigt die Bedrohung deiner Gruppe auf dein aktuelles Ziel. Kicks = erfolgreiche Unterbrechungen.", 12, C.dim)
  segRow(p, st, "Kampf-Abschnitt", { { label = "Aktueller Kampf", value = "current" }, { label = "Gesamt", value = "overall" } },
    function() return (d.session == "overall") and "overall" or "current" end, function(v) d.session = v refreshMeter() end)
  st:Title("Platz")
  local pos = label(p, "Position " .. idx .. " von " .. #DB().panes .. " (von links)", 13, C.text, "bold")
  st:Add(pos, 20, 10, 14)
  local lb = UI.Button(p, "Nach links", "soft", half, 34, "chevron")
  lb.icon:SetRotation(math.pi / 2)
  lb:SetScript("OnClick", function() moveOrder(idx, -1) end)
  local rb = UI.Button(p, "Nach rechts", "soft", half, 34, "chevron")
  rb.icon:SetRotation(-math.pi / 2)
  rb:SetScript("OnClick", function() moveOrder(idx, 1) end)
  st:Add(lb, 34, 0)
  rb:SetPoint("LEFT", lb, "RIGHT", 24, 0)
  st:Space(12)
  local dk = UI.Button(p, d.docked and "Loesen (eigenes Fenster)" or "Wieder andocken", "primary", half, 34, d.docked and "detach" or "dock")
  dk:SetScript("OnClick", function() ns.Meter.ToggleDock(d.id) Config.Show(current) end)
  local del = UI.Button(p, "Teil loeschen", "danger", half, 34, "trash")
  del:SetScript("OnClick", function()
    if #DB().panes <= 1 then ns.Print("Ein Teil muss bleiben.") return end
    table.remove(DB().panes, idx)
    ns.Meter.Rebuild()
    Config.Show("fenster")
  end)
  st:Add(dk, 34, 0)
  del:SetPoint("LEFT", dk, "RIGHT", 24, 0)
  st:Space(16)
  st:Para("Tipp: Rechtsklick auf die Kopfzeile eines Teils oeffnet diese Seite. Titel anklicken = Ansicht direkt "
    .. "im Fenster wechseln, Kapsel daneben = Kampf-Abschnitt.", 12, C.dim)
  finish(st)
end

----------------------------------------------------------------------------
-- Seitenleiste
----------------------------------------------------------------------------
local function sideButton(i, text, value, icon, y)
  local b = sideButtons[i]
  if not b then
    b = UI.SafeButton(side)
    b:SetSize(SIDE - 28, 38)
    local shape = UI.PillShape(b, 38, 0, true)
    b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetSize(16, 16)
    b.icon:SetPoint("LEFT", 16, 0)
    b.text = UI.Text(b, 13, "semibold", C.text)
    b.text:SetPoint("LEFT", b.icon, "RIGHT", 9, 0)
    b.text:SetPoint("RIGHT", -12, 0)
    b.text:SetWordWrap(false)
    function b:Paint()
      local t = theme()
      local on = current == self.value
      local hover = self:IsMouseOver()
      if on then
        self.edge:SetGradientV({ 1, 1, 1, 0.6 }, { 1, 1, 1, 0.1 })
        self.bg:SetGradient({ t[1], t[2], t[3] }, 1)
        self.gloss:SetAlpha(1)
        self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
        self.icon:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
      else
        local g = hover and UI.GLASS.pillHi or UI.GLASS.pill
        self.edge:SetGradient({ t[1], t[2], t[3] }, hover and 0.55 or 0.18)
        self.bg:SetGradientV(g[1], g[2], hover and 0.95 or 0.7)
        self.gloss:SetAlpha(0.35)
        self.text:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
        self.icon:SetVertexColor(t[1][1], t[1][2], t[1][3], 1)
      end
    end
    b:SetScript("OnEnter", function(self) self:Paint() end)
    b:SetScript("OnLeave", function(self) self:Paint() end)
    b:SetScript("OnClick", function(self) UI.PlayClick() Config.Show(self.value) end)
    sideButtons[i] = b
  end
  b.value = value
  b.icon:SetTexture(UI.Icon(icon))
  b.text:SetText(text)
  b:ClearAllPoints()
  b:SetPoint("TOPLEFT", 14, -y)
  b:Show()
  b:Paint()
  return b
end

function Config.Sidebar()
  if not side then return end
  for _, b in ipairs(sideButtons) do b:Hide() end
  sideButton(1, "Fenster", "fenster", "layers", 14)
  sideButton(2, "Aussehen", "aussehen", "palette", 58)
  sideButton(3, "Zahlen-Studio", "zahlen", "text", 102)
  side.teile:ClearAllPoints()
  side.teile:SetPoint("TOPLEFT", 22, -154)
  for i, d in ipairs(DB().panes) do
    local v = Data.VIEW[d.view] or Data.VIEWS[1]
    sideButton(3 + i, i .. ". " .. v.short, "teil" .. d.id, "chart", 176 + (i - 1) * 44)
  end
end

function Config.Show(value)
  current = value or current
  if current:match("^teil") and not ns.PaneById(tonumber(current:match("%d+")) or -1) then current = "fenster" end
  Config.Sidebar()
  if sf.ScrollToTop then sf:ScrollToTop() end
  if current == "aussehen" then
    frame.sub:SetText("Hintergrund, Farben, Balken")
    lookPage()
  elseif current == "zahlen" then
    frame.sub:SetText("Schaden- und Heilzahlen ueber Gegnern")
    numbersPage()
  elseif current:match("^teil") then
    local id = tonumber(current:match("%d+"))
    local d, idx = ns.PaneById(id)
    frame.sub:SetText("Teil " .. (idx or "?") .. ": " .. ((d and Data.VIEW[d.view]) and Data.VIEW[d.view].label or ""))
    panePage(id)
  else
    current = "fenster"
    frame.sub:SetText("Teile, Reihenfolge, Verhalten")
    windowPage()
  end
end

----------------------------------------------------------------------------
-- Hauptfenster
----------------------------------------------------------------------------
local function build()
  frame = CreateFrame("Frame", "KampfWerkConfig", UIParent)
  frame:SetSize(W, H)
  frame:SetPoint("CENTER")
  frame:SetFrameStrata("HIGH")
  frame:SetToplevel(true)
  frame:EnableMouse(true)
  frame:SetMovable(true)
  frame:SetClampedToScreen(true)
  frame:RegisterForDrag("LeftButton")
  frame:SetScript("OnDragStart", frame.StartMoving)
  frame:SetScript("OnDragStop", frame.StopMovingOrSizing)
  frame.glass = UI.Glass(frame, { radius = 28, body = UI.GLASS.window, edgeMode = "neon", edge = 0.6, halo = 0.16, haloPad = 30, sheen = 0.05 })
  frame.hud = UI.HUD(frame, { radius = 28, flow = frame.glass.edge, flowAlpha = 0.65, grid = 0.045, streakW = 220, streakTime = 4 })
  tinsert(UISpecialFrames, "KampfWerkConfig")
  local g1 = UI.Glow(frame, C.amber, 420, 0.07, "BACKGROUND")
  g1:SetPoint("CENTER", frame, "TOPLEFT", 120, -40)
  local g2 = UI.Glow(frame, C.aqua, 480, 0.06, "BACKGROUND")
  g2:SetPoint("CENTER", frame, "BOTTOMRIGHT", -80, 40)

  local logo = frame:CreateTexture(nil, "ARTWORK")
  logo:SetTexture(MEDIA .. "logo")
  logo:SetSize(46, 46)
  logo:SetPoint("TOPLEFT", 24, -18)
  frame.title = UI.Text(frame, 22, "display", C.text)
  frame.title:SetPoint("TOPLEFT", logo, "TOPRIGHT", 12, -2)
  frame.sub = UI.Text(frame, 13, "regular", C.muted)
  frame.sub:SetPoint("TOPLEFT", frame.title, "BOTTOMLEFT", 1, -3)
  local ver = UI.Chip(frame, "v" .. ns.VERSION, C.teal)
  ver:SetPoint("LEFT", frame.title, "RIGHT", 10, 0)

  local close = UI.IconButton(frame, "close", 32, "Schliessen")
  close:SetPoint("TOPRIGHT", -18, -20)
  close:SetScript("OnClick", function() frame:Hide() end)

  side = CreateFrame("Frame", nil, frame)
  side:SetPoint("TOPLEFT", 16, -84)
  side:SetPoint("BOTTOMLEFT", 16, 16)
  side:SetWidth(SIDE)
  UI.Glass(side, { radius = 22, body = { { 0.05, 0.065, 0.068, 0.82 }, { 0.035, 0.042, 0.050, 0.82 } }, sheen = 0.03, line = 0.15, edge = 0.18 })
  side.teile = label(side, "TEILE", 11, C.dim, "bold")

  body = CreateFrame("Frame", nil, frame)
  body:SetPoint("TOPLEFT", side, "TOPRIGHT", 20, -4)
  body:SetPoint("BOTTOMRIGHT", -20, 16)
  sf, content = UI.Scroll(body)
  sf:SetAllPoints()
  content:SetWidth(W - SIDE - 16 - 20 - 20 - 14)
  frame:Hide()
end

local function paintFrame()
  local t = theme()
  frame.title:SetText(UI.GradText("KAMPFWERK", t[1], t[3]))
  frame.glass.opts.edgeStops = t
  frame.glass:SetEdge("neon", 0.6)
  frame.hud.flow.colors = { t[1], t[2], t[3], t[2] }
end

function Config.Open(value)
  if not frame then build() end
  paintFrame()
  frame:Show()
  Config.Show(value or current)
end

function Config.Toggle()
  if frame and frame:IsShown() then frame:Hide() else Config.Open() end
end

function Config.Refresh()
  if frame and frame:IsShown() then paintFrame() Config.Show(current) end
end
