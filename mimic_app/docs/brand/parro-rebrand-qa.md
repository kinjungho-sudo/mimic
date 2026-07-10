# Parro Rebrand QA

## Verification commands

Ran from `mimic_app` on `2026-07-10`.

```bash
npm run lint
$env:NODE_OPTIONS='--use-system-ca'; npm run build
npm ci
npm run build
rg -n "MIMIC|Mimic|mimic|미믹" . --glob "!node_modules" --glob "!.next" --glob "!.git"
git diff --check
```

## Build/lint results

- `npm run lint`: passed.
- `npm run build`: passed.
- Re-ran `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, `git diff --check`, and focused `sendMimicEmail|sendParroEmail` search after the email helper alias pass; all passed with only existing warnings.
- Re-ran `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, `git diff --check`, and focused `MimicAppHeader|mimicFadeIn|mimic:survey` search after the internal UI name cleanup; all passed with only existing warnings.
- Re-ran `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, `git diff --check`, and focused `demo@mimicflow.com|demo@parro.example|devtest@mimic.dev` search after the mock email cleanup; all passed with only existing warnings.
- Re-ran `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, `git diff --check`, and focused SDK color search after the SDK guide color pass; all passed with only existing warnings.
- Re-ran `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, `git diff --check`, and focused public viewer color search after the `/play` and Live Guide color pass; all passed with only existing warnings.
- Re-ran focused SDK/viewer color search, `node --check public/sdk.js`, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the SDK AutoRun pulse cleanup; all passed with only existing warnings.
- Re-ran focused email color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the email template color pass; all passed with only existing warnings.
- Re-ran focused extension-link/contact/BrandMark color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the extension link and contact color pass; all passed with only existing warnings.
- Re-ran focused mypage color/`M` mark search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the mypage color pass; all passed with only existing warnings.
- Re-ran focused home dashboard color/inline mark search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the home dashboard color pass; all passed with only existing warnings.
- Re-ran focused settings/trash/embed color and inline mark search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the settings/trash/embed color pass; all passed with only existing warnings.
- Re-ran focused recording modal color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the recording modal color pass; all passed with only existing warnings.
- Re-ran focused auth color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the auth color pass; all passed with only existing warnings.
- Re-ran focused help/chat color and inline mark search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the help/chat color pass; all passed with only existing warnings.
- Re-ran focused invite/legal/survey/guidebook color and inline mark search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the invite/legal/survey color pass; all passed with only existing warnings.
- Re-ran focused default color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the default color pass; all passed with only existing warnings.
- Re-ran focused landing page old-color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the landing page color pass; all passed with only existing warnings.
- Re-ran focused manual editor/studio old-color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the editor/studio color pass; all passed with only existing warnings.
- Re-ran focused workspace/pages/home public-surface old-color search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the workspace/pages color pass; all passed with only existing warnings.
- Re-ran focused admin old-color and temporary `M` mark search, `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`, and `git diff --check` after the admin color pass; all passed with only existing warnings.
- Replaced the default Next.js `README.md` with a Parro public project introduction and re-ran root old-brand search plus `git diff --check`; results are limited to historical docs, compatibility identifiers, deployment/domain decisions, and blocked asset files.
- Removed obsolete one-off `scripts/replace_demo.py`, which hardcoded an old local landing-page path and legacy MIMIC landing snippets; re-ran focused script reference search, `npm run lint`, and `git diff --check`.
- Updated `public/llms.txt` to use relative public links and changed the public SDK header usage example to a neutral Parro placeholder while preserving SDK runtime compatibility identifiers.
- Updated Chrome extension public display surfaces from MIMIC Recorder to Parro Recorder in the manifest, popup chrome, microphone permission page, privacy policy, store-listing copy, and store ZIP manifest rewriting scripts.
- Updated Chrome extension console/debug log prefixes from `[MIMIC]`/`[MIMIC Recorder]` to `[Parro]`/`[Parro Recorder]` while preserving runtime storage and DOM compatibility keys.
- Re-ran extension checks after the public extension naming pass: `node --check` for recorder JS files, `python -m py_compile mimic_recorder/build-store-zip.py`, focused old-brand searches, `git diff --check`, and app `npm run lint`; all passed with only existing app lint warnings.
- Updated recorder popup, microphone permission page, privacy policy, countdown accent, and Live Guide overlay colors from the old indigo/purple palette to Parro teal/guide/accent colors.
- Re-ran focused recorder old-purple search and recorder JS `node --check`; runtime recorder files no longer contain the old purple palette values.
- Added `parro` and `패로` to the help chat introduction keyword match, then re-ran `npm run lint` and `git diff --check`; lint passed with only existing warnings, and diff check passed with CRLF warnings only.
- Added public Parro SDK aliases (`window.ParroSDK`, `window.ParroAutoRun`, `?parro_guide=...`, `data-parro-float`) while preserving legacy SDK compatibility names, then re-ran `node --check public/sdk.js`, `npm run lint`, focused SDK alias search, and a Node VM smoke test confirming Parro/Mimic SDK aliases point to the same objects.
- Removed unused old public product/extension name constants from `LEGACY_INTERNAL_IDENTIFIERS` and updated an internal auth comment to `Parro Recorder`; `npm run lint` passed with only existing warnings.
- Added `window.ParroGuide` as the primary recorder Live Guide runtime API while keeping `window.MimicGuide` as a compatibility alias; re-ran `node --check` for `content.js` and `guide-engine.js`, plus a Node VM smoke test confirming both names point to the same object.
- Added `parro-*` public SDK DOM/CSS classes and `parro-sdk-styles` while preserving legacy `mimic-*` class compatibility; re-ran `node --check public/sdk.js`, `npm run lint`, SDK alias smoke test, and `git diff --check`.
- Updated Chrome Web Store package build scripts to produce `parro-recorder-v{version}.zip` and use `parro-recorder-build` as the temporary packaging directory; `python -m py_compile mimic_recorder/build-store-zip.py` and PowerShell script parsing passed.
- Updated Recorder full-page capture downloads to use the `parro_fullpage_` filename prefix; `node --check mimic_recorder/background.js` passed and focused filename search found no remaining `mimic_fullpage` references.
- Added `parro-btn` to Recorder Live Guide overlay controls while preserving `mimic-btn`; `node --check mimic_recorder/guide-engine.js` passed and focused class search confirmed no button remains with only `mimic-btn`.
- Updated Recorder countdown runtime animations to use `parro-blink`, `parro-pop`, and `parro-start` while keeping legacy `mimic-*` keyframe definitions; `node --check mimic_recorder/content.js` passed.
- Added `window.__parroContentLoaded` and `parro-overlay-root` as primary Recorder runtime identifiers while preserving legacy guard/root cleanup; `node --check` passed for `content.js`, `background.js`, and `guide-engine.js`.
- Updated Recorder popup toast DOM ID to `parroToast` while preserving `mimicToast` lookup fallback; `node --check mimic_recorder/popup.js` passed.
- Updated Recorder Live Guide overlay runtime animations to use `parro-*` names while preserving legacy `mimic-*` keyframe definitions; `node --check mimic_recorder/guide-engine.js` passed.
- Updated full-page capture's temporary hidden fixed-element guard to `window.__parroFixedHidden` while preserving legacy cleanup fallback; `node --check mimic_recorder/background.js` passed.
- Updated Recorder click capture to ignore both `parro` and legacy `mimic` overlay IDs/classes; `node --check mimic_recorder/content.js` passed and focused guard search confirmed both names are handled.
- Updated root MCP package README, package description, and `list_tutorials` tool description to Parro while preserving `@mimic/mcp-server` and MCP server key `mimic`; `packages/mcp-server npm run build` passed.
- Updated SDK AutoRun runtime DOM IDs, style ID, active class, and animation names to `parro-*` primary values while preserving legacy `mimic-*` selectors/fallbacks; `node --check public/sdk.js` and a Node DOM-stub smoke test passed.
- Updated active app and Recorder agent docs to use Parro as the current display name while preserving `mimic_app`/`mimic_recorder` folder references, schema filenames, and historical design document filenames; focused doc search and `git diff --check` passed.
- Added `data-parro-guide` as the primary SDK script auto-start attribute while preserving legacy `data-guide`; `node --check public/sdk.js`, focused SDK attribute search, a Node VM smoke test, `npm run lint`, and `git diff --check` passed.
- Updated active root PM docs `OVERVIEW.md` and `Plan.md` to use Parro as the current product/Recorder display name while preserving folder names, storage bucket names, historical design document filenames, and Phase 2 domain decisions.
- Re-ran `git diff --check`, focused public old-brand search (`MIMIC Recorder|# MIMIC|Don't Explain, Just Mimic|MIMIC은|미믹`), and focused `OVERVIEW.md`/`Plan.md` old-brand classification search after the active PM docs pass. Diff check passed with CRLF warnings only; public old-brand search returned no hits.
- `packages/mcp-server`: `npm ci` then `npm run build` passed.
- `git diff --check`: passed.
- `packages/mcp-server npm ci` reported 2 high severity dependency audit findings. No `npm audit fix` was run because that is outside the rebrand scope and can change dependency versions.
- Existing lint/build warnings remain unrelated to the rebrand:
  - `app/manual/[id]/editor/page.tsx`: missing hook dependency `id`.
  - `app/mypage/page.tsx`: missing hook dependencies `updateUser`, `user`.
  - `components/editor/AppSidebar.tsx`, `components/editor/GuideViewer.tsx`: `<img>` warning.
  - `components/editor/ImageAnnotationEditor.tsx`: missing hook dependency `pushHistory`.
  - `components/viewer/InteractiveFollowPlayer.tsx`: missing hook dependency `steps`.
  - Build warning: edge runtime disables static generation for that page.

