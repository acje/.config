---
name: quality-sweep
description: Generic, shareable SDLC quality sweep of a codebase. Discovers each independently deployable service in the target and scores 29 equally-weighted quality dimensions across 7 SDLC phases for each, producing one prioritised, evidence-arbitrated HTML report per service (summary + per-phase detail) from a template — or a single short no-services report when none are discovered. Every verdict is decided by cited evidence, never by a prior. NOT a per-change gate — a standalone breadth-first sweep run on demand. Use when the user asks to "run a quality sweep", "SDLC quality audit", or "quality process", or wants a periodic codebase health check. For per-diff review use a dedicated code-review process instead.
---

# Quality Sweep

A generic, breadth-first SDLC quality sweep. It scores 29 dimensions across 7
phases against **each independently deployable service discovered in one
target codebase** and produces a prioritised HTML report per service. The
evidence pass **fans out one subagent per SDLC phase** (seven parallel
shards) so each shard gets a fresh full context budget for its ~4 dimensions
rather than 29 dimensions competing in one window — the fix for run-to-run
score nondeterminism. Before each service's report is written, a
fresh-context verification subagent re-arbitrates every finding against its
cited evidence (Phase 2.5) so no producing shard signs off its own work. The
engine is target-agnostic and self-contained; five swappable data layers tune
it:

- **Toolchain adapter** (`adapters/toolchains.md`) — maps the target's
  ecosystem to `{test, lint, audit, deny}` commands (rust / node / python / …).
- **Service discovery adapter** (`adapters/services.md`) — maps deployment-
  marker/entrypoint/monorepo-convention tiers to service root directories, so
  the sweep knows what a "service" is in this target.
- **Stack-profile adapter** (`adapters/stacks/`) — per-stack probes, anti-
  patterns, and exemplars that ADD to (and, where marked, replace) each phase
  reference's generic probe floor for a service's bound ecosystem; see
  `adapters/stacks/README.md`.
- **Per-phase check references** (`references/phase-<n>-*.md`) — one file per
  SDLC phase holding concrete, generalized checks and named anti-patterns for
  that phase's dimensions. The engine defines *what* each dimension is; the
  reference tells you *what concrete issues to hunt for*. Load the reference for
  a phase before running its evidence pass.
- **Report template** (`templates/report.html`) — a self-contained HTML
  template (summary + per-phase detail) filled once per discovered service.

The 29 dimensions and the 7-phase model are fixed, and **all dimensions carry
equal importance**. There is no weighting, ranking, or bias — the sweep looks
for evidence on every dimension with the same rigour.

Each dimension is scored **exactly once**. A concept that surfaces at more than
one SDLC phase (Type safety, API-versioning, Cost/economics, Accessibility) is
one scored dimension with a **facet note** naming the extra phase — never a
duplicate row.

## The one rule that governs the whole sweep

**Evidence is the arbiter.** A dimension is `PRESENT` only when it carries a
concrete artifact — file:line, CI step, or doc section. Absence of evidence is
a finding, not a pass.

Corollary (the green-arbitration rule): **green WITHOUT evidence = under-looked;
green WITH evidence = pass.** A dimension marked fine but carrying no cited
artifact is a finding (look harder), not a pass. A dimension marked fine *with*
a cited artifact is a genuine pass.

**Closing a dimension is state-dependent.** For a **binary** dimension (present
or not — e.g. "a lockfile is committed", "the format carries a version tag") a
single concrete artifact **closes** it; do not keep interrogating something that
has already produced dispositive evidence. For a **graded** dimension (Testing,
Security, Observability, Correctness, Reliability) a first hit does **not**
close it — the dimension's probe floor must COMPLETE, so the score reflects
coverage rather than first-touch luck. Which artifact you stumble on first is
nondeterministic; requiring the floor to finish removes that variance.

**ABSENT is earned, not defaulted.** A dimension may be scored `ABSENT` only
after its **probe floor** (the mandatory minimum probe set in the phase
reference — specific greps, conventional paths, adapter commands) has been
executed and its transcript recorded. `ABSENT` means "these specific probes
returned nothing", never "I didn't find anything". This converts
ABSENT-by-exhaustion (the dominant source of run-to-run variance) into
ABSENT-by-completed-checklist.

## When to run (and when NOT to)

- **Run:** on a whole crate / workspace / service, as a deliberate health
  check — on demand. Running the sweep *periodically* is a **discovery
  trigger** (surface findings you would otherwise miss); it is not a fixed
  calendar cadence and carries no "daily/weekly is best practice" claim.
- **Route findings signal-triggered.** Hand the report to your team's triage /
  review process; let real signals (not the calendar) decide which findings
  graduate into work. The sweep discovers; triage disposes.
