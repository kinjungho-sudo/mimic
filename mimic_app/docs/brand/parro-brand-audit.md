# Parro Brand Migration Audit

Date: 2026-07-10
Branch: `brand/parro-system`
Base: `origin/dev`

## Summary

This audit prepares the staged public rebrand from **MIMIC / 미믹** to **Parro / 패로**.

Scope is Task 1 only. No app UI, runtime behavior, database object, API route, package name, environment variable, deployment identifier, repository name, folder name, or migration file was changed.

`CLAUDE.md` was read. `docs/mistakes.md` was requested by the plan but is not present in this checkout; this is tracked under risks.

Searches showed old-brand references across public UI, email templates, metadata, help/FAQ surfaces, exported document branding, SDK/embed surfaces, historical docs, and internal identifiers. Phase 1 should change only public-facing product surfaces after owner review.

## Public-facing references to change

These references appear user-visible and should be migrated in Phase 1 after owner review.

- `app/layout.tsx`: global metadata, Open Graph/Twitter title, JSON-LD `name`, old `mimic-logo.png` reference, and "Don't Explain, Just Mimic." description.
- `app/landingpage/layout.tsx`: landing metadata titles and OG alt text.
- `app/landingpage/page.tsx`: hero/product copy, product simulator labels, mock URLs, "MIMIC Recorder" visible copy, "Why MIMIC", pricing features, footer, and "Don't Explain, Just Mimic." tagline.
- `app/help/page.tsx`: help navigation, intro, FAQ entries, support copy, footer logo text, and extension setup wording.
- `app/extension-link/page.tsx`: extension setup headings and CTA labels. The Chrome Web Store URL contains `mimic-recorder` and needs owner decision before changing.
- `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`, `app/auth/forgot-password/page.tsx`, `app/auth/reset-password/page.tsx`: visible auth brand headers. The dev test email `devtest@mimic.dev` is not public branding and should be preserved until owner decides.
- `app/home/page.tsx`, `app/settings/page.tsx`, `app/mypage/page.tsx`, `app/workspace/invite/[token]/page.tsx`: visible app chrome brand labels and current purple brand mark usage.
- `app/p/[token]/page.tsx`: "Made with MIMIC" public page attribution.
- `app/play/[token]/layout.tsx`, `app/play/[token]/page.tsx`, `app/embed/[token]/page.tsx`: player metadata, visible player header/watermark, and public manual descriptions.
- `app/legal/privacy/page.tsx`, `app/legal/terms/page.tsx`: public legal references to product/service name; should be changed only after legal wording review.
- `components/chat/AgentChat.tsx`: assistant welcome text.
- `components/dashboard/RecordingModal.tsx`: visible extension installation/setup copy, but console log tags should remain internal unless owner approves.
- `components/editor/ExportModal.tsx`, `components/editor/ShareModal.tsx`: visible sharing and Kakao/email description copy.
- `lib/email/email.ts`, `lib/email/email-n8n.ts`: visible email subject lines, headers, footers, sender default names, logo image path, and "Don't Explain, Just Mimic." tagline.
- `app/api/contact/route.ts`, `app/api/share/email/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/signup-with-agreements/route.ts`, `app/api/agent/chat/route.ts`, `app/api/og/route.tsx`: generated user-facing email/chat/OG text. Function names like `sendMimicEmail` should remain internal in Phase 1.
- `app/api/export/docx/[id]/route.ts`, `app/api/export/pdf/[id]/route.ts`, `app/api/export/pdf/token/[token]/route.ts`, `app/api/export/pptx/[id]/route.ts`: exported document cover/author/company defaults visible to users.
- `public/llms.txt`, `README.md`: public project/introduction text.

## Internal identifiers to preserve

These are compatibility, storage, database, package, route, SDK, or development identifiers and must not change in Phase 1.

