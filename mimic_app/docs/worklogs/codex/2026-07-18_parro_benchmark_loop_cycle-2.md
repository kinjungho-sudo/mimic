# Parro Benchmark Loop Cycle 2 - 2026-07-18

## 1. Source Brief

- Requested task: run Cycle 2 on the current `dev` branch only, preserve the
  Cycle 1 commit, audit a safe Scribe-like browser/desktop capture flow, make
  only low-risk fixes, queue high-risk decisions, write a repo worklog, and
  commit without pushing.
- Runbook: `docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md`
- Starting branch: `dev`
- Base DEV branch: `origin/dev` at
  `2d927cefbb4ff1dbecb003a44c7daed7e7464377`
- Starting commit: `cd9bbe912d37f4b168932bee005e51bd35d1578c`
- After `git fetch origin dev`, ahead/behind was `0 1`: local `dev` was exactly
  one commit ahead and the one local commit was Cycle 1.
- Confirmed not main: yes
- Main touched: no
- Cycle 1 commit rewritten or amended: no
- Push performed: no
- Selected cycle: Cycle 2 - Scribe Capture Flow Audit

## 2. Files Read

- `AGENTS.md`
- `mimic_app/CLAUDE.md`
- `mimic_recorder/CLAUDE.md`
- `mimic_app/docs/mistakes.md`
- `mimic_app/docs/approval-queue.md`
- `mimic_app/docs/review-notes.md`
- `mimic_app/docs/implementation-log.md`
- `mimic_app/docs/codex/CODEX_WORKLOG_PROTOCOL.md`
- `mimic_app/docs/codex/PARRO_SEMI_AUTO_BENCHMARK_LOOP.md`
- `mimic_app/docs/worklogs/codex/2026-07-17_parro_benchmark_loop_cycle-1.md`
- `mimic_app/components/dashboard/RecordingModal.tsx`
- `mimic_app/lib/extension-id.ts`
- `mimic_app/app/desktop-setup/page.tsx`
- `mimic_app/package.json` and app/root `.gitignore` files
- `mimic_recorder/manifest.json`
- `mimic_recorder/background.js`
- `mimic_recorder/content.js`
- `mimic_recorder/popup.js`
- `mimic_recorder/desktop-bridge.js`
- `mimic_recorder/desktop-import.js`
- Recorder targeting/import verification scripts
- `mimic_desktop/native-host/src/host.js`
- `mimic_desktop/native-host/src/controller.ps1`
- `mimic_desktop/native-host/src/capture-agent.ps1`
- Native host smoke/import/capture-agent scripts
- Native host installer source and installer verification script

## 3. Benchmark Focus

