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
