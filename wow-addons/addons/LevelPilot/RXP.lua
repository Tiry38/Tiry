---------------------------------------------------------------------------
-- LevelPilot · RXP-Quelle (Tiry, 7.0)
-- RestedXP-Guides (Add-on RXPGuides) als Plan fuer LevelPilot: RXP arbeitet unsichtbar darunter
-- (Schritt-Pruefung, Auto-Annehmen, Wegpunkte), LevelPilot zeigt alles in seinem eigenen Fenster mit
-- Pfeil, Lichtstrahl, echten Laufwegen, Flug-Rat und Questlog-Check.
-- Nutzt nur, was RXP zur Laufzeit bereitstellt (RXP.currentGuide, RXPFrame, RXP.activeWaypoints, RXP.SetStep).
-- Kein RXP-Code in diesem Add-on. Ohne RXPGuides tut diese Datei nichts.
---------------------------------------------------------------------------
LP_RXP = {}
local X = LP_RXP
local fmt = string.format
local QL = C_QuestLog

X.KEY = "rxp"
X.grind = false       -- false = Grind-Schritte (".xp 30") ueberspringen (Tiry will nicht grinden)
X.sync = true         -- Questlog-Abgleich: Spiel sagt erledigt -> Haken bei RXP setzen

local function RXP() return _G.RXP end
local function RXPF() return _G.RXPFrame end

function X.Has()
  local r = RXP()
  return type(r) == "table" and type(r.guides) == "table"
end

-- RXP-Element -> LevelPilot-Schritt-Art
local TAG = {
  accept = "accept", daily = "accept", turnin = "turnin",
  complete = "complete", collect = "complete", mob = "complete", use = "complete", unitscan = "complete",
  buy = "complete", itemcount = "complete", cast = "complete", emote = "complete",
  fly = "fly", taxi = "fly", fp = "go",
  hs = "hearth", home = "hearth", bindlocation = "hearth",
  ["goto"] = "go", zone = "go", zoneskip = "go", subzone = "go", deathskip = "go",
  train = "train", trainer = "train", skill = "train",
  xp = "grind", vendor = "note",
}
X.TAG = TAG

-- Grind-Befehl (".xp 16" = "Grinde bis Stufe 16"). NICHT gemeint: ".xp <16,1" / ".xp >16,1" = Sprungmarken.
local function IsGrind(el) return el and el.tag == "xp" and not el.skipstep and not el.textOnly end
X.IsGrind = IsGrind

---------------------------------------------------------------------------
-- Texte
---------------------------------------------------------------------------
local function Plain(s)
  return (tostring(s or ""):gsub("|T[^|]*|t", ""):gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("^%s+", ""):gsub("%s+$", ""))
end
X.Plain = Plain

-- Text eines Elements wie RXP ihn zeigt (RXPNeon installiert: deutsch), ohne Symbole/Farben
function X.Text(el)
  if not el then return nil end
  local N = _G.RXPNeon
  local s
  if N and N.ElText then
    local ok, t = pcall(N.ElText, el); if ok then s = t end
  end
  if not s then
    s = el.text
    if type(s) ~= "string" or s == "" or s == " " then return nil end
    local r = RXP()
    if r and r.ReplaceNpcIds then
      local ok, t = pcall(r.ReplaceNpcIds, s, el)
      if ok and type(t) == "string" then s = t end
    end
  end
  if type(s) ~= "string" then return nil end
  s = Plain(s:gsub("^%s*>>", ""):gsub("\\n", " "):gsub("\n", " "))
  return s ~= "" and s or nil
end

local function MapName(m)
  if not (m and C_Map and C_Map.GetMapInfo) then return nil end
  local ok, i = pcall(C_Map.GetMapInfo, m)
  return ok and i and i.name or nil
end

-- Guide-Name deutsch (RXPNeon kennt die Uebersetzung) -> Titel, Stufe a, Stufe b
function X.GuideName(g)
  local name = g and (g.name or g.displayname) or ""
  local N = _G.RXPNeon
  if N and N.T then local ok, t = pcall(N.T, name); if ok and type(t) == "string" then name = t end end
  local a, b, rest = name:match("^(%d+)%-(%d+)%s+(.+)$")
  return rest or name, tonumber(a), tonumber(b)
end

