@echo off
cd /d "%~dp0backend"
if not exist .venv (
  python -m venv .venv
)
call .venv\Scripts\activate
python -m pip install -r requirements.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\show_lan_urls.ps1"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
