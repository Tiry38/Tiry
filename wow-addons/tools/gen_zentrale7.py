"""RezeptRadar - kompakte Daten fuer den Rezept-Berater (Kochen + Lederverarbeitung) -> addons/RezeptRadar/Data_Craft.lua

Quelle: tools/zentrale_src/ - die aus den Forever-Spieldaten erzeugten Dateien Data_Recipes.lua, Data_RecipeItems.lua und
Data_AllItems.lua (Item-Name, Qualitaet, Symbol, Haendler-Verkaufspreis, Bindung). Nur Rezepte, die ein Rezept-Item
haben (nur die kann man im AH kaufen). Hotfixes (Data_Hotfix.lua) legt das Add-on zur Laufzeit darueber.
Aufruf (aus wow-addons/): python3 -I tools/gen_zentrale7.py
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
TZ = os.path.join(os.path.dirname(HERE), "addons", "RezeptRadar")
PROFS = ("COOKING", "LEATHERWORKING")


SRC = os.path.join(HERE, "zentrale_src")  # Rohdaten (frueher im Add-on, erzeugt von gen_recipes/gen_recipe_items/gen_alldb)


def read(name):
    return open(os.path.join(SRC, name), encoding="utf-8").read()


def main():
    items = {}
    raw = read("Data_RecipeItems.lua")
    for spell, item, skill, rep in re.findall(r"\[(\d+)\]\s*=\s*\{\s*(\d+),\s*(\d+),\s*(\d+)\s*\}", raw):
        items[int(spell)] = (int(item), int(skill), int(rep))
    rows, need = [], set()
    for line in read("Data_Recipes.lua").splitlines():
        p = line.split("\t")
        if len(p) != 9 or p[0] not in PROFS:
            continue
        spell = int(p[1])
        if spell not in items:
            continue
        ri, skill, rep = items[spell]
        mats = re.findall(r"(\d+)x(\d+)", p[8])
        rows.append((p[0], spell, p[2], int(p[3]), int(p[4]), skill, int(p[6]), int(p[7]), ri, rep,
                     ",".join("%sx%s" % m for m in mats)))
        need.add(int(p[3])); need.add(ri)
        need.update(int(m[0]) for m in mats)
    info = {}
    body = read("Data_AllItems.lua").split("ns.ALLDB_RAW = [==[", 1)[1]
    for line in body.splitlines():
        p = line.split("\t")
        if len(p) == 11 and p[0].isdigit() and int(p[0]) in need:
            # ID, Name, Qualitaet, Klasse, Unterklasse, Symbol, Haendlerpreis, Stapel, Mindestlevel, Stufe, Bindung
            info[int(p[0])] = (p[1], int(p[2]), int(p[5]), int(p[6]), int(p[10]))
    missing = sorted(need - set(info))
    out = os.path.join(TZ, "Data_Craft.lua")
    with open(out, "w", encoding="utf-8") as f:
        f.write("-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_zentrale7.py - nicht von Hand bearbeiten.\n")
        f.write("-- Kaufbare Rezepte (Rezept-Item) fuer Kochen und Lederverarbeitung aus den Spieldaten von WoW Forever (deutsch).\n")
        f.write("-- Zeile: Beruf, Zauber, Name, Ergebnis, Menge, lernbar ab, gelb, grau, Rezept-Item, Ruf noetig, Material (ID x Anzahl)\n")
        f.write("local _, ns = ...\nns.CRAFT_RAW = [==[\n")
        for r in sorted(rows, key=lambda r: (r[0], r[5], r[1])):
            f.write("\t".join(str(x) for x in r) + "\n")
        f.write("]==]\n")
        f.write("-- Item: { Name, Qualitaet, Symbol, Haendler-Verkaufspreis (Kupfer), Bindung (1 = beim Aufheben gebunden) }\n")
        f.write("ns.CRAFT_ITEMS = {\n")
        for i in sorted(info):
            n, q, icon, sell, bind = info[i]
            f.write('  [%d] = { "%s", %d, %d, %d, %d },\n' % (i, n.replace('"', '\\"'), q, icon, sell, bind))
        f.write("}\n")
    print("%d Rezepte, %d Items (%d ohne Daten) -> %s" % (len(rows), len(info), len(missing), out))
    for p in PROFS:
        print("  ", p, sum(1 for r in rows if r[0] == p))


if __name__ == "__main__":
    main()
