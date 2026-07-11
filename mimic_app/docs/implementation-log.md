# Implementation Log

## 2026-07-11 - Parro SDK script attribute alias

- Added `data-parro-guide` as the primary SDK script auto-start attribute.
- Preserved legacy `data-guide` script embeds for compatibility.

## 2026-07-11 - Parro Phase 2 owner decision matrix

- Created `docs/brand/parro-phase2-owner-decisions.md`.
- Documented the remaining logo, domain, support email, Chrome Web Store, bot/user-agent, and internal identifier decisions before Phase 2 operational changes.
- Kept all runtime, DB, deployment, route, env, package, and extension identifiers unchanged.

## 2026-07-11 - Parro brand QA documentation alignment

- Clarified that mascot raster exploration is not a production logo source.
- Updated the rebrand QA historical-doc classification after active app and Recorder docs moved to Parro naming.

## 2026-07-11 - Parro active docs naming

- Updated active app and Recorder agent docs to use Parro as the current display name.
- Preserved `mimic_app`/`mimic_recorder` folder references, schema filenames, and historical design document filenames.

## 2026-07-11 - Parro SDK AutoRun DOM identifiers

- Updated SDK AutoRun runtime DOM IDs, style ID, active class, and animation names to use `parro-*` as the primary identifiers.
- Preserved legacy `mimic-*` selectors, keyframes, and lookup fallbacks for embedded compatibility.

## 2026-07-11 - Parro MCP public description cleanup

- Updated root MCP package README, package description, and `list_tutorials` tool description from MIMIC to Parro.
- Preserved the `@mimic/mcp-server` package name and MCP server key `mimic` for compatibility.

## 2026-07-11 - Parro Recorder overlay click guard

- Updated Recorder click capture to ignore both `parro` and legacy `mimic` overlay IDs/classes.
- Preserved legacy overlay ignore behavior while protecting new Parro runtime DOM from being recorded.

## 2026-07-10 - Parro brand migration audit

- Created `docs/brand/parro-brand-audit.md`.
- Classified public-facing vs internal `MIMIC`/`mimic` references.
- Noted that `docs/mistakes.md` is missing in this checkout.
- No broad rename performed.

## 2026-07-10 - Parro public brand decision recorded

- Recorded the MIMIC -> Parro public brand decision in `docs/decisions.md`.
- Confirmed Phase 1 keeps internal identifiers unchanged.

## 2026-07-10 - Parro brand constants added

- Added `lib/brand.ts` as the public brand source of truth for future UI copy migration.
- Kept legacy compatibility identifiers explicit and unchanged.
- No UI surfaces were rewired yet.

## 2026-07-10 - Parro public text surfaces batch 1

- Replaced selected public-facing `MIMIC` text with centralized Parro brand constants in metadata, auth headers, public page attribution, embed watermark, help chat welcome text, extension-link labels, mypage headers, FAQ quick question, and OG image branding.
- Preserved deployment URLs, `mimic-logo.png`, Chrome Web Store slug, dev test email, SDK globals, DB/schema identifiers, API route names, package names, and env/header identifiers.
- Deferred logo/icon replacement until a production-ready Wing Pointer SVG is available.

## 2026-07-10 - Parro public text surfaces batch 2

- Replaced additional public-facing old-brand text in player metadata/header/share copy, settings, workspace invite, share/export modals, FAQ answers, contact/share/welcome email copy, and email subject defaults.
- Preserved compatibility names such as `sendMimicEmail`, `x-mimic-secret`, `mimic-logo.png`, `mimic:survey:*`, Chrome Web Store slug, support email/domain, and deployment URLs.
- Kept logo/icon asset replacement deferred pending production-ready SVG.

## 2026-07-10 - Parro public text surfaces batch 3

- Replaced visible old-brand text in the recording modal, help center primary sections/FAQ, and `public/llms.txt`.
- Preserved extension debug log tags, Chrome Web Store slug, support email/domain, and deployment URLs.
- Kept legal wording and landing page as separate follow-up batches because they contain dense public copy and owner/asset decisions.

## 2026-07-10 - Parro landing page public text batch

- Replaced landing page public `MIMIC`/`MIMIC Recorder` text, mock display URLs, comparison labels, CTA copy, header/footer brand text, and hero headline with Parro-facing wording.
- Preserved the internal `MimicAppHeader` component name because it is not user-visible and does not affect deployment or data compatibility.
- Kept production logo/icon asset replacement deferred until a production-ready Wing Pointer SVG is available.

