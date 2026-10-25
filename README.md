# Sins of Chaotic Shadow — Official Site

The public website for **Sins of Chaotic Shadow (SCS)**: game overview, showcase galleries,
patch notes, Android compatibility guide, and a direct no-login download of the latest
**signed Android APK** (`/apk/SCS.apk`).

This repository is **deliberately separate** from the private game repository
(`Sins-Of-Chaotic-Shadows`). It contains **only** website code and approved public assets.
No game source code, no private configuration, and no signing material ever belongs here.

## What's on the site

1. **Cinematic Homepage (`#top`, `#trailer`)** — Atmospheric dark/crimson FPS theme, distortion-free
   SCS emblem (`<picture>` responsive WebP + PNG fallback), direct working APK download button with
   verified version (`0.22.1`) and actual file size (`SCS.apk` · `7.86 MB` / `8,244,435` bytes), subtle motion,
   and an in-build gameplay showcase trailer (`media/scs-gameplay-trailer.mp4`, `object-fit: contain`)
   with chapter controls.
2. **What's New in This Build (`#whatsNew`, inside `#download`)** — Mobile-friendly release notes for the
   packaged Part 4 + Part 5 optimization pass: performance optimizations, movement/stability fixes,
   developer testing status, and an explicit list of honest limits (no FPS guarantees, no unverified
   device claims, no invented content). Every bullet is verifiable in the shipped APK.
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
├── js/main.js                  release & community loaders, trailer chapters, interactive tabs, lightbox
├── apk/SCS.apk                 verified signed Android APK served directly at /apk/SCS.apk
├── data/release.json           ★ release manifest — single source of truth for APK metadata & kill-switch
│                               (file name, byte size, SHA-256, cert digest, version)
├── data/community.json         developer Discord contact URL, coming-soon channels & trailer config
├── img/                        approved public assets (800w/1600w WebP + PNG/JPG fallbacks, OG, favicon)
├── media/                      self-contained in-build gameplay showcase reel (MP4)
├── scripts/check-site.py       dependency-free structural, image, map, manifest & content integrity suite
├── scripts/check-responsive.cjs optional Playwright multi-viewport browser regression suite
├── vercel.json                 Vercel static deployment config (security headers, APK headers, cache rules)
└── docs/                       deployment, release flow, changelog provenance & privacy runbooks
```

## How downloads work

- The download buttons (`#heroDl`, `#dlBtn`, and patch-note release links) point directly to
  `/apk/SCS.apk` with the `download` attribute so downloads work even without JavaScript.
- `data/release.json` supplies verified version (`0.22.1`), `versionCode` (`3`), release date,
  file name (`SCS.apk`), exact byte size (`8,244,435`), package ID (`com.sinsofchaoticshadow.game`),
  and SHA-256 checksum (`04cf9290…0f6d9cf`) — all measured from the file in `apk/`.
- Setting `"available": false` in `data/release.json` acts as an instant kill-switch that cleanly
  disables the download buttons and displays an honest status message.

## Configuring social & community links

Edit `data/community.json` to update `developerDiscordUrl` or publish official community URLs for
`discord`, `instagram`, or `youtube` once live. Empty strings (`""`) keep planned channels marked
`COMING SOON` rather than exposing broken or premature links.

## Local development & testing

No build step — static by design.

```bash
python3 scripts/check-site.py          # structural, image, map, checksum & content verification
node --check js/main.js                # JS syntax check
python3 -m http.server 8080            # preview locally at http://localhost:8080
```

## Deployment

Recommended: **Vercel** (zero build command, output directory = repo root; see `docs/DEPLOYMENT.md`).
There are no environment variables, secrets, or serverless functions required.

## License

Site code: MIT (see `LICENSE`). Game name, logo, screenshots and media:
© 2026 SCS project (`0-umbra`), all rights reserved.

Support: [Contact the Developer on Discord](https://discord.com/users/1341279384535044097).
