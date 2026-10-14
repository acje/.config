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
contract (global AGENTS § House style — Rust comments; the positive technique
for what would otherwise be a `//`-or-`#![allow]` comment). The reason is the
load-bearing rationale for why the lint is expected here. Preserve the review
trigger and disposition in the reviewer's role prompt (linus § Review
patterns); this section owns the writing technique, not a new lint policy,
gate or dependency configuration.

## Local provenance

Native fleet method home created by mission `sf-sdlc-4b56` / `sf-sdlc-4b56.4`
(mission `sf-sdlc-4b56-migration`, 2026-10-14). Paragraphs extracted from:
- `agents/hopper.md` R16 type-restructuring grounding and worked framing
  (source C HEAD `1526930be58004d2493171d86efebac8bc5852be`);
- `agents/linus.md` illegal-state-representable Check/Fix/Grounding/Problem
  shapes and the Claim-driven evidence-selection proposition/mechanism-adequacy
  table (same C HEAD);
- `sf-sdlc/AGENTS.md` § 1 Doctrine "Zero compliance theatre" prose and the
  locally-retained `#[expect]` suppression technique (source R HEAD
  `36c4412005a91c67a9def86885be09dbe9f4d030`).
Pre-deletion baseline paragraph ledger + per-paragraph SHA256: bead
`sf-sdlc-k6v5`. Research grounding retained as-is within the moved text:
`config-54u` (types-as-axioms; not-sourced Rust-synthesis boundary) and
`config-fho4` (evidence-selection source grounding). Adaptations: grounding
that was previously duplicated across hopper R16 and linus is now a **single
deduplicated home**; activity-scoped sectioning with mandatory load-before /
reload-after-context-reload. The canonical construction-path review inventory
remains global AGENTS § Rustling → Construction-path review inventory (this
skill references it, never competes with it). Upstream: n/a — native prose,
not imported; no license/pin applies.
