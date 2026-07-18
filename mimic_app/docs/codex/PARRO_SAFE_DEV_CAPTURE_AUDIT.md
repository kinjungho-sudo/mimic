# Parro Safe DEV Capture Audit

Cycle 2 audit date: 2026-07-18

This document defines the safe verification boundary for Parro's browser and
Windows desktop capture foundations. It does not authorize production data
access, a real user Chrome profile, native-host installation, screen capture,
or elevated execution.

## Benchmark references

- [Scribe browser capture flow](https://support.scribehow.com/hc/en-us/articles/9008025006749-Basics-How-to-create-a-Scribe-using-Chrome-or-Edge)
- [Scribe Desktop App for Windows](https://support.scribehow.com/hc/en-us/articles/7005266699933-Scribe-Desktop-App-Windows)
- [Scribe Windows capture and completion flow](https://support.scribehow.com/hc/en-us/articles/14969089852317-Updating-to-the-newest-Scribe-Windows-app)
- [Scribe capture outside the browser](https://support.scribehow.com/hc/en-us/articles/10114064422429-How-to-capture-Scribes-on-desktop-apps-outside-of-my-browser)
- [Playwright extension testing](https://playwright.dev/docs/chrome-extensions)
- [Chrome extension end-to-end testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- [Chrome extension storage behavior](https://developer.chrome.com/docs/extensions/reference/api/storage)

The translated Parro quality bar is: explicit start, visible capture state and
step feedback, explicit completion, and automatic editor handoff. Browser and
desktop privilege/data boundaries must remain visible rather than being hidden
behind a nominal end-to-end test.

## Audit conclusion

Parro already has the control-flow foundation for a Scribe-like browser and
desktop journey. The browser path can be booted and its pre-capture boundary
tested safely in an isolated Playwright Chromium profile. The desktop protocol
and import transformation can be tested with source contracts and synthetic
fixtures.

A dedicated browser profile is necessary but not sufficient for a real click
capture. Once a linked browser recording accepts a click, the current Recorder
can capture the visible tab, upload the image, call analysis/save APIs, and
finalize a tutorial. A real desktop start launches an OS-level capture agent.
Those stages remain outside automatic Cycle 2 verification.

## 1. Current intended capture flow

### Browser

1. The dashboard resolves the unpacked DEV Recorder ID, links the current
   Parro account, and asks the extension for recordable tabs.
2. The user selects a tab. The dashboard sends `START_RECORDING` directly
   before its wake-and-retry fallback so the extension can request the side
   panel while the user gesture is still active.
3. The extension opens `popup.html` as its side panel, rejects unlinked starts,
   creates local session state for linked starts, focuses the selected tab,
   injects the content scripts, and arms recording.
4. Content-script click events request a visible-tab screenshot. The background
   path processes the image, uploads it, calls analysis/save APIs, and writes
   step metadata to extension storage/IndexedDB.
5. `popup.js` renders expanded step cards and scrolls to each newly added step.
6. Finish sends `FINALIZE_SESSION`. Success opens
   `/manual/{tutorial_id}/editor?from=recording` and clears temporary capture
   state.

### Windows desktop

1. `/desktop-setup` asks the Recorder for `DESKTOP_COMPANION_STATUS`, then sends
   start, pause/resume, undo, stop, or import commands.
2. `desktop-bridge.js` translates those commands to the compatibility Native
   Messaging host `com.mimic.desktop_companion.dev`.
3. The host starts the PowerShell capture agent. The agent polls the global
   left mouse button, inspects UI Automation context, and copies the selected
   monitor/window pixels to local PNG files.
4. Stop/import reads session metadata and PNG chunks through Native Messaging.
   `desktop-import.js` converts events to Parro step geometry.
5. The Recorder uploads/analyzes/saves the imported steps, finalizes the
   tutorial, and returns `/manual/{tutorial_id}/editor`; `/desktop-setup`
   navigates to that URL.

## 2. What is safely testable now

| Surface | Safe verification | What it proves | What it does not prove |
|---|---|---|---|
| Browser profile | `npm.cmd run verify:recorder-profile` | Unpacked extension/service worker load, side-panel manifest, content-script response, localhost external tab discovery, unlinked start gate, and no capture-state creation | Linked click capture, screenshot quality, upload, finalize, or real Chrome compatibility |
| Cross-runtime wiring | `node scripts/verify-capture-flow-contract.js` | Required browser/desktop commands, step panel, finalize, editor route, bridge, and host handlers remain connected in source | Runtime API success or UI appearance |
| Browser target selection | `node scripts/verify-targeting.js` | Pure target-selection behavior | A real click or screenshot |
| Desktop step conversion | `node scripts/verify-desktop-import.js` | Pure Windows-event-to-step geometry | OS capture accuracy |
| Native image transport | `node scripts/test-native-import.js` | Synthetic Native Messaging metadata and chunk reconstruction | Host registration or live capture |

The profile smoke creates `Parro-BrowserProfile-*` under the OS temporary
directory, loads only Playwright's bundled Chromium, serves a fixture only on
`localhost:3000` or `localhost:3001`, and deletes the owned profile on exit. It
does not download a browser automatically, sign in, enable sync, set a token,
take a screenshot, connect to the native host, or call Parro APIs.

## 3. Operations that require a dedicated DEV browser profile

Use an isolated profile for every unpacked Recorder test involving:

- the generated unpacked extension ID and web-app discovery;
- `chrome.storage.local`, extension IndexedDB, or the `parro_extension_id`
  web-app local-storage key;
- service-worker lifecycle, external messaging, content scripts, action UI, or
  the side panel;
- a future DEV-only linked account/token and synthetic capture fixture.

Never point automation at the user's Chrome profile or any directory under the
normal Chrome `User Data` tree. Do not sign the isolated profile into Chrome or
turn on sync. Playwright's persistent context is required for extension tests;
the temporary `userDataDir` is the isolation boundary.

## 4. Operations that mutate data or Windows

| Operation | Mutation/risk | Cycle 2 decision |
|---|---|---|
| Account link | Calls `/api/extension/link` and stores an extension token | Not run; requires a dedicated DEV account and AQ-001/AQ-004 decisions |
| Browser click capture | Reads visible-tab pixels, uploads an image, calls analysis/save APIs, and creates step data | Not run |
| Browser finalize | Creates/finalizes a tutorial and opens its editor | Not run |
| Native capture start | Launches PowerShell, observes global mouse state/UI Automation, and captures monitor/window pixels | Not run outside a disposable controlled desktop |
| Native-host install | Copies files under LocalAppData, writes HKCU Native Messaging and uninstall keys, and creates shortcuts | Not run; governed by AQ-003 |
| Installer verification | Installs, launches, checks registry/shortcuts, and may uninstall | Not run |
| Elevated capture | Changes the trust/consent model and can expose elevated application content | Not implemented or tested; governed by AQ-003 |

Do not use these existing commands as routine safe tests:

- `node scripts/smoke-native-host.js` because `START_CAPTURE_SESSION` launches
  the real capture agent;
- `test-capture-agent.ps1` because it observes the active Windows session and
  takes screenshots;
- `test-installer.ps1` or the installer because they change HKCU, shortcuts,
  installed files, and processes.

## 5. Smallest safe Cycle 3 step

Add a test-only side-panel fixture to the same isolated Playwright profile. The
fixture should write one synthetic step and an in-profile synthetic thumbnail,
then verify the expanded card, thumbnail, click-target metadata, step count,
and auto-scroll. It must not set an account token, dispatch a real click,
capture pixels, call a Parro endpoint, or connect to Native Messaging.

That step directly supports Cycle 3's click-highlight and step-panel focus. A
true linked browser capture/finalize test should wait for AQ-001 and AQ-004. A
true Windows capture should remain a disposable-VM/manual test behind AQ-003.

## Safe command set

```powershell
cd mimic_app
npm.cmd run verify:recorder-profile

cd ..\mimic_recorder
node scripts/verify-capture-flow-contract.js
node scripts/verify-targeting.js
node scripts/verify-desktop-import.js

cd ..\mimic_desktop\native-host
node scripts/test-native-import.js
```
