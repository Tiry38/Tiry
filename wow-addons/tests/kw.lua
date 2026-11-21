-- KampfWerk 1.0: Ablauf im strengen Forever-Nachbau. Geteiltes Fenster (Heilung | Schaden), Ansichten, Kampf-Sperre
-- (geheime Werte), Teiler ziehen, Teil loesen/andocken, Aggro, Einstellungen (Hintergrund, Farbthema), Zahlen-Studio.
-- Aufruf: lua5.1 tests/kw.lua [ausgabeordner]  -> Vorschau: python3 -I tools/render_pages.py <ordner>
-- Exit 0 + "KW TESTS OK" = alles gruen.
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local ROOT = HERE .. "../addons/KampfWerk/"
local W = require("wow_mock")
local L = require("layout")

W.install({ auctionator = false })
local G = _G
local fails, checks = 0, 0
local function ok(cond, msg)
  checks = checks + 1
  if not cond then fails = fails + 1 print("  FEHLER " .. msg) end
end

----------------------------------------------------------------------------
-- Umgebung: Geheimwerte, Klassenfarben, C_DamageMeter, Aggro, Namensplaketten
----------------------------------------------------------------------------
local SECRET = setmetatable({}, { __tostring = function() error("geheimer Wert wurde als Text benutzt") end,
  __concat = function() error("geheimer Wert wurde verkettet") end, __len = function() error("geheimer Wert: Laenge") end,
  __eq = function() error("geheimer Wert verglichen") end, __lt = function() error("geheimer Wert verglichen (<)") end,
  __le = function() error("geheimer Wert verglichen (<=)") end, __index = function() error("geheimer Wert indiziert") end,
  __add = function() error("geheimer Wert gerechnet") end, __sub = function() error("geheimer Wert gerechnet") end,
  __mul = function() error("geheimer Wert gerechnet") end, __div = function() error("geheimer Wert gerechnet") end })
G.issecretvalue = function(v) return rawequal(v, SECRET) end
G.STANDARD_TEXT_FONT = "Fonts\\FRIZQT__.TTF"
G.RAID_CLASS_COLORS = {
  SHAMAN = { r = 0, g = 0.44, b = 0.87 }, MAGE = { r = 0.25, g = 0.78, b = 0.92 },
  WARRIOR = { r = 0.78, g = 0.61, b = 0.43 }, PRIEST = { r = 1, g = 1, b = 1 },
}
-- Blizzards Kuerzel nehmen geheime Werte an (Doku: SecretArguments = AllowedWhenTainted) -> geheimes Ergebnis
G.AbbreviateLargeNumbers = function(n)
  if rawequal(n, SECRET) then return SECRET end
  assert(type(n) == "number", "AbbreviateLargeNumbers braucht Zahl")
  if n >= 1e6 then return string.format("%.1fM", n / 1e6) elseif n >= 1e3 then return string.format("%.1fK", n / 1e3) end
  return tostring(math.floor(n))
end
G.AbbreviateNumbers = G.AbbreviateLargeNumbers
G.BreakUpLargeNumbers = function(n) assert(type(n) == "number") return tostring(n) end
G.Enum.DamageMeterType = { DamageDone = 0, Dps = 1, HealingDone = 2, Hps = 3, Absorbs = 4, Interrupts = 5, Dispels = 6,
  DamageTaken = 7, AvoidableDamageTaken = 8, Deaths = 9, EnemyDamageTaken = 10 }
G.Enum.DamageMeterSessionType = { Overall = 0, Current = 1, Expired = 2 }

W.secretMode = false
local function S(v) if W.secretMode then return SECRET end return v end
local SOURCES = {
  [0] = { { "Grogg", "WARRIOR", 41200, 412 }, { "Tiry", "SHAMAN", 30500, 305, true }, { "Jaina", "MAGE", 22000, 220 } },
  [2] = { { "Scaara", "PRIEST", 133000, 1330 }, { "Tiry", "SHAMAN", 6000, 60, true } },
  [5] = { { "Tiry", "SHAMAN", 3, 0, true }, { "Grogg", "WARRIOR", 1, 0 } },
}
W.dmCalls = 0
local function session(t)
  W.dmCalls = W.dmCalls + 1
  local list, total, max = {}, 0, 0
  for _, s in ipairs(SOURCES[t] or {}) do
    total = total + s[3]
    max = math.max(max, s[3])
    list[#list + 1] = { name = S(s[1]), classFilename = s[2], totalAmount = S(s[3]), amountPerSecond = S(s[4]),
      isLocalPlayer = s[5] == true, sourceGUID = S("Player-1-" .. s[1]), sourceCreatureID = 0, deathTimeSeconds = S(95) }
  end
  return { combatSources = list, totalAmount = S(total), maxAmount = S(max), durationSeconds = S(100) }
