-- RXPNeon: Neon-Pfeil fuer RestedXP. Ruhige Glas-Scheibe mit Skala, facettierter Pfeil mit mitdrehendem Leuchten,
-- darunter Entfernung als Kapsel und das Ziel auf Deutsch. RXP rechnet Richtung und Entfernung weiter selbst.
local N = RXPNeon
local MEDIA = "Interface\\AddOns\\RXPNeon\\Media\\"
local WHITE = "Interface\\Buttons\\WHITE8X8"
local FONT = "Fonts\\ARIALN.TTF"
local GREEN = { 0.224, 1.0, 0.420 }
local TEAL = { 0.176, 0.886, 0.902 }
local SIZE = 44          -- Pfeil (RXP: 32)
local DIAL = 1.95        -- Scheibe relativ zum Pfeil

N.Pfeil = {}
local built, guard
local P = {}
N.Pfeil.P = P

local function Grad(t, c1, c2)
  t:SetVertexColor(1, 1, 1, 1)
  if t.SetGradient and CreateColor then
    pcall(t.SetGradient, t, "HORIZONTAL", CreateColor(c1[1], c1[2], c1[3], c1[4] or 1), CreateColor(c2[1], c2[2], c2[3], c2[4] or 1))
  else
    t:SetVertexColor(c1[1], c1[2], c1[3], c1[4] or 1)
  end
end

local function Scale()
  local r = _G.RXP
  local p = r and r.settings and r.settings.profile
  return (p and tonumber(p.arrowScale)) or 1
end

local function On() return N.DB and N.DB.skin end

-- RXP-Text "Ziel\n(123yd)" -> eigene Anzeige
local function ShowText(s)
  if not built then return end
  if type(s) ~= "string" then s = "" end
  local title, d = s:match("^(.-)\n?%((%d+)yd%)%s*$")
  if not d then title = s end
  title = (title or ""):gsub("^%s+", ""):gsub("%s+$", "")
  if title ~= "" and N.T and N.DB and N.DB.deutsch then
    local ok, t = pcall(N.T, title); if ok and t then title = t end
  end
  P.title:SetText(title)
  if d then
    P.dist:SetText(d .. " |cff8fa7a2m|r")
    local w = (P.dist:GetStringWidth() or 30) + 26
    P.pill:SetSize(w, 22)
    P.cap.l:SetSize(11, 22); P.cap.r:SetSize(11, 22); P.cap.m:SetSize(math.max(0.5, w - 22), 22)
    P.pill:Show()
  else
    P.pill:Hide()
  end
end

local function Layout()
  local r = _G.RXP; local af = r and r.arrowFrame
  if not (af and built) then return end
  local s = SIZE * Scale()
  local d = s * DIAL
  P.halo:SetSize(d * 1.55, d * 1.55)
  P.dial:SetSize(d, d)
  P.aglow:SetSize(s * 1.5, s * 1.5)
  P.pill:ClearAllPoints(); P.pill:SetPoint("TOP", af, "CENTER", 0, -d / 2 - 6)
end

