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
