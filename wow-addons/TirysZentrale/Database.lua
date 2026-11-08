-- Tiry's Zentrale – komplette Item-Datenbank (alle Gegenstände von WoW Forever, deutsch)
-- Die Rohdaten (Data_AllItems.lua) werden erst beim ersten Gebrauch eingelesen.
local ADDON, ns = ...

local D = {}
ns.DB = D

-- Kleinschreibung inkl. deutscher Umlaute (string.lower kennt kein UTF-8)
local UPPER = { ["Ä"] = "ä", ["Ö"] = "ö", ["Ü"] = "ü" }
function D.Lower(s)
  s = (s or ""):lower()
  return (s:gsub("\195[\132\150\156]", UPPER))
end

function D.Load()
  if D.list then return D.list end
  local list, byID = {}, {}
  local raw = ns.ALLDB_RAW or ""
  for id, name, q, c, s, icon, sell, stack, req, ilvl, bind in
      raw:gmatch("(%d+)\t([^\t\n]+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)\t(%d+)") do
    local e = {
      id = tonumber(id), name = name, q = tonumber(q), class = tonumber(c), sub = tonumber(s),
      icon = tonumber(icon), sell = tonumber(sell), stack = tonumber(stack), req = tonumber(req),
      ilvl = tonumber(ilvl), bind = tonumber(bind),
    }
    e.lname = D.Lower(name)
    e.skey = e.lname:gsub("\195\164", "a"):gsub("\195\182", "o"):gsub("\195\188", "u"):gsub("\195\159", "ss")
    list[#list + 1] = e
    byID[e.id] = e
  end
  D.list, D.byID = list, byID
  ns.ALLDB_RAW = nil -- Rohtext freigeben
  return list
end

function D.Get(id)
  D.Load()
  return D.byID[id]
end

function D.ClassName(e)
  return ns.ITEM_CLASSES[e.class] or "?"
end

function D.SubName(e)
  return ns.ITEM_SUBCLASSES[e.class * 100 + e.sub]
end

local BIND = { [1] = "Beim Aufheben gebunden", [2] = "Beim Anlegen gebunden", [3] = "Beim Benutzen gebunden", [4] = "Questgegenstand" }
function D.BindText(e)
  return BIND[e.bind]
end

-- Suche: Textteile müssen alle vorkommen (z. B. "rot tasche"); Filter und Sortierung optional
function D.Search(text, filter, sortKey)
  local list = D.Load()
  local words = {}
  for w in D.Lower(text or ""):gmatch("%S+") do words[#words + 1] = w end
  local idQuery = tonumber(text or "")
  local out = {}
  for i = 1, #list do
    local e = list[i]
    local ok = true
    if idQuery then
      ok = (e.id == idQuery)
    else
      for w = 1, #words do
        if not e.lname:find(words[w], 1, true) then ok = false break end
      end
    end
    if ok and filter then ok = filter(e) end
    if ok then out[#out + 1] = e end
  end
  local M = ns.Market
  if sortKey == "ah" then
    for _, e in ipairs(out) do e._ah = M.Price(e.id) or -1 end
    table.sort(out, function(a, b) if a._ah ~= b._ah then return a._ah > b._ah end return a.name < b.name end)
  elseif sortKey == "sell" then
    table.sort(out, function(a, b) if a.sell ~= b.sell then return a.sell > b.sell end return a.name < b.name end)
  elseif sortKey == "level" then
    table.sort(out, function(a, b) if a.req ~= b.req then return a.req > b.req end if a.ilvl ~= b.ilvl then return a.ilvl > b.ilvl end return a.name < b.name end)
  else
    table.sort(out, function(a, b) if a.skey ~= b.skey then return a.skey < b.skey end return a.id < b.id end)
  end
  return out
end
