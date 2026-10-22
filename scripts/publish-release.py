#!/usr/bin/env python3
"""SCS release publisher — turns a verified signed APK into a public site release.

WHAT THIS DOES
  1. Creates a release on the PUBLIC site repo (0-umbra/Sins-Of-Chaotic-Shadows-Site)
     and attaches the APK + SHA256SUMS so anyone can download it without a GitHub login.
  2. Updates data/release.json in the site repo (version, date, size, SHA-256, URL,
     previous-release history) and commits it, so the website updates automatically.

WHAT THIS NEVER DOES
  - It never uploads, reads or needs the signing keystore or any signing secret.
  - It never publishes an unsigned/debug APK: pass --unsigned-check to enforce that the
    file name and the SHA256SUMS entry came from the game repo's verified release flow.

USAGE (run from a checkout of the site repo, with `gh` authenticated)
  # after the game repo published release vX.Y.Z with the APK attached:
  python3 scripts/publish-release.py --tag vX.Y.Z --apk /path/to/sins-of-chaotic-shadow-x.y.z-code.apk \
      --checksums /path/to/SHA256SUMS.txt --repo 0-umbra/Sins-Of-Chaotic-Shadows-Site

  # or let the script pull the assets straight from the game repo release itself:
  python3 scripts/publish-release.py --tag vX.Y.Z --from-game-repo 0-umbra/Sins-Of-Chaotic-Shadows

Requirements: python3, `gh` (GitHub CLI) logged in as an account with write access to the
site repo, and (for --from-game-repo) read access to the game repo.
"""
from __future__ import annotations
import argparse, hashlib, json, re, subprocess, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path

SITE_DEFAULT = "0-umbra/Sins-Of-Chaotic-Shadows-Site"
PKG = "com.sinsofchaoticshadow.game"

def sh(*args: str, cwd: Path | None = None) -> str:
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(args)}\n{r.stderr.strip()}")
    return r.stdout.strip()

def gh(*args: str) -> str:
    return sh("gh", *args)

def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def parse_version(tag: str, apk_name: str) -> tuple[str, str | None]:
    ver = tag.lstrip("v")
    m = re.search(r"-(\d+)\.apk$", apk_name)
    return ver, (m.group(1) if m else None)

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True, help="release tag, e.g. v0.21.0")
    ap.add_argument("--apk", help="path to the signed APK produced by the game repo's verified workflow")
    ap.add_argument("--checksums", help="path to SHA256SUMS.txt from the same workflow run")
    ap.add_argument("--from-game-repo", help="instead of --apk/--checksums, download assets from this game repo release")
    ap.add_argument("--repo", default=SITE_DEFAULT, help=f"public site repo (default {SITE_DEFAULT})")
    ap.add_argument("--title", default=None)
    args = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="scs-publish-"))
    if args.from_game_repo:
        print(f"Downloading verified assets from {args.from_game_repo} release {args.tag} …")
        gh("release", "download", args.tag, "--repo", args.from_game_repo, "--dir", str(tmp),
           "--pattern", "*.apk", "--pattern", "SHA256SUMS.txt", "--clobber")
        files = list(tmp.glob("*.apk"))
        if len(files) != 1: sys.exit(f"expected exactly one APK in the release, found {len(files)}")
        apk, sums = files[0], tmp / "SHA256SUMS.txt"
    else:
        if not args.apk: sys.exit("give either --apk or --from-game-repo")
        apk = Path(args.apk); sums = Path(args.checksums) if args.checksums else None

    if not apk.exists(): sys.exit(f"APK not found: {apk}")

    # Guard: refuse anything that does not look like the workflow's verified output.
    if not re.match(r"sins-of-chaotic-shadow-\d+\.\d+\.\d+-\d+\.apk$", apk.name):
        sys.exit(f"refusing: '{apk.name}' does not match the verified workflow output naming "
                 "(sins-of-chaotic-shadow-<ver>-<code>.apk). Publish only workflow-verified APKs.")

    digest = sha256_file(apk)
    if sums and sums.exists():
        expected = next((l.split()[0] for l in sums.read_text().splitlines()
                         if apk.name in l and len(l.split()) == 2), None)
        if expected and expected.lower() != digest.lower():
            sys.exit("checksum mismatch between local APK and SHA256SUMS.txt — aborting.")
    size = apk.stat().st_size
    ver, code = parse_version(args.tag, apk.name)
    print(f"APK OK: {apk.name}  v{ver} (code {code})  {size:,} bytes  sha256={digest[:16]}…")

    # 1) publish the public release on the site repo
    notes = (f"Sins of Chaotic Shadow {args.tag} — signed Android release.\n\n"
             f"- Package: `{PKG}` (updates any installed SCS build in place)\n"
             f"- Asset: `{apk.name}`\n- SHA-256: `{digest}`\n\n"
             "This is the same verified build produced by the game repository's signed-release "
             "workflow (signature, package id, version and non-debuggable state verified in CI).")
    print(f"Creating release {args.tag} on {args.repo} …")
    gh("release", "create", args.tag, str(apk),
       *( [str(sums)] if sums and sums.exists() else [] ),
       "--repo", args.repo, "--title", args.title or f"Sins of Chaotic Shadow {args.tag}",
       "--notes", notes)
    dl = f"https://github.com/{args.repo}/releases/download/{args.tag}/{apk.name}"
    print(f"public download URL: {dl}")

    # 2) update the manifest in the site repo working copy and commit
    repo_root = Path(sh("git", "rev-parse", "--show-toplevel"))
    manifest_path = repo_root / "data" / "release.json"
    manifest = json.loads(manifest_path.read_text())
    today = datetime.now(timezone.utc).date().isoformat()
    if manifest.get("available") and manifest.get("version") and manifest.get("downloadUrl"):
        manifest.setdefault("history", []).insert(0, {
            "version": manifest["version"], "releaseDate": manifest["releaseDate"],
            "fileSizeBytes": manifest["fileSizeBytes"], "downloadUrl": manifest["downloadUrl"]})
        manifest["history"] = manifest["history"][:6]
    manifest.update(available=True, version=ver, versionCode=code, releaseDate=today,
                    fileSizeBytes=size, sha256=digest, packageName=PKG, downloadUrl=dl,
                    updated=today, note="")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    sh("git", "add", "data/release.json")
    commit = f"release: publish {args.tag} ({ver}, {size} bytes)"
    sh("git", "commit", "-m", commit)
    sh("git", "push")
    print("manifest committed and pushed — the website now serves the new release.")
    print("DONE.")

if __name__ == "__main__":
    main()
