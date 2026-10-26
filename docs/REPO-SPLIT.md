# Repo split & privacy runbook

Two repositories, on purpose:

| | Repo | Visibility | Contains |
|---|---|---|---|
| A | `0-umbra/Sins-Of-Chaotic-Shadows` | **PRIVATE** (target) | game source, history, workflows, secrets |
| B | `0-umbra/Sins-Of-Chaotic-Shadows-Site` | **PUBLIC** | this website + approved assets + public APK releases |

## Making the game repo private (owner action)

GitHub → `0-umbra/Sins-Of-Chaotic-Shadows` → **Settings** → scroll to
**Danger Zone** → **Change repository visibility** → *Make private* → type the repo name
to confirm.

### Consequences to know before flipping

1. **GitHub Pages for the game stops working.** Free accounts cannot serve Pages from a
   private repo. The game's Pages URL (`0-umbra.github.io/...`) will 404.
2. **The Vercel web-game deployment keeps working** (Vercel's GitHub App retains access
   to private repos it was granted). Verify after the flip: the game URL
   `sins-of-chaotic-shadows.vercel.app` must still load. If it breaks, open the Vercel
   project → Settings → Git → reconnect/re-grant the repo.
3. **Releases in the game repo become private too.** Anyone relying on downloading the
   APK from the *game* repo loses access — which is exactly why the public APK is served
   directly from *this* site at `/apk/SCS.apk` (see docs/RELEASE-FLOW.md). The website's
   download is unaffected.
4. **Collaborators** keep access; everyone else (forks, watchers, issue reporters) is cut
   off. Check Settings → Collaborators before flipping if that matters.
5. **Existing forks are not deleted or made private** — if the repo was forked while
   public, those forks keep a snapshot of the source at fork time. If that is a concern,
   review the fork list (Insights → Forks) before flipping.
6. **Do not delete & recreate** the game repo to change visibility — that would destroy
   issues, stars, workflow history and the release pipeline configuration.

### Do this flip AFTER

- The site repo is created and pushed.
- (Ideally) the first public APK release is published on the site repo, so downloads
  never skip a beat.

## What must never enter this (public) repo

- Any file from the game repo's `js/`, `server/`, `supabase/`, `tests/`, `tools/` trees
- Supabase URLs/keys, API configs, `.env*`, keystores (`*.jks`/`*.keystore`), passwords
- `.git` history from the game repo (this repo has its own clean history)
- Actions artifacts or logs from the game repo

`.gitignore` blocks common secret file patterns as a seatbelt, but review every commit.
