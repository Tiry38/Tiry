-- TotemTakt-Uhr: Simulation im strengen Forever-Nachbau. Totem-Restzeit als Symbole, auch mit geheimen
-- Kampfwerten (nur erlaubte Anzeige-Funktionen), Verschieben, Groesse (Befehl, Mausrad, Ecke), Sperre,
-- Ausrichtung, leere Plaetze, Reihenfolge aus TotemTakt.
-- Aufruf aus addons/TotemTakt: lua5.1 ../../tests/totem_uhr.lua [ausgabeordner fuer Vorschau]  -> "UHR TESTS OK"
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local W = require("wow_mock")
local L = require("layout")
W.class = "SHAMAN"
W.install({})
local G = _G
local fails, n = 0, 0
local say = function(x) io.stdout:write(x, "\n") end
local function ok(c, name) n = n + 1 if not c then fails = fails + 1 say("FEHLER: " .. name) end end
G.print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring(select(i, ...)) end table.insert(W.prints, table.concat(t, " ")) end
local function said(p) for _, l in ipairs(W.prints) do if l:find(p, 1, true) then return true end end return false end
G.UnitClass = function() return "Schamane", W.class end
G.C_Spell = { GetSpellName = function() return nil end, GetSpellTexture = function() return 134400 end }
G.C_UnitAuras = { GetPlayerAuraBySpellID = function() return nil end }
G.GetMacroIndexByName = function() return 0 end
G.CreateMacro = function() return 121 end
G.EditMacro = function() end
G.FIRE_TOTEM_SLOT, G.EARTH_TOTEM_SLOT, G.WATER_TOTEM_SLOT, G.AIR_TOTEM_SLOT = 1, 2, 3, 4

-- Totem-Plaetze wie im Spiel: 1 Feuer, 2 Erde, 3 Wasser, 4 Luft
local SECRET = setmetatable({}, { __tostring = function() return "secret" end,
  __eq = function() error("Vergleich mit geheimem Wert") end,
  __lt = function() error("Vergleich mit geheimem Wert") end, __le = function() error("Vergleich mit geheimem Wert") end,
  __add = function() error("Rechnen mit geheimem Wert") end, __sub = function() error("Rechnen mit geheimem Wert") end,
  __concat = function() error("Verketten mit geheimem Wert") end })
G.issecretvalue = function(v) return rawequal(v, SECRET) end
W.totems, W.secret = {}, false
local function live(slot) local t = W.totems[slot] return t and t.start + t.dur > W.now and t or nil end
G.GetTotemInfo = function(slot)
  assert(type(slot) == "number" and slot >= 1 and slot <= 4)
  if W.secret then return SECRET, SECRET, SECRET, SECRET, SECRET, SECRET, SECRET end
  local t = live(slot)
  if not t then return false, "", 0, 0, 0, 1, nil end
  return true, t.name, t.start, t.dur, t.icon, 1, 8075
end
G.GetTotemTimeLeft = function(slot)
  if W.secret then return SECRET end
  local t = live(slot)
  return t and (t.start + t.dur - W.now) or 0
end
W.durCalls = 0
G.GetTotemDuration = function(slot)
  W.durCalls = W.durCalls + 1
  return { __duration = true, slot = slot }   -- Objekt selbst ist nicht geheim (Inhalt ggf. schon)
end

dofile("TotemTakt.lua")
dofile("Uhr.lua")
local TT = G.TotemTakt
W.fire("ADDON_LOADED", "TotemTakt")
W.fire("PLAYER_LOGIN")
local B = G.TotemTaktUhr
local U = TotemTaktDB.uhr
local E = W.registered.PLAYER_LOGIN[1]

