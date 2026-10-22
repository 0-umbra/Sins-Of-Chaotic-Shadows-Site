# Release flow — from game build to public download

The game source lives in the **private** `Sins-Of-Chaotic-Shadows` repo. The public site
repo never sees game source — only the **verified signed APK** that gets published here.

## The pipeline (one release, end to end)

```
GAME REPO (private)                          SITE REPO (public)
─────────────────────                        ──────────────────
push tag v0.21.0
   │
"Android signed release APK" workflow
   • builds release APK (Capacitor + Gradle)
   • apksigner verify + package id check
     (com.sinsofchaoticshadow.game)
   • version match vs build.gradle
   • refuses debuggable / unsigned builds
   • optional cert-continuity guard
   │
GitHub Release (private repo)  ──manual──▶  scripts/publish-release.py
(clearly not public at this point)             1. copies APK + SHA256SUMS to a
                                                  PUBLIC Release on the site repo
   │                                            2. updates data/release.json
   │                                            3. commits + pushes the manifest
   ▼
Website picks up the new manifest automatically:
version, date, size, SHA-256 and the Download button
now point at the new public APK.
```

Key properties:

- **No GitHub login needed** — visitors download from the *public site repo's* Releases,
  which keep working even after the game repo is private.
- **No expiring links** — the download URL is a permanent
  `github.com/<site-repo>/releases/download/<tag>/<file>` URL, never an Actions artifact.
- **No invented facts** — version, size and SHA-256 are computed from the file being
  published. Anything the script cannot prove is either refused or made explicit in the
  release notes.
- **Failed builds change nothing** — if a build fails, no tag/release exists, the script
  isn't run, and the previous valid release stays live.
- **Previous releases preserved** — `data/release.json` keeps a `history` of the last
  valid releases with direct links.

## Two publishing modes

`scripts/publish-release.py` supports exactly two ways in, and they are not
interchangeable — pick the one that describes where your APK actually came from.

| | A — workflow artifact (default) | B — locally verified APK (`--local-apk`) |
|---|---|---|
| Use when | the APK was produced by the game repo's signed-release workflow | the signed APK exists only as a file (Android Studio export, copy on a phone) and did **not** go through that workflow |
| File name | must be `sins-of-chaotic-shadow-<ver>-<code>.apk` | any name, e.g. `SCS.apk` |
| Checksums | `SHA256SUMS.txt` from the same workflow run, must match | `SHA256SUMS.txt` you generate from this exact file, must match |
| Package id | taken from the workflow output name | you must pass `--package` (must be `com.sinsofchaoticshadow.game`) |
| Version | parsed from the file name, must agree with `--tag` | you must pass `--version` (must agree with `--tag`) and `--version-code` |
| Signature | verified by CI before upload | **not verified** — the certificate digest is recorded if you pass `--cert-sha256` |
| Release notes | state the CI workflow verified the build | state plainly that the APK was **not** CI-verified and list what the signer reported |

What both modes refuse in every case:

- a file that is not an APK (no `AndroidManifest.xml`), or that shows no signature
  (no APK Signing Block and no `META-INF/*.RSA|DSA|EC`)
- a checksum file that has no entry for the APK, or whose entry does not match the file
- a tag whose version disagrees with the APK's version
- a package id other than `com.sinsofchaoticshadow.game` (a different id is a different
  app and will not update existing installs)
- a version code that is not greater than the version code already published
- a release tag that already exists on the site repo (links/checksums already handed out
  stay valid; bump the version instead)
- a signing certificate different from the one pinned in `data/release.json`
  (`certSha256`), once one is pinned

Run with `--dry-run` to execute every check and print the release notes + the resulting
`data/release.json` without creating, committing or pushing anything.

## Option A — workflow artifact (recommended)

1. In the **game repo**: finish the build on the `android-capacitor` branch (or `main`),
   then cut the release:
   ```bash
   git tag v0.21.0 && git push origin v0.21.0
   ```
2. Wait for the **“Android signed release APK”** workflow to finish green. It attaches
   `sins-of-chaotic-shadow-<ver>-<code>.apk` and `SHA256SUMS.txt` to the game repo's release.
3. In a checkout of **this site repo** (with `gh` authenticated and write access):
   ```bash
   python3 scripts/publish-release.py --tag v0.21.0 \
       --from-game-repo 0-umbra/Sins-Of-Chaotic-Shadows
   ```
   or, if you already have the two files:
   ```bash
   python3 scripts/publish-release.py --tag v0.21.0 \
       --apk sins-of-chaotic-shadow-0.21.0-21.apk --checksums SHA256SUMS.txt
   ```
4. Verify: the site's Download section shows the new version/size/date; the button
   downloads the actual APK in a private/incognito browser; `sha256sum` of the file
   matches the published checksum.

