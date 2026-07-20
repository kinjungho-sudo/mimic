# Parro B2C/B2B Pricing Boundary Principles v0.1

Updated: 2026-07-20
Owner: CoMind Works / Parro
Audience: MAX, Codex, product/design agents, future implementation work
Status: Strategy baseline — do not treat as final pricing table without owner approval.

## Why this document exists

Parro may experiment with a B2C viral surface while preserving B2B revenue potential.

The risk is clear: if B2C free features allow companies or teams to run real business workflows for free, Parro will train the market not to pay. This document defines the product and pricing boundary so future development does not accidentally undermine B2B monetization.

## North-star principle

```text
Free is for public discovery and viral sharing.
Paid is for controlled work operations.
```

Plain Korean version:

```text
누구나 공개로 공유할 수는 있다.
하지만 팀이 통제하고 운영하려면 돈을 낸다.
```

## Product positioning implication

B2C Parro should not be positioned as “manual creation software.” Most consumers do not wake up wanting to create manuals.

B2C Parro should be positioned as:

```text
A way to make a digital path followable by others.
```

Possible Korean framing:

```text
한 번 간 길은 모두가 따라갈 수 있게.
```

This supports consumer sharing without giving away the operational controls that businesses need.

## Strategic model

```text
B2C = acquisition, viral loops, public examples, search demand, use-case discovery
B2B = monetization, control, security, analytics, team/customer operations
```

B2C should feed B2B. It should not replace B2B.

A healthy funnel:

```text
Individual creates a public guide
→ People follow and share it
→ A team starts using similar guides repeatedly
→ The team needs privacy, permissions, branding, analytics, and governance
→ Team/Business conversion
```

## Boundary 1: public vs controlled access

This is the most important boundary.

### Free can include

- Public guides
- Public share links
- Basic follow/read experience
- Searchable/discoverable guide pages
- Parro watermark/branding
- Basic creator profile
- Limited AI rewrite/refinement
- Limited draft/private capacity for personal experimentation

Why: public content becomes distribution for Parro.

### Paid should include

- Private links beyond a small personal limit
- Password-protected guides
- Email/domain-restricted access
- Team-only sharing
- Customer-only sharing
- Expiring links
- Download/export controls
- Access logs
- Viewer identity and completion records

Why: controlled access is work operation, not consumer virality.

### Rule

```text
Public sharing trends free.
Controlled sharing trends paid.
```

## Boundary 2: individual vs team

### Free individual account

Purpose: let individuals try Parro and spread public guides.

Possible capabilities:

- Create public guides
- Share public links
- Follow public guides
- Maintain a personal creator profile
- Use basic AI text cleanup within limits
- Keep a small number of private drafts
- Parro branding/watermark remains visible

### Pro individual account

Purpose: support creator, consultant, educator, or power-user productivity.

Possible capabilities:

- More guide creation volume
- Higher AI rewrite limits
- Personal branding
- Reduced/removed watermark for individual creator use
- Templates
- Duplicate/copy guides
- Basic personal analytics

### Team account

Purpose: support internal team operations.

Capabilities that should be paid:

- Team workspace
- Member invitations
- Roles and permissions
- Shared folders
- Collaborative editing
- Team templates
- Private/team-only guides
- Brand controls
- Basic analytics

### Business account

Purpose: support customer education, security, compliance, and larger-scale operations.

Capabilities that should be paid at Business or Enterprise level:

- SSO
- Audit logs
- Domain-restricted access
- Customer-specific share portals
- Advanced analytics
- Completion reports
- White-labeling
- API/integrations
- Admin policies
- Data retention controls

### Rule

```text
Personal creation trends free/pro.
Team governance trends paid.
```

## Boundary 3: following vs operating

The viewer/follower experience should stay low-friction, especially for public guides.

### Free can include

- Open a public guide link
- Follow step-by-step instructions
- Check progress locally/session-level
- Share the public guide onward

### Paid should include

- Know who viewed a guide
- Know who completed each step
- Team/customer completion tracking
- Drop-off analytics
- Training reports
- Exportable learning/compliance records
- Update notifications to controlled audiences

### Rule

```text
Following a public path trends free.
Managing people through that path trends paid.
```

## Boundary 4: brand and trust controls

Brand controls are a business value lever.

### Free

- Parro branding visible
- Public guide attribution visible
- No company-level brand kit

### Pro

- Personal creator branding
- Optional lighter Parro branding

### Team/Business

- Company logo
- Custom guide theme
- Branded share pages
- White-label or near-white-label options
- Custom domains only at higher paid levels

