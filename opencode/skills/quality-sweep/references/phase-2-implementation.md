# Phase 2 — Implementation: detailed checks

> Enrichment reference for the quality-sweep skill. Concrete, generalized
> checks mined from real improvement history. Evidence arbitrates: a check is
> PRESENT only with a cited artifact (file:line); absence is a finding.

**Shard ownership.** This is the phase-2 evidence shard. It scores exactly the
five dimensions below (Refactor/readability, Correctness, Error handling,
Concurrency, Dead-code removal). **Type safety** surfaces at implementation
level here as context only — its home row and score belong to the phase-1
shard (facet-ownership rule, SKILL.md § The 29 dimensions). Do not score
Type-safety in this shard.

**Probe floor is mandatory.** A dimension may be scored `ABSENT` only after its
probe floor below has been executed and its transcript recorded (what was
searched / run, and the empty result). `ABSENT` means "these specific probes
returned nothing", never "I didn't find anything".

**State hygiene — "graded" is a closing rule, not a state.** Several dimensions
here are graded (Correctness especially): the probe floor must complete even
after a first hit. But a graded dimension still emits exactly one concrete
state — `PRESENT | PARTIAL | ABSENT | N/A`. Never return a category word
("GRADED", "binary", a phase name) in the state field; that is a shard-contract
violation the verifier auto-rejects. "Graded" describes how you *close* the
dimension (complete the floor), not what you *report* as its state.

## Refactor / readability

Good: functions are cohesive single-responsibility units small enough to hold
in the head; names distinguish near-twins; duplicated logic is extracted to one
named helper; structural (rename/extract/move) changes are committed separately
from behavioural ones; the code reads as its own explanation so no "why" comment
is needed.

**Checks:**
- Are oversized functions (the generalized intent behind `too_many_lines`)
  split into named cohesive helpers, rather than suppressed with a blanket
  allow? A per-site suppression left in place is a finding; cite the attribute.
- Are near-twin local variables renamed to distinguish their roles, and multi-
  phase procedures decomposed into named phases (e.g. `resume_and_populate`,
  `enqueue_and_await_batch`, `finalize_and_publish`)?
- Is duplicated logic consolidated into ONE helper at the shared call sites
  (e.g. a signal handler copied across two modules; a "lazy-index-or-create"
  block repeated across service methods; an open/rehydrate flow repeated across
  constructor variants)? Cite each duplicated site.
- Does a function take too many arguments / too many boolean flags (the intent
  behind `too_many_arguments`, `struct_excessive_bools`)? Prefer a parameter
  struct that decouples the callee from the caller's incidental types.
- Are structural and behavioural changes in separate commits (Tidy-First), so a
  reviewer can read the refactor without behaviour noise?
- Is the placement idiomatic for the paradigm in use (layering, module
  boundaries, public-vs-internal split), or does it fight the grain? State
  whether the current placement COINCIDES with, DIVERGES from, or is
  UNDERDETERMINED by the idiom.
- Are lint suppressions narrow and justified (`#[expect(lint, reason=...)]`
  over bare/blanket allows), and does each still fire? A blanket module-level
  allow is itself a finding.

**Probe floor (mandatory before ABSENT):**
- Grep for oversized-function / arg-count suppressions (`rg 'too_many_lines|too_many_arguments|excessive_bools|#\[allow'`).
- Grep for duplicated blocks (search a distinctive line from a suspected copy across the tree; check sibling modules).
- Check commit granularity: `git log --oneline -20` for structural+behavioural mixing tells.
- ABSENT only if no source to read OR the probes surfaced no readability signal to score — record the transcript.

**Anti-patterns to hunt:**
- God function — one function owning multiple responsibilities / exceeding a
  cohesion budget; masked by a `too_many_lines`-style suppression.
- Copy-paste cluster — the same block at N sites; tell: identical wiring in
  sibling functions/modules that could be one helper.
- Near-twin locals — two variables whose names don't encode the distinction,
  forcing the reader to re-derive it.
- Flag-drunk signature — long positional arg list or many booleans; call sites
  become inscrutable `foo(x, true, false, true)`.
- Blanket-allow shield — a crate/module-wide `allow` hiding many real items
  behind one suppression, blocking the smaller cohesive fix.
- Refactor-and-behaviour-in-one-commit — structural moves mixed with logic
  changes, so the diff can't be read.

## Correctness / bugfix

