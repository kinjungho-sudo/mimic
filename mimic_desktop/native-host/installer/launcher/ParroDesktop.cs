using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Parro Desktop Capture")]
[assembly: System.Reflection.AssemblyProduct("Parro Desktop Capture")]
[assembly: System.Reflection.AssemblyCompany("Parro")]
[assembly: System.Reflection.AssemblyVersion("0.4.1.0")]
[assembly: System.Reflection.AssemblyFileVersion("0.4.1.0")]

internal static class ParroDesktopProgram
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new CaptureForm());
    }
}

internal sealed class CaptureForm : Form
{
    private const uint WdaNone = 0x00000000;
    private const uint WdaMonitor = 0x00000001;
    private const uint WdaExcludeFromCapture = 0x00000011;
    private const int WmNclButtonDown = 0x00A1;
    private const int HtCaption = 0x0002;

    [DllImport("user32.dll")]
    private static extern bool SetWindowDisplayAffinity(IntPtr window, uint affinity);

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

    private readonly string installDirectory = AppDomain.CurrentDomain.BaseDirectory;
    private readonly string captureRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Parro", "DesktopCompanion", "captures");

    private readonly Panel mainPanel;
    private readonly Panel toolbarPanel;
    private readonly Label statusLabel;
    private readonly Label pathLabel;
    private readonly Label elapsedLabel;
    private readonly Label toolbarStatusLabel;
    private readonly Button startButton;
    private readonly Button stopButton;
    private readonly Button openButton;
    private readonly Button recordButton;
    private readonly Button manualButton;
    private readonly Button blurButton;
    private readonly Button undoButton;
    private readonly Button pauseButton;
    private readonly Button completeButton;
    private readonly Button toolbarStopButton;
    private readonly Timer elapsedTimer;
    private readonly ToolTip toolTip;

    private string sessionId;
    private string outputDirectory;
    private string stopFile;
    private string pauseFile;
    private string manualCaptureFile;
    private string undoFile;
    private string blurNextFile;
    private string toolbarBoundsFile;
    private Process captureProcess;
    private DateTime captureStartedAt;
    private bool paused;
    private bool blurNext;
    private bool toolbarMode;

    internal CaptureForm()
    {
        Text = "Parro Desktop Capture";
        ClientSize = new Size(520, 330);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = true;
        BackColor = Color.FromArgb(248, 250, 252);
        Font = new Font("Segoe UI", 9F);
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        toolTip = new ToolTip();
        mainPanel = BuildMainPanel();
        toolbarPanel = BuildToolbarPanel();
        toolbarPanel.Visible = false;
        Controls.Add(mainPanel);
        Controls.Add(toolbarPanel);

        statusLabel = (Label)mainPanel.Controls["StatusPanel"].Controls["StatusLabel"];
        pathLabel = (Label)mainPanel.Controls["StatusPanel"].Controls["PathLabel"];
        openButton = (Button)mainPanel.Controls["OpenButton"];
        stopButton = (Button)mainPanel.Controls["StopButton"];
        startButton = (Button)mainPanel.Controls["StartButton"];

        recordButton = (Button)toolbarPanel.Controls["RecordButton"];
        manualButton = (Button)toolbarPanel.Controls["ManualButton"];
        blurButton = (Button)toolbarPanel.Controls["BlurButton"];
        undoButton = (Button)toolbarPanel.Controls["UndoButton"];
        pauseButton = (Button)toolbarPanel.Controls["PauseButton"];
        completeButton = (Button)toolbarPanel.Controls["CompleteButton"];
        toolbarStopButton = (Button)toolbarPanel.Controls["ToolbarStopButton"];
        elapsedLabel = (Label)toolbarPanel.Controls["ElapsedLabel"];
        toolbarStatusLabel = (Label)toolbarPanel.Controls["ToolbarStatusLabel"];

        startButton.Click += delegate { StartCapture(); };
        stopButton.Click += delegate { StopCapture(false); };
        openButton.Click += delegate { OpenCaptureFolder(); };
        manualButton.Click += delegate { RequestManualCapture(); };
        blurButton.Click += delegate { ToggleBlurNext(); };
        undoButton.Click += delegate { RequestUndo(); };
        pauseButton.Click += delegate { TogglePause(); };
        completeButton.Click += delegate { CompleteCapture(); };
        toolbarStopButton.Click += delegate { StopCapture(false); };

        elapsedTimer = new Timer();
        elapsedTimer.Interval = 250;
        elapsedTimer.Tick += delegate { UpdateToolbarState(); };

        LocationChanged += delegate { WriteToolbarBounds(); };
        SizeChanged += delegate { WriteToolbarBounds(); };
        HandleCreated += delegate { if (toolbarMode) ApplyCaptureExclusion(); };
        FormClosing += OnFormClosing;
    }

