[CmdletBinding()]
param(
  [string]$ExtensionId = 'fbpgolbgpdlphhlodhehiilobpanehal',
  [string]$ChromeProfile = 'Default',
  [string]$ArchivePath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
& (Join-Path $PSScriptRoot 'verify-parro-workspace.ps1') | Out-Null

$manifestPath = Join-Path $repoRoot 'mimic_recorder\manifest.json'
$version = (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json).version
if (-not $ArchivePath) {
  $ArchivePath = Join-Path $repoRoot "mimic_recorder\parro-recorder-v$version.zip"
}
$archive = (Resolve-Path -LiteralPath $ArchivePath).Path

$preferencesPath = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\$ChromeProfile\Secure Preferences"
if (-not (Test-Path -LiteralPath $preferencesPath -PathType Leaf)) {
  throw "Chrome Secure Preferences not found: $preferencesPath"
}
$loadedPathValue = & node -e @'
const fs = require('node:fs');
const [preferencesPath, extensionId] = process.argv.slice(1);
const preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
const extension = preferences?.extensions?.settings?.[extensionId];
if (!extension?.path || extension.location !== 4 || extension.from_webstore === true) process.exit(2);
process.stdout.write(extension.path);
'@ $preferencesPath $ExtensionId
if ($LASTEXITCODE -ne 0 -or -not $loadedPathValue) {
  throw "Unpacked extension '$ExtensionId' was not found in Chrome profile '$ChromeProfile'."
}

$loadedPath = (Resolve-Path -LiteralPath $loadedPathValue).Path
$workspaceRoot = (Resolve-Path (Join-Path $repoRoot '..')).Path
if (-not $loadedPath.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to deploy outside workspace '$workspaceRoot': $loadedPath"
}

function Compare-ArchiveToDirectory([string]$ZipPath, [string]$DirectoryPath) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    $mismatches = @()
    $checked = 0
    foreach ($item in $zip.Entries) {
      if ([string]::IsNullOrEmpty($item.Name)) { continue }
      $diskPath = Join-Path $DirectoryPath ($item.FullName -replace '/', '\')
      if (-not (Test-Path -LiteralPath $diskPath -PathType Leaf)) {
        $mismatches += "missing:$($item.FullName)"
        continue
      }
      $sha = [System.Security.Cryptography.SHA256]::Create()
      try {
        $stream = $item.Open()
        try {
          $archiveHash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '')
        } finally { $stream.Dispose() }
      } finally { $sha.Dispose() }
      $diskHash = (Get-FileHash -LiteralPath $diskPath -Algorithm SHA256).Hash
      if ($archiveHash -ne $diskHash) { $mismatches += "hash:$($item.FullName)" }
      $checked++
    }
    return [pscustomobject]@{ ok = $mismatches.Count -eq 0; checked = $checked; mismatches = $mismatches }
  } finally { $zip.Dispose() }
}

$before = Compare-ArchiveToDirectory $archive $loadedPath
if ($before.ok) {
  [pscustomobject]@{
    ok = $true
    deployed = $false
    alreadyCurrent = $true
    extensionId = $ExtensionId
    loadedPath = $loadedPath
    version = $version
    checked = $before.checked
    reloadRequired = $true
  } | ConvertTo-Json
  exit 0
}

$backupRoot = Join-Path $workspaceRoot '_backups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $backupRoot "parro-recorder-loaded-before-v$version-$timestamp"
New-Item -ItemType Directory -Path $backupPath | Out-Null
Copy-Item -Path (Join-Path $loadedPath '*') -Destination $backupPath -Recurse -Force

Expand-Archive -LiteralPath $archive -DestinationPath $loadedPath -Force
$after = Compare-ArchiveToDirectory $archive $loadedPath
if (-not $after.ok) {
  throw "Recorder deployment verification failed: $($after.mismatches -join ', ')"
}

[pscustomobject]@{
  ok = $true
  deployed = $true
  alreadyCurrent = $false
  extensionId = $ExtensionId
  loadedPath = $loadedPath
  version = $version
  checked = $after.checked
  backupPath = $backupPath
  reloadRequired = $true
} | ConvertTo-Json
