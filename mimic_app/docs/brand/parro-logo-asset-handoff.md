# Parro Logo Asset Handoff

## Status

Approved and applied on `2026-07-11` in `brand/parro-system`.

The selected Wing Pointer direction was rebuilt as original vector geometry. The production files do not embed or trace the source screenshot.

## Approved source assets

- `public/brand/parro-logo.svg`: horizontal Wing Pointer plus Parro wordmark.
- `public/brand/parro-mark.svg`: standalone Wing Pointer mark.
- `public/brand/parro-mark.png`: email/metadata-compatible PNG generated from the approved mark SVG.

The mark uses Parro teal, lime, and deep navy and combines an abstract wing, click ring, and screen pointer.

## Mascot vs production logo

Parro mascot/raster exploration can be used as product-avatar or marketing reference, but it is not a production logo source.

- Mascot direction: friendly AI parrot avatar for in-product help moments.
- Main logo direction: Wing Pointer, an abstract parrot wing plus screen pointer.
- Do not derive app icons, favicon, or `public/logo.svg` from mascot screenshots.

## Applied files

- `public/brand/parro-logo.svg`
- `public/brand/parro-mark.svg`
- `public/brand/parro-mark.png`
- `public/logo.svg`
- `app/icon.svg`
- `public/favicon.svg`
- `public/icons/icon16.png`
- `public/icons/icon48.png`
- `public/icons/icon128.png`
- `public/mimic-logo.png`: retained as a compatibility filename, with its contents replaced by the Parro mark.
- `components/common/BrandMark.tsx`: updated to use the same Wing Pointer geometry.

## Asset path decision

- `BRAND_LOGO_IMAGE_PATH` now points to `/brand/parro-mark.png`.
- `/mimic-logo.png` remains available as a compatibility fallback so cached email or metadata references do not break.
- No package, route, database, environment, deployment, or extension identifier changed in this asset batch.

## Safe replacement rules

- Do not rename package names, routes, DB objects, env vars, deployment IDs, or extension IDs during asset replacement.
- Generate PNG icons from `public/brand/parro-mark.svg` so SVG and bitmap assets stay aligned.
- Run asset search, lint, build, and visual smoke checks after replacement.

## Verification result

- SVG and generated PNG previews rendered correctly, including the 48 px icon.
- `npm run lint` and `$env:NODE_OPTIONS='--use-system-ca'; npm run build` passed with only the existing unrelated warnings.
- Focused search found no old purple mark colors or `M`/temporary `P` glyph marks in active logo assets.
- Full in-app visual smoke was attempted at `http://localhost:3017/landingpage`, but this worktree has no `.env.development.local`, so middleware stopped on missing Supabase URL/key. No environment values were created, copied, or changed.

## Verification commands

```bash
rg -n "MIMIC|Mimic|mimic|미믹" app components lib public docs --glob "!node_modules" --glob "!.next" --glob "!.git"
rg -n "#3730a3|#6d28d9|#4f46e5|#7c3aed|>M<" app components lib public --glob "!node_modules" --glob "!.next" --glob "!.git"
npm run lint
$env:NODE_OPTIONS='--use-system-ca'; npm run build
```
