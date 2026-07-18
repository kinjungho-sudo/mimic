# Mistakes and Safety Lessons

This file records verified failure patterns and non-negotiable recovery rules for Parro development.

## Rebrand safety

### Do not run broad brand replacement

`mimic` appears in public copy, SDK compatibility aliases, storage keys, DB/schema names, package names, routes, headers, deployment identifiers, and historical docs. A blind replacement can break existing users, data, auth, extensions, and integrations.

Classify each match before changing it:

- public surface
- compatibility alias
- internal identifier
- historical record
- owner decision

### Do not rename `mm_*` tables during the public rebrand

The owner approved `mm_*` as Parro's internal database namespace. Renaming tables can break queries, RLS policies, functions, triggers, Realtime, automation, and external integrations. New tables keep `mm_*` until a separately approved Phase 3 migration exists.

### Do not use screenshots as production logo assets

Screenshots and chat images are visual references only. Production logo/icon replacement requires clean SVG/PNG assets that can be rendered and inspected at favicon sizes.

## Deployment and domain safety

### Do not point a Parro alias at an unverified deployment

The first `parro-guide.vercel.app` assignment pointed to the existing Production deployment, which still rendered MIMIC. Verification caught this and the alias was immediately moved to a Parro Preview.

Required order:

1. Create a Preview.
2. Verify status, public pages, metadata, assets, DB environment, and error logs on its unique URL.
3. Move the alias only after those checks pass.
4. Re-run the same checks through the alias.

### Visible copy checks are not enough

A page can display Parro while metadata, canonical URLs, robots, or sitemap still expose the old deployment URL. Inspect HTML source plus `/robots.txt` and `/sitemap.xml`.

### Do not change shared Vercel env to fix one Preview

A branch-scoped env add failed with `branch_not_found` because `brand/parro-system` was not pushed to the connected repository. Do not overwrite the shared Preview value as a shortcut.

For an isolated manual Preview, use deployment-scoped `--build-env` and `--env`, verify the deployment, and record the rollback target.

### Do not treat a successful build as runtime verification

Lint/build prove compilation, not public behavior. Verify the actual deployment URL, HTTP status, visible brand copy, metadata, Supabase project reference, robots/sitemap, and error logs.

## Git safety

### Never apply the rebrand directly to `main`

Use `brand/parro-system`, then an owner-approved `--no-ff` merge to `dev`. Verify the Git-generated Preview before any later Production decision.

### Do not rewrite shared history to roll back

Revert the Parro merge commit with `git revert -m 1 <merge_sha>`. Do not use `git reset --hard` or force-push on shared branches.

### Fetch before integration

Run `git fetch origin dev` and verify behind/ahead plus ancestry immediately before merge. Stop if `origin/dev` is no longer an ancestor or the worktree is dirty.

## Recorder and Web Store safety

### Do not assume a web alias can connect to the extension

The exact origin must be in Recorder `externally_connectable`. Keep old origins during the transition for rollback compatibility.

### Do not publish while validating packaging

Build the Web Store ZIP locally, inspect its manifest, path separators, icons, name, permissions, and version, then remove the artifact. Store publication and version bumps require separate approval.

## Environment handling

### Never print or commit secrets

When auditing Supabase/Vercel environments, output only variable names, project references, or exact known-value classifications. Remove temporary pulled env files after inspection.

### Keep dev and Production DBs separate

- Preview/dev: `dskphgxurxebblnpwhax`
- Production: `gqynptpjomcqzxyykqic`

Do not point Preview at Production or Production at dev. Do not copy, delete, or migrate production data as part of the rebrand.

## Synthetic capture-result verification

### Do not treat a temporary profile alone as a complete safety boundary

A synthetic Recorder UI test must also block and record HTTP(S), record capture
commands, avoid tokens/session state, use artificial storage/IndexedDB data,
and prove exact temporary-profile cleanup. A disposable browser directory does
not by itself prevent backend mutation.

### Do not infer card interaction from styling or source text

A pointer cursor or an `expanded` class is not proof that a step card can be
collapsed and reopened. Exercise the real mouse and keyboard interactions and
assert the thumbnail visibility plus `aria-expanded` state in the isolated UI.
