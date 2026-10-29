$ErrorActionPreference = 'Stop'
$env:TEXMFHOME = 'E:\G\codex\texmf'

$sourceDir = $PSScriptRoot
$buildDir = Join-Path $env:TEMP 'codex-diode-circuitikz-build'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
$engine = 'E:\G\codex\TinyTeX\TinyTeX\bin\windows\xelatex.exe'
$pdfToPpm = 'C:\Users\qingyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe'

$files = Get-ChildItem -LiteralPath $sourceDir -Filter 'diode-*.tex' | Sort-Object Name
foreach ($file in $files) {
  $name = $file.BaseName
  $compileLog = Join-Path $buildDir "$name.compile.log"
  & $engine '-interaction=nonstopmode' '-halt-on-error' "-output-directory=$buildDir" $file.FullName *> $compileLog
  if ($LASTEXITCODE -ne 0) {
    Get-Content -LiteralPath $compileLog -Tail 30
    throw "XeLaTeX failed for $($file.Name)"
  }

  $pdf = Join-Path $buildDir "$name.pdf"
  & $pdfToPpm -png -r 300 -singlefile $pdf (Join-Path $sourceDir $name)
  if ($LASTEXITCODE -ne 0) {
    throw "PDF rasterization failed for $name"
  }
}

Write-Host "Generated $($files.Count) diode diagrams in $sourceDir"
