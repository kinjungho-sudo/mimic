#!/usr/bin/env python3
r"""Build a separate Chrome Web Store ZIP for Parro Recorder.

This does not edit manifest.json in-place. It stages a Parro manifest and
runtime files, then writes a Web Store-ready ZIP with manifest.json at root.

Run:
  python build-parro-store-zip.py
"""
import json
import os
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))

PARRO_NAME = "Parro Recorder"
PARRO_VERSION = "1.0.0"
PARRO_DESCRIPTION = "웹페이지 작업을 단계별로 자동 캡처하여 매뉴얼과 가이드를 빠르게 만드는 스크린샷 레코더입니다."

FILES = [
    "manifest.json",
    "background.js", "content.js", "guide-engine.js",
    "popup.js", "popup.html",
    "offscreen.html", "offscreen.js",
    "request-mic.html", "request-mic.js",
]
ICONS = ["icon16.png", "icon48.png", "icon128.png"]


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write_text(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def build_manifest():
    manifest = json.loads(read_text(os.path.join(ROOT, "manifest.json")))
    manifest["name"] = PARRO_NAME
    manifest["short_name"] = "Parro"
    manifest["version"] = PARRO_VERSION
    manifest["description"] = PARRO_DESCRIPTION
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"


def transform_runtime_file(name, text):
    if name == "popup.html":
        return text.replace("MIMIC Recorder", "Parro Recorder").replace("MIMIC", "Parro")
    if name == "privacy_policy.html":
        return text.replace("MIMIC Recorder", "Parro Recorder").replace("MIMIC", "Parro")
    if name == "popup.js":
        return text.replace("MIMIC 계정", "Parro 계정")
    return text


def main():
    missing = [f for f in FILES if not os.path.isfile(os.path.join(ROOT, f))]
    missing += [f"icons/{i}" for i in ICONS if not os.path.isfile(os.path.join(ROOT, "icons", i))]
    if missing:
        print("Missing required file(s): " + ", ".join(missing), file=sys.stderr)
        sys.exit(1)

    out = os.path.join(ROOT, f"parro-recorder-v{PARRO_VERSION}.zip")
    if os.path.exists(out):
        os.remove(out)

    with tempfile.TemporaryDirectory(prefix="parro-recorder-build-") as stage:
        os.makedirs(os.path.join(stage, "icons"), exist_ok=True)

        for name in FILES:
            dest = os.path.join(stage, name)
            if name == "manifest.json":
                write_text(dest, build_manifest())
            else:
                write_text(dest, transform_runtime_file(name, read_text(os.path.join(ROOT, name))))

        for icon in ICONS:
            src = os.path.join(ROOT, "icons", icon)
            dst = os.path.join(stage, "icons", icon)
            with open(src, "rb") as rf, open(dst, "wb") as wf:
                wf.write(rf.read())

        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for name in FILES:
                z.write(os.path.join(stage, name), arcname=name)
            for icon in ICONS:
                z.write(os.path.join(stage, "icons", icon), arcname=f"icons/{icon}")

    size_kb = round(os.path.getsize(out) / 1024, 1)
    print(f"OK  parro-recorder-v{PARRO_VERSION}.zip  ({size_kb} KB)")
    print(f"Included: {len(FILES)} files + {len(ICONS)} icons")
    print("Note: replace icons with final Parro brand icons before public submission if needed.")


if __name__ == "__main__":
    main()
