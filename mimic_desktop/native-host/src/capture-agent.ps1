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
Add-Type -AssemblyName System.Windows.Forms
$uiAutomationReady = $true
try {
  Add-Type -AssemblyName WindowsBase
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
} catch {
  $uiAutomationReady = $false
}
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class ParroDesktopInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int virtualKey);

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT point);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int index);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr window, StringBuilder text, int maxCount);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr window, out RECT rect);
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

function Get-ForegroundContext {
  $window = [ParroDesktopInput]::GetForegroundWindow()
  if ($window -eq [IntPtr]::Zero) { return $null }
  $titleBuilder = New-Object System.Text.StringBuilder 512
  [void][ParroDesktopInput]::GetWindowText($window, $titleBuilder, $titleBuilder.Capacity)
  [uint32]$processId = 0
  [void][ParroDesktopInput]::GetWindowThreadProcessId($window, [ref]$processId)
  $processName = $null
  if ($processId -gt 0) {
    try { $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName } catch {}
  }
  $rect = New-Object ParroDesktopInput+RECT
  $hasRect = [ParroDesktopInput]::GetWindowRect($window, [ref]$rect)
  return [ordered]@{
    window_title = $titleBuilder.ToString().Trim()
    process_name = $processName
    left = $(if ($hasRect) { $rect.Left } else { $null })
    top = $(if ($hasRect) { $rect.Top } else { $null })
    width = $(if ($hasRect) { $rect.Right - $rect.Left } else { $null })
    height = $(if ($hasRect) { $rect.Bottom - $rect.Top } else { $null })
  }
}

function Get-UiElementContext($point) {
  if (-not $uiAutomationReady -or -not $point) { return $null }
  try {
    $automationPoint = [System.Windows.Point]::new([double]$point.X, [double]$point.Y)
    $element = [System.Windows.Automation.AutomationElement]::FromPoint($automationPoint)
    if (-not $element) { return $null }
    $current = $element.Current
    $rect = $current.BoundingRectangle
    $name = ([string]$current.Name).Trim()
    $automationId = ([string]$current.AutomationId).Trim()
    $controlType = ([string]$current.ControlType.ProgrammaticName).Replace("ControlType.", "").Trim()
    $className = ([string]$current.ClassName).Trim()
    return [ordered]@{
      name = $(if ($name) { $name } else { $null })
      automation_id = $(if ($automationId) { $automationId } else { $null })
      control_type = $(if ($controlType) { $controlType } else { $null })
      class_name = $(if ($className) { $className } else { $null })
      left = [Math]::Round($rect.Left, 2)
      top = [Math]::Round($rect.Top, 2)
      width = [Math]::Round($rect.Width, 2)
      height = [Math]::Round($rect.Height, 2)
    }
  } catch {
    return $null
  }
}

function Get-CaptureBounds([string]$eventType, $point, $foreground) {
  $virtualLeft = [ParroDesktopInput]::GetSystemMetrics(76)
  $virtualTop = [ParroDesktopInput]::GetSystemMetrics(77)
  $virtualWidth = [ParroDesktopInput]::GetSystemMetrics(78)
  $virtualHeight = [ParroDesktopInput]::GetSystemMetrics(79)

  # Automatic clicks produce the clearest manual when only the active app
  # window is captured. This also avoids leaking unrelated monitors.
  if ($eventType -eq "click" -and $foreground -and $foreground.process_name -ne "ParroDesktop") {
    $left = [int]$foreground.left
    $top = [int]$foreground.top
    $width = [int]$foreground.width
    $height = [int]$foreground.height
    $containsPoint = $point.X -ge $left -and $point.X -lt ($left + $width) -and $point.Y -ge $top -and $point.Y -lt ($top + $height)
    if ($width -ge 160 -and $height -ge 100 -and $containsPoint) {
      $right = [Math]::Min($virtualLeft + $virtualWidth, $left + $width)
      $bottom = [Math]::Min($virtualTop + $virtualHeight, $top + $height)
      $left = [Math]::Max($virtualLeft, $left)
      $top = [Math]::Max($virtualTop, $top)
      return [ordered]@{ left = $left; top = $top; width = $right - $left; height = $bottom - $top; mode = "window" }
    }
  }

  # The manual button temporarily makes Parro the foreground window. Capture
  # only the monitor containing the toolbar instead of the whole virtual desktop.
  $monitor = [System.Windows.Forms.Screen]::FromPoint((New-Object System.Drawing.Point($point.X, $point.Y))).Bounds
  return [ordered]@{ left = $monitor.Left; top = $monitor.Top; width = $monitor.Width; height = $monitor.Height; mode = "monitor" }
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

function Capture-Frame([string]$eventType, $capturePoint = $null) {
  $point = if ($capturePoint) { $capturePoint } else { Get-CursorPoint }
  if (-not $point) { return }
  $foreground = Get-ForegroundContext
  $uiElement = if ($eventType -eq "click") { Get-UiElementContext $point } else { $null }
  $bounds = Get-CaptureBounds $eventType $point $foreground
  $left = [int]$bounds.left
  $top = [int]$bounds.top
  $width = [int]$bounds.width
  $height = [int]$bounds.height
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
    screen = [ordered]@{ left = $left; top = $top; width = $width; height = $height; mode = $bounds.mode }
    screenshot_path = $screenshotPath
    blur_applied = [bool]$applyBlur
    blur_region = $blurRegion
    window_title = $(if ($foreground.process_name -eq "ParroDesktop" -and $eventType -eq "manual") { $null } else { $foreground.window_title })
    process_name = $(if ($foreground.process_name -eq "ParroDesktop" -and $eventType -eq "manual") { $null } else { $foreground.process_name })
    ui_element = $uiElement
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
      $point = Get-CursorPoint
      if ($point -and -not (Test-ToolbarPoint $point)) {
        # Keep the actual pointer-down coordinate even if the user moves the
        # cursor while the UI settles for the screenshot.
        Start-Sleep -Milliseconds 120
        Capture-Frame "click" $point
      }
    }
    $leftWasDown = $leftDown
    Start-Sleep -Milliseconds 25
  }
} finally {
  Write-Session "stopped"
}
