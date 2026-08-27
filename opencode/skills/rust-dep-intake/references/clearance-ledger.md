# The clearance ledger — surviving routine use

Tiering solves **breadth**: a 400-crate closure with a two-node delta is a
two-node review. It does nothing for **recurrence**: the same ~40
build-script-carrying crates coming back every sprint. A skill whose cost does
not amortize is a skill that gets skipped, and a skipped gate is no gate.

The ledger is what makes the second run cheaper than the first. One mechanism is
mandated here — `cargo-vet`. Do not substitute a bespoke ledger file; a second
format nobody validates is how ledgers rot.

All commands below were verified live against the installed `cargo-vet`
(`cargo vet help <subcommand>`). Flags not listed here were not verified — check
`--help` before using one.

## Why cargo-vet and not a text file

| Requirement | `cargo-vet` |
|---|---|
| Records `(crate, version)` + criteria + reviewer + notes | `audits.toml`, machine-readable, in-repo, reviewable in PR |
| Consulting it is a command, not a habit | `cargo vet check` |
| Computes the outstanding review set | `cargo vet suggest` |
| Handles the version-changed case as a **diff** | `cargo vet certify <crate> <v1> <v2>` (delta audit) |
| Survives handoff between people and agents | It is a file in the repo, not one reviewer's memory |

A plain ledger file can hold the first row. It cannot hold the rest without
someone writing and maintaining the tooling that already exists here.

## Setup (once per project)

```
cargo vet init
```

VERIFIED behaviour: this adds `exemptions` and `audit-as-crates-io = false` for
everything currently in the tree so `check` passes immediately, then you work the
backlog down with `suggest`. The initial exemption set is **not** a clearance —
it is a to-do list. Do not read a green `check` on day one as "all reviewed".

## Step 1 — Consult, at the T2→T3 boundary

Run this **before** computing the T3 set, not after reviewing.

```
cargo vet check      # cleared pairs pass; unaudited ones are reported
cargo vet suggest    # the review backlog, with the command to audit each item
```

`suggest` is `check` with exemptions temporarily removed — it is the honest view
of the backlog. Per its own help text: do not run `suggest` while `check` is
failing, because the output is worse information.

The T3 set is then:

```
T3 set = (crates with changed build-time surface, per SKILL.md T3)
         MINUS (pairs already cleared in the ledger)
         PLUS  (cleared crates whose version moved -> DIFF, not a fresh read)
```

Anything the ledger clears drops out **before** anyone opens a `build.rs`.

## Step 2 — Record, after T3/T4 clears

Full audit — a crate reviewed at one version, first time:

```
cargo vet certify <crate> <version>
```

Delta audit — a crate you previously cleared, now bumped. **This is the common
case on a routine update** and is the whole point of the ledger:

```
cargo vet certify <crate> <cleared-version> <new-version>
```

VERIFIED: with two versions supplied, `certify` records a diff from
`version1 -> version2` rather than a full audit of `version2`. That matches the
work you actually did — you diffed the build-time surface against the cleared
version (`source-diff-recipes.md` §(a)), you did not re-read the crate.

Verified optional flags on `certify`: `--criteria <CRITERIA>`, `--who <WHO>`,
`--notes <NOTES>`, `--accept-all`, `--force`. Record *what* you reviewed in
`--notes` — for this skill, that the build-time surface was enumerated and read:

```
cargo vet certify <crate> <old> <new> \
  --notes 'rust-dep-intake T3: build.rs/build=/links=/proc-macro/[build-dependencies] diffed, no new build-time surface'
```

To obtain the diff itself:

```
cargo vet diff <crate> <version1> <version2>
```

VERIFIED: `diff` takes exactly `<PACKAGE> <VERSION1> <VERSION2>` and accepts
`--mode local|sourcegraph|diff.rs`. `--mode local` keeps the review offline;
extraction is inert and executes nothing. `source-diff-recipes.md` remains the
tool-free equivalent when `cargo-vet` is not installed.

## The trust boundary — what a clearance is and is not

A clearance is **evidence about one specific `(crate, version)` tarball**. It is
not a statement about the crate, the author, or future versions.

A clearance is **void**, and the pair returns to the T3 set, when:

- the version changed (handled as a delta audit above — void, not carried over);
- the **publisher identity** changed (§O), or the publishing account is younger
  than the crate it publishes into;
- the crate's **source** changed — registry to git, a `[patch]` was introduced,
  the git `rev` moved (§N);
- the tarball for that exact version changed underneath you — a `cksum` mismatch
  against the sparse index.

**The ledger never suppresses the cheap signals.** §Y (yank census), §P (publish
clustering) and §O (publisher identity) are metadata lookups costing seconds, and
they are precisely the signals that detect account takeover — the case where the
crate you cleared last month is now published by someone else. They run on every
node in the delta on every run, cleared or not.

Ordering, and it is not negotiable:

```
hard stops (SKILL.md §Verdict)  >  T2 cheap signals  >  ledger clearance
```

A `Halt` overrides any clearance. A ledger that can suppress a hard stop is a
bypass, not a ledger.

## Non-registry sources

`cargo-vet` is built around crates.io `(crate, version)` pairs. Per
`triage-signals.md` §N:

- **`rev`-pinned git dep** — clearable in principle, because the sha is stable;
  record the sha in `--notes`, and treat any sha movement as void.
- **Floating git dep (`branch`/`tag`, no `rev`)** — **not clearable.** There is no
  stable artefact to certify: the head re-resolves and a tag can be re-pointed.
  It is `Investigate` on every run until it is `rev`-pinned. This is a reason to
  pin, not a reason to relax the rule.
- **path / workspace-internal** — out of scope for the ledger; these are
  first-party code and belong to normal review.
- **alternative / vendored registry** — clear it against the vendored tree diff,
  and record in `--notes` which registry the artefact came from.

## What "the ledger earned its lines" looks like

First run on a project: 40 build-script-carrying crates in the T3 set, 40 reads,
40 `certify` calls. Expensive, once.

A month later, `cargo update` bumps 3 of those 40 by a patch version and changes
nothing else. `cargo vet check` passes the 37 untouched pairs and reports 3;
`cargo vet suggest` prints those same 3 as the backlog. The work is **3 delta
diffs**, not 40 reads — and the 3 diffs are scoped to what changed between the
cleared version and the new one.

If a second run does not visibly shrink, the ledger is not being consulted before
the T3 set is computed. That is the step being skipped.
