#!/bin/bash
# Läuft bei jedem Start einer Claude-Code-Cloud-Sitzung.
# 1. agent-browser-CLI (für den Skill agent-browser) – nutzt das vorinstallierte Chromium.
# 2. Abhängigkeiten der App Forge, damit Tests, Selbsttest und Electron-E2E sofort laufen.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# agent-browser: Fehler hier dürfen den Rest nicht blockieren.
if ! command -v agent-browser >/dev/null 2>&1; then
  npm install -g agent-browser --no-audit --no-fund --loglevel=error || true
fi
if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}/app-forge"
npm install --no-audit --no-fund --loglevel=error
