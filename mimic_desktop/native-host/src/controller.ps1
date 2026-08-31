param()

$ErrorActionPreference = "Stop"

$logRoot = Join-Path $env:LOCALAPPDATA "Parro\DesktopCompanion"
$controllerLogPath = Join-Path $logRoot "controller.log"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

trap {
  $detail = "[{0}] {1}`r`n{2}`r`n" -f (Get-Date).ToString("o"), $_.Exception.Message, ($_ | Out-String)
  try { [System.IO.File]::AppendAllText($controllerLogPath, $detail, [System.Text.UTF8Encoding]::new($false)) } catch {}
  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "Parro Desktop을 실행하지 못했습니다.`r`n`r`n$($_.Exception.Message)`r`n`r`n로그: $controllerLogPath",
      "Parro Desktop 실행 오류"
    ) | Out-Null
  } catch {}
  exit 1
}

Add-Type -AssemblyName PresentationFramework

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentPath = Join-Path $installDir "capture-agent.ps1"
$captureRoot = Join-Path $env:LOCALAPPDATA "Parro\DesktopCompanion\captures"
$script:sessionId = $null
$script:outputDir = $null
$script:stopFile = $null
$script:captureProcess = $null

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
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
    <TextBlock Grid.Row="0" Text="Parro Desktop Capture" FontSize="25" FontWeight="Bold" Foreground="#111827" />
    <TextBlock Grid.Row="1" Margin="0,8,0,0" Text="Windows 작업을 클릭 단위로 기록합니다." FontSize="14" Foreground="#4B5563" />
    <Border Grid.Row="2" Margin="0,22,0,0" Padding="15" CornerRadius="10" Background="#EEF2FF">
      <StackPanel>
        <TextBlock x:Name="StatusText" Text="준비 완료" FontSize="15" FontWeight="SemiBold" Foreground="#3730A3" />
        <TextBlock x:Name="PathText" Margin="0,6,0,0" Text="캡처를 시작하면 저장 폴더가 표시됩니다." TextWrapping="Wrap" FontSize="12" Foreground="#6B7280" />
      </StackPanel>
    </Border>
    <TextBlock Grid.Row="3" Margin="0,18,0,0" Text="개인정보 안내: 비밀번호·결제 화면에서는 일시정지를 사용하세요." TextWrapping="Wrap" FontSize="12" Foreground="#B45309" />
    <StackPanel Grid.Row="4" Margin="0,22,0,0" Orientation="Horizontal" HorizontalAlignment="Right">
      <Button x:Name="OpenButton" Content="폴더 열기" Width="120" Height="40" Margin="0,0,10,0" IsEnabled="False" />
      <Button x:Name="StopButton" Content="중지" Width="100" Height="40" Margin="0,0,10,0" IsEnabled="False" />
      <Button x:Name="StartButton" Content="캡처 시작" Width="100" Height="40" Background="#4F46E5" Foreground="White" FontWeight="Bold" />
    </StackPanel>
  </Grid>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)
$iconPath = Join-Path $installDir "parro.ico"
if (Test-Path -LiteralPath $iconPath) {
  try {
    $iconImage = New-Object Windows.Media.Imaging.BitmapImage
    $iconImage.BeginInit()
    $iconImage.CacheOption = [Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $iconImage.UriSource = [uri]$iconPath
    $iconImage.EndInit()
    $iconImage.Freeze()
    $window.Icon = $iconImage
  } catch {}
}
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
  $statusText.Text = "캡처 중지됨"
  $pathText.Text = $script:outputDir
  $startButton.IsEnabled = $true
  $stopButton.IsEnabled = $false
  $openButton.IsEnabled = $true
  $script:sessionId = $null
  $script:captureProcess = $null
}

$startButton.Add_Click({
  if (-not (Test-Path -LiteralPath $agentPath)) {
    [System.Windows.MessageBox]::Show("캡처 엔진을 찾을 수 없습니다. 앱을 다시 설치해 주세요.", "Parro Desktop Capture") | Out-Null
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
  $statusText.Text = "기록 중 - Windows 앱에서 작업을 진행하세요."
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
