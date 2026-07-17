# Phase 5 — Release / Deploy / Migration: detailed checks

> Enrichment reference for the quality-sweep skill. Concrete, generalized
> checks mined from real improvement history. Evidence arbitrates: a check is
> PRESENT only with a cited artifact; absence is a finding. Safety and Delivery
> performance (DORA) are N/A for targets with no safety-critical function or no
> deployment pipeline respectively — state N/A explicitly with a one-line reason.

## Operational / runtime resilience

Good looks like: every failure mode has a bounded, observable, and *reacted-to*
response. Retries terminate. Concurrency is admission-controlled so a load spike
cannot exhaust memory. Shutdown reports the truth about what it did. Observability
is not write-only — the signals a system emits map to a documented operator
reaction (SLO bands: "fence firing as designed" vs "fence firing pathologically").

**Checks:**
- Every retry/redelivery/delivery loop is explicitly bounded — a maximum attempt
  count or total-time budget, then a terminal typed error. Point to the bound.
- Concurrent fan-out (over repos, users, partitions, work items) is bounded by a
  semaphore or admission-control gate, sized so the largest realistic input cannot
  blow memory. Unbounded channels/queues on an ingest path are a finding.
- Under sustained overload the system sheds load explicitly (returns a busy/503
  signal) rather than queueing without limit. There is a test that drives N > limit
  concurrent requests and asserts the excess are rejected, not silently queued.
- A degraded mode is defined and tested: on loss of a downstream dependency the
  system serves reads and rejects writes (or an equivalent documented posture),
  and recovers automatically on reconnection — with a test for both the degrade
  transition and the recovery transition.
- Graceful shutdown on SIGTERM/SIGINT drains in-flight work, flushes buffers, and
  the shutdown path reports the *actual* outcome (Completed vs Cancelled) — the
  success log must not fire on the cancelled path.
- Startup is resilient to transient dependency failure: a brief outage during
  startup (auth burst, dependency not-yet-ready) does not cause a cold-restart
  storm. Decide fail-fast vs bounded-retry-on-open deliberately and document which.
- Startup ordering is explicit: whether the process replays state / rebuilds
  projections / connects to dependencies *before* it binds its listener or accepts
  traffic is a documented decision, not an accident.
- Emitted signals have a documented operator reaction. For each key metric there
  is a healthy band, an alert/deviation condition, and a statement of what it
  discriminates — so on-call can tell "designed behaviour" from "pathology".
- Timeouts on every outbound operation are bounded and return a typed
  "unavailable" error within that bound; in-memory state is unchanged after a
  timeout (test it).

**Anti-patterns to hunt:**
- unbounded retry loop — no attempt cap or time budget; a stuck dependency spins forever.
- unbounded queue / channel — ingest with no backpressure; memory grows with load.
- no load-shedding — overload path queues instead of rejecting; latency climbs unbounded.
- shutdown-lies-on-cancel — success/"complete" logged on the SIGTERM-cancelled path.
- cold-restart storm — fail-fast startup that turns a transient dep blip into a crash loop.
- write-only observability — metrics emitted with no documented reaction / SLO band.
- no degraded mode — dependency loss takes the whole service down instead of read-only serving.
- allocator retention masquerading as leak — RSS plateaus post-op from page retention; distinguish live heap from OS-unreturned pages before "fixing" it.

## Data lifecycle & migration safety

Good looks like: schema changes are versioned, additive-only where possible, and
proven by a replay / round-trip test that old data still loads. The evolution
policy (roll-forward-only vs reversible) is written down and its failure mode
(what happens when old code meets new data, or vice versa) is stated. Corruption
and partial-write recovery paths are typed and tested, not implicit.

**Checks:**
- Every persisted format carries a version tag or schema hash, and reads of an
  older-version artifact produce a *specific* typed error (e.g. SchemaHashMismatch),
  never a silent misparse. Cite the version field and the mismatch handling.
- A replay / round-trip test proves old on-disk data still loads after a schema
  change: encode → persist → read-back → assert equality; or a stored-corpus replay
  that reconstructs identical state. This is the load-bearing migration test.
- The schema-evolution policy is documented: additive-only vs breaking, and whether
  rollback to code lacking newer variants is supported. Roll-forward-only must say
  so explicitly and state the consequence (older code meeting a newer variant
  panics / rejects) — an undocumented policy is a finding.
- Corruption recovery is typed and tested: a valid file with a deliberately
  corrupted region (invalid UTF-8, truncated multi-byte, bad checksum) is *rejected*
  with the specific variant for that corruption class — and the test proves it fails
  for the right reason, not incidentally at an earlier check.
