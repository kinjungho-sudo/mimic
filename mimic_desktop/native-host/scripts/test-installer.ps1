param(
  [string]$InstallerPath,
  [switch]$UninstallAfter
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $InstallerPath) {
  $InstallerPath = Join-Path $root "dist\installer\ParroDesktopSetup.exe"
}
$InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).Path

$hostName = "com.mimic.desktop_companion.dev"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\MIMIC\DesktopCompanion"
$manifestPath = Join-Path $installDir "$hostName.json"
$requiredFiles = @(
  "node.exe",
  "host.js",
  "capture-agent.ps1",
  "controller.ps1",
  "mimic-desktop-host.cmd",
  "$hostName.json"
)
$requiredExtensionIds = @(
  "pnkkalnfddapkmiobbhnkbhplakamaok",
  "ehbhcdkapcbfehinjapabgoegcjmmbgd"
)

$process = Start-Process -FilePath $InstallerPath -ArgumentList "/Q" -Wait -PassThru
if ($process.ExitCode -ne 0) {
  throw "Installer exited with code $($process.ExitCode)."
}

$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $manifestPath)) {
  Start-Sleep -Milliseconds 500
}

if (-not (Test-Path $registryPath)) {
  throw "Native Messaging registry key was not created: $registryPath"
}

$registeredManifest = (Get-ItemProperty -Path $registryPath)."(default)"
if ($registeredManifest -ne $manifestPath) {
  throw "Registry manifest mismatch. Expected '$manifestPath', got '$registeredManifest'."
}

foreach ($file in $requiredFiles) {
  $path = Join-Path $installDir $file
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Installed file is missing: $path"
  }
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.name -ne $hostName) {
  throw "Unexpected Native Messaging host name: $($manifest.name)"
}
if (-not (Test-Path -LiteralPath $manifest.path)) {
  throw "Manifest host path does not exist: $($manifest.path)"
}
foreach ($extensionId in $requiredExtensionIds) {
  $origin = "chrome-extension://$extensionId/"
  if ($manifest.allowed_origins -notcontains $origin) {
    throw "Required extension origin is missing: $origin"
  }
}

$smokeScript = Join-Path $root "scripts\smoke-native-host.js"
$installedHost = Join-Path $installDir "host.js"
$installedNode = Join-Path $installDir "node.exe"
& node $smokeScript $installedHost $installedNode
if ($LASTEXITCODE -ne 0) {
  throw "Installed Native Messaging host smoke test failed."
}

$result = [ordered]@{
  ok = $true
  installer = $InstallerPath
  installer_sha256 = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash
  install_dir = $installDir
  manifest = $manifestPath
  allowed_origins = $manifest.allowed_origins
}
$result | ConvertTo-Json -Depth 4

if ($UninstallAfter) {
  $installScript = Join-Path $root "installer\install.ps1"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installScript -Uninstall -Quiet
  if ($LASTEXITCODE -ne 0) {
    throw "Uninstall verification failed."
  }
}
