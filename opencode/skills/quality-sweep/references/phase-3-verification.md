# Phase 3 — Verification: detailed checks

> Enrichment reference for the quality-sweep skill. Concrete, generalized
> checks mined from real improvement history. Evidence arbitrates: a check is
> PRESENT only with a cited artifact; absence is a finding.

**Shard ownership.** This is the phase-3 evidence shard. It scores exactly the
four dimensions below (Testing, Lint/format/style, Performance, Chaos/fault
injection & load/soak). No facet dimensions live here.

**Probe floor is mandatory.** A dimension may be scored `ABSENT` only after its
probe floor below has been executed and its transcript recorded — including the
relevant toolchain-adapter command (`test`, `lint`) with its real exit code.
`ABSENT` means "these specific probes returned nothing", never "I didn't find
anything". Testing, Performance, and Chaos are graded dimensions: complete the
probe floor even after a first hit, so the score reflects coverage, not
first-touch luck.

## Testing

Good testing proves behaviour, not implementation. Every test earns its keep by
being able to FAIL for a real reason: it was seen red before the fix, it asserts
observable behaviour, and mutating the code under test flips it. The single
strongest signal in the corpus is red-first discipline plus relentless hunting
of tests that pass vacuously.

**Checks:**
- Red-first discipline: the failing test was written against current HEAD and
  observed to fail FOR THE RIGHT REASON (the target defect, not a compile error
  or unrelated assertion) BEFORE the implementation landed. Look for a cited
  red→green commit-hash transition or a journal note; "test added in same commit
  as fix" is not proof of red.
- A test that passes on unpatched HEAD does NOT reproduce the bug — it is a
  broken reproduction, not a regression guard. Treat a green-on-old-code test as
  a finding.
- Regression pin per fixed defect: every closed bug has a test that fails if the
  defect silently returns. The pin asserts the specific corrected behaviour
  (e.g. the exact off-by-one, the excluded item, the fenced double-append), not
  a generic smoke path.
- Assertion strength: mutate the code the test claims to cover (flip a branch,
  change a constant); the test MUST go red. If mutation leaves it green the
  assertion is tautological — rewrite it, don't count it as coverage.
- Characterization before change: before refactoring untested behaviour, pin the
  CURRENT observable behaviour with a characterization test so the refactor is
  provably behaviour-preserving. Structural and behavioural changes stay in
  separate commits.
- Property-test key invariants rather than only example cases: round-trip
  (encode→decode equals original), ordering / total-order, idempotence,
  monotonicity, clamp/boundary. Confirm the generator's precondition is REAL —
  a strategy that never emits the interesting case (e.g. never generates
  distinct ids) proves the property vacuously.
- Boundary and edge coverage: off-by-one is the top unit falsifier — test the
  N-1 / N / N+1 boundary, the empty/degenerate input, the None-fallback, and the
  clamp ceiling explicitly, not just the happy midpoint.
- Golden / snapshot fixtures are correctness ORACLES for wire formats and
  rendered output: assert the SAME bytes/output as before across a change. A
  moved golden is a red flag to HALT and explain, never to silently re-bless the
  constant to make the test pass.
- When a preserved-invariant test fails during a change, reconcile or surface it
  — never weaken the assertion (e.g. broadening a specific-id check to
  `contains("warning")`) to get green.
- Test-retirement hygiene: deleting mechanism-coupled tests is fine only when
  equivalent behavioural coverage is cited upstream; a net coverage drop with no
  replacement is a finding.

**Probe floor (mandatory before ABSENT):**
- Run the adapter `test` command; record exit code and pass/fail counts (never fabricate).
- Locate test files (`rg -l '#\[test\]|#\[tokio::test\]|it\(|describe\(|def test_'` / conventional `tests/`, `__tests__/`, `*_test.*`).
- Grep for red-first / regression-pin evidence (`rg -i 'regression|reproduc|red.?green'`; scan bugfix commits for paired tests).
- Grep for property tests (`rg 'proptest|quickcheck|fast-check|hypothesis'`).
- ABSENT only if the adapter `test` finds no tests AND no test files exist — record the transcript with the exit code. (Graded: finish the floor even after a hit.)

**Anti-patterns to hunt:**
- test-after-the-fix (no red proof) — test and fix land in one commit; no
  evidence it was ever seen failing.
- broken reproduction — new test passes against unpatched code; it does not
  exercise the bug it claims to guard.
- tautological / vacuous test — assertions that restate what the code just did;
  mutating the code under test does not flip the test.
- vacuous-green by absence — test silently skips its assertions when a host path,
  fixture, or feature is missing (e.g. gated on an absolute local path absent in
  CI), so it "passes" without verifying anything.