## 2026-07-10 - Parro app shell and export text batch

- Replaced remaining app-shell, legal metadata/body, admin broadcast/admin dashboard, Live Guide error, and PDF/DOCX export cover old-brand text with Parro-facing wording.
- Preserved internal drag MIME type `text/mimic-tutorial`, auth comments, support email/domain, deployment URLs, SDK identifiers, package names, and database/schema identifiers.
- Kept asset replacement deferred pending final Wing Pointer SVG.

## 2026-07-10 - Parro rebrand QA report

- Created `docs/brand/parro-rebrand-qa.md`.
- Recorded final lint/build/search results for the current public rebrand batch.
- Classified remaining old-brand references as asset/domain decisions, internal compatibility identifiers, or historical docs.

## 2026-07-10 - Parro public docs and SDK label cleanup

- Updated a public SDK file header from MIMIC to Parro while preserving `MimicSDK`, `MimicAutoRun`, `mimic_guide`, `data-mimic-float`, deployment URL, and CSS compatibility identifiers.
- Updated the manual content rules intro to use Parro as the public product name.
- Left operational n8n workflow names, package names, and MCP identifiers unchanged.

## 2026-07-10 - Parro MCP and console label cleanup

- Updated MCP server human-facing README, package description, and tool description text to Parro.
- Preserved the `@mimic/mcp-server` package name and `mimic` MCP server key for compatibility.
- Updated SDK and recorder console log prefixes from `[MIMIC]` to `[Parro]` while preserving SDK globals, CSS classes, query params, and extension/store identifiers.
- Updated the n8n setup guide display name to Parro while preserving `x-mimic-secret` and `mimic-share-email` webhook path.

## 2026-07-10 - Parro support email centralization

- Added `BRAND_SUPPORT_EMAIL` to `lib/brand.ts` for the current Phase 2 support email value.
- Replaced hardcoded `support@mimic.so` strings in help, FAQ chat, and auth error copy with the centralized brand constant.
- Kept the visible support email unchanged until the owner approves the Parro support domain/email migration.

## 2026-07-10 - Parro URL and logo path centralization

- Added `BRAND_APP_URL_FALLBACK`, `BRAND_LOGO_IMAGE_PATH`, and `getBrandAppUrl()` to `lib/brand.ts`.
- Replaced scattered app/library hardcoded deployment URL and `mimic-logo.png` references with centralized constants/helpers.
- Kept the current deployment URL and logo asset path unchanged until Phase 2 domain decisions and final Wing Pointer SVG assets are ready.

## 2026-07-10 - Parro extension store URL centralization

- Added `BRAND_EXTENSION_STORE_URL` to `lib/brand.ts`.
- Replaced duplicated Chrome Web Store URLs in the extension link page and recording modal with the centralized brand constant.
- Kept the current `mimic-recorder` store slug unchanged until the owner approves an extension listing/identity migration.

## 2026-07-10 - Parro legacy identifier centralization

- Reused `LEGACY_INTERNAL_IDENTIFIERS` for preserved runtime identifiers such as `x-mimic-secret`, `MIMICBot/1.0`, `text/mimic-tutorial`, and `mimic_annot_defaults_v1`.
- Removed duplicated legacy identifier literals from share email headers, n8n email headers, favicon crawler requests, home drag/drop, and annotation defaults.
- Kept the identifier values unchanged because these remain compatibility surfaces until a separate Phase 3 migration is approved.

## 2026-07-10 - Parro email sender helper alias

- Added `sendParroEmail` as the primary n8n transactional email helper name.
- Updated internal app call sites to use `sendParroEmail`.
- Kept `sendMimicEmail` as a backward-compatible alias until a separate Phase 3 internal rename cleanup is approved.

## 2026-07-10 - Parro internal UI name cleanup

- Renamed the landing page internal preview header component from `MimicAppHeader` to `ParroAppHeader`.
- Renamed the editor toast animation from `mimicFadeIn` to `parroFadeIn`.
- Centralized preserved survey localStorage key prefixes under `LEGACY_INTERNAL_IDENTIFIERS` without changing their stored values.

## 2026-07-10 - Parro mock user email cleanup

