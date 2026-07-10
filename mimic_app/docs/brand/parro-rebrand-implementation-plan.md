# Parro Public Rebrand Implementation Plan

> **For Codex:** Use this document as the source-of-truth handoff for the MIMIC → Parro public rebrand. Do not perform broad search-and-replace. Follow the phases and guardrails exactly.

**Goal:** Change the public-facing product brand from **MIMIC / 미믹** to **Parro / 패로** while preserving internal identifiers, database safety, and deployment stability.

**Architecture:** This is a staged rebrand, not a full internal rename. Phase 1 changes only user-facing brand surfaces, logo assets, brand colors, metadata, and documentation. Internal code names such as package names, DB tables, migrations, env vars, API routes, and deployment identifiers remain unchanged until a separately approved migration phase.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, Supabase, Vercel, TypeScript/JavaScript, existing project docs and scripts.

---

## 0. Current Brand Decision

### New public brand

| Item | Value |
|---|---|
| English brand | `Parro` |
| Korean brand | `패로` |
| Product category | B2B AI Live Guide for hands-on training/classes |
| Visual metaphor | Abstract parrot wing + screen pointer |
| Selected logo direction | **Wing Pointer** |
| Brand tone | Professional, friendly, helpful, B2B SaaS-ready |

### Why we are changing from MIMIC

- `MIMIC / 미믹` has negative search and image associations: horror, monster, game, uncanny imitation.
- The product direction is not horror/creature-like imitation; it is guided, friendly, step-by-step live assistance.
- `Parro` keeps the parrot/follow/repeat metaphor while making the product warmer and more approachable.
- The logo should not be a literal cartoon parrot. It should communicate **on-screen guidance** first and parrot identity second.

### Final visual principle

```text
Parro is not a cute bird app.
Parro is a professional AI Live Guide whose mark subtly combines a wing and a pointer.
```

---

## 1. Non-Negotiable Safety Rules

Before implementation, Codex must read:

1. `CLAUDE.md`
2. `docs/mistakes.md`
3. This plan: `docs/brand/parro-rebrand-implementation-plan.md`

### Branch rules

- Do **not** work on `main`.
- Start from `dev` unless the owner explicitly says otherwise.
- Recommended branch:

```bash
git checkout dev
git checkout -b brand/parro-system
```

### Production/DB rules

Do **not** touch:

- production DB
- Supabase project settings
- Supabase migrations
- Supabase schema files
- dev/prod env wiring
- Vercel production deployment
- production data

### Do not rename these in this project phase

These remain as-is unless a separate internal rename migration is approved:

- DB table names
- SQL migration filenames
- Supabase schema/setup files
- env variable names
- API route names
- OAuth callback URLs
- package names such as `mimic-app`
- GitHub repository name
- local directory names such as `mimic_app`
- Vercel project name
- storage bucket names
- MCP package names
- any identifier whose rename could break existing data, deployment, auth, extension, or webhook integrations

### Forbidden implementation approach

Do **not** run a blind replacement such as:

```bash
perl -pi -e 's/MIMIC/Parro/g' ...
sed -i 's/mimic/parro/g' ...
```

Every changed reference must be classified first as one of:

- public-facing brand text
- internal identifier
- historical documentation
- generated/reference artifact
- owner decision needed

---

## 2. Work Strategy Overview

This rebrand is split into three major phases.

| Phase | Scope | Risk | Status |
|---|---|---:|---|
| Phase 1 | Public-facing brand migration | Low–Medium | Do now |
| Phase 2 | Operational/docs/deployment-adjacent cleanup | Medium | After Phase 1 verifies |
| Phase 3 | Internal identifier and DB rename migration | High | Do later only if approved |

This plan covers **Phase 1** and prepares the audit structure for later phases.

---

## 3. Phase 1 Scope — Public-Facing Brand Migration

### Phase 1 goal

Users, learners, instructors, and public visitors should see **Parro** instead of **MIMIC** in product-facing surfaces.

Internally, the codebase may still contain `mimic` where it is an identifier, folder name, package name, schema name, migration history, or implementation detail.

### Must update in Phase 1

Inspect and update public-facing references in:

- landing page
- app header/logo
- app footer/logo
- browser title/metadata
- Open Graph metadata if present
- favicon/app icon
- PWA manifest if present
- help page visible copy
- onboarding visible copy
- extension link/setup visible copy
- learner/shared page visible copy
- email sender display/copy where safe
- FAQ visible copy
- README or docs used as public project introduction
- docs decision and implementation logs

### Known candidate files from initial discovery

Codex must verify these paths before editing:

```text
app/landingpage/page.tsx
app/landingpage/layout.tsx
app/help/page.tsx
app/extension-link/page.tsx
app/p/[token]/page.tsx
lib/email/email.ts
lib/email/email-n8n.ts
lib/faq-data.ts
lib/favicon.ts
public/logo.svg
public/mimic-logo.png
app/icon.svg
docs/decisions.md
docs/implementation-log.md
docs/mistakes.md
README.md (if present)
```

