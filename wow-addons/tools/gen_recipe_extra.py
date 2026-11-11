#!/usr/bin/env python3
"""Erzeugt TirysZentrale/Data_RecipeExtra.lua: Zusatzdaten zu den Rezepten, die gen_recipes.py nicht liest.
- Station je Rezept (Amboss, Gerbrahmen, Spinnrad …): SpellCastingRequirements.RequiresSpellFocus + SpellFocusObject (deDE)
  Art: "town" = Amboss/Schmiede/Kochstelle (überall in Städten), "camp" = Lager-Station, die ein Spieler am Lagerfeuer
  aufstellt (es gibt ein gleichnamiges Rezept = Bausatz), "place" = feste Station an einem besonderen Ort.
- Zufallsmenge (z. B. Grobes Dynamit 1–3): SpellEffect.Variance -> Basis × (1 ± Variance/2).
- Herkunft der Rezept-Items (Muster, Pläne …): QuestieDB Forever (vendors / npcDrops+objectDrops+itemDrops / Quest).
Quellen: wago.tools DB2, Build 1.60.1.70888 (Forever), QuestieDB data/Forever/foreverItemDB.lua (GPL-3.0).
Aufruf: python3 -I tools/gen_recipe_extra.py <csv-ordner Forever> <SpellFocusObject deDE.csv> <foreverItemDB.lua>"""
import csv, os, re, sys

src, focus_de, qitems = sys.argv[1:4]
here = os.path.dirname(os.path.abspath(__file__))
zdir = os.path.normpath(os.path.join(here, "..", "TirysZentrale"))
def rd(path): return csv.DictReader(open(path, encoding="utf-8"))

recipes = {}
for line in open(os.path.join(zdir, "Data_Recipes.lua"), encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if len(p) == 9 and p[1].isdigit():
        recipes[int(p[1])] = p
by_name = {}
for sid, p in recipes.items():
    by_name.setdefault(p[2], sid)

focus_name = {int(r["ID"]): r["Name_lang"] for r in rd(focus_de)}
TOWN = {1, 3, 4}  # Amboss, Schmiede, Kochstelle
station = {}
for r in rd(os.path.join(src, "SpellCastingRequirements.csv")):
    sid, f = int(r["SpellID"]), int(r["RequiresSpellFocus"] or 0)
    if sid in recipes and f > 0:
        station[sid] = f
used = sorted(set(station.values()))
kinds = {}
for f in used:
    name = focus_name.get(f, str(f))
    kit = by_name.get(name)
    if f in TOWN:
        kinds[f] = (name, "town", None)
    elif kit and kit not in station:
        kinds[f] = (name, "camp", kit)
    else:
        kinds[f] = (name, "place", None)

yields = {}
for r in rd(os.path.join(src, "SpellEffect.csv")):
    sid = int(r["SpellID"])
    if sid in recipes and r["Effect"] == "24" and int(r["EffectIndex"]) == 0:
        v, b = float(r["Variance"] or 0), float(r["EffectBasePointsF"] or 0)
        if v > 0 and b > 0:
            lo, hi = round(b * (1 - v / 2)), round(b * (1 + v / 2))
            if hi > lo:
                yields[sid] = (max(1, lo), hi)

ri = {int(a): int(b) for a, b in re.findall(r"\[(\d+)\] = \{ (\d+), \d+, \d+ \}", open(os.path.join(zdir, "Data_RecipeItems.lua"), encoding="utf-8").read())}
want = set(ri.values())
def fields(s):
    parts, depth, cur, q, i = [], 0, "", False, 0
    while i < len(s):
        ch = s[i]
        if ch == "\\" and q:
            cur += s[i:i + 2]; i += 2; continue
        if ch == "'":
            q = not q
        if not q and ch == "{": depth += 1
        if not q and ch == "}": depth -= 1
        if not q and depth == 0 and ch == ",":
            parts.append(cur); cur = ""
        else:
            cur += ch
        i += 1
    parts.append(cur)
    return parts
def has(p, i): return len(p) > i and p[i].strip() not in ("nil", "", "{}")
srcs = {}
for line in open(qitems, encoding="utf-8"):
    m = re.match(r"\[(\d+)\] = \{(.*)\},?$", line.strip())
    if not m or int(m.group(1)) not in want:
        continue
    p = fields(m.group(2))
    if has(p, 13): srcs[int(m.group(1))] = "v"
    elif has(p, 1) or has(p, 2) or has(p, 3): srcs[int(m.group(1))] = "d"
    elif has(p, 4) or has(p, 5): srcs[int(m.group(1))] = "q"

out = ["-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_recipe_extra.py – nicht von Hand bearbeiten.",
       "-- Quellen: WoW-Forever-Spieldaten 1.60.1.70888 (wago.tools) und QuestieDB Forever (GPL-3.0, siehe LIZENZ.txt).",
       "local _, ns = ...",
       "-- Station: { Name, Art (town = Stadt, camp = Lager-Station am Lagerfeuer, place = besonderer Ort), Bausatz-Rezept }",
       "ns.STATIONS = {"]
for f in used:
    name, kind, kit = kinds[f]
    out.append(f'  [{f}] = {{ "{name}", "{kind}", {kit or "nil"} }},')
out.append("}")
out.append(f"-- Rezept-Zauber -> Station ({len(station)} Rezepte)")
out.append("ns.RECIPE_STATION = {")
row = []
for sid in sorted(station):
    row.append(f"[{sid}]={station[sid]},")
    if len(row) == 10:
        out.append("  " + " ".join(row)); row = []
if row: out.append("  " + " ".join(row))
out.append("}")
out.append("-- Zufallsmenge je Herstellung { von, bis } (gespeichert ist der Mittelwert)")
out.append("ns.RECIPE_YIELD = {")
for sid in sorted(yields):
    out.append(f"  [{sid}] = {{ {yields[sid][0]}, {yields[sid][1]} }}, -- {recipes[sid][2]}")
out.append("}")
out.append('-- Rezept-Item -> Herkunft: "v" = Händler, "d" = Beute (Gegner/Truhe), "q" = Quest; fehlt = unbekannt')
out.append("ns.RECIPE_ITEM_SRC = {")
row = []
for it in sorted(srcs):
    row.append(f'[{it}]="{srcs[it]}",')
    if len(row) == 10:
        out.append("  " + " ".join(row)); row = []
if row: out.append("  " + " ".join(row))
out.append("}")
open(os.path.join(zdir, "Data_RecipeExtra.lua"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("Stationen:", {kinds[f][0]: kinds[f][1] for f in used})
print(len(station), "Rezepte mit Station,", len(yields), "Zufallsmengen,", len(srcs), "von", len(want), "Rezept-Items mit Herkunft")
