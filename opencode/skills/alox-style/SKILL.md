---
name: alox-style
description: "Apply standalone AloxStyle for Rust services without an async runtime."
---
# Skill: alox-style

Apply the complete inline AloxStyle before Rust writing or review in a matching
no-async service repository. Authoring source:
`/Users/anders.jensen/code/aloxstyle/aloxstyle.md`;
public: https://github.com/acje/aloxstyle/blob/main/aloxstyle.md.

<!-- BEGIN INLINE: aloxstyle.md -->
# AloxStyle - Robust Oxidation

AloxStyle is a strict Rust style for latency-sensitive, unattended infrastructure
services without an async runtime. It uses explicit ownership, bounded execution,
and typed invariants to keep latency predictable and runtime failures explicit.

## Define outcomes and priorities

Define observable success, acceptable degradation, and recovery under normal load,
overload, and dependency failure. Align API contracts and budgets with these
outcomes. Distinguish enforced invariants from environmental assumptions in
service contracts; define behavior when assumptions fail. Within correctness
and security constraints, prioritize:

1. **Maintainability.** Favor simple designs and small, reversible, deployable
   changes.
2. **Correctness by design.** Encode invariants in types. Validate untrusted
   input at boundaries; trust validated values inward.
3. **Response times.** Bound work and keep progress, timers, and shutdown
   responsive to service requirements.
4. **Energy efficiency.** Minimize redundant polling, unnecessary allocation,
   and idle CPU or network activity.
5. **Features.** Build only capabilities justified by requirements; choose the
  simplest design meeting behavior, resource, and security constraints.

## Design deep modules

- Give each format, configuration rule, and state transition one owner. Define
  related constants with that owner, derive dependent values, and expose
  operations over validated values.
- Prefer unique ownership and borrowing; justify cloning and `Rc`/`Arc` against
  latency and lifecycle budgets. Accept borrowed views such as `&str` and `&[T]`
  when container ownership is irrelevant; preserve validated domain types.
- Put specialized logic and bookkeeping behind a small interface. Hide
  representations and algorithms; expose resource costs, failure behavior,
  policy, and caller obligations.
- Merge tightly coupled components and remove redundant forwarding layers.
  Preserve boundaries that enforce validation, authorization, ownership,
  supervision, or distinct responsibilities.
- Keep work budgets, progress, timers, and shutdown checks visible to the event
  loop.
- Generalize across current, related uses. Group inputs that travel together
  into types that enforce their invariants; keep independent values separate.
- Where startup validation and preallocation are required, construct a validated
  runtime plan once.

## Model valid states

Use enums, newtypes, private fields, and state machines to exclude real invalid
states. Separate untrusted input representations from validated domain values.
Construct validated domain values through checked constructors or `TryFrom`;
reserve `From` for infallible, lossless conversions.
Represent independent flags as booleans and genuine optionality as `Option`.
Choose integer types that fit the domain and Rust APIs.

Use `const fn` for compile-time callers and const initializers or blocks to
require compile-time evaluation. Preserve public const-callability across
compatible releases.

All construction and mutation paths for validated values preserve domain
invariants, including parsing, trait implementations, and code inside the
defining module.

## Give each decision one owner

Express each decision in one place. Replace invalid sentinel states with valid
domain types before simplifying branches. Keep a decision together instead of
splitting it between leading return guards and a `match` over the same cases.

Use guards for genuine preconditions and early short-circuits. Use `?`,
`let else`, and loop `continue` where they make control flow clearer.

## Make outcomes explicit

- Preserve meaningful `Option`, `Result`, and error distinctions. Distinguish
  acceptance from completion in success types where callers must act differently.
  Empty results represent successful queries with no matches; idempotent success
  represents an operation whose required outcome is already established. Keep
  malformed input, operating failures, capacity exhaustion, and unknown outcomes
  explicit.
- Deny `unused_must_use`. Add `#[must_use]` where discarding a result violates its
  contract, unless the return type already carries it.
- Keep public error enums closed: omit `#[non_exhaustive]` and keep variant sets
  complete within a major semver line. Avoid wildcard arms on closed error and
  state enums where new variants require an explicit handling decision.
- Handle malformed external input and expected operating failures as errors.
  Use fail-stop behavior for unexpected panics. Reusing owner state after a
  caught panic requires a demonstrated recovery contract.
- Deny production `unwrap()`. Permit `expect()` only for a construction-proven
  invariant with a justified per-site lint expectation.
