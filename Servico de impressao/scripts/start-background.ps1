$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".service.pid"
$exePath = Join-Path $root "dist\\Servico-de-impressao.exe"

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existingPid) {
    try {
      $proc = Get-Process -Id $existingPid -ErrorAction Stop
      Write-Host "Servico ja esta em execucao. PID: $($proc.Id)"
      exit 0
    } catch {
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
  }
}

$process = $null
if (Test-Path $exePath) {
  $process = Start-Process -FilePath $exePath -WorkingDirectory $root -WindowStyle Hidden -PassThru
} else {
  $process = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru
}
Set-Content -Path $pidFile -Value $process.Id
Write-Host "Servico iniciado em segundo plano. PID: $($process.Id)"
