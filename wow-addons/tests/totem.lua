-- TotemTakt: Simulation im strengen Forever-Nachbau. Spielt echte Tastendruecke mit /castsequence-Regeln nach
-- (Druck in der Abklingzeit = nichts passiert, Sequenz rueckt nur bei Erfolg vor, Makro-Aenderung = Neustart).
-- Aufruf aus addons/TotemTakt: lua5.1 ../../tests/totem.lua [ausgabeordner fuer Vorschau]  -> "TOTEM TESTS OK"
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
G.UnitClass = function() return "Schamane", W.class end

-- deutsche Namen (Testdaten; das Add-on liest die echten Namen aus dem Spiel)
local DE = {
  [8071] = "Totem der Steinhaut", [2484] = "Totem der Erdbindung", [5730] = "Totem der Steinklaue", [8075] = "Totem der Erdstärke",
  [8143] = "Totem des Erdstoßes", [3599] = "Totem der Verbrennung", [8181] = "Totem des Frostwiderstands", [8190] = "Totem des glühenden Magmas",
  [8227] = "Totem der Flammenzunge", [5394] = "Totem des heilenden Flusses", [8166] = "Totem der Giftreinigung", [5675] = "Totem der Manaquelle",
  [8184] = "Totem des Feuerwiderstands", [8170] = "Totem der Krankheitsreinigung", [16190] = "Totem der Manaflut", [8177] = "Totem der Erdung",
  [10595] = "Totem des Naturwiderstands", [8512] = "Totem des Windzorns", [6495] = "Totem der Wache", [15107] = "Totem der Windmauer",
  [8835] = "Totem der luftgleichen Anmut",
}
local KEYOF, NAMEOF, RANKS = {}, {}, {}
W.known = {}
G.C_Spell = {
  GetSpellName = function(id) assert(type(id) == "number") return NAMEOF[id] end,
  GetSpellTexture = function(id) assert(type(id) == "number") return 100000 + id end,
}
-- Totem-Plaetze wie im Spiel: 1 Feuer, 2 Erde, 3 Wasser, 4 Luft
local SLOT = { fire = 1, earth = 2, water = 3, air = 4 }
W.totems, W.auras = {}, {}
G.GetNumTotemSlots = function() return 4 end
local SECRET = setmetatable({}, { __tostring = function() return "secret" end })
G.issecretvalue = function(v) return v == SECRET end
G.GetTotemInfo = function(slot)
  assert(type(slot) == "number")
  if W.secret then return SECRET, SECRET, SECRET, SECRET, SECRET, SECRET, SECRET end
  local t = W.totems[slot]
  if not t or t.start + t.dur <= W.now then return false, "", 0, 0, 0, 1, nil end
  return true, t.name, t.start, t.dur, t.icon, 1, t.sid
