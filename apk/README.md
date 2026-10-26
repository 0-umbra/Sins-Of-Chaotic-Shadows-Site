# APK distribution

This directory holds the Android APK served by this website itself — no GitHub
Release, expiring URL or login is involved.

| File | Purpose |
| --- | --- |
| `SCS.apk` | The signed APK served at `/apk/SCS.apk`. Replace this file for a new release; keep the exact case-sensitive name. |
| `release.json` | Human-written `releaseDate` and `whatsNew` list. It **must not** contain version, version code, file size or checksum. |

`vercel.json` sets the APK MIME type, `Content-Disposition: attachment`, and
revalidation caching for `/apk/SCS.apk`. All download buttons are plain
`<a href="/apk/SCS.apk" download>` links, so Android browsers work even when
JavaScript is unavailable.

## Automatic metadata

`npm run build` (run automatically by Vercel) executes
`scripts/generate-apk-metadata.mjs`. It reads the actual `apk/SCS.apk`:

- `versionName`, `versionCode`, `packageName`, `minSdkVersion`, `targetSdkVersion`
  from the APK’s binary `AndroidManifest.xml`;
- `fileSizeBytes` and human-readable `fileSize` from the file itself;
- `sha256` from the file bytes;
- `releaseDate` from `apk/release.json` (or the APK’s Git commit date / build
  date as a fallback).

The generator writes `data/apk-metadata.json`, refreshes the legacy
`data/release.json`, and stages the static site in `dist/`. The browser fetches
the two small JSON files — it never downloads the whole APK just to show its
version. Generated version/size/checksum values are committed only as a local
fallback; Vercel always regenerates them from the current APK.

Example `apk/release.json`:

```json
{
  "releaseDate": "2026-10-22",
  "whatsNew": [
    "Added new playable characters",
    "Improved low-end Android performance",
    "Fixed settings and controls bugs"
  ]
}
```

`releaseDate` is optional. If omitted or invalid, the build uses the Git commit
date of the last APK change when available, then a Vercel/build-environment
date. Filesystem and ZIP timestamps are not trusted because reproducible builds
often fix them to 1981.

## Publish a new release

1. Replace `apk/SCS.apk` with the new signed APK.
2. Edit the `whatsNew` list in `apk/release.json`. Update `releaseDate` if you
   want to pin an explicit release day. Do **not** add version or size fields.
3. Push to GitHub. Vercel runs `npm run build`, which refreshes all version,
   version-code, size, checksum and date display values automatically.

Run `npm run build` locally to preview the generated facts, then
`python3 -m http.server 8080 --directory dist --bind 0.0.0.0`.

## Graceful failure

- Missing `apk/SCS.apk`: generated metadata has `available: false`; the site
  says “Latest APK currently unavailable.” and disables download links.
- Missing/invalid `apk/release.json`: release notes show a safe fallback; the
  APK download still works.
- Unreadable `AndroidManifest.xml`: size and checksum are still real, version
  fields show “Unavailable”, and the direct download stays active.

`data/release.json` remains for legacy scripts and an optional manual
kill-switch (`"available": false`). Its generated fields are overwritten on
every build; do not hand-edit them. The old `scripts/publish-release.py`
GitHub-Releases flow is legacy and is not part of the active release path.
