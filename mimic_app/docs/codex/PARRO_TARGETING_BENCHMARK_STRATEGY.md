# Parro Targeting Benchmark Strategy

Date: 2026-08-25

## 1. Objective

Eliminate visibly wrong screenshot annotations and Live Guide targets by
separating capture evidence from each product surface that consumes it.

The product quality rule is:

> A missing or point-only target is preferable to a confident-looking box on
> the wrong element.

This strategy covers browser Recorder capture, generated manual annotations,
manual editing, Learning Guide rendering, and Live Guide replay. It does not
change Desktop capture.

## 2. What Competitors Actually Do

The vendors do not publish their selector or geometry algorithms. The findings
below distinguish observed product behavior from architectural inference.

| Product | Observed behavior | Implication for Parro |
|---|---|---|
| Scribe | Screenshot guides default to a click target at the recorded click position. The target can be moved, removed, recolored, or changed from a circle to a rectangle. Screenshot zoom naturally focuses on that target. Guide Me is presented as a separate browser walkthrough experience. | A point marker is the stable default for click documentation. Framing follows the marker; it does not redefine the captured target. Document rendering and browser replay should be separate consumers. |
| Supademo | Screenshot/video hotspots use editable X/Y positions. HTML demos use a different model: the user selects an actual element while hovering and the hotspot is anchored to that element. The anchor can be replaced after capture. | Static-media coordinates and live-element anchors are explicitly different data types. The editor exposes recovery instead of silently inventing a target. |
| Tango | Workflow documentation is generated from clicks, screenshots, annotations, and descriptions. Guide Me and pinned in-app knowledge are presented as separate overlay products. | Treat document generation and current-page guidance as separate outputs, even when they originate from the same capture event. |
| Guidde | Screenshot/video overlays and spotlight shapes are editable media elements. Users can position and resize them after capture. | Static annotations should remain image-space objects with deterministic persistence and visible manual recovery. |

Primary references:

- Scribe click targets: https://support.scribehow.com/hc/en-us/articles/7006817910429-Screenshots-Click-Target
- Scribe screenshot zoom: https://support.scribehow.com/hc/en-us/articles/7006830679709-Screenshots-Zooming-in-and-out
- Scribe Guide Me: https://support.scribehow.com/hc/en-us/articles/9117306305565-How-to-launch-Guide-Me-for-interactive-walkthroughs
- Supademo hotspots: https://docs.supademo.com/customize/hotspot
- Supademo HTML hotspots: https://docs.supademo.com/article/224-html-based-hotspots
- Supademo browser capture: https://docs.supademo.com/article/39-record-browser
- Tango process documentation: https://crm.tango.us/process-documentation
- Guidde overlays: https://help.guidde.com/en/articles/10383126-how-to-hide-sensitive-information

Competitors still report capture incidents. The benchmark is not zero internal
failure; it is preventing a failure from becoming a polished but incorrect
instruction.

## 3. Current Parro Failure Pattern

The 2026-08-25 Gmail reproduction proved:

1. Recorder stored the Gmail body selector and full `568 x 410` CSS-pixel DOM
   rectangle correctly.
2. The manual annotation pipeline later compacted that rectangle around the
   action point.
3. The displayed annotation was wrong although the capture evidence was right.
4. Live Guide used the selector and current DOM rectangle independently, so its
   risk profile differed from the manual annotation.

The recurring architectural mistake is allowing downstream presentation logic
to reinterpret trusted capture geometry without recording that decision or its
confidence.

## 4. Target Architecture

### 4.1 Immutable capture evidence

Store one versioned evidence object per action:

```text
captureEvidence
  schemaVersion
  captureId
  capturedAt
  actionKind
  screenshotWidthPx / screenshotHeightPx
  viewportWidthCssPx / viewportHeightCssPx
  devicePixelRatio
  visualViewport
  actionPointTopViewportCssPx
  actionPointNormalized
  semanticSelector / semanticXPath
  semanticRectNormalized
  visualBoundaryRectNormalized
  accessibleName / role / contextLabel
  framePath / shadowPath
  geometryConfidence / selectorConfidence
```

No AI or renderer may overwrite this object. Derived targets must be stored in
separate fields with their source and policy version.

### 4.2 Three explicit target types

`point`

- Default for clicks when the element boundary is ambiguous.
- Rendered like Scribe's click target.
- Never expanded into a guessed container.

`element`

- Used for a high-confidence semantic control.
- Typing steps preserve the complete editable control rectangle.
- The rectangle must not be compacted around the caret or click point.

`none`

- Used when neither point nor element geometry is trustworthy.
- The editor shows an unobtrusive review-needed state.
- Live Guide waits/re-grounds instead of drawing at stale coordinates.

### 4.3 Separate consumers

Manual document:

- Uses screenshot-space coordinates only.
- Click: point marker by default; element box only at high confidence.
- Type: full editable control rectangle.
- Zoom/crop changes framing only, never annotation coordinates.

Learning Guide:

- Uses the original screenshot plus a green target treatment.
- Applies the same static target policy as the manual.
- Does not reuse Live Guide DOM resolution state.

Live Guide:

- Resolves the current DOM for every step.
- Stable selector and accessibility evidence take priority.
- Stored geometry is scoring evidence, not an unconditional fallback box.
- Low-confidence resolution fails closed and requests re-grounding.
- The current element's `getBoundingClientRect()` drives the overlay.

Manual editor:

- Manual geometry becomes a separate `manual` target source.
- Save must round-trip exactly and survive two reloads.
- Manual edits never mutate immutable capture evidence.

## 5. Target Policy

