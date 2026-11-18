@echo off
rem Startet die Installation ohne Admin-Rechte und ohne PowerShell-Sperre.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-ki-tools.ps1"
