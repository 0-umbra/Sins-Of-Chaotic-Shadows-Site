# APK distribution

This directory hosts the Android APK served by this website itself
(no GitHub Release involved):

- **File to upload:** `SCS.apk` — into this `apk/` directory, so the
  final path in the repo is exactly `apk/SCS.apk` (case-sensitive).
- **Public URL once deployed:** `https://sinsofchaoticshadows.vercel.app/apk/SCS.apk`
  (Vercel serves the repo root as static files; `vercel.json` sets the
  APK content type, a download disposition, and revalidation caching
  for this exact path).
- **Download button:** `data/release.json` → `downloadUrl` is `/apk/SCS.apk`,
  and `js/main.js` enables the button only after a `HEAD` request confirms
  the file is actually being served. Until the real `SCS.apk` is uploaded,
  the site honestly shows its "not available yet" state instead of a
  broken link. No placeholder APK is, or ever should be, committed here.

## How to publish (manual)

1. Upload the signed APK here as `SCS.apk` (git, or GitHub web UI:
   open this `apk/` folder → **Add file → Upload files** → commit).
2. Make sure `data/release.json` describes that exact file — `version`,
   `versionCode`, `releaseDate`, `fileSizeBytes`, `sha256`, `certSha256`,
   `updated`. Leave `downloadUrl` as `/apk/SCS.apk`.
   (Verify with `sha256sum apk/SCS.apk` and compare to the manifest.)
3. Push/merge to `main`. Vercel redeploys and the download button goes
   live on its own — no code change needed.

For future versions, replace `apk/SCS.apk` with the new signed build
(same filename) and update the manifest fields in step 2. Do not use the
old `scripts/publish-release.py` flow for this — that script published
to GitHub Releases, which this site no longer uses for the APK.
