# Parro Dev Integration and Rollback Runbook

## Purpose

Integrate `brand/parro-system` into `dev` as one reversible merge unit. This runbook never merges or pushes `main` and never changes Production, Supabase, or data.

## Current evidence

Verified on `2026-07-11` after `git fetch origin dev`:

- `origin/dev...brand/parro-system`: behind `0`, ahead `87`.
- `origin/dev` is an ancestor of `brand/parro-system`.
- The rebrand worktree is clean.
- App lint/build, SDK and Recorder syntax checks, Recorder manifest assertion, MCP build, and Parro Preview QA pass.
- Current temporary alias: `https://parro-guide.vercel.app` -> Preview `dpl_J85ABCHTTM6EaxGXzvDMhZTCrh2i`.

Re-run these checks immediately before integration because `dev` may move.

## Integration result - 2026-07-11

- Owner approved merge and push to `dev`.
- Existing dirty `dev` worktree was preserved; integration used clean branch `integration/parro-dev` from `origin/dev`.
- Merged with `--no-ff` and pushed merge commit `216c35fb6b0783524bc21f1600907524b5c06979` to `dev`.
- Local lint/build, SDK/Recorder checks, manifest assertion, MCP build, and full diff check passed.
- Git Preview `dpl_DgLFYLdL1JsKoJ1zFeayujtJ9YMc` is Ready on the dev branch alias.
- `Preview (dev)` now has branch-scoped `NEXT_PUBLIC_APP_URL=https://parro-guide.vercel.app`; Production env remains unchanged.
- Six public routes, Parro assets, robots/sitemap, dev Supabase reference, browser rendering, and error logs passed.

Rollback source merge with:

```powershell
git revert -m 1 216c35fb6b0783524bc21f1600907524b5c06979
```

Remove the branch-scoped Preview URL only if the dev metadata rollback is also required; then redeploy the previous dev Preview.

## Required approval gate

Do not run the integration commands until the owner explicitly approves **merge to dev and push dev**.

Approval for this step does not approve:

- merge or push to `main`
- Production deployment or promotion
- shared Vercel environment changes
- final custom-domain cutover
- Chrome Web Store publication
- DB, schema, migration, bucket, or `mm_*` rename

## Pre-merge checks

Run in the integration worktree:

```powershell
git fetch origin dev
git status --short --branch
git rev-list --left-right --count origin/dev...brand/parro-system
git merge-base --is-ancestor origin/dev brand/parro-system
```

Stop if:

- the worktree is dirty
- the left count is not `0`
- `origin/dev` is not an ancestor of `brand/parro-system`
- any required verification command fails

## Dev integration

```powershell
git checkout dev
git pull --ff-only origin dev
git merge --no-ff brand/parro-system -m "merge: integrate Parro public rebrand"
```

Run before any push:

```powershell
cd mimic_app
npm run lint
$env:NODE_OPTIONS='--use-system-ca'
npm run build
cd ..
node --check mimic_app/public/sdk.js
node --check mimic_recorder/content.js
node --check mimic_recorder/background.js
node --check mimic_recorder/guide-engine.js
node --check mimic_recorder/popup.js
cd packages/mcp-server
npm run build
cd ../..
git diff --check origin/dev...HEAD
```

Only after all checks pass and the owner has approved the push:

```powershell
git push origin dev
```

Verify the resulting Vercel Preview before considering any later Production step. Do not merge `main` in this runbook.

## Git rollback

If the `dev` merge causes a regression, preserve history and revert the merge commit:

```powershell
git checkout dev
git pull --ff-only origin dev
git log --merges -5 --oneline
git revert -m 1 <parro_merge_commit_sha>
```

Re-run the same verification commands, then push the revert to `dev` only after approval:

```powershell
git push origin dev
```

Do not use `git reset --hard`, force-push, or rewrite shared branch history.

## Temporary alias rollback

The current Parro alias can be moved back without changing Production:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
vercel alias set mimic-9apmt74sw-kinjungho-7735s-projects.vercel.app parro-guide.vercel.app --scope kinjungho-7735s-projects
```

Earlier verified fallback Preview: `dpl_8KycS2iBFbDi8K826UeEjmpm5TBw`.

The alias can also be removed if temporary Parro access must be stopped. Existing Production aliases remain unchanged.

## Later gates

After the `dev` Preview is verified, the following still require separate owner approval:

1. Final custom Parro domain and mailbox.
2. Production environment URL changes.
3. Recorder production origin and Chrome Web Store publication.
4. Merge to `main` and Production promotion.
5. Any Phase 3 internal identifier migration.
