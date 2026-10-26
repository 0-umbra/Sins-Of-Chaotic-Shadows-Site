# Responsive UI changes and validation

## Scope and diagnosis

This checkout is a static, single-page site with shared CSS and vanilla JavaScript,
not the game application. All sections, media, release data and download behavior
are retained. No forms or tables exist in this checkout.

Root causes found by code inspection:
- Full desktop navigation stayed active down to 781px despite its combined intrinsic width.
- Fractional grid tracks and grid children retained content-driven minimum sizes.
- The nonbreaking hero title, package identifier and nowrap APK button forced overflow.
- Body horizontal clipping concealed overflow rather than fixing its source.
- Mobile navigation had no short-viewport scroll limit; anchors lacked header clearance.
- Modal/gallery keyboard focus and Escape behavior were incomplete.

## Changes

- `css/style.css`: collapse navigation at 1100px, scroll long menus, keep the download
  shortcut visible, preserve compact mobile styling, use shrinkable grids, wrap
  metadata/buttons/headings, constrain overlays, account for safe areas, improve focus
  and reduced-motion support, prevent decorative layers intercepting clicks.
- `index.html`: progressive-enhancement class, breakable hero title, menu aria-controls.
- `js/main.js`: synchronized menu state and dismissal, focus management/trapping,
  Escape and focus restoration for legal dialogs and screenshots, reveal fallback.
- `scripts/check-site.py`: dependency-free asset/anchor/download integrity regression check.
- `scripts/check-responsive.cjs`: optional Playwright browser regression suite.
- `css/style.css`, `index.html`, `js/main.js`: incremental generated-metadata upgrade —
  compact current-release facts, dynamic What's New list, and a collapsible archive
  of the previous long-form technical notes.

## Checks completed

- `python3 scripts/check-site.py`: PASS, 33 unique IDs; local assets/anchors resolve;
  original `/apk/SCS.apk` URL, download attribute, manifest size and SHA-256 verified.
- `node --check js/main.js`: PASS.
- `git diff --check`: PASS.
- A minimal `package.json` now defines `npm run build`, `npm test`, and
  `npm run check`. There is still no application framework, runtime dependency,
  bundler, linter or type-check step.

## Browser validation: still required

No viewport has been successfully browser-tested in this environment. Playwright's
browser download was blocked by network restrictions. A Chromium binary obtained
through npm could not launch because `libnspr4.so` is missing. Consequently screenshots,
console/network checks and visual acceptance remain unverified.

The optional suite targets 320×740, 375×812, 430×932, 600×960, 768×1024,
820×1180, 1024×768, 1180×820, 1280×800, 1440×900 and 1920×1080.
It checks overflow, all section anchors, navigation state, legal dialog keyboard
focus/Escape, gallery dismissal, resource errors and served APK checksum.

Run with Playwright and Chromium available in the Node environment:

```
python3 -m http.server 8080 --bind 0.0.0.0
# In another shell:
node scripts/check-responsive.cjs
```

Also manually review each section at those widths, tablet portrait/landscape,
short-height menus/dialogs, touch navigation, zoom, reduced motion and no-JS fallback.
External browser-game and GitHub destinations are preserved, not network-validated.

## Incremental APK-metadata upgrade

The latest-release card now uses the existing SCS design system. New elements
are deliberately small and mobile-safe:

- `.dl-quick` is a wrapping flex row of version code / APK size / released
  values; it never uses `white-space: nowrap`.
- `.wn-current` holds the changelog loaded from `apk/release.json`. Its list
  items use `overflow-wrap: anywhere`, a shrinkable grid/flex context, and the
  existing dark/crimson surface colors.
- The long Part 4 + Part 5 technical notes remain intact inside a native
  `<details class="wn-archive">` disclosure, reducing scroll length on Android
  without deleting content or adding JavaScript state.
- The direct `<a href="/apk/SCS.apk" download>` buttons keep their existing
  `min-height` and full-width mobile rules; the optional Playwright suite now
  checks the button box, generated values, changelog item count and overflow at
  all 11 viewports.
- Generated JSON files are tiny and requested with `no-store`; the APK itself
  is never fetched just to display metadata.

Run `npm run check` after replacing an APK. It regenerates `dist/`, verifies
the binary manifest / size / SHA-256 independently, checks all existing site
features and asset paths, and runs synthetic-APK regression tests for changed
versions, missing files and failure fallbacks.

## Branch / PR prerequisite

Work remains on the fixed session feature branch
`arena/dc51d80c-sins-of-chaotic-shadows-site`. Remote branch discovery found no
`android-capacitor` branch in this repository, so that requested base cannot be
used and no correctly targeted PR can yet be created. No substitute base branch
was created, no main branch modified, and nothing merged. Confirm the intended
repository/base before integration.
