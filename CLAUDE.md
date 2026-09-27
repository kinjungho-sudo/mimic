@AGENTS.md

# Parro development

- Start Claude Code from `D:\project\dev\parro`. The repository name and internal `mimic_*` paths are compatibility identifiers; the product name is Parro.
- The web app is `mimic_app` (Next.js), the Chrome extension is `mimic_recorder`, and the Desktop companion is `mimic_desktop`. `parro-edu` is a separate repository.
- Before Recorder development, packaging, or browser reload, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-parro-workspace.ps1` from the repository root.
- On Windows, use `npm.cmd` and `npx.cmd` in PowerShell. Run web checks from `mimic_app`: `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build` as appropriate. The build requires its existing environment and Desktop installer artifact; report missing prerequisites rather than bypassing the check.
- Follow `mimic_app/docs/DEV_PROCESS.md` for feature branches, verification, and deployment. A push to `dev` can trigger Preview; a push to `main` can trigger Production. State the exact branch, target, and alias impact before any push or deployment. Do not merge to `main` without the user's explicit request.
- Keep local checks, an installed Recorder test, Preview, and Production as distinct verification results. Check the actual installed extension and matching web origin for Recorder release claims.
- Preserve existing worktrees and local changes. Do not copy secrets from `.env*` into instructions, logs, commits, or MCP settings.
- Read `docs/development/claude-code-handoff.md` for the migration snapshot and open verification items. Recheck branch, remote, deployed aliases, and installed versions before relying on that snapshot.