- **Do NOT run** as a per-commit / per-PR gate — that is a per-diff code-review
  process's job (§ Relationship below).
- The sweep **produces a report and never edits source.**

## Relationship to other processes (no duplication)

| Concern | Owned by | This skill's stance |
|---|---|---|
| Per-diff / per-PR correctness+security review | your code-review process | Defer. Sweep does not re-review diffs. |
| Language-specific deep review (unsafe, audit/deny, MSRV) | your language review process | Cite its findings if present; don't re-run inline. |
| Architectural constraint / ADR lookup | your ADR / architecture process | Consult for phase-1 evidence; don't re-derive. |
| Structural blast-radius / dependency questions | your code-graph / structural tool | Use for phase-1/2 structural evidence. |
| Turning findings into fixes | your build / triage process | Sweep hands off a prioritised list; it does not fix. |

The sweep is **breadth-first**; the above are **depth-first and event-driven**.
No overlap when each stays in its lane.

> **Optional fleet note (safe to delete when sharing):** if your setup has a
> code-review skill, a language-review agent, an ADR/architecture lookup, a
> code-graph tool, and a build/triage flow, plug them into the table above.
> These are soft references only — no dimension check requires any of them, and
> the sweep runs fully on its own.

---

## The 29 dimensions

Grouped by SDLC phase. Generic SDLC quality dimension definitions; the 7-phase
model and the 29-dimension membership are fixed, and every dimension is looked
at with equal rigour. Each dimension is scored **once**; where a concept spans
phases it carries a `(facet: …)` note under its primary phase instead of a
second row.

Each phase has a companion reference file (`references/phase-<n>-*.md`) that
expands these one-line definitions into concrete checks and named anti-patterns.
The definitions below say *what* each dimension is; the reference says *what to
hunt for*. Read the phase reference before that phase's evidence pass.

### Phase 1 — Requirements / Design
- **API / schema design** — public surface minimality, contracts, newtypes.
- **Architecture** — decomposition, coupling, hexagonal/EDA fit, ADR adherence.
- **Type safety** — illegal states unrepresentable, invariants in types.
  *(facet: phase 2 — enforcement at implementation level; scored here once.)*
- **API-versioning & consumer contracts** — deprecation policy, semver
  discipline, who breaks when this public surface changes. *(facet: phase 5 —
  release mechanics: deprecation windows, semver bumps, consumer-side breakage
  coordination at release time; scored here once.)*
- **Compatibility / interoperability** — co-existence alongside other systems
  sharing an environment/resources, and data-format / protocol interchange with
  foreign systems (wire formats, encodings, standard-conformant I/O). Distinct
  from API-versioning: that governs temporal change of *your own* surface, this
  governs cross-system interchange *now*.
- **Cost / resource economics** — is spend / quota / rate-limit budget a design
  input, or ignored until the bill arrives? *(facet: phase 6 — runtime: actual
  spend, quota headroom, egress; scored here once.)*

### Phase 2 — Implementation
- **Refactor / readability** — idiomatic, cohesive units, low cognitive load.
- **Correctness / bugfix** — edge cases, defect density.
- **Error handling** — typed errors, no swallowed panics, bounded retry.
- **Concurrency** — locks across await, races, backpressure primitives.
- **Dead-code removal** — unused, duplicated, cognitive-load debt.

### Phase 3 — Verification
- **Testing** — TDD, regression pins, coverage, property tests.
- **Lint / format / style** — linter clean, house style, formatter.
- **Performance** — latency, memory, build-time, profiling.
- **Chaos / fault injection & load / soak testing** — beyond unit concurrency
  tests: sustained load, fault injection, soak. Does *anything* exercise the
  system under sustained adverse conditions?

### Phase 4 — Security / Supply-chain
- **Security** — OWASP/CISQ, hardening, input validation, advisories.
- **Dependency / build** — dependency audit/deny, toolchain pins, CI.
- **Supply-chain integrity** — SBOM, dependency provenance / signing,
  reproducible builds, license compliance. (Audit ≠ provenance.)

