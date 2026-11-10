#!/usr/bin/env python3
"""Erzeugt TirysZentrale/Data_AllItems.lua: ALLE Gegenstände aus den Spieldaten von WoW Forever (deutsch).

Quelle: DB2-Tabellen ItemSparse, Item, ItemClass, ItemSubClass des Forever-Builds über wago.tools, z. B.
  https://wago.tools/db2/ItemSparse/csv?build=1.60.1.70862&locale=deDE
Aufruf: python3 gen_alldb.py <Ordner mit ItemSparse_deDE.csv, Item.csv, ItemClass.csv, ItemSubClass.csv>
Interne Platzhalter (Monster-Waffen, "Deprecated", "OLD…", Test-Items) werden ausgelassen.
"""
import csv, os, re, sys
src = sys.argv[1]
BUILD = "1.60.1.70862"
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.normpath(os.path.join(here, "..", "TirysZentrale", "Data_AllItems.lua"))
bad = re.compile(r'(^Monster - |^Deprecated|DEPRECATED|^zz|\[PH\]|^TEST|^Test |^OLD|^QA |^\(OLD\)|Unused|UNUSED|^NPC Equip)')
items = {r['ID']: r for r in csv.DictReader(open(os.path.join(src, 'Item.csv'), encoding='utf-8'))}
rows, skipped = [], 0
for r in csv.DictReader(open(os.path.join(src, 'ItemSparse_deDE.csv'), encoding='utf-8')):
    name = (r['Display_lang'] or '').strip()
    if not name or bad.search(name):
        skipped += 1
        continue
    i = items[r['ID']]
    name = name.replace('\t', ' ').replace('\n', ' ').replace('\r', ' ')
    assert ']==]' not in name
    rows.append((int(r['ID']), name, int(r['OverallQualityID']), int(i['ClassID']), int(i['SubclassID']),
                 int(i['IconFileDataID'] or 0), int(r['SellPrice'] or 0), int(r['Stackable'] or 1),
                 int(r['RequiredLevel'] or 0), int(r['ItemLevel'] or 0), int(r['Bonding'] or 0)))
rows.sort()
classes = {int(r['ClassID']): r['ClassName_lang'] for r in csv.DictReader(open(os.path.join(src, 'ItemClass.csv'), encoding='utf-8'))}
subs = {}
for r in csv.DictReader(open(os.path.join(src, 'ItemSubClass.csv'), encoding='utf-8')):
    subs[(int(r['ClassID']), int(r['SubClassID']))] = r['DisplayName_lang'] or r['VerboseName_lang']
def q(s): return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
with open(out, 'w', encoding='utf-8') as f:
    f.write("-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_alldb.py – nicht von Hand bearbeiten.\n")
    f.write(f"-- Alle {len(rows)} Gegenstände aus den Spieldaten von WoW Forever {BUILD} (deutsch), Quelle: DB2 über wago.tools.\n")
    f.write("-- Je Zeile: ID, Name, Qualität, Klasse, Unterklasse, Symbol, Händlerpreis (Kupfer), Stapel, Mindestlevel, Gegenstandsstufe, Bindung\n")
    f.write("local _, ns = ...\n")
    f.write(f'ns.ALLDB_BUILD = "{BUILD}"\nns.ALLDB_COUNT = {len(rows)}\n')
    f.write("ns.ITEM_CLASSES = {\n" + "".join(f"  [{k}] = {q(v)},\n" for k, v in sorted(classes.items())) + "}\n")
    f.write("ns.ITEM_SUBCLASSES = {\n" + "".join(f"  [{c * 100 + s}] = {q(v)},\n" for (c, s), v in sorted(subs.items()) if s >= 0 and v) + "}\n")
    f.write("ns.ALLDB_RAW = [==[\n")
    for row in rows:
        f.write("\t".join(str(x) for x in row) + "\n")
    f.write("]==]\n")
print(out, len(rows), "Items,", skipped, "Platzhalter ausgelassen", os.path.getsize(out) // 1024, "KB")