- assertion-free test — exercises a path but asserts nothing meaningful (or only
  that it didn't panic).
- coverage theatre — claims full coverage while missing the critical branch;
  high line-coverage number with no branch/boundary assertions.
- golden re-bless reflex — updating the expected constant/snapshot to match new
  output instead of investigating why it moved.
- test weakening under pressure — loosening an assertion so a failing test goes
  green rather than fixing the code or confirming the new behaviour is correct.

## Lint / format / style

Good static hygiene means the linter runs clean at the strictest practical level,
suppressions are rare and individually justified, formatting is enforced not
negotiated, and house-style rules are actually gated rather than aspirational.
(Tool names and exact flags belong in the toolchain adapter; the checks below are
the intent.)

**Checks:**
- Linter runs clean at the strictest practical level as a HARD gate (warnings
  treated as errors), not an advisory that scrolls past. Confirm the gate fails
  the build, and that it covers all targets (lib, tests, examples), not just the
  default build.
- Formatter is enforced in a check mode that fails on drift; a pure-format fixup
  is in-scope and self-contained (re-run to confirm clean), and does not smuggle
  behavioural change.
- Suppressions are per-item, rare, and carry a stated rationale — never a
  blanket file- or module-wide silence of a whole lint class. Each suppression
  should name WHY (framework requirement, deliberate test-only allowance, a
  contract the lint can't see).
- Suppression audit: count them and read each. A suppression that could be
  removed by a rename/extract/restructure is a finding; the code should read as
  its own explanation rather than being silenced.
- House-style rules are machine-gated where possible (a custom lint or check),
  not left to review vigilance. If a style rule exists only in prose and nothing
  enforces it, that gap is the finding.
- New lint activation is treated as additive scope (expect new findings) and the
  backlog is triaged, not mass-suppressed to restore green.
- A style/lint rule that produces mass false positives is itself a defect: retire
  or narrow the rule rather than teaching contributors to blanket-allow it.
- Verify-run hygiene: re-running the identical lint/format/test gate repeatedly
  against an unchanged tree is waste, not diligence — re-run gates only after an
  intervening change.

**Probe floor (mandatory before ABSENT):**
- Run the adapter `lint` command; record exit code and whether warnings fail the build.
- Locate lint/format config (`rg -l 'eslint|prettier|ruff|flake8|clippy|rustfmt|.editorconfig'` / conventional config files).
- Grep for suppressions and their justification (`rg '#\[allow|eslint-disable|# noqa|# type: ignore'`).
- Grep CI for a lint gate step (`rg -i 'lint|clippy|fmt.*check' .github/ .gitlab-ci.yml` or equivalent).
- ABSENT only if no linter is configured AND the adapter `lint` reports no tool — record the transcript with the exit code.

**Anti-patterns to hunt:**
- blanket lint suppression — a file/module-wide allow that silences a whole class
  of diagnostics instead of fixing or justifying per-site.
- unjustified suppression — a per-item allow with no rationale; nobody can tell
  if it's load-bearing or lazy.
- advisory-only linter — lint runs but doesn't fail the build; drift accumulates.
- format-drift tolerated — no enforced check mode; formatting argued in review.
- aspirational house style — a documented convention with zero enforcement.
- mass-suppress-to-green — silencing a newly-activated lint's whole backlog to
  restore a green gate instead of triaging.
- paranoid re-confirm — re-running an already-green gate N times with no
  intervening change (observed: a full gate re-run 9–11× in one session).

## Performance

Good performance work is measured against a baseline, targets the actual hot
path, and defends known-good numbers with a gate. The corpus shows concrete
latency/memory targets (sub-100µs serve paths, a 164MB retention peak, per-cycle
memory budgets) and a strong preference for provable bounds over vibes.

**Checks:**
- Baseline exists and is tracked: a benchmark without a recorded baseline can't
  detect regression. Confirm hot-path benchmarks (the operations on the critical
  path) have committed baseline numbers.
- Regression is gated, not hoped: a measurable perf budget (latency percentile,
  peak memory, allocation count on the hot path) is asserted somewhere a
  regression trips — ideally a CI budget check, at minimum a documented target
  with a re-measure step.
- Hot path is identified by measurement, not guess: profiling/measurement
  evidence names where time and allocation actually go before any optimization.
  An "optimization" with no before/after number is unverified.
- Read/serve-path protection: changes near a measured fast path (e.g. a
  zero-allocation dispatch, a µs-scale serve) are checked for latency/allocation
  regression, including second-order effects (an allocator swap that trades
  throughput for tail latency).
- Memory bound is provable where it's a stated priority: a worst-case peak is
  either computed from declared maxima (max-items × max-size × max-workers) or
  demonstrated under a load test with headroom below the deployment limit — not
  assumed.
- Percentiles over averages: latency is tracked at p50/p95/p99 (tail matters);
  a single mean hides the tail that actually hurts.
- Build-time / profile discipline: profiling or perf-specific build profiles are
  isolated (dedicated profile or env toggle) and NOT committed into the default
  build config; measurement scaffolding doesn't leak into shipped artifacts.
- Measurement excludes noise: perf metrics filter out non-comparable events (e.g.
  long-lived connection lifetimes counted as request latency) so the number
  reflects the thing being optimized.

**Probe floor (mandatory before ABSENT):**
- Grep for benchmarks (`rg -l 'criterion|#\[bench\]|benchmark|bencher|hyperfine'` / conventional `benches/`).
- Grep for committed baselines / perf budgets (`rg -i 'baseline|budget|p95|p99|latency|throughput'`).
- Grep for profiling evidence or perf-specific build profiles (`rg -i 'flamegraph|perf|profil|\[profile'`).
- ABSENT only if no benchmark, baseline, or perf target exists — record the transcript. (Graded: finish the floor even after a hit.)

**Anti-patterns to hunt:**
- benchmark without a baseline — a bench exists but nothing records or compares
  the prior number, so regression is invisible.
- optimization by assertion — a change claimed faster/leaner with no before/after
  measurement.
- guessed hot path — effort spent optimizing code no profile implicates.
- mean-only latency — averages reported, tail percentiles ignored.
- assumed memory bound — peak memory claimed safe with no computed worst case or
  load evidence; blows the deployment limit under real load.
- profiling config committed — perf/debug profile or allocator override leaks
  into the default build.
- noisy metric — perf number contaminated by non-comparable events and used to
  justify a change anyway.

## Chaos / fault injection & load / soak testing

Good adverse-condition testing subjects the system to sustained load, injected
faults, and crash/interrupt at the worst moment, then asserts it recovers
correctly. The corpus is thinner here than testing but concrete where present:
crash-injection mid-write (SIGKILL between sync and footer-write), N-times soak
loops for flake windows, fuzzing of parse/recovery entry points, and concurrent
two-writer race tests that assert exactly-one-wins.

**Checks:**
- At least one adverse-condition test exists for any component with a durability,
  concurrency, or availability contract — its ABSENCE is the primary finding for
  such components.
- Crash / interrupt injection at the dangerous instant: kill the process
  mid-operation (e.g. between the durable sync and the commit/footer write) and
  assert recovery yields a consistent state, not a torn or zero-byte artifact.
  Confirm the kill lands at the pre-commit window, not a benign point.
- Soak / repeat loop for rare races: the flake-prone path runs N times
  (dozens–hundreds) under an explicitly-ignored/opt-in test and asserts zero
  failures across the run, surfacing timing windows a single pass misses.
- Fuzzing on untrusted-input boundaries: parse/decode/recovery entry points that
  ingest external or on-disk bytes have a fuzz target that feeds arbitrary input
  and asserts no panic / no unsound state (resource limits bound allocation
  before it happens, so a malformed input can't OOM).
- Concurrency tests achieve REAL concurrency: a "concurrency limit" or
  "two-writer" test drives genuinely in-flight overlap (e.g. holds requests open
  on a barrier) rather than sending N+1 sequential requests. Sequential-N does
  not test concurrency.
- Contention asserts a single winner + no corruption: a two-writer/race test
  asserts exactly one operation succeeds, the loser gets a typed conflict and
  aborts (no retry-spin), and there are zero duplicate/torn committed records.
- Fault-injection asserts the recovery PATH, not just the absence of a crash: the
  test exercises the real failure branch (transient auth burst, publish failure,
  torn write) and confirms the documented recovery/fallback actually runs and is
  faithful (surfaces the true cause, doesn't mask it as a different error).
- Adverse tests are non-vacuous like any other: verify the injected fault is
  actually reached and the recovery assertion can fail — a crash-recovery test
  gated on an absent host artifact is vacuous-green.

**Probe floor (mandatory before ABSENT):**
- Grep for adverse-condition tests (`rg -l -i 'chaos|soak|fault.?inject|crash|sigkill|fuzz|loom|--count'`).
- Grep for fuzz targets (`rg -l 'fuzz_target|cargo-fuzz|libfuzzer|jazzer'` / conventional `fuzz/`).
- Grep for real-concurrency tests (barrier/latch-driven, not sequential-N) (`rg -i 'barrier|latch|two.?writer|concurrent'`).
- ABSENT only if the target has a durability/concurrency/availability contract AND none of the above exist — the absence is itself the primary finding. Record the transcript. (Graded: finish the floor even after a hit.)

**Anti-patterns to hunt:**
- no adverse-condition test at all — a component with a durability/concurrency/
  availability contract has only happy-path coverage. (history: the most common
  gap.)
- fake concurrency — "concurrent" test issues sequential requests; the limit/race
  is never actually exercised.
- benign-point crash injection — process killed at a safe moment, so the torn-
  write / partial-commit window is never hit.
- crash test that only checks "didn't panic" — no assertion that recovery
  produced a consistent, correct state.
- fault masked, not surfaced — recovery path rewrites the true error as an
  unrelated one; the test passes but hides the real failure cause.
- single-pass race test — timing-dependent bug "tested" once, never looped, so
  the flake window stays open. (history-thin: soak loops present but sparse.)
- unbounded-input fuzz — parser fuzzed with no resource limit, so a decompression
  bomb / oversized input is a real DoS the fuzzer would itself trip.
