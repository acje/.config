---
name: rust-design-evidence
description: Rust-adjacent method home for type-restructuring grounding (make illegal states unrepresentable), claim-driven evidence selection, and lint suppression technique. Load before designing or reviewing a constrained Rust type, selecting evidence for a changed invariant/behaviour, or suppressing lints. Activity-scoped; authority and safety stay in role prompts and AGENTS doctrine.
---

# Rust Design & Evidence

One home for reusable Rust design and evidence-selection technique. Each
section is activity-scoped: load the section relevant to the current activity
and reload after a context reload or compaction. Techniques here are
**methods**, not authority — review triggers/dispositions, safety and role
obligations (hopper R15/R16, linus findings) remain in the role prompts and
AGENTS doctrine. The canonical construction-path review inventory lives in
global `AGENTS.md` § Rustling → Construction-path review inventory; this skill
references it and adds worked technique only — it never creates a competing
inventory owner.

## Type Restructuring

Applies when designing, refactoring or reviewing a constrained Rust type: make
illegal states unrepresentable by restructuring the *type*, not by bolting a
runtime predicate onto an existing one.

**Check.** *Can a caller construct an invalid value at all?* If yes, could an
`enum` (legal shapes only), a newtype with a validating constructor at the
boundary, or a "correct by construction" datatype (`NonEmptyVec<T>`,
`Natural`, a typed state machine) make the illegal state **unrepresentable**
rather than merely rejected after the fact?