    private Panel BuildMainPanel()
    {
        Panel panel = new Panel();
        panel.Name = "MainPanel";
        panel.Dock = DockStyle.Fill;
        panel.BackColor = Color.FromArgb(248, 250, 252);

        Label title = new Label();
        title.Text = "Parro Desktop Capture";
        title.Location = new Point(28, 24);
        title.Size = new Size(450, 38);
        title.Font = new Font("Segoe UI", 21F, FontStyle.Bold);
        title.ForeColor = Color.FromArgb(17, 24, 39);
        panel.Controls.Add(title);

        Label description = new Label();
        description.Text = "Windows 작업을 기록하고 완료하면 Parro 매뉴얼로 만듭니다.";
        description.Location = new Point(30, 69);
        description.Size = new Size(450, 24);
        description.ForeColor = Color.FromArgb(75, 85, 99);
        panel.Controls.Add(description);

        Panel statusPanel = new Panel();
        statusPanel.Name = "StatusPanel";
        statusPanel.Location = new Point(28, 108);
        statusPanel.Size = new Size(464, 82);
        statusPanel.BackColor = Color.FromArgb(238, 248, 246);
        panel.Controls.Add(statusPanel);

        Label status = new Label();
        status.Name = "StatusLabel";
        status.Text = "준비 완료";
        status.Location = new Point(15, 13);
        status.Size = new Size(430, 24);
        status.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
        status.ForeColor = Color.FromArgb(0, 112, 103);
        statusPanel.Controls.Add(status);

        Label path = new Label();
        path.Name = "PathLabel";
        path.Text = "캡처를 시작하면 저장 폴더가 표시됩니다.";
        path.Location = new Point(15, 43);
        path.Size = new Size(430, 30);
        path.AutoEllipsis = true;
        path.ForeColor = Color.FromArgb(107, 114, 128);
        statusPanel.Controls.Add(path);

        Label privacy = new Label();
        privacy.Text = "개인정보 안내: 비밀번호·결제 화면에서는 일시정지를 사용하세요.";
        privacy.Location = new Point(30, 207);
        privacy.Size = new Size(460, 30);
        privacy.ForeColor = Color.FromArgb(180, 83, 9);
        panel.Controls.Add(privacy);

        Button open = MakeMainButton("폴더 열기", 132, 264, 110);
        open.Name = "OpenButton";
        Button stop = MakeMainButton("중지", 252, 264, 100);
        stop.Name = "StopButton";
        Button start = MakeMainButton("캡처 시작", 362, 264, 130);
        start.Name = "StartButton";
        start.BackColor = Color.FromArgb(0, 142, 134);
        start.ForeColor = Color.White;
        start.FlatAppearance.BorderSize = 0;
        open.Enabled = false;
        stop.Enabled = false;
        panel.Controls.Add(open);
        panel.Controls.Add(stop);
        panel.Controls.Add(start);
        return panel;
    }

