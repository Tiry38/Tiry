return function(allstates, event, unit, castGUID, spellID)
  -- Blitzschlagschild, auch im Kampf (Forever sperrt dort Aura-Werte):
  -- 1) Buff lesen, wenn erlaubt  2) eigener Zauber = Schild neu (10 Min, 3 Ladungen)
  local env = aura_env
  env.st = env.st or { exp = 0, dur = 0, stacks = 0 }
  local st, now = env.st, GetTime()
  local function secret(v) return issecretvalue and issecretvalue(v) end
  local NAMES = { ["Blitzschlagschild"] = true, ["Lightning Shield"] = true }
  local IDS = { [324] = true, [325] = true, [905] = true, [945] = true, [8134] = true,
                [10431] = true, [10432] = true, [25469] = true, [25472] = true }
  local function scan()
    for i = 1, 40 do
      local d = C_UnitAuras.GetBuffDataByIndex("player", i)
      if not d then return false end
      if secret(d.name) or secret(d.spellId) then return nil end
      if NAMES[d.name] or IDS[d.spellId] then
        if secret(d.applications) or secret(d.expirationTime) then return nil end
        return true, d.applications or 0, d.expirationTime or 0, d.duration or 0
      end
    end
    return false
  end
  local ok, found, stacks, exp, dur = pcall(scan)
  local fight = InCombatLockdown() or UnitAffectingCombat("player")
  if ok and found == true then
    if not exp or exp <= 0 then exp, dur = now + 600, 600 end
    st.exp, st.dur, st.stacks = exp, dur, stacks or 0
  elseif ok and found == false and not fight then
    st.exp, st.dur, st.stacks = 0, 0, 0
  end
  if event == "UNIT_SPELLCAST_SUCCEEDED" then
    local hit = false
    pcall(function()
      if secret(spellID) then return end
      if IDS[spellID] then hit = true; return end
      local n = C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(spellID)
      if n and not secret(n) and NAMES[n] then hit = true end
    end)
    if hit then st.exp, st.dur, st.stacks = now + 600, 600, 3 end
  end
  if st.exp > 0 and st.exp <= now then st.exp, st.dur, st.stacks = 0, 0, 0 end
  if st.exp > now and st.timerFor ~= st.exp then
    st.timerFor = st.exp
    C_Timer.After(st.exp - now + 0.05, function() WeakAuras.ScanEvents("TIRY_LS") end)
  end
  local active = st.exp > now
  allstates[""] = {
    show = true, changed = true, autoHide = false, progressType = "timed",
    duration = active and st.dur or 0, expirationTime = active and st.exp or 0,
    stacks = (active and st.stacks > 0) and st.stacks or nil, active = active,
  }
  return true
end