### Phase 5 — Release / Deploy / Migration
- **Operational / runtime resilience** — rollback strategy, health checks,
  graceful degradation, circuit breakers, backpressure under sustained load,
  deploy topology; *reacting* to what observability reports. (Mechanics of
  recovery, distinct from Reliability's availability outcome.)
- **Data lifecycle & migration safety** — schema *evolution over time*
  (fwd/back compat, replay-after-schema-change), retention, backup/restore,
  corruption recovery.
- **Reliability / availability / recoverability** — faultlessness, uptime /
  availability, MTBF, mean-time-to-recovery as a first-class *outcome* — not
  the code-level defect density (Correctness), nor the reaction mechanics
  (Operational resilience), nor schema-migration safety (Data lifecycle). Names
  the availability/recoverability concept that was previously smeared across
  those dimensions.
- **Delivery performance (DORA)** — deployment frequency, change lead time,
  change-fail rate, failed-deployment recovery time as *measured delivery
  outcomes*. `N/A` when the target has no deployment pipeline (e.g. a pure
  library with no release/deploy automation).
- **Safety / fail-safe** — operational hazard avoidance: fail-safe default
  states, safe-degradation-on-fault, hazard identification/warning, safe
  integration. Distinct from Reliability (keep serving) and Operational
  resilience (recover): Safety is *fail without causing harm*. `N/A` for
  non-safety-critical targets (state the reason in one line).
- **Flexibility / portability** — installability, replaceability, adaptability
  to new environments, config-via-environment, dev/prod parity, deployability
  across environments. Distinct from Compatibility (interchange with foreign
  systems) — this is the target's own portability across environments.

### Phase 6 — Operate / Observe
- **Observability** — structured logging, metrics, tracing.

### Phase 7 — Documentation & Human-facing quality
- **Docs** — API docs, ARCHITECTURE, C4/mermaid, READMEs.
- **Accessibility (a11y)** — WCAG perceivable / operable / understandable /
  robust: ARIA, contrast, keyboard-nav on shipped user-facing surfaces (HTML,
  tooltips, diagrams). *(facet: phase 1 — a11y as stated design intent for any
  user-facing surface; scored here once against the delivered surface.)*
- **Usability / UX** — ISO Interaction Capability: task effectiveness,
  learnability, *end-user* error-message quality (vs. operator logs), and
  external-adopter DX. Distinct from Accessibility (assistive-tech reach) and
  from i18n (locale reach).
- **Internationalisation / localisation (i18n/l10n)** — locale support,
  translatable/externalised strings, locale-aware formatting, right-to-left and
  encoding readiness on user-facing surfaces.

---

## Procedure

### Phase 0 — Scope & context
1. Resolve target: module / workspace / repo path. State it before starting.
2. **Discover services** per `adapters/services.md` (tiered T1/T2/T3
   detection, dedup by filesystem root). **State the discovered service list**
   before any evidence pass runs — this is what makes the discovery
   assumption reversible: the operator may override it. When **more than 5**
   services are discovered, **pause here** for operator confirmation or
   narrowing before continuing; do not start the evidence pass on more than 5
   services without that confirmation. When discovery finds nothing, record
   the full probe transcript (every tier probed, every path/glob searched)
   and proceed to the single no-services report (Phase 3).
3. **Bind, per discovered service, its ecosystem toolchain row and stack
   profile.** Detect that service's ecosystem (lockfile/manifest presence),
   pick the matching row from `adapters/toolchains.md`, and bind the matching
   profile from `adapters/stacks/` per the per-service binding contract in
   `adapters/stacks/README.md`. A service whose ecosystem has no seeded
   profile records the bound profile as `none (unseeded)` — visible in the
   report, never silently implied generic (python/ruby/php take this path
   today; the python toolchains.md row stays regardless). A polyglot service
   (one root, two stacks) binds one PRIMARY profile plus SECONDARY profiles
   per the polyglot rule in `adapters/stacks/README.md` — still one service,
   one report. State each service's bound toolchain row and profile(s) before
   the evidence pass runs; no repo-wide single-ecosystem assumption carries
   past this step.
4. Read `AGENTS.md` (or equivalent), relevant ADRs/architecture docs, and any
   available code-graph. Note committed conventions so findings judge against
   *this* codebase's contract, not a generic one.
5. Record the sweep timestamp, target, and, per service, its bound ecosystem
   and stack profile(s), in the report header. One timestamp is shared across
   every report produced by this sweep run (see Phase 3 path scheme).
6. **(Optional) Reference exemplar.** You may name a mature sibling/exemplar
   repo whose *solved* patterns become an extra checklist for this sweep: "does
   the target do what the exemplar already solved?". Inspecting a weaker repo
   right after a stronger sibling sharpens both — the sibling's solved patterns
   expose the target's gaps as concrete probes. Guardrails: the exemplar is
   **optional**; **evidence still arbitrates** (never assume the exemplar is
   itself correct — an exemplar's pattern is a probe to run against the target,
   not a score to inherit); the exemplar **sharpens probes, it does not set
   scores**. Record which repo was used as exemplar in the report header for
   provenance.

### Phase 1 — Evidence pass (7 parallel phase shards, equal rigour)

**Services are swept sequentially; the 7-shard fan-out stays within one
service.** For each discovered service, in turn, run the full phase-shard
fan-out described below for that service alone. Peak parallelism is always 7
shards, never 7×N — total sweep cost is linear in the number of services (N),
not multiplicative. This is the cost-control shape: do not fan out shards
across services.

The evidence pass **fans out one subagent per SDLC phase** — seven shards, run
in parallel. Each shard is a self-contained evidence job: it loads **exactly its
own** `references/phase-<n>-*.md`, PLUS the current service's bound stack
profile(s) from `adapters/stacks/` (composition rule: ADD-BY-DEFAULT,
REPLACE-ONLY-WHEN-MARKED — the generic probe floor always still runs; see
`adapters/stacks/README.md`), scores **only that phase's dimension
cluster** for the current service, and returns a phase scorecard. A single agent
scoring all 29 dimensions in one context window is what makes the sweep
nondeterministic (later dimensions starve as context saturates and default to
under-looked `ABSENT`); per-phase fan-out gives each shard a fresh full budget
for ~4 dimensions.

Do **not** split by code region (dimensions are cross-cutting) or by individual
dimension (29 shards = coordination overhead >> work, and evidence dedup is
lost). Phase is the natural boundary — it is already the data-layer seam.

**Shared-root artifacts count as evidence for every service.**
Root-level artifacts that apply repo-wide — CI config, root lockfile, root
LICENSE, root SBOM, and similar — are valid evidence **for each service**,
cited by their **real path** (the actual root-relative path, e.g.
`.github/workflows/ci.yml`, never rewritten as if it lived under the service
root). A service must not score `ABSENT` on CI merely because the CI
definition lives at the repo root rather than inside the service directory.

**Compiled-ecosystem mechanical checks run ONCE PER BUILD ROOT, not per
shard and not unconditionally per service.** For compiled ecosystems (rust,
go, dotnet, …) the adapter commands (`test` / `lint` / `audit` / `deny`)
share a single build directory (`target/`, etc.) per build root. Running them
inside each parallel phase shard causes build-lock contention and wasted
rebuilds; running them once per service when several services share one build
root does the same. Run the four mechanical commands **once per build root**,
capture their exit codes and transcripts, and hand the captured results to
every shard and every service mapping to that build root as shared evidence.
A monorepo with one shared `target/` runs the four commands once for the
whole sweep (identical to a single-service sweep today); a polyglot repo with
a separate manifest/build dir per service runs them once per service, which is
correct and causes no contention. Shards still interpret those results for
their own dimensions, but they do not each re-invoke the compiler.
Interpreted ecosystems without a shared build artifact are exempt.

**The seven shards and their scored dimension counts (sum = 29):**

| Shard | Reference file | Scores |
|---|---|---|
| 1 | `references/phase-1-design.md` | 6 — API/schema, Architecture, **Type safety**, **API-versioning**, Compatibility, **Cost** |
| 2 | `references/phase-2-implementation.md` | 5 — Refactor, Correctness, Error handling, Concurrency, Dead-code |
| 3 | `references/phase-3-verification.md` | 4 — Testing, Lint/format/style, Performance, Chaos/soak |
| 4 | `references/phase-4-security.md` | 3 — Security, Dependency/build, Supply-chain integrity |
| 5 | `references/phase-5-release.md` | 6 — Operational resilience, Data lifecycle, Reliability, Delivery perf (DORA), Safety, Flexibility/portability |
| 6 | `references/phase-6-observe.md` | 1 — Observability |
| 7 | `references/phase-7-docs.md` | 4 — Docs, Usability/UX, **Accessibility**, i18n/l10n |

**Facet-ownership rule (each dimension scored exactly once).** The four
cross-phase facet dimensions are scored by **their home shard only**; the other
shard reads the facet content for context but must NOT emit a score for it:

| Facet dimension | Scored by (home) | Read-only context in |
|---|---|---|
| Type safety | Shard 1 (phase 1) | Shard 2 (phase 2) |
| API-versioning & consumer contracts | Shard 1 (phase 1) | Shard 5 (phase 5) |
| Cost / resource economics | Shard 1 (phase 1) | Shard 6 (phase 6) |
| Accessibility (a11y) | Shard 7 (phase 7) | Shard 1 (phase 1) |

The rule is one-directional and unambiguous: **a facet dimension belongs to the
shard whose reference file carries its full dimension row and probe floor.**
Shard 6 therefore scores only Observability (Cost is context there); Shard 2
never scores Type safety; Shard 5 never scores API-versioning; Shard 1 never
scores Accessibility. This guarantees 6+5+4+3+6+1+4 = 29 dimensions, none
dropped, none doubled.

**Each shard's contract (Result-shaped return).** A shard, for every dimension
in its scored set, executes the dimension's **mandatory probe floor** from its
reference file (specific greps, conventional paths, adapter commands), records
the transcript, then decides state. It returns a phase scorecard:

```
phase: <n> — <name>
dimensions: [ per dimension:
  { name, state: PRESENT|PARTIAL|ABSENT|N/A,
    evidence: <cited artifact — file:line / CI step / doc, required for PRESENT>,
    probe_transcript: <what was searched / which adapter commands ran + exit codes> } ]
```

Use the toolchain-adapter row for the mechanical probes (`test`, `lint`,
`audit`, `deny` — record exit codes, never fabricate). `PRESENT` **must** carry
a concrete artifact; "looks fine" is never a pass. `ABSENT` is legal **only**
after the dimension's probe floor has run and its transcript is recorded —
`ABSENT` means "these specific probes returned nothing", never "I didn't look".

**Merge step.** After all seven shards return, assemble the scorecards into one
set of exactly 29 scored dimensions (verify each of the 29 appears once and only
once — the facet-ownership table above is the checklist), dedup any evidence
cited by more than one shard, then proceed to Phase 2 scoring, the Phase 2.5
verification pass, and the report.

For reference, the dimensions each shard hunts (the reference file is the
authoritative check source; this is a fast summary, not a substitute):
- Tests exist and run? (adapter `test` — record exit code, don't fabricate.)
- Linter clean, house style honoured? (adapter `lint`.)
- Dependency audit / deny present and passing? (adapter `audit`, `deny`.)
- Public API surface documented and minimal?
- Migration safety: schema-version fields, replay tests across schema changes,
  backup/restore paths, migration scripts.
- Runtime resilience: health endpoints, rollback docs, degradation paths,
  circuit breakers, backpressure, signal handling.
- Reliability: availability/uptime targets or SLOs, MTBF/MTTR data, faultless-
  ness evidence distinct from resilience mechanics.
- Delivery performance: deploy-frequency / lead-time / change-fail-rate /
  recovery-time signals from CI/CD (mark `N/A` if no deployment pipeline).
- Safety: fail-safe defaults, hazard warnings, safe-degradation paths (mark
  `N/A` for non-safety-critical targets).
- Compatibility: data-format/protocol interchange, standard-conformant I/O,
  co-existence constraints with foreign systems.
- Flexibility / portability: installability, replaceability, environment
  config, dev/prod parity.
- API-versioning: deprecation markers, semver policy, breaking-change
  changelog, consumer inventory.
- Supply-chain integrity: SBOM generation, dependency signing/provenance,
  reproducible-build config, license-scan step.
- Cost economics: budget/quota/rate-limit constants, cost dashboard ref.
- Chaos/soak: tests tagged load/soak/fault-injection.
- Accessibility / usability / i18n: ARIA/contrast/keyboard-nav on shipped HTML;
  end-user error copy and adopter-facing DX/quickstart; locale/translation
  support.
- …and the remaining dimensions from the list above.

State explicitly for each: `PRESENT (evidence: file:line / CI step / doc)`,
`PARTIAL (…)`, or `ABSENT — probes X, Y, Z returned nothing` (never a bare "no
evidence found"). `PRESENT` **must** carry a concrete artifact; "looks fine" is
never a pass. For **binary** dimensions a single concrete artifact closes the
dimension. For **graded** dimensions (Testing, Security, Observability,
Correctness, Reliability) the probe floor must COMPLETE even after a hit, so the
score reflects coverage, not first-touch luck — do not stop at the first
artifact. **"Graded" names the closing rule, never a state value.** A graded
dimension still emits exactly one of `PRESENT | PARTIAL | ABSENT | N/A`;
returning a category word such as "GRADED" as if it were a state is a contract
violation — resolve it to a concrete state.

### Phase 2 — Score & prioritise
Score each of the 29 dimensions **once** (cross-phase concepts get one row with
a facet note, never two):

| State | Meaning |
|---|---|
| `PRESENT` | Dimension actively addressed with cited evidence |
| `PARTIAL` | Some coverage, notable gap |
| `ABSENT` | No evidence found |
| `N/A` | Genuinely inapplicable to this target (justify in one line) |

`N/A` is the expected state for **Delivery performance (DORA)** on targets with
no deployment pipeline (e.g. a pure library) and for **Safety / fail-safe** on
non-safety-critical targets — mark `N/A` with a one-line reason rather than
`ABSENT`, since absence of the *concern* is not a finding.

**`N/A` can coexist with a PRESENT sub-facet.** When a dimension is `N/A` for
its *primary* concern but an applicable *sub-facet* exists, score `N/A` with the
reason AND record the sub-facet's `PRESENT` evidence — do not lose it. Example:
Safety is `N/A` for physical safety on a data service, yet a data-integrity
fail-safe sub-facet is genuinely `PRESENT` with cited evidence; the row reads
`N/A (physical safety inapplicable) — sub-facet: data-integrity fail-safe
PRESENT (evidence: …)`. The primary `N/A` reason and the sub-facet evidence both
survive into the report.

Prioritise findings by **risk = blast-radius × irreversibility × likelihood**.
`ABSENT` items on a production/public artifact are medium+ by default
(data-migration and API-versioning gaps are classic expensive-later failures).

### Phase 2.5 — Independent verification (fresh context, before report)

Before the report is written, the merged-and-scored dimension set is handed to
**one verification subagent in a fresh context** whose sole job is to
re-arbitrate every finding against its cited evidence. This is a second pair of
eyes that never saw the shard runs — it cannot inherit a shard's under-looking,
only catch it. The producing contexts (the seven shards) are the wrong ones to
check their own work; a fresh context is.

The verifier receives the full scored set (all 29 dimensions with state,
evidence, and probe transcript) and, for each dimension, re-checks against the
same evidence-arbitration rules the sweep runs on:

- **`PRESENT` without a concrete artifact** (file:line / CI step / doc section)
  → **reject**: downgrade to a finding (green-without-evidence = under-looked).
- **`ABSENT` without a completed probe-floor transcript** → **reject**: the
  score is not yet earned; the dimension returns to its home shard for the
  mandatory probes, or is marked with the gap explicit.
- **Cited artifact that does not support the claimed state** (evidence
  mismatch, stale line reference, artifact proves a weaker/different claim) →
  **reject**: correct the state to what the evidence actually supports.
- **`N/A` without a one-line applicability reason** → **reject**: demand the
  reason or rescore.
- **Facet dimension scored by the wrong shard, or scored twice** → **reject**:
  re-apply the facet-ownership table; exactly 29 rows, none dropped, none
  doubled.
- **State field carrying a category label instead of a concrete state** (e.g.
  "GRADED", "binary", a phase name) → **reject**: `PRESENT | PARTIAL | ABSENT |
  N/A` are the only legal state values; resolve the label to the concrete state
  its evidence supports.

The verifier returns a **verification verdict** per dimension —
`CONFIRMED` (state and evidence stand) or `REJECTED (reason, corrected state /
required re-probe)` — plus a one-line overall gate:

```
verification: dimensions_checked: 29
  confirmed: <n>   rejected: <n>
  [ per rejected: { name, was: <state>, reason, disposition: CORRECT|RE-PROBE } ]
gate: PASS  (all findings evidence-backed)  |  FAIL (rejects must be resolved)
```

On `FAIL`, resolve every rejection before Phase 3 — corrected states are
applied in place; `RE-PROBE` dispositions go back to the owning shard for the
missing probe floor, then re-verify. The report is written **only** from a set
whose verification gate is `PASS`. The verification verdict itself is recorded
so the report's validation section can cite it (findings survived an
independent evidence re-check, not just the producing shard's own claim).


### Phase 3 — Report

Produce one **HTML report per discovered service** from the template at
`templates/report.html`. Write each to the configured report path (default
`.ooda/`, gitignored):

`<report-dir>/quality-sweep-<target>-<service-slug>-<timestamp>.html`

- `<service-slug>`: the service root path relative to the target, with `/`
  replaced by `-`, any character outside `[A-Za-z0-9._-]` replaced by `-`,
  lowercased.
- Service root equal to the target root → slug `root`.
- The no-services report (below) → slug `no-services`.
- Dedup-by-filesystem-root (`adapters/services.md`) guarantees relative roots
  are unique, so slugs are unique — no collisions.
- One shared `<timestamp>` covers every report from a single sweep run (set
  in Phase 0), so all reports of one run sort together and are identifiable
  as one run.

The template is self-contained (inline CSS, no external assets) and has two
parts: a **Summary** (verdict, state counts, scorecard, prioritised findings,
validation run) and a **Detail** section (per-SDLC-phase, one entry per
dimension with its state, note, and cited evidence). Fill procedure, run once
per service:

1. Read `templates/report.html`.
2. Replace every `{{TOKEN}}` with the swept value. Header tokens: `{{TARGET}}`,
   `{{DATE_ISO}}`, `{{ECOSYSTEM}}` (this service's bound ecosystem — per
   Phase 0 step 3, ecosystem binding is per service, not run-level),
   `{{PROFILE}}` (this service's bound stack profile: the seeded profile
   name, `none (unseeded)` when the ecosystem has no seeded profile — never
   blank, never implying stack-awareness that didn't happen — or
   `<primary> + <secondary>` for a polyglot service per the polyglot rule in
   `adapters/stacks/README.md`), `{{DIMS_SCORED}}`, `{{SERVICE}}` (service
   name — manifest-declared name, or directory basename), `{{SERVICE_ROOT}}`
   (service root path relative to the target), `{{SERVICE_N_OF}}` (this
   service's position in the run, e.g. `2 of 4`, so a single report is
   legible as part of a cohort); summary tokens: `{{VERDICT}}`,
   `{{N_PRESENT}}`/`{{N_PARTIAL}}`/`{{N_ABSENT}}`/`{{N_NA}}`; verification
   tokens (Phase 2.5): `{{VERIFY_GATE}}` (`PASS` — the report is only written
   from a passing set), `{{VERIFY_CONFIRMED}}`, `{{VERIFY_REJECTED}}` (rejects
   found and resolved before reporting).
3. Repeat each marked block once per item, then delete its `BEGIN/END` comment
   markers: `scorecard-row` per dimension, `finding` per prioritised finding
   (highest risk first), `validation-row` per adapter check, `phase-section`
   per phase with `dimension-detail` nested per dimension, `solid` per
   evidence-backed PRESENT dimension. In each `dimension-detail`, fill
   `{{DET_PROBE}}` with the dimension's **probe transcript** from its phase
   shard — what was searched and which adapter commands ran with exit codes.
   This is what makes two runs diffable: differing scores on the same target
   become a visible defect in the transcript, not an invisible one.
4. Use the state vocabulary verbatim in `data-state` so the CSS colours it:
   `PRESENT | PARTIAL | ABSENT | NA`. Severity classes: `high | medium | low`.
5. Every `PRESENT` and every finding must carry a concrete artifact
   (file:line / CI step / doc section) in its evidence/why field — the
   green-arbitration rule applies to the HTML exactly as to the sweep.
6. **Shared-root artifacts.** When a dimension's evidence is a root-level
   artifact (CI config, root lockfile, root LICENSE, root SBOM), cite its
   **real path** (e.g. `.github/workflows/ci.yml`), never a path rewritten as
   if it lived under the service root.

Do not invent chart libraries or external CSS; keep each report a single
portable file.

**No-services report.** When Phase 0 discovery finds zero services,
emit **exactly one** report from the same template, filled as a distinct
short form — never 29 fabricated `N/A` rows (that would fabricate scores and
violate both evidence-arbitration and ABSENT-is-earned). "No services were
discovered" is itself the single arbitrated claim, governed by the same
rules as any other finding:

- `{{SERVICE}}` = `(none discovered)`, `{{SERVICE_ROOT}}` = `—`,
  `{{SERVICE_N_OF}}` = `—`, `{{PROFILE}}` = `—` (no service to bind a
  profile to).
- `{{DIMS_SCORED}}` = `0`; `{{N_PRESENT}}` = `{{N_PARTIAL}}` = `{{N_ABSENT}}`
  = `{{N_NA}}` = `0`.
- `{{VERDICT}}` — short statement: no services were identified, therefore no
  service-scoped checks were applicable or run; names the discovery probe
  floor that was executed.
- `scorecard-row` — exactly **one** row: phase `0`, dimension
  `(no services discovered)`, state `NA`, evidence = discovery probe
  transcript.
- `finding` — **zero** blocks (delete the block entirely).
- `solid` — **zero** blocks (delete the block entirely).
- `validation-row` — exactly **one** row: check `Service discovery`, result
  `0 services — probe floor completed`, exit `—`.
- `phase-section` — exactly **one**: `0 — Service discovery`, containing
  **one** `dimension-detail` whose `{{DET_PROBE}}` carries the full discovery
  transcript (every tier probed, every path/glob searched, what returned
  nothing).
- Phase 2.5 **still runs** on the no-services report; its sole job is to
  re-arbitrate the discovery claim against that transcript.
  `{{VERIFY_GATE}}` = `PASS`, `{{VERIFY_CONFIRMED}}` = `1`,
  `{{VERIFY_REJECTED}}` = whatever was actually rejected and resolved
  (usually `0`).

This is ABSENT-is-earned applied to discovery itself: "no services" is legal
only after the discovery probe floor ran and its transcript is recorded —
never a default.

---

## Report template

The report template is `templates/report.html` — a self-contained HTML file
(inline CSS, no external assets). It captures, in order:

- **Header** — target, date, the swept service's bound ecosystem and stack
  profile (`{{ECOSYSTEM}}`, `{{PROFILE}}` — per-service, never a run-level
  single value; unseeded renders `none (unseeded)`), dimensions-scored / 29,
  and the swept service's identity (`{{SERVICE}}`, `{{SERVICE_ROOT}}`,
  `{{SERVICE_N_OF}}`).
- **Summary** — a 2–3 sentence verdict (lead with where evidence is thinnest,
  stated as an evidence claim not a prior); PRESENT / PARTIAL / ABSENT / N/A
  counts; the full scorecard (one row per dimension, cross-listed concepts as a
  single `(facet: …)` row); prioritised findings, risk-ordered
  (`risk = blast-radius × irreversibility × likelihood`), each with a cited
  artifact and a triage-shaped next step; and the validation run (adapter
  test / lint / audit / deny with exit codes — never fabricated), plus the
  Phase-2.5 verification gate (findings survived an independent fresh-context
  evidence re-check, not just the producing shard's claim).
- **Detail** — per SDLC phase, one entry per dimension: state, note, the
  concrete evidence that decided the state, and the **probe transcript** (what
  was searched / which adapter commands ran with exit codes) that earned the
  state — mandatory for every `ABSENT`, so absence is auditable and run-to-run
  score variance is diffable.
- **What's solid** — dimensions confirmed PRESENT with evidence, so the report
  is honest rather than a gap list.

Fill it per the Phase-3 procedure above; do not hand-roll a different format.

---

## Final reply (terse, structured)

After writing all reports, reply with one summary line per service, then the
report path list.

Multi-service shape:

```
Target: <path>   Services discovered: <n>

[per service:]
Service: <name> (<service-root>)   Ecosystem: <name>   Stack profile: <name | none (unseeded) | primary + secondary>
PRESENT (with evidence): <n>   PARTIAL: <n>   ABSENT: <n>   N/A: <n>
Top finding: <one line, risk-ranked #1>
Validation: Tests=<..> Lint=<..> Audit=<..> Deny=<..>

Reports:
  <report-dir>/quality-sweep-<target>-<service-slug-1>-<timestamp>.html
  <report-dir>/quality-sweep-<target>-<service-slug-2>-<timestamp>.html
  ...
```

No-services shape:

```
Target: <path>   Services discovered: 0
Discovery probe floor: <one line — tiers probed, all returned nothing>
Report: <report-dir>/quality-sweep-<target>-no-services-<timestamp>.html
```

## Discipline

- **Service is the reporting unit.** Each discovered service gets its own
  full 29-dimension report; no blended whole-repo score. Sequential across
  services, 7-way parallel within one service (never 7×N).
- **Shared-root artifacts are evidence for every service.** Root-level CI,
  lockfile, LICENSE, SBOM, etc. count for each service, cited by their real
  path — never rewritten as a service-relative fiction, and never scored
  `ABSENT` merely for living at the repo root.
- **"No services" is earned, never defaulted.** The no-services report is
  legal only after the discovery probe floor (`adapters/services.md`)
  completed and its transcript is recorded — the same ABSENT-is-earned rule
  applied to discovery itself.
- **Evidence arbitrates.** A dimension is `PRESENT` only with a cited artifact
  (file:line / CI step / doc section); nothing is passed on a prior.
- **Green without evidence = under-looked; green with evidence = pass.**
- **All 29 dimensions are equal.** No weighting, no ranking, no bias — every
  dimension gets the same rigour.
- **Score each dimension once.** Cross-phase concepts (Type safety,
  API-versioning, Cost, Accessibility) are one scored row with a facet note,
  never a duplicate row. Under the phase fan-out, each facet dimension is scored
  by its **home shard only** (Type safety / API-versioning / Cost → shard 1;
  Accessibility → shard 7); the other shard reads its context but emits no score.
- **Close binary dimensions on evidence; complete graded dimensions.** A single
  concrete artifact closes a genuinely *binary* dimension and ends the
  interrogation. For *graded* dimensions (Testing, Security, Observability,
  Correctness, Reliability) the probe floor must complete even after a hit, so
  the score reflects coverage, not first-touch luck. Do not re-litigate a closed
  binary dimension.
- **ABSENT is earned.** No dimension is scored `ABSENT` until its mandatory
  probe floor has run and its transcript is recorded. `ABSENT` = "these specific
  probes returned nothing", never "I didn't look".
- **Verify in a fresh context before reporting.** Every finding is re-arbitrated
  against its cited evidence by an independent verification subagent (Phase 2.5)
  that never saw the shard runs. The report is written only from a set whose
  verification gate is `PASS`; a producing context does not sign off its own work.
- **Don't fabricate validation.** Tool missing → `SKIPPED` with a reason.
- **Exit code is not truth — interpret it against the tool's config.** A green
  exit can mask suppressed advisories, and a red exit can be a missing config
  rather than a real violation. Before scoring a mechanical check, read its
  config: an `audit` that passes *with* an ignore list is `PASS-WITH-IGNORES`
  (name the suppressed advisories), not a clean pass; a `deny`/policy gate that
  fails because there is *no* policy file is `UNCONFIGURED`, not a license
  violation. Score the interpreted state, and record the config basis in the
  probe transcript.
- **Periodicity is a discovery trigger, not a cadence.** Route findings to your
  triage process signal-triggered; the sweep discovers, triage disposes.
- **Sweep reports; it does not fix.** Findings become work through your normal
  triage/build flow. The sweep never edits source.
- **Stay in lane.** Per-diff review, language deep-dive, and ADR lookup are
  separate processes; this skill is the breadth-first complement.
