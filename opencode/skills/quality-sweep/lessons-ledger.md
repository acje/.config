# Cross-repo lessons ledger (maintainer-local)

Durable, append-only record of generalizable learnings harvested via the
**user-guided Harvest workflow in `improving-this-skill.md`** — never run
automatically by a sweep. One row per lesson. Every lesson is evidence-cited.
Only lessons that are generalizable (ideally seen in ≥ 2 repos) get
**promoted** into the phase references / adapter; the rest stay here as
provenance and never bloat a reference.

This ledger is the **maintainer's own local accumulation** from repos they
personally inspected — it is not shipped engine data. A downstream adopter of
this skill may clear it and start their own by running the same
`improving-this-skill.md` workflow against their own repos.

Row shape: `{ date, repo, ecosystem, dimension, observation (cited),
generalization, disposition }`.

`disposition` records where a promoted lesson landed, or `ledger-only` for
repo-specific provenance.

The entry below (2026-07-18, skuffen) is retained as a **worked example** of
the row shape and promotion discipline, not as shipped engine data.

---

## 2026-07-18 — skuffen sweep + skuffen↔gh-report comparison

Provenance: `skuffen-sweep-2026-07-18` (epic `skuffen-dyu`, scored set
`skuffen-srf`); comparative inspection of gh-report ("solon", rust monorepo,
~25 crates, edition 2024, MSRV 1.97).

### B1 — Compiled-ecosystem central validation

- **date**: 2026-07-18
- **repo**: skuffen (rust)
- **ecosystem**: rust (compiled, shared `target/`)
- **dimension**: engine/operational (validation fan-out)
- **observation (cited)**: the skuffen run had to invoke the adapter commands
  (`test`/`lint`/`audit`/`deny`) once centrally rather than per-shard, because
  parallel phase shards contend on the shared `target/` build directory and
  waste rebuilds. The skill implied per-shard mechanical checks and did not
  state the central-run rule.
- **generalization**: for any compiled ecosystem with a shared build directory
  (rust `target/`, go build cache, dotnet `obj/bin`), run the four mechanical
  commands once centrally and share captured exit codes + transcripts with the
  shards. Interpreted ecosystems without a shared build artifact are exempt.
- **disposition**: PROMOTED → `SKILL.md` Phase 1 fan-out notes ("Compiled-ecosystem
  mechanical checks run ONCE, centrally") + `adapters/toolchains.md`
  (central-run note + anti-pattern).

### B2 — Exit code ≠ truth; interpret against config

- **date**: 2026-07-18
- **repo**: skuffen (rust)
- **ecosystem**: rust
- **dimension**: Security / Supply-chain (validation interpretation)
- **observation (cited)**: a PASSING `cargo audit` masked ignored advisories —
  skuffen's `.cargo/audit.toml` ignore list suppressed RUSTSEC-2023-0071 (RSA
  Marvin) plus 2 more. Separately, a FAILING `cargo deny` (exit 4) was merely
  "no/unconfigured deny.toml", not a real license violation.
- **generalization**: interpret each mechanical exit code against the tool's
  CONFIG before scoring. Green + ignore list = `PASS-WITH-IGNORES` (name the
  suppressed advisories); red from missing config = `UNCONFIGURED`, not a
  violation. Record the config basis in the probe transcript.
- **disposition**: PROMOTED → `SKILL.md` validation discipline (Don't-fabricate
  bullet + new exit-code bullet) + `references/phase-4-security.md`
  (exit-code anti-pattern) + `adapters/toolchains.md` (interpret-against-config
  note).

### B3 — Graded is a closing rule, not a state value

- **date**: 2026-07-18
- **repo**: skuffen (rust)
- **ecosystem**: rust
- **dimension**: engine/shard-contract + Phase 2.5 verifier
- **observation (cited)**: a phase shard returned "GRADED" (a category word) in
  the state field instead of a concrete state; the Phase 2.5 verifier had to
  resolve it to `PRESENT/PARTIAL/ABSENT`.
- **generalization**: graded dimensions STILL emit exactly one of
  `PRESENT | PARTIAL | ABSENT | N/A`. "Graded" names the closing rule (complete
  the probe floor after a hit), never a state value. A non-state/category label
  in the state field is an automatic verifier REJECT → resolve to a concrete
  state.
- **disposition**: PROMOTED → `SKILL.md` Phase 2 graded-dimension prose +
  Phase 2.5 verifier reject list + `references/phase-2-implementation.md`
  (state-hygiene note).

### B4 — N/A can coexist with a PRESENT sub-facet

- **date**: 2026-07-18
- **repo**: skuffen (rust)
- **ecosystem**: rust
- **dimension**: Safety / fail-safe
- **observation (cited)**: skuffen Safety scored `N/A` for physical safety but
  had a genuinely `PRESENT` data-integrity fail-safe sub-facet (fail-closed
  rehydrate gated on a schema marker). A flat `N/A` would have lost that
  evidence.
- **generalization**: when a dimension is `N/A` for its primary concern but an
  applicable sub-facet exists, score `N/A` with reason AND record the
  sub-facet's `PRESENT` evidence in the same row — don't lose it.
- **disposition**: PROMOTED → `SKILL.md` Phase 2 N/A rule +
  `references/phase-5-release.md` (Safety N/A-with-sub-facet check).

### B5 — Optional comparative reference exemplar

- **date**: 2026-07-18
- **repo**: gh-report (compared against skuffen)
- **ecosystem**: rust
- **dimension**: engine/Phase 0 input
- **observation (cited)**: inspecting gh-report right after skuffen sharpened
  both reviews — skuffen's gaps mapped directly onto gh-report's solved patterns
  (secrecy+zeroize, proptest/trybuild/insta/wiremock, deny.toml, digest-pinned
  Cloud Run deploy + SBOM + provenance, graceful shutdown), turning "does the
  target solve what the exemplar solved?" into concrete probes.
- **generalization**: allow an OPTIONAL Phase-0 input — a mature sibling/exemplar
  repo whose SOLVED patterns become an extra checklist. Guardrails: optional;
  evidence still arbitrates (never assume the exemplar is itself correct — its
  pattern is a probe to run, not a score to inherit); the exemplar sharpens
  probes, it does not set scores.
- **disposition**: PROMOTED → `SKILL.md` Phase 0 step 5 (optional reference
  exemplar).
