@echo off
chcp 65001 >nul
title Hanoi Food - local server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js not found. Install Node first: https://nodejs.org
  echo.
  pause
  exit /b 1
)

node server.js
echo.
echo   Server stopped.
pause
