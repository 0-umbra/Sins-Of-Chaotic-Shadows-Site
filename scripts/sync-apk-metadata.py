#!/usr/bin/env python3
"""Backward-compatible entry point for regenerating APK metadata.

Older release notes and muscle memory use:

    python3 scripts/sync-apk-metadata.py

The site no longer keeps version, version code, byte size or SHA-256 in
hand-edited HTML. This command now delegates to the same dependency-free
Node generator used by Vercel (`npm run build`). It reads apk/SCS.apk,
writes data/apk-metadata.json, refreshes the legacy data/release.json, and
stages dist/. Version/size/checksum values are never edited by hand.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "generate-apk-metadata.mjs"


def main() -> int:
    if not GENERATOR.is_file():
        print(f"Missing generator: {GENERATOR}", file=sys.stderr)
        return 1
    result = subprocess.run(["node", str(GENERATOR)], cwd=ROOT, check=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