    private Panel BuildToolbarPanel()
    {
        Panel panel = new Panel();
        panel.Name = "ToolbarPanel";
        panel.Dock = DockStyle.Fill;
        panel.Padding = new Padding(8);
        panel.BackColor = Color.FromArgb(7, 20, 17);
        panel.MouseDown += BeginToolbarDrag;

        PictureBox logo = new PictureBox();
        logo.Location = new Point(11, 13);
        logo.Size = new Size(30, 30);
        logo.SizeMode = PictureBoxSizeMode.Zoom;
        try { logo.Image = Icon.ToBitmap(); } catch { }
        logo.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(logo);

        Label brand = new Label();
        brand.Text = "Parro";
        brand.Location = new Point(43, 11);
        brand.Size = new Size(48, 18);
        brand.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        brand.ForeColor = Color.White;
        brand.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(brand);

        Label toolbarStatus = new Label();
        toolbarStatus.Name = "ToolbarStatusLabel";
        toolbarStatus.Text = "기록 중";
        toolbarStatus.Location = new Point(43, 30);
        toolbarStatus.Size = new Size(62, 17);
        toolbarStatus.Font = new Font("Segoe UI", 7.5F);
        toolbarStatus.ForeColor = Color.FromArgb(137, 219, 204);
        toolbarStatus.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(toolbarStatus);

        Button record = MakeToolbarButton("● 녹화", 106, 10, 66);
        record.Name = "RecordButton";
        record.BackColor = Color.FromArgb(113, 25, 35);
        record.ForeColor = Color.FromArgb(255, 224, 228);
        toolTip.SetToolTip(record, "현재 데스크톱 클릭 캡처가 진행 중입니다.");
        panel.Controls.Add(record);

        Label elapsed = new Label();
        elapsed.Name = "ElapsedLabel";
        elapsed.Text = "00:00";
        elapsed.Location = new Point(176, 19);
        elapsed.Size = new Size(44, 20);
        elapsed.TextAlign = ContentAlignment.MiddleCenter;
        elapsed.Font = new Font("Consolas", 9F, FontStyle.Bold);
        elapsed.ForeColor = Color.FromArgb(215, 235, 230);
        elapsed.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(elapsed);

        Button manual = MakeToolbarButton("▣ 캡처", 226, 10, 72);
        manual.Name = "ManualButton";
        toolTip.SetToolTip(manual, "현재 화면을 즉시 한 장 캡처합니다.");
        panel.Controls.Add(manual);

        Button blur = MakeToolbarButton("◉ 블러", 304, 10, 68);
        blur.Name = "BlurButton";
        toolTip.SetToolTip(blur, "다음 캡처에서 클릭 주변을 픽셀 블러 처리합니다.");
        panel.Controls.Add(blur);

        Button undo = MakeToolbarButton("↶ 취소", 378, 10, 66);
        undo.Name = "UndoButton";
        toolTip.SetToolTip(undo, "가장 최근 캡처를 삭제합니다.");
        panel.Controls.Add(undo);

        Button pause = MakeToolbarButton("Ⅱ 일시정지", 450, 10, 88);
        pause.Name = "PauseButton";
        toolTip.SetToolTip(pause, "자동 캡처를 잠시 멈추거나 다시 시작합니다.");
        panel.Controls.Add(pause);

        Button complete = MakeToolbarButton("✓ 매뉴얼 만들기", 544, 10, 122);
        complete.Name = "CompleteButton";
        complete.BackColor = Color.FromArgb(0, 142, 134);
        complete.ForeColor = Color.White;
        complete.FlatAppearance.BorderSize = 0;
        toolTip.SetToolTip(complete, "세션을 완료하고 Parro에서 매뉴얼을 생성합니다.");
        panel.Controls.Add(complete);

        Button stop = MakeToolbarButton("■ 중지", 672, 10, 68);
        stop.Name = "ToolbarStopButton";
        stop.ForeColor = Color.FromArgb(255, 174, 183);
        toolTip.SetToolTip(stop, "세션을 중지하고 Parro 기본 창으로 돌아갑니다.");
        panel.Controls.Add(stop);

        Label drag = new Label();
        drag.Text = "⋮⋮";
        drag.Location = new Point(744, 15);
        drag.Size = new Size(28, 25);
        drag.TextAlign = ContentAlignment.MiddleCenter;
        drag.Font = new Font("Segoe UI", 13F, FontStyle.Bold);
        drag.ForeColor = Color.FromArgb(98, 139, 130);
        drag.Cursor = Cursors.SizeAll;
        drag.MouseDown += BeginToolbarDrag;
        toolTip.SetToolTip(drag, "드래그하여 툴바를 이동합니다.");
        panel.Controls.Add(drag);
        return panel;
    }

