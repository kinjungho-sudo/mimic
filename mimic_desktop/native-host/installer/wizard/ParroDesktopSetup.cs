using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

[assembly: AssemblyTitle("Parro Desktop Setup")]
[assembly: AssemblyDescription("Parro Desktop Capture installer")]
[assembly: AssemblyCompany("Parro")]
[assembly: AssemblyProduct("Parro Desktop")]
[assembly: AssemblyCopyright("Copyright © Parro 2026")]
[assembly: AssemblyVersion("0.4.1.0")]
[assembly: AssemblyFileVersion("0.4.1.0")]

namespace Parro.Desktop.Setup
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            bool quiet = HasArgument(args, "/quiet") || HasArgument(args, "/q");
            bool uninstall = HasArgument(args, "/uninstall");
            bool noLaunch = HasArgument(args, "/nolaunch");
            string installDirectory = GetValueArgument(args, "/dir=");

            try
            {
                if (uninstall)
                {
                    if (!quiet)
                    {
                        DialogResult result = MessageBox.Show(
                            "Parro Desktop과 관련된 바로가기 및 연결 정보를 제거하시겠습니까?",
                            "Parro Desktop 제거",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question);
                        if (result != DialogResult.Yes) return 0;
                    }

                    InstallerEngine.Uninstall();
                    if (!quiet)
                    {
                        MessageBox.Show("Parro Desktop이 제거되었습니다.", "제거 완료", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    return 0;
                }

                if (quiet)
                {
                    string target = String.IsNullOrWhiteSpace(installDirectory)
                        ? InstallerEngine.GetDefaultInstallDirectory()
                        : Path.GetFullPath(installDirectory);
                    InstallerEngine.Install(target, false, null);
                    if (!noLaunch) InstallerEngine.Launch(target);
                    return 0;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new SetupWizard());
                return 0;
            }
            catch (Exception ex)
            {
                InstallerEngine.Log("Fatal setup error", ex);
                if (!quiet)
                {
                    MessageBox.Show(
                        "설치를 완료하지 못했습니다.\r\n\r\n" + ex.Message + "\r\n\r\n로그: " + InstallerEngine.LogPath,
                        "Parro Desktop 설치 오류",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }
                return 1;
            }
        }

        private static bool HasArgument(string[] args, string value)
        {
            foreach (string arg in args)
            {
                if (String.Equals(arg, value, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static string GetValueArgument(string[] args, string prefix)
        {
            foreach (string arg in args)
            {
                if (arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    return arg.Substring(prefix.Length).Trim('"');
                }
            }
            return null;
        }
    }

    internal sealed class SetupWizard : Form
    {
        private readonly Panel contentPanel;
        private readonly Button backButton;
        private readonly Button nextButton;
        private readonly Button cancelButton;
        private readonly TextBox installPathBox;
        private readonly CheckBox desktopShortcutBox;
        private readonly Label readyLocationLabel;
        private readonly Label progressLabel;
        private readonly ProgressBar progressBar;
        private readonly CheckBox launchBox;
        private readonly Panel[] pages;
        private int pageIndex;
        private bool installing;

        internal SetupWizard()
        {
            Text = "Parro Desktop 설치";
            ClientSize = new Size(720, 455);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            Font = new Font("Segoe UI", 9F);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            Panel brandPanel = new Panel();
            brandPanel.Dock = DockStyle.Left;
            brandPanel.Width = 220;
            brandPanel.BackColor = Color.FromArgb(7, 20, 17);
            Controls.Add(brandPanel);

            PictureBox logo = new PictureBox();
            logo.Location = new Point(38, 45);
            logo.Size = new Size(72, 72);
            logo.SizeMode = PictureBoxSizeMode.Zoom;
            try { logo.Image = Icon.ToBitmap(); } catch { }
            brandPanel.Controls.Add(logo);

            Label brand = MakeLabel("Parro", 38, 132, 150, 38, 25F, FontStyle.Bold, Color.White);
            brandPanel.Controls.Add(brand);
            Label brandCopy = MakeLabel("평소처럼 클릭하면\r\n매뉴얼이 완성됩니다.", 39, 178, 160, 60, 10F, FontStyle.Regular, Color.FromArgb(176, 210, 201));
            brandCopy.AutoSize = false;
            brandPanel.Controls.Add(brandCopy);
            Label version = MakeLabel("DESKTOP  0.4.1", 39, 388, 150, 24, 8F, FontStyle.Bold, Color.FromArgb(78, 205, 183));
            brandPanel.Controls.Add(version);

            Panel footer = new Panel();
            footer.Dock = DockStyle.Bottom;
            footer.Height = 68;
            footer.BackColor = Color.FromArgb(247, 249, 249);
            footer.Padding = new Padding(0, 14, 18, 14);
            Controls.Add(footer);

            cancelButton = MakeButton("취소", 0, 14, 82, 38);
            backButton = MakeButton("이전", 0, 14, 82, 38);
            nextButton = MakeButton("다음", 0, 14, 106, 38);
            cancelButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            backButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            nextButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            nextButton.BackColor = Color.FromArgb(0, 142, 134);
            nextButton.ForeColor = Color.White;
            nextButton.FlatAppearance.BorderSize = 0;
            footer.Controls.Add(cancelButton);
            footer.Controls.Add(backButton);
            footer.Controls.Add(nextButton);
            footer.Layout += delegate { AlignFooterButtons(footer); };
            AlignFooterButtons(footer);

            contentPanel = new Panel();
            contentPanel.Dock = DockStyle.Fill;
            contentPanel.Padding = new Padding(38, 34, 34, 24);
            Controls.Add(contentPanel);
            contentPanel.BringToFront();
            footer.BringToFront();

            Panel welcomePage = CreatePage();
            welcomePage.Controls.Add(MakeTitle("Parro Desktop 설치를 시작합니다"));
            welcomePage.Controls.Add(MakeBody(
                "Parro Desktop은 브라우저 밖의 Windows 화면도 클릭 단위로 기록합니다.\r\n\r\n" +
                "설치 마법사가 필요한 파일과 Chrome 연결 정보를 현재 사용자 계정에 안전하게 구성합니다.",
                2, 92));
            Label recommendation = MakeLabel("계속하려면 [다음]을 클릭하세요.", 2, 270, 410, 28, 9F, FontStyle.Bold, Color.FromArgb(0, 124, 114));
            welcomePage.Controls.Add(recommendation);

            Panel locationPage = CreatePage();
            locationPage.Controls.Add(MakeTitle("설치 위치 선택"));
            Label locationDescription = MakeBody("Parro Desktop을 설치할 폴더를 선택하세요.", 2, 72);
            locationDescription.Size = new Size(420, 36);
            locationPage.Controls.Add(locationDescription);
            installPathBox = new TextBox();
            installPathBox.Location = new Point(2, 126);
            installPathBox.Size = new Size(326, 27);
            installPathBox.Text = InstallerEngine.GetDefaultInstallDirectory();
            locationPage.Controls.Add(installPathBox);
            Button browseButton = MakeButton("찾아보기…", 336, 123, 90, 32);
            locationPage.Controls.Add(browseButton);
            installPathBox.BringToFront();
            browseButton.BringToFront();
            desktopShortcutBox = new CheckBox();
            desktopShortcutBox.Location = new Point(2, 184);
            desktopShortcutBox.Size = new Size(300, 26);
            desktopShortcutBox.Text = "바탕 화면에 바로가기 만들기";
            desktopShortcutBox.Checked = true;
            locationPage.Controls.Add(desktopShortcutBox);
            Label permissionHint = MakeLabel("관리자 권한 없이 설치됩니다. 쓰기 권한이 있는 폴더를 선택해 주세요.", 2, 230, 420, 44, 8.5F, FontStyle.Regular, Color.FromArgb(101, 116, 112));
            permissionHint.AutoSize = false;
            locationPage.Controls.Add(permissionHint);

            Panel readyPage = CreatePage();
            readyPage.Controls.Add(MakeTitle("설치 준비 완료"));
            readyLocationLabel = MakeLabel(
                string.Empty,
                2, 72, 420, 104,
                9F,
                FontStyle.Bold,
                Color.FromArgb(18, 54, 48));
            readyLocationLabel.AutoSize = false;
            readyPage.Controls.Add(readyLocationLabel);
            readyPage.Controls.Add(MakeBody("[설치]를 클릭하면 파일 복사, Chrome 연결, 시작 메뉴 등록을 진행합니다.", 2, 190));

            Panel progressPage = CreatePage();
            progressPage.Controls.Add(MakeTitle("Parro Desktop 설치 중"));
            progressLabel = MakeLabel("설치를 준비하고 있습니다…", 2, 104, 420, 30, 9F, FontStyle.Regular, Color.FromArgb(61, 79, 74));
            progressPage.Controls.Add(progressLabel);
            progressBar = new ProgressBar();
            progressBar.Location = new Point(2, 150);
            progressBar.Size = new Size(420, 18);
            progressBar.Style = ProgressBarStyle.Continuous;
            progressPage.Controls.Add(progressBar);
            progressPage.Controls.Add(MakeBody("이 작업은 보통 1분 이내에 완료됩니다. 설치 창을 닫지 마세요.", 2, 204));

            Panel completePage = CreatePage();
            completePage.Controls.Add(MakeTitle("설치가 완료되었습니다"));
            completePage.Controls.Add(MakeBody("Parro Desktop Capture를 실행해 Windows 화면 캡처를 시작할 수 있습니다.", 2, 82));
            launchBox = new CheckBox();
            launchBox.Location = new Point(2, 164);
            launchBox.Size = new Size(330, 28);
            launchBox.Text = "Parro Desktop Capture 지금 실행";
            launchBox.Checked = true;
            completePage.Controls.Add(launchBox);
            Label completeHint = MakeLabel("시작 메뉴의 Parro Desktop Capture에서도 언제든 실행할 수 있습니다.", 2, 220, 420, 40, 8.5F, FontStyle.Regular, Color.FromArgb(101, 116, 112));
            completeHint.AutoSize = false;
            completePage.Controls.Add(completeHint);

            pages = new[] { welcomePage, locationPage, readyPage, progressPage, completePage };
            foreach (Panel page in pages) contentPanel.Controls.Add(page);

            browseButton.Click += delegate { BrowseForInstallFolder(); };
            backButton.Click += delegate { ShowPage(pageIndex - 1); };
            nextButton.Click += delegate { HandleNext(); };
            cancelButton.Click += delegate { Close(); };
            FormClosing += OnFormClosing;
            ShowPage(0);
        }

        private void HandleNext()
        {
            if (pageIndex == 0)
            {
                ShowPage(1);
                return;
            }
            if (pageIndex == 1)
            {
                string validationError;
                if (!InstallerEngine.TryValidateInstallDirectory(installPathBox.Text, out validationError))
                {
                    MessageBox.Show(validationError, "설치 위치 확인", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                installPathBox.Text = Path.GetFullPath(Environment.ExpandEnvironmentVariables(installPathBox.Text.Trim()));
                readyLocationLabel.Text = "설치 위치\r\n\r\n" + installPathBox.Text;
                ShowPage(2);
                return;
            }
            if (pageIndex == 2)
            {
                BeginInstall();
                return;
            }
            if (pageIndex == 4)
            {
                if (launchBox.Checked)
                {
                    try { InstallerEngine.Launch(installPathBox.Text); }
                    catch (Exception ex)
                    {
                        InstallerEngine.Log("Launch after setup failed", ex);
                        MessageBox.Show("설치는 완료됐지만 실행하지 못했습니다.\r\n\r\n" + ex.Message, "실행 오류", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                }
                Close();
            }
        }

        private void BeginInstall()
        {
            installing = true;
            ShowPage(3);
            backButton.Enabled = false;
            nextButton.Enabled = false;
            cancelButton.Enabled = false;
            progressBar.Value = 4;

            BackgroundWorker worker = new BackgroundWorker();
            worker.DoWork += delegate
            {
                InstallerEngine.Install(installPathBox.Text, desktopShortcutBox.Checked, delegate(int percent, string message)
                {
                    BeginInvoke((MethodInvoker)delegate
                    {
                        progressBar.Value = Math.Max(progressBar.Minimum, Math.Min(progressBar.Maximum, percent));
                        progressLabel.Text = message;
                    });
                });
            };
            worker.RunWorkerCompleted += delegate(object sender, RunWorkerCompletedEventArgs e)
            {
                installing = false;
                if (e.Error != null)
                {
                    InstallerEngine.Log("Interactive installation failed", e.Error);
                    MessageBox.Show(
                        "설치를 완료하지 못했습니다.\r\n\r\n" + e.Error.Message + "\r\n\r\n로그: " + InstallerEngine.LogPath,
                        "Parro Desktop 설치 오류",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                    ShowPage(2);
                    return;
                }
                progressBar.Value = 100;
                ShowPage(4);
            };
            worker.RunWorkerAsync();
        }

        private void BrowseForInstallFolder()
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Parro Desktop을 설치할 폴더를 선택하세요.";
                dialog.SelectedPath = installPathBox.Text;
                dialog.ShowNewFolderButton = true;
                if (dialog.ShowDialog(this) == DialogResult.OK) installPathBox.Text = dialog.SelectedPath;
            }
        }

        private void ShowPage(int index)
        {
            pageIndex = Math.Max(0, Math.Min(pages.Length - 1, index));
            for (int i = 0; i < pages.Length; i++) pages[i].Visible = i == pageIndex;
            backButton.Enabled = !installing && pageIndex > 0 && pageIndex < 3;
            cancelButton.Enabled = !installing;
            cancelButton.Visible = pageIndex != 4;
            nextButton.Enabled = !installing && pageIndex != 3;
            nextButton.Text = pageIndex == 2 ? "설치" : pageIndex == 4 ? "완료" : "다음";
            nextButton.Visible = pageIndex != 3;
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            if (installing)
            {
                e.Cancel = true;
                return;
            }
            if (pageIndex < 4 && e.CloseReason == CloseReason.UserClosing)
            {
                DialogResult result = MessageBox.Show("설치를 취소하시겠습니까?", "Parro Desktop 설치", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (result != DialogResult.Yes) e.Cancel = true;
            }
        }

        private Panel CreatePage()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Fill;
            panel.BackColor = Color.White;
            panel.Visible = false;
            return panel;
        }

        private Label MakeTitle(string text)
        {
            Label label = MakeLabel(text, 2, 18, 420, 52, 19F, FontStyle.Bold, Color.FromArgb(14, 36, 32));
            label.AutoSize = false;
            return label;
        }

        private Label MakeBody(string text, int x, int y)
        {
            Label label = MakeLabel(text, x, y, 420, 105, 9.5F, FontStyle.Regular, Color.FromArgb(74, 92, 87));
            label.AutoSize = false;
            return label;
        }

        private static Label MakeLabel(string text, int x, int y, int width, int height, float size, FontStyle style, Color color)
        {
            Label label = new Label();
            label.Text = text;
            label.Location = new Point(x, y);
            label.Size = new Size(width, height);
            label.Font = new Font("Segoe UI", size, style);
            label.ForeColor = color;
            label.BackColor = Color.Transparent;
            label.AutoSize = false;
            return label;
        }

        private static Button MakeButton(string text, int x, int y, int width, int height)
        {
            Button button = new Button();
            button.Text = text;
            button.Location = new Point(x, y);
            button.Size = new Size(width, height);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = Color.FromArgb(202, 213, 210);
            button.BackColor = Color.White;
            button.Cursor = Cursors.Hand;
            return button;
        }

        private void AlignFooterButtons(Panel footer)
        {
            const int gap = 8;
            int right = footer.ClientSize.Width - footer.Padding.Right;
            nextButton.Left = right - nextButton.Width;
            backButton.Left = nextButton.Left - gap - backButton.Width;
            cancelButton.Left = backButton.Left - gap - cancelButton.Width;
        }
    }

    internal static class InstallerEngine
    {
        internal const string HostName = "com.mimic.desktop_companion.dev";
        internal const string ProductVersion = "0.4.1";
        private const string NativeHostRegistry = @"Software\Google\Chrome\NativeMessagingHosts\com.mimic.desktop_companion.dev";
        private const string UninstallRegistry = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\ParroDesktop";
        private static readonly string[] PayloadFiles = { "node.exe", "host.js", "capture-agent.ps1", "controller.ps1", "parro.ico", "ParroDesktop.exe" };
        private static readonly string[] DefaultExtensionIds = {
            "pnkkalnfddapkmiobbhnkbhplakamaok",
            "dhfcmomnambegkibjnandckacihnaelb",
            "ehbhcdkapcbfehinjapabgoegcjmmbgd"
        };

        internal static string LogPath
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Parro", "DesktopCompanion", "installer.log");
            }
        }

        internal static string GetDefaultInstallDirectory()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(UninstallRegistry))
                {
                    if (key != null)
                    {
                        string existing = key.GetValue("InstallLocation") as string;
                        if (!String.IsNullOrWhiteSpace(existing)) return existing;
                    }
                }
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(NativeHostRegistry))
                {
                    if (key != null)
                    {
                        string manifest = key.GetValue(null) as string;
                        if (!String.IsNullOrWhiteSpace(manifest)) return Path.GetDirectoryName(manifest);
                    }
                }
            }
            catch { }

            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "Parro", "Desktop");
        }

        internal static bool TryValidateInstallDirectory(string value, out string error)
        {
            error = null;
            if (String.IsNullOrWhiteSpace(value))
            {
                error = "설치 위치를 입력해 주세요.";
                return false;
            }
            try
            {
                string full = Path.GetFullPath(Environment.ExpandEnvironmentVariables(value.Trim()));
                string root = Path.GetPathRoot(full);
                if (String.Equals(full.TrimEnd(Path.DirectorySeparatorChar), root.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
                {
                    error = "드라이브 루트에는 직접 설치할 수 없습니다. 하위 폴더를 선택해 주세요.";
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                error = "유효한 설치 위치가 아닙니다.\r\n" + ex.Message;
                return false;
            }
        }

        internal static void Install(string installDirectory, bool createDesktopShortcut, Action<int, string> progress)
        {
            string validationError;
            if (!TryValidateInstallDirectory(installDirectory, out validationError)) throw new InvalidOperationException(validationError);
            installDirectory = Path.GetFullPath(Environment.ExpandEnvironmentVariables(installDirectory.Trim()));
            Log("Install started: " + installDirectory, null);
            Report(progress, 8, "설치 폴더를 준비하고 있습니다…");

            Directory.CreateDirectory(installDirectory);
            VerifyWritable(installDirectory);
            StopParroDesktopProcess(installDirectory);
            StopBundledNodeProcess(installDirectory);

            string tempDirectory = Path.Combine(Path.GetTempPath(), "ParroDesktopSetup-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDirectory);
            try
            {
                Report(progress, 20, "설치 파일을 압축 해제하고 있습니다…");
                ExtractPayload(tempDirectory);
                for (int i = 0; i < PayloadFiles.Length; i++)
                {
                    string fileName = PayloadFiles[i];
                    string source = Path.Combine(tempDirectory, fileName);
                    if (!File.Exists(source)) throw new FileNotFoundException("설치 패키지에 필요한 파일이 없습니다.", fileName);
                    CopyWithRetry(source, Path.Combine(installDirectory, fileName));
                    Report(progress, 28 + (i * 8), "파일을 설치하고 있습니다… " + fileName);
                }

                string wrapperPath = Path.Combine(installDirectory, "parro-desktop-host.cmd");
                File.WriteAllText(wrapperPath, "@echo off\r\n\"%~dp0node.exe\" \"%~dp0host.js\"\r\n", new UTF8Encoding(false));

                Report(progress, 72, "Chrome 연결 정보를 등록하고 있습니다…");
                string manifestPath = WriteManifest(installDirectory, wrapperPath);
                using (RegistryKey hostKey = Registry.CurrentUser.CreateSubKey(NativeHostRegistry))
                {
                    hostKey.SetValue(null, manifestPath, RegistryValueKind.String);
                }

                Report(progress, 82, "바로가기를 만들고 있습니다…");
                CreateShortcuts(installDirectory, createDesktopShortcut);

                string uninstallPath = Path.Combine(installDirectory, "Uninstall.exe");
                CopyWithRetry(Application.ExecutablePath, uninstallPath);
                RegisterUninstaller(installDirectory, uninstallPath);

                File.WriteAllText(
                    Path.Combine(installDirectory, "install.json"),
                    "{\r\n  \"installed_at\": \"" + DateTimeOffset.Now.ToString("o") + "\",\r\n  \"version\": \"" + ProductVersion + "\",\r\n  \"install_location\": \"" + JsonEscape(installDirectory) + "\"\r\n}",
                    new UTF8Encoding(false));

                Report(progress, 100, "설치가 완료되었습니다.");
                Log("Install completed: " + installDirectory, null);
            }
            finally
            {
                try { Directory.Delete(tempDirectory, true); } catch { }
            }
        }

        internal static void Launch(string installDirectory)
        {
            string launcherPath = Path.Combine(installDirectory, "ParroDesktop.exe");
            if (!File.Exists(launcherPath)) throw new FileNotFoundException("Parro Desktop 실행 파일을 찾을 수 없습니다.", launcherPath);
            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = launcherPath;
            start.WorkingDirectory = installDirectory;
            start.UseShellExecute = true;
            Process process = Process.Start(start);
            if (process == null) throw new InvalidOperationException("Parro Desktop 프로세스를 시작하지 못했습니다.");
            Log("Controller launched: " + launcherPath, null);
        }

        internal static void Uninstall()
        {
            string installDirectory = GetDefaultInstallDirectory();
            Log("Uninstall started: " + installDirectory, null);
            try { Registry.CurrentUser.DeleteSubKeyTree(NativeHostRegistry, false); } catch { }
            try { Registry.CurrentUser.DeleteSubKeyTree(UninstallRegistry, false); } catch { }

            DeleteShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Parro Desktop Capture.lnk"));
            DeleteShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Parro Desktop Capture.lnk"));

            string executable = Path.GetFullPath(Application.ExecutablePath);
            string directory = Path.GetFullPath(installDirectory);
            if (executable.StartsWith(directory.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            {
                ScheduleDirectoryDeletion(directory);
            }
            else if (Directory.Exists(directory))
            {
                Directory.Delete(directory, true);
            }
            Log("Uninstall scheduled/completed: " + directory, null);
        }

        internal static void Log(string message, Exception exception)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
                string line = DateTimeOffset.Now.ToString("o") + "  " + message;
                if (exception != null) line += "\r\n" + exception;
                File.AppendAllText(LogPath, line + "\r\n", new UTF8Encoding(false));
            }
            catch { }
        }

        private static void ExtractPayload(string destination)
        {
            string archivePath = Path.Combine(destination, "payload.zip");
            using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("Parro.Payload.zip"))
            {
                if (resource == null) throw new InvalidOperationException("설치 패키지 리소스를 찾을 수 없습니다.");
                using (FileStream output = File.Create(archivePath)) resource.CopyTo(output);
            }
            string extractDirectory = Path.Combine(destination, "files");
            ZipFile.ExtractToDirectory(archivePath, extractDirectory);
            foreach (string file in Directory.GetFiles(extractDirectory))
            {
                File.Move(file, Path.Combine(destination, Path.GetFileName(file)));
            }
        }

        private static string WriteManifest(string installDirectory, string wrapperPath)
        {
            List<string> extensionIds = new List<string>(DefaultExtensionIds);
            string extras = Environment.GetEnvironmentVariable("PARRO_EXTENSION_ID");
            if (String.IsNullOrWhiteSpace(extras)) extras = Environment.GetEnvironmentVariable("MIMIC_EXTENSION_ID");
            if (!String.IsNullOrWhiteSpace(extras))
            {
                foreach (string raw in extras.Split(','))
                {
                    string id = raw.Trim();
                    if (id.Length > 0 && !extensionIds.Contains(id)) extensionIds.Add(id);
                }
            }

            StringBuilder origins = new StringBuilder();
            for (int i = 0; i < extensionIds.Count; i++)
            {
                if (i > 0) origins.Append(",\r\n");
                origins.Append("    \"chrome-extension://").Append(JsonEscape(extensionIds[i])).Append("/\"");
            }

            string manifest = "{\r\n" +
                "  \"name\": \"" + HostName + "\",\r\n" +
                "  \"description\": \"Parro Desktop native messaging host\",\r\n" +
                "  \"path\": \"" + JsonEscape(wrapperPath) + "\",\r\n" +
                "  \"type\": \"stdio\",\r\n" +
                "  \"allowed_origins\": [\r\n" + origins + "\r\n  ]\r\n" +
                "}";
            string manifestPath = Path.Combine(installDirectory, HostName + ".json");
            File.WriteAllText(manifestPath, manifest, new UTF8Encoding(false));
            return manifestPath;
        }

        private static void CreateShortcuts(string installDirectory, bool createDesktopShortcut)
        {
            string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Parro Desktop Capture.lnk");
            string desktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Parro Desktop Capture.lnk");
            string launcher = Path.Combine(installDirectory, "ParroDesktop.exe");
            string icon = Path.Combine(installDirectory, "parro.ico");
            CreateShortcut(startMenu, launcher, installDirectory, icon);
            if (createDesktopShortcut) CreateShortcut(desktop, launcher, installDirectory, icon);
            else DeleteShortcut(desktop);
        }

        private static void CreateShortcut(string shortcutPath, string launcherPath, string workingDirectory, string iconPath)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(shortcutPath));
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) throw new InvalidOperationException("Windows 바로가기 서비스를 사용할 수 없습니다.");
            object shell = Activator.CreateInstance(shellType);
            try
            {
                object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                Type shortcutType = shortcut.GetType();
                shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { launcherPath });
                shortcutType.InvokeMember("Arguments", BindingFlags.SetProperty, null, shortcut, new object[] { String.Empty });
                shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDirectory });
                shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { iconPath + ",0" });
                shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "Parro Desktop Capture" });
                shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            }
            finally
            {
                try { System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell); } catch { }
            }
        }

        private static void RegisterUninstaller(string installDirectory, string uninstallPath)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallRegistry))
            {
                key.SetValue("DisplayName", "Parro Desktop", RegistryValueKind.String);
                key.SetValue("DisplayVersion", ProductVersion, RegistryValueKind.String);
                key.SetValue("Publisher", "Parro", RegistryValueKind.String);
                key.SetValue("InstallLocation", installDirectory, RegistryValueKind.String);
                key.SetValue("DisplayIcon", Path.Combine(installDirectory, "parro.ico"), RegistryValueKind.String);
                key.SetValue("UninstallString", "\"" + uninstallPath + "\" /uninstall", RegistryValueKind.String);
                key.SetValue("QuietUninstallString", "\"" + uninstallPath + "\" /uninstall /quiet", RegistryValueKind.String);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }

        private static void StopBundledNodeProcess(string installDirectory)
        {
            string expected = Path.GetFullPath(Path.Combine(installDirectory, "node.exe"));
            foreach (Process process in Process.GetProcessesByName("node"))
            {
                try
                {
                    if (String.Equals(process.MainModule.FileName, expected, StringComparison.OrdinalIgnoreCase))
                    {
                        process.Kill();
                        process.WaitForExit(3000);
                    }
                }
                catch { }
                finally { process.Dispose(); }
            }
        }

        private static void StopParroDesktopProcess(string installDirectory)
        {
            string expected = Path.GetFullPath(Path.Combine(installDirectory, "ParroDesktop.exe"));
            foreach (Process process in Process.GetProcessesByName("ParroDesktop"))
            {
                try
                {
                    if (String.Equals(process.MainModule.FileName, expected, StringComparison.OrdinalIgnoreCase))
                    {
                        process.CloseMainWindow();
                        if (!process.WaitForExit(1500)) process.Kill();
                        process.WaitForExit(3000);
                    }
                }
                catch { }
                finally { process.Dispose(); }
            }
        }

        private static void VerifyWritable(string directory)
        {
            string testPath = Path.Combine(directory, ".parro-write-test-" + Guid.NewGuid().ToString("N"));
            try { File.WriteAllText(testPath, "ok", Encoding.ASCII); }
            catch (UnauthorizedAccessException) { throw new UnauthorizedAccessException("선택한 설치 폴더에 쓸 권한이 없습니다. 다른 위치를 선택해 주세요."); }
            finally { try { File.Delete(testPath); } catch { } }
        }

        private static void CopyWithRetry(string source, string destination)
        {
            Exception last = null;
            for (int attempt = 0; attempt < 4; attempt++)
            {
                try
                {
                    File.Copy(source, destination, true);
                    return;
                }
                catch (Exception ex)
                {
                    last = ex;
                    System.Threading.Thread.Sleep(300 * (attempt + 1));
                }
            }
            throw new IOException("파일을 설치하지 못했습니다: " + Path.GetFileName(destination), last);
        }

        private static void DeleteShortcut(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); } catch { }
        }

        private static void ScheduleDirectoryDeletion(string directory)
        {
            string batchPath = Path.Combine(Path.GetTempPath(), "ParroDesktopUninstall-" + Guid.NewGuid().ToString("N") + ".cmd");
            string script = "@echo off\r\n" +
                "ping 127.0.0.1 -n 3 > nul\r\n" +
                "rmdir /s /q \"" + directory + "\"\r\n" +
                "del /q \"%~f0\"\r\n";
            File.WriteAllText(batchPath, script, Encoding.ASCII);
            ProcessStartInfo start = new ProcessStartInfo("cmd.exe", "/c \"\"" + batchPath + "\"\"");
            start.CreateNoWindow = true;
            start.UseShellExecute = false;
            start.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(start);
        }

        private static string JsonEscape(string value)
        {
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }

        private static void Report(Action<int, string> progress, int percent, string message)
        {
            if (progress != null) progress(percent, message);
        }
    }
}
