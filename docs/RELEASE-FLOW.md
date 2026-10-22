# Release flow — from game build to public download

The game source lives in the **private** `Sins-Of-Chaotic-Shadows` repo. The public site
repo never sees game source — only the **verified signed APK** that the game repo's CI
produces and publishes.

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
- **No unsigned builds** — the publisher script refuses APKs that don't match the
  workflow's verified output naming and checksums.
- **Failed builds change nothing** — if a build fails, no tag/release exists, the script
  isn't run, and the previous valid release stays live.
- **Previous releases preserved** — `data/release.json` keeps a `history` of the last
  valid releases with direct links.

## Step by step (per release)

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
   (or pass `--apk`/`--checksums` paths manually if you prefer).
4. Verify: the site's Download section shows the new version/size/date; the button
   downloads the actual APK in a private/incognito browser; `sha256sum` of the file
   matches the published checksum.

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
