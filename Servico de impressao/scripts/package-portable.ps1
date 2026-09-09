$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$packageRoot = Join-Path $root "dist-pacote"
$packageName = "DNMS-Servico-de-impressao"
$staging = Join-Path $packageRoot $packageName
$zipPath = Join-Path $packageRoot "$packageName-portable.zip"

Set-Location $root

if (-not (Test-Path (Join-Path $root "dist\Servico-de-impressao.exe"))) {
  cmd /c npm run build:exe
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao gerar o executavel do servico de impressao."
  }
}

if (-not (Test-Path (Join-Path $root "bin\SumatraPDF.exe"))) {
  cmd /c npm run prepare:sumatra
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao preparar o SumatraPDF."
  }
}

Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $staging) {
  Start-Sleep -Milliseconds 500
  Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path $staging) {
  throw "Nao foi possivel limpar a pasta de pacote: $staging. Feche qualquer servico/janela usando essa pasta e tente novamente."
}
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$items = @(
  "dist",
  "bin",
  "scripts",
  "DNMS Impressao.cmd",
  "DNMS Instalar Atualizar.cmd",
  "DNMS Validar Instalacao.cmd",
  "DNMS Validacao Continua.cmd",
  "README.md",
  ".codex-secrets.example.env"
)

foreach ($item in $items) {
  $source = Join-Path $root $item
  if (-not (Test-Path $source)) {
    throw "Item obrigatorio ausente: $item"
  }
  Copy-Item -LiteralPath $source -Destination $staging -Recurse -Force
}

$sqliteBinding = Join-Path $root "node_modules\sqlite3\build\Release\node_sqlite3.node"
if (-not (Test-Path $sqliteBinding)) {
  throw "Binding nativo do SQLite ausente: $sqliteBinding"
}
$sqliteNativeDir = Join-Path $staging "dist\native\sqlite3"
New-Item -ItemType Directory -Path $sqliteNativeDir -Force | Out-Null
Copy-Item -LiteralPath $sqliteBinding -Destination $sqliteNativeDir -Force

$localSecrets = Join-Path $root ".codex-secrets.env"
if (Test-Path $localSecrets) {
  Copy-Item -LiteralPath $localSecrets -Destination $staging -Force
  Write-Host "Configuracao local incluida no pacote: .codex-secrets.env"
} else {
  Write-Host "Configuracao local ausente: crie .codex-secrets.env no destino antes de usar autoimpressao do celular."
}

Compress-Archive -LiteralPath $staging -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $staging -Recurse -Force

Write-Host "Pacote gerado em: $zipPath"
