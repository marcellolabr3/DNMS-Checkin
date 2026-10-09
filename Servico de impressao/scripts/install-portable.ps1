param(
  [switch]$NoShortcut,
  [switch]$NoStartupShortcut,
  [switch]$StartNow,
  [switch]$StopExisting
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $root "DNMS Impressao.cmd"
$validator = Join-Path $PSScriptRoot "validate-install.ps1"
$stopScript = Join-Path $PSScriptRoot "stop-background.ps1"

Set-Location $root

if (-not (Test-Path $launcher)) {
  throw "Iniciador ausente: $launcher"
}
if (-not (Test-Path $validator)) {
  throw "Validador ausente: $validator"
}

if ($StopExisting -and (Test-Path $stopScript)) {
  Write-Host "Encerrando instancia anterior, se existir..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $stopScript
}

Write-Host "Validando arquivos do pacote..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $validator
if ($LASTEXITCODE -ne 0) {
  throw "Validacao falhou. Corrija os itens com [ERRO] antes de iniciar."
}

if (-not $NoShortcut) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  $shortcutPath = Join-Path $desktop "DNMS Impressao.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcher
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = "Inicia o servico local de impressao do DNMS Check-in"
  $shortcut.Save()
  Write-Host "Atalho criado/atualizado na area de trabalho: $shortcutPath"
}

if (-not $NoStartupShortcut) {
  $startup = [Environment]::GetFolderPath("Startup")
  $startupShortcutPath = Join-Path $startup "DNMS Impressao.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $startupShortcut = $shell.CreateShortcut($startupShortcutPath)
  $startupShortcut.TargetPath = $launcher
  $startupShortcut.WorkingDirectory = $root
  $startupShortcut.Description = "Inicia automaticamente o servico local de impressao do DNMS Check-in"
  $startupShortcut.Save()
  Write-Host "Inicializacao com Windows criada/atualizada: $startupShortcutPath"
}

if ($StartNow) {
  Write-Host "Iniciando DNMS Impressao..."
  Start-Process -FilePath $launcher -WorkingDirectory $root
  Start-Sleep -Seconds 4
  & powershell -NoProfile -ExecutionPolicy Bypass -File $validator -RequireRunning
}

Write-Host "Instalacao/atualizacao concluida."
