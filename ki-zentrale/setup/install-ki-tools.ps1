# =====================================================================
#  KI-Zentrale Velocenter Hessert - Werkzeug-Installation fuer Claude Code
#  Windows 11, PowerShell 5.1+, KEINE Admin-Rechte noetig.
#  Start: Doppelklick auf install-ki-tools.cmd (im selben Ordner)
#
#  Installiert (Quellen am 18.11.2026 gegen die offiziellen Repos geprueft):
#   1. claude-mem          github.com/thedotmack/claude-mem
#   2. Agent Reach         github.com/Panniantong/Agent-Reach
#   3. Strix (+ 9 Skills)  github.com/usestrix/strix
#   4. claude-code-setup   github.com/anthropics/claude-plugins-official
#   5. awesome-free-llm-apis (Skill) github.com/aradotso/trending-skills
#
#  Es wird KEIN Scan gestartet und KEIN API-Guthaben verbraucht.
# =====================================================================

$ErrorActionPreference = 'Continue'
$Ergebnis = [ordered]@{}

function Titel($t)  { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Warn($t)   { Write-Host "  [!]    $t" -ForegroundColor Yellow }
function Fehler($t) { Write-Host "  [X]    $t" -ForegroundColor Red }
function Hat($cmd)  { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function PfadNeuLaden {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $uvBin = Join-Path $env:USERPROFILE '.local\bin'
    if ((Test-Path $uvBin) -and ($env:Path -notlike "*$uvBin*")) { $env:Path = "$uvBin;$env:Path" }
}

function Version($cmd, $arg = '--version') {
    try { ((& $cmd $arg 2>&1) | Select-Object -First 1).ToString().Trim() } catch { $null }
}

# ---------------------------------------------------------------------
Titel "0. Bestandsaufnahme"
PfadNeuLaden

# Node.js (claude-mem verlangt 20.19+ oder 22.12+)
$nodeOk = $false
if (Hat node) {
    $nv = (Version node) -replace '^v', ''
    $p = $nv.Split('.') | ForEach-Object { [int]$_ }
    $nodeOk = ($p[0] -ge 23) -or ($p[0] -eq 22 -and $p[1] -ge 12) -or ($p[0] -eq 20 -and $p[1] -ge 19)
    if ($nodeOk) { Ok "Node.js $nv" } else { Warn "Node.js $nv ist zu alt (noetig: 20.19+ oder 22.12+)" }
} else { Warn "Node.js fehlt" }

if (-not $nodeOk) {
    if (Hat winget) {
        Write-Host "  -> Installiere Node.js LTS ueber winget ..."
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        PfadNeuLaden
        $nodeOk = Hat node
        if ($nodeOk) { Ok "Node.js $(Version node) installiert" }
    }
    if (-not $nodeOk) { Fehler "Node.js manuell installieren: https://nodejs.org (LTS) - danach Skript neu starten."; Read-Host "Enter zum Beenden"; exit 1 }
}

# Python (nur Info - uv bringt fuer Strix ein eigenes Python 3.12 mit)
$py = $null
if (Hat py) { $py = Version py } elseif (Hat python) { $py = Version python }
if ($py -and $py -notmatch 'Microsoft Store') { Ok "$py (nur Info, Strix nutzt eigenes Python ueber uv)" }
else { Warn "Kein Python gefunden - kein Problem, uv laedt Python 3.12 fuer Strix selbst" }

# pipx (nur Info - wird durch uv ersetzt)
if (Hat pipx) { Ok "pipx vorhanden (wird nicht gebraucht, uv uebernimmt)" } else { Warn "pipx fehlt - wird nicht gebraucht, uv uebernimmt" }

# Docker
$dockerLaeuft = $false
if (Hat docker) {
    docker info *> $null
    $dockerLaeuft = ($LASTEXITCODE -eq 0)
    if ($dockerLaeuft) { Ok "Docker laeuft" } else { Warn "Docker installiert, aber Docker Desktop laeuft NICHT (fuer Strix-Scans noetig)" }
} else { Warn "Docker fehlt - Strix installiert trotzdem, Scans erst mit Docker Desktop moeglich" }

# Claude Code
$claudeOk = Hat claude
if ($claudeOk) { Ok "Claude Code $(Version claude)" } else { Warn "Claude Code CLI nicht gefunden - Punkt 4 wird uebersprungen (Anleitung am Ende)" }

# uv (fuer Agent Reach + Strix)
if (-not (Hat uv)) {
    Write-Host "  -> Installiere uv (offizieller Installer von astral.sh, ohne Admin) ..."
    powershell -NoProfile -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    PfadNeuLaden
}
if (Hat uv) { Ok "uv $(Version uv)" } else { Fehler "uv-Installation fehlgeschlagen - Punkte 2 und 3 werden uebersprungen" }

# ---------------------------------------------------------------------
Titel "2. Agent Reach"
# Hinweis: Das PyPI-Paket 'agent-reach' ist NICHT dieses Projekt. Nur die GitHub-Release-Datei nutzen.
if (Hat uv) {
    if (Hat agent-reach) {
        Write-Host "  -> Bereits installiert, aktualisiere ..."
        agent-reach update
    } else {
        uv tool install https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip
        uv tool update-shell
        PfadNeuLaden
    }
    if (Hat agent-reach) {
        # 'setup' aktiviert die Standard-Kanaele und legt den Skill fuer Claude Code an
        agent-reach setup
        if (Test-Path (Join-Path $env:USERPROFILE '.claude\skills\agent-reach')) {
            Ok "Agent Reach + Skill (~/.claude/skills/agent-reach)"; $Ergebnis['Agent Reach'] = 'OK'
        } else {
            Warn "Agent Reach installiert, Skill-Ordner nicht gefunden - 'agent-reach setup' in neuem Fenster wiederholen"
            $Ergebnis['Agent Reach'] = 'Programm OK, Skill pruefen'
        }
    } else { Fehler "agent-reach nicht gefunden"; $Ergebnis['Agent Reach'] = 'FEHLER' }
} else { $Ergebnis['Agent Reach'] = 'uebersprungen (uv fehlt)' }

# ---------------------------------------------------------------------
Titel "3. Strix (Programm + Skills, KEIN Scan)"
if (Hat uv) {
    if (Hat strix) { uv tool upgrade strix-agent } else { uv tool install strix-agent --python 3.12 }
    PfadNeuLaden
    if (Hat strix) { Ok "Strix-Programm installiert" } else { Fehler "Strix-Programm fehlt" }
}
npx.cmd -y skills add usestrix/strix --agent claude-code -g -y
if (Test-Path (Join-Path $env:USERPROFILE '.claude\skills\penetration-testing-with-strix')) { Ok "9 Strix-Skills installiert" }
if ((Hat strix) -and $dockerLaeuft) { $Ergebnis['Strix'] = 'OK (Scans bereit, LLM-Key fehlt noch)' }
elseif (Hat strix) { $Ergebnis['Strix'] = 'Programm OK - Docker Desktop starten fuer Scans' }
else { $Ergebnis['Strix'] = 'nur Skills' }

# ---------------------------------------------------------------------
Titel "4. claude-code-setup (offizielles Anthropic-Plugin)"
if ($claudeOk) {
    claude plugin marketplace add anthropics/claude-plugins-official 2>$null
    claude plugin install claude-code-setup@claude-plugins-official
    if ($LASTEXITCODE -eq 0) { Ok "claude-code-setup installiert"; $Ergebnis['claude-code-setup'] = 'OK' }
    else { Fehler "Installation fehlgeschlagen"; $Ergebnis['claude-code-setup'] = 'FEHLER - in Claude Code: /plugin install claude-code-setup@claude-plugins-official' }
} else { $Ergebnis['claude-code-setup'] = 'uebersprungen (Claude Code fehlt)' }

# ---------------------------------------------------------------------
Titel "5. Skill: awesome-free-llm-apis"
npx.cmd -y skills add aradotso/trending-skills --skill awesome-free-llm-apis --agent claude-code -g -y
if (Test-Path (Join-Path $env:USERPROFILE '.claude\skills\awesome-free-llm-apis\SKILL.md')) {
    Ok "Skill installiert"; $Ergebnis['awesome-free-llm-apis'] = 'OK'
} else { Fehler "Skill nicht gefunden"; $Ergebnis['awesome-free-llm-apis'] = 'FEHLER' }

# ---------------------------------------------------------------------
Titel "1. claude-mem (zuletzt, weil die Einrichtung im Browser laeuft)"
Write-Host "  Der Browser oeffnet sich mit der Einrichtungsseite. Dort waehlen:"
Write-Host "   - Agent: Claude Code"
Write-Host "   - Nutzungsstatistik (Analytics): AUS"
Write-Host "   - E-Mail: leer lassen"
Write-Host "  Dieses Fenster offen lassen, bis die Seite 'fertig' meldet."
npx.cmd -y claude-mem install --setup browser
npx.cmd -y claude-mem telemetry disable 2>$null
if (Test-Path (Join-Path $env:LOCALAPPDATA 'claude-mem\bin\claude-mem.exe')) {
    Ok "claude-mem installiert (Speicher: ~/.claude-mem)"; $Ergebnis['claude-mem'] = 'OK'
} else {
    Warn "Starter nicht gefunden - nach Neustart pruefen mit: npx claude-mem doctor"
    $Ergebnis['claude-mem'] = 'pruefen: npx claude-mem doctor'
}

# ---------------------------------------------------------------------
Titel "ERGEBNIS"
$Ergebnis.GetEnumerator() | ForEach-Object { Write-Host ("  {0,-24} {1}" -f $_.Key, $_.Value) }
Write-Host ""
Write-Host "  JETZT: Alle Terminals und Claude Code komplett schliessen und neu starten." -ForegroundColor Cyan
Write-Host "  Test in Claude Code:  /plugin   (claude-mem + claude-code-setup muessen aktiv sein)"
Write-Host "                        /skills   (agent-reach, awesome-free-llm-apis, 9x strix)"
Write-Host ""
Write-Host "  Strix-Scan erst nach Kostenfreigabe. Vorher setzen:" -ForegroundColor Yellow
Write-Host '    setx STRIX_LLM "openrouter/z-ai/glm-5.3"   (Format laut Strix-README: anbieter/modell)'
Write-Host '    setx LLM_API_KEY "<dein-key>"'
Write-Host '  Strix speichert das danach in ~/.strix/cli-config.json.'
Write-Host ""
Read-Host "Enter zum Beenden"
