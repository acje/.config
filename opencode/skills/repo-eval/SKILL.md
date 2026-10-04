---
name: repo-eval
description: Evaluates a repository against non-mechanical SDLC quality criteria, including accidental complexity from overconstrained assumptions, stale documentation, epistemic cruft, strategic priority alignment, and API cognitive overhead. Designed for autonomous agent execution, producing structured summaries guided by a template.
---

# Skill: repo-eval

Evaluates qualitative, strategic, and non-mechanical dimensions of a software repository that cannot be established purely by syntax checkers or compiler tripwires.

This audit is **always run by an agent**. The evaluating agent inspects the repository, applies rigorous engineering judgement against fleet doctrine, and outputs a completed evaluation summary guided by the canonical template at `templates/eval-summary.md`.

---

## The Non-Mechanical Evaluation Dimensions

Mechanical audits (compiler flags, linter catalogs, closed error enum checkers, formatters) verify syntactic invariants. `repo-eval` audits the semantic and strategic integrity of the repository across five core dimensions:

### NM-01: Accidental Complexity from Overconstrained Assumptions (The Standardization Failure Mode)

- **The Threat**: When repository guidelines, standardization initiatives, or test tripwires overconstrain implementation details (e.g. rigid syntax matching, multi-file handshakes, nested negative assertions) rather than verifying positive operational invariants, agents enter a loop of writing layers of defensive scaffolding (custom parsers, drop-guards, redundant file checks, wrapper scripts).
- **The .beads/dolt Witness**: A standardisation effort intended to align configuration can consume excessive agent turns and produce fragile scaffolding if the solution requires satisfying multiple brittle negative constraints instead of a clean, minimal contract.
- **Probe Questions for the Agent**:
  1. *Scaffolding-to-Domain Ratio*: Does the volume of configuration, ignore rules, and defensive drop-guards exceed the actual business or domain logic? A ratio > 2:1 is an immediate finding.
  2. *Negative Constraint Fragility*: Are rules asserting the absence of specific strings/spellings rather than verifying positive domain invariants?
  3. *Double Accounting / State Duplication*: Do multiple files or metadata records store overlapping authority (e.g. `config.yaml` vs `metadata.json` vs `.gate.lock`)?
  4. *Agent Thrashing Evidence*: Did prior commits or audit logs show multiple repetitive attempts to satisfy defensive gates?

### NM-02: Living Documentation & Reality Parity (Semantic Decay)

- **The Threat**: Documentation rots while code advances. Documentation claiming "implementation not started" when code is shipped, or referencing superseded prototypes, misleads developers and wastes LLM context windows on false premises.
- **Probe Questions for the Agent**:
  1. Do version citations in `docs/` match `Cargo.toml` and crate releases?
  2. Do design documents reference abandoned prototypes (e.g. superseded Go/Python implementations) without clear deprecation banners?
  3. Are architecture decision records (ADRs) updated when operational reality drifts?
  4. Do README examples compile and run against the current crate exports?

### NM-03: Epistemic Cruft & Ephemeral Leakage

- **The Threat**: Checking transient operational outputs into git-tracked markdown. Committing Cloud Run container image digests, live NATS message sequence counts, specific deployment execution IDs, or one-off migration scripts clutters the tree and treats source control as an append-only log of transient facts.
- **Probe Questions for the Agent**:
  1. Are single-run deployment receipts, specific IP addresses, or workflow IDs checked into `docs/`?
  2. Are one-off migration or renumbering scripts lingering in `scripts/` or `tools/` with zero active CI or verification references?
  3. Are historical trace dumps or uncurated debug sessions sitting in the repository?

### NM-04: Strategic Priority Alignment (Fleet Engineering Priorities)

- **The Threat**: Features or premature performance optimizations bypassing maintainability and correctness by design.
- **Priority Hierarchy (Strictly Ordered)**:
  1. **Maintainability (P1)**: Lean trunk-based development, small deployable increments, minimal cognitive overhead, low complexity.
  2. **Correctness by Design (P2)**: Illegal states unrepresentable via types, explicit state machines, private invariant constructors.
  3. **Response Times (P3)**: Read paths and prompt event propagation across boundaries.
  4. **Energy Efficiency in Code (P4)**: Conserve compute/memory resources, eliminate redundant polling and idle CPU/memory burn.
  5. **Features (P5)**: Features rank last and must never compromise higher tiers.
- **Probe Questions for the Agent**:
  1. Did a recent feature or optimization introduce unchecked complexity, loose types, or unmetered background daemons?
  2. Are trade-offs documented honestly in accordance with this hierarchy?

### NM-05: API Surface Cleanliness & Cognitive Overhead

- **The Threat**: Primitive obsession (e.g. tuples of raw `(String, bool, u64)`), leaking internal storage or transport types to callers, or splitting domain decisions between boolean flags and pattern matching.
- **Probe Questions for the Agent**:
  1. Are domain concepts represented by type-safe newtypes and tagged enums rather than raw primitives?
  2. Does the API force callers into defensive guard-then-match splits?
  3. Are error types closed and informative with clear remedies?

---

## Agent Execution Protocol

When invoked to run a `repo-eval`:

1. **Phase 1: Environment & Surface Observation**
   - Check git status and recent commit history (`git log -n 10 --oneline`).
   - Read crate manifests (`Cargo.toml`), workspace configurations, and toolchain files.
   - Scan `docs/` for stale roadmaps, obsolete prototypes, and ephemeral deployment receipts.
   - Scan `scripts/` and `tools/` for unreferenced, dead one-off binaries.
   - Check `.beads/` for backlog proliferation (`bd ready`).

2. **Phase 2: Accidental Complexity & Scaffolding Analysis**
   - Review configuration files (`.gitignore`, `.beads/`, gate files).
   - Evaluate whether standardization requirements forced excessive defensive scaffolding.
   - Calculate estimated scaffolding-to-domain ratio.

3. **Phase 3: Generate Evaluation Summary**
   - Load `templates/eval-summary.md`.
   - Populate all sections with concrete file:line citations and objective evidence.
   - State an explicit maturity verdict: `COMPLIANT`, `NEEDS WORK`, or `DIVERGENT`.

4. **Phase 4: Handoff & Fleet Improvement Filing**
   - Deliver the completed summary to the user or requesting agent.
   - If a systemic, fleet-wide pattern or opportunity was discovered, file a bead under the Fleet Opportunity Protocol (`fleet-opportunity`).
