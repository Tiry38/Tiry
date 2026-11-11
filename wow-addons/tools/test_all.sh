#!/usr/bin/env bash
# Alle Tests der WoW-Forever-Add-ons mit einem Befehl.
# Aufruf (von überall):  bash wow-addons/tools/test_all.sh [ziel ...]
#   Ziele: zentrale levelpilot proc hagel blitzschild chathoch minipost enhancehud syntax  (ohne Ziel = alle)
# Exit-Code 0 = alles grün. Am Ende steht eine Zusammenfassung.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$(mktemp -d)"
trap 'rm -rf "$LOG"' EXIT
pass=0
fail=0
failed=()

# run <Name> <Ordner> <Pflichttext oder -> <Befehl ...>
run() {
  local name="$1" dir="$2" marker="$3"
  shift 3
  local out="$LOG/$(echo "$name" | tr -c 'A-Za-z0-9' '_').txt" code
  (cd "$dir" && "$@") >"$out" 2>&1
  code=$?
  if [ "$code" -eq 0 ] && { [ "$marker" = "-" ] || grep -q -- "$marker" "$out"; }; then
    pass=$((pass + 1))
    printf 'OK      %s\n' "$name"
  else
    fail=$((fail + 1))
    failed+=("$name")
    printf 'FEHLER  %s (Exit %s)\n' "$name" "$code"
    tail -n 20 "$out" | sed 's/^/        /'
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

want() {
  [ "${#TARGETS[@]}" -eq 0 ] && return 0
  local t
  for t in "${TARGETS[@]}"; do [ "$t" = "$1" ] && return 0; done
  return 1
}

if [ ! -d "$ROOT/TirysZentrale" ] || [ ! -d "$ROOT/addons" ]; then
  echo "Die Add-ons fehlen in diesem Arbeitsstand – sie liegen im Branch claude/wow-addons:"
  echo "  git fetch origin claude/wow-addons && git checkout claude/wow-addons"
  exit 2
fi

TARGETS=("$@")
A="$ROOT/addons"
T="$ROOT/tests"

if want zentrale; then
  run "Zentrale: Ladetest (Forever-Nachbau)" "$ROOT" " 0 fehlgeschlagen" lua5.1 tests/run_tests.lua
  if have busted; then run "Zentrale: Specs (busted)" "$ROOT" " 0 failures / 0 errors" busted
  else echo "UEBERSPRUNGEN  Zentrale: Specs (busted fehlt)"; fi
  if have luacheck; then run "Zentrale: luacheck" "$ROOT" "0 warnings / 0 errors" luacheck --no-color TirysZentrale
  else echo "UEBERSPRUNGEN  Zentrale: luacheck (fehlt)"; fi
  run "Zentrale: Layout" "$ROOT" "0 Layout-Probleme" lua5.1 tests/check_layout.lua
fi

if want levelpilot; then
  run "LevelPilot: v4 (Logik)" "$A/LevelPilot" "ALLE TESTS OK" lua5.1 "$T/v4.lua"
  run "LevelPilot: lp" "$A/LevelPilot" - lua5.1 "$T/lp.lua"
  run "LevelPilot: lp2" "$A/LevelPilot" - lua5.1 "$T/lp2.lua"
  run "LevelPilot: nav" "$A/LevelPilot" - lua5.1 "$T/nav.lua"
  run "LevelPilot: fly" "$A/LevelPilot" "HEARTHTEST OK" lua5.1 "$T/fly.lua"
  run "LevelPilot: route" "$A/LevelPilot" "ROUTE TESTS OK" lua5.1 "$T/route.lua"
  run "LevelPilot: travel (Wegenetz/Flug-Rat)" "$A/LevelPilot" "TRAVEL TESTS OK" lua5.1 "$T/travel.lua"
  run "LevelPilot: travel2 (Klippen, Inseln, Aufzüge, Flug nur verbunden)" "$A/LevelPilot" "TRAVEL2 OK" lua5.1 "$T/travel2.lua"
  run "LevelPilot: plan (fester Plan, Einstieg, Sprung, Questlog-Check)" "$A/LevelPilot" "PLAN TESTS OK" lua5.1 "$T/plan.lua"
  run "LevelPilot: Durchlauf beider Routen (Plan, Einstieg, hinter Plan, Hexer)" "$A/LevelPilot" "PLAYTHROUGH OK" lua5.1 "$T/playthrough.lua"
  run "LevelPilot: Zufalls-Stresstest Plan-Engine (18.000 Aktionen)" "$A/LevelPilot" "FUZZ OK" lua5.1 "$T/fuzz.lua"
  run "LevelPilot: Fenster-Layout (strenger Forever-Nachbau)" "$ROOT" "LP LAYOUT OK" lua5.1 tests/lp_layout.lua
fi

if want proc; then run "ProcAlarm" "$A" - lua5.1 "$T/proc.lua"; fi
if want hagel; then
  run "Schlaghagel (Schamane)" "$A" - env PROC_CLASS=SHAMAN lua5.1 "$T/hagel.lua"
  run "Schlaghagel (Hexer)" "$A" - env PROC_CLASS=WARLOCK lua5.1 "$T/hagel.lua"
fi
if want blitzschild; then
  run "Blitzschild: bs" "$A/Blitzschild" - lua5.1 "$T/bs.lua"
  run "Blitzschild: bs2" "$A/Blitzschild" - lua5.1 "$T/bs2.lua"
fi
if want chathoch; then run "ChatHoch" "$A/ChatHoch" - lua5.1 "$T/ch.lua"; fi
if want minipost; then run "MiniPost" "$A/MiniPost" - lua5.1 "$T/mp.lua"; fi
if want enhancehud; then
  run "EnhanceHUD" "$A" - lua5.1 "$T/run.lua"
  run "EnhanceHUD (Forever)" "$A" - lua5.1 "$T/run_forever.lua"
fi

if want syntax; then
  bad=0
  while IFS= read -r -d '' f; do
    if ! luac5.1 -p "$f" 2>"$LOG/luac.txt"; then bad=$((bad + 1)); cat "$LOG/luac.txt"; fi
  done < <(find "$ROOT/addons" "$ROOT/TirysZentrale" -name '*.lua' -print0)
  if [ "$bad" -eq 0 ]; then pass=$((pass + 1)); echo "OK      Syntax (luac5.1 -p, alle .lua)"
  else fail=$((fail + 1)); failed+=("Syntax"); echo "FEHLER  Syntax: $bad Datei(en)"; fi
fi

echo
echo "Ergebnis: $pass ok, $fail fehlgeschlagen"
if [ "$fail" -gt 0 ]; then
  printf '  - %s\n' "${failed[@]}"
  exit 1
fi
echo "ALLES GRUEN"
