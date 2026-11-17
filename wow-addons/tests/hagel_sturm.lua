-- Schlaghagel 1.2: Schlaghagel-Anzeige im strengen Forever-Nachbau (nur echte Widget-Methoden/Animationstypen),
-- Hagelsturm-Animation nachgerechnet (Klingen-Schnitte, Funken, Hagel, Tempo-Striche, Einschlag; keine Kreise) und optional Bild fuer Bild exportiert.
-- Aufruf aus wow-addons/: lua5.1 tests/hagel_sturm.lua [ausgabeordner]   -> "HAGELSTURM TESTS OK"
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
local A, P = G.SchlaghagelAnchor, G.SchlaghagelPreview
ok(A and P and G.SchlaghagelMahlAnchor, "beide Anker gebaut")
ok(A.__points.CENTER and A.__points.CENTER[4] == -150, "Schlaghagel unter der Bildmitte (y -150)")
for _, f in ipairs({ "strom_glow", "hagel_cut", "hagel_spark", "hagel_fall1", "hagel_fall2", "hagel_speed" }) do
  local h = io.open("addons/Schlaghagel/Media/" .. f .. ".tga", "rb")
  ok(h ~= nil, "Grafik " .. f) if h then h:close() end
end

SlashCmdList.SCHLAGHAGEL("test hagel")
ok(P.__shown and not G.SchlaghagelMahlPreview.__shown, "test hagel zeigt nur Schlaghagel")
local groups = {}
local function walk(o)
  for _, c in ipairs(o.__children or {}) do
    if c.__kind == "AnimationGroup" then groups[#groups + 1] = c else walk(c) end
  end
end
walk(P)
local playing = 0 for _, g in ipairs(groups) do if g.__playing then playing = playing + 1 end end
ok(#groups == 9 and playing == 9, "9 Animationen (Puls, 2 Hagel, 2 Tempo, 3 Schnitte, Einschlag) laufen: " .. #groups .. "/" .. playing)
-- keine Kreis-/Ring-Grafik und keine Drehung in der Schlaghagel-Optik
local round = false
local function scan(o)
  for _, c in ipairs(o.__children or {}) do
    local f = tostring(c.__file or "")
    if f:find("strom_arc") or f:find("strom_plasma") or f:find("ring") or f:find("swirl") then round = true end
    if c.__kind == "AnimationGroup" then for _, a in ipairs(c.__anims) do if a.__kind == "Rotation" then round = true end end end
    scan(c)
  end
end
scan(P)
ok(not round, "keine Kreise/Ringe/Drehungen")

local function at(t)
  local res = {}
  for _, g in ipairs(groups) do
    if g.__playing then for _, e in ipairs((W.animState(g, t))) do res[#res + 1] = e end end
  end
  return res
end
-- Klingen-Schnitte: "ta-ta-ta", dann Pause; Takt 1,2 s
local slashes = {}
for _, g in ipairs(groups) do
  local a = g.__anims[1]
  if a and a.__target and tostring(a.__target.__file):find("hagel_cut", 1, true) then slashes[#slashes + 1] = g end
end
ok(#slashes == 3, "3 Klingen-Schnitte (= 3 Ladungen)")
local function cutAlpha(g, t)
  local a, sp = 0, 0
  for _, e in ipairs((W.animState(g, t))) do
    if e[2] == "alpha" then
      if e[1] == g.__anims[1].__target then a = e[3] else sp = e[3] end
    end
  end
  return a, sp
end
local first, maxLit, litPause = {}, 0, false
local sparkSeen = 0
for step = 0, 119 do
  local t = step * 0.01
  local cnt = 0
  for i, g in ipairs(slashes) do
    local a, sp = cutAlpha(g, t)
    if a > 0.5 then cnt = cnt + 1 first[i] = first[i] or t end
    if sp > 0.5 then sparkSeen = sparkSeen + 1 end
  end
  maxLit = math.max(maxLit, cnt)
  if t > 0.70 and cnt > 0 then litPause = true end
end
ok(first[1] and first[2] and first[3] and first[1] < first[2] and first[2] < first[3], "Schnitte schlagen nacheinander")
ok(sparkSeen > 0, "Treffer-Funken blitzen mit")
ok(first[3] and first[3] - first[1] < 0.35, "drei Schlaege kurz hintereinander")
ok(maxLit <= 2, "nie alle drei gleichzeitig (" .. maxLit .. ")")
ok(not litPause, "danach Pause bis zum naechsten Takt")
-- naechster Takt beginnt wieder
local again = false
again = (cutAlpha(slashes[1], 1.22)) > 0.5
ok(again, "Takt wiederholt sich (1,2 s)")
-- Hagel: beide Lagen fallen nach unten, sichtbar in der Mitte des Takts, unsichtbar am Takt-Ende
local hails = {}
for _, g in ipairs(groups) do
  local a = g.__anims[1]
  if a and a.__target and tostring(a.__target.__file):find("hagel_fall", 1, true) then hails[#hails + 1] = g end
end
ok(#hails == 2, "2 Hagel-Lagen")
local function hailAt(g, t)
  local dy, a = 0, 0
  for _, e in ipairs((W.animState(g, t))) do
    if e[2] == "move" then dy = dy + e[3][2] elseif e[2] == "alpha" then a = e[3] end
  end
  return dy, a
end
for _, g in ipairs(hails) do
  local _, total = W.animState(g, 0)
  local y1, a1 = hailAt(g, total * 0.3)
  local y2, a2 = hailAt(g, total * 0.6)
  local y3, a3 = hailAt(g, total * 0.99)
  ok(y2 < y1 and y3 < y2 and a1 > 0.5 and a2 > 0.5 and a3 < 0.1, "Hagel faellt und blendet aus (" .. string.format("%.2f", total) .. " s)")
end
local _, t1 = W.animState(hails[1], 0) local _, t2 = W.animState(hails[2], 0)
ok(math.abs(t1 - t2) > 0.1, "Hagel-Lagen mit eigenem Takt (kein gemeinsames Aussetzen)")
-- Tempo-Striche flackern
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

if OUT then
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
  for step = 0, 59 do                       -- 2,4 s (zwei Takte) mit 25 Bildern/s
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
io.stdout:write("HAGELSTURM TESTS OK\n")
