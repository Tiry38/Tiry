-- LevelPilot 5: kompletter Durchlauf beider echten Routen (Schritt für Schritt bis zum Ende) +
-- Einstiegs-Probe an JEDEM Schritt (Neu-Login ohne gespeicherten Zeiger: findet der Plan deinen Platz?).
-- Geografie nachgestellt: jeder Hub (Gebiet · Hub) hat einen festen Ort – mehrfach besuchte Hubs (z. B. Camp Taurajo)
-- liegen am SELBEN Ort, genau der schwierige Fall für den Einstieg. Questziele liegen ~600 yd vor dem Hub.
-- Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/playthrough.lua   (meldet "PLAYTHROUGH OK", Exit 0)
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
CLASSID = 7
function UnitClass() return "Klasse", "X", CLASSID end
bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
local PX, PY = 0.5, 0.5
C_Map = { GetBestMapForUnit = function() return 9999 end, GetPlayerMapPosition = function() return { x = PX, y = PY } end,
  GetMapWorldSize = function() return 30000, 30000 end, GetMapInfo = function() return { parentMapID = 0 } end,
  GetWorldPosFromMapPos = function(m, v) return 1, v end, GetMapPosFromWorldPos = function(c, v, m) return m, v end }
CreateVector2D = function(x, y) return { x = x, y = y } end
local LOG, READY, DONE = {}, {}, {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function() return nil end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, GetInfo = function() return nil end,
  GetNumQuestLogEntries = function() return 0, 0 end, GetQuestObjectives = function() return {} end,
  ReadyForTurnIn = function(id) return READY[id] or false end, IsQuestFlaggedCompleted = function(id) return DONE[id] or false end,
  GetMaxNumQuestsCanAccept = function() return 25 end }
local LOGORDER = {}
C_QuestLog.GetNumQuestLogEntries = function() local n = 0 for _ in pairs(LOG) do n = n + 1 end return n, n end
C_QuestLog.GetInfo = function(i)
  local q = LOGORDER[i]
  return q and { questID = q, title = "Quest " .. q, level = QLVL and QLVL[q], isHeader = false } or nil
