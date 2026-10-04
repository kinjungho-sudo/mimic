# Parro Desktop monitor capture design QA

## Source

- Selected visual reference: `C:\Users\김정호\.codex\generated_images\019ff015-27aa-7f01-920c-a8b484027973\exec-2b9f1192-befb-47e8-a37e-927811b70659.png`
- Combined comparison: `D:\project\dev\mimic\mimic_desktop\native-host\dist\parro-monitor-design-qa-comparison.png`

## Implementation renders

- Monitor selection: `D:\project\dev\mimic\mimic_desktop\native-host\dist\launcher-topology-final.png` — 1040 × 720, two physical monitors, primary monitor selected
- Default recording side panel: `D:\project\dev\mimic\mimic_desktop\native-host\dist\launcher-side-panel-final.png` — 410 × 720, active recording state
- Compact recording toolbar: `D:\project\dev\mimic\mimic_desktop\native-host\dist\launcher-mini-toolbar-final.png` — 960 × 68, active recording state

## Findings and iteration history

1. Replaced the fixed monitor dropdown with a scaled Windows virtual-desktop topology. Each card uses a live screenshot from its physical monitor and retains the monitor's real left, top, width, and height relationship.
2. Kept the selected reference's strong two-state flow: visual screen selection first, persistent side panel during recording second.
3. Added an explicit all-screens control and a compact toolbar option without weakening the default side-panel hierarchy.
4. Verified synthetic vertical and three-monitor coordinates in addition to the connected two-monitor layout. All mapped screens retained the intended above/left/primary relationships.
5. Combined reference and implementation inspection found no clipped primary controls, broken spacing, missing monitor content, or ambiguous selected state. The implementation intentionally uses the real Windows topology instead of forcing the reference's left/right-only layout.

final result: passed

---

# Parro Desktop web-parity area blur v0.6.5 design QA

## Evidence

- Source visual truth: `C:\Users\김정호\.codex\generated_images\019ff015-27aa-7f01-920c-a8b484027973\exec-c3ac9a63-92ec-4f56-b354-9d49b1847d97.png` — selected web-style persistent side-panel direction
- Web interaction truth: `mimic_recorder/popup.js` `startBlurMode` flow — expand preview, select area by drag, normalize against the rendered image, apply pixel blur, refresh preview, Escape to cancel
- Implementation screenshot: `D:\project\dev\mimic\mimic_desktop\native-host\dist\launcher-side-panel-blur-v065.png` — 410 × 720 at 1× density
- Combined comparison: `D:\project\dev\mimic\mimic_desktop\native-host\dist\parro-area-blur-v065-comparison.png` — 872 × 786
- State: recording preview enlarged, area-blur mode active, normalized selection rectangle visible

## Fidelity review

- Fonts and typography: Segoe UI hierarchy remains consistent with the selected Windows-native reference; the blur instruction is compact and readable.
- Spacing and layout rhythm: the blur toolbar stays above the image, leaving the image itself as the dominant interaction surface.
- Colors and tokens: Parro teal is used for the active blur action and dashed selection; the dark overlay matches the web Recorder zoom treatment.
- Image quality: the original capture remains full resolution. Pixelation is written to the source PNG only inside the normalized drag region and the card reloads from that edited file.
- Copy and content: `영역 블러`, drag guidance, `Esc 취소`, too-small-area feedback, processing, success, and failure states are present.

## Interaction verification

1. Preview opens in a full-panel overlay.
2. `영역 블러` enters crosshair selection mode.
3. Selection coordinates compensate for image letterboxing and clamp to the actual rendered image.
4. Dragging a valid area pixelates only that normalized region; a too-small area remains in selection mode with guidance.
5. The enlarged image and chronological step card refresh immediately from the edited PNG.
6. Re-entering area blur supports additional regions on the same step; all regions are retained in `blur-edits.jsonl` and merged into the capture summary used by upload.
7. Escape cancels selection before closing the preview.

## Findings

- No actionable P0/P1/P2 visual or interaction differences remain for the requested area-blur flow.
- The source mock does not depict the zoom/blur state, so the focused state was checked against the shipping web Recorder interaction and token definitions rather than a mock-only overlay.

final result: passed

---

# Parro Desktop recording panel v0.6.4 design QA

## Source and parity target

- Behavioral and visual source: `mimic_recorder/popup.html` and `mimic_recorder/popup.js` (`.steps-list`, `.step-card`, chronological `renderSteps`, automatic scroll to the newest step, thumbnail zoom overlay)
- Previous desktop panel render: `D:\project\dev\mimic\mimic_desktop\native-host\dist\launcher-side-panel-final.png`
- Combined before/after comparison: `D:\project\dev\mimic\mimic_desktop\native-host\dist\parro-side-panel-v064-comparison.png`

## Implementation render

- Updated panel: `D:\project\dev\mimic\mimic_desktop\native-host\dist\launcher-side-panel-v064-final.png` — 410 × 720, three chronological expanded capture cards

## Findings and iteration history

1. Removed the desktop-only latest-screen hero preview; the content area now starts with the same “캡처된 스텝” hierarchy as the web Recorder.
2. Rebuilt captures as numbered, expanded cards in chronological order. New captures append at the bottom and automatically scroll into view.
3. Added click-to-enlarge image viewing using a full-panel dark zoom overlay and Escape/click close behavior.
4. Replaced the hide-to-bottom-toolbar action with a right-edge dock. The visible teal `PARRO` handle communicates the hidden state; pointer hover reveals the panel and pointer leave returns it after a short delay.
5. Added header dragging and a bottom-right resize grip while preserving capture exclusion and toolbar-bound updates as the panel moves.
6. Combined render inspection found no clipped step title, thumbnail, scrollbar, primary controls, or recording status at the default 410 × 720 state.

final result: passed