- Updated mock user data from `demo@mimicflow.com` to reserved-domain `demo@parro.example`.
- Preserved the real development guest login account `devtest@mimic.dev`.

## 2026-07-10 - Parro SDK guide color pass

- Updated the public SDK overlay colors from the old indigo palette to Parro teal/guide/pointer colors.
- Updated the editor SDK preview panel to reuse `BRAND_COLORS.primary`.
- Preserved SDK compatibility names such as `MimicSDK`, `MimicAutoRun`, `mimic_guide`, and `mimic-*` CSS classes.

## 2026-07-10 - Parro public viewer color pass

- Updated the shared Live Guide stage and interactive player from the old indigo/purple palette to Parro brand colors.
- Updated the public `/play` viewer survey, document, share, slide, and hotspot controls to use Parro color tokens.
- Preserved route names, share tokens, SDK compatibility identifiers, and stored data shapes.

## 2026-07-10 - Parro SDK autorun pulse cleanup

- Updated the remaining SDK AutoRun pulse keyframe colors from the old indigo palette to Parro primary/guide colors.
- Preserved the existing `mimic-autorun-*` CSS identifiers for SDK compatibility.

## 2026-07-10 - Parro email template color pass

- Updated Resend, n8n, and share-email HTML templates from the old indigo/purple palette to Parro brand color tokens.
- Preserved n8n webhook configuration, legacy secret header values, email routes, sender/reply-to settings, and current logo path.

## 2026-07-10 - Parro extension link and contact color pass

- Updated the extension link setup page and admin contact email header from the old indigo/purple palette to Parro brand color tokens.
- Updated the shared temporary inline `BrandMark` from an `M` glyph to a Parro `P` glyph while keeping final Wing Pointer SVG asset replacement deferred.
- Preserved the Chrome Web Store URL slug, contact email routing, n8n webhook configuration, and support/reply-to addresses.

## 2026-07-10 - Parro mypage color pass

- Updated the user-facing mypage shell, profile avatar fallback, active navigation, and Pro upgrade card from the old indigo/purple palette to Parro brand color tokens.
- Replaced inline `M` glyph marks on the mypage desktop/mobile headers with the shared temporary Parro `BrandMark`.
- Preserved auth/account behavior, plan labels, routes, and profile upload/delete flows.

## 2026-07-10 - Parro home dashboard color pass

- Updated the home dashboard shell, sidebar, folder panel, workspace selectors, search, notices, CTA buttons, and action modal samples from the old indigo/purple palette to Parro brand color tokens.
- Replaced inline home dashboard `P` glyph SVG marks with the shared temporary Parro `BrandMark`.
- Preserved stored folder colors, workspace/manual data, routes, drag/drop data type, capture flows, and account behavior.

## 2026-07-10 - Parro settings trash embed color pass

- Updated settings, trash, and embed viewer public UI accents from the old indigo/purple palette to Parro brand color tokens.
- Replaced settings inline `M` glyph marks with the shared temporary Parro `BrandMark`.
- Preserved settings agreement behavior, trash restore/delete routes, embed token route, and viewer data flow.

## 2026-07-10 - Parro recording modal color pass

- Updated the recording start modal, tab selection state, install prompt, and extension-required states from the old indigo/purple palette to Parro brand color tokens.
- Preserved extension runtime IDs, Chrome Web Store URL, tab selection, reconnect, and `START_RECORDING` message flow.

## 2026-07-11 - Parro auth color pass

- Updated login, signup, forgot-password, and reset-password public auth screens from the old indigo/purple palette to Parro brand color tokens.
- Preserved auth routes, Supabase password recovery flow, Google/email auth behavior, and the development-only guest login account.

## 2026-07-11 - Parro help and chat color pass

- Updated the help page header mark, help navigation, plan highlights, FAQ chips, and floating agent chat accents from the old indigo/purple palette to Parro brand color tokens.
- Preserved help routes, FAQ content structure, agent chat API calls, contact submission flow, and support email routing.

## 2026-07-11 - Parro invite legal survey color pass

- Updated workspace invite, legal header marks, survey modal controls, and guidebook embedded guide cards from the old indigo/purple palette to Parro brand color tokens.
- Preserved workspace invite API flow, legal document content, survey submission payloads, and guidebook block schema behavior.

## 2026-07-11 - Parro default color pass