- Partial-write / crash-mid-write recovery is defined: on restart the system
  handles present-and-valid, missing, and corrupt sidecar/cursor/journal states
  distinctly (e.g. missing → start-from-beginning; corrupt → typed error).
- Commit/checkpoint offsets are persisted durably (write + fsync) so recovery
  resumes from the true frontier, not from the beginning or a stale position.
- Retention is bounded and stated (not "grow forever"); if a store has no retention
  policy that is itself a finding for a long-lived deployment.
- Baseline / snapshot files that predate an upgrade have a migration or graceful
  fallback path — old snapshots on disk after upgrade must not crash or be silently
  ignored.
- Auto-migration posture is explicit: does open-on-mismatch auto-migrate, or refuse?
  Refuse-and-require-explicit-migration is a valid choice but must be documented.

**Anti-patterns to hunt:**
- schema change with no replay test — format changed, no proof old data loads.
- silent misparse on version skew — old artifact read as new shape, no version guard.
- undocumented roll-forward-only — no rollback but nothing says so; ops assumes reversibility.
- corruption test passing for the wrong reason — rejected at checksum before reaching the region under test.
- unversioned persisted format — no hash/version field; drift is undetectable.
- lost-frontier recovery — offset not fsynced; restart re-processes or skips.
- unbounded retention — store grows without a documented cap or sweep.
- snapshot-orphaned-on-upgrade — pre-upgrade baseline files neither migrated nor fenced.

## Reliability / availability / recoverability

Good looks like: the consistency stance is a declared, defended choice (e.g.
correctness-first PC/EC — consistency under partition and in normal operation,
accepting the latency cost), not an accident. Every write path under partition
either fences or has documented conflict resolution. Crash-recovery is a gated,
tested property of every stateful component, not an afterthought.

**Checks:**
- The consistency/availability stance under partition is explicitly declared and
  justified (which of correctness vs availability wins, and why for this workload).
  An undeclared stance is a finding.
- Every write path under partition either fences (rejects with a typed conflict) or
  has a documented conflict-resolution strategy. Silent divergence — two writers
  both "winning" — is forbidden.
- Concurrent writes to a single aggregate/entity are serialized (optimistic
  concurrency fence, single-writer, or equivalent) with a test asserting exactly one
  writer wins per cycle and the losers get typed conflict errors.
- Idempotency under redelivery is guaranteed and does not depend on a
  best-effort/expiring dedup window: a retry after the window expires must still be
  caught by the durable fence. Correctness flows down from the durable layer.
- Cross-entity causal dependencies are carried explicitly (stamp the observed
  sequence of the other entity; a dependent read fences to it or rejects within SLO)
  — not left to a "reads usually arrive after writes" assumption.
- Every stateful component has a green crash-recovery test as an admission gate:
  crash mid-operation → restart → state is consistent and the frontier is correct.
- Recovery reconstructs in-memory indices/projections from the durable log on
  startup (or from a snapshot proven equivalent to replay), so nothing correctness-
  bearing lives only in volatile memory.
- Degraded/partial reads can never fabricate a definitive negative: a failed or
  truncated fetch returns "unknown" (None), never "empty set" that would be read as
  a confident "nothing there" (the departed-everyone class of bug).

**Anti-patterns to hunt:**
- silent divergence under partition — concurrent writers both succeed; state forks.
- interleaved writes to one aggregate — no serialization; events interleave.
- dedup-window as correctness — load-bearing on an expiring best-effort window.
- acausal command — command computed on a read missing its own causal history.
- no crash-recovery gate — stateful crate admitted without a crash-recovery test.
- volatile-only state-of-record — indices/projections not rebuildable from the durable log.
- truncated-fetch-reads-as-empty — degraded fetch returns Some(empty) instead of None, producing false negatives.

## Delivery performance (DORA)

history-thin. The corpus is a personal / small-team library context with an
image-build + push and occasional managed-runtime deploy, not a metricated
delivery pipeline. Treat these as lightweight checks; mark the whole dimension
N/A when the target has no deployment pipeline.

**Checks:**
- A rollback path exists and is identified before deploy: the current healthy
  release/revision is recorded so a bad deploy can be reverted, and rollback safety
  is verifiable (e.g. new revision takes zero traffic until proven — a failed
  revision receiving no traffic satisfies rollback safety).
- Version provenance is single-sourced and unambiguous: the deployed artifact's
  reported version derives from one authoritative source (a tag) threaded through
  build and image, not a hand-edited constant that can go stale and misreport.
