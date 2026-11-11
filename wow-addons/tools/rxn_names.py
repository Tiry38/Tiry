#!/usr/bin/env python3
"""Baut RXPNeon/Namen.lua: englische -> deutsche Namen fuer alles, was in den RestedXP-Forever-Guides vorkommt.

Aufruf:  python3 -I tools/rxn_names.py <Pfad zu RXPGuides> [<Cache-Ordner fuer wago-CSV>]

Quellen (nur Namen, keine Guide-Texte):
  - QuestieDB (GPL-3.0): data/Forever/forever{Npc,Item,Object,Quest}DB.lua (englisch)
    und l10n/Forever/lookup{Npcs,Items,Objects,Quests}/deDE.lua (deutsch) - Ordner wow-addons/qdb/QuestieDB
  - WoW-Forever-Spieldaten (DB2 AreaTable + TaxiNodes, enUS/deDE) ueber wago.tools, Build unten.
Die RXP-Guides werden nur gelesen, um zu wissen, WELCHE Namen gebraucht werden.
"""
import csv, glob, io, os, re, sys, urllib.request
from collections import Counter, defaultdict

BUILD = "1.60.1.70888"
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.abspath(os.path.join(HERE, ".."))
QDB = os.path.join(BASE, "qdb", "QuestieDB")
OUT = os.path.join(BASE, "addons", "RXPNeon", "Namen.lua")

rxp = sys.argv[1]
cache = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "__rxn_cache")
os.makedirs(cache, exist_ok=True)


def wago(table, loc):
    p = os.path.join(cache, f"{table}_{loc}.csv")
    if not os.path.exists(p):
        url = f"https://wago.tools/db2/{table}/csv?build={BUILD}&locale={loc}"
        with urllib.request.urlopen(url, timeout=120) as r, open(p, "wb") as f:
            f.write(r.read())
    return list(csv.DictReader(open(p, encoding="utf-8")))


def qdb_en(kind):
    out = {}
    pat = re.compile(r"""^\[(\d+)\] = \{(["'])((?:\\.|(?!\2).)*)\2""")
    for line in open(os.path.join(QDB, "data", "Forever", f"forever{kind}DB.lua"), encoding="utf-8"):
        m = pat.match(line)
        if m:
            out[int(m.group(1))] = m.group(3).replace("\\'", "'").replace('\\"', '"')
    return out


def qdb_de(kind):
    out = {}
    pat = re.compile(r"""^\[(\d+)\] = \{?"((?:\\.|[^"])*)\"""")
    for line in open(os.path.join(QDB, "l10n", "Forever", f"lookup{kind}", "deDE.lua"), encoding="utf-8"):
        m = pat.match(line)
        if m:
            out[int(m.group(1))] = m.group(2).replace('\\"', '"')
    return out


def en_de(en, de):
    """englischer Name -> haeufigster deutscher Name (ueber alle IDs mit diesem Namen)"""
    cnt = defaultdict(Counter)
    for i, n in en.items():
        d = de.get(i)
        if d and n:
            cnt[n][d] += 1
    return {n: c.most_common(1)[0][0] for n, c in cnt.items()}


# ---- 1. Was brauchen die Guides? ----
files = glob.glob(os.path.join(rxp, "Guides", "forever", "*.lua")) + \
        glob.glob(os.path.join(rxp, "Guides", "forever", "dungeon", "*.lua"))
spans, brackets, texts, qids = Counter(), Counter(), [], set()
for f in files:
    for line in open(f, encoding="utf-8", errors="replace"):
        s = line.strip()
        for m in re.finditer(r"\.(?:accept|turnin|complete)\s+(\d+)", s):
            qids.add(int(m.group(1)))
        if ">>" in s:
            t = s.split(">>", 1)[1]
        elif s.startswith("+"):
            t = s[1:]
        elif s.startswith("#name") or s.startswith("#displayname") or s.startswith("#title"):
            t = s.split(None, 1)[1] if " " in s else ""
        else:
            continue
        t = re.sub(r"\s*<<.*$", "", t)
        texts.append(t)
        for m in re.finditer(r"\|cRXP_[A-Z]+_([^|]+)\|r", t):
            spans[m.group(1).strip()] += 1
        for m in re.finditer(r"\[([^\]]+)\]", t):
            brackets[m.group(1).strip()] += 1

