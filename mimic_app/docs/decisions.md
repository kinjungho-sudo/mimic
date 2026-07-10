# Decisions

## 2026-07-10 - Public brand rename from MIMIC to Parro

### Decision

The public-facing product brand changes from **MIMIC / &#48120;&#48121;** to **Parro / &#54056;&#47196;**.

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
