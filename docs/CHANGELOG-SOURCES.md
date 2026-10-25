# Latest Updates: provenance and maintenance

## Primary source

The complete user-supplied `README.md.txt` (395 lines, attached to the website task)
was inspected, including the version sections, Android release information,
historical notes, limitations, maps and unversioned match-flow changes.
Attachment SHA-256:
`fb687367755ebaf0603244ae91aa8ccd50786c43776e5ae9d5b4a50a4e377391`.
The attachment is game documentation; the repository's own README describes the
website and is not a substitute for that source. The attachment's private/game
source links are intentionally not published in the UI.

## Included highlights

| Version | Source sections | Included information |
| --- | --- | --- |
| 0.23.0 | `0.23.0 — living sky` | Rays, separate moving cloud layers, gradual lighting, birds and LOW-quality fallback. No date documented. |
| 0.22.1 | `Android release (signing, versioning, APK download)`; site's `data/release.json` | Signed Android package/version; October 22, 2026 from the manifest only. No gameplay changes claimed for this patch. |
| 0.22.0 | `0.22.0 — a real daytime sky on every map` and `v0.22.0 — daytime conversion + Eclipse Veil removal` | Combined into one entry: daylight, skies, Eclipse Veil removal, unchanged map gameplay geometry and low-quality options. No date documented. |
| 0.21.0 | `0.21.0 — ten new firearms...` | Fifteen total firearms, category tabs, eleven level-gated blades, larger cards and responsive audio. No date documented. |
| 0.20.0 | `0.20.0 — polished menu audio...` | Menu/weapon audio, volume controls, pistol hold-to-fire and mobile release/cancellation handling. No date documented. |

These are selected recent highlights, not an exhaustive copy of the README.
Earlier version histories and the unversioned match-flow section are not assigned
to an invented release. Technical timings, test-count claims and measured FPS
improvements are not republished. No planned feature is presented as released.

## Cross-check and availability distinction

The site manifest confirms APK version 0.22.1, version code 3 and release date
2026-10-22. It contains no gameplay notes and has empty history. Local Git tags
and `gh release list` returned no additional releases to corroborate gameplay
history. The supplied README documents 0.23.0 game changes despite its older
0.21.0 title and 0.22.1 Android package configuration. Accordingly, the UI calls
0.23.0 a **documented game update**, not the downloadable APK, and directs users
to Download for the current package. The manifest, APK and release configuration
are untouched.

## Maintenance

The static semantic list in `index.html#updates` is the sole player-facing
changelog; no second release manifest or runtime renderer was introduced. Add
verified entries newest-first, document their source here, and omit unknown
dates/categories. Keep APK metadata in the existing release manifest, not in new
configuration. If all reliable notes are removed, replace the list with:
“Release notes will be available here soon.” An empty state is not currently
needed because the attachment provides explicit versioned notes.

## Validation for this change

- `python3 scripts/check-site.py`: passes assets/anchors, APK URL/size/SHA-256,
  content presence/removal, installation-note preservation, version order and
  documented release date checks.
- `node --check js/main.js` and `node --check scripts/check-responsive.cjs`: pass.
- `git diff --check`: passes.
- No build, lint or type-check command is configured for this static project.
- Playwright browser installation was attempted; network access to
  `cdn.playwright.dev` failed (ECONNRESET). No installed browser was found.
  Actual viewport screenshots, console/network and browser interaction tests
  therefore remain unverified, not passed.
- The updated optional browser suite covers widths 320, 375, 430, 600, 768, 820,
  1024, 1180, 1280, 1440 and 1920px, including tablet portrait/landscape. It now
  checks the new section/notice and absent browser-play link as well as existing
  navigation, modals, gallery, overflow and APK behavior.
- Layout code review: a single-column list bounded by the existing narrow wrapper,
  shrinkable cards, wrapping card headers, fluid padding/font sizes and no fixed
  content heights. No unrelated responsive rules were modified.

---

# Part 4 + Part 5 optimization notes (APK build 0.22.1 / versionCode 3)

## Where these notes come from

Unlike the earlier entries above (taken from the user-supplied game `README`), the
`#whatsNew` release notes in `index.html` were verified **against the contents of the
signed APK that is actually served** at `/apk/SCS.apk`. The package was unpacked and
read directly (no game source was added to this repo):

