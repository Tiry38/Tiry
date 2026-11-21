-- KampfWerk: Daten. Ansichten (Schaden, Heilung, Kicks, Aggro ...), Kampf-Abschnitte und das Auslesen von
-- C_DamageMeter. Geheime Werte (im Kampf) werden nie gerechnet/verglichen, nur in Zeilen-Felder gelegt und spaeter
-- an SetText / StatusBar:SetValue / AbbreviateLargeNumbers durchgereicht.
local _, ns = ...
local Data = {}
ns.Data = Data
local secret = ns.IsSecret

local function MT(name, fallback)
  local e = Enum and Enum.DamageMeterType
  return e and e[name] or fallback
end
local function ST(name, fallback)
  local e = Enum and Enum.DamageMeterSessionType
  return e and e[name] or fallback
end

-- sub = "ps": zweite Zahl ist "pro Sekunde"; primaryPS: Hauptzahl ist "pro Sekunde"
Data.VIEWS = {
  { key = "damage", label = "Verursachter Schaden", short = "Schaden", mtype = MT("DamageDone", 0), sub = "ps" },
  { key = "dps", label = "Schaden pro Sekunde", short = "DPS", mtype = MT("Dps", 1), primaryPS = true },
  { key = "heal", label = "Gewirkte Heilung", short = "Heilung", mtype = MT("HealingDone", 2), sub = "ps" },
  { key = "hps", label = "Heilung pro Sekunde", short = "HPS", mtype = MT("Hps", 3), primaryPS = true },
  { key = "absorb", label = "Absorbiert", short = "Absorbs", mtype = MT("Absorbs", 4), sub = "ps" },
  { key = "kicks", label = "Unterbrechungen (Kicks)", short = "Kicks", mtype = MT("Interrupts", 5) },
  { key = "dispels", label = "Reinigungen", short = "Dispels", mtype = MT("Dispels", 6) },
  { key = "taken", label = "Erlittener Schaden", short = "Erlitten", mtype = MT("DamageTaken", 7), sub = "ps" },
  { key = "avoidable", label = "Vermeidbarer Schaden", short = "Vermeidbar", mtype = MT("AvoidableDamageTaken", 8) },
  { key = "deaths", label = "Tode", short = "Tode", mtype = MT("Deaths", 9), deaths = true },
  { key = "enemy", label = "Schaden an Gegnern", short = "Gegner", mtype = MT("EnemyDamageTaken", 10), sub = "ps" },
  { key = "threat", label = "Aggro (Bedrohung)", short = "Aggro", threat = true },
}
Data.VIEW = {}
for _, v in ipairs(Data.VIEWS) do Data.VIEW[v.key] = v end

----------------------------------------------------------------------------
-- Zahlen als Text (geheim -> Blizzard-Kuerzel, das geheime Werte annimmt)
----------------------------------------------------------------------------
local function short(n)
  if AbbreviateLargeNumbers then return AbbreviateLargeNumbers(n) end
  if n >= 1e6 then return string.format("%.1fM", n / 1e6) elseif n >= 1e4 then return string.format("%.1fK", n / 1e3) end
  return tostring(math.floor(n + 0.5))
end
function Data.Num(n)
  if n == nil then return "" end
  if secret(n) then return short(n) end
  if ns.DB and ns.DB.look.numbers == "voll" and BreakUpLargeNumbers then return BreakUpLargeNumbers(math.floor(n + 0.5)) end
  return short(n)
end

function Data.Clock(sec)
  if sec == nil or secret(sec) then return nil end
  sec = math.max(0, math.floor(sec))
  return string.format("%d:%02d", math.floor(sec / 60), sec % 60)
end

----------------------------------------------------------------------------
-- Verfuegbarkeit, Abschnitte
----------------------------------------------------------------------------
function Data.Available()
  local DM = C_DamageMeter
  if not DM or not DM.GetCombatSessionFromType then return false, "Blizzards Kampfdaten fehlen in diesem Spiel." end
  if DM.IsDamageMeterAvailable then
    local ok, reason = DM.IsDamageMeterAvailable()
    if not ok then return false, (type(reason) == "string" and reason ~= "") and reason or "Kampfdaten gerade nicht verfuegbar." end
  end
  return true
end

