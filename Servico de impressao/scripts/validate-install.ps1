param(
  [switch]$Json,
  [switch]$RequireRunning
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".codex-secrets.env"
$exePath = Join-Path $root "dist\Servico-de-impressao.exe"
$sumatraPath = Join-Path $root "bin\SumatraPDF.exe"

function Get-EnvFileMap {
  $map = @{}
  if (-not (Test-Path $envFile)) {
    return $map
  }

  Get-Content -LiteralPath $envFile -ErrorAction SilentlyContinue | ForEach-Object {
    $line = [string]$_
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      return
    }
    $idx = $trimmed.IndexOf("=")
    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim().Trim('"')
    if ($key) {
      $map[$key] = $value
    }
  }
  return $map
}

function Get-ConfigValue {
  param(
    [hashtable]$EnvMap,
    [string]$Key,
    [string]$Default = ""
  )

  $processValue = [Environment]::GetEnvironmentVariable($Key)
  if ($processValue) {
    return $processValue
  }
  if ($EnvMap.ContainsKey($Key)) {
    return [string]$EnvMap[$Key]
  }
  return $Default
}

function Add-Check {
  param(
    [System.Collections.ArrayList]$Checks,
    [string]$Code,
    [string]$Status,
    [string]$Message,
    [string]$Action = ""
  )

  [void]$Checks.Add([pscustomobject]@{
    code = $Code
    status = $Status
    message = $Message
    action = $Action
  })
}

function Find-Chromium {
  param([hashtable]$EnvMap)

  $custom = Get-ConfigValue -EnvMap $EnvMap -Key "CHROME_PATH"
  if (-not $custom) {
    $custom = Get-ConfigValue -EnvMap $EnvMap -Key "PUPPETEER_EXECUTABLE_PATH"
  }
  if ($custom -and (Test-Path $custom)) {
    return $custom
  }

  $candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  return ""
}

function Get-PortProcess {
  param([int]$Port)

  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($connection -and $connection.OwningProcess) {
      return Get-Process -Id $connection.OwningProcess -ErrorAction Stop
    }
  } catch {}
  return $null
}

$envMap = Get-EnvFileMap
$hostName = Get-ConfigValue -EnvMap $envMap -Key "PRINT_SERVICE_HOST" -Default "127.0.0.1"
$portValue = Get-ConfigValue -EnvMap $envMap -Key "PRINT_SERVICE_PORT" -Default "3001"
$port = 3001
if (-not [int]::TryParse($portValue, [ref]$port)) {
  $port = 3001
}
$healthUrl = "http://$hostName`:$port/health"
$statusUrl = "http://$hostName`:$port/status"
$checks = New-Object System.Collections.ArrayList

if (Test-Path $exePath) {
  Add-Check -Checks $checks -Code "EXE_OK" -Status "ok" -Message "Motor interno encontrado."
} else {
  Add-Check -Checks $checks -Code "EXE_MISSING" -Status "error" -Message "Motor interno nao encontrado." -Action "Use um ZIP portable completo ou gere com 'cmd /c npm run build:exe'."
}

if (Test-Path $sumatraPath) {
  Add-Check -Checks $checks -Code "SUMATRA_OK" -Status "ok" -Message "SumatraPDF encontrado."
} else {
  Add-Check -Checks $checks -Code "SUMATRA_MISSING" -Status "error" -Message "SumatraPDF nao encontrado." -Action "Gere novamente o pacote portable ou rode 'cmd /c npm run prepare:sumatra'."
}

$chromium = Find-Chromium -EnvMap $envMap
if ($chromium) {
  Add-Check -Checks $checks -Code "CHROMIUM_OK" -Status "ok" -Message "Chrome/Edge encontrado."
} else {
  Add-Check -Checks $checks -Code "CHROMIUM_MISSING" -Status "error" -Message "Chrome/Edge nao encontrado." -Action "Instale Chrome/Edge ou configure CHROME_PATH."
}

$adminKeys = @("DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")
$adminConfigured = $false
foreach ($key in $adminKeys) {
  if (Get-ConfigValue -EnvMap $envMap -Key $key) {
    $adminConfigured = $true
    break
  }
}
if ($adminConfigured) {
  Add-Check -Checks $checks -Code "ADMIN_DATA_OK" -Status "ok" -Message "Configuracao local para autoimpressao encontrada."
} else {
  Add-Check -Checks $checks -Code "ADMIN_DATA_MISSING" -Status "warning" -Message "Sem DATABASE_URL ou Service Role local." -Action "Obrigatorio apenas para autoimpressao de check-ins feitos por celular/outro computador."
}

$tokenConfigured = [bool](Get-ConfigValue -EnvMap $envMap -Key "PRINT_SERVICE_TOKEN")
Add-Check -Checks $checks -Code "HTTP_TOKEN" -Status "ok" -Message ("Token HTTP: " + $(if ($tokenConfigured) { "configurado." } else { "nao configurado." }))

$portProcess = Get-PortProcess -Port $port
if ($portProcess) {
  Add-Check -Checks $checks -Code "PORT_IN_USE" -Status "warning" -Message "Porta $port em uso por PID $($portProcess.Id) ($($portProcess.ProcessName))." -Action "Se for outra instancia do DNMS Impressao, use Encerrar servico antes de atualizar."
} else {
  Add-Check -Checks $checks -Code "PORT_FREE" -Status "ok" -Message "Porta $port livre."
}

if ($RequireRunning) {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 4
    $healthStatus = if ($health.ok) { "ok" } else { "warning" }
    Add-Check -Checks $checks -Code "HEALTH_RESPONSE" -Status $healthStatus -Message "Servico respondeu em $healthUrl." -Action "Abra $statusUrl para detalhes."
  } catch {
    Add-Check -Checks $checks -Code "HEALTH_UNREACHABLE" -Status "error" -Message "Servico nao respondeu em $healthUrl." -Action "Inicie pelo DNMS Impressao.cmd e valide novamente."
  }
}

$result = [pscustomobject]@{
  ok = -not ($checks | Where-Object { $_.status -eq "error" })
  root = $root
  status_url = $statusUrl
  checks = $checks
}

if ($Json) {
  $result | ConvertTo-Json -Depth 5
} else {
  Write-Host "DNMS Impressao - validacao da instalacao"
  Write-Host "Pasta: $root"
  Write-Host "Status: $statusUrl"
  Write-Host ""
  foreach ($check in $checks) {
    $prefix = switch ($check.status) {
      "ok" { "[OK]" }
      "warning" { "[AVISO]" }
      default { "[ERRO]" }
    }
    Write-Host "$prefix $($check.code): $($check.message)"
    if ($check.action) {
      Write-Host "       Acao: $($check.action)"
    }
  }
}

if (-not $result.ok) {
  exit 1
}
