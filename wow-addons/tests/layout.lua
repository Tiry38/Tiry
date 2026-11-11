-- Layout-Prüfung für den WoW-Nachbau: löst alle Anker auf (wie der Client), findet Überlappungen
-- und exportiert die sichtbaren Elemente zum Zeichnen (tools/render_pages.py).
local W = require("wow_mock")
local L = {}

local FRAC = {
  TOPLEFT = { 0, 1 }, TOP = { 0.5, 1 }, TOPRIGHT = { 1, 1 }, LEFT = { 0, 0.5 }, CENTER = { 0.5, 0.5 },
  RIGHT = { 1, 0.5 }, BOTTOMLEFT = { 0, 0 }, BOTTOM = { 0.5, 0 }, BOTTOMRIGHT = { 1, 0 },
}

local cache
function L.reset() cache = {} end

local function isShown(o)
  local p = o
  while p do
    if not p.__shown then return false end
    p = p.__parent
  end
  return true
end
L.isShown = isShown

local function ownSize(o)
  local w, h = o.__w or 0, o.__h or 0
  if o.__kind == "FontString" then
    if w <= 0 then w = o:GetStringWidth() end
    if h <= 0 then h = o:GetStringHeight() end
  end
  return w, h
end

-- Rechteck { l, b, r, t } in Bildschirmkoordinaten (y nach oben)
function L.rect(o)
  if not o then return nil end
  if cache[o] then return cache[o] end
  if o.__name == "UIParent" then
    cache[o] = { l = 0, b = 0, r = o.__w, t = o.__h }
    return cache[o]
  end
  cache[o] = { l = 0, b = 0, r = 0, t = 0 } -- Schutz vor Zyklen
  local parent = o.__parent
  -- Scroll-Inhalt sitzt oben links im Scrollrahmen, verschoben um die Scrollposition
  if parent and parent.__child == o then
    local pr = L.rect(parent)
    local w, h = ownSize(o)
    local off = parent.__scroll or 0
    cache[o] = { l = pr.l, t = pr.t + off, r = pr.l + w, b = pr.t + off - h }
    return cache[o]
  end
  if o.__allPoints then
    local rel = (o.__allPoints == true) and parent or o.__allPoints
    if type(rel) == "string" then rel = _G[rel] end
    local rr = L.rect(rel or parent)
    cache[o] = { l = rr.l, b = rr.b, r = rr.r, t = rr.t }
    return cache[o]
  end
  local hx, vy = {}, {}
  for point, a in pairs(o.__points) do
    local rel = a[1]
    if type(rel) == "string" then rel = _G[rel] end
    local relPoint = a[2]
    local x, y = a[3] or 0, a[4] or 0
    if type(rel) ~= "table" then -- SetPoint("TOPLEFT", 10, -5)
      x, y = (type(a[1]) == "number") and a[1] or 0, (type(a[2]) == "number") and a[2] or 0
      rel, relPoint = parent, point
    end
    relPoint = (type(relPoint) == "string") and relPoint or point
    local rr = L.rect(rel or parent)
    local f, rf = FRAC[point], FRAC[relPoint]
    hx[#hx + 1] = { f = f[1], v = rr.l + (rr.r - rr.l) * rf[1] + x }
    vy[#vy + 1] = { f = f[2], v = rr.b + (rr.t - rr.b) * rf[2] + y }
  end
  local w, h = ownSize(o)
  local function axis(list, size)
    if #list == 0 then return 0, size end
    for i = 1, #list do
      for j = i + 1, #list do
        if list[i].f ~= list[j].f then
          local a, b = list[i], list[j]
          local s = (b.v - a.v) / (b.f - a.f)
          return a.v - a.f * s, s
        end
      end
    end
    return list[1].v - list[1].f * size, size
  end
  local l, ww = axis(hx, w)
  local b, hh = axis(vy, h)
  cache[o] = { l = l, b = b, r = l + ww, t = b + hh }
  return cache[o]
end

local function inter(a, b, pad)
  pad = pad or 0
  local w = math.min(a.r + pad, b.r + pad) - math.max(a.l - pad, b.l - pad)
  local h = math.min(a.t + pad, b.t + pad) - math.max(a.b - pad, b.b - pad)
  return w, h
end

local function isAncestor(a, b)
  local p = b.__parent
  while p do
    if p == a then return true end
    p = p.__parent
  end
  return false
end

local function walk(o, fn)
  fn(o)
  for _, c in ipairs(o.__children or {}) do walk(c, fn) end
end
L.walk = walk

-- Text-Rechteck = tatsächlich belegte Fläche (Breite der Zeilen, nicht die volle Feldbreite)
local function textRect(fs)
  local r = L.rect(fs)
  local tw = fs:GetStringWidth()
  local th = fs:GetStringHeight()
  local just = fs.__justH or "CENTER"
  local l = r.l
  if (r.r - r.l) > tw then
    if just == "CENTER" then l = r.l + ((r.r - r.l) - tw) / 2 elseif just == "RIGHT" then l = r.r - tw end
  end
  local t = r.t
  if (r.t - r.b) > th and (fs.__justV or "MIDDLE") == "MIDDLE" then t = r.t - ((r.t - r.b) - th) / 2 end
  return { l = l, r = l + tw, t = t, b = t - th }
end
L.textRect = textRect

-- Findet überlappende Texte und Texte, die in fremde Bedienelemente ragen
function L.problems(root, clipRect)
  L.reset()
  local texts, controls, out = {}, {}, {}
  walk(root, function(o)
    if not isShown(o) then return end
    if o.__kind == "FontString" and W.strip(o.__text or "") ~= "" then
      local tr = textRect(o)
      if not clipRect or (tr.t > clipRect.b and tr.b < clipRect.t) then texts[#texts + 1] = { o = o, r = tr } end
    elseif (o.__kind == "Button" or o.__kind == "EditBox") and (o.__w or 0) > 0 then
      controls[#controls + 1] = { o = o, r = L.rect(o) }
    end
  end)
  for i = 1, #texts do
    for j = i + 1, #texts do
      local w, h = inter(texts[i].r, texts[j].r, 1)
      if w > 0.01 and h > 0.01 then -- Rundungsfehler ignorieren
        out[#out + 1] = string.format("Text überlappt Text: \"%s\" <-> \"%s\"", W.strip(texts[i].o.__text):sub(1, 40), W.strip(texts[j].o.__text):sub(1, 40))
      end
    end
    for _, c in ipairs(controls) do
      if not isAncestor(c.o, texts[i].o) and not isAncestor(texts[i].o.__parent, c.o) and texts[i].o.__parent ~= c.o then
        local w, h = inter(texts[i].r, c.r, 2)
        if w > 0 and h > 0 then
          out[#out + 1] = string.format("Text ragt in Bedienelement: \"%s\"", W.strip(texts[i].o.__text):sub(1, 50))
        end
      end
    end
    -- Text ragt unten/rechts aus seiner Karte (Elternrahmen mit fester Größe, kein Scroll-Inhalt)
    do
      local o = texts[i].o
      local par = o.__parent
      if par and par.__kind ~= "ScrollFrame" and not (par.__parent and par.__parent.__child == par) and (par.__w or 0) > 0 and (par.__h or 0) > 0 then
        local pr = L.rect(par)
        local tr = texts[i].r
        if tr.b < pr.b - 3 and tr.t <= pr.t + 1 and tr.t > pr.b then
          out[#out + 1] = string.format("Text ragt unten aus dem Rahmen (%d px): \"%s\"", math.floor(pr.b - tr.b), W.strip(o.__text):sub(1, 50))
        end
      end
    end
    -- einzeilige Texte, die über ihr Feld hinausgehen (würden im Spiel abgeschnitten)
    local o = texts[i].o
    if o.__wrap == false and (o.__w or 0) > 0 and o:GetUnboundedStringWidth() > o.__w + 1 then
      out[#out + 1] = string.format("Text abgeschnitten (%d > %d px): \"%s\"", o:GetUnboundedStringWidth(), o.__w, W.strip(o.__text):sub(1, 50))
    end
  end
  return out
end

-- Zeilen wie W.lines, aber Farbcodes (|cAARRGGBB ... |r) bleiben erhalten, damit die Vorschau farbig zeichnet
local function colorLines(o)
  local raw = tostring(o.__text or ""):gsub("|A[^|]*|a", "\1"):gsub("|T[^|]*|t", "\1")
  local maxW = (o.__wrap ~= false and o.__w and o.__w > 0) and o.__w or nil
  local out = {}
  for para in (raw .. "\n"):gmatch("(.-)\n") do
    if not maxW then
      out[#out + 1] = para
    else
      local line = ""
      for word in para:gmatch("%S+") do
        local try = (line == "") and word or (line .. " " .. word)
        if W.textWidth(o, W.strip(try)) <= maxW + 0.5 or line == "" then
          line = try
        else
          out[#out + 1] = line
          line = word
        end
      end
      out[#out + 1] = line
    end
  end
  return out
end

-- Export zum Zeichnen: eine Zeile pro sichtbarem Element in Zeichenreihenfolge
local LAYERS = { BACKGROUND = 1, BORDER = 2, ARTWORK = 3, OVERLAY = 4, HIGHLIGHT = 5 }
-- opts.levels = true: Frames wie im Spiel nach Strata + Frame-Level zeichnen (sonst Baum-Reihenfolge)
local STRATA_ORDER = { BACKGROUND = 1, LOW = 2, MEDIUM = 3, HIGH = 4, DIALOG = 5, FULLSCREEN = 6, FULLSCREEN_DIALOG = 7, TOOLTIP = 8 }
function L.dump(root, path, opts)
  L.reset()
  local f = assert(io.open(path, "w"))
  -- Masken (z. B. runde Item-Symbole): Ziel-Textur -> Maskendatei, damit die Vorschau sie rund zeichnet
  local masks = {}
  walk(root, function(o)
    if o.__kind == "MaskTexture" and type(o.__allPoints) == "table" and o.__file then masks[o.__allPoints] = o.__file end
  end)
  local function emit(o)
    if not isShown(o) then return end
    local regions = {}
    for _, c in ipairs(o.__children or {}) do
      if c.__kind == "Texture" or c.__kind == "FontString" then regions[#regions + 1] = c end
    end
    table.sort(regions, function(a, b)
      local la, lb = LAYERS[a.__layer] or 3, LAYERS[b.__layer] or 3
      if la ~= lb then return la < lb end
      return (a.__sub or 0) < (b.__sub or 0)
    end)
    for _, rgn in ipairs(regions) do
      if rgn.__shown then
        local r = L.rect(rgn)
        if rgn.__kind == "Texture" then
          local c = rgn.__color or { 1, 1, 1, 1 }
          local g = rgn.__grad
          local coord = rgn.__coord and table.concat(rgn.__coord, ",") or ""
          f:write(table.concat({ "T", r.l, r.b, r.r, r.t, tostring(rgn.__file), c[1], c[2], c[3], (c[4] or 1) * (rgn.__alpha or 1),
            g and g[1] or "", g and table.concat(g[2], ",") or "", g and table.concat(g[3], ",") or "", coord, rgn.__blend or "",
            masks[rgn] and tostring(masks[rgn]) or "", rgn.__slice and table.concat(rgn.__slice, ",") or "", rgn.__rot or "" }, "\t"), "\n")
        else
          local tc = rgn.__tc
          local lines = colorLines(rgn)
          f:write(table.concat({ "F", r.l, r.b, r.r, r.t, rgn.__weight or "regular", rgn.__size or 12, tc[1], tc[2], tc[3], tc[4] or 1,
            rgn.__justH or "CENTER", rgn.__justV or "MIDDLE", rgn.__spacing or 0, table.concat(lines, "\31"), rgn.__outline and "OUTLINE" or "" }, "\t"), "\n")
        end
      end
    end
    if opts and opts.levels then return end
    for _, c in ipairs(o.__children or {}) do
      if c.__kind ~= "Texture" and c.__kind ~= "FontString" and c.__kind ~= "MaskTexture" then emit(c) end
    end
  end
  if opts and opts.levels then
    -- Effektive Ebene: gesetzte Ebene, sonst Eltern + 1 (wie beim Erzeugen im Spiel); Strata erbt vom Eltern-Frame
    local frames, n = {}, 0
    local function collect(o, plevel, pstrata)
      local lvl = o.__lvlSet and o.__level or (plevel + 1)
      local st = o.__strata or pstrata
      n = n + 1
      frames[#frames + 1] = { o = o, lvl = lvl, st = STRATA_ORDER[st] or 3, i = n }
      for _, c in ipairs(o.__children or {}) do
        if c.__kind ~= "Texture" and c.__kind ~= "FontString" and c.__kind ~= "MaskTexture" then collect(c, lvl, st) end
      end
    end
    collect(root, 0, root.__strata or "MEDIUM")
    table.sort(frames, function(a, b)
      if a.st ~= b.st then return a.st < b.st end
      if a.lvl ~= b.lvl then return a.lvl < b.lvl end
      return a.i < b.i
    end)
    for _, e in ipairs(frames) do emit(e.o) end
  else
    emit(root)
  end
  f:close()
end

return L
