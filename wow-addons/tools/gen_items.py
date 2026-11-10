#!/usr/bin/env python3
"""Erzeugt TirysZentrale/Data_Items.lua aus den geprüften Wowhead-Forever-Daten (items_forever.json).

Daten holen/aktualisieren:  python3 fetch_items.py <id,id,...>   (schreibt items.json -> nach items_forever.json kopieren)
Quelle: https://nether.wowhead.com/forever/tooltip/item/<id>?locale=3 (deDE) bzw. ohne locale (enUS)
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "items_forever.json"), encoding="utf-8"))

CATS = [
    ("cloth", [2589, 2592, 4306, 4338, 2996, 2997, 4305]),
    ("leather", [2934, 2318, 783, 2319, 4232, 4234]),
    ("ore", [2770, 2771, 2775, 2772, 2840, 3576, 2841, 2842, 2835, 2836, 774, 818, 1210, 1206, 1705]),
    ("herb", [2447, 765, 2449, 785, 2450, 2452, 2453, 3820, 3355, 3369, 3356, 3357]),
    ("scarce", [249399, 249391, 249427]),
    ("enchant", [10940, 10938, 10939, 10978, 11083, 10998]),
    ("fish", [6291, 6303, 6289, 6317, 6308, 6358, 6359, 6522, 21071, 6361, 6362]),
    ("meat", [2672, 769, 2673, 3173, 1015, 2924, 5503, 3667, 2675, 2674, 3712, 5465, 1081, 5469, 723, 730, 731, 1468, 3685]),
    ("crafted", [4238, 4240, 4241, 5762, 5763, 4245, 5764, 5765, 118, 858, 929, 2455, 3385, 2459, 2454, 5997, 2457, 2458, 3382, 5996,
                 1251, 2581, 3530, 3531, 6450, 4357, 4364, 4359, 2862, 2863, 2304, 2313, 4231, 4233]),
    ("vendor", [2320, 2321, 3371, 3372, 2678, 2324, 2604, 6260, 4470, 4399, 2880]),
    ("other", [16882, 6256]),
]

def lua_str(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

lines = [
    "-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_items.py – nicht von Hand bearbeiten.",
    "-- Quelle: Wowhead-Datenbank für WoW Forever (Item-ID, deutscher Name, Qualität, Händler-Verkaufspreis, Stapelgröße).",
    "-- Im Spiel zeigt Tiry's Zentrale immer den Namen aus dem Client an; diese Namen sind nur der Rückfall.",
    "local _, ns = ...",
    "ns.ITEMS = {",
]
order = []
for cat, ids in CATS:
    lines.append(f"  -- {cat}")
    for i in ids:
        d = data[str(i)]
        assert d.get("de") and d.get("en"), f"Item {i} fehlt in items_forever.json"
        stack = d.get("stack") or 1
        sell = d.get("sell") or 0
        lines.append(f"  [{i}] = {{ cat = {lua_str(cat)}, de = {lua_str(d['de'])}, en = {lua_str(d['en'])}, q = {d.get('q', 1)}, sell = {sell}, stack = {stack} }},")
        order.append(i)
lines.append("}")
lines.append("ns.ITEM_ORDER = { " + ", ".join(str(i) for i in order) + " }")
out = os.path.normpath(os.path.join(HERE, "..", "TirysZentrale", "Data_Items.lua"))
open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("geschrieben:", out, len(order), "Items")
