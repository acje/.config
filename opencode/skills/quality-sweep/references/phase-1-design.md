# Phase 1 — Requirements / Design: detailed checks

> Enrichment reference for the quality-sweep skill. Concrete, generalized
> checks mined from real improvement history. Evidence arbitrates: a check is
> PRESENT only with a cited artifact (file:line / doc / ADR); absence is a
> finding.

## API / schema design
Good: the smallest public surface that expresses the domain; every exported
symbol is a deliberate adopter affordance, not accidental leakage; primitives
are wrapped at the boundary and validated once.

**Checks:**
- Is every public symbol a deliberate affordance? Flag `pub` items whose only
  callers are internal/tests/no dependent — demote to module-private or
  crate-visible (visibility tighten, not necessarily a newtype).
- Does any public function take or return a bare primitive (`String`/int) where
  a validated domain type belongs? Grep public signatures for primitive params
  and returns; sample and classify each.
- Are re-exports minimal? Count `pub use` of internal/sibling/third-party
  symbols per module — a large re-export map is an API-hygiene smell (leaks
  internals into the stable surface).
- Is validation centralized at the constructor/boundary so invalid instances
  cannot be built? Flag validation logic scattered across infrastructure that
  a caller can bypass.
- Does an accessor leak interior mutability or internal collections (e.g.
  returning `&mut Vec`, exposing a sub-struct's fields via reach-through)?
  Require behavior accessors over field exposure.
- When a symbol must exist but isn't a stable affordance, is it explicitly
  hidden / test-only / marked with a removal path — rather than silently
  `pub`?
- Does the design state, up front, exactly which names are exposed now vs kept
  internal/advanced/test-only? Absence of an explicit minimal-surface proposal
  is a finding.

**Anti-patterns to hunt:**
- Stringly-typed public API — `pub fn …(x: String)` / `-> String` where a
  closed set or validated type is meant.
- Over-exposed re-export — `pub use` of a symbol with no external dependent.
- Reach-through accessor — two-hop `state.sub().field` access that pins
  internal layout into the contract.
- Primitive obsession — domain identifiers and quantities modeled as bare
  ints/strings throughout.

## Architecture
Good: dependencies point one way along a declared ring; domain core is
dependency-light and free of infrastructure concerns; ports are pure and
adapters hold the messy I/O; every cross-boundary edge is justified by a
declared dependency.

**Checks:**
- Does the dependency graph respect the declared ring/layer direction? Map the
  crate/module DAG; flag any edge crossing a boundary the design forbids
  (core depending on adapter, substrate depending on runtime).
- Is the domain core free of runtime/infrastructure deps (async runtime, HTTP,
  storage, serialization frameworks) — even transitively via dev-deps? A
  dependency budget on the core crate is load-bearing; verify it.
- Is the sync-domain / async-infrastructure split honored — no async on the
  pure domain/port surface, async confined to adapter signatures? Flag
  `async fn` that leaked onto a synchronous facade.
- Do declared dependencies match actual edges? A declared dep with no edges is
  dead weight; an edge with no declared dep is a hidden coupling — report both.
- Is duplicated infrastructure logic (two crates each reimplementing atomic
  write, budget gating, etc.) consolidated, or explicitly justified as
  forbidden-to-merge by a cited decision?
- Is each invariant's enforcement mechanism classified — compile-error >
  CI-tripwire > lint > prose-only? Prose-only invariants are the weakest and
  should be flagged for promotion.
- Does the change respect stated coupling guardrails — is a "refactor" quietly
  a breaking API redesign that cascades into consumers/frontends? Separate
  structural polish from behavior/contract change.
- Are decomposition boundaries information-hiding (fields tightened, behavior
  accessors added) rather than a single struct accumulating all state?

**Anti-patterns to hunt:**
- God-struct app-state — one struct owning all sub-aggregates with public
  fields reached through from everywhere.
- Ring/layer inversion — a lower-purity layer importing a higher one.
- Leaky port — infrastructure type (framework struct, async signature) bleeding
  across the port boundary into the domain.
- Coupling-to-framework — library logic taking the CLI/HTTP framework's own
  types instead of a decoupled options struct.
- Prose-only invariant — a load-bearing rule enforced by a comment/doc rather
  than the compiler or a gate.

## Type safety
Good: illegal states do not compile; invariants live in the type, validated
once at construction; total functions over debug-only assertions; closed sets
are enums, not strings or bool-pairs.

**Checks:**
- Are mutually-exclusive fields modeled as a sum type rather than a struct of
  optionals or a pair of booleans? Flag `Option<bool>` tri-states and
  co-occurring booleans that encode a state machine.
- Are closed sets (outcomes, categories, skip/error reasons, states) modeled as
  enums matched exhaustively — not stringly-typed and not bool flags?
- Are primitive identifiers wrapped in validated newtypes that enforce their
  invariant at construction (non-empty, charset, no path traversal) and return
  a `Result` at the parse boundary?
- Do constructors return a fallible result at the boundary so a bad value is
  structurally impossible downstream — replacing debug-only asserts / panics
  that encode "caller convention"?
- Is each type-safety contract backed by exactly one compile-fail test proving
  the illegal construction does not compile? Absence of the negative test is a
  finding.
- Does a newtype/enum refactor actually remove a panic site, or merely relocate
  it to a `.expect()` at the boundary reached by the same callers? The latter
  is not an improvement — flag it.
- Before forcing an enum on a set, is the set actually closed at the boundary?
  If the upstream source is open, a validated newtype wrapper is correct;
  forcing an enum on an open set is a defect.
- Are the writer/state-transition APIs shaped so illegal transitions are
  unrepresentable (opaque state handles / typestate) rather than checked at
  runtime?

**Anti-patterns to hunt:**
- Stringly-typed state — a `String` field standing in for a closed set.
- Bool-pair state machine — two+ booleans encoding states that should be one
  enum.
- Panic-relocation "fix" — a newtype whose only effect is moving a panic to a
  `TryFrom` reached from the same convention-only callers.
- Assertion-as-contract — debug asserts encoding an invariant the type could
  enforce.

## API-versioning & consumer contracts
Good: any public-surface change is deliberate about who breaks and when;
a single authoritative changelog records breaks; deprecation vs clean-break is
a conscious policy, not an accident; automated semver tooling is advisory
backup to the human-authored record.

**Checks:**
- Is there a single authoritative changelog, and does every public-surface
  change carry an entry? A surface change without a changelog entry is a
  finding regardless of what tooling says.
- Is the deprecation-vs-clean-break stance explicit for this change? If shims
  are omitted, is the break intentional and documented in the commit body as
  breaking for external pins?
- Before removing/renaming a public symbol, were callers enumerated? Grep the
  whole surface for the symbol; a surviving non-test/external caller means the
  break needs a deprecation path or an explicit stop.
- Are deprecated aliases/shims actually retired on the stated schedule, or
  lingering indefinitely? Flag stale shims kept "so tests don't break."
- Is wire/schema-format breakage treated as a major-version / clean-break event
  with an explicit regeneration + migration/reset story — never a silent
  change?
- Does a numeric-trade-off parameter that consumers depend on (page size,
  timeout, cardinality ceiling) live where consumers can find and rely on it,
  with the value justified?
- Is automated API-stability checking treated as advisory (with its known gaps
  documented) and the human changelog as the authoritative gate — not the
  reverse?

**Anti-patterns to hunt:**
- Silent breaking change — public symbol/enum-variant/field removed with no
  changelog entry and no commit-body note.
- Zombie shim — deprecated alias retained long past its migration window.
- Changelog-less surface edit — `pub` change shipped without the authoritative
  record updated.

## Compatibility / interoperability
Good: the system co-exists with peers reading the same data; wire encoding is
deterministic and canonical; schema evolution is a planned seam (versioning /
upcasting / additive rules), not an ad-hoc field addition; format identity is
pinned by a stable hash and golden vectors.

**Checks:**
- Is the wire encoding deterministic and canonical (stable byte layout,
  ordered maps, no nondeterministic derives)? A nondeterministic encode
  invalidates the format — flag it.
- Is format identity pinned by a schema-hash and golden byte-vectors, and does
  a round-trip test (encode→decode→equal) exist? An unexpected hash move must
  HALT, not ship silently.
- Is schema evolution a first-class strategy — version bytes / header
  negotiation / upcasting / a documented forward-backward-compat rule — rather
  than appending optional fields ad hoc? Flag the "add `Option<T>` with a
  serde default" pattern where a version bump is the accepted policy.
- When adding a field, is it confined to render-only/projection types and kept
  OFF the persisted event/payload schema unless a schema bump is intended?
  Verify the persisted-type diff is empty when no bump is meant.
- For cross-implementation / cross-language interchange, do golden test vectors
  validate that independent readers agree on the bytes?
- Are typed structs for external data formats (foreign JSON/API shapes) tested
  against real captured responses so field drift (missing/renamed) is caught,
  with optionality handled deliberately?
- Do timestamps and identity fields survive round-trip in the interchange
  format (e.g. ISO-8601 string round-trip) where a peer or fixture depends on
  it?
- When co-existing with an external transport/store, is the format-identity
  gate checked once up front (stream/file tagged with the expected schema hash)
  rather than assumed?

**Anti-patterns to hunt:**
- Ad-hoc field addition — new persisted field bolted on without a version bump
  or golden regeneration.
- Silent hash move — golden schema hash changes and the diff is accepted
  without back-brief.
- Nondeterministic canonical bytes — ordering/derive nondeterminism under a
  format that promises byte-stability.
- Untested foreign-shape struct — external-data deserializer with no test
  against a real captured payload.

## Cost / resource economics
Good: spend, quota, and rate-limit ceilings are explicit design inputs;
externally-sized collections are bounded before allocation; numeric
trade-off parameters are chosen as defensible interior optima; the dominant
cost driver is measured, not guessed.

**Checks:**
- Is every externally-sized collection (sized by remote API / user data)
  capped BEFORE/at allocation, with the cap value justified against a real
  ceiling and set so legitimate workloads still pass?
- Are decompression/deserialization bounds explicit (max decompressed bytes,
  body-size limit, message-size limit) as DoS/resource-exhaustion guards?
- Is the operation's demand sized against the actual quota/rate-limit window
  (calls-per-item × item-count vs the per-window ceiling)? Flag designs that
  cannot complete one unit of work within one quota window.
- For each numeric trade-off parameter (batch size, queue depth, retry count,
  timeout, cadence, utilization target), is BOTH the cost of increasing and the
  cost of decreasing named — so the value is a defensible interior optimum, not
  a corner picked from one side?
- Is the dominant cost driver measured (a representative run capturing the peak
  and a latency sample) rather than assumed? "Memory budget" / spend claims
  must cite a measurement, not a guess.
- Does the design distinguish idle/base cost from peak/spike cost, and target
  the one that actually sets the bill (e.g. peak sets an allocation-based
  charge; lowering idle alone yields no saving)?
- Is backpressure / bounded queueing present where an unbounded producer could
  exhaust memory — a bounded queue with try-send/shed rather than unbounded
  buffering?
- Is a new dependency weighed against a dependency budget (footprint, transitive
  advisories, non-default-allocator complexity) with the smallest-footprint
  option justified?
- Is the cost of the verification/CI strategy itself considered — moving a
  rarely-failing check to CI saves local tokens, but a frequently-failing one
  moved to CI increases total round-trip cost?

**Anti-patterns to hunt:**
- Unbounded external-input allocation — collection sized directly by remote
  data with no cap.
- One-sided parameter — a numeric limit justified only by the cost of it being
  too small (or too large), never both.
- Guessed budget — a spend/memory claim with no measurement artifact.
- Idle-optimization mirage — lowering base cost that doesn't set the actual
  (peak-driven) bill.
- Dependency-budget breach — new dep added to a deliberately dep-light core
  without justification.
