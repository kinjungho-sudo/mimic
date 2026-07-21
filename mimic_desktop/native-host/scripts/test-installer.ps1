param(
  [string]$InstallerPath,
  [string]$InstallDir,
  [switch]$UninstallAfter
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $InstallerPath) {
  $InstallerPath = Join-Path $root "dist\installer\ParroDesktopSetup.exe"
}
$InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).Path
if (-not $InstallDir) {
  $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\Parro\Desktop"
}
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)

$hostName = "com.mimic.desktop_companion.dev"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$uninstallRegistryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ParroDesktop"
$manifestPath = Join-Path $InstallDir "$hostName.json"
$requiredFiles = @(
  "node.exe",
  "host.js",
  "capture-agent.ps1",
  "controller.ps1",
  "ParroDesktop.exe",
  "parro.ico",
  "parro-desktop-host.cmd",
  "Uninstall.exe",
  "install.json",
  "$hostName.json"
)
$requiredExtensionIds = @(
  "lefkpmfgdbhckcemfghpegleknaepekm",
  "pnkkalnfddapkmiobbhnkbhplakamaok",
  "ehbhcdkapcbfehinjapabgoegcjmmbgd"
)

$arguments = @("/quiet", "/nolaunch", "/dir=$InstallDir")
$process = Start-Process -FilePath $InstallerPath -ArgumentList $arguments -Wait -PassThru
if ($process.ExitCode -ne 0) {
  $logPath = Join-Path $env:LOCALAPPDATA "Parro\DesktopCompanion\installer.log"
  $logTail = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Tail 40 | Out-String } else { "No installer log found." }
  throw "Installer exited with code $($process.ExitCode).`n$logTail"
}

if (-not (Test-Path $registryPath)) {
  throw "Native Messaging registry key was not created: $registryPath"
}
if (-not (Test-Path $uninstallRegistryPath)) {
  throw "Windows uninstall registry key was not created: $uninstallRegistryPath"
}

$registeredManifest = (Get-ItemProperty -Path $registryPath)."(default)"
if ($registeredManifest -ne $manifestPath) {
  throw "Registry manifest mismatch. Expected '$manifestPath', got '$registeredManifest'."
}
$registeredLocation = (Get-ItemProperty -Path $uninstallRegistryPath).InstallLocation
if ($registeredLocation -ne $InstallDir) {
  throw "Uninstall install-location mismatch. Expected '$InstallDir', got '$registeredLocation'."
}
$expectedIconPath = Join-Path $InstallDir "parro.ico"
$registeredIcon = (Get-ItemProperty -Path $uninstallRegistryPath).DisplayIcon
if ([System.IO.Path]::GetFullPath($registeredIcon) -ne [System.IO.Path]::GetFullPath($expectedIconPath)) {
  throw "Uninstall icon mismatch. Expected '$expectedIconPath', got '$registeredIcon'."
}
$registeredVersion = (Get-ItemProperty -Path $uninstallRegistryPath).DisplayVersion
if ($registeredVersion -ne "0.5.0") {
  throw "Installed version mismatch. Expected '0.5.0', got '$registeredVersion'."
}

foreach ($file in $requiredFiles) {
  $path = Join-Path $InstallDir $file
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Installed file is missing: $path"
  }
}

foreach ($scriptName in @("controller.ps1", "capture-agent.ps1")) {
  $scriptBytes = [System.IO.File]::ReadAllBytes((Join-Path $InstallDir $scriptName))
  if ($scriptBytes.Length -lt 3 -or $scriptBytes[0] -ne 0xEF -or $scriptBytes[1] -ne 0xBB -or $scriptBytes[2] -ne 0xBF) {
    throw "PowerShell payload must be UTF-8 BOM encoded for Windows PowerShell 5.1: $scriptName"
  }
}

$manifestText = [System.IO.File]::ReadAllText($manifestPath, [System.Text.UTF8Encoding]::new($false, $true))
$manifest = $manifestText | ConvertFrom-Json
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

$startMenuShortcut = Join-Path ([Environment]::GetFolderPath("Programs")) "Parro Desktop Capture.lnk"
if (-not (Test-Path -LiteralPath $startMenuShortcut)) {
  throw "Start-menu shortcut was not created: $startMenuShortcut"
}

