# Auto-Move Raw Image Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a PR adds a raw image (`.jpg`/`.jpeg`/`.png`/`.heic`) directly under `public/images/<category>/` for a known carousel category, CI automatically moves it to `originals/images/<category>/`, regenerates the optimized `.webp`, and pushes the fix back to the PR — no manual intervention required.

**Architecture:** A new standalone Node script (`scripts/auto-move-uploaded-images.mjs`) detects and moves misplaced raw uploads using `git diff` + `git mv`. A new step in `.github/workflows/pr-check.yml` runs it before the existing validation steps, then commits and pushes any resulting changes back to the PR branch.

**Tech Stack:** Node.js (ESM, matches `scripts/optimize-carousel-images.mjs` conventions), `git` CLI via `child_process.execSync`, GitHub Actions (`actions/checkout@v7`).

## Global Constraints

- Raw extensions detected (case-insensitive): `jpg`, `jpeg`, `png`, `heic` — exact set, no others.
- Known categories = subdirectories that already exist under `originals/images/` (currently `meetings`, `bbo`, `ironmash`) — never hardcode this list; read it from the filesystem.
- Only files matching `public/images/<category>/<filename>.<ext>` (exactly 4 path segments) are eligible. Root-level `public/images/*` files (`logo.png`, `beer-glass.jpg`, etc.) and subfolders not present under `originals/images/` are never touched.
- Only newly-**added** files count (via `git diff --diff-filter=A`) — pre-existing files already committed to `public/images/` must never be flagged or moved.
- Destination collisions: overwrite + log a warning. No renaming logic.
- Commit message for the auto-fix commit: `Auto-move raw image upload(s) to originals/`
- `pr-check.yml` top-level `permissions.contents` must be `write` (was `read`).
- `pr-check.yml`'s `Checkout` step must use `fetch-depth: 0` and check out the PR's actual head branch (`ref: ${{ github.head_ref }}`), not the default merge ref — needed both for the `origin/<base>...HEAD` diff and for pushing the fix back to a real branch tip.
- Checking out a specific `ref` does not guarantee `origin/<base>` exists as a local remote-tracking ref, even with `fetch-depth: 0` — the workflow step must explicitly `git fetch origin "<base-ref>"` before running the script.

---

### Task 1: Auto-move detection script

**Files:**
- Create: `scripts/auto-move-uploaded-images.mjs`

**Interfaces:**
- Consumes: nothing from other tasks (first task).
- Produces: a CLI script invoked as `node scripts/auto-move-uploaded-images.mjs <baseRef>` (default `baseRef` = `"origin/main"` if omitted). Exit code 0 on success (including the "nothing to move" case); non-zero if a `git mv` fails. Task 2 invokes this script by exact path and argument shape.

- [ ] **Step 1: Write the script**

```javascript
#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const originalsImagesDir = join(root, "originals", "images");

const RAW_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic"]);

function knownCategories() {
  return readdirSync(originalsImagesDir).filter((name) =>
    statSync(join(originalsImagesDir, name)).isDirectory()
  );
}

function addedPublicImageFiles(baseRef) {
  const output = execSync(
    `git diff --diff-filter=A --name-only ${baseRef}...HEAD -- public/images`,
    { cwd: root, encoding: "utf8" }
  );
  return output.split("\n").filter((line) => line.trim().length > 0);
}

function parseCandidate(relPath, categories) {
  const parts = relPath.split("/");
  if (parts.length !== 4) return null;
  const [, , category, filename] = parts;
  if (!categories.includes(category)) return null;
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return null;
  const ext = filename.slice(lastDot + 1).toLowerCase();
  if (!RAW_EXTENSIONS.has(ext)) return null;
  return { category, filename };
}

function main() {
  const baseRef = process.argv[2] || "origin/main";
  const categories = knownCategories();
  const candidates = addedPublicImageFiles(baseRef)
    .map((relPath) => ({ relPath, parsed: parseCandidate(relPath, categories) }))
    .filter((c) => c.parsed !== null);

  if (candidates.length === 0) {
    console.log("No raw image uploads found under public/images/. Nothing to move.");
    return;
  }

  for (const { relPath, parsed } of candidates) {
    const destRel = join("originals", "images", parsed.category, parsed.filename);
    const destAbs = join(root, destRel);
    if (existsSync(destAbs)) {
      console.warn(`WARNING: ${destRel} already exists — overwriting with ${relPath}`);
    }
    console.log(`Moving ${relPath} -> ${destRel}`);
    execSync(`git mv -f "${relPath}" "${destRel}"`, { cwd: root, stdio: "inherit" });
  }
}

main();
```

- [ ] **Step 2: Manually verify on a scratch branch (no automated unit tests — mirrors `optimize-carousel-images.mjs`, which also has none)**

Run, from the repo root on `main` (or any up-to-date branch):

```bash
git checkout main && git pull --ff-only
git checkout -b scratch-verify-auto-move
cp originals/images/meetings/Jan_Mtg_1.jpg public/images/meetings/ScratchTest.jpg
git add public/images/meetings/ScratchTest.jpg
git commit -m "scratch: simulate a raw upload for verification"
node scripts/auto-move-uploaded-images.mjs origin/main
```

Expected output: a line `Moving public/images/meetings/ScratchTest.jpg -> originals/images/meetings/ScratchTest.jpg`, and running `git status --short` afterward shows:
```
R  public/images/meetings/ScratchTest.jpg -> originals/images/meetings/ScratchTest.jpg
```