Good: edge cases (empty, max, boundary, overflow, archived/filtered, absent
config) are enumerated and tested; numeric conversions are checked not
truncating; denominators and population sets are scoped correctly; a bugfix
lands as a red→green reproduction of the real defect shape, not a guess; copy
and docs describe CURRENT behaviour, not aspirational behaviour.

**Checks:**
- Are widening/narrowing numeric casts audited? Flag lossy `as` casts on
  sizes/counts (e.g. `u64 -> u32`, `len as usize`); prefer checked conversion
  that surfaces a typed error or documented panic. Cite each site.
- Are the off-by-one / boundary conditions covered by a test written FIRST
  (e.g. "after an append acks seq N, the next expected value MUST equal N")?
  Half-open vs closed range confusion is a top defect source.
- Are overflow/underflow at type limits and empty/singleton invariants handled
  (e.g. `is_empty` under a len>=1 invariant, sentinel-vs-`Option`, index at
  MAX)?
- Is the population/denominator scoping correct for any ratio or aggregate
  (archived/excluded items counted or not counted consistently with the stated
  semantics)? A silently-wrong denominator is a correctness bug even when it
  compiles.
- Does user-facing copy / doc-comment describe the CURRENT behaviour? Hunt
  stale framing where prose claims a policy the code no longer implements.
- For each bugfix: is there a reproduction test that was RED before the fix and
  GREEN after, exercising the real shape (not an accidental adjacent scenario)?
- Are absent/malformed inputs handled deterministically (missing config,
  malformed file, unsupported feature, oversized body rejected before full
  processing)? Cite the guard.

**Probe floor (mandatory before ABSENT):**
- Grep for lossy casts (`rg ' as (u8|u16|u32|i32|usize|f32)'`) and classify each on a count/size path.
- Grep for boundary/edge tests (`rg -i 'off.?by.?one|boundary|empty|overflow|saturating|checked_'`).
- Grep for red→green reproduction evidence in bugfix commits (`git log --grep -i 'fix|bug' --oneline`; look for paired test additions).
- ABSENT only if no source and no tests exist OR the probes surfaced nothing — record the transcript.

**Anti-patterns to hunt:**
- Truncating cast — `as`-cast that silently drops high bits on a count/size;
  tell: `x as u32` where x is `u64`-sourced from data.
- Off-by-one at the fence — expected-value / range arithmetic with no first-
  written boundary test.
- Wrong denominator — a percentage/coverage metric that folds an
  excluded/unknown bucket into the base inconsistently with its own label.
- Stale-display bug — the value is correct in code but copy/doc still describes
  the old behaviour; reader misled.
- Guess-fix — a change with no red→green reproduction; may mask, not fix.
- Silent narrowing — a call discards fields of a richer result
  (`append` drops `AppendResult` data) with no documented intent.

## Error handling

Good: every fallible call either propagates a typed error or handles it
explicitly; error enums are exhaustive-by-intent with a single controlled
conversion chokepoint that fails closed; there is no path that discards a
durable-write failure or returns success on failure; `expect`/`unwrap` are
absent from production paths (or carry a precondition-naming message on a
genuinely-unrecoverable, documented invariant).

**Checks:**
- Enumerate `unwrap`/`expect`/`panic`/array-index on production (non-test)
  paths, especially on derivation/aggregation and external-input paths. Each is
  a finding unless it guards a documented, genuinely-unreachable invariant with
  a message that names the precondition. Cite file:line.
- Is every fallible call propagated (`?`/typed error) rather than
  `unwrap`/`expect`? Distinguish library error style (typed, structured) from
  binary/top-level style (context-carrying); flag `Box<dyn Error>` on public
  APIs without justification.
- Is there a single conversion chokepoint mapping backend/low-level errors to
  the domain taxonomy, with exactly ONE controlled wildcard that FAILS CLOSED
  to an unrecoverable/refuse variant — and NO per-call-site wildcard swallow?