- Updated global CSS brand variables, marker pulse color, generated OG image accents, folder default color, user branding default color, PPTX export fallback color, and AI cover-color fallback from the old indigo/purple palette to Parro brand colors.
- Preserved DB schemas, stored existing user colors, API route names, and branding payload shapes.

## 2026-07-11 - Parro landing page color pass

- Updated landing page demo SVGs, hero preview, product tour, pricing, FAQ, and CTA accents from the old indigo/purple palette to Parro teal/guide/accent colors.
- Preserved landing page copy, routes, forms, feature data, and deferred final logo asset replacement.

## 2026-07-11 - Parro editor studio color pass

- Updated the manual editor, Live Studio, and shared editor panels/modals from the old indigo/purple palette to Parro teal/guide/accent colors.
- Preserved editor routes, data flows, SDK/runtime compatibility identifiers, stored annotation colors, and sharing/export behavior.

## 2026-07-11 - Parro workspace pages color pass

- Updated workspace management, Pages editor/share controls, public Page cover fallback, and remaining home folder hover/drag accents from the old indigo/purple palette to Parro brand colors.
- Preserved workspace/page routes, invitation/member APIs, page publishing flow, stored custom cover colors, and folder data behavior.

## 2026-07-11 - Parro admin color pass

- Updated admin dashboard, users, tutorials, surveys, broadcasts, logs, and Pro signup management accents from the old indigo/purple palette to Parro brand colors.
- Replaced the admin sidebar temporary `M` mark with the shared temporary Parro `BrandMark`.
- Preserved admin routes, stats/log/survey data flows, broadcast behavior, and deferred production logo/icon asset replacement.

## 2026-07-11 - Parro logo asset handoff

- Created `docs/brand/parro-logo-asset-handoff.md` to capture the exact production logo/icon assets still blocked on a final Wing Pointer SVG source.
- Confirmed `public/logo.svg` and `app/icon.svg` still contain the old circular `M` mark, while `public/favicon.svg` does not exist.
- Preserved all production assets unchanged because the owner has not provided a production-ready final logo SVG yet.

## 2026-07-11 - Parro README public intro

- Replaced the default Next.js `README.md` with a Parro public project introduction.
- Documented the staged rebrand guardrails and the intentionally preserved internal `mimic-*` compatibility identifiers.
- Preserved package names, routes, DB identifiers, extension identifiers, deployment identifiers, and blocked logo/icon production assets.

## 2026-07-11 - Obsolete landing rewrite helper cleanup

- Removed `scripts/replace_demo.py`, an old one-off landing page rewrite helper with hardcoded local paths and legacy MIMIC snippets.
- Updated Parro audit/QA docs to stop preserving that helper as historical material.
- Preserved runtime app code, routes, DB identifiers, env names, package names, deployment identifiers, and production logo/icon assets.

## 2026-07-11 - Public crawler and SDK example cleanup

- Changed `public/llms.txt` public links from the legacy deployment URL to relative paths.
- Updated the public SDK header usage example to a neutral Parro placeholder while documenting that legacy `MimicSDK` and `mimic_guide` API names remain supported.
- Preserved SDK runtime globals, query params, CSS identifiers, fallback deployment URL, routes, DB identifiers, env names, package names, and production logo/icon assets.

## 2026-07-11 - Parro Recorder public extension naming

- Updated Chrome extension public display surfaces from `MIMIC Recorder` to `Parro Recorder` in `manifest.json`, popup chrome, microphone permission page, privacy policy, store-listing copy, and store ZIP manifest rewriting scripts.
- Updated extension console/debug log prefixes to `Parro` / `Parro Recorder`.
- Preserved extension IDs, Chrome Web Store slug/URLs, runtime app URLs, local storage keys, IndexedDB names, output ZIP filename, internal `mimic-*` hooks, routes, DB identifiers, env names, package names, and production logo/icon assets.

## 2026-07-11 - Parro Recorder color pass

- Updated recorder popup controls, microphone permission page, privacy policy, countdown accent, and Live Guide overlay colors from the old indigo/purple palette to Parro teal/guide/accent colors.
- Preserved extension IDs, Chrome Web Store slug/URLs, runtime app URLs, local storage keys, IndexedDB names, output ZIP filename, internal `mimic-*` hooks, routes, DB identifiers, env names, package names, and production logo/icon assets.

## 2026-07-11 - Parro help chat brand keyword pass

