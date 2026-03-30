@echo off
cd /d "%~dp0"

if not exist "dist\Servico-de-impressao.exe" (
  echo Executavel nao encontrado. Gere com: cmd /c npm run build:exe
  pause
  exit /b 1
)

start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File ".\scripts\start-service-ui.ps1"
exit /b 0
