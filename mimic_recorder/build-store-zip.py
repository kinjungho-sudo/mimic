#!/usr/bin/env python3
r"""Build Chrome Web Store ZIP with spec-compliant forward-slash paths.

PowerShell's Compress-Archive writes backslash path separators (e.g. icons\icon16.png),
which violates the ZIP spec and can break Chrome's icon lookup (manifest uses icons/...).
This builder writes forward-slash arcnames so the package loads correctly everywhere.

Run:  python build-store-zip.py
"""
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))

# Runtime whitelist — must mirror build-store-zip.ps1 (anything not listed never ships).
FILES = [
    "manifest.json",
    "background.js", "content.js", "guide-engine.js",
    "desktop-bridge.js", "desktop-import.js", "targeting.js",
    "popup.js", "popup.html", "i18n.js",
    "_locales/ko/messages.json", "_locales/en/messages.json",
    "offscreen.html", "offscreen.js",
    "request-mic.html", "request-mic.js",
    "assets/parro-ai-avatar.png",
    "assets/parro-ai-avatar-neutral.png",
    "assets/parro-ai-avatar-listen.png",
    "assets/parro-ai-avatar-talk.png",
    "assets/parro-ai-avatar-point.png",
    "assets/parro-ai-avatar-think.png",
    "assets/parro-ai-avatar-search.png",
    "assets/parro-ai-avatar-warning.png",
    "assets/parro-ai-avatar-error.png",
    "assets/parro-ai-avatar-blocked.png",
    "assets/parro-ai-avatar-clarify.png",
    "assets/parro-ai-avatar-success.png",
]
ICONS = ["icon16.png", "icon48.png", "icon128.png"]


def main():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
        version = json.load(f)["version"]

    out = os.path.join(ROOT, f"parro-recorder-v{version}.zip")

    # Verify presence before zipping (fail loud, like the PS script).
    missing = [f for f in FILES if not os.path.isfile(os.path.join(ROOT, f))]
    missing += [f"icons/{i}" for i in ICONS if not os.path.isfile(os.path.join(ROOT, "icons", i))]
    if missing:
        print("Missing required file(s): " + ", ".join(missing), file=sys.stderr)
        sys.exit(1)

    if os.path.exists(out):
        os.remove(out)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in FILES:
            if f in {"_locales/ko/messages.json", "_locales/en/messages.json"}:
                # 운영 패키지는 locale의 dev 표식을 제거한다.
                with open(os.path.join(ROOT, f), encoding="utf-8") as mf:
                    text = mf.read().replace("Parro Recorder (dev)", "Parro Recorder")
                z.writestr(f, text)
            else:
                z.write(os.path.join(ROOT, f), arcname=f)  # forward-slash arcname
        for i in ICONS:
            z.write(os.path.join(ROOT, "icons", i), arcname=f"icons/{i}")

    size_kb = round(os.path.getsize(out) / 1024, 1)
    print(f"OK  parro-recorder-v{version}.zip  ({size_kb} KB)")
    print(f"Included: {len(FILES)} files + {len(ICONS)} icons (forward-slash paths)")


if __name__ == "__main__":
    main()
