param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$agentPath = Join-Path $root "src\capture-agent.ps1"
$testRoot = Join-Path $root "dist\display-capture-test"
$resolvedRoot = (Resolve-Path -LiteralPath $root).Path
if (Test-Path -LiteralPath $testRoot) {
  $resolvedTestRoot = (Resolve-Path -LiteralPath $testRoot).Path
  if (-not $resolvedTestRoot.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean a test directory outside the native-host workspace: $resolvedTestRoot"
  }
  Remove-Item -LiteralPath $testRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Write-Utf8([string]$path, [string]$value) {
  [System.IO.File]::WriteAllText($path, $value, $utf8)
}

function Test-CaptureTarget([string]$name, [string]$mode, [System.Drawing.Rectangle]$bounds, [string]$expectedMode) {
  $outputDir = Join-Path $testRoot $name
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $stopFile = Join-Path $outputDir ".stop"
  $manualFile = Join-Path $outputDir ".manual-capture"
  $eventsFile = Join-Path $outputDir "events.jsonl"
  $sessionFile = Join-Path $outputDir "session.json"
  $arguments = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$agentPath`"",
    "-SessionId", "display-$name", "-OutputDir", "`"$outputDir`"", "-StopFile", "`"$stopFile`"",
    "-ManualCaptureFile", "`"$manualFile`"", "-CaptureMode", $mode
  )
  if ($mode -eq "monitor") {
    $arguments += @("-CaptureLeft", $bounds.Left, "-CaptureTop", $bounds.Top, "-CaptureWidth", $bounds.Width, "-CaptureHeight", $bounds.Height)
  }
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = "powershell.exe"
  $start.Arguments = $arguments -join " "
  $start.WorkingDirectory = $root
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::Start($start)
  try {
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $sessionFile)) { Start-Sleep -Milliseconds 100 }
    if (-not (Test-Path -LiteralPath $sessionFile)) { throw "$name capture agent did not initialize." }
    Write-Utf8 $manualFile "manual"
    while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $eventsFile)) { Start-Sleep -Milliseconds 100 }
    if (-not (Test-Path -LiteralPath $eventsFile)) { throw "$name capture did not create an event." }
    $event = Get-Content -LiteralPath $eventsFile -Encoding UTF8 | Select-Object -First 1 | ConvertFrom-Json
    if ($event.screen.mode -ne $expectedMode) { throw "$name mode mismatch: $($event.screen.mode)" }
    if ($event.screen.left -ne $bounds.Left -or $event.screen.top -ne $bounds.Top -or $event.screen.width -ne $bounds.Width -or $event.screen.height -ne $bounds.Height) {
      throw "$name bounds mismatch: $($event.screen | ConvertTo-Json -Compress)"
    }
    $image = [System.Drawing.Image]::FromFile([string]$event.screenshot_path)
    try {
      if ($image.Width -ne $bounds.Width -or $image.Height -ne $bounds.Height) { throw "$name image size mismatch: $($image.Width)x$($image.Height)" }
    } finally { $image.Dispose() }
  } finally {
    Write-Utf8 $stopFile "stop"
    if (-not $process.WaitForExit(8000)) { $process.Kill() }
    if ($process.ExitCode -ne 0) { throw "$name capture agent failed: $($process.StandardError.ReadToEnd())" }
    $process.Dispose()
  }
}

function Test-OrphanOwnerGuard {
  $outputDir = Join-Path $testRoot "orphan-owner"
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $stopFile = Join-Path $outputDir ".stop"
  $sessionFile = Join-Path $outputDir "session.json"
  $process = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$agentPath`"",
    "-SessionId", "display-orphan-owner", "-OutputDir", "`"$outputDir`"", "-StopFile", "`"$stopFile`"",
    "-OwnerProcessId", "2147483647"
  ) -PassThru -WindowStyle Hidden
  if (-not $process.WaitForExit(5000)) {
    $process.Kill()
    throw "Capture agent stayed alive after its owner disappeared."
  }
  if (-not (Test-Path -LiteralPath $sessionFile)) { throw "Owner guard did not write a stopped session." }
  $session = Get-Content -Raw -LiteralPath $sessionFile | ConvertFrom-Json
  if ($session.status -ne "stopped") { throw "Owner guard session status mismatch: $($session.status)" }
  $process.Dispose()
}

$primary = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$active = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).Bounds
Test-CaptureTarget "selected" "monitor" $primary "selected-monitor"
Test-CaptureTarget "all" "all" $active "active-monitor"
Test-OrphanOwnerGuard

[pscustomobject]@{
  ok = $true
  display_count = [System.Windows.Forms.Screen]::AllScreens.Count
  selected_monitor = [pscustomobject]@{ left = $primary.Left; top = $primary.Top; width = $primary.Width; height = $primary.Height }
  all_screens_mode = "capture-monitor-containing-each-click"
  orphan_owner_guard = $true
} | ConvertTo-Json -Depth 4
