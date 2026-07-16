param(
  [string]$OutputName = "ParroDesktopSetup.exe",
  [switch]$PublishToWebApp
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$repoRoot = Split-Path -Parent (Split-Path -Parent $root)
$stagingDir = Join-Path $root "dist\installer-staging"
$payloadDir = Join-Path $stagingDir "payload"
$outputDir = Join-Path $root "dist\installer"
$outputPath = Join-Path $outputDir $OutputName
$payloadZip = Join-Path $stagingDir "payload.zip"
$iconPath = Join-Path $stagingDir "parro.ico"
$wizardSource = Join-Path $root "installer\wizard\ParroDesktopSetup.cs"
$launcherSource = Join-Path $root "installer\launcher\ParroDesktop.cs"

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$hostPath = Join-Path $root "src\host.js"
$captureAgentPath = Join-Path $root "src\capture-agent.ps1"
$controllerPath = Join-Path $root "src\controller.ps1"
$iconSources = @(
  (Join-Path $repoRoot "mimic_app\public\icons\icon16.png"),
  (Join-Path $repoRoot "mimic_app\public\icons\icon48.png"),
  (Join-Path $repoRoot "mimic_app\public\icons\icon128.png")
)
$cscCandidates = @(
  "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$cscPath = $cscCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

foreach ($requiredPath in @($hostPath, $captureAgentPath, $controllerPath, $wizardSource, $launcherSource) + $iconSources) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Missing installer input: $requiredPath"
  }
}
if (-not $cscPath) {
  throw ".NET Framework C# compiler was not found. Windows .NET Framework 4.x is required."
}

function Write-Utf8BomCopy {
  param([string]$Source, [string]$Destination)
  $content = [System.IO.File]::ReadAllText($Source, [System.Text.UTF8Encoding]::new($false, $true))
  [System.IO.File]::WriteAllText($Destination, $content, [System.Text.UTF8Encoding]::new($true))
}

function Write-IcoFromPngFiles {
  param([string[]]$PngPaths, [string]$Destination)

  $images = @($PngPaths | ForEach-Object {
    $bitmap = [System.Drawing.Bitmap]::FromFile($_)
    try {
      # .NET Framework's Icon reader (also used by WinForms and shortcut tests)
      # renders PNG-compressed ICO entries incorrectly on some Windows builds.
      # Store standard 32-bit BGRA DIB entries with an AND transparency mask.
      $dibStream = New-Object System.IO.MemoryStream
      $dibWriter = New-Object System.IO.BinaryWriter($dibStream)
      try {
        $width = $bitmap.Width
        $height = $bitmap.Height
        $pixelBytes = $width * $height * 4
        $maskStride = [int]([Math]::Ceiling($width / 32.0) * 4)
        $maskBytes = $maskStride * $height
        $dibWriter.Write([uint32]40)
        $dibWriter.Write([int32]$width)
        $dibWriter.Write([int32]($height * 2))
        $dibWriter.Write([uint16]1)
        $dibWriter.Write([uint16]32)
        $dibWriter.Write([uint32]0)
        $dibWriter.Write([uint32]$pixelBytes)
        $dibWriter.Write([int32]0)
        $dibWriter.Write([int32]0)
        $dibWriter.Write([uint32]0)
        $dibWriter.Write([uint32]0)
        for ($y = $height - 1; $y -ge 0; $y--) {
          for ($x = 0; $x -lt $width; $x++) {
            $pixel = $bitmap.GetPixel($x, $y)
            $dibWriter.Write([byte]$pixel.B)
            $dibWriter.Write([byte]$pixel.G)
            $dibWriter.Write([byte]$pixel.R)
            $dibWriter.Write([byte]$pixel.A)
          }
        }
        $mask = New-Object byte[] $maskBytes
        for ($row = 0; $row -lt $height; $row++) {
          $sourceY = $height - 1 - $row
          for ($x = 0; $x -lt $width; $x++) {
            if ($bitmap.GetPixel($x, $sourceY).A -lt 128) {
              $byteIndex = ($row * $maskStride) + [int][Math]::Floor($x / 8.0)
              $mask[$byteIndex] = $mask[$byteIndex] -bor (1 -shl (7 - ($x % 8)))
            }
          }
        }
        $dibWriter.Write($mask)
        $dibWriter.Flush()
        [pscustomobject]@{ Bytes = $dibStream.ToArray(); Width = $width; Height = $height }
      } finally {
        $dibWriter.Dispose()
        $dibStream.Dispose()
      }
    } finally {
      $bitmap.Dispose()
    }
  })

  $stream = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$images.Count)
    $offset = 6 + (16 * $images.Count)
    foreach ($image in $images) {
      $writer.Write([byte]$(if ($image.Width -ge 256) { 0 } else { $image.Width }))
      $writer.Write([byte]$(if ($image.Height -ge 256) { 0 } else { $image.Height }))
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$image.Bytes.Length)
      $writer.Write([uint32]$offset)
      $offset += $image.Bytes.Length
    }
    foreach ($image in $images) {
      $writer.Write($image.Bytes)
    }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