## Public-facing old brand references remaining

- Production logo/icon assets still reference current files such as `public/logo.svg`, `app/icon.svg`, `public/mimic-logo.png`, and `public/icons/*.png`. App/library uses of the bitmap logo path now go through `BRAND_LOGO_IMAGE_PATH`, and visible in-app temporary marks use `BrandMark`, but production asset replacement is blocked until the owner provides production-ready Wing Pointer SVG assets.
- Current asset evidence: `public/logo.svg` and `app/icon.svg` are still the old circular `M` mark; `public/favicon.svg` does not exist. See `docs/brand/parro-logo-asset-handoff.md`.
- Public support/contact email remains `support@mimic.so` in help/chat/auth copy through `BRAND_SUPPORT_EMAIL`. This is now centralized, but the address itself is still a domain and operations decision for Phase 2.
- Deployment URLs remain `mimic-nine-ashen.vercel.app`. App/library fallbacks now go through `BRAND_APP_URL_FALLBACK`/`getBrandAppUrl()`, `public/llms.txt` uses relative links, and static/runtime files such as `robots.txt` plus the `public/sdk.js` fallback still need a Phase 2 domain pass. These are deployment identifiers and should move only after domain/Vercel decisions.
- Chrome Web Store URL slug remains `mimic-recorder`; the visible extension name is now `Parro Recorder`, and app references now go through `BRAND_EXTENSION_STORE_URL`, but the store slug/extension identity is preserved.