-- Liste fuer die Abschnitt-Auswahl: Aktuell, Gesamt, dann die letzten Kaempfe (neueste zuerst)
function Data.Sessions()
  local out = { { value = "current", label = "Aktueller Kampf" }, { value = "overall", label = "Gesamt" } }
  local DM = C_DamageMeter
  local list = DM and DM.GetAvailableCombatSessions and DM.GetAvailableCombatSessions() or {}
  for i = #list, math.max(1, #list - 11), -1 do
    local s = list[i]
    if s and s.sessionID and not secret(s.sessionID) then
      local name = (not secret(s.name) and s.name and s.name ~= "") and s.name or ("Kampf " .. i)
      local clock = Data.Clock(s.durationSeconds)
      out[#out + 1] = { value = "id:" .. s.sessionID, label = name .. (clock and ("  " .. clock) or "") }
    end
  end
  return out
end

function Data.SessionLabel(session)
  if session == "overall" then return "Gesamt" end
  if session == "current" or session == nil then return "Aktuell" end
  for _, s in ipairs(Data.Sessions()) do if s.value == session then return (s.label:gsub("%s+%d+:%d%d$", "")) end end
  return "Kampf"
end

local function fetch(session, mtype)
  local DM = C_DamageMeter
  if session == "overall" then return DM.GetCombatSessionFromType(ST("Overall", 0), mtype) end
  local id = type(session) == "string" and tonumber(session:match("^id:(%d+)$"))
  if id then return DM.GetCombatSessionFromID(id, mtype) end
  return DM.GetCombatSessionFromType(ST("Current", 1), mtype)
end

----------------------------------------------------------------------------
-- Eine Ansicht lesen -> { rows = {...}, secret = bool, max, duration, empty }
-- Zeile: name, class, isSelf, bar (Wert fuer den Balken), barMax, valueText, subText, unit, pctText
----------------------------------------------------------------------------
local function sourceRows(view, session)
  local ok, why = Data.Available()
  if not ok then return { rows = {}, empty = why } end
  local cs = fetch(session, view.mtype)
  local res = { rows = {} }
  if not cs then return res end
  local list = cs.combatSources or {}
  local max, total = cs.maxAmount, cs.totalAmount
  res.secret = secret(total) or secret(max)
  res.duration = cs.durationSeconds
  for i, s in ipairs(list) do
    local r = { index = i, name = s.name, class = s.classFilename, isSelf = s.isLocalPlayer == true,
                guid = s.sourceGUID, creature = s.sourceCreatureID }
    local value, ps = s.totalAmount, s.amountPerSecond
    if secret(value) or secret(ps) then res.secret = true end
    r.bar, r.barMax = value, max
    if view.deaths then
      r.bar, r.barMax = 1, 1
      r.valueText = Data.Clock(s.deathTimeSeconds) or ""
    elseif view.primaryPS then
      r.valueText = Data.Num(ps)
      r.subText = Data.Num(value)
    else
      r.valueText = Data.Num(value)
      if view.sub == "ps" then r.subText, r.unit = Data.Num(ps), "/s" end
    end
    -- Prozent nur ohne Geheimwerte (ausserhalb des Kampfes)
    if not view.deaths and not secret(value) and not secret(total) and type(value) == "number" and type(total) == "number" and total > 0 then
      r.pctText = string.format("%d%%", math.floor(value / total * 100 + 0.5))
    end
    res.rows[i] = r
  end
  return res
end

----------------------------------------------------------------------------
-- Aggro auf dein aktuelles Ziel (Gruppe/Schlachtzug + Begleiter)
----------------------------------------------------------------------------
local threatOrder = {}   -- letzte gueltige Reihenfolge (fuer den Kampf, wenn die Werte geheim sind)
local function groupUnits()
  local u = { "player" }
  if UnitExists and UnitExists("pet") then u[#u + 1] = "pet" end
  if IsInRaid and IsInRaid() then
    u = {}
    for i = 1, (GetNumGroupMembers and GetNumGroupMembers() or 0) do u[#u + 1] = "raid" .. i end
  elseif IsInGroup and IsInGroup() then
    for i = 1, 4 do u[#u + 1] = "party" .. i end
  end
  return u
end

local function threatRows()
  local res = { rows = {} }
  if not UnitExists or not UnitExists("target") then res.empty = "Kein Ziel - Aggro gilt fuer dein aktuelles Ziel." return res end
  if not UnitDetailedThreatSituation then res.empty = "Aggro-Daten fehlen in diesem Spiel." return res end
  local list = {}
  for _, unit in ipairs(groupUnits()) do
    if UnitExists(unit) then
      local n = select("#", UnitDetailedThreatSituation(unit, "target"))
      if n > 0 then
        local tanking, _, scaled, _, raw = UnitDetailedThreatSituation(unit, "target")
        local cls = UnitClass and select(2, UnitClass(unit))
        if secret(cls) then cls = nil end
        local r = { uid = unit, name = UnitName and UnitName(unit), class = cls, isSelf = unit == "player",
                    bar = scaled, barMax = 100, tanking = tanking, raw = raw }
        if secret(scaled) then
          res.secret = true
          r.valueText = AbbreviateNumbers and AbbreviateNumbers(scaled) or Data.Num(scaled)
          r.unit = "%"
        elseif type(scaled) == "number" then
          r.valueText = string.format("%d%%", math.floor(scaled + 0.5))
          if not secret(raw) and type(raw) == "number" then r.subText = Data.Num(raw / 100) end
        else
          r.valueText = ""
        end
        list[#list + 1] = r
      end
    end
  end
  if not res.secret then
    table.sort(list, function(a, b) return (a.bar or 0) > (b.bar or 0) end)
    wipe(threatOrder)
    for i, r in ipairs(list) do threatOrder[r.uid] = i end
  else
    -- Werte geheim: letzte bekannte Reihenfolge beibehalten (nicht vergleichen!)
    table.sort(list, function(a, b) return (threatOrder[a.uid] or 99) < (threatOrder[b.uid] or 99) end)
  end
  for i, r in ipairs(list) do r.index = i end
  res.rows = list
  if #list == 0 then res.empty = "Niemand hat Aggro auf dein Ziel." end
  return res
end

function Data.Get(viewKey, session)
  local view = Data.VIEW[viewKey] or Data.VIEWS[1]
  if view.threat then return threatRows() end
  return sourceRows(view, session)
end

----------------------------------------------------------------------------
-- Zauber eines Spielers (Tooltip) - nur ohne Geheimwerte
----------------------------------------------------------------------------
function Data.Spells(viewKey, session, row)
  local view = Data.VIEW[viewKey]
  local DM = C_DamageMeter
  if not view or view.threat or not DM or not row then return nil end
  if secret(row.guid) or secret(row.creature) then return nil end
  local src
  local id = type(session) == "string" and tonumber(session:match("^id:(%d+)$"))
  if id and DM.GetCombatSessionSourceFromID then
    src = DM.GetCombatSessionSourceFromID(id, view.mtype, row.guid, row.creature)
  elseif DM.GetCombatSessionSourceFromType then
    src = DM.GetCombatSessionSourceFromType(session == "overall" and ST("Overall", 0) or ST("Current", 1), view.mtype, row.guid, row.creature)
  end
  if not src or secret(src.totalAmount) then return nil end
  local out, total = {}, src.totalAmount or 0
  for _, sp in ipairs(src.combatSpells or {}) do
    if secret(sp.totalAmount) or secret(sp.spellID) then return nil end
    local name = C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(sp.spellID) or ("Zauber " .. tostring(sp.spellID))
    if sp.creatureName and not secret(sp.creatureName) and sp.creatureName ~= "" then name = name .. " (" .. sp.creatureName .. ")" end
    out[#out + 1] = { name = name, amount = sp.totalAmount or 0, pct = total > 0 and (sp.totalAmount or 0) / total * 100 or 0 }
  end
  table.sort(out, function(a, b) return a.amount > b.amount end)
  return out, total
end

----------------------------------------------------------------------------
-- Zuruecksetzen + Aktualisierung
----------------------------------------------------------------------------
function Data.Reset()
  if C_DamageMeter and C_DamageMeter.ResetAllCombatSessions then
    C_DamageMeter.ResetAllCombatSessions()
    ns.Print("Kampfdaten geleert.")
  end
  Data.dirty = true
  if ns.Meter then ns.Meter.Refresh(true) end
end

-- Kampf-Uhr fuer den aktuellen Abschnitt (eigene Zeit, nie geheim)
Data.combatStart = nil
ns.On("PLAYER_REGEN_DISABLED", function() Data.combatStart = GetTime() Data.combatEnd = nil Data.dirty = true end)
ns.On("PLAYER_REGEN_ENABLED", function() Data.combatEnd = GetTime() Data.dirty = true end)
function Data.CombatClock()
  if not Data.combatStart then return nil end
  return Data.Clock((Data.combatEnd or GetTime()) - Data.combatStart)
end

for _, ev in ipairs({ "DAMAGE_METER_COMBAT_SESSION_UPDATED", "DAMAGE_METER_CURRENT_SESSION_UPDATED", "DAMAGE_METER_RESET",
  "UNIT_THREAT_LIST_UPDATE", "UNIT_THREAT_SITUATION_UPDATE", "PLAYER_TARGET_CHANGED", "GROUP_ROSTER_UPDATE" }) do
  ns.On(ev, function() Data.dirty = true end)
end
