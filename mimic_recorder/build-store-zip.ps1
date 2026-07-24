# Build Chrome Web Store ZIP — whitelist runtime files only.
# Excludes dev files: .env, AGENTS.md, test_*, supabase/, store-assets/, etc.
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
  'desktop-bridge.js', 'desktop-import.js', 'targeting.js',
  'popup.js', 'popup.html', 'i18n.js',
  '_locales/ko/messages.json', '_locales/en/messages.json',
  'offscreen.html', 'offscreen.js',
  'request-mic.html', 'request-mic.js',
  'assets/parro-ai-avatar.png',
  'assets/parro-ai-avatar-neutral.png',
  'assets/parro-ai-avatar-listen.png',
  'assets/parro-ai-avatar-talk.png',
  'assets/parro-ai-avatar-point.png',
  'assets/parro-ai-avatar-think.png',
  'assets/parro-ai-avatar-search.png',
  'assets/parro-ai-avatar-warning.png',
  'assets/parro-ai-avatar-error.png',
  'assets/parro-ai-avatar-blocked.png',
  'assets/parro-ai-avatar-clarify.png',
  'assets/parro-ai-avatar-success.png'
)
foreach ($f in $files) {
  if (-not (Test-Path $f)) { throw "Missing required file: $f" }
  $destination = Join-Path $stage $f
  $destinationDir = Split-Path $destination -Parent
  New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  Copy-Item $f $destination
}
foreach ($i in @('icon16.png','icon48.png','icon128.png')) {
  Copy-Item (Join-Path 'icons' $i) (Join-Path $stage 'icons')
}

# 운영 패키지는 locale의 dev 표식을 제거한다.
foreach ($localeFile in @('_locales/ko/messages.json', '_locales/en/messages.json')) {
  $stagedLocale = Join-Path $stage $localeFile
  $localeText = [System.IO.File]::ReadAllText($stagedLocale)
  $localeText = $localeText.Replace('Parro Recorder (dev)', 'Parro Recorder')
  [System.IO.File]::WriteAllText($stagedLocale, $localeText, (New-Object System.Text.UTF8Encoding($false)))
}

$out = Join-Path $PSScriptRoot "parro-recorder-v$version.zip"
if (Test-Path $out) { Remove-Item $out -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $files) {
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      (Join-Path $stage $f),
      $f,
      [System.IO.Compression.CompressionLevel]::Optimal
    )
  }
  foreach ($i in @('icon16.png','icon48.png','icon128.png')) {
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      (Join-Path (Join-Path $stage 'icons') $i),
      "icons/$i",
      [System.IO.Compression.CompressionLevel]::Optimal
    )
  }
} finally {
  $archive.Dispose()
}
Remove-Item $stage -Recurse -Force

$size = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "OK  parro-recorder-v$version.zip  ($size KB)"
Write-Host "Included: $($files.Count) files + 3 icons"
