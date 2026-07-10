# Implementation Log

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
