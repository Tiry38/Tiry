-- Tiry's Zentrale – Design-System 6.0 "Neon Glass": Farben, Schrift, Glasflächen, runde Formen, Bausteine
local _, ns = ...

local UI = {}
ns.UI = UI

local MEDIA = ns.MEDIA
local WHITE = "Interface\\Buttons\\WHITE8X8"
UI.TEX = {
  circle = MEDIA .. "circle", ring = MEDIA .. "ring", glow = MEDIA .. "glow",
  blob1 = MEDIA .. "blob1", blob2 = MEDIA .. "blob2", wave = MEDIA .. "wave",
  sparkle = MEDIA .. "sparkle", logo = MEDIA .. "logo", wordmark = MEDIA .. "wordmark",
  emblem = MEDIA .. "emblem", tribal = MEDIA .. "tribal", corner = MEDIA .. "corner",
  -- Neon-Glas
  ringthin = MEDIA .. "ringthin", ringgrad = MEDIA .. "ringgrad", gloss = MEDIA .. "gloss",
  shade = MEDIA .. "shade", fade = MEDIA .. "fade", white = WHITE,
}


function UI.Icon(name) return MEDIA .. "i_" .. name end

----------------------------------------------------------------------------
-- Farben (Kontrast der Texte auf den Glasflächen >= 4.5:1)
----------------------------------------------------------------------------
local C = {
  -- Anthrazit + Neon-Grün (#39FF6B) / Türkis / Aqua. Orange nur sparsam: "jetzt dran" und Warnungen.
  bg     = { 0.047, 0.057, 0.060, 0.97 },
  side   = { 0.066, 0.078, 0.080, 0.94 },
  card   = { 0.098, 0.114, 0.116, 0.96 },
  cardHi = { 0.150, 0.176, 0.176, 0.98 },
  inset  = { 0.072, 0.085, 0.088, 0.95 },
  text   = { 0.955, 0.975, 0.965 },
  muted  = { 0.770, 0.825, 0.805 },
  dim    = { 0.600, 0.665, 0.640 },
  gold   = { 0.470, 1.000, 0.580 }, -- Akzent Mint-Neon (Name bleibt für den Code)
  amber  = { 0.224, 1.000, 0.420 }, -- Neon-Grün #39FF6B
  rose   = { 0.000, 0.800, 0.580 }, -- Smaragd
  teal   = { 0.150, 0.950, 0.850 }, -- Türkis
  aqua   = { 0.160, 0.700, 1.000 }, -- Aqua
  violet = { 0.200, 0.420, 0.420 }, -- Schiefer-Türkis
  green  = { 0.380, 0.950, 0.580 },
  red    = { 1.000, 0.440, 0.520 },
  dark   = { 0.020, 0.060, 0.045 },
  hi     = { 1.000, 0.640, 0.240 }, -- Orange-Akzent (sparsam)
}
C.neon = C.amber
UI.C = C
UI.GRAD = { C.amber, C.teal, C.aqua }                       -- Haupt-Verlauf: Neon-Grün -> Türkis -> Aqua
UI.GRAD_COOL = { C.teal, C.aqua, { 0.32, 0.52, 1.00 } }     -- Zweit-Verlauf: Türkis -> Aqua -> Blau
UI.GRAD_FRESH = { { 0.62, 1.00, 0.36 }, C.amber, C.teal }   -- Lime -> Neon -> Türkis
UI.GRAD_EDGE = { C.amber, C.teal, C.aqua }                  -- Leuchtrand
UI.NEON_HEX = "|cff39ff6b"
UI.TEAL_HEX = "|cff26f2d9"

-- Glas-Körper (oben -> unten): Fenster, Karte, Held (Hero)
UI.GLASS = {
  window = { { 0.074, 0.096, 0.092, 0.97 }, { 0.026, 0.030, 0.040, 0.97 } },
  card   = { { 0.118, 0.148, 0.142, 0.93 }, { 0.058, 0.068, 0.076, 0.95 } },
  hero   = { { 0.070, 0.190, 0.140, 0.96 }, { 0.040, 0.072, 0.082, 0.97 } },
  pill   = { { 0.170, 0.205, 0.200, 0.96 }, { 0.090, 0.104, 0.112, 0.97 } },
  pillHi = { { 0.215, 0.260, 0.252, 0.98 }, { 0.115, 0.135, 0.142, 0.98 } },
}

-- Horde-Stil im Hintergrund: Stammesmuster (gekachelt) + Zacken-Ecken. Sehr dezent, frisst keine Klicks.
-- opts: w, h (Größe für die Kachelung), pattern (Alpha), corners (Alpha), cornerSize, inset
function UI.Ornaments(frame, opts)
  opts = opts or {}
  local holder = CreateFrame("Frame", nil, frame)
  holder:SetPoint("TOPLEFT", opts.inset or 8, -(opts.inset or 8))
  holder:SetPoint("BOTTOMRIGHT", -(opts.inset or 8), opts.inset or 8)
  holder:SetFrameLevel(frame:GetFrameLevel())
  holder:SetClipsChildren(true)
  local accent = C.amber
  if (opts.pattern or 0) > 0 then
    local t = holder:CreateTexture(nil, "BACKGROUND", nil, -6)
    t:SetTexture(UI.TEX.tribal, "REPEAT", "REPEAT")
    t:SetPoint("TOPLEFT")
    t:SetSize(opts.w, opts.h)
    t:SetTexCoord(0, opts.w / 160, 0, opts.h / 160)
    t:SetVertexColor(accent[1], accent[2], accent[3], opts.pattern)
    holder.pattern = t
  end
  holder.corners = {}
  if (opts.corners or 0.3) > 0 then
    local cs = opts.cornerSize or 64
    local coords = {
      { "TOPLEFT", 0, 1, 0, 1 }, { "TOPRIGHT", 1, 0, 0, 1 },
      { "BOTTOMLEFT", 0, 1, 1, 0 }, { "BOTTOMRIGHT", 1, 0, 1, 0 },
    }
    for _, cdef in ipairs(coords) do
      local t = holder:CreateTexture(nil, "BACKGROUND", nil, -5)
      t:SetTexture(UI.TEX.corner)
      t:SetSize(cs, cs)
      t:SetPoint(cdef[1])
      t:SetTexCoord(cdef[2], cdef[3], cdef[4], cdef[5])
      t:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], opts.corners or 0.3)
      holder.corners[#holder.corners + 1] = t
    end
  end
  return holder
end

function UI.Hex(c)
  return string.format("|cff%02x%02x%02x", math.floor(c[1] * 255), math.floor(c[2] * 255), math.floor(c[3] * 255))
end

UI.QUALITY = {
  [0] = { 0.62, 0.62, 0.62 }, [1] = { 1, 1, 1 }, [2] = { 0.12, 1, 0 },
  [3] = { 0.0, 0.44, 0.87 }, [4] = { 0.64, 0.21, 0.93 }, [5] = { 1, 0.5, 0 },
}

----------------------------------------------------------------------------
-- Schrift (eigene Poppins-Schrift mit sicherem Rückfall auf die Spielschrift)
----------------------------------------------------------------------------
local FONT_FILES = {
  regular = MEDIA .. "Fonts\\Poppins-Regular.ttf",
  semibold = MEDIA .. "Fonts\\Poppins-SemiBold.ttf",
  bold = MEDIA .. "Fonts\\Poppins-ExtraBold.ttf",
}
local fallbackFont
local function gameFont()
  if fallbackFont then return fallbackFont end
  local f = GameFontNormal and GameFontNormal.GetFont and GameFontNormal:GetFont()
  fallbackFont = f or STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF"
  return fallbackFont
end

function UI.SetFont(fs, size, weight, flags)
  local file = FONT_FILES[weight or "regular"] or FONT_FILES.regular
  local ok, res = pcall(fs.SetFont, fs, file, size, flags or "")
  if not ok or res == false then
    pcall(fs.SetFont, fs, gameFont(), size, flags or "")
  end
end

UI.MIN_FONT = 12 -- gut lesbar: keine Schrift kleiner als 12
function UI.Text(parent, size, weight, color, layer)
  local fs = parent:CreateFontString(nil, layer or "OVERLAY")
  UI.SetFont(fs, math.max(size or 13, UI.MIN_FONT), weight)
  local c = color or C.text
  fs:SetTextColor(c[1], c[2], c[3], c[4] or 1)
  fs:SetJustifyH("LEFT")
  fs:SetJustifyV("MIDDLE")
  fs:SetShadowColor(0, 0, 0, 0.45)
  fs:SetShadowOffset(0, -1)
  return fs
end

-- Setzt Text einzeilig und kürzt ihn wortweise mit "...", bis er in maxW passt (nichts ragt mehr heraus)
function UI.FitText(fs, text, maxW)
  fs:SetText(text)
  if not maxW or fs:GetUnboundedStringWidth() <= maxW then return end
  local words = {}
  for w in text:gmatch("%S+") do words[#words + 1] = w end
  for n = #words - 1, 1, -1 do
    local t = table.concat(words, " ", 1, n):gsub("[,·%-–]+$", "") .. " ..."
    fs:SetText(t)
    if fs:GetUnboundedStringWidth() <= maxW then return end
  end
end

-- Mehrzeiliger Absatz mit fester Breite
function UI.Para(parent, size, color, width, weight)
  local fs = UI.Text(parent, size or 13, weight or "regular", color or C.muted)
  fs:SetJustifyV("TOP")
  fs:SetWordWrap(true)
  fs:SetSpacing(3)
  if width then fs:SetWidth(width) end
  return fs
end

-- Text mit Farbverlauf (Buchstabe für Buchstabe, UTF-8-sicher) – für große Überschriften
function UI.GradText(text, c1, c2)
  text = tostring(text or "")
  c1, c2 = c1 or C.amber, c2 or C.teal
  local chars = {}
  for ch in text:gmatch("[%z\1-\127\194-\244][\128-\191]*") do chars[#chars + 1] = ch end
  local n, out = #chars, {}
  for i, ch in ipairs(chars) do
    if ch == " " then
      out[#out + 1] = ch
    else
      local t = n > 1 and (i - 1) / (n - 1) or 0
      out[#out + 1] = string.format("|cff%02x%02x%02x%s|r",
        math.floor((c1[1] + (c2[1] - c1[1]) * t) * 255 + 0.5),
        math.floor((c1[2] + (c2[2] - c1[2]) * t) * 255 + 0.5),
        math.floor((c1[3] + (c2[3] - c1[3]) * t) * 255 + 0.5), ch)
    end
  end
  return table.concat(out)
end

----------------------------------------------------------------------------
-- Runde Formen: Ecken aus Kreis-Viertel + Flächen; Verläufe waagerecht (3 Farben) und senkrecht
-- inset: Abstand zum Rahmen (für Glasränder), band: nur die oberen <band> Pixel füllen (Glanz)
----------------------------------------------------------------------------
local Round = {}
Round.__index = Round

local function tex(frame, layer, sub, file)
  local t = frame:CreateTexture(nil, layer or "BACKGROUND", nil, sub or 0)
  t:SetTexture(file or WHITE)
  return t
end

function UI.Round(frame, radius, layer, sub, inset, band)
  local r = setmetatable({ frame = frame, radius = radius or 12, parts = {}, inset = inset or 0, band = band }, Round)
  local p = r.parts
  p.tl = tex(frame, layer, sub, UI.TEX.circle); p.tl:SetTexCoord(0, 0.5, 0, 0.5)
  p.tr = tex(frame, layer, sub, UI.TEX.circle); p.tr:SetTexCoord(0.5, 1, 0, 0.5)
  p.bl = tex(frame, layer, sub, UI.TEX.circle); p.bl:SetTexCoord(0, 0.5, 0.5, 1)
  p.br = tex(frame, layer, sub, UI.TEX.circle); p.br:SetTexCoord(0.5, 1, 0.5, 1)
  p.l = tex(frame, layer, sub)
  p.rr = tex(frame, layer, sub)
  p.c1 = tex(frame, layer, sub)
  p.c2 = tex(frame, layer, sub)
  r:Layout()
  frame:HookScript("OnSizeChanged", function() r:Layout() end)
  return r
end

function Round:Layout()
  local f, p = self.frame, self.parts
  local i = self.inset or 0
  local w, h = (f:GetWidth() or 0) - i * 2, (f:GetHeight() or 0) - i * 2
  if self.band then h = math.min(self.band, math.max(h, 0)) end
  local rad = self.radius
  if w > 0 and h > 0 then rad = math.min(rad, w / 2, (self.band and self.radius) or h / 2) end
  rad = math.max(math.floor(rad + 0.5), 1)
  self.r = rad
  self.h = h
  for _, k in ipairs({ "tl", "tr", "bl", "br", "l", "rr", "c1", "c2" }) do p[k]:ClearAllPoints() end
  p.tl:SetSize(rad, rad); p.tl:SetPoint("TOPLEFT", f, "TOPLEFT", i, -i)
  p.tr:SetSize(rad, rad); p.tr:SetPoint("TOPRIGHT", f, "TOPRIGHT", -i, -i)
  if self.band then
    -- Glanzband: oben runde Ecken, unten gerade (läuft per Verlauf aus)
    local bh = math.max(h, rad)
    p.bl:SetSize(rad, math.max(bh - rad, 1)); p.bl:SetPoint("TOPLEFT", f, "TOPLEFT", i, -i - rad)
    p.br:SetSize(rad, math.max(bh - rad, 1)); p.br:SetPoint("TOPRIGHT", f, "TOPRIGHT", -i, -i - rad)
    p.bl:SetTexture(WHITE); p.br:SetTexture(WHITE)
    p.l:SetSize(1, 1); p.l:SetPoint("TOPLEFT", f, "TOPLEFT", i, -i); p.l:SetAlpha(0)
    p.rr:SetSize(1, 1); p.rr:SetPoint("TOPRIGHT", f, "TOPRIGHT", -i, -i); p.rr:SetAlpha(0)
    p.c1:SetPoint("TOPLEFT", f, "TOPLEFT", i + rad, -i); p.c1:SetPoint("TOPRIGHT", f, "TOP", 0, -i); p.c1:SetHeight(bh)
    p.c2:SetPoint("TOPLEFT", f, "TOP", 0, -i); p.c2:SetPoint("TOPRIGHT", f, "TOPRIGHT", -i - rad, -i); p.c2:SetHeight(bh)
  else
    p.bl:SetSize(rad, rad); p.bl:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", i, i)
    p.br:SetSize(rad, rad); p.br:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -i, i)
    p.l:SetPoint("TOPLEFT", f, "TOPLEFT", i, -rad - i); p.l:SetPoint("BOTTOMRIGHT", f, "BOTTOMLEFT", rad + i, rad + i)
    p.rr:SetPoint("TOPRIGHT", f, "TOPRIGHT", -i, -rad - i); p.rr:SetPoint("BOTTOMLEFT", f, "BOTTOMRIGHT", -rad - i, rad + i)
    p.c1:SetPoint("TOPLEFT", f, "TOPLEFT", rad + i, -i); p.c1:SetPoint("BOTTOMRIGHT", f, "BOTTOM", 0, i)
    p.c2:SetPoint("TOPLEFT", f, "TOP", 0, -i); p.c2:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -rad - i, i)
  end
  if self.mode == "vgrad" then self:ApplyV() end
end

local function setColor(t, c, a)
  t:SetVertexColor(c[1], c[2], c[3], a or c[4] or 1)
end

local function setGrad(t, c1, c2, a)
  local ok = pcall(t.SetGradient, t, "HORIZONTAL",
    CreateColor(c1[1], c1[2], c1[3], a or c1[4] or 1), CreateColor(c2[1], c2[2], c2[3], a or c2[4] or 1))
  if not ok then setColor(t, c1, a) end
end

-- Senkrechter Verlauf: top oben, bot unten; Alpha = Farb-Alpha × a
local function setGradV(t, top, bot, a)
  local ta, ba = (top[4] or 1) * (a or 1), (bot[4] or 1) * (a or 1)
  local ok = pcall(t.SetGradient, t, "VERTICAL", CreateColor(bot[1], bot[2], bot[3], ba), CreateColor(top[1], top[2], top[3], ta))
  if not ok then setColor(t, top, ta) end
end
UI.SetGradV = setGradV
UI.SetGradH = setGrad

local function lerp(c1, c2, t)
  return { c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t, c1[3] + (c2[3] - c1[3]) * t,
    (c1[4] or 1) + ((c2[4] or 1) - (c1[4] or 1)) * t }
end
UI.Lerp = lerp

function Round:SetColor(c, a)
  for _, t in pairs(self.parts) do setColor(t, c, a) end
  self.mode = "solid"
end

-- Waagerechter Verlauf über drei Farben (links -> Mitte -> rechts)
function Round:SetGradient(stops, a)
  local c1, c2, c3 = stops[1], stops[2], stops[3] or stops[2]
  local p = self.parts
  setColor(p.tl, c1, a); setColor(p.bl, c1, a); setColor(p.l, c1, a)
  setColor(p.tr, c3, a); setColor(p.br, c3, a); setColor(p.rr, c3, a)
  setGrad(p.c1, c1, c2, a)
  setGrad(p.c2, c2, c3, a)
  self.mode = "grad"
end

-- Senkrechter Verlauf oben -> unten (exakt über alle Teile, auch in den runden Ecken)
function Round:SetGradientV(top, bot, a)
  self.vg = { top, bot, a }
  self.mode = "vgrad"
  self:ApplyV()
end

function Round:ApplyV()
  local top, bot, a = self.vg[1], self.vg[2], self.vg[3]
  local p, h, r = self.parts, self.h or 0, self.r or self.radius
  if self.band then
    local t1 = h > 0 and math.min(r / h, 1) or 0.5
    local cA = lerp(top, bot, t1)
    setGradV(p.tl, top, cA, a); setGradV(p.tr, top, cA, a)
    setGradV(p.bl, cA, bot, a); setGradV(p.br, cA, bot, a)
    setGradV(p.c1, top, bot, a); setGradV(p.c2, top, bot, a)
    return
  end
  local t1 = h > 0 and math.min(r / h, 0.5) or 0.25
  local cA, cB = lerp(top, bot, t1), lerp(top, bot, 1 - t1)
  setGradV(p.tl, top, cA, a); setGradV(p.tr, top, cA, a)
  setGradV(p.l, cA, cB, a); setGradV(p.rr, cA, cB, a)
  setGradV(p.bl, cB, bot, a); setGradV(p.br, cB, bot, a)
  setGradV(p.c1, top, bot, a); setGradV(p.c2, top, bot, a)
end

function Round:SetAlpha(a)
  for k, t in pairs(self.parts) do
    if not (self.band and (k == "l" or k == "rr")) then t:SetAlpha(a) end
  end
end

function Round:SetShown(shown)
  for _, t in pairs(self.parts) do t:SetShown(shown) end
end

function Round:SetBlendMode(mode)
  for _, t in pairs(self.parts) do t:SetBlendMode(mode) end
end

-- Glas-Farbe: aus einer Grundfarbe wird ein senkrechter Verlauf (oben heller/grünlich, unten tiefer)
function UI.GlassStops(c)
  return { math.min(c[1] * 1.08 + 0.014, 1), math.min(c[2] * 1.12 + 0.030, 1), math.min(c[3] * 1.10 + 0.024, 1), c[4] or 1 },
    { c[1] * 0.56, c[2] * 0.58, c[3] * 0.64, c[4] or 1 }
end

----------------------------------------------------------------------------
-- Weiches Leuchten
----------------------------------------------------------------------------
function UI.Glow(frame, color, size, alpha, layer)
  local g = frame:CreateTexture(nil, layer or "BACKGROUND", nil, -6)
  g:SetTexture(UI.TEX.glow)
  g:SetBlendMode("ADD")
  g:SetSize(size, size)
  g:SetVertexColor(color[1], color[2], color[3], alpha or 0.5)
  return g
end

-- Äußeres Leuchten rund um eine Fläche (9-teilig aus der Glow-Textur, Farbe links -> rechts)
local Halo = {}
Halo.__index = Halo
function UI.Halo(frame, stops, alpha, pad, layer, sub)
  pad = pad or 24
  local h = setmetatable({ parts = {}, pad = pad }, Halo)
  local function t(u0, u1, v0, v1)
    local x = frame:CreateTexture(nil, layer or "BACKGROUND", nil, sub or -8)
    x:SetTexture(UI.TEX.glow)
    x:SetTexCoord(u0, u1, v0, v1)
    x:SetBlendMode("ADD")
    return x
  end
  local p, S = h.parts, pad * 2
  p.tl = t(0, 0.5, 0, 0.5); p.tl:SetSize(S, S); p.tl:SetPoint("TOPLEFT", frame, "TOPLEFT", -pad, pad)
  p.tr = t(0.5, 1, 0, 0.5); p.tr:SetSize(S, S); p.tr:SetPoint("TOPRIGHT", frame, "TOPRIGHT", pad, pad)
  p.bl = t(0, 0.5, 0.5, 1); p.bl:SetSize(S, S); p.bl:SetPoint("BOTTOMLEFT", frame, "BOTTOMLEFT", -pad, -pad)
  p.br = t(0.5, 1, 0.5, 1); p.br:SetSize(S, S); p.br:SetPoint("BOTTOMRIGHT", frame, "BOTTOMRIGHT", pad, -pad)
  p.t = t(0.49, 0.51, 0, 0.5); p.t:SetPoint("TOPLEFT", p.tl, "TOPRIGHT"); p.t:SetPoint("BOTTOMRIGHT", p.tr, "BOTTOMLEFT")
  p.b = t(0.49, 0.51, 0.5, 1); p.b:SetPoint("TOPLEFT", p.bl, "TOPRIGHT"); p.b:SetPoint("BOTTOMRIGHT", p.br, "BOTTOMLEFT")
  p.l = t(0, 0.5, 0.49, 0.51); p.l:SetPoint("TOPLEFT", p.tl, "BOTTOMLEFT"); p.l:SetPoint("BOTTOMRIGHT", p.bl, "TOPRIGHT")
  p.r = t(0.5, 1, 0.49, 0.51); p.r:SetPoint("TOPLEFT", p.tr, "BOTTOMLEFT"); p.r:SetPoint("BOTTOMRIGHT", p.br, "TOPRIGHT")
  h:SetColors(stops or UI.GRAD_EDGE, alpha or 0.3)
  return h
end

function Halo:SetColors(stops, a)
  local c1, c3 = stops[1], stops[3] or stops[2] or stops[1]
  local p = self.parts
  for _, k in ipairs({ "tl", "l", "bl" }) do setColor(p[k], c1, a) end
  for _, k in ipairs({ "tr", "r", "br" }) do setColor(p[k], c3, a) end
  setGrad(p.t, c1, c3, a)
  setGrad(p.b, c1, c3, a)
end

function Halo:SetShown(s) for _, t in pairs(self.parts) do t:SetShown(s) end end
function Halo:SetAlpha(a) for _, t in pairs(self.parts) do t:SetAlpha(a) end end

-- Haarlinie, die zu beiden Enden weich ausläuft
function UI.Hairline(parent, color, alpha, layer, add)
  local t = parent:CreateTexture(nil, layer or "ARTWORK")
  t:SetTexture(UI.TEX.fade)
  t:SetHeight(1)
  local c = color or C.teal
  t:SetVertexColor(c[1], c[2], c[3], alpha or 0.35)
  if add then t:SetBlendMode("ADD") end
  return t
end

----------------------------------------------------------------------------
-- Glasfläche "Neon Glass" (wie LevelPilot 4.1): Leuchtrand, Körper mit Verlauf, Glanz oben, Lichtkante, Halo
-- opts: radius, edge (Alpha), edgeMode ("neon" = Neon-Verlauf links->rechts, "light" = Licht von oben),
--       body = { top, bot }, sheen (Alpha), sheenH, line (Alpha der Lichtkante), halo (Alpha), haloPad,
--       layer, sub (unterste Unterebene, Standard -6)
----------------------------------------------------------------------------
local Glass = {}
Glass.__index = Glass

function UI.Glass(frame, opts)
  opts = opts or {}
  local r = opts.radius or 18
  local layer, sub = opts.layer or "BACKGROUND", opts.sub or -6
  local g = setmetatable({ frame = frame, opts = opts }, Glass)
  if (opts.halo or 0) > 0 then
    g.halo = UI.Halo(frame, opts.haloStops or UI.GRAD_EDGE, opts.halo, opts.haloPad or 26, layer, math.max(sub - 2, -8))
  end
  g.edge = UI.Round(frame, r, layer, sub)
  g.body = UI.Round(frame, math.max(r - 1, 1), layer, sub + 1, 1)
  if (opts.sheen or 0.05) > 0 then
    g.sheen = UI.Round(frame, math.max(r - 1, 1), layer, sub + 2, 1, opts.sheenH or 30)
    g.sheen:SetGradientV({ 1, 1, 1, opts.sheen or 0.05 }, { 1, 1, 1, 0 })
  end
  if (opts.line or 0.30) > 0 then
    g.line = frame:CreateTexture(nil, layer, nil, sub + 3)
    g.line:SetTexture(UI.TEX.fade)
    g.line:SetHeight(1)
    g.line:SetPoint("TOPLEFT", frame, "TOPLEFT", r * 0.5, -1)
    g.line:SetPoint("TOPRIGHT", frame, "TOPRIGHT", -r * 0.5, -1)
    g.line:SetVertexColor(1, 1, 1, opts.line or 0.30)
    g.line:SetBlendMode("ADD")
  end
  g:SetEdge(opts.edgeMode or "light", opts.edge)
  local b = opts.body or UI.GLASS.card
  g.body:SetGradientV(b[1], b[2])
  return g
end

function Glass:SetEdge(mode, alpha)
  self.edgeMode = mode
  if mode == "neon" then
    self.edge:SetGradient(self.opts.edgeStops or UI.GRAD_EDGE, alpha or 0.75)
  elseif type(mode) == "table" then
    self.edge:SetColor(mode, alpha or 0.6)
  else
    local a = alpha or 0.26
    self.edge:SetGradientV({ 0.60, 1.00, 0.85, a }, { 0.20, 0.55, 0.65, a * 0.30 })
  end
end

function Glass:SetBody(top, bot, a)
  self.body:SetGradientV(top, bot, a)
end

function Glass:SetShown(s)
  self.edge:SetShown(s)
  self.body:SetShown(s)
  if self.sheen then self.sheen:SetShown(s) end
  if self.line then self.line:SetShown(s) end
  if self.halo then self.halo:SetShown(s) end
end

-- Sanfte Endlos-Animation (Atmen/Treiben); respektiert die Einstellung "Animationen"
function UI.Drift(region, dx, dy, duration, alphaFrom, alphaTo)
  local ag = region:CreateAnimationGroup()
  ag:SetLooping("BOUNCE")
  local move = ag:CreateAnimation("Translation")
  move:SetOffset(dx or 0, dy or 0)
  move:SetDuration(duration or 6)
  move:SetSmoothing("IN_OUT")
  if alphaFrom and alphaTo then
    local fade = ag:CreateAnimation("Alpha")
    fade:SetFromAlpha(alphaFrom)
    fade:SetToAlpha(alphaTo)
    fade:SetDuration(duration or 6)
    fade:SetSmoothing("IN_OUT")
  end
  UI.animations = UI.animations or {}
  table.insert(UI.animations, ag)
  return ag
end

function UI.UpdateAnimations()
  local on = not ns.settings or ns.settings.animations ~= false
  for _, ag in ipairs(UI.animations or {}) do
    if on then
      if not ag:IsPlaying() then ag:Play() end
    else
      ag:Stop()
    end
  end
end

----------------------------------------------------------------------------
-- Tooltip-Helfer
----------------------------------------------------------------------------
function UI.SetTooltip(frame, title, body)
  frame:HookScript("OnEnter", function(self)
    local t, b = title, body
    if type(t) == "function" then t, b = t(self) end
    if not t then return end
    GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
    GameTooltip:SetText(t, 0.22, 1, 0.42)
    if b then GameTooltip:AddLine(b, 0.86, 0.92, 0.89, true) end
    GameTooltip:Show()
  end)
  frame:HookScript("OnLeave", function() GameTooltip:Hide() end)
end

----------------------------------------------------------------------------
-- Knöpfe
----------------------------------------------------------------------------
-- Klicks & Co. abgesichert: Ein Fehler in einem Knopf landet in der eigenen Fehleranzeige (/tz fehler)
-- statt still zu verschwinden – und bricht nie das ganze Fenster.
local GUARDED = { OnClick = true, OnEnter = true, OnLeave = true, OnMouseDown = true, OnMouseUp = true, OnDragStart = true, OnDragStop = true }
function UI.Guard(frame)
  local set = frame.SetScript
  frame.SetScript = function(self, script, fn, ...)
    if type(fn) == "function" and GUARDED[script] then
      local f = fn
      fn = function(...) return ns.Safe(f, ...) end
    end
    return set(self, script, fn, ...)
  end
  return frame
end

function UI.SafeButton(parent, name)
  return UI.Guard(CreateFrame("Button", name, parent))
end

local function playClick()
  if PlaySound and SOUNDKIT and SOUNDKIT.U_CHAT_SCROLL_BUTTON then
    pcall(PlaySound, SOUNDKIT.U_CHAT_SCROLL_BUTTON)
  end
end
UI.PlayClick = playClick

-- Glas-Pille (Grundform für Knöpfe, Chips, Eingaben): Rand + Körper (1 px eingerückt) + Glanzband
local function pill(frame, h, sub, withGloss)
  local o = {}
  o.edge = UI.Round(frame, h / 2, "BACKGROUND", sub)
  o.body = UI.Round(frame, h / 2 - 1, "BACKGROUND", sub + 1, 1)
  if withGloss then
    o.gloss = UI.Round(frame, h / 2 - 1, "BACKGROUND", sub + 2, 1, math.floor(h * 0.5))
    o.gloss:SetGradientV({ 1, 1, 1, 0.22 }, { 1, 1, 1, 0 })
  end
  return o
end
UI.PillShape = pill

-- style: "primary" (Neon-Verlauf), "cool" (Türkis-Aqua), "danger" (Rot-Glas), "soft" (Glas), "ghost" (nur Rand)
function UI.Button(parent, label, style, width, height, icon)
  local b = UI.SafeButton(parent)
  local h = height or 32
  b:SetSize(width or 140, h)
  b.style = style or "primary"
  b.glow = UI.Glow(b, C.amber, (width or 140) * 1.25, 0, "BACKGROUND")
  b.glow:SetPoint("CENTER", 0, -2)
  b.glow:SetHeight(h * 2.2)
  local shape = pill(b, h, 0, true)
  b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
  b.text = UI.Text(b, 13, "semibold", b.style == "primary" and C.dark or C.text)
  b.text:SetPoint("CENTER", icon and 9 or 0, 0)
  b.text:SetText(label or "")
  if icon then
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetTexture(UI.Icon(icon))
    b.icon:SetSize(15, 15)
    b.icon:SetPoint("RIGHT", b.text, "LEFT", -6, 0)
  end
  function b:Paint()
    local on = self:IsEnabled()
    local hover = self:IsMouseOver() and on
    local st = self.style
    if (st == "primary" or st == "cool") and not on then
      -- gesperrt: Glas mit zartem Neon-Rand statt matschigem Verlauf
      self.edge:SetGradient(UI.GRAD_EDGE, 0.30)
      self.bg:SetGradientV(UI.GLASS.pill[1], UI.GLASS.pill[2], 0.92)
      self.gloss:SetAlpha(0.35)
      self.text:SetTextColor(C.muted[1], C.muted[2], C.muted[3], 0.9)
      if self.icon then self.icon:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 0.7) end
      self.glow:SetAlpha(0)
    elseif st == "primary" or st == "cool" then
      local grad = st == "primary" and UI.GRAD or UI.GRAD_COOL
      self.edge:SetGradientV({ 1, 1, 1, 0.75 }, { 1, 1, 1, 0.12 }, on and 1 or 0.4)
      self.bg:SetGradient(grad, on and (hover and 1 or 0.94) or 0.32)
      self.gloss:SetAlpha(on and (hover and 1.3 or 1) or 0.4)
      self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], on and 1 or 0.6)
      if self.icon then self.icon:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], on and 1 or 0.6) end
      local gc = st == "primary" and C.amber or C.teal
      self.glow:SetVertexColor(gc[1], gc[2], gc[3])
      self.glow:SetAlpha(on and (hover and 0.55 or 0.20) or 0)
    elseif st == "danger" then
      self.edge:SetColor(C.red, on and (hover and 0.9 or 0.55) or 0.2)
      local top, bot = { 0.42, 0.13, 0.18, 0.96 }, { 0.22, 0.07, 0.10, 0.97 }
      self.bg:SetGradientV(top, bot, on and (hover and 1 or 0.9) or 0.4)
      self.gloss:SetAlpha(on and 0.6 or 0.2)
      self.text:SetTextColor(1, 1, 1, on and 1 or 0.45)
      if self.icon then self.icon:SetVertexColor(1, 0.75, 0.8, on and 1 or 0.45) end
      self.glow:SetVertexColor(C.red[1], C.red[2], C.red[3])
      self.glow:SetAlpha(hover and 0.35 or 0)
    else
      local g = hover and UI.GLASS.pillHi or UI.GLASS.pill
      if st == "ghost" then
        self.edge:SetGradient(UI.GRAD_EDGE, on and (hover and 0.65 or 0.30) or 0.12)
        self.bg:SetGradientV(g[1], g[2], hover and 0.95 or 0.80)
      else
        self.edge:SetGradient(UI.GRAD_EDGE, on and (hover and 0.75 or 0.30) or 0.12)
        self.bg:SetGradientV(g[1], g[2], 1)
      end
      self.gloss:SetAlpha(on and (hover and 0.7 or 0.45) or 0.2)
      self.text:SetTextColor(C.text[1], C.text[2], C.text[3], on and 1 or 0.45)
      if self.icon then self.icon:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], on and 1 or 0.45) end
      self.glow:SetVertexColor(C.teal[1], C.teal[2], C.teal[3])
      self.glow:SetAlpha(hover and 0.22 or 0)
    end
  end
  function b:SetLabel(s) self.text:SetText(s) end
  b:SetScript("OnEnter", function(self) self:Paint() end)
  b:SetScript("OnLeave", function(self) self:Paint() end)
  b:SetScript("OnMouseDown", function(self) if self:IsEnabled() then self.text:SetPoint("CENTER", self.icon and 9 or 0, -1) end end)
  b:SetScript("OnMouseUp", function(self) self.text:SetPoint("CENTER", self.icon and 9 or 0, 0) end)
  b:HookScript("OnClick", playClick)
  b:SetScript("OnEnable", function(self) self:Paint() end)
  b:SetScript("OnDisable", function(self) self:Paint() end)
  b:Paint()
  return b
