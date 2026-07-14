param()

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName PresentationFramework

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentPath = Join-Path $installDir "capture-agent.ps1"
$captureRoot = Join-Path $env:LOCALAPPDATA "MIMIC\DesktopCompanion\captures"
$script:sessionId = $null
$script:outputDir = $null
$script:stopFile = $null
$script:captureProcess = $null

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        Title="Parro Desktop Capture" Height="330" Width="520"
        WindowStartupLocation="CenterScreen" ResizeMode="NoResize"
        Background="#F8FAFC">
  <Grid Margin="28">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto" />
      <RowDefinition Height="Auto" />
      <RowDefinition Height="Auto" />
      <RowDefinition Height="*" />
      <RowDefinition Height="Auto" />
    </Grid.RowDefinitions>
    <TextBlock Grid.Row="0" Text="Desktop Capture" FontSize="25" FontWeight="Bold" Foreground="#111827" />
    <TextBlock Grid.Row="1" Margin="0,8,0,0" Text="Captures the full desktop each time you click." FontSize="14" Foreground="#4B5563" />
    <Border Grid.Row="2" Margin="0,22,0,0" Padding="15" CornerRadius="10" Background="#EEF2FF">
      <StackPanel>
        <TextBlock x:Name="StatusText" Text="Ready" FontSize="15" FontWeight="SemiBold" Foreground="#3730A3" />
        <TextBlock x:Name="PathText" Margin="0,6,0,0" Text="The capture folder will appear after recording starts." TextWrapping="Wrap" FontSize="12" Foreground="#6B7280" />
      </StackPanel>
    </Border>
    <TextBlock Grid.Row="3" Margin="0,18,0,0" Text="Privacy: pause recording before using password or payment screens." TextWrapping="Wrap" FontSize="12" Foreground="#B45309" />
    <StackPanel Grid.Row="4" Margin="0,22,0,0" Orientation="Horizontal" HorizontalAlignment="Right">
      <Button x:Name="OpenButton" Content="Open folder" Width="120" Height="40" Margin="0,0,10,0" IsEnabled="False" />
      <Button x:Name="StopButton" Content="Stop" Width="100" Height="40" Margin="0,0,10,0" IsEnabled="False" />
      <Button x:Name="StartButton" Content="Start capture" Width="100" Height="40" Background="#4F46E5" Foreground="White" FontWeight="Bold" />
    </StackPanel>
  </Grid>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)
$statusText = $window.FindName("StatusText")
$pathText = $window.FindName("PathText")
$startButton = $window.FindName("StartButton")
$stopButton = $window.FindName("StopButton")
$openButton = $window.FindName("OpenButton")

function Stop-Capture {
  if (-not $script:sessionId) { return }
  try {
    [System.IO.File]::WriteAllText($script:stopFile, (Get-Date).ToUniversalTime().ToString("o"))
  } catch {}
  $statusText.Text = "Capture stopped"
  $pathText.Text = $script:outputDir
  $startButton.IsEnabled = $true
  $stopButton.IsEnabled = $false
  $openButton.IsEnabled = $true
  $script:sessionId = $null
  $script:captureProcess = $null
}

$startButton.Add_Click({
  if (-not (Test-Path -LiteralPath $agentPath)) {
    [System.Windows.MessageBox]::Show("Capture engine not found. Please reinstall the app.", "Parro Desktop Capture") | Out-Null
    return
  }

  $script:sessionId = "desktop-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ([guid]::NewGuid().ToString("N").Substring(0, 8))
  $script:outputDir = Join-Path $captureRoot $script:sessionId
  $script:stopFile = Join-Path $script:outputDir ".stop"
  New-Item -ItemType Directory -Force -Path $script:outputDir | Out-Null
  Remove-Item -LiteralPath $script:stopFile -Force -ErrorAction SilentlyContinue

  $arguments = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$agentPath`"",
    "-SessionId", "`"$script:sessionId`"",
    "-OutputDir", "`"$script:outputDir`"",
    "-StopFile", "`"$script:stopFile`""
  )
  $script:captureProcess = Start-Process powershell.exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
  $statusText.Text = "Recording - click inside any Windows app."
  $pathText.Text = $script:outputDir
  $startButton.IsEnabled = $false
  $stopButton.IsEnabled = $true
  $openButton.IsEnabled = $true
})

$stopButton.Add_Click({ Stop-Capture })

$openButton.Add_Click({
  if ($script:outputDir -and (Test-Path -LiteralPath $script:outputDir)) {
    Start-Process explorer.exe -ArgumentList "`"$script:outputDir`""
  } else {
    New-Item -ItemType Directory -Force -Path $captureRoot | Out-Null
    Start-Process explorer.exe -ArgumentList "`"$captureRoot`""
  }
})

$window.Add_Closing({ Stop-Capture })
$window.ShowDialog() | Out-Null
