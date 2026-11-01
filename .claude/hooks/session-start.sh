#!/bin/bash
# Installiert die Abhängigkeiten der App Forge in Claude-Code-Cloud-Sitzungen,
# damit Tests, Selbsttest und Electron-E2E sofort laufen.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}/app-forge"
npm install --no-audit --no-fund --loglevel=error
