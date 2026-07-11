# Parro Phase 2 Owner Decisions

Phase 1 public rebrand work has moved visible product copy, colors, Recorder display names, SDK Parro aliases, and MCP public descriptions toward Parro while preserving risky internal identifiers.

Phase 2 should not start until the owner explicitly approves each operational decision below.

## Decision 1: Final Logo Source

Status: approved and applied on `2026-07-11` in `brand/parro-system`.

The selected Wing Pointer direction was rebuilt as original vector geometry and applied to the app logo, icon, favicon, PNG icon set, and shared `BrandMark` component.

Applied files:

- `public/brand/parro-logo.svg`
- `public/brand/parro-mark.svg`
- `public/brand/parro-mark.png`
- `public/logo.svg`
- `app/icon.svg`
- `public/favicon.svg`
- `public/icons/icon16.png`
- `public/icons/icon48.png`
- `public/icons/icon128.png`

Resolved asset path decision:

- Use `/brand/parro-mark.png` as the primary public bitmap path.
- Keep `/mimic-logo.png` as a compatibility filename with identical Parro mark contents.

Risk:

- Medium. Bad source assets can make the brand look unprofessional, and changing image paths can affect email, metadata, and cached embeds.

## Decision 2: Public Domain

Current old-brand values:

- `https://mimic-nine-ashen.vercel.app`
- `https://mimic-git-dev-kinjungho-7735s-projects.vercel.app`
- `https://mimicflow.com`

Files currently holding deployment/domain values include:

- `mimic_app/lib/brand.ts`
- `mimic_app/public/sdk.js`
- `mimic_app/public/robots.txt`
- `mimic_recorder/background.js`
- `mimic_recorder/popup.js`
- `mimic_recorder/manifest.json`
- `mimic_recorder/store-assets/store-listing.md`

Open decision:

- Choose the final Parro production domain.
- Choose the Parro preview/dev host strategy.
- Decide whether `mimicflow.com` remains as a redirect, is disconnected, or stays as historical only.

Risk:

- High. Domain changes affect auth redirects, extension host permissions, SDK embeds, SEO files, and production deployment routing.

Prerequisite:

- Vercel CLI `54.5.1` is available in this environment. Do not run `vercel env pull`, `vercel deploy`, `vercel logs`, or linked-project inspection until the owner explicitly approves Phase 2 operational work.

### Read-only Vercel preflight — 2026-07-11

- Account: `kinjungho-7735` under `kinjungho-7735s-projects`.
- Existing project: `mimic`; root directory `mimic_app`; Node.js `24.x`; framework preset Next.js.
- Current production alias: `https://mimic-nine-ashen.vercel.app`, pointing to a Ready production deployment.
- Additional stable aliases include the project and `main` branch Vercel URLs, all using the old project name.
- `vercel domains ls` returned zero custom domains for the current scope.
- At the initial preflight, this worktree had no root or `mimic_app` `.vercel/project.json`; no project link had been created yet.
- No project, domain, alias, environment, or deployment was changed during the preflight.

### Approved Preview deployment — 2026-07-11

- Linked this worktree locally to the existing `kinjungho-7735s-projects/mimic` project. `.vercel` remains ignored by git.
- Created Preview deployment `dpl_HDq1Ec1ksAYMQBogXj7foyrHaG6z`:
  `https://mimic-24chg4zda-kinjungho-7735s-projects.vercel.app`
- Deployment target is Preview and status is Ready. No `--prod`, `promote`, production alias, custom domain, environment, or Supabase change was used.
- `/landingpage` returned Parro metadata and UI: `Parro` 36 matches and zero visible `MIMIC` / `미믹` matches in the rendered HTML.
- `/brand/parro-mark.svg`, `/brand/parro-mark.png`, and `/icon.svg` returned HTTP 200 with the expected content types.
- Browser smoke confirmed the Wing Pointer mark and Parro first viewport render correctly.
- Recent Preview error-log query returned no errors.

### Recommended domain cutover

1. Choose and prepare the final Parro custom domain.
2. Add the custom domain to the existing `mimic` Vercel project first; keep the Vercel project name as an internal deployment identifier during cutover.
3. Verify the custom domain against a Preview deployment and confirm auth redirects, public assets, SDK origin behavior, and Recorder host access.
4. Update `NEXT_PUBLIC_APP_URL` and public fallback/static URLs by environment only after the domain verification passes.
5. Update Recorder runtime URLs and manifest host permissions in a separate rollback-friendly commit.
6. Keep the old Vercel aliases active during the transition; consider renaming the Vercel project only in a later dedicated migration.

## Decision 3: Support Email

Current value:

- `support@mimic.so` via `BRAND_SUPPORT_EMAIL` in `mimic_app/lib/brand.ts`

Open decision:

- Choose final public support email, for example `support@<parro-domain>`.
- Decide whether old `support@mimic.so` forwards to the new address.

Risk:

- Medium. Email sender/reply-to changes affect support workflows and automated email trust.

## Decision 4: Chrome Web Store Slug and Policy URLs

Current old-brand values:

- Chrome Web Store slug: `mimic-recorder`
- Privacy policy URL: `https://kinjungho-sudo.github.io/mimic-recorder-policy/privacy_policy.html`

Files currently holding values include:

- `mimic_app/lib/brand.ts`
- `mimic_recorder/store-assets/store-listing.md`

Open decision:

- Keep the existing store slug for continuity, or migrate through a separate listing/update process.
- Decide whether policy hosting moves to a Parro domain/path.

Risk:

- High. Store identity, extension IDs, update channels, policy URLs, and user trust can be affected.

## Decision 5: Bot/User-Agent Name

Current value:

- `MIMICBot/1.0` in `LEGACY_INTERNAL_IDENTIFIERS.botUserAgent`

Open decision:

- Keep `MIMICBot/1.0` as a stable crawler compatibility identifier, or change to `ParroBot/1.0` in a dedicated migration.

Risk:

- Low to medium. Some remote servers may use user-agent allow/block rules.

## Decision 6: Internal Identifier Migration

Current intentionally preserved identifiers include:

- `@mimic/mcp-server`
- MCP server key `mimic`
- `mimic-app`
- `x-mimic-secret`
- `mimic-tts`
- `MIMIC_EXTENSION_ID`
- `mimic_guide`
- `data-mimic-float`
- `MimicSDK`
- `MimicAutoRun`
- `mimic-*` legacy DOM/CSS selectors
- local storage and IndexedDB names such as `mimic:survey:*`, `mimic_annot_defaults_v1`, and `mimic_screenshots`

Open decision:

- Keep these indefinitely as compatibility identifiers, or schedule a Phase 3 internal migration with explicit rollback plan.

Risk:

- High. Renaming these can break existing embeds, automation, data, auth, webhooks, extension runtime, or package consumers.

## Recommended Phase 2 Order

1. Final logo SVG and asset filename policy completed on `brand/parro-system`.
2. Read-only Vercel preflight and approved Parro Preview deployment completed; Production remains unchanged.
3. Decide the final Parro custom domain and support email.
4. Update app constants and public static files.
5. Update Recorder runtime URLs and manifest host permissions only after domain/auth behavior is confirmed.
6. Decide Chrome Web Store/policy URL migration separately.
7. Run full app lint/build, Recorder syntax checks, SDK smoke tests, and final old-brand classification search.

## Do Not Mix Into Phase 2

- DB table/schema/bucket renames.
- Supabase migration filename rewrites.
- API route renames.
- Env var renames.
- Package/repo/folder renames.
- Extension ID changes.
- SDK breaking changes.

Those belong to Phase 3 only if explicitly approved.
