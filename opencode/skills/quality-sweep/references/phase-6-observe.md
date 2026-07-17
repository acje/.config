# Phase 6 — Operate / Observe: detailed checks

> Enrichment reference for the quality-sweep skill. Concrete, generalized
> checks mined from real improvement history. Evidence arbitrates: a check is
> PRESENT only with a cited artifact; absence is a finding.

**Shard ownership.** This is the phase-6 evidence shard. It scores exactly
**one** dimension: Observability. The **Cost / resource economics (runtime)**
section below is facet context only — Cost's home row and score belong to the
phase-1 shard (facet-ownership rule, SKILL.md § The 29 dimensions). Read the
runtime-cost checks to inform the phase-1 Cost score if you are also that shard,
but **do not score Cost in this shard**.

**Probe floor is mandatory.** Observability may be scored `ABSENT` only after
its probe floor below has been executed and its transcript recorded. `ABSENT`
means "these specific probes returned nothing", never "I didn't find anything".
Observability is a graded dimension: complete the probe floor even after a first
hit, so the score reflects instrumentation coverage, not a single log line.

## Observability

Good observability lets an operator diagnose a running system without reading
source. Every event carries the keys needed to reconstruct what happened
(operation, result, cause, duration); levels map to actionable severity;
metric labels stay bounded; a trace threads one span through the full call
graph; failure and cancel paths tell the truth. Instrumentation lives at the
adapter/facade seam, not smeared into pure inner rings. Measurement precedes
optimization: you cannot tune what you never observed.

**Checks:**
- Log events are structured, not free text: each carries the keys an operator
  needs to diagnose — operation, result, cause (`?err`), duration/elapsed,
  attempts/retries — as discrete fields, not interpolated into one message
  string. Free-text-only logs on a decision path are a finding.
- Levels are actionable and consistent across the lifecycle: INFO for
  state transitions and one unambiguous "ready" line, WARN for recoverable
  degradation, ERROR only for events an operator must act on. A swallowed
  failure logged at WARN (or below) that an operator needs to act on is a
  mis-level finding — escalate to ERROR with a typed error-variant field.
- Metric labels are low-cardinality: no unbounded values (ids, timestamps,
  correlation/run/repo/subject ids, event ids) on a metric label — those
  explode the series count. High-cardinality identifiers belong on
  spans/logs; metric labels carry only bounded operation/result dimensions.
- Traces thread a span through the full request path (gateway → store → bus),
  not just the entrypoint. A span that stops at the front door and never
  reaches the store or the async edge cannot explain where latency or failure
  arose.
- Every emitted signal has a consumer: a metric/span/log is defined AND read
  (dashboard, alert band, SLO doc). An emit-only signal with no detect half
  (no registry, no alert, "log-as-metric" with nothing consuming it) is
  half-instrumentation — name the backend that consumes it or it is a finding.
- Failure and cancel paths do not emit success: no "complete"/"done"/"job
  finished" line on a cancelled, aborted, or errored path. A fatal error
  misreported as job-completed, or a truncated/partial result reported as
  complete, is a lying-event finding.
- Secrets and PII never reach logs/spans: tokens, JWT signature segments,
  keys, seeds, auth headers, cookies are redacted or omitted wholesale
  (hashes/decoded non-secret claims only). A planted-secret smoke test
  asserting absence is the evidence.
- Startup emits a config snapshot and dependency-readiness signal: one line
  recording effective config and a readiness check for each external
  dependency, so an operator can confirm what the process actually loaded and
  what it connected to. Silent startup is a finding.
- Runtime resource visibility exists: a self-read of resident memory
  (`/proc/self/status` VmRSS / statm, or an allocator-stats gauge) and a
  size/cardinality gauge for the growing in-memory structures, surfaced on a
  status endpoint or a low-cadence tick log. Zero heap/RSS instrumentation
  makes "measure before optimize" unsatisfiable — a finding when memory is a
  concern.
- Shutdown is observable and honest: signal name, shutdown-begin, abort-vs-
  drain disposition, and total-shutdown-duration are all logged; no line
  claims completion on a path that was cut short.
- Instrumentation sits at the correct architectural seam: added to the
  adapter/facade ring that already consumes signals, not forced into a pure
  inner ring whose dependency budget forbids a metrics/tracing crate. If a
  signal needs data only the pure ring has, surface it through the existing
  return/error type rather than adding an instrumentation call there.
