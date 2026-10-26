#!/usr/bin/env python3
"""LEGACY SCS release publisher (GitHub Releases flow).

The live website no longer downloads APKs from GitHub Releases. Current
releases replace `apk/SCS.apk`, edit `apk/release.json`, and let Vercel run
`npm run build` to extract metadata from that APK. This script is retained for
historical/private-workflow use only; do not use it as the normal site release
path. See `docs/RELEASE-FLOW.md` for the active flow.

WHAT THIS DOES
  1. Creates a release on the PUBLIC site repo (0-umbra/Sins-Of-Chaotic-Shadows-Site)
     and attaches the APK + SHA256SUMS so anyone can download it without a GitHub login.
  2. Updates data/release.json in the site repo (version, date, size, SHA-256, URL,
     previous-release history) and commits it, so the website updates automatically.

WHAT THIS NEVER DOES
  - It never uploads, reads or needs the signing keystore or any signing secret.
  - It never invents a fact. Version, size and SHA-256 are computed from the file you
    pass; every other published fact must come from you and is checked before upload
    (see the two modes below). Nothing is published if any check fails.

TWO PUBLISHING MODES
  A. WORKFLOW ARTIFACT — default, strongest guarantee.
     The APK is the output of the game repo's signed-release workflow. The script
     refuses any file that does not match that workflow's output naming, and any file
     whose SHA-256 does not match the workflow's SHA256SUMS.txt.

       # after the game repo published release vX.Y.Z with APK + SHA256SUMS attached:
       python3 scripts/publish-release.py --tag v0.21.0 \
           --apk sins-of-chaotic-shadow-0.21.0-21.apk --checksums SHA256SUMS.txt

       # or pull both assets straight from the game repo release (needs read access):
       python3 scripts/publish-release.py --tag v0.21.0 \
           --from-game-repo 0-umbra/Sins-Of-Chaotic-Shadows

  B. LOCALLY VERIFIED APK — explicit opt-in with --local-apk, for a signed APK built
     outside the game repo CI (e.g. exported straight from Android Studio / a phone).
     No CI verification is claimed anywhere. Instead you must pass the facts that the
     Android verification tools reported for this exact file, plus a checksum file:

       apksigner verify --print-certs SCS.apk     # signer certificate SHA-256 digest
       aapt dump badging SCS.apk | head -1        # package name + versionCode + versionName
       sha256sum SCS.apk > SHA256SUMS.txt

       python3 scripts/publish-release.py --tag v0.21.0 --local-apk --apk SCS.apk \
           --checksums SHA256SUMS.txt --package com.sinsofchaoticshadow.game \
           --version 0.21.0 --version-code 21 --cert-sha256 <64 hex chars>

     The release notes say plainly that the build did not go through CI.

OTHER FLAGS
  --no-push     commit the manifest but do not push (use when publishing via a PR).
  --dry-run     run every check and print the release notes + resulting manifest,
                without creating a release, committing, or pushing anything.

Requirements: python3, `gh` (GitHub CLI) logged in as an account with write access to the
site repo, and (for --from-game-repo) read access to the private game repo.
"""
from __future__ import annotations
import argparse, hashlib, json, mmap, re, subprocess, sys, tempfile, zipfile
from datetime import datetime, timezone
from pathlib import Path

SITE_DEFAULT = "0-umbra/Sins-Of-Chaotic-Shadows-Site"
PKG = "com.sinsofchaoticshadow.game"
# The exact file name the game repo's signed-release workflow produces.
WORKFLOW_APK_RE = re.compile(r"^sins-of-chaotic-shadow-(\d+\.\d+\.\d+)-(\d+)\.apk$")
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")


def sh(*args: str, cwd: Path | None = None) -> str:
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(args)}\n{r.stderr.strip()}")
    return r.stdout.strip()


def sh_ok(*args: str) -> bool:
    return subprocess.run(args, capture_output=True, text=True).returncode == 0


def gh(*args: str) -> str:
    return sh("gh", *args)


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_fingerprint(value: str) -> str:
    """Accept 'AB:CD:EF:…', 'ABCDEF…' or 'sha256:…' and return bare lowercase hex."""
    v = value.strip().lower().replace(":", "").replace(" ", "")
    return v[len("sha256"):] if v.startswith("sha256") else v


def read_checksums(p: Path) -> dict[str, str]:
    """Parse sha256sum-style lines ('<hex>  <name>' / '<hex> *<name>') into name -> hex."""
    out: dict[str, str] = {}
    for line in p.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 2:
            continue
        digest, name = parts[0].lower(), parts[1].lstrip("*")
        if HEX64_RE.match(digest):
            out[Path(name).name] = digest
    return out


