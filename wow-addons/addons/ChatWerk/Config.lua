-- ChatWerk: Einstellungen. Links die Reiter des Chatfensters (+ neuer Reiter), rechts fuer den gewaehlten Reiter
-- Name, Reihenfolge und die komplette Auswahlliste aller Nachrichtenarten (Suche, "alle an/aus" je Gruppe, Kanaele).
-- Seite "Allgemein": Fenster-Aussehen, Zeitstempel, Kanalnamen, Klassenfarben, Spam-Filter, Stichwoerter, Blizzard-Chat ...
local _, ns = ...
local UI = ns.UI
local C = UI.C
local Config = {}
ns.Config = Config

local W, H, SIDE = 860, 600, 210
local frame, side, body, sf, content
local current = "general"
local sideButtons = {}

local function DB() return ns.DB end
local function theme() return ns.Theme() end
local MEDIA = ns.MEDIA

----------------------------------------------------------------------------
-- Kleine Bausteine
----------------------------------------------------------------------------
local function editPill(parent, width, text, onCommit, maxLetters)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(width, 36)
  local shape = UI.PillShape(f, 36, 0, true)
  shape.edge:SetGradient(UI.GRAD_EDGE, 0.32)
  shape.body:SetGradientV({ 0.045, 0.055, 0.060, 0.96 }, { 0.090, 0.105, 0.110, 0.96 })
  shape.gloss:SetAlpha(0.35)
  local eb = CreateFrame("EditBox", nil, f)
  eb:SetPoint("TOPLEFT", 16, -4)
  eb:SetPoint("BOTTOMRIGHT", -16, 4)
  eb:SetAutoFocus(false)
  eb:SetMaxLetters(maxLetters or 40)
  local ok = pcall(eb.SetFont, eb, ns.MEDIA .. "Fonts\\Poppins-Regular.ttf", 13, "")
  if not ok then pcall(eb.SetFont, eb, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", 13, "") end
  eb:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
  eb:SetText(text or "")
  local function commit(self)
    self:ClearFocus()
    onCommit(self:GetText() or "")
  end
  eb:SetScript("OnEnterPressed", commit)
  eb:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
  eb:SetScript("OnEditFocusGained", function() shape.edge:SetGradient(UI.GRAD_EDGE, 0.9) end)
  eb:SetScript("OnEditFocusLost", function(self)
    shape.edge:SetGradient(UI.GRAD_EDGE, 0.32)
    onCommit(self:GetText() or "")
  end)
  f:EnableMouse(true)
  f:SetScript("OnMouseDown", function() eb:SetFocus() end)
  f.edit = eb
  return f
end

local function label(parent, text, size, color, weight)
  local fs = UI.Text(parent, size or 12, weight or "semibold", color or C.dim)
  fs:SetText(text)
  return fs
end

----------------------------------------------------------------------------
-- Kopier-Fenster (Links, Verlauf)
----------------------------------------------------------------------------
local copy
-- (aus KampfWerk) Auswahl-Pille (Radio): optional Vorschau-Textur, Verlauf oder eigene Schrift
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

local function strip(s)
  s = s:gsub("|T.-|t", ""):gsub("|H.-|h(.-)|h", "%1"):gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")
  return s
end
function Config.Copy(title, text)
  if not copy then
    copy = CreateFrame("Frame", "ChatWerkCopy", UIParent)
    copy:SetSize(620, 380)
    copy:SetPoint("CENTER")
    copy:SetFrameStrata("DIALOG")
    copy:EnableMouse(true)
    copy:SetMovable(true)
    copy:SetClampedToScreen(true)
    copy:RegisterForDrag("LeftButton")
    copy:SetScript("OnDragStart", copy.StartMoving)
    copy:SetScript("OnDragStop", copy.StopMovingOrSizing)
    local cg = UI.Glass(copy, { radius = 22, body = UI.GLASS.window, edgeMode = "neon", edge = 0.55, halo = 0.12 })
    UI.HUD(copy, { radius = 22, flow = cg.edge, flowAlpha = 0.55, grid = 0.04 })
    copy.title = UI.Text(copy, 14, "display", C.text)
    copy.title:SetPoint("TOPLEFT", 22, -18)
    copy.hint = label(copy, "Strg+C kopiert die Markierung · Esc schliesst", 12)
    copy.hint:SetPoint("TOPLEFT", copy.title, "BOTTOMLEFT", 0, -4)
    local close = UI.IconButton(copy, "close", 28, "Schliessen")
    close:SetPoint("TOPRIGHT", -14, -14)
    close:SetScript("OnClick", function() copy:Hide() end)
    local s, c = UI.Scroll(copy)
    s:SetPoint("TOPLEFT", 20, -64)
    s:SetPoint("BOTTOMRIGHT", -16, 18)
    c:SetWidth(570)
    local eb = CreateFrame("EditBox", nil, c)
    eb:SetMultiLine(true)
    eb:SetAutoFocus(false)
    eb:SetWidth(560)
    eb:SetPoint("TOPLEFT", 0, 0)
    pcall(eb.SetFont, eb, ns.MEDIA .. "Fonts\\Poppins-Regular.ttf", 13, "")
    eb:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
    eb:SetScript("OnEscapePressed", function() copy:Hide() end)
    eb:SetScript("OnTextChanged", function(self)
      c:SetHeight(math.max(40, (self:GetNumLines() or 1) * 17 + 10))
      self:SetHeight(c:GetHeight())
    end)
    copy.edit = eb
    tinsert(UISpecialFrames, "ChatWerkCopy")
  end
  copy.title:SetText(UI.Upper(title))
  copy.edit:SetText(text or "")
  copy:Show()
  copy.edit:SetFocus()
  copy.edit:HighlightText()
end
function Config.CopyHistory(id)
  local h = ns.CDB.hist[id] or {}
  local out = {}
  for _, e in ipairs(h) do out[#out + 1] = strip(e[1]) end
  local d = ns.WindowById(id)
  Config.Copy("Verlauf: " .. (d and d.name or "Chat"), table.concat(out, "\n"))
end

----------------------------------------------------------------------------
-- Seiten
----------------------------------------------------------------------------
local page          -- aktueller Seiten-Rahmen (wird bei Wechsel neu gebaut)
local rows          -- filterbare Zeilen der Fensterseite
local filter = ""

local function newPage()
  if page then page:Hide() end
  page = CreateFrame("Frame", nil, content)
  page:SetPoint("TOPLEFT", 0, 0)
  page:SetSize(content:GetWidth(), 10)
  return page
end

local function refreshWindows()
  ns.BuildWindows()
end

-- Raster aus Schaltern (2 Spalten), nach Suchtext filterbar
local function layoutRows(startY)
  local y = startY
  local colW = math.floor((page:GetWidth() - 24) / 2)
  local i = 0
  local f = filter:lower()
  for _, r in ipairs(rows) do
    if r.kind == "title" then
      local any = false
      for _, t in ipairs(r.children) do
        t.visible = f == "" or t.search:find(f, 1, true) ~= nil
        any = any or t.visible
      end
      if i % 2 == 1 then y = y + 42 end
      i = 0
      r.frame:SetShown(any)
      if any then
        y = y + 14
        r.frame:ClearAllPoints()
        r.frame:SetPoint("TOPLEFT", page, "TOPLEFT", 0, -y)
        y = y + 40
      end
      for _, t in ipairs(r.children) do
        t.frame:SetShown(t.visible)
        if t.visible then
          t.frame:ClearAllPoints()
          t.frame:SetPoint("TOPLEFT", page, "TOPLEFT", (i % 2) * (colW + 24), -y)
          if i % 2 == 1 then y = y + 42 end
          i = i + 1
        end
      end
    end
  end
  if i % 2 == 1 then y = y + 42 end
  page:SetHeight(y + 30)
  content:SetHeight(y + 40)
  if sf.UpdateBar then sf.UpdateBar() end
end

local function groupTitle(text, onAll, onNone)
  local f = CreateFrame("Frame", nil, page)
  f:SetSize(page:GetWidth(), 34)
  local dot = f:CreateTexture(nil, "ARTWORK")
  dot:SetTexture(UI.TEX.circle)
  dot:SetSize(8, 8)
  dot:SetPoint("LEFT", 2, 0)
  UI.SetGradV(dot, C.amber, C.teal, 1)
  local g = UI.Glow(f, C.amber, 24, 0.45, "ARTWORK")
  g:SetPoint("CENTER", dot, "CENTER")
  local t = UI.Text(f, 14, "display", C.text)
  t:SetPoint("LEFT", dot, "RIGHT", 9, 0)
  t:SetText(UI.Upper(text))
  local none = UI.Button(f, "Keine", "ghost", 76, 28)
  none:SetPoint("RIGHT", 0, 0)
  none:SetScript("OnClick", onNone)
  local all = UI.Button(f, "Alle", "soft", 70, 28, "check")
  all:SetPoint("RIGHT", none, "LEFT", -6, 0)
  all:SetScript("OnClick", onAll)
  return f
end

-- Alle Schalter einer Gruppe neu zeichnen
local function repaint()
  for _, r in ipairs(rows or {}) do
    for _, t in ipairs(r.children or {}) do t.frame:Refresh() end
  end
end

local function windowPage(id)
  local d = ns.WindowById(id)
  if not d then return Config.Show("general") end
  local p = newPage()
  local w = p:GetWidth()
  rows = {}

  -- Kopf: Name, Loeschen
  local name = editPill(p, 300, d.name, function(txt)
    txt = txt:gsub("^%s+", ""):gsub("%s+$", "")
    if txt ~= "" and txt ~= d.name then d.name = txt refreshWindows() Config.Sidebar() end
  end, 24)
  name:SetPoint("TOPLEFT", 0, -26)
  local nl = label(p, "Name des Reiters")
  nl:SetPoint("BOTTOMLEFT", name, "TOPLEFT", 14, 4)

  local del = UI.Button(p, "Reiter loeschen", "danger", 156, 34, "trash")
  del:SetPoint("TOPRIGHT", 0, -27)
  del:SetEnabled(#DB().windows > 1)
  del:SetScript("OnClick", function(self)
    if not self.armed then
      self.armed = true
      self:SetLabel("Wirklich?")
      C_Timer.After(3, function() if self.armed then self.armed = nil self:SetLabel("Reiter loeschen") end end)
      return
    end
    local _, idx = ns.WindowById(id)
    if idx then table.remove(DB().windows, idx) end
    ns.CDB.hist[id] = nil
    if DB().active == id then DB().active = DB().windows[1].id end
    refreshWindows()
    Config.Sidebar()
    Config.Show(DB().windows[1].id)
  end)

  -- Reihenfolge der Reiter
  local _, idx = ns.WindowById(id)
  local n = #DB().windows
  local function move(dir)
    local _, k = ns.WindowById(id)
    local list = DB().windows
    local o = k + dir
    if not k or o < 1 or o > #list then return end
    list[k], list[o] = list[o], list[k]
    refreshWindows()
    Config.Show(id)
  end
  local ol = label(p, "Position oben in der Reiterleiste:  " .. idx .. " von " .. n)
  ol:SetPoint("TOPLEFT", 14, -82)
  local left = UI.Button(p, "Nach links", "soft", 120, 32)
  left:SetPoint("TOPLEFT", 0, -102)
  left:SetEnabled(idx > 1)
  left:SetScript("OnClick", function() move(-1) end)
  local right = UI.Button(p, "Nach rechts", "soft", 124, 32)
  right:SetPoint("LEFT", left, "RIGHT", 8, 0)
  right:SetEnabled(idx < n)
  right:SetScript("OnClick", function() move(1) end)
  local show = UI.Button(p, "Jetzt anzeigen", "cool", 150, 32, "chat")
  show:SetPoint("TOPRIGHT", 0, -102)
  show:SetScript("OnClick", function() if ns.Main then ns.Main:Select(id) end end)

  -- Vorlagen
  local function preset(list)
    d.cats = {}
    for _, k in ipairs(list) do d.cats[k] = true end
    repaint()
  end
  local presets = {
    { "Alles", "primary", 92, function() for _, c in ipairs(ns.CATS) do d.cats[c.key] = true end d.newChannels = true
      for k in pairs(DB().channels or {}) do d.chans["ch:" .. k] = true end repaint() end },
    { "Nur Gespraeche", "soft", 150, function() preset({ "say", "yell", "emote", "whisper", "bnet", "party", "raid", "raidwarn",
      "instance", "guild", "officer" }) end },
    { "Handel & Gold", "soft", 140, function()
      local l = {}
      for _, c in ipairs(ns.CATS) do if c.group == "ah" then l[#l + 1] = c.key end end
      preset(l) end },
    { "Nichts", "ghost", 92, function() d.cats = {} d.newChannels = false
      for k in pairs(DB().channels or {}) do d.chans["ch:" .. k] = false end repaint() end },
  }
  local px = 0
  local pl = label(p, "Schnell-Auswahl")
  pl:SetPoint("TOPLEFT", 14, -150)
  for _, pr in ipairs(presets) do
    local bw = pr[3]
    local b = UI.Button(p, pr[1], pr[2], bw, 32)
    b:SetPoint("TOPLEFT", px, -170)
    b:SetScript("OnClick", pr[4])
    px = px + bw + 8
  end

  local search = UI.SearchBox(p, w, "Nachrichtenart suchen (z. B. Auktion, Gilde, Handel) ...", function(t)
    filter = t or ""
    layoutRows(274)
  end)
  search:SetPoint("TOPLEFT", 0, -218)
  search.edit:SetText(filter)

  -- Auswahlliste
  local colW = math.floor((w - 24) / 2)
  for _, gr in ipairs(ns.GROUPS) do
    local entry = { kind = "title", children = {} }
    local keys = {}
    for _, c in ipairs(ns.CATS) do if c.group == gr.key then keys[#keys + 1] = c end end
    local function setAll(v)
      for _, c in ipairs(keys) do d.cats[c.key] = v or nil end
      if gr.key == "chan" then
        d.newChannels = v
        for k in pairs(DB().channels or {}) do d.chans["ch:" .. k] = v end
      end
      repaint()
    end
    entry.frame = groupTitle(gr.label, function() setAll(true) end, function() setAll(false) end)
    if gr.key == "chan" then
      local chans = {}
      for k in pairs(DB().channels or {}) do chans[#chans + 1] = k end
      table.sort(chans)
      for _, k in ipairs(chans) do
        local key = "ch:" .. k
        local t = UI.Toggle(p, "Kanal: " .. k, function() return ns.Wants(d, nil, key) end,
          function(v) d.chans[key] = v end, nil, colW)
        entry.children[#entry.children + 1] = { frame = t, search = ("kanal " .. k):lower() }
      end
      local t = UI.Toggle(p, "Neue Kanaele zeigen", function() return d.newChannels == true end,
        function(v) d.newChannels = v end, nil, colW)
      entry.children[#entry.children + 1] = { frame = t, search = "kanal neue kanaele automatisch" }
    end
    for _, c in ipairs(keys) do
      local t = UI.Toggle(p, c.label, function() return d.cats[c.key] == true end,
        function(v) d.cats[c.key] = v or nil end, nil, colW)
      if c.tip then UI.SetTooltip(t, c.label, c.tip) end
      entry.children[#entry.children + 1] = { frame = t, search = (c.label .. " " .. gr.label .. " " .. (c.tip or "")):lower() }
    end
    rows[#rows + 1] = entry
  end
  layoutRows(274)
end

local function generalPage()
  local p = newPage()
  local w = p:GetWidth()
  rows = nil
  local st = UI.Stack(p, 0)
  local half = math.floor((w - 24) / 2)
  local F = DB().frame
  st:Title("Chatfenster")
  local font = UI.Stepper(p, "Schrift", half, function() return F.font or 13 end,
    function(v) F.font = v refreshWindows() end, 1, 9, 24, function(v) return v .. " px" end)
  local fade = UI.Stepper(p, "Ausblenden", half, function() return F.fade or 0 end,
    function(v) F.fade = v refreshWindows() end, 10, 0, 600, function(v) return v == 0 and "nie" or (v .. " s") end)
  st:Add(font, 34, 0)
  fade:SetPoint("LEFT", font, "RIGHT", 24, 0)
  st:Space(10)
  local lockAnchor = CreateFrame("Frame", nil, p)
  lockAnchor:SetSize(half, 34)
  st:Add(lockAnchor, 34, 0)
  local lockT = UI.Toggle(p, "Sperren", function() return F.locked == true end,
    function(v) F.locked = v refreshWindows() end, nil, half)
  lockT:SetPoint("LEFT", lockAnchor, "LEFT", 0, 0)
  local bar = UI.Stepper(p, "Reiter weg nach", half, function() return F.barFade or 5 end,
    function(v) F.barFade = v end, 1, 0, 60, function(v) return v == 0 and "nie" or (v .. " s") end)
  UI.SetTooltip(bar, "Reiterleiste ausblenden", "So viele Sekunden, nachdem die Maus das Chatfenster verlassen hat, blendet die Reiterleiste aus. Maus drueber = sofort wieder da. 0 = immer sichtbar.")
  bar:SetPoint("LEFT", lockAnchor, "RIGHT", 24, 0)
  st:Space(14)
  st:Title("Darstellung")
  local function seg(text, options, get, set)
    local l = label(p, text)
    st:Add(l, 18, 6, 14)
    local s = UI.Segments(p, options, function(v) set(v) refreshWindows() end, w)
    s:Select(get())
    st:Add(s, s:GetHeight(), 16)
  end
  seg("Zeitstempel", { { label = "Aus", value = "aus" }, { label = "14:05", value = "%H:%M" }, { label = "14:05:33", value = "%H:%M:%S" } },
    function() return DB().timestamp end, function(v) DB().timestamp = v end)
  seg("Herkunft vorne in jeder Zeile", { { label = "[Handel]", value = "name" }, { label = "[2·H]", value = "kurz" },
    { label = "[2]", value = "nummer" }, { label = "[2. Handel]", value = "voll" } },
    function() return DB().channelStyle end, function(v) DB().channelStyle = v end)
  seg("Chat-Schrift", { { label = "Tech 2045", value = "tech" }, { label = "Poppins", value = "poppins" },
    { label = "Spielschrift", value = "spiel" } }, function() return DB().font or "tech" end, function(v) DB().font = v end)

  local toggles = {
    { "Klassenfarben fuer Namen", "classColors", "Spielernamen in Klassenfarbe: Chat, Beute, Emotes, Freunde, Kaeufer." },
    { "Links anklickbar", "links", "Internet-Adressen werden zum Kopieren anklickbar." },
    { "Spam-Filter", "spam", "Gleiche Zeile vom gleichen Spieler binnen 60 s wird ausgeblendet." },
    { "Wert bei Beute", "lootPrices", "Haendlerpreis (mit Auctionator auch AH-Preis) hinter eigener Beute." },
    { "Ton bei Fluestern", "soundWhisper", "Kurzer Ton, wenn dir jemand fluestert." },
    { "Ton bei Stichwort", "soundKeyword", "Ton, wenn eines deiner Stichwoerter faellt." },
    { "Eigenen Namen hervorheben", "ownName", "Nennt dich jemand, wird die Zeile mit ! markiert." },
    { "Namen in [Klammern]", "nameBrackets", "Wie im Blizzard-Chat: [Name] statt Name." },
    { "Verlauf speichern", "history", "Die letzten Zeilen bleiben nach /reload und Neustart." },
    { "Animationen", "animations", "Fliessender Neon-Rand, Lauflicht, pulsierende Kugel und atmende Eckklammern." },
    { "Leiste + Knoepfe immer zeigen", "alwaysHeader", "Reiterleiste nie ausblenden; Zahnrad, Schloss, Kopieren und + nicht nur bei Maus ueber dem Fenster." },
  }
  st:Space(6)
  st:Title("Funktionen")
  for _, t in ipairs(toggles) do
    local tg = UI.Toggle(p, t[1], function() return DB()[t[2]] == true end,
      function(v) DB()[t[2]] = v refreshWindows() if t[2] == "animations" then UI.UpdateAnimations() end end, t[3], w)
    st:Add(tg, tg:GetHeight(), 6)
  end

  st:Space(6)
  st:Title("Stichwoerter")
  st:Para("Kommt eines dieser Woerter im Chat vor, wird es gelb hervorgehoben und es gibt einen Ton. Mit Komma trennen, z. B.: "
    .. "|cff39ff6bLFM, Inv, Stoff, Ony|r", 12, C.muted)
  local kw = editPill(p, w, DB().keywords or "", function(t) DB().keywords = t end, 200)
  st:Add(kw, 36, 16)

  st:Title("Blizzard-Chat")
  local bz = UI.Toggle(p, "Blizzard-Chat ausblenden", function() return DB().hideBlizzard end,
    function(v) DB().hideBlizzard = v if ns.Blizzard then ns.Blizzard.Apply() end end,
    "Die normalen Chatfenster verschwinden, ChatWerk zeigt alles. Die Eingabezeile (Enter) sitzt unter dem Chatfenster.", w)
  st:Add(bz, bz:GetHeight(), 12)
  local hl = UI.Stepper(p, "Verlauf je Reiter", half, function() return DB().historyLines or 150 end,
    function(v) DB().historyLines = v end, 50, 50, 1000, function(v) return v .. " Zeilen" end)
  st:Add(hl, 34, 14)
  st:Para("|cff39ff6b/cw|r Einstellungen · |cff39ff6b/cw neu|r neuer Reiter · |cff39ff6b/cw sperren|r Fenster sperren/frei · "
    .. "|cff39ff6b/cw blizzard|r Blizzard-Chat ein/aus", 12, C.dim)
  st:Finish(20)
  page:SetHeight(st.y + 20)
  content:SetHeight(st.y + 30)
  if sf.UpdateBar then sf.UpdateBar() end
end

----------------------------------------------------------------------------
-- Seite: Aussehen (gleiche Hintergruende, Farbthemen und Transparenz wie KampfWerk)
----------------------------------------------------------------------------
local function lookPage()
  local p = newPage()
  rows = nil
  local st = UI.Stack(p, 0)
  local w = st:Width()
  local half = math.floor((w - 24) / 2)
  local F = DB().frame
  st:Title("Hintergrund")
  local items = {}
  for _, b in ipairs(ns.BACKGROUNDS) do
    items[#items + 1] = { value = b.key, label = b.label, tex = b.file, tile = b.tile }
  end
  grid(p, st, items, function(v) return (F.bg or "glas") == v end, function(v) F.bg = v refreshWindows() end, 4, 56, 10)
  st:Para("Die drei WoW-Hintergruende kommen direkt aus dem Spiel. Fehlt einer in Forever, bleibt die Flaeche leer - "
    .. "dann einfach einen anderen waehlen.", 12, C.dim)
  local ba = UI.Stepper(p, "Hintergrund", half, function() return math.floor((F.bgAlpha or 0.55) * 100 + 0.5) end,
    function(v) F.bgAlpha = v / 100 refreshWindows() end, 5, 0, 100, function(v) return v .. " %" end)
  local ga = UI.Stepper(p, "Glas", half, function() return math.floor((F.alpha or 0.62) * 100 + 0.5) end,
    function(v) F.alpha = v / 100 refreshWindows() end, 5, 0, 100, function(v) return v .. " %" end)
  UI.SetTooltip(ba, "Hintergrund", "Wie stark das Hintergrundbild durchscheint. 0 % = nur Glas.")
  UI.SetTooltip(ga, "Glas", "Deckkraft der Glasflaeche und Staerke des Neon-Rands. 0 % = komplett durchsichtig.")
  st:Add(ba, 34, 0)
  ga:SetPoint("LEFT", ba, "RIGHT", 24, 0)
  st:Space(18)
  st:Title("Farbthema")
  st:Para("Faerbt Neon-Rand, Eckklammern, Lauflicht, aktiven Reiter, Unterstrich, Status-Kugel und Griff.", 12, C.dim)
  local th = {}
  for _, t in ipairs(ns.THEMES) do th[#th + 1] = { value = t.key, label = t.label, grad = t.c } end
  grid(p, st, th, function(v) return (F.theme or "neon") == v end,
    function(v) F.theme = v refreshWindows() Config.Show(current) end, 3, 38, 10)
  st:Finish(20)
  page:SetHeight(st.y + 20)
  content:SetHeight(st.y + 30)
  if sf.UpdateBar then sf.UpdateBar() end
end

----------------------------------------------------------------------------
-- Seitenleiste
----------------------------------------------------------------------------
local function sideButton(i, text, value, icon)
  local b = sideButtons[i]
  if not b then
    b = UI.SafeButton(side)
    b:SetSize(SIDE - 28, 40)
    local shape = UI.PillShape(b, 40, 0, true)
    b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetSize(16, 16)
    b.icon:SetPoint("LEFT", 16, 0)
    b.text = UI.Text(b, 13, "semibold", C.text)
    b.text:SetPoint("LEFT", b.icon, "RIGHT", 9, 0)
    b.text:SetPoint("RIGHT", -12, 0)
    b.text:SetWordWrap(false)
    function b:Paint()
      local on = current == self.value
      local hover = self:IsMouseOver()
      if on then
        self.edge:SetGradientV({ 1, 1, 1, 0.6 }, { 1, 1, 1, 0.1 })
        self.bg:SetGradient(UI.GRAD, 1)
        self.gloss:SetAlpha(1)
        self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
        self.icon:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
      else
        local g = hover and UI.GLASS.pillHi or UI.GLASS.pill
        self.edge:SetGradient(UI.GRAD_EDGE, hover and 0.55 or 0.18)
        self.bg:SetGradientV(g[1], g[2], hover and 0.95 or 0.7)
        self.gloss:SetAlpha(0.35)
        self.text:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
        self.icon:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 1)
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
  b:SetPoint("TOPLEFT", 14, -(i - 1) * 46 - 14)
  b:Show()
  b:Paint()
  return b
end

function Config.Sidebar()
  if not side then return end
  for _, b in ipairs(sideButtons) do b:Hide() end
  local i = 1
  sideButton(i, "Einstellungen", "general", "gear")
  i = i + 1
  sideButton(i, "Aussehen", "look", "palette")
  for _, d in ipairs(DB().windows) do
    i = i + 1
    sideButton(i, d.name or "Chat", d.id, "chat")
  end
  side.add:ClearAllPoints()
  side.add:SetPoint("TOPLEFT", 14, -i * 46 - 22)
end

function Config.Show(value)
  current = value
  if value ~= "general" and value ~= "look" then filter = filter or "" end
  Config.Sidebar()
  if sf.ScrollToTop then sf:ScrollToTop() end
  if value == "general" then
    frame.sub:SetText("Allgemeine Einstellungen")
    generalPage()
  elseif value == "look" then
    frame.sub:SetText("Hintergrund, Farbthema, Transparenz")
    lookPage()
  else
    local d = ns.WindowById(value)
    frame.sub:SetText("Reiter \"" .. (d and d.name or "?") .. "\" - was soll hier stehen?")
    windowPage(value)
  end
end

----------------------------------------------------------------------------
-- Hauptfenster
----------------------------------------------------------------------------
local function build()
  frame = CreateFrame("Frame", "ChatWerkConfig", UIParent)
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
  local glass = UI.Glass(frame, { radius = 28, body = UI.GLASS.window, edgeMode = "neon", edge = 0.6, halo = 0.16, haloPad = 30, sheen = 0.05 })
  UI.HUD(frame, { radius = 28, flow = glass.edge, flowAlpha = 0.65, grid = 0.045, streakW = 220, streakTime = 4 })
  tinsert(UISpecialFrames, "ChatWerkConfig")

  -- weiche Farb-Leuchten im Hintergrund (organisch statt Kasten)
  local g1 = UI.Glow(frame, C.amber, 420, 0.07, "BACKGROUND")
  g1:SetPoint("CENTER", frame, "TOPLEFT", 120, -40)
  local g2 = UI.Glow(frame, C.aqua, 480, 0.06, "BACKGROUND")
  g2:SetPoint("CENTER", frame, "BOTTOMRIGHT", -80, 40)

  local logo = frame:CreateTexture(nil, "ARTWORK")
  logo:SetTexture(ns.MEDIA .. "logo")
  logo:SetSize(46, 46)
  logo:SetPoint("TOPLEFT", 24, -18)
  local title = UI.Text(frame, 22, "display", C.text)
  title:SetPoint("TOPLEFT", logo, "TOPRIGHT", 12, -2)
  title:SetText(UI.GradText("CHATWERK", C.amber, C.aqua))
  frame.sub = UI.Text(frame, 13, "regular", C.muted)
  frame.sub:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 1, -3)
  local ver = UI.Chip(frame, "v" .. ns.VERSION, C.teal)
  ver:SetPoint("LEFT", title, "RIGHT", 10, 0)

  local close = UI.IconButton(frame, "close", 32, "Schliessen")
  close:SetPoint("TOPRIGHT", -18, -20)
  close:SetScript("OnClick", function() frame:Hide() end)

  -- Seitenleiste als schwebende Glas-Insel
  side = CreateFrame("Frame", nil, frame)
  side:SetPoint("TOPLEFT", 16, -84)
  side:SetPoint("BOTTOMLEFT", 16, 16)
  side:SetWidth(SIDE)
  UI.Glass(side, { radius = 22, body = { { 0.05, 0.065, 0.068, 0.82 }, { 0.035, 0.042, 0.050, 0.82 } }, sheen = 0.03, line = 0.15, edge = 0.18 })
  side.add = UI.Button(side, "Neuer Reiter", "primary", SIDE - 28, 38, "plus")
  side.add:SetScript("OnClick", function()
    local d = ns.NewWindow(nil, {})
    refreshWindows()
    if ns.Main then ns.Main:Select(d.id) end
    Config.Show(d.id)
  end)
  local tip = UI.Para(side, 12, C.dim, SIDE - 40)
  tip:SetPoint("BOTTOMLEFT", 20, 18)
  tip:SetText("Jeder Reiter ist ein eigener Chat oben im Fenster. Rechtsklick auf einen Reiter oeffnet seine Seite. Verschieben: an der Reiterleiste ziehen.")

  body = CreateFrame("Frame", nil, frame)
  body:SetPoint("TOPLEFT", side, "TOPRIGHT", 20, -4)
  body:SetPoint("BOTTOMRIGHT", -20, 16)
  sf, content = UI.Scroll(body)
  sf:SetAllPoints()
  content:SetWidth(W - SIDE - 16 - 20 - 20 - 14)
  frame:Hide()
end

function Config.Open(value)
  if not frame then build() end
  frame:Show()
  Config.Show(value or current)
end

function Config.Toggle()
  if frame and frame:IsShown() then frame:Hide() else Config.Open() end
end

-- neue Kanaele in der offenen Liste
function Config.Refresh()
  if frame and frame:IsShown() and current ~= "general" then Config.Show(current) end
end
