---
name: alox-style
description: "Apply self-contained Alox Rust rules before writing or review in no-async service repos: repo-owned dependency contracts, preallocation, scoped budgets, and Ousterhout guidance."
---
# Skill: alox-style
Apply the embedded common and Alox rules on load, before Rust writing or review
in a matching no-async service repository. No follow-up source reads are needed
for runtime use. The embedded profile is not permission to disregard
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

<!-- BEGIN INLINE: alox-style.md -->
# Rust Style — Alox (Service-Unattended / No-Async)

Documentation lens for the `service-unattended` target class under
`unattended-no-async` (`templates/AGENTS.unattended.md:86-95`). "alox" is the
user-granted fleet name for the no-Tokio Rust style realised in `alumina-proxy`
and `corundum`. Adopts the common rules in `rust-style.md`; the items below are
**repo-owned contracts**, not a fleet ban — the Tokio and attended-CLI profiles
legitimately use async runtimes, `thiserror`, and `clap`.

## No async runtime — repo-owned and gate-enforced
- `corundum/AGENTS.md:31-40`: no async runtime; no thiserror/anyhow/clap; custom
  error enums with sysexits exit codes. Enforced by the `FORBIDDEN_DEPS` gate in
  `corundum/scripts/verify.sh` across every tracked Cargo.toml, plus the loader
  listener-bind rule and loader-never-runs-as-root.
- `alumina-proxy/docs/alumina-proxy.md` §Architecture: single worker loop on
  `mio`/epoll, no `async`/`await`, no runtime surface beyond the CONNECT listener.
- Do NOT universalize corundum's loader gates (listener-bind, non-root identity)
  to other repos; they are corundum-specific.

## Explicit owner, state, work, budgets
Single owner of tunnel/DNS state; cooperative, bounded work between shutdown
checks. Alumina-only exemplars, not Corundum/fleet defaults: fair round-robin
with at most 64 KiB or 16 I/O operations per connection visit, whichever comes
first; recheck timers after at most 256 ready-slot visits or I/O operations
([`../../alumina-proxy/docs/alumina-proxy.md`](../../alumina-proxy/docs/alumina-proxy.md) §Architecture:191,:185+).
State transitions and ownership are explicit application responsibilities.

## Preallocation & the scoped Zero-Allocation Invariant
Preallocate where the spec requires: boot-time storage, statically fixed
connection/buffer limits, one preallocated cache entry per configured
name/type. The Zero-Allocation Invariant is **scoped, not universal**
(`alumina-proxy/docs/alumina-proxy.md` §Zero-Allocation Invariant: first-party
scope, rustls bounded seam, :627):
- Binding scope = first-party serving/DNS-refresh paths: no post-boot heap
  alloc/dealloc; boot initialization exempt; shutdown exits without
  deallocating.
- Dependency allocations are a bounded seam outside first-party scope (pinned
  rustls, bounded per-record ~≤16-18 KiB on the warm DoT path).
- The per-connect DoT setup seam (`build_tls_connection`) is the single
  authorized first-party allocation point (rustls `Arc`s, SNI `String`, `Box`ed
  `ClientConnection`).
- "No post-boot first-party alloc/dealloc" is not a claim of constant total
  memory use or immunity to resource exhaustion (`AGENTS.md:30-37`).
- Alumina TLS setup and dependency allocations are scoped exceptions, never a
  universal zero-allocation contract.

## Ousterhout — Alox application
Applies the [common complexity-reduction guidance](rust-style.md#ousterhout--reduce-complexity-at-module-boundaries)
within the repository's no-async and scoped allocation contracts.

- Put connection/DNS state transitions, buffer layout, and bookkeeping behind
  the owning module's operations. Keep the event loop's work allowance, progress,
  timer obligations, and shutdown checks explicit; a deep module must not hide
  an unbounded drain loop or monopolize execution.
- Consolidate format/configuration rules at their owner; where boot-time
  validation and preallocation are required, produce a validated runtime plan
  there rather than repeating decisions in the serving path. Bundle related
  state/limits without adding a heap-allocated context or copying large buffers.
- Remove forwarding wrappers or merge shallow state helpers only when ownership,
  bounded work, and existing security boundaries remain intact. General-purpose
  operations must fit current needs without adding a runtime, growing storage,
  or introducing allocation outside the repository's authorized seams.
- Represent normal readiness/no-progress outcomes explicitly when the protocol
  allows them, rather than inventing exceptional failures. Do not confuse them
  with EOF, protocol/TLS failures, or capacity rejection, and never retry by
  silently enlarging a fixed pool or relaxing validation.
- Before restructuring, test state transitions, capacity boundaries, fairness,
  timers, and shutdown as relevant to the changed contract. Compare alternative
  designs by caller complexity, ownership, per-visit work, and allocation seams;
  retain scoped allocation evidence where required, not a universal memory claim.

## Precedence
The repository spec/section clauses govern; the fixed profile never yields to a
feature. Limit exhaustion rejects work; it never enlarges storage or relaxes
validation.

An applicable deliberate governance amendment governs superseded baseline
wording ([`../../alumina-proxy/AGENTS.md`](../../alumina-proxy/AGENTS.md):51-55,:63-71).
<!-- END INLINE: alox-style.md -->
