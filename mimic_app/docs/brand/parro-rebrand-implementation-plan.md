# Parro Public Rebrand Implementation Plan

> Source of truth for the staged public rebrand from MIMIC / 미믹 to Parro / 패로.
>
> Do not perform broad search-and-replace. This is a public-brand migration, not a full internal system rename.

## Goal

Change the public-facing product brand to Parro while preserving data, authentication, deployment, extension, SDK, and integration stability.

The target product position is a professional B2B **AI Live Guide for hands-on training/classes**. The selected visual direction is **Wing Pointer**: an abstract parrot wing plus screen pointer.

## Non-negotiable safety rules

- Never work directly on `main`.
- Start from `dev` and use an isolated feature branch.
- Keep changes small, classified, and rollback-friendly.
- Never run a blind `MIMIC` / `mimic` replacement.
- Do not touch Production, production data, or Supabase project settings during public-brand work.
- Do not rename DB tables, schemas, migrations, buckets, env vars, API routes, OAuth callbacks, package names, repository/folder names, Vercel project identifiers, extension IDs, webhooks, or compatibility APIs without a separately approved migration.
- Keep `mm_*` as Parro's internal database namespace. New tables continue using `mm_*` until a separately approved Phase 3 plan exists.
- Every operational change must have an explicit rollback target.

Required reading before implementation:

1. `CLAUDE.md`
2. `docs/mistakes.md`
3. This plan
4. `docs/brand/parro-brand-audit.md`
5. `docs/brand/parro-rebrand-qa.md`
6. `docs/brand/parro-dev-integration-runbook.md` before any `dev` integration

## Brand decision

| Item | Decision |
|---|---|
| English brand | Parro |
| Korean brand | 패로 |
| Category | B2B AI Live Guide for hands-on training/classes |
| Visual metaphor | Abstract parrot wing + screen pointer |
| Logo direction | Wing Pointer |
| Tone | Professional, friendly, helpful, B2B SaaS-ready |

Parro may use a friendly avatar inside the product, but the primary logo must not read as a literal cartoon bird or children's app.

## Phase strategy

| Phase | Scope | Risk | Current status |
|---|---|---|---|
| Phase 1 | Public-facing brand migration | Low to medium | Merged to `dev` in `216c35f`; Git Preview verified |
| Phase 2 | Preview/domain/contact/deployment-adjacent cleanup | Medium | Dev Preview URL/env completed; final domain pending |
| Phase 3 | Internal identifier and DB rename migration | High | Deferred; `mm_*` preservation approved |

## Task 1: Brand migration audit

Status: **Completed**.

Deliverables:

- `docs/brand/parro-brand-audit.md`
- `docs/implementation-log.md`

Evidence:

- Public-facing, compatibility, internal, historical, asset, and color references were classified before code changes.
- No broad replacement was performed.

## Task 2: Record the public brand decision

Status: **Completed**.

Deliverables:

- `docs/decisions.md`
- `docs/brand/parro-phase2-owner-decisions.md`

Decisions:

- Public brand is Parro / 패로.
- Wing Pointer is the selected logo direction.
- Internal identifiers remain unchanged unless separately approved.
- `mm_*` remains the database namespace.

## Task 3: Add production-ready Wing Pointer assets and brand tokens

Status: **Completed**.

Primary assets:

- `public/brand/parro-logo.svg`
- `public/brand/parro-mark.svg`
- `public/brand/parro-mark.png`
- `public/logo.svg`
- `app/icon.svg`
- `public/favicon.svg`
- shared `BrandMark`

Compatibility:

- `public/mimic-logo.png` remains as a compatibility filename but contains the Parro mark.

Colors are centralized through Parro semantic brand tokens rather than scattered as a new one-off palette.

## Task 4: Apply Parro public surfaces

Status: **Completed on the feature branch, merged to `dev`, and verified in the Git Preview**.

Covered surfaces:

- landing, app shell, settings, help, onboarding, legal, auth, admin, public viewers, and export branding
- email and n8n copy
- metadata, OG, sitemap, and robots
- FAQ and help chat
- Recorder visible name, popup, policy, permission, colors, logs, and packaging source
- SDK public aliases and visible descriptions
- MCP public README and tool descriptions
- active README, PM, agent, and operational docs

Allowed product copy includes:

- `Parro`
- `패로`
- `AI Live Guide for hands-on training`
- `실습 수업을 끝까지 따라오게 만드는 AI 라이브 가이드`