- Added `parro` and `패로` to the help chat introduction keyword match so direct brand-name questions route to the Parro overview answer.
- Preserved legacy `mimic` keyword aliases so users asking with the old name can still get help during the staged rebrand.

## 2026-07-11 - Parro SDK public alias pass

- Added public Parro SDK aliases for `window.ParroSDK`, `window.ParroAutoRun`, `?parro_guide=...`, and `data-parro-float`.
- Preserved legacy `MimicSDK`, `MimicAutoRun`, `mimic_guide`, `data-mimic-float`, and `mimic-*` CSS/DOM identifiers as compatibility aliases.

## 2026-07-11 - Unused legacy brand constants cleanup

- Removed unused `LEGACY_INTERNAL_IDENTIFIERS` entries for the old public product and extension names.
- Updated an internal auth comment to refer to `Parro Recorder` while preserving extension token behavior.

## 2026-07-11 - Parro Recorder guide runtime alias pass

- Added `window.ParroGuide` as the primary Live Guide runtime API in the Chrome extension.
- Preserved `window.MimicGuide` as a compatibility alias and updated content-script calls to prefer `ParroGuide` with legacy fallback.

## 2026-07-11 - Parro SDK DOM class alias pass

- Added `parro-*` DOM/CSS classes and `parro-sdk-styles` for newly generated public SDK guide UI.
- Preserved legacy `mimic-*` classes and duplicate-prevention checks so existing embeds and CSS overrides remain compatible.

## 2026-07-11 - Parro Recorder package artifact naming

- Updated Chrome Web Store package build scripts to produce `parro-recorder-v{version}.zip`.
- Updated the temporary packaging directory to `parro-recorder-build`.
- Preserved extension IDs, Chrome Web Store slug/URLs, runtime app URLs, local storage keys, IndexedDB names, and `mimic-*` runtime compatibility hooks.

## 2026-07-11 - Parro Recorder full-page download naming

- Updated the Recorder full-page capture download filename prefix from `mimic_fullpage_` to `parro_fullpage_`.
- Preserved storage keys, IndexedDB names, runtime URLs, and internal compatibility globals.

## 2026-07-11 - Parro Recorder guide DOM class alias pass

- Added `parro-btn` to Recorder Live Guide overlay controls and survey buttons.
- Preserved `mimic-btn` on the same elements for compatibility with existing runtime styling and overrides.

## 2026-07-11 - Parro Recorder countdown animation naming

- Updated Recorder countdown runtime animations to use `parro-blink`, `parro-pop`, and `parro-start`.
- Preserved legacy `mimic-*` keyframe definitions in the injected style block for compatibility.

## 2026-07-11 - Parro Recorder runtime guard and overlay ID pass

- Added `window.__parroContentLoaded` as the primary content-script duplicate-injection guard.
- Updated Recorder Live Guide overlay hosts to use `parro-overlay-root`.
- Preserved legacy `__mimicContentLoaded` and `mimic-overlay-root` recognition for cleanup and compatibility.

## 2026-07-11 - Parro Recorder popup toast ID

- Updated the Recorder popup toast DOM ID to `parroToast`.
- Preserved lookup fallback for legacy `mimicToast` during an already-open popup session.

## 2026-07-11 - Parro Recorder guide animation naming

- Updated Recorder Live Guide overlay runtime animations to use `parro-ripple`, `parro-glow`, `parro-nudge`, `parro-avatar-in`, and `parro-tip-in`.
- Preserved legacy `mimic-*` keyframe definitions in the injected shadow style for compatibility.

## 2026-07-11 - Parro Recorder full-page fixed-element guard

- Updated full-page capture's temporary hidden fixed-element guard to use `window.__parroFixedHidden`.
- Preserved cleanup fallback for legacy `window.__mimicFixedHidden`.

## 2026-07-11 - Active PM docs Parro naming pass

- Updated root `OVERVIEW.md` and `Plan.md` to use Parro as the current public product name.
- Preserved `mimic_app`/`mimic_recorder` folder names, `mimicflow.com` as a Phase 2 domain decision, `mimic-tts`, and historical design document filenames.

## 2026-07-11 - Active operations docs Parro naming pass

- Updated `docs/DEV_PROCESS.md` and `docs/SESSION_HANDOVER.md` current operational wording from MIMIC to Parro.
- Preserved historical backend plan content and deployment/database identifiers.

