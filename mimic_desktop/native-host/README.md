# Parro Desktop Native Host (preview)

This is the Windows preview bridge for Parro Desktop Companion.

The production Desktop App can later replace this host with a signed Tauri binary, but the Chrome Extension contract should stay the same:

- `START_CAPTURE_SESSION`
- `STOP_CAPTURE_SESSION`
- `PING`

## What this verifies

This dev host verifies the first Desktop Companion contract:

1. The Chrome extension starts a MIMIC capture session.
2. The extension sends the same `capture_session_id` to the desktop host.
3. The desktop host keeps the active session while recording is running.
4. The extension sends a stop message when recording ends.

This stage does not watch files yet. File creation, modification, active app detection, and upload correlation are the next implementation layer.

## 사용자 사용 흐름

정식 Desktop Companion의 사용자 흐름은 다음을 목표로 합니다.

1. 첫 캡처 전에 MIMIC 웹에서 Desktop Companion 설치를 안내합니다.
2. 사용자는 Windows 설치 파일을 실행합니다.
3. 설치가 끝나면 Chrome Recorder와 Desktop Companion 연결 상태를 확인합니다.
4. 이후 녹화를 시작하면 Desktop Companion이 같은 `capture_session_id`로 세션에 붙습니다.
5. 웹에서 파일을 다운로드하고, PC에서 수정/저장하고, 다시 업로드하는 흐름을 하나의 MIMIC 매뉴얼 단계로 복원합니다.

MVP 원칙:

- 캡처 중간에 설치를 요구하지 않습니다.
- 파일 내용은 기본으로 업로드하지 않습니다.
- 기록 중인 세션에서만 파일 작업 흐름을 감지합니다.
- 비밀번호, OTP, 결제, 개인 인증 화면은 자동 기록 대상에서 제외합니다.

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
%LOCALAPPDATA%\MIMIC\DesktopCompanion\native-host.log
```

## Build quick Windows installer

This builds an unsigned internal-test installer at:

```text
mimic_desktop\native-host\dist\installer\ParroDesktopSetup.exe
```

Run:

```powershell
.\scripts\build-dev-installer.ps1
```

The quick installer bundles the current local `node.exe` with `src\host.js`, installs them under:

```text
%LOCALAPPDATA%\Programs\MIMIC\DesktopCompanion
```

It registers the current-user Native Messaging host:

```text
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mimic.desktop_companion.dev
```

Default allowed Chrome extension IDs:

- current Parro dev extension: `pnkkalnfddapkmiobbhnkbhplakamaok`
- dev unpacked extension: `dhfcmomnambegkibjnandckacihnaelb`
- Chrome Web Store extension: `ehbhcdkapcbfehinjapabgoegcjmmbgd`

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

```powershell
.\install-dev-native-host.ps1 -Uninstall
```
