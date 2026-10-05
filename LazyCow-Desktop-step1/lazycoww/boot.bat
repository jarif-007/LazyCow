@echo off
cd /d "%~dp0"
node scripts\boot.mjs
echo.
echo Press any key to close.
pause >nul