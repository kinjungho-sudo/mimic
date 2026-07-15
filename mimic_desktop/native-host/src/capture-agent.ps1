param(
  [Parameter(Mandatory = $true)][string]$SessionId,
  [Parameter(Mandatory = $true)][string]$OutputDir,
  [Parameter(Mandatory = $true)][string]$StopFile,
  [string]$PauseFile,
  [string]$ManualCaptureFile,
  [string]$UndoFile,
  [string]$BlurNextFile,
  [string]$ToolbarBoundsFile
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class ParroDesktopInput {
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
if (-not $PauseFile) { $PauseFile = Join-Path $OutputDir ".pause" }
if (-not $ManualCaptureFile) { $ManualCaptureFile = Join-Path $OutputDir ".manual-capture" }
if (-not $UndoFile) { $UndoFile = Join-Path $OutputDir ".undo" }
if (-not $BlurNextFile) { $BlurNextFile = Join-Path $OutputDir ".blur-next" }
if (-not $ToolbarBoundsFile) { $ToolbarBoundsFile = Join-Path $OutputDir ".toolbar-bounds.json" }

$eventsPath = Join-Path $OutputDir "events.jsonl"
$sessionPath = Join-Path $OutputDir "session.json"
$startedAt = (Get-Date).ToUniversalTime().ToString("o")
$step = 0
$leftWasDown = $false
$lastPauseState = $false
$history = New-Object System.Collections.ArrayList
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Write-Session([string]$status) {
  $session = [ordered]@{
    session_id = $SessionId
    status = $status
    started_at = $startedAt
    updated_at = (Get-Date).ToUniversalTime().ToString("o")
    captured_steps = $script:step
    events_file = $eventsPath
    capture_directory = $OutputDir
  }
  [System.IO.File]::WriteAllText(
    $sessionPath,
    ($session | ConvertTo-Json -Depth 4),
    $utf8
  )
}

function Rewrite-Events {
  $builder = New-Object System.Text.StringBuilder
  foreach ($item in $history) {
    [void]$builder.Append(($item | ConvertTo-Json -Compress -Depth 5))
    [void]$builder.Append([Environment]::NewLine)
  }
  [System.IO.File]::WriteAllText($eventsPath, $builder.ToString(), $utf8)
}

function Get-CursorPoint {
  $point = New-Object ParroDesktopInput+POINT
  if (-not [ParroDesktopInput]::GetCursorPos([ref]$point)) { return $null }
  return $point
}

function Test-ToolbarPoint($point) {
  if (-not (Test-Path -LiteralPath $ToolbarBoundsFile)) { return $false }
  try {
    $bounds = Get-Content -LiteralPath $ToolbarBoundsFile -Raw -Encoding UTF8 | ConvertFrom-Json
    return (
      $point.X -ge [int]$bounds.left -and
      $point.X -lt [int]$bounds.right -and
      $point.Y -ge [int]$bounds.top -and
      $point.Y -lt [int]$bounds.bottom
    )
  } catch {
    return $false
  }
}

function Add-PrivacyBlur($bitmap, $graphics, $point, [int]$screenLeft, [int]$screenTop) {
  $centerX = $point.X - $screenLeft
  $centerY = $point.Y - $screenTop
  $regionWidth = [Math]::Min(360, $bitmap.Width)
  $regionHeight = [Math]::Min(220, $bitmap.Height)
  $x = [Math]::Max(0, [Math]::Min($bitmap.Width - $regionWidth, $centerX - [int]($regionWidth / 2)))
  $y = [Math]::Max(0, [Math]::Min($bitmap.Height - $regionHeight, $centerY - [int]($regionHeight / 2)))
  $sourceRect = New-Object System.Drawing.Rectangle($x, $y, $regionWidth, $regionHeight)
  $smallWidth = [Math]::Max(12, [int]($regionWidth / 18))
  $smallHeight = [Math]::Max(8, [int]($regionHeight / 18))
  $smallBitmap = New-Object System.Drawing.Bitmap($smallWidth, $smallHeight)
  $smallGraphics = [System.Drawing.Graphics]::FromImage($smallBitmap)
  try {
    $smallGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Low
    $smallGraphics.DrawImage(
      $bitmap,
      (New-Object System.Drawing.Rectangle(0, 0, $smallWidth, $smallHeight)),
      $sourceRect,
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.DrawImage(
      $smallBitmap,
      $sourceRect,
      (New-Object System.Drawing.Rectangle(0, 0, $smallWidth, $smallHeight)),
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $smallGraphics.Dispose()
    $smallBitmap.Dispose()
  }
  return [ordered]@{
    left = $x + $screenLeft
    top = $y + $screenTop
    width = $regionWidth
    height = $regionHeight
  }
}

function Capture-Frame([string]$eventType) {
  $point = Get-CursorPoint
  if (-not $point) { return }

  $left = [ParroDesktopInput]::GetSystemMetrics(76)
  $top = [ParroDesktopInput]::GetSystemMetrics(77)
  $width = [ParroDesktopInput]::GetSystemMetrics(78)
  $height = [ParroDesktopInput]::GetSystemMetrics(79)
  if ($width -le 0 -or $height -le 0) { return }

  $script:step += 1
  $capturedAt = (Get-Date).ToUniversalTime().ToString("o")
  $fileName = "step-{0:D4}-{1}.png" -f $script:step, (Get-Date -Format "yyyyMMdd-HHmmss-fff")
  $screenshotPath = Join-Path $OutputDir $fileName
  $applyBlur = Test-Path -LiteralPath $BlurNextFile
  $blurRegion = $null

  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
    if ($applyBlur) {
      Remove-Item -LiteralPath $BlurNextFile -Force -ErrorAction SilentlyContinue
      $blurRegion = Add-PrivacyBlur $bitmap $graphics $point $left $top
    }
    $bitmap.Save($screenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  $event = [ordered]@{
    session_id = $SessionId
    step_number = $script:step
    event_type = $eventType
    captured_at = $capturedAt
    click_x = $point.X
    click_y = $point.Y
    normalized_x = [Math]::Round(($point.X - $left) / $width, 6)
    normalized_y = [Math]::Round(($point.Y - $top) / $height, 6)
    screen = [ordered]@{ left = $left; top = $top; width = $width; height = $height }
    screenshot_path = $screenshotPath
    blur_applied = [bool]$applyBlur
    blur_region = $blurRegion
  }
  [void]$history.Add($event)
  [System.IO.File]::AppendAllText(
    $eventsPath,
    ($event | ConvertTo-Json -Compress -Depth 5) + [Environment]::NewLine,
    $utf8
  )
  Write-Session "recording"
}

function Undo-LastCapture {
  Remove-Item -LiteralPath $UndoFile -Force -ErrorAction SilentlyContinue
  if ($history.Count -eq 0) { return }
  $lastIndex = $history.Count - 1
  $last = $history[$lastIndex]
  if ($last.screenshot_path) {
    Remove-Item -LiteralPath ([string]$last.screenshot_path) -Force -ErrorAction SilentlyContinue
  }
  $history.RemoveAt($lastIndex)
  $script:step = $history.Count
  Rewrite-Events
  Write-Session $(if (Test-Path -LiteralPath $PauseFile) { "paused" } else { "recording" })
}

Write-Session "recording"

try {
  while (-not (Test-Path -LiteralPath $StopFile)) {
    if (Test-Path -LiteralPath $UndoFile) {
      Undo-LastCapture
    }

    $paused = Test-Path -LiteralPath $PauseFile
    if ($paused -ne $lastPauseState) {
      Write-Session $(if ($paused) { "paused" } else { "recording" })
      $lastPauseState = $paused
    }

    if (-not $paused -and (Test-Path -LiteralPath $ManualCaptureFile)) {
      Remove-Item -LiteralPath $ManualCaptureFile -Force -ErrorAction SilentlyContinue
      Capture-Frame "manual"
    }

    $leftDown = (([ParroDesktopInput]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0)
    if (-not $paused -and $leftDown -and -not $leftWasDown) {
      Start-Sleep -Milliseconds 120
      $point = Get-CursorPoint
      if ($point -and -not (Test-ToolbarPoint $point)) {
        Capture-Frame "click"
      }
    }
    $leftWasDown = $leftDown
    Start-Sleep -Milliseconds 25
  }
} finally {
  Write-Session "stopped"
}