## 2026-07-11 - Active agent guardrail docs Parro wording pass

- Updated active agent/development guardrail wording in `CLAUDE.md` and `DEV_PROCESS.md` to refer to Parro instead of MIMIC where the text described the current service.
- Preserved Supabase project IDs, schema filenames, `mm_*` table prefix references, and all DB safety rules.

## 2026-07-11 - Parro remaining-reference QA refresh

- Re-ran focused public-surface and full active-code searches from `brand/parro-system`.
- Confirmed the only direct public old-brand marks are the blocked `M` glyph assets in `public/logo.svg` and `app/icon.svg`.
- Reclassified remaining lowercase `mimic` references as approved compatibility identifiers, internal/deployment identifiers, development fixtures, or Phase 2 owner decisions.
- Confirmed Vercel CLI `54.5.1` is available, but did not inspect or change linked projects, environments, domains, or deployments.

## 2026-07-11 - Parro full verification refresh

- Re-ran app lint and production build on `brand/parro-system`; both passed with only the previously documented unrelated warnings.
- Re-ran JavaScript syntax checks for the public SDK and Recorder runtime files; all passed.
- Re-ran the MCP server TypeScript build; it passed.
- Made no application, database, environment, or deployment changes in this verification batch.

## 2026-07-11 - Phase 2 Vercel prerequisite correction

- Corrected the Phase 2 decision document to reflect the verified Vercel CLI `54.5.1` installation.
- Kept linked-project inspection, environment access, logs, and deployment blocked until explicit owner approval.

## 2026-07-11 - Approved Parro Wing Pointer assets

- Rebuilt the selected Wing Pointer direction as original SVG geometry using Parro teal, lime, and deep navy.
- Added `public/brand/parro-logo.svg`, `public/brand/parro-mark.svg`, `public/brand/parro-mark.png`, and `public/favicon.svg`.
- Replaced `public/logo.svg`, `app/icon.svg`, the PNG icon set, and the shared `BrandMark` with the approved mark.
- Switched `BRAND_LOGO_IMAGE_PATH` to `/brand/parro-mark.png`; retained `/mimic-logo.png` as an identical compatibility fallback.
- Verified SVG/PNG rendering, 48 px icon legibility, focused old-mark search, app lint, and production build.
- Attempted local browser smoke at port `3017`; the page was blocked by missing local Supabase environment values, so no env, database, or deployment wiring was changed.

## 2026-07-11 - Phase 2 Vercel read-only preflight

- Verified the current Vercel account, `mimic` project configuration, production alias, deployment history, and domain inventory using read-only CLI commands.
- Confirmed the project root is `mimic_app`, Node.js is `24.x`, the current production deployment is Ready, and the account has no custom domains.
- Confirmed this worktree has no `.vercel/project.json`; no link, project, domain, alias, environment, or deployment was created or changed.
- Documented a custom-domain-first cutover that preserves the Vercel project name as an internal identifier until public URL migration is verified.

## 2026-07-11 - Parro Vercel Preview deployment

- Linked the isolated `brand/parro-system` worktree to the existing Vercel `mimic` project; the generated `.vercel` directory remains gitignored.
- Created Ready Preview deployment `dpl_HDq1Ec1ksAYMQBogXj7foyrHaG6z` without using `--prod`, promotion, alias changes, custom domains, or environment writes.
- Verified the Preview landing HTML contains Parro branding and no visible old-brand copy.
- Verified the Parro SVG, PNG, and app icon responses, browser-rendered first viewport, and absence of recent Preview error logs.
- Kept `main`, Production aliases, Supabase, and all production data unchanged.

## 2026-07-11 - Parro interim support contact

- Replaced the old `support@mimic.so` public contact with the already-operational `kinjungho@gmail.com` address through `BRAND_SUPPORT_EMAIL`.
- Centralized app landing, settings, legal, extension-link, auth/help, transactional email, n8n reply-to, and share-email reply-to uses on the brand constant.
- Local lint/build passed with only the existing unrelated warnings.
- Deployed and verified Ready Preview `dpl_8oErV37fcoayvYYzAE9qF5cCU6qz`; landing/help responses contained the Gmail contact and no old support address or visible old-brand copy.
- Kept the custom-domain mailbox decision open and made no Production, domain, environment, Supabase, or data changes.

