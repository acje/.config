---
name: spec-driven-development
description: Writes a structured, human-approved specification before coding — the shared source of truth for what is being built, why, and how we know it is done. Use in the DEFINE phase when starting a new project, feature, or significant change with no spec yet; when requirements are unclear, ambiguous, or only a vague idea; or when one requirement spans several independently testable capabilities needing a capability map. Spec approval precede implementation; planning/implementation route to fleet plan-mode/moltke/hopper.
---

# Spec-Driven Development

## Overview

Write a structured specification before writing code. The spec is the shared source of truth between the author and the human — it defines what we're building, why, and how we'll know it's done. Code without a spec is guessing. This skill owns the DEFINE-phase clarification, content, and approval gates; it does not run plan/build (fleet plan-mode, moltke, hopper own those).

**Read-only mode.** Invoked in a read-only context (e.g. plan mode, or any context without write authority), this skill produces the spec inline in the reply or in a bd bead — it never writes to the working tree and never proceeds toward planning or implementation. Where the active mode authorizes file writes, the spec may be saved as a repository file.

## When to Use

- Starting a new project or feature
- Requirements are ambiguous or incomplete
- The change touches multiple files or modules
- You're about to make an architectural decision
- The task would take more than 30 minutes to implement

When NOT to use: single-line fixes, typo corrections, or changes where requirements are unambiguous and self-contained.

## The Gated Workflow

Spec-driven development has four phases, preceded by a scope check (Phase 0) that activates only when one request bundles several independently testable capabilities. Do not advance to the next phase until the current one is validated.

```
SPECIFY ──→ PLAN ──→ TASKS ──→ IMPLEMENT
   │          │        │          │
   ▼          ▼        ▼          ▼
 Fleet      plan-     moltke-    hopper-
 DEFINE     mode      contracted  executed
 gate       authors   packages    (TDD)
```

In the fleet, only the SPECIFY gate is this skill's approval checkpoint:
plan-mode authors the plan, moltke contracts mission packages, hopper executes
with Kent Beck TDD and verify-before-claim. This skill keeps the DEFINE gate
and the spec-as-living-document discipline authoritative; it does not assign
human review gates to PLAN/TASKS/IMPLEMENT.

### Phase 0: Scope Check

Most requests describe one capability. If this one does, skip this phase and go straight to Specify — Phase 0 exists for the exception, not the rule.

**Detection.** Decompose before specifying when a single requirement bundles several independently testable capabilities:

- The requirement names distinct capabilities with their own consumers or data
- Acceptance criteria cluster into groups that could ship and be verified separately
- One capability could be cut or replaced without rewriting the others' requirements

**Propose a capability map before writing any spec.** Small and reviewable — a module table plus a build order:

```markdown
# Capability Map: [Initiative Name]

| Module id | Responsibility | Depends on |
|---|---|---|
| identity | Accounts, sessions, SSO | — |
| billing | Plans, invoices, payments | identity |
| notifications | Email and webhook fan-out | identity |

Build order: identity → billing, notifications
```

