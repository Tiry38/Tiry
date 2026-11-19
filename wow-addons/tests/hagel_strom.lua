-- Schlaghagel 1.4: Mahlstrom-Anzeige im strengen Forever-Nachbau (nur echte Widget-Methoden/Animationstypen),
-- Blitzsturm nachgerechnet (5 Blitz-Schnitte, aufsteigende Funken, Tempo-Striche, Einschlag) und optional Bild fuer Bild exportiert.
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
for _, f in ipairs({ "strom_glow", "blitz_slash", "blitz_rise1", "blitz_rise2", "hagel_spark", "hagel_speed" }) do
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
ok(#groups == 11 and playing == 11, "11 Animationen (Puls, 2 Funken-Lagen, 2 Tempo, 5 Blitz-Schnitte, Einschlag) laufen: " .. #groups .. "/" .. playing)
-- 1.4: Stil wie Schlaghagel - keine Kreise/Ringe/Kometen und keine Drehung
local round = false
local function scan(o)
  for _, c in ipairs(o.__children or {}) do
    local f = tostring(c.__file or "")
    if f:find("strom_arc") or f:find("strom_plasma") or f:find("strom_comet") or f:find("strom_orbit")
      or f:find("strom_wave") or f:find("ring") then round = true end
    if c.__kind == "AnimationGroup" then for _, a in ipairs(c.__anims) do if a.__kind == "Rotation" then round = true end end end
    scan(c)
  end
end
scan(P)
ok(not round, "keine Kreise/Ringe/Drehungen (Stil wie Schlaghagel)")

local function at(t)
  local res = {}
  for _, g in ipairs(groups) do
    if g.__playing then for _, e in ipairs((W.animState(g, t))) do res[#res + 1] = e end end
  end
  return res
end
-- Blitz-Schnitte: "ta-ta-ta-ta-ta" (= 5 Stapel), dann Pause; Takt 1,5 s
local slashes = {}
for _, g in ipairs(groups) do
  local a = g.__anims[1]
  if a and a.__target and tostring(a.__target.__file):find("blitz_slash", 1, true) then slashes[#slashes + 1] = g end
end
ok(#slashes == 5, "5 Blitz-Schnitte (= 5 Stapel)")
local function cutAlpha(g, t)
  local a, sp = 0, 0
  for _, e in ipairs((W.animState(g, t))) do
    if e[2] == "alpha" then
      if e[1] == g.__anims[1].__target then a = e[3] else sp = e[3] end
    end
  end
  return a, sp
end
local first, maxLit, litPause, sparkSeen = {}, 0, false, 0
for step = 0, 149 do
  local t = step * 0.01
  local cnt = 0
  for i, g in ipairs(slashes) do
    local a, sp = cutAlpha(g, t)
    if a > 0.5 then cnt = cnt + 1 first[i] = first[i] or t end
    if sp > 0.5 then sparkSeen = sparkSeen + 1 end
  end
  maxLit = math.max(maxLit, cnt)
  if t > 0.95 and cnt > 0 then litPause = true end
end
local seq = true
for i = 1, 5 do seq = seq and first[i] ~= nil and (i == 1 or first[i] > first[i - 1]) end
ok(seq, "Blitze schlagen nacheinander")
ok(sparkSeen > 0, "Treffer-Funken blitzen mit")
ok(first[5] and first[5] - first[1] < 0.5, "fuenf Schlaege kurz hintereinander")
ok(maxLit <= 3, "nie alle gleichzeitig (" .. maxLit .. ")")
ok(not litPause, "danach Pause bis zum naechsten Takt")
ok((cutAlpha(slashes[1], 1.52)) > 0.5, "Takt wiederholt sich (1,5 s)")
-- Funken: beide Lagen steigen nach oben, sichtbar in der Mitte des Takts, unsichtbar am Takt-Ende
local rises = {}
for _, g in ipairs(groups) do
  local a = g.__anims[1]
  if a and a.__target and tostring(a.__target.__file):find("blitz_rise", 1, true) then rises[#rises + 1] = g end
end
ok(#rises == 2, "2 Funken-Lagen")
local function riseAt(g, t)
  local dy, a = 0, 0
  for _, e in ipairs((W.animState(g, t))) do
    if e[2] == "move" then dy = dy + e[3][2] elseif e[2] == "alpha" then a = e[3] end
  end
  return dy, a
end
for _, g in ipairs(rises) do
  local _, total = W.animState(g, 0)
  local y1, a1 = riseAt(g, total * 0.3)
  local y2, a2 = riseAt(g, total * 0.6)
  local y3, a3 = riseAt(g, total * 0.99)
  ok(y2 > y1 and y3 > y2 and a1 > 0.5 and a2 > 0.5 and a3 < 0.1, "Funken steigen und blenden aus (" .. string.format("%.2f", total) .. " s)")
end
local _, t1 = W.animState(rises[1], 0) local _, t2 = W.animState(rises[2], 0)
ok(math.abs(t1 - t2) > 0.1, "Funken-Lagen mit eigenem Takt")
local fl = 0
for _, g in ipairs(groups) do
  local a = g.__anims[1]
  if g.__loop == "BOUNCE" and a and a.__target and tostring(a.__target.__file):find("hagel_speed", 1, true) then fl = fl + 1 end
end
ok(fl == 2, "Tempo-Striche links und rechts flackern")
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
  local function restore()
    for o, v in pairs(saved) do
      o.__alpha, o.__rot, o.__w, o.__h = v[1], v[2], v[3], v[4]
      if v[5] then o.__points.CENTER[3], o.__points.CENTER[4] = v[5], v[6] end
    end
    saved = {}
  end
  for step = 0, 59 do                       -- 2,4 s mit 25 Bildern/s
    local t = step * 0.04
    restore()
    for _, e in ipairs(at(t)) do
      local o = e[1]
      if o.__kind == "Texture" then
        local c = o.__points and o.__points.CENTER
        saved[o] = saved[o] or { o.__alpha, o.__rot, o.__w, o.__h, c and c[3], c and c[4] }
        local s = saved[o]
        if e[2] == "alpha" then o.__alpha = e[3]
        elseif e[2] == "rot" then o.__rot = (s[2] or 0) + e[3]
        elseif e[2] == "scale" then o.__w, o.__h = s[3] * e[3], s[4] * e[3]
        elseif e[2] == "move" and c then c[3], c[4] = c[3] + e[3][1], c[4] + e[3][2] end
      end
    end
    L.dump(A, string.format("%s/f_%03d.tsv", OUT, step))
    frames = frames + 1
  end
  restore()
  ok(frames == 60, "60 Bilder exportiert")
end

ok(#W.errors == 0, "keine Lua-Fehler: " .. table.concat(W.errors, " | "))
io.stdout:write(string.format("%d Pruefungen, %d Fehler\n", n, fails))
if fails > 0 then os.exit(1) end
io.stdout:write("STROM TESTS OK\n")
