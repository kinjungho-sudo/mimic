# Parro Desktop Native Host (preview)

This is the Windows preview bridge for Parro Desktop Companion.

The production Desktop App can later replace this host with a signed Tauri binary, but the Chrome Extension contract should stay the same:

- `START_CAPTURE_SESSION`
- `STOP_CAPTURE_SESSION`
- `PAUSE_CAPTURE_SESSION`
- `RESUME_CAPTURE_SESSION`
- `REQUEST_MANUAL_CAPTURE`
- `UNDO_CAPTURE_STEP`
- `MARK_NEXT_CAPTURE_PRIVATE`
- `UPDATE_TOOLBAR_BOUNDS`
- `GET_CAPTURE_SESSION`
- `READ_CAPTURE_IMAGE_CHUNK`
- `PING`

## What this verifies

This dev host verifies the first Desktop Companion contract:

1. The Chrome extension starts a Parro capture session.
2. The extension sends the same `capture_session_id` to the desktop host.
3. The desktop host keeps the active session while recording is running.
4. The extension sends a stop message when recording ends.
5. Scribe-like recording controls stay native-host backed: pause/resume,
   manual capture, undo last step, mark the next capture private, and toolbar
   bounds exclusion all use local control files inside the active session
   directory.

The current preview captures Windows clicks, the foreground application/window,
and either the active window or current monitor. When the session is completed,
the Recorder reads the local images in bounded Native Messaging chunks, runs the
existing Parro AI analysis/upload pipeline, creates a manual, and opens its editor.

## 사용자 사용 흐름

정식 Desktop Companion의 사용자 흐름은 다음을 목표로 합니다.

1. 첫 캡처 전에 Parro 웹에서 Desktop Companion 설치를 안내합니다.
2. 사용자는 Windows 설치 파일을 실행합니다.
3. 설치가 끝나면 Chrome Recorder와 Desktop Companion 연결 상태를 확인합니다.
4. 이후 녹화를 시작하면 Desktop Companion이 같은 `capture_session_id`로 세션에 붙습니다.
5. 녹화를 종료하면 데스크톱 캡처를 Parro 단계로 변환하고 완성된 매뉴얼 편집기로 이동합니다.

MVP 원칙:

- 캡처 중간에 설치를 요구하지 않습니다.
- 파일 내용은 기본으로 업로드하지 않습니다.
- 기록 중인 세션에서만 파일 작업 흐름을 감지합니다.
- 비밀번호, OTP, 결제, 개인 인증 화면은 자동 기록 대상에서 제외합니다.
- 다중 모니터 전체가 아니라 자동 클릭은 활성 앱 창, 수동 캡처는 현재 모니터만 저장합니다.

## Install for local Chrome dev

1. Load `mimic_recorder` as an unpacked Chrome extension.
2. Copy the extension ID from `chrome://extensions`.
3. Run PowerShell:

```powershell
.\install-dev-native-host.ps1 -ExtensionId "<chrome-extension-id>"
```

The script registers a current-user Native Messaging host:

```text
com.mimic.desktop_companion.dev
```

The dev host writes session messages to:

```text
%LOCALAPPDATA%\Parro\DesktopCompanion\native-host.log
```

## Build Windows installer

This builds the current unsigned preview installer at:

```text
mimic_desktop\native-host\dist\installer\ParroDesktopSetup.exe
```

Run:

```powershell
.\scripts\build-dev-installer.ps1
```

The installer is a Windows wizard with a user-selectable install directory and an optional desktop shortcut. It bundles the current local `node.exe`, Native Messaging host, and Desktop Capture controller. The default install directory is:

```text
%LOCALAPPDATA%\Programs\Parro\Desktop
```

The setup executable and installed shortcuts use the same icon as the Parro web favicon. After installation it appears in Windows Apps & features and can be removed with the installed uninstaller.

To also publish the current build to the web app download directory:

```powershell
.\scripts\build-dev-installer.ps1 -PublishToWebApp
```

The published file is:

```text
mimic_app\public\downloads\ParroDesktopSetup.exe
```

Silent installation is available for CI and smoke tests:

```powershell
.\dist\installer\ParroDesktopSetup.exe /quiet /nolaunch /dir="C:\Path\To\Parro\Desktop"
```

It registers the current-user Native Messaging host:

```text
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mimic.desktop_companion.dev
```

Default allowed Chrome extension IDs:

- current Parro dev extension: `pnkkalnfddapkmiobbhnkbhplakamaok`
- legacy dev unpacked extension: `dhfcmomnambegkibjnandckacihnaelb`
- replacement Chrome Web Store extension under review: `lefkpmfgdbhckcemfghpegleknaepekm`
- currently published Chrome Web Store extension: `ehbhcdkapcbfehinjapabgoegcjmmbgd`

To allow extra extension IDs, set `PARRO_EXTENSION_ID` before running the installer. Multiple IDs can be comma-separated. `MIMIC_EXTENSION_ID` remains supported for compatibility.

```powershell
$env:PARRO_EXTENSION_ID="extraextensionid"
.\dist\installer\ParroDesktopSetup.exe
```

## End-to-end installer verification

Build, install silently, validate the registry/manifest/payload, and run the installed Native Messaging host:

```powershell
.\scripts\build-dev-installer.ps1 -PublishToWebApp
.\scripts\test-installer.ps1
```

## Uninstall

Use Windows Settings > Apps > Installed apps, the Start menu shortcut, or run:

```powershell
"%LOCALAPPDATA%\Programs\Parro\Desktop\Uninstall.exe" /uninstall
```

The legacy local-development registration script can still be removed with:

```powershell
.\install-dev-native-host.ps1 -Uninstall
```