end
G.C_UnitAuras = { GetPlayerAuraBySpellID = function(id)
  if W.combat then error("secret") end
  if W.auras[id] then return { spellId = id } end
end }
-- Makros (Charakter-Makros 121..150)
W.macros, W.edits = {}, 0
local function idxByName(name) for i, m in pairs(W.macros) do if m.name == name then return i end end return 0 end
G.GetMacroIndexByName = function(name) return idxByName(name) end
G.GetMacroBody = function(i) return W.macros[i] and (W.macros[i].body .. "\n") end
G.CreateMacro = function(name, icon, body, perChar)
  assert(not W.combat, "CreateMacro im Kampf")
  assert(type(name) == "string" and type(icon) == "number" and type(body) == "string" and perChar == true)
  assert(#body <= 255, "Makro zu lang: " .. #body)
  local cnt = 0 for i in pairs(W.macros) do if i > 120 then cnt = cnt + 1 end end
  if cnt + (W.otherMacros or 0) >= 30 then error("Zu viele Makros") end
  local i = 121 while W.macros[i] do i = i + 1 end
  W.macros[i] = { name = name, icon = icon, body = body, pos = 1 }
  return i
end
G.EditMacro = function(i, name, icon, body)
  assert(not W.combat, "EditMacro im Kampf")
  assert(W.macros[i] and name == "TotemTakt" and type(body) == "string" and #body <= 255)
  W.macros[i].body, W.macros[i].pos = body, 1   -- neuer Text = Sequenz beginnt vorne
  W.edits = W.edits + 1
end
G.PickupMacro = function(x) W.picked = x end

-- Totem-Daten aus dem Add-on holen (nach dem Laden)
dofile("TotemTakt.lua")
local TT = G.TotemTakt
W.fire("ADDON_LOADED", "TotemTakt")
local E = W.registered.PLAYER_TOTEM_UPDATE[1]

local T = {}
for _, key in ipairs({ "stoneskin", "earthbind", "stoneclaw", "strength", "tremor", "searing", "frostres", "magma", "flametongue",
  "healing", "poison", "manaspring", "fireres", "disease", "manatide", "grounding", "natureres", "windfury", "sentry", "windwall", "grace" }) do
  T[key] = true
end
-- Raenge/Buffs aus dem Add-on-Quelltext lesen, damit Test und Add-on dieselben Daten nutzen
local src = io.open("TotemTakt.lua"):read("*a")
local INFO = {}
for key, el, ranks, rest in src:gmatch("\n  (%w+)%s*= { el = \"(%w+)\",%s*lvl = %d+,%s*en = \"[^\"]+\",%s*ranks = { ([%d, ]+) }([^\n]*)") do
  local r = {} for id in ranks:gmatch("%d+") do r[#r + 1] = tonumber(id) end
  local b = {} local bs = rest:match("buffs = { ([%d, ]+) }") if bs then for id in bs:gmatch("%d+") do b[#b + 1] = tonumber(id) end end
  INFO[key] = { el = el, ranks = r, buffs = b }
  for _, id in ipairs(r) do KEYOF[id] = key; NAMEOF[id] = DE[r[1]] end
end
local cntInfo = 0 for _ in pairs(INFO) do cntInfo = cntInfo + 1 end
ok(cntInfo == 21, "21 Totems in den Daten (" .. cntInfo .. ")")
for k in pairs(T) do ok(INFO[k] and DE[INFO[k].ranks[1]], "Daten+Name fuer " .. k) end
for k, i in pairs(INFO) do ok(#i.buffs == 0 or #i.buffs == #i.ranks, "Buff je Rang: " .. k) end

local function learn(key, upto)
  local r = INFO[key].ranks
  for i = 1, math.min(upto or #r, #r) do W.known[r[i]] = true end
end
local function macro() local i = idxByName("TotemTakt") return i > 0 and W.macros[i] or nil end
local function seqNames()
  local m = macro() if not m then return {} end
  local list = m.body:match("/castsequence [^ ]+ (.*)$")
  local out = {} if list then for nm in (list .. ","):gmatch("%s*(.-),") do out[#out + 1] = nm end end
  return out
end
local BYNAME = {} for id, nm in pairs(DE) do BYNAME[nm] = KEYOF[id] end
local function seqKeys() local o = {} for i, nm in ipairs(seqNames()) do o[i] = BYNAME[nm] end return table.concat(o, ",") end
local function tick(sec)  -- Zeit vergeht, Ticker + Timer laufen
  local steps = math.max(1, math.floor(sec + 0.5))
  for _ = 1, steps do W.now = W.now + sec / steps W.call(E, "OnUpdate", sec / steps) W.flush() end
end

-- Tastendruck auf das Makro nach /castsequence-Regeln
local gcdEnd, lastPress = 0, -1e9
W.inRange = true
local function press()
  local m = macro() assert(m, "kein Makro")
  local reset = tonumber(m.body:match("reset=(%d+)"))
  if reset and W.now - lastPress >= reset then m.pos = 1 end
  lastPress = W.now
  local names = seqNames()
  if W.now < gcdEnd then return false end          -- Abklingzeit: Zauber scheitert, Sequenz bleibt stehen
  local key = BYNAME[names[m.pos]]
  if not key then return false end
  local info = INFO[key]
  local rank
  for i = #info.ranks, 1, -1 do if W.known[info.ranks[i]] then rank = i break end end
  local dur = (key == "searing") and 55 or (key == "magma" and 20 or 300)
  W.totems[SLOT[info.el]] = { name = DE[info.ranks[1]] .. " " .. ({ "", " II", " III", " IV", " V", " VI" })[rank], start = W.now, dur = dur,
    icon = 100000 + info.ranks[1], sid = (rank % 2 == 0) and info.ranks[rank] or nil, key = key }
  -- Buffs anderer Totems desselben Elements weg, eigener Buff an (in Reichweite)
  for k, i2 in pairs(INFO) do if i2.el == info.el then for _, b in ipairs(i2.buffs) do W.auras[b] = nil end end end
  if #info.buffs > 0 and W.inRange then W.auras[info.buffs[rank]] = true end
  m.pos = m.pos % #names + 1
  gcdEnd = W.now + 1
  W.fire("PLAYER_TOTEM_UPDATE", SLOT[info.el])
  W.flush()
  return key
end

---------------------------------------------------------------------------
say("== A: Laden, nichts gelernt")
ok(G.SLASH_TOTEMTAKT1 == "/takt", "Slash /takt")
W.fire("PLAYER_ENTERING_WORLD") W.flush()
ok(macro() == nil, "ohne gelerntes Totem kein Makro")
ok(TotemTaktDB.made == false, "noch nicht angelegt")

say("== B: Stufe 42 - erstes Lernen legt Makro an")
learn("stoneskin", 3) learn("strength", 3) learn("searing", 4) learn("magma", 1) learn("flametongue", 2)
learn("healing", 3) learn("manaspring", 2) learn("windfury", 1) learn("grace", 1) learn("grounding")
W.fire("SPELLS_CHANGED") W.flush()
ok(macro() ~= nil, "Makro angelegt")
ok(TotemTaktDB.made == true and TotemTaktDB.intro == true, "made + Hinweis")
ok(macro().body:find("^#showtooltip\n/castsequence reset=3/combat ") ~= nil, "Makrokopf: " .. macro().body)
ok(seqKeys() == "strength,windfury,manaspring,searing", "Standard: Erde, Luft, Wasser, Feuer -> " .. seqKeys())
local intro = 0 for _, p in ipairs(W.prints) do if p:find("Charakter%-Makros") then intro = intro + 1 end end
ok(intro == 1, "Hinweis genau einmal")

say("== C: vier Druecke stellen vier Totems, Druck in der Abklingzeit zaehlt nicht")
local placed = {}
local r = press() placed[#placed + 1] = r
ok(r == "strength", "1. Druck Erdstaerke")
ok(press() == false, "Druck in der Abklingzeit scheitert")
ok(seqKeys() == "windfury,manaspring,searing,strength", "Makro neu sortiert: fehlende zuerst -> " .. seqKeys())
tick(1.1) ok(press() == "windfury", "2. Druck Windzorn")
tick(0.3) ok(press() == false, "zu frueh")
tick(0.8) ok(press() == "manaspring", "3. Druck Manaquelle")
tick(1.1) ok(press() == "searing", "4. Druck Verbrennung")
local plan, list, readable = TT.Plan()
ok(readable, "Daten lesbar")
local allUp = true for _, e in ipairs(list) do if e.st ~= "steht" then allUp = false end end
ok(allUp, "alle vier stehen")
ok(seqKeys() == "strength,windfury,manaspring,searing", "alle frisch: zuletzt gestelltes hinten -> " .. seqKeys())
tick(1.1) ok(press() == "strength", "5. Druck erneuert das aelteste")
ok(seqKeys():sub(-8) == "strength", "frisch gestellt -> ans Ende")
tick(15) ok(seqKeys():sub(1, 7) == "searing", "nach der Schonfrist: Verbrennung (55 s) laeuft zuerst ab -> vorne")
tick(1) ok(press() == "searing", "Druck erneuert Verbrennung")
ok(seqKeys():sub(-7) == "searing", "Verbrennung danach hinten (Makrotext aendert sich -> Schritt 1)")
ok(macro().body:find("reset=3/combat") ~= nil, "ausserhalb des Kampfes kurzer Neustart")

say("== D: zu weit weg (Buff fehlt) und gleich ablaufend")
tick(20)
W.auras[INFO.manaspring.buffs[2]] = nil   -- weggelaufen: Manaquellen-Buff weg
tick(1.2)
ok(seqKeys():sub(1, 10) == "manaspring", "fehlender Buff -> vorne: " .. seqKeys())
local _, l2 = TT.Plan()
local stM for _, e in ipairs(l2) do if e.key == "manaspring" then stM = e.st end end
ok(stM == "weg", "Zustand 'zu weit weg'")
ok(press() == "manaspring", "Druck stellt Manaquelle neu")
-- Verbrennung (55 s) laeuft ab -> vorne
tick(30)
ok(seqKeys():sub(1, 7) == "searing", "bald ablaufendes Totem vorne: " .. seqKeys())
tick(12)
ok(seqKeys():sub(1, 7) == "searing", "abgelaufenes Totem vorne")
-- Totem ohne Buff gilt als stehend, solange es laeuft (keine Reichweiten-Pruefung moeglich)
tick(1) press()
local _, l3 = TT.Plan() local stS for _, e in ipairs(l3) do if e.key == "searing" then stS = e.st end end
ok(stS == "steht", "Verbrennung steht wieder")

say("== E: Kampf - Makro bleibt fest, danach neu sortiert")
W.fire("PLAYER_REGEN_DISABLED") W.flush()
ok(macro().body:find("reset=8/combat") ~= nil, "Kampfbeginn: deine Neustart-Wahl gilt")
local before = macro().body
local edits = W.edits
W.combat = true
W.totems[2] = nil                                  -- Erdtotem stirbt im Kampf
W.fire("PLAYER_TOTEM_UPDATE", 2) W.flush() tick(3)
ok(W.edits == edits and macro().body == before, "im Kampf keine Makro-Aenderung")
ok(select(3, TT.Plan()) == false, "im Kampf keine Totem-Daten")
TT.Toggle() W.flush()
ok(G.TotemTaktFrame:IsShown(), "Fenster im Kampf offen")
W.call(G.TotemTaktFrame, "OnUpdate", 1.1)
ok(G.TotemTaktFrame.hint:GetText():find("Kampf") ~= nil, "Hinweis Kampf")
W.call(G.TotemTaktFrame.big, "OnClick")
ok(W.picked == nil, "Knopf im Kampf gesperrt")
TT.Pick("fire", "magma")
ok(macro().body == before, "Auswahl im Kampf wartet")
W.combat = false
W.fire("PLAYER_REGEN_ENABLED") W.flush()
ok(seqKeys():sub(1, 8) == "strength", "nach dem Kampf: totes Erdtotem vorne -> " .. seqKeys())
ok(seqKeys():find("magma") ~= nil, "Auswahl uebernommen")
TT.Toggle()

say("== F: Auswahl, aus, Reihenfolge, feste Folge")
TT.Pick("fire", "searing")
TT.Pick("water", "off") W.flush()
ok(not seqKeys():find("manaspring"), "Wasser aus")
TT.Pick("water", "manatide") W.flush()
ok(TotemTaktDB.pick.water == "off", "nicht gelerntes Totem nicht waehlbar")
TT.Pick("water", "healing") W.flush()
ok(seqKeys():find("healing") ~= nil, "Heilender Fluss gewaehlt")
TT.Move(4, 1) W.flush()
ok(TotemTaktDB.order[1] == "fire", "Feuer nach vorne")
TotemTaktDB.smart = false
W.totems = {} W.auras = {} W.fire("PLAYER_TOTEM_UPDATE", 1) tick(1)
ok(seqKeys() == "searing,earth" or seqKeys() == "searing,strength,windfury,healing", "feste Reihenfolge: " .. seqKeys())
local fixedBody = macro().body
local e0 = W.edits
tick(1.1) press() tick(1.1) press()
ok(W.edits == e0 and macro().body == fixedBody, "feste Folge: Makro bleibt, Sequenz laeuft")
ok(macro().pos == 3, "Sequenz bei Schritt 3")
tick(9) local k = press()
ok(k == "searing", "nach 8 s Pause beginnt die Folge vorne")
TotemTaktDB.reset = 15 TT.Write(false)
ok(macro().body:find("reset=15/combat") ~= nil, "Neustart 15 s")
TotemTaktDB.reset = 0 TT.Pick("fire", "searing") W.flush()
ok(macro().body:find("reset=combat ") ~= nil, "Neustart nie -> nur Kampf")
TotemTaktDB.smart, TotemTaktDB.reset = true, 8

say("== G: Makro geloescht, Platz voll, Laenge")
for i in pairs(W.macros) do W.macros[i] = nil end
tick(2)
ok(macro() == nil, "geloeschtes Makro wird nicht still neu angelegt")
W.otherMacros = 30
SlashCmdList.TOTEMTAKT("makro")
ok(macro() == nil and W.prints[#W.prints]:find("30") ~= nil, "volle Makroplaetze -> Hinweis")
W.otherMacros = 0
TT.Toggle()
W.call(G.TotemTaktFrame.big, "OnClick")
ok(macro() ~= nil, "Knopf legt Makro an")
W.call(G.TotemTaktFrame.big, "OnClick")
ok(W.picked == "TotemTakt", "Knopf nimmt Makro auf den Cursor")
TT.Toggle()
-- laengste deutsche Kombination passt in 255 Zeichen
learn("disease") learn("frostres") learn("stoneclaw") learn("natureres") learn("magma")
W.fire("SPELLS_CHANGED") W.flush()
TT.Pick("earth", "stoneclaw") TT.Pick("fire", "magma") TT.Pick("water", "disease") TT.Pick("air", "grace")
TotemTaktDB.reset = 15 W.flush()
local longest = TT.Body((TT.Plan()), false)
ok(#longest <= 255 and longest:find("^#showtooltip") ~= nil and #macro().body <= 255, "laengstes Makro " .. #longest .. " Zeichen")
TotemTaktDB.reset = 8

say("== H: geheime Werte, kaputte Reihenfolge, Nicht-Schamane")
W.secret = true
local p4, l4, rd = TT.Plan()
ok(rd == false and #p4 == 4 and l4[1].st == "?", "geheime Totem-Daten -> feste Reihenfolge")
W.secret = false
local ok2 = pcall(SlashCmdList.TOTEMTAKT, "status")
ok(ok2 and W.prints[#W.prints]:find("Makro") ~= nil, "/takt status")

say("== I: Oberflaeche (Layout im Forever-Nachbau)")
W.fire("SPELLS_CHANGED") W.flush()
TT.Pick("earth", "strength") TT.Pick("fire", "flametongue") TT.Pick("water", "healing") TT.Pick("air", "grace") W.flush()
TT.Toggle()
local F = G.TotemTaktFrame
for _ = 1, 30 do W.call(F, "OnUpdate", 0.05) end
local function check(name)
  for _ = 1, 30 do W.call(F, "OnUpdate", 0.05) end
  local probs = L.problems(F)
  ok(#probs == 0, "Layout " .. name .. ": " .. table.concat(probs, " | "))
  if OUT then L.dump(F, OUT .. "/totem_" .. name .. ".tsv") end
end
check("1_start")
TT.Select("water") check("2_auswahl_wasser")
TT.Select("water")
-- Ziehen: Erde auf Platz 3
local earthOrb
for _, c in ipairs(F.__children) do if c.el == "earth" and c.__kind == "Button" then earthOrb = c end end
ok(earthOrb ~= nil, "Erd-Kugel gefunden")
local from for i, el in ipairs(TotemTaktDB.order) do if el == "earth" then from = i end end
W.call(earthOrb, "OnDragStart")
G.GetCursorPosition = function() return 100 + 66 + 106 * 2, 300 end
W.call(F, "OnUpdate", 0.05)
W.call(earthOrb, "OnDragStop") W.flush()
ok(TotemTaktDB.order[3] == "earth", "Ziehen sortiert um (" .. table.concat(TotemTaktDB.order, ",") .. ")")
W.call(earthOrb, "OnClick")
check("3_umsortiert")
-- Element ohne gelerntes Totem
W.known = {} learn("strength", 1) learn("searing", 1)
W.fire("SPELLS_CHANGED") W.flush()
TT.Select("air") check("4_nichts_gelernt")
TT.Select("air")
W.totems = {} W.fire("PLAYER_TOTEM_UPDATE", 1) W.flush()
TotemTaktDB.smart = false W.call(F.sw, "OnClick") W.flush()
ok(TotemTaktDB.smart == true, "Schalter")
W.call(F.seg.opt[2], "OnClick") W.flush()
ok(TotemTaktDB.reset == 15, "Segment 15 s")
check("5_optionen")
for _, b in ipairs({ F.big, F.sw, F.seg.opt[1] }) do W.call(b, "OnEnter") W.call(b, "OnLeave") end
W.call(earthOrb, "OnEnter")
ok(#GameTooltip.lines >= 1, "Tooltip")
F:Hide()

say("== J: Klassen-Schutz")
ok(#W.errors == 0, "keine Lua-Fehler: " .. table.concat(W.errors, "\n"))
-- frisch laden als Hexer
for k in pairs(W.registered) do W.registered[k] = nil end
G.TotemTaktDB, G.TotemTaktFrame = nil, nil
W.class = "WARLOCK"
dofile("TotemTakt.lua")
W.fire("ADDON_LOADED", "TotemTakt")
ok(W.registered.PLAYER_TOTEM_UPDATE == nil, "Hexer: keine Totem-Ereignisse")
SlashCmdList.TOTEMTAKT("")
ok(W.prints[#W.prints]:find("Schamanen") ~= nil, "Hexer: Hinweis")
-- kaputte gespeicherte Reihenfolge
for k in pairs(W.registered) do W.registered[k] = nil end
W.class = "SHAMAN"
G.TotemTaktDB = { order = { "fire", "fire", "luft", "water" } }
dofile("TotemTakt.lua")
W.fire("ADDON_LOADED", "TotemTakt")
ok(table.concat(TotemTaktDB.order, ",") == "fire,water,earth,air", "Reihenfolge repariert: " .. table.concat(TotemTaktDB.order, ","))
ok(TotemTaktDB.smart == true and TotemTaktDB.reset == 8, "Standardwerte ergaenzt")

say(string.format("%d Pruefungen, %d Fehler", n, fails))
if fails > 0 then os.exit(1) end
say("TOTEM TESTS OK")
