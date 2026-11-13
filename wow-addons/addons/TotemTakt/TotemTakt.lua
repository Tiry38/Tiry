-- TotemTakt 1.1.0 (Tiry): deine Totems in deiner Reihenfolge auf EINER Taste.
--
-- Blizzard erlaubt pro Tastendruck genau einen Zauber. Eine Taste, die alle vier Totems von selbst
-- nacheinander stellt, kann deshalb kein Add-on bauen. TotemTakt pflegt dafuer ein /castsequence-Makro
-- ("TotemTakt", Charakter-Makro): jeder Druck stellt das naechste Totem. Ein Druck in der globalen
-- Abklingzeit (Forever: 1 s bei Totems) schlaegt fehl und verschiebt die Reihenfolge nicht.
--
-- Fehlende zuerst: Ausserhalb des Kampfes sortiert TotemTakt nach jedem Totem neu. Was fehlt, gleich
-- auslaeuft oder ausser Reichweite ist (dir fehlt sein Buff), kommt vorne; stehende Totems danach, das
-- am fruehesten auslaufende zuerst. Im Kampf sind Makros gesperrt und Totem-/Aura-Daten geheim ->
-- das Makro bleibt, wie es beim Kampfbeginn war (letzte Aktualisierung bei PLAYER_REGEN_DISABLED).
--
-- Daten: Forever-Spieldaten 1.60.1 (simc-forever SpellDataDump/allspells.txt): alle Raenge je Totem,
-- Buff-Zauber je Rang (Apply Aura Raid/Party), Totems 1 s GCD, Buff-Totems 300 s.

local VERSION = "1.1.0"
local MACRO, QMARK = "TotemTakt", 134400          -- 134400 = Fragezeichen -> Symbol des naechsten Totems
local MEDIA = "Interface\\AddOns\\TotemTakt\\Media\\"
local CIRCLE = "Interface\\CharacterFrame\\TempPortraitAlphaMask"
local FONT, FONT_UI = "Fonts\\FRIZQT__.TTF", "Fonts\\ARIALN.TTF"
local GRACE, LOW = 10, 10   -- s: frisch gestellt = steht (Buff kommt erst an) | Restzeit darunter = fehlt

local NEON = { 0.22, 1.00, 0.42 }
local TEAL = { 0.15, 0.95, 0.85 }
local AQUA = { 0.16, 0.70, 1.00 }
local floor, max, min, abs, sin, pi = math.floor, math.max, math.min, math.abs, math.sin, math.pi
local fmt = string.format

---------------------------------------------------------------------------
-- Totem-Daten (Forever 1.60.1)
---------------------------------------------------------------------------
local T = {
  -- Erde
  stoneskin   = { el = "earth", lvl = 4,  en = "Stoneskin Totem", ranks = { 8071, 8154, 8155, 10406, 10407, 10408 }, buffs = { 8072, 8156, 8157, 10403, 10404, 10405 } },
  earthbind   = { el = "earth", lvl = 6,  en = "Earthbind Totem", ranks = { 2484 } },
  stoneclaw   = { el = "earth", lvl = 8,  en = "Stoneclaw Totem", ranks = { 5730, 6390, 6391, 6392, 10427, 10428 } },
  strength    = { el = "earth", lvl = 10, en = "Strength of Earth Totem", ranks = { 8075, 8160, 8161, 10442, 25361 }, buffs = { 8076, 8162, 8163, 10441, 25362 } },
  tremor      = { el = "earth", lvl = 18, en = "Tremor Totem", ranks = { 8143 } },
  -- Feuer
  searing     = { el = "fire", lvl = 10, en = "Searing Totem", ranks = { 3599, 6363, 6364, 6365, 10437, 10438 } },
  frostres    = { el = "fire", lvl = 24, en = "Frost Resistance Totem", ranks = { 8181, 10478, 10479 }, buffs = { 8182, 10476, 10477 } },
  magma       = { el = "fire", lvl = 26, en = "Magma Totem", ranks = { 8190, 10585, 10586, 10587 } },
  flametongue = { el = "fire", lvl = 28, en = "Flametongue Totem", ranks = { 8227, 8249, 10526, 16387 }, buffs = { 8230, 8250, 10521, 15036 } },
  -- Wasser
  healing     = { el = "water", lvl = 20, en = "Healing Stream Totem", ranks = { 5394, 6375, 6377, 10462, 10463 }, buffs = { 5672, 6371, 6372, 10460, 10461 } },
  poison      = { el = "water", lvl = 22, en = "Poison Cleansing Totem", ranks = { 8166 } },
  manaspring  = { el = "water", lvl = 26, en = "Mana Spring Totem", ranks = { 5675, 10495, 10496, 10497 }, buffs = { 5677, 10491, 10493, 10494 } },
  fireres     = { el = "water", lvl = 28, en = "Fire Resistance Totem", ranks = { 8184, 10537, 10538 }, buffs = { 8185, 10534, 10535 } },
  disease     = { el = "water", lvl = 38, en = "Disease Cleansing Totem", ranks = { 8170 } },
  manatide    = { el = "water", lvl = 40, en = "Mana Tide Totem", ranks = { 16190, 17354, 17359, 1325256 }, buffs = { 16191, 17355, 17360, 1325257 } },
  -- Luft
  grounding   = { el = "air", lvl = 30, en = "Grounding Totem", ranks = { 8177 } },
  natureres   = { el = "air", lvl = 30, en = "Nature Resistance Totem", ranks = { 10595, 10600, 10601 }, buffs = { 10596, 10598, 10599 } },
  windfury    = { el = "air", lvl = 32, en = "Windfury Totem", ranks = { 8512, 10613, 10614 }, buffs = { 8515, 10609, 10612 } },
  sentry      = { el = "air", lvl = 34, en = "Sentry Totem", ranks = { 6495 } },
  windwall    = { el = "air", lvl = 36, en = "Windwall Totem", ranks = { 15107, 15111, 15112 }, buffs = { 15108, 15109, 15110 } },
  grace       = { el = "air", lvl = 42, en = "Grace of Air Totem", ranks = { 8835, 10627, 25359 }, buffs = { 8836, 10626, 25360 } },
}
local ELS = { "earth", "fire", "water", "air" }
local EL = {
  earth = { name = "Erde",   c1 = { 1.00, 0.70, 0.26 }, c2 = { 0.56, 0.95, 0.34 }, pref = { "strength", "stoneskin" } },
  fire  = { name = "Feuer",  c1 = { 1.00, 0.34, 0.16 }, c2 = { 1.00, 0.80, 0.24 }, pref = { "searing", "flametongue", "magma" } },
  water = { name = "Wasser", c1 = { 0.18, 0.58, 1.00 }, c2 = { 0.15, 0.95, 0.85 }, pref = { "manaspring", "healing" } },
  air   = { name = "Luft",   c1 = { 0.72, 0.93, 1.00 }, c2 = { 0.52, 0.60, 1.00 }, pref = { "windfury", "grace" } },
}
local BYRANK, LIST = {}, {}
for key, t in pairs(T) do
  t.key = key
  for _, id in ipairs(t.ranks) do BYRANK[id] = key end
  LIST[t.el] = LIST[t.el] or {}
  table.insert(LIST[t.el], t)
end
for _, l in pairs(LIST) do table.sort(l, function(a, b) if a.lvl ~= b.lvl then return a.lvl < b.lvl end return a.key < b.key end) end