### Must not update in Phase 1 unless explicitly approved

```text
package.json
package-lock.json
packages/mcp-server/package.json
packages/mcp-server/package-lock.json
supabase/dev-setup/01_mimic_dev_schema.sql
supabase/migrations/*
.env* files
Vercel config/project identifiers
API route filenames
local directory names
```

---

## 4. Phase 1 Detailed Tasks

## Task 1 — Brand Migration Audit

**Objective:** Create an audit that classifies every old-brand reference before code changes.

**Files:**

- Create: `docs/brand/parro-brand-audit.md`
- Modify: `docs/implementation-log.md`

**Steps:**

1. Read `CLAUDE.md` and `docs/mistakes.md`.
2. Check branch/status:

```bash
git status --short --branch
```

3. Run searches:

```bash
rg -n "MIMIC|Mimic|mimic|미믹" . --glob "!node_modules" --glob "!.next" --glob "!.git"
rg -n "logo|favicon|icon|manifest|themeColor|metadata|title|description" app components lib public docs --glob "!node_modules" --glob "!.next"
rg -n "#[0-9A-Fa-f]{3,8}|rgb\(|hsl\(" app components lib styles public --glob "!node_modules" --glob "!.next"
```

4. Write `docs/brand/parro-brand-audit.md` with these sections:

```md
# Parro Brand Migration Audit

## Summary
## Public-facing references to change
## Internal identifiers to preserve
## Historical docs to preserve
## Logo/icon asset locations
## Color/theme locations
## Recommended brand token structure
## Implementation phases
## Verification commands
## Risks and owner decisions needed
```

5. Append to `docs/implementation-log.md`:

```md
## YYYY-MM-DD — Parro brand migration audit

- Created `docs/brand/parro-brand-audit.md`.
- Classified public-facing vs internal `MIMIC`/`mimic` references.
- No broad rename performed.
```

**Verification:**

```bash
npm run lint
```

If lint fails due to existing issues, document the failure exactly.

**Commit:**

```bash
git add docs/brand/parro-brand-audit.md docs/implementation-log.md
git commit -m "docs: add Parro brand migration audit"
```

---

## Task 2 — Record Product/Brand Decision

**Objective:** Document the decision to use Parro as the public brand while deferring internal renames.

**Files:**

- Modify: `docs/decisions.md`
- Modify: `docs/implementation-log.md`

**Decision entry content:**

```md
## YYYY-MM-DD — Public brand rename from MIMIC to Parro

### Decision

The public-facing product brand changes from **MIMIC / 미믹** to **Parro / 패로**.

The selected visual direction is **Wing Pointer**: an abstract parrot wing plus screen pointer, not a literal cartoon bird.

Internal identifiers such as DB tables, migrations, package names, env vars, API routes, repo/folder names, and deployment identifiers remain unchanged in Phase 1.

### Rationale

- MIMIC has negative horror/game/monster search associations.
- Parro preserves the follow/repeat/parrot metaphor in a friendlier way.
- The service target is B2B education/training, so the brand must remain professional.
- A staged public rebrand is safer than an internal full rename.

### Non-goals

- No DB/table/schema rename in this phase.
- No migration filename rewrite.
- No repo/folder/package rename.
- No weakening of Live Guide, DOM selector, coordinate, or capture-event assets.
- No childish cartoon parrot tone.
```

**Verification:**

- Confirm docs only changed.

**Commit:**

```bash
git add docs/decisions.md docs/implementation-log.md
git commit -m "docs: record Parro public brand decision"
```

---

## Task 3 — Add Parro Brand Assets

**Objective:** Add final Wing Pointer logo assets without replacing UI broadly yet.

**Prerequisite:** Owner must provide final logo source file, preferably SVG.

Expected source examples:

```text
/Users/macmini/Downloads/parro-wing-pointer.svg
/Users/macmini/Downloads/parro-logo.svg
```

**Files:**

- Create/modify according to existing project conventions:

```text
public/brand/parro-logo.svg
public/brand/parro-mark.svg
public/logo.svg
app/icon.svg
public/favicon.svg (if project supports it)
```

**Rules:**

- Use final SVG source if available.
- Do not use Telegram screenshot as production asset.
- Keep old `public/mimic-logo.png` only if needed for historical/backward compatibility; otherwise report before deleting.
- Ensure icon works at favicon size.
- Add accessible alt text in render locations later.

**Verification:**

```bash
npm run lint
```

**Commit:**

```bash
git add public app/icon.svg
# include only actual changed asset files
git commit -m "style: add Parro brand assets"
```

---

## Task 4 — Add/Update Brand Color Tokens

**Objective:** Centralize Parro colors in the theme instead of scattering raw hex values.

**Files to inspect:**

```text
tailwind.config.js
tailwind.config.ts
app/globals.css
styles/globals.css
app/landingpage/page.tsx
components/*
```

**Recommended semantic tokens:**