npc = en_de(qdb_en("Npc"), qdb_de("Npcs"))
item = en_de(qdb_en("Item"), qdb_de("Items"))
obj = en_de(qdb_en("Object"), qdb_de("Objects"))
qde = qdb_de("Quests")


def singular(w):
    c = [w]
    if w.endswith("ies"): c.append(w[:-3] + "y")
    if w.endswith("ves"): c += [w[:-3] + "f", w[:-3] + "fe"]
    if w.endswith("men"): c.append(w[:-3] + "man")
    if w.endswith("es"): c.append(w[:-2])
    if w.endswith("s"): c.append(w[:-1])
    return c


N, I, O = {}, {}, {}
for name in list(spans) + list(brackets):
    for cand in singular(name):
        hit = False
        for src, dst in ((npc, N), (item, I), (obj, O)):
            d = src.get(cand)
            if d and d != name:
                dst[name] = d
                hit = True
                break
        if hit:
            break

# ---- 2. Orte (Gebiete + Flugpunkte) aus den Forever-Spieldaten ----
A = {}
corpus = "\n".join(texts)
for table, key in (("AreaTable", "AreaName_lang"), ("TaxiNodes", "Name_lang")):
    en = {r["ID"]: r[key] for r in wago(table, "enUS")}
    de = {r["ID"]: r[key] for r in wago(table, "deDE")}
    for i, n in en.items():
        d = de.get(i)
        if not n or not d or n == d or len(n) < 4:
            continue
        names = [n]
        if table == "TaxiNodes" and ", " in n and ", " in d:   # "Crossroads, The Barrens" -> "Crossroads"
            names.append(n.split(", ")[0]); d2 = d.split(", ")[0]
        else:
            d2 = d
        for k, v in ((names[0], d),) + (((names[1], d2),) if len(names) > 1 else ()):
            if re.search(r"(?<![A-Za-z'])" + re.escape(k) + r"(?![A-Za-z'])", corpus):
                A.setdefault(k, v)
# Ein-Wort-Orte, die zugleich normale englische Woerter sind, nicht im Fliesstext ersetzen
COMMON = {"Inn", "Bank", "Barracks", "Docks", "Cathedral", "Stables", "Lighthouse", "Gates", "Library",
          "Farm", "Tower", "Graveyard", "Temple", "Keep", "Mine", "Bridge", "Ruins", "Lake", "Village",
          "Tunnel", "Blacksmith", "Camp", "City", "Moonwell", "Prison", "Lumber Mill"}
for k in list(A):
    if k in COMMON or A[k] == k:
        del A[k]

Q = {q: qde[q] for q in sorted(qids) if q in qde}


def lua_s(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def dump(name, d):
    lines = [f"  {name} = {{"]
    for k in sorted(d):
        kk = f"[{k}]" if isinstance(k, int) else f"[{lua_s(k)}]"
        lines.append(f"    {kk} = {lua_s(d[k])},")
    lines.append("  },")
    return lines


os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("-- RXPNeon: englische -> deutsche Namen (automatisch erzeugt von tools/rxn_names.py, nicht von Hand aendern)\n")
    f.write("-- Quellen: QuestieDB Forever (GPL-3.0, siehe LIZENZ.txt) und WoW-Forever-Spieldaten " + BUILD + " (wago.tools).\n")
    f.write("RXN_NAMEN = {\n")
    for nm, d in (("npc", N), ("item", I), ("obj", O), ("ort", A), ("quest", Q)):
        f.write("\n".join(dump(nm, d)) + "\n")
    f.write("}\n")
print(f"NPC {len(N)}  Items {len(I)}  Objekte {len(O)}  Orte {len(A)}  Quests {len(Q)}/{len(qids)}  -> {OUT}")
print("ungeloeste Farb-Namen (Top 25):", [n for n, _ in spans.most_common(400) if n not in N and n not in I and n not in O and n not in A][:25])
