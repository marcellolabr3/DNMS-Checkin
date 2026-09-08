@echo off
cd /d "%~dp0"

if not exist "scripts\install-portable.ps1" (
  echo Instalador nao encontrado.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\install-portable.ps1" -StopExisting -StartNow
echo.
pause
