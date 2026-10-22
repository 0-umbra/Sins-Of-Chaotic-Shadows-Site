# Sins of Chaotic Shadow — Official Site

The public website for **Sins of Chaotic Shadow (SCS)**: game information, real screenshots,
and a no-login download of the latest **signed Android APK**.

This repository is **deliberately separate** from the private game repository
(`Sins-Of-Chaotic-Shadows`). It contains **only** website code and approved public assets.
No game source code, no private configuration, no signing material ever belongs here.

## What's on the site

- Cinematic hero with the SCS emblem
- Prominent **Download Latest APK** button wired to `data/release.json`
- Real, current-build screenshots (captured from the game itself — replaceable, never fictional)
- Accurate mode descriptions: **TDM**, **Free-For-All**, **5v5 Shadow Core**, private rooms, Training Ground
- Arsenal overview: 15 firearms in 5 classes + the level-gated melee collection
- FAQ, About, Terms/Privacy summaries, responsive footer

## Project layout

```
├── index.html            single-page site (no framework, no CDN — fully self-contained)
├── css/style.css         design system (dark neon, responsive, reduced-motion aware)
├── js/main.js            release-manifest loader, gallery lightbox, nav, reveal animations
├── img/                  approved public assets (emblem, screenshots, og image, favicon)
├── data/release.json     ★ release manifest — the download button's single source of truth
├── scripts/publish-release.py   publishes a verified APK to this repo's Releases + updates the manifest
├── vercel.json           deployment config (security headers, cache rules)
└── docs/                 deployment, release flow, and repo-split/privacy runbooks
```

## How downloads work

`data/release.json` is the **only** thing the download button trusts:

- `available: true` → the button links straight to the APK file in this repo's GitHub
  **Releases** (public, no login, never an expiring artifact link), and the page shows
  version, release date, file size and the SHA-256 checksum.
- `available: false` (or manifest missing) → the site shows a clean "first signed build
  being prepared" state instead of a broken button.

A new release can never silently break the site: the manifest keeps the previous valid
release listed in `history`, and updates only flow through
`scripts/publish-release.py`, which refuses anything that didn't come from the game
repo's signature-verifying workflow. See **docs/RELEASE-FLOW.md**.

## Local development

No build step — it's static on purpose.

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```

## Deployment

Any static host works. Recommended: **Vercel** (see docs/DEPLOYMENT.md) or GitHub Pages.
There are no environment variables, no secrets, and no server functions required.

## License

Site code: MIT (see LICENSE). Game name, logo, screenshots and assets:
© 2026 SCS project (0-umbra), all rights reserved.

Support: open an issue here, or Discord `scr1pt.fx`.
