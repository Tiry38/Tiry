#!/usr/bin/env python3
"""Erzeugt tests/font_metrics.lua: Zeichenbreiten der Poppins-Schriften (pro 1 px Schriftgröße) für den Layout-Test."""
import os
from fontTools.ttLib import TTFont
here = os.path.dirname(os.path.abspath(__file__))
fonts = {"regular": "Poppins-Regular.ttf", "semibold": "Poppins-SemiBold.ttf", "bold": "Poppins-ExtraBold.ttf"}
out = ["-- AUTOMATISCH ERZEUGT: Zeichenbreiten (Anteil der Schriftgröße) für Poppins", "return {"]
for key, fn in fonts.items():
    f = TTFont(os.path.join(here, "..", "TirysZentrale", "Media", "Fonts", fn))
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
out.append("}")
open(os.path.join(here, "..", "tests", "font_metrics.lua"), "w").write("\n".join(out) + "\n")
print("ok")
