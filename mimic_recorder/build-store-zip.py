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
    "popup.js", "popup.html",
    "offscreen.html", "offscreen.js",
    "request-mic.html", "request-mic.js",
]
ICONS = ["icon16.png", "icon48.png", "icon128.png"]


def main():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
        version = json.load(f)["version"]

    out = os.path.join(ROOT, f"mimic-recorder-v{version}.zip")

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
            z.write(os.path.join(ROOT, f), arcname=f)  # forward-slash arcname
        for i in ICONS:
            z.write(os.path.join(ROOT, "icons", i), arcname=f"icons/{i}")

    size_kb = round(os.path.getsize(out) / 1024, 1)
    print(f"OK  mimic-recorder-v{version}.zip  ({size_kb} KB)")
    print(f"Included: {len(FILES)} files + {len(ICONS)} icons (forward-slash paths)")


if __name__ == "__main__":
    main()
