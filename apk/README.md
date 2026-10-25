# APK distribution

This directory hosts the Android APK served by this website itself
(no GitHub Release involved):

- **File to upload:** `SCS.apk` — into this `apk/` directory, so the
  final path in the repo is exactly `apk/SCS.apk` (case-sensitive).
- **Public URL once deployed:** `https://sinsofchaoticshadows.vercel.app/apk/SCS.apk`
  (Vercel serves the repo root as static files; `vercel.json` sets the
  APK content type, a download disposition, and revalidation caching
  for this exact path).
- **Download button:** the buttons are plain `<a href="/apk/SCS.apk" download>`
  links, so they work without JavaScript. `js/main.js` then fetches
  `data/release.json` to print the file name, exact byte size, checksum and
  version, and to honour the `"available": false` kill-switch. If the manifest
  cannot be fetched the buttons keep their direct link and an honest status
  message is shown — never a broken link. No placeholder APK is, or ever
  should be, committed here.

## Currently published file

| Field | Value (measured from `apk/SCS.apk`) |
| --- | --- |
| File name | `SCS.apk` |
| Size | `5,901,720` bytes (`5.63 MB`) |
| SHA-256 | `820cd45bd918697f05dda8771e7df8da856b044505668ac6fd70bfcf24e72220` |
| versionName / versionCode | `0.22.1` / `3` (from `AndroidManifest.xml`) |
| Package | `com.sinsofchaoticshadow.game` |
| Signer cert SHA-256 | `2e868ac5056906ddfddf8be00bdc1a89629cbec335a38d5cb621f638b1a28018` (unchanged, matches `certSha256`) |

Re-verify at any time:

```bash
sha256sum apk/SCS.apk                                   # must equal data/release.json sha256
stat -c '%s' apk/SCS.apk                                # must equal data/release.json fileSizeBytes
python3 scripts/check-site.py                           # fails if either disagrees
```

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