No access to the game repo is needed for the `--apk/--checksums` variant — only the two
files and a `gh` login with write access to the site repo. `--from-game-repo` additionally
needs read access to the private game repo.

## Option B — publish a signed APK you already have

This exists because a signed APK does not always come out of the game repo CI (builds cut
in Android Studio, or a file that only exists on a phone). **The script cannot verify a
signature on its own**, so it does the next best thing: it takes the facts the Android
verification tools report, checks them against each other, and never claims CI verified
anything.

You must supply four facts. Do not guess them — read them off the tool output:

| Fact | Tool | Expected form |
|---|---|---|
| SHA-256 of the file | `sha256sum SCS.apk` | 64 hex chars, written into `SHA256SUMS.txt` |
| Package id | `aapt dump badging SCS.apk \| head -1` | `com.sinsofchaoticshadow.game` |
| Version name / code | same line | `versionCode='21' versionName='0.21.0'` |
| Signing certificate SHA-256 | `apksigner verify --print-certs SCS.apk` | `Signer #1 certificate SHA-256 digest: …` |

Then, in a checkout of the site repo:

```bash
python3 scripts/publish-release.py --tag v0.21.0 --local-apk \
    --apk /path/to/SCS.apk --checksums /path/to/SHA256SUMS.txt \
    --package com.sinsofchaoticshadow.game --version 0.21.0 --version-code 21 \
    --cert-sha256 4A:1F:…   # full 64-hex digest printed by apksigner (colons optional)
```

`--cert-sha256` is optional on the very first release (nothing is pinned yet) and
required afterwards, so a later APK signed with a different keystore can never be
published silently. The publisher also stores the digest in `data/release.json` as
`certSha256`.

### Option B on the phone itself (Termux, no PC)

Everything runs on the Android device; the APK never leaves it except as a GitHub
Release asset.

1. Install [Termux](https://termux.dev) from F-Droid (the Play Store build is outdated).
2. Install the tools and give Termux storage access:
   ```bash
   pkg update && pkg install -y git gh python aapt apksigner
   termux-setup-storage     # grant the permission prompt
   ```
3. Copy the APK into Termux's home and fingerprint it:
   ```bash
   cd ~ && cp ~/storage/downloads/SCS.apk .
   sha256sum SCS.apk | tee SHA256SUMS.txt
   aapt dump badging SCS.apk | head -1            # package + versionCode + versionName
   apksigner verify --print-certs SCS.apk         # certificate SHA-256 digest
   ```
   If `apksigner` is unavailable, `pkg install openjdk-17` gives you
   `keytool -printcert -jarfile SCS.apk`, which prints the same SHA-256 line —
   it only sees the v1 (JAR) signature, so it can say "not a signed jar" for a
   v2/v3-only APK.
4. Log in `gh` and clone the site repo:
   ```bash
   gh auth login
   gh auth setup-git
   git clone https://github.com/0-umbra/Sins-Of-Chaotic-Shadows-Site.git
   cd Sins-Of-Chaotic-Shadows-Site
   ```
5. Dry-run first, then publish:
   ```bash
   python scripts/publish-release.py --tag v0.21.0 --local-apk \
       --apk ~/SCS.apk --checksums ~/SHA256SUMS.txt \
       --package com.sinsofchaoticshadow.game --version 0.21.0 --version-code 21 \
       --cert-sha256 <paste the digest> --dry-run
   ```
   drop `--dry-run` when the notes and manifest it prints are correct. The script creates
   the public release on this repo, verifies the uploaded asset, writes
   `data/release.json` and pushes it.
6. If `main` is protected (no direct pushes), add `--no-push`, then open a PR from the
   branch it committed to and merge it — Vercel redeploys on merge.

> Keep the keystore that signed the APK. Every future release must be signed with the
> same certificate or Android will refuse to update an installed copy in place.

## Optional full automation

The manual `publish-release.py` step can be automated with a GitHub Actions workflow in
the **game repo** that triggers after a successful release publish, downloads its own APK
asset, creates the release on the site repo, and commits the manifest update.

Setup (only if you want it):

1. Create a **fine-grained PAT** limited to: repository access = *only*
   `Sins-Of-Chaotic-Shadows-Site`, permission = Contents: Read and write.
2. Add it as a secret named `SCS_SITE_PUBLISH_TOKEN` in the **game repo**
   (Settings → Secrets and variables → Actions). A private repo is the right place for
   it — never put a token in this public repo.
3. Copy `docs/workflows/site-publish.yml.example` (in this repo) to
   `.github/workflows/site-publish.yml` in the **game repo** and adjust nothing else.

Without that step, the manual script flow above is the supported path — it is one command.
