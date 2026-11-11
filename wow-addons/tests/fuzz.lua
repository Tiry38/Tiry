-- LevelPilot 5: Zufalls-Stresstest der Plan-Engine auf beiden echten Routen (12 x 1500 chaotische Aktionen:
-- Plan-Schritte, wahllos Quests annehmen/abbrechen/fertig, Teleport, Stufe, Schritte ueberspringen, /lp schritt,
-- /lp einstieg, Ausloggen). Invarianten: kein Lua-Fehler, Zeiger nie von selbst rueckwaerts, Ziel immer offen und
-- nicht vor dem Zeiger, Liste ohne Doppelte/Erledigtes, Questlog-Check raet nie zum Loeschen einer Quest, deren
-- Schritt offen im Plan steht. Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/fuzz.lua   (meldet "FUZZ OK")
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


-- Zufalls-Stresstest: chaotisches Spielen, Invarianten pruefen
local function fuzz(key, seed, N)
  math.randomseed(seed)
  local route = LevelPilot_Routes[key]
  local steps = route.steps
  R.StepTarget = function(s) return target(route, s) end
  LOG, READY, DONE = {}, {}, {}
  QLVL = {}
  for _, st in ipairs(steps) do if st.q and st.ql then QLVL[st.q] = st.ql end end
  R.mem = { acc = {}, done = {}, at = {} }
  R.ScanLog(true)
  local lvl = route.min or 20
  local plan, skipped = {}, {}
  local lastPtr, worst, errs = 0, 0, 0
  local accepts = {}
  for i, s in ipairs(steps) do if s.t == "accept" then accepts[#accepts + 1] = i end end
  local manual = false
  for it = 1, N do
    local r = math.random()
    if r < 0.30 then -- Plan-Schritt ausfuehren (normaler Spieler)
      local h = plan.i and R.info and R.info.hero
      local s = h and steps[h]
      if s then
        local t = target(route, s); PX, PY = t.x, t.y
        if s.t == "accept" then LOG[s.q] = true R.OnAccepted(s.q)
        elseif s.t == "complete" then READY[s.q] = true
        elseif s.t == "turnin" then LOG[s.q] = nil READY[s.q] = nil DONE[s.q] = true R.OnTurnedIn(s.q)
        elseif s.t == "grind" then lvl = math.max(lvl, s.to or lvl)
        elseif s.t == "fly" then R.OnLanded() elseif s.t == "hearth" then R.OnHearth() end
        if (s.l or 0) > lvl then lvl = s.l end
      end
    elseif r < 0.45 then -- zufaellige Quest annehmen (Auto-Annehmen im Fenster)
      local i = accepts[math.random(#accepts)]
      local s = steps[i]
      if R.Wants(route, s.q, plan.i) or math.random() < 0.2 then
        local t = target(route, s); PX, PY = t.x, t.y
        LOG[s.q] = true R.OnAccepted(s.q)
      end
    elseif r < 0.55 then -- eine Quest im Log fertig
      for q in pairs(LOG) do if math.random() < 0.3 then READY[q] = true break end end
    elseif r < 0.62 then -- Quest abbrechen
      for q in pairs(LOG) do if math.random() < 0.3 then LOG[q] = nil READY[q] = nil R.ScanLog(false) R.OnRemoved(q) break end end
    elseif r < 0.70 then -- teleport (Ruhestein/Flug) an einen zufaelligen Hub
      local s = steps[math.random(#steps)]
      local t = target(route, s); PX, PY = t.x, t.y
    elseif r < 0.75 then lvl = math.min(60, lvl + 1)
    elseif r < 0.78 then -- Schritt ueberspringen
      local h = R.info and R.info.hero
      if h then skipped[R.StepKey(steps[h])] = true end
    elseif r < 0.80 then -- /lp schritt X
      local n = math.random(#steps)
      plan.hist = plan.hist or {}
      plan.k, plan.i, plan.hold = R.StepKey(steps[n]), n, CLOCK + 1800
      manual = true
    elseif r < 0.82 then -- /lp einstieg
      plan.k, plan.i, plan.hold = nil, nil, nil
      manual = true
    elseif r < 0.84 then -- Ausloggen, naechster Tag
      R.mem.at = {} CLOCK = CLOCK + 86400
    end
    Tm, CLOCK = Tm + math.random(1, 30), CLOCK + 30
    R.ScanLog(true)
    local c0 = os.clock()
    local ok, hero, list, info = pcall(R.Plan, route, lvl, skipped, plan, 6, nil)
    local dt = os.clock() - c0
    worst = math.max(worst, dt)
    if not ok then errs = errs + 1 print("LUA-FEHLER: " .. tostring(hero)) break end
    -- Invarianten
    local p = plan.i or 0
    if not manual and plan.k ~= "END" and p < lastPtr then print(string.format("  Zeiger rueckwaerts %d -> %d (it %d)", lastPtr, p, it)) errs = errs + 1 end
    manual = false
    lastPtr = (plan.k == "END") and #steps + 1 or p
    if hero and R.state[hero] ~= "open" then print("  Ziel nicht offen: " .. hero .. " " .. tostring(R.state[hero])) errs = errs + 1 end
    if hero and hero < p then print("  Ziel vor dem Zeiger") errs = errs + 1 end
    local seen = {}
    for _, i in ipairs(list or {}) do
      if seen[i] then print("  doppelt in Liste " .. i) errs = errs + 1 end
      seen[i] = true
      local st = R.state[i]
      if st ~= "open" and st ~= "later" and st ~= "planned" then print("  Liste mit Zustand " .. tostring(st)) errs = errs + 1 end
      if i < p then print("  Liste vor dem Zeiger " .. i .. " < " .. p) errs = errs + 1 end
    end
    syncLog()
    local okA, adv = pcall(R.LogAdvice, route, key, lvl, p, hero, { speed = 7, xpm = route.xpm })
    if not okA then print("LUA-FEHLER LogAdvice: " .. tostring(adv)) errs = errs + 1 break end
    local ix = R.QuestIndex(route)
    for _, a in ipairs(adv.list) do
      if a.cat == "delete" and not (R.ban and R.ban[a.q]) then
        local e = ix[a.q]
        for _, k in ipairs({ e and e.cmp, e and e.tin }) do
          if k and k >= p and (R.state[k] == "open") then
            local c = e.cmp
            print(string.format("  Lösch-Tipp für Quest %d, deren Schritt %d (%s) offen im Plan ist: %s | Erledigen-Schritt %s: %s, uebersprungen=%s, Zeiger %d",
              a.q, k, steps[k].t, a.why, tostring(c), tostring(c and R.state[c]), tostring(c and skipped[R.StepKey(steps[c])]), p)) errs = errs + 1
          end
        end
      end
    end
    if errs > 8 then break end
  end
  print(string.format("== %s Seed %d: %d Aktionen, Fehler %d, R.Plan max %.2f ms, Ende Zeiger %s", key, seed, N, errs, worst * 1000, tostring(plan.k)))
  return errs
end
local total = 0
for seed = 1, 12 do
  total = total + fuzz(seed % 2 == 0 and "horde_30_40" or "horde_22_30", seed, 1500)
end
print(total == 0 and "FUZZ OK" or ("FUZZ FEHLER " .. total))
if total > 0 then os.exit(1) end