end
G.C_DamageMeter = {
  IsDamageMeterAvailable = function() return true, "" end,
  GetCombatSessionFromType = function(st, t) assert(type(st) == "number" and type(t) == "number") return session(t) end,
  GetCombatSessionFromID = function(id, t) assert(type(id) == "number") return session(t) end,
  GetAvailableCombatSessions = function() return { { sessionID = 7, name = "Hogger", durationSeconds = 64 }, { sessionID = 8, name = "Ragnaros", durationSeconds = 312 } } end,
  GetCombatSessionSourceFromType = function(st, t, guid, cid)
    assert(type(guid) == "string", "Quelle braucht GUID")
    return { totalAmount = 30500, combatSpells = { { spellID = 403, totalAmount = 20000 }, { spellID = 8042, totalAmount = 10500 } } }
  end,
  ResetAllCombatSessions = function() W.resetCalled = true end,
}
G.C_Spell = { GetSpellName = function(id) assert(type(id) == "number") return id == 403 and "Blitzschlag" or "Erdschock" end }
-- Gruppe + Ziel + Aggro
W.target = true
G.UnitExists = function(u) if u == "target" then return W.target end return u == "player" or u == "party1" end
G.IsInRaid = function() return false end
G.IsInGroup = function() return true end
G.GetNumGroupMembers = function() return 2 end
G.UnitName = function(u) if u == "party1" then return S("Grogg") end return S("Tiry") end
G.UnitClass = function(u) if u == "party1" then return "Krieger", "WARRIOR" end return "Schamane", "SHAMAN" end
G.UnitDetailedThreatSituation = function(u, mob)
  assert(mob == "target")
  if u == "player" then return S(false), S(1), S(64), S(70), S(6400) end
  if u == "party1" then return S(true), S(3), S(100), S(110), S(10000) end
end
G.UnitIsUnit = function(a, b) if a == "nameplate1" and b == "target" then return true end return a == b end
G.C_CVar = { GetCVar = function(n) return W.cvars[n] end, SetCVar = function(n, v) assert(type(v) == "string") W.cvars[n] = v end }
W.cvars = { WorldTextScale = "1", floatingCombatTextCombatDamage = "1", floatingCombatTextCombatHealing = "1" }
W.plate = CreateFrame("Frame", "NamePlate1", UIParent)
G.C_NamePlate = { GetNamePlateForUnit = function(u) assert(type(u) == "string") if u == "target" or u == "nameplate1" then return W.plate end end }
-- Blizzards eigenes Meter (zum Verstecken)
local blzMeter = CreateFrame("Frame", "DamageMeter", UIParent)

