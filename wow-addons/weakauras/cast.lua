function(allstates, event, ...)
  -- Kampf-Ersatz fuer Forever (dort sind Buff-Werte im Kampf gesperrt):
  -- Ausserhalb des Kampfes Schild + seine Aura-Kennung merken. Im Kampf ueber die
  -- UNIT_AURA-Meldungen verfolgen: Kennung "geaendert" = 1 Ladung weg, "entfernt" = Schild weg.
  local env, now = aura_env, GetTime()
  local fight = InCombatLockdown() or UnitAffectingCombat("player") or event == "PLAYER_REGEN_DISABLED"
  if event == "PLAYER_REGEN_ENABLED" then fight = false end
  local function secret(v) return issecretvalue and issecretvalue(v) end
  local function ok(v) return v ~= nil and not secret(v) end
  local IDS = { [324] = true, [325] = true, [905] = true, [945] = true, [8134] = true,
                [10431] = true, [10432] = true, [25469] = true, [25472] = true }
  local NAMES = { ["Blitzschlagschild"] = true, ["Lightning Shield"] = true }
  env.s = env.s or {}
  local s = env.s

  local function isLS(id, name)
    local r = false
    pcall(function()
      if ok(id) and IDS[id] then r = true; return end
      if ok(name) and NAMES[name] then r = true; return end
      if ok(id) and not ok(name) then
        local n = (C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(id)) or (GetSpellInfo and GetSpellInfo(id))
        if ok(n) and NAMES[n] then r = true end
      end
    end)
    return r
  end

  -- Aura-Datensatz pruefen: true = Schild (Werte uebernommen), false = anderer Buff, nil = gesperrt
  local function take(d)
    local res
    pcall(function()
      if not ok(d.spellId) and not ok(d.name) then return end
      if not isLS(d.spellId, d.name) then res = false; return end
      if ok(d.auraInstanceID) then s.iid = d.auraInstanceID end
      if ok(d.expirationTime) and d.expirationTime > 0 then
        s.exp = d.expirationTime
        s.dur = (ok(d.duration) and d.duration > 0) and d.duration or 600
      elseif not s.exp or s.exp <= now then
        s.exp, s.dur = now + 600, 600
      end
      if ok(d.applications) then s.stacks = d.applications end
      res = true
    end)
    return res
  end

  local function scan()
    local unknown = false
    for i = 1, 40 do
      local d
      pcall(function()
        if C_UnitAuras.GetAuraDataByIndex then d = C_UnitAuras.GetAuraDataByIndex("player", i, "HELPFUL")
        else d = C_UnitAuras.GetBuffDataByIndex("player", i) end
      end)
      if not d then break end
      local r = take(d)
      if r == true then return true elseif r == nil then unknown = true end
    end
    -- zweite Quelle: Stand von Ausloeser 1
    local okS, states = pcall(WeakAuras.GetTriggerStateForTrigger, env.id, 1)
    if okS and type(states) == "table" then
      for _, st in pairs(states) do
        local good = false
        pcall(function()
          if st.show and ok(st.expirationTime) and st.expirationTime > now then
            s.exp = st.expirationTime
            s.dur = (ok(st.duration) and st.duration > 0) and st.duration or 600
            if ok(st.stacks) then s.stacks = st.stacks end
            good = true
          end
        end)
        if good then return true end
      end
    end
    if unknown then return nil end
    return false
  end

  local function clear() s.exp, s.iid, s.stacks = nil, nil, nil end

  if event == "UNIT_SPELLCAST_SUCCEEDED" then
    local _, _, spellID = ...
    if isLS(spellID) then
      s.exp, s.dur, s.stacks, s.castAt, s.iid = now + 600, 600, 3, now, nil
    end
  elseif event == "UNIT_AURA" then
    local _, info = ...
    local r = scan()
    if not fight then
      if r == false then clear() end
    elseif r ~= true and s.exp and type(info) == "table" then
      pcall(function()
        local fresh = s.castAt and (now - s.castAt) < 1.5
        -- neuer Schild nach Zauber im Kampf: Kennung aus "hinzugefuegt" holen
        if fresh and info.addedAuras then
          for _, a in ipairs(info.addedAuras) do
            if ok(a.auraInstanceID) then
              local ls = take(a)
              if ls == true or (ls == nil and not s.iid) then s.iid = a.auraInstanceID end
            end
          end
        end
        if s.iid and not fresh and info.removedAuraInstanceIDs then
          for _, id in ipairs(info.removedAuraInstanceIDs) do
            if id == s.iid then clear(); return end
          end
        end
        if s.iid and info.updatedAuraInstanceIDs then
          for _, id in ipairs(info.updatedAuraInstanceIDs) do
            if id == s.iid then
              local d = C_UnitAuras.GetAuraDataByAuraInstanceID and C_UnitAuras.GetAuraDataByAuraInstanceID("player", id)
              if d and ok(d.applications) then s.stacks = d.applications
              else s.stacks = math.max(1, (s.stacks or 3) - 1) end
            end
          end
        end
      end)
    end
  elseif event == "PLAYER_REGEN_DISABLED" then
    if scan() == false then clear() end
    env.dbg = (env.dbg or 0) + 1
    if env.dbg <= 3 and (not s.exp or not s.iid) then
      print("|cff4dd9ff[Blitzschlagschild]|r Kampfbeginn – Schild gemerkt: " .. (s.exp and "ja" or "nein")
        .. ", Kennung: " .. (s.iid and "ja" or "nein"))
    end
  elseif event == "PLAYER_REGEN_ENABLED" then
    if scan() == false then clear() end
  end

  if s.exp and s.exp <= now then clear() end
  if fight and s.exp then
    allstates[""] = { show = true, changed = true, autoHide = true, progressType = "timed",
      duration = s.dur or 600, expirationTime = s.exp, stacks = (s.stacks and s.stacks > 0) and s.stacks or nil }
    return true
  end
  if allstates[""] and allstates[""].show then
    allstates[""].show = false; allstates[""].changed = true
    return true
  end
  return false
end
