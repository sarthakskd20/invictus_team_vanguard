@echo off
title Invictus Inventory Management System
color 0B

echo.
echo  ======================================================
echo    INVICTUS INVENTORY MANAGEMENT SYSTEM
echo    Team Vanguard - Electrolyte Solutions Hackathon
echo  ======================================================
echo.

REM =============================================
REM  STEP 1: Check Required Software
REM =============================================
echo  [1/5] Checking required software...
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is NOT installed.
    echo  Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo    Node.js: %NODE_VER% [OK]

REM Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] npm is NOT installed.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo    npm:     v%NPM_VER% [OK]

REM Check PostgreSQL (psql)
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [WARNING] PostgreSQL ^(psql^) not found in PATH.
    echo  Make sure PostgreSQL 15+ is installed and running.
    echo  You may need to add it to your PATH:
    echo    C:\Program Files\PostgreSQL\15\bin
    echo.
) else (
    for /f "tokens=3" %%i in ('psql --version') do set PG_VER=%%i
    echo    psql:    v%PG_VER% [OK]
)

REM Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [WARNING] Python is NOT installed.
    echo  PCB Schematic Import feature will NOT work.
    echo  Please install Python 3.8+ from https://python.org
) else (
    for /f "tokens=*" %%i in ('python --version') do set PY_VER=%%i
    echo    Python:  %PY_VER% [OK]
    
    REM Install Python dependencies
    echo.
    echo  [1.5/5] Installing Python dependencies...
    pip install -r backend\requirements.txt >nul 2>nul
    if %errorlevel% neq 0 (
         echo    [WARNING] Failed to install Python dependencies.
    ) else (
         echo    Python dependencies installed.
    )
)

echo.
echo  All core dependencies verified.
echo.

REM =============================================
REM  STEP 2: Install Dependencies
REM =============================================
echo  [2/5] Installing dependencies...
echo.

echo    Backend dependencies...
cd /d "%~dp0backend"
echo    (Ensuring dependencies are up to date...)
call npm install --no-audit --no-fund --quiet
if %errorlevel% neq 0 (
    echo  [ERROR] Backend npm install failed.
    pause
    exit /b 1
)

echo.
echo    Frontend dependencies...
cd /d "%~dp0frontend"
echo    (Ensuring dependencies are up to date...)
call npm install --no-audit --no-fund --quiet
if %errorlevel% neq 0 (
    echo  [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)

echo.
echo  Dependencies installed successfully.
echo.

REM =============================================
REM  STEP 3: Database Setup
REM =============================================
echo  [3/5] Setting up database...
echo.

cd /d "%~dp0"

REM Try to create the database (ignore errors if it already exists)
psql -U postgres -c "CREATE DATABASE invictus_inventory;" 2>nul
if %errorlevel% neq 0 (
    echo    Database 'invictus_inventory' already exists or psql unavailable.
) else (
    echo    Database 'invictus_inventory' created.
)

REM Run schema
psql -U postgres -d invictus_inventory -f "database\schema.sql" 2>nul
if %errorlevel% neq 0 (
    echo    [WARNING] Could not run schema.sql automatically.
    echo    Please run manually: psql -U postgres -d invictus_inventory -f database\schema.sql
) else (
    echo    Schema applied.
)

REM Run seed data
psql -U postgres -d invictus_inventory -f "database\seed.sql" 2>nul
if %errorlevel% neq 0 (
    echo    [WARNING] Could not run seed.sql automatically.
    echo    Please run manually: psql -U postgres -d invictus_inventory -f database\seed.sql
) else (
    echo    Seed data loaded.
)

echo.

REM =============================================
REM  STEP 4: Kill conflicting ports
REM =============================================
echo  [4/5] Cleaning up ports 5000 and 5173...
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTEN"') do (
    echo    Killing process on port 5000 (PID: %%a)
    taskkill /PID %%a /F >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTEN"') do (
    echo    Killing process on port 5173 (PID: %%a)
    taskkill /PID %%a /F >nul 2>nul
)

echo    Ports cleared.
echo.

REM =============================================
REM  STEP 5: Start Application
REM =============================================
echo  [5/5] Starting application...
echo.

REM Start backend server in a new window
start "Invictus Backend" cmd /c "cd /d %~dp0backend && node server.js"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend dev server in a new window
start "Invictus Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

REM Wait for frontend to start
timeout /t 4 /nobreak >nul

echo.
echo  ======================================================
echo    APPLICATION STARTED SUCCESSFULLY
echo  ======================================================
echo.
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:5000
echo    API Docs: http://localhost:5000/api/health
echo.
echo    Default Login:
echo      Username: admin
echo      Password: admin123
echo.
echo  ======================================================
echo.

REM Open browser
start "" "http://localhost:5173"

echo  Press any key to stop the application...
pause >nul

REM Cleanup: Kill both servers
taskkill /FI "WINDOWTITLE eq Invictus Backend*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Invictus Frontend*" /F >nul 2>nul
echo  Application stopped.