## 2026-07-11 - Parro favicon crawler User-Agent

- Added `BRAND_BOT_USER_AGENT` with `ParroBot/1.0` and switched active server-side favicon HTML requests to it.
- Preserved `MIMICBot/1.0` in `LEGACY_INTERNAL_IDENTIFIERS` as an explicit compatibility and rollback value.
- `npm run lint` and `$env:NODE_OPTIONS='--use-system-ca'; npm run build` passed with only the existing unrelated warnings.
- Made no route, API contract, database, environment, extension, or deployment identifier change.

## 2026-07-11 - Temporary Parro Vercel alias

- Added `https://parro-guide.vercel.app` without renaming the existing Vercel project or removing existing Production aliases.
- Initial verification identified that the old Production deployment still showed MIMIC, so the new alias was immediately repointed to verified Parro Preview `dpl_8oErV37fcoayvYYzAE9qF5cCU6qz`.
- Verified `/landingpage` returned HTTP 200 with 36 `Parro` matches and zero visible old-brand matches.
- Made no `main`, Production deployment, environment, Supabase, or data change; rollback is removing the temporary alias.

## 2026-07-11 - Preserve `mm_*` database namespace

- Recorded the owner-approved decision to keep `mm_*` as Parro's internal legacy database namespace.
- New tables continue using the established `mm_*` convention until a separately approved Phase 3 database migration; mixed `parro_*` table names are not introduced.
- Made no table, schema, migration, policy, function, trigger, bucket, environment, or data change.

## 2026-07-11 - Parro alias Recorder connectivity

- Added the exact temporary origin `https://parro-guide.vercel.app/*` to Recorder `externally_connectable` so the Parro web alias can link to the extension.
- Preserved existing Vercel, `mimicflow.com`, localhost, extension ID, runtime URLs, storage keys, and DB identifiers for compatibility and rollback.
- Did not bump the extension version, build a store package, publish an extension, or change `main`, Production, environments, Supabase, or data.

## 2026-07-11 - Parro Web Store source URL

- Updated the Chrome Web Store source listing's public web-service URL from the legacy Vercel address to `https://parro-guide.vercel.app`.
- Preserved Recorder runtime URLs, existing origins, extension ID, Web Store slug, and all internal identifiers.
- Did not publish or mutate the live Chrome Web Store listing.

## 2026-07-11 - Parro alias metadata Preview refresh

- Found that the temporary Parro alias rendered no old visible brand copy but still emitted the old Production URL in metadata.
- Created Ready Preview `dpl_8KycS2iBFbDi8K826UeEjmpm5TBw` with deployment-only `NEXT_PUBLIC_APP_URL=https://parro-guide.vercel.app`; shared Preview and Production env values were not changed.
- Verified six public routes with HTTP 200, Parro metadata, zero visible old-brand and old Production URL matches, dev Supabase `dskphgxurxebblnpwhax`, and no recent error logs before moving the alias.
- Repointed `https://parro-guide.vercel.app` to the verified Preview. Kept `main`, Production aliases/deployment, project name, shared environments, Supabase configuration, and data unchanged.
- Rollback target remains the earlier verified Preview `dpl_8oErV37fcoayvYYzAE9qF5cCU6qz`, or the alias can be removed.

## 2026-07-11 - Environment-aware robots sitemap

- Replaced the static `public/robots.txt` old Production sitemap URL with `app/robots.ts` using `getBrandAppUrl()`.
- Preserved the existing search/AI crawler allow rules, CCBot block, and private app/API disallow rules.
- Preview and Production now emit their own environment-specific sitemap URL without renaming routes or changing shared Vercel environment variables.
- Deployed Ready Preview `dpl_J85ABCHTTM6EaxGXzvDMhZTCrh2i`, verified Parro robots/sitemap responses and no error logs, then moved `parro-guide.vercel.app` to that deployment.

## 2026-07-11 - Recorder dev origin migration

- Changed only unpacked/dev Recorder defaults from the old Vercel Preview URL to `https://parro-guide.vercel.app` in background API fallback and popup login/link navigation.
- Added the Parro alias explicitly to host permissions while preserving `<all_urls>`, the old dev Preview origin, existing Production origin, extension ID, stored `webappOrigin`, dev/prod Supabase split, and all DB identifiers.
- Kept the published production extension on `https://mimic-nine-ashen.vercel.app`; no store package, publication, `main`, Production deployment, environment, Supabase, or data change was made.

