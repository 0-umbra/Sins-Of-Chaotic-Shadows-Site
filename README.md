# Sins of Chaotic Shadow — Official Site

The public website for **Sins of Chaotic Shadow (SCS)**: game overview, showcase galleries,
patch notes, Android compatibility guide, and a direct no-login download of the latest
**signed Android APK** (`/apk/SCS.apk`).

This repository is **deliberately separate** from the private game repository
(`Sins-Of-Chaotic-Shadows`). It contains **only** website code and approved public assets.
No game source code, no private configuration, and no signing material ever belongs here.

## What's on the site

1. **Cinematic Homepage (`#top`, `#trailer`)** — Atmospheric dark/crimson FPS theme, distortion-free
   SCS emblem (`<picture>` WebP + PNG fallback), direct working APK download button with verified
   version (`0.22.1`) and actual file size (`5.58 MB` / `5,851,613` bytes), subtle motion, and an
   in-build gameplay showcase trailer (`media/scs-gameplay-trailer.mp4`) with chapter controls.
2. **Updates & Patch Notes (`#updates`)** — Filterable newest-first version history (`0.23.0` down
   to `0.20.0`), new features, maps, arsenal, performance passes, bug fixes, known issues, and
   individual release download links.
3. **Game Showcase (`#showcase`, `#maps`, `#modes`, `#weapons`, `#abilities`, `#gallery`)** —
   Interactive maps gallery featuring the **Sunken Meridian** planned-arena spotlight alongside the
   4 playable `v0.22.1` daylight arenas (**Umbra Crossing**, **Neon Veil**, **Foundry Siege**,
   **Ironfall Industries**); interactive 15-firearm & 11-blade arsenal browser; interactive
   3-Resonator / 9-ability kit viewer (**Vex**, **Aura**, **Rift**); TDM, FFA, and competitive-format
   **5v5 Shadow Core** mode cards; and filterable WebP build screenshots with keyboard lightbox.
4. **News & Community (`#community`)** — Development announcements, explicitly labeled planned
   feature previews, one-click diagnostic bug-report template generator, Discord contact
   (`0_umbra`), and configurable social/support channels via `data/community.json`.
5. **Android Compatibility & Performance (`#compatibility`)** — Manifest-verified Android
   requirements (`minSdkVersion 24` / Android 7.0+, `targetSdkVersion 36` / Android 16, WebGL,
   Sensor Landscape), in-game Render Control options, low-end GPU optimization profile, and
   troubleshooting for lag, crashes, Play Protect installation, and in-place updates.

## Project layout

```
├── index.html                  single-page site (no framework, no CDN — fully self-contained)
├── css/style.css               dark/crimson tactical FPS design system (responsive, reduced-motion aware)
├── js/main.js                  release & community loaders, trailer chapters, interactive tabs, lightbox
├── apk/SCS.apk                 verified signed Android APK served directly at /apk/SCS.apk
├── data/release.json           ★ release manifest — single source of truth for APK metadata & kill-switch
├── data/community.json         configurable social channels, support links & external trailer URL
├── img/                        approved public assets (WebP + PNG/JPG fallbacks, OG card, favicon)
├── media/                      self-contained in-build gameplay showcase reel (MP4)
├── scripts/check-site.py       dependency-free structural, asset, manifest & content integrity suite
├── scripts/check-responsive.cjs optional Playwright multi-viewport browser regression suite
├── vercel.json                 Vercel static deployment config (security headers, APK headers, cache rules)
└── docs/                       deployment, release flow, changelog provenance & privacy runbooks
```

## How downloads work

- The download buttons (`#heroDl`, `#dlBtn`, and patch-note release links) point directly to
  `/apk/SCS.apk` with the `download` attribute so downloads work even without JavaScript.
- `data/release.json` supplies verified version (`0.22.1`), `versionCode` (`3`), release date,
  exact byte size (`5,851,613`), package ID (`com.sinsofchaoticshadow.game`), and SHA-256 checksum.
- Setting `"available": false` in `data/release.json` acts as an instant kill-switch that cleanly
  disables the download buttons and displays an honest status message.

## Configuring social & community links

Edit `data/community.json` to publish official social or tracker URLs (`channels[].url`,
`support.bugReportUrl`, `support.feedbackUrl`, `trailer.externalUrl`). Empty strings (`""`) keep
unconfigured channels transparently labeled rather than exposing broken or placeholder links.

## Local development & testing

No build step — static by design.

```bash
python3 scripts/check-site.py          # structural, asset, checksum & content verification
node --check js/main.js                # JS syntax check
python3 -m http.server 8080            # preview locally at http://localhost:8080
```

## Deployment

Recommended: **Vercel** (zero build command, output directory = repo root; see `docs/DEPLOYMENT.md`).
There are no environment variables, secrets, or serverless functions required.

## License

Site code: MIT (see `LICENSE`). Game name, logo, screenshots and media:
© 2026 SCS project (`0-umbra`), all rights reserved.

Support: open an issue on this repository, or reach developer `0_umbra` on Discord.
