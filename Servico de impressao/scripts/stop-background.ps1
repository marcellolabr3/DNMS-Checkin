$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".service.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "PID nao encontrado. Servico provavelmente nao esta em execucao."
  exit 0
}

$pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
if (-not $pidValue) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host "PID invalido removido."
  exit 0
}

try {
  Stop-Process -Id $pidValue -Force -ErrorAction Stop
  Write-Host "Servico encerrado. PID: $pidValue"
} catch {
  Write-Host "Nao foi possivel encerrar o PID $pidValue. Pode ja estar parado."
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

try {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "powershell" -and $_.CommandLine -match "start-service-ui.ps1"
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch {}
