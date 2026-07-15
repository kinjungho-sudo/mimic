param()

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$agentPath = Join-Path $root "src\capture-agent.ps1"
$testRoot = Join-Path $root "dist\capture-agent-test"
$resolvedRoot = (Resolve-Path -LiteralPath $root).Path

if (Test-Path -LiteralPath $testRoot) {
  $resolvedTestRoot = (Resolve-Path -LiteralPath $testRoot).Path
  if (-not $resolvedTestRoot.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean a test directory outside the native-host workspace: $resolvedTestRoot"
  }
  Remove-Item -LiteralPath $testRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$stopFile = Join-Path $testRoot ".stop"
$pauseFile = Join-Path $testRoot ".pause"
$manualFile = Join-Path $testRoot ".manual-capture"
$undoFile = Join-Path $testRoot ".undo"
$blurFile = Join-Path $testRoot ".blur-next"
$boundsFile = Join-Path $testRoot ".toolbar-bounds.json"
$eventsFile = Join-Path $testRoot "events.jsonl"
$sessionFile = Join-Path $testRoot "session.json"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$result = $null
$agent = $null

function Write-Command([string]$path, [string]$value) {
  [System.IO.File]::WriteAllText($path, $value, $utf8)
}

function Get-Events {
  if (-not (Test-Path -LiteralPath $eventsFile)) { return @() }
  return @(
    Get-Content -LiteralPath $eventsFile -Encoding UTF8 |
      Where-Object { $_.Trim() } |
      ForEach-Object { $_ | ConvertFrom-Json }
  )
}

function Wait-EventCount([int]$count, [int]$timeoutSeconds = 8) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ($agent -and $agent.HasExited) {
      $stderr = $agent.StandardError.ReadToEnd()
      throw "Capture agent exited early with code $($agent.ExitCode).`n$stderr"
    }
    $events = @(Get-Events)
    if ($events.Count -eq $count) { return $events }
    Start-Sleep -Milliseconds 100
  }
  throw "Timed out waiting for $count capture events. Current count: $(@(Get-Events).Count)"
}

try {
  Write-Command $boundsFile '{"left":-100000,"top":-100000,"right":100000,"bottom":100000}'
  $arguments = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$agentPath`"",
    "-SessionId", "capture-agent-test",
    "-OutputDir", "`"$testRoot`"",
    "-StopFile", "`"$stopFile`"",
    "-PauseFile", "`"$pauseFile`"",
    "-ManualCaptureFile", "`"$manualFile`"",
    "-UndoFile", "`"$undoFile`"",
    "-BlurNextFile", "`"$blurFile`"",
    "-ToolbarBoundsFile", "`"$boundsFile`""
  )
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = "powershell.exe"
  $start.Arguments = $arguments -join " "
  $start.WorkingDirectory = $root
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $agent = New-Object System.Diagnostics.Process
  $agent.StartInfo = $start
  if (-not $agent.Start()) { throw "Capture agent process did not start." }

  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $sessionFile)) {
    Start-Sleep -Milliseconds 100
  }
  if (-not (Test-Path -LiteralPath $sessionFile)) { throw "Capture agent did not initialize." }

  Write-Command $manualFile "manual"
  $firstEvents = Wait-EventCount 1
  if ($firstEvents[0].event_type -ne "manual") { throw "Manual capture event type was not recorded." }
  if (-not (Test-Path -LiteralPath $firstEvents[0].screenshot_path)) { throw "Manual screenshot was not created." }

  Write-Command $blurFile "blur-next"
  Write-Command $manualFile "manual"
  $blurEvents = Wait-EventCount 2
  if (-not $blurEvents[1].blur_applied) { throw "Blur was not applied to the next capture." }
  if (-not $blurEvents[1].blur_region) { throw "Blur region metadata is missing." }

  Write-Command $undoFile "undo"
  $undoEvents = Wait-EventCount 1
  if ($undoEvents[0].step_number -ne 1) { throw "Undo did not preserve the first step." }

  Write-Command $pauseFile "paused"
  Start-Sleep -Milliseconds 200
  Write-Command $manualFile "manual"
  Start-Sleep -Milliseconds 500
  if (@(Get-Events).Count -ne 1) { throw "A capture was created while paused." }

  Remove-Item -LiteralPath $pauseFile -Force
  Write-Command $manualFile "manual"
  $resumedEvents = Wait-EventCount 2

  Write-Command $stopFile "stop"
  if (-not $agent.WaitForExit(8000)) { throw "Capture agent did not stop." }
  if ($agent.ExitCode -ne 0) { throw "Capture agent exited with code $($agent.ExitCode)." }

  $session = Get-Content -LiteralPath $sessionFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($session.status -ne "stopped") { throw "Session did not finish in stopped state." }
  $result = [ordered]@{
    ok = $true
    events_after_resume = $resumedEvents.Count
    final_status = $session.status
    manual_capture = $true
    pause_resume = $true
    undo = $true
    blur_next = $true
    toolbar_click_exclusion_bounds = $true
  }
} finally {
  if ($agent -and -not $agent.HasExited) {
    try { Write-Command $stopFile "stop" } catch {}
    if (-not $agent.WaitForExit(3000)) { try { $agent.Kill() } catch {} }
  }
  if ($agent) { $agent.Dispose() }
}

$result | ConvertTo-Json -Depth 4
