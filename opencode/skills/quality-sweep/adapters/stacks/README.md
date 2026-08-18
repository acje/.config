# Stack-profile adapter

Phase-1 through phase-7 checks are generic by design — the reference files
under `references/` hold a stack-neutral probe floor for every dimension.
This adapter is the swappable data layer for *stack-specific depth*: it
supplies extra probes, anti-patterns, and exemplars for a bound ecosystem,
without touching what the reference files already cover for every stack.

A stack profile never replaces the generic floor by default; it narrows and
deepens it for one ecosystem, per the composition rule below.

## Composition rule (ADD-BY-DEFAULT, REPLACE-ONLY-WHEN-MARKED)

- A stack profile entry ADDS probes to the generic phase reference's probe
  floor by default. The generic floor still runs.
- An entry may REPLACE a named generic probe line only when it carries an
  explicit `replaces:` marker naming the exact generic probe text it
  displaces.
- **Anti-cheapening guard.** A replacing entry MUST supply at least as many
  distinct probes as the generic probe it displaces. A profile may never
  reduce the number of probes that must complete before ABSENT is earned. If
  a stack genuinely has no equivalent probe, the entry records "no stack
  equivalent — generic probe stands" and the generic probe still runs.
- A profile supplies PROBES, ANTI-PATTERNS, GOOD-LOOKS-LIKE exemplars, and
  TOOLCHAIN commands. It NEVER supplies a score, and NEVER pre-declares a
  dimension N/A. N/A stays earned per service from evidence with a one-line
  reason.

## Depth contract

Only dimensions where the stack MATERIALLY changes the probe get an entry.
Dimensions with no stack-specific delta are OMITTED and inherit the generic
reference — an omitted dimension means INHERITS GENERIC, never "not
applicable". Budget: each profile file <= ~150 lines, entries for roughly
8-14 of the 29 dimensions. Breadth over depth; do not restate generic
reference content.

## Profile file format

Each `adapters/stacks/<stack>.md` file opens with a header block stating:

- stack name
- detection markers (files/manifests that identify this stack)
- the four toolchain slots (`test`, `lint`, `audit`, `deny`) per
  `adapters/toolchains.md`
- the depth contract sentence (link back here)
- the omitted-means-inherits-generic sentence

Then per-dimension entries, keyed by **phase number + dimension name exactly
as they appear in `SKILL.md`'s 29-dimension list** (so a shard can key off
them unambiguously). Each entry carries:

- **probes** — concrete greps/paths/commands for this stack
- **anti-patterns** — named, stack-idiomatic
- optional **replaces:** marker naming the exact generic probe text displaced
  (see composition rule)

Keep entries terse and tabular where a table fits.

## Per-service binding contract

Phase 0 binds a stack profile to each discovered service, alongside its
toolchain row (see `SKILL.md` Phase 0). A phase-1 shard, when scoring a
dimension for a service, loads the generic phase reference AND the service's
bound stack profile(s), and composes them per the rule above. The generic
probe floor always runs regardless of which profile is bound.

## Unseeded-stack fallback

A service whose ecosystem has no `adapters/stacks/<stack>.md` file runs the
generic reference only. Record the bound profile as `none (unseeded)` in the
report — this MUST be visible so a reader never mistakes a generic sweep for
a stack-aware one. Do not withhold the toolchain row when the stack profile
is unseeded: a service can have a real toolchain adapter row (e.g. python)
and still be `none (unseeded)` on the stack-profile layer.

## Polyglot single root (one service, two stacks)

Consistent with dedup-by-filesystem-root (`adapters/services.md`), a root
with two stacks (e.g. a Rust binary embedding a TypeScript frontend) stays
ONE service with ONE report. Bind a PRIMARY profile — the stack owning the
deployment/entrypoint signal that made it a service — plus SECONDARY
profiles whose probes are added. Secondary profiles never get their own
report and never re-score a dimension; their probes fold into the primary
service's single scorecard.

## Adding a stack profile

1. Copy the header block shape from an existing profile (`rust.md` is the
   reference implementation).
2. Walk the 29 dimensions; for each one ask whether this stack's idiom
   changes the probe materially. If not, omit the entry — it inherits the
   generic reference.
3. For each included dimension, write concrete probes (real greps/commands
   for this stack's tooling) and name 3-6 stack-idiomatic anti-patterns.
4. Only add a `replaces:` marker when a generic probe line is stated in
   ecosystem-neutral terms that this stack can supply a strictly stronger,
   equal-or-greater-count replacement for. Default to ADD, not REPLACE.
5. Pull the stack's toolchain row from `adapters/toolchains.md` (or add one
   there first if it doesn't exist yet) for the four toolchain slots.
6. Keep the file under the ~150-line budget; breadth over depth.
