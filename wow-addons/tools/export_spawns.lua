-- Exportiert Fundorte aus QuestieDB Forever als TSV für tools/gen_spots.py:
-- N|O <TAB> id <TAB> name <TAB> minLevel <TAB> maxLevel <TAB> zoneID <TAB> x <TAB> y
local dir = arg[1]
local Q = {}
QuestieLoader = { ImportModule = function() return Q end }
local function load(file, field, nameIdx, spawnIdx, loIdx, hiIdx, tag)
  dofile(dir .. "/" .. file)
  local data = assert(loadstring(Q[field]))()
  local ids = {}
  for id in pairs(data) do ids[#ids + 1] = id end
  table.sort(ids)
  for _, id in ipairs(ids) do
    local e = data[id]
    local sp = e[spawnIdx]
    if type(sp) == "table" then
      local zones = {}
      for z in pairs(sp) do zones[#zones + 1] = z end
      table.sort(zones)
      for _, z in ipairs(zones) do
        for _, c in ipairs(sp[z]) do
          if c[1] and c[1] >= 0 then
            io.write(string.format("%s\t%d\t%s\t%d\t%d\t%d\t%s\t%s\n", tag, id, e[nameIdx] or "?",
              loIdx and e[loIdx] or 0, hiIdx and e[hiIdx] or 0, z, tostring(c[1]), tostring(c[2])))
          end
        end
      end
    end
  end
end
load("foreverNpcDB.lua", "npcData", 1, 7, 4, 5, "N")
load("foreverObjectDB.lua", "objectData", 1, 4, nil, nil, "O")
