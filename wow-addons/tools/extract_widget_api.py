#!/usr/bin/env python3
"""Liest die Widget-API (Simple*APIDocumentation.lua) aus Blizzards Forever-UI-Quellcode
(Gethe/wow-ui-source, Branch "forever") und erzeugt tests/forever_widget_api.lua:
eine Liste aller Methoden je API-Gruppe. Der Test-Mock erlaubt nur diese Methoden."""
import os, re, sys
src = sys.argv[1] if len(sys.argv) > 1 else "/home/user/ext/wow-ui-forever/Interface/AddOns/Blizzard_APIDocumentationGenerated"
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.normpath(os.path.join(here, "..", "tests", "forever_widget_api.lua"))
groups = {}
for fn in sorted(os.listdir(src)):
    if not (fn.startswith("Simple") and fn.endswith("APIDocumentation.lua")):
        continue
    text = open(os.path.join(src, fn), encoding="utf-8").read()
    m = re.search(r'Name = "(Simple\w+API)"', text)
    if not m:
        continue
    name = m.group(1)
    funcs = re.search(r"Functions =\s*\{(.*?)\n\tEvents =", text, re.S)
    body = funcs.group(1) if funcs else ""
    methods = re.findall(r'\n\t\t\{\n\t\t\tName = "(\w+)",\n\t\t\tType = "Function"', body)
    groups[name] = sorted(set(methods))
with open(out, "w") as f:
    f.write("-- AUTOMATISCH ERZEUGT aus Blizzards Forever-UI-Quellcode (wow-ui-source, Branch forever, 1.60.1)\n")
    f.write("return {\n")
    for name in sorted(groups):
        f.write(f"  {name} = {{ " + ", ".join(f'"{m}"' for m in groups[name]) + " },\n")
    f.write("}\n")
print("geschrieben:", out)
for name in sorted(groups):
    print(f"{name}: {len(groups[name])}")

# Zusätzlich: alle Ereignisnamen (für die Prüfung von RegisterEvent im Test)
events = set()
for fn in os.listdir(src):
    if fn.endswith(".lua"):
        events.update(re.findall(r'LiteralName = "([A-Z0-9_]+)"', open(os.path.join(src, fn), encoding="utf-8").read()))
ev_out = os.path.normpath(os.path.join(here, "..", "tests", "forever_events.lua"))
with open(ev_out, "w") as f:
    f.write("-- AUTOMATISCH ERZEUGT: alle Ereignisse des Forever-Clients 1.60.1\nreturn {\n")
    for e in sorted(events):
        f.write(f'  ["{e}"] = true,\n')
    f.write("}\n")
print("Ereignisse:", len(events))
