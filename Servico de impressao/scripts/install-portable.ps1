param(
  [switch]$NoShortcut,
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

if ($StartNow) {
  Write-Host "Iniciando DNMS Impressao..."
  Start-Process -FilePath $launcher -WorkingDirectory $root
  Start-Sleep -Seconds 4
  & powershell -NoProfile -ExecutionPolicy Bypass -File $validator -RequireRunning
}

Write-Host "Instalacao/atualizacao concluida."