---------------------------------------------------------------------------
-- Helfer
---------------------------------------------------------------------------
local DB
local DEF = { order = { "earth", "air", "water", "fire" }, pick = {}, smart = true, reset = 8, made = false, intro = false }
local TT = {}
_G.TotemTakt = TT   -- fuer Tests, /dump und die Totem-Uhr (Uhr.lua)
TT.EL, TT.ELS, TT.MEDIA = EL, ELS, MEDIA
TT.GetDB = function() return DB end

local function P(msg) print("|cff39ff6bTotem|r|cff2de2e6Takt|r: " .. msg) end

-- geheime Werte (Forever/Midnight-Regeln) nie benutzen
local function plain(v)
  if v == nil then return nil end
  if issecretvalue then
    local ok, s = pcall(issecretvalue, v)
    if not ok or s then return nil end
  end
  return v
end
local function inCombat() return InCombatLockdown and InCombatLockdown() end

local knownCache = {}
local function isKnown(id)
  local c = knownCache[id]
  if c ~= nil then return c end
  local ok, r = pcall(function()
    if C_SpellBook and C_SpellBook.IsSpellKnown then return C_SpellBook.IsSpellKnown(id) end
    if IsPlayerSpell then return IsPlayerSpell(id) end
  end)
  c = (ok and plain(r) == true) and true or false
  knownCache[id] = c
  return c
end
-- hoechster bekannter Rang (nil = Totem nicht gelernt)
local function knownRank(t)
  for i = #t.ranks, 1, -1 do if isKnown(t.ranks[i]) then return t.ranks[i] end end
end
local function spellName(t)
  local id = knownRank(t) or t.ranks[1]
  local ok, n = pcall(function() return C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(id) end)
  n = ok and plain(n)
  return (type(n) == "string" and n ~= "") and n or t.en
end
local function spellIcon(t)
  local ok, n = pcall(function() return C_Spell and C_Spell.GetSpellTexture and C_Spell.GetSpellTexture(t.ranks[1]) end)
  return (ok and plain(n)) or QMARK
end

-- gewaehltes Totem eines Elements (nil = aus / nichts gelernt)
function TT.Chosen(el)
  local p = DB.pick[el]
  if p == "off" then return nil end
  if p and T[p] and T[p].el == el and knownRank(T[p]) then return p end
  for _, k in ipairs(EL[el].pref) do if knownRank(T[k]) then return k end end
  for _, t in ipairs(LIST[el]) do if knownRank(t) then return t.key end end
end

---------------------------------------------------------------------------
-- Totem-Zustand (nur ausserhalb des Kampfes lesbar)
---------------------------------------------------------------------------
local nameBase, iconBase
local function matchTotem(sid, name, icon)
  if sid and BYRANK[sid] then return BYRANK[sid] end
  if not nameBase then
    nameBase, iconBase = {}, {}
    for key, t in pairs(T) do
      nameBase[key] = spellName(t)
      local ic = spellIcon(t); if ic ~= QMARK then iconBase[ic] = iconBase[ic] or key end
    end
  end
  if type(name) == "string" and name ~= "" then
    local best, bestLen = nil, 0   -- laengster passender Name gewinnt ("Searing Totem IV" -> Rang egal)
    for key, base in pairs(nameBase) do
      if #base > bestLen and name:sub(1, #base) == base then best, bestLen = key, #base end
    end
    if best then return best end
  end
  if icon and iconBase[icon] then return iconBase[icon] end
end

-- aktive eigene Totems: key -> { left = Restzeit, age = Alter } ; zweiter Wert false = Daten nicht lesbar
function TT.Active(now)
  local out = {}
  if inCombat() or not GetTotemInfo then return out, false end
  local n = 4
  if GetNumTotemSlots then local okN, v = pcall(GetNumTotemSlots); v = okN and plain(v); if type(v) == "number" and v > 0 then n = v end end
  for slot = 1, n do
    local ok, have, name, start, dur, icon, _, sid = pcall(GetTotemInfo, slot)
    if not ok then return out, false end
    if have ~= nil and plain(have) == nil then return out, false end   -- geheim
    have, name, start, dur, icon, sid = plain(have), plain(name), plain(start), plain(dur), plain(icon), plain(sid)
    if have and type(start) == "number" and type(dur) == "number" and dur > 0 then
      local key = matchTotem(sid, name, icon)
      if key then out[key] = { left = start + dur - now, age = now - start, slot = slot } end
    end
  end
  return out, true
end

local function hasBuff(t)
  if not (C_UnitAuras and C_UnitAuras.GetPlayerAuraBySpellID) then return nil end
  local any = false
  for _, id in ipairs(t.buffs) do
    local ok, a = pcall(C_UnitAuras.GetPlayerAuraBySpellID, id)
    if ok then any = true; if plain(a) then return true end end
  end
  if any then return false end
end

-- "steht" | "fehlt" | "weg" (ausser Reichweite) | "aus" (gleich abgelaufen)
function TT.State(key, act)
  local a = act[key]
  if not a then return "fehlt" end
  if a.left < LOW then return "aus", a end
  local t = T[key]
  if t.buffs and a.age >= GRACE and hasBuff(t) == false then return "weg", a end
  return "steht", a
end

