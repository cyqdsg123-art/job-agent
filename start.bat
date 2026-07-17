@echo off
rem One-click launcher: opens two terminal windows (backend + frontend)
start "job-agent-backend (port 8000)" cmd /k "cd /d D:\job-agent\backend && venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"
start "job-agent-frontend (port 3000)" cmd /k "cd /d D:\job-agent\frontend && npm run dev"
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