| Claim | Evidence inside `apk/SCS.apk` |
| --- | --- |
| Distance-based workload reduction for visible objects | `assets/public/js/char-lod.js` (`LOD_TIERS`: detail tiers from 24 m / 45 m, hysteresis, shadow `shadowMinRadius`), imported by `bots.js` |
| Static character-part batching | `assets/public/js/char-batch.js` (`batchStaticParts`, merge key = bone + material + shadow flags + size class; animatable parts excluded), called from `character.js` |
| Fewer shadow casters / shadow-map renders | `assets/public/js/shadow-cadence.js` (`createShadowCadence`, `maxAgeMs` default 18 ms, `force()`), instantiated in `game.js`; LOD shadow cut-offs in `char-lod.js` |
| Fewer per-frame allocations | `bots.js` shared scratch `_m` / `_t` in `fire()` and `updateBullets()`; reused viewmodel state bag comment in `game.js` |
| Adaptive quality with cooldown/back-off | `assets/public/js/quality-ladder.js` (`degradeCooldownMs`, `restoreStableMs`, `flapWindowMs`, `maxBackoff`, `maxFlaps`, sticky level, reset on manual change), driven by `createRenderGovernor` in `perf.js` |
| Frame-time percentiles | `assets/public/js/frame-stats.js` (`p50`/`p95`/`p99`/`maxMs`/`latePct`/`hitches`), rendered into the FPS readout in `game.js` |
| Frame-rate-independent acceleration | `assets/public/js/player-physics.js` (`matchRate`, `expK`, `RATE_GROUND`/`RATE_AIR`/`RATE_SLIDE_STEER`/`RATE_EYE`/`RATE_SLIDE_TILT`) |
| Frame-rate-independent jump apex | `player-physics.js` (`GRAVITY 22`, `JUMP_V 7.4` → 1.245 m apex, `SLIDE_JUMP_V 8.9`, `PHYS_MAX_STEP 1/120`, `MAX_SUBSTEPS 8`), used by `stepVertical()` in `game.js` |
| Resume frame-pacing recovery | `game.js` `resetFramePacing()` on `visibilitychange` (visible) and `pageshow`, plus the debt caps in `perf.js` |
| Automated tests exist | test hooks in the shipped code: pure/no-DOM modules "so the headless suites can import it", `opts.batch === false` unbatched path kept for batching-equivalence tests |

## What is deliberately **not** claimed

- No test count: the Part 4 / Part 5 suites live in the private game repository and
  **were not executed for this website change** (this repo has no copy of them, no
  `node_modules`, and no test runner). The notes say only that the development
  workflow reported them passing.
- No FPS measurement: there is no Android-device measurement (including a Moto e13)
  in the supplied artifacts, and no frame-time capture is published here. Batching,
  LOD and shadow cadence are presented as draw-call / shadow-caster reductions
  (their documented design goal), never as measured Android FPS gains.
- No lighting or shadow-timing verification on device.
- No new weapons, maps, modes, multiplayer changes or other content: the notes say so
  explicitly, and the UI keeps the previously documented `0.23.0` Living Sky entry
  labelled as a documented game update rather than the downloadable package.
- No invented version, date, size or download count: `version` / `versionCode` were
  read from the APK's `AndroidManifest.xml`, the size and SHA-256 were computed from
  the file, and `releaseDate` was left at the value already recorded in
  `data/release.json` (the new APK declares the same versionName/versionCode and the
  package strips build timestamps — all ZIP entries read `1981-01-01`).

## Validation for this change

- `python3 scripts/check-site.py`: **PASS** — assets/anchors, APK byte size and
  SHA-256 cross-checked against `data/release.json`, download labels, release-notes
  content and forbidden-claim guards.
- `node --check js/main.js`, `node --check scripts/check-responsive.cjs`: **PASS**.
- Local static server (`python3 -m http.server 8080 --bind 0.0.0.0`):
  `GET /apk/SCS.apk` → `200`, `Content-Type: application/vnd.android.package-archive`,
  `Content-Length: 5901720`, and the downloaded bytes are identical to the committed
  file (`cmp` + SHA-256 match).
- Playwright browser/viewport checks were **not** run (no installed browser in this
  sandbox and no network access to the browser CDN), so rendered mobile/desktop
  screenshots remain unverified — not passed.
