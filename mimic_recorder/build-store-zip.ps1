# Build Chrome Web Store ZIP — whitelist runtime files only.
# Excludes dev files: .env, CLAUDE.md, test_*, supabase/, store-assets/, etc.
# Run:  powershell -ExecutionPolicy Bypass -File build-store-zip.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$manifest = Get-Content manifest.json -Raw | ConvertFrom-Json
$version  = $manifest.version

$stage = Join-Path $env:TEMP 'parro-recorder-build'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $stage 'icons') -Force | Out-Null

# Runtime whitelist (anything not listed here never ends up in the package)
$files = @(
  'manifest.json',
  'background.js', 'content.js', 'guide-engine.js',
  'popup.js', 'popup.html',
  'offscreen.html', 'offscreen.js',
  'request-mic.html', 'request-mic.js'
)
foreach ($f in $files) {
  if (-not (Test-Path $f)) { throw "Missing required file: $f" }
  Copy-Item $f $stage
}
foreach ($i in @('icon16.png','icon48.png','icon128.png')) {
  Copy-Item (Join-Path 'icons' $i) (Join-Path $stage 'icons')
}

# 운영 패키지는 dev 표식 제거 — 소스 manifest는 언팩 dev 구분용으로 "(dev)"를 달고 있다.
$stagedManifest = Join-Path $stage 'manifest.json'
$mtext = [System.IO.File]::ReadAllText($stagedManifest)
$mtext = $mtext.Replace('Parro Recorder (dev)', 'Parro Recorder')
[System.IO.File]::WriteAllText($stagedManifest, $mtext, (New-Object System.Text.UTF8Encoding($false)))

$out = Join-Path $PSScriptRoot "parro-recorder-v$version.zip"
if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -Force
Remove-Item $stage -Recurse -Force

$size = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "OK  parro-recorder-v$version.zip  ($size KB)"
Write-Host "Included: $($files.Count) files + 3 icons"
