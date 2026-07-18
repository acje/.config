# Improving this skill (maintainer, opt-in, user-guided)

This file is **not** part of a sweep run. `SKILL.md` never references it, and
a sweep **never auto-harvests** — running a quality sweep produces a report
and stops. This document is a separate, deliberate workflow for the skill's
**maintainer** to fold lessons learned across inspected repos back into the
shared engine (`SKILL.md`, `references/`, `adapters/`). You choose when to run
it; nothing in the sweep procedure triggers it.

If you are a downstream adopter of this skill, you can run this same process
against your own inspected repos, seeding your own local ledger — the process
is documented here (not hard-wired into the sweep) precisely so it is
reusable and shareable independent of any one maintainer's history.

## When you (the maintainer) choose to fold lessons back in

Whenever you decide a sweep run taught the skill something worth keeping —
not on a schedule, not automatically after every report — do the following:

1. **Harvest ≤ N generalizable lessons** (default N = 5) from the run — a
   lesson is anything the sweep *taught you about sweeping*: a probe that
   should have run, an exit code that lied, a state-hygiene slip, a scoring
   edge case, a sharper input. Repo-specific findings are NOT lessons — they
   belong in the report and the ledger's provenance, never in the shared
   references.
2. **Append each lesson to the ledger** (`lessons-ledger.md`, skill root — see
   below), one row per lesson: `{date, repo, ecosystem, dimension, observation
   (cited), generalization, disposition}`. The observation must carry the same
   evidence-arbitration discipline as a sweep finding — cite the artifact.
3. **Promote generalizable lessons into the references.** A lesson that is
   ecosystem- or SDLC-general (and *especially* one seen in ≥ 2 repos) is
   promoted into the relevant `references/phase-<n>-*.md` (or
   `adapters/toolchains.md`) as a new **probe-floor check** or **named
   anti-pattern**. Promotion is what closes the loop: the next sweep runs a
   probe mined from this one.
4. **Discipline — only generalizable lessons get promoted.** A repo-specific
   observation stays in the ledger/report as provenance; it must never bloat a
   shared reference. The ledger is the full record; the references hold only
   the distilled, reusable subset. Prefer ledger-first: write every lesson to
   the ledger, then promote the subset that clears the "generalizable /
   ≥ 2-repo" bar.

This workflow is additive to any sweep report; it never changes a dimension
score, the 29-dimension membership, the 7-phase model, or the
evidence-arbitration rule — it only feeds the *next* sweep's data layers.

## Where the ledger lives

The durable, append-only record of harvested lessons is `lessons-ledger.md`
at this skill's root (sibling to `SKILL.md` and this file) — not inside
`references/`, since it is not sweep engine data. See that file's header for
how it is scoped and how a downstream adopter should treat it.