-- Makro-Reihenfolge: { {el, key, st, left, pos}, ... } ; zweiter Wert = Liste in deiner Reihenfolge
function TT.Plan(now)
  now = now or GetTime()
  local act, ok = TT.Active(now)
  local list = {}
  for _, el in ipairs(DB.order) do
    local key = TT.Chosen(el)
    if key then
      local st, a = "?", nil
      if ok then st, a = TT.State(key, act) end
      list[#list + 1] = { el = el, key = key, st = st, left = a and a.left or 0, age = a and a.age or 999, pos = #list + 1 }
    end
  end
  local seq = {}
  if DB.smart and ok then
    local standing = {}
    for _, e in ipairs(list) do
      if e.st == "steht" then standing[#standing + 1] = e else seq[#seq + 1] = e end
    end
    -- frisch gestellte ans Ende (zuletzt gestelltes ganz hinten), sonst das am fruehesten auslaufende zuerst.
    -- Wichtig fuer /castsequence: nach jedem Totem aendert sich so der Makrotext -> naechster Druck = Schritt 1.
    table.sort(standing, function(a, b)
      local fa, fb = a.age < GRACE, b.age < GRACE
      if fa ~= fb then return fb end
      if fa then if abs(a.age - b.age) > 0.05 then return a.age > b.age end return a.pos < b.pos end
      if abs(a.left - b.left) > 0.5 then return a.left < b.left end
      return a.pos < b.pos
    end)
    for _, e in ipairs(standing) do seq[#seq + 1] = e end
  else
    for _, e in ipairs(list) do seq[#seq + 1] = e end
  end
  return seq, list, ok
end

-- quick = ausserhalb des Kampfes mit "fehlende zuerst": TotemTakt schreibt das Makro nach jedem Totem neu.
-- Kurzer Neustart (3 s), damit ein liegengebliebener Sequenz-Stand nie spaeter wieder auftaucht
-- (4 Totems bei 1 s GCD dauern mindestens 3 s). Im Kampf gilt deine Wahl (8 s / 15 s / nie).
function TT.Body(seq, quick)
  if #seq == 0 then return "#showtooltip\n/stopmacro" end
  local names = {}
  for _, e in ipairs(seq) do names[#names + 1] = spellName(T[e.key]) end
  local reset = quick and "reset=3/combat" or ((DB.reset and DB.reset > 0) and ("reset=" .. DB.reset .. "/combat") or "reset=combat")
  local line = "/castsequence " .. reset .. " " .. table.concat(names, ", ")
  if #line + 13 > 255 then return line end   -- Makro-Grenze 255 Zeichen: dann ohne Tooltip-Zeile
  return "#showtooltip\n" .. line
end

---------------------------------------------------------------------------
-- Makro pflegen (nur ausserhalb des Kampfes - Blizzard sperrt Makros im Kampf)
---------------------------------------------------------------------------
local pending, lastBody, status = false, nil, "?"
local function macroIndex()
  local ok, i = pcall(GetMacroIndexByName, MACRO)
  i = ok and plain(i)
  return (type(i) == "number" and i > 0) and i or nil
end
TT.MacroIndex = macroIndex

-- create = true: anlegen, falls es fehlt (erster Start oder Knopf). Sonst nur ein vorhandenes Makro pflegen.
-- fight = true: Kampfbeginn (PLAYER_REGEN_DISABLED) -> Makro mit deiner Neustart-Wahl einfrieren
function TT.Write(create, fight)
  if not DB then return false end
  if inCombat() then pending = true; status = "kampf"; return false end
  pending = false
  local seq, _, readable = TT.Plan()
  local body = TT.Body(seq, DB.smart and readable and not fight)
  local idx = macroIndex()
  if not idx then
    if not create or #seq == 0 then status = "fehlt"; return false end   -- leeres Makro nie anlegen
    local ok, newIdx = pcall(CreateMacro, MACRO, QMARK, body, true)
    if not ok or not newIdx then
      status = "voll"
      P("Makro konnte nicht angelegt werden – sind alle 30 Charakter-Makroplätze belegt?")
      return false
    end
    DB.made = true; lastBody = body; status = "ok"
    return true
  end
  local okB, cur = pcall(GetMacroBody, idx)
  cur = okB and plain(cur)
  if type(cur) == "string" and cur:gsub("%s+$", "") == body then lastBody = body; status = "ok"; return true end
  local ok = pcall(EditMacro, idx, MACRO, QMARK, body)
  if ok then lastBody = body; status = "ok" else status = "fehler" end
  return ok
end
TT.Status = function() return status, pending, lastBody end

-- gebuendelt: viele Ereignisse in kurzer Folge = eine Aktualisierung
local queued, queuedCreate = false, false
local function queue(create)
  queuedCreate = queuedCreate or (create and true or false)
  if queued then return end
  queued = true
  C_Timer.After(0.15, function()
    local c = queuedCreate
    queued, queuedCreate = false, false
    local had = macroIndex()
    if TT.Write(c) and c and not had and not DB.intro then
      DB.intro = true
      P("Makro „TotemTakt“ liegt in deinen Charakter-Makros – auf eine Leiste ziehen. Einstellen: /takt")
    end
    if TT.Refresh then TT.Refresh() end
  end)
end

---------------------------------------------------------------------------
-- Oberflaeche: Neon-Glas, vier Element-Kugeln in deiner Reihenfolge
---------------------------------------------------------------------------
local W_, H_ = 452, 346
local ORB, GAP, X0, Y_ORB = 62, 106, 66, -108
local Y_ROW, Y_FOOT = -230, -264   -- Mitte Optionen/Auswahl | Oberkante Fusszeile
local F, orbs, picker, sel

local function Tex(p, layer, sub) return p:CreateTexture(nil, layer or "ARTWORK", nil, sub or 0) end
local function MT(p, layer, sub, name, blend)
  local t = Tex(p, layer, sub); t:SetTexture(MEDIA .. name); if blend then t:SetBlendMode(blend) end
  return t
end
local function Grad(t, orient, a, b)
  if t.SetGradient and CreateColor then
    pcall(t.SetGradient, t, orient, CreateColor(a[1], a[2], a[3], a[4] or 1), CreateColor(b[1], b[2], b[3], b[4] or 1))
  end
end
local function Slice(t, m) if t.SetTextureSliceMargins then pcall(t.SetTextureSliceMargins, t, m, m, m, m); pcall(t.SetTextureSliceMode, t, 0) end end
local function Text(p, size, bold, layer)
  local f = p:CreateFontString(nil, layer or "OVERLAY")
  if not f:SetFont(FONT_UI, size, bold and "OUTLINE" or "") then f:SetFont(FONT, size, "") end
  f:SetShadowColor(0, 0, 0, 0.9); f:SetShadowOffset(1, -1)
  return f
end
local function GradText(txt, c1, c2, c3)
  local chars = {}
  for ch in txt:gmatch("[%z\1-\127\194-\244][\128-\191]*") do chars[#chars + 1] = ch end
  local out = {}
  for i, ch in ipairs(chars) do
    local t = #chars > 1 and (i - 1) / (#chars - 1) or 0
    local a, b = c1, c2
    if c3 then if t < 0.5 then t = t * 2 else a, b, t = c2, c3, (t - 0.5) * 2 end end
    out[#out + 1] = fmt("|cff%02x%02x%02x%s|r", floor((a[1] + (b[1] - a[1]) * t) * 255), floor((a[2] + (b[2] - a[2]) * t) * 255), floor((a[3] + (b[3] - a[3]) * t) * 255), ch)
  end
  return table.concat(out)
end
-- runde Flaeche (9-Slice): Pille/abgerundetes Rechteck
local function Round(p, layer, sub, small, inset, blend)
  local t = MT(p, layer or "BACKGROUND", sub or 0, small and "card_s" or "card", blend)
  local i = inset or 0
  t:SetPoint("TOPLEFT", i, -i); t:SetPoint("BOTTOMRIGHT", -i, i)
  Slice(t, small and 8 or 14)
  return t
end
local function RoundIcon(p, size, layer, sub)
  local ic = Tex(p, layer or "ARTWORK", sub or 1)
  ic:SetSize(size, size); ic:SetPoint("CENTER"); ic:SetTexCoord(0.08, 0.92, 0.08, 0.92)
  pcall(function()
    local m = p:CreateMaskTexture()
    m:SetTexture(CIRCLE, "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    m:SetAllPoints(ic)
    ic:AddMaskTexture(m)
  end)
  return ic
end
local function Tip(owner, title, ...)
  if not GameTooltip then return end
  GameTooltip:SetOwner(owner, "ANCHOR_RIGHT")
  GameTooltip:SetText(title)
  for _, l in ipairs({ ... }) do GameTooltip:AddLine(l) end
  GameTooltip:Show()
end
local function NoTip() if GameTooltip then GameTooltip:Hide() end end

local ST = {   -- Zustands-Punkt + Text
  steht = { 0.22, 1.00, 0.42, "steht" },
  fehlt = { 1.00, 0.36, 0.30, "fehlt" },
  aus   = { 1.00, 0.62, 0.20, "läuft gleich ab" },
  weg   = { 1.00, 0.78, 0.22, "zu weit weg" },
  ["?"] = { 0.55, 0.62, 0.60, "im Kampf" },
}

local function orbX(i) return X0 + (i - 1) * GAP end

local function buildOrb(i)
  local o = CreateFrame("Button", nil, F)
  o:SetSize(ORB + 8, ORB + 8)
  o:RegisterForClicks("LeftButtonUp")
  o:RegisterForDrag("LeftButton")
  o.x, o.tx = orbX(i), orbX(i)
  o:SetPoint("CENTER", F, "TOPLEFT", o.x, Y_ORB)
  o.px = o.x
  o.halo = MT(o, "BACKGROUND", 0, "dot", "ADD"); o.halo:SetPoint("CENTER"); o.halo:SetSize(ORB * 1.9, ORB * 1.9)
  o.disc = MT(o, "BORDER", 0, "ctx_disc"); o.disc:SetPoint("CENTER"); o.disc:SetSize(ORB + 2, ORB + 2)
  o.disc:SetVertexColor(0.03, 0.05, 0.05, 0.95)
  o.icon = RoundIcon(o, ORB - 16, "ARTWORK", 1)
  o.gloss = MT(o, "ARTWORK", 3, "ctx_gloss", "ADD"); o.gloss:SetPoint("CENTER"); o.gloss:SetSize(ORB - 14, ORB - 14); o.gloss:SetVertexColor(1, 1, 1, 0.18)
  o.ring = MT(o, "OVERLAY", 0, "ctx_ring", "ADD"); o.ring:SetPoint("CENTER"); o.ring:SetSize(ORB + 8, ORB + 8)
  -- Schritt-Nummer oben, Zustand unten rechts
  o.badge = CreateFrame("Frame", nil, o); o.badge:SetSize(22, 22); o.badge:SetPoint("CENTER", o, "CENTER", -24, 24)
  o.bdisc = MT(o.badge, "BACKGROUND", 0, "ctx_disc"); o.bdisc:SetAllPoints(); o.bdisc:SetVertexColor(0.02, 0.03, 0.03, 1)
  o.bring = MT(o.badge, "BORDER", 0, "ctx_ring", "ADD"); o.bring:SetPoint("CENTER"); o.bring:SetSize(25, 25)
  o.num = Text(o.badge, 11, true); o.num:SetPoint("CENTER", 0, 0)
  o.dot = MT(o, "OVERLAY", 2, "dot", "ADD"); o.dot:SetSize(16, 16); o.dot:SetPoint("CENTER", o, "CENTER", 23, -23)
  o.dotCore = MT(o, "OVERLAY", 3, "dot"); o.dotCore:SetSize(8, 8); o.dotCore:SetPoint("CENTER", o.dot, "CENTER")
  -- Beschriftung unter der Kugel (eigener Rahmen, damit nichts in die Kugel ragt)
  o.cap = CreateFrame("Frame", nil, F); o.cap:SetSize(100, 42)
  o.cap:SetPoint("TOP", F, "TOPLEFT", o.x, Y_ORB - ORB / 2 - 11)
  o.elT = Text(o.cap, 10, true); o.elT:SetPoint("TOP", 0, 0); o.elT:SetWidth(100); o.elT:SetWordWrap(false)
  o.nameT = Text(o.cap, 11); o.nameT:SetPoint("TOP", o.elT, "BOTTOM", 0, -3); o.nameT:SetWidth(100)
  o.nameT:SetWordWrap(true); o.nameT:SetMaxLines(2); o.nameT:SetSpacing(1)   -- lange deutsche Namen: 2 Zeilen
  o.nameT:SetTextColor(0.90, 0.96, 0.93)

  o:SetScript("OnClick", function(self) if not self.dragged then TT.Select(self.el) end end)
  o:SetScript("OnDragStart", function(self)
    self.dragged = true; self.drag = true
    self:SetFrameLevel((F:GetFrameLevel() or 1) + 20)
  end)
  o:SetScript("OnDragStop", function(self)
    self.drag = false
    local x = self.x
    local to = max(1, min(#DB.order, floor((x - X0) / GAP + 1.5)))
    local from
    for k, el in ipairs(DB.order) do if el == self.el then from = k end end
    self:SetFrameLevel((F:GetFrameLevel() or 1) + 5)
    if from then TT.Move(from, to) end
    C_Timer.After(0.05, function() self.dragged = false end)
  end)
  o:SetScript("OnEnter", function(self)
    local key = TT.Chosen(self.el)
    local e = EL[self.el]
    if key then
      Tip(self, spellName(T[key]), e.name .. " · Schritt " .. (self.i or i), "Klick: anderes Totem · Ziehen: Reihenfolge")
    else
      Tip(self, e.name .. ": aus", "Klick: Totem wählen")
    end
  end)
  o:SetScript("OnLeave", NoTip)
  o:SetFrameLevel((F:GetFrameLevel() or 1) + 5)
  return o
end

local function paintOrb(o, el, i, state)
  local e = EL[el]
  o.el, o.i = el, i
  local key = TT.Chosen(el)
  local on = key ~= nil
  o.icon:SetTexture(on and spellIcon(T[key]) or QMARK)
  pcall(o.icon.SetDesaturated, o.icon, not on)
  o.icon:SetAlpha(on and 1 or 0.35)
  local hot = (sel == el) and 1 or 0.75
  Grad(o.ring, "VERTICAL", { e.c2[1], e.c2[2], e.c2[3], hot }, { e.c1[1], e.c1[2], e.c1[3], hot })
  o.halo:SetVertexColor(e.c1[1], e.c1[2], e.c1[3], on and 0.30 or 0.08)
  Grad(o.bring, "VERTICAL", { e.c2[1], e.c2[2], e.c2[3], 0.9 }, { e.c1[1], e.c1[2], e.c1[3], 0.9 })
  o.num:SetText(on and tostring(i) or "–")
  o.elT:SetText(GradText(e.name:upper(), e.c1, e.c2))
  o.nameT:SetText(on and spellName(T[key]) or "aus")
  local s = ST[state or "?"] or ST["?"]
  o.dot:SetShown(on); o.dotCore:SetShown(on)
  o.dot:SetVertexColor(s[1], s[2], s[3], 0.9); o.dotCore:SetVertexColor(s[1], s[2], s[3], 1)
  o.state = state
end

-- Auswahl-Leiste (Glas-Pille): Totems des Elements + "aus" + Pfeile fuer die Reihenfolge
local function iconButton(parent, size)
  local b = CreateFrame("Button", nil, parent)
  b:SetSize(size, size)
  b.disc = MT(b, "BACKGROUND", 0, "ctx_disc"); b.disc:SetAllPoints(); b.disc:SetVertexColor(0.03, 0.05, 0.05, 1)
  b.icon = RoundIcon(b, size - 8, "ARTWORK", 1)
  b.ring = MT(b, "OVERLAY", 0, "ctx_ring", "ADD"); b.ring:SetPoint("CENTER"); b.ring:SetSize(size + 4, size + 4)
  b.hl = MT(b, "HIGHLIGHT", 0, "ctx_ring", "ADD"); b.hl:SetPoint("CENTER"); b.hl:SetSize(size + 4, size + 4); b.hl:SetVertexColor(1, 1, 1, 0.45)
  return b
end
local function arrowButton(parent, rot)
  local b = CreateFrame("Button", nil, parent)
  b:SetSize(34, 34)
  b.disc = MT(b, "BACKGROUND", 0, "ctx_disc"); b.disc:SetPoint("CENTER"); b.disc:SetSize(30, 30); b.disc:SetVertexColor(1, 1, 1, 0.07)
  b.hl = MT(b, "HIGHLIGHT", 0, "ctx_disc", "ADD"); b.hl:SetPoint("CENTER"); b.hl:SetSize(30, 30); b.hl:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.25)
  b.a = MT(b, "ARTWORK", 0, "arrow"); b.a:SetPoint("CENTER"); b.a:SetSize(18, 18); b.a:SetRotation(rot)
  b.a:SetVertexColor(TEAL[1], TEAL[2], TEAL[3], 1)
  return b
end

local function buildPicker()
  picker = CreateFrame("Frame", nil, F)
  picker:SetSize(W_ - 40, 46)
  picker:SetPoint("CENTER", F, "TOPLEFT", W_ / 2, Y_ROW)
  picker.edge = Round(picker, "BACKGROUND", 0, false)
  Grad(picker.edge, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 0.55 }, { AQUA[1], AQUA[2], AQUA[3], 0.40 })
  picker.body = Round(picker, "BACKGROUND", 1, false, 1)
  Grad(picker.body, "VERTICAL", { 0.03, 0.04, 0.05, 0.97 }, { 0.07, 0.09, 0.09, 0.97 })
  picker.left = arrowButton(picker, pi / 2); picker.left:SetPoint("LEFT", 6, 0)
  picker.right = arrowButton(picker, -pi / 2); picker.right:SetPoint("RIGHT", -6, 0)
  picker.left:SetScript("OnClick", function() TT.Shift(-1) end)
  picker.right:SetScript("OnClick", function() TT.Shift(1) end)
  picker.left:SetScript("OnEnter", function(s) Tip(s, "Früher stellen") end); picker.left:SetScript("OnLeave", NoTip)
  picker.right:SetScript("OnEnter", function(s) Tip(s, "Später stellen") end); picker.right:SetScript("OnLeave", NoTip)
  picker.btn = {}
  for k = 1, 7 do
    local b = iconButton(picker, 34)
    b:SetScript("OnClick", function(s) TT.Pick(sel, s.key or "off") end)
    b:SetScript("OnEnter", function(s)
      if s.key then
        local t = T[s.key]
        Tip(s, spellName(t), t.buffs and "Buff-Totem – TotemTakt erkennt, ob du in Reichweite bist" or "ohne Buff – zählt als stehend, solange es läuft")
      else Tip(s, "Element aus", "Dieses Element lässt die Taste aus") end
    end)
    b:SetScript("OnLeave", NoTip)
    picker.btn[k] = b
  end
  picker.none = Text(picker, 11); picker.none:SetPoint("CENTER", -34, 0); picker.none:SetTextColor(0.7, 0.78, 0.75)
  picker:Hide()
end

local function paintPicker()
  if not sel then picker:Hide(); F.opts:Show(); return end
  F.opts:Hide(); picker:Show()
  local e = EL[sel]
  local cur = TT.Chosen(sel)
  local items = {}
  for _, t in ipairs(LIST[sel]) do if knownRank(t) then items[#items + 1] = t.key end end
  items[#items + 1] = false
  local n = #items
  local size, gap = 34, 8
  local total = n * size + (n - 1) * gap
  for k, b in ipairs(picker.btn) do
    local key = items[k]
    if k <= n then
      b.key = key or nil
      b:ClearAllPoints()
      if n == 1 then b:SetPoint("CENTER", picker, "CENTER", 118, 0)   -- nur "aus": rechts neben den Hinweis
      else b:SetPoint("CENTER", picker, "CENTER", -total / 2 + size / 2 + (k - 1) * (size + gap), 0) end
      if key then
        b.icon:SetTexture(spellIcon(T[key])); pcall(b.icon.SetDesaturated, b.icon, false); b.icon:SetAlpha(1)
      else
        b.icon:SetTexture(QMARK); pcall(b.icon.SetDesaturated, b.icon, true); b.icon:SetAlpha(0.4)
      end
      local on = (key or nil) == cur or (key == false and cur == nil)
      Grad(b.ring, "VERTICAL", { e.c2[1], e.c2[2], e.c2[3], on and 1 or 0.22 }, { e.c1[1], e.c1[2], e.c1[3], on and 1 or 0.22 })
      b:Show()
    else
      b:Hide()
    end
  end
  picker.none:SetShown(n == 1)
  picker.none:SetText(n == 1 and ("Noch kein " .. e.name .. "-Totem gelernt") or "")
  local pos
  for k, el in ipairs(DB.order) do if el == sel then pos = k end end
  picker.left:SetAlpha((pos and pos > 1) and 1 or 0.3)
  picker.right:SetAlpha((pos and pos < #DB.order) and 1 or 0.3)
end

-- Schalter "Fehlende zuerst" + Neustart-Wahl
local function buildOptions()
  local o = CreateFrame("Frame", nil, F)
  o:SetSize(W_ - 40, 46); o:SetPoint("CENTER", F, "TOPLEFT", W_ / 2, Y_ROW)
  F.opts = o
  local sw = CreateFrame("Button", nil, o); sw:SetSize(196, 40); sw:SetPoint("LEFT", 0, 0)
  sw.track = CreateFrame("Frame", nil, sw); sw.track:SetSize(44, 24); sw.track:SetPoint("LEFT", 2, 0)
  sw.tb = Round(sw.track, "BACKGROUND", 0, true)
  sw.knob = MT(sw.track, "ARTWORK", 0, "ctx_disc"); sw.knob:SetSize(20, 20)
  sw.knobG = MT(sw.track, "ARTWORK", 1, "ctx_gloss", "ADD"); sw.knobG:SetSize(20, 20); sw.knobG:SetVertexColor(1, 1, 1, 0.35)
  sw.t = Text(sw, 12, true); sw.t:SetPoint("LEFT", sw.track, "RIGHT", 10, 6); sw.t:SetText("Fehlende zuerst")
  sw.s = Text(sw, 10); sw.s:SetPoint("TOPLEFT", sw.t, "BOTTOMLEFT", 0, -2); sw.s:SetTextColor(0.62, 0.74, 0.70)
  sw.s:SetText("stehende danach")
  sw.kx = 12
  sw:SetScript("OnClick", function() DB.smart = not DB.smart; queue(false); TT.Refresh() end)
  sw:SetScript("OnEnter", function(s) Tip(s, "Fehlende zuerst", "Außerhalb des Kampfes sortiert TotemTakt nach jedem Totem neu:",
    "was fehlt, gleich ausläuft oder zu weit weg ist, kommt vorne dran.", "Aus = immer deine feste Reihenfolge.") end)
  sw:SetScript("OnLeave", NoTip)
  F.sw = sw
  -- Neustart-Wahl (Segment): nach wie vielen Sekunden ohne Totem die Folge wieder vorne beginnt
  local seg = CreateFrame("Frame", nil, o); seg:SetSize(186, 34); seg:SetPoint("RIGHT", 0, -2)
  seg.bg = Round(seg, "BACKGROUND", 0, true); seg.bg:SetVertexColor(1, 1, 1, 0.07)
  seg.thumb = CreateFrame("Frame", nil, seg); seg.thumb:SetSize(58, 28)
  seg.th = Round(seg.thumb, "BACKGROUND", 1, true)
  Grad(seg.th, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 0.95 }, { TEAL[1], TEAL[2], TEAL[3], 0.95 })
  seg.cap = Text(o, 10); seg.cap:SetPoint("BOTTOM", seg, "TOP", 0, 3); seg.cap:SetTextColor(0.62, 0.74, 0.70); seg.cap:SetText("Neustart nach Pause")
  seg.opt = {}
  for k, v in ipairs({ 8, 15, 0 }) do
    local b = CreateFrame("Button", nil, seg); b:SetSize(60, 34); b:SetPoint("LEFT", 2 + (k - 1) * 61, 0)
    b.v = v
    b.t = Text(b, 12, true); b.t:SetPoint("CENTER"); b.t:SetText(v > 0 and (v .. " s") or "nie")
    b:SetScript("OnClick", function(s) DB.reset = s.v; queue(false); TT.Refresh() end)
    b:SetScript("OnEnter", function(s) Tip(s, s.v > 0 and ("Neustart nach " .. s.v .. " s") or "Kein Neustart nach Zeit",
      s.v > 0 and "Drückst du länger nicht, beginnt die Folge wieder vorne (im Kampf: das Totem, das am ehesten ausläuft)." or "Die Folge läuft weiter, wo du aufgehört hast.",
      "Nach dem Kampf beginnt sie immer neu.") end)
    b:SetScript("OnLeave", NoTip)
    seg.opt[k] = b
  end
  seg.tx = 2
  F.seg = seg
end

local function paintOptions()
  local sw, seg = F.sw, F.seg
  sw.on = DB.smart and true or false
  if sw.on then Grad(sw.tb, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 0.95 }, { TEAL[1], TEAL[2], TEAL[3], 0.95 }); sw.knob:SetVertexColor(0.04, 0.06, 0.06, 1)
  else Grad(sw.tb, "HORIZONTAL", { 1, 1, 1, 0.10 }, { 1, 1, 1, 0.10 }); sw.knob:SetVertexColor(0.85, 0.9, 0.88, 1) end
  for k, b in ipairs(seg.opt) do
    local on = (DB.reset or 0) == b.v
    b.t:SetTextColor(on and 0.03 or 0.80, on and 0.07 or 0.88, on and 0.06 or 0.85)
    if on then seg.tx = 2 + (k - 1) * 61 end
  end
end

-- grosser Knopf + "Naechster Druck"
local function buildFooter()
  local b = CreateFrame("Button", nil, F)
  b:SetSize(212, 42); b:SetPoint("TOPLEFT", F, "TOPLEFT", 20, Y_FOOT)
  b:RegisterForDrag("LeftButton")
  b.glow = MT(b, "BACKGROUND", 0, "dot", "ADD"); b.glow:SetPoint("CENTER"); b.glow:SetSize(300, 90); b.glow:SetVertexColor(NEON[1], NEON[2], NEON[3], 0.18)
  b.bg = Round(b, "BORDER", 0, false)
  b.sheen = Tex(b, "BORDER", 2); b.sheen:SetPoint("TOPLEFT", 14, -2); b.sheen:SetPoint("TOPRIGHT", -14, -2); b.sheen:SetHeight(16)
  b.sheen:SetColorTexture(1, 1, 1, 1); Grad(b.sheen, "VERTICAL", { 1, 1, 1, 0 }, { 1, 1, 1, 0.22 })
  b.hl = Round(b, "HIGHLIGHT", 0, false, 0, "ADD"); b.hl:SetVertexColor(1, 1, 1, 0.16)
  b.t = Text(b, 13, false); b.t:SetPoint("CENTER", 0, 0); b.t:SetShadowColor(0, 0, 0, 0)
  local function act()
    if inCombat() then P("Im Kampf gesperrt – nach dem Kampf noch einmal."); return end
    if not macroIndex() then
      if TT.Write(true) then P("Makro „TotemTakt“ angelegt – jetzt auf eine Leiste ziehen.")
      elseif status ~= "voll" then P("Noch kein Totem gewählt – erst ein Totem lernen oder ein Element einschalten.") end
      TT.Refresh()
      return
    end
    TT.Write(false)
    pcall(PickupMacro, MACRO)
  end
  b:SetScript("OnClick", act)
  b:SetScript("OnDragStart", act)
  b:SetScript("OnEnter", function(s) Tip(s, "Makro „TotemTakt“", "Auf eine Aktionsleiste legen und die Taste wie gewohnt belegen.",
    "Jeder Druck stellt ein Totem. Drückst du in der Abklingzeit, passiert nichts – die Reihenfolge bleibt.") end)
  b:SetScript("OnLeave", NoTip)
  F.big = b
  -- Naechster Druck
  local n = CreateFrame("Frame", nil, F); n:SetSize(196, 42); n:SetPoint("TOPRIGHT", F, "TOPRIGHT", -20, Y_FOOT)
  n.cap = Text(n, 10); n.cap:SetPoint("TOPLEFT", 48, -5); n.cap:SetTextColor(0.62, 0.74, 0.70); n.cap:SetText("NÄCHSTER DRUCK")
  n.f = CreateFrame("Frame", nil, n); n.f:SetSize(38, 38); n.f:SetPoint("LEFT", 2, 0)
  n.disc = MT(n.f, "BACKGROUND", 0, "ctx_disc"); n.disc:SetAllPoints(); n.disc:SetVertexColor(0.03, 0.05, 0.05, 1)
  n.icon = RoundIcon(n.f, 30, "ARTWORK", 1)
  n.ring = MT(n.f, "OVERLAY", 0, "ctx_ring", "ADD"); n.ring:SetPoint("CENTER"); n.ring:SetSize(42, 42)
  n.t = Text(n, 12, true); n.t:SetPoint("TOPLEFT", n.cap, "BOTTOMLEFT", 0, -3); n.t:SetWidth(146); n.t:SetWordWrap(false); n.t:SetJustifyH("LEFT")
  n.cap:SetWidth(146); n.cap:SetJustifyH("LEFT")
  F.next = n
  -- Hinweiszeile
  F.hint = Text(F, 10); F.hint:SetPoint("BOTTOM", F, "BOTTOM", 0, 14); F.hint:SetWidth(W_ - 40); F.hint:SetWordWrap(false)
  F.hint:SetTextColor(0.62, 0.74, 0.70)
end

local function paintFooter(seq)
  local b, n = F.big, F.next
  local has = macroIndex() ~= nil
  local fight = inCombat()
  if fight then
    Grad(b.bg, "HORIZONTAL", { 0.35, 0.40, 0.40, 0.9 }, { 0.30, 0.34, 0.38, 0.9 })
    b.t:SetText("|cffd8e2deIM KAMPF GESPERRT|r")
  else
    Grad(b.bg, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 1 }, { AQUA[1], AQUA[2], AQUA[3], 1 })
    b.t:SetText(has and "|cff07110cAUF LEISTE ZIEHEN|r" or "|cff07110cMAKRO ANLEGEN|r")
  end
  local first = seq and seq[1]
  if first then
    local e = EL[first.el]
    n.icon:SetTexture(spellIcon(T[first.key])); n.icon:SetAlpha(1)
    Grad(n.ring, "VERTICAL", { e.c2[1], e.c2[2], e.c2[3], 1 }, { e.c1[1], e.c1[2], e.c1[3], 1 })
    n.t:SetText(spellName(T[first.key]))
  else
    n.icon:SetTexture(QMARK); n.icon:SetAlpha(0.4)
    Grad(n.ring, "VERTICAL", { 1, 1, 1, 0.2 }, { 1, 1, 1, 0.2 })
    n.t:SetText("kein Totem gewählt")
  end
  local h
  if fight then h = "Im Kampf bleibt das Makro fest – danach sortiert TotemTakt neu."
  elseif not has and DB.made then h = "Makro fehlt – der Knopf legt es neu an (Charakter-Makros)."
  elseif not has then h = "Der Knopf legt das Makro „TotemTakt“ an (Charakter-Makros)."
  elseif pending then h = "Änderung wird nach dem Kampf ins Makro übernommen."
  else h = "1 Druck = 1 Totem · Druck in der Abklingzeit zählt nicht" end
  F.hint:SetText(h)
end

function TT.Refresh()
  if not (F and F:IsShown()) then return end
  local seq, list, ok = TT.Plan()
  local stateOf = {}
  for _, e in ipairs(list) do stateOf[e.el] = ok and e.st or "?" end
  for i, el in ipairs(DB.order) do
    local o = orbs[el]
    o.tx = orbX(i)
    paintOrb(o, el, i, stateOf[el])
  end
  -- Schritt-Nummer = Platz im Makro (fehlende zuerst), nicht nur der Platz in der Reihe
  local place = {}
  for k, e in ipairs(seq) do place[e.el] = k end
  for _, el in ipairs(DB.order) do
    local o = orbs[el]
    if place[el] then o.num:SetText(tostring(place[el])) end
  end
  paintOptions()
  paintPicker()
  paintFooter(seq)
end

-- Reihenfolge aendern
function TT.Move(from, to)
  local o = DB.order
  if not (o[from] and to >= 1 and to <= #o) or from == to then if TT.Refresh then TT.Refresh() end return end
  local el = table.remove(o, from)
  table.insert(o, to, el)
  queue(false)
  if TT.Refresh then TT.Refresh() end
end
function TT.Shift(d)
  if not sel then return end
  for k, el in ipairs(DB.order) do if el == sel then return TT.Move(k, k + d) end end
end
function TT.Select(el)
  sel = (sel ~= el) and el or nil
  if TT.Refresh then TT.Refresh() end
end
function TT.Pick(el, key)
  if not el then return end
  if key == "off" then DB.pick[el] = "off"
  elseif T[key] and T[key].el == el and knownRank(T[key]) then DB.pick[el] = key end
  queue(false)
  if TT.Refresh then TT.Refresh() end
end

local function buildWindow()
  F = CreateFrame("Frame", "TotemTaktFrame", UIParent)
  F:SetSize(W_, H_); F:SetFrameStrata("DIALOG"); F:SetClampedToScreen(true); F:SetMovable(true); F:EnableMouse(true)
  F:RegisterForDrag("LeftButton")
  F:SetScript("OnDragStart", function(s) if not inCombat() then s:StartMoving() end end)
  F:SetScript("OnDragStop", function(s)
    s:StopMovingOrSizing()
    local p, _, rp, x, y = s:GetPoint(1)
    DB.pos = { p, rp, x, y }
  end)
  F:SetPoint("CENTER", UIParent, "CENTER", 0, 80)
  if DB.pos and DB.pos[1] then F:ClearAllPoints(); F:SetPoint(DB.pos[1], UIParent, DB.pos[2], DB.pos[3], DB.pos[4]) end
  if UISpecialFrames then table.insert(UISpecialFrames, "TotemTaktFrame") end   -- Escape schliesst
  -- Glas: Aussenleuchten, Verlaufskante, Anthrazit-Koerper, Farbschleier, Lichtkante
  local gl = CreateFrame("Frame", nil, F); gl:SetPoint("TOPLEFT", -36, 36); gl:SetPoint("BOTTOMRIGHT", 36, -36)
  gl:SetFrameLevel(max(0, (F:GetFrameLevel() or 1) - 1))
  local g = MT(gl, "BACKGROUND", 0, "glow", "ADD"); g:SetAllPoints(); Slice(g, 60)
  Grad(g, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 0.30 }, { AQUA[1], AQUA[2], AQUA[3], 0.22 })
  F.glow = g
  local edge = Round(F, "BACKGROUND", 0, false)
  Grad(edge, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 0.80 }, { AQUA[1], AQUA[2], AQUA[3], 0.50 })
  local body = Round(F, "BACKGROUND", 1, false, 1)
  Grad(body, "VERTICAL", { 0.030, 0.034, 0.048, 0.97 }, { 0.072, 0.092, 0.088, 0.96 })
  local tint = Round(F, "BACKGROUND", 2, false, 1, "ADD")
  Grad(tint, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 0.05 }, { AQUA[1], AQUA[2], AQUA[3], 0.035 })
  F.aur = {}
  for k, d in ipairs({ { NEON, 0.10, 0 }, { TEAL, 0.07, 2.1 }, { AQUA, 0.09, 4.2 } }) do
    local t = MT(F, "BORDER", k - 1, "dot", "ADD"); t:SetVertexColor(d[1][1], d[1][2], d[1][3], d[2]); t:SetSize(230, 160)
    t:SetPoint("CENTER", F, "TOPLEFT", 120 * k, -120)
    F.aur[k] = { t = t, ph = d[3] }
  end
  local sheen = Tex(F, "BORDER", 4); sheen:SetPoint("TOPLEFT", 14, -1); sheen:SetPoint("TOPRIGHT", -14, -1); sheen:SetHeight(34)
  sheen:SetColorTexture(1, 1, 1, 1); Grad(sheen, "VERTICAL", { 1, 1, 1, 0 }, { 1, 1, 1, 0.045 })
  -- Kopf
  local title = Text(F, 17, true); title:SetPoint("TOPLEFT", 22, -18)
  title:SetText(GradText("TOTEMTAKT", NEON, TEAL, AQUA))
  local sub = Text(F, 11); sub:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -4); sub:SetTextColor(0.66, 0.80, 0.75)
  sub:SetText("Eine Taste – jeder Druck stellt das nächste Totem")
  local x = CreateFrame("Button", nil, F); x:SetSize(30, 30); x:SetPoint("TOPRIGHT", -12, -12)
  local xd = MT(x, "BACKGROUND", 0, "ctx_disc"); xd:SetPoint("CENTER"); xd:SetSize(30, 30); xd:SetVertexColor(1, 1, 1, 0.06)
  local xh = MT(x, "HIGHLIGHT", 0, "ctx_disc", "ADD"); xh:SetPoint("CENTER"); xh:SetSize(30, 30); xh:SetVertexColor(1, 0.35, 0.35, 0.25)
  for _, rot in ipairs({ pi / 4, -pi / 4 }) do
    local l = Tex(x, "ARTWORK", 0); l:SetColorTexture(0.85, 0.95, 0.9, 0.9); l:SetSize(13, 2); l:SetPoint("CENTER"); l:SetRotation(rot)
  end
  x:SetScript("OnClick", function() F:Hide() end)
  -- Takt-Linie hinter den Kugeln mit wanderndem Lichtpuls
  local line = Tex(F, "BORDER", 6); line:SetColorTexture(1, 1, 1, 1); line:SetHeight(2)
  line:SetPoint("LEFT", F, "TOPLEFT", orbX(1), Y_ORB); line:SetPoint("RIGHT", F, "TOPLEFT", orbX(4), Y_ORB)
  Grad(line, "HORIZONTAL", { NEON[1], NEON[2], NEON[3], 0.45 }, { AQUA[1], AQUA[2], AQUA[3], 0.45 })
  F.pulse = MT(F, "BORDER", 7, "dot", "ADD"); F.pulse:SetSize(70, 22); F.pulse:SetVertexColor(TEAL[1], TEAL[2], TEAL[3], 0.75)
  -- Kugeln
  orbs = {}
  for i, el in ipairs(DB.order) do orbs[el] = buildOrb(i); orbs[el].el = el end
  buildOptions()
  buildPicker()
  buildFooter()
  F:SetScript("OnShow", function() TT.Write(false); TT.Refresh() end)
  F:SetScript("OnHide", function() sel = nil; NoTip() end)
  -- Animation: Kugeln gleiten auf ihren Platz, gezogene Kugel folgt der Maus, Puls wandert, Aurora treibt
  local acc = 0
  F:SetScript("OnUpdate", function(_, el)
    local now = GetTime()
    for _, o in pairs(orbs) do
      if o.drag then
        local cx = GetCursorPosition()
        local sc = F:GetEffectiveScale()
        local left = F:GetLeft() or 0
        o.x = max(X0 - 20, min(orbX(4) + 20, cx / sc - left))
      elseif abs(o.x - o.tx) > 0.3 then
        o.x = o.x + (o.tx - o.x) * min(1, el * 12)
      else
        o.x = o.tx
      end
      if o.px ~= o.x then
        o.px = o.x
        o:ClearAllPoints(); o:SetPoint("CENTER", F, "TOPLEFT", o.x, Y_ORB)
        o.cap:ClearAllPoints(); o.cap:SetPoint("TOP", F, "TOPLEFT", o.x, Y_ORB - ORB / 2 - 11)
      end
      local hot = (o.el == sel or o.drag) and 1 or 0.72
      o.halo:SetAlpha(hot * (0.78 + 0.22 * sin(now * 2 + o.tx * 0.02)))
    end
    local f = (now / 2.4) % 1
    F.pulse:ClearAllPoints(); F.pulse:SetPoint("CENTER", F, "TOPLEFT", orbX(1) + (orbX(4) - orbX(1)) * f, Y_ORB)
    F.pulse:SetAlpha(0.8 * sin(f * pi))
    for k, b in ipairs(F.aur) do
      b.t:SetPoint("CENTER", F, "TOPLEFT", W_ * (0.5 + 0.34 * sin(now * (0.09 + 0.02 * k) + b.ph)), -H_ * (0.5 + 0.30 * math.cos(now * (0.11 + 0.01 * k) + b.ph * 1.7)))
    end
    local sw = F.sw
    local kx = sw.on and 34 or 12
    sw.kx = sw.kx + (kx - sw.kx) * min(1, el * 14)
    sw.knob:ClearAllPoints(); sw.knob:SetPoint("CENTER", sw.track, "LEFT", sw.kx, 0)
    sw.knobG:ClearAllPoints(); sw.knobG:SetPoint("CENTER", sw.track, "LEFT", sw.kx, 0)
    local seg = F.seg
    seg.thx = (seg.thx or seg.tx) + (seg.tx - (seg.thx or seg.tx)) * min(1, el * 14)
    seg.thumb:ClearAllPoints(); seg.thumb:SetPoint("LEFT", seg, "LEFT", seg.thx + 1, 0)
    acc = acc + el
    if acc >= 1 then acc = 0; TT.Refresh() end   -- Zustandspunkte live
  end)
  F:Hide()
end

function TT.Toggle()
  if not F then buildWindow() end
  if F:IsShown() then F:Hide() else F:Show() end
end
TT.Frame = function() return F end

---------------------------------------------------------------------------
-- Ereignisse
---------------------------------------------------------------------------
local E = CreateFrame("Frame")
local isShaman = false
E:RegisterEvent("ADDON_LOADED")
E:SetScript("OnEvent", function(_, ev, a1)
  if ev == "ADDON_LOADED" then
    if a1 ~= "TotemTakt" then return end
    TotemTaktDB = TotemTaktDB or {}
    DB = TotemTaktDB
    for k, v in pairs(DEF) do
      if DB[k] == nil then
        if type(v) == "table" then local c = {} for i, x in pairs(v) do c[i] = x end DB[k] = c else DB[k] = v end
      end
    end
    -- Reihenfolge reparieren (jedes Element genau einmal)
    local seen, fixed = {}, {}
    for _, el in ipairs(DB.order) do if EL[el] and not seen[el] then seen[el] = true; fixed[#fixed + 1] = el end end
    for _, el in ipairs(ELS) do if not seen[el] then fixed[#fixed + 1] = el end end
    DB.order = fixed
    local _, cls = UnitClass("player")
    isShaman = cls == "SHAMAN"
    if not isShaman then return end
    E:RegisterEvent("PLAYER_ENTERING_WORLD")
    E:RegisterEvent("PLAYER_TOTEM_UPDATE")
    E:RegisterEvent("PLAYER_REGEN_DISABLED")
    E:RegisterEvent("PLAYER_REGEN_ENABLED")
    E:RegisterEvent("SPELLS_CHANGED")
    return
  end
  if not (DB and isShaman) then return end
  if ev == "PLAYER_ENTERING_WORLD" then
    wipe(knownCache); nameBase = nil
    queue(not DB.made)   -- erster Start: Makro anlegen, sobald ein Totem gelernt ist
  elseif ev == "SPELLS_CHANGED" then
    wipe(knownCache); nameBase = nil
    queue(not DB.made)   -- erstes Totem gelernt -> Makro einmalig anlegen
  elseif ev == "PLAYER_REGEN_DISABLED" then
    -- letzte Gelegenheit vor der Kampfsperre: Makro auf den neuesten Stand, mit deiner Neustart-Wahl
    TT.Write(false, true)
    if TT.Refresh then TT.Refresh() end
  elseif ev == "PLAYER_REGEN_ENABLED" then
    queue(false)
  elseif ev == "PLAYER_TOTEM_UPDATE" then
    if not inCombat() then queue(false) end
  end
end)
-- ausserhalb des Kampfes jede Sekunde nachsehen (Buff weg, Totem laeuft gleich ab, Schonfrist vorbei)
local tick = 0
E:SetScript("OnUpdate", function(_, el)
  if not (DB and isShaman) then return end
  tick = tick + el
  if tick < 1 then return end
  tick = 0
  if not inCombat() and DB.smart then TT.Write(false) end
end)

---------------------------------------------------------------------------
-- /takt
---------------------------------------------------------------------------
SLASH_TOTEMTAKT1, SLASH_TOTEMTAKT2 = "/takt", "/totemtakt"
SlashCmdList.TOTEMTAKT = function(msg)
  msg = (msg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  if not DB then return end
  if not isShaman then P("nur für Schamanen."); return end
  if msg == "" then TT.Toggle()
  elseif msg == "uhr" or msg:sub(1, 4) == "uhr " then
    if TT.UhrCmd then TT.UhrCmd(msg:sub(5)) end
  elseif msg == "makro" then
    if inCombat() then P("Im Kampf gesperrt – nach dem Kampf noch einmal."); return end
    if TT.Write(true) then P("Makro „TotemTakt“ ist aktuell – auf eine Leiste ziehen (oder /takt).")
    elseif status ~= "voll" then P("Noch kein Totem gewählt – erst ein Totem lernen oder ein Element einschalten.") end
  elseif msg == "status" then
    local seq, _, ok = TT.Plan()
    local parts = {}
    for k, e in ipairs(seq) do parts[#parts + 1] = k .. ". " .. spellName(T[e.key]) .. (ok and (" (" .. (ST[e.st] or ST["?"])[4] .. ")") or "") end
    P(#parts > 0 and table.concat(parts, "  ") or "kein Totem gewählt")
    P("Makro: " .. (macroIndex() and "da" or "fehlt") .. (pending and " · Änderung wartet aufs Kampfende" or ""))
  elseif msg == "fest" or msg == "smart" then
    DB.smart = (msg == "smart"); queue(false)
    P(DB.smart and "Fehlende zuerst: an" or "Fehlende zuerst: aus (feste Reihenfolge)")
  else
    P("v" .. VERSION .. " · /takt (Fenster) · /takt makro (Makro anlegen/aktualisieren) · /takt status · /takt smart | fest · /takt uhr (Totem-Restzeit) · /takt uhr hilfe")
  end
end
