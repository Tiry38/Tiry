-- Strenger Nachbau der WoW-Forever-Umgebung (Lua 5.1) für Tiry's Zentrale-Tests.
-- Widget-Methoden sind nur erlaubt, wenn sie in Blizzards Forever-API-Doku stehen (forever_widget_api.lua).
local M = {}
local HERE = (debug.getinfo(1, "S").source:match("^@(.*/)") or "./")
M.ROOT = HERE .. "../"
local API = dofile(HERE .. "forever_widget_api.lua")
local METRICS = dofile(HERE .. "font_metrics.lua")
M.METRICS = METRICS
local EVENTS = dofile(HERE .. "forever_events.lua")

M.errors = {}
M.prints = {}
M.timers = {}
M.now = 1730000000

local function set(list) local s = {} for _, v in ipairs(list) do s[v] = true end return s end
local function union(...)
  local s = {}
  for _, g in ipairs({ ... }) do
    assert(API[g], "API-Gruppe fehlt: " .. g)
    for _, m in ipairs(API[g]) do s[m] = true end
  end
  return s
end

local BASE = { "SimpleObjectAPI", "SimpleFrameScriptObjectAPI", "SimpleScriptRegionAPI", "SimpleScriptRegionResizingAPI", "SimpleAnimatableObjectAPI" }
local function allowed(...)
  local groups = {}
  for _, g in ipairs(BASE) do groups[#groups + 1] = g end
  for _, g in ipairs({ ... }) do groups[#groups + 1] = g end
  return union(unpack(groups))
end
local ALLOWED = {
  Frame = allowed("SimpleFrameAPI"),
  Button = allowed("SimpleFrameAPI", "SimpleButtonAPI"),
  ScrollFrame = allowed("SimpleFrameAPI", "SimpleScrollFrameAPI"),
  EditBox = allowed("SimpleFrameAPI", "SimpleEditBoxAPI"),
  Texture = allowed("SimpleRegionAPI", "SimpleTextureBaseAPI", "SimpleTextureAPI"),
  MaskTexture = allowed("SimpleRegionAPI", "SimpleTextureBaseAPI", "SimpleMaskTextureAPI"),
  FontString = allowed("SimpleRegionAPI", "SimpleFontStringAPI"),
  AnimationGroup = union("SimpleObjectAPI", "SimpleFrameScriptObjectAPI", "SimpleAnimGroupAPI"),
  Alpha = union("SimpleObjectAPI", "SimpleFrameScriptObjectAPI", "SimpleAnimAPI", "SimpleAnimAlphaAPI"),
  Translation = union("SimpleObjectAPI", "SimpleFrameScriptObjectAPI", "SimpleAnimAPI", "SimpleAnimTranslationAPI"),
  Scale = union("SimpleObjectAPI", "SimpleFrameScriptObjectAPI", "SimpleAnimAPI", "SimpleAnimScaleAPI"),
  Rotation = union("SimpleObjectAPI", "SimpleFrameScriptObjectAPI", "SimpleAnimAPI", "SimpleAnimRotationAPI"),
}
-- Methoden aus Frame-Schablonen bzw. Lua-Mixins, die nicht in der C-API-Doku stehen
ALLOWED.Frame.SetBackdrop = nil

local STRATA = set({ "BACKGROUND", "LOW", "MEDIUM", "HIGH", "DIALOG", "FULLSCREEN", "FULLSCREEN_DIALOG", "TOOLTIP" })
local LAYERS = set({ "BACKGROUND", "BORDER", "ARTWORK", "OVERLAY", "HIGHLIGHT" })
local BLEND = set({ "DISABLE", "BLEND", "ALPHAKEY", "ADD", "MOD" })
local POINTS = set({ "TOPLEFT", "TOPRIGHT", "BOTTOMLEFT", "BOTTOMRIGHT", "TOP", "BOTTOM", "LEFT", "RIGHT", "CENTER" })
local SMOOTH = set({ "IN", "OUT", "IN_OUT", "OUT_IN", "NONE" })
local LOOP = set({ "NONE", "REPEAT", "BOUNCE" })
local JUSTH = set({ "LEFT", "CENTER", "RIGHT" })
local JUSTV = set({ "TOP", "MIDDLE", "BOTTOM" })

M.textures = {}
M.fonts = {}

local function fileExists(p)
  local f = io.open(p, "rb")
  if f then f:close() return true end
  return false
end

-- Pfade aus dem Addon-Ordner müssen als Datei existieren
local function checkAddonFile(path, exts)
  if type(path) ~= "string" then return end
  local addon, rel = path:match("^Interface\\AddOns\\([^\\]+)\\(.*)$")
  if not rel then return end
  rel = rel:gsub("\\", "/")
  for _, ext in ipairs(exts) do
    local candidate = rel:lower():match("%." .. ext .. "$") and rel or (rel .. "." .. ext)
    if fileExists(M.ROOT .. addon .. "/" .. candidate) or fileExists(M.ROOT .. "addons/" .. addon .. "/" .. candidate) then return end
  end
  error("Datei fehlt im Addon: " .. path, 3)
end

----------------------------------------------------------------------------
-- Objekte
----------------------------------------------------------------------------
local Obj = {}
local function make(kind, parent, name)
  local o = { __kind = kind, __parent = parent, __name = name, __scripts = {}, __hooks = {}, __points = {},
    __shown = true, __w = 0, __h = 0, __alpha = 1, __scale = 1, __enabled = true, __level = 1, __children = {} }
  if parent and parent.__children then table.insert(parent.__children, o) end
  return setmetatable(o, {
    __index = function(t, k)
      local impl = Obj[k]
      local allowedSet = ALLOWED[kind]
      if allowedSet and allowedSet[k] then
        return impl or function() return nil end
      end
      if impl and (k:sub(1, 2) == "__") then return impl end
      return nil -- unbekannte Methode -> Aufruf scheitert mit "attempt to call nil"
    end,
  })
end
M.make = make

local function call(o, script, ...)
  local fn = o.__scripts[script]
  if fn then fn(o, ...) end
  for _, h in ipairs(o.__hooks[script] or {}) do h(o, ...) end
end
M.call = call

function Obj.SetScript(o, s, fn) o.__scripts[s] = fn end
function Obj.GetScript(o, s) return o.__scripts[s] end
function Obj.HookScript(o, s, fn)
  o.__hooks[s] = o.__hooks[s] or {}
  table.insert(o.__hooks[s], fn)
end
function Obj.HasScript() return true end
function Obj.Show(o)
  if not o.__shown then o.__shown = true call(o, "OnShow") end
end
function Obj.Hide(o)
  if o.__shown then o.__shown = false call(o, "OnHide") end
end
function Obj.SetShown(o, v) if v then Obj.Show(o) else Obj.Hide(o) end end
function Obj.IsShown(o) return o.__shown end
function Obj.IsVisible(o)
  local p = o
  while p do
    if not p.__shown then return false end
    p = p.__parent
  end
  return true
end
function Obj.GetName(o) return o.__name end
function Obj.GetParent(o) return o.__parent end
function Obj.SetParent(o, p) o.__parent = p end
function Obj.GetObjectType(o) return o.__kind end
function Obj.IsObjectType(o, t) return o.__kind == t end
function Obj.IsForbidden() return false end
function Obj.SetSize(o, w, h)
  assert(type(w) == "number" and type(h) == "number", "SetSize braucht Zahlen")
  local changed = (w ~= o.__w or h ~= o.__h)
  o.__w, o.__h = w, h
  if changed then call(o, "OnSizeChanged", w, h) end
end
function Obj.SetWidth(o, w) assert(type(w) == "number", "SetWidth braucht Zahl"); local c = w ~= o.__w; o.__w = w; if c then call(o, "OnSizeChanged", w, o.__h) end end
function Obj.SetHeight(o, h) assert(type(h) == "number", "SetHeight braucht Zahl"); local c = h ~= o.__h; o.__h = h; if c then call(o, "OnSizeChanged", o.__w, h) end end
function Obj.GetWidth(o)
  if o.__w == 0 and o.__allPoints and o.__parent then return Obj.GetWidth(o.__parent) end
  return o.__w
end
function Obj.GetHeight(o)
  if o.__h == 0 and o.__allPoints and o.__parent then return Obj.GetHeight(o.__parent) end
  return o.__h
end
function Obj.GetSize(o) return Obj.GetWidth(o), Obj.GetHeight(o) end
function Obj.SetPoint(o, point, rel, relPoint, x, y)
  assert(POINTS[point], "Ungültiger Ankerpunkt: " .. tostring(point))
  if type(rel) == "string" then assert(POINTS[rel] or _G[rel], "Ungültiger Anker: " .. rel) end
  if relPoint ~= nil and type(relPoint) == "string" then assert(POINTS[relPoint], "Ungültiger relPoint: " .. relPoint) end
  o.__points[point] = { rel, relPoint, x, y }
end
function Obj.ClearAllPoints(o) o.__points = {} o.__allPoints = nil end
function Obj.SetAllPoints(o, rel) o.__allPoints = rel or true end
function Obj.GetPoint(o, i)
  for p, v in pairs(o.__points) do return p, v[1], v[2], v[3], v[4] end
end
function Obj.GetNumPoints(o) local n = 0 for _ in pairs(o.__points) do n = n + 1 end return n end
function Obj.GetCenter() return 500, 400 end
function Obj.GetLeft() return 100 end
function Obj.GetTop() return 700 end
function Obj.GetEffectiveScale() return 1 end
function Obj.SetScale(o, s) assert(type(s) == "number" and s > 0, "SetScale braucht Zahl > 0") o.__scale = s end
function Obj.GetScale(o) return o.__scale end
function Obj.SetAlpha(o, a) assert(type(a) == "number", "SetAlpha braucht Zahl") o.__alpha = a end
function Obj.GetAlpha(o) return o.__alpha end
function Obj.IsMouseOver(o) return o.__mouseOver == true end
function Obj.EnableMouse() end
function Obj.EnableMouseWheel() end
function Obj.SetFrameStrata(o, s) assert(STRATA[s], "Ungültige Strata: " .. tostring(s)) end
function Obj.SetFrameLevel(o, l) assert(type(l) == "number") o.__level = l end
function Obj.GetFrameLevel(o) return o.__level end
function Obj.RegisterEvent(o, e)
  if not EVENTS[e] then error("Ereignis existiert in Forever nicht: " .. tostring(e)) end
  M.registered = M.registered or {}
  M.registered[e] = M.registered[e] or {}
  table.insert(M.registered[e], o)
end
function Obj.UnregisterEvent() end
function Obj.RegisterForDrag() end
function Obj.RegisterForClicks() end
function Obj.SetMovable() end
function Obj.StartMoving() end
function Obj.StopMovingOrSizing() end
function Obj.SetClampedToScreen() end
function Obj.SetToplevel() end
function Obj.SetClipsChildren() end
function Obj.SetEnabled(o, v) o.__enabled = v and true or false call(o, v and "OnEnable" or "OnDisable") end
function Obj.Enable(o) Obj.SetEnabled(o, true) end
function Obj.Disable(o) Obj.SetEnabled(o, false) end
function Obj.IsEnabled(o) return o.__enabled end
function Obj.Click(o, button) if o.__enabled then call(o, "OnClick", button or "LeftButton", false) end end

function Obj.CreateTexture(o, name, layer, template, sub)
  if layer then assert(LAYERS[layer], "Ungültige Ebene: " .. tostring(layer)) end
  if sub then assert(sub >= -8 and sub <= 7, "Sublevel außerhalb -8..7: " .. tostring(sub)) end
  local t = make("Texture", o, name)
  t.__layer, t.__sub = layer or "ARTWORK", sub or 0
  table.insert(M.textures, t)
  return t
end
function Obj.CreateMaskTexture(o, name, layer)
  return make("MaskTexture", o, name)
end
function Obj.CreateFontString(o, name, layer)
  if layer then assert(LAYERS[layer], "Ungültige Ebene: " .. tostring(layer)) end
  local f = make("FontString", o, name)
  f.__text = ""
  f.__layer = layer or "OVERLAY"
  f.__wrap, f.__spacing, f.__justH, f.__tc = true, 0, "CENTER", { 1, 1, 1, 1 }
  table.insert(M.fonts, f)
  return f
end
function Obj.CreateAnimationGroup(o)
  local ag = make("AnimationGroup", o)
  ag.__anims = {}
  return ag
end

-- Texturen
function Obj.SetTexture(o, file, wrapH, wrapV)
  if type(file) == "string" then checkAddonFile(file, { "tga", "blp" }) end
  o.__file = file
end
function Obj.SetDesaturated(o, v) o.__desat = v end
function Obj.SetAtlas(o, name) assert(type(name) == "string") o.__file = "ATLAS:" .. name end
function Obj.SetColorTexture(o, r, g, b, a) assert(type(r) == "number") o.__file = "WHITE" o.__color = { r, g, b, a or 1 } o.__grad = nil end
function Obj.SetTexCoord(o, ...) local n = select("#", ...) assert(n == 4 or n == 8, "SetTexCoord braucht 4 oder 8 Werte") o.__coord = { ... } end
function Obj.SetVertexColor(o, r, g, b, a)
  assert(type(r) == "number" and type(g) == "number" and type(b) == "number", "SetVertexColor braucht Zahlen")
  if a ~= nil then assert(type(a) == "number", "Alpha muss Zahl sein") end
  o.__color = { r, g, b, a or 1 } o.__grad = nil
end
function Obj.SetGradient(o, orient, c1, c2)
  assert(orient == "HORIZONTAL" or orient == "VERTICAL", "Ungültige Ausrichtung")
  assert(type(c1) == "table" and c1.GetRGBA and type(c2) == "table" and c2.GetRGBA, "SetGradient braucht ColorMixin-Objekte")
  o.__grad = { orient, { c1:GetRGBA() }, { c2:GetRGBA() } }
end
function Obj.SetBlendMode(o, m) assert(BLEND[m], "Ungültiger Blendmodus: " .. tostring(m)) o.__blend = m end
function Obj.AddMaskTexture(o, m) assert(m and m.__kind == "MaskTexture", "AddMaskTexture braucht MaskTexture") end
function Obj.SetRotation(o, r) assert(type(r) == "number") o.__rot = r end
function Obj.SetTextureSliceMargins(o, l, t, r, b)
  assert(type(l) == "number" and type(t) == "number" and type(r) == "number" and type(b) == "number", "SetTextureSliceMargins braucht 4 Zahlen")
  o.__slice = { l, t, r, b }
end
function Obj.SetTextureSliceMode(o, m) assert(m == 0 or m == 1, "SliceMode 0 (gestreckt) oder 1 (gekachelt)") o.__sliceMode = m end

-- Schrift
function Obj.SetFont(o, file, size, flags)
  assert(type(file) == "string" and file ~= "", "SetFont: Datei fehlt")
  assert(type(size) == "number" and size > 0, "SetFont: Größe fehlt")
  if file:match("^Interface\\AddOns\\TirysZentrale\\") then checkAddonFile(file, { "ttf" }) end
  o.__font = file
  o.__size = size
  o.__weight = file:find("ExtraBold") and "bold" or (file:find("SemiBold") and "semibold" or (file:upper():find("ARIALN") and "narrow" or "regular"))
  o.__outline = type(flags) == "string" and flags:find("OUTLINE") and true or nil
  return true
end
function Obj.SetText(o, t)
  assert(o.__font, "Font not set – SetText vor SetFont")
  if t ~= nil then assert(type(t) == "string" or type(t) == "number", "SetText braucht Text") end
  o.__text = t and tostring(t) or ""
end
function Obj.SetFormattedText(o, fmt, ...) Obj.SetText(o, string.format(fmt, ...)) end
function Obj.GetText(o) return o.__text end
function Obj.SetTextColor(o, r, g, b, a) assert(type(r) == "number" and type(g) == "number" and type(b) == "number", "SetTextColor braucht Zahlen") o.__tc = { r, g, b, a or 1 } end

-- Exakte Textmaße mit den Poppins-Zeichenbreiten
local function strip(text)
  text = tostring(text or "")
  text = text:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")
  text = text:gsub("|A[^|]*|a", "\1"):gsub("|T[^|]*|t", "\1") -- Symbole = 1 Platzhalter
  return text
end
M.strip = strip
local function charWidth(o, ch)
  local t = METRICS[o.__weight or "regular"]
  if ch == "\1" then return 1.0 end
  return t[ch] or 0.6
end
local function utf8chars(s)
  local out = {}
  for ch in s:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
    local b1, b2, b3 = ch:byte(1, 3)
    local cp = b1
    if b1 >= 240 then cp = 0x2000 elseif b1 >= 224 then cp = ((b1 % 16) * 4096) + ((b2 % 64) * 64) + (b3 % 64)
    elseif b1 >= 192 then cp = ((b1 % 32) * 64) + (b2 % 64) end
    out[#out + 1] = (ch == "\1") and "\1" or cp
  end
  return out
end
function M.textWidth(o, s)
  local w = 0
  for _, cp in ipairs(utf8chars(s)) do w = w + charWidth(o, cp) end
  return w * (o.__size or 12)
end
-- Zeilen nach Wortumbruch
function M.lines(o)
  local text = strip(o.__text)
  local maxW = (o.__wrap ~= false and o.__w and o.__w > 0) and o.__w or nil
  local out = {}
  for para in (text .. "\n"):gmatch("(.-)\n") do
    if not maxW then
      out[#out + 1] = para
    else
      local line = ""
      for word in para:gmatch("%S+") do
        local try = (line == "") and word or (line .. " " .. word)
        if M.textWidth(o, try) <= maxW + 0.5 or line == "" then
          line = try
        else
          out[#out + 1] = line
          line = word
        end
      end
      out[#out + 1] = line
    end
  end
  return out
end
function Obj.GetStringWidth(o)
  local best = 0
  for _, l in ipairs(M.lines(o)) do best = math.max(best, M.textWidth(o, l)) end
  return best
end
function Obj.GetUnboundedStringWidth(o) return M.textWidth(o, strip(o.__text)) end
function Obj.GetStringHeight(o)
  local n = #M.lines(o)
  local size = o.__size or 12
  -- Zeilenhöhe im Spiel liegt bei Poppins sichtbar über der Schriftgröße -> 1,2 x Größe (vorsichtig gerechnet)
  return n * size * 1.2 + math.max(n - 1, 0) * (o.__spacing or 0)
end
function Obj.SetJustifyH(o, j) assert(JUSTH[j], "Ungültig JustifyH: " .. tostring(j)) o.__justH = j end
function Obj.SetJustifyV(o, j) assert(JUSTV[j], "Ungültig JustifyV: " .. tostring(j)) o.__justV = j end
function Obj.SetWordWrap(o, v) o.__wrap = v and true or false end
function Obj.SetSpacing(o, s) assert(type(s) == "number") o.__spacing = s end
function Obj.SetShadowColor(o, r, g, b, a) assert(type(r) == "number") end
function Obj.SetShadowOffset(o, x, y) assert(type(x) == "number" and type(y) == "number") end

-- Scrollrahmen
function Obj.SetScrollChild(o, c) o.__child = c end
function Obj.GetVerticalScrollRange(o)
  local c = o.__child
  if not c then return 0 end
  return math.max(0, (c.__h or 0) - Obj.GetHeight(o))
end
function Obj.GetVerticalScroll(o) return o.__scroll or 0 end
function Obj.SetVerticalScroll(o, v) assert(type(v) == "number") o.__scroll = v end

-- Animationen
local ANIM_TYPES = set({ "Alpha", "Translation", "Scale", "Rotation", "Path", "FlipBook", "VertexColor", "TextureCoordTranslation" })
function Obj.CreateAnimation(o, kind)
  assert(ANIM_TYPES[kind], "Unbekannter Animationstyp: " .. tostring(kind))
  local a = make(kind, o)
  table.insert(o.__anims, a)
  return a
end
function Obj.SetLooping(o, l) assert(LOOP[l], "Ungültiges Looping: " .. tostring(l)) end
function Obj.Play(o) o.__playing = true end
function Obj.Stop(o) o.__playing = false end
function Obj.IsPlaying(o) return o.__playing == true end
function Obj.SetDuration(o, d) assert(type(d) == "number" and d > 0) end
function Obj.SetSmoothing(o, s) assert(SMOOTH[s], "Ungültiges Smoothing: " .. tostring(s)) end
function Obj.SetOffset(o, x, y) assert(type(x) == "number" and type(y) == "number") end
function Obj.SetFromAlpha(o, a) assert(type(a) == "number") end
function Obj.SetToAlpha(o, a) assert(type(a) == "number") end

----------------------------------------------------------------------------
-- Globale Umgebung
----------------------------------------------------------------------------
function M.install(opts)
  opts = opts or {}
  local G = _G
  G.UIParent = make("Frame", nil, "UIParent"); UIParent:SetSize(1920, 1080)
  G.Minimap = make("Frame", UIParent, "Minimap"); Minimap:SetSize(198, 198)
  G.GameFontNormal = { GetFont = function() return "Fonts\\FRIZQT__.TTF", 12, "" end }
  G.CreateFrame = function(kind, name, parent, template)
    assert(ALLOWED[kind], "CreateFrame: Typ nicht im Mock: " .. tostring(kind))
    assert(template == nil, "Schablonen werden im Addon nicht benutzt: " .. tostring(template))
    local f = make(kind, parent, name)
    if name then G[name] = f end
    return f
  end
  local tip = make("Frame", UIParent, "GameTooltip")
  tip.lines = {}
  local tipMethods = {
    SetOwner = function(self, owner, anchor) assert(owner, "SetOwner braucht Besitzer") self.lines = {} end,
    SetText = function(self, t) assert(type(t) == "string", "Tooltip SetText braucht Text") self.lines = { t } end,
    AddLine = function(self, t) assert(type(t) == "string", "AddLine braucht Text") table.insert(self.lines, t) end,
    AddDoubleLine = function(self, a, b) table.insert(self.lines, a .. " " .. b) end,
    SetItemByID = function(self, id) assert(type(id) == "number") table.insert(self.lines, "Item " .. id) end,
    Show = function() end, Hide = function() end,
  }
  G.GameTooltip = setmetatable({}, { __index = function(_, k) return tipMethods[k] or tip[k] end })
  for k, v in pairs(tipMethods) do G.GameTooltip[k] = v end
  G.GameTooltip.lines = {}
  G.DEFAULT_CHAT_FRAME = { AddMessage = function(_, msg) table.insert(M.prints, msg) end }
  G.UISpecialFrames = {}
  G.SlashCmdList = {}
  G.SOUNDKIT = { IG_MAINMENU_OPEN = 850, IG_MAINMENU_CLOSE = 851, U_CHAT_SCROLL_BUTTON = 1115 }
  G.PlaySound = function(id) assert(type(id) == "number") end
  G.NUM_BAG_SLOTS = 4
  G.NUM_TOTAL_EQUIPPED_BAG_SLOTS = 5
  G.Enum = { CraftingReagentType = { Modifying = 0, Basic = 1, Finishing = 2, Automatic = 3 } }
  G.wipe = function(t) for k in pairs(t) do t[k] = nil end return t end
  G.tinsert = table.insert
  G.strtrim = function(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end
  G.date = os.date
  G.time = function(t) if t then return os.time(t) end return M.now end
  G.GetTime = function() return M.now end
  G.GetLocale = function() return opts.locale or "deDE" end
  G.GetCursorPosition = function() return 400, 300 end
  G.IsShiftKeyDown = function() return M.shift == true end
  G.HandleModifiedItemClick = function(link) M.linked = link return true end
  G.GetMoneyString = function(m) return tostring(m) .. "c" end
  G.CreateColor = function(r, g, b, a)
    assert(type(r) == "number" and type(g) == "number" and type(b) == "number", "CreateColor braucht Zahlen")
    return { r = r, g = g, b = b, a = a or 1, GetRGBA = function(s) return s.r, s.g, s.b, s.a end }
  end
  local defaultHandler = function(err) table.insert(M.errors, debug.traceback(tostring(err), 2)) end
  M.errorHandler = defaultHandler
  G.geterrorhandler = function() return M.errorHandler end
  G.seterrorhandler = function(fn) assert(type(fn) == "function") M.errorHandler = fn end
  G.C_Timer = {
    After = function(sec, fn) assert(type(sec) == "number" and type(fn) == "function") table.insert(M.timers, fn) end,
    NewTicker = function(sec, fn) return { Cancel = function() end } end,
  }
  G.C_AddOns = { GetAddOnMetadata = function(name, field) if field == "Version" then return "1.0.0" end end }
  G.UnitName = function(u) if u == "npc" then return M.npcName or "Händlerin" end return "Tiry" end
  G.UnitLevel = function() return M.level or 20 end
  G.UnitFactionGroup = function() return M.faction or "Alliance" end
  G.UnitClass = function() return "Schurke", M.class or "ROGUE" end
  G.GetMoney = function() return M.money or 123456 end

  -- Items: Teil-Cache, damit auch der Rückfall auf gespeicherte Namen getestet wird
  M.itemInfo = M.itemInfo or {}
  G.C_Item = {
    GetItemInfo = function(id)
      assert(id ~= nil, "GetItemInfo ohne ID")
      local d = M.itemInfo[id]
      if not d then return nil end
      return d.name, "|cffffffff|Hitem:" .. id .. "::::::::20:::::::|h[" .. d.name .. "]|h|r", d.q or 1, 5, 1, "Handwerkswaren", "Stoff", d.stack or 20, "", 132889, d.sell or 0, 7, 5, 0, 0, nil, true, ""
    end,
    GetItemIconByID = function(id) assert(type(id) == "number") return 134400 end,
    RequestLoadItemDataByID = function(id) assert(type(id) == "number") end,
    GetItemCount = function(id, bank) assert(id ~= nil) local n = 0 for _, b in pairs(M.bags or {}) do for _, it in pairs(b) do if it.itemID == id then n = n + (it.stackCount or 1) end end end return n end,
  }
  -- Zauberbuch, Karte, Wegpunkte
  G.C_SpellBook = { IsSpellKnown = function(id, bank) assert(type(id) == "number") return (M.known or {})[id] == true end }
  G.UiMapPoint = { CreateFromCoordinates = function(map, x, y) assert(type(map) == "number" and x >= 0 and x <= 1 and y >= 0 and y <= 1, "Koordinaten 0..1") return { map = map, x = x, y = y } end }
  -- Atlanten, die im Forever-Client belegt sind (Camelot-Charaktererstellung)
  G.C_Texture = { GetAtlasInfo = function(name) if name == "charactercreate-icon-horde" then return { width = 128, height = 128, file = 1 } end end }
  G.C_Map = {
    CanSetUserWaypointOnMap = function(map) return true end,
    SetUserWaypoint = function(p) assert(p and p.map) M.waypoint = p end,
    HasUserWaypoint = function() return M.waypoint ~= nil end,
    ClearUserWaypoint = function() M.waypoint = nil end,
    GetBestMapForUnit = function(u) assert(u == "player") return 1413 end,
    GetPlayerMapPosition = function(map, u) return { GetXY = function() return 0.502, 0.421 end } end,
    GetMapInfo = function(map) return { name = "Karte" .. map } end,
  }
  G.TooltipDataProcessor = { AddTooltipPostCall = function(kind, fn) assert(kind == 0, "Item-Tooltip-Typ") M.tooltipHook = fn end }
  G.Enum.TooltipDataType = { Item = 0, Spell = 1, Unit = 2 }
  G.InCombatLockdown = function() return M.combat == true end
  G.UnitCastingInfo = function(unit)
    assert(type(unit) == "string")
    local c = M.casting
    if not c then return nil end
    return c.name, c.name, 136246, c.start, c.stop, c.trade ~= false, "cast-guid", false, c.spell or 0, nil, 0
  end
  G.ItemRefTooltip = {}
  G.CanMerchantRepair = function() return true end
  G.GetRepairAllCost = function() return M.repairCost or 0, (M.repairCost or 0) > 0 end
  G.RepairAllItems = function() M.repaired = true end
  G.C_SuperTrack = { SetSuperTrackedUserWaypoint = function(v) M.superTracked = v end }
  G.OpenWorldMap = function(map) M.mapOpened = map end
  -- Berufe
  G.C_SkillInfo = {
    GetNumSkillLines = function() return #(M.skills or {}) end,
    GetSkillLineInfo = function(i) return (M.skills or {})[i] end,
    ExpandSkillHeader = function(i) local s = M.skills[i]; if s then s.isCollapsed = false end end,
  }
  -- Taschen
  G.C_Container = {
    GetContainerNumSlots = function(bag) return (M.bags and M.bags[bag]) and #M.bags[bag] or 0 end,
    GetContainerItemInfo = function(bag, slot) local b = M.bags and M.bags[bag]; return b and b[slot] or nil end,
    UseContainerItem = function(bag, slot) assert(type(bag) == "number" and type(slot) == "number") M.sold = (M.sold or 0) + 1 M.bags[bag][slot] = nil end,
  }
  -- Händler
  G.GetMerchantNumItems = function() return #(M.merchant or {}) end
  G.GetMerchantItemID = function(i) local m = M.merchant[i]; return m and m.id end
  G.GetMerchantItemLink = function(i) local m = M.merchant[i]; return m and ("|Hitem:" .. m.id .. "|h") end
  G.ATTACHMENTS_MAX_RECEIVE = 16
  G.C_AuctionHouse = {
    GetNumCommoditySearchResults = function(id) return #((M.ahResults or {})[id] or {}) end,
    GetCommoditySearchResultInfo = function(id, i) local r = (M.ahResults or {})[id] r = r and r[i] if r then return { itemID = id, unitPrice = r[1], quantity = r[2], containsOwnerItem = r[3] or false } end end,
    GetNumItemSearchResults = function(key) return #((M.ahResults or {})[key.itemID] or {}) end,
    GetItemSearchResultInfo = function(key, i) local r = (M.ahResults or {})[key.itemID] r = r and r[i] if r then return { buyoutAmount = r[1], quantity = r[2], containsOwnerItem = r[3] or false } end end,
    QueryOwnedAuctions = function(sorts) assert(type(sorts) == "table") M.ownedQueried = (M.ownedQueried or 0) + 1 end,
    GetNumOwnedAuctions = function() return #(M.owned or {}) end,
    GetOwnedAuctionInfo = function(i) return (M.owned or {})[i] end,
    SendSearchQuery = function(key, sorts, separate) assert(type(key) == "table" and type(sorts) == "table" and type(separate) == "boolean") M.searchedKeys = M.searchedKeys or {} table.insert(M.searchedKeys, key.itemID) end,
    IsThrottledMessageSystemReady = function() return true end,
    GetItemKeyInfo = function(key) return { itemID = key.itemID, isCommodity = not (M.nonCommodity or {})[key.itemID] } end,
    MakeItemKey = function(id) return { itemID = id, itemLevel = 0, itemSuffix = 0, battlePetSpeciesID = 0 } end,
  }
  G.AUCTION_EXPIRED_MAIL_SUBJECT = "Auktion abgelaufen: %s"
  G.GetRealmName = function() return "Forever-Testrealm" end
  -- Post: M.mails = { { subject, money, daysLeft, invoice = { type, item, player, bid, count } } }
  G.GetInboxHeaderInfo = function(i)
    local m = (M.mails or {})[i]
    if not m then return nil end
    return 1, nil, "Auktionshaus", m.subject or "", m.money or 0, 0, m.daysLeft or 29.5, m.items or 0
  end
  G.GetInboxInvoiceInfo = function(i)
    local m = (M.mails or {})[i]
    local v = m and m.invoice
    if not v then return nil end
    return v[1], v[2], v[3], v[4], v[4], 0, 0, 0, 0, 0, v[5]
  end
  G.HasNewMail = function() return M.newMail and true or false end
  G.GetLatestThreeSenders = function() if M.newMail then return "Auktionshaus" end end
  G.GetInboxNumItems = function() local n = math.max(#(M.inbox or {}), #(M.mails or {})) return n, n end
  G.GetInboxItem = function(i, slot) local m = (M.inbox or {})[i]; local a = m and m[slot]; if a then return "Item", a[1], 1, a[2] end end
  G.BuyMerchantItem = function(i, n)
    assert(type(i) == "number")
    local m = M.merchant and M.merchant[i]
    if m and m.maxStack then assert((n or 1) <= m.maxStack, "mehr als GetMerchantItemMaxStack pro Kauf") end
    M.bought = (M.bought or 0) + (n or 1)
    M.boughtByID = M.boughtByID or {}
    if m then M.boughtByID[m.id] = (M.boughtByID[m.id] or 0) + (n or 1) end
  end
  G.GetMerchantItemMaxStack = function(i) local m = M.merchant and M.merchant[i]; return m and (m.maxStack or 200) or 0 end
  G.MerchantFrame = make("Frame", UIParent, "MerchantFrame")
  G.C_MerchantFrame = {
    GetNumJunkItems = function() return M.junk or 0 end,
    SellAllJunkItems = function() M.junkSold = true M.junk = 0 end,
    GetItemInfo = function(i)
      local m = M.merchant[i]
      if not m then return nil end
      return { name = m.name, texture = 1, price = m.price, stackCount = m.stack or 1, numAvailable = m.avail or -1, isPurchasable = true,
        isUsable = true, hasExtendedCost = false }
    end,
  }
  -- Berufsfenster
  G.C_TradeSkillUI = {
    GetFilteredRecipeIDs = function() local ids = {} for id in pairs(M.recipes or {}) do ids[#ids + 1] = id end table.sort(ids) return ids end,
    GetRecipeInfo = function(id) local r = M.recipes[id]; return r and { name = r.name, learned = r.learned ~= false, isRecraft = false, relativeDifficulty = r.diff or 0, canSkillUp = true } end,
    GetRecipeSchematic = function(id, isRecraft)
      assert(type(isRecraft) == "boolean", "GetRecipeSchematic braucht isRecraft (bool)")
      local r = M.recipes[id]
      local slots = {}
      for _, re in ipairs(r.reagents) do
        slots[#slots + 1] = { reagents = { { itemID = re[1] } }, quantityRequired = re[2], reagentType = 1 }
      end
      return { recipeID = id, outputItemID = r.out, quantityMin = 1, quantityMax = 1, reagentSlotSchematics = slots }
    end,
    GetBaseProfessionInfo = function() return { professionName = "Schneiderei", skillLevel = 60, maxSkillLevel = 150 } end,
    OpenTradeSkill = function(skill) assert(type(skill) == "number") M.openedSkill = skill return true end,
    CraftRecipe = function(id, n, reagents) assert(type(id) == "number" and type(n) == "number") assert(type(reagents) == "table", "Materialliste wie Blizzard") M.crafted = (M.crafted or 0) + n M.craftedID = id end,
    OpenRecipe = function(id) assert(type(id) == "number") M.opened = id end,
  }
  -- Auctionator (öffentliche API v1, Argumentprüfung wie im Original)
  if opts.auctionator ~= false then
    M.prices = M.prices or {}
    M.lists = {}
    local function verify(callerID) if type(callerID) ~= "string" or callerID == "" then error("Invalid callerID. Use the name of your add-on.") end end
    G.Auctionator = { API = { v1 = {
      GetAuctionPriceByItemID = function(c, id) verify(c) assert(type(id) == "number", "Usage GetAuctionPriceByItemID(string, number)") return M.prices[id] end,
      GetAuctionAgeByItemID = function(c, id) verify(c) assert(type(id) == "number") return M.prices[id] and 1 or nil end,
      GetVendorPriceByItemID = function(c, id) verify(c) assert(type(id) == "number") return nil end,
      ConvertToSearchString = function(c, term) assert(type(term) == "table" and type(term.searchString) == "string") return '"' .. term.searchString .. '"' end,
      CreateShoppingList = function(c, name, terms) verify(c) assert(type(name) == "string" and type(terms) == "table") M.lists[name] = terms end,
      MultiSearchExact = function(c, terms) verify(c) assert(type(terms) == "table") M.searched = terms end,
      RegisterForDBUpdate = function(c, cb) verify(c) assert(type(cb) == "function") M.dbCallback = cb end,
    } },
      State = { FullScanFrameRef = { InitiateScan = function() M.scanStarted = true end },
        IncrementalScanFrameRef = { InitiateScan = function() M.scanStarted = true end } },
      Config = { Options = { REPLICATE_SCAN = "replicate_scan" }, Get = function() return true end },
    }
  else
    G.Auctionator = nil
  end
end

-- Ereignis an alle registrierten Rahmen senden
function M.fire(event, ...)
  for _, f in ipairs((M.registered or {})[event] or {}) do
    call(f, "OnEvent", event, ...)
  end
end

-- Alle anstehenden C_Timer.After-Aufrufe ausführen
function M.flush()
  for _ = 1, 10 do
    local list = M.timers
    if #list == 0 then return end
    M.timers = {}
    for _, fn in ipairs(list) do fn() end
  end
end

return M
