# Parro Phase 2 Owner Decisions

Phase 1 public rebrand work has moved visible product copy, colors, Recorder display names, SDK Parro aliases, and MCP public descriptions toward Parro while preserving risky internal identifiers.

Phase 2 should not start until the owner explicitly approves each operational decision below.

## Decision 1: Final Logo Source

Status: blocked on final production SVG.

Owner must provide a production-ready Wing Pointer SVG, not a screenshot or mascot raster.

Target files after approval:

- `public/brand/parro-logo.svg`
- `public/brand/parro-mark.svg`
- `public/logo.svg`
- `app/icon.svg`
- `public/favicon.svg`
- `public/icons/icon16.png`
- `public/icons/icon48.png`
- `public/icons/icon128.png`

Open decision:

- Keep `/mimic-logo.png` as a compatibility filename and replace its contents, or introduce `/brand/parro-logo.svg`/`/parro-logo.png` as the primary public path and keep `/mimic-logo.png` as a fallback.

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

- Vercel CLI is currently not installed in this environment. Install with `npm i -g vercel` before using `vercel env pull`, `vercel deploy`, or `vercel logs`.

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

1. Approve final logo SVG and asset filename policy.
2. Install Vercel CLI and inspect current linked project/env state.
3. Decide final Parro domain and support email.
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