end

-- Runder Glas-Symbolknopf (z. B. Schließen): dunkle Glaskugel, Neon-Ring, Glanz, Leuchten beim Überfahren
function UI.IconButton(parent, icon, size, tip)
  local b = UI.SafeButton(parent)
  size = size or 28
  b:SetSize(size, size)
  b.glow = UI.Glow(b, C.amber, size * 2.1, 0, "BACKGROUND")
  b.glow:SetPoint("CENTER")
  b.bg = b:CreateTexture(nil, "BACKGROUND", nil, 1)
  b.bg:SetTexture(UI.TEX.circle)
  b.bg:SetAllPoints()
  b.ring = b:CreateTexture(nil, "BORDER")
  b.ring:SetTexture(UI.TEX.ringthin)
  b.ring:SetAllPoints()
  b.gloss = b:CreateTexture(nil, "BORDER", nil, 1)
  b.gloss:SetTexture(UI.TEX.gloss)
  b.gloss:SetPoint("TOPLEFT", 1, -1)
  b.gloss:SetPoint("BOTTOMRIGHT", -1, 1)
  b.gloss:SetBlendMode("ADD")
  b.gloss:SetVertexColor(1, 1, 1, 0.14)
  b.icon = b:CreateTexture(nil, "ARTWORK")
  b.icon:SetTexture(UI.Icon(icon))
  b.icon:SetPoint("CENTER")
  b.icon:SetSize(size * 0.5, size * 0.5)
  local function paint(self)
    local hover = self:IsMouseOver()
    local g = hover and UI.GLASS.pillHi or UI.GLASS.pill
    setGradV(self.bg, g[1], g[2], 1)
    setGrad(self.ring, C.amber, C.aqua, hover and 0.95 or 0.38)
    local ic = hover and C.amber or C.muted
    self.icon:SetVertexColor(ic[1], ic[2], ic[3], 1)
    self.glow:SetAlpha(hover and 0.32 or 0)
  end
  b:SetScript("OnEnter", paint)
  b:SetScript("OnLeave", paint)
  b:HookScript("OnClick", playClick)
  paint(b)
  if tip then UI.SetTooltip(b, tip) end
  return b