Grounding (types-as-axioms, Alexis King / lexi-lambda, 2020-08-13, evidence
bead `config-54u`). Cite these ideas in the author's terms, not beyond them:
- A datatype declaration is an **axiom schema** — it *creates* a value space,
  it does not merely restrict a pre-existing one ("playing god with static
  types"). `enum Natural { Zero, Succ(Box<Natural>) }` has no representable
  negative.
- **Make illegal states unrepresentable** is not "bolt a predicate onto an
  existing type"; it is *restructure the type* so bad values cannot be built.
  `NonEmptyVec<T>`, not `Vec<T>` + a runtime `assert!(!v.is_empty())`.
- **Correct by construction** — shape the data so every legally-built value is
  automatically valid; push validation to the boundary where untrusted input
  first becomes a typed value, then trust the type inward (positive space, not
  negative space).

**Not sourced from that post — mark as Rust-idiom synthesis if you invoke it:**
"obligations discharged by the type system", total-vs-partial functions,
Curry-Howard/propositions-as-types framing. The post does not use that
vocabulary; do not attribute it there.

Problem shape:

```rust
struct Connection { connected: bool, socket: Option<TcpStream>, err: Option<Error> }
```

Preferred shape — illegal (`connected == true && socket == None`) is unrepresentable:

```rust
enum Connection {
    Disconnected,
    Connected(TcpStream),
    Failed(Error),
}
```

Encoding lives in the **types**, never in comments: an `enum` variant or
newtype *is* the documentation; do not encode an invariant in a `//` comment
or a non-mandatory doc comment. Independent booleans and genuine `Option`
remain valid; do not invent stronger domain constraints than the domain
requires. The construction-path review inventory (global AGENTS § Rustling)
is the mandatory inventory when assessing a changed constrained type.

## Claim-driven Evidence Selection

*(Referenced equivalently in loaders as "Evidence Selection" — same section.)*

Applies when selecting evidence for a changed invariant or behaviour. Name the
proposition, caller/module boundary and relevant build, then separate
construction exclusion from remaining computation, termination, effects and
unsafe obligations; an in-bounds index does not prove it selects the correct
element. Apply the high-assurance methods **purposefully at critical
serialization, concurrency, and storage boundaries** (high-risk seams), not
sprayed ubiquitously as box-ticking ceremony — where type invariants and
deterministic unit tests suffice, do not add compliance overhead.

Select evidence for the uncovered claim within AGENTS § Review tiers — not
every mechanism below for every diff. A clean run is evidence for that run,
not a universal proof.

| Claim / mechanism | Adequacy and limits to record in the existing report |
|---|---|
| Observable boundary or behavior / examples | Valid and invalid outcomes, edge cases and regressions; chosen examples do not cover an unbounded domain. |
| Broad input relation / property tests | Generator domain, explicit rare boundaries, oracle independence, shrinking and regression seeds; sampling and a shared buggy oracle do not prove the property. |
| State transitions / model tests | Reference-model assumptions, generated transition/sequence bounds and invariants after transitions; a sequential model is not concurrency evidence. |
| Interleavings / Loom or equivalent | Instrumented operations, mocks, schedule/preemption bounds and memory-model exclusions; hidden dependency operations and unmodeled executions remain uncovered. |
| Cross-component effects / integration | Exercise the real relevant boundary and failure path; mocks or constructor proofs alone do not establish delivery or external effects. |
| Prohibited construction / compile-fail | Meaningful API misuse at the named caller boundary and the intended diagnostic, with compiler/configuration sensitivity; not every wrong-type call, and not a failure caused by an unrelated error. |
| Unsafe execution / Miri or equivalent | Supported concrete executions, seeds, platform/FFI and memory-model limits; a clean run is not a general soundness proof or a replacement for the soundness argument. |

Source grounding and precise limits: verified research `config-fho4`
(Mahoney, Tests vs. Types; Proptest limitations/state machines; Loom,
trybuild and Miri documentation), orientation `config-4zai`. These are
mechanism-selection criteria, not a new harness, dependency or universal suite.

## Lint Suppression

Applies when suppressing a lint where no plain comment may be used: suppress
lints with `#[expect(lint, reason = "...")]` per the global Rust comment
contract. The reason is the load-bearing rationale for why the lint is expected
here.

## Rust House Style (Comments & Control Flow)

- **No non-doc comments in `*.rs`**: Never write `//` or `/* ... */` comments (no `// SAFETY:`, `// TODO`, or why-comments). If code needs a comment to be understood, rename, extract, or restructure it. Write `///` or `//!` doc comments **only** when part of the public API contract (`# Errors`, `# Panics`, `# Safety`) or `unsafe fn/trait`. Durable rationale belongs in ADRs, commit messages, or `bd` beads.
- **No split guard-then-match (`guard-then-match-split`)**: Do not split a single decision between leading `if <cond> { return <literal>; }` guards and a `match` that decides the same thing. Fix sentinel states in the type first (`illegal-state-representable`), then express the decision as one exhaustive `match`. (Exempt: preconditions in non-match functions, `?` / `let ... else`, loop `continue` guards, early returns short-circuiting expensive work, and slice-validity guards).

## Construction-Path Review Inventory (`illegal-state-representable`)

When designing or reviewing a changed constrained type:
1. Name the invariant and caller boundary (distinguishing untrusted DTOs from validated domain types).
2. Inventory all construction/mutation routes: public fields/literals, constructors/builders, `Default`, `From`/`TryFrom`, `serde`, and `&mut`/`DerefMut` (note that private fields do not constrain code inside the defining module).
3. Cite how each route preserves the invariant or provide a constructible counterexample.
4. Record a valid boundary case, an invalid-state witness, and the enum/newtype remedy.

## Rust / Tokio Resource Contracts

For changes to ingestion, buffering, concurrency, retries, recursion, long-running services, or hot paths:
- **Boundary & Budget**: Name explicit limits with units (items and bytes accounted separately, active tasks, waiters, retries, depth, deadlines). Compose per-unit limits into an aggregate bound.
- **Ownership & Exhaustion**: Keep permits/charges alive via RAII across errors and cancellation; use checked arithmetic. Define explicit exhaustion behavior (reject, deadline-wait, drop, degrade).
- **Progress, Cancellation & Shutdown**: Bound individual work units and recursion depth; service loops require reachable shutdown and bounded work between checks. Dropping a future or task handle is neither rollback nor task termination — stop admission, drain/cancel admitted work, and supervise task exit.
- **Review artefacts**: `resource-contract-gap` (missing budget/boundary/exhaustion policy/evidence) and `resource-bound-violated` (breached contract).

