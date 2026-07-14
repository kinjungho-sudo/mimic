param(
  [Parameter(Mandatory = $true)][string]$SessionId,
  [Parameter(Mandatory = $true)][string]$OutputDir,
  [Parameter(Mandatory = $true)][string]$StopFile
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class MimicDesktopInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }

  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int virtualKey);

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT point);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int index);
}
"@

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$eventsPath = Join-Path $OutputDir "events.jsonl"
$sessionPath = Join-Path $OutputDir "session.json"
$startedAt = (Get-Date).ToUniversalTime().ToString("o")
$step = 0
$leftWasDown = $false

function Write-Session([string]$status) {
  $session = [ordered]@{
    session_id = $SessionId
    status = $status
    started_at = $startedAt
    updated_at = (Get-Date).ToUniversalTime().ToString("o")
    captured_steps = $step
    events_file = $eventsPath
  }
  [System.IO.File]::WriteAllText(
    $sessionPath,
    ($session | ConvertTo-Json -Depth 3),
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Capture-Click {
  $point = New-Object MimicDesktopInput+POINT
  if (-not [MimicDesktopInput]::GetCursorPos([ref]$point)) { return }

  $left = [MimicDesktopInput]::GetSystemMetrics(76)
  $top = [MimicDesktopInput]::GetSystemMetrics(77)
  $width = [MimicDesktopInput]::GetSystemMetrics(78)
  $height = [MimicDesktopInput]::GetSystemMetrics(79)
  if ($width -le 0 -or $height -le 0) { return }

  $script:step += 1
  $capturedAt = (Get-Date).ToUniversalTime().ToString("o")
  $fileName = "step-{0:D4}-{1}.png" -f $script:step, (Get-Date -Format "yyyyMMdd-HHmmss-fff")
  $screenshotPath = Join-Path $OutputDir $fileName

  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
    $bitmap.Save($screenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  $event = [ordered]@{
    session_id = $SessionId
    step_number = $script:step
    event_type = "click"
    captured_at = $capturedAt
    click_x = $point.X
    click_y = $point.Y
    normalized_x = [Math]::Round(($point.X - $left) / $width, 6)
    normalized_y = [Math]::Round(($point.Y - $top) / $height, 6)
    screen = [ordered]@{ left = $left; top = $top; width = $width; height = $height }
    screenshot_path = $screenshotPath
  }
  [System.IO.File]::AppendAllText(
    $eventsPath,
    ($event | ConvertTo-Json -Compress -Depth 4) + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Session "recording"
}

Write-Session "recording"

try {
  while (-not (Test-Path -LiteralPath $StopFile)) {
    $leftDown = (([MimicDesktopInput]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0)
    if ($leftDown -and -not $leftWasDown) {
      Start-Sleep -Milliseconds 120
      Capture-Click
    }
    $leftWasDown = $leftDown
    Start-Sleep -Milliseconds 25
  }
} finally {
  Write-Session "stopped"
}