## Internal identifiers intentionally preserved

- `package.json`, `package-lock.json`, and MCP package names such as `mimic-app` / `@mimic/mcp-server`.
- Supabase schema, migrations, storage buckets, and SQL comments, including `mimic-tts`, `01_mimic_dev_schema.sql`, and `supabase/migrations/*`.
- API route filenames and environment/header identifiers including `x-mimic-secret`, `MIMIC_EXTENSION_ID`, and `NEXT_PUBLIC_APP_URL`. Runtime uses of preserved legacy values such as `x-mimic-secret` and `MIMICBot/1.0` now go through `LEGACY_INTERNAL_IDENTIFIERS`.
- SDK compatibility globals/classes/query params in `public/sdk.js`. New public aliases include `window.ParroSDK`, `window.ParroAutoRun`, `data-parro-guide`, `parro_guide`, and `data-parro-float`; legacy aliases such as `window.MimicSDK`, `window.MimicAutoRun`, `data-guide`, `mimic_guide`, `data-mimic-float`, and `mimic-*` CSS classes remain intentionally supported.
- Local storage and drag/drop keys such as `mimic:survey:*`, `mimic_annot_defaults_v1`, and `text/mimic-tutorial`. Survey prefixes, annotation defaults, and drag/drop keys now go through `LEGACY_INTERNAL_IDENTIFIERS`.
- `sendMimicEmail` remains as a backward-compatible alias to `sendParroEmail`; app call sites now use the Parro helper name.
- Development-only guest login still uses `devtest@mimic.dev`; this appears to be a seeded dev account and should not be renamed without owner approval.
- SDK/recorder console log tags have been updated to `[Parro]` / `[Parro Recorder]`; compatibility names remain unchanged.
- Chrome extension runtime URLs, extension IDs, local storage keys, IndexedDB names, and `mimic-*` DOM/CSS compatibility hooks are preserved. Local package artifacts now use `parro-recorder-v{version}.zip`.
- Recorder test fixtures may still contain legacy color values; runtime extension UI files have been migrated to Parro colors.
- Legacy matching keywords in the help chat so users asking about the old name can still get an answer.