end

----------------------------------------------------------------------------
-- Karte = Glasfläche. f.bg ist der Glas-Körper: SetColor(c) färbt ihn als Glas-Verlauf, SetGradient bleibt waagerecht.
-- opts (optional): { hero = true } -> Neon-Rand + Halo; { flat = true } -> nur Körper ohne Glanz
----------------------------------------------------------------------------
function UI.Card(parent, radius, color, opts)
  opts = opts or {}
  local f = CreateFrame("Frame", nil, parent)
  local body
  if color and color ~= C.card then
    local top, bot = UI.GlassStops(color)
    body = { top, bot }
  end
  f.glass = UI.Glass(f, {
    radius = radius or 16,
    edgeMode = opts.hero and "neon" or "light",
    edge = opts.hero and 0.70 or nil,
    halo = opts.hero and 0.16 or 0,
    haloPad = 22,
    body = body or (opts.hero and UI.GLASS.hero or UI.GLASS.card),
    sheen = opts.flat and 0 or (opts.hero and 0.07 or 0.045),
    line = opts.flat and 0 or (opts.hero and 0.45 or 0.28),
  })
  f.bg = f.glass.body
  -- Grundfarbe -> Glas-Verlauf (Seiten färben Karten so beim Überfahren um)
  f.bg.SetColor = function(self, c, a)
    local top, bot = UI.GlassStops(c)
    Round.SetGradientV(self, top, bot, a)
  end
  return f