say("== A: Aufbau")
ok(B ~= nil, "Uhr-Leiste gebaut")
ok(U and U.on == true and U.scale == 1 and U.lock == false and U.leer == 0.25, "Standardwerte")
local slots = {}
for _, c in ipairs(B.__children) do if c.el then slots[c.el] = c end end
ok(slots.earth and slots.fire and slots.water and slots.air, "vier Element-Plaetze")
ok(slots.fire.slot == 1 and slots.earth.slot == 2 and slots.water.slot == 3 and slots.air.slot == 4, "Totem-Plaetze 1-4")
local function x(el) return slots[el].__points.TOPLEFT[3] end
local function y(el) return slots[el].__points.TOPLEFT[4] end
-- Standard-Reihenfolge TotemTakt: Erde, Luft, Wasser, Feuer
ok(x("earth") < x("air") and x("air") < x("water") and x("water") < x("fire"), "Reihenfolge wie TotemTakt")
ok(B.__w > B.__h, "waagerecht")
local function tick(sec)
  local steps = math.max(1, math.floor(sec / 0.1 + 0.5))
  for _ = 1, steps do W.now = W.now + sec / steps W.call(E, "OnUpdate", sec / steps) end
end
-- leer: Grundring blass, Inhalt unsichtbar
W.fire("PLAYER_TOTEM_UPDATE", 1)
ok(slots.fire.base.__alpha == 0.25 and slots.fire.live.__alpha == 0, "leerer Platz blass, Inhalt aus")
ok(L and #L.problems(B) == 0, "Layout leer: " .. table.concat(L.problems(B), " | "))

say("== B: Restzeit ausserhalb des Kampfes")
W.totems[2] = { name = "Totem der Erdstärke", start = W.now, dur = 300, icon = 136023 }
W.totems[4] = { name = "Totem des Windzorns", start = W.now - 188, dur = 300, icon = 136114 }
W.totems[1] = { name = "Totem der Verbrennung", start = W.now - 47.5, dur = 55, icon = 135825 }
W.fire("PLAYER_TOTEM_UPDATE", 2)
tick(0.2)
ok(slots.earth.base.__alpha == 1 and slots.earth.live.__alpha == 1, "Erde sichtbar")
ok(slots.earth.icon.__file == 136023, "Symbol des Totems")
ok(slots.earth.cd.__durobj and slots.earth.cd.__durobj.slot == 2, "Ablauf-Ring aus GetTotemDuration")
ok(slots.earth.txt.__text == "4:60" or slots.earth.txt.__text == "5:00", "Erde 5:00 (" .. tostring(slots.earth.txt.__text) .. ")")
ok(slots.earth.txt.__text == "5:00", "kein 4:60")
ok(slots.air.txt.__text == "1:52", "Luft 1:52 (" .. tostring(slots.air.txt.__text) .. ")")
ok(slots.fire.txt.__text == "8", "Feuer 8 s (" .. tostring(slots.fire.txt.__text) .. ")")
ok(slots.fire.txt.__tc[1] == 1 and slots.fire.txt.__tc[2] < 0.5, "unter 10 s rot")
ok(slots.earth.txt.__tc[2] > 0.9, "sonst hell")
ok(slots.water.live.__alpha == 0 and slots.water.txt.__text == "", "Wasser leer")
if OUT then L.dump(B, OUT .. "/uhr_1_waagerecht.tsv") end
tick(9)
ok(slots.fire.txt.__text == "", "Feuer abgelaufen -> keine Zahl")
W.fire("PLAYER_TOTEM_UPDATE", 1)
ok(slots.fire.live.__alpha == 0, "Feuer abgelaufen -> Symbol weg")

say("== C: Kampf mit geheimen Werten")
W.secret = true
W.secretSeen = W.secretSeen or {}
for k in pairs(W.secretSeen) do W.secretSeen[k] = nil end
local okc, err = pcall(function()
  W.fire("PLAYER_REGEN_DISABLED")
  W.fire("PLAYER_TOTEM_UPDATE", 3)
  tick(0.5)
end)
ok(okc, "keine Fehler mit geheimen Werten: " .. tostring(err))
ok(W.secretSeen.alpha and W.secretSeen.texture and W.secretSeen.text, "geheime Werte nur an erlaubte Anzeige-Funktionen")
ok(slots.earth.live.__alpha == "secret" and slots.earth.txt.__text == "secret", "Anzeige laeuft mit geheimen Werten")
ok(slots.earth.cd.__durobj ~= nil, "Ablauf-Ring auch im Kampf")
W.secret = false
W.fire("PLAYER_REGEN_ENABLED")
W.fire("PLAYER_TOTEM_UPDATE", 2)
tick(0.2)
ok(slots.earth.live.__alpha == 1 and slots.earth.txt.__text:match("^%d:%d%d$"), "nach dem Kampf wieder m:ss")

say("== D: Verschieben und Groesse")
W.call(slots.earth, "OnDragStart") W.call(slots.earth, "OnDragStop")
ok(U.x == 100 and U.y == 700, "Position gespeichert (" .. tostring(U.x) .. "," .. tostring(U.y) .. ")")
ok(B.__points.TOPLEFT and B.__points.TOPLEFT[1] == UIParent and B.__points.TOPLEFT[3] == 100, "Leiste an gespeicherter Stelle")
SlashCmdList.TOTEMTAKT("uhr groesse 1,5")
ok(U.scale == 1.5 and B.__scale == 1.5, "Groesse 1,5")
ok(math.abs(B.__points.TOPLEFT[3] - 100 / 1.5) < 1e-6 and math.abs(B.__points.TOPLEFT[4] - 700 / 1.5) < 1e-6, "obere linke Ecke bleibt")
SlashCmdList.TOTEMTAKT("uhr groesse 9") ok(U.scale == 2.5, "max 2,5")
SlashCmdList.TOTEMTAKT("uhr groesse 0.1") ok(U.scale == 0.5, "min 0,5")
SlashCmdList.TOTEMTAKT("uhr groesse x") ok(U.scale == 0.5 and said("/takt uhr groesse"), "ungueltig -> Hinweis")
TT.UhrScale(1)
W.call(slots.air, "OnMouseWheel", 1) ok(math.abs(U.scale - 1.05) < 1e-9, "Mausrad groesser")
W.call(B, "OnMouseWheel", -1) W.call(B, "OnMouseWheel", -1) ok(math.abs(U.scale - 0.95) < 1e-9, "Mausrad kleiner")
-- Ecke ziehen: Maus 1,5x so weit weg wie die Leiste breit ist
local grip
for _, c in ipairs(B.__children) do if c.__kind == "Button" and not c.el then grip = c end end
ok(grip ~= nil and grip.__shown, "Groessen-Ecke sichtbar")
local bw = B.__w
G.GetCursorPosition = function() return U.x + bw * 1.5, U.y - 50 end
W.call(grip, "OnMouseDown", "LeftButton") W.call(grip, "OnUpdate", 0.02) W.call(grip, "OnMouseUp", "LeftButton")
ok(math.abs(U.scale - 1.5) < 0.01, "Ecke ziehen -> 1,5 (" .. U.scale .. ")")
W.call(grip, "OnUpdate", 0.02)
G.GetCursorPosition = function() return 400, 300 end
W.call(grip, "OnUpdate", 0.02) ok(math.abs(U.scale - 1.5) < 0.01, "nach Loslassen keine Aenderung")
W.call(grip, "OnClick", "RightButton") ok(U.scale == 1, "Rechtsklick -> Groesse 1")
W.call(grip, "OnEnter") ok(GameTooltip.lines[1] == "Größe ändern", "Tooltip Ecke")
W.call(slots.earth, "OnEnter") ok(#GameTooltip.lines >= 2, "Tooltip Totem")

say("== E: fixieren, Ausrichtung, leere Plaetze, Glas")
SlashCmdList.TOTEMTAKT("uhr fest")
ok(U.lock and not grip.__shown, "fest: Ecke weg")
W.call(slots.air, "OnMouseWheel", 1) ok(U.scale == 1, "fest: Mausrad aendert nichts")
local sx = U.x
G.GetCursorPosition = function() return 1500, 100 end
W.call(grip, "OnMouseDown", "LeftButton") W.call(grip, "OnUpdate", 0.02) ok(U.scale == 1, "fest: Ecke aendert nichts")
SlashCmdList.TOTEMTAKT("uhr frei") ok(not U.lock and grip.__shown and U.x == sx, "frei")
SlashCmdList.TOTEMTAKT("uhr senkrecht")
ok(U.vert and B.__h > B.__w, "senkrecht")
ok(x("earth") == x("fire") and y("earth") > y("air") and y("water") > y("fire"), "senkrecht: von oben nach unten")
ok(#L.problems(B) == 0, "Layout senkrecht: " .. table.concat(L.problems(B), " | "))
if OUT then L.dump(B, OUT .. "/uhr_2_senkrecht.tsv") end
SlashCmdList.TOTEMTAKT("uhr waagerecht") ok(not U.vert and B.__w > B.__h, "waagerecht")
SlashCmdList.TOTEMTAKT("uhr leer") ok(U.leer == 0 and slots.water.base.__alpha == 0, "leere Plaetze ausgeblendet")
SlashCmdList.TOTEMTAKT("uhr leer") ok(U.leer == 0.25 and slots.water.base.__alpha == 0.25, "leere Plaetze blass")
SlashCmdList.TOTEMTAKT("uhr glas") ok(U.glas == false, "Glas aus")
if OUT then L.dump(B, OUT .. "/uhr_3_ohne_glas.tsv") end
SlashCmdList.TOTEMTAKT("uhr glas") ok(U.glas == true, "Glas an")
SlashCmdList.TOTEMTAKT("uhr reset") ok(U.x == nil and U.scale == 1 and B.__points.CENTER, "reset")
SlashCmdList.TOTEMTAKT("uhr") ok(U.on == false and not B.__shown, "aus")
SlashCmdList.TOTEMTAKT("uhr") ok(U.on == true and B.__shown, "an")
W.prints = {} SlashCmdList.TOTEMTAKT("uhr hilfe") ok(said("/takt uhr fest"), "Hilfe")
W.prints = {} SlashCmdList.TOTEMTAKT("hilfe") ok(said("/takt uhr"), "Hinweis in /takt-Hilfe")

say("== F: Reihenfolge aus TotemTakt folgt")
TotemTaktDB.order = { "fire", "earth", "water", "air" }
tick(0.6)
ok(x("fire") < x("earth") and x("earth") < x("water") and x("water") < x("air"), "neue Reihenfolge uebernommen")

say("== G: ohne GetTotemDuration (Ersatz SetCooldown)")
local keep = G.GetTotemDuration
G.GetTotemDuration = nil
slots.earth.cd.__durobj = nil
W.fire("PLAYER_TOTEM_UPDATE", 2)
ok(slots.earth.cd.__cd and slots.earth.cd.__cd[2] == 300, "SetCooldown mit Klarwerten")
ok(slots.water.cd.__cd == nil, "leerer Platz ohne Ring")
G.GetTotemDuration = keep

say("== H: Neu laden mit gespeicherten Werten / kein Schamane")
ok(#W.errors == 0, "keine Lua-Fehler: " .. table.concat(W.errors, "\n"))
for k in pairs(W.registered) do W.registered[k] = nil end
G.TotemTaktUhr = nil
G.TotemTaktDB = { uhr = { on = true, scale = 7, x = 300, y = 500, lock = true, vert = true, leer = "quatsch" } }
dofile("TotemTakt.lua") dofile("Uhr.lua")
W.fire("ADDON_LOADED", "TotemTakt") W.fire("PLAYER_LOGIN")
local U2 = TotemTaktDB.uhr
ok(U2.scale == 2.5 and U2.leer == 0.25 and U2.glas == true, "kaputte Werte repariert/ergaenzt")
ok(G.TotemTaktUhr.__scale == 2.5 and G.TotemTaktUhr.__points.TOPLEFT[3] == 120, "gespeicherte Stelle + Groesse")
for k in pairs(W.registered) do W.registered[k] = nil end
G.TotemTaktUhr, G.TotemTaktDB = nil, nil
W.class = "WARLOCK"
dofile("TotemTakt.lua") dofile("Uhr.lua")
W.fire("ADDON_LOADED", "TotemTakt") W.fire("PLAYER_LOGIN")
ok(G.TotemTaktUhr == nil, "Hexer: keine Uhr")
ok(W.registered.PLAYER_TOTEM_UPDATE == nil, "Hexer: keine Totem-Ereignisse")

say(string.format("%d Pruefungen, %d Fehler", n, fails))
if fails > 0 then os.exit(1) end
say("UHR TESTS OK")
