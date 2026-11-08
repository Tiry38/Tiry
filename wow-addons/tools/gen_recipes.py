#!/usr/bin/env python3
"""Erzeugt TirysZentrale/Data_Recipes.lua: alle herstellbaren Rezepte der Forever-Spieldaten.
Quelle (wago.tools, Build 1.60.1.70862): SkillLineAbility, SpellReagents, SpellEffect (Effekt 24 = Item herstellen),
SpellName (deDE), ItemSparse (deDE) zur Prüfung, dass Ergebnis und Material echte Items sind.
Aufruf: python3 gen_recipes.py <csv-ordner>"""
import csv, os, sys, collections
src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.normpath(os.path.join(here, "..", "TirysZentrale", "Data_Recipes.lua"))
PROFS = {171: "ALCHEMY", 164: "BLACKSMITHING", 333: "ENCHANTING", 202: "ENGINEERING", 165: "LEATHERWORKING",
         197: "TAILORING", 185: "COOKING", 129: "FIRST_AID", 186: "MINING"}
def rd(n): return csv.DictReader(open(os.path.join(src, n), encoding="utf-8"))
items = {int(r["ID"]): r for r in rd("ItemSparse_deDE.csv")}
names = {int(r["ID"]): r["Name_lang"] for r in rd("SpellName.csv")}
reag = {int(r["SpellID"]): r for r in rd("SpellReagents.csv")}
create = {}
for r in rd("SpellEffect.csv"):
    if r["Effect"] == "24" and int(r["EffectItemType"] or 0) > 0:
        sid = int(r["SpellID"])
        if sid not in create or int(r["EffectIndex"]) < create[sid][2]:
            create[sid] = (int(r["EffectItemType"]), max(1, round(float(r["EffectBasePointsF"] or 1))), int(r["EffectIndex"]))
rows, seen, stats = [], set(), collections.Counter()
for r in rd("SkillLineAbility.csv"):
    skill, spell = int(r["SkillLine"]), int(r["Spell"])
    if skill not in PROFS or spell in seen or spell not in create:
        continue
    out_id, qty, _ = create[spell]
    if out_id not in items:
        continue
    rg = reag.get(spell)
    parts = []
    if rg:
        for i in range(8):
            iid, n = int(rg[f"Reagent_{i}"] or 0), int(rg[f"ReagentCount_{i}"] or 0)
            if iid > 0 and n > 0:
                if iid not in items:
                    parts = None
                    break
                parts.append(f"{iid}x{n}")
    if not parts:
        continue
    name = names.get(spell) or items[out_id]["Display_lang"]
    if any(b in name for b in ("Deprecated", "TEST", "[PH]", "OLD")):
        continue
    seen.add(spell)
    lo, hi = int(r["TrivialSkillLineRankLow"] or 0), int(r["TrivialSkillLineRankHigh"] or 0)
    rows.append((PROFS[skill], spell, name.replace("\t", " "), out_id, qty, int(r["MinSkillLineRank"] or 0), lo, hi, ",".join(parts)))
    stats[PROFS[skill]] += 1
rows.sort(key=lambda x: (x[0], x[5], x[2]))
with open(out, "w", encoding="utf-8") as f:
    f.write("-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_recipes.py – nicht von Hand bearbeiten.\n")
    f.write(f"-- {len(rows)} Rezepte aus den Spieldaten von WoW Forever 1.60.1.70862 (deutsch).\n")
    f.write("-- Je Zeile: Beruf, Zauber-ID, Name, Ergebnis-Item, Menge, ab Skill, gelb ab, grau ab, Material (ID x Anzahl)\n")
    f.write("local _, ns = ...\nns.RECIPES_RAW = [==[\n")
    for row in rows:
        f.write("\t".join(str(x) for x in row) + "\n")
    f.write("]==]\n")
print(out, len(rows), dict(stats))