def check_apk_container(p: Path) -> None:
    """Cheap structural proof that this is an APK at all (not that it is signed)."""
    try:
        with zipfile.ZipFile(p) as z:
            names = set(z.namelist())
    except zipfile.BadZipFile:
        sys.exit(f"refusing: {p.name} is not a ZIP/APK container.")
    if "AndroidManifest.xml" not in names:
        sys.exit(f"refusing: {p.name} has no AndroidManifest.xml — that is not an Android APK.")


def signature_hint(p: Path) -> tuple[bool, bool]:
    """(looks_signed, looks_debug_key) — cheap heuristics, not a cryptographic check.

    Finds an APK Signing Block (v2/v3: 'APK Sig Block 42' just before the central
    directory) or a v1 JAR signature (META-INF/*.RSA|DSA|EC), and looks for the
    Android debug certificate distinguished name in the raw bytes.
    """
    with p.open("rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        looks_signed = mm.find(b"APK Sig Block 42") != -1
        debug_key = mm.find(b"Android Debug") != -1
    if not looks_signed:
        with zipfile.ZipFile(p) as z:
            looks_signed = any(n.startswith("META-INF/") and n.upper().endswith((".RSA", ".DSA", ".EC"))
                               for n in z.namelist())
    return looks_signed, debug_key


def build_manifest(manifest: dict, *, ver: str, code: str, size: int, digest: str,
                   dl: str, today: str, cert: str | None) -> dict:
    m = json.loads(json.dumps(manifest))  # deep copy, never mutate the input
    if m.get("available") and m.get("version") and m.get("downloadUrl"):
        m.setdefault("history", []).insert(0, {
            "version": m["version"], "releaseDate": m["releaseDate"],
            "fileSizeBytes": m["fileSizeBytes"], "downloadUrl": m["downloadUrl"]})
        m["history"] = m["history"][:6]
    m.update(available=True, version=ver, versionCode=code, releaseDate=today,
             fileSizeBytes=size, sha256=digest, packageName=PKG, downloadUrl=dl,
             updated=today, note="")
    if cert:
        m["certSha256"] = cert
    return m


def build_notes(*, ver: str, code: str, apk: Path, size: int, digest: str,
                cert: str | None, local: bool) -> str:
    facts = [f"- Package: `{PKG}` (updates an installed SCS build in place only if it was "
             f"signed with the same certificate)",
             f"- Asset: `{apk.name}`",
             f"- Version: {ver} (version code {code})",
             f"- Size: {size:,} bytes",
             f"- SHA-256: `{digest}`"]
    if cert:
        facts.append(f"- Signing certificate SHA-256: `{cert}`")
    if local:
        body = [
            f"Sins of Chaotic Shadow v{ver} — signed Android release (locally verified build).",
            "", *facts, "",
            "This APK was built and signed outside the game repository's CI and published directly by "
            "the maintainer. It did **not** go through the automated signature / package-id / version "
            "verification of that pipeline. The values above are what `apksigner verify --print-certs` "
            "and `aapt dump badging` reported for this exact file, and its SHA-256 matches the "
            "`SHA256SUMS.txt` published next to it.",
            "",
            "Verify after downloading: run `sha256sum` (or `certutil -hashfile <file> SHA256`) and compare "
            "with the SHA-256 above.",
        ]
    else:
        body = [
            f"Sins of Chaotic Shadow v{ver} — signed Android release.",
            "", *facts, "",
            "This is the artifact of the game repository's signed-release workflow "
            "(`0-umbra/Sins-Of-Chaotic-Shadows`): the file name matches that workflow's output naming, "
            "and its SHA-256 matches the `SHA256SUMS.txt` produced by the same run, which this publisher "
            "checked before uploading.",
        ]
    return "\n".join(body)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Publish a verified signed SCS APK to the public site repo and update data/release.json.")
    ap.add_argument("--tag", required=True, help="release tag, e.g. v0.21.0")
    ap.add_argument("--apk", help="path to the signed APK")
    ap.add_argument("--checksums", help="path to the SHA256SUMS.txt produced from this exact APK")
    ap.add_argument("--from-game-repo", help="instead of --apk/--checksums, download the assets from this game repo release")
    ap.add_argument("--local-apk", action="store_true",
                    help="publish a signed APK that did NOT come from the game repo CI "
                         "(requires --apk, --checksums, --package, --version, --version-code, --cert-sha256)")
    ap.add_argument("--package", help="(--local-apk) package id verified with aapt, must be %s" % PKG)
    ap.add_argument("--version", help="(--local-apk) versionName verified with aapt, e.g. 0.21.0")
    ap.add_argument("--version-code", help="(--local-apk) versionCode verified with aapt, e.g. 21")
    ap.add_argument("--cert-sha256", help="(--local-apk) signer certificate SHA-256 digest from apksigner")
    ap.add_argument("--repo", default=SITE_DEFAULT, help=f"public site repo (default {SITE_DEFAULT})")
    ap.add_argument("--title", default=None)
    ap.add_argument("--no-push", action="store_true", help="commit the manifest but do not git push")
    ap.add_argument("--dry-run", action="store_true", help="validate + print, publish nothing")
    args = ap.parse_args()

    tag_ver = args.tag.lstrip("v")

    # ---------- resolve the APK + its checksum file ----------
    if args.local_apk and args.from_game_repo:
        sys.exit("--local-apk and --from-game-repo are mutually exclusive: local mode is for APKs "
                 "that never went through the game repo.")
    if args.from_game_repo:
        tmp = Path(tempfile.mkdtemp(prefix="scs-publish-"))
        print(f"Downloading verified assets from {args.from_game_repo} release {args.tag} …")
        gh("release", "download", args.tag, "--repo", args.from_game_repo, "--dir", str(tmp),
           "--pattern", "*.apk", "--pattern", "SHA256SUMS.txt", "--clobber")
        files = list(tmp.glob("*.apk"))
        if len(files) != 1:
            sys.exit(f"expected exactly one APK in the release, found {len(files)}")
        apk, sums = files[0], tmp / "SHA256SUMS.txt"
        if not sums.exists():
            sys.exit("that release has no SHA256SUMS.txt — refusing to publish an artifact without a checksum.")
    else:
        if not args.apk:
            sys.exit("give --apk (with --checksums), or --from-game-repo, or --local-apk --apk …")
        apk = Path(args.apk)
        if not args.checksums:
            sys.exit("--checksums <SHA256SUMS.txt> is required: the published SHA-256 must be backed by a "
                     "checksum file produced from this exact APK "
                     "(`sha256sum SCS.apk > SHA256SUMS.txt`).")
        sums = Path(args.checksums)

    if not apk.exists():
        sys.exit(f"APK not found: {apk}")
    if not sums.exists():
        sys.exit(f"checksum file not found: {sums}")

    # ---------- facts computed from the actual file ----------
    digest = sha256_file(apk)
    size = apk.stat().st_size
    if size == 0:
        sys.exit(f"refusing: {apk.name} is empty.")
    listed = read_checksums(sums).get(apk.name)
    if listed is None:
        sys.exit(f"'{apk.name}' has no entry in {sums.name} — refusing. The checksum file must be "
                 f"produced from this exact file (name and bytes).")
    if listed != digest:
        sys.exit(f"checksum mismatch for {apk.name}: {sums.name} says {listed}, the file is {digest} — aborting.")
    check_apk_container(apk)

    # ---------- existing manifest (drives cert pinning + downgrade guards) ----------
    repo_root = Path(sh("git", "rev-parse", "--show-toplevel"))
    manifest_path = repo_root / "data" / "release.json"
    manifest = json.loads(manifest_path.read_text())

    # ---------- version facts: workflow naming, or operator-verified local facts ----------
    cert: str | None = None
    if args.local_apk:
        needed = [("--package", args.package), ("--version", args.version),
                  ("--version-code", args.version_code)]
        if manifest.get("certSha256"):
            needed.append(("--cert-sha256", args.cert_sha256))
        missing = [f for f, v in needed if not v]
        if missing:
            sys.exit("--local-apk requires " + ", ".join(missing) +
                     " — pass the values reported by `aapt dump badging` and `apksigner verify "
                     "--print-certs`.")
        if args.package != PKG:
            sys.exit(f"--package is '{args.package}' but this site publishes '{PKG}' only. A different package "
                     "id is a different app and will not update existing installs.")
        if args.version != tag_ver:
            sys.exit(f"--version {args.version} does not match tag {args.tag} — refusing to publish a "
                     "release labelled with a version it does not contain.")
        if not args.version_code.isdigit():
            sys.exit(f"--version-code must be a positive integer, got '{args.version_code}'.")
        if args.cert_sha256:
            cert = normalize_fingerprint(args.cert_sha256)
            if not HEX64_RE.match(cert):
                sys.exit("--cert-sha256 must be the 64-hex-character SHA-256 digest of the signing "
                         "certificate (as printed by `apksigner verify --print-certs`), with or without colons.")
        ver, code = args.version, args.version_code
        mode = "local"
    else:
        m = WORKFLOW_APK_RE.match(apk.name)
        if not m:
            sys.exit(f"refusing: '{apk.name}' does not match the verified workflow output naming "
                     "(sins-of-chaotic-shadow-<ver>-<code>.apk).\n"
                     "If this APK did not come from the game repo's signed-release workflow, publish it "
                     "with --local-apk and the verification facts from apksigner/aapt instead of renaming "
                     "the file to look like a CI artifact.")
        file_ver, file_code = m.group(1), m.group(2)
        if file_ver != tag_ver:
            sys.exit(f"tag {args.tag} and artifact version {file_ver} disagree — refusing to publish a "
                     "release labelled with a version it does not contain.")
        ver, code = tag_ver, file_code
        if args.cert_sha256:
            cert = normalize_fingerprint(args.cert_sha256)
            if not HEX64_RE.match(cert):
                sys.exit("--cert-sha256 must be 64 hex characters.")
        mode = "workflow"

    print(f"APK OK: {apk.name}  v{ver} (code {code})  {size:,} bytes  sha256={digest}")
    print(f"source: {'locally signed build (not CI-verified)' if mode == 'local' else 'game-repo signed-release workflow'}")

    signed, debug_key = signature_hint(apk)
    if not signed:
        sys.exit("refusing: no APK signature found (neither an APK Signing Block nor a v1 META-INF "
                 "signature). Android will not install this file, and it is not a release build.")
    if debug_key:
        print("WARNING: the bytes of this file contain the Android debug certificate name — it looks "
              "like a debug-signed build. Publishing a debug build is not a release. Ctrl-C now if that "
              "is not what you intend.", file=sys.stderr)

    try:
        prev_code = int(manifest.get("versionCode"))
    except (TypeError, ValueError):
        prev_code = None
    if prev_code is not None and int(code) <= prev_code:
        sys.exit(f"version code {code} is not greater than the published version code {prev_code}. "
                 "Android will not install a same-or-lower version over an existing install — bump "
                 "the version instead of republishing.")

    # ---------- refuse to overwrite a published release ----------
    if sh_ok("gh", "release", "view", args.tag, "--repo", args.repo):
        sys.exit(f"release {args.tag} already exists on {args.repo}. Bump the version instead of replacing "
                 "an existing public release — links and checksums already handed out must stay valid.")

    # ---------- signing-certificate continuity ----------
    if cert and manifest.get("certSha256") and manifest["certSha256"] != cert:
        sys.exit("signing certificate mismatch: the manifest was published with certificate "
                 f"{manifest['certSha256']} and this APK is signed by {cert}.\n"
                 "Installs would fail to update in place. Publish with the same keystore; if you really "
                 "rotated keys on purpose, remove 'certSha256' from data/release.json in the same commit "
                 "and say so in the release notes.")

    if not cert and not manifest.get("certSha256"):
        print("WARNING: no signing certificate pinned for this release. Add --cert-sha256 on the first "
              "release and future ones can be checked against it (the script then refuses an APK signed "
              "with a different key).", file=sys.stderr)

    dl = f"https://github.com/{args.repo}/releases/download/{args.tag}/{apk.name}"
    today = datetime.now(timezone.utc).date().isoformat()
    notes = build_notes(ver=ver, code=code, apk=apk, size=size, digest=digest, cert=cert, local=mode == "local")
    new_manifest = build_manifest(manifest, ver=ver, code=code, size=size, digest=digest,
                                  dl=dl, today=today, cert=cert)

    if args.dry_run:
        print("\n--- dry run: nothing created, committed or pushed ---")
        print(f"would create release {args.tag} on {args.repo} with {apk.name}"
              + (f" + {sums.name}" if sums.exists() else "") + " and these notes:\n")
        print(notes)
        print("\n--- data/release.json after publishing ---")
        print(json.dumps(new_manifest, indent=2))
        print(f"\n--- public download URL ---\n{dl}")
        return

    # ---------- 1) publish the public release on the site repo ----------
    print(f"Creating release {args.tag} on {args.repo} …")
    gh("release", "create", args.tag, str(apk), str(sums),
       "--repo", args.repo, "--title", args.title or f"Sins of Chaotic Shadow {args.tag}",
       "--notes", notes)

    # ---------- verify the upload really holds the file we measured ----------
    release = json.loads(gh("release", "view", args.tag, "--repo", args.repo, "--json", "assets,url"))
    assets = {a["name"]: a for a in release.get("assets", [])}
    asset = assets.get(apk.name)
    if not asset or asset.get("size") != size:
        sys.exit(f"upload verification failed: '{apk.name}' is not attached with {size:,} bytes "
                 f"(assets: {sorted(assets)}). Manifest NOT updated — inspect the release on {args.repo}.")
    print(f"release verified: {asset.get('url')} ({asset['size']:,} bytes)")

    # ---------- 2) update the manifest and commit ----------
    manifest_path.write_text(json.dumps(new_manifest, indent=2) + "\n")
    sh("git", "add", "data/release.json")
    sh("git", "commit", "-m", f"release: publish {args.tag} ({ver}, {size} bytes)")
    if args.no_push:
        print("manifest committed (not pushed, --no-push). Open a PR / push the branch when ready.")
    else:
        sh("git", "push")
        print("manifest committed and pushed — the website now serves the new release.")
    print(f"public download URL: {dl}")
    print("DONE. Verify with a private browser window and `sha256sum` the downloaded file.")


if __name__ == "__main__":
    main()