- Competitor: Scribe
- Official references:
  - [Browser capture](https://support.scribehow.com/hc/en-us/articles/9008025006749-Basics-How-to-create-a-Scribe-using-Chrome-or-Edge)
  - [Windows desktop app](https://support.scribehow.com/hc/en-us/articles/7005266699933-Scribe-Desktop-App-Windows)
  - [Windows capture completion](https://support.scribehow.com/hc/en-us/articles/14969089852317-Updating-to-the-newest-Scribe-Windows-app)
  - [Capture outside the browser](https://support.scribehow.com/hc/en-us/articles/10114064422429-How-to-capture-Scribes-on-desktop-apps-outside-of-my-browser)
  - [Playwright extension testing](https://playwright.dev/docs/chrome-extensions)
  - [Chrome extension E2E testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)

Observed quality standards:

1. Start is explicit and immediately exposes capture state/controls.
2. Captured steps appear as the workflow runs.
3. Completion creates the guide and hands the user to an editor.
4. Browser profile, captured-data, OS capture, installation, and elevation
   boundaries are explicit.

Parro acceptance criteria for Cycle 2:

1. Map browser and desktop start-to-editor wiring without using a real browser
   profile, real screen capture, installer, registry, or production data.
2. Prove the unpacked Recorder's pre-capture boundary in a disposable browser
   profile and prove cross-runtime wiring with read-only contracts/fixtures.
3. Identify the first operation that requires a dedicated DEV account/data
   lifecycle and the first operation that mutates Windows.
4. Define the smallest safe Cycle 3 test that advances click feedback/step
   panel coverage without live capture.

## 4. Six Loop Results

| Loop | Result | Issues Found | Auto-fixed | Approval Needed | Notes |
|---|---|---:|---:|---:|---|
| Code Stability | Pass | 2 | 2 | 0 | Added browser and cross-runtime verification seams; corrected Recorder version copy. |
| Runtime/Build | Pass with constraints | 2 | 1 | 1 | Isolated Chromium works without user Chrome; live native start launches real capture and remains AQ-003 gated. |
| Core Scenario | Partial pass | 2 | 0 | 2 | Start/step/finalize/editor wiring is present; linked cloud capture and Windows capture were intentionally not run. |
| UI/UX | Partial pass | 1 | 0 | 0 | Side-panel document and step renderer are wired; live step visuals were not exercised. |
| Security/Data | Needs approval | 3 | 1 | 3 | Temporary profile isolation is automated; production fallback, DEV capture data, and OS privilege decisions remain queued. |
| Product Completeness | Pass for audit scope | 1 | 1 | 0 | Added a safe command matrix and a bounded Cycle 3 recommendation. |

## 5. Changes Made

- `mimic_app/scripts/verify-recorder-profile.mjs`
  - Added a localhost-only Playwright Chromium persistent-context smoke under an
    owned OS temporary `Parro-BrowserProfile-*` directory.
  - Verifies extension worker/manifest, content-script status, external tab
    discovery, side-panel document, the `not_linked` gate, and absence of
    capture state after the blocked start.
  - Deletes only its validated owned temporary profile and performs no browser
    download automatically.
- `mimic_app/package.json`
  - Added `npm run verify:recorder-profile`.
- `mimic_recorder/scripts/verify-capture-flow-contract.js`
  - Added 11 read-only source contract checks spanning web start, browser
    capture, live steps, finalize/editor navigation, desktop setup, bridge, and
    native-host message handlers.
- `mimic_app/app/desktop-setup/page.tsx`
  - Corrected the connection error's Recorder version from `1.7.0` to the
    manifest's `1.7.1`.
- `mimic_app/docs/codex/PARRO_SAFE_DEV_CAPTURE_AUDIT.md`
  - Documented intended flows, safe tests, isolated-profile rules, data/OS
    mutation boundaries, prohibited live-session tests, and Cycle 3 scope.
- `mimic_app/docs/approval-queue.md`
  - Added AQ-004 for the dedicated DEV capture identity/data lifecycle.
  - Added Cycle 2 OS-capture evidence to AQ-003.
- `mimic_app/docs/review-notes.md`
  - Added Cycle 2 review evidence and owner follow-ups.
- `mimic_app/docs/implementation-log.md`
  - Recorded the Cycle 2 safe capture audit.
- `mimic_app/docs/worklogs/codex/2026-07-18_parro_benchmark_loop_cycle-2.md`
  - Added this required repo worklog.

## 6. Product Behavior Implemented

- Developers can safely prove that the unpacked DEV Recorder boots, connects to
  a localhost fixture, exposes its side panel, and rejects an unlinked start
  before creating capture state.
- Developers can detect accidental breaks in the intended browser/desktop
  command chain without starting capture.
- The desktop setup error now names the installed Recorder version correctly.
- No capture, auth, upload, database, native-host, installer, privilege, or
  editor behavior changed.

## 7. Verification

```text
git fetch origin dev; git branch --show-current;
git rev-list --left-right --count origin/dev...HEAD
PASS - branch dev; ahead/behind 0 1 before Cycle 2; Cycle 1 HEAD preserved.

npm.cmd run lint
PASS - no ESLint warnings or errors.

npx.cmd tsc --noEmit --pretty false
PASS - no TypeScript errors.

npm.cmd test
PASS - 23 capture fallback cases, 6 regeneration checks, and follow config.
Existing module-type and experimental-loader warnings remain; package module
semantics were not changed automatically.

npm.cmd run verify:recorder-profile
PASS - 8 checks; isolated temporary Playwright Chromium; localhost-only;
captureStarted=false. No Parro temporary browser profile remained afterward.

node --check scripts/verify-capture-flow-contract.js
node scripts/verify-capture-flow-contract.js
node scripts/verify-targeting.js
node scripts/verify-desktop-import.js
PASS - syntax; 11 source contracts; 5 targeting checks; 15 import checks.

node scripts/test-native-import.js
PASS - one synthetic event and 819,200 bytes restored over three chunks.
```

`next build` was not run in Cycle 2 because Cycle 1 established that it loads
the local production fallback covered by AQ-001. No production-mode API or
authenticated behavior was needed for this audit.

## 8. Manual QA

- Inspected the browser start ordering: direct start precedes the wake fallback,
  and the extension requests the side panel before awaiting account state.
- Inspected capture, live-step rendering, finalize, desktop import, and editor
  route handoff source.
- Confirmed the isolated browser smoke left no `Parro-BrowserProfile-*`
  directory behind.
- Did not use the user's Chrome profile, link an account, store a token, click
  while recording, capture a screen, upload/finalize data, connect to an
  installed native host, run the capture agent, install software, change HKCU,
  create shortcuts, elevate a process, deploy, or push.

## Desktop Capture Specific Report

### Desktop Runtime

- Runtime: Chrome Native Messaging host plus Node controller and PowerShell
  capture agent; no Electron/Tauri runtime.
- Global click listener: the agent polls the global left mouse button and reads
  UI Automation context. This is implemented but deliberately not exercised.
- OS permission: current preview is current-user/HKCU. Elevated application
  capture and distribution trust remain AQ-003 decisions.

### Multi-Monitor Capture

- Current code selects a monitor/window based on pointer and foreground-window
  context rather than unconditionally saving the whole virtual desktop.
- Geometry transformation has safe fixture coverage, including negative monitor
  coordinates.
- Physical multi-monitor, scale-factor, occlusion, and elevated-window behavior
  remain unverified.

### Step Preview

- `popup.html` is the manifest side panel.
- `renderSteps()` expands cards, loads thumbnails, updates counts, and scrolls
  when a step arrives.
- Cycle 2 proved the side-panel document boots, but did not inject a synthetic
  step or take a real screenshot. That is the proposed Cycle 3 seam.

### Finalize Flow

- Browser finish sends `FINALIZE_SESSION`; success opens
  `/manual/{id}/editor?from=recording`.
- Desktop stop/import reconstructs native images, saves/finalizes steps, returns
  `/manual/{id}/editor`, and the setup page assigns that URL.
- Finalize was source-verified only because it creates backend data.

## 9. Approval Queue Additions

- AQ-004: approve a dedicated DEV capture user/project/bucket, synthetic data,
  retention/cleanup ownership, and a positive production-use guard.
- AQ-003: expanded evidence that native start observes the active Windows
  session and installer verification mutates more than registry keys.

## 10. Known Limitations / Blockers

- A dedicated browser profile prevents mutation of the user's Chrome state but
  does not prevent backend mutations after account linking.
- Full browser click/upload/finalize E2E is blocked by AQ-001 and AQ-004.
- Full desktop capture and host install/elevation QA are blocked by AQ-003 and
  require a disposable controlled Windows environment.
- Playwright package/browser caches can be on different revisions. The smoke
  uses the package-requested Chromium when present, otherwise the newest
  already-installed Playwright Chromium; it never downloads one implicitly.
- Existing Node module-type/experimental-loader warnings remain.
- Pre-existing untracked screenshots, logs, JSON files, and the legacy root ZIP
  were left unchanged and excluded from the cycle commit.

## 11. Commit

- Cycle commit: this worklog's containing commit. Resolve with
  `git log -1 --format=%H -- mimic_app/docs/worklogs/codex/2026-07-18_parro_benchmark_loop_cycle-2.md`.
- Cycle 1 commit was not amended or rewritten.

## 12. Next Actions for MAX

1. Review AQ-004 together with AQ-001; do not authorize linked capture using an
   ambiguous local environment.
2. Keep AQ-003 pending until a disposable Windows QA environment and privilege,
   signing, consent, and distribution model are approved.
3. Review the safe test classification correction for
   `smoke-native-host.js`: despite its name, it starts the real capture agent.

## 13. Next Cycle Recommendation

- Cycle 3 - Click Highlight + Step Panel.
- Add one synthetic step and in-profile synthetic thumbnail to the isolated
  Recorder side panel, then verify expanded card, click-target metadata, count,
  thumbnail, and auto-scroll without token, click, screenshot, API, or native
  host activity.
