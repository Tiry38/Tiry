---------------------------------------------------------------------------
-- Blitzschild 1.2.0 · Blitzschlagschild-Anzeige fuer WoW Forever (16001)
-- Im Kampf sperrt Forever Buff-Werte fuer Addons ("secret values"). Gesperrte
-- Werte duerfen aber ANGEZEIGT werden -> Zeit/Aufladungen kommen dann direkt
-- aus Blizzards Anzeige-Funktionen, ohne dass das Addon sie lesen muss.
---------------------------------------------------------------------------
local ADDON = ...
local TITLE = "|cff4dd9ffBlitz|r|cffff6a14schild|r"
local function P(m) DEFAULT_CHAT_FRAME:AddMessage(TITLE .. " " .. m) end

local IDS = { [324] = true, [325] = true, [905] = true, [945] = true, [8134] = true,
              [10431] = true, [10432] = true, [25469] = true, [25472] = true }
local NAMES = { ["Blitzschlagschild"] = true, ["Lightning Shield"] = true }
local ICON = "Interface\\Icons\\Spell_Nature_LightningShield"
local FROST, RED, GREEN = { 0.30, 0.85, 1 }, { 1, 0.2, 0.12 }, { 0.25, 1, 0.35 }

local DB
local DEF = { point = "CENTER", x = 0, y = -150, scale = 1, locked = true }

local function secret(v) return issecretvalue and issecretvalue(v) or false end
local function readable(v) return v ~= nil and not secret(v) end

---------------------------------------------------------------------------
-- Anzeige
---------------------------------------------------------------------------
local F = CreateFrame("Frame", "BlitzschildFrame", UIParent)
F:SetSize(64, 64)
F:SetClampedToScreen(true)
F:SetMovable(true)
F:RegisterForDrag("LeftButton")
F:SetScript("OnDragStart", function(s) if not DB.locked then s:StartMoving() end end)
F:SetScript("OnDragStop", function(s)
  s:StopMovingOrSizing()
  local p, _, _, x, y = s:GetPoint()
  DB.point, DB.x, DB.y = p, x, y
end)

local bg = F:CreateTexture(nil, "BACKGROUND")
bg:SetPoint("TOPLEFT", -3, 3); bg:SetPoint("BOTTOMRIGHT", 3, -3)
bg:SetColorTexture(0, 0, 0, 0.9)

local B = {}
local function edge(p1, p2, w, h)
  local t = F:CreateTexture(nil, "BORDER")
  t:SetColorTexture(1, 1, 1, 1)
  t:SetPoint(p1, p1:find("LEFT") and -2 or 2, p1:find("TOP") and 2 or -2)
  t:SetPoint(p2, p2:find("LEFT") and -2 or 2, p2:find("TOP") and 2 or -2)
  if w then t:SetWidth(w) end
  if h then t:SetHeight(h) end
  B[#B + 1] = t
end
edge("TOPLEFT", "TOPRIGHT", nil, 2)
edge("BOTTOMLEFT", "BOTTOMRIGHT", nil, 2)
edge("TOPLEFT", "BOTTOMLEFT", 2, nil)
edge("TOPRIGHT", "BOTTOMRIGHT", 2, nil)
local function border(c) for _, t in ipairs(B) do t:SetVertexColor(c[1], c[2], c[3], 1) end end

local icon = F:CreateTexture(nil, "ARTWORK")
icon:SetAllPoints()
icon:SetTexture(ICON)
icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)

local cd = CreateFrame("Cooldown", nil, F, "CooldownFrameTemplate")
cd:SetAllPoints()
cd:SetDrawEdge(false)
if cd.SetDrawBling then cd:SetDrawBling(false) end
cd:SetSwipeColor(0, 0, 0, 0.45)
local cfont = CreateFont("BlitzschildCDFont")
cfont:SetFont(STANDARD_TEXT_FONT, 16, "OUTLINE")
if cd.SetCountdownFont then pcall(cd.SetCountdownFont, cd, "BlitzschildCDFont") end
if cd.SetHideCountdownNumbers then cd:SetHideCountdownNumbers(true) end

