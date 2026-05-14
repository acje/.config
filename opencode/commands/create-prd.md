---
description: Generate a 15-section Product Requirements Document from a feature description. Output to .ooda/PRDs/<slug>.prd.md.
---

# /create-prd — Product Requirements Document generator

Generate a structured PRD from a feature description. Output lands in `.ooda/PRDs/` (gitignored scratch space).

## Usage

```
/create-prd <feature description>
```

## Preflight

1. Confirm the feature description is non-empty. If absent, ask for it (max 1 question).
2. Derive a `<slug>` from the feature name (lowercase, hyphens, no spaces): e.g. `user-auth-refresh`.
3. Ensure `.ooda/PRDs/` exists: `mkdir -p .ooda/PRDs`.

## Output

Write to: `.ooda/PRDs/<slug>.prd.md`

## PRD template (15 sections)

```markdown
# PRD: <Feature Name>

**Status**: Draft
**Author**: <inferred from git config user.name or "unknown">
**Date**: <today's date>
**Slug**: <slug>

---

## 1. Problem Statement

<What problem does this solve? Who is affected? What is the current pain?>

## 2. Goals

<What outcomes does success look like? Measurable where possible.>

## 3. Non-Goals

<What is explicitly out of scope for this iteration?>

## 4. Background & Context

<Prior art, related work, decisions already made, constraints inherited.>

## 5. User Stories

<Format: "As a <role>, I want <capability> so that <benefit>.">

- As a …, I want …, so that …
- As a …, I want …, so that …

## 6. Functional Requirements

<Numbered list of behaviours the system must exhibit.>

1. The system shall …
2. …

## 7. Non-Functional Requirements

<Performance, reliability, security, scalability, accessibility thresholds.>

## 8. Technical Approach (sketch)

<High-level implementation direction. Not a design doc — enough to scope.>

## 9. Data Model Changes

<New entities, schema changes, migration considerations. "None" if not applicable.>

## 10. API / Interface Changes

<New endpoints, changed signatures, deprecations. "None" if not applicable.>

## 11. Dependencies

<External services, libraries, other teams, infrastructure changes required.>

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| …    | …         | …      | …          |

## 13. Success Metrics

<How will we know the feature is working? Quantitative where possible.>

## 14. Open Questions

<Unresolved decisions that must be answered before implementation begins.>

- [ ] …

## 15. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1     | <today> | <author> | Initial draft |
```

## Discipline

- Fill every section. Use "N/A" or "None" for sections that genuinely don't apply — never skip silently.
- Cite evidence: if you read existing code or docs to fill a section, note the source (`file:line`).
- Do not add external issue-tracker links, sprint references, or external service hooks — this is a local document.
- Output path is always `.ooda/PRDs/<slug>.prd.md`. Do not write elsewhere.
- After writing, report: `PRD written: .ooda/PRDs/<slug>.prd.md` (one line).
