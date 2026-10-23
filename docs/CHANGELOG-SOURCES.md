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