local over = CreateFrame("Frame", nil, F)
over:SetAllPoints()
over:SetFrameLevel(cd:GetFrameLevel() + 5)
local function FS(size)
  local f = over:CreateFontString(nil, "OVERLAY")
  f:SetFont(STANDARD_TEXT_FONT, size, "OUTLINE")
  f:SetShadowOffset(1, -1)
  return f
end
local tTime = FS(16); tTime:SetPoint("CENTER", 0, 8)
local tCnt = FS(18); tCnt:SetPoint("CENTER", 0, -13); tCnt:SetTextColor(GREEN[1], GREEN[2], GREEN[3])
local tMsg = FS(17); tMsg:SetPoint("CENTER", 0, 0)
local hint = FS(10); hint:SetPoint("TOP", F, "BOTTOM", 0, -4)
hint:SetText("|cffaaaaaaziehen · /bs lock|r")

---------------------------------------------------------------------------
-- Schild finden
---------------------------------------------------------------------------
local S = { iid = nil, gone = false, castAt = 0 }
-- im Kampf verfolgter Stand (Abfragen sind dort blockiert)
local T = { exp = nil, dur = 600, stacks = nil }
local inCombat = false

local function isLS(d)
  local r = false
  pcall(function()
    if readable(d.spellId) and IDS[d.spellId] then r = true; return end
    if readable(d.name) and NAMES[d.name] then
      r = true
      if readable(d.spellId) then IDS[d.spellId] = true end -- Forever-ID lernen
    end
  end)
  return r
end

-- liefert Aura-Datensatz des Schilds (Felder evtl. gesperrt) oder nil
local function findLS()
  local U = C_UnitAuras
  if not U then return end
  -- 1) direkte Abfrage per Zauber-ID
  if U.GetPlayerAuraBySpellID then
    for id in pairs(IDS) do
      local okA, d = pcall(U.GetPlayerAuraBySpellID, id)
      if okA and d then return d end
    end
  end
  -- 2) gemerkte Kennung
  if S.iid and U.GetAuraDataByAuraInstanceID then
    local okA, d = pcall(U.GetAuraDataByAuraInstanceID, "player", S.iid)
    if okA and d then return d end
  end
  -- 3) alle Buffs durchsuchen (klappt ausserhalb des Kampfes)
  for i = 1, 40 do
    local okA, d = pcall(U.GetAuraDataByIndex, "player", i, "HELPFUL")
    if not okA or not d then break end
    if isLS(d) then return d end
  end
end

local function fmtT(t)
  if t >= 60 then return string.format("%d:%02d", math.floor(t / 60), math.floor(t % 60)) end
  return string.format("%.0f", t)
end


---------------------------------------------------------------------------
-- Diagnose (/bs test, und automatisch 1x, wenn im Kampf "?" entsteht)
---------------------------------------------------------------------------
local function sv(v)
  if v == nil then return "nil" end
  if secret(v) then return "GESPERRT" end
  return tostring(v)