```ts
brand: {
  primary: "<deep teal/parrot green>",
  primaryForeground: "#ffffff",
  accent: "<mint/lime>",
  accentForeground: "<deep navy>",
  highlight: "<warm coral/orange>",
  guide: "<parrot green>",
  guideSoft: "<soft mint background>",
  pointer: "<deep navy>",
  surface: "<neutral surface>",
  border: "<soft border>",
  focus: "<accessible focus ring>"
}
```

**Rules:**

- Use actual values from the final logo SVG when available.
- Maintain accessibility contrast.
- Do not redesign the entire UI.
- Do not change business logic.
- Keep dark mode behavior intact if present.

**Verification:**

```bash
npm run lint
npm run build
```

**Commit:**

```bash
git add tailwind.config.* app styles components
# include only actual changed files
git commit -m "style: add Parro brand color tokens"
```

---

## Task 5 — Apply Parro to Public UI Surfaces

**Objective:** Replace public-facing product labels and visible copy from MIMIC to Parro.

**Files to prioritize:**

```text
app/landingpage/page.tsx
app/landingpage/layout.tsx
app/help/page.tsx
app/extension-link/page.tsx
app/p/[token]/page.tsx
lib/faq-data.ts
lib/email/email.ts
lib/email/email-n8n.ts
lib/favicon.ts
```

**Suggested copy rules:**

Use:

```text
Parro
패로
AI Live Guide for hands-on training
실습 수업을 끝까지 따라오게 만드는 AI 라이브 가이드
```

Avoid as main B2B copy:

```text
따라오새!
귀여운 앵무새
앵무새 친구
어린이 앱 같은 표현
```

Allowed only in minor character moments, not hero copy:

```text
패로가 다음 단계를 안내합니다.
패로가 화면 위에서 필요한 위치를 짚어줍니다.
```

**Rules:**

- Change only public-facing text.
- Preserve internal identifiers.
- If unsure whether a reference is public or internal, leave it and report it.

**Verification:**

```bash
npm run lint
npm run build
rg -n "MIMIC|Mimic|미믹" app components lib public docs --glob "!node_modules" --glob "!.next"
```

Classify remaining hits.

**Commit:**

```bash
git add app components lib public docs
# include only actual changed files
git commit -m "style: apply Parro public brand surfaces"
```

---

## Task 6 — Final QA and Remaining Reference Classification

**Objective:** Verify the app builds and produce a final report of remaining `mimic` references.

**Commands:**

```bash
npm run lint
npm run build
rg -n "MIMIC|Mimic|mimic|미믹" . --glob "!node_modules" --glob "!.next" --glob "!.git"
```

**Create or update:**

```text
docs/brand/parro-rebrand-qa.md
```

**QA document sections:**

```md
# Parro Rebrand QA

## Verification commands
## Build/lint results
## Public-facing old brand references remaining
## Internal identifiers intentionally preserved
## Historical docs intentionally preserved
## Follow-up owner decisions
## Phase 2 recommendations
```

**Commit:**

```bash
git add docs/brand/parro-rebrand-qa.md docs/implementation-log.md
git commit -m "docs: add Parro rebrand QA report"
```

---

## 5. Phase 2 — Operational Cleanup, Not Yet Implementation

Do only after Phase 1 is verified.

Possible tasks:

- custom domain decision
- Vercel display name decision
- email sender name/domain update
- Open Graph image generation
- README cleanup
- extension name/manifest review
- external docs update
- Slack/Telegram/n8n notification copy review

Do not mix Phase 2 with Phase 1 unless owner approves.

---

## 6. Phase 3 — Internal Rename Migration, Deferred

This is a separate high-risk project. Do not start without explicit owner approval.

Potential internal rename areas:

- repo name
- local directory name
- package name
- Supabase table/schema names
- SQL migration naming strategy
- API routes
- env vars
- storage buckets
- Vercel project name
- OAuth redirect URLs
- extension IDs
- webhook URLs
- n8n workflow references

Phase 3 requires:

1. full dependency map
2. dev DB migration plan
3. rollback plan
4. production backup plan
5. owner approval before any production DB operation

---

## 7. Codex Final Report Format

At the end of each task, Codex must report:

1. Current branch
2. Files changed
3. Summary of changes
4. Verification commands and results
5. Remaining risks
6. Any old-brand references left intentionally
7. Recommended next task

Do not claim success unless commands actually ran.

---

## 8. Owner Inputs Needed Before Visual Implementation

Before Tasks 3–5, owner should provide:

```text
Final Wing Pointer logo SVG path:
Final wordmark/logo lockup path, if separate:
Preferred English display name: Parro or Parro AI:
Preferred Korean display name: 패로 or 패로 AI:
```

If only screenshots exist, stop and request production-ready assets before replacing app icons/logos.

---

## 9. MAX Recommendation

Proceed as follows:

1. Commit this implementation plan.
2. Ask Codex to execute Task 1 only.
3. Review audit.
4. Provide final logo SVG.
5. Ask Codex to execute Tasks 2–4.
6. Review visual/build results.
7. Ask Codex to execute Task 5.
8. Run Task 6 QA before any merge to `dev`.

Do not start Phase 3 until the public rebrand is stable.
