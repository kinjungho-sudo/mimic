#!/usr/bin/env python3
r"""Build Chrome Web Store ZIP with spec-compliant forward-slash paths.

PowerShell's Compress-Archive writes backslash path separators (e.g. icons\icon16.png),
which violates the ZIP spec and can break Chrome's icon lookup (manifest uses icons/...).
This builder writes forward-slash arcnames so the package loads correctly everywhere.

Run:  python build-store-zip.py
"""
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))

# Runtime whitelist — must mirror build-store-zip.ps1 (anything not listed never ships).
FILES = [
    "manifest.json",
    "background.js", "content.js", "guide-engine.js", "pre-capture-buffer.js",
    "desktop-bridge.js", "desktop-import.js", "targeting.js",
    "popup.js", "popup.html", "i18n.js",
    "_locales/ko/messages.json", "_locales/en/messages.json",
    "offscreen.html", "offscreen.js",
    "request-mic.html", "request-mic.js",
    "assets/parro-3d-neutral.png", "assets/parro-3d-point.png",
]
ICONS = ["icon16.png", "icon48.png", "icon128.png"]


def background_imports():
    """Return every literal script loaded by the MV3 service worker."""
    with open(os.path.join(ROOT, "background.js"), encoding="utf-8") as f:
        source = f.read()

    imports = []
    for call in re.finditer(r"\bimportScripts\s*\((.*?)\)\s*;", source, re.DOTALL):
        imports.extend(re.findall(r"""['"]([^'"]+)['"]""", call.group(1)))
    return imports


def main():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
        version = json.load(f)["version"]

    out = os.path.join(ROOT, f"parro-recorder-v{version}.zip")

    # Keep the whitelist aligned with background.js. A missing import aborts the
    # service worker before CONNECT listeners can be registered.
    worker_imports = background_imports()
    missing_from_whitelist = [f for f in worker_imports if f not in FILES]
    if missing_from_whitelist:
        print(
            "background.js importScripts dependency missing from FILES: "
            + ", ".join(missing_from_whitelist),
            file=sys.stderr,
        )
        sys.exit(1)

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

    required_entries = set(FILES + [f"icons/{i}" for i in ICONS])
    with zipfile.ZipFile(out, "r") as z:
        missing_from_archive = sorted(required_entries.difference(z.namelist()))
    if missing_from_archive:
        print(
            "Built ZIP is missing required file(s): " + ", ".join(missing_from_archive),
            file=sys.stderr,
        )
        sys.exit(1)

    size_kb = round(os.path.getsize(out) / 1024, 1)
    print(f"OK  parro-recorder-v{version}.zip  ({size_kb} KB)")
    print(f"Included: {len(FILES)} files + {len(ICONS)} icons (forward-slash paths)")


if __name__ == "__main__":
    main()
