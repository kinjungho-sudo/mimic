# Hackathon Parro EDU landing rollback

This change is a temporary landing-page replacement for the hackathon period.
It must not replace Parro authentication, workspaces, Recorder, editor, or any
other product routes.

## Preserved production baseline

- Repository: `kinjungho-sudo/mimic`
- Production branch baseline: `origin/main`
- Baseline commit: `ded8b0f275b0b1c885673f3df84a9524c4b825cf`
- Captured on: 2026-08-12 (Asia/Seoul)

The baseline commit contains the original Parro landing page and is the clean
rollback target.

## Temporary change boundary

- Replace only `/landingpage` presentation and metadata with Parro EDU copy.
- Keep login and primary conversion actions on the existing Parro auth routes.
- Keep the instructor and learner preview links pointed at the temporary EDU
  demonstration deployment until those preview routes are part of Parro.
- Do not deploy this branch until the user explicitly requests deployment.

## Rollback

Revert the temporary landing commit, or deploy the preserved baseline commit
above. Then verify `/landingpage`, `/auth/login`, and an existing workspace URL
on the deployed Parro domain.