- **Stable module ids.** Kebab-case, chosen once, never renamed mid-initiative.
- **Dependency direction, no cycles.** Arrows point one way; if two modules need each other, they are one module.
- **The map is gated like the DEFINE phase.** The owning role (the caller holding this skill's DEFINE gate) confirms module boundaries, dependency direction, and build order before any module spec is written. Ordering stays with the owning roles — never push the user to sequence tasks or re-order modules.

Then recurse per module: each module gets its own spec scoped to its objective, boundaries, and success criteria, named by module id (`SPEC-identity.md`). The map, not filename guessing, is the index of what exists.

### Phase 1: Specify

Start with a high-level vision. Clarify per the fleet autonomy risk gate: clarify only when a genuinely blocking requirement is at medium+ risk and the next observation will not resolve it, batched at a natural checkpoint; otherwise surface assumptions and proceed. Never use clarification to offload decomposition or ordering (owning roles own that). **Surface assumptions immediately** before writing spec content:

```
ASSUMPTIONS I'M MAKING:
1. …
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements — assumptions are the most dangerous form of misunderstanding.

**Write a spec document covering these six core areas:**

1. **Objective** — What are we building and why? Who is the user? What does success look like?
2. **Commands** — Full executable commands with flags, not just tool names. Use the repo's native commands (build/test/lint from the repo AGENTS.md tiers), not language-specific examples.
3. **Project Structure** — Where source, tests, and docs live.
4. **Code Style** — One real snippet beats three paragraphs; naming conventions, formatting rules, good outputs.
5. **Testing Strategy** — Framework/location, coverage expectations, which test levels for which concerns.
6. **Boundaries** — Always do / Ask first / Never do.

External spec tools (OpenSpec or similar): this workflow is format-agnostic. Keep the project's existing artifact format and storage conventions instead of duplicating a `SPEC.md`; the skill owns clarification, content, and approval gates — the external tool owns representation.

**Reframe instructions as success criteria.** Translate vague requirements into concrete, testable conditions:

```
REQUIREMENT: "Make the dashboard faster"
REFRAMED SUCCESS CRITERIA:
- Dashboard LCP < 2.5s on 4G connection
- Initial data load completes in < 500ms
→ Are these the right targets?
```

**Stop after writing the spec (CRITICAL).** Once the spec is saved:

1. Summarize it and list any Open Questions.
2. Hand it to the owning caller for the DEFINE approval checkpoint. In the fleet the approval checkpoint is caller-granted (plan-mode/moltke hold downstream authority), not a direct user ask — clarify with the end user only per the autonomy risk gate.
3. STOP YOUR TURN. Do NOT start planning or implementing in the same turn. Planning starts only after the spec is approved through the DEFINE checkpoint in a later turn (fleet: plan-mode/moltke/hopper execute the downstream phases).

### Phase 2: Plan

With the validated spec, generate a technical implementation plan:

1. Identify major components and their dependencies
2. Determine implementation order (what must be built first)
3. Note risks and mitigation strategies
4. Identify parallel vs sequential work
5. Define verification checkpoints between phases

In the fleet, route the plan to plan-mode / moltke (mission contract with verify tiers); durable task state lives in bd beads, not a markdown task store.

### Phase 3: Tasks

Break the plan into discrete, implementable tasks:

- Each task completable in a single focused session
- Each task has explicit acceptance criteria
- Each task includes a verification step (test, build, manual check)
- Tasks ordered by dependency, not perceived importance
- No task requires changing more than ~5 files

### Phase 4: Implement

Execute tasks one at a time using the fleet execution loop: moltke contracts hopper, which runs Kent Beck TDD (red → green → refactor) with tier-scoped verification. Load only the spec sections relevant to each step rather than flooding context with the whole spec.

## Keeping the Spec Alive

The spec is a living document, not a one-time artifact:

- **Update when decisions change** — change the spec first, then implement.
- **Update when scope changes** — additions/cuts are reflected in the spec.
- **Store the spec in version control** alongside the code where writes are authorized; in read-only mode, keep it inline or in a bd bead instead.
- **Reference the spec in change summaries** — link each change back to the spec section it implements.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is simple, I don't need a spec" | Simple tasks need short specs, but still need acceptance criteria. A two-line spec is fine. |
| "I'll write the spec after I code it" | That's documentation, not specification. The value is clarity *before* code. |
| "The spec will slow us down" | A 15-minute spec prevents hours of rework. |
| "Requirements will change anyway" | That's why the spec is a living document. |
| "The user knows what they want" | Even clear requests have implicit assumptions. The spec surfaces them. |
| "Splitting one big feature is overhead" | If acceptance criteria cluster independently, a monolithic spec forces every downstream task to reason over the whole contract. |
| "I'll decompose during planning" | By then the oversized artifact exists; module boundaries and dependency direction must be decided before the spec is written. |

## Red Flags

- Writing code with no written requirements
- Implementing features not in any spec or task list
- Making architectural decisions without documenting them
- Skipping the spec because "it's obvious what to build"
- Writing the spec and starting the plan or code in the same turn
- One spec whose requirements span several independently testable capabilities
- Module boundaries decided implicitly during implementation (no approved capability map)

## Verification

Before proceeding to implementation:

- [ ] The spec covers all six core areas
- [ ] The spec passed its DEFINE approval checkpoint (owning caller in the fleet; not a direct user ask unless the autonomy risk gate requires it)
- [ ] The turn ended after saving the spec; approval came in a later turn
- [ ] Success criteria are specific and testable
- [ ] Boundaries (Always / Ask First / Never) are defined
- [ ] The spec is saved to the mode-authorized location (repository file where writes are authorized; inline or bd bead in read-only mode)
- [ ] If one request bundles several independently testable capabilities, a capability map (module ids, dependency direction, build order) was approved before any module spec was written
- [ ] Every module spec traces to a module id in the approved map
