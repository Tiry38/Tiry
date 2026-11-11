-- RXPNeon: Live-Uebersetzung der englischen RestedXP-Schritt-Texte ins Deutsche.
-- Reihenfolge: 1) Quest-Titel ueber die Quest-ID  2) Namen in Farb-Markierungen und [Klammern]
-- 3) Ortsnamen im Fliesstext  4) Satz-Regeln aus Phrasen.lua (laengste zuerst).
-- Namen: Namen.lua (offizielle Spieldaten), Saetze: Phrasen.lua.

RXPNeon = RXPNeon or {}
local N = RXPNeon
local NAMES = RXN_NAMEN or {}
local npc, item, obj, ort, quest = NAMES.npc or {}, NAMES.item or {}, NAMES.obj or {}, NAMES.ort or {}, NAMES.quest or {}

local wipe = wipe or function(t) for k in pairs(t) do t[k] = nil end end
local function esc(s) return (s:gsub("[%^%$%(%)%%%.%[%]%*%+%-%?]", "%%%0")) end
-- Wortgrenzen inkl. Apostroph ("Sen'jin") – %f ist in Lua 5.1 vorhanden
local function bound(p) return "%f[%w']" .. p .. "%f[^%w']" end
local function repl(s) return (s:gsub("%%", "%%%%")) end

-- Ortsnamen: laengste zuerst, damit "Thousand Needles" vor "Needles" greift
local ORTE = {}
for en, de in pairs(ort) do ORTE[#ORTE + 1] = { bound(esc(en)), repl(de), en } end
table.sort(ORTE, function(a, b) return #a[3] > #b[3] end)

-- Satz-Regeln: "~"-Regeln sind Lua-Muster (in Listenreihenfolge, zuerst), alle anderen woertlich (laengste zuerst)
local PAT, LIT = {}, {}
local function compile()
  wipe(PAT); wipe(LIT)
  for _, r in ipairs(RXN_PHRASEN or {}) do
    local en, de = r:match("^(.-)%s*=>%s?(.*)$")
    if en and en ~= "" then
      if en:sub(1, 1) == "~" then
        PAT[#PAT + 1] = { en:sub(2), de }
      else
        -- Wortgrenzen nur dort, wo die Phrase mit Buchstaben beginnt/endet
        local p = esc(en)
        if en:match("^[%w']") then p = "%f[%w']" .. p end
        if en:match("[%w']$") then p = p .. "%f[^%w']" end
        LIT[#LIT + 1] = { p, repl(de), #en }
      end
    end
  end
  table.sort(LIT, function(a, b) return a[3] > b[3] end)
end
compile()
N.CompilePhrasen = compile

local function trim(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end

-- Name nachschlagen (NPC, Gegenstand, Objekt, Ort)
local function lookup(s)
  local t = trim(s)
  local d = npc[t] or item[t] or obj[t] or ort[t]
  if d then return (s:gsub(esc(t), repl(d), 1)) end
end
N.Lookup = lookup

local cache, cacheN = {}, 0

local function core(text)
  local c = cache[text]
  if c then return c end
  local s = text
  -- Namen in Farb-Markierungen: |cAARRGGBBName|r
  s = s:gsub("(|c%x%x%x%x%x%x%x%x)([^|]+)(|r)", function(a, inner, b)
    local d = lookup(inner)
    if d then return a .. d .. b end
  end)
  -- Gegenstaende/Zauber in eckigen Klammern
  s = s:gsub("%[([^%]|]+)%]", function(inner)
    local d = item[inner] or obj[inner]
    if d then return "[" .. d .. "]" end
  end)
  -- Ortsnamen im Fliesstext
  for i = 1, #ORTE do
    local o = ORTE[i]
    if s:find(o[3], 1, true) then s = s:gsub(o[1], o[2]) end
  end
  -- Satz-Regeln. Farbcodes/Symbole kleben direkt am Wort ("|cFF00FF00Kill") – \001 dahinter schafft eine Wortgrenze
  s = s:gsub("(|c%x%x%x%x%x%x%x%x)", "%1\001"):gsub("(|T[^|]*|t)", "%1\001")
  for i = 1, #PAT do s = s:gsub(PAT[i][1], PAT[i][2]) end
  for i = 1, #LIT do
    local r = LIT[i]
    s = s:gsub(r[1], r[2])
  end
  s = s:gsub("\001", ""):gsub("  +", " ")
  if cacheN > 20000 then cache, cacheN = {}, 0 end
  cache[text] = s; cacheN = cacheN + 1
  return s
end

-- Quest-Titel: "Accept <englischer Titel>" -> "Annehmen: <deutscher Titel>" (ueber die Quest-ID des Elements)
local VERB = { accept = { "Accept ", "Annehmen: " }, turnin = { "Turn in ", "Abgeben: " } }
local function questTitle(id)
  local de = quest[id]
  if not de and C_QuestLog and C_QuestLog.GetTitleForQuestID then
    local ok, t = pcall(C_QuestLog.GetTitleForQuestID, id)
    if ok and type(t) == "string" and t ~= "" then de = t end
  end
  return de
end
N.QuestTitle = questTitle

local function questSwap(text, el)
  local v = VERB[el.tag]
  local id = tonumber(el.questId)
  if not (v and id) then return end
  local a, b = text:find(v[1], 1, true)
  if not a then return end
  local tail = text:sub(b + 1)
  local de = questTitle(id)
  local endc = tail:match("|r%s*$") and "|r" or ""
  if not de then de = core(tail) ; endc = "" end
  return core(text:sub(1, a - 1)) .. v[2] .. de .. endc
end

-- Oeffentlich: Text uebersetzen; el = RXP-Element (optional, fuer Quest-Titel)
function N.T(text, el)
  if type(text) ~= "string" or text == "" then return text end
  if type(el) == "table" and el.tag and el.questId then
    local q = questSwap(text, el)
    if q then return q end
  end
  return core(text)
end

function N.ClearCache() cache, cacheN = {}, 0 end