## Historical docs intentionally preserved

- `README.md` now describes Parro and explicitly documents why selected `mimic-*` identifiers are preserved during the staged rebrand.
- Active app/Recorder agent docs now use Parro as the current display name while preserving historical filenames and internal folder identifiers.
- Historical planning docs such as `docs/DEV_PROCESS.md`, `docs/PLAN.md`, `docs/SESSION_HANDOVER.md`, `docs/VOICE_PIPELINE_TASK.md`, top-level legacy PRDs, and older design-fetch artifacts under `_design_fetch/` may still preserve old-brand context.
- `docs/brand/parro-brand-audit.md`, `docs/decisions.md`, and `docs/implementation-log.md` preserve old-brand references as migration history.
- Obsolete one-off rewrite helper `scripts/replace_demo.py` was removed instead of preserved because it could restore legacy MIMIC landing content if accidentally run.

## Follow-up owner decisions

- See `docs/brand/parro-phase2-owner-decisions.md` for the full Phase 2 decision matrix and recommended order.
- Provide final production-ready Wing Pointer SVG assets for `public/brand/parro-logo.svg`, `public/brand/parro-mark.svg`, `public/logo.svg`, `app/icon.svg`, and `public/favicon.svg`.
- Decide whether `public/mimic-logo.png` remains as a compatibility filename or moves to a new `public/brand/parro-logo.png` path after the final SVG is approved.
- Decide public domain and support email migration timing.
- Decide whether the Chrome Web Store listing/slug should remain `mimic-recorder` or move through a separate extension listing/update process.
- Decide how long legacy SDK globals and CSS classes such as `MimicSDK`, `MimicAutoRun`, and `mimic-*` remain supported now that Parro aliases exist.
- Decide whether bot/user-agent names such as `MIMICBot/1.0` should change in Phase 2 or remain stable.

## Phase 2 recommendations

1. Add final Wing Pointer SVG assets and replace logo/icon/favicon files after owner approval.
2. Install Vercel CLI and inspect linked project/env state before domain/deployment changes.
3. Decide and migrate support email/domain/Vercel display names.
4. Update Recorder host permissions and store/policy URLs only after domain behavior is verified.
5. Defer DB/API/env/package/SDK identifier rename to a separate Phase 3 migration plan.
