@echo off
setlocal
cd /d "%~dp0"
node --version >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.13 or newer, then run this file again.
  pause
  exit /b 1
)
node server.js
pause
