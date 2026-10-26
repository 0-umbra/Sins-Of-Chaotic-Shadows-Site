# Sins of Chaotic Shadow — Official Site

The public website for **Sins of Chaotic Shadow (SCS)**: game overview, showcase galleries,
patch notes, Android compatibility guide, and a direct no-login download of the latest
**signed Android APK** (`/apk/SCS.apk`).

This repository is **deliberately separate** from the private game repository
(`Sins-Of-Chaotic-Shadows`). It contains **only** website code and approved public assets.
No game source code, no private configuration, and no signing material ever belongs here.

## What's on the site

1. **Cinematic Homepage (`#top`, `#trailer`)** — Atmospheric dark/crimson FPS theme, distortion-free
   SCS emblem (`<picture>` responsive WebP + PNG fallback), direct working APK download button whose
   version, version code and file size come from the actual APK at build time, subtle motion,
   and an in-build gameplay showcase trailer (`media/scs-gameplay-trailer.mp4`, `object-fit: contain`)
   with chapter controls.
2. **What's New in This Build (`#whatsNew`, inside `#download`)** — Mobile-friendly current notes
   loaded from `apk/release.json`. The original Part 4 + Part 5 technical notes and honest limits
   remain available in a clearly labelled historical archive beneath the current list.
3. **Updates & Patch Notes (`#updates`)** — Filterable newest-first version history (`0.23.0` down
   to `0.20.0`), new features, maps, arsenal, performance passes, bug fixes, known issues, and
   individual release download links.
4. **Game Showcase (`#showcase`, `#maps`, `#modes`, `#weapons`, `#abilities`, `#gallery`)** —
   - **Tactical Maps (`#maps`)**: Filterable across all 5 maps (**Umbra Crossing**, **Neon Veil**,
     **Foundry Siege**, **Ironfall Industries**, and planned future arena **Sunken Meridian**). Each
     map shows only its own authentic capture (`object-fit: contain`) or a clearly labelled 16:9
     placeholder — never reusing another map's screenshot.
   - **Interactive Arsenal (`#weapons`)**: 15 verified firearms across 5 classes plus the **11-Blade
     Melee Collection** (`Lv 1`–`Lv 27`) with an honest dedicated placeholder while public melee
     captures are pending.
   - **Tactical Abilities (`#abilities`)**: Interactive 3-Resonator / 9-ability kit viewer (**Vex**,
     **Aura**, **Rift**).
   - **Gameplay Screenshots (`#gallery`)**: Full 16:9 uncropped build captures (`800w` + `1600w`
     responsive WebP with JPG fallback, `object-fit: contain`) and keyboard/touch-swipe lightbox.
