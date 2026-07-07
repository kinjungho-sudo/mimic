# MIMIC Desktop Native Host (dev)

This is the first development bridge for the MIMIC Desktop Companion.

The production Desktop App can later replace this host with a signed Tauri binary, but the Chrome Extension contract should stay the same:

- `START_CAPTURE_SESSION`
- `STOP_CAPTURE_SESSION`
- `PING`

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

## Uninstall

```powershell
.\install-dev-native-host.ps1 -Uninstall
```

