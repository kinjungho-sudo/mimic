$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourcePath = Join-Path $root "installer\launcher\ParroDesktop.cs"
$source = [System.IO.File]::ReadAllText($sourcePath, [System.Text.UTF8Encoding]::new($false, $true))

$checks = [ordered]@{
  modern_main_size = 'ClientSize = new Size\(1040, 720\)'
  modern_toolbar_size = 'ClientSize = new Size\(960, 68\)'
  rounded_panel = 'internal sealed class RoundedPanel'
  rounded_button = 'internal sealed class RoundedButton'
  topology_picker = 'internal sealed class MonitorTopologyControl'
  real_monitor_preview = 'CopyFromScreen\(screen\.Bounds\.Location'
  real_monitor_coordinates = 'Rectangle\.Union\(virtualBounds, target\.Screen\.Bounds\)'
  vertical_and_triple_layout_test = 'VerifySyntheticLayouts'
  all_screens_scope = 'SelectAllScreens'
  default_all_screens_auto = 'targets\.Count > 1[\s\S]*selectedTarget = new CaptureTargetOption[\s\S]*Mode = "all"'
  default_side_panel = 'private string recordingDisplayMode = "side"'
  compact_toolbar_option = 'ShowMiniToolbar'
  automatic_companion_screen = 'FindRecordingUiScreen'
  nearest_non_capture_screen = 'ChooseCompanionScreenIndex'
  hidden_single_or_all = 'HideRecordingUi'
  tray_restore = 'trayIcon\.DoubleClick'
  branded_primary_action = 'SetColors\(Color\.FromArgb\(0, 151, 136\)'
  renderable_main_preview = '"--render-preview"'
  renderable_toolbar_preview = '"--render-toolbar-preview"'
  renderable_side_panel = '"--render-side-panel-preview"'
  renderable_area_blur = '"--render-side-panel-blur-preview"'
  verifiable_side_panel_behavior = '"--verify-side-panel-behavior"'
  current_version = 'PREVIEW 0\.6\.7'
  movable_panel = 'BeginPanelDrag'
  resizable_panel = 'BeginPanelResize'
  right_edge_docking = 'DockToRight'
  hover_reveal = 'RevealDockedPanel'
  chronological_steps = 'index = first; index < files\.Length; index\+\+'
  preview_zoom = 'OpenThumbnailZoom'
  web_style_area_blur = 'CompleteBlurSelection'
}

foreach ($entry in $checks.GetEnumerator()) {
  if ($source -notmatch $entry.Value) {
    throw "Launcher UI contract failed: $($entry.Key)"
  }
}

if ($source -match 'FormBorderStyle = FormBorderStyle\.FixedDialog') {
  throw "Launcher UI contract failed: legacy visual treatment remains"
}

if ($source -match 'private readonly PictureBox latestImage') {
  throw "Launcher UI contract failed: latest-screen preview still exists"
}

$compiler = @(
  "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw "Launcher UI behavior check requires the .NET Framework compiler." }
$verificationRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("parro-panel-verify-" + [guid]::NewGuid().ToString("N"))
$verificationExe = Join-Path $verificationRoot "ParroDesktopVerify.exe"
$verificationJson = Join-Path $verificationRoot "result.json"
New-Item -ItemType Directory -Force -Path $verificationRoot | Out-Null
try {
  & $compiler @(
    "/nologo", "/target:exe", "/platform:anycpu", "/optimize+", "/codepage:65001",
    "/out:$verificationExe", "/reference:System.dll", "/reference:System.Core.dll",
    "/reference:System.Drawing.dll", "/reference:System.Windows.Forms.dll", $sourcePath
  )
  if ($LASTEXITCODE -ne 0) { throw "Launcher UI behavior check failed to compile." }
  & $verificationExe --verify-side-panel-behavior $verificationJson
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $verificationJson)) {
    throw "Launcher UI behavior check did not complete."
  }
  $behavior = Get-Content -Raw -LiteralPath $verificationJson | ConvertFrom-Json
  if (-not $behavior.ok -or -not $behavior.zoom -or -not $behavior.area_blur -or -not $behavior.repeated_area_blur -or -not $behavior.dock_handle -or -not $behavior.hover_reveal -or -not $behavior.resizable) {
    throw "Launcher UI behavior check failed: $($behavior | ConvertTo-Json -Compress)"
  }
} finally {
  if (Test-Path -LiteralPath $verificationRoot) { Remove-Item -LiteralPath $verificationRoot -Recurse -Force }
}

[pscustomobject]@{
  ok = $true
  checks = $checks.Count
  version = "0.6.7"
  main_size = "1040x720"
  toolbar_size = "960x68"
  recording_default = "side-panel"
  single_or_all = "hidden-with-tray-control"
  panel_behavior = $behavior
} | ConvertTo-Json
