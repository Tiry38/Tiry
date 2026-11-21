#!/usr/bin/env python3
"""Erzeugt tests/font_metrics.lua: Zeichenbreiten der Poppins-Schriften (pro 1 px Schriftgröße) für den Layout-Test."""
import os
from fontTools.ttLib import TTFont
here = os.path.dirname(os.path.abspath(__file__))
RR = os.path.join("RezeptRadar", "Media", "Fonts")
CW = os.path.join("ChatWerk", "Media", "Fonts")
fonts = {"regular": (RR, "Poppins-Regular.ttf"), "semibold": (RR, "Poppins-SemiBold.ttf"), "bold": (RR, "Poppins-ExtraBold.ttf"),
         # ChatWerk 1.2 "2045": Rajdhani (Text) + Orbitron (Titel), beide SIL OFL
         "tech": (CW, "Rajdhani-Medium.ttf"), "techsemi": (CW, "Rajdhani-SemiBold.ttf"), "techbold": (CW, "Rajdhani-Bold.ttf"),
         "display": (CW, "Orbitron-Bold.ttf")}
out = ["-- AUTOMATISCH ERZEUGT: Zeichenbreiten (Anteil der Schriftgröße) für Poppins, Rajdhani, Orbitron", "return {"]
for key, (sub, fn) in fonts.items():
    f = TTFont(os.path.join(here, "..", "addons", sub, fn))
    upm = f["head"].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    widths = []
    for cp in sorted(cmap):
        if cp < 32 or cp > 0x2030:
            continue
        adv = hmtx[cmap[cp]][0] / upm
        widths.append(f"[{cp}]={adv:.4f}")
    out.append(f"  {key} = {{ " + ", ".join(widths) + " },")
# Arial Narrow (WoW ARIALN.TTF) ist von Hand eingetragen und wird beibehalten
old = os.path.join(here, "..", "tests", "font_metrics.lua")
if os.path.exists(old):
    for line in open(old, encoding="utf-8"):
        if line.startswith("  narrow = "):
            out.append(line.rstrip("\n"))
out.append("}")
open(os.path.join(here, "..", "tests", "font_metrics.lua"), "w").write("\n".join(out) + "\n")
print("ok")
