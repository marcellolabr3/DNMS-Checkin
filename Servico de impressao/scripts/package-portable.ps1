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
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging | Out-Null

$items = @(
  "dist",
  "bin",
  "scripts",
  "Iniciar Servico de impressao.cmd",
  "Parar Servico de impressao.cmd",
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

Compress-Archive -LiteralPath $staging -DestinationPath $zipPath -Force

Write-Host "Pacote gerado em: $zipPath"
