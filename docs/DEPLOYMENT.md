# Deployment — SCS Official Site

The site remains plain HTML/CSS/JS plus the APK and public assets. It now has one
tiny, dependency-free build step: `npm run build` reads `apk/SCS.apk`, generates
`data/apk-metadata.json`, refreshes `data/release.json`, and stages the static
site into `dist/`. No environment variables, secrets, serverless functions or
runtime npm dependencies are required.

## Vercel (recommended)

The repository’s `vercel.json` pins everything needed, so a re-imported project
does not depend on dashboard defaults:

- Framework Preset: **Other** (`"framework": null`)
- Install Command: `npm install --ignore-scripts --no-audit --no-fund --no-package-lock`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: **none required**

To deploy:

1. Sign in at https://vercel.com with your GitHub account.
2. **Add New → Project** → import `0-umbra/Sins-Of-Chaotic-Shadows-Site`.
3. Keep the overrides from `vercel.json` (or enter the values above).
4. Deploy. Vercel assigns a production URL; a custom domain can be attached in
   **Settings → Domains**.

`vercel.json` also sets security headers, long image/media caching, `no-store`
for `/data/*.json` and `/apk/*.json`, and the APK MIME type /
`Content-Disposition: attachment` header for `/apk/SCS.apk`. Generated JSON uses
no-store so a new release appears immediately without a stale CDN copy.

### What the build produces

`dist/` is a complete copy of the existing static site (so no asset paths
change) plus freshly generated metadata. It is gitignored and rebuilt on every
deployment. Sensitive local files such as `.env`, key/keystore files and Git
credentials are explicitly excluded from the staged output.

## GitHub Pages (alternative)

GitHub Pages does not run this repository’s Vercel build command. If you use
Pages, either publish the generated `dist/` directory via a small Actions
workflow, or run `npm run build` locally and publish `dist/` as the site root.
Serving the source root without rebuilding will show the committed fallback
metadata rather than facts from a newly replaced APK.

Pages also caches aggressively; after a release, hard-refresh or bust the cache
to see the new JSON files.

## Verification checklist (after deployment)

- [ ] Open the production URL in a private/incognito window — no auth prompt, page loads.
- [ ] The Download section shows `SCS vX.X.X`, the generated version code,
      calculated APK size and release date; no stale hardcoded values remain.
- [ ] `curl -sSI https://<deployment>/apk/SCS.apk` returns `200` with
      `content-type: application/vnd.android.package-archive` and
      `content-disposition: attachment`. Its `content-length` equals
      `data/apk-metadata.json → fileSizeBytes`.
- [ ] `curl -s https://<deployment>/data/apk-metadata.json` matches
      `versionName`/`versionCode` from the APK’s `AndroidManifest.xml` and the
      real byte size / SHA-256 of the served file.
- [ ] `curl -s https://<deployment>/apk/release.json` returns the current
      `whatsNew` list, and the page renders every item.
- [ ] Click **Download Latest Android APK** on an Android browser. The browser
      downloads an `.apk` file directly, not an HTML page.
- [ ] Lighthouse/mobile check: no horizontal scroll at 320–430px, the Download
      button is at least 44px high, and the What’s New list wraps cleanly.
- [ ] Temporarily invalidating `apk/release.json` in a preview must not break
      the page or the APK download; release notes show a fallback message.
