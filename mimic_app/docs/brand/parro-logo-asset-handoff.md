# Parro Logo Asset Handoff

## Status

The public UI copy and app color palette have been migrated to Parro, but production logo/icon assets are intentionally not replaced yet.

Reason: the rebrand plan requires a production-ready Wing Pointer SVG source before replacing app icons/logos. Screenshot-derived assets should not be used for production.

## Required source asset

Owner must provide final vector source:

- `parro-wing-pointer.svg` or equivalent final SVG
- Includes the abstract parrot wing + screen pointer mark
- Uses final Parro colors or clearly exposes editable fills
- Not a screenshot, PNG trace, Telegram image, or AI raster export

## Target files to create or replace

- `public/brand/parro-logo.svg`
- `public/brand/parro-mark.svg`
- `public/logo.svg`
- `app/icon.svg`
- `public/favicon.svg` if the app should use an explicit SVG favicon
- `public/icons/icon16.png`
- `public/icons/icon48.png`
- `public/icons/icon128.png`
- `public/mimic-logo.png` only after deciding whether to keep the compatibility filename or add a new `parro-logo.png` path

## Current legacy asset evidence

- `public/logo.svg` is still the old circular `M` mark.
- `app/icon.svg` is still the old circular `M` mark.
- `public/mimic-logo.png` still uses the legacy filename and should be replaced or deprecated only after final asset approval.
- `public/favicon.svg` does not currently exist.

## Safe replacement rules

- Do not rename package names, routes, DB objects, env vars, deployment IDs, or extension IDs during asset replacement.
- Keep `BRAND_LOGO_IMAGE_PATH` unchanged until the owner decides whether the filename should remain `/mimic-logo.png` for compatibility.
- If creating PNG icons, generate them from the approved SVG source.
- Run asset search, lint, build, and visual smoke checks after replacement.

## Verification commands

```bash
rg -n "MIMIC|Mimic|mimic|미믹" app components lib public docs --glob "!node_modules" --glob "!.next" --glob "!.git"
rg -n "#3730a3|#6d28d9|#4f46e5|#7c3aed|>M<" app components lib public --glob "!node_modules" --glob "!.next" --glob "!.git"
npm run lint
$env:NODE_OPTIONS='--use-system-ca'; npm run build
```
