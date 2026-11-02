---
name: rust-cli-style
description: "Apply self-contained attended Rust/CLI rules before writing or review in attended-app repos: rustdoc, closed errors, tri-state exits, explicit caps, Ratchet, and Ousterhout guidance."
---
# Skill: rust-cli-style
Apply the embedded common and attended-CLI rules on load, before Rust writing or
review in a matching attended-app repository. No follow-up source reads are
needed for runtime use. The embedded profile is not permission to disregard
repository-specific contracts.

The documents in `/Users/anders.jensen/code/sf-sdlc/docs/` remain the authoring
SSOT: update those documents first, then refresh the marked sections together
in all affected skills. Embedded link paths are relative to that docs directory,
not this skill directory.

<!-- BEGIN INLINE: rust-style.md -->
# Rust Style — Common House Rules (SSOT)

Single source of truth for the fleet's shared Rust house rules. Adopted by every
coding profile: `rust-cli-style` (attended-app), `rust-tokio-style` and
`alox-style` (the two service-unattended lenses). The profiles hold what they
distinguish; this file holds what they share. Target classes are unchanged: the
two checker classes (`attended-app`, `service-unattended`) and the three
documentation profiles remain separate.

**Provenance (grounded recovery, not live authority).** The original house rules
below were recovered from the
archived pre-slim global `references/shared-opencode/AGENTS.md.ref` sections
House style — Rust comments (:428-464), House style — Rust control flow
(:465-513), Rustling — selective TigerStyle adaptation (:515-528),
Construction-path review inventory (:530-551), and Rust/Tokio resource contracts
(:563-632). Same rules are cited by `templates/AGENTS.attended.md`,
`templates/AGENTS.unattended.md`, `AGENTS.md`, and the `rust-design-evidence`,
`code-review`, and `linus` guidance. The live `~/.config/opencode/AGENTS.md`
no longer hosts these sections; this file re-homes the backed rules. Do not
blindly restore drift — recovery claims require a backing citation above. The
Ousterhout section is a separate, user-authorized addition, not recovered text.

## Rust comments (house)
No plain comments in `*.rs`: no `//`, no `/* … */`, and no exceptions (`SAFETY`,
`TODO`, `#[allow]` justification, commented-out code). Doc comments (`///`,
`//!`) exist only where documentation is part of the code contract: `pub` API
surfaces (`# Errors`/`# Panics`/`# Safety` where the signature warrants),
`unsafe fn`/`unsafe trait` (mandatory `# Safety`), and in-scope doctests. A doc
comment is not a rationale host; durable rationale lives in ADRs, commit
messages, or beads. Code that needs a why-comment is wrong: restructure.

## Control flow (house)
One decision must not be split between leading `if … { return … }` guards and a
`match` deciding the rest. Fix the type first (make illegal states
unrepresentable — sentinel `""`/`0`/magic default) so the guards have nothing
to reject; the single match then falls out. This is **not** "always
exhaustive": guards, `?`, `let else`, `continue` guards in loops, early-return
short-circuits, and guards establishing scrutinee validity are exempt. No
clippy lint or CI gate; review surfaces it as `guard-then-match-split`.

## Construction-path inventory
For each changed invariant-bearing type, name the invariant and caller boundary
(including module visibility) and distinguish untrusted DTOs from validated
values; inventory every construction route, recording valid and invalid
evidence (artefact `illegal-state-representable`): public fields/struct
literals, constructors/builders, `Default`, `From`/`TryFrom`, serde/custom
deserialization, and mutation routes (setters, mutable references, `DerefMut`). Mark absent routes explicitly; a safe primary constructor
does not excuse an unchecked alternate route; private fields constrain outside
callers, not the defining module. For each route cite how the invariant is
preserved or give a constructible counterexample. Record a valid boundary case,
an invalid-state witness, the enum/newtype/private-cx remedy when needed, and
an accept/reject verdict with a named compile-fail or runtime test —
distinguish read-level assessment from an executed test. Incomplete
route evidence is a review gap, not proof of safety. Do not invent artificial
restrictions: independent booleans stay booleans, genuine optionality stays
`Option`, and a boundary returning `None`/`Err` is valid.

