# Rust stack profile

- **Detection markers:** `Cargo.toml`, `Cargo.lock`.
- **Toolchain slots** (`adapters/toolchains.md` rust row): test `cargo test`;
  lint `cargo clippy -- -D warnings`; audit `cargo audit`; deny `cargo deny
  check`.
- Depth contract and composition rule: see `adapters/stacks/README.md`. Only
  dimensions with a material Rust-specific probe delta appear below; every
  other dimension INHERITS GENERIC from `references/phase-<n>-*.md` as-is.

## Phase 1 — API / schema design

**Probes (add):**
- `rg 'pub fn .*(String|&str|u\d+|i\d+|bool)'` for bare-primitive public
  signatures.
- Check `lib.rs`/`mod.rs` re-export blocks (`pub use`) for the crate's
  declared public surface.

**Anti-patterns:** stringly-typed `pub fn` params/returns; a `pub use` block
re-exporting internal-only or third-party symbols with no external caller.

## Phase 1 — Architecture

**Probes (add):**
- Map the workspace: `Cargo.toml` `[workspace]` members, then the crate/module
  `mod`/`use` graph for layer-violation tells (`rg 'use .*(runtime|adapter|infra)'`
  inside a declared core crate).
- Check the core crate's `Cargo.toml` `[dependencies]` for a runtime/async/HTTP
  dependency that violates a declared dependency-light core.

**Anti-patterns:** a `[dependencies]` entry on the core crate that pulls
runtime/infra transitively even via `dev-dependencies`; `async fn` leaking
onto a declared-sync facade crate.

## Phase 1 — API-versioning & consumer contracts

**Probes (add):**
- `cargo-semver-checks` config/CI step presence (`rg -l 'cargo-semver-checks'`
  in `.github/` or `Cargo.toml` dev-tooling).

**Anti-patterns:** relying on `cargo-semver-checks` (or its absence) as the
sole gate with no human-authored changelog entry — the automated diff is
advisory backup, never the authoritative record.

## Phase 1 — Compatibility / interoperability

**Probes (add):**
- `rg 'serde|Serialize|Deserialize|#\[serde\(default'` for the wire/schema
  surface; specifically flag `#[serde(default)]` used to add an optional
  field to a persisted type as a version-bump substitute.

**Anti-patterns:** `#[serde(default)]` added to a persisted/event schema in
lieu of an explicit version bump — the generic "ad-hoc field addition"
anti-pattern's Rust-idiomatic shape.

## Phase 2 — Refactor / readability

**Probes (add):**
- `rg '#!\[allow|#\[allow'` at crate root / module top for a blanket
  suppression shield (vs a narrow per-site `#[expect(lint, reason = ...)]`).

**Anti-patterns:** blanket-allow shield — a crate- or module-wide `#[allow(...)]`
hiding many real items behind one suppression, rather than a narrow, justified
per-site `#[expect]`.

## Phase 2 — Error handling

*(replaces: the generic Error-handling probe floor's Rust-specific literal
patterns — see `references/phase-2-implementation.md` "Error handling",
whose probe floor is stated stack-neutrally as "partial-function calls /
panic-equivalents / unchecked-index access"; this entry supplies the exact
Rust patterns, at least as many probes as the generic floor names.)*

**Probes:**
- `rg 'unwrap\(\)|expect\(|panic!|\[[0-9]' src/` (excluding tests) for
  partial-function calls and unchecked index access on production paths.
- `rg 'enum .*Error|thiserror|anyhow|Box<dyn.*Error>|\?;'` for the typed-error
  taxonomy and propagation idiom.
- `rg '#\[non_exhaustive\]'` for the forward-compat/exhaustiveness marker on
  public error enums; check it is applied uniformly across consumer enums.
- `rg 'lock\(\)|Mutex|RwLock'` combined with a following `.unwrap()` for
  poison-panic-cascade risk on lock guards.

**Anti-patterns:** `unwrap`/`expect`/`panic!`/index reachable from non-test
code on fallible data; `Box<dyn Error>` on a public API with no
justification; a consumer error enum missing `#[non_exhaustive]` where the
library discipline mandates it; `.unwrap()` on a lock guard turning one
panic into a poison cascade.

## Phase 2 — Dead-code removal

**Probes (add):**
- Run `cargo machete` or `cargo-udeps` if available for unused-dependency
  detection; else grep manifest deps against `src/`+tests references.
- `rg 'mod \w+;'` cross-checked against remaining callers for orphan modules;
  same check at crate granularity for orphan crates in a workspace.

**Anti-patterns:** zombie dependency surviving in `Cargo.toml` with zero
`src`/test references; orphan module or workspace crate with no remaining
callers, not yet deleted.

## Phase 4 — Security

**Probes (add):**
- `rg '#\[derive\(Deserialize\)\]'` at trust-boundary types; confirm a
  post-decode `validate()` pass exists rather than trusting the derive alone.
- Read `.cargo/audit.toml` (project-root form; `~/.cargo/audit.toml` is the
  user-home form) for the `[advisories] ignore` list before scoring `audit`
  PASS-WITH-IGNORES vs clean.

**Anti-patterns:** `#[derive(Deserialize)]` writing private fields with no
post-decode `validate()`; a suppressed-advisory `.cargo/audit.toml` entry
scored as a clean pass instead of `PASS-WITH-IGNORES`.

## Phase 4 — Dependency / build

**Probes (add):**
- `rg -l 'rust-toolchain|rust-toolchain.toml'` for the toolchain pin (channel
  + minimal profile + components); `rust-toolchain.toml` is current,
  bare `rust-toolchain` is legacy — either is a valid pin.
- `rg '\[dev-dependencies\]'` in `Cargo.toml`; check a test-only harness crate
  (e.g. `tempfile`) is declared there, not in `[dependencies]`.
- `deny.toml` presence and content for the license/advisory policy gate;
  `clippy.toml`/`.clippy.toml` (both spellings accepted) for lint
  configuration.

**Anti-patterns:** no `rust-toolchain(.toml)` pin (channel drifts run-to-run);
a test-only harness crate (`tempfile` or similar) declared in
`[dependencies]` instead of `[dev-dependencies]`, inflating the shipped
dependency graph.

## Phase 3 — Testing

**Probes (add):**
- `rg '#\[cfg\(test\)\]'` for inline unit tests colocated with source,
  plus a `tests/` dir for integration tests against the public API.
- `rg '#\[should_panic\]|#\[ignore\]'` — `#[ignore]` needs a reason string.

**Anti-patterns:** `#[ignore]`d test with no reason; a `tests/` test
reaching into private items (module-boundary violation); public API with
zero doc-tests (`cargo test --doc`).

## Phase 2 — Concurrency

**Probes (add):**
- `rg 'unsafe impl (Send|Sync)'` for manual impls needing justification.
- Check a `std::sync::MutexGuard` held across `.await` vs an async-aware
  lock (`tokio::sync::Mutex`); `rg 'thread::sleep|block_on'` inside an
  `async fn` with no `spawn_blocking` hand-off.

**Anti-patterns:** a `MutexGuard` held across `.await`, blocking the
executor thread; a blocking call inside `async fn` with no
`spawn_blocking`; `unsafe impl Send`/`Sync` with no safety justification.
