# Parro Benchmark Loop Cycle 1 — 2026-07-17

## 1. Source Brief

- Requested task: run the next Parro semi-auto benchmark loop cycle, stay on
  DEV, auto-fix only low-risk findings, record high-risk decisions, write a
  repo worklog, and commit.
- Runbook: `docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md` (initially absent on
  `dev`; read from the canonical `origin/brand/parro-system` source, then
  restored with trailing whitespace normalized).
- Starting branch: `dev`
- Base DEV branch: `dev`
- Starting commit: `2d927cefbb4ff1dbecb003a44c7daed7e7464377`
- Confirmed not main: yes
- Main touched: no
- Previous benchmark worklog: none found on fetched refs
- Previous approval queue: none found on fetched refs
- Selected cycle: Cycle 1 — Runtime Foundation

## 2. Files Read

- `AGENTS.md`
- `mimic_app/CLAUDE.md`
- `mimic_app/DEV_PROCESS.md`
- `mimic_app/README.md`
- `mimic_app/package.json`
- `mimic_app/docs/mistakes.md`
- `mimic_app/docs/implementation-log.md`
- `mimic_app/docs/codex/CODEX_WORKLOG_PROTOCOL.md`
- `mimic_app/docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md`
- `mimic_desktop/native-host/README.md`
- `mimic_desktop/native-host/scripts/build-dev-installer.ps1`
- `mimic_desktop/native-host/scripts/smoke-native-host.js`
- `mimic_desktop/native-host/scripts/test-native-import.js`
- `mimic_desktop/native-host/scripts/test-installer.ps1`
- `mimic_recorder/manifest.json`
- `mimic_recorder/popup.js`
- `mimic_recorder/background.js`
- `mimic_app/components/dashboard/RecordingModal.tsx`
- `packages/mcp-server/package.json`
- root and app `.gitignore` files

## 3. Benchmark Focus

