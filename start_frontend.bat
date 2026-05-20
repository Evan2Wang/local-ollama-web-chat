@echo off
cd /d "%~dp0frontend"
if not exist node_modules (
  npm install
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\show_lan_urls.ps1"
npm run dev -- --host 0.0.0.0