- `package.json`, `package-lock.json`: package name `mimic-app`.
- `packages/mcp-server/package.json`, `packages/mcp-server/package-lock.json`, `packages/mcp-server/src/index.ts`, `packages/mcp-server/README.md`: MCP package naming and integration copy.
- `supabase/dev-setup/01_mimic_dev_schema.sql` and `supabase/migrations/*`: schema, migration filenames, storage bucket references such as `mimic-tts`, and historical SQL comments.
- `app/api/**` route filenames and route paths: no route rename.
- Environment names and values in code comments or examples, including `MIMIC_EXTENSION_ID`, `NEXT_PUBLIC_APP_URL`, n8n secret headers, and Supabase project references.
- `app/api/share/email/route.ts`: `x-mimic-secret` header.
- `app/api/guide/[token]/route.ts`, `app/layout.tsx`, `app/landingpage/layout.tsx`: deployment URLs such as `mimic-nine-ashen.vercel.app` remain deployment identifiers until Phase 2.
- `app/home/page.tsx`: drag/drop MIME type `text/mimic-tutorial`.
- `components/editor/ImageAnnotationEditor.tsx`: local storage key `mimic_annot_defaults_v1`.
- `public/sdk.js`: public SDK class names, query params, globals, and IDs such as `mimic_guide`, `data-mimic-float`, `window.MimicSDK`, `window.MimicAutoRun`, `mimic-highlight`, and `mimic-autorun-*`.
- `lib/favicon.ts`: `MIMICBot/1.0` crawler user agent should remain until owner approves a bot/user-agent migration.
- `lib/auth/auth-client.ts`, `lib/auth/auth-guard.ts`, `lib/api/liveGuide.ts`: comments and messages tied to extension/auth compatibility need owner review before changing.
- Local directory names: `mimic_app`, `mimic_recorder`, and repo/worktree names remain unchanged.
- Chrome Web Store extension slug/ID and OAuth callback URLs remain unchanged.

## Historical docs to preserve

These references are historical context or implementation handover records. Do not rewrite them in Phase 1 unless the owner explicitly asks for documentation cleanup.

- `docs/PLAN.md`: backend specification for the older MIMIC architecture, including repo/domain/storage examples.
- `docs/DEV_PROCESS.md` and root `DEV_PROCESS.md`: branch/worktree/database process history and safety rules.
- `docs/SESSION_HANDOVER.md`: prior deployment and naming handover context.
- `docs/MANUAL_CONTENT_RULES.md`, `docs/VOICE_PIPELINE_TASK.md`, `docs/N8N_EMAIL_SETUP.md`: operational docs with technical references.
- `_design_fetch/motion-v2/**`: archived design fetches, screenshots, and generated HTML prototypes.
- `LOCAL_TESTING.md`, `_design_fetch/motion-v2/chats/chat1.md`, `scripts/replace_demo.py`: historical/dev support material.

## Logo/icon asset locations

Current assets discovered:

- `public/logo.svg`: current circular purple `M` mark.
- `components/common/BrandMark.tsx`: inline current circular purple `M` mark.
- `app/icon.svg`: app icon SVG with current `M` mark.
- `public/mimic-logo.png`: current bitmap logo used by emails/metadata.
- `public/icons/icon16.png`, `public/icons/icon48.png`, `public/icons/icon128.png`: current icon PNG set.
- `app/api/og/route.tsx`: generated OG image brand text and purple palette.
- `public/sdk.js`: embedded floating guide icon/cursor SVG and guide styles.

Production-ready Parro SVG assets are needed before replacing app icons/logos. Screenshots should not be used as production logo sources.

## Color/theme locations

Central theme and hardcoded color locations:

- `tailwind.config.ts`: `mm-primary`, `mm-accent`, `mm-grad`, and related purple tokens.
- `app/globals.css`: CSS variables `--mm-primary`, `--mm-accent`, gradients, aliases, and pulse keyframes.
- `components/common/BrandMark.tsx`: hardcoded `#3730a3`.
- `public/logo.svg`, `app/icon.svg`: hardcoded `#3730a3`.
- `app/landingpage/page.tsx`: extensive hardcoded gradients, purple CTA, guide highlight, and mock UI colors.
- `components/dashboard/RecordingModal.tsx`: hardcoded purple gradients and CTA/selection colors.
- `public/sdk.js`: embedded guide highlight, button, cursor, progress, and autorun colors.
- `app/api/og/route.tsx`: OG background/brand palette.
- `app/api/share/email/route.ts`, `app/api/contact/route.ts`, `lib/email/email.ts`, `lib/email/email-n8n.ts`: email brand gradients and text colors.
- `app/api/export/pdf/[id]/route.ts`, `app/api/export/pdf/token/[token]/route.ts`, `app/api/export/pptx/[id]/route.ts`, `app/api/export/docx/[id]/route.ts`: document export brand color defaults.