- Competitor: Scribe
- Official references:
  - [Scribe Desktop App: Windows](https://support.scribehow.com/hc/en-us/articles/7005266699933-Scribe-Desktop-App-Windows)
  - [How to create a Scribe using Chrome or Edge](https://support.scribehow.com/hc/en-us/articles/9008025006749-Basics-How-to-create-a-Scribe-using-Chrome-or-Edge)
  - [Updating to the newest Scribe Windows app](https://support.scribehow.com/hc/en-us/articles/14969089852317-Updating-to-the-newest-Scribe-Windows-app)
  - [Capturing desktop apps outside the browser](https://support.scribehow.com/hc/en-us/articles/10114064422429-How-to-capture-Scribes-on-desktop-apps-outside-of-my-browser)

Observed quality standards:

1. A documented, direct install path exists for both browser and Windows
   capture runtimes.
2. Starting capture is explicit, capture state is visible, and steps appear in
   a side panel as the workflow runs.
3. Completing capture automatically creates a guide and opens it for editing.
4. Desktop runtime limitations and required privilege level are explained.

Parro acceptance criteria for Cycle 1:

1. Locked dependency resolution and conventional lint/test/build commands are
   runnable from a clean DEV checkout.
2. Web DEV startup, Recorder static verification, MCP build, native host smoke,
   image import, and local installer build have repeatable commands.
3. The existing start/stop, step-panel, finalize, and editor-handoff wiring is
   verified without changing capture architecture.
4. Any production-data or OS-privilege decision is approval-gated.

## 4. Six Loop Results

| Loop | Result | Issues Found | Auto-fixed | Approval Needed | Notes |
|---|---|---:|---:|---:|---|
| Code Stability | Pass | 1 | 1 | 0 | Added the missing standard `npm test` alias; lint, TypeScript, quality, Recorder, and MCP checks passed. |
| Runtime/Build | Pass with constraints | 2 | 2 | 0 | Restored missing runbook/protocol; documented `npm.cmd` after the local PowerShell shim was blocked. App and installer builds passed. |
| Core Scenario | Partial pass | 0 | 0 | 0 | Fixtures and source inspection confirmed start/stop, step list, desktop import, finalize, and editor handoff. Live Chrome/desktop capture was not run. |
| UI/UX | Pass for foundation scope | 0 | 0 | 0 | Local `/landingpage` returned 200, contained Parro, and had no legacy MIMIC H1. No redesign attempted. |
| Security/Data | Needs approval | 3 | 0 | 3 | Production local fallback, tracked dependencies, and Windows signing/privilege policy are in the approval queue. |
| Product Completeness | Pass for foundation scope | 1 | 1 | 0 | Local setup now documents a reproducible install and conventional test entry point. |

## 5. Changes Made

- `mimic_app/package.json`
  - Added `npm test` as an alias for the existing `verify:quality` suite.
- `mimic_app/README.md`
  - Switched setup guidance from `npm install` to `npm ci`.
  - Added the Windows `npm.cmd` execution-policy fallback and `npm test` to
    verification guidance.
- `mimic_app/docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md`
  - Restored the runbook from canonical `origin/brand/parro-system` content and
    normalized trailing whitespace.
- `mimic_app/docs/codex/CODEX_WORKLOG_PROTOCOL.md`
  - Restored the worklog protocol from the same canonical source and normalized
    trailing whitespace.
- `mimic_app/docs/approval-queue.md`
  - Added AQ-001 through AQ-003 without implementing them.
- `mimic_app/docs/review-notes.md`
  - Added Cycle 1 review evidence and owner follow-ups.
- `mimic_app/docs/implementation-log.md`
  - Recorded the Cycle 1 runtime-foundation result.
- `mimic_app/docs/worklogs/codex/2026-07-17_parro_benchmark_loop_cycle-1.md`
  - Added this required repo worklog.

## 6. Product Behavior Implemented

- Developers can run the existing quality verification through the conventional
  `npm test` command.
- Developers have reproducible install guidance and a Windows-safe npm command
  fallback.
- No end-user capture, auth, data, or UI behavior changed.

## 7. Verification

```text
git fetch origin dev
git merge --ff-only origin/dev
PASS — local dev fast-forwarded to fetched origin/dev; main untouched.

npm.cmd ci --dry-run --ignore-scripts --no-audit --no-fund
PASS — app lockfile resolved (3 adds, 1 removal, 1 change in dry-run);
MCP lockfile reported up to date.

npm.cmd run lint
PASS — no ESLint warnings or errors.

npx.cmd tsc --noEmit --pretty false
PASS — no TypeScript errors.

npm.cmd test
PASS — 23 capture fallback cases, 6 regeneration checks, and follow config
verification passed. Node reported existing module-type/experimental-loader
warnings; changing package module semantics was not considered low risk.

node --check ...; node scripts/verify-targeting.js;
node scripts/verify-desktop-import.js
PASS — Recorder syntax passed; targeting checks=5; desktop import checks=15.

npm.cmd run build  (packages/mcp-server)
PASS — TypeScript build completed.

node scripts/smoke-native-host.js; node scripts/test-native-import.js
PASS — PING/start/pause/resume/stop/session protocol passed; 819,200-byte
fixture restored across three Native Messaging chunks.

powershell.exe -NoProfile -ExecutionPolicy Bypass
  -File .\\scripts\\build-dev-installer.ps1
PASS — unsigned 34,258,944-byte ParroDesktopSetup.exe built under ignored
`dist`; PublishedToWebApp=False.

npm.cmd run build  (mimic_app)
PASS — Next.js compiled and generated 75 static pages.

bounded localhost Next DEV smoke, GET /landingpage
PASS — HTTP 200; Parro present; legacy MIMIC H1 absent.

tracked filename and high-confidence secret-pattern scan
PASS with review — no tracked env/key file beyond `.env.example` templates.
The sole text-pattern candidate was generic private-key parser code in the
tracked `jose` dependency, not a credential.

git diff --check
PASS — no whitespace errors after the final documentation edits.
```

## 8. Manual QA

- Confirmed the local DEV landing response renders Parro copy.
- Confirmed by source inspection that Recorder step cards show thumbnails and
  auto-scroll as steps are added.
- Confirmed by source inspection that successful finalize opens
  `/manual/{tutorial_id}/editor?from=recording` and clears local capture blobs.
- Did not perform a real Chrome extension recording, user-screen desktop
  capture, installer registry mutation, deployment, or database operation.

## Desktop Capture Specific Report

### Desktop Runtime

- Runtime: Windows Native Messaging host plus PowerShell capture agent; no
  Electron/Tauri runtime in the current preview.
- Global click listener: implemented by the capture agent; not exercised
  against the user's screen in this cycle.
- OS screen recording permission: Windows privilege/install policy remains
  approval-gated in AQ-003.

### Multi-Monitor Capture

- Capture behavior: current monitor or active window, according to the native
  host documentation and capture-agent contract.
- Virtual desktop prevention: the current monitor/window path avoids an
  unconditional whole-virtual-desktop screenshot.
- HiDPI: code exists in the capture path, but no physical multi-monitor/HiDPI
  manual QA was performed in Cycle 1.

### Step Preview

- Side panel: `popup.html` is the manifest side panel; `renderSteps()` creates
  expanded step cards and loads thumbnails as steps arrive.
- Click highlight: covered by existing targeting/import verification, not a
  physical screen capture in this cycle.

### Finalize Flow

- Finalize API: extension `finalizeSession()` calls the existing capture
  finalize route.
- Tutorial ID: required before success; desktop import is idempotently cached
  by native session ID.
- Editor navigation: browser capture opens
  `/manual/{id}/editor?from=recording`; desktop setup responses return
  `/manual/{id}/editor`.

## 9. Approval Queue Additions

- AQ-001: local production credential fallback / DEV guard policy.
- AQ-002: tracked MCP `node_modules` cleanup policy.
- AQ-003: Windows installer signing and privilege model.

## 10. Known Limitations / Blockers

- The full Chrome/desktop interaction needs a safe DEV browser profile and
  explicit manual QA; fixture tests do not prove real OS capture behavior.
- The installer install/uninstall test was intentionally not run because it
  mutates registry keys, shortcuts, and local installed files.
- Production-mode server/API behavior was not exercised because `.env.local`
  points at production; no production data access was needed for this cycle.
- Existing Node module-type and experimental-loader warnings remain. Adding
  `"type": "module"` to a Next.js application could change runtime semantics,
  so it was not auto-fixed.
- Pre-existing untracked screenshots, logs, JSON fixtures, and the legacy root
  ZIP were left unchanged and excluded from the cycle commit.

## 11. Commit

- Cycle commit: this worklog's containing commit. Resolve with
  `git log -1 --format=%H -- mimic_app/docs/worklogs/codex/2026-07-17_parro_benchmark_loop_cycle-1.md`.

## 12. Next Actions for MAX

1. Review and decide AQ-001 through AQ-003.
2. Confirm a safe DEV Chrome profile and non-sensitive test workflow for Cycle
   2 live capture QA.
3. Keep large dependency cleanup separate from product behavior changes.

## 13. Next Cycle Recommendation

- Cycle 2 — Scribe Capture Flow Audit.
- Focus on a safe DEV end-to-end recording: start, target app/window/display,
  capture only the selected surface, immediate click feedback and step panel,
  finish, manual creation, and automatic editor navigation.