| Action | High confidence | Medium confidence | Low confidence |
|---|---|---|---|
| Click | Semantic element box when compact; otherwise point | Point | Point or none |
| Type/input | Full editable control | Full rect only when selector and accessible name agree; otherwise point | None and review |
| Rich text editor | Full contenteditable editing surface | Explicit app adapter or review | None |
| Drag/resize | Start/end points or path | Start/end points | None |
| Navigation/page change | No target unless an originating click exists | Originating point | None |

Application adapters may identify the correct semantic editing surface, but
they must return evidence through the same policy. They must not apply visual
offsets or post-render corrections.

## 6. Automated Quality Gates

Every change to targeting, capture normalization, annotation generation,
framing, or Live Guide resolution must pass these gates.

### Geometry invariants

- Screenshot aspect ratio must match viewport aspect ratio after DPR and any
  explicit crop transform.
- Normalized rectangles must remain within `[0, 1]` and have positive area.
- A high-confidence action point must be inside its element rectangle.
- A type annotation's border must equal the stored element rectangle exactly.
- Static render round-trip error must be at most 2 screenshot pixels per edge.
- Zoom and pan must not change annotation image-space coordinates.

### Replay invariants

- Stable selectors must resolve to exactly one approved candidate or be scored
  with accessibility/context evidence.
- Live Guide must never display a coordinate-only box when selector resolution
  failed on a changed page.
- Target overlays must follow resize, scroll, and responsive layout changes.
- A disconnected or hidden target returns to waiting/re-grounding.

### Persistence invariants

- Generated annotations remain generated until the user edits them.
- Manual edits and intentional deletion survive save plus two reloads.
- Saving an annotation failure keeps the editor open and surfaces the error.

## 7. Benchmark Corpus

### Deterministic fixtures required in CI

1. Native input and textarea.
2. Contenteditable with a one-line text node inside a tall editing surface.
3. Nested contenteditable descendants.
4. Same-origin iframe with CSS scaling.
5. Cross-origin iframe with cached frame geometry.
6. Open shadow root.
7. Duplicate selectors with accessibility-name disambiguation.
8. Responsive layout before and after resize.
9. Page scroll and sticky/fixed containers.
10. DPR values `1`, `1.1`, `1.25`, and `2`.
11. Screenshot letterboxing/cropping fixture.
12. Delayed DOM replacement after a SPA transition.

### Account-backed DEV acceptance set

- Gmail: recipient, subject, full body, send button.
- Google Docs or an equivalent iframe-based editor.
- Notion or an equivalent nested contenteditable editor.
- A dense CRM form with repeated labels.
- A component library fixture containing portals, dialogs, and shadow DOM.

Recordings must retain evidence JSON, source screenshot, rendered screenshot,
and Live Guide result. Sensitive text is excluded or replaced with fixtures.

## 8. Release Scorecard

A Recorder/editor candidate is releasable only when:

- 100% of deterministic fixture steps select the expected target type.
- Type-element box IoU is at least `0.98` against the measured DOM rectangle.
- Static annotation edge error is at most 2 image pixels.
- There are zero wrong-target Live Guide overlays in the acceptance set.
- Low-confidence cases degrade to point/none, never a wrong rectangle.
- Manual save/reload tests pass for add, move, resize, and delete.
- Recorder ZIP verification, `verify:quality`, production build, and visual
  browser checks all pass.

The primary metric is `wrong target rate`, not merely `target found rate`.

## 9. Delivery Plan

### Phase 0 - Freeze and observe

- Freeze additional Gmail geometry heuristics.
- Add structured target-decision diagnostics without captured text.
- Persist policy version and target source for new DEV recordings.

Exit: one recording explains exactly which evidence and policy produced every
displayed target.

### Phase 1 - Separate data contracts

- Introduce versioned immutable capture evidence.
- Add explicit `point | element | none` document target.
- Keep backward compatibility for existing steps.

Exit: presentation code cannot mutate or reinterpret capture evidence silently.

### Phase 2 - Deterministic document renderer

- Make clicks point-first.
- Preserve exact type-control rectangles.
- Move zoom/crop into a transform layer independent of annotations.
- Add render round-trip tests using the benchmark corpus.

Exit: all static geometry gates pass.

### Phase 3 - Harden Live Guide independently

- Version selector evidence and candidate scoring.
- Require selector/accessibility agreement for type controls.
- Fail closed on ambiguous candidates.
- Add scroll, resize, SPA replacement, iframe, and shadow DOM replay tests.

Exit: zero wrong-target overlays in deterministic and DEV acceptance sets.

### Phase 4 - Recovery UX and operations

- Add explicit reselect-target action for static and Live Guide targets.
- Show capture confidence only when review is needed.
- Add a pre-release dashboard for wrong/point/none target outcomes.
- Require benchmark evidence before Recorder or editor promotion.

Exit: unsupported pages are recoverable without code changes or silent failure.

## 10. Immediate Engineering Order

1. Add Gmail reproduction data as sanitized deterministic fixtures.
2. Test stored geometry to generated annotation to rendered SVG round-trip.
3. Remove any remaining generic post-capture geometry compaction for typing.
4. Add explicit point fallback for ambiguous clicks.
5. Version and log target decisions.
6. Build Live Guide replay fixtures from the same evidence records.
7. Run account-backed Gmail acceptance only after fixture gates pass.

## 11. Non-Goals and Prohibited Shortcuts

- Do not add another Gmail ancestor-depth or pixel-offset heuristic without a
  failing fixture and a shared semantic rule.
- Do not ask AI or OCR to replace trustworthy DOM geometry.
- Do not reuse static annotation geometry as a Live Guide overlay target.
- Do not compact typing rectangles for visual neatness.
- Do not claim success from source-contract tests without rendered screenshots.
- Do not promote a candidate when the target is merely present; it must be the
  correct target.