end

-- Kennzahl als Glas-Pille (statt Kachel): Leuchtpunkt, kleines Etikett, große Zahl
function UI.StatPill(parent, w, label, accent, h, withSub)
  h = h or 60
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(w, h)
  local shape = pill(f, h, 0, true)
  f.edge, f.bg, f.gloss = shape.edge, shape.body, shape.gloss
  f.edge:SetGradientV({ 0.60, 1.00, 0.85, 0.30 }, { 0.20, 0.55, 0.65, 0.08 })
  f.bg:SetGradientV(UI.GLASS.pill[1], UI.GLASS.pill[2], 0.92)
  f.gloss:SetAlpha(0.35)
  local c = accent or C.amber
  f.glow = UI.Glow(f, c, 46, 0.45, "ARTWORK")
  f.glow:SetPoint("CENTER", f, "LEFT", 24, 0)
  f.dot = tex(f, "ARTWORK", 1, UI.TEX.circle)
  f.dot:SetSize(9, 9)
  f.dot:SetPoint("CENTER", f, "LEFT", 24, 0)
  setGradV(f.dot, c, lerp(c, C.aqua, 0.5), 1)
  f.label = UI.Text(f, 12, "semibold", C.dim)
  -- mit Unterzeile (withSub): drei Zeilen senkrecht mittig, sonst zwei
  f.label:SetPoint("TOPLEFT", withSub and 44 or 40, -math.floor((h - (withSub and 58 or 42)) / 2))
  f.label:SetText(label or "")
  f.value = UI.Text(f, 18, "bold", C.text)
  f.value:SetPoint("TOPLEFT", f.label, "BOTTOMLEFT", 0, -3)
  if withSub then
    f.glow:SetPoint("CENTER", f, "LEFT", 26, 0)
    f.dot:SetPoint("CENTER", f, "LEFT", 26, 0)
    f.sub = UI.Text(f, 11, "regular", C.muted)
    f.sub:SetPoint("TOPLEFT", f.value, "BOTTOMLEFT", 0, -3)
    f.sub:SetWidth(w - 44 - math.floor(h / 3))
    f.sub:SetJustifyH("LEFT")
    f.sub:SetWordWrap(false)
  end
  function f:SetAccent(col)
    self.glow:SetVertexColor(col[1], col[2], col[3], 0.45)
    setGradV(self.dot, col, lerp(col, C.aqua, 0.5), 1)
  end
  return f