- The pushed artifact is identifiable (tag/digest captured at build) so a running
  deployment can be traced back to an exact build.
- Change-fail signal is observable: there is some way to tell a failed deploy from a
  healthy one (health/readiness probe, traffic-split state) rather than discovering
  failure from users.

**Anti-patterns to hunt:**
- no rollback path — no recorded prior-good release to revert to.
- stale hand-edited version — reported version is a frozen constant, misidentifies the build.
- untraceable artifact — no captured tag/digest linking running deploy to a build.

## Safety / fail-safe

Mark N/A with a one-line reason for targets with no safety-critical function.
For data-integrity-critical systems the fail-safe posture still applies (a
corrupt write is the hazard). The corpus is rich on fail-*closed* defaults at
data boundaries; genuine physical-hazard safety is history-thin.

**Checks:**
- Fail-safe default is declared and correct for the domain: gates fail closed where
  a wrong-accept is the hazard (e.g. rehydrate gated on a schema marker, fail-closed
  on mismatch). State which of fail-open / fail-closed each boundary chooses and why.
- Invariants are enforced at the deserialization/ingest boundary, not only at
  construction: a value that violates its invariant (e.g. a zero where NonZero is
  required, non-UTF-8 where text is required) is rejected with a specific typed
  error at read time.
- Validation is eager, not lazy, on safety-relevant fields — decode-time rejection,
  so invalid data cannot flow deeper before being caught.
- Rejected-input tests assert the *specific* variant rejected, not merely `is_err()`
  — a test that only checks "some error" is a weak safety gate and a finding.
- Idempotent/value-exact writes on convergent operations: a second identical apply
  is conflict-free and non-destructive; overlapping provisioners writing the same
  value do not corrupt or conflict.
- Destructive or irreversible operations require an explicit marker/guard (e.g.
  refuse-to-overwrite-without-marker, refuse-empty) with tests for both the refuse
  and the permit paths.

**Anti-patterns to hunt:**
- fail-open where fail-closed is required — mismatch/uncertainty defaults to accept.
- invariant checked only at construction — deserialization bypasses it; bad data persists.
- weak rejection test — asserts is_err() not the specific variant; wrong-reason rejection passes.
- destructive-without-guard — overwrite/delete with no marker check or confirmation.

## Flexibility / portability

Good looks like: the artifact installs and runs across target environments with
config supplied by the environment (12-factor style), no host-specifics baked in.
Replaceable components sit behind a boundary. The corpus is moderately thin here —
strong on env-var config and container packaging, thin on broad multi-platform
portability.

**Checks:**
- Runtime configuration is supplied via environment variables (or equivalent
  external config) following one consistent pattern — bind address, port, log
  format, dependency URLs, credentials are all env-driven, none hardcoded.
- Bind address / network exposure is parameterized with a safe default (bind to
  localhost by default, `0.0.0.0` only by explicit config) — never a hardcoded
  wide-open bind.
- Credentials and dependency endpoints are injected (env vars, secrets, mounted
  files), never committed; document exactly how each is injected (file:line).
- The runtime image is portable and minimal: multi-stage build, minimal/distroless
  base, non-root user, explicit runtime env for logging and TLS certs.
- Managed-runtime compatibility is explicit where relevant: honors the platform's
  port env var, binds correctly, exposes liveness/readiness/startup probes with
  sane timeouts.
- Platform-specific code paths are gated and their non-portable assumptions noted
  (e.g. `#[cfg(unix)]` error-code tricks that differ on Windows) — an untested
  cross-platform assumption is a finding.
- Replaceable infrastructure (storage backend, cache, message transport) sits
  behind a trait/interface boundary so it can be swapped without contorting callers;
  note the migration cost of any battle-tested-but-locked-in dependency.
- Undocumented operational surface is a finding: any config knob, env var, CLI flag,
  error code, or retry behaviour an operator would hit but that is absent from
  OPERATIONS.md / README.

**Anti-patterns to hunt:**
- hardcoded host config — bind address, port, or dependency URL baked into the binary.
- wide-open default bind — `0.0.0.0` as the un-overridable default.
- committed credentials/endpoints — secrets in source instead of injected.
- root container / fat base image — runs as root, non-minimal base, no non-root user.
- untested platform assumption — OS-specific path/error-code with no cfg-gate or note.
- vendor lock-in behind no boundary — swappable infra wired directly into callers.
- undocumented operational knob — env var / flag / error code not in ops docs.