    private static Button MakeMainButton(string text, int x, int y, int width)
    {
        Button button = new Button();
        button.Text = text;
        button.Location = new Point(x, y);
        button.Size = new Size(width, 40);
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
        button.BackColor = Color.White;
        return button;
    }

    private static Button MakeToolbarButton(string text, int x, int y, int width)
    {
        Button button = new Button();
        button.Text = text;
        button.Location = new Point(x, y);
        button.Size = new Size(width, 38);
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderColor = Color.FromArgb(45, 78, 70);
        button.BackColor = Color.FromArgb(18, 43, 37);
        button.ForeColor = Color.FromArgb(225, 242, 237);
        button.Font = new Font("Segoe UI", 8.25F, FontStyle.Bold);
        button.Cursor = Cursors.Hand;
        button.TabStop = false;
        return button;
    }

    private void StartCapture()
    {
        string agentPath = Path.Combine(installDirectory, "capture-agent.ps1");
        if (!File.Exists(agentPath))
        {
            MessageBox.Show("캡처 엔진을 찾을 수 없습니다. 앱을 다시 설치해 주세요.", Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        try
        {
            sessionId = "desktop-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0, 8);
            outputDirectory = Path.Combine(captureRoot, sessionId);
            stopFile = Path.Combine(outputDirectory, ".stop");
            pauseFile = Path.Combine(outputDirectory, ".pause");
            manualCaptureFile = Path.Combine(outputDirectory, ".manual-capture");
            undoFile = Path.Combine(outputDirectory, ".undo");
            blurNextFile = Path.Combine(outputDirectory, ".blur-next");
            toolbarBoundsFile = Path.Combine(outputDirectory, ".toolbar-bounds.json");
            Directory.CreateDirectory(outputDirectory);
            DeleteCommandFiles();

            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = "powershell.exe";
            start.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + agentPath + "\"" +
                " -SessionId \"" + sessionId + "\"" +
                " -OutputDir \"" + outputDirectory + "\"" +
                " -StopFile \"" + stopFile + "\"" +
                " -PauseFile \"" + pauseFile + "\"" +
                " -ManualCaptureFile \"" + manualCaptureFile + "\"" +
                " -UndoFile \"" + undoFile + "\"" +
                " -BlurNextFile \"" + blurNextFile + "\"" +
                " -ToolbarBoundsFile \"" + toolbarBoundsFile + "\"";
            start.WorkingDirectory = installDirectory;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            captureProcess = Process.Start(start);
            if (captureProcess == null) throw new InvalidOperationException("캡처 프로세스를 시작하지 못했습니다.");

            captureStartedAt = DateTime.UtcNow;
            paused = false;
            blurNext = false;
            statusLabel.Text = "기록 중 · Windows 앱을 평소처럼 클릭하세요.";
            pathLabel.Text = outputDirectory;
            startButton.Enabled = false;
            stopButton.Enabled = true;
            openButton.Enabled = true;
            EnterToolbarMode();
        }
        catch (Exception exception)
        {
            Log(exception);
            MessageBox.Show("캡처를 시작하지 못했습니다.\r\n\r\n" + exception.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void RequestManualCapture()
    {
        if (paused || String.IsNullOrWhiteSpace(manualCaptureFile)) return;
        WriteCommand(manualCaptureFile, "manual");
        toolbarStatusLabel.Text = "수동 캡처 요청";
    }

    private void ToggleBlurNext()
    {
        if (String.IsNullOrWhiteSpace(blurNextFile)) return;
        blurNext = !blurNext;
        if (blurNext)
        {
            WriteCommand(blurNextFile, "blur-next");
            blurButton.BackColor = Color.FromArgb(0, 112, 103);
            blurButton.ForeColor = Color.White;
            toolbarStatusLabel.Text = "다음 캡처 블러";
        }
        else
        {
            TryDelete(blurNextFile);
            ResetBlurButton();
            toolbarStatusLabel.Text = paused ? "일시정지" : "기록 중";
        }
    }

    private void RequestUndo()
    {
        if (String.IsNullOrWhiteSpace(undoFile)) return;
        WriteCommand(undoFile, "undo");
        toolbarStatusLabel.Text = "최근 캡처 취소";
    }

    private void TogglePause()
    {
        if (String.IsNullOrWhiteSpace(pauseFile)) return;
        paused = !paused;
        if (paused)
        {
            WriteCommand(pauseFile, "paused");
            pauseButton.Text = "▶ 다시 시작";
            pauseButton.BackColor = Color.FromArgb(125, 83, 15);
            recordButton.Text = "Ⅱ 정지";
            toolbarStatusLabel.Text = "일시정지";
            manualButton.Enabled = false;
        }
        else
        {
            TryDelete(pauseFile);
            pauseButton.Text = "Ⅱ 일시정지";
            pauseButton.BackColor = Color.FromArgb(18, 43, 37);
            recordButton.Text = "● 녹화";
            toolbarStatusLabel.Text = "기록 중";
            manualButton.Enabled = true;
        }
    }

    private void CompleteCapture()
    {
        string completedSessionId = sessionId;
        StopCapture(true);
        if (!String.IsNullOrWhiteSpace(completedSessionId))
        {
            OpenManualImport(completedSessionId);
        }
        else
        {
            OpenCaptureFolder();
        }
    }

    private void OpenManualImport(string completedSessionId)
    {
        try
        {
            string url = "https://parro-guide.vercel.app/desktop-setup?source=desktop-app&autoImport=1&session=" +
                Uri.EscapeDataString(completedSessionId);
            Process.Start(url);
            statusLabel.Text = "캡처 완료 · 브라우저에서 매뉴얼을 만들고 있습니다.";
        }
        catch (Exception exception)
        {
            Log(exception);
            statusLabel.Text = "캡처 완료 · 폴더에서 결과를 확인하세요.";
            OpenCaptureFolder();
        }
    }

    private void StopCapture(bool completed)
    {
        if (String.IsNullOrWhiteSpace(sessionId)) return;
        try { WriteCommand(stopFile, DateTimeOffset.UtcNow.ToString("o")); }
        catch (Exception exception) { Log(exception); }

        elapsedTimer.Stop();
        ExitToolbarMode();
        statusLabel.Text = completed ? "캡처 완료" : "캡처 중지됨";
        pathLabel.Text = outputDirectory;
        startButton.Enabled = true;
        stopButton.Enabled = false;
        openButton.Enabled = true;
        sessionId = null;
        captureProcess = null;
        paused = false;
        blurNext = false;
    }

    private void EnterToolbarMode()
    {
        toolbarMode = true;
        mainPanel.Visible = false;
        toolbarPanel.Visible = true;
        FormBorderStyle = FormBorderStyle.None;
        ClientSize = new Size(780, 58);
        MinimumSize = Size.Empty;
        MaximumSize = Size.Empty;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.FromArgb(7, 20, 17);
        Screen screen = Screen.FromPoint(Cursor.Position);
        Left = screen.WorkingArea.Left + (screen.WorkingArea.Width - Width) / 2;
        Top = screen.WorkingArea.Top + 14;
        elapsedLabel.Text = "00:00";
        toolbarStatusLabel.Text = "기록 중";
        elapsedTimer.Start();
        ApplyCaptureExclusion();
        WriteToolbarBounds();
    }

    private void ExitToolbarMode()
    {
        try { if (IsHandleCreated) SetWindowDisplayAffinity(Handle, WdaNone); } catch { }
        toolbarMode = false;
        TopMost = false;
        ShowInTaskbar = true;
        toolbarPanel.Visible = false;
        mainPanel.Visible = true;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        ClientSize = new Size(520, 330);
        StartPosition = FormStartPosition.Manual;
        CenterToScreen();
        ResetBlurButton();
        pauseButton.Text = "Ⅱ 일시정지";
        pauseButton.BackColor = Color.FromArgb(18, 43, 37);
        recordButton.Text = "● 녹화";
        manualButton.Enabled = true;
    }

    private void ApplyCaptureExclusion()
    {
        if (!toolbarMode || !IsHandleCreated) return;
        try
        {
            if (!SetWindowDisplayAffinity(Handle, WdaExcludeFromCapture))
            {
                SetWindowDisplayAffinity(Handle, WdaMonitor);
            }
        }
        catch (Exception exception) { Log(exception); }
    }

    private void UpdateToolbarState()
    {
        TimeSpan elapsed = DateTime.UtcNow - captureStartedAt;
        elapsedLabel.Text = elapsed.TotalHours >= 1
            ? elapsed.ToString(@"hh\:mm\:ss")
            : elapsed.ToString(@"mm\:ss");

        if (blurNext && !String.IsNullOrWhiteSpace(blurNextFile) && !File.Exists(blurNextFile))
        {
            blurNext = false;
            ResetBlurButton();
            toolbarStatusLabel.Text = paused ? "일시정지" : "기록 중";
        }
        WriteToolbarBounds();
    }

    private void ResetBlurButton()
    {
        if (blurButton == null) return;
        blurButton.BackColor = Color.FromArgb(18, 43, 37);
        blurButton.ForeColor = Color.FromArgb(225, 242, 237);
    }

    private void WriteToolbarBounds()
    {
        if (!toolbarMode || String.IsNullOrWhiteSpace(toolbarBoundsFile)) return;
        try
        {
            string json = "{\"left\":" + Left + ",\"top\":" + Top +
                ",\"right\":" + Right + ",\"bottom\":" + Bottom + "}";
            File.WriteAllText(toolbarBoundsFile, json, new UTF8Encoding(false));
        }
        catch (Exception exception) { Log(exception); }
    }

    private void BeginToolbarDrag(object sender, MouseEventArgs eventArgs)
    {
        if (!toolbarMode || eventArgs.Button != MouseButtons.Left) return;
        ReleaseCapture();
        SendMessage(Handle, WmNclButtonDown, new IntPtr(HtCaption), IntPtr.Zero);
        WriteToolbarBounds();
    }

    private void OpenCaptureFolder()
    {
        string target = !String.IsNullOrWhiteSpace(outputDirectory) && Directory.Exists(outputDirectory)
            ? outputDirectory
            : captureRoot;
        Directory.CreateDirectory(target);
        Process.Start("explorer.exe", "\"" + target + "\"");
    }

    private void DeleteCommandFiles()
    {
        TryDelete(stopFile);
        TryDelete(pauseFile);
        TryDelete(manualCaptureFile);
        TryDelete(undoFile);
        TryDelete(blurNextFile);
        TryDelete(toolbarBoundsFile);
    }

    private static void WriteCommand(string path, string value)
    {
        File.WriteAllText(path, value, new UTF8Encoding(false));
    }

    private static void TryDelete(string path)
    {
        if (!String.IsNullOrWhiteSpace(path) && File.Exists(path)) File.Delete(path);
    }

    private void OnFormClosing(object sender, FormClosingEventArgs eventArgs)
    {
        if (!String.IsNullOrWhiteSpace(sessionId)) StopCapture(false);
    }

    private static void Log(Exception exception)
    {
        try
        {
            string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Parro", "DesktopCompanion");
            Directory.CreateDirectory(directory);
            File.AppendAllText(
                Path.Combine(directory, "launcher.log"),
                DateTimeOffset.Now.ToString("o") + "  " + exception + Environment.NewLine,
                new UTF8Encoding(false));
        }
        catch { }
    }
}