- Where overflow is not excluded by construction, use checked arithmetic.
  Saturating or wrapping behavior must be part of the domain contract.
- Enforce structural invariants, including capacity and layout relationships,
  through types or const assertions. Keep input validation and correctness checks
  active in release builds; reserve `debug_assert!` for diagnostics. Keep hot-path
  assertions within execution budgets.

## Bound execution

Use explicit scheduling without an async runtime. The application owns
scheduling, fairness, timer progress, and shutdown.

- Use `Instant` for deadlines and elapsed time, `Duration` for intervals, and
  `SystemTime` for wall-clock timestamps.
- Work in bounded increments between reachable timer and shutdown checks.
  Apply the same discipline to synchronous helpers and drain loops.
- Prefer direct loops when they expose errors and work budgets more clearly.
  Bound iterator work by inputs inspected, not just values yielded.
- Bound aggregate memory and work as well as per-item and per-visit consumption.
- Bound recursive work and depth wherever execution guarantees depend on them.
- Preserve fair progress across active work. Evaluate batching and hot-path
  optimizations against measured or modeled work and latency budgets.
- Distinguish readiness and no-progress outcomes from EOF, protocol errors,
  TLS errors, and capacity rejection.
- Reject work when fixed capacity is exhausted. Keep retries within the same
  storage limits and validation rules.

Record each resource budget in the owning design or configuration contract:

| Field | Record |
| --- | --- |
| Owner | Component responsible for enforcement. |
| Scope | Resource, execution phase, and local or aggregate coverage. |
| Units | Items, bytes, operations per visit, or time. |
| Limit | Workload-justified maximum or deadline. |
| Exhaustion | Rejection, yielding, or timeout behavior at the limit. |
| Evidence | Named test or measurement of enforcement and exhaustion behavior. |

## Budget memory across lifecycles

Perform fallible startup setup and required preallocation explicitly before
serving; report startup failures through `Result`. Do not run code before
`main()`. Reserve fixed connection, buffer, and cache capacity at startup when
required by the service contract. Account separately for future socket creation
and kernel resource exhaustion.

- Use `const` for fixed values and immutable `static` for shared program-lifetime
  storage. Runtime copies and drops of const values remain subject to resource
  budgets.
- Where allocation failure must return an error, use fallible reservation such
  as `try_reserve` and prevent implicit growth beyond reserved capacity.
- Keep `Drop` bounded and nonblocking. Expose fallible shutdown and flush
  operations as explicit methods returning `Result`.

For each allocation or deallocation restriction, specify:

- The execution phase and first-party scope.
- Dependency behavior and authorized exceptions.
- Ownership and retained capacity across initialization, serving, failure,
  reconnect, teardown, and final shutdown.

Define an exception across its complete lifecycle, including caller-owned
allocations. Revalidate affected evidence after dependency changes and resolve
implementation deviations through correction or explicit approval.

## Keep feedback actionable and bounded

Keep logging and metrics within the service's work, latency, and allocation
budgets, including during overload and sink failure.

- Measure service outcomes from typed results and owning state transitions,
  not process liveness alone.
- Make diagnostics identify the operation, typed outcome, and relevant state.
  Use operational evidence to reproduce failures in regression tests and correct
  the owning code or contract.
- Bound event size, emission rate, buffering, and metric label cardinality.
  Use stable labels rather than per-request or per-connection identifiers.
- Rate-limit or aggregate repeated diagnostics. Account for suppressed events
  with bounded counters.
- Define behavior for full buffers and unavailable sinks. Keep emission and
  flush work within timer and shutdown budgets, including final shutdown.
- Respect phase-specific allocation restrictions in formatting, aggregation,
  and export. Verify worst-case telemetry load alongside serving work.

## Explain through structure and contracts

Restructure code that needs explanatory commentary. Keep rationale in design
decisions, commit messages, or issues.

Use doc comments only for code contracts: public APIs, unsafe functions and
traits, and in-scope doctests. Include `# Errors`, `# Panics`, and `# Safety`
where required; unsafe functions and traits require `# Safety`. Follow the
project's restrictions on unsafe code.

Plain line and block comments are prohibited, including safety notes, TODOs,
lint justifications, and commented-out code.

## Choose dependencies and tools deliberately

Compare dependencies with equivalent in-house code on maintenance cost,
complexity, supply-chain risk, allocation behavior, and update cost. Honor
project dependency restrictions.

Use the project's formatter and lint configuration. Give lint exceptions
specific reasons and preserve coherent logic when satisfying size limits.
<!-- END INLINE: aloxstyle.md -->
