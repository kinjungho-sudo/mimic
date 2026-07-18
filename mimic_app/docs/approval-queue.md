# Parro Approval Queue

Last updated: 2026-07-17 (Benchmark Loop Cycle 1)

Only owner-approved decisions may move an item out of `Pending`. Benchmark
cycles may add evidence, but must not implement these items automatically.

## AQ-001 — Remove production credentials from the default local fallback

- Status: Pending
- Risk: High — security and production data
- Evidence: the ignored `mimic_app/.env.development.local` selects the Parro
  development Supabase project, while the ignored `mimic_app/.env.local`
  selects the production project and contains production-capable credentials.
  `next dev` loaded both files and correctly preferred the development file;
  `next build` loaded `.env.local`.
- Decision requested: choose whether developer workspaces must remove the
  production fallback entirely, or whether the repo should add a branch-aware
  guard that refuses production project references during DEV validation.
- Recommendation: remove production credentials from routine developer
  workspaces and use an explicit, separately approved production workflow.
- Auto-action taken: none. No credential values were printed, changed, staged,
  or used for a data mutation.

## AQ-002 — Untrack the vendored MCP `node_modules` tree

- Status: Pending
- Risk: Medium-high — repository and dependency architecture
- Evidence: `packages/mcp-server/node_modules` contains 4,987 tracked files
  totaling approximately 51.52 MiB even though a package lock exists and
  `npm ci --dry-run` succeeds.
- Decision requested: confirm whether this dependency tree is intentionally
  vendored for offline operation. If it is not, remove it from Git, add a
  recursive `node_modules` ignore rule, and rely on the lockfile.
- Recommendation: untrack it in a dedicated reviewed cleanup commit so the
  large deletion is isolated from product work.
- Auto-action taken: none; a multi-thousand-file repository change is outside
  the low-risk auto-fix boundary.

## AQ-003 — Approve the Windows desktop signing and privilege model

- Status: Pending
- Risk: High — OS security, distribution, and capture architecture
- Evidence: the current Parro installer builds successfully as an unsigned,
  current-user preview. The full installer test changes HKCU Native Messaging
  and uninstall registry keys. Scribe recommends elevated installation for
  capturing elevated applications, but adopting that behavior would change
  Parro's privilege and consent model.
- Decision requested: define code-signing requirements, current-user versus
  all-users installation, elevation behavior, and the applications Parro is
  permitted to capture before production distribution.
- Recommendation: keep the current preview current-user-only and unsigned for
  DEV; require signing and an explicit permission review before release.
- Auto-action taken: none. Cycle 1 built the installer locally without
  publishing or installing it.
