"""Tiry's Zentrale 7 - Haendler-Zutaten fuer Kochen und Lederverarbeitung -> TirysZentrale/Data_VendorMats.lua

Quelle Preis: Forever-Spieldaten ItemSparse (BuyPrice gilt fuer VendorStackCount Stueck -> Preis je Stueck).
Quelle "beim Haendler": QuestieDB Forever (Item-Feld vendors = NPC-IDs), Fraktion der Haendler aus tools/full.json.
Aufruf (aus wow-addons/): python3 -I tools/gen_vendor_mats.py <ordner mit ItemSparse.csv>
"""
import csv, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROFS = ("COOKING", "LEATHERWORKING")
# Haendler mit BEGRENZTEM Vorrat (wenige Stueck, Nachschub erst nach Zeit) - nicht als normale Einkaufsquelle rechnen:
# Leder, Kraeuter, Staub, Teufelsstoff, Verzaubertes Leder, Traenke (QuestieDB kennt den Vorrat nicht).
LIMITED = {785, 2447, 3356, 3357, 2319, 4234, 4304, 8170, 10940, 12810, 14256, 2455, 3385, 3827}


def reagents():
    raw = open(os.path.join(HERE, "zentrale_src", "Data_Recipes.lua"), encoding="utf-8").read()
    ids = set()
    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) == 9 and parts[0] in PROFS:
            for m in re.finditer(r"(\d+)x\d+", parts[8]):
                ids.add(int(m.group(1)))
    return ids


def questie_vendors(ids):
    db = os.path.join(ROOT, "qdb", "QuestieDB", "data", "Forever", "foreverItemDB.lua")
    lua = r"""
QuestieLoader = { ImportModule = function() return {} end }
local f = assert(io.open(arg[1], "rb")) local src = f:read("*a") f:close()
local env = {}
local data = src:match("itemData = %[%[(.-)%]%]")
local t = assert(loadstring(data))()
for id, v in pairs(t) do
  if v[14] and #v[14] > 0 then io.write(id, "\t", table.concat(v[14], ","), "\n") end
end
"""
    out = subprocess.run(["lua5.1", "-e", lua.replace("arg[1]", repr(db))], capture_output=True, text=True, check=True).stdout
    res = {}
    for line in out.splitlines():
        i, vs = line.split("\t")
        if int(i) in ids:
            res[int(i)] = [int(x) for x in vs.split(",")]
    return res


def main():
    src = sys.argv[1]
    ids = reagents()
    vend = questie_vendors(ids)
    npcs = json.load(open(os.path.join(HERE, "full.json"), encoding="utf-8"))["N"]
    sparse = {}
    for r in csv.DictReader(open(os.path.join(src, "ItemSparse.csv"), encoding="utf-8")):
        i = int(r["ID"])
        if i in vend:
            sparse[i] = (int(r["BuyPrice"] or 0), max(1, int(r["VendorStackCount"] or 1)), r["Display_lang"])
    rows = []
    for i in sorted(vend):
        if i not in sparse or sparse[i][0] <= 0 or i in LIMITED:
            continue
        price, stack, name = sparse[i]
        fac = set()
        for n in vend[i]:
            fr = (npcs.get(str(n)) or {}).get("fr")
            fac |= set(fr) if fr else {"A", "H"}
        rows.append((i, max(1, round(price / stack)), "".join(sorted(fac)), name))
    out = os.path.join(ROOT, "TirysZentrale", "Data_VendorMats.lua")
    with open(out, "w", encoding="utf-8") as f:
        f.write("-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_vendor_mats.py - nicht von Hand bearbeiten.\n")
        f.write("-- Zutaten fuer Kochen/Lederverarbeitung, die Haendler verkaufen: Preis je Stueck (Kupfer, Forever-Spieldaten)\n")
        f.write("-- und Fraktion der Haendler (A/H, QuestieDB Forever, GPL-3.0 - siehe LIZENZ.txt). Im Spiel gelernte Haendlerpreise gehen vor.\n")
        f.write("local _, ns = ...\nns.VENDOR_MATS = {\n")
        for i, p, fac, name in rows:
            f.write('  [%d] = { %d, "%s" }, -- %s\n' % (i, p, fac, name))
        f.write("}\n")
    print("%d Haendler-Zutaten -> %s" % (len(rows), out))


if __name__ == "__main__":
    main()