- Deterministic instrumentation tests exist: emitted events are captured via
  a test subscriber and asserted (level + fields present), not left
  unverified. A capture harness proving a failure site emits ERROR with the
  expected field is the evidence.

**Probe floor (mandatory before ABSENT):**
- Grep for structured logging (`rg 'tracing|slog|log::|logrus|structlog|winston|zap'`).
- Grep for metrics / tracing instrumentation (`rg -i 'metric|counter|gauge|histogram|span|opentelemetry|prometheus'`).
- Grep for startup config-snapshot / readiness lines and honest shutdown (`rg -i 'ready|starting|config.*snapshot|shutdown|drain'`).
- Grep for instrumentation-capture tests (`rg -l -i 'subscriber|test.*log|capture.*event'`).
- ABSENT only if the target is a runnable system AND these probes surfaced no instrumentation — record the transcript. (Graded: finish the floor even after a hit.)

**Anti-patterns to hunt:**
- Free-text log with no structured keys — one prose string on a decision path; operator must read source to diagnose.
- High-cardinality metric label — id/timestamp/correlation value on a metric label, exploding series count.
- Trace that stops at the entrypoint — span at the gateway only; store/bus/async legs uninstrumented.
- Emit-only signal — a metric/counter defined but nothing consumes it (no dashboard, alert, or SLO band).
- Mis-levelled swallow — a failure logged at WARN/DEBUG (or fully swallowed) that an operator must act on.
- Log-and-continue that hides failure — error caught, down-logged or discarded, batch/loop advances as if clean.
- Misleading success event — "complete"/"done"/200 OK on a failure, cancel, abort, or truncated-partial path.
- Secret/PII in logs — token, JWT signature, key, seed, or auth header emitted unredacted.
- Message-less / empty event — a WARN/ERROR emitted with no message and no fields, pure noise masking real signal.
- No runtime resource visibility — zero RSS/heap/cardinality gauge; memory tuning is guesswork.
- Silent startup / shutdown — no config snapshot, no dependency-readiness line, no honest shutdown disposition.
- Instrumentation in the wrong ring — metrics/tracing dep forced into a pure inner crate, breaching its dependency budget.

## Cost / resource economics (runtime)

> **Facet context — not scored in this shard.** Cost's home row and score
> belong to the phase-1 shard. The runtime checks below inform the phase-1 Cost
> score (its phase-6 facet); do not emit a separate Cost score here. No probe
> floor is attached because this shard does not score the dimension.

(history-thin) Good runtime cost hygiene means actual spend, quota headroom,
and resource utilisation are observed at runtime — not assumed from
worst-case math alone. The history is sparse and mostly frames cost as a
memory/quota-headroom and API-budget-exhaustion concern rather than dollar
spend.

**Checks:**
- External-resource consumption is bounded and observed: an API-call /
  request budget exists with a pause-or-degrade marker on exhaustion, and the
  call count is emitted so runtime spend against the budget is visible (e.g.
  `api_calls` correlated with duration). An unbounded external caller with no
  budget signal is a finding.
- Rate-limit / quota headroom is surfaced: secondary-rate-limit or
  quota-exhaustion responses (Retry-After, backoff) are logged as distinct
  signals, not swallowed into a generic error, so an operator sees headroom
  shrinking before it hits zero.
- Runtime memory utilisation is measured against its declared limit: steady
  RSS and spike figures are captured and comparable to the deployment memory
  limit (headroom assertable), not merely bounded by a static worst-case
  computation. "We computed a worst case" without a runtime number is
  history-thin evidence, not a runtime observation.
- Quota/permission/auth failures on a spend path halt cleanly and report the
  exact cause, rather than retrying or escalating privilege — a runaway
  retry loop against a rate-limited or billing-gated dependency is a runtime
  cost finding.

**Anti-patterns to hunt:**
- Unbounded external caller — no API/request budget, no exhaustion marker, spend invisible at runtime.
- Swallowed quota/rate-limit signal — 429/Retry-After folded into a generic error; headroom loss unobservable.
- Worst-case-math-only memory claim — a computed bound with no runtime RSS number to confirm it.
- Retry-against-billing-gate — auth/quota failure triggers a retry or privilege escalation instead of a clean halt.
