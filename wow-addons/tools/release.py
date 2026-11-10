#!/usr/bin/env python3
"""Version eines WoW-Add-ons hochzählen und Auslieferungs-ZIP bauen.

Aufruf (aus beliebigem Ordner, immer mit -I):
    python3 -I wow-addons/tools/release.py <Add-on> <Version> [--no-zip] [--dry-run]

Beispiele:
    python3 -I wow-addons/tools/release.py zentrale 6.0.0
    python3 -I wow-addons/tools/release.py LevelPilot 4.1.1

Was passiert:
  * "## Version:" in ALLEN .toc-Dateien des Add-ons wird gesetzt,
  * `local VERSION = "..."` in den Lua-Dateien direkt im Add-on-Ordner wird gesetzt (falls vorhanden),
  * wow-addons/dist/<Add-on>.zip wird neu gebaut (Ordner <Add-on>/ im ZIP, so wie er in Interface\\AddOns liegt).
Tests laufen NICHT hier: vorher `bash wow-addons/tools/test_all.sh`.
"""
import argparse
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../wow-addons
ALIASES = {"zentrale": "TirysZentrale", "tz": "TirysZentrale", "lp": "LevelPilot", "proc": "ProcAlarm",
           "hagel": "Schlaghagel"}
SKIP_DIRS = {"__pycache__", ".git"}


def find_addon(name):
    name = ALIASES.get(name.lower(), name)
    candidates = [os.path.join(ROOT, name)]
    addons = os.path.join(ROOT, "addons")
    if os.path.isdir(addons):
        for entry in sorted(os.listdir(addons)):
            if entry.lower() == name.lower():
                candidates.append(os.path.join(addons, entry))
    for path in candidates:
        base = os.path.basename(path)
        if os.path.isdir(path) and any(f.lower().endswith(".toc") for f in os.listdir(path)):
            return base, path
    if not os.path.isdir(addons):
        sys.exit("Die Add-ons fehlen in diesem Arbeitsstand – sie liegen im Branch claude/wow-addons "
                 "(git fetch origin claude/wow-addons && git checkout claude/wow-addons).")
    known = ["TirysZentrale"] + sorted(os.listdir(addons))
    sys.exit("Add-on '%s' nicht gefunden. Bekannt: %s" % (name, ", ".join(known)))


def set_versions(path, version, dry):
    changed = []
    for entry in sorted(os.listdir(path)):
        full = os.path.join(path, entry)
        if not os.path.isfile(full):
            continue
        low = entry.lower()
        if low.endswith(".toc"):
            pattern = re.compile(r"^(## Version:[ \t]*)(\S+)", re.M)
        elif low.endswith(".lua"):
            pattern = re.compile(r'^(local VERSION[ \t]*=[ \t]*")([^"]*)', re.M)
        else:
            continue
        with open(full, encoding="utf-8", newline="") as fh:
            text = fh.read()
        match = pattern.search(text)
        if not match:
            continue
        old = match.group(2)
        if old != version:
            text = pattern.sub(lambda m: m.group(1) + version, text, count=1)
            if not dry:
                with open(full, "w", encoding="utf-8", newline="") as fh:
                    fh.write(text)
        changed.append((entry, old))
    return changed


def build_zip(name, path, dry):
    dist = os.path.join(ROOT, "dist")
    target = os.path.join(dist, name + ".zip")
    files = []
    for folder, dirs, names in os.walk(path):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for fname in sorted(names):
            if fname.startswith(".") or fname.endswith((".pyc", ".orig", ".rej")):
                continue
            full = os.path.join(folder, fname)
            files.append((full, os.path.join(name, os.path.relpath(full, path)).replace(os.sep, "/")))
    if dry:
        return target, len(files), 0
    os.makedirs(dist, exist_ok=True)
    tmp = target + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for full, arc in files:
            zf.write(full, arc)
    os.replace(tmp, target)
    with zipfile.ZipFile(target) as zf:
        bad = zf.testzip()
        if bad:
            sys.exit("ZIP defekt bei " + bad)
    return target, len(files), os.path.getsize(target)


def main():
    ap = argparse.ArgumentParser(description="Version setzen und ZIP bauen")
    ap.add_argument("addon")
    ap.add_argument("version")
    ap.add_argument("--no-zip", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not re.fullmatch(r"\d+\.\d+\.\d+", args.version):
        sys.exit("Version bitte als X.Y.Z, z. B. 6.0.0")
    name, path = find_addon(args.addon)
    changed = set_versions(path, args.version, args.dry_run)
    tocs = [c for c in changed if c[0].lower().endswith(".toc")]
    if not tocs:
        sys.exit("Keine '## Version:'-Zeile in den TOCs von %s gefunden." % name)
    print("%s -> %s%s" % (name, args.version, " (Probelauf, nichts geschrieben)" if args.dry_run else ""))
    for entry, old in changed:
        print("  %-40s %s -> %s" % (entry, old, args.version))
    if not args.no_zip:
        target, count, size = build_zip(name, path, args.dry_run)
        print("ZIP: %s (%d Dateien%s)" % (os.path.relpath(target, os.path.dirname(ROOT)), count,
                                          ", %.1f MB" % (size / 1048576.0) if size else ""))


if __name__ == "__main__":
    main()
