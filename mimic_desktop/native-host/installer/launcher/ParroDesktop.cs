using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Parro Desktop Capture")]
[assembly: System.Reflection.AssemblyProduct("Parro Desktop Capture")]
[assembly: System.Reflection.AssemblyCompany("Parro")]
[assembly: System.Reflection.AssemblyVersion("0.6.7.0")]
[assembly: System.Reflection.AssemblyFileVersion("0.6.7.0")]

internal static class ParroDesktopProgram
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        if (args != null && args.Length == 2 && String.Equals(args[0], "--verify-topology", StringComparison.OrdinalIgnoreCase))
        {
            File.WriteAllText(args[1], MonitorTopologyControl.VerifySyntheticLayouts(), new UTF8Encoding(false));
            return;
        }
        if (args != null && args.Length == 2 && String.Equals(args[0], "--verify-side-panel-behavior", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                File.WriteAllText(args[1], CapturePreviewForm.VerifyBehavior(), new UTF8Encoding(false));
            }
            catch (Exception exception)
            {
                File.WriteAllText(args[1], "{\"ok\":false,\"error\":\"" + JsonSafe(exception.GetType().Name + ": " + exception.Message) + "\"}", new UTF8Encoding(false));
                Environment.ExitCode = 1;
            }
            return;
        }
        if (args != null && args.Length == 2 &&
            (String.Equals(args[0], "--render-preview", StringComparison.OrdinalIgnoreCase) ||
             String.Equals(args[0], "--render-toolbar-preview", StringComparison.OrdinalIgnoreCase) ||
             String.Equals(args[0], "--render-side-panel-preview", StringComparison.OrdinalIgnoreCase) ||
             String.Equals(args[0], "--render-side-panel-blur-preview", StringComparison.OrdinalIgnoreCase)))
        {
            if (String.Equals(args[0], "--render-side-panel-preview", StringComparison.OrdinalIgnoreCase) ||
                String.Equals(args[0], "--render-side-panel-blur-preview", StringComparison.OrdinalIgnoreCase))
            {
                RenderSidePanelPreview(args[1], String.Equals(args[0], "--render-side-panel-blur-preview", StringComparison.OrdinalIgnoreCase));
                return;
            }
            RenderPreview(args[1], String.Equals(args[0], "--render-toolbar-preview", StringComparison.OrdinalIgnoreCase));
            return;
        }
        Application.Run(new CaptureForm());
    }

    private static string JsonSafe(string value)
    {
        return (value ?? String.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ");
    }

    private static void RenderPreview(string outputPath, bool toolbar)
    {
        using (CaptureForm form = new CaptureForm())
        {
            form.StartPosition = FormStartPosition.Manual;
            form.Location = new Point(-10000, -10000);
            form.ShowInTaskbar = false;
            form.Show();
            Application.DoEvents();
            if (toolbar)
            {
                form.PrepareToolbarPreview();
                Application.DoEvents();
            }
            using (Bitmap bitmap = new Bitmap(form.Width, form.Height))
            {
                form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                bitmap.Save(outputPath, System.Drawing.Imaging.ImageFormat.Png);
            }
            form.Close();
        }
    }

    private static void RenderSidePanelPreview(string outputPath, bool blurPreview)
    {
        string previewDirectory = Path.Combine(Path.GetTempPath(), "Parro", "side-panel-preview-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(previewDirectory);
        for (int index = 0; index < 3; index++)
        {
            using (Bitmap sample = new Bitmap(1280, 720))
            using (Graphics graphics = Graphics.FromImage(sample))
            using (Font heading = new Font("Segoe UI", 28F, FontStyle.Bold))
            using (Font body = new Font("Segoe UI", 15F))
            {
                Color[] accents = { Color.FromArgb(0, 151, 136), Color.FromArgb(64, 104, 178), Color.FromArgb(121, 83, 168) };
                graphics.Clear(Color.FromArgb(242, 246, 248));
                graphics.FillRectangle(new SolidBrush(Color.White), new Rectangle(70, 58, 1140, 604));
                graphics.FillRectangle(new SolidBrush(accents[index]), new Rectangle(70, 58, 1140, 76));
                graphics.DrawString("Parro 데스크톱 캡처", heading, Brushes.White, 104, 76);
                graphics.DrawString((index + 1) + "단계  ·  작업 화면 미리보기", heading, new SolidBrush(Color.FromArgb(28, 45, 52)), 104, 184);
                graphics.DrawString("웹 Recorder와 같은 순서로 새 스텝이 아래에 추가됩니다.", body, new SolidBrush(Color.FromArgb(91, 105, 114)), 106, 246);
                for (int row = 0; row < 4; row++)
                {
                    graphics.FillRectangle(new SolidBrush(Color.FromArgb(235, 241, 243)), new Rectangle(106, 318 + row * 60, 760 - row * 70, 34));
                }
                sample.Save(Path.Combine(previewDirectory, "step-" + (index + 1).ToString("00") + ".png"), System.Drawing.Imaging.ImageFormat.Png);
            }
        }
        using (CapturePreviewForm form = new CapturePreviewForm())
        {
            form.StartPosition = FormStartPosition.Manual;
            form.Location = new Point(-10000, -10000);
            form.ShowInTaskbar = false;
            form.SetRecordingState("화면 1 · 주 모니터", "02:18", 7, false, false);
            form.SetSession(previewDirectory);
            form.RefreshSession(Directory.GetFiles(previewDirectory, "*.png"));
            form.Show();
            Application.DoEvents();
            if (blurPreview)
            {
                form.PrepareBlurPreview(Directory.GetFiles(previewDirectory, "*.png")[0]);
                Application.DoEvents();
            }
            using (Bitmap bitmap = new Bitmap(form.Width, form.Height))
            {
                if (blurPreview) form.DrawBlurPreviewToBitmap(bitmap);
                else form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                bitmap.Save(outputPath, System.Drawing.Imaging.ImageFormat.Png);
            }
            form.Close();
        }
        try { Directory.Delete(previewDirectory, true); } catch { }
    }
}

internal sealed class CaptureTargetOption
{
    internal string Mode;
    internal string Label;
    internal Screen Screen;
    public override string ToString() { return Label; }
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

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int widthEllipse, int heightEllipse);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr handle);

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
    private readonly Button previewButton;
    private readonly Button completeButton;
    private readonly Button toolbarStopButton;
    private readonly MonitorTopologyControl displayPicker;
    private readonly Button allScreensButton;
    private readonly Button sidePanelModeButton;
    private readonly Button miniToolbarModeButton;
    private readonly Timer elapsedTimer;
    private readonly ToolTip toolTip;
    private readonly CapturePreviewForm previewForm;
    private readonly NotifyIcon trayIcon;

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
    private int capturedStepCount;
    private string captureTargetLabel = "기본 화면";
    private string recordingDisplayMode = "side";
    private Screen captureTargetScreen;
    private Screen recordingUiScreen;
    private bool recordingUiHiddenForCapture;
    private bool hasSafeRecordingUiScreen;

    internal CaptureForm()
    {
        Text = "Parro Desktop Capture";
        ClientSize = new Size(1040, 720);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
        MaximizeBox = false;
        MinimizeBox = true;
        BackColor = Color.FromArgb(7, 36, 31);
        Font = new Font("Segoe UI", 9.5F);
        AutoScaleMode = AutoScaleMode.Dpi;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        toolTip = new ToolTip();
        mainPanel = BuildMainPanel();
        toolbarPanel = BuildToolbarPanel();
        toolbarPanel.Visible = false;
        Controls.Add(mainPanel);
        Controls.Add(toolbarPanel);

        statusLabel = (Label)mainPanel.Controls["StatusPanel"].Controls["StatusLabel"];
        pathLabel = (Label)mainPanel.Controls["StatusPanel"].Controls["PathLabel"];
        openButton = (Button)mainPanel.Controls.Find("OpenButton", true)[0];
        stopButton = (Button)mainPanel.Controls.Find("StopButton", true)[0];
        startButton = (Button)mainPanel.Controls.Find("StartButton", true)[0];
        displayPicker = (MonitorTopologyControl)mainPanel.Controls["DisplayPicker"];
        allScreensButton = (Button)mainPanel.Controls.Find("AllScreensButton", true)[0];
        sidePanelModeButton = (Button)mainPanel.Controls.Find("SidePanelModeButton", true)[0];
        miniToolbarModeButton = (Button)mainPanel.Controls.Find("MiniToolbarModeButton", true)[0];
        PopulateDisplayPicker();

        recordButton = (Button)toolbarPanel.Controls["RecordButton"];
        manualButton = (Button)toolbarPanel.Controls["ManualButton"];
        blurButton = (Button)toolbarPanel.Controls["BlurButton"];
        undoButton = (Button)toolbarPanel.Controls["UndoButton"];
        pauseButton = (Button)toolbarPanel.Controls["PauseButton"];
        previewButton = (Button)toolbarPanel.Controls["PreviewButton"];
        completeButton = (Button)toolbarPanel.Controls["CompleteButton"];
        toolbarStopButton = (Button)toolbarPanel.Controls["ToolbarStopButton"];
        elapsedLabel = (Label)toolbarPanel.Controls["ElapsedLabel"];
        toolbarStatusLabel = (Label)toolbarPanel.Controls["ToolbarStatusLabel"];
        previewForm = new CapturePreviewForm();
        previewForm.ManualCaptureRequested += delegate { RequestManualCapture(); };
        previewForm.BlurRequested += delegate { ToggleBlurNext(); };
        previewForm.UndoRequested += delegate { RequestUndo(); };
        previewForm.PauseRequested += delegate { TogglePause(); };
        previewForm.CompleteRequested += delegate { CompleteCapture(); };
        previewForm.StopRequested += delegate { StopCapture(false); };
        previewForm.DockRequested += delegate
        {
            Screen screen = recordingUiScreen ?? captureTargetScreen ?? Screen.PrimaryScreen;
            previewForm.DockToRight(screen);
            WriteToolbarBounds();
        };
        previewForm.BoundsChanged += delegate { WriteToolbarBounds(); };
        previewForm.VisibleChanged += delegate
        {
            if (!previewForm.Visible) previewButton.Text = "미리보기";
            WriteToolbarBounds();
        };

        ContextMenuStrip trayMenu = new ContextMenuStrip();
        trayMenu.Items.Add("사이드 패널 열기", null, delegate { RestoreRecordingUi(); });
        trayMenu.Items.Add("현재 화면 캡처", null, delegate { RequestManualCapture(); });
        trayMenu.Items.Add("일시정지 / 다시 시작", null, delegate { TogglePause(); });
        trayMenu.Items.Add(new ToolStripSeparator());
        trayMenu.Items.Add("매뉴얼 만들기", null, delegate { CompleteCapture(); });
        trayMenu.Items.Add("캡처 종료", null, delegate { StopCapture(false); });
        trayIcon = new NotifyIcon();
        trayIcon.Text = "Parro Desktop Capture";
        trayIcon.Icon = Icon ?? SystemIcons.Application;
        trayIcon.ContextMenuStrip = trayMenu;
        trayIcon.Visible = false;
        trayIcon.DoubleClick += delegate { RestoreRecordingUi(); };

        startButton.Click += delegate { StartCapture(); };
        allScreensButton.Click += delegate { displayPicker.SelectAllScreens(); UpdateScopeButtons(); };
        sidePanelModeButton.Click += delegate { SetRecordingDisplayMode("side"); };
        miniToolbarModeButton.Click += delegate { SetRecordingDisplayMode("mini"); };
        displayPicker.SelectionChanged += delegate { UpdateScopeButtons(); };
        stopButton.Click += delegate { StopCapture(false); };
        openButton.Click += delegate { OpenCaptureFolder(); };
        manualButton.Click += delegate { RequestManualCapture(); };
        blurButton.Click += delegate { ToggleBlurNext(); };
        undoButton.Click += delegate { RequestUndo(); };
        pauseButton.Click += delegate { TogglePause(); };
        previewButton.Click += delegate { TogglePreview(); };
        completeButton.Click += delegate { CompleteCapture(); };
        toolbarStopButton.Click += delegate { StopCapture(false); };

        elapsedTimer = new Timer();
        elapsedTimer.Interval = 250;
        elapsedTimer.Tick += delegate { UpdateToolbarState(); };

        LocationChanged += delegate { WriteToolbarBounds(); };
        SizeChanged += delegate { ApplyWindowShape(); WriteToolbarBounds(); };
        Shown += delegate { ApplyWindowShape(); };
        HandleCreated += delegate { if (toolbarMode) ApplyCaptureExclusion(); };
        FormClosing += OnFormClosing;
    }

    private Panel BuildMainPanel()
    {
        Panel panel = new Panel();
        panel.Name = "MainPanel";
        panel.Dock = DockStyle.Fill;
        panel.BackColor = Color.FromArgb(242, 247, 245);

        Panel header = new Panel();
        header.Location = new Point(0, 0);
        header.Size = new Size(1040, 72);
        header.BackColor = Color.FromArgb(250, 252, 251);
        header.MouseDown += BeginWindowDrag;
        panel.Controls.Add(header);

        RoundedPanel logoTile = new RoundedPanel(12, Color.FromArgb(0, 151, 136), Color.Transparent);
        logoTile.Location = new Point(28, 17);
        logoTile.Size = new Size(38, 38);
        header.Controls.Add(logoTile);

        PictureBox logoImage = new PictureBox();
        logoImage.Dock = DockStyle.Fill;
        logoImage.Padding = new Padding(5);
        logoImage.SizeMode = PictureBoxSizeMode.Zoom;
        logoImage.BackColor = Color.Transparent;
        try { logoImage.Image = Icon.ToBitmap(); } catch { }
        logoImage.MouseDown += BeginWindowDrag;
        logoTile.Controls.Add(logoImage);

        Label brand = new Label();
        brand.Text = "Parro Desktop";
        brand.Location = new Point(78, 20);
        brand.Size = new Size(180, 28);
        brand.Font = new Font("Segoe UI", 11F, FontStyle.Bold);
        brand.ForeColor = Color.FromArgb(10, 42, 36);
        brand.TextAlign = ContentAlignment.MiddleLeft;
        brand.MouseDown += BeginWindowDrag;
        header.Controls.Add(brand);

        Label version = new Label();
        version.Text = "PREVIEW 0.6.7";
        version.Location = new Point(250, 26);
        version.Size = new Size(95, 19);
        version.Font = new Font("Segoe UI", 7.5F, FontStyle.Bold);
        version.ForeColor = Color.FromArgb(63, 104, 96);
        version.TextAlign = ContentAlignment.MiddleCenter;
        version.BackColor = Color.FromArgb(226, 239, 235);
        header.Controls.Add(version);

        WindowControlButton minimize = new WindowControlButton(WindowControlKind.Minimize);
        minimize.Location = new Point(932, 18);
        minimize.Size = new Size(36, 36);
        minimize.Click += delegate { WindowState = FormWindowState.Minimized; };
        toolTip.SetToolTip(minimize, "내리기");
        header.Controls.Add(minimize);

        WindowControlButton close = new WindowControlButton(WindowControlKind.Close);
        close.Location = new Point(974, 18);
        close.Size = new Size(36, 36);
        close.Click += delegate { Close(); };
        toolTip.SetToolTip(close, "닫기");
        header.Controls.Add(close);

        Label eyebrow = new Label();
        eyebrow.Text = "1  ·  캡처 범위";
        eyebrow.Location = new Point(48, 94);
        eyebrow.Size = new Size(240, 20);
        eyebrow.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
        eyebrow.ForeColor = Color.FromArgb(0, 132, 120);
        panel.Controls.Add(eyebrow);

        Label title = new Label();
        title.Text = "어디를 클릭하든 알아서 기록할게요";
        title.Location = new Point(46, 120);
        title.Size = new Size(620, 42);
        title.Font = new Font("Segoe UI", 24F, FontStyle.Bold);
        title.ForeColor = Color.FromArgb(7, 36, 31);
        panel.Controls.Add(title);

        Label description = new Label();
        description.Text = "기본은 모든 화면 자동 감지입니다. 필요한 경우에만 특정 화면을 눌러 그 화면만 녹화하세요.";
        description.Location = new Point(49, 166);
        description.Size = new Size(760, 24);
        description.Font = new Font("Segoe UI", 9.5F);
        description.ForeColor = Color.FromArgb(77, 101, 96);
        panel.Controls.Add(description);

        RoundedPanel statusPanel = new RoundedPanel(16, Color.White, Color.FromArgb(206, 224, 219));
        statusPanel.Name = "StatusPanel";
        statusPanel.Location = new Point(786, 103);
        statusPanel.Size = new Size(206, 70);
        panel.Controls.Add(statusPanel);

        RoundedPanel statusDot = new RoundedPanel(6, Color.FromArgb(42, 180, 127), Color.Transparent);
        statusDot.Location = new Point(16, 16);
        statusDot.Size = new Size(12, 12);
        statusPanel.Controls.Add(statusDot);

        Label status = new Label();
        status.Name = "StatusLabel";
        status.Text = "준비 완료";
        status.Location = new Point(38, 10);
        status.Size = new Size(152, 24);
        status.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
        status.ForeColor = Color.FromArgb(0, 105, 94);
        status.BackColor = Color.Transparent;
        statusPanel.Controls.Add(status);

        Label path = new Label();
        path.Name = "PathLabel";
        path.Text = "모니터 구성을 확인했습니다.";
        path.Location = new Point(16, 40);
        path.Size = new Size(174, 20);
        path.AutoEllipsis = true;
        path.Font = new Font("Segoe UI", 8.5F);
        path.ForeColor = Color.FromArgb(84, 116, 108);
        path.BackColor = Color.Transparent;
        statusPanel.Controls.Add(path);

        MonitorTopologyControl picker = new MonitorTopologyControl();
        picker.Name = "DisplayPicker";
        picker.Location = new Point(48, 198);
        picker.Size = new Size(944, 344);
        panel.Controls.Add(picker);

        RoundedPanel dock = new RoundedPanel(18, Color.White, Color.FromArgb(203, 221, 216));
        dock.Location = new Point(48, 562);
        dock.Size = new Size(944, 118);
        panel.Controls.Add(dock);

        Label scopeLabel = new Label();
        scopeLabel.Text = "기본 범위";
        scopeLabel.Location = new Point(20, 14);
        scopeLabel.Size = new Size(90, 18);
        scopeLabel.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
        scopeLabel.ForeColor = Color.FromArgb(87, 110, 104);
        scopeLabel.BackColor = Color.Transparent;
        dock.Controls.Add(scopeLabel);

        RoundedButton all = new RoundedButton("모든 화면 자동", 10, Color.FromArgb(239, 245, 243), Color.FromArgb(35, 70, 62), Color.FromArgb(209, 223, 219));
        all.Name = "AllScreensButton";
        all.Location = new Point(18, 40);
        all.Size = new Size(126, 48);
        dock.Controls.Add(all);

        Label modeLabel = new Label();
        modeLabel.Text = "녹화 도구";
        modeLabel.Location = new Point(164, 14);
        modeLabel.Size = new Size(90, 18);
        modeLabel.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
        modeLabel.ForeColor = Color.FromArgb(87, 110, 104);
        modeLabel.BackColor = Color.Transparent;
        dock.Controls.Add(modeLabel);

        RoundedButton side = new RoundedButton("사이드 패널", 10, Color.FromArgb(7, 105, 95), Color.White, Color.FromArgb(7, 105, 95));
        side.Name = "SidePanelModeButton";
        side.Location = new Point(164, 40);
        side.Size = new Size(132, 48);
        dock.Controls.Add(side);

        RoundedButton mini = new RoundedButton("미니 툴바", 10, Color.FromArgb(239, 245, 243), Color.FromArgb(35, 70, 62), Color.FromArgb(209, 223, 219));
        mini.Name = "MiniToolbarModeButton";
        mini.Location = new Point(306, 40);
        mini.Size = new Size(132, 48);
        dock.Controls.Add(mini);

        Label privacy = new Label();
        privacy.Text = "특정 화면만 녹화하려면\r\n위 미리보기에서 선택하세요.";
        privacy.Location = new Point(466, 38);
        privacy.Size = new Size(170, 45);
        privacy.Font = new Font("Segoe UI", 8.5F);
        privacy.ForeColor = Color.FromArgb(91, 112, 107);
        privacy.BackColor = Color.Transparent;
        dock.Controls.Add(privacy);

        Button open = MakeMainButton("저장 폴더", 650, 38, 108);
        open.Name = "OpenButton";
        Button stop = MakeMainButton("캡처 중지", 650, 38, 108);
        stop.Name = "StopButton";
        Button start = MakeMainButton("캡처 시작", 774, 38, 150);
        start.Name = "StartButton";
        ((RoundedButton)start).SetColors(Color.FromArgb(0, 151, 136), Color.White, Color.FromArgb(0, 151, 136));
        open.Enabled = false;
        stop.Enabled = false;
        dock.Controls.Add(open);
        dock.Controls.Add(stop);
        dock.Controls.Add(start);
        return panel;
    }

    private Panel BuildToolbarPanel()
    {
        Panel panel = new Panel();
        panel.Name = "ToolbarPanel";
        panel.Dock = DockStyle.Fill;
        panel.Padding = new Padding(8);
        panel.BackColor = Color.FromArgb(7, 36, 31);
        panel.MouseDown += BeginToolbarDrag;

        PictureBox logo = new PictureBox();
        logo.Location = new Point(14, 17);
        logo.Size = new Size(32, 32);
        logo.SizeMode = PictureBoxSizeMode.Zoom;
        try { logo.Image = Icon.ToBitmap(); } catch { }
        logo.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(logo);

        Label brand = new Label();
        brand.Text = "Parro";
        brand.Location = new Point(52, 13);
        brand.Size = new Size(58, 19);
        brand.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold);
        brand.ForeColor = Color.White;
        brand.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(brand);

        Label toolbarStatus = new Label();
        toolbarStatus.Name = "ToolbarStatusLabel";
        toolbarStatus.Text = "기록 중";
        toolbarStatus.Location = new Point(52, 34);
        toolbarStatus.Size = new Size(64, 17);
        toolbarStatus.Font = new Font("Segoe UI", 7.5F);
        toolbarStatus.ForeColor = Color.FromArgb(137, 219, 204);
        toolbarStatus.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(toolbarStatus);

        Button record = MakeToolbarButton("녹화 중", 120, 14, 76);
        record.Name = "RecordButton";
        ((RoundedButton)record).SetColors(Color.FromArgb(105, 30, 38), Color.FromArgb(255, 226, 230), Color.FromArgb(139, 45, 55));
        toolTip.SetToolTip(record, "현재 데스크톱 클릭 캡처가 진행 중입니다.");
        panel.Controls.Add(record);

        Label elapsed = new Label();
        elapsed.Name = "ElapsedLabel";
        elapsed.Text = "00:00";
        elapsed.Location = new Point(202, 23);
        elapsed.Size = new Size(50, 20);
        elapsed.TextAlign = ContentAlignment.MiddleCenter;
        elapsed.Font = new Font("Consolas", 9F, FontStyle.Bold);
        elapsed.ForeColor = Color.FromArgb(215, 235, 230);
        elapsed.MouseDown += BeginToolbarDrag;
        panel.Controls.Add(elapsed);

        Button manual = MakeToolbarButton("화면 캡처", 258, 14, 84);
        manual.Name = "ManualButton";
        toolTip.SetToolTip(manual, "현재 화면을 즉시 한 장 캡처합니다.");
        panel.Controls.Add(manual);

        Button blur = MakeToolbarButton("민감정보", 348, 14, 84);
        blur.Name = "BlurButton";
        toolTip.SetToolTip(blur, "다음 캡처에서 클릭 주변을 픽셀 블러 처리합니다.");
        panel.Controls.Add(blur);

        Button undo = MakeToolbarButton("실행 취소", 438, 14, 84);
        undo.Name = "UndoButton";
        toolTip.SetToolTip(undo, "가장 최근 캡처를 삭제합니다.");
        panel.Controls.Add(undo);

        Button pause = MakeToolbarButton("일시정지", 528, 14, 96);
        pause.Name = "PauseButton";
        toolTip.SetToolTip(pause, "자동 캡처를 잠시 멈추거나 다시 시작합니다.");
        panel.Controls.Add(pause);

        Button preview = MakeToolbarButton("미리보기", 630, 14, 92);
        preview.Name = "PreviewButton";
        toolTip.SetToolTip(preview, "지금까지 캡처된 화면과 단계 목록을 확인합니다.");
        panel.Controls.Add(preview);

        Button complete = MakeToolbarButton("매뉴얼 만들기", 728, 14, 132);
        complete.Name = "CompleteButton";
        ((RoundedButton)complete).SetColors(Color.FromArgb(0, 151, 136), Color.White, Color.FromArgb(0, 178, 160));
        toolTip.SetToolTip(complete, "세션을 완료하고 Parro에서 매뉴얼을 생성합니다.");
        panel.Controls.Add(complete);

        Button stop = MakeToolbarButton("종료", 866, 14, 72);
        stop.Name = "ToolbarStopButton";
        stop.ForeColor = Color.FromArgb(255, 174, 183);
        toolTip.SetToolTip(stop, "세션을 중지하고 Parro 기본 창으로 돌아갑니다.");
        panel.Controls.Add(stop);

        Label drag = new Label();
        drag.Text = "···";
        drag.Location = new Point(940, 19);
        drag.Size = new Size(20, 25);
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
        RoundedButton button = new RoundedButton(text, 12, Color.White, Color.FromArgb(36, 70, 62), Color.FromArgb(196, 214, 209));
        button.Location = new Point(x, y);
        button.Size = new Size(width, 46);
        button.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        return button;
    }

    private static Button MakeToolbarButton(string text, int x, int y, int width)
    {
        RoundedButton button = new RoundedButton(text, 10, Color.FromArgb(19, 57, 49), Color.FromArgb(224, 242, 237), Color.FromArgb(45, 86, 76));
        button.Location = new Point(x, y);
        button.Size = new Size(width, 40);
        button.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
        button.Cursor = Cursors.Hand;
        button.TabStop = false;
        return button;
    }

    private void PopulateDisplayPicker()
    {
        displayPicker.RefreshScreens();
        UpdateScopeButtons();
    }

    private void UpdateScopeButtons()
    {
        if (allScreensButton == null || displayPicker == null) return;
        bool all = displayPicker.SelectedTarget != null && displayPicker.SelectedTarget.Mode == "all";
        ((RoundedButton)allScreensButton).SetColors(
            all ? Color.FromArgb(7, 105, 95) : Color.FromArgb(239, 245, 243),
            all ? Color.White : Color.FromArgb(35, 70, 62),
            all ? Color.FromArgb(0, 132, 120) : Color.FromArgb(229, 239, 236));
    }

    private void SetRecordingDisplayMode(string mode)
    {
        recordingDisplayMode = mode == "mini" ? "mini" : "side";
        bool side = recordingDisplayMode == "side";
        ((RoundedButton)sidePanelModeButton).SetColors(side ? Color.FromArgb(7, 105, 95) : Color.FromArgb(239, 245, 243), side ? Color.White : Color.FromArgb(35, 70, 62), side ? Color.FromArgb(0, 132, 120) : Color.FromArgb(229, 239, 236));
        ((RoundedButton)miniToolbarModeButton).SetColors(!side ? Color.FromArgb(7, 105, 95) : Color.FromArgb(239, 245, 243), !side ? Color.White : Color.FromArgb(35, 70, 62), !side ? Color.FromArgb(0, 132, 120) : Color.FromArgb(229, 239, 236));
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
            CaptureTargetOption target = displayPicker.SelectedTarget;
            if (target == null) throw new InvalidOperationException("캡처 범위를 선택해 주세요.");
            captureTargetLabel = target.Label;
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

            using (CountdownForm countdown = new CountdownForm(target.Screen ?? Screen.PrimaryScreen))
            {
                countdown.ShowDialog(this);
            }

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
                " -ToolbarBoundsFile \"" + toolbarBoundsFile + "\"" +
                " -OwnerProcessId " + Process.GetCurrentProcess().Id +
                " -CaptureMode \"" + target.Mode + "\"" +
                (target.Mode == "monitor"
                    ? " -CaptureLeft " + target.Screen.Bounds.Left +
                      " -CaptureTop " + target.Screen.Bounds.Top +
                      " -CaptureWidth " + target.Screen.Bounds.Width +
                      " -CaptureHeight " + target.Screen.Bounds.Height
                    : "");
            start.WorkingDirectory = installDirectory;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            captureProcess = Process.Start(start);
            if (captureProcess == null) throw new InvalidOperationException("캡처 프로세스를 시작하지 못했습니다.");

            captureStartedAt = DateTime.UtcNow;
            paused = false;
            blurNext = false;
            capturedStepCount = 0;
            completeButton.Enabled = false;
            statusLabel.Text = "기록 중 · " + captureTargetLabel;
            pathLabel.Text = outputDirectory;
            startButton.Enabled = false;
            stopButton.Enabled = true;
            openButton.Enabled = true;
            EnterToolbarMode(target.Screen ?? Screen.PrimaryScreen, target.Mode);
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
            ((RoundedButton)blurButton).SetColors(Color.FromArgb(0, 112, 103), Color.White, Color.FromArgb(0, 141, 127));
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

    private void TogglePreview()
    {
        if (!toolbarMode) return;
        ShowSidePanel();
    }

    private void PositionPreviewPanel()
    {
        if (!toolbarMode || !previewForm.Visible) return;
        Screen screen = recordingUiScreen ?? captureTargetScreen ?? Screen.PrimaryScreen;
        previewForm.PositionOnScreen(screen);
    }

    private void TogglePause()
    {
        if (String.IsNullOrWhiteSpace(pauseFile)) return;
        paused = !paused;
        if (paused)
        {
            WriteCommand(pauseFile, "paused");
            pauseButton.Text = "다시 시작";
            ((RoundedButton)pauseButton).SetColors(Color.FromArgb(122, 83, 24), Color.FromArgb(255, 240, 205), Color.FromArgb(148, 99, 28));
            recordButton.Text = "일시정지";
            toolbarStatusLabel.Text = "일시정지";
            manualButton.Enabled = false;
        }
        else
        {
            TryDelete(pauseFile);
            pauseButton.Text = "일시정지";
            ((RoundedButton)pauseButton).SetColors(Color.FromArgb(19, 57, 49), Color.FromArgb(224, 242, 237), Color.FromArgb(45, 86, 76));
            recordButton.Text = "녹화 중";
            toolbarStatusLabel.Text = "기록 중";
            manualButton.Enabled = true;
        }
    }

    private void CompleteCapture()
    {
        if (capturedStepCount <= 0)
        {
            toolbarStatusLabel.Text = "먼저 한 단계를 캡처해 주세요";
            return;
        }
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
            string url = "https://parro-guide-dev.vercel.app/desktop-import?source=desktop-app&session=" +
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

        if (captureProcess != null)
        {
            try
            {
                if (!captureProcess.HasExited && !captureProcess.WaitForExit(5000))
                {
                    captureProcess.Kill();
                    captureProcess.WaitForExit(2000);
                }
            }
            catch (Exception exception) { Log(exception); }
            finally { captureProcess.Dispose(); }
        }

        elapsedTimer.Stop();
        previewForm.Hide();
        trayIcon.Visible = false;
        previewButton.Text = "미리보기";
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
        capturedStepCount = 0;
    }

    private void EnterToolbarMode(Screen targetScreen, string targetMode)
    {
        toolbarMode = true;
        captureTargetScreen = targetScreen ?? Screen.PrimaryScreen;
        recordingUiScreen = FindRecordingUiScreen(captureTargetScreen, targetMode);
        hasSafeRecordingUiScreen = recordingUiScreen != null;
        recordingUiHiddenForCapture = !hasSafeRecordingUiScreen;
        mainPanel.Visible = false;
        toolbarPanel.Visible = false;
        FormBorderStyle = FormBorderStyle.None;
        ClientSize = new Size(960, 68);
        MinimumSize = Size.Empty;
        MaximumSize = Size.Empty;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.FromArgb(7, 36, 31);
        Screen screen = recordingUiScreen ?? captureTargetScreen;
        Left = screen.WorkingArea.Left + (screen.WorkingArea.Width - Width) / 2;
        Top = screen.WorkingArea.Top + 14;
        elapsedLabel.Text = "00:00";
        toolbarStatusLabel.Text = "기록 중";
        elapsedTimer.Start();
        trayIcon.Visible = true;
        ApplyCaptureExclusion();
        if (recordingUiHiddenForCapture)
        {
            HideRecordingUi();
            trayIcon.BalloonTipTitle = "Parro가 화면 밖에서 기록 중입니다";
            trayIcon.BalloonTipText = "패널은 캡처에 방해되지 않도록 숨겼습니다. 알림 영역의 Parro 아이콘을 두 번 누르면 다시 열 수 있습니다.";
            trayIcon.ShowBalloonTip(5000);
        }
        else if (recordingDisplayMode == "side") ShowSidePanel();
        else ShowMiniToolbar();
        WriteToolbarBounds();
    }

    private Screen FindRecordingUiScreen(Screen targetScreen, string targetMode)
    {
        Screen[] screens = Screen.AllScreens;
        if (!String.Equals(targetMode, "monitor", StringComparison.OrdinalIgnoreCase) || screens.Length <= 1) return null;
        int targetIndex = Array.FindIndex(screens, delegate(Screen screen) { return String.Equals(screen.DeviceName, targetScreen.DeviceName, StringComparison.OrdinalIgnoreCase); });
        if (targetIndex < 0) return null;
        Rectangle[] bounds = Array.ConvertAll(screens, delegate(Screen screen) { return screen.Bounds; });
        int companionIndex = ChooseCompanionScreenIndex(bounds, targetIndex, false);
        return companionIndex >= 0 ? screens[companionIndex] : null;
    }

    internal static int ChooseCompanionScreenIndex(Rectangle[] screens, int targetIndex, bool captureAll)
    {
        if (captureAll || screens == null || screens.Length <= 1 || targetIndex < 0 || targetIndex >= screens.Length) return -1;
        Rectangle target = screens[targetIndex];
        long bestDistance = Int64.MaxValue;
        int bestIndex = -1;
        for (int index = 0; index < screens.Length; index++)
        {
            if (index == targetIndex) continue;
            long dx = (screens[index].Left + screens[index].Width / 2L) - (target.Left + target.Width / 2L);
            long dy = (screens[index].Top + screens[index].Height / 2L) - (target.Top + target.Height / 2L);
            long distance = (dx * dx) + (dy * dy);
            if (distance < bestDistance)
            {
                bestDistance = distance;
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    private void HideRecordingUi()
    {
        previewForm.Hide();
        toolbarPanel.Visible = false;
        ClientSize = new Size(2, 2);
        Rectangle virtualBounds = SystemInformation.VirtualScreen;
        Left = virtualBounds.Right + 20;
        Top = virtualBounds.Bottom + 20;
        WriteToolbarBounds();
    }

    private void RestoreRecordingUi()
    {
        if (!toolbarMode) return;
        if (recordingUiScreen == null) recordingUiScreen = captureTargetScreen ?? Screen.PrimaryScreen;
        recordingUiHiddenForCapture = false;
        ShowSidePanel();
    }

    private void ShowSidePanel()
    {
        if (!toolbarMode) return;
        recordingDisplayMode = "side";
        toolbarPanel.Visible = false;
        ClientSize = new Size(2, 2);
        Screen screen = recordingUiScreen ?? captureTargetScreen ?? Screen.PrimaryScreen;
        Left = screen.WorkingArea.Right + 4;
        Top = screen.WorkingArea.Top;
        previewForm.SetSession(outputDirectory);
        previewForm.SetRecordingState(captureTargetLabel, "00:00", capturedStepCount, paused, blurNext);
        if (!previewForm.Visible) previewForm.Show(this);
        PositionPreviewPanel();
        previewButton.Text = "사이드 패널";
        WriteToolbarBounds();
    }

    private void ShowMiniToolbar()
    {
        if (!toolbarMode) return;
        if (!hasSafeRecordingUiScreen)
        {
            recordingDisplayMode = "mini";
            HideRecordingUi();
            return;
        }
        recordingDisplayMode = "mini";
        previewForm.Hide();
        toolbarPanel.Visible = true;
        ClientSize = new Size(960, 68);
        Screen screen = recordingUiScreen ?? captureTargetScreen ?? Screen.PrimaryScreen;
        Left = screen.WorkingArea.Left + (screen.WorkingArea.Width - Width) / 2;
        Top = screen.WorkingArea.Bottom - Height - 18;
        previewButton.Text = "사이드 패널";
        ApplyCaptureExclusion();
        WriteToolbarBounds();
    }

    private void ExitToolbarMode()
    {
        try { if (IsHandleCreated) SetWindowDisplayAffinity(Handle, WdaNone); } catch { }
        toolbarMode = false;
        captureTargetScreen = null;
        recordingUiScreen = null;
        recordingUiHiddenForCapture = false;
        hasSafeRecordingUiScreen = false;
        TopMost = false;
        ShowInTaskbar = true;
        toolbarPanel.Visible = false;
        mainPanel.Visible = true;
        FormBorderStyle = FormBorderStyle.None;
        ClientSize = new Size(1040, 720);
        StartPosition = FormStartPosition.Manual;
        CenterToScreen();
        ResetBlurButton();
        pauseButton.Text = "일시정지";
        ((RoundedButton)pauseButton).SetColors(Color.FromArgb(19, 57, 49), Color.FromArgb(224, 242, 237), Color.FromArgb(45, 86, 76));
        recordButton.Text = "녹화 중";
        manualButton.Enabled = true;
        previewButton.Text = "사이드 패널";
        completeButton.Enabled = true;
        PopulateDisplayPicker();
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
        string elapsedText = elapsed.TotalHours >= 1
            ? elapsed.ToString(@"hh\:mm\:ss")
            : elapsed.ToString(@"mm\:ss");
        elapsedLabel.Text = elapsedText;
        previewForm.SetRecordingState(captureTargetLabel, elapsedText, capturedStepCount, paused, blurNext);

        if (blurNext && !String.IsNullOrWhiteSpace(blurNextFile) && !File.Exists(blurNextFile))
        {
            blurNext = false;
            ResetBlurButton();
            toolbarStatusLabel.Text = paused ? "일시정지" : "기록 중";
        }
        RefreshCaptureProgress();
        WriteToolbarBounds();
    }

    private void RefreshCaptureProgress()
    {
        if (String.IsNullOrWhiteSpace(outputDirectory) || !Directory.Exists(outputDirectory)) return;
        string[] files;
        try
        {
            files = Directory.GetFiles(outputDirectory, "step-*.png", SearchOption.TopDirectoryOnly);
            Array.Sort(files, StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception exception)
        {
            Log(exception);
            return;
        }

        if (files.Length != capturedStepCount)
        {
            capturedStepCount = files.Length;
            completeButton.Enabled = capturedStepCount > 0;
            if (!paused && !blurNext)
            {
                toolbarStatusLabel.Text = capturedStepCount == 0 ? "기록 중" : capturedStepCount + "개 기록";
            }
            recordButton.Text = paused
                ? "일시정지"
                : capturedStepCount == 0 ? "녹화 중" : capturedStepCount + "단계";
        }
        if (previewForm.Visible) previewForm.RefreshSession(files);
    }

    private void ResetBlurButton()
    {
        if (blurButton == null) return;
        ((RoundedButton)blurButton).SetColors(Color.FromArgb(19, 57, 49), Color.FromArgb(224, 242, 237), Color.FromArgb(45, 86, 76));
    }

    private void WriteToolbarBounds()
    {
        if (!toolbarMode || String.IsNullOrWhiteSpace(toolbarBoundsFile)) return;
        try
        {
            StringBuilder json = new StringBuilder();
            json.Append("{\"regions\":[");
            bool hasRegion = false;
            if (toolbarPanel.Visible)
            {
                json.Append("{\"left\":").Append(Left)
                    .Append(",\"top\":").Append(Top)
                    .Append(",\"right\":").Append(Right)
                    .Append(",\"bottom\":").Append(Bottom).Append("}");
                hasRegion = true;
            }
            if (previewForm != null && previewForm.Visible)
            {
                if (hasRegion) json.Append(",");
                json.Append("{\"left\":").Append(previewForm.Left)
                    .Append(",\"top\":").Append(previewForm.Top)
                    .Append(",\"right\":").Append(previewForm.Right)
                    .Append(",\"bottom\":").Append(previewForm.Bottom).Append("}");
            }
            json.Append("]}");
            File.WriteAllText(toolbarBoundsFile, json.ToString(), new UTF8Encoding(false));
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

    internal void PrepareToolbarPreview()
    {
        toolbarMode = true;
        mainPanel.Visible = false;
        toolbarPanel.Visible = true;
        FormBorderStyle = FormBorderStyle.None;
        ClientSize = new Size(960, 68);
        ShowInTaskbar = false;
        BackColor = Color.FromArgb(7, 36, 31);
        toolbarStatusLabel.Text = "기록 중";
        elapsedLabel.Text = "02:18";
        recordButton.Text = "7단계";
        completeButton.Enabled = true;
        ApplyWindowShape();
    }

    private void BeginWindowDrag(object sender, MouseEventArgs eventArgs)
    {
        if (toolbarMode || eventArgs.Button != MouseButtons.Left) return;
        ReleaseCapture();
        SendMessage(Handle, WmNclButtonDown, new IntPtr(HtCaption), IntPtr.Zero);
    }

    private void ApplyWindowShape()
    {
        if (Width <= 0 || Height <= 0) return;
        IntPtr handle = CreateRoundRectRgn(0, 0, Width + 1, Height + 1, toolbarMode ? 20 : 26, toolbarMode ? 20 : 26);
        if (handle == IntPtr.Zero) return;
        Region previous = Region;
        Region = Region.FromHrgn(handle);
        DeleteObject(handle);
        if (previous != null) previous.Dispose();
    }

    protected override CreateParams CreateParams
    {
        get
        {
            const int CsDropShadow = 0x00020000;
            CreateParams parameters = base.CreateParams;
            parameters.ClassStyle |= CsDropShadow;
            return parameters;
        }
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
        trayIcon.Visible = false;
        trayIcon.Dispose();
        previewForm.Dispose();
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

internal sealed class RoundedPanel : Panel
{
    private readonly int radius;
    private readonly Color fillColor;
    private readonly Color borderColor;

    internal RoundedPanel(int cornerRadius, Color fill, Color border)
    {
        radius = cornerRadius;
        fillColor = fill;
        borderColor = border;
        DoubleBuffered = true;
        BackColor = Color.Transparent;
        SetStyle(ControlStyles.ResizeRedraw | ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint, true);
    }

    protected override void OnPaintBackground(PaintEventArgs eventArgs)
    {
        eventArgs.Graphics.Clear(Parent == null ? Color.Transparent : Parent.BackColor);
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        base.OnPaint(eventArgs);
        eventArgs.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        Rectangle bounds = new Rectangle(0, 0, Math.Max(1, Width - 1), Math.Max(1, Height - 1));
        using (System.Drawing.Drawing2D.GraphicsPath path = RoundedGeometry.CreatePath(bounds, radius))
        using (SolidBrush brush = new SolidBrush(fillColor))
        {
            eventArgs.Graphics.FillPath(brush, path);
            if (borderColor.A > 0)
            {
                using (Pen pen = new Pen(borderColor)) eventArgs.Graphics.DrawPath(pen, path);
            }
        }
    }
}

internal sealed class RoundedButton : Button
{
    private readonly int radius;
    private Color fillColor;
    private Color textColor;
    private Color hoverColor;
    private Color borderColor;
    private bool hovered;

    internal RoundedButton(string text, int cornerRadius, Color fill, Color foreground, Color border)
    {
        Text = text;
        radius = cornerRadius;
        fillColor = fill;
        textColor = foreground;
        hoverColor = Blend(fill, Color.White, 0.08F);
        borderColor = border;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        UseVisualStyleBackColor = false;
        TabStop = true;
        Cursor = Cursors.Hand;
        SetStyle(ControlStyles.ResizeRedraw | ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
    }

    internal void SetColors(Color fill, Color foreground, Color hover)
    {
        fillColor = fill;
        textColor = foreground;
        hoverColor = hover;
        borderColor = fill;
        Invalidate();
    }

    protected override void OnMouseEnter(EventArgs eventArgs)
    {
        hovered = true;
        Invalidate();
        base.OnMouseEnter(eventArgs);
    }

    protected override void OnMouseLeave(EventArgs eventArgs)
    {
        hovered = false;
        Invalidate();
        base.OnMouseLeave(eventArgs);
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        eventArgs.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        Rectangle bounds = new Rectangle(0, 0, Math.Max(1, Width - 1), Math.Max(1, Height - 1));
        Color actualFill = Enabled ? (hovered ? hoverColor : fillColor) : Color.FromArgb(231, 237, 235);
        Color actualText = Enabled ? textColor : Color.FromArgb(145, 160, 156);
        Color actualBorder = Enabled ? borderColor : Color.FromArgb(215, 225, 222);
        using (System.Drawing.Drawing2D.GraphicsPath path = RoundedGeometry.CreatePath(bounds, radius))
        using (SolidBrush brush = new SolidBrush(actualFill))
        using (Pen pen = new Pen(actualBorder))
        {
            eventArgs.Graphics.FillPath(brush, path);
            if (actualBorder.A > 0) eventArgs.Graphics.DrawPath(pen, path);
        }
        TextRenderer.DrawText(
            eventArgs.Graphics,
            Text,
            Font,
            bounds,
            actualText,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        if (Focused && ShowFocusCues)
        {
            Rectangle focus = Rectangle.Inflate(bounds, -4, -4);
            ControlPaint.DrawFocusRectangle(eventArgs.Graphics, focus, actualText, actualFill);
        }
    }

    private static Color Blend(Color first, Color second, float amount)
    {
        return Color.FromArgb(
            255,
            (int)(first.R + ((second.R - first.R) * amount)),
            (int)(first.G + ((second.G - first.G) * amount)),
            (int)(first.B + ((second.B - first.B) * amount)));
    }
}

internal enum WindowControlKind
{
    Minimize,
    Close
}

internal sealed class WindowControlButton : Button
{
    private readonly WindowControlKind kind;
    private bool hovered;

    internal WindowControlButton(WindowControlKind controlKind)
    {
        kind = controlKind;
        Text = String.Empty;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        BackColor = Color.Transparent;
        UseVisualStyleBackColor = false;
        TabStop = false;
        Cursor = Cursors.Hand;
        SetStyle(ControlStyles.ResizeRedraw | ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
    }

    protected override void OnMouseEnter(EventArgs eventArgs)
    {
        hovered = true;
        Invalidate();
        base.OnMouseEnter(eventArgs);
    }

    protected override void OnMouseLeave(EventArgs eventArgs)
    {
        hovered = false;
        Invalidate();
        base.OnMouseLeave(eventArgs);
    }

    protected override void OnPaintBackground(PaintEventArgs eventArgs)
    {
        eventArgs.Graphics.Clear(Parent == null ? Color.Transparent : Parent.BackColor);
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        eventArgs.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        Rectangle bounds = new Rectangle(0, 0, Math.Max(1, Width - 1), Math.Max(1, Height - 1));
        Color fill = hovered
            ? (kind == WindowControlKind.Close ? Color.FromArgb(255, 237, 238) : Color.FromArgb(230, 241, 238))
            : Color.Transparent;
        Color stroke = hovered && kind == WindowControlKind.Close
            ? Color.FromArgb(185, 28, 28)
            : Color.FromArgb(16, 78, 68);

        if (hovered)
        {
            using (System.Drawing.Drawing2D.GraphicsPath path = RoundedGeometry.CreatePath(bounds, 12))
            using (SolidBrush brush = new SolidBrush(fill))
            {
                eventArgs.Graphics.FillPath(brush, path);
            }
        }

        using (Pen pen = new Pen(stroke, 1.8F))
        {
            pen.StartCap = System.Drawing.Drawing2D.LineCap.Round;
            pen.EndCap = System.Drawing.Drawing2D.LineCap.Round;
            if (kind == WindowControlKind.Minimize)
            {
                int y = bounds.Top + (bounds.Height / 2) + 5;
                eventArgs.Graphics.DrawLine(pen, bounds.Left + 11, y, bounds.Right - 11, y);
            }
            else
            {
                eventArgs.Graphics.DrawLine(pen, bounds.Left + 12, bounds.Top + 12, bounds.Right - 12, bounds.Bottom - 12);
                eventArgs.Graphics.DrawLine(pen, bounds.Right - 12, bounds.Top + 12, bounds.Left + 12, bounds.Bottom - 12);
            }
        }
    }
}

internal sealed class MonitorTopologyControl : Control
{
    private readonly List<CaptureTargetOption> targets = new List<CaptureTargetOption>();
    private readonly List<Rectangle> hitAreas = new List<Rectangle>();
    private readonly Dictionary<string, Bitmap> thumbnails = new Dictionary<string, Bitmap>();
    private CaptureTargetOption selectedTarget;

    internal event EventHandler SelectionChanged;
    internal CaptureTargetOption SelectedTarget { get { return selectedTarget; } }

    internal MonitorTopologyControl()
    {
        BackColor = Color.White;
        Cursor = Cursors.Hand;
        TabStop = true;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
    }

    internal void RefreshScreens()
    {
        foreach (Bitmap bitmap in thumbnails.Values) bitmap.Dispose();
        thumbnails.Clear();
        targets.Clear();
        Screen[] screens = Screen.AllScreens;
        Screen primary = Screen.PrimaryScreen;
        for (int index = 0; index < screens.Length; index++)
        {
            Screen screen = screens[index];
            targets.Add(new CaptureTargetOption
            {
                Mode = screens.Length == 1 ? "auto" : "monitor",
                Label = BuildMonitorLabel(screen, index + 1, primary),
                Screen = screen,
            });
            thumbnails[screen.DeviceName] = CaptureThumbnail(screen);
        }
        if (targets.Count > 1)
        {
            selectedTarget = new CaptureTargetOption
            {
                Mode = "all",
                Label = "모든 화면 자동 · " + targets.Count + "개 모니터",
                Screen = Screen.PrimaryScreen,
            };
        }
        else
        {
            selectedTarget = targets.Find(delegate(CaptureTargetOption item) { return item.Screen != null && item.Screen.Primary; });
            if (selectedTarget == null && targets.Count > 0) selectedTarget = targets[0];
        }
        Invalidate();
    }

    internal void SelectAllScreens()
    {
        if (targets.Count <= 1) return;
        selectedTarget = new CaptureTargetOption
        {
            Mode = "all",
            Label = "모든 화면 자동 · " + targets.Count + "개 모니터",
            Screen = Screen.PrimaryScreen,
        };

        Invalidate();
        if (SelectionChanged != null) SelectionChanged(this, EventArgs.Empty);
    }

    internal static string VerifySyntheticLayouts()
    {
        Rectangle primary = new Rectangle(0, 0, 1920, 1080);
        Rectangle above = new Rectangle(0, -1200, 1920, 1200);
        Rectangle left = new Rectangle(-1600, 120, 1600, 900);
        Rectangle triple = Rectangle.Union(Rectangle.Union(primary, above), left);
        Rectangle canvas = new Rectangle(0, 0, 900, 420);
        Rectangle mappedPrimary = MapBounds(primary, triple, canvas);
        Rectangle mappedAbove = MapBounds(above, triple, canvas);
        Rectangle mappedLeft = MapBounds(left, triple, canvas);
        bool vertical = mappedAbove.Bottom <= mappedPrimary.Top + 2;
        bool threeScreens = mappedLeft.Right <= mappedPrimary.Left + 2 && mappedAbove.Left >= mappedPrimary.Left - 2;
        Rectangle[] pair = new Rectangle[] { new Rectangle(0, 0, 1920, 1080), new Rectangle(1920, 0, 1920, 1080) };
        bool leftCaptureMovesRight = CaptureForm.ChooseCompanionScreenIndex(pair, 0, false) == 1;
        bool rightCaptureMovesLeft = CaptureForm.ChooseCompanionScreenIndex(pair, 1, false) == 0;
        bool singleMonitorHides = CaptureForm.ChooseCompanionScreenIndex(new Rectangle[] { primary }, 0, false) == -1;
        bool allScreensHides = CaptureForm.ChooseCompanionScreenIndex(pair, 0, true) == -1;
        return "{\"vertical\":" + vertical.ToString().ToLowerInvariant() +
            ",\"threeScreens\":" + threeScreens.ToString().ToLowerInvariant() +
            ",\"allScreens\":true" +
            ",\"leftCaptureMovesRight\":" + leftCaptureMovesRight.ToString().ToLowerInvariant() +
            ",\"rightCaptureMovesLeft\":" + rightCaptureMovesLeft.ToString().ToLowerInvariant() +
            ",\"singleMonitorHides\":" + singleMonitorHides.ToString().ToLowerInvariant() +
            ",\"allScreensHides\":" + allScreensHides.ToString().ToLowerInvariant() + "}";
    }

    private static Rectangle MapBounds(Rectangle source, Rectangle virtualBounds, Rectangle canvas)
    {
        float scale = Math.Min((float)canvas.Width / virtualBounds.Width, (float)canvas.Height / virtualBounds.Height);
        int contentWidth = (int)(virtualBounds.Width * scale);
        int contentHeight = (int)(virtualBounds.Height * scale);
        int offsetX = canvas.Left + (canvas.Width - contentWidth) / 2;
        int offsetY = canvas.Top + (canvas.Height - contentHeight) / 2;
        return new Rectangle(
            offsetX + (int)((source.Left - virtualBounds.Left) * scale),
            offsetY + (int)((source.Top - virtualBounds.Top) * scale),
            Math.Max(1, (int)(source.Width * scale)),
            Math.Max(1, (int)(source.Height * scale)));
    }

    private static string BuildMonitorLabel(Screen screen, int number, Screen primary)
    {
        string prefix = "화면 " + number;
        if (screen.Primary) return prefix + " · 주 모니터";
        Point center = new Point(screen.Bounds.Left + screen.Bounds.Width / 2, screen.Bounds.Top + screen.Bounds.Height / 2);
        Point origin = new Point(primary.Bounds.Left + primary.Bounds.Width / 2, primary.Bounds.Top + primary.Bounds.Height / 2);
        int dx = center.X - origin.X;
        int dy = center.Y - origin.Y;
        string horizontal = Math.Abs(dx) > primary.Bounds.Width / 4 ? (dx < 0 ? "왼쪽" : "오른쪽") : String.Empty;
        string vertical = Math.Abs(dy) > primary.Bounds.Height / 4 ? (dy < 0 ? "위쪽" : "아래쪽") : String.Empty;
        string direction = horizontal.Length > 0 && vertical.Length > 0
            ? horizontal + " " + vertical
            : horizontal.Length > 0 ? horizontal : vertical.Length > 0 ? vertical : "보조 모니터";
        return prefix + " · " + direction;
    }

    private static Bitmap CaptureThumbnail(Screen screen)
    {
        Bitmap thumbnail = new Bitmap(360, 210);
        try
        {
            using (Bitmap source = new Bitmap(screen.Bounds.Width, screen.Bounds.Height))
            using (Graphics sourceGraphics = Graphics.FromImage(source))
            using (Graphics graphics = Graphics.FromImage(thumbnail))
            {
                sourceGraphics.CopyFromScreen(screen.Bounds.Location, Point.Empty, screen.Bounds.Size, CopyPixelOperation.SourceCopy);
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                graphics.DrawImage(source, new Rectangle(0, 0, thumbnail.Width, thumbnail.Height));
            }
        }
        catch
        {
            using (Graphics graphics = Graphics.FromImage(thumbnail))
            {
                graphics.Clear(Color.FromArgb(222, 233, 229));
                TextRenderer.DrawText(graphics, "화면 미리보기를 불러올 수 없습니다", new Font("Segoe UI", 9F), new Rectangle(12, 12, 336, 186), Color.FromArgb(82, 108, 101), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }
        }
        return thumbnail;
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        base.OnPaint(eventArgs);
        Graphics graphics = eventArgs.Graphics;
        graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        graphics.Clear(Color.FromArgb(229, 237, 234));
        hitAreas.Clear();
        if (targets.Count == 0) return;

        Rectangle virtualBounds = targets[0].Screen.Bounds;
        foreach (CaptureTargetOption target in targets) virtualBounds = Rectangle.Union(virtualBounds, target.Screen.Bounds);
        Rectangle canvas = new Rectangle(34, 28, Math.Max(1, Width - 68), Math.Max(1, Height - 56));
        foreach (CaptureTargetOption target in targets)
        {
            Rectangle source = target.Screen.Bounds;
            Rectangle card = MapBounds(source, virtualBounds, canvas);
            card = Rectangle.Intersect(card, new Rectangle(8, 8, Width - 16, Height - 16));
            hitAreas.Add(card);
            bool selected = selectedTarget != null && (selectedTarget.Mode == "all" || selectedTarget.Screen == target.Screen);
            using (System.Drawing.Drawing2D.GraphicsPath path = RoundedGeometry.CreatePath(card, 14))
            using (SolidBrush fill = new SolidBrush(Color.White))
            using (Pen border = new Pen(selected ? Color.FromArgb(0, 151, 136) : Color.FromArgb(174, 196, 190), selected ? 4F : 1.5F))
            {
                graphics.FillPath(fill, path);
                graphics.SetClip(path);
                Bitmap bitmap;
                if (thumbnails.TryGetValue(target.Screen.DeviceName, out bitmap)) graphics.DrawImage(bitmap, card);
                using (SolidBrush shade = new SolidBrush(Color.FromArgb(166, 5, 28, 24))) graphics.FillRectangle(shade, card.Left, card.Bottom - 44, card.Width, 44);
                graphics.ResetClip();
                graphics.DrawPath(border, path);
            }
            Rectangle labelBounds = new Rectangle(card.Left + 14, card.Bottom - 38, card.Width - 28, 20);
            TextRenderer.DrawText(graphics, target.Label, new Font("Segoe UI", 9F, FontStyle.Bold), labelBounds, Color.White, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
            Rectangle sizeBounds = new Rectangle(card.Left + 14, card.Bottom - 20, card.Width - 28, 16);
            TextRenderer.DrawText(graphics, source.Width + " × " + source.Height, new Font("Segoe UI", 7F), sizeBounds, Color.FromArgb(209, 232, 226), TextFormatFlags.Left | TextFormatFlags.VerticalCenter);
        }
    }

    protected override void OnMouseDown(MouseEventArgs eventArgs)
    {
        base.OnMouseDown(eventArgs);
        for (int index = hitAreas.Count - 1; index >= 0; index--)
        {
            if (!hitAreas[index].Contains(eventArgs.Location)) continue;
            selectedTarget = targets[index];
            Invalidate();
            if (SelectionChanged != null) SelectionChanged(this, EventArgs.Empty);
            break;
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            foreach (Bitmap bitmap in thumbnails.Values) bitmap.Dispose();
            thumbnails.Clear();
        }
        base.Dispose(disposing);
    }
}

internal sealed class ModernComboBox : ComboBox
{
    internal ModernComboBox()
    {
        DrawMode = DrawMode.OwnerDrawFixed;
        ItemHeight = 30;
        IntegralHeight = false;
        DropDownHeight = 220;
        Cursor = Cursors.Hand;
    }

    protected override void OnDrawItem(DrawItemEventArgs eventArgs)
    {
        if (eventArgs.Index < 0) return;
        bool selected = (eventArgs.State & DrawItemState.Selected) == DrawItemState.Selected;
        Color background = selected ? Color.FromArgb(229, 244, 239) : Color.White;
        Color foreground = selected ? Color.FromArgb(0, 105, 94) : Color.FromArgb(25, 62, 54);
        using (SolidBrush brush = new SolidBrush(background)) eventArgs.Graphics.FillRectangle(brush, eventArgs.Bounds);
        Rectangle textBounds = new Rectangle(eventArgs.Bounds.X + 10, eventArgs.Bounds.Y, eventArgs.Bounds.Width - 16, eventArgs.Bounds.Height);
        TextRenderer.DrawText(eventArgs.Graphics, GetItemText(Items[eventArgs.Index]), Font, textBounds, foreground,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        eventArgs.DrawFocusRectangle();
    }
}

internal static class RoundedGeometry
{
    internal static System.Drawing.Drawing2D.GraphicsPath CreatePath(Rectangle bounds, int radius)
    {
        int diameter = Math.Max(2, radius * 2);
        System.Drawing.Drawing2D.GraphicsPath path = new System.Drawing.Drawing2D.GraphicsPath();
        path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
        path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
        path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }
}

internal sealed class CountdownForm : Form
{
    private readonly Timer animationTimer;
    private readonly Stopwatch stopwatch;

    internal CountdownForm(Screen screen)
    {
        Text = "Parro 녹화 시작";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        Bounds = screen.Bounds;
        BackColor = Color.Black;
        Opacity = 0.82D;
        TopMost = true;
        ShowInTaskbar = false;
        KeyPreview = true;
        DoubleBuffered = true;
        AutoScaleMode = AutoScaleMode.Dpi;

        stopwatch = new Stopwatch();
        animationTimer = new Timer();
        animationTimer.Interval = 16;
        animationTimer.Tick += delegate
        {
            if (stopwatch.ElapsedMilliseconds >= 3300)
            {
                animationTimer.Stop();
                Close();
                return;
            }
            Invalidate();
        };
        Shown += delegate { stopwatch.Start(); animationTimer.Start(); };
        FormClosed += delegate { animationTimer.Dispose(); stopwatch.Stop(); };
    }

    protected override void OnPaint(PaintEventArgs eventArgs)
    {
        base.OnPaint(eventArgs);
        Graphics graphics = eventArgs.Graphics;
        graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        graphics.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;

        long elapsed = stopwatch.ElapsedMilliseconds;
        int stage = elapsed < 2550 ? (int)(elapsed / 850) : 3;
        long localElapsed = stage < 3 ? elapsed % 850 : elapsed - 2550;
        string text = stage == 0 ? "3" : stage == 1 ? "2" : stage == 2 ? "1" : "START";
        float progress = Math.Min(1F, localElapsed / 300F);
        float scale = 1.28F - (0.28F * progress);
        float baseSize = stage == 3 ? 56F : 96F;
        Color accent = stage == 3 ? Color.FromArgb(141, 214, 63) : Color.White;

        string caption = "화면 녹화가 시작됩니다";
        using (Font captionFont = new Font("Segoe UI", 13F, FontStyle.Bold))
        using (SolidBrush captionBrush = new SolidBrush(Color.FromArgb(235, 255, 255, 255)))
        using (SolidBrush badgeBrush = new SolidBrush(Color.FromArgb(55, 255, 255, 255)))
        using (SolidBrush dotBrush = new SolidBrush(Color.FromArgb(239, 68, 68)))
        {
            SizeF captionSize = graphics.MeasureString(caption, captionFont);
            RectangleF badge = new RectangleF(
                (ClientSize.Width - captionSize.Width) / 2F - 28F,
                (ClientSize.Height / 2F) - 112F,
                captionSize.Width + 56F,
                38F);
            graphics.FillRectangle(badgeBrush, badge);
            graphics.FillEllipse(dotBrush, badge.Left + 14F, badge.Top + 15F, 8F, 8F);
            graphics.DrawString(caption, captionFont, captionBrush, badge.Left + 30F, badge.Top + 9F);
        }

        using (Font numberFont = new Font("Segoe UI", baseSize * scale, FontStyle.Bold, GraphicsUnit.Pixel))
        using (SolidBrush numberBrush = new SolidBrush(accent))
        {
            SizeF numberSize = graphics.MeasureString(text, numberFont);
            graphics.DrawString(
                text,
                numberFont,
                numberBrush,
                (ClientSize.Width - numberSize.Width) / 2F,
                (ClientSize.Height - numberSize.Height) / 2F - 10F);
        }
    }
}

internal sealed class CapturePreviewForm : Form
{
    private const uint WdaMonitor = 0x00000001;
    private const uint WdaExcludeFromCapture = 0x00000011;
    private const int WmNclButtonDown = 0x00A1;
    private const int HtCaption = 0x0002;
    private const int HtBottomRight = 17;
    private const int DockHandleWidth = 26;

    [DllImport("user32.dll")]
    private static extern bool SetWindowDisplayAffinity(IntPtr window, uint affinity);

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

    private readonly Label countLabel;
    private readonly Label elapsedStateLabel;
    private readonly Label targetStateLabel;
    private readonly Label recordingStateLabel;
    private readonly FlowLayoutPanel stepList;
    private readonly Panel dockHandle;
    private readonly Panel zoomOverlay;
    private readonly PictureBox zoomImage;
    private readonly RoundedButton zoomBlurButton;
    private readonly Label zoomHintLabel;
    private readonly Timer dockAnimationTimer;
    private readonly Timer dockHoverTimer;
    private string sessionDirectory;
    private string lastSignature;
    private Screen dockScreen;
    private Rectangle lastFloatingBounds;
    private int dockTargetLeft;
    private bool isDocked;
    private bool isDockRevealed;
    private bool userPositioned;
    private DateTime lastDockHoverAt;
    private string zoomImagePath;
    private bool blurSelectionMode;
    private bool blurSelectionDragging;
    private Point blurSelectionStart;
    private Rectangle blurSelectionRectangle;

    internal event EventHandler ManualCaptureRequested;
    internal event EventHandler BlurRequested;
    internal event EventHandler UndoRequested;
    internal event EventHandler PauseRequested;
    internal event EventHandler CompleteRequested;
    internal event EventHandler StopRequested;
    internal event EventHandler DockRequested;
    internal event EventHandler BoundsChanged;

    internal CapturePreviewForm()
    {
        Text = "Parro 캡처 기록";
        ClientSize = new Size(410, 720);
        MinimumSize = new Size(380, 560);
        MaximumSize = new Size(620, 960);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.FromArgb(246, 249, 248);
        Font = new Font("Segoe UI", 9F);
        AutoScaleMode = AutoScaleMode.Dpi;

        Panel header = new Panel();
        header.Dock = DockStyle.Top;
        header.Height = 112;
        header.Padding = new Padding(20, 0, 14, 0);
        header.BackColor = Color.FromArgb(7, 36, 31);
        header.MouseDown += BeginPanelDrag;
        Controls.Add(header);

        Label title = new Label();
        title.Text = "Parro  ·  녹화 중";
        title.Location = new Point(20, 12);
        title.Size = new Size(150, 21);
        title.Font = new Font("Segoe UI", 11F, FontStyle.Bold);
        title.ForeColor = Color.White;
        title.MouseDown += BeginPanelDrag;
        header.Controls.Add(title);

        countLabel = new Label();
        countLabel.Text = "아직 캡처 없음";
        countLabel.Location = new Point(20, 74);
        countLabel.Size = new Size(160, 22);
        countLabel.Font = new Font("Segoe UI", 8F);
        countLabel.ForeColor = Color.FromArgb(184, 226, 218);
        header.Controls.Add(countLabel);

        recordingStateLabel = new Label();
        recordingStateLabel.Text = "●  기록 중";
        recordingStateLabel.Location = new Point(20, 39);
        recordingStateLabel.Size = new Size(106, 24);
        recordingStateLabel.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        recordingStateLabel.ForeColor = Color.FromArgb(255, 126, 137);
        header.Controls.Add(recordingStateLabel);

        elapsedStateLabel = new Label();
        elapsedStateLabel.Text = "00:00";
        elapsedStateLabel.Location = new Point(126, 39);
        elapsedStateLabel.Size = new Size(70, 24);
        elapsedStateLabel.Font = new Font("Consolas", 10F, FontStyle.Bold);
        elapsedStateLabel.ForeColor = Color.White;
        header.Controls.Add(elapsedStateLabel);

        targetStateLabel = new Label();
        targetStateLabel.Text = "화면 1";
        targetStateLabel.Location = new Point(194, 74);
        targetStateLabel.Size = new Size(148, 22);
        targetStateLabel.TextAlign = ContentAlignment.MiddleRight;
        targetStateLabel.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
        targetStateLabel.ForeColor = Color.FromArgb(137, 219, 204);
        header.Controls.Add(targetStateLabel);

        RoundedButton hide = new RoundedButton("›", 8, Color.FromArgb(19, 57, 49), Color.White, Color.FromArgb(34, 79, 69));
        hide.Location = new Point(360, 15);
        hide.Size = new Size(30, 30);
        hide.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        hide.Font = new Font("Segoe UI", 14F, FontStyle.Bold);
        hide.Cursor = Cursors.Hand;
        hide.Click += delegate { if (DockRequested != null) DockRequested(this, EventArgs.Empty); };
        header.Controls.Add(hide);

        Panel content = new Panel();
        content.Location = new Point(0, 112);
        content.Size = new Size(410, 486);
        content.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        content.Padding = new Padding(18);
        content.BackColor = BackColor;
        Controls.Add(content);

        Label sectionTitle = new Label();
        sectionTitle.Location = new Point(18, 12);
        sectionTitle.Size = new Size(240, 28);
        sectionTitle.Text = "캡처된 스텝";
        sectionTitle.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
        sectionTitle.ForeColor = Color.FromArgb(28, 53, 48);
        content.Controls.Add(sectionTitle);

        stepList = new FlowLayoutPanel();
        stepList.Location = new Point(18, 43);
        stepList.Size = new Size(374, 417);
        stepList.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        stepList.AutoScroll = true;
        stepList.WrapContents = false;
        stepList.FlowDirection = FlowDirection.TopDown;
        stepList.Padding = new Padding(0, 4, 0, 0);
        stepList.BackColor = BackColor;
        content.Controls.Add(stepList);

        Panel actions = new Panel();
        actions.Location = new Point(0, 598);
        actions.Size = new Size(410, 122);
        actions.Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        actions.Padding = new Padding(18, 10, 18, 14);
        actions.BackColor = Color.White;
        Controls.Add(actions);

        RoundedButton manual = MakeActionButton("화면 캡처", 18, 10, 96);
        RoundedButton blur = MakeActionButton("민감정보", 122, 10, 82);
        RoundedButton undo = MakeActionButton("실행 취소", 212, 10, 82);
        RoundedButton pause = MakeActionButton("일시정지", 302, 10, 90);
        RoundedButton complete = MakeActionButton("매뉴얼 만들기", 18, 64, 252);
        complete.SetColors(Color.FromArgb(0, 151, 136), Color.White, Color.FromArgb(0, 178, 160));
        RoundedButton stop = MakeActionButton("종료", 278, 64, 114);
        manual.Click += delegate { if (ManualCaptureRequested != null) ManualCaptureRequested(this, EventArgs.Empty); };
        blur.Click += delegate { if (BlurRequested != null) BlurRequested(this, EventArgs.Empty); };
        undo.Click += delegate { if (UndoRequested != null) UndoRequested(this, EventArgs.Empty); };
        pause.Click += delegate { if (PauseRequested != null) PauseRequested(this, EventArgs.Empty); };
        complete.Click += delegate { if (CompleteRequested != null) CompleteRequested(this, EventArgs.Empty); };
        stop.Click += delegate { if (StopRequested != null) StopRequested(this, EventArgs.Empty); };
        actions.Controls.Add(manual);
        actions.Controls.Add(blur);
        actions.Controls.Add(undo);
        actions.Controls.Add(pause);
        actions.Controls.Add(complete);
        actions.Controls.Add(stop);

        dockHandle = new Panel();
        dockHandle.Location = new Point(0, 0);
        dockHandle.Size = new Size(DockHandleWidth, ClientSize.Height);
        dockHandle.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left;
        dockHandle.BackColor = Color.FromArgb(0, 151, 136);
        dockHandle.Cursor = Cursors.Hand;
        dockHandle.Visible = false;
        dockHandle.MouseEnter += delegate { RevealDockedPanel(); };
        dockHandle.Click += delegate { UndockPanel(); };
        Controls.Add(dockHandle);

        Label dockMark = new Label();
        dockMark.Dock = DockStyle.Fill;
        dockMark.Text = "P\r\nA\r\nR\r\nR\r\nO\r\n‹";
        dockMark.TextAlign = ContentAlignment.MiddleCenter;
        dockMark.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
        dockMark.ForeColor = Color.White;
        dockMark.Cursor = Cursors.Hand;
        dockMark.MouseEnter += delegate { RevealDockedPanel(); };
        dockMark.Click += delegate { UndockPanel(); };
        dockHandle.Controls.Add(dockMark);

        Label resizeGrip = new Label();
        resizeGrip.Text = "◢";
        resizeGrip.Size = new Size(22, 22);
        resizeGrip.Location = new Point(ClientSize.Width - 24, ClientSize.Height - 24);
        resizeGrip.Anchor = AnchorStyles.Bottom | AnchorStyles.Right;
        resizeGrip.TextAlign = ContentAlignment.MiddleCenter;
        resizeGrip.ForeColor = Color.FromArgb(122, 151, 144);
        resizeGrip.BackColor = Color.White;
        resizeGrip.Cursor = Cursors.SizeNWSE;
        resizeGrip.MouseDown += BeginPanelResize;
        Controls.Add(resizeGrip);

        zoomOverlay = new Panel();
        zoomOverlay.Dock = DockStyle.Fill;
        zoomOverlay.BackColor = Color.FromArgb(20, 23, 28);
        zoomOverlay.Visible = false;
        zoomOverlay.Cursor = Cursors.Hand;
        zoomOverlay.Click += delegate { CloseZoom(); };
        Controls.Add(zoomOverlay);

        zoomImage = new PictureBox();
        zoomImage.Location = new Point(18, 58);
        zoomImage.Size = new Size(ClientSize.Width - 36, ClientSize.Height - 116);
        zoomImage.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        zoomImage.SizeMode = PictureBoxSizeMode.Zoom;
        zoomImage.Cursor = Cursors.Hand;
        zoomImage.MouseDown += BeginBlurSelection;
        zoomImage.MouseMove += UpdateBlurSelection;
        zoomImage.MouseUp += CompleteBlurSelection;
        zoomImage.Paint += PaintBlurSelection;
        zoomOverlay.Controls.Add(zoomImage);

        zoomBlurButton = new RoundedButton("영역 블러", 9, Color.FromArgb(48, 52, 60), Color.White, Color.FromArgb(0, 151, 136));
        zoomBlurButton.Location = new Point(18, 14);
        zoomBlurButton.Size = new Size(92, 34);
        zoomBlurButton.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
        zoomBlurButton.Cursor = Cursors.Hand;
        zoomBlurButton.Click += delegate { ToggleBlurSelectionMode(); };
        zoomOverlay.Controls.Add(zoomBlurButton);

        zoomHintLabel = new Label();
        zoomHintLabel.Location = new Point(118, 14);
        zoomHintLabel.Size = new Size(ClientSize.Width - 176, 34);
        zoomHintLabel.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        zoomHintLabel.Text = "미리보기";
        zoomHintLabel.TextAlign = ContentAlignment.MiddleLeft;
        zoomHintLabel.Font = new Font("Segoe UI", 8F);
        zoomHintLabel.ForeColor = Color.FromArgb(205, 211, 219);
        zoomHintLabel.BackColor = Color.Transparent;
        zoomOverlay.Controls.Add(zoomHintLabel);

        RoundedButton zoomClose = new RoundedButton("×", 9, Color.FromArgb(48, 52, 60), Color.White, Color.FromArgb(67, 73, 84));
        zoomClose.Location = new Point(ClientSize.Width - 48, 14);
        zoomClose.Size = new Size(34, 34);
        zoomClose.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        zoomClose.Font = new Font("Segoe UI", 12F, FontStyle.Bold);
        zoomClose.Click += delegate { CloseZoom(); };
        zoomOverlay.Controls.Add(zoomClose);

        dockAnimationTimer = new Timer();
        dockAnimationTimer.Interval = 15;
        dockAnimationTimer.Tick += AnimateDock;
        dockHoverTimer = new Timer();
        dockHoverTimer.Interval = 180;
        dockHoverTimer.Tick += WatchDockHover;

        HandleCreated += delegate { ApplyCaptureExclusion(); ApplyWindowShape(); };
        Shown += delegate { ApplyCaptureExclusion(); };
        LocationChanged += delegate { RaiseBoundsChanged(); };
        SizeChanged += delegate { ApplyWindowShape(); ReflowStepCards(); RaiseBoundsChanged(); };
        KeyPreview = true;
        KeyDown += delegate(object sender, KeyEventArgs eventArgs)
        {
            if (eventArgs.KeyCode != Keys.Escape) return;
            if (blurSelectionMode) CancelBlurSelection();
            else CloseZoom();
        };
    }

    internal static string VerifyBehavior()
    {
        string tempDirectory = Path.Combine(Path.GetTempPath(), "Parro", "panel-behavior-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDirectory);
        try
        {
            for (int index = 0; index < 3; index++)
            {
                using (Bitmap bitmap = new Bitmap(320, 180))
                using (Graphics graphics = Graphics.FromImage(bitmap))
                {
                    for (int y = 0; y < bitmap.Height; y++)
                    {
                        for (int x = 0; x < bitmap.Width; x++)
                        {
                            bitmap.SetPixel(x, y, Color.FromArgb((x * 3 + index * 17) % 255, (y * 5 + x) % 255, (x + y * 2) % 255));
                        }
                    }
                    graphics.DrawString("Step " + (index + 1), SystemFonts.DefaultFont, Brushes.Black, 20, 20);
                    bitmap.Save(Path.Combine(tempDirectory, "step-" + (index + 1).ToString("00") + ".png"), System.Drawing.Imaging.ImageFormat.Png);
                }
            }

            using (CapturePreviewForm form = new CapturePreviewForm())
            {
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new Point(-10000, -10000);
                form.CreateControl();
                string[] files = Directory.GetFiles(tempDirectory, "*.png");
                Array.Sort(files, StringComparer.OrdinalIgnoreCase);
                form.SetSession(tempDirectory);
                form.RefreshSession(files);
                if (form.stepList.Controls.Count != 3) throw new InvalidOperationException("Step cards did not render chronologically.");
                Label firstBadge = form.stepList.Controls[0].Controls[0] as Label;
                Label lastBadge = form.stepList.Controls[2].Controls[0] as Label;
                if (firstBadge == null || firstBadge.Text != "1" || lastBadge == null || lastBadge.Text != "3")
                    throw new InvalidOperationException("Step order is not oldest-to-newest.");

                PictureBox firstPreview = null;
                foreach (Control child in form.stepList.Controls[0].Controls)
                {
                    firstPreview = child as PictureBox;
                    if (firstPreview != null) break;
                }
                form.OpenThumbnailZoom(firstPreview, EventArgs.Empty);
                if (form.zoomImage.Image == null) throw new InvalidOperationException("Thumbnail zoom did not load the selected image.");
                string blurPath = files[0];
                if (!ApplyPixelBlur(blurPath, new RectangleF(0.20F, 0.20F, 0.35F, 0.35F)))
                    throw new InvalidOperationException("Area blur did not modify the selected capture.");
                form.RecordBlurEdit(blurPath, new RectangleF(0.20F, 0.20F, 0.35F, 0.35F));
                form.RecordBlurEdit(blurPath, new RectangleF(0.60F, 0.55F, 0.20F, 0.20F));
                using (Bitmap blurred = LoadFullImage(blurPath))
                {
                    Color firstPixel = blurred.GetPixel(64, 36);
                    Color blockPixel = blurred.GetPixel(65, 37);
                    if (firstPixel.ToArgb() != blockPixel.ToArgb()) throw new InvalidOperationException("Area blur was not pixelated in blocks.");
                }
                string[] blurEdits = File.ReadAllLines(Path.Combine(tempDirectory, "blur-edits.jsonl"));
                if (blurEdits.Length != 2) throw new InvalidOperationException("Repeated area blur metadata was not recorded.");
                form.CloseZoom();

                Screen screen = Screen.PrimaryScreen;
                form.DockToRight(screen);
                form.Left = screen.WorkingArea.Right - DockHandleWidth;
                if (!form.isDocked || form.dockTargetLeft != screen.WorkingArea.Right - DockHandleWidth || form.Left != screen.WorkingArea.Right - DockHandleWidth)
                    throw new InvalidOperationException("Right-edge dock did not retain its visible handle.");
                form.RevealDockedPanel();
                form.Left = screen.WorkingArea.Right - form.Width - 12;
                if (!form.isDockRevealed) throw new InvalidOperationException("Dock hover reveal did not open the panel.");
                form.UndockPanel();
                form.Size = new Size(480, 800);
                if (form.Size != new Size(480, 800)) throw new InvalidOperationException("Panel resizing is unavailable.");

                return "{\"ok\":true,\"steps\":3,\"order\":\"oldest-to-newest\",\"zoom\":true,\"area_blur\":true,\"repeated_area_blur\":true,\"dock_handle\":true,\"hover_reveal\":true,\"resizable\":true}";
            }
        }
        finally
        {
            try { Directory.Delete(tempDirectory, true); } catch { }
        }
    }

    internal void PrepareBlurPreview(string path)
    {
        PictureBox preview = new PictureBox();
        preview.Tag = path;
        OpenThumbnailZoom(preview, EventArgs.Empty);
        ToggleBlurSelectionMode();
        Rectangle imageRectangle = GetRenderedImageRectangle(zoomImage);
        blurSelectionRectangle = new Rectangle(
            imageRectangle.Left + imageRectangle.Width / 5,
            imageRectangle.Top + imageRectangle.Height / 4,
            imageRectangle.Width / 2,
            imageRectangle.Height / 4);
        zoomImage.Invalidate();
    }

    internal void DrawBlurPreviewToBitmap(Bitmap bitmap)
    {
        zoomOverlay.DrawToBitmap(bitmap, new Rectangle(Point.Empty, ClientSize));
    }

    private static RoundedButton MakeActionButton(string text, int x, int y, int width)
    {
        RoundedButton button = new RoundedButton(text, 10, Color.FromArgb(239, 245, 243), Color.FromArgb(30, 66, 58), Color.FromArgb(211, 225, 221));
        button.Location = new Point(x, y);
        button.Size = new Size(width, 44);
        button.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
        return button;
    }

    internal void SetRecordingState(string target, string elapsed, int count, bool paused, bool blurNext)
    {
        elapsedStateLabel.Text = elapsed;
        targetStateLabel.Text = target;
        countLabel.Text = count == 0 ? "아직 캡처 없음" : count + "개 단계 기록";
        recordingStateLabel.Text = paused ? "Ⅱ  일시정지" : blurNext ? "●  다음 캡처 보호" : "●  기록 중";
        recordingStateLabel.ForeColor = paused ? Color.FromArgb(255, 210, 126) : Color.FromArgb(255, 126, 137);
    }

    protected override bool ShowWithoutActivation
    {
        get { return true; }
    }

    protected override CreateParams CreateParams
    {
        get
        {
            const int WsExToolWindow = 0x00000080;
            CreateParams parameters = base.CreateParams;
            parameters.ExStyle |= WsExToolWindow;
            return parameters;
        }
    }

    internal void SetSession(string directory)
    {
        if (String.Equals(sessionDirectory, directory, StringComparison.OrdinalIgnoreCase)) return;
        sessionDirectory = directory;
        lastSignature = null;
        ClearPreview();
    }

    internal void RefreshSession(string[] files)
    {
        if (files == null) files = new string[0];
        string latest = files.Length == 0 ? String.Empty : files[files.Length - 1];
        long latestWrite = 0;
        try { if (latest.Length > 0) latestWrite = File.GetLastWriteTimeUtc(latest).Ticks; } catch { }
        string signature = files.Length + "|" + latest + "|" + latestWrite;
        if (String.Equals(lastSignature, signature, StringComparison.Ordinal)) return;

        try
        {
            RebuildPreview(files);
            lastSignature = signature;
        }
        catch
        {
            // The capture agent can still be flushing the newest PNG. The next
            // toolbar timer tick retries without interrupting the recording.
        }
    }

    private void RebuildPreview(string[] files)
    {
        int previousCount = stepList.Controls.Count;
        ClearControlImages(stepList);
        stepList.Controls.Clear();

        if (files.Length == 0)
        {
            countLabel.Text = "아직 캡처 없음";
            Label empty = new Label();
            empty.Width = Math.Max(240, stepList.ClientSize.Width - 12);
            empty.Height = 96;
            empty.Text = "대상 앱을 클릭하면\r\n캡처 스텝이 아래로 쌓입니다.";
            empty.TextAlign = ContentAlignment.MiddleCenter;
            empty.Font = new Font("Segoe UI", 9F);
            empty.ForeColor = Color.FromArgb(112, 132, 127);
            stepList.Controls.Add(empty);
            return;
        }

        countLabel.Text = files.Length + "개 단계가 기록되었습니다";
        int first = Math.Max(0, files.Length - 200);
        Control lastCard = null;
        for (int index = first; index < files.Length; index++)
        {
            RoundedPanel row = new RoundedPanel(10, Color.White, Color.FromArgb(214, 228, 224));
            int rowWidth = Math.Max(292, stepList.ClientSize.Width - 22);
            int imageWidth = rowWidth - 20;
            int imageHeight = Math.Max(112, Math.Min(210, (int)(imageWidth * 0.56F)));
            row.Width = rowWidth;
            row.Height = imageHeight + 64;
            row.Margin = new Padding(0, 0, 0, 8);

            Label badge = new Label();
            badge.Location = new Point(10, 10);
            badge.Size = new Size(24, 24);
            badge.Text = (index + 1).ToString();
            badge.TextAlign = ContentAlignment.MiddleCenter;
            badge.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
            badge.ForeColor = Color.White;
            badge.BackColor = Color.FromArgb(0, 151, 136);
            row.Controls.Add(badge);

            Label step = new Label();
            step.Text = "데스크톱 화면 캡처";
            step.Location = new Point(44, 8);
            step.Size = new Size(rowWidth - 58, 20);
            step.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
            step.ForeColor = Color.FromArgb(30, 42, 48);
            step.BackColor = Color.Transparent;
            row.Controls.Add(step);

            Label saved = new Label();
            DateTime savedAt;
            try { savedAt = File.GetLastWriteTime(files[index]); } catch { savedAt = DateTime.Now; }
            saved.Text = savedAt.ToString("HH:mm:ss") + "  ·  미리보기를 눌러 확대";
            saved.Location = new Point(44, 29);
            saved.Size = new Size(rowWidth - 58, 18);
            saved.Font = new Font("Segoe UI", 7.5F);
            saved.ForeColor = Color.FromArgb(120, 128, 140);
            saved.BackColor = Color.Transparent;
            row.Controls.Add(saved);

            PictureBox thumbnail = new PictureBox();
            thumbnail.Location = new Point(10, 52);
            thumbnail.Size = new Size(imageWidth, imageHeight);
            thumbnail.SizeMode = PictureBoxSizeMode.CenterImage;
            thumbnail.Image = LoadThumbnail(files[index], imageWidth, imageHeight);
            thumbnail.Cursor = Cursors.Hand;
            thumbnail.Tag = files[index];
            thumbnail.Click += OpenThumbnailZoom;
            row.Controls.Add(thumbnail);
            stepList.Controls.Add(row);
            lastCard = row;
        }
        if (files.Length > previousCount && lastCard != null && IsHandleCreated)
        {
            Control scrollTarget = lastCard;
            BeginInvoke(new MethodInvoker(delegate { stepList.ScrollControlIntoView(scrollTarget); }));
        }
    }

    private void ClearPreview()
    {
        ClearControlImages(stepList);
        stepList.Controls.Clear();
        countLabel.Text = "아직 캡처 없음";
    }

    private void OpenThumbnailZoom(object sender, EventArgs eventArgs)
    {
        PictureBox picture = sender as PictureBox;
        string path = picture == null ? null : picture.Tag as string;
        if (String.IsNullOrWhiteSpace(path) || !File.Exists(path)) return;
        zoomImagePath = path;
        CancelBlurSelection();
        ReplaceImage(zoomImage, LoadFullImage(path));
        zoomOverlay.Visible = true;
        zoomOverlay.BringToFront();
    }

    private void CloseZoom()
    {
        if (!zoomOverlay.Visible) return;
        CancelBlurSelection();
        zoomOverlay.Visible = false;
        ReplaceImage(zoomImage, null);
        zoomImagePath = null;
    }

    private void ToggleBlurSelectionMode()
    {
        if (String.IsNullOrWhiteSpace(zoomImagePath) || zoomImage.Image == null) return;
        if (blurSelectionMode)
        {
            CancelBlurSelection();
            return;
        }
        blurSelectionMode = true;
        blurSelectionRectangle = Rectangle.Empty;
        zoomImage.Cursor = Cursors.Cross;
        zoomHintLabel.Text = "드래그로 블러할 영역을 선택하세요 · Esc 취소";
        zoomBlurButton.SetColors(Color.FromArgb(0, 151, 136), Color.White, Color.FromArgb(0, 178, 160));
    }

    private void CancelBlurSelection()
    {
        blurSelectionMode = false;
        blurSelectionDragging = false;
        blurSelectionRectangle = Rectangle.Empty;
        if (zoomImage != null)
        {
            zoomImage.Cursor = Cursors.Hand;
            zoomImage.Invalidate();
        }
        if (zoomHintLabel != null) zoomHintLabel.Text = "미리보기";
        if (zoomBlurButton != null) zoomBlurButton.SetColors(Color.FromArgb(48, 52, 60), Color.White, Color.FromArgb(0, 151, 136));
    }

    private void BeginBlurSelection(object sender, MouseEventArgs eventArgs)
    {
        if (!blurSelectionMode || eventArgs.Button != MouseButtons.Left || zoomImage.Image == null) return;
        Rectangle imageRectangle = GetRenderedImageRectangle(zoomImage);
        if (!imageRectangle.Contains(eventArgs.Location)) return;
        blurSelectionDragging = true;
        blurSelectionStart = ClampPoint(eventArgs.Location, imageRectangle);
        blurSelectionRectangle = new Rectangle(blurSelectionStart, Size.Empty);
        zoomImage.Capture = true;
        zoomImage.Invalidate();
    }

    private void UpdateBlurSelection(object sender, MouseEventArgs eventArgs)
    {
        if (!blurSelectionDragging || zoomImage.Image == null) return;
        Rectangle imageRectangle = GetRenderedImageRectangle(zoomImage);
        Point current = ClampPoint(eventArgs.Location, imageRectangle);
        blurSelectionRectangle = Rectangle.FromLTRB(
            Math.Min(blurSelectionStart.X, current.X),
            Math.Min(blurSelectionStart.Y, current.Y),
            Math.Max(blurSelectionStart.X, current.X),
            Math.Max(blurSelectionStart.Y, current.Y));
        zoomImage.Invalidate();
    }

    private void CompleteBlurSelection(object sender, MouseEventArgs eventArgs)
    {
        if (!blurSelectionDragging || zoomImage.Image == null) return;
        UpdateBlurSelection(sender, eventArgs);
        blurSelectionDragging = false;
        zoomImage.Capture = false;
        Rectangle imageRectangle = GetRenderedImageRectangle(zoomImage);
        Rectangle selected = Rectangle.Intersect(imageRectangle, blurSelectionRectangle);
        if (selected.Width < 6 || selected.Height < 6)
        {
            zoomHintLabel.Text = "영역이 너무 작습니다. 다시 드래그하세요.";
            blurSelectionRectangle = Rectangle.Empty;
            zoomImage.Invalidate();
            return;
        }

        RectangleF normalized = new RectangleF(
            (float)(selected.Left - imageRectangle.Left) / imageRectangle.Width,
            (float)(selected.Top - imageRectangle.Top) / imageRectangle.Height,
            (float)selected.Width / imageRectangle.Width,
            (float)selected.Height / imageRectangle.Height);
        zoomHintLabel.Text = "블러 처리 중...";
        Application.DoEvents();
        try
        {
            ReplaceImage(zoomImage, null);
            if (!ApplyPixelBlur(zoomImagePath, normalized)) throw new InvalidOperationException("blur_failed");
            RecordBlurEdit(zoomImagePath, normalized);
            ReplaceImage(zoomImage, LoadFullImage(zoomImagePath));
            lastSignature = null;
            RefreshCurrentSession();
            blurSelectionMode = false;
            blurSelectionRectangle = Rectangle.Empty;
            zoomImage.Cursor = Cursors.Hand;
            zoomBlurButton.SetColors(Color.FromArgb(48, 52, 60), Color.White, Color.FromArgb(0, 151, 136));
            zoomHintLabel.Text = "블러 처리 완료 ✓";
        }
        catch
        {
            if (zoomImage.Image == null && File.Exists(zoomImagePath)) ReplaceImage(zoomImage, LoadFullImage(zoomImagePath));
            zoomHintLabel.Text = "블러 처리에 실패했습니다. 다시 시도하세요.";
        }
        zoomImage.Invalidate();
    }

    private void PaintBlurSelection(object sender, PaintEventArgs eventArgs)
    {
        if (!blurSelectionMode || blurSelectionRectangle.Width <= 0 || blurSelectionRectangle.Height <= 0) return;
        using (SolidBrush fill = new SolidBrush(Color.FromArgb(48, 0, 151, 136)))
        using (Pen border = new Pen(Color.FromArgb(0, 201, 180), 2F))
        {
            border.DashStyle = System.Drawing.Drawing2D.DashStyle.Dash;
            eventArgs.Graphics.FillRectangle(fill, blurSelectionRectangle);
            eventArgs.Graphics.DrawRectangle(border, blurSelectionRectangle);
        }
    }

    private void RefreshCurrentSession()
    {
        if (String.IsNullOrWhiteSpace(sessionDirectory) || !Directory.Exists(sessionDirectory)) return;
        string[] files = Directory.GetFiles(sessionDirectory, "step-*.png", SearchOption.TopDirectoryOnly);
        Array.Sort(files, StringComparer.OrdinalIgnoreCase);
        RebuildPreview(files);
        string latest = files.Length == 0 ? String.Empty : files[files.Length - 1];
        long latestWrite = latest.Length == 0 ? 0 : File.GetLastWriteTimeUtc(latest).Ticks;
        lastSignature = files.Length + "|" + latest + "|" + latestWrite;
        zoomOverlay.BringToFront();
    }

    private void RecordBlurEdit(string imagePath, RectangleF region)
    {
        if (String.IsNullOrWhiteSpace(sessionDirectory)) return;
        string editPath = Path.Combine(sessionDirectory, "blur-edits.jsonl");
        string line = "{\"screenshot_name\":\"" + JsonEscape(Path.GetFileName(imagePath)) +
            "\",\"region\":{\"x\":" + region.X.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture) +
            ",\"y\":" + region.Y.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture) +
            ",\"w\":" + region.Width.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture) +
            ",\"h\":" + region.Height.ToString("0.######", System.Globalization.CultureInfo.InvariantCulture) + "}}";
        File.AppendAllText(editPath, line + Environment.NewLine, new UTF8Encoding(false));
    }

    private static string JsonEscape(string value)
    {
        return (value ?? String.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"");
    }

    private static Rectangle GetRenderedImageRectangle(PictureBox picture)
    {
        if (picture.Image == null || picture.ClientSize.Width <= 0 || picture.ClientSize.Height <= 0) return Rectangle.Empty;
        float scale = Math.Min((float)picture.ClientSize.Width / picture.Image.Width, (float)picture.ClientSize.Height / picture.Image.Height);
        int width = Math.Max(1, (int)Math.Round(picture.Image.Width * scale));
        int height = Math.Max(1, (int)Math.Round(picture.Image.Height * scale));
        return new Rectangle((picture.ClientSize.Width - width) / 2, (picture.ClientSize.Height - height) / 2, width, height);
    }

    private static Point ClampPoint(Point point, Rectangle bounds)
    {
        return new Point(
            Math.Max(bounds.Left, Math.Min(bounds.Right, point.X)),
            Math.Max(bounds.Top, Math.Min(bounds.Bottom, point.Y)));
    }

    private static bool ApplyPixelBlur(string path, RectangleF normalizedRegion)
    {
        if (String.IsNullOrWhiteSpace(path) || !File.Exists(path)) return false;
        string tempPath = path + ".blur-" + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (Bitmap source = LoadFullImage(path))
            {
                int x = Math.Max(0, Math.Min(source.Width - 1, (int)Math.Round(normalizedRegion.X * source.Width)));
                int y = Math.Max(0, Math.Min(source.Height - 1, (int)Math.Round(normalizedRegion.Y * source.Height)));
                int width = Math.Max(1, Math.Min(source.Width - x, (int)Math.Round(normalizedRegion.Width * source.Width)));
                int height = Math.Max(1, Math.Min(source.Height - y, (int)Math.Round(normalizedRegion.Height * source.Height)));
                if (width < 2 || height < 2) return false;
                int block = Math.Max(8, Math.Min(width, height) / 10);
                int smallWidth = Math.Max(1, (int)Math.Ceiling((double)width / block));
                int smallHeight = Math.Max(1, (int)Math.Ceiling((double)height / block));
                using (Bitmap pixelated = new Bitmap(smallWidth, smallHeight))
                using (Graphics smallGraphics = Graphics.FromImage(pixelated))
                using (Graphics sourceGraphics = Graphics.FromImage(source))
                {
                    smallGraphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Low;
                    smallGraphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;
                    smallGraphics.DrawImage(source, new Rectangle(0, 0, smallWidth, smallHeight), new Rectangle(x, y, width, height), GraphicsUnit.Pixel);
                    sourceGraphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                    sourceGraphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;
                    sourceGraphics.DrawImage(pixelated, new Rectangle(x, y, width, height), new Rectangle(0, 0, smallWidth, smallHeight), GraphicsUnit.Pixel);
                }
                source.Save(tempPath, System.Drawing.Imaging.ImageFormat.Png);
            }
            File.Copy(tempPath, path, true);
            return true;
        }
        finally
        {
            try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { }
        }
    }

    private static Bitmap LoadFullImage(string path)
    {
        using (FileStream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
        using (Image source = Image.FromStream(stream))
        {
            return new Bitmap(source);
        }
    }

    private void BeginPanelDrag(object sender, MouseEventArgs eventArgs)
    {
        if (eventArgs.Button != MouseButtons.Left) return;
        if (isDocked) UndockPanel();
        userPositioned = true;
        ReleaseCapture();
        SendMessage(Handle, WmNclButtonDown, new IntPtr(HtCaption), IntPtr.Zero);
    }

    private void BeginPanelResize(object sender, MouseEventArgs eventArgs)
    {
        if (eventArgs.Button != MouseButtons.Left || isDocked) return;
        userPositioned = true;
        ReleaseCapture();
        SendMessage(Handle, WmNclButtonDown, new IntPtr(HtBottomRight), IntPtr.Zero);
    }

    internal void PositionOnScreen(Screen screen)
    {
        if (screen == null || userPositioned || isDocked) return;
        Rectangle working = screen.WorkingArea;
        Left = working.Right - Width - 18;
        Top = working.Top + Math.Max(18, (working.Height - Height) / 2);
        lastFloatingBounds = Bounds;
    }

    internal void DockToRight(Screen screen)
    {
        if (screen == null) screen = Screen.FromControl(this);
        if (!isDocked) lastFloatingBounds = Bounds;
        dockScreen = screen;
        isDocked = true;
        isDockRevealed = false;
        userPositioned = false;
        dockHandle.Visible = true;
        dockHandle.BringToFront();
        dockTargetLeft = screen.WorkingArea.Right - DockHandleWidth;
        dockAnimationTimer.Start();
        dockHoverTimer.Start();
    }

    private void RevealDockedPanel()
    {
        if (!isDocked) return;
        Screen screen = dockScreen ?? Screen.FromControl(this);
        isDockRevealed = true;
        lastDockHoverAt = DateTime.UtcNow;
        dockTargetLeft = screen.WorkingArea.Right - Width - 12;
        dockAnimationTimer.Start();
    }

    private void UndockPanel()
    {
        if (!isDocked) return;
        isDocked = false;
        isDockRevealed = false;
        dockAnimationTimer.Stop();
        dockHoverTimer.Stop();
        dockHandle.Visible = false;
        Rectangle fallback = lastFloatingBounds;
        Screen screen = dockScreen ?? Screen.FromControl(this);
        if (fallback.Width <= 0 || !screen.WorkingArea.IntersectsWith(fallback))
        {
            fallback = new Rectangle(screen.WorkingArea.Right - Width - 18, screen.WorkingArea.Top + 18, Width, Height);
        }
        Bounds = fallback;
        userPositioned = true;
    }

    private void AnimateDock(object sender, EventArgs eventArgs)
    {
        int distance = dockTargetLeft - Left;
        if (Math.Abs(distance) <= 2)
        {
            Left = dockTargetLeft;
            dockAnimationTimer.Stop();
            return;
        }
        Left += Math.Sign(distance) * Math.Max(2, Math.Abs(distance) / 3);
    }

    private void WatchDockHover(object sender, EventArgs eventArgs)
    {
        if (!isDocked || !isDockRevealed) return;
        if (Bounds.Contains(Cursor.Position))
        {
            lastDockHoverAt = DateTime.UtcNow;
            return;
        }
        if ((DateTime.UtcNow - lastDockHoverAt).TotalMilliseconds < 750) return;
        isDockRevealed = false;
        dockTargetLeft = (dockScreen ?? Screen.FromControl(this)).WorkingArea.Right - DockHandleWidth;
        dockAnimationTimer.Start();
    }

    private void ReflowStepCards()
    {
        int rowWidth = Math.Max(292, stepList.ClientSize.Width - 22);
        foreach (Control control in stepList.Controls)
        {
            RoundedPanel row = control as RoundedPanel;
            if (row == null) continue;
            row.Width = rowWidth;
            PictureBox thumbnail = null;
            foreach (Control child in row.Controls)
            {
                PictureBox candidate = child as PictureBox;
                if (candidate != null) { thumbnail = candidate; break; }
            }
            if (thumbnail == null) continue;
            int imageWidth = rowWidth - 20;
            int imageHeight = Math.Max(112, Math.Min(210, (int)(imageWidth * 0.56F)));
            thumbnail.Size = new Size(imageWidth, imageHeight);
            row.Height = imageHeight + 64;
        }
    }

    private void RaiseBoundsChanged()
    {
        if (BoundsChanged != null) BoundsChanged(this, EventArgs.Empty);
    }

    private static Bitmap LoadThumbnail(string path, int width, int height)
    {
        using (FileStream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
        using (Image source = Image.FromStream(stream))
        {
            Bitmap result = new Bitmap(width, height);
            using (Graphics graphics = Graphics.FromImage(result))
            {
                graphics.Clear(Color.FromArgb(231, 241, 238));
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                float ratio = Math.Min((float)width / source.Width, (float)height / source.Height);
                int drawWidth = Math.Max(1, (int)(source.Width * ratio));
                int drawHeight = Math.Max(1, (int)(source.Height * ratio));
                int x = (width - drawWidth) / 2;
                int y = (height - drawHeight) / 2;
                graphics.DrawImage(source, new Rectangle(x, y, drawWidth, drawHeight));
            }
            return result;
        }
    }

    private static void ReplaceImage(PictureBox picture, Image image)
    {
        Image previous = picture.Image;
        picture.Image = image;
        if (previous != null) previous.Dispose();
    }

    private static void ClearControlImages(Control root)
    {
        foreach (Control child in root.Controls)
        {
            PictureBox picture = child as PictureBox;
            if (picture != null && picture.Image != null)
            {
                picture.Image.Dispose();
                picture.Image = null;
            }
            if (child.HasChildren) ClearControlImages(child);
        }
    }

    private void ApplyCaptureExclusion()
    {
        if (!IsHandleCreated) return;
        try
        {
            if (!SetWindowDisplayAffinity(Handle, WdaExcludeFromCapture))
            {
                SetWindowDisplayAffinity(Handle, WdaMonitor);
            }
        }
        catch { }
    }

    private void ApplyWindowShape()
    {
        if (Width <= 0 || Height <= 0) return;
        using (System.Drawing.Drawing2D.GraphicsPath path = RoundedGeometry.CreatePath(new Rectangle(0, 0, Width - 1, Height - 1), 18))
        {
            Region previous = Region;
            Region = new Region(path);
            if (previous != null) previous.Dispose();
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            dockAnimationTimer.Dispose();
            dockHoverTimer.Dispose();
            ReplaceImage(zoomImage, null);
            ClearControlImages(stepList);
        }
        base.Dispose(disposing);
    }
}