## Closed error enums
Public error enums MUST NOT carry `#[non_exhaustive]` (C4.5/C4.6): variant sets
are complete within a major semver line, so unhandled states are unrepresentable
at compile time. The canonical checker is `non-exhaustive-check` from the
`tripwires` repo (derived-`Error` syntax); enforcement/integration is
repository-owned: sf-sdlc uses its own conservative lexical gate, not that
binary ([`../AGENTS.md`](../AGENTS.md) § Closed Error Enum Policy).

## TigerStyle / TigerBeetle provenance
Selective adaptation, never a blanket import. Sources: TigerStyle (2024)
`https://tigerstyle.dev/` and TigerBeetle "A database without dynamic memory"
(2022-10-12) `https://tigerbeetle.com/blog/2022-10-12-a-database-without-dynamic-memory/`,
assessed in `docs/aspect-quality-assessment.md:22-23` and in gh-report beads
`ghr-9e7f5`/`ghr-d4nk2` (2026-09-06). Adopted: explicit limits as scoped
budgets (items/bytes/tasks, deadlines, ownership), assertions at validated input
boundaries assessing both valid and invalid cases, illegal-state modelling, and
the construction-path inventory. Rejected as blanket imports: static-memory-only,
no-recursion, u32-preference, "zero dependencies", and new naming mandates.
Strict no-allocation applies only when a scoped phase explicitly requires it; a
finite run is evidence for that run, never a universal guarantee. Type
grounding lives in `rust-design-evidence` § Type Restructuring and § Evidence
Selection.

## Ousterhout — reduce complexity at module boundaries

Selective Rust adaptation of John Ousterhout's principles from the
user-supplied structural refactoring checklist (2026-11-02), not verbatim
quotations or a wholesale adoption of his coding style. Applies to all three
profiles; each profile gives concrete applications. Existing comment rules,
error distinctions, resource contracts, and repository-specific constraints
remain in force. This guidance adds no checker class, lint, or mandatory gate.

### Module boundaries: deep modules, not layers for their own sake
- Pull complexity downward: let a module handle specialized logic, internal
  configuration choices, and bookkeeping behind a small, useful interface.
  A deep module provides substantial capability with little caller knowledge;
  it need not be a large module. Do not hide caller obligations, resource
  costs, externally meaningful policy choices, or failure behavior.
- Merge shallow, tightly coupled components when one cohesive module reduces
  the concepts and coordination callers must understand. Do not combine
  unrelated responsibilities merely to reduce the number of types or files.
- Remove pass-through methods and layers that only repeat another interface;
  let callers communicate directly with the actual owning module. Preserve
  boundaries that enforce validation, authorization, ownership, supervision,
  or a genuine abstraction, even when their implementation is small.

### Information hiding: one owner for each design decision
- Consolidate shared knowledge of a format, representation, or configuration
  rule in the module/type that owns it. Parse and validate at its boundary;
  dependent modules consume meaningful operations or validated values instead
  of repeating the rule or accessing representation details directly.
- Hide internal data structures and changeable algorithms behind an abstract
  API. Share the abstraction, not mutable internals; do not build a global
  catch-all module or conceal information callers need for correctness.

### Interfaces and errors: fewer concepts, honest semantics
- Define avoidable errors out of existence through simpler semantics: an empty
  collection for a valid no-results query, or an already-completed operation
  treated as success when the contract is genuinely idempotent. Validate once
  and use types inward. Never turn malformed input, permission/I/O failures,
  resource exhaustion, or Unknown into empty success; preserve meaningful
  `Option`, `Result`, and closed error distinctions. Changes to observable
  semantics require the normal contract approval, not just a refactoring label.
- Prefer somewhat general-purpose operations that cover related current uses
  without exposing implementation details. Generality should simplify today's
  callers, not introduce speculative extension points, flag combinations, or
  frameworks for hypothetical future requirements.
- Bundle repeatedly co-travelling parameters into a cohesive, named request,
  configuration, or context type. Keep invariants at its construction boundary;
  do not replace explicit inputs with an opaque parameter bag, unrelated
  dependencies, or fabricated relationships between independent values.

### Before and during structural refactoring
- Establish passing automated tests for the affected observable behavior before
  restructuring; add missing characterization/regression coverage first. Prefer
  contract-level assertions that survive changes to private structure, with
  focused unit tests where useful. Keep behavior changes separate and follow
  the existing TDD and tier-scoped verification cadence.
