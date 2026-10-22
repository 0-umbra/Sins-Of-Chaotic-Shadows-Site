# Deployment — SCS Official Site

The site is 100% static (HTML/CSS/JS + images + one JSON manifest). No env vars,
no secrets, no build step. Connect **this repository only** — never the game repo.

## Option A — Vercel (recommended, ~2 minutes)

1. Sign in at https://vercel.com with your GitHub account.
2. **Add New → Project** → Import `0-umbra/Sins-Of-Chaotic-Shadows-Site`.
3. Configure:
   - Framework Preset: **Other** (static)
   - Build Command: *(empty)*
   - Output Directory: *(empty — repo root)*
   - Environment Variables: **none required. Ever.**
4. **Deploy.** Vercel assigns a URL like `https://sins-of-chaotic-shadows-site.vercel.app`.
5. (Optional) Settings → Domains to attach a custom domain — follow Vercel's DNS instructions.

`vercel.json` in the repo root already sets security headers, long cache for images,
and `no-store` for `data/release.json` so version updates appear immediately.

## Option B — GitHub Pages

1. Repo → **Settings → Pages**.
2. Source: **Deploy from a branch** → Branch `main`, folder `/ (root)` → Save.
3. The site goes live at `https://0-umbra.github.io/Sins-Of-Chaotic-Shadows-Site/`.

Note: GitHub Pages caches aggressively; after publishing a new release the manifest may
lag behind for ~10 minutes unless you bust cache (hard refresh).

## Verification checklist (after first deploy)

- [ ] Open the production URL in a private/incognito window — no auth prompt, page loads.
- [ ] Lighthouse mobile check: layout stacks, no horizontal scroll.
- [ ] Download section shows either the verified release facts or the honest
      "not available yet" state — never a broken button.
- [ ] After the first release is published: click **Download Latest APK** — the browser
      should download an `.apk` file directly (not an HTML page), and the SHA-256 on the
      page must match `sha256sum` of the downloaded file.