end

-- Kleine Pille als Etikett ("Level 10+", "AH", ...): getönter Glaskörper + leuchtender Rand
function UI.Chip(parent, text, color, filled)
  local f = CreateFrame("Frame", nil, parent)
  local shape = pill(f, 22, 2, false)
  f.edge, f.bg = shape.edge, shape.body
  f.text = UI.Text(f, 11, "semibold", color or C.gold)
  f.text:SetPoint("CENTER", 0, 0)
  function f:Set(t, c, isFilled)
    c = c or C.gold
    self.text:SetText(t)
    if isFilled then
      self.edge:SetGradientV({ 1, 1, 1, 0.55 }, { 1, 1, 1, 0.1 })
      self.bg:SetColor(c, 1)
      self.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
    else
      self.edge:SetColor(c, 0.42)
      local base = C.card
      local mix = { base[1] + (c[1] - base[1]) * 0.15, base[2] + (c[2] - base[2]) * 0.15, base[3] + (c[3] - base[3]) * 0.15 }
      self.bg:SetGradientV(lerp(mix, { 1, 1, 1 }, 0.04), lerp(mix, { 0, 0, 0 }, 0.25), 0.97)
      self.text:SetTextColor(c[1], c[2], c[3], 1)
    end
    self:SetSize(math.ceil(self.text:GetStringWidth()) + 20, 22)
  end
  f:Set(text or "", color, filled)
  return f
end

----------------------------------------------------------------------------
-- Rundes Item-Symbol: Glaskugel mit Qualitäts-Ring, Innenschatten und Glanz
----------------------------------------------------------------------------
function UI.ItemIcon(parent, size)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(size, size)
  f.back = f:CreateTexture(nil, "BACKGROUND", nil, 2)
  f.back:SetTexture(UI.TEX.circle)
  f.back:SetAllPoints()
  setGradV(f.back, { 0.16, 0.19, 0.19 }, { 0.05, 0.06, 0.07 }, 1)
  f.icon = f:CreateTexture(nil, "ARTWORK")
  f.icon:SetPoint("TOPLEFT", 2, -2)
  f.icon:SetPoint("BOTTOMRIGHT", -2, 2)
  f.icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
  if f.CreateMaskTexture then
    local mask = f:CreateMaskTexture()
    mask:SetTexture(UI.TEX.circle, "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    mask:SetAllPoints(f.icon)
    f.icon:AddMaskTexture(mask)
  end
  f.shade = f:CreateTexture(nil, "ARTWORK", nil, 2)
  f.shade:SetTexture(UI.TEX.shade)
  f.shade:SetAllPoints(f.icon)
  f.shade:SetVertexColor(1, 1, 1, 0.75)
  f.ring = f:CreateTexture(nil, "OVERLAY")
  f.ring:SetTexture(UI.TEX.ringthin)
  f.ring:SetAllPoints()
  f.gloss = f:CreateTexture(nil, "OVERLAY", nil, 1)
  f.gloss:SetTexture(UI.TEX.gloss)
  f.gloss:SetAllPoints(f.icon)
  f.gloss:SetBlendMode("ADD")
  f.gloss:SetVertexColor(1, 1, 1, 0.16)
  function f:SetItem(id)
    local item = ns.Item(id)
    self.icon:SetTexture(item.icon)
    local q = UI.QUALITY[item.quality or 1] or UI.QUALITY[1]
    self.ring:SetVertexColor(q[1], q[2], q[3], 0.95)
  end
  function f:SetIcon(file, color)
    self.icon:SetTexture(file)
    local c = color or C.gold
    self.ring:SetVertexColor(c[1], c[2], c[3], 0.95)
  end
  return f
end

----------------------------------------------------------------------------
-- Glas-Kugel ("Orb") für große Symbole: Halo, Verlaufsring, dunkle Glaskugel, Symbol, Glanzkappe
-- Symbol: Spiel-Icon (Pfad/Datei-ID, rund maskiert) oder eigenes Linien-Symbol (glyph = true)
----------------------------------------------------------------------------
function UI.Orb(parent, size, opts)
  opts = opts or {}
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(size, size)
  f.halo = f:CreateTexture(nil, "BACKGROUND", nil, -2)
  f.halo:SetTexture(UI.TEX.glow)
  f.halo:SetBlendMode("ADD")
  f.halo:SetPoint("CENTER")
  f.halo:SetSize(size * 2.1, size * 2.1)
  f.halo:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 0)
  f.disc = f:CreateTexture(nil, "BACKGROUND", nil, 1)
  f.disc:SetTexture(UI.TEX.circle)
  f.disc:SetPoint("TOPLEFT", 1, -1)
  f.disc:SetPoint("BOTTOMRIGHT", -1, 1)
  setGradV(f.disc, { 0.13, 0.17, 0.17 }, { 0.025, 0.035, 0.045 }, 0.98)
  local ins = math.max(math.floor(size * 0.07 + 0.5), 3)
  f.icon = f:CreateTexture(nil, "ARTWORK")
  f.icon:SetPoint("TOPLEFT", ins, -ins)
  f.icon:SetPoint("BOTTOMRIGHT", -ins, ins)
  if f.CreateMaskTexture then
    f.mask = f:CreateMaskTexture()
    f.mask:SetTexture(UI.TEX.circle, "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    f.mask:SetAllPoints(f.icon)
  end
  f.shade = f:CreateTexture(nil, "ARTWORK", nil, 3)
  f.shade:SetTexture(UI.TEX.shade)
  f.shade:SetAllPoints(f.icon)
  f.glyph = f:CreateTexture(nil, "ARTWORK", nil, 4)
  f.glyph:SetPoint("CENTER")
  f.glyph:SetSize(size * 0.46, size * 0.46)
  f.ring = f:CreateTexture(nil, "OVERLAY")
  f.ring:SetTexture(UI.TEX.ringgrad)
  f.ring:SetAllPoints()
  f.gloss = f:CreateTexture(nil, "OVERLAY", nil, 1)
  f.gloss:SetTexture(UI.TEX.gloss)
  f.gloss:SetPoint("TOPLEFT", 2, -2)
  f.gloss:SetPoint("BOTTOMRIGHT", -2, 2)
  f.gloss:SetBlendMode("ADD")
  f.gloss:SetVertexColor(1, 1, 1, 0.20)
  -- Spiel-Symbol; existiert die Datei nicht (SetTexture meldet false), springt das eigene Symbol ein
  function f:SetGameIcon(file, fallback)
    local ok, res = pcall(self.icon.SetTexture, self.icon, file)
    if ok and res ~= false then
      if self.mask and not self.masked then self.icon:AddMaskTexture(self.mask) self.masked = true end
      self.icon:Show()
      self.shade:Show()
      self.glyph:Hide()
    else
      self:SetGlyph(fallback or "star")
    end
  end
  function f:SetGlyph(name)
    self.icon:Hide()
    self.shade:Hide()
    self.glyph:SetTexture(UI.Icon(name))
    self.glyph:Show()
  end
  -- Zustand: active = leuchtet (Halo, voller Ring), sonst gedämpft
  function f:SetActive(on, hover)
    self.halo:SetAlpha(1)
    self.halo:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], on and 0.55 or (hover and 0.25 or 0))
    self.ring:SetVertexColor(1, 1, 1, on and 1 or (hover and 0.85 or 0.42))
    self.icon:SetVertexColor(1, 1, 1, on and 1 or (hover and 0.95 or 0.72))
    pcall(self.icon.SetDesaturation, self.icon, on and 0 or (hover and 0.1 or 0.45))
    local gc = on and C.amber or (hover and C.text or C.muted)
    self.glyph:SetVertexColor(gc[1], gc[2], gc[3], 1)
    self.shade:SetVertexColor(1, 1, 1, on and 0.55 or 0.8)
  end
  if opts.glyph then f:SetGlyph(opts.glyph) end
  f:SetActive(opts.active)
  return f