- Do public error enums preserve their forward-compat / exhaustiveness
  discipline (the repo's `#[non_exhaustive]`-style policy), applied UNIFORMLY?
  Hunt consumer enums that escaped the discipline the libraries enforce.
- Is a failure on a durability/write path NEVER swallowed and NEVER reported as
  success (e.g. returning HTTP 200 on a failed durable write defeats upstream
  redelivery)? Classify each designed response as fatal | retry | degrade |
  swallow and flag every swallow with a real consequence.
- On the error path, is the full cause chain preserved (not flattened to a
  string), so operators see the originating error? Cite where the chain is
  logged/propagated.
- Where a mutex/lock can be poisoned, is recovery explicit
  (recover-inner-value) rather than an `unwrap` that turns one panic into a
  cascade? Cite the lock site.

**Probe floor (mandatory before ABSENT):**
- Grep production paths for `unwrap`/`expect`/`panic!`/index (`rg 'unwrap\(\)|expect\(|panic!|\[[0-9]' src/` excluding tests).
- Grep for typed error taxonomy and propagation (`rg 'enum .*Error|thiserror|anyhow|Box<dyn.*Error>|\?;'`).
- Grep for durable-write / success-on-failure tells (`rg -i 'return.*Ok|200|success' ` near persist/append/write paths).
- ABSENT only if the target has no fallible operations (state so) OR the probes surfaced no error-handling surface — record the transcript.

**Anti-patterns to hunt:**
- Unwrap in production path — `unwrap`/`expect` reachable from non-test code on
  data that can fail.
- Swallowed durable-write — a persist/append failure dropped or masked; tell:
  success returned / 200 emitted while the write did not land.
- Catch-all wildcard swallow — a per-call-site `_ =>`/catch-all that discards
  the cause instead of routing it through the typed chokepoint.
- Fail-open conversion — the single error-mapping wildcard defaults to a benign
  variant instead of failing closed to unrecoverable/refuse.
- String-flattened error — cause chain collapsed to a `String`, losing
  downcast/classification ability.
- Escaped-enum discipline — consumer error enums missing the forward-compat
  marker the libraries mandate; tell: a grep for the marker finds gaps.
- Poison-panic cascade — `unwrap` on a lock guard so one thread's panic
  poisons and crashes all others.

## Concurrency

Good: no lock guard is held across an await/suspension point; critical sections
are minimal (take guard, read/update, drop, THEN await); serialization intent is
legible (a 1-permit semaphore reads clearer than `Mutex<()>`); blocking/CPU work
is offloaded off the async reactor and the offload handle is awaited; queues are
bounded with explicit backpressure (try-send → full-signal); shared mutable
state is per-instance, not global; concurrent-path invariants have regression
tests.

**Checks:**
- Audit every critical section that spans I/O or an await: is any lock guard
  held across an `.await`? The correct shape is acquire → read/update → release
  → then await. Cite each guard whose scope crosses a suspension point.
  (Exception worth noting: an async-aware mutex intentionally held across await
  is legitimate; a sync/std mutex held across await is the defect.)
- Is blocking or heavy-CPU work moved off the async reactor (offload primitive),
  and is the offload handle actually awaited in the same function (an un-awaited
  spawn is a leak/ordering hazard; an awaited one is correct)?
- Are queues/channels bounded with explicit backpressure — a try-send that
  returns a "full" outcome and a rollback — rather than unbounded growth? Can a
  slow consumer on a broadcast/fan-out cause unbounded memory or silent lag/drop?
  Cite the bound and the lag policy.
- Is there a TOCTOU window on any check-then-act (lock acquisition, lazy-index
  populate, file create-then-read)? Two concurrent callers on the same key must
  not both "miss" and both proceed. Cite the window.
- Is shared mutable state scoped per-instance rather than a global static that
  parallel tests/tasks race on? Hunt global mutable state as a race source.
- Is serialization intent legible — a 1-permit semaphore or named gate over a
  bare `Mutex<()>` — and is it documented as serialization, NOT mistaken for a
  correctness fence/guarantee it doesn't provide?
- Do concurrency invariants have deterministic regression tests (single-winner
  under N racers, no self-fence on a single serialized writer, no double-apply
  under redelivery, race-free wait, underflow/zero-capacity/zero-worker guards)?
- On file durability paths: is fsync placed AFTER each record write before
  returning success, with atomic-rename or append-only discipline, and is
  truncated-trailing-record recovery handled on replay? Kill-mid-write must not
  yield zero-byte/torn state.

**Probe floor (mandatory before ABSENT):**
- Grep for async + lock combos (`rg 'lock\(\)|Mutex|RwLock'` and check for `.await` within guard scope).
- Grep for bounded channels / backpressure (`rg 'bounded|try_send|Semaphore|channel\('`).
- Grep for concurrency regression tests (`rg -l -i 'concurren|race|winner|barrier'` in tests).
- ABSENT only if the target is single-threaded with no async/shared state (state so) OR the probes surfaced nothing — record the transcript.

**Anti-patterns to hunt:**
- Lock held across await — sync/std guard alive across a suspension point;
  deadlock/contract risk; tell: guard binding outlives an `.await` in scope.
- Heavy work on the reactor — CPU-bound or blocking I/O inside an async block
  with no offload; starves the executor.
- Un-awaited offload — blocking work spawned off-thread but its handle never
  awaited, breaking ordering / dropping results.
- Unbounded fan-out — broadcast/channel with no backpressure; slow consumer →
  unbounded memory or silent lag-drop.
- TOCTOU on check-then-act — concurrent callers both pass a check and both act
  (orphan stream, double create, double-acquire lock).
- Global-static race — shared mutable static that parallel tests/tasks mutate;
  flaky under concurrency; fix is per-instance state.
- Fence-confusion — an intra-process serialization gate documented/relied on as
  the distributed correctness fence it is not.
- Missing fsync/torn write — durability write returns success before fsync, or
  no atomic-rename; kill-mid-write leaves torn/zero-byte data.

## Dead-code removal

Good: unused items, dead branches, orphaned modules, and stale planning docs are
removed rather than shielded with suppressions; there are zero commented-out
code blocks and zero migration/TODO scaffolding left behind after the migration
lands; suppression of "unused" lints is temporary and justified, never a
permanent mask over genuinely-removable items.

**Checks:**
- Are there items suppressed as "unused"/"dead" (the intent behind
  `dead_code`/`unused` allows) that are actually removable now? A standing
  suppression masking a real dead item is a finding; distinguish it from a
  documented deliberate scaffold ("planned, not yet used") with a tracking
  reference.
- Is there commented-out code left in the source? Remove it — version control is
  the archive. Cite each block.
- Are migration/TODO/temporary markers ("TODO", "FIXME", "HACK", "MIGRATION",
  "DEPRECATED", "BEFORE:/AFTER:", "Phase N", old-dependency names) left behind
  after the corresponding work landed? Sweep and remove; cite each.
- Are unused dependencies removed from the manifest (a declared-but-unreferenced
  dep), verified by zero references in src+tests? Cite the manifest line and the
  zero-reference evidence.
- Are unused error-enum variants, unused struct fields, and unused function
  parameters pruned (e.g. dropping a `_policy` param, deleting variants only
  ever matched never constructed)? Deletion shrinks the taxonomy without
  changing topology.
- Are orphaned modules / whole dead crates deleted, with proof no remaining
  references exist and no behaviour is silently lost (demoted-not-deleted must
  be explicit)? Cite the reference-check.
- Is duplicated dead structure collapsed (repeated open/rehydrate flows,
  duplicated macro definitions across crates) rather than left as parallel
  copies?
- Do "unused"-lint suppressions carry a reason and a plan, or are they permanent
  masks? A suppression that hides multiple real dead items is itself the finding.

**Probe floor (mandatory before ABSENT):**
- Grep for dead-code suppressions (`rg '#\[allow\(dead_code|unused'`).
- Grep for commented-out code and stale markers (`rg '^\s*// .*(fn |let |= )|TODO|FIXME|HACK|MIGRATION|DEPRECATED'`).
- Run the ecosystem's unused-dependency check if available (`cargo machete`/`cargo-udeps`, `depcheck`); else grep manifest deps against `src/`+tests references.
- ABSENT only if a clean unused-scan ran AND the greps returned nothing — record the transcript. (A truly clean tree is PRESENT-with-evidence, not ABSENT.)

**Anti-patterns to hunt:**
- Allow-masked dead item — `#[allow(dead_code)]`/unused suppression over code
  that is genuinely removable now; tell: the allow guards more than the one
  documented scaffold.
- Commented-out code — dead lines kept "just in case"; belongs in history.
- Stale migration scaffold — TODO/FIXME/"Phase N"/old-dep-name markers left
  after the migration completed.
- Zombie dependency — manifest entry with zero references in src+tests.
- Vestigial variant/field/param — enum variants never constructed, fields never
  read, params never used (dead `_`-prefixed args).
- Orphan module/crate — module or crate with no remaining callers, not yet
  deleted; risk of silent behaviour loss if demoted without a note.
- Parallel-copy debt — duplicated flow/macro kept as N copies instead of one
  source; cognitive-load and drift risk.
