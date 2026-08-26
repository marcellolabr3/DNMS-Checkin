$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".service.pid"

function Stop-ServiceProcessById {
  param([string]$PidValue)

  if (-not $PidValue) {
    return $false
  }

  try {
    Stop-Process -Id $PidValue -Force -ErrorAction Stop
    Write-Host "Servico encerrado. PID: $PidValue"
    return $true
  } catch {
    Write-Host "Nao foi possivel encerrar o PID $PidValue. Pode ja estar parado."
    return $false
  }
}

function Get-ServicePidFromPort {
  try {
    $connection = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($connection -and $connection.OwningProcess) {
      return [string]$connection.OwningProcess
    }
  } catch {}

  return $null
}

$stopped = $false
if (Test-Path $pidFile) {
  $pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($pidValue) {
    $stopped = Stop-ServiceProcessById -PidValue $pidValue
  } else {
    Write-Host "PID invalido removido."
  }
}

$portPid = Get-ServicePidFromPort
if ($portPid) {
  $stopped = (Stop-ServiceProcessById -PidValue $portPid) -or $stopped
}

if (-not $stopped) {
  Write-Host "Servico provavelmente nao esta em execucao."
}
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

try {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "powershell" -and $_.CommandLine -match "start-service-ui.ps1"
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch {}
