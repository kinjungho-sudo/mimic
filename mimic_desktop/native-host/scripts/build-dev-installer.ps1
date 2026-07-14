param(
  [string]$OutputName = "MIMICDesktopSetup-dev.exe",
  [switch]$PublishToWebApp
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$repoRoot = Split-Path -Parent (Split-Path -Parent $root)
$stagingDir = Join-Path $root "dist\installer-staging"
$outputDir = Join-Path $root "dist\installer"
$outputPath = Join-Path $outputDir $OutputName
$sedPath = Join-Path $stagingDir "mimic-desktop-installer.sed"

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$hostPath = Join-Path $root "src\host.js"
$captureAgentPath = Join-Path $root "src\capture-agent.ps1"
$installScriptPath = Join-Path $root "installer\install.ps1"

if (-not (Test-Path $hostPath)) {
  throw "Missing host script: $hostPath"
}
if (-not (Test-Path $installScriptPath)) {
  throw "Missing installer script: $installScriptPath"
}
if (-not (Test-Path $captureAgentPath)) {
  throw "Missing capture agent: $captureAgentPath"
}
if (-not (Get-Command iexpress.exe -ErrorAction SilentlyContinue)) {
  throw "iexpress.exe is required to build the quick Windows installer."
}

New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Remove-Item -LiteralPath (Join-Path $stagingDir "*") -Recurse -Force -ErrorAction SilentlyContinue

Copy-Item -LiteralPath $installScriptPath -Destination (Join-Path $stagingDir "install.ps1") -Force
Copy-Item -LiteralPath $hostPath -Destination (Join-Path $stagingDir "host.js") -Force
Copy-Item -LiteralPath $captureAgentPath -Destination (Join-Path $stagingDir "capture-agent.ps1") -Force
Copy-Item -LiteralPath $nodePath -Destination (Join-Path $stagingDir "node.exe") -Force

$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=MIMIC Desktop Companion installation is complete.
TargetName=$outputPath
FriendlyName=MIMIC Desktop Companion
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Quiet
UserQuietInstCmd=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Quiet
SourceFiles=SourceFiles
[Strings]
FILE0=install.ps1
FILE1=host.js
FILE2=node.exe
FILE3=capture-agent.ps1
[SourceFiles]
SourceFiles0=$stagingDir
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
"@

[System.IO.File]::WriteAllText($sedPath, $sed, [System.Text.UTF8Encoding]::new($false))

if (Test-Path $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

& iexpress.exe /N /Q $sedPath

$deadline = (Get-Date).AddMinutes(3)
$lastLength = -1
$stableChecks = 0
while ((Get-Date) -lt $deadline) {
  if (Test-Path $outputPath) {
    $currentLength = (Get-Item $outputPath).Length
    if ($currentLength -gt 1MB -and $currentLength -eq $lastLength) {
      $stableChecks += 1
      if ($stableChecks -ge 3) { break }
    } else {
      $stableChecks = 0
    }
    $lastLength = $currentLength
  }
  Start-Sleep -Seconds 1
}

if (-not (Test-Path $outputPath) -or (Get-Item $outputPath).Length -le 1MB -or $stableChecks -lt 3) {
  throw "Installer was not created completely: $outputPath"
}

if ($PublishToWebApp) {
  $downloadsDir = Join-Path $repoRoot "mimic_app\public\downloads"
  New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
  Copy-Item -LiteralPath $outputPath -Destination (Join-Path $downloadsDir $OutputName) -Force
}

Get-Item $outputPath | Select-Object FullName, Length, LastWriteTime