---------------------------------------------------------------------------
-- Questlog-Fragen (dieselben wie RXP)
---------------------------------------------------------------------------
local function OnQuest(id)
  if QL and QL.IsOnQuest then local ok, v = pcall(QL.IsOnQuest, id); if ok then return v end end
end
local function TurnedIn(id)
  if QL and QL.IsQuestFlaggedCompleted then local ok, v = pcall(QL.IsQuestFlaggedCompleted, id); if ok then return v end end
end
X.OnQuest, X.TurnedIn = OnQuest, TurnedIn
local function QID(el) local q = el and tonumber(el.questId); return q and math.abs(q) or nil end

-- Spiel sagt: erledigt (Annehmen = im Log oder abgegeben, Abgeben = abgegeben)
local function GameDone(el)
  local id = QID(el)
  if not id then return false end
  if el.tag == "accept" or el.tag == "daily" then return (OnQuest(id) or TurnedIn(id)) and true or false end
  if el.tag == "turnin" then return TurnedIn(id) and true or false end
  return false
end
X.GameDone = GameDone

-- Offene Ziele einer Quest im Log ("Gefuellte geaetzte Phiole: 0/1"), sonst nil
local HINT = {
  [1195] = "Leere Phiole am Mondbrunnen in Eschental benutzen (RXP-Guide: 60.2, 72.9).",
}
function X.Missing(id)
  if not id or not OnQuest(id) or TurnedIn(id) then return nil end
  if not (QL and QL.GetQuestObjectives) then return nil end
  local ok, objs = pcall(QL.GetQuestObjectives, id)
  if not ok or type(objs) ~= "table" then return nil end
  local out = {}
  for _, o in ipairs(objs) do
    if type(o) == "table" and not o.finished then
      local t = o.text
      if type(t) ~= "string" or t == "" then
        t = (o.numFulfilled and o.numRequired) and fmt("%d/%d", o.numFulfilled, o.numRequired) or nil
      end
      if t then out[#out + 1] = t end
    end
  end
  if #out == 0 then return nil end
  return out, HINT[id]
end

local function QTitle(id)
  local t
  if QL and QL.GetTitleForQuestID then pcall(function() t = QL.GetTitleForQuestID(id) end) end
  if (not t or t == "") and _G.RXPNeon and _G.RXPNeon.QuestTitle then pcall(function() t = _G.RXPNeon.QuestTitle(id) end) end
  return (t and t ~= "") and t or nil
end

-- RXP markiert "Annehmen" mit Fehler-Symbol, wenn eine Vorquest fehlt (Tooltip: "Missing pre-requisites:" + Quests)
function X.PreReq(el)
  local r = RXP()
  if not (r and r.icons and r.icons.error and el and el.icon == r.icons.error) or type(el.tooltip) ~= "string" then return nil end
  local out, first = {}, true
  for line in el.tooltip:gmatch("[^\n]+") do
    if first then first = false
    else
      local id = tonumber(line:match("%((%d+)%)%s*$"))
      local name = (id and QTitle(id)) or Plain(line:gsub("%s*%(%d+%)%s*$", ""))
      if name and name ~= "" then out[#out + 1] = name end
    end
  end
  return #out > 0 and out or nil
end

-- Warum haengt dieser Schritt? { head, miss = {..}, hint } oder nil
function X.Warn(s)
  local el = s and s.el
  if not el or s.state == "done" then return nil end
  local q = QID(el)
  if el.tag == "turnin" and q and not TurnedIn(q) then
    local miss, hint = X.Missing(q)
    if miss then return { head = "ABGEBEN GEHT NOCH NICHT", miss = miss, hint = hint or "Erst erledigen, dann abgeben – RXP geht danach von selbst weiter." } end
    if not OnQuest(q) and not el.skipIfMissing and (tonumber(el.questId) or 0) >= 0 then
      return { head = "QUEST NICHT IM LOG", miss = { "Du hast diese Quest nicht (nie angenommen oder abgebrochen)." },
        hint = "Annehmen, falls noch möglich – sonst Rechtsklick: Schritt überspringen." }
    end
  elseif (el.tag == "accept" or el.tag == "daily") and q and not GameDone(el) then
    local pre = X.PreReq(el)
    if pre then return { head = "VORQUEST FEHLT", miss = pre, hint = "Erst diese Quest(s) abschließen – oder Rechtsklick: Schritt überspringen." } end
  end
  return nil
end

---------------------------------------------------------------------------
-- Guide -> LevelPilot-Route (einmal je Guide)
---------------------------------------------------------------------------
local function Goto(st)
  local best
  for _, el in ipairs(st.elements or {}) do
    if el.tag == "goto" and el.zone and el.x and el.y then
      if not el.lowPrio then return el end
      best = best or el
    end
  end
  return best
end

local function Fallback(t, el)
  if t == "fly" then return "Fliegen" .. ((el and type(el.location) == "string") and (" nach " .. el.location) or "") end
  if t == "hearth" then return (el and el.tag == "home") and "Ruhestein setzen" or "Ruhestein benutzen" end
  if t == "train" then return "Neue Zauber lernen" end
  if t == "grind" then return "EP sammeln bis Stufe " .. tostring(el and el.level or "?") end
  return nil
end

local function Build(g)
  local route = { name = "RXP", rxp = true, faction = "RXP", min = 999, max = 0, steps = {}, segs = {}, byRs = {} }
  local title, a, b = X.GuideName(g)
  route.title, route.l0, route.l1 = title, a, b
  route.name = "RXP · " .. title
  route.segs[1] = { z = title, hub = "RestedXP", l0 = a or 1, l1 = b or a or 1 }
  for i, st in ipairs(g.steps or {}) do
    local gt = Goto(st)
    local map, x, y = gt and tonumber(gt.zone), gt and gt.x and gt.x / 100, gt and gt.y and gt.y / 100
    local z = MapName(map)
    local first, notes, seen = nil, {}, {}
    local function add(t, el, q, n)
      local k = t .. ":" .. tostring(q or "")
      if q and seen[k] then return end
      seen[k] = true
      local s = { t = t, q = q, n = n, rs = i, el = el, rx = true, seg = 1, l = tonumber(st.level) or a, z = z,
        map = map, x = map and x or nil, y = map and y or nil, to = (t == "grind") and tonumber(el.level) or nil }
      route.steps[#route.steps + 1] = s
      route.byRs[i] = route.byRs[i] or {}
      table.insert(route.byRs[i], s)
      first = first or s
    end
    for _, el in ipairs(st.elements or {}) do
      local t = el.tag and TAG[el.tag]
      local q = QID(el)
      if t == "grind" then
        if IsGrind(el) and X.grind then add("grind", el, nil, Fallback("grind", el)) end
      elseif el.tag == "fp" and not el.textOnly then add("go", el, nil, X.Text(el) or "Flugpunkt holen")
      elseif t and (t == "accept" or t == "turnin") and q then add(t, el, q)
      elseif t == "complete" and q and not el.textOnly then add("complete", el, q)
      elseif t and t ~= "go" and t ~= "note" and not el.textOnly then
        add(t, el, nil, X.Text(el) or Fallback(t, el) or (t == "go" and z) or "Hinweis")
      elseif el.text and el.tag ~= "xp" then
        local txt = X.Text(el)
        if txt then notes[#notes + 1] = txt end
      end
    end
    if not first and (#notes > 0 or gt) then
      -- Schritt nur mit Weg/Hinweis: "Gehe zu" mit RXPs Text
      add(gt and "go" or "note", gt or (st.elements and st.elements[1]), nil, notes[1] or z or "Weiter")
      table.remove(notes, 1)
    end
    if first and #notes > 0 then
      local nt = table.concat(notes, " · ")
      if #nt > 140 then nt = nt:sub(1, 137) .. "…" end
      for _, s in ipairs(route.byRs[i]) do s.note = nt end
    end
  end
  return route
end

local CACHE = { g = nil, n = 0, route = nil, grind = nil }
function X.Route()
  local r = RXP()
  local g = r and r.currentGuide
  if not (g and g.steps) then CACHE.g, CACHE.route = nil, nil; return nil end
  if CACHE.g ~= g or CACHE.n ~= #g.steps or CACHE.grind ~= X.grind then
    local ok, rt = pcall(Build, g)
    CACHE.g, CACHE.n, CACHE.grind, CACHE.route = g, #g.steps, X.grind, ok and rt or nil
    if not ok and X.Debug then X.Debug(rt) end
  end
  return CACHE.route
end
function X.Reset() CACHE.g = nil end

function X.Progress()
  local r = RXP()
  local g = r and r.currentGuide
  if not g then return end
  local cur
  if r.GetGuideProgress then local ok, v = pcall(r.GetGuideProgress); if ok then cur = tonumber(v) end end
  cur = cur or tonumber(g.currentStep) or 1
  return g, cur, (g.steps and #g.steps) or 0
end

---------------------------------------------------------------------------
-- Haken-Knoepfe von RXP (klassisches Fenster): Element -> Element-Rahmen
---------------------------------------------------------------------------
local function Frames()
  local F = RXPF()
  local pool = F and F.CurrentStepFrame and F.CurrentStepFrame.framePool
  local map = {}
  for _, sf in ipairs(pool or {}) do
    local st = sf.step
    if st and sf.elements and sf.IsShown and sf:IsShown() then
      for j, el in ipairs(st.elements or {}) do
        local ef = sf.elements[j]
        if ef and ef.button then map[el] = ef end
      end
    end
  end
  return map
end

local function Checked(ef) return ef and ef.button and ef.button.GetChecked and ef.button:GetChecked() and true or false end
local function Click(ef)
  if not (ef and ef.button and ef.button.Click) or (InCombatLockdown and InCombatLockdown()) then return false end
  return pcall(ef.button.Click, ef.button)
end

---------------------------------------------------------------------------
-- Plan: Zustand je Schritt, aktuelles Ziel, Liste (gleiches Format wie LP_Route.Plan)
---------------------------------------------------------------------------
X.say = nil   -- Chat-Ausgabe (setzt LevelPilot)
local function Say(m) if X.say then X.say(m) end end

function X.Plan(n)
  local route = X.Route()
  local g, cur, total = X.Progress()
  local info = { n = route and #route.steps or 0, rxp = { cur = cur or 0, total = total or 0, guide = g } }
  if not (route and g) then return nil, nil, {}, info end
  info.rxp.title, info.rxp.l0, info.rxp.l1 = route.title, route.l0, route.l1
  local steps = route.steps
  local efs = Frames()
  local lvl = UnitLevel and UnitLevel("player") or 1
  local combat = InCombatLockdown and InCombatLockdown()
  local state = {}
  local ptr, hero
  local grindHit = nil
  -- Grind-Elemente aktiver Schritte: Haken bei RXP setzen (Tiry will nicht grinden)
  if not X.grind then
    for i, st in ipairs(g.steps) do
      if st.active then
        local other, gr = 0, {}
        for _, el in ipairs(st.elements or {}) do
          if IsGrind(el) then gr[#gr + 1] = el
          elseif not el.textOnly and TAG[el.tag] and el.tag ~= "goto" then other = other + 1 end
        end
        for _, el in ipairs(gr) do
          local ef = efs[el]
          if not combat and ef and not el.lpGrind and not el.completed and not el.skip and not Checked(ef) then
            el.lpGrind = true
            if Click(ef) then grindHit = el.level or true end
          elseif not combat and el.lpGrind and other == 0 and i == cur and not st.lpJump and RXP().SetStep then
            st.lpJump = true
            pcall(RXP().SetStep, cur + 1)
          end
        end
      end
    end
    if grindHit then
      Say((grindHit ~= true and fmt("Grind-Schritt (Stufe %s) übersprungen", tostring(grindHit)) or "Grind-Schritt übersprungen")
        .. " – |cff8a9396/lp grind an|r zeigt sie wieder.")
    end
  end
  for idx, s in ipairs(steps) do
    local st = g.steps[s.rs]
    local el = s.el
    local ef = el and efs[el]
    local rxpDone = (el and (el.completed or el.skip)) or Checked(ef)
    local gd = GameDone(el)
    local stt
    if not st then stt = "skip"
    elseif st.active then
      ptr = ptr or idx
      if rxpDone or gd then stt = "done" else stt = "open" end
      -- Abgleich: Spiel sagt erledigt, RXP noch nicht -> Haken bei RXP (wie ein Klick von dir)
      if gd and not rxpDone and X.sync and ef and not el.lpSynced and not combat then
        el.lpSynced = true; Click(ef)
      end
      if el and el.textOnly then stt = "done" end   -- Hinweis/Wegpunkt ohne Haken: RXP wartet nicht darauf
    elseif s.rs < (cur or 1) then
      stt = (st.completed or st.skip) and "done" or "skip"
    else
      if st.hidewindow or st.optional or st.completed or (el and el.textOnly and s.t == "note") then stt = "skip"
      elseif gd then stt = "done"
      else stt = "open" end
    end
    if s.t == "grind" and not X.grind then stt = "skip" end
    s.state = stt
    state[idx] = stt
    if not hero and stt == "open" and st and st.active then hero = idx end
  end
  -- alles Aktive erledigt (RXP springt gleich weiter): das Naechste zeigen
  if not hero then
    for idx, s in ipairs(steps) do
      if state[idx] == "open" and s.rs >= (cur or 1) then hero = idx; break end
    end
    if hero and ptr then info.rxp.wait = true end
  end
  ptr = ptr or hero or 1
  local list = {}
  if hero then list[1] = hero end
  for idx = ptr, #steps do
    if idx ~= hero and state[idx] == "open" then
      list[#list + 1] = idx
      if #list >= (n or 6) then break end
    end
  end
  info.ptr, info.hero = ptr, hero
  info.rxp.warn = hero and X.Warn(steps[hero]) or nil
  info.rxp.lvl = lvl
  return route, hero, list, info, state
end

---------------------------------------------------------------------------
-- Pfeil-Ziel: RXPs aktueller Wegpunkt (Wegnetz des Guides), sonst Punkt des Schritts
---------------------------------------------------------------------------
function X.Waypoint(s)
  local r = RXP()
  local g = r and r.currentGuide
  local st = g and s and g.steps[s.rs]
  if not (st and st.active) then return nil end
  local function ok(el)
    return el and el.zone and el.x and el.y and el.step == st and not el.hidden and not el.skip and not el.completed
  end
  local af = r.arrowFrame
  if af and ok(af.element) then
    return { map = tonumber(af.element.zone), x = af.element.x / 100, y = af.element.y / 100, rxp = true }
  end
  local low
  for _, el in ipairs(r.activeWaypoints or {}) do
    if ok(el) and el.arrow then
      if not el.lowPrio then return { map = tonumber(el.zone), x = el.x / 100, y = el.y / 100, rxp = true } end
      low = low or el
    end
  end
  if low then return { map = tonumber(low.zone), x = low.x / 100, y = low.y / 100, rxp = true } end
  return nil
end

---------------------------------------------------------------------------
-- Aktionen (wie Klicks des Spielers in RXPs Fenster)
---------------------------------------------------------------------------
function X.Toggle(s)
  local ef = s and s.el and Frames()[s.el]
  if not ef then return false, "erst wenn RXP den Schritt anzeigt" end
  if InCombatLockdown and InCombatLockdown() then return false, "nach dem Kampf" end
  return Click(ef)
end

-- Schritt ueberspringen: aktueller Schritt -> RXP eins weiter; anderer aktiver Schritt -> Haken setzen
function X.Skip(s)
  local r = RXP()
  local _, cur = X.Progress()
  if not (r and s and cur) then return false, "kein RXP-Guide" end
  if InCombatLockdown and InCombatLockdown() then return false, "nach dem Kampf" end
  if s.rs == cur and r.SetStep then return pcall(r.SetStep, cur + 1) end
  local st = r.currentGuide and r.currentGuide.steps[s.rs]
  if st and st.active then
    local efs, any = Frames(), false
    for _, el in ipairs(st.elements or {}) do
      local ef = efs[el]
      if ef and not el.textOnly and not el.completed and not el.skip and not Checked(ef) then Click(ef); any = true end
    end
    return any, any and nil or "nichts abzuhaken"
  end
  return false, "kommt erst später dran"
end

function X.Next()
  local r = RXP()
  local _, cur = X.Progress()
  if not (r and r.SetStep and cur) then return false end
  if InCombatLockdown and InCombatLockdown() then return false, "nach dem Kampf" end
  return pcall(r.SetStep, cur + 1)
end

function X.Menu()
  local F = RXPF()
  if F and F.DropDownMenu then return pcall(F.DropDownMenu) end
  return false
end

-- Guide fuer die eigene Stufe: Name "a-b Gebiet", a <= Stufe <= b, fuer Klasse/Fraktion aktiv (RXP prueft das),
-- bevorzugt deutsche Route, dann der Haupt-Speedrun-Guide, keine Dungeon-/Klassen-Sonderwege.
function X.Recommend(level)
  local r = RXP()
  if not (r and r.guides) then return end
  level = level or UnitLevel("player")
  local best, bestScore
  for _, g in pairs(r.guides) do
    if type(g) == "table" and type(g.name) == "string" and not g.chapter then
      local a, b = g.name:match("^(%d+)%-(%d+)%s")
      a, b = tonumber(a), tonumber(b)
      if a and b and a <= level and level <= b then
        local ok, active = true, true
        if r.IsGuideActive then ok, active = pcall(r.IsGuideActive, g) end
        local grp = type(g.group) == "string" and g.group or ""
        if ok and active and not grp:find("Dungeon") and not grp:find("Survival") then
          local score = a
          if grp:find("Route") then score = score + 300
          elseif grp:find("Forever Guide") then score = score + 200 end
          if g.name:find("AoE") or grp:find("AoE") or grp:find("Mage") then score = score - 150 end
          if level == b and b > a then score = score - 20 end
          if not bestScore or score > bestScore then best, bestScore = g, score end
        end
      end
    end
  end
  return best
end

function X.Fits(g, level)
  if not (g and type(g.name) == "string") then return false end
  local a, b = g.name:match("^(%d+)%-(%d+)%s")
  a, b = tonumber(a), tonumber(b)
  if not (a and b) then return true end
  return level >= a - 1 and level <= b + 1
end

function X.LoadRecommended()
  local r = RXP()
  local g = X.Recommend()
  if not g then return false, "kein passender RXP-Guide für Stufe " .. tostring(UnitLevel("player")) end
  if InCombatLockdown and InCombatLockdown() then return false, "nach dem Kampf" end
  if r.LoadGuideTable then pcall(r.LoadGuideTable, r, g.group, g.name)
  elseif r.LoadGuide then pcall(r.LoadGuide, r, g) end
  X.Reset()
  return true, (X.GuideName(g))
end

---------------------------------------------------------------------------
-- RXPs eigenes Fenster + Pfeil unsichtbar (NIE Hide(): RXP pausiert sonst Auto-Annehmen und Schritt-Pruefung)
---------------------------------------------------------------------------
local TINY = 0.01
local guard = {}
local function Guard(f, key, scaleOf)
  if not f or f["lpHook" .. key] then return end
  f["lpHook" .. key] = true
  hooksecurefunc(f, "SetScale", function(self, s)
    if guard[self] or not X.hidden then return end
    if s ~= TINY then guard[self] = true; self:SetScale(TINY); guard[self] = nil end
  end)
  hooksecurefunc(f, "SetAlpha", function(self, a)
    if guard[self] or not X.hidden then return end
    if a ~= 0 then guard[self] = true; self:SetAlpha(0); guard[self] = nil end
  end)
end
local function Set(f, sc, al, mouse)
  if not f then return end
  guard[f] = true
  pcall(f.SetScale, f, sc); pcall(f.SetAlpha, f, al)
  if f.EnableMouse then pcall(f.EnableMouse, f, mouse) end
  guard[f] = nil
end

X.hidden = false
function X.HideRXP(on)
  local F, r = RXPF(), RXP()
  local af = r and r.arrowFrame
  local prof = r and r.settings and r.settings.profile
  local N = _G.RXPNeon
  if on then
    X.hidden = true
    Guard(F, "F"); Guard(af, "A")
    Set(F, TINY, 0, false); Set(af, TINY, 0, false)
    -- RXPNeon (falls installiert): dessen Fenster aus, Uebersetzung bleibt
    if N and N.extern ~= "LevelPilot" then
      N.extern = "LevelPilot"
      if N.Fenster and N.Fenster.Apply then pcall(N.Fenster.Apply) end
    end
  elseif X.hidden then
    X.hidden = false
    Set(F, (prof and prof.windowScale) or 1, 1, true)
    Set(af, (prof and prof.arrowScale) or 1, 1, true)
    if N and N.extern == "LevelPilot" then
      N.extern = nil
      if N.Fenster and N.Fenster.Apply then pcall(N.Fenster.Apply) end
    end
  end
end

-- Aenderungen bei RXP -> LevelPilot rechnet neu (Flag, das LevelPilot im Takt abfragt)
X.dirty = false
function X.Hook()
  local r = RXP()
  if X.hooked or not r then return end
  X.hooked = true
  local function d() X.dirty = true end
  for _, fn in ipairs({ "SetStep", "LoadGuide" }) do
    if type(r[fn]) == "function" then pcall(hooksecurefunc, r, fn, d) end
  end
  local F = RXPF()
  local C = F and F.CurrentStepFrame
  if C and type(C.UpdateText) == "function" then pcall(hooksecurefunc, C, "UpdateText", d) end
end