### Rule

```text
Parro-branded public sharing can be free.
Organization-branded distribution should be paid.
```

## Boundary 5: volume and storage

Do not make unlimited private/business-grade usage free.

### Free limits should bias toward public sharing

Good free limits:

- Public guide creation: relatively generous at first
- Private draft count: low
- AI rewrite quota: limited
- Storage: limited
- Exports: limited or watermarked

### Paid limits should expand operational usage

Paid expansions:

- More private guides
- More storage
- More AI operations
- More exports
- More collaborators/viewers
- Better retention/history

### Rule

```text
Be generous where Parro gains distribution.
Be restrictive where users gain private operational value.
```

## Anti-abuse posture

Avoid hostile anti-user blocking early. Instead, make business misuse naturally inconvenient on free accounts.

Free accounts should not be convenient for real company operations because they lack:

- Workspace membership
- Permissions
- Private sharing at scale
- Brand control
- Viewer/completion analytics
- Access logs
- Update management
- Admin visibility

The goal is not to punish free users. The goal is to ensure businesses need paid functionality to operate responsibly.

## Decision questions for future features

When Codex, MAX, or another agent implements a feature, classify it with these questions before deciding plan placement.

### Question 1: Does this spread Parro publicly?

If yes, it can be Free.

Examples:

- Public guide links
- Public guide gallery
- Basic follow mode
- Social sharing
- Parro-branded public pages

### Question 2: Does this improve individual creator productivity?

If yes, it likely belongs in Pro.

Examples:

- Higher AI rewrite quota
- Personal templates
- Copy/duplicate guide
- Personal branding
- Watermark reduction

### Question 3: Does this let a team govern work?

If yes, it belongs in Team or higher.

Examples:

- Workspace
- Member invite
- Role permissions
- Team folders
- Shared editing
- Team-only access

### Question 4: Does this support security, customer education, compliance, or scale?

If yes, it belongs in Business/Enterprise.

Examples:

- SSO
- Audit logs
- Domain restriction
- Customer completion reports
- White-labeling
- API integrations
- Data retention policies

## Initial B2C experiment constraints

The first B2C experiment should stay small and avoid pricing overbuild.

Recommended initial scope:

- Public guide page
- Public share link
- Followable step experience
- Curated guide list or “Parro Picks”
- AI-tools category as the first target market
- A small set of seed guides

Avoid in the first experiment unless separately approved:

- Full community platform
- Complex recommendation algorithm
- Creator monetization
- Marketplace payouts
- Enterprise pricing UI
- Production-wide pricing migration
- Large permission-system rewrite

## Recommended first target

Initial B2C experiment target:

```text
AI tool beginners who want to use AI tools for work and content creation.
```

Example guide topics:

- Create a blog draft with ChatGPT
- Make an Instagram card image with Canva
- Build a presentation draft with Gamma
- Research a topic with Perplexity
- Summarize a long document with Claude
- Create a simple content calendar in Notion

Why this target first:

- Demand already exists
- Guides are easy to seed
- Sharing behavior is plausible
- Tool UIs change often, so fresh guides matter
- Parro’s screen-step format is easy to understand here

## Success metrics for B2C experiment

Do not judge early B2C by revenue first.

Primary learning metrics:

- Public guide link open rate
- Step completion rate
- Re-share rate
- “I can follow this” qualitative feedback
- Creator creates a second guide
- A guide gets reused by a team or repeated audience

Business signal metrics:

- Requests for private sharing
- Requests for team workspace
- Requests for branding removal
- Requests for analytics/completion tracking
- Requests for customer-facing controlled guide delivery

These business signals indicate B2B conversion potential.

## Non-negotiables for implementation

- Do not make private/team/business functionality unlimited free by accident.
- Do not hide the B2B value behind vague “later pricing” assumptions.
- Do not position Free as “everything you need for a team.”
- Do not build a full community before proving public guide followability.
- Do not weaken Parro manual content quality: B2C users will abandon awkward copy faster than B2B users.
- Do not merge to `main`, deploy Production, change DB/auth/storage, or modify billing/plan enforcement without explicit owner approval.

## Short reference for agents

```text
Free = public sharing and viral discovery.
Pro = individual creator productivity.
Team = organization operation and control.
Business = security, customer education, analytics, and scale.

If a feature helps Parro spread publicly, consider Free.
If it helps one creator produce more, consider Pro.
If it helps a team manage people/content/access, it is paid.
If it helps security/compliance/customer education at scale, it is Business/Enterprise.
```
