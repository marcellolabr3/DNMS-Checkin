$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".service.pid"
$exePath = Join-Path $root "dist\\Servico-de-impressao.exe"

if (-not (Test-Path $exePath)) {
  exit 1
}

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existingPid) {
    try {
      $existingProc = Get-Process -Id $existingPid -ErrorAction Stop
      if ($existingProc) {
        exit 0
      }
    } catch {
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
  }
}

$proc = Start-Process -FilePath $exePath -WorkingDirectory $root -WindowStyle Hidden -PassThru
Set-Content -Path $pidFile -Value $proc.Id

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.Text = "Servico de impressao"
$notify.Visible = $true
$notify.BalloonTipTitle = "Servico de impressao"
$notify.BalloonTipText = "Sistema pronto"
$notify.ShowBalloonTip(2000)

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$exitItem = $menu.Items.Add("Encerrar servico")
$notify.ContextMenuStrip = $menu

$appContext = New-Object System.Windows.Forms.ApplicationContext

$exitItem.Add_Click({
  try {
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {}
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  $notify.Visible = $false
  $notify.Dispose()
  $menu.Dispose()
  $appContext.ExitThread()
})

[System.Windows.Forms.Application]::Run($appContext)