end
local function Diag(why)
  local U = C_UnitAuras or {}
  P("|cffffd200Diagnose (" .. why .. ")|r Kampf=" .. tostring(inCombat) .. " Kennung=" .. sv(S.iid))
  local ids = {}
  for id in pairs(IDS) do ids[#ids + 1] = id end
  table.sort(ids)
  local hits = {}
  for _, id in ipairs(ids) do
    local okA, d = pcall(U.GetPlayerAuraBySpellID, id)
    if not okA then hits[#hits + 1] = id .. "=FEHLER" elseif d then hits[#hits + 1] = id .. "=DA" end
  end
  P("1 BySpellID: " .. (#hits > 0 and table.concat(hits, " ") or "nichts"))
  if S.iid then
    local okA, d = pcall(U.GetAuraDataByAuraInstanceID, "player", S.iid)
    P("2 ByInstanceID: " .. (not okA and "FEHLER" or (d and ("DA name=" .. sv(d.name) .. " stacks=" .. sv(d.applications) .. " exp=" .. sv(d.expirationTime))) or "nil"))
    local okD, dur = pcall(U.GetAuraDuration or function() end, "player", S.iid)
    local okC, cnt = pcall(U.GetAuraApplicationDisplayCount or function() end, "player", S.iid)
    P("3 Duration=" .. (okD and (dur and "Objekt" or "nil") or "FEHLER") .. "  Count=" .. (okC and sv(cnt) or "FEHLER"))
  end
  local n, names = 0, {}
  for i = 1, 40 do
    local okA, d = pcall(U.GetAuraDataByIndex, "player", i, "HELPFUL")
    if not okA then names[#names + 1] = "FEHLER"; break end
    if not d then break end
    n = n + 1
    if #names < 6 then names[#names + 1] = sv(d.name) .. "/" .. sv(d.spellId) .. "/#" .. sv(d.auraInstanceID) end
  end
  P("4 Buffs per Index: " .. n .. "  " .. table.concat(names, ", "))
  local api = {}
  for _, f in ipairs({ "GetUnitAuraInstanceIDs", "GetAuraSlots", "GetUnitAuras", "IsAuraFilteredOutByInstanceID" }) do
    api[#api + 1] = f .. "=" .. tostring(U[f] ~= nil)
  end
  P("5 " .. table.concat(api, " ") .. "  AuraUtil=" .. tostring(AuraUtil ~= nil))
end
local diagDone = false

local state = "?"
local function Paint(st, timeTxt, cnt, low)
  state = st
  if st == "on" then
    icon:SetDesaturated(false); icon:SetVertexColor(1, 1, 1)
    tMsg:SetText(""); tTime:SetText(timeTxt or ""); tCnt:SetText(cnt or "")
    border(low and { 1, 0.45, 0.08 } or FROST)
  elseif st == "off" then
    icon:SetDesaturated(true); icon:SetVertexColor(1, 0.45, 0.45)
    tTime:SetText(""); tCnt:SetText(""); tMsg:SetText("|cffff3320FEHLT|r")
    border(RED)
  else
    icon:SetDesaturated(false); icon:SetVertexColor(0.7, 0.7, 0.7)
    tTime:SetText(""); tCnt:SetText(""); tMsg:SetText("|cff4dd9ff?|r")
    border(FROST)
  end
end

local function Update()
  if not DB then return end
  local now = GetTime()
  if not inCombat then
    -- ausserhalb des Kampfes: echter Buff
    local d = findLS()
    if d then
      local okR = pcall(function()
        if readable(d.auraInstanceID) then S.iid = d.auraInstanceID end
        if readable(d.expirationTime) and d.expirationTime > 0 then
          T.exp = d.expirationTime
          T.dur = (readable(d.duration) and d.duration > 0) and d.duration or 600
        end
        if readable(d.applications) then T.stacks = d.applications end
      end)
      S.gone = false
    else
      S.iid, T.exp, T.stacks = nil, nil, nil
      S.gone = true
    end
    cd:SetHideCountdownNumbers(true)
  end
  -- Anzeige aus dem verfolgten Stand (gilt in und ausserhalb des Kampfes)
  if T.exp and T.exp > now and not S.gone then
    local st = T.stacks
    pcall(cd.SetCooldown, cd, T.exp - (T.dur or 600), T.dur or 600)
    if inCombat and T.unsure then
      Paint("on", fmtT(T.exp - now), "|cff4dd9ff?|r", false)   -- Aufladungen im Kampf nicht lesbar
    else
      Paint("on", fmtT(T.exp - now), (st and st > 0) and st or "", st == 1)
    end
  elseif S.gone or (not inCombat) then
    cd:Clear()
    Paint("off")
  else
    cd:Clear()
    Paint("?")
  end
end

---------------------------------------------------------------------------
-- Ereignisse
---------------------------------------------------------------------------
local E = CreateFrame("Frame")
E:RegisterEvent("PLAYER_LOGIN")
E:SetScript("OnEvent", function(_, ev, unit, a2, a3)
  if ev == "PLAYER_LOGIN" then
    BlitzschildDB = BlitzschildDB or {}
    DB = BlitzschildDB
    for k, v in pairs(DEF) do if DB[k] == nil then DB[k] = v end end
    F:ClearAllPoints()
    F:SetPoint(DB.point, UIParent, DB.point, DB.x, DB.y)
    F:SetScale(DB.scale)
    F:EnableMouse(not DB.locked); hint:SetShown(not DB.locked)
    local _, class = UnitClass("player")
    if class ~= "SHAMAN" then F:Hide(); return end
    for _, e in ipairs({ "UNIT_AURA", "UNIT_SPELLCAST_SUCCEEDED", "PLAYER_REGEN_DISABLED",
      "PLAYER_REGEN_ENABLED", "PLAYER_ENTERING_WORLD" }) do pcall(E.RegisterEvent, E, e) end
    Update()
    P("geladen – /bs unlock zum Verschieben")
    return
  end
  if ev == "UNIT_AURA" then
    if unit ~= "player" then return end
    -- Forever sperrt im Kampf auch den Inhalt dieser Meldung -> nur "es hat sich etwas geaendert"
    if inCombat then T.unsure = true end
  elseif ev == "UNIT_SPELLCAST_SUCCEEDED" then
    if unit ~= "player" then return end
    pcall(function()
      local n = C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(a3)
      if (readable(a3) and IDS[a3]) or (readable(n) and NAMES[n]) then
        S.castAt = GetTime(); S.gone = false
        T.exp, T.dur, T.stacks, T.unsure = GetTime() + 600, 600, 3, false
      end
    end)
  elseif ev == "PLAYER_REGEN_DISABLED" then
    Update()            -- letzter freier Stand vor dem Kampf
    T.unsure = false
    inCombat = true
  elseif ev == "PLAYER_REGEN_ENABLED" then
    inCombat = false
  elseif ev == "PLAYER_ENTERING_WORLD" then
    inCombat = UnitAffectingCombat("player") and true or false
  end
  Update()
end)

local acc = 0
E:SetScript("OnUpdate", function(_, el)
  acc = acc + el
  if acc >= 0.2 then acc = 0; pcall(Update) end
end)

---------------------------------------------------------------------------
-- /bs
---------------------------------------------------------------------------
SLASH_BLITZSCHILD1 = "/bs"
SlashCmdList.BLITZSCHILD = function(msg)
  if not DB then return end
  local c, a = (msg or ""):lower():match("^%s*(%S*)%s*(.-)%s*$")
  if c == "test" then Diag("/bs test"); return end
  if c == "unlock" then DB.locked = false
  elseif c == "lock" then DB.locked = true
  elseif c == "scale" and tonumber(a) then DB.scale = math.max(0.5, math.min(3, tonumber(a))); F:SetScale(DB.scale)
  elseif c == "reset" then
    DB.point, DB.x, DB.y, DB.scale = "CENTER", 0, -150, 1
    F:ClearAllPoints(); F:SetPoint("CENTER", UIParent, "CENTER", 0, -150); F:SetScale(1)
  else
    P("Befehle: /bs test · /bs unlock · /bs lock · /bs scale 1.3 · /bs reset"); return
  end
  F:EnableMouse(not DB.locked); hint:SetShown(not DB.locked)
  P(DB.locked and "gesperrt." or "entsperrt – mit Linksklick ziehen, danach /bs lock")
end
