-- Schlaghagel 1.1: Mahlstrom-Anzeige im strengen Forever-Nachbau (nur echte Widget-Methoden/Animationstypen),
-- Strom-Animation nachgerechnet (Drehen, Flackern, Blitze, Einschlag) und optional Bild fuer Bild exportiert.
-- Aufruf aus wow-addons/: lua5.1 tests/hagel_strom.lua [ausgabeordner]   -> "STROM TESTS OK"
-- Mit Ordner: <ordner>/f_000.tsv ... (python3 -I tools/render_pages.py <ordner>, dann zu GIF zusammensetzen)
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local W = require("wow_mock")
local L = require("layout")
W.install({})
local G = _G
local fails, n = 0, 0
local function ok(c, name) n = n + 1 if not c then fails = fails + 1 io.stdout:write("FEHLER: " .. name .. "\n") end end
G.print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring(select(i, ...)) end table.insert(W.prints, table.concat(t, " ")) end
G.UnitClass = function() return "Schamane", "SHAMAN" end
G.STANDARD_TEXT_FONT = "Fonts\\FRIZQT__.TTF"
G.C_Spell = { GetSpellTexture = function(id) assert(type(id) == "number") return 136048 end }
G.C_UnitAuras = { GetPlayerAuraBySpellID = function() return nil end }
-- Blizzards Aura-Container gibt es im Nachbau nicht -> Add-on meldet "fehlt", die Vorschau laeuft trotzdem.
-- Cooldown mit Blizzard-Schablone (CooldownFrameTemplate) wie im Add-on: im Nachbau ohne Schablone.
local cf = G.CreateFrame
G.CreateFrame = function(kind, name, parent, tpl)
  if kind == "Cooldown" and tpl == "CooldownFrameTemplate" then tpl = nil end
  return cf(kind, name, parent, tpl)
end

