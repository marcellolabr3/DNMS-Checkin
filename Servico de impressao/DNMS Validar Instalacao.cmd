@echo off
cd /d "%~dp0"

if not exist "scripts\validate-install.ps1" (
  echo Validador nao encontrado.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\validate-install.ps1"
echo.
pause
