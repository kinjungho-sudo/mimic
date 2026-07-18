# Parro Review Notes

## 2026-07-17 — Benchmark Loop Cycle 1

### Review outcome

- Runtime foundation: pass with approval-gated environment and repository
  policy follow-ups.
- Branch safety: work stayed on `dev`; `main` was not checked out, merged,
  committed, pushed, or deployed.
- Product code risk: no capture, auth, database, storage, or architecture code
  changed.

### Low-risk changes to review

- Restored the benchmark runbook and worklog protocol to `dev` from the
  canonical `origin/brand/parro-system` source, normalizing trailing whitespace.
- Added the conventional `npm test` entry point as an alias for the existing
  `verify:quality` suite.
- Updated local setup documentation to prefer reproducible `npm ci` installs
  and document the Windows `npm.cmd` fallback.

### Evidence reviewed

- App lint, TypeScript, quality suite, production build, and bounded localhost
  `/landingpage` smoke passed.
- Recorder syntax, targeting, and desktop-import fixture checks passed.
- MCP TypeScript build passed.
- Native host protocol, chunked image import, and unsigned installer build
  passed without installing or publishing the installer.
- Static inspection confirmed the real-time step panel, finalize flow, and
  editor URL handoff remain wired.

### MAX / owner review requested

1. Decide AQ-001 before any benchmark command is allowed to exercise APIs or
   authenticated server behavior from a local production-mode build.
2. Decide AQ-002 in a dedicated dependency-hygiene change.
3. Decide AQ-003 before the desktop installer leaves DEV preview status.
4. For Cycle 2, provide or approve a safe DEV Chrome profile for live browser
   and desktop capture QA; fixture coverage is not a substitute for a full
   interactive recording.
