-- ChatWerk: Blizzard-Chat ausblenden (Fenster, Reiter, Knopfleisten wandern in einen unsichtbaren Rahmen - sie
-- bekommen weiter alle Ereignisse, Antworten auf Fluestern usw. funktionieren also normal), Eingabezeile unter das
-- gewaehlte ChatWerk-Fenster legen und Ausgaben von Add-ons (print) einsammeln, die sonst im unsichtbaren Chat landen.
local _, ns = ...
local UI = ns.UI
local B = {}
ns.Blizzard = B

local hider = CreateFrame("Frame", nil, UIParent)
hider:Hide()
B.hider = hider
local moved = {}   -- Rahmen -> urspruenglicher Eltern-Rahmen

local EXTRA = { "GeneralDockManager", "ChatFrameMenuButton", "ChatFrameChannelButton", "ChatFrameToggleVoiceDeafenButton",
  "ChatFrameToggleVoiceMuteButton", "QuickJoinToastButton", "ChatAlertFrame" }

local function frames()
  local list = {}
  for i = 1, (NUM_CHAT_WINDOWS or 10) do
    for _, suffix in ipairs({ "", "Tab", "ButtonFrame" }) do
      local f = _G["ChatFrame" .. i .. suffix]
      if f then list[#list + 1] = f end
    end
  end
  for _, n in ipairs(EXTRA) do if _G[n] then list[#list + 1] = _G[n] end end
  return list
end

local function park(f)
  if moved[f] then return end
  local ok, parent = pcall(f.GetParent, f)
  if not ok then return end
  if pcall(f.SetParent, f, hider) then moved[f] = parent or UIParent end
end
local function unpark(f)
  local parent = moved[f]
  if not parent then return end
  if pcall(f.SetParent, f, parent) then moved[f] = nil end
end

-- Eingabezeile: frei unter dem gewaehlten Fenster, mit Glas statt Blizzard-Rahmen
local editStyled = false
local function styleEdit(eb)
  if editStyled then return end
  editStyled = true
  local name = eb:GetName() or "ChatFrame1EditBox"
  for _, part in ipairs({ "Left", "Mid", "Right", "FocusLeft", "FocusMid", "FocusRight" }) do
    local t = _G[name .. part] or eb[part]
    if t and t.SetAlpha then pcall(t.SetAlpha, t, 0) end
  end
  ns.Safe(function()
    eb.cwGlass = UI.Glass(eb, { radius = 15, sheen = 0.06, line = 0.25, edgeMode = "neon", edge = 0.45, sub = -8 })
    eb.cwHud = UI.HUD(eb, { radius = 15, grid = false, corner = false, flow = eb.cwGlass.edge, flowAlpha = 0.5, streakW = 110, streakPause = 6 })
    B.Theme()
  end)
end

-- Eingabezeile im gewaehlten Farbthema (wie das Chatfenster)
function B.Theme()
  local eb = ChatFrame1EditBox
  if not eb or not eb.cwGlass or not ns.Theme then return end
  local t = ns.Theme()
  eb.cwGlass.opts.edgeStops = t
  eb.cwGlass:SetEdge("neon", 0.45)
  if eb.cwHud then
    if eb.cwHud.flow then eb.cwHud.flow.colors = { t[1], t[2], t[3], t[2] } end
    if eb.cwHud.streak then eb.cwHud.streak:SetVertexColor(t[2][1], t[2][2], t[2][3], 1) end
  end
end

function B.Anchor()
  local eb = ChatFrame1EditBox
  if not eb or not ns.DB then return end
  if not ns.DB.hideBlizzard then
    if moved[eb] then unpark(eb) end
    if B.editMoved then
      pcall(eb.ClearAllPoints, eb)
      local cf = ChatFrame1
      pcall(eb.SetPoint, eb, "TOPLEFT", cf, "BOTTOMLEFT", -5, -2)
      pcall(eb.SetPoint, eb, "TOPRIGHT", cf, "BOTTOMRIGHT", 5, -2)
      B.editMoved = false
    end
    return
  end
  local w = ns.Main
  if not w or not w.frame then return end
  B.editMoved = true
  if eb:GetParent() ~= UIParent then pcall(eb.SetParent, eb, UIParent) end
  pcall(eb.SetIgnoreParentAlpha, eb, true)
  pcall(eb.SetFrameStrata, eb, "DIALOG")
  pcall(eb.ClearAllPoints, eb)
  pcall(eb.SetPoint, eb, "TOPLEFT", w.frame, "BOTTOMLEFT", 0, -3)
  pcall(eb.SetPoint, eb, "TOPRIGHT", w.frame, "BOTTOMRIGHT", 0, -3)
  styleEdit(eb)
  if not B.editHooked then
    B.editHooked = true
    -- Blizzard setzt die Eingabezeile beim Oeffnen evtl. neu -> wieder unter das Fenster
    pcall(eb.HookScript, eb, "OnShow", function() if ns.DB.hideBlizzard then C_Timer.After(0, B.Anchor) end end)
  end
end

function B.Apply()
  if not ns.DB then return end
  if ns.DB.hideBlizzard then
    for _, f in ipairs(frames()) do park(f) end
  else
    for f in pairs(moved) do unpark(f) end
  end
  B.Anchor()
end

----------------------------------------------------------------------------
-- Ausgaben einsammeln, die nicht aus Chat-Ereignissen kommen
--  * kein 5. Argument (Meldungs-ID) -> print() eines Add-ons oder Blizzard-Text ohne Chat-Typ -> "addons"
--  * ID = Systemmeldung, aber kein CHAT_MSG_SYSTEM dazu (von Blizzard-Lua erzeugt) -> passende Kategorie
----------------------------------------------------------------------------
local own = false        -- ChatWerk schreibt selbst gerade in den Blizzard-Chat
local last, lastT        -- gleiche Ausgabe in mehreren Blizzard-Fenstern nur einmal
local queue = {}

local function deliver(msg, r, g, b, id)
  if ns.IsSecret(msg) then
    if id == nil then ns.Emit("addons", msg, r, g, b, { secret = true }) end
    return
  end
  if type(msg) ~= "string" or msg == "" then return end
  local now = GetTime()
  if msg == last and lastT and now - lastT < 0.5 then return end
  last, lastT = msg, now
  if id == nil then
    ns.Emit("addons", msg, r or 1, g or 1, b or 1)
    return
  end
  local sys = ChatTypeInfo and ChatTypeInfo.SYSTEM
  if sys and id == sys.id then
    C_Timer.After(0, function()
      local seen = ns.systemSeen[msg]
      if seen and GetTime() - seen < 2 then return end
      local cat = ns.Classify("sys", msg) or "sys_other"
      ns.Emit(cat, msg, r or 1, g or 1, b or 0)
    end)
  end
end

function B.OnAddMessage(frame, msg, r, g, b, id)
  if own then return end
  if not ns.ready then
    if #queue < 60 then queue[#queue + 1] = { msg, r, g, b, id } end
    return
  end
  ns.Safe(deliver, msg, r, g, b, id)
end

function B.Flush()
  local q = queue
  queue = {}
  for _, e in ipairs(q) do ns.Safe(deliver, e[1], e[2], e[3], e[4], e[5]) end
end

-- Notfall-Ausgabe in den Blizzard-Chat ohne Selbst-Einsammeln
function B.Raw(msg)
  own = true
  pcall(DEFAULT_CHAT_FRAME.AddMessage, DEFAULT_CHAT_FRAME, msg)
  own = false
end

function B.Hook()
  for i = 1, (NUM_CHAT_WINDOWS or 10) do
    local f = _G["ChatFrame" .. i]
    if f and type(f.AddMessage) == "function" and not f.cwHooked then
      f.cwHooked = true
      pcall(hooksecurefunc, f, "AddMessage", B.OnAddMessage)
    end
  end
end
