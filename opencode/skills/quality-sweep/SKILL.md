---
name: quality-sweep
description: Generic, shareable SDLC quality sweep of a codebase or crate. Scores 29 equally-weighted quality dimensions across 7 SDLC phases and produces a prioritised, evidence-arbitrated report. Every verdict is decided by cited evidence, never by a prior. NOT a per-change gate — a standalone breadth-first sweep run on demand. Use when the user asks to "run a quality sweep", "SDLC quality audit", or "quality process", or wants a periodic codebase health check. For per-diff review use a dedicated code-review process instead.
---

# Quality Sweep

A generic, breadth-first SDLC quality sweep. It scores 29 dimensions across 7
phases against **one target codebase** and produces a prioritised report. The
engine is target-agnostic and self-contained; one swappable data layer tunes it
to the target's ecosystem:

- **Toolchain adapter** (`adapters/toolchains.md`) — maps the target's
  ecosystem to `{test, lint, audit, deny}` commands (rust / node / python / …).

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
a cited artifact is a genuine pass. A single concrete artifact **closes** a
dimension — do not keep interrogating something that has already produced
evidence.

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
1. Resolve target: crate / workspace / service path. State it before starting.
2. Detect the ecosystem and pick the matching row from
   `adapters/toolchains.md`. State it.
3. Read `AGENTS.md` (or equivalent), relevant ADRs/architecture docs, and any
   available code-graph. Note committed conventions so findings judge against
   *this* codebase's contract, not a generic one.
4. Record the sweep timestamp, target, and ecosystem in the report header.

### Phase 1 — Evidence pass (all 29 dimensions, equal rigour)
For every dimension, search for concrete presence-evidence. Use the
toolchain-adapter row for the mechanical checks:
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
`PARTIAL (…)`, or `ABSENT — no evidence found`. `PRESENT` **must** carry a
concrete artifact; "looks fine" is never a pass. A single concrete artifact
closes a dimension — do not keep interrogating it.

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

Prioritise findings by **risk = blast-radius × irreversibility × likelihood**.
`ABSENT` items on a production/public artifact are medium+ by default
(data-migration and API-versioning gaps are classic expensive-later failures).

### Phase 3 — Report
Write the report to the configured report path (default `.ooda/`, gitignored):
`<report-dir>/quality-sweep-<target>-<timestamp>.md`. Use the template below.

---

## Report template

```markdown
# Quality Sweep: <TARGET>

**Date**: <ISO>
**Target**: <crate/workspace/service path>
**Ecosystem**: <rust | node | python | …>

## Verdict

<2–3 sentences. Lead with where the evidence is thinnest — that is where risk
hides. State it as an evidence claim, not a prior.>

## Scorecard (29 distinct dimensions across 7 phases)

| Phase | Dimension | State | Evidence / gap |
|-------|-----------|-------|----------------|
| 1 Design | API/schema design | PRESENT/PARTIAL/ABSENT | … |
| 1 Design | Type safety *(facet: phase 2)* | … | one row; note impl-level enforcement |
| … | … | … | … |
| 5 Release | Data-migration safety | PRESENT | schema-version field at db/mod.rs:12; replay test tests/replay.rs:40 |
| 5 Release | Delivery performance (DORA) | N/A | no deployment pipeline (pure library) |
| … | … | … | … |

## Dimension notes

<terse: one line each where useful. PRESENT+evidence closes it; ABSENT/PARTIAL
is a finding. An evidence-free green is under-looked, not a pass.>

## Validation run

| Check | Result | Exit code |
|-------|--------|-----------|
| Tests (adapter test) | PASS/FAIL/SKIPPED | <n> |
| Lint (adapter lint) | … | <n> |
| Audit (adapter audit) | … | <n> |
| Deny (adapter deny) | … | <n> |

## Prioritised findings (risk-ordered)

1. **[MEDIUM+] <finding>** — phase <n>, dimension <name>. <one-line why it
   bites later>. Suggested next step: <triage-shaped, but do not execute>.
2. …

## What's solid

<brief acknowledgement of dimensions confirmed PRESENT with evidence — so the
report is honest, not just a gap list.>
```

---

## Final reply (terse, structured)

After writing the report, reply with:

```
Target: <path>   Ecosystem: <name>
PRESENT (with evidence): <n>   PARTIAL: <n>   ABSENT: <n>   N/A: <n>
Top finding: <one line, risk-ranked #1>
Validation: Tests=<..> Lint=<..> Audit=<..> Deny=<..>
Report: <report-dir>/quality-sweep-<target>-<timestamp>.md
```

## Discipline

- **Evidence arbitrates.** A dimension is `PRESENT` only with a cited artifact
  (file:line / CI step / doc section); nothing is passed on a prior.
- **Green without evidence = under-looked; green with evidence = pass.**
- **All 29 dimensions are equal.** No weighting, no ranking, no bias — every
  dimension gets the same rigour.
- **Score each dimension once.** Cross-phase concepts (Type safety,
  API-versioning, Cost, Accessibility) are one scored row with a facet note,
  never a duplicate row.
- **Close on evidence.** A single concrete artifact closes a dimension and ends
  the interrogation. Do not re-litigate.
- **Don't fabricate validation.** Tool missing → `SKIPPED` with a reason.
- **Periodicity is a discovery trigger, not a cadence.** Route findings to your
  triage process signal-triggered; the sweep discovers, triage disposes.
- **Sweep reports; it does not fix.** Findings become work through your normal
  triage/build flow. The sweep never edits source.
- **Stay in lane.** Per-diff review, language deep-dive, and ADR lookup are
  separate processes; this skill is the breadth-first complement.
