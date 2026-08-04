# Auto-Move Raw Image Uploads — Design

## Problem

Members add meeting/event photos by uploading files directly through the GitHub web UI (drag-and-drop into whatever folder they're browsing), not from a local git clone. The documented workflow (`docs/src/content/docs/guides/posting-images.mdx`) tells them to upload to `originals/images/<category>/`, and a build step (`npm run optimize-images`) resizes/converts those originals into `.webp` files under `public/images/<category>/`, which is what the deployed site actually serves.

When a member instead uploads (or the web UI defaults them) into `public/images/<category>/` directly, two things go wrong:
1. `optimize-images` can't find a matching file under `originals/`, and (once carousel checks reference it) fails the build.
2. Even if it didn't fail, a raw, multi-megabyte phone photo would be served as-is to visitors — including on mobile data — instead of the optimized `.webp`.

This happened in practice: PR #7 uploaded `AugMtg02.jpg` and `augMtg03.jpg` straight into `public/images/meetings/`, which had to be found and fixed manually (moving the files into `originals/images/meetings/` and regenerating the `.webp` outputs) before the PR could merge safely.

Since members use the GitHub web UI and have no local git tooling, no local git hook (pre-commit/pre-push) can ever see this mistake. The fix has to run server-side, in GitHub Actions.

## Goal

When a PR adds a raw image file directly under `public/images/<category>/` (where `<category>` is one of the known carousel photo categories), CI should automatically move it to the correct `originals/images/<category>/` path, regenerate the optimized `.webp`, and commit the fix back to the PR branch — with zero action required from the member. The existing PR checks (JSON validation, `optimize-images`, build) then run against the corrected tree in the same job run.

Out of scope: files under `public/images/` that are not carousel photos (e.g. `logo.png`, `beer-glass.jpg`, `dark-logo2.png` at the `public/images/` root) must never be touched. Those are site assets deployed as-is on purpose, not meeting-photo uploads.

## Design

### Components

**`scripts/auto-move-uploaded-images.mjs`** (new script)
- Determines the set of known carousel categories by listing subdirectories of `originals/images/` (currently `meetings`, `bbo`, `ironmash`).
- Gets the PR's newly-added files with:
  ```
  git diff --diff-filter=A --name-only origin/main...HEAD -- public/images
  ```
- Filters that list to paths matching `public/images/<category>/<name>.<ext>` where `<category>` is in the known-category set and `<ext>` (case-insensitive) is one of `jpg`, `jpeg`, `png`, `heic`.
- For each match, runs `git mv public/images/<category>/<name>.<ext> originals/images/<category>/<name>.<ext>`. If a file already exists at the destination, it is overwritten and a warning is logged (no collision-avoidance renaming — acceptable given meeting photos are named per-event and collisions are unlikely).
- Logs what it moved (or logs "nothing to move" and exits 0 if the diff had no matches). The script's own exit code is 0 in both cases; only a `git mv` failure (e.g. filesystem error) is a non-zero exit.
- Files under `public/images/` root, or under any subfolder not already present in `originals/images/`, are left untouched.

**`.github/workflows/pr-check.yml`** (edit)
- Top-level `permissions.contents` changes from `read` to `write` (needed to push the fix commit back to the PR branch; safe here because contributors push branches directly into this org repo — there are no fork-based PRs to worry about).
- New step **"Auto-move raw image uploads"** added right after `Install main site dependencies` and before `Validate carousel-images.json`:
  1. Run `node scripts/auto-move-uploaded-images.mjs`.
  2. If `git status --short` shows changes, configure a git identity (e.g. `github-actions[bot]`), commit with message `Auto-move raw image upload(s) to originals/`, and `git push` to the PR's head ref.
  3. If nothing changed, skip the commit/push (no-op).
- All existing steps (JSON validation, `optimize-images`, main-site build, docs build) are unchanged and now simply run against the already-corrected working tree.

### Data flow

1. Member uploads `NewPhoto.jpg` via the GitHub web UI into `public/images/meetings/` and opens/updates a PR.
2. `pull_request` event triggers `pr-check.yml`.
3. Auto-move step finds `public/images/meetings/NewPhoto.jpg` is newly added; `meetings` is a known category; extension matches → moves it to `originals/images/meetings/NewPhoto.jpg`; commits and pushes.
4. `optimize-images` runs, finds the original in place, generates `public/images/meetings/NewPhoto.webp`.
5. JSON validation and both builds succeed; the PR check shows green.
6. The member (or maintainer) still edits `carousel-images.json` to add the display entry — this step is unchanged.

### Error handling

- Destination collision: overwrite + log warning (see above).
- `git push` failure (e.g. unexpected branch protection blocking the bot): the step fails loudly with a clear error, rather than silently leaving the PR in a broken state.
- Non-carousel files under `public/images/` (root-level assets, or subfolders with no `originals/images/` counterpart) are never modified.

### Testing

- Manual: open a throwaway PR that uploads a raw `.jpg` into `public/images/meetings/`; confirm the bot moves it, pushes a fix commit, and the check goes green.
- Manual: open a throwaway PR touching `public/images/logo.png` (root-level); confirm it is left untouched.
- No automated unit tests for the script — mirrors the existing `scripts/optimize-carousel-images.mjs`, which also has no test coverage; simulating git repo state for a test would be disproportionate to the script's size.

## Explicitly not doing

- No local git hook — contributors don't use local git, so it would never run.
- No renaming/collision-avoidance logic for destination filename clashes.
- No changes to how `carousel-images.json` entries are authored — that step remains manual, as documented today.
