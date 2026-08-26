$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$createdMutex = $false
$mutex = New-Object System.Threading.Mutex($true, "DNMSCheckinPrintServiceTray", [ref]$createdMutex)
if (-not $createdMutex) {
  exit 0
}

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".service.pid"
$exePath = Join-Path $root "dist\\Servico-de-impressao.exe"
$statusUrl = "http://localhost:3001/status"
$healthUrl = "http://localhost:3001/health"

function Set-NotifyText {
  param(
    [System.Windows.Forms.NotifyIcon]$NotifyIcon,
    [string]$Text
  )

  if (-not $NotifyIcon) {
    return
  }

  $cleanText = [string]$Text
  if ($cleanText.Length -gt 63) {
    $cleanText = $cleanText.Substring(0, 60) + "..."
  }
  $NotifyIcon.Text = $cleanText
}

function Get-ServiceProcessFromPidFile {
  if (-not (Test-Path $pidFile)) {
    return $null
  }

  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if (-not $existingPid) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    return $null
  }

  try {
    return Get-Process -Id $existingPid -ErrorAction Stop
  } catch {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    return $null
  }
}

function Get-ServiceProcessFromPort {
  try {
    $connection = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($connection -and $connection.OwningProcess) {
      return Get-Process -Id $connection.OwningProcess -ErrorAction Stop
    }
  } catch {}

  return $null
}

function Set-NotifyStatus {
  param(
    [System.Windows.Forms.NotifyIcon]$NotifyIcon,
    [System.Diagnostics.Process]$ServiceProcess
  )

  if (-not $NotifyIcon) {
    return
  }

  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.ok) {
      $printer = [string]($health.target_printer)
      if (-not $printer) {
        $printer = "-"
      }
      $NotifyIcon.Icon = [System.Drawing.SystemIcons]::Application
      Set-NotifyText -NotifyIcon $NotifyIcon -Text "DNMS impressao: online - $printer"
      return
    }
  } catch {}

  if ($ServiceProcess -and -not $ServiceProcess.HasExited) {
    $NotifyIcon.Icon = [System.Drawing.SystemIcons]::Warning
    Set-NotifyText -NotifyIcon $NotifyIcon -Text "DNMS impressao: iniciando/verificar health"
  } else {
    $NotifyIcon.Icon = [System.Drawing.SystemIcons]::Error
    Set-NotifyText -NotifyIcon $NotifyIcon -Text "DNMS impressao: parado"
  }
}

if (-not (Test-Path $exePath)) {
  exit 1
}

$proc = Get-ServiceProcessFromPidFile
if (-not $proc) {
  $proc = Get-ServiceProcessFromPort
}
if (-not $proc) {
  $proc = Start-Process -FilePath $exePath -WorkingDirectory $root -WindowStyle Hidden -PassThru
}
Set-Content -Path $pidFile -Value $proc.Id

$notify = New-Object System.Windows.Forms.NotifyIcon
Set-NotifyText -NotifyIcon $notify -Text "DNMS impressao: iniciando"
$notify.Visible = $true
$notify.BalloonTipTitle = "Servico de impressao"
$notify.BalloonTipText = "Sistema pronto"
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.ShowBalloonTip(2000)

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = $menu.Items.Add("Abrir status")
$exitItem = $menu.Items.Add("Encerrar servico")
$notify.ContextMenuStrip = $menu

$appContext = New-Object System.Windows.Forms.ApplicationContext
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({
  Set-NotifyStatus -NotifyIcon $notify -ServiceProcess $proc
})

$statusItem.Add_Click({
  Start-Process $statusUrl
})

$exitItem.Add_Click({
  try {
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {}
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  $timer.Stop()
  $timer.Dispose()
  $notify.Visible = $false
  $notify.Dispose()
  $menu.Dispose()
  $mutex.ReleaseMutex()
  $mutex.Dispose()
  $appContext.ExitThread()
})

Set-NotifyStatus -NotifyIcon $notify -ServiceProcess $proc
$timer.Start()
[System.Windows.Forms.Application]::Run($appContext)