Then verify the negative case — a root-level file is left untouched:

```bash
cp public/images/logo.png /tmp/logo-copy.png
cp /tmp/logo-copy.png public/images/logo-copy.png
git add public/images/logo-copy.png
git commit -m "scratch: simulate a root-level asset upload"
node scripts/auto-move-uploaded-images.mjs origin/main
```

Expected output: `No raw image uploads found under public/images/. Nothing to move.` (the file has 3 path segments after `public/images/`, not 4, so it's correctly ignored).

Clean up the scratch branch once both cases pass:

```bash
git checkout main
git branch -D scratch-verify-auto-move
```

- [ ] **Step 3: Commit**

```bash
git add scripts/auto-move-uploaded-images.mjs
git commit -m "Add script to auto-move raw image uploads into originals/"
```

---

### Task 2: Wire the script into the PR check workflow

**Files:**
- Modify: `.github/workflows/pr-check.yml`

**Interfaces:**
- Consumes: `scripts/auto-move-uploaded-images.mjs` from Task 1, invoked as `node scripts/auto-move-uploaded-images.mjs "origin/${{ github.base_ref }}"`.
- Produces: a `pull_request`-triggered workflow that, on a same-repo PR containing a misplaced raw upload, pushes a fix commit to the PR's head branch before running the existing validation steps. Task 3 depends on this being merged to `main` to test end-to-end.

- [ ] **Step 1: Edit the workflow file**

Replace the full contents of `.github/workflows/pr-check.yml` with:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

permissions:
  contents: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          ref: ${{ github.head_ref }}
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version: 22

      - name: Install main site dependencies
        run: npm ci

      - name: Auto-move raw image uploads
        run: |
          git fetch origin "${{ github.base_ref }}"
          node scripts/auto-move-uploaded-images.mjs "origin/${{ github.base_ref }}"
          if [ -n "$(git status --porcelain)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add -A
            git commit -m "Auto-move raw image upload(s) to originals/"
            git push origin HEAD:"${{ github.head_ref }}"
          else
            echo "No changes to commit."
          fi

      - name: Validate carousel-images.json
        run: node -e "JSON.parse(require('fs').readFileSync('src/config/carousel-images.json', 'utf8')); console.log('carousel-images.json is valid JSON')"

      - name: Optimize carousel images
        run: npm run optimize-images

      - name: Build main site
        run: npm run build
        env:
          NODE_ENV: production

      - name: Install docs dependencies
        run: npm ci
        working-directory: ./docs

      - name: Build docs
        run: npm run build
        working-directory: ./docs
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pr-check.yml
git commit -m "Auto-move raw image uploads to originals/ before PR validation"
```

---

### Task 3: End-to-end verification against a real PR

**Files:** none (verification only — no code changes)

**Interfaces:**
- Consumes: the merged workflow + script from Tasks 1–2 running on `main`.
- Produces: confirmation the feature works against real GitHub Actions, not just local simulation. This is the task's deliverable.

- [ ] **Step 1: Merge the branch containing Tasks 1–2 into `main`** (via PR, following this repo's existing pattern of PR-per-change) so the new workflow is active for future PRs.

- [ ] **Step 2: Open a throwaway PR that uploads a raw image directly into `public/images/meetings/`**

```bash
git checkout main && git pull --ff-only
git checkout -b verify-auto-move-e2e
cp originals/images/meetings/Jan_Mtg_1.jpg public/images/meetings/E2ETest.jpg
git add public/images/meetings/E2ETest.jpg
git commit -m "e2e: verify auto-move workflow with a raw upload"
git push -u origin verify-auto-move-e2e
gh pr create --title "E2E check: auto-move raw upload" --body "Throwaway PR to verify the auto-move workflow. Will close without merging."
```

- [ ] **Step 3: Watch the check run and confirm the fix commit lands**

```bash
gh pr checks <PR_NUMBER>
```

Expected: the "PR Checks" run succeeds. Then confirm the branch was fixed:

```bash
git fetch origin verify-auto-move-e2e
git log origin/verify-auto-move-e2e --oneline -3
```

Expected: a commit `Auto-move raw image upload(s) to originals/` appears on top of your `e2e:` commit, and:

```bash
git show origin/verify-auto-move-e2e --stat
```

confirms `public/images/meetings/E2ETest.jpg` was renamed to `originals/images/meetings/E2ETest.jpg` and `public/images/meetings/E2ETest.webp` was created.

- [ ] **Step 4: Confirm root-level assets are left alone**

```bash
git checkout verify-auto-move-e2e 2>/dev/null || git checkout main
git pull origin verify-auto-move-e2e --ff-only 2>/dev/null || true
cp public/images/logo.png public/images/logo-e2e-check.png
git add public/images/logo-e2e-check.png
git commit -m "e2e: verify root-level assets are ignored"
git push
gh pr checks <PR_NUMBER>
```

Expected: check still passes, and `public/images/logo-e2e-check.png` remains in `public/images/` (not moved to `originals/`) — confirm with `git show HEAD --stat` after the CI push settles (`git pull`).

- [ ] **Step 5: Clean up the throwaway PR**

```bash
gh pr close <PR_NUMBER> --delete-branch
```

No commit for this task — it's verification-only, and the throwaway branch is deleted in Step 5.