The search path `styles` does not exist in this checkout, so color search was adapted to `app`, `components`, `lib`, and `public`.

## Recommended brand token structure

Add semantic Parro tokens before broader UI migration. Use exact values from final Wing Pointer SVG when available.

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

Suggested starting palette, subject to final logo extraction:

- `primary`: `#009B8E`
- `primaryForeground`: `#FFFFFF`
- `accent`: `#8DD63F`
- `accentForeground`: `#102033`
- `highlight`: `#FF7A3D`
- `guide`: `#12B886`
- `guideSoft`: `#E8FFF7`
- `pointer`: `#102033`
- `surface`: `#FFFFFF`
- `border`: `#DDE7E4`
- `focus`: `#17C9B6`

## Implementation phases

Phase 1: Public-facing brand migration

- Change visible product name, metadata, help, landing, auth, public page attribution, email copy, generated OG/email/export branding, and public introduction docs.
- Keep internal identifiers unchanged.
- Add/consume approved Parro logo SVGs only after production-ready assets are provided.

Phase 2: Operational/docs/deployment-adjacent cleanup

- Decide custom domain, Vercel display name, email sender name/domain, Chrome Web Store listing name, and support email/domain.
- Do not mix with Phase 1 without owner approval.

Phase 3: Internal identifier migration

- Only with an approved migration plan for API routes, env vars, storage buckets, Vercel project name, OAuth redirect URLs, extension IDs, webhook URLs, n8n references, MCP package names, and DB/schema naming.

## Verification commands

Run from `mimic_app`:

```powershell
git status --short --branch
rg -n "MIMIC|Mimic|mimic|미믹" . --glob "!node_modules" --glob "!.next" --glob "!.git"
rg -n "logo|favicon|icon|manifest|themeColor|metadata|title|description" app components lib public docs --glob "!node_modules" --glob "!.next"
rg -n "#[0-9A-Fa-f]{3,8}|rgb\(|hsl\(" app components lib public --glob "!node_modules" --glob "!.next"
npm run lint
npm run build
```

After each implementation task, re-run the old-brand search and classify remaining hits as public-facing, internal-preserved, historical-preserved, or owner-decision.

## Risks and owner decisions needed

- `docs/mistakes.md` is missing, although the plan requires it to be read. Owner should provide or confirm it is intentionally absent.
- `docs/implementation-log.md` and `docs/decisions.md` are missing in this checkout; Task 1 creates the implementation log, and Task 2 should create or update decisions.
- Final Wing Pointer logo source must be provided as production-ready SVG before icon/logo replacement. Current selected PNG/screenshots are not enough for production logo replacement.
- Decide public extension name: keep `MIMIC Recorder` temporarily for store/extension compatibility, or present it as `Parro Recorder` while preserving extension IDs/slugs internally.
- Decide whether generated exports should say `Parro`, `Parro Manual`, or user workspace/company branding when no company branding is set.
- Decide support domain/email migration timing for `support@mimic.so`, `hello@mimicflow.com`, and `mimic-nine-ashen.vercel.app` links.
- Decide legal document wording before changing `app/legal/privacy/page.tsx` and `app/legal/terms/page.tsx`.
- Decide whether SDK public globals and CSS classes remain `mimic-*` indefinitely for backward compatibility.
- Decide whether `MIMICBot/1.0` user agent remains or changes in Phase 2/3.
- Existing docs contain encoding-corrupted Korean text in `CLAUDE.md`/CSS comments; avoid broad rewrites.
