#!/usr/bin/env python3
"""Rezept-Items (mit nötigem Berufsskill aus ItemSparse.RequiredSkillRank) (Muster/Pläne/Formel/Rezept/Bauplan ...) -> Rezept-Zauber, aus den Forever-Spieldaten.
Quelle (wago.tools, Build 1.60.1.70862): ItemXItemEffect, ItemEffect, ItemSparse_deDE.
Ein Rezept-Item hat zwei Effekte: "Lernen" (Effekt 36) und den Rezept-Zauber selbst -> das ist die Zuordnung.
Aufruf: python3 tools/gen_recipe_items.py <csv-ordner>"""
import csv, os, re, sys

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
def rd(n): return csv.DictReader(open(os.path.join(src, n), encoding="utf-8"))

recipes = set(int(m) for m in re.findall(r"^[A-Z_]+\t(\d+)\t", open(os.path.join(here, "..", "TirysZentrale", "Data_Recipes.lua"), encoding="utf-8").read(), re.M))
effects = {int(r["ID"]): int(r["SpellID"]) for r in rd("ItemEffect.csv")}
items = {int(r["ID"]): r for r in rd("ItemSparse_deDE.csv")}
JUNK = ("(DNT)", "NYI", "OBSOLETE", "DEPRECATED", "Deprecated", "[PH]", "zzOLD", "Monster -")

by_spell = {}
for r in rd("ItemXItemEffect.csv"):
    item_id, spell = int(r["ItemID"]), effects.get(int(r["ItemEffectID"]))
    it = items.get(item_id)
    if spell in recipes and it is not None:
        name = it["Display_lang"]
        if any(j in name for j in JUNK):
            continue
        bonding = int(it.get("Bonding") or 0)
        req = int(it.get("RequiredSkillRank") or 0)
        by_spell.setdefault(spell, []).append((bonding == 1, item_id, req))  # handelbare zuerst, dann kleinste ID

out = ["-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_recipe_items.py – nicht von Hand bearbeiten.",
       "-- Rezept-Zauber -> { Rezept-Item (Muster, Pläne, Formel ...), nötiger Berufsskill } aus WoW Forever 1.60.1.70862.",
       "-- Rezepte ohne Eintrag lernt man beim Lehrer.",
       "local _, ns = ...",
       "ns.RECIPE_ITEMS = {"]
for spell in sorted(by_spell):
    _, best, req = sorted(by_spell[spell])[0]
    out.append(f"  [{spell}] = {{ {best}, {req} }},")
out.append("}")
open(os.path.join(here, "..", "TirysZentrale", "Data_RecipeItems.lua"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print(len(by_spell), "Rezepte mit Rezept-Item von", len(recipes))
