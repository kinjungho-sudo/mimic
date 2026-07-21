# Parro

Parro is a B2B AI Live Guide for hands-on software training.

It helps instructors and teams turn real workflows into step-by-step guides that learners can follow directly on screen.

## Brand Status

The public product brand is **Parro / 패로**.

This repository is in a staged public rebrand from the former MIMIC brand. Internal identifiers are intentionally preserved where changing them could break data, auth, deployments, extensions, SDK compatibility, or integrations.

Preserved internal identifiers include:

- package names such as `mimic-app`
- database table names and migrations
- environment variable names
- API route names
- SDK globals and compatibility classes
- extension IDs and store slugs
- deployment identifiers

See `docs/brand/parro-rebrand-qa.md` for the current migration status.

## Local Development

Install dependencies and run the app:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

On Windows systems that block the PowerShell `npm.ps1` shim, use `npm.cmd`
for the same commands (for example, `npm.cmd run dev`).

## Verification

Common checks:

```bash
npm test
npm run lint
$env:NODE_OPTIONS='--use-system-ca'; npm run build
git diff --check
```

## Rebrand Guardrails

Do not perform broad search-and-replace for `mimic` or `MIMIC`.

Before changing old-brand references, classify each one as:

- public-facing brand surface
- internal compatibility identifier
- historical documentation
- owner decision needed

Production logo/icon assets are blocked until a final production-ready Wing Pointer SVG is provided. See `docs/brand/parro-logo-asset-handoff.md`.