- Before a major rewrite, sketch at least two materially different designs and
  compare caller knowledge, information leakage, failure paths, ownership, and
  profile-specific resource costs. Record the choice and rationale in the
  appropriate ADR or bead, not plain Rust comments; no diagram tool is required.
- Reserve roughly 10–20% of task effort for design improvement and nearby
  cleanup while planning the task. This is an investment guideline, not a
  measured compliance quota or authority to expand scope. Keep cleanup relevant,
  small, reversible, and separate from behavioral changes; defer larger work to
  a bead rather than silently growing the task.

Profile applications: [attended CLI](rust-cli-style.md#ousterhout--cli-application),
[Tokio](rust-tokio-style.md#ousterhout--tokio-application),
[Alox](alox-style.md#ousterhout--alox-application).
<!-- END INLINE: rust-style.md -->

<!-- BEGIN INLINE: rust-cli-style.md -->
# Rust Style — Attended CLI (Attended-Application)

Documentation lens for the `attended-app` target class
(`templates/AGENTS.attended.md`). Adopts the common rules in `rust-style.md`;
this file adds only what distinguishes attended CLIs and developer tools.

## Doc contract
Rustdoc is the API surface for `pub` items; `# Errors`/`# Panics`/`# Safety`
sections are mandatory where the signature warrants. Rustdoc budget gate:
`comment-free --check-doc-budget` (120 words enforced, 80 advisory, per
`AGENTS.md` Rustdoc Budget Gate). No plain comments (see `rust-style.md`).

## Closed errors & exit taxonomy
- Closed error enums, no `#[non_exhaustive]` (C4.5/C4.6).
- Fixed tri-state exit codes: `0` clean pass; `1` domain defect/violation;
  `2` unknown / environmental / missing permission / indeterminate.
- Stream separation: structured machine-readable findings (TSV, JSON Lines) to
  `stdout`; operational telemetry, diagnostics, and error traces to `stderr`.
- Distinguish **user errors** (domain, exit 1: invalid input, violated
  constraint, recoverable by the caller) from **bugs and environment failures**
  (exit 2: internal invariant breach, missing permission, indeterminacy).
  Model that distinction in the error enum; do not collapse user errors into
  internal states or vice versa.

## Resource caps & no invented constraints
Resource caps are explicit where the tool's contract requires them (bounded
input sizes, bounded work per invocation). Do not invent caps absent a stated
contract. Independent booleans, genuine `Option`, and fallible boundaries stay
as they are (`rust-style.md`).

## Guards, tripwires, Ratchet
New custom lints/tripwires follow the four-step guard proof: plant → fail →
revert → clean, pinned by a committed regression harness. Style documentation is
documentation, not a control: per the Ratchet Doctrine new checker controls are
`OptIn` first (`AGENTS.md:70-71`).

## Ousterhout — CLI application
Applies the [common complexity-reduction guidance](rust-style.md#ousterhout--reduce-complexity-at-module-boundaries)
to attended tools without changing their public contracts.

- Resolve argument syntax, configuration precedence, and defaults at the input
  boundary into a validated request. Let domain modules own format rules and
  processing, rather than making every caller repeat parsing or validation.
  Keep diagnostic formatting and exit-code mapping at the CLI boundary.
- Prefer a direct call from the command handler to a cohesive domain operation
  over chains of forwarding handlers. Keep adapters that genuinely translate
  inputs, enforce policy, or maintain the stdout/stderr contract; do not leak
  parser-library types into otherwise independent domain APIs.
- Group related invocation options into a named request when they repeatedly
  travel together. Prefer operations useful to related current commands, not
  a generic command framework or speculative options. Add no unstated caps.
- An empty successful search may return no findings when that is the declared
  contract; unreadable input, invalid configuration, or incomplete inspection
  must retain their documented domain/Unknown distinction and exit code.
- Before restructuring, test observable output, exit statuses, diagnostics,
  empty input/results, and relevant invalid-input cases. Preserve machine
  schemas and CLI compatibility; a cleaner API does not authorize changing them.
<!-- END INLINE: rust-cli-style.md -->
