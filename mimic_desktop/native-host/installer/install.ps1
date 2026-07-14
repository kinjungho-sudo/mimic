param(
  [switch]$Uninstall,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$hostName = "com.mimic.desktop_companion.dev"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\MIMIC\DesktopCompanion"
$manifestPath = Join-Path $installDir "$hostName.json"
$wrapperPath = Join-Path $installDir "mimic-desktop-host.cmd"
$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$defaultExtensionIds = @(
  "dhfcmomnambegkibjnandckacihnaelb",
  "ehbhcdkapcbfehinjapabgoegcjmmbgd"
)

function Show-Result {
  param([string]$Title, [string]$Message)

  if ($Quiet) {
    Write-Host "$Title - $Message"
    return
  }

  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($Message, $Title) | Out-Null
  } catch {
    Write-Host "$Title - $Message"
  }
}

if ($Uninstall) {
  if (Test-Path $registryPath) {
    Remove-Item -Path $registryPath -Recurse -Force
  }
  if (Test-Path $installDir) {
    Remove-Item -Path $installDir -Recurse -Force
  }
  Show-Result "MIMIC Desktop Companion" "Uninstalled."
  exit 0
}

$nodeSource = Join-Path $sourceRoot "node.exe"
$hostSource = Join-Path $sourceRoot "host.js"
$captureAgentSource = Join-Path $sourceRoot "capture-agent.ps1"

if (-not (Test-Path $nodeSource)) {
  throw "node.exe is missing from installer payload."
}
if (-not (Test-Path $hostSource)) {
  throw "host.js is missing from installer payload."
}
if (-not (Test-Path $captureAgentSource)) {
  throw "capture-agent.ps1 is missing from installer payload."
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $installDir "node.exe") -Force
Copy-Item -LiteralPath $hostSource -Destination (Join-Path $installDir "host.js") -Force
Copy-Item -LiteralPath $captureAgentSource -Destination (Join-Path $installDir "capture-agent.ps1") -Force

$wrapperContent = @"
@echo off
"%~dp0node.exe" "%~dp0host.js"
"@
[System.IO.File]::WriteAllText($wrapperPath, $wrapperContent, [System.Text.UTF8Encoding]::new($false))

$extensionIds = New-Object System.Collections.Generic.List[string]
foreach ($extensionId in $defaultExtensionIds) {
  $extensionIds.Add($extensionId)
}
if ($env:MIMIC_EXTENSION_ID) {
  foreach ($extensionId in ($env:MIMIC_EXTENSION_ID -split ",")) {
    $trimmed = $extensionId.Trim()
    if ($trimmed -and -not $extensionIds.Contains($trimmed)) {
      $extensionIds.Add($trimmed)
    }
  }
}

$manifest = [ordered]@{
  name = $hostName
  description = "MIMIC Desktop Companion dev native messaging host"
  path = $wrapperPath
  type = "stdio"
  allowed_origins = @($extensionIds | ForEach-Object { "chrome-extension://$_/" })
}

$manifestJson = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

New-Item -ItemType Directory -Force -Path $registryPath | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestPath

$logPath = Join-Path $installDir "install.log"
$log = [ordered]@{
  installed_at = (Get-Date).ToString("o")
  host = $hostName
  manifest = $manifestPath
  wrapper = $wrapperPath
  allowed_origins = $manifest.allowed_origins
}
($log | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $logPath -Encoding UTF8

Show-Result "MIMIC Desktop Companion" "Installed. Return to MIMIC and click '설치 완료, 연결 확인'."
