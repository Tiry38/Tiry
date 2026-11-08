-- Tiry's Zentrale – komplette Item-Datenbank (alle Gegenstände von WoW Forever, deutsch)
-- Speicherschonend: Die Rohdaten (Data_AllItems.lua, ~1 MB Text) werden NICHT mehr komplett in Tabellen
-- verwandelt (das kostete 17,5 MB und 76 ms Ruckler). Stattdessen:
--   * D.Get(id)     -> Index ID -> Textposition (einmalig ~20 ms), dann nur diese eine Zeile lesen (Cache)
--   * D.Search(...) -> durchsucht den Text direkt, baut nur die Treffer als Tabellen
--   * D.IDByName    -> Namensindex erst, wenn er gebraucht wird (Verkaufsbuch)
local _, ns = ...

local D = {}
ns.DB = D

-- Kleinschreibung inkl. deutscher Umlaute (string.lower kennt kein UTF-8)
local UPPER = { ["Ä"] = "ä", ["Ö"] = "ö", ["Ü"] = "ü" }
function D.Lower(s)
  s = (s or ""):lower()
  return (s:gsub("\195[\132\150\156]", UPPER))
end

local function sortKey(lname)
  return (lname:gsub("\195\164", "a"):gsub("\195\182", "o"):gsub("\195\188", "u"):gsub("\195\159", "ss"))
end

-- Interne Platzhalter des Spiels, die kein Spieler je sieht
local JUNK = { "(DNT)", "DNT ", "NYI", "OBSOLETE", "DEPRECATED", "Deprecated", "[PH]", "Monster -", "zzOLD", "QA " }
local function isJunk(name)
  for i = 1, #JUNK do
    if name:find(JUNK[i], 1, true) then return true end
  end
  return false
end
D.IsJunk = isJunk

local raw         -- "\n" .. Rohtext (jede Zeile beginnt mit \n)
local index       -- [id] = Position direkt hinter "ID\t"
local cache = {}  -- [id] = Eintrag
local LINE = "^([^\t\n]+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)"

local function source()
  if not raw then
    raw = "\n" .. (ns.ALLDB_RAW or "")
    ns.ALLDB_RAW = nil -- nur noch eine Kopie im Speicher
  end
  return raw
end

local function build(id, pos)
  local name, q, c, s, icon, sell, stack, req, ilvl, bind = source():match(LINE, pos)
  if not name then return nil end
  return {
    id = id, name = name, q = tonumber(q), class = tonumber(c), sub = tonumber(s), icon = tonumber(icon),
    sell = tonumber(sell), stack = tonumber(stack), req = tonumber(req), ilvl = tonumber(ilvl), bind = tonumber(bind),
  }
end

local function buildIndex()
  if index then return index end
  index = {}
  for id, pos in source():gmatch("\n(%d+)\t()") do index[tonumber(id)] = pos end
  return index
end

-- Ein Item nach ID (nil, wenn unbekannt)
function D.Get(id)
  id = tonumber(id)
  if not id then return nil end
  local e = cache[id]
  if e ~= nil then return e or nil end
  local pos = buildIndex()[id]
  e = pos and build(id, pos) or false
  cache[id] = e
  return e or nil
end

-- Anzahl der Einträge (für Tests und Anzeige)
function D.Count()
  local n = 0
  for _ in pairs(buildIndex()) do n = n + 1 end
  return n
end

-- Durchläuft alle Items ohne sie zu speichern: fn(entry) – Rückgabe true bricht ab
function D.Each(fn)
  local src = source()
  for id, pos in src:gmatch("\n(%d+)\t()") do
    local e = build(tonumber(id), pos)
    if e and fn(e) then return end
  end
end

function D.ClassName(e)
  return ns.ITEM_CLASSES[e.class] or "?"
end

function D.SubName(e)
  return e and ns.ITEM_SUBCLASSES[e.class * 100 + e.sub]
end

local BIND = { [1] = "Beim Aufheben gebunden", [2] = "Beim Anlegen gebunden", [3] = "Beim Benutzen gebunden", [4] = "Questgegenstand" }
function D.BindText(e)
  return BIND[e.bind]
end

-- Item-ID über den (deutschen) Namen; handelbare Items bevorzugt. Index erst beim ersten Bedarf.
local nameIndex
function D.IDByName(name)
  if not name then return nil end
  if not nameIndex then
    nameIndex = {}
    local bound = {}
    for id, nm, bind in source():gmatch("\n(%d+)\t([^\t\n]+)\t%d+\t%d+\t%d+\t%d+\t%d+\t%d+\t%d+\t%d+\t(%d+)") do
      local cur = nameIndex[nm]
      if not cur or (bound[nm] and bind ~= "1") then
        nameIndex[nm] = tonumber(id)
        bound[nm] = (bind == "1")
      end
    end
  end
  return nameIndex[name]
end

-- Suche: alle Wörter müssen im Namen vorkommen (z. B. "rot tasche"); Filter und Sortierung optional.
-- Nur Treffer werden zu Tabellen – nach der Suche gibt der Speicher alles wieder frei.
function D.Search(text, filter, sortBy)
  local words = {}
  for w in D.Lower(text or ""):gmatch("%S+") do words[#words + 1] = w end
  local idQuery = tonumber(text or "")
  local out = {}
  if idQuery then
    local e = D.Get(idQuery)
    if e and (not filter or filter(e)) then out[1] = e end
    return out
  end
  local src = source()
  for id, pos in src:gmatch("\n(%d+)\t()") do
    local name = src:match("^([^\t\n]+)", pos)
    local ok = name and not isJunk(name)
    if ok and #words > 0 then
      local lname = D.Lower(name)
      for w = 1, #words do
        if not lname:find(words[w], 1, true) then ok = false break end
      end
    end
    if ok then
      local e = cache[tonumber(id)] or build(tonumber(id), pos)
      if e and (not filter or filter(e)) then out[#out + 1] = e end
    end
  end
  local M = ns.Market
  if sortBy == "ah" then
    local price = {}
    for _, e in ipairs(out) do price[e] = M.Price(e.id) or -1 end
    table.sort(out, function(a, b) if price[a] ~= price[b] then return price[a] > price[b] end return a.name < b.name end)
  elseif sortBy == "sell" then
    table.sort(out, function(a, b) if a.sell ~= b.sell then return a.sell > b.sell end return a.name < b.name end)
  elseif sortBy == "level" then
    table.sort(out, function(a, b) if a.req ~= b.req then return a.req > b.req end if a.ilvl ~= b.ilvl then return a.ilvl > b.ilvl end return a.name < b.name end)
  else
    local key = {}
    for _, e in ipairs(out) do key[e] = sortKey(D.Lower(e.name)) end
    table.sort(out, function(a, b) if key[a] ~= key[b] then return key[a] < key[b] end return a.id < b.id end)
  end
  return out
end