end

----------------------------------------------------------------------------
-- Scrollbereich mit schlanker Neon-Leiste
----------------------------------------------------------------------------
function UI.Scroll(parent)
  local sf = CreateFrame("ScrollFrame", nil, parent)
  local content = CreateFrame("Frame", nil, sf)
  content:SetSize(10, 10)
  sf:SetScrollChild(content)
  sf:EnableMouseWheel(true)

  local track = CreateFrame("Frame", nil, sf)
  track:SetPoint("TOPRIGHT", sf, "TOPRIGHT", -3, -6)
  track:SetPoint("BOTTOMRIGHT", sf, "BOTTOMRIGHT", -3, 6)
  track:SetWidth(4)
  track.bg = UI.Round(track, 2, "BACKGROUND", 0)
  track.bg:SetColor({ 1, 1, 1 }, 0.06)

  local thumb = CreateFrame("Frame", nil, track)
  thumb:SetWidth(4)
  thumb.glow = UI.Glow(thumb, C.teal, 22, 0.28, "BACKGROUND")
  thumb.glow:SetPoint("TOPLEFT", -9, 6)
  thumb.glow:SetPoint("BOTTOMRIGHT", 9, -6)
  thumb.bg = UI.Round(thumb, 2, "ARTWORK", 0)
  thumb.bg:SetGradientV({ C.amber[1], C.amber[2], C.amber[3], 1 }, { C.aqua[1], C.aqua[2], C.aqua[3], 1 }, 0.95)
  thumb:EnableMouse(true)

  local function update()
    local range = sf:GetVerticalScrollRange() or 0
    local h = track:GetHeight() or 1
    if range <= 1 then
      track:Hide()
      return
    end
    track:Show()
    local view = sf:GetHeight() or 1
    local th = math.max(h * view / (view + range), 28)
    thumb:SetHeight(th)
    local pos = (sf:GetVerticalScroll() or 0) / range
    thumb:ClearAllPoints()
    thumb:SetPoint("TOP", track, "TOP", 0, -(h - th) * pos)
  end
  sf.UpdateBar = update

  sf:SetScript("OnMouseWheel", function(self, delta)
    local range = self:GetVerticalScrollRange() or 0
    local cur = self:GetVerticalScroll() or 0
    self:SetVerticalScroll(ns.Clamp(cur - delta * 48, 0, range))
    update()
  end)
  sf:SetScript("OnScrollRangeChanged", function(self)
    local range = self:GetVerticalScrollRange() or 0
    if (self:GetVerticalScroll() or 0) > range then self:SetVerticalScroll(range) end
    update()
  end)
  sf:SetScript("OnSizeChanged", function(self, w)
    content:SetWidth(math.max((w or self:GetWidth() or 10) - 14, 10))
    update()
  end)

  -- Ziehen am Griff
  thumb:SetScript("OnMouseDown", function(self)
    local _, cy = GetCursorPosition()
    self.dragStart = cy / (self:GetEffectiveScale() or 1)
    self.scrollStart = sf:GetVerticalScroll() or 0
    self:SetScript("OnUpdate", function(me)
      local _, y = GetCursorPosition()
      y = y / (me:GetEffectiveScale() or 1)
      local range = sf:GetVerticalScrollRange() or 0
      local free = (track:GetHeight() or 1) - (me:GetHeight() or 1)
      if free > 0 then
        local newScroll = me.scrollStart + (me.dragStart - y) / free * range
        sf:SetVerticalScroll(ns.Clamp(newScroll, 0, range))
        update()
      end
    end)
  end)
  thumb:SetScript("OnMouseUp", function(self) self:SetScript("OnUpdate", nil) end)
  thumb:SetScript("OnHide", function(self) self:SetScript("OnUpdate", nil) end)

  function sf:ScrollToTop()
    self:SetVerticalScroll(0)
    update()
  end
  return sf, content
end

----------------------------------------------------------------------------
-- Schalter (Ein/Aus) im Handy-Stil: Neon-Schiene mit Leuchten, weißer Glasknopf
----------------------------------------------------------------------------
function UI.Toggle(parent, label, getter, setter, desc, width)
  local f = UI.SafeButton(parent)
  f:SetSize(width or 520, desc and 54 or 36)
  f.label = UI.Text(f, 13, "semibold", C.text)
  f.label:SetPoint("TOPLEFT", 0, desc and -4 or -10)
  f.label:SetText(label)
  if desc then
    f.desc = UI.Para(f, 11, C.dim, (width or 520) - 70)
    f.desc:SetPoint("TOPLEFT", f.label, "BOTTOMLEFT", 0, -3)
    f.desc:SetText(desc)
  end
  local sw = CreateFrame("Frame", nil, f)
  sw:SetSize(46, 26)
  sw:SetPoint("TOPRIGHT", 0, desc and -5 or -5)
  sw.glow = UI.Glow(sw, C.amber, 70, 0, "BACKGROUND")
  sw.glow:SetPoint("CENTER")
  sw.glow:SetHeight(46)
  local shape = pill(sw, 26, 0, true)
  sw.edge, sw.bg, sw.gloss = shape.edge, shape.body, shape.gloss
  sw.knob = sw:CreateTexture(nil, "ARTWORK")
  sw.knob:SetTexture(UI.TEX.circle)
  sw.knob:SetSize(20, 20)
  sw.knobShine = sw:CreateTexture(nil, "ARTWORK", nil, 1)
  sw.knobShine:SetTexture(UI.TEX.gloss)
  sw.knobShine:SetAllPoints(sw.knob)
  sw.knobShine:SetBlendMode("ADD")
  sw.knobShine:SetVertexColor(1, 1, 1, 0.5)
  f.switch = sw
  function f:Refresh()
    local on = getter()
    if on then
      sw.edge:SetGradientV({ 1, 1, 1, 0.65 }, { 1, 1, 1, 0.1 })
      sw.bg:SetGradient(UI.GRAD, 1)
      sw.gloss:SetAlpha(1)
      sw.glow:SetAlpha(0.32)
      sw.knob:ClearAllPoints(); sw.knob:SetPoint("RIGHT", -3, 0)
      setGradV(sw.knob, { 1, 1, 1 }, { 0.86, 0.93, 0.92 }, 1)
    else
      sw.edge:SetGradient(UI.GRAD_EDGE, 0.30)
      sw.bg:SetGradientV({ 0.05, 0.06, 0.07, 0.98 }, { 0.12, 0.14, 0.15, 0.98 })
      sw.gloss:SetAlpha(0.35)
      sw.glow:SetAlpha(0)
      sw.knob:ClearAllPoints(); sw.knob:SetPoint("LEFT", 3, 0)
      setGradV(sw.knob, { 0.86, 0.90, 0.89 }, { 0.58, 0.64, 0.63 }, 1)
    end
  end
  f:SetScript("OnClick", function(self)
    setter(not getter())
    playClick()
    self:Refresh()
  end)
  f:Refresh()
  return f