end
local function syncLog() LOGORDER = {} for q in pairs(LOG) do LOGORDER[#LOGORDER + 1] = q end table.sort(LOGORDER) end
dofile("Route.lua") dofile("Routes/Horde_22_30.lua") dofile("Routes/Horde_30_40.lua")
local R = LP_Route
local fails = 0
local function check(name, c) print((c and "  ok   " or "  FEHLER ") .. name) if not c then fails = fails + 1 end end

-- Geografie: Hub-Orte im Raster (je ~3000 yd auseinander), Questziele 600 yd daneben
local HUB, nHub = {}, 0
local function hubPos(route, seg)
  local sd = route.segs[seg]
  local key = sd.z .. "|" .. sd.hub
  if not HUB[key] then
    nHub = nHub + 1
    HUB[key] = { x = 0.1 + ((nHub - 1) % 8) * 0.1, y = 0.1 + math.floor((nHub - 1) / 8) * 0.1 }
  end
  return HUB[key]
end
local function target(route, s)
  local h = hubPos(route, s.seg)
  if s.t == "complete" or s.t == "grind" then
    local a = ((s.q or 7) * 2.399) % (2 * math.pi)
    return { map = 9999, x = h.x + 0.02 * math.cos(a), y = h.y + 0.02 * math.sin(a) }
  end
  local j = ((s.q or s.npc or 3) % 7) * 0.0003
  return { map = 9999, x = h.x + j, y = h.y - j }
end

local function runRoute(key, lag)
  lag = lag or 0
  local route = LevelPilot_Routes[key]
  local steps = route.steps
  local N = #steps
  local origT = R.StepTarget
  R.StepTarget = function(s) return target(route, s) end
  LOG, READY, DONE = {}, {}, {}
  -- Vorquests vor Routenbeginn gelten als erledigt (wer die Route faehrt, hat sie)
  local inRoute = {}
  for _, s in ipairs(steps) do if s.q then inRoute[s.q] = true end end
  for _, s in ipairs(steps) do
    for _, p in ipairs(s.pre or {}) do if not inRoute[p] then DONE[p] = true end end
    for _, p in ipairs(s.pres or {}) do if not inRoute[p] then DONE[p] = true end end
  end
  QLVL = {}
  for _, st in ipairs(steps) do if st.q and st.ql then QLVL[st.q] = st.ql end end
  local advN, advBad, advWorst, advMax = 0, 0, nil, 0
  R.mem = { acc = {}, done = {}, at = {} }
  R.ScanLog(true)
  local lvl = math.max(route.min or 1, steps[1].l or 1)
  local plan, skipped = {}, {}
  local cur, prevPos
  local iters, last, same, stuck = 0, nil, 0, false
  local entryErr, entryN, entryBad, entryWorst = {}, 0, 0, nil
  local tPlan, nPlan, tMax = 0, 0, 0
  local done = { accept = 0, complete = 0, turnin = 0, other = 0 }
  while true do
    iters = iters + 1
    if iters > 4 * N then stuck = true break end
    local c0 = os.clock()
    local hero, list, info = R.Plan(route, lvl, skipped, plan, 6, cur)
    local dt = os.clock() - c0
    tPlan, nPlan, tMax = tPlan + dt, nPlan + 1, math.max(tMax, dt)
    if not hero then break end
    if hero == last then same = same + 1 else same = 0 end
    if same > 3 then stuck = true print("    haengt an Schritt " .. hero .. " " .. R.StepKey(steps[hero]) .. " (" .. tostring(R.state[hero]) .. ")") break end
    last = hero
    cur = { i = hero, since = GetTime() }
    local s = steps[hero]
    local t = target(route, s)
    PX, PY = t.x, t.y
    -- Einstiegs-Probe: gleicher Stand, aber kein gespeicherter Zeiger und keine frischen Spuren (Login am naechsten Tag),
    -- abwechselnd am Ziel des aktuellen Schritts und dort, wo der letzte Schritt erledigt wurde (da loggt man aus)
    if s.q and (s.t == "accept" or s.t == "turnin" or s.t == "complete") then
      local memAt = R.mem.at
      R.mem.at = {}
      local probe = {}
      local hx, hy = PX, PY
      if prevPos and iters % 2 == 0 then PX, PY = prevPos.x, prevPos.y end
      local eh = R.Plan(route, lvl, skipped, probe, 6, nil)
      PX, PY = hx, hy
      R.mem.at = memAt
      local err = (eh or N + 1) - hero
      entryN = entryN + 1
      entryErr[#entryErr + 1] = err
      if err ~= 0 then
        entryBad = entryBad + 1
        if not entryWorst or math.abs(err) > math.abs(entryWorst.err) then entryWorst = { at = hero, got = eh, err = err, why = R.info and R.info.entry } end
      end
      R.Plan(route, lvl, skipped, plan, 6, cur) -- echten Stand wiederherstellen (R.state)
    end
    -- Questlog-Check: darf nie eine Quest zum Loeschen vorschlagen, die der Plan noch braucht
    if lag == 0 then
      syncLog()
      local c1 = os.clock()
      local adv = R.LogAdvice(route, key, lvl, plan.i or hero, hero, { speed = 7, xpm = route.xpm })
      advMax = math.max(advMax, os.clock() - c1)
      advN = advN + 1
      for _, a in ipairs(adv.list) do
        if a.cat == "delete" then
          advBad = advBad + 1
          advWorst = advWorst or string.format("bei Schritt %d: Quest %d „%s“", hero, a.q, a.why or "?")
        end
      end
    end
    -- Schritt ausfuehren
    prevPos = { x = PX, y = PY }
    Tm, CLOCK = Tm + 90, CLOCK + 90
    if s.t == "accept" then LOG[s.q] = true R.OnAccepted(s.q) done.accept = done.accept + 1
    elseif s.t == "complete" then READY[s.q] = true done.complete = done.complete + 1
    elseif s.t == "turnin" then LOG[s.q] = nil READY[s.q] = nil DONE[s.q] = true R.OnTurnedIn(s.q) done.turnin = done.turnin + 1
    elseif s.t == "grind" then lvl = math.max(lvl, s.to or lvl) done.other = done.other + 1
    elseif s.t == "hearth" then R.OnHearth() done.other = done.other + 1
    elseif s.t == "fly" then R.OnLanded() done.other = done.other + 1
    else done.other = done.other + 1 end
    if (s.l or 0) - lag > lvl then lvl = s.l - lag end
    R.ScanLog(true)
  end
  R.StepTarget = origT
  -- Auswertung
  local missed, skip, open = 0, 0, 0
  for i = 1, N do
    local st = R.state[i]
    if st == "missed" then missed = missed + 1 elseif st == "skip" then skip = skip + 1 elseif st == "open" or st == "later" then open = open + 1 end
  end
  print(string.format("== %s%s: %d Schritte, %d Durchläufe – angenommen %d, erledigt %d, abgegeben %d, sonst %d", key,
    lag > 0 and (" (" .. lag .. " Stufen hinter Plan)") or (CLASSID ~= 7 and " (Hexer)" or ""), N, iters, done.accept, done.complete, done.turnin, done.other))
  local sk = {}
  for i = 1, N do if R.state[i] == "skip" then sk[#sk + 1] = i .. ":" .. R.StepKey(steps[i]) end end
  if #sk > 0 then print("    übersprungen: " .. table.concat(sk, ", ", 1, math.min(#sk, 8)) .. (#sk > 8 and " …" or "")) end
  if lag > 0 then
    local m = {}
    for i = 1, N do if R.state[i] == "missed" then m[#m + 1] = i .. ":" .. R.StepKey(steps[i]) end end
    print("    verpasst (Stufe fehlte, Plan ging weiter): " .. #m .. (#m > 0 and (" – " .. table.concat(m, ", ", 1, math.min(#m, 6))) or ""))
    check(key .. " hinter Plan: läuft trotzdem bis zum Ende", not stuck and plan.k == "END")
    R.StepTarget = origT
    return
  end
  check(key .. ": Plan läuft bis zum Ende durch (hängt nirgends)", not stuck and plan.k == "END")
  check(key .. ": nichts verpasst, nichts offen geblieben (verpasst " .. missed .. ", offen " .. open .. ", übersprungen " .. skip .. ")", missed == 0 and open == 0)
  local exact, near = 0, 0
  for _, e in ipairs(entryErr) do if e == 0 then exact = exact + 1 end if e >= -3 and e <= 3 then near = near + 1 end end
  print(string.format("    Einstieg: %d Proben, exakt %d (%.0f %%), ±3 Schritte %d (%.0f %%)", entryN, exact, 100 * exact / entryN, near, 100 * near / entryN))
  if entryWorst then print(string.format("    schlimmster Fall: richtig wäre %d (%s), Einstieg %s (%s), Abstand %+d", entryWorst.at, R.StepKey(steps[entryWorst.at]),
    tostring(entryWorst.got), tostring(entryWorst.why), entryWorst.err)) end
  check(key .. ": Einstieg nie VOR deinen Stand zurück und nie mehr als 3 Schritte daneben", (function()
    for _, e in ipairs(entryErr) do if e < 0 or e > 3 then return false end end return true end)())
  print(string.format("    Questlog-Check: %d Prüfungen, %d falsche Lösch-Tipps, max %.2f ms%s", advN, advBad, 1000 * advMax,
    advWorst and (" – erster: " .. advWorst) or ""))
  check(key .. ": Questlog-Check rät nie zum Löschen einer Quest, die der Plan noch braucht", advBad == 0)
  print(string.format("    Rechenzeit R.Plan: Ø %.2f ms, max %.2f ms (%d Aufrufe)", 1000 * tPlan / nPlan, 1000 * tMax, nPlan))
  check(key .. ": R.Plan im Mittel unter 2 ms", 1000 * tPlan / nPlan < 2)
  return entryErr
end

runRoute("horde_22_30")
runRoute("horde_30_40")
runRoute("horde_22_30", 2)
runRoute("horde_30_40", 2)
CLASSID = 9
runRoute("horde_22_30")
CLASSID = 7
print(fails == 0 and "PLAYTHROUGH OK" or ("FEHLER: " .. fails))
if fails > 0 then os.exit(1) end
