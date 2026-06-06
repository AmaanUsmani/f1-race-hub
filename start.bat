@echo off
setlocal

set FRONTEND_PORT=5500
set BACKEND_PORT=5001
set URL=http://localhost:%FRONTEND_PORT%/index.html

REM ── Locate Python ─────────────────────────────────────────────
set PYTHON=
where py >nul 2>nul
if %errorlevel%==0 set PYTHON=py

if "%PYTHON%"=="" (
  where python >nul 2>nul
  if %errorlevel%==0 set PYTHON=python
)

if "%PYTHON%"=="" (
  echo Could not find Python. Install from https://www.python.org/ and try again.
  pause
  goto :eof
)

echo Python found: %PYTHON%

REM ── Install backend dependencies (skip if flask already present) ──
%PYTHON% -m pip show flask >nul 2>nul
if %errorlevel% neq 0 (
  echo Installing backend dependencies...
  %PYTHON% -m pip install -r "%~dp0backend\requirements.txt" -q
) else (
  echo Backend dependencies already installed, skipping.
)

REM ── Install replay dependencies using Python 3.12 (arcade needs it) ──
set PYTHON_REPLAY=
py -3.12 --version >nul 2>nul
if %errorlevel%==0 set PYTHON_REPLAY=py -3.12

if "%PYTHON_REPLAY%"=="" (
  py -3.11 --version >nul 2>nul
  if %errorlevel%==0 set PYTHON_REPLAY=py -3.11
)

if "%PYTHON_REPLAY%"=="" (
  echo WARNING: Python 3.12 or 3.11 not found. Replay feature will not work.
  echo Install Python 3.12 from https://www.python.org/ to enable it.
  goto :start_servers
)

%PYTHON_REPLAY% -m pip show arcade >nul 2>nul
if %errorlevel% neq 0 goto :install_replay
%PYTHON_REPLAY% -m pip show fastf1 >nul 2>nul
if %errorlevel% neq 0 goto :install_replay
echo Replay dependencies already installed, skipping.
goto :start_servers

:install_replay
echo Installing replay dependencies with %PYTHON_REPLAY%...
%PYTHON_REPLAY% -m pip install -r "%~dp0replay\requirements.txt"

:start_servers

REM ── Start Flask backend (using /d to set working directory) ───
echo Starting FastF1 backend on port %BACKEND_PORT%...
start "FastF1 Backend" /d "%~dp0backend" cmd /k %PYTHON% server.py

timeout /t 2 /nobreak >nul

REM ── Start frontend HTTP server ────────────────────────────────
echo Starting frontend on port %FRONTEND_PORT%...
start "F1 Frontend" /d "%~dp0" cmd /k %PYTHON% -m http.server %FRONTEND_PORT%

timeout /t 1 /nobreak >nul

REM ── Open browser ──────────────────────────────────────────────
start "" %URL%

echo.
echo Dashboard: %URL%
echo Backend:   http://localhost:%BACKEND_PORT%
echo.
echo Close the two server windows to stop.
pause