end

----------------------------------------------------------------------------
-- Segment-Auswahl (Filter-Pillen nebeneinander, mit Umbruch). Eine Zeile -> in einer Glas-Schiene.
----------------------------------------------------------------------------
function UI.Segments(parent, options, onChange, width)
  local f = CreateFrame("Frame", nil, parent)
  f.buttons = {}
  f.value = options[1] and options[1].value
  local maxW = width or 600
  local x, y, rowH = 0, 0, 30
  local PADX = 3
  -- Schiene (eigener Rahmen auf derselben Ebene, vor den Pillen erzeugt -> liegt dahinter)
  local holder = CreateFrame("Frame", nil, f)
  holder:SetPoint("TOPLEFT", 0, 0)
  holder:SetFrameLevel(f:GetFrameLevel())
  for i, opt in ipairs(options) do
    local b = UI.SafeButton(f)
    b.value = opt.value
    b.glow = UI.Glow(b, C.amber, 100, 0, "BACKGROUND")
    b.glow:SetPoint("CENTER", 0, -2)
    local shape = pill(b, 28, 0, true)
    b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
    b.text = UI.Text(b, 12, "semibold", C.muted)
    b.text:SetPoint("CENTER")
    b.text:SetText(opt.label)
    local w = math.ceil(b.text:GetStringWidth()) + 30
    b:SetSize(w, 28)
    b.glow:SetSize(w * 1.3, 56)
    if x + w > maxW - PADX * 2 and x > 0 then
      x = 0
      y = y + rowH + 6
    end
    b:SetPoint("TOPLEFT", x + PADX, -y - 1)
    x = x + w + 4
    b:SetScript("OnClick", function(self)
      f:Select(self.value, true)
      playClick()
    end)
    b:SetScript("OnEnter", function() f:Paint() end)
    b:SetScript("OnLeave", function() f:Paint() end)
    f.buttons[i] = b
  end
  f:SetSize(maxW, y + rowH)
  -- Eine Zeile: dunkle Glas-Schiene hinter den Pillen, nur so breit wie die Pillen
  if y == 0 and #options > 1 then
    holder:SetSize(x - 4 + PADX * 2, rowH)
    f.track = UI.Glass(holder, { radius = 15, body = { { 0.04, 0.05, 0.055, 0.85 }, { 0.07, 0.085, 0.09, 0.85 } },
      sheen = 0, line = 0.12, edge = 0.16, sub = -8 })
    f.trackHolder = holder
  else
    holder:SetSize(1, 1)
    holder:Hide()
  end
  function f:Paint()
    for _, b in ipairs(self.buttons) do
      if b.value == self.value then
        b.edge:SetGradientV({ 1, 1, 1, 0.65 }, { 1, 1, 1, 0.1 })
        b.bg:SetGradient(UI.GRAD, 1)
        b.gloss:SetAlpha(1)
        b.edge:SetShown(true) b.bg:SetShown(true) b.gloss:SetShown(true)
        b.glow:SetAlpha(0.26)
        b.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
      else
        local hover = b:IsMouseOver()
        local inTrack = self.trackHolder ~= nil
        b.edge:SetShown(hover or not inTrack) b.bg:SetShown(hover or not inTrack) b.gloss:SetShown(hover or not inTrack)
        local g = hover and UI.GLASS.pillHi or UI.GLASS.pill
        b.edge:SetGradient(UI.GRAD_EDGE, hover and 0.45 or 0.18)
        b.bg:SetGradientV(g[1], g[2], inTrack and 0.7 or 0.9)
        b.gloss:SetAlpha(0.35)
        b.glow:SetAlpha(0)
        local tc = hover and C.text or C.muted
        b.text:SetTextColor(tc[1], tc[2], tc[3], 1)
      end
    end
  end
  function f:Select(value, fire)
    self.value = value
    self:Paint()
    if fire and onChange then onChange(value) end
  end
  f:Paint()
  return f
end