local function Build(af)
  built = true
  P.halo = af:CreateTexture(nil, "BACKGROUND", nil, 0)
  P.halo:SetTexture(MEDIA .. "dot"); P.halo:SetBlendMode("ADD"); P.halo:SetPoint("CENTER")
  P.halo:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.22)
  P.dial = af:CreateTexture(nil, "BACKGROUND", nil, 1)
  P.dial:SetTexture(MEDIA .. "dial"); P.dial:SetPoint("CENTER")
  P.aglow = af:CreateTexture(nil, "ARTWORK", nil, 0)
  P.aglow:SetTexture(MEDIA .. "arrow_glow"); P.aglow:SetBlendMode("ADD"); P.aglow:SetPoint("CENTER")
  P.aglow:SetVertexColor(0.55, 1, 0.75, 0.75)
  if af.texture and af.texture.SetDrawLayer then af.texture:SetDrawLayer("ARTWORK", 2) end
  -- Entfernung: Kapsel mit Verlauf
  P.pill = CreateFrame("Frame", nil, af)
  P.pill:SetSize(60, 22)
  P.cap = {}
  P.cap.l = P.pill:CreateTexture(nil, "ARTWORK", nil, 0); P.cap.l:SetTexture(MEDIA .. "white_circle"); P.cap.l:SetTexCoord(0, 0.5, 0, 1)
  P.cap.r = P.pill:CreateTexture(nil, "ARTWORK", nil, 0); P.cap.r:SetTexture(MEDIA .. "white_circle"); P.cap.r:SetTexCoord(0.5, 1, 0, 1)
  P.cap.m = P.pill:CreateTexture(nil, "ARTWORK", nil, 0); P.cap.m:SetTexture(WHITE)
  P.cap.l:SetPoint("LEFT", P.pill, "LEFT", 0, 0); P.cap.r:SetPoint("RIGHT", P.pill, "RIGHT", 0, 0)
  P.cap.m:SetPoint("LEFT", P.cap.l, "RIGHT", 0, 0)
  local dark1, dark2 = { 0.04, 0.07, 0.065, 0.92 }, { 0.04, 0.06, 0.08, 0.92 }
  P.cap.l:SetVertexColor(dark1[1], dark1[2], dark1[3], dark1[4]); P.cap.r:SetVertexColor(dark2[1], dark2[2], dark2[3], dark2[4])
  Grad(P.cap.m, dark1, dark2)
  P.line = P.pill:CreateTexture(nil, "ARTWORK", nil, 1); P.line:SetTexture(WHITE)
  P.line:SetPoint("BOTTOMLEFT", P.pill, "BOTTOMLEFT", 9, 0); P.line:SetPoint("BOTTOMRIGHT", P.pill, "BOTTOMRIGHT", -9, 0)
  P.line:SetHeight(1.5); Grad(P.line, { GREEN[1], GREEN[2], GREEN[3], 0.95 }, { TEAL[1], TEAL[2], TEAL[3], 0.95 })
  P.dist = P.pill:CreateFontString(nil, "OVERLAY")
  P.dist:SetFont(FONT, 14, ""); P.dist:SetShadowColor(0, 0, 0, 0.9); P.dist:SetShadowOffset(1, -1)
  P.dist:SetJustifyH("CENTER"); P.dist:SetJustifyV("MIDDLE"); P.dist:SetPoint("CENTER", P.pill, "CENTER", 0, 0)
  P.dist:SetTextColor(GREEN[1], GREEN[2], GREEN[3])
  P.title = af:CreateFontString(nil, "OVERLAY")
  P.title:SetFont(FONT, 13, "OUTLINE"); P.title:SetJustifyH("CENTER"); P.title:SetJustifyV("TOP")
  P.title:SetWidth(240); P.title:SetPoint("TOP", P.pill, "BOTTOM", 0, -4)
  P.title:SetTextColor(0.93, 0.97, 0.95)
  -- Leuchten dreht mit dem Pfeil
  if af.texture then
    hooksecurefunc(af.texture, "SetRotation", function(_, rad) if P.aglow.SetRotation then P.aglow:SetRotation(rad or 0) end end)
  end
  -- RXPs Text liefert Ziel + Entfernung; selbst unsichtbar
  if af.text then hooksecurefunc(af.text, "SetText", function(_, s) if On() then ShowText(s) end end) end
  -- RXP setzt die Groesse beim Neuzeichnen zurueck (32 x Skalierung)
  hooksecurefunc(af, "SetSize", function(self)
    if guard or not On() then return end
    local s = SIZE * Scale()
    guard = true; self:SetSize(s, s); guard = false
    Layout()
  end)
end

function N.Pfeil.Apply()
  local r = _G.RXP; local af = r and r.arrowFrame
  if not af then return end
  if not built then
    if not On() then return end
    Build(af)
  end
  local on = On() and true or false
  for _, k in ipairs({ "halo", "dial", "aglow", "title" }) do P[k]:SetShown(on) end
  if af.text then af.text:SetAlpha(on and 0 or 1); af.text:SetShown(not on) end
  guard = true
  if on then
    local s = SIZE * Scale(); af:SetSize(s, s)
  else
    local s = 32 * Scale(); af:SetSize(s, s); P.pill:Hide()
  end
  guard = false
  if on then
    Layout()
    if af.text and af.text.GetText then ShowText(af.text:GetText()) end
    if af.texture and af.orientation and P.aglow.SetRotation then P.aglow:SetRotation(af.orientation) end
  end
end
