#!/usr/bin/env python3
"""Regenerate APK metadata from the actual apk/SCS.apk file.

This is a static site (no build step): js/main.js fetches
data/release.json at runtime and derives every displayed size from its
fileSizeBytes, and index.html carries the same values as a no-JS
fallback. This script is the "build-time" generator for that metadata:

    python3 scripts/sync-apk-metadata.py

It measures apk/SCS.apk (exact byte size + SHA-256), rewrites
data/release.json, and replaces the previous size/checksum strings in
the files that hard-code them (index.html fallback, READMEs,
deployment doc, responsive-check script). It never touches the APK,
the download URL (/apk/SCS.apk), version, or any styling.

Historical records (e.g. docs/CHANGELOG-SOURCES.md, which logs the
Content-Length observed at verification time for a past build) are
deliberately NOT rewritten.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APK = ROOT / "apk" / "SCS.apk"
MANIFEST = ROOT / "data" / "release.json"

# Files containing hard-coded copies of the current size / checksum.
SYNCED_FILES = [
    "index.html",
    "README.md",
    "apk/README.md",
    "docs/DEPLOYMENT.md",
    "scripts/check-responsive.cjs",
]


def fmt_size(num_bytes: int) -> str:
    """Match fmtSize() in js/main.js (1024-based, 2 decimals)."""
    units = ["B", "KB", "MB", "GB"]
    n = float(num_bytes)
    i = 0
    while n >= 1024 and i < len(units) - 1:
        n /= 1024
        i += 1
    return f"{n:.0f} {units[i]}" if i == 0 else f"{n:.2f} {units[i]}"


def main() -> None:
    assert APK.is_file(), f"Missing APK: {APK}"
    apk_bytes = APK.read_bytes()
    size = len(apk_bytes)
    sha = hashlib.sha256(apk_bytes).hexdigest()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert manifest.get("fileName") == APK.name == "SCS.apk"
    assert manifest.get("downloadUrl") == "/apk/SCS.apk"
    old_size = int(manifest["fileSizeBytes"])
    old_sha = str(manifest["sha256"])

    if old_size == size and old_sha == sha:
        print(f"Already in sync: SCS.apk {size:,} bytes ({fmt_size(size)}), sha256={sha}")
        return

    manifest["fileSizeBytes"] = size
    manifest["sha256"] = sha
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    replacements = [
        (f"{old_size:,}", f"{size:,}"),
        (str(old_size), str(size)),
        (fmt_size(old_size), fmt_size(size)),
        (old_sha, sha),
        (f"{old_sha[:8]}…{old_sha[-7:]}", f"{sha[:8]}…{sha[-7:]}"),
    ]
    for rel in SYNCED_FILES:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        new = text
        for old, replacement in replacements:
            new = new.replace(old, replacement)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print(f"updated {rel}")

    print(f"APK: {APK} {size:,} bytes ({fmt_size(size)}) sha256={sha}")
    print(f"data/release.json: fileSizeBytes {old_size:,} -> {size:,}")


if __name__ == "__main__":
    main()
