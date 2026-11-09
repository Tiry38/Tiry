function(allstates, event, ...)
  -- Blitzschlagschild im Kampf (WoW Forever sperrt dort alle Buff-Abfragen):
  -- ausserhalb des Kampfes echten Stand lesen, im Kampf Zeit weiterlaufen lassen.
  -- Aufladungen im Kampf: bis zur ersten Buff-Aenderung bekannt, danach "?".
  local env, now = aura_env, GetTime()
  env.s = env.s or {}
  local s = env.s
  local fight
  if event == "PLAYER_REGEN_DISABLED" then fight = true
  elseif event == "PLAYER_REGEN_ENABLED" then fight = false
  else fight = (InCombatLockdown() or UnitAffectingCombat("player")) and true or false end
  local function secret(v) return (issecretvalue ~= nil and issecretvalue(v)) or false end
  local function ok(v) return v ~= nil and not secret(v) end
  local NAMES = { ["Blitzschlagschild"] = true, ["Lightning Shield"] = true }
  env.ids = env.ids or { [324] = true, [325] = true, [905] = true, [945] = true, [8134] = true,
                         [10431] = true, [10432] = true, [25469] = true, [25472] = true }
  local IDS = env.ids

  -- true = Schild da (Werte uebernommen), false = sicher nicht da, nil = gesperrt/unbekannt
  local function scan()
    local res
    local fine = pcall(function()
      for i = 1, 40 do
        local d = C_UnitAuras.GetAuraDataByIndex("player", i, "HELPFUL")
        if not d then res = false; return end
        local id, name = d.spellId, d.name
        if not ok(id) and not ok(name) then res = nil; return end
        if (ok(id) and IDS[id]) or (ok(name) and NAMES[name]) then
          if ok(id) then IDS[id] = true end
          local exp, dur, st = d.expirationTime, d.duration, d.applications
          if ok(exp) and exp > 0 then
            s.exp = exp
            s.dur = (ok(dur) and dur > 0) and dur or 600
          elseif not s.exp or s.exp <= now then
            s.exp, s.dur = now + 600, 600
          end
          if ok(st) then s.stacks = st end
          res = true
          return
        end
      end
      res = false
    end)
    if not fine then return nil end
    return res
  end

  if event == "UNIT_SPELLCAST_SUCCEEDED" then
    local _, _, spellID = ...
    local hit = false
    pcall(function()
      if ok(spellID) and IDS[spellID] then hit = true; return end
      local n = C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(spellID)
      if ok(n) and NAMES[n] then hit = true end
    end)
    if hit then s.exp, s.dur, s.stacks, s.unsure, s.castAt = now + 600, 600, 3, false, now end
  end

  local showIt = false
  if not fight then
    local r = scan()
    if r ~= nil then s.scanWorks = true end
    if r == true then
      s.unsure = false; showIt = true
    elseif r == false then
      s.exp, s.stacks = nil, nil
    elseif s.scanWorks then
      showIt = true -- kurz gesperrt (direkt nach dem Kampf): alten Stand halten
    end
    if event == "PLAYER_REGEN_ENABLED" then
      pcall(function()
        C_Timer.After(0.5, function() pcall(WeakAuras.ScanEvents, "TIRY_LS_NEU") end)
        C_Timer.After(2, function() pcall(WeakAuras.ScanEvents, "TIRY_LS_NEU") end)
      end)
    end
  else
    if event == "PLAYER_REGEN_DISABLED" then
      if scan() == false then s.exp, s.stacks = nil, nil end
      s.unsure = false
    elseif event == "UNIT_AURA" then
      if not (s.castAt and now - s.castAt < 0.6) then s.unsure = true end
    end
    showIt = true
  end

  if showIt and s.exp and s.exp > now then
    allstates[""] = {
      show = true, changed = true, autoHide = true, progressType = "timed",
      duration = s.dur or 600, expirationTime = s.exp,
      stacks = (not s.unsure and s.stacks and s.stacks > 0) and s.stacks or nil,
      unsure = s.unsure and true or false,
    }
    return true
  end
  if allstates[""] and allstates[""].show then
    allstates[""].show = false
    allstates[""].changed = true
    return true
  end
  return false
end