dofile("addons/Schlaghagel/Schlaghagel.lua")
W.fire("ADDON_LOADED", "Schlaghagel")
W.fire("PLAYER_LOGIN")
ok(#W.errors == 0, "keine Lua-Fehler beim Laden: " .. table.concat(W.errors, " | "))
local A, P = G.SchlaghagelMahlAnchor, G.SchlaghagelMahlPreview
ok(A and P and G.SchlaghagelAnchor, "beide Anker gebaut")
ok(A.__points.CENTER and A.__points.CENTER[4] == 120, "Mahlstrom ueber der Bildmitte (y +120)")
for _, f in ipairs({ "strom_glow", "strom_plasma", "strom_arc1", "strom_arc2", "strom_bolt1", "strom_bolt2", "strom_bolt3" }) do
  local h = io.open("addons/Schlaghagel/Media/" .. f .. ".tga", "rb")
  ok(h ~= nil, "Grafik " .. f) if h then h:close() end
end

SlashCmdList.SCHLAGHAGEL("test mahl")
ok(P.__shown and not G.SchlaghagelPreview.__shown, "test mahl zeigt nur Mahlstrom")
-- nur Ladungen/Stapel + Restzeit als Text, kein Titel/Hinweis (1.2.1)
local function texts(o, out)
  for _, c in ipairs(o.__children or {}) do
    if c.__kind == "FontString" then out[#out + 1] = c end
    texts(c, out)
  end
  return out
end
local fsl = texts(P, {})
local wordy = false
for _, f in ipairs(fsl) do if tostring(f.__text or ""):gsub("|c%x%x%x%x%x%x%x%x", ""):find("%a") then wordy = true end end
ok(#fsl == 1 and not wordy, "Mahlstrom: nur 1 Text (Sekunden, mittig), keine Stapelzahl, keine Woerter: " .. #fsl)
ok(fsl[1] and fsl[1].__points.CENTER ~= nil, "Sekunden in der Mitte")
-- alle Animationsgruppen der Vorschau einsammeln
local groups = {}
local function walk(o)
  for _, c in ipairs(o.__children or {}) do
    if c.__kind == "AnimationGroup" then groups[#groups + 1] = c else walk(c) end
  end
end
walk(P)
local playing = 0 for _, g in ipairs(groups) do if g.__playing then playing = playing + 1 end end
ok(#groups == 13 and playing == 13, "13 Animationen (Puls, 5 Strom, 6 Blitze, Einschlag) laufen: " .. #groups .. "/" .. playing)

-- Ablauf nachrechnen
local function at(t)
  local res = {}
  for _, g in ipairs(groups) do
    if g.__playing then for _, e in ipairs((W.animState(g, t))) do res[#res + 1] = e end end
  end
  return res
end
-- Blitze: jeder zuckt einmal je Takt, kurz hell, sonst aus
local bolts = {}
for _, g in ipairs(groups) do
  local a = g.__anims[1]
  if a and a.__target and tostring(a.__target.__file):find("strom_bolt", 1, true) then bolts[#bolts + 1] = g end
end
ok(#bolts == 6, "6 Blitze")
local lit, maxLit, minLit = {}, 0, 99
for step = 0, 119 do
  local t = step * 0.02
  local cnt = 0
  for i, g in ipairs(bolts) do
    local a = 0
    for _, e in ipairs((W.animState(g, t))) do a = e[3] end
    if a > 0.5 then cnt = cnt + 1 lit[i] = true end
  end
  maxLit, minLit = math.max(maxLit, cnt), math.min(minLit, cnt)
end
local all = true for i = 1, 6 do all = all and lit[i] == true end
ok(all, "jeder Blitz zuckt in 2,4 s")
ok(maxLit <= 2, "nie mehr als 2 Blitze gleichzeitig hell (" .. maxLit .. ") - wirkt wie Zucken, nicht wie Dauerlicht")
-- Drehungen laufen durchgehend (kein Stillstand)
local spins = {}
for _, g in ipairs(groups) do
  local a = g.__anims[1]
  if a and a.__kind == "Rotation" then spins[#spins + 1] = g end
end
ok(#spins == 3, "3 Drehungen")
for _, g in ipairs(spins) do
  local r1 = W.animState(g, 3.0)[1][3]
  local r2 = W.animState(g, 3.1)[1][3]
  ok(math.abs(r2 - r1) > 0.05, "dreht bei 3 s weiter (" .. tostring(g.__anims[1].__dur) .. " s/Runde)")
end
-- Einschlag nur am Anfang
local strike
for _, g in ipairs(groups) do if g.__loop == nil and #g.__anims == 3 then strike = g end end
ok(strike and #W.animState(strike, 0.1) == 3 and #W.animState(strike, 1.0) == 0, "Einschlag einmalig beim Erscheinen")

ok(#L.problems(A) == 0, "Layout: " .. table.concat(L.problems(A), " | "))

-- Bild fuer Bild exportieren (Hintergrund fest, damit alle Bilder gleich gross sind)
if OUT then
  if fsl[1] then fsl[1]:SetText("24") end   -- Restzeit wie im Spiel (Vorschau-Zaehler laeuft im Nachbau nicht)
  local bg = A:CreateTexture(nil, "BACKGROUND", nil, -8)
  bg:SetColorTexture(0.055, 0.06, 0.075, 1)
  bg:SetPoint("CENTER", A, "CENTER", 0, 10)
  bg:SetSize(76 * 3.6, 76 * 3.6)
  local saved = {}
  local frames = 0
  for step = 0, 59 do                       -- 2,4 s mit 25 Bildern/s
    local t = step * 0.04
    for o, v in pairs(saved) do o.__alpha, o.__rot, o.__w, o.__h = v[1], v[2], v[3], v[4] end
    saved = {}
    for _, e in ipairs(at(t)) do
      local o = e[1]
      if o.__kind == "Texture" then
        saved[o] = saved[o] or { o.__alpha, o.__rot, o.__w, o.__h }
        local s = saved[o]
        if e[2] == "alpha" then o.__alpha = e[3]
        elseif e[2] == "rot" then o.__rot = (s[2] or 0) + e[3]
        elseif e[2] == "scale" then o.__w, o.__h = s[3] * e[3], s[4] * e[3] end
      end
    end
    L.dump(A, string.format("%s/f_%03d.tsv", OUT, step))
    frames = frames + 1
  end
  for o, v in pairs(saved) do o.__alpha, o.__rot, o.__w, o.__h = v[1], v[2], v[3], v[4] end
  ok(frames == 60, "60 Bilder exportiert")
end

ok(#W.errors == 0, "keine Lua-Fehler: " .. table.concat(W.errors, " | "))
io.stdout:write(string.format("%d Pruefungen, %d Fehler\n", n, fails))
if fails > 0 then os.exit(1) end
io.stdout:write("STROM TESTS OK\n")
