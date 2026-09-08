param(
  [switch]$Watch,
  [int]$IntervalSeconds = 30,
  [int]$Count = 1,
  [switch]$Json,
  [switch]$OpenStatus
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$installValidator = Join-Path $PSScriptRoot "validate-install.ps1"

function Get-EnvFileValue {
  param(
    [string]$Key,
    [string]$Default = ""
  )

  $processValue = [Environment]::GetEnvironmentVariable($Key)
  if ($processValue) {
    return $processValue
  }

  $envFile = Join-Path $root ".codex-secrets.env"
  if (-not (Test-Path $envFile)) {
    return $Default
  }

  foreach ($line in (Get-Content -LiteralPath $envFile -ErrorAction SilentlyContinue)) {
    $trimmed = ([string]$line).Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      continue
    }
    $idx = $trimmed.IndexOf("=")
    $currentKey = $trimmed.Substring(0, $idx).Trim()
    if ($currentKey -eq $Key) {
      return $trimmed.Substring($idx + 1).Trim().Trim('"')
    }
  }
  return $Default
}

function Get-ServiceUrls {
  $hostName = Get-EnvFileValue -Key "PRINT_SERVICE_HOST" -Default "127.0.0.1"
  $portText = Get-EnvFileValue -Key "PRINT_SERVICE_PORT" -Default "3001"
  $port = 3001
  if (-not [int]::TryParse($portText, [ref]$port)) {
    $port = 3001
  }
  return [pscustomobject]@{
    Health = "http://$hostName`:$port/health"
    Status = "http://$hostName`:$port/status"
  }
}

function Invoke-InstallValidation {
  if (-not (Test-Path $installValidator)) {
    return [pscustomobject]@{
      ok = $false
      checks = @([pscustomobject]@{
        code = "INSTALL_VALIDATOR_MISSING"
        status = "error"
        message = "validate-install.ps1 nao encontrado."
        action = "Extraia novamente o ZIP portable completo."
      })
    }
  }

  $raw = & powershell -NoProfile -ExecutionPolicy Bypass -File $installValidator -RequireRunning -Json
  if ($LASTEXITCODE -ne 0 -and -not $raw) {
    throw "Validacao da instalacao falhou sem retorno JSON."
  }
  return ($raw | ConvertFrom-Json)
}

function Invoke-HealthValidation {
  param([string]$HealthUrl)

  try {
    return Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5
  } catch {
    return [pscustomobject]@{
      ok = $false
      status = "unreachable"
      diagnostics = @([pscustomobject]@{
        code = "HEALTH_UNREACHABLE"
        severity = "error"
        message = "Servico nao respondeu em $HealthUrl."
        action = "Inicie pelo DNMS Impressao.cmd e rode a validacao novamente."
      })
    }
  }
}

function New-ValidationSnapshot {
  $urls = Get-ServiceUrls
  $install = Invoke-InstallValidation
  $health = Invoke-HealthValidation -HealthUrl $urls.Health
  $diagnostics = @($health.diagnostics)
  $installErrors = @($install.checks | Where-Object { $_.status -eq "error" })
  $healthErrors = @($diagnostics | Where-Object { $_.severity -eq "error" })
  $printerQueueLength = 0
  if ($null -ne $health.printer_queue_length) {
    $printerQueueLength = [int]$health.printer_queue_length
  }

  return [pscustomobject]@{
    checked_at = (Get-Date).ToString("s")
    ok = (($installErrors.Count -eq 0) -and ($healthErrors.Count -eq 0) -and [bool]$health.ok)
    status_url = $urls.Status
    health_url = $urls.Health
    install_checks = $install.checks
    service = [pscustomobject]@{
      ok = [bool]$health.ok
      status = [string]$health.status
      target_printer = [string]$health.target_printer
      printer_ready = [bool]$health.printer_ready
      printer_queue_length = $printerQueueLength
      auto_print_listener = [bool]$health.auto_print_listener
      auto_print_polling = [bool]$health.auto_print_polling
      reprint_queue_polling = [bool]$health.reprint_queue_polling
      supabase_role = [string]$health.supabase_role
    }
    diagnostics = $diagnostics
  }
}

function Write-Snapshot {
  param([object]$Snapshot)

  if ($Json) {
    $Snapshot | ConvertTo-Json -Depth 8
    return
  }

  Clear-Host
  Write-Host "DNMS Impressao - validacao continua"
  Write-Host "Atualizado em: $($Snapshot.checked_at)"
  Write-Host "Status: $($Snapshot.status_url)"
  Write-Host ""
  Write-Host "Servico: $($Snapshot.service.status) | ok=$($Snapshot.service.ok)"
  Write-Host "Brother: $($Snapshot.service.target_printer) | pronta=$($Snapshot.service.printer_ready) | fila=$($Snapshot.service.printer_queue_length)"
  Write-Host "Autoimpressao: listener=$($Snapshot.service.auto_print_listener) polling=$($Snapshot.service.auto_print_polling) role=$($Snapshot.service.supabase_role)"
  Write-Host "Reimpressao: polling=$($Snapshot.service.reprint_queue_polling)"
  Write-Host "Observacao: SPOOLER_DONE confirma apenas saida da fila do Windows; a etiqueta fisica precisa ser observada no local."
  Write-Host ""

  foreach ($check in @($Snapshot.install_checks)) {
    $prefix = if ($check.status -eq "ok") { "[OK]" } elseif ($check.status -eq "warning") { "[AVISO]" } else { "[ERRO]" }
    Write-Host "$prefix $($check.code): $($check.message)"
    if ($check.action) {
      Write-Host "       Acao: $($check.action)"
    }
  }

  foreach ($item in @($Snapshot.diagnostics)) {
    $prefix = if ($item.severity -eq "error") { "[ERRO]" } elseif ($item.severity -eq "warning") { "[AVISO]" } else { "[INFO]" }
    Write-Host "$prefix $($item.code): $($item.message)"
    if ($item.action) {
      Write-Host "       Acao: $($item.action)"
    }
  }
}

if ($OpenStatus) {
  Start-Process (Get-ServiceUrls).Status
}

$iterations = if ($Watch -and $Count -le 1) { 0 } else { $Count }
$done = 0
$lastSnapshot = $null
do {
  $lastSnapshot = New-ValidationSnapshot
  Write-Snapshot -Snapshot $lastSnapshot
  $done += 1
  if ($iterations -ne 0 -and $done -ge $iterations) {
    break
  }
  Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
} while ($Watch -or $iterations -eq 0)

if (-not $lastSnapshot.ok) {
  exit 1
}