Avoid childish parrot copy in primary product surfaces.

## Task 5: Preserve compatibility while adding Parro APIs

Status: **Completed for additive aliases; legacy removal deferred**.

Parro primary aliases include:

- `window.ParroSDK`
- `window.ParroAutoRun`
- `window.ParroGuide`
- `parro_guide`
- `data-parro-guide`
- `data-parro-float`
- `parro-*` DOM/CSS/runtime identifiers

Preserved compatibility includes:

- `MimicSDK`, `MimicAutoRun`, `MimicGuide`
- `mimic_guide`, `data-mimic-float`, and `mimic-*` selectors
- storage, IndexedDB, package, route, header, extension, DB, and deployment identifiers

Do not remove compatibility aliases in this phase.

## Task 6: Final QA and remaining-reference classification

Status: **Completed for the feature branch, merged `dev`, and temporary/Git Previews**.

Authoritative report:

- `docs/brand/parro-rebrand-qa.md`

Required checks:

```powershell
cd mimic_app
npm run lint
$env:NODE_OPTIONS='--use-system-ca'
npm run build
cd ..
node --check mimic_app/public/sdk.js
node --check mimic_recorder/content.js
node --check mimic_recorder/background.js
node --check mimic_recorder/guide-engine.js
node --check mimic_recorder/popup.js
cd packages/mcp-server
npm run build
cd ../..
git diff --check origin/dev...HEAD
```

Known unrelated warnings are recorded in the QA report and must not be mixed into the rebrand.

## Phase 2: Operational cleanup

Completed reversible Preview work:

- Temporary URL: `https://parro-guide.vercel.app`
- Current verified Preview: `dpl_J85ABCHTTM6EaxGXzvDMhZTCrh2i`
- `dev` merge commit: `216c35fb6b0783524bc21f1600907524b5c06979`
- Current Git `dev` Preview: `dpl_DgLFYLdL1JsKoJ1zFeayujtJ9YMc`
- Branch-scoped Vercel value: `NEXT_PUBLIC_APP_URL=https://parro-guide.vercel.app` for `Preview (dev)` only.
- Preview uses dev Supabase `dskphgxurxebblnpwhax`.
- Metadata, robots, and sitemap emit the Parro alias.
- Interim support contact is `kinjungho@gmail.com`.
- Active favicon crawler uses `ParroBot/1.0` with `MIMICBot/1.0` retained for rollback.
- Unpacked Recorder defaults to the Parro Preview alias; the published production extension remains on the existing Production origin.
- Web Store source listing uses the temporary Parro URL; the live listing was not modified.

Still requires separate owner approval:

1. Purchase and attach the final Parro custom domain.
2. Provision the final domain mailbox if required.
3. Update production URL/env and Recorder production origin only after final-domain verification.
4. Publish a new Chrome Web Store version only after package and policy review.
5. Merge to `main` and promote Production only through a separate explicit approval gate.

## Phase 3: Internal migration

Status: **Deferred and not approved**.

The following remain unchanged:

- `mm_*` tables and related policies/functions/triggers
- Supabase migration and schema filenames
- storage bucket names such as `mimic-tts`
- package names such as `mimic-app` and `@mimic/mcp-server`
- API routes, env vars, headers, OAuth callbacks, extension ID, repo/folder names, and Vercel project name
- SDK and Recorder compatibility names

Any future Phase 3 work requires a dedicated inventory, dev rehearsal, security review, data/rollback plan, and separate owner approval.

## Rollback model

- Source changes are split into small commits on `brand/parro-system`.
- `dev` integration must use one `--no-ff` merge commit so it can be reverted with `git revert -m 1`.
- Temporary Vercel alias can be repointed to a previously verified Preview or removed.
- Shared branch history must never be rewritten with reset or force-push.
- Production and `main` remain unchanged until their own approval gate.

## Completion definition

The full rebrand is complete only when all of the following are proven:

1. Parro public surfaces and compatibility paths pass branch QA.
2. Owner-approved `dev` merge and Git Preview verification pass.
3. Final custom domain and production environment behavior pass.
4. Recorder production package/listing and app integration pass.
5. Owner explicitly approves `main` merge and Production promotion.
6. Production smoke tests show Parro branding with no unintended MIMIC public copy.
7. Rollback instructions and targets are current.

Until then, the project remains in staged rebrand status and must not be described as fully deployed.