## 2026-07-11 - Parro dev integration runbook

- Fetched current `origin/dev` and confirmed `brand/parro-system` is behind `0`, ahead `87`, with `origin/dev` as its ancestor and no current merge conflict.
- Added `docs/brand/parro-dev-integration-runbook.md` with explicit approval gates, pre-merge checks, a single `--no-ff` dev merge, full verification commands, merge-revert rollback, and temporary alias rollback.
- Did not merge or push `dev` or `main`, change Production, publish the extension, or touch environments, Supabase, or data.

## 2026-07-11 - Parro Recorder store artifact verification

- Ran `python build-store-zip.py` and produced local `parro-recorder-v1.6.2.zip` from the runtime whitelist.
- Verified 13 ZIP entries, forward-slash paths only, production name `Parro Recorder`, version `1.6.2`, all three icons, Parro alias host/external permissions, and preserved production origin.
- Removed the temporary ZIP after verification. Did not publish or mutate the Chrome Web Store listing, bump the extension version, or change `main`, Production, environments, Supabase, or data.

## 2026-07-11 - Restore Parro implementation source of truth

- Found that the required `docs/brand/parro-rebrand-implementation-plan.md` did not exist in the repository even though the handoff referenced it.
- Restored the plan at the required path with the original safety boundaries, brand decision, phased tasks, current evidence, explicit pending approvals, rollback model, and full completion definition.
- Did not change application runtime, Recorder runtime, `dev`, `main`, Production, environments, Supabase, or data.

## 2026-07-11 - Restore required mistakes log

- Found that required pre-read file `docs/mistakes.md` was also absent from the repository.
- Added verified rebrand, Vercel alias, metadata, Git rollback, Recorder packaging, secret-handling, and dev/prod DB separation lessons from the work completed on `brand/parro-system`.
- Updated the local `mimic-parro-rebrand` skill so future sessions must read the restored plan and mistakes log before rebrand work.
- Validated the updated skill with `quick_validate.py` under `PYTHONUTF8=1`; validation passed. The first run failed only because the Windows default `cp949` decoder could not read the UTF-8 skill file.
- Did not change runtime code, branches, deployments, environments, Supabase, or data.

## 2026-07-11 - Owner-approved Parro dev integration

- Preserved the existing dirty `dev` worktree and created clean integration branch/worktree from current `origin/dev`.
- Merged `brand/parro-system` with `--no-ff` as `216c35fb6b0783524bc21f1600907524b5c06979`, ran full app/SDK/Recorder/MCP verification, and fast-forward pushed `HEAD:dev`.
- Verified Ready Git Preview `dpl_8t9d8GULEqG7uJXHgAryCRiG3MjT`, browser-rendered Parro landing, dev Supabase, Parro assets, and no recent error logs.
- Added branch-scoped `NEXT_PUBLIC_APP_URL=https://parro-guide.vercel.app` to `Preview (dev)` only and redeployed as Ready `dpl_DgLFYLdL1JsKoJ1zFeayujtJ9YMc`.
- Reverified six public routes, metadata, robots, sitemap, assets, dev DB reference, and logs; old visible brand and old Production URL matches were zero.
- Kept `main`, Production deployment/env, production Supabase, published extension, and data unchanged. Source rollback is `git revert -m 1 216c35f`.

## 2026-07-11 - Parro Recorder 브랜드 아이콘 적용

- `fix/parro-recorder-brand`를 원격 `dev`의 `c6cde0f`에서 분리해 작업했다.
- Recorder의 16/48/128px 보라색 `M` 아이콘을 앱과 동일한 Wing Pointer 자산으로 교체했다.
- 매니페스트 이름 `Parro Recorder (dev)`를 유지하고 설명에 `Parro Recorder`를 명시했다.
- Recorder popup은 이미 Parro teal/lime 팔레트가 적용된 상태임을 확인했으며 420x800 렌더링에서 로고, 버튼, 레이아웃을 검증했다.
- 임시 Web Store ZIP을 생성해 `Parro Recorder`, 버전 `1.6.2`, Wing Pointer 아이콘 3종을 검증한 뒤 제거했으며 게시하지 않았다.
- `main`, Production, DB, 배포, Chrome Web Store에는 변경하지 않았다.
