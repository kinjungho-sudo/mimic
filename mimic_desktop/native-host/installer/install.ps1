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
$startMenuShortcut = Join-Path ([Environment]::GetFolderPath("Programs")) "Parro Desktop Capture.lnk"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Parro Desktop Capture.lnk"
$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$defaultExtensionIds = @(
  "pnkkalnfddapkmiobbhnkbhplakamaok",
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
  Remove-Item -LiteralPath $startMenuShortcut -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $desktopShortcut -Force -ErrorAction SilentlyContinue
  Show-Result "Parro Desktop" "Uninstalled."
  exit 0
}

$nodeSource = Join-Path $sourceRoot "node.exe"
$hostSource = Join-Path $sourceRoot "host.js"
$captureAgentSource = Join-Path $sourceRoot "capture-agent.ps1"
$controllerSource = Join-Path $sourceRoot "controller.ps1"

if (-not (Test-Path $nodeSource)) {
  throw "node.exe is missing from installer payload."
}
if (-not (Test-Path $hostSource)) {
  throw "host.js is missing from installer payload."
}
if (-not (Test-Path $captureAgentSource)) {
  throw "capture-agent.ps1 is missing from installer payload."
}
if (-not (Test-Path $controllerSource)) {
  throw "controller.ps1 is missing from installer payload."
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $installDir "node.exe") -Force
Copy-Item -LiteralPath $hostSource -Destination (Join-Path $installDir "host.js") -Force
Copy-Item -LiteralPath $captureAgentSource -Destination (Join-Path $installDir "capture-agent.ps1") -Force
Copy-Item -LiteralPath $controllerSource -Destination (Join-Path $installDir "controller.ps1") -Force

$wrapperContent = @"
@echo off
"%~dp0node.exe" "%~dp0host.js"
"@
[System.IO.File]::WriteAllText($wrapperPath, $wrapperContent, [System.Text.UTF8Encoding]::new($false))

$extensionIds = New-Object System.Collections.Generic.List[string]
foreach ($extensionId in $defaultExtensionIds) {
  $extensionIds.Add($extensionId)
}
$extraExtensionIds = if ($env:PARRO_EXTENSION_ID) { $env:PARRO_EXTENSION_ID } else { $env:MIMIC_EXTENSION_ID }
if ($extraExtensionIds) {
  foreach ($extensionId in ($extraExtensionIds -split ",")) {
    $trimmed = $extensionId.Trim()
    if ($trimmed -and -not $extensionIds.Contains($trimmed)) {
      $extensionIds.Add($trimmed)
    }
  }
}

$manifest = [ordered]@{
  name = $hostName
  description = "Parro Desktop preview native messaging host"
  path = $wrapperPath
  type = "stdio"
  allowed_origins = @($extensionIds | ForEach-Object { "chrome-extension://$_/" })
}

$manifestJson = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))

New-Item -ItemType Directory -Force -Path $registryPath | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestPath

$controllerPath = Join-Path $installDir "controller.ps1"
$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @($startMenuShortcut, $desktopShortcut)) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = "powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$controllerPath`""
  $shortcut.WorkingDirectory = $installDir
  $shortcut.Save()
}

$logPath = Join-Path $installDir "install.log"
$log = [ordered]@{
  installed_at = (Get-Date).ToString("o")
  host = $hostName
  manifest = $manifestPath
  wrapper = $wrapperPath
  allowed_origins = $manifest.allowed_origins
}
($log | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $logPath -Encoding UTF8

Start-Process powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", "`"$controllerPath`""
Show-Result "Parro Desktop" "설치가 완료되었습니다. Parro Desktop Capture 창에서 캡처를 시작할 수 있습니다."
