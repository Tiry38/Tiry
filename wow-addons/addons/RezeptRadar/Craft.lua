-- RezeptRadar 1.0 – Rezepte (Kochkunst + Lederverarbeitung, nur kaufbare mit Rezept-Item) und
-- Erkennung, welche du schon kannst: Zauberbuch (C_SpellBook) + Berufsfenster (C_TradeSkillUI) + "Neues Rezept".
local _, ns = ...

local C = {}
ns.Craft = C

local list, bySpell, byOut

-- Zeile: Beruf, Zauber, Name, Ergebnis, Menge, lernbar ab, gelb, grau, Rezept-Item, Ruf nötig, Material
function C.Load()
  if list then return list end
  list, bySpell, byOut = {}, {}, {}
  for prof, spell, name, out, qty, learn, yellow, grey, item, rep, mats in (ns.CRAFT_RAW or ""):gmatch(
      "(%u[%u_]*)\t(%d+)\t([^\t]+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d)\t([^\n]+)") do
    local reagents = {}
    for id, n in mats:gmatch("(%d+)x(%d+)") do reagents[#reagents + 1] = { id = tonumber(id), n = tonumber(n) } end
    local r = {
      prof = prof, id = tonumber(spell), name = name, out = tonumber(out), qty = tonumber(qty),
      learn = tonumber(learn), yellow = tonumber(yellow), grey = tonumber(grey), item = tonumber(item),
      rep = rep == "1", reagents = reagents,
    }
    local hf = ns.HOTFIX and ns.HOTFIX.recipes and ns.HOTFIX.recipes[r.id] -- Blizzard-Hotfixes (serverseitig)
    if hf then r.learn, r.yellow, r.grey = hf.learn or r.learn, hf.yellow or r.yellow, hf.grey or r.grey end
    list[#list + 1] = r
    bySpell[r.id] = r
    byOut[prof] = byOut[prof] or {}
    byOut[prof][r.out] = byOut[prof][r.out] or r
  end
  ns.CRAFT_RAW = nil
  return list
end

function C.Get(spell) C.Load() return bySpell[spell] end

-- Alle Items, die der Berater im AH-Scan braucht: Ergebnisse, Material, Rezept-Items
local watch
function C.Watch()
  if watch then return watch end
  watch = {}
  for _, r in ipairs(C.Load()) do
    watch[r.out], watch[r.item] = true, true
    for _, re in ipairs(r.reagents) do watch[re.id] = true end
  end
  return watch
end

function C.IsKnown(r)
  if C_SpellBook and C_SpellBook.IsSpellKnown then
    local ok, known = pcall(C_SpellBook.IsSpellKnown, r.id)
    if ok and known then return true end
  end
  local l = ns.char and ns.char.learned
  return l ~= nil and l[r.id] == true
end

-- Skill-Farbe bei deinem Stand: orange (sicher +1), gelb (meist), grün (selten), grau (nie)
function C.Color(r, rank)
  if rank >= r.grey then return "grey" end
  if rank < r.yellow then return "orange" end
  if rank < math.floor((r.yellow + r.grey) / 2) then return "yellow" end
  return "green"
end
C.SKILLUP = { orange = true, yellow = true, green = true, grey = false }

----------------------------------------------------------------------------
-- Berufsfenster lesen: welche Rezepte sind gelernt? (zuverlässiger als das Zauberbuch)
----------------------------------------------------------------------------
local function openProfKey()
  if not (C_TradeSkillUI and C_TradeSkillUI.GetBaseProfessionInfo) then return nil end
  local ok, info = pcall(C_TradeSkillUI.GetBaseProfessionInfo)
  local pname = ok and info and info.professionName
  if not pname then return nil end
  for key, id in pairs(ns.PROF) do
    local p = ns.professions[id]
    if (p and p.name == pname) or ns.PROF_LABEL[key] == pname then return key end
  end
end
C.OpenProfKey = openProfKey

function C.ScanTradeSkill()
  local TS = C_TradeSkillUI
  if not (TS and TS.GetRecipeInfo) then return 0 end
  local key = openProfKey()
  if not key then return 0 end
  C.Load()
  local ids, seen = {}, {}
  if TS.GetFilteredRecipeIDs then
    for _, id in ipairs(TS.GetFilteredRecipeIDs() or {}) do
      if not seen[id] then seen[id] = true ids[#ids + 1] = id end
    end
  end
  for _, r in ipairs(list) do -- eigene Rezepte direkt abfragen (Filter/Suchfeld im Fenster spielen keine Rolle)
    if r.prof == key and not seen[r.id] then seen[r.id] = true ids[#ids + 1] = r.id end
  end
  local n = 0
  for _, id in ipairs(ids) do
    local ok, info = pcall(TS.GetRecipeInfo, id)
    if ok and info and info.learned ~= nil and not info.isRecraft then
      local r = bySpell[id]
      if not (r and r.prof == key) and TS.GetRecipeSchematic then
        local ok2, s = pcall(TS.GetRecipeSchematic, id, false)
        r = ok2 and s and s.outputItemID and byOut[key] and byOut[key][s.outputItemID] or nil
      end
      if r then
        if info.learned then ns.char.learned[r.id] = true n = n + 1 end
      end
    end
  end
  ns.char.seen[key] = time()
  ns.Fire("KNOWN_CHANGED")
  return n
end

local function rescan() ns.Debounce("tradeskill", 0.8, C.ScanTradeSkill) end
ns.On("TRADE_SKILL_SHOW", rescan)
ns.On("TRADE_SKILL_LIST_UPDATE", rescan)
ns.On("TRADE_SKILL_DATA_SOURCE_CHANGED", rescan)
ns.On("NEW_RECIPE_LEARNED", function(_, recipeID)
  local r = recipeID and C.Get(recipeID)
  if r then ns.char.learned[r.id] = true end
  ns.Debounce("learned", 0.3, function() ns.Fire("KNOWN_CHANGED") end)
end)
ns.On("LEARNED_SPELL_IN_SKILL_LINE", function()
  ns.Debounce("learned", 0.3, function() ns.Fire("KNOWN_CHANGED") end)
end)
