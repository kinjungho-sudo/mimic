# Parro Review Notes

## 2026-07-18 - Benchmark Loop Cycle 2

### Review outcome

- Capture-flow foundation: pass for source wiring and isolated pre-capture
  browser runtime; live browser/desktop capture remains approval-gated.
- Branch safety: work stayed on `dev`, fetched `origin/dev`, and confirmed the
  Cycle 1 commit remained the single local commit before Cycle 2 changes.
  `main` was not touched and nothing was pushed.
- Product code risk: no auth, capture, upload, database, storage, native-host,
  installer, privilege, or architecture behavior changed.

### Low-risk changes to review

- Added an isolated temporary Playwright Chromium profile smoke for the
  unpacked Recorder. It verifies extension startup, content-script response,
  localhost tab discovery, side-panel loading, the unlinked start gate, and
  absence of capture state after the blocked start.
- Added a read-only source contract verifier across dashboard start, Recorder
  capture/step/finalize, desktop setup, Native Messaging bridge, and host.
- Corrected `/desktop-setup`'s connection error from Recorder `1.7.0` to the
  manifest's current `1.7.1`.
- Added the safe DEV capture audit/runbook and classified existing native smoke,
  capture-agent, and installer tests as unsafe for a live user session.

### Evidence reviewed

- Isolated Recorder profile smoke: 8 checks passed, localhost-only, no capture
  started, and no temporary profile remained.
- Cross-runtime source contract: 11 checks passed without live capture or OS
  mutation.
- Existing target-selection and desktop-import fixtures passed 5 and 15 checks.
- Source inspection confirmed that linked browser clicks and desktop imports
  can upload/analyze/save data, while native start launches the real capture
  agent and installer verification changes Windows state.

### MAX / owner review requested

1. Resolve AQ-001 and AQ-004 before any linked browser click, upload, finalize,
   or authenticated API E2E is permitted.
2. Resolve AQ-003 before live native capture, host installation, elevation, or
   installer verification outside a disposable controlled Windows environment.
3. For Cycle 3, prefer a synthetic side-panel step/thumbnail fixture in the
   isolated profile; it can verify click feedback without capturing a screen.

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
