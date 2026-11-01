#!/bin/bash
# App-Bibliothek (Branch "forge-library") als Ordner <repo>/forge-data holen bzw. zurückschreiben.
#   bash scripts/library-sync.sh pull
#   bash scripts/library-sync.sh push "Commit-Nachricht"
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
DIR="${FORGE_DATA_DIR:-$ROOT/forge-data}"
BR=forge-library
IGNORE=$'logs/\nbackups/\nexports/\n_stage-*/\n'

remote_has_branch() { git -C "$ROOT" ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; }

case "${1:-}" in
  pull)
    git -C "$ROOT" worktree prune
    if [ -e "$DIR/.git" ]; then
      if remote_has_branch; then git -C "$DIR" pull -q --rebase origin "$BR"; fi
    elif remote_has_branch; then
      git -C "$ROOT" fetch -q origin "$BR"
      git -C "$ROOT" worktree add -q -B "$BR" "$DIR" "origin/$BR"
    else
      git -C "$ROOT" worktree add -q --orphan -b "$BR" "$DIR"
    fi
    printf '%s' "$IGNORE" > "$DIR/.gitignore"
    echo "✓ Bibliothek bereit: $DIR"
    ;;
  push)
    cd "$DIR"
    printf '%s' "$IGNORE" > .gitignore
    git config user.name >/dev/null || git config user.name "forge-bot"
    git config user.email >/dev/null || git config user.email "forge-bot@localhost"
    git add -A
    if git diff --cached --quiet; then echo "Keine Änderungen."; exit 0; fi
    git commit -q -m "${2:-Forge: Bibliothek aktualisiert $(date -u +%Y-%m-%d_%H%M)}"
    if remote_has_branch; then
      git pull -q --rebase origin "$BR" || { git rebase --abort || true; echo "✗ Konflikt mit der Cloud-Bibliothek – bitte erneut pull + Änderungen wiederholen."; exit 1; }
    fi
    git push -q origin "HEAD:$BR"
    echo "✓ Bibliothek gesichert (Branch $BR)"
    ;;
  *)
    echo "Aufruf: bash scripts/library-sync.sh pull | push \"Nachricht\""; exit 1 ;;
esac
