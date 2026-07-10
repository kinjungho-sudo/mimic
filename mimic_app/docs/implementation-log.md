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