$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($startMenuShortcut)
$expectedShortcutTarget = Join-Path $InstallDir "ParroDesktop.exe"
if ([System.IO.Path]::GetFullPath($shortcut.TargetPath) -ne [System.IO.Path]::GetFullPath($expectedShortcutTarget)) {
  throw "Start-menu shortcut target mismatch. Expected '$expectedShortcutTarget', got '$($shortcut.TargetPath)'."
}
if (-not $shortcut.IconLocation.StartsWith($expectedIconPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Start-menu shortcut icon mismatch. Expected '$expectedIconPath', got '$($shortcut.IconLocation)'."
}

Add-Type -AssemblyName System.Drawing
function Assert-ParroIcon {
  param(
    [System.Drawing.Icon]$Icon,
    [string]$Label
  )

  $bitmap = $Icon.ToBitmap()
  try {
    $parroColorPixels = 0
    $legacyPurplePixels = 0
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      for ($y = 0; $y -lt $bitmap.Height; $y++) {
        $pixel = $bitmap.GetPixel($x, $y)
        if ($pixel.A -lt 32) { continue }
        $isTeal = $pixel.R -le 45 -and $pixel.G -ge 115 -and $pixel.B -ge 75
        $isLime = $pixel.R -ge 80 -and $pixel.R -le 180 -and $pixel.G -ge 165 -and $pixel.B -le 115
        if ($isTeal -or $isLime) { $parroColorPixels++ }
        # Legacy MIMIC purple has meaningful red plus a strongly dominant blue.
        # Requiring red avoids counting Parro's cyan/teal antialiasing as purple.
        if ($pixel.R -ge 30 -and $pixel.G -lt 130 -and $pixel.B -ge ($pixel.R + 30) -and $pixel.B -ge ($pixel.G + 30)) { $legacyPurplePixels++ }
      }
    }
    if ($parroColorPixels -lt 3) {
      throw "$Label does not contain the Parro teal/lime brand colors."
    }
    if ($legacyPurplePixels -gt $parroColorPixels) {
      throw "$Label still appears to use the legacy purple MIMIC icon."
    }
  } finally {
    $bitmap.Dispose()
  }
}

$setupIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($InstallerPath)
try {
  if (-not $setupIcon -or $setupIcon.Width -lt 16) {
    throw "Installer executable icon could not be loaded."
  }
  Assert-ParroIcon -Icon $setupIcon -Label "Installer executable icon"
} finally {
  if ($setupIcon) { $setupIcon.Dispose() }
}

$launcherIcon = [System.Drawing.Icon]::ExtractAssociatedIcon((Join-Path $InstallDir "ParroDesktop.exe"))
try {
  if (-not $launcherIcon -or $launcherIcon.Width -lt 16) {
    throw "Desktop launcher icon could not be loaded."
  }
  Assert-ParroIcon -Icon $launcherIcon -Label "Desktop launcher icon"
} finally {
  if ($launcherIcon) { $launcherIcon.Dispose() }
}

$installedIcon = New-Object System.Drawing.Icon($expectedIconPath)
try {
  Assert-ParroIcon -Icon $installedIcon -Label "Installed shortcut icon"
} finally {
  $installedIcon.Dispose()
}

$smokeScript = Join-Path $root "scripts\smoke-native-host.js"
$installedHost = Join-Path $InstallDir "host.js"
$installedNode = Join-Path $InstallDir "node.exe"
& node $smokeScript $installedHost $installedNode
if ($LASTEXITCODE -ne 0) {
  throw "Installed Native Messaging host smoke test failed."
}

$result = [ordered]@{
  ok = $true
  installer = $InstallerPath
  installer_sha256 = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash
  installer_size = (Get-Item -LiteralPath $InstallerPath).Length
  install_dir = $InstallDir
  manifest = $manifestPath
  icon = (Join-Path $InstallDir "parro.ico")
  powershell_payload_encoding = "UTF-8 BOM"
  allowed_origins = $manifest.allowed_origins
}
$result | ConvertTo-Json -Depth 4

if ($UninstallAfter) {
  $uninstaller = Join-Path $InstallDir "Uninstall.exe"
  $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList "/uninstall", "/quiet" -Wait -PassThru
  if ($uninstallProcess.ExitCode -ne 0) {
    throw "Uninstaller exited with code $($uninstallProcess.ExitCode)."
  }
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline -and ((Test-Path $registryPath) -or (Test-Path $uninstallRegistryPath))) {
    Start-Sleep -Milliseconds 300
  }
  if ((Test-Path $registryPath) -or (Test-Path $uninstallRegistryPath)) {
    throw "Uninstall verification failed: registry keys remain."
  }
}
