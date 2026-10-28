$ErrorActionPreference = 'Stop'
$env:TEXMFHOME = 'E:\G\codex\texmf'

$sourceDir = $PSScriptRoot
$buildDir = Join-Path $sourceDir 'build'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
$engine = 'E:\G\codex\TinyTeX\TinyTeX\bin\windows\xelatex.exe'
$pdfToPpm = 'C:\Users\qingyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe'

$diagrams = @(
  'voltage-follower',
  'inverting',
  'non-inverting',
  'summing',
  'differential',
  'integrator',
  'differentiator'
)

foreach ($name in $diagrams) {
  $tex = Join-Path $sourceDir "$name.tex"
  $compileLog = Join-Path $buildDir "$name.compile.log"
  & $engine '-interaction=nonstopmode' '-halt-on-error' "-output-directory=$buildDir" $tex *> $compileLog
  if ($LASTEXITCODE -ne 0) {
    Get-Content -LiteralPath $compileLog -Tail 30
    throw "XeLaTeX failed for $name.tex"
  }

  $pdf = Join-Path $buildDir "$name.pdf"
  $png = Join-Path $sourceDir $name
  & $pdfToPpm -png -r 300 -singlefile $pdf $png
  if ($LASTEXITCODE -ne 0) {
    throw "pdftoppm failed for $name.pdf"
  }
}

Write-Host "Generated $($diagrams.Count) circuitikz diagrams in $sourceDir"