5. **News & Community (`#community`)** — Development announcements, planned roadmap items,
   **Issue Reporting — Under Development** status notice (no nonfunctional submission form),
   planned community channels (**Discord Server**, **Instagram**, **YouTube** marked *Coming Soon*),
   and direct clickable [Contact the Developer on Discord](https://discord.com/users/1341279384535044097)
   links.
6. **Android Compatibility & Performance (`#compatibility`)** — Manifest-verified Android
   requirements (`minSdkVersion 24` / Android 7.0+, `targetSdkVersion 36` / Android 16, WebGL,
   Sensor Landscape), in-game Render Control options, low-end GPU optimization profile, and
   troubleshooting for lag, crashes, Play Protect installation, and in-place updates.

## Project layout

```
├── index.html                  single-page site (no framework, no CDN — fully self-contained)
├── css/style.css               dark/crimson tactical FPS design system (aspect-ratio safe, responsive)
├── js/main.js                  generated metadata, changelog & community loaders, trailer, tabs, lightbox
├── apk/SCS.apk                 verified signed Android APK served directly at /apk/SCS.apk
├── apk/release.json            ★ human-written releaseDate + whatsNew list only (no version/size)
├── data/apk-metadata.json      generated from apk/SCS.apk by npm run build; committed as a local fallback
├── data/release.json           generated legacy manifest + human kill-switch/history/cert config
├── data/community.json         developer Discord contact URL, coming-soon channels & trailer config
├── package.json                build/test/check scripts (no runtime dependencies)
├── scripts/generate-apk-metadata.mjs dependency-free APK/AXML reader, JSON generator, dist staging
├── scripts/apk_manifest.py     independent Python AXML reader used by integrity checks
├── scripts/test-apk-metadata.mjs synthetic-APK metadata regression tests
├── scripts/check-site.py       dependency-free structural, image, map, APK & content integrity suite
├── scripts/check-responsive.cjs optional Playwright multi-viewport browser regression suite
├── dist/                       generated Vercel output directory (gitignored)
├── vercel.json                 Vercel build + static deployment config (security/APK/cache headers)
└── docs/                       deployment, release flow, changelog provenance & privacy runbooks
```

## How downloads work

- Every download link is a plain `<a href="/apk/SCS.apk" download>` so Android browsers receive
  the current APK even without JavaScript. `vercel.json` also sends the correct APK MIME type and
  `Content-Disposition: attachment`.
- `npm run build` runs `scripts/generate-apk-metadata.mjs` during the Vercel build. It opens
  `apk/SCS.apk`, decodes its binary `AndroidManifest.xml` for `versionName`, `versionCode`, package
  and SDK levels, measures the real byte size / human-readable size / SHA-256, and writes
  `data/apk-metadata.json`. No APK is downloaded by the browser just to read its version.
- `apk/release.json` contains only `releaseDate` and `whatsNew`. The site fetches it for the
  current release notes. It never contains a duplicated version, version code, size or checksum.
- `data/release.json` is refreshed automatically for backward compatibility. Its `available`
  field remains an optional human kill-switch; setting it to `false` disables links and shows
  “Latest APK currently unavailable.”
- Missing APK, missing/invalid `apk/release.json`, or unreadable binary manifest metadata produce
  safe UI fallbacks rather than a broken page. When the APK itself still exists, the direct download
  stays active.

## Publishing a new APK

1. Replace `apk/SCS.apk` with the new signed APK (same case-sensitive filename).
2. Edit only the `whatsNew` list in `apk/release.json`. Update its optional `releaseDate` if you
   want an explicit date; omit it to fall back to the APK’s Git commit date / build date.
3. Push the change. Vercel runs `npm run build`, generates fresh metadata, and serves `dist/`.

Never edit version, version code, file size or SHA-256 in HTML, CSS, JS or `apk/release.json`.

## Configuring social & community links

Edit `data/community.json` to update `developerDiscordUrl` or publish official community URLs for
`discord`, `instagram`, or `youtube` once live. Empty strings (`""`) keep planned channels marked
`COMING SOON` rather than exposing broken or premature links.

## Local development & testing

Still a static site, but it now has one tiny dependency-free build step that generates release
facts and stages the deployable output. Run it before previewing `dist/` or checking integrity:

```bash
npm run build                           # extract APK metadata + stage dist/
npm run check                           # build, integrity, JS syntax, metadata regression tests
python3 -m http.server 8080 --directory dist --bind 0.0.0.0
```

`npm run check` runs `python3 scripts/check-site.py`, `node --check` on browser/test JS, and
`node --test scripts/test-apk-metadata.mjs`. The optional `scripts/check-responsive.cjs`
Playwright suite checks 11 viewport sizes when a browser is installed.

## Deployment

Recommended: **Vercel**. `vercel.json` pins Framework Preset = Other, Build Command = `npm run build`,
and Output Directory = `dist`. The build has no npm dependencies, environment variables, secrets or
serverless functions. See `docs/DEPLOYMENT.md` for the dashboard-equivalent settings.

## License

Site code: MIT (see `LICENSE`). Game name, logo, screenshots and media:
© 2026 SCS project (`0-umbra`), all rights reserved.

Support: [Contact the Developer on Discord](https://discord.com/users/1341279384535044097).