----------------------------------------------------------------------------
-- Laden (TOC-Reihenfolge, gemeinsamer Namensraum wie im Spiel)
----------------------------------------------------------------------------
local tocs = {}
for _, suf in ipairs({ "", "_Forever", "_Camelot", "_Mainline" }) do
  local f = io.open(ROOT .. "KampfWerk" .. suf .. ".toc")
  ok(f ~= nil, "TOC " .. suf .. " vorhanden")
  if f then tocs[#tocs + 1] = f:read("*a") f:close() end
end
ok(#tocs == 4 and tocs[1] == tocs[2] and tocs[1] == tocs[3] and tocs[1] == tocs[4], "vier gleiche TOCs")
local TOCVER = tocs[1]:match("## Version: ([%d%.]+)")
ok(tocs[1]:find("## Interface: 16001", 1, true) and TOCVER ~= nil, "TOC: Interface 16001 + Version")

local ns = {}
for line in io.lines(ROOT .. "KampfWerk.toc") do
  if not line:match("^##") and line:match("%S") then
    local f = ROOT .. line:gsub("\\", "/"):gsub("%s+$", "")
    assert(loadfile(f))("KampfWerk", ns)
  end
end
ok(ns.VERSION == TOCVER, "Version im Code = TOC (" .. tostring(TOCVER) .. ")")
local okLoad, errLoad = pcall(function()
  W.fire("ADDON_LOADED", "KampfWerk")
  W.fire("PLAYER_LOGIN")
  W.flush()
end)
ok(okLoad, "Laden/Login: " .. tostring(errLoad))

local DB = KampfWerkDB
local M = ns.Meter
local P1, P2 = M.Panes[DB.panes[1].id], M.Panes[DB.panes[2].id]
ok(KampfWerkFrame and KampfWerkFrame:IsShown(), "grosses Fenster da")
ok(#DB.panes == 2 and DB.panes[1].view == "heal" and DB.panes[2].view == "damage", "Start: links Heilung, rechts Schaden (wie Tirys Bild)")
ok(P1.frame:GetParent() == KampfWerkFrame and P2.frame:GetParent() == KampfWerkFrame, "beide Teile im selben Fenster")
local w1, w2 = P1.frame:GetWidth(), P2.frame:GetWidth()
ok(math.abs(w1 - w2) <= 1 and w1 + w2 + 12 == KampfWerkFrame:GetWidth(), "mittig geteilt (" .. w1 .. " | " .. w2 .. ")")
local x2 = select(4, P2.frame:GetPoint(1))
ok(x2 == w1 + 12, "rechter Teil rechts vom Teiler")
ok(M.Group.dividers[1] and M.Group.dividers[1]:IsShown(), "Teiler zwischen den Teilen")

local function plain(s) return type(s) == "string" and W.strip(s) or s end
ok(plain(P1.title:GetText()) == "GEWIRKTE HEILUNG" and plain(P2.title:GetText()) == "VERURSACHTER SCHADEN", "Titel der Teile")
ok(P2.sess.text:GetText() == "AKTUELL", "Kampf-Abschnitt: Aktuell")

-- Zeilen ausserhalb des Kampfes
local r1 = P2.rows[1]
ok(r1 and r1:IsShown() and r1.name:GetText() == "Grogg" and r1.rank:GetText() == "1", "Schaden: Platz 1 Grogg")
ok(r1.value:GetText() == "41.2K" and r1.sub:GetText() == "412" and r1.unit:GetText() == "/s", "Schaden: Wert + pro Sekunde")
ok(r1.pct:GetText() == "44%", "Prozent ausserhalb des Kampfes (" .. tostring(r1.pct:GetText()) .. ")")
ok(r1.sb.__minmax[2] == 41200 and r1.sb.__value == 41200, "Balken: Wert/Max")
local c = r1.sb.__sbcolor
ok(c and math.abs(c[1] - 0.78 * 0.82) < 0.01, "Balken in Klassenfarbe (Krieger)")
ok(P1.rows[1].name:GetText() == "Scaara" and P1.rows[2].name:GetText() == "Tiry", "Heilung: Scaara vor Tiry")

----------------------------------------------------------------------------
-- Kampf: geheime Werte duerfen nur durchgereicht werden
----------------------------------------------------------------------------
W.secretMode = true
W.combat = true
W.fire("PLAYER_REGEN_DISABLED")
W.fire("DAMAGE_METER_CURRENT_SESSION_UPDATED")
local okC, errC = pcall(M.Tick)
ok(okC, "Kampf-Aktualisierung ohne Fehler: " .. tostring(errC))
ok(#ns.errors == 0, "keine Fehler mit geheimen Werten: " .. tostring(ns.errors[1]))
r1 = P2.rows[1]
ok(r1:IsShown() and r1.name.__text == "secret" and r1.value.__text == "secret", "geheimer Name/Wert per SetText durchgereicht")
ok(r1.sb.__value == "secret" and r1.sb.__minmax == "secret", "geheimer Wert direkt an den Balken")
ok(r1.pct:GetText() == "", "im Kampf kein Prozent")
ok(P2.rows[3] and P2.rows[3]:IsShown(), "alle 3 Zeilen auch im Kampf")
W.now = W.now + 75
M.Refresh(false)
ok(P2.timer:GetText() == "1:15", "Kampf-Uhr laeuft (eigene Zeit, nicht geheim)")
-- Tooltip im Kampf: kein Zugriff auf Zauber
P2.rows[1]:GetScript("OnEnter")(P2.rows[1])
ok(GameTooltip.lines[1] == "Kampf laeuft", "Tooltip im Kampf: Details spaeter")
W.secretMode = false
W.combat = false
W.fire("PLAYER_REGEN_ENABLED")
M.Tick()
ok(P2.rows[1].name:GetText() == "Grogg" and P2.rows[1].pct:GetText() == "44%", "nach dem Kampf wieder mit Prozent")
P2.rows[2]:GetScript("OnEnter")(P2.rows[2])
ok(GameTooltip.lines[1] == "Tiry" and tostring(GameTooltip.lines[2]):find("Blitzschlag"), "Tooltip nach dem Kampf: Zauber-Liste")

----------------------------------------------------------------------------
-- Eigene Zeile immer sichtbar, Scrollen
----------------------------------------------------------------------------
DB.look.barH = 40
M.Apply()
local vis = 0
for _, r in ipairs(P2.rows) do if r:IsShown() then vis = vis + 1 end end
ok(vis >= 1, "mit hohen Balken weniger Zeilen (" .. vis .. ")")
local selfShown = false
for _, r in ipairs(P2.rows) do if r:IsShown() and r.data and r.data.isSelf then selfShown = true end end
ok(selfShown, "eigene Zeile bleibt sichtbar")
DB.look.barH = 20
M.Apply()

----------------------------------------------------------------------------
-- Ansicht wechseln ueber den Titel (Auswahl-Liste)
----------------------------------------------------------------------------
P2.titleBtn:GetScript("OnClick")(P2.titleBtn)
ok(KampfWerkPicker and KampfWerkPicker:IsShown(), "Titel-Klick oeffnet die Auswahl")
local items = KampfWerkPicker.items
local nShown, kick = 0, nil
for _, b in ipairs(items) do if b:IsShown() then nShown = nShown + 1 if b.value == "kicks" then kick = b end end end
ok(nShown == 12, "12 Ansichten zur Wahl (" .. nShown .. ")")
kick:GetScript("OnClick")(kick)
ok(DB.panes[2].view == "kicks" and plain(P2.title:GetText()) == "UNTERBRECHUNGEN (KICKS)", "Ansicht: Kicks")
ok(P2.rows[1].name:GetText() == "Tiry" and P2.rows[1].value:GetText() == "3", "Kicks: Tiry 3")
ok(not KampfWerkPicker:IsShown(), "Auswahl schliesst nach Klick")
-- Kampf-Abschnitt
P2.sess:GetScript("OnClick")(P2.sess)
local hog
for _, b in ipairs(KampfWerkPicker.items) do if b:IsShown() and b.text:GetText():find("Ragnaros") then hog = b end end
ok(hog ~= nil, "frueherer Kampf (Ragnaros) waehlbar")
hog:GetScript("OnClick")(hog)
ok(DB.panes[2].session == "id:8" and P2.sess.text:GetText() == "RAGNAROS", "Abschnitt: Ragnaros")
DB.panes[2].session = "current"

-- Aggro
DB.panes[2].view = "threat"
M.Refresh(true)
ok(P2.rows[1].name:GetText() == "Grogg" and P2.rows[1].value:GetText() == "100%", "Aggro: Grogg 100% vorne")
ok(P2.rows[2].name:GetText() == "Tiry" and P2.rows[2].value:GetText() == "64%", "Aggro: Tiry 64%")
W.secretMode = true
M.Refresh(false)
ok(#ns.errors == 0, "Aggro geheim ohne Fehler: " .. tostring(ns.errors[1]))
ok(P2.rows[1].sb.__value == "secret" and P2.rows[1].unit:GetText() == "%", "Aggro geheim: Balken + %-Zeichen")
ok(P2.rows[2].data.uid == "player", "Aggro geheim: Reihenfolge eingefroren")
W.secretMode = false
W.target = false
M.Refresh(false)
ok(P2.empty:IsShown() and P2.empty:GetText():find("Kein Ziel"), "Aggro ohne Ziel: Hinweis")
W.target = true
DB.panes[2].view = "damage"
M.Refresh(true)

----------------------------------------------------------------------------
-- Teiler ziehen, Teil loesen / andocken, Reihenfolge
----------------------------------------------------------------------------
local dv = M.Group.dividers[1]
local cx = 400
G.GetCursorPosition = function() return cx, 300 end
dv:GetScript("OnMouseDown")(dv)
cx = 480
dv:GetScript("OnUpdate")(dv, 0.1)
dv:GetScript("OnMouseUp")(dv)
ok(math.abs(P1.frame:GetWidth() - (w1 + 80)) <= 1, "Teiler 80 px nach rechts: linker Teil breiter (" .. P1.frame:GetWidth() .. ")")
ok(DB.panes[1].share > DB.panes[2].share, "Breiten gespeichert")

M.ToggleDock(DB.panes[2].id)
ok(not DB.panes[2].docked and P2.frame:GetParent() == UIParent, "Teil geloest: eigenes Fenster")
ok(P2.grip:IsShown() and not P2.skin.hidden, "geloester Teil: eigener Griff + Glas")
ok(P1.frame:GetWidth() == KampfWerkFrame:GetWidth() and not M.Group.dividers[1]:IsShown(), "verbleibender Teil fuellt das Fenster")
rawset(P2.frame, "GetBottom", function() return 333 end)
P2.frame:SetSize(420, 260)
P2:StopMove()
ok(DB.panes[2].w == 420 and DB.panes[2].h == 260 and DB.panes[2].y == 333, "geloester Teil: Groesse/Lage gespeichert")
M.ToggleDock(DB.panes[2].id)
ok(DB.panes[2].docked and P2.frame:GetParent() == KampfWerkFrame and M.Group.dividers[1]:IsShown(), "wieder angedockt")
-- Reihenfolge tauschen (Schaden links, Heilung rechts)
DB.panes[1], DB.panes[2] = DB.panes[2], DB.panes[1]
M.Apply()
local xa = select(4, P2.frame:GetPoint(1))
ok(xa == 0, "Schaden jetzt links")

-- Gruppe vergroessern
rawset(KampfWerkFrame, "GetBottom", function() return 55 end)
KampfWerkFrame:SetSize(700, 240)
M.Group.grip:GetScript("OnMouseUp")(M.Group.grip)
ok(DB.frame.w == 700 and DB.frame.h == 240 and DB.frame.y == 55, "grosses Fenster: Groesse gespeichert")

-- dritter Teil per Befehl
SlashCmdList.KAMPFWERK("neu")
ok(#DB.panes == 3 and DB.panes[3].view == "kicks", "/kw neu: dritter Teil (Kicks)")
ok(M.Group.dividers[2] and M.Group.dividers[2]:IsShown(), "zwei Teiler bei drei Teilen")
table.remove(DB.panes, 3)
M.Rebuild()
ok(not M.Group.dividers[2]:IsShown(), "Teil entfernt")

-- 1.1 Aufteilung: nur ein Fenster (z. B. nur Schaden), dann wieder zwei
do
  local saved = {}
  for i, d in ipairs(DB.panes) do saved[i] = d end
  local id1, id2 = P1.data.id, P2.data.id
  local hadDamage = false
  for _, d in ipairs(DB.panes) do if d.view == "damage" then hadDamage = true end end
  SlashCmdList.KAMPFWERK("eins")
  ok(#DB.panes == 1 and (not hadDamage or DB.panes[1].view == "damage"), "/kw eins: nur ein Teil, Schaden bleibt")
  ok(DB.frame.w == 350, "ein Teil: Fenster halb so breit (" .. tostring(DB.frame.w) .. ")")
  ok(not (M.Group.dividers[1] and M.Group.dividers[1]:IsShown()), "ein Teil: kein Teiler")
  local only = M.Panes[DB.panes[1].id]
  L.reset()
  local gr, pr = L.rect(KampfWerkFrame), L.rect(only.frame)
  ok(only.frame:IsShown() and pr.r - pr.l > (gr.r - gr.l) - 30, "ein Teil fuellt das ganze Fenster")
  for _, pp in pairs(M.Panes) do if pp ~= only then ok(false, "alter Teil noch da") end end
  M.SetCount(2)
  ok(#DB.panes == 2 and DB.panes[2].view == "heal" and DB.frame.w == 700, "zwei Teile: Heilung kommt dazu, Breite zurueck")
  M.SetCount(3)
  ok(#DB.panes == 3 and DB.panes[3].view == "kicks", "drei Teile: Kicks kommt dazu")
  M.SetCount(1)
  ok(#DB.panes == 1 and DB.panes[1].view == "damage", "wieder eins: Schaden bleibt")
  for i = 1, #saved do DB.panes[i] = saved[i] end
  for i = #saved + 1, #DB.panes do DB.panes[i] = nil end
  DB.frame.w = 700
  M.Rebuild()
  P1, P2 = M.Panes[id1], M.Panes[id2]   -- (im Spiel kommen geloeschte IDs nie wieder; hier nur fuer die weiteren Pruefungen)
  ok(#DB.panes == #saved and P1 and P2, "Teile wiederhergestellt")
end

-- Zuruecksetzen, sperren, Blizzard-Meter
SlashCmdList.KAMPFWERK("reset")
ok(W.resetCalled, "/kw reset leert Blizzards Kampfdaten")
SlashCmdList.KAMPFWERK("sperren")
ok(DB.frame.locked and not M.Group.grip:IsShown(), "gesperrt: kein Griff")
SlashCmdList.KAMPFWERK("sperren")
DB.hideBlizzard = true
ns.Blizzard.Apply()
ok(not blzMeter:IsShown(), "Blizzard-Meter versteckt")
blzMeter:Show()
ok(not blzMeter:IsShown(), "Blizzard-Meter bleibt versteckt")
DB.hideBlizzard = false
ns.Blizzard.Apply()

-- Knoepfe nur bei Maus
M.Hover()
ok(P1.buttons[1]:GetAlpha() == 0, "Knoepfe ohne Maus unsichtbar")
P1.frame.__mouseOver = true
M.Hover()
ok(P1.buttons[1]:GetAlpha() == 1, "Knoepfe bei Maus sichtbar")
P1.frame.__mouseOver = false

----------------------------------------------------------------------------
-- Aussehen: Hintergrund, Farbthema
----------------------------------------------------------------------------
DB.look.bg = "arkan"
DB.look.theme = "glut"
M.Apply()
local sk = M.Group.skin
ok(sk.bg:IsShown() and sk.bg.__file:find("bg_arkan"), "Hintergrund Arkan")
ok(sk.hud.flow.colors[1][1] == 1 and sk.hud.flow.colors[1][2] == 0.86, "Farbthema Glut im fliessenden Rand")
DB.look.bg = "b_marmor"
M.Apply()
ok(sk.bg.__file == "Interface\\FrameGeneral\\UI-Background-Marble" and sk.bg.__coord, "WoW-Marmor gekachelt")
DB.look.bg = "eigen"
M.Apply()
do
  local c = sk.bg.__coord or {}
  local w, h = KampfWerkFrame:GetWidth(), KampfWerkFrame:GetHeight()
  local ok1 = sk.bg.__file:find("eigenes_bild") and c[1] == 0 and c[2] == 1 and math.abs((c[4] - c[3]) - 2 / (w / h)) < 0.001
  ok(ok1, "Eigenes Bild: volle Breite, Hoehe ausgeschnitten statt verzerrt")
  KampfWerkFrame:SetSize(200, 200)
  sk:Tile()
  c = sk.bg.__coord
  ok(math.abs(c[1] - 0.25) < 0.001 and math.abs(c[2] - 0.75) < 0.001 and c[3] == 0 and c[4] == 1, "schmales Fenster: Bildmitte (Motiv) bleibt")
  KampfWerkFrame:SetSize(w, h)
end
DB.look.bg = "glas"
DB.look.theme = "neon"
M.Apply()
ok(not sk.bg:IsShown(), "2045-Glas ohne Bild")

----------------------------------------------------------------------------
-- Zahlen-Studio
----------------------------------------------------------------------------
ok(#ns.Numbers.FONTS >= 21, "ueber 20 Schriften (" .. #ns.Numbers.FONTS .. ")")
for _, f in ipairs(ns.Numbers.FONTS) do
  if f.file and f.file:find("AddOns") then
    local fs = UIParent:CreateFontString(nil, "OVERLAY")
    local okF, e = pcall(fs.SetFont, fs, f.file, 20, "OUTLINE")
    ok(okF, "Schrift-Datei vorhanden: " .. f.label .. " " .. tostring(e))
  end
end
local N = DB.numbers
N.own = true
W.fire("UNIT_COMBAT", "target", "WOUND", "CRITICAL", SECRET, 1)
local shown
for _, ch in ipairs(UIParent.__children) do
  if ch.text and ch.prefix and ch:IsShown() then shown = ch end
end
ok(#ns.errors == 0, "Neon-Zahl mit geheimem Betrag ohne Fehler: " .. tostring(ns.errors[1]))
ok(shown and shown.text.__text == "secret", "geheimer Schaden als Zahl ueber dem Gegner")
ok(shown and shown.text.__font:find("Bangers") and shown.text.__size == 39, "Schaden: Bangers, kritisch 1,5x groesser")
local pt, rel = shown:GetPoint(1)
ok(rel == W.plate, "Zahl haengt an der Namensplakette")
local n0 = #UIParent.__children
W.fire("UNIT_COMBAT", "nameplate1", "WOUND", "", SECRET, 1)
ok(#UIParent.__children == n0, "Ziel-Plakette nicht doppelt")
W.fire("UNIT_COMBAT", "player", "HEAL", "", SECRET, 1)
local heal
for _, ch in ipairs(UIParent.__children) do if ch.prefix and ch.prefix.__text == "+" and ch:IsShown() then heal = ch end end
ok(heal and heal.text.__font:find("LilitaOne") and heal.text.__tc[2] == 1, "Heilung: eigene Schrift + gruen, mit +")
N.heal.font = "glitch"
N.heal.color = { 1, 0.24, 0.76 }
W.fire("UNIT_COMBAT", "player", "HEAL", "", SECRET, 1)
heal = nil
for _, ch in ipairs(UIParent.__children) do if ch.prefix and ch.prefix.__text == "+" and ch:IsShown() and ch.text.__font:find("Glitch") then heal = ch end end
ok(heal and heal.text.__tc[1] == 1 and heal.text.__tc[3] == 0.76, "Heilung getrennt umgestellt (Glitch, Pink)")
-- Blizzard-Zahlen: Schrift ab dem naechsten Login, Ausblenden per CVar
N.blizzFont = "neon"
W.fire("ADDON_LOADED", "KampfWerk")
ok(DAMAGE_TEXT_FONT and DAMAGE_TEXT_FONT:find("Orbitron%-Black"), "DAMAGE_TEXT_FONT = Neon 2045")
N.hideBlizzDamage, N.blizzDamageSet = true, true
ns.Numbers.ApplyBlizzard()
ok(W.cvars.floatingCombatTextCombatDamage == "0" and W.cvars.floatingCombatTextCombatHealing == "1", "Blizzard-Schadenszahlen aus, Heilung bleibt")

----------------------------------------------------------------------------
-- Einstellungen: alle Seiten ohne Layout-Probleme
----------------------------------------------------------------------------
local function check(name, root)
  L.reset()
  local probs = L.problems(root)
  for _, p in ipairs(probs) do ok(false, "[" .. name .. "] " .. p) end
  if OUT then L.dump(root, OUT .. "/" .. name .. ".tsv", { levels = true }) end
end
SlashCmdList.KAMPFWERK("")
ok(KampfWerkConfig and KampfWerkConfig:IsShown(), "/kw oeffnet die Einstellungen")
check("kw_fenster", KampfWerkConfig)
ns.Config.Show("aussehen")
check("kw_aussehen", KampfWerkConfig)
local function find(o, pred)
  if pred(o) then return o end
  for _, ch in ipairs(o.__children or {}) do local r = find(ch, pred) if r then return r end end
end
local frost = find(KampfWerkConfig, function(o) return o.item and o.item.value == "frost" and o.item.tex and L.isShown(o) end)
ok(frost ~= nil, "Hintergrund-Kachel Frost")
if frost then frost:GetScript("OnClick")(frost) end
ok(DB.look.bg == "frost", "Klick waehlt Hintergrund Frost")
local cyber = find(KampfWerkConfig, function(o) return o.item and o.item.value == "cyber" and o.item.grad and L.isShown(o) end)
if cyber then cyber:GetScript("OnClick")(cyber) end
ok(DB.look.theme == "cyber", "Klick waehlt Farbthema Cyber-Pink")
ns.Config.Show("zahlen")
check("kw_zahlen", KampfWerkConfig)
local bebas = find(KampfWerkConfig, function(o) return o.item and o.item.value == "bebas" and o.item.font and L.isShown(o) end)
if bebas then bebas:GetScript("OnClick")(bebas) end
ok(N.damage.font == "bebas", "Klick waehlt Schaden-Schrift Bebas")
ns.Config.Show("teil" .. DB.panes[1].id)
check("kw_teil", KampfWerkConfig)
local heal2 = find(KampfWerkConfig, function(o) return o.item and o.item.value == "heal" and L.isShown(o) end)
if heal2 then heal2:GetScript("OnClick")(heal2) end
ok(DB.panes[1].view == "heal", "Teil-Seite: Ansicht Heilung gewaehlt")
ns.Config.Show("fenster")

for _, e in ipairs(W.errors) do ok(false, "Fehler-Handler: " .. e) end
for _, e in ipairs(ns.errors) do ok(false, "KampfWerk-Fehler: " .. e:gsub("\n.*", "")) end

----------------------------------------------------------------------------
-- Vorschau: Meter wie auf Tirys Bild (Heilung | Schaden) + Zahlen-Studio
----------------------------------------------------------------------------
if OUT then
  KampfWerkConfig:Hide()
  DB.look.theme = "neon"
  DB.look.bg = "glas"
  DB.panes[1].view, DB.panes[2].view = "heal", "damage"
  DB.panes[1].share, DB.panes[2].share = 1, 1
  KampfWerkFrame:SetSize(640, 200)
  SOURCES[0] = { { "Grogg", "WARRIOR", 412000, 4120 }, { "Tiry", "SHAMAN", 305000, 3050, true }, { "Jaina", "MAGE", 220000, 2200 },
    { "Thrall", "SHAMAN", 188000, 1880 }, { "Anduin", "PRIEST", 90000, 900 } }
  SOURCES[2] = { { "Scaara", "PRIEST", 133000, 1330 }, { "Tiry", "SHAMAN", 61000, 610, true }, { "Thrall", "SHAMAN", 22000, 220 } }
  M.Apply()
  ns.Numbers.Clear() -- Probezahlen aus
  P1.frame.__mouseOver = true
  M.Hover()
  L.dump(UIParent, OUT .. "/kw_meter.tsv", { levels = true })
  P1.frame.__mouseOver = false
  DB.look.bg = "nacht"
  DB.look.theme = "cyber"
  M.ToggleDock(DB.panes[2].id)
  DB.panes[2].x, DB.panes[2].y = 700, 300
  M.Apply()
  L.dump(UIParent, OUT .. "/kw_meter_nordlicht.tsv", { levels = true })
  M.ToggleDock(DB.panes[2].id)
  DB.look.bg, DB.look.theme = "eigen", "arkan"
  M.Apply()
  L.dump(UIParent, OUT .. "/kw_meter_eigenes_bild.tsv", { levels = true })
  M.SetCount(1)
  M.Apply()
  L.dump(UIParent, OUT .. "/kw_meter_eins_bild.tsv", { levels = true })
  DB.look.bg, DB.look.theme = "glas", "neon"
  M.Apply()
  L.dump(UIParent, OUT .. "/kw_meter_eins.tsv", { levels = true })
end

print(string.format("KampfWerk: %d Pruefungen, %d Fehler", checks, fails))
if fails > 0 then os.exit(1) end
print("KW TESTS OK")