function Assert-ParroExecutableIcon {
  param([string]$ExecutablePath)

  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($ExecutablePath)
  if (-not $icon) {
    throw "Executable icon could not be loaded: $ExecutablePath"
  }

  $bitmap = $icon.ToBitmap()
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
      throw "Executable icon does not contain the Parro teal/lime brand colors: $ExecutablePath"
    }
    if ($legacyPurplePixels -gt $parroColorPixels) {
      throw "Executable icon still appears to use the legacy purple MIMIC icon: $ExecutablePath"
    }
  } finally {
    $bitmap.Dispose()
    $icon.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $stagingDir, $payloadDir, $outputDir | Out-Null
$resolvedStaging = (Resolve-Path -LiteralPath $stagingDir).Path
$resolvedRoot = (Resolve-Path -LiteralPath $root).Path
if (-not $resolvedStaging.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean a staging directory outside the native-host workspace: $resolvedStaging"
}
Get-ChildItem -LiteralPath $stagingDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null

Copy-Item -LiteralPath $nodePath -Destination (Join-Path $payloadDir "node.exe") -Force
Copy-Item -LiteralPath $hostPath -Destination (Join-Path $payloadDir "host.js") -Force
Write-Utf8BomCopy -Source $captureAgentPath -Destination (Join-Path $payloadDir "capture-agent.ps1")
Write-Utf8BomCopy -Source $controllerPath -Destination (Join-Path $payloadDir "controller.ps1")

Add-Type -AssemblyName System.Drawing
Write-IcoFromPngFiles -PngPaths $iconSources -Destination $iconPath
Copy-Item -LiteralPath $iconPath -Destination (Join-Path $payloadDir "parro.ico") -Force

$launcherPath = Join-Path $payloadDir "ParroDesktop.exe"
$launcherCompilerArguments = @(
  "/nologo",
  "/target:winexe",
  "/platform:anycpu",
  "/optimize+",
  "/codepage:65001",
  "/win32icon:$iconPath",
  "/out:$launcherPath",
  "/reference:System.dll",
  "/reference:System.Core.dll",
  "/reference:System.Windows.Forms.dll",
  $launcherSource
)
& $cscPath $launcherCompilerArguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $launcherPath)) {
  throw "Desktop launcher compiler exited with code $LASTEXITCODE."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $payloadZip) { Remove-Item -LiteralPath $payloadZip -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $payloadDir,
  $payloadZip,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
$compilerArguments = @(
  "/nologo",
  "/target:winexe",
  "/platform:anycpu",
  "/optimize+",
  "/codepage:65001",
  "/win32icon:$iconPath",
  "/resource:$payloadZip,Parro.Payload.zip",
  "/out:$outputPath",
  "/reference:System.dll",
  "/reference:System.Core.dll",
  "/reference:System.Drawing.dll",
  "/reference:System.Windows.Forms.dll",
  "/reference:System.IO.Compression.dll",
  "/reference:System.IO.Compression.FileSystem.dll",
  $wizardSource
)
& $cscPath $compilerArguments
if ($LASTEXITCODE -ne 0) {
  throw "Installer compiler exited with code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath $outputPath) -or (Get-Item -LiteralPath $outputPath).Length -le 1MB) {
  throw "Installer was not created completely: $outputPath"
}

foreach ($artifactPath in @($outputPath, $launcherPath)) {
  Assert-ParroExecutableIcon -ExecutablePath $artifactPath
  $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($artifactPath).FileVersion
  if ($version -ne "0.4.1.0") {
    throw "Unexpected desktop artifact version '$version': $artifactPath"
  }
}

if ($PublishToWebApp) {
  $downloadsDir = Join-Path $repoRoot "mimic_app\public\downloads"
  New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
  Copy-Item -LiteralPath $outputPath -Destination (Join-Path $downloadsDir $OutputName) -Force
}

$built = Get-Item -LiteralPath $outputPath
[pscustomobject]@{
  FullName = $built.FullName
  Length = $built.Length
  LastWriteTime = $built.LastWriteTime
  SHA256 = (Get-FileHash -LiteralPath $built.FullName -Algorithm SHA256).Hash
  Icon = $iconPath
  PublishedToWebApp = [bool]$PublishToWebApp
}
