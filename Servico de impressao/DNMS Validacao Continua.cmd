@echo off
cd /d "%~dp0"

if not exist "scripts\validate-real-environment.ps1" (
  echo Script de validacao continua nao encontrado.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\validate-real-environment.ps1" -Watch -OpenStatus
