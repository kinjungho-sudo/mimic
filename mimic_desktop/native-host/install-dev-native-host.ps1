param(
  [string]$ExtensionId,
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$hostName = "com.mimic.desktop_companion.dev"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist"
$hostScript = Join-Path $root "src\host.js"
$wrapperPath = Join-Path $dist "mimic-desktop-host.cmd"
$manifestPath = Join-Path $dist "$hostName.json"

if ($Uninstall) {
  if (Test-Path $registryPath) {
    Remove-Item -Path $registryPath -Recurse -Force
  }
  Write-Host "Unregistered $hostName"
  exit 0
}

if (-not $ExtensionId) {
  throw "ExtensionId is required. Load mimic_recorder in Chrome and copy its extension ID."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required for the dev native host."
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null

$wrapperContent = @"
@echo off
node "$hostScript"
"@
[System.IO.File]::WriteAllText($wrapperPath, $wrapperContent, [System.Text.UTF8Encoding]::new($false))

$manifest = [ordered]@{
  name = $hostName
  description = "Parro Desktop Companion dev native messaging host"
  path = $wrapperPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestJson = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

New-Item -ItemType Directory -Force -Path $registryPath | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestPath

Write-Host "Registered $hostName"
Write-Host "Manifest: $manifestPath"
Write-Host "Allowed extension: chrome-extension://$ExtensionId/"
