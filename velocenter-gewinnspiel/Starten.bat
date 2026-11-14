@echo off
rem Durchzieher-Zentrale starten: Edge im App-Fenster, sonst Standardbrowser
set "APP=%~dp0index.html"
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" >nul 2>nul && goto edge
reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" >nul 2>nul && goto edge
start "" "%APP%"
exit /b
:edge
start "" msedge --app="file:///%APP%"