----------------------------------------------------------------------------
-- Große Reiter (Unterseiten): gleich breite Glas-Pillen mit Symbol, Text und Zahlen-Badge
-- options: { value, label, icon, tip }
----------------------------------------------------------------------------
function UI.Tabs(parent, options, onChange, width, height)
  local f = CreateFrame("Frame", nil, parent)
  height = height or 38
  f:SetSize(width, height + 8)
  f.buttons = {}
  f.value = options[1] and options[1].value
  f.track = UI.Glass(f, { radius = (height + 8) / 2, body = { { 0.035, 0.045, 0.050, 0.88 }, { 0.065, 0.080, 0.085, 0.88 } },
    sheen = 0, line = 0.16, edge = 0.20 })
  local n = math.max(#options, 1)
  local gap = 4
  local bw = (width - 8 - gap * (n - 1)) / n
  for i, opt in ipairs(options) do
    local b = UI.SafeButton(f)
    b.value = opt.value
    b:SetSize(bw, height)
    b:SetPoint("TOPLEFT", 4 + (i - 1) * (bw + gap), -4)
    b.glow = UI.Glow(b, C.amber, bw * 1.15, 0, "BACKGROUND")
    b.glow:SetPoint("CENTER", 0, -3)
    b.glow:SetHeight(height * 2.1)
    local shape = pill(b, height, 0, true)
    b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
    b.text = UI.Text(b, 13, "semibold", C.muted)
    b.text:SetWordWrap(false)
    b.icon = b:CreateTexture(nil, "ARTWORK")
    b.icon:SetSize(16, 16)
    b.icon:SetTexture(UI.Icon(opt.icon or "star"))
    b.badge = UI.Chip(b, "", C.hi, true)
    b.badge:Hide()
    function b:Layout()
      local tw = math.min(math.ceil(self.text:GetUnboundedStringWidth()), bw - 50)
      local bwid = self.badge:IsShown() and (self.badge:GetWidth() + 6) or 0
      local total = 16 + 7 + tw + bwid
      self.icon:ClearAllPoints()
      self.icon:SetPoint("LEFT", self, "LEFT", math.max((bw - total) / 2, 10), 0)
      self.text:ClearAllPoints()
      self.text:SetPoint("LEFT", self.icon, "RIGHT", 7, 0)
      self.text:SetWidth(tw + 2)
      self.badge:ClearAllPoints()
      self.badge:SetPoint("LEFT", self.text, "RIGHT", 4, 0)
    end
    UI.FitText(b.text, opt.label, bw - 50)
    b:Layout()
    b:SetScript("OnClick", function(self)
      f:Select(self.value, true)
      playClick()
    end)
    b:SetScript("OnEnter", function() f:Paint() end)
    b:SetScript("OnLeave", function() f:Paint() end)
    if opt.tip then UI.SetTooltip(b, opt.label, opt.tip) end
    f.buttons[i] = b
  end
  function f:SetBadge(value, text)
    for _, b in ipairs(self.buttons) do
      if b.value == value then
        if text and text ~= "" then b.badge:Set(tostring(text), C.hi, true) b.badge:Show() else b.badge:Hide() end
        b:Layout()
      end
    end
  end
  function f:Paint()
    for _, b in ipairs(self.buttons) do
      local hover = b:IsMouseOver()
      if b.value == self.value then
        b.edge:SetShown(true) b.bg:SetShown(true) b.gloss:SetShown(true)
        b.edge:SetGradientV({ 1, 1, 1, 0.70 }, { 1, 1, 1, 0.12 })
        b.bg:SetGradient(UI.GRAD, 1)
        b.gloss:SetAlpha(1)
        b.glow:SetAlpha(0.30)
        b.text:SetTextColor(C.dark[1], C.dark[2], C.dark[3], 1)
        b.icon:SetVertexColor(C.dark[1], C.dark[2], C.dark[3], 1)
      else
        b.edge:SetShown(hover) b.bg:SetShown(hover) b.gloss:SetShown(hover)
        b.edge:SetGradient(UI.GRAD_EDGE, 0.40)
        b.bg:SetGradientV(UI.GLASS.pillHi[1], UI.GLASS.pillHi[2], 0.8)
        b.gloss:SetAlpha(0.4)
        b.glow:SetAlpha(0)
        local tc = hover and C.text or C.muted
        b.text:SetTextColor(tc[1], tc[2], tc[3], 1)
        local ic = hover and C.amber or C.dim
        b.icon:SetVertexColor(ic[1], ic[2], ic[3], 1)
      end
    end
  end
  function f:Select(value, fire)
    self.value = value
    self:Paint()
    if fire and onChange then onChange(value) end
  end
  f:Paint()
  return f
end

----------------------------------------------------------------------------
-- Senkrechter Stapel-Layouter für Seiten
----------------------------------------------------------------------------
local Stack = {}
Stack.__index = Stack

function UI.Stack(content, padX)
  return setmetatable({ content = content, y = 0, pad = padX or 0 }, Stack)
end

function Stack:Width()
  return math.max((self.content:GetWidth() or 600) - self.pad * 2, 100)
end

function Stack:Add(region, height, gap, x)
  region:ClearAllPoints()
  region:SetPoint("TOPLEFT", self.content, "TOPLEFT", self.pad + (x or 0), -self.y)
  if height then
    self.y = self.y + height + (gap or 12)
  end
  return region
end

function Stack:Space(h)
  self.y = self.y + h
end

-- Fügt einen Textabsatz ein und rückt um seine echte Höhe vor
function Stack:Para(text, size, color, gap, weight)
  local fs = UI.Para(self.content, size or 13, color, self:Width(), weight)
  fs:SetText(text)
  self:Add(fs, nil)
  self.y = self.y + math.ceil(fs:GetStringHeight()) + (gap or 10)
  return fs
end

-- Abschnitts-Überschrift: Neon-Akzentpunkt + Titel
function Stack:Title(text, size, color, gap)
  local fs = UI.Text(self.content, size or 17, "bold", color or C.text)
  fs:SetText(text)
  self:Add(fs, nil, nil, 14)
  local dot = self.content:CreateTexture(nil, "ARTWORK")
  dot:SetTexture(UI.TEX.circle)
  dot:SetSize(7, 7)
  dot:SetPoint("RIGHT", fs, "LEFT", -7, 0)
  setGradV(dot, C.amber, C.teal, 1)
  local glow = UI.Glow(self.content, C.amber, 22, 0.45, "ARTWORK")
  glow:SetPoint("CENTER", dot, "CENTER")
  fs.dot, fs.glow = dot, glow
  self.y = self.y + (size or 17) + 6 + (gap or 8)
  return fs
end

function Stack:Finish(extra)
  self.content:SetHeight(self.y + (extra or 20))
end

----------------------------------------------------------------------------
-- Suchfeld (Glas-Pille mit Lupe; leuchtet beim Tippen)
----------------------------------------------------------------------------
function UI.SearchBox(parent, width, placeholder, onChange)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(width, 38)
  f.glow = UI.Glow(f, C.teal, width * 1.1, 0, "BACKGROUND")
  f.glow:SetPoint("CENTER")
  f.glow:SetHeight(84)
  local shape = pill(f, 38, 0, true)
  f.edge, f.bg, f.gloss = shape.edge, shape.body, shape.gloss
  f.gloss:SetAlpha(0.35)
  local function paint(focus)
    f.edge:SetGradient(UI.GRAD_EDGE, focus and 0.9 or 0.32)
    f.bg:SetGradientV({ 0.045, 0.055, 0.060, 0.96 }, { 0.090, 0.105, 0.110, 0.96 })
    f.glow:SetAlpha(focus and 0.22 or 0)
  end
  paint(false)
  f.icon = f:CreateTexture(nil, "ARTWORK")
  f.icon:SetTexture(UI.Icon("scan"))
  f.icon:SetSize(16, 16)
  f.icon:SetPoint("LEFT", 16, 0)
  f.icon:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 1)
  local eb = CreateFrame("EditBox", nil, f)
  eb:SetPoint("TOPLEFT", 42, -4)
  eb:SetPoint("BOTTOMRIGHT", -16, 4)
  eb:SetAutoFocus(false)
  eb:SetMaxLetters(60)
  local ok, res = pcall(eb.SetFont, eb, ns.MEDIA .. "Fonts\\Poppins-Regular.ttf", 14, "")
  if not ok or res == false then pcall(eb.SetFont, eb, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", 14, "") end
  eb:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
  f.hint = UI.Text(f, 13, "regular", C.dim)
  f.hint:SetPoint("LEFT", 42, 0)
  f.hint:SetText(placeholder or "Suchen ...")
  eb:SetScript("OnTextChanged", function(self)
    local t = self:GetText() or ""
    f.hint:SetShown(t == "")
    if onChange then onChange(t) end
  end)
  eb:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
  eb:SetScript("OnEnterPressed", function(self) self:ClearFocus() end)
  eb:SetScript("OnEditFocusGained", function() paint(true) end)
  eb:SetScript("OnEditFocusLost", function() paint(false) end)
  f:EnableMouse(true)
  f:SetScript("OnMouseDown", function() eb:SetFocus() end)
  f.edit = eb
  return f
end

----------------------------------------------------------------------------
-- Kompakter Regler:  Beschriftung   (-)  Wert  (+)   als Glas-Pille
----------------------------------------------------------------------------
function UI.Stepper(parent, label, width, getter, setter, step, min, max, format, parse, hint)
  local f = CreateFrame("Frame", nil, parent)
  f:SetSize(width, 34)
  local shape = pill(f, 34, 0, true)
  f.edge, f.bg, f.gloss = shape.edge, shape.body, shape.gloss
  f.edge:SetGradient(UI.GRAD_EDGE, 0.26)
  f.bg:SetGradientV(UI.GLASS.pill[1], UI.GLASS.pill[2], 0.95)
  f.gloss:SetAlpha(0.4)
  f.label = UI.Text(f, 12, "semibold", C.muted)
  f.label:SetPoint("LEFT", 14, 0)
  f.label:SetText(label)
  local plus = UI.IconButton(f, "plus", 26)
  plus:SetPoint("RIGHT", -4, 0)
  f.value = UI.Text(f, 12, "bold", C.text)
  f.value:SetWidth(76)
  f.value:SetJustifyH("CENTER")
  f.value:SetPoint("RIGHT", plus, "LEFT", -2, 0)
  local minus = UI.IconButton(f, "minus", 26)
  minus:SetPoint("RIGHT", f.value, "LEFT", -2, 0)
  function f:Refresh() self.value:SetText(format(getter())) end
  -- Freie Eingabe: Klick auf den Wert -> Eingabefeld (Enter übernimmt, Esc bricht ab)
  if parse then
    local hit = UI.SafeButton(f)
    hit:SetAllPoints(f.value)
    local eb = CreateFrame("EditBox", nil, f)
    f.edit = eb
    eb:SetSize(84, 24)
    eb:SetPoint("CENTER", f.value, "CENTER")
    eb:SetAutoFocus(false)
    eb:SetMaxLetters(12)
    eb:SetJustifyH("CENTER")
    local ok, res = pcall(eb.SetFont, eb, ns.MEDIA .. "Fonts\\Poppins-SemiBold.ttf", 12, "")
    if not ok or res == false then pcall(eb.SetFont, eb, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", 12, "") end
    eb:SetTextColor(1, 1, 1, 1)
    eb.edge = UI.Round(eb, 10, "BACKGROUND", 3)
    eb.edge:SetGradient(UI.GRAD_EDGE, 0.8)
    eb.bg = UI.Round(eb, 9, "BACKGROUND", 4, 1)
    eb.bg:SetColor(C.inset, 1)
    eb:Hide()
    local function finish(apply)
      if apply then
        local v = parse(eb:GetText())
        if v then
          setter(math.max(min, math.min(max, v)))
          if f.onChange then f.onChange() end
        else
          ns.Print(f.badInput or "Bitte eine Zahl eingeben, z. B. 45 (Silber), 1g 20s oder 1,5g.")
        end
      end
      eb:ClearFocus()
      eb:Hide()
      f.value:Show()
      f:Refresh()
    end
    eb:SetScript("OnEnterPressed", function() finish(true) end)
    eb:SetScript("OnEscapePressed", function() finish(false) end)
    eb:SetScript("OnEditFocusLost", function() if eb:IsShown() then finish(true) end end)
    hit:SetScript("OnClick", function()
      f.value:Hide()
      eb:SetText("")
      eb:Show()
      eb:SetFocus()
    end)
    if hint then UI.SetTooltip(hit, "Selbst eintragen", hint) end
    f.edit, f.hit = eb, hit
  end
  local function change(dir)
    local v = getter() + dir * (type(step) == "function" and step(getter(), dir) or step)
    setter(math.max(min, math.min(max, v)))
    f:Refresh()
    if f.onChange then f.onChange() end
  end
  plus:SetScript("OnClick", function() change(1) end)
  minus:SetScript("OnClick", function() change(-1) end)
  -- Rückgängig: × rechts neben dem Regler, sobald der Wert vom Standard abweicht
  function f:SetDefault(def, onReset)
    self.default, self.onReset = def, onReset
    if not self.reset then
      self.reset = UI.IconButton(self, "close", 24, "Zurück auf Standard")
      self.reset:SetPoint("LEFT", self, "RIGHT", 6, 0)
      self.reset:SetScript("OnClick", function()
        local d = type(self.default) == "function" and self.default() or self.default
        if self.onReset then self.onReset() else setter(d) end
        self:Refresh()
        if self.onChange then self.onChange() end
      end)
    end
    self:Refresh()
  end
  function f:Refresh()
    self.value:SetText(format(getter()))
    if self.reset then
      local d = type(self.default) == "function" and self.default() or self.default
      self.reset:SetShown(getter() ~= d)
    end
  end
  f:Refresh()
  return f
end

-- Kleiner Umschalter als Pille (an = Verlauf)
function UI.Pill(parent, label, getter, setter, onChange)
  local b = UI.Button(parent, label, "soft", nil, 30)
  b:SetWidth(math.ceil(b.text:GetStringWidth()) + 34)
  local function paint()
    b.style = getter() and "primary" or "soft"
    b:Paint()
  end
  b:SetScript("OnClick", function()
    setter(not getter())
    paint()
    if onChange then onChange() end
  end)
  b.Refresh = paint
  paint()
  return b
end
