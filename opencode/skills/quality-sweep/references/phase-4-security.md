# Phase 4 — Security / Supply-chain: detailed checks

> Enrichment reference for the quality-sweep skill. Concrete, generalized
> checks mined from real improvement history. Evidence arbitrates: a check is
> PRESENT only with a cited artifact; absence is a finding.

**Shard ownership.** This is the phase-4 evidence shard. It scores exactly the
three dimensions below (Security, Dependency/build, Supply-chain integrity). No
facet dimensions live here.

**Probe floor is mandatory.** A dimension may be scored `ABSENT` only after its
probe floor below has been executed and its transcript recorded — including the
relevant toolchain-adapter command (`audit`, `deny`) with its real exit code.
`ABSENT` means "these specific probes returned nothing", never "I didn't find
anything". Security is a graded dimension: complete the probe floor even after a
first hit, so the score reflects coverage across the trust boundaries, not a
single lucky finding.

**Anti-pattern — trusting the exit code over the tool config.** A green `audit`
can mask suppressed advisories: read the ignore list (the ecosystem's audit
tool's ignore-list config, e.g. Rust's `.cargo/audit.toml`, or equivalent)
and, if advisories are suppressed, score `PASS-WITH-IGNORES` and
name each suppressed advisory (its risk did not disappear, it was accepted). A
red `deny`/policy gate can simply mean *no policy file is configured* — that is
`UNCONFIGURED`, not a license violation. Always interpret the exit code against
the tool's configuration before scoring, and record the config basis in the
probe transcript.

## Security

Good looks like: every trust boundary validates on the way in, secrets never
reach source/config/logs, the network surface defaults closed, errors reveal
nothing about internals, and a named framework (OWASP category set, CISQ
quality axes: integrity / availability / control / authenticity / confidentiality
/ non-repudiation / race-freedom) grounds the review rather than ad-hoc
intuition. Defense-in-depth: a validation that "the upstream API already
enforces" is still required at the local boundary.

**Checks:**
- Validate on deserialization at every trust boundary: reject out-of-domain
  values, surrogates, over-large code points, malformed encodings (invalid
  UTF-8 continuation bytes, truncated multibyte sequences) rather than trusting
  inbound bytes. A constructor that enforces invariants is bypassed if
  deserialization writes private fields directly — require a post-decode
  `validate()` pass.
- Path/identifier inputs that compose into filesystem paths or URL paths are
  sanitized once at the boundary (reject `..`, percent/double-encoded traversal,
  backslash, null-byte, dotfiles, extensionless) — and sanitized on EVERY
  composition site, not just the primary one; audit for sibling code paths
  that interpolate the same raw input directly.
- Network binds default to loopback; binding all-interfaces is an explicit,
  documented, env-gated decision, never a silent default. Any all-interfaces
  bind pairs with an auth layer or a documented "fronted by X" deployment note.
- Every unauthenticated endpoint is reviewed for what operational metadata it
  leaks (org names, timestamps, schema/version, uptime); status/health
  endpoints do not become a reconnaissance surface.
- Security response headers are present and asserted by test on ALL routes,
  including dynamically-injected/extra routes: frame-options, CSP, HSTS,
  cross-domain-policy. Header values built from input reject CRLF before
  header construction (not at panic time).
- Secrets are wrapped in a zeroizing secret type; intermediate plaintext
  (e.g. `env::var` String) is zeroized before wrapping, not left dangling.
  Debug/Display impls redact. Private-key/credential file permissions are
  checked. Cryptographic choices are keyed where comparison is
  security-sensitive (no unkeyed hash for auth comparison).
- User/websocket upgrades validate Origin (anti-CSWSH) and authenticate before
  granting access; DoS resistance (body-size caps, concurrency limits) is
  bounded by named values, not permissive defaults.
- The review is framework-anchored: findings map to OWASP categories (broken
  access control, crypto failures, injection, …) or CISQ axes, with file:line
  citations, so coverage is auditable rather than impressionistic.

**Probe floor (mandatory before ABSENT):**
- Grep trust boundaries for validation (`rg 'Deserialize|from_str|parse|validate|sanitiz'` at ingest sites).
- Grep for path-traversal / injection guards (`rg '\.\.|canonicalize|percent|escape|prepared|parameteri'`).
- Grep for secret handling (`rg -i 'secret|token|api.?key|password|zeroize|redact'`; check for hardcoded literals).
- Grep for network-bind default (`rg '0\.0\.0\.0|bind\(|listen\('`).
- ABSENT only if the target has a trust/network/secret surface AND these probes surfaced no security control — record the transcript. (Graded: finish the floor even after a hit.)

**Anti-patterns to hunt:**
- trust-the-input deserialization — an auto-derived deserializer writing
  private fields with no post-decode `validate()`; zero/sentinel/out-of-range
  values accepted silently.
- defense-in-depth gap — one call site sanitizes, a sibling interpolates the
  same raw input directly ("the API already validates" excuse).
- all-interfaces default bind — binds `0.0.0.0` with no env gate, no auth, no
  deployment note.
- secret in source/config/logs — hardcoded token/key, credential file
  committed, or plaintext secret surviving into error/log/trace output.
- redaction-that-misses — redactor handles one secret block but a second
  adjacent block (or a dash-count/format variant) survives; verify with a
  planted-secret test asserting the literal is ABSENT and a redaction marker
  is present.
- verbose error leaking internals — error/log surfaces free-form upstream
  server text, stack internals, or credential material instead of a typed
  class + safe remediation.
- permissive-Default footgun — `Default` on a limits/policy struct yields an
  unbounded production config; force consumers to name limit values.
- unauthenticated metadata endpoint — status/diagnostics route reveals
  operational internals with no auth.

## Dependency / build

Good looks like: every dependency is scanned for known advisories in CI and a
failing scan BLOCKS the build (not `continue-on-error`); a policy gate rejects
yanked, vulnerable, or disallowed-license dependencies; the lockfile is
committed and builds are `--locked`; the toolchain is pinned with a declared
minimum-supported version; dependencies pull minimal features
(default-features off, opt into what is used); and dependency changes are
reviewed as a deliberate act, not absorbed silently.

**Checks:**
- Advisory scanning runs in CI on every push/PR and is a HARD gate — a new
  advisory fails the build. Advisory-class jobs marked `continue-on-error`/
  non-blocking are a finding: they produce signal nobody must act on.
- A policy gate (deny-list config) rejects yanked, vulnerable, and
  disallowed-license dependencies; license allow-lists are explicit, and
  narrow local exceptions (e.g. a fuzz-only sub-config) are documented with
  rationale rather than widening the root policy.
- Lockfile is committed and CI builds/tests run `--locked`; a lockfile delta
  is inspected (only expected version lines move) before commit. Clearing one
  advisory must not introduce a new one, and a version pin to dodge an advisory
  must not be a downgrade that strips a needed fix.
- Toolchain is pinned (channel + minimal profile + required components) with a
  declared minimum-supported-version contract; MSRV drift is a mechanical gate,
  not a surprise.
- Dependencies default-features-off, opting into only used features; unused
  declared dependencies are removed; test-only deps live in a dev/test-only
  dependency group, not the runtime dependency set. Adding a new feature flag that pulls new transitive
  code is treated as a dependency change (see governance below).
- Warnings are denied in CI (`-D warnings` / equivalent) so lint regressions
  block; the "advisory warning" tier is bounded and not silently growing.
- Test matrix exercises `--no-default-features` and `--all-targets` so a
  feature-gated or test-only path cannot hide a break/lint.
- Adding a CI-installed binary tool (test runner, scanner) is itself governed:
  is it pinned/vetted like a dependency? A floating CI tool version is a
  supply-chain surface.

**Probe floor (mandatory before ABSENT):**
- Run the adapter `audit` and `deny` commands; record exit codes (never fabricate).
- Check for a committed lockfile and `--locked`/`--frozen` usage in CI (`rg -l 'Cargo.lock|package-lock.json|poetry.lock|--locked|--frozen'`).
- Grep for advisory/deny gate config and whether it blocks (`rg -i 'audit|deny|continue-on-error' .github/ deny.toml`).
- Grep for toolchain pin / MSRV (`rg -l 'rust-version|engines|.tool-versions'` — plus the ecosystem's own toolchain-pin file, e.g. Rust's `rust-toolchain(.toml)`; see the bound stack profile).
- ABSENT only if no lockfile, no audit/deny gate, and the adapter reports no tool — record the transcript with exit codes.

**Anti-patterns to hunt:**
- unpinned/floating dependency — no committed lockfile, no `--locked`, or
  toolchain channel unpinned; builds are not reproducible run-to-run.
- advisory-scan-as-decoration — audit/deny job runs but `continue-on-error`,
  so a real finding never blocks a merge.
- kitchen-sink features — default-features left on, pulling transitive code and
  license/advisory surface nobody uses.
- runtime-dep-that-is-test-only — a test-only harness dependency (e.g. Rust's
  `tempfile`) declared in the runtime dependency set instead of the
  dev/test-only group, inflating the shipped dependency graph.
- advisory-dodge downgrade — a pin added "to clear the scan" silently reverts
  a security fix or masks the real vulnerable path.
- lint-tier creep — the tolerated advisory-warning count ratchets upward every
  mission with no gate; signal drowns.

## Supply-chain integrity

Good looks like: dependency changes are a reviewed, deliberate act with a
recorded diff; provenance of what actually ships is verifiable (build metadata
traces to a source revision); transport of credentials and data is encrypted by
mandate; and artifacts are attributable. History-thin: the mined corpus is
strong on audit/deny + committed-lock + dependency-review-record, but has
little on SBOM emission, artifact signing/attestation, and bit-for-bit
reproducible builds — treat those as ASK-the-repo checks, not assumed-present.

**Checks:**
- Dependency evolution is intentional and reviewed: version/feature changes go
  through a dedicated change (a "dependency PR" discipline), carrying a
  before/after dependency-tree diff and a record of any new advisory warnings,
  new transitive packages, or new unsafe surface introduced. A silent bump inside
  an unrelated change is a finding.
- Duplicate/transitive version bloat is surfaced (dep-tree duplicate scan) and
  justified or collapsed, not left to accumulate.
- Transport of credentials and sensitive data is encrypted by mandate (a
  transport-security policy), not opportunistically; credential files are
  delivered via a secret manager, never committed, and re-read behavior on
  reconnect is defined.
- Build metadata (version string, embedded identifiers) traces to a single
  source of truth (e.g. VCS tag → build → embedded version), so what ships is
  attributable to a revision; a frozen/stale embedded version that no longer
  matches the tag is a provenance finding. (audit≠provenance gap: dependencies
  are scanned but the shipped artifact is not tied back to its inputs.)
- License compliance is enforced as policy (allow-list gate), and third-party
  license obligations are packaged with the artifact (LICENSE files present and
  correct) — history-thin on full SBOM emission; check whether one is produced
  at all.
- (ASK, history-thin) Is a software bill of materials (SBOM) generated per
  release? Are release artifacts signed / attested? Are builds reproducible
  (bit-for-bit from pinned inputs)? Absence of any of these is a finding to
  record, not to assume closed.

**Probe floor (mandatory before ABSENT):**
- Grep for SBOM generation (`rg -l -i 'sbom|cyclonedx|spdx|syft'`).
- Grep for artifact signing / attestation (`rg -l -i 'cosign|sigstore|attest|provenance|slsa'`).
- Grep for reproducible-build config and version-provenance threading (`rg -i 'reproducib|SOURCE_DATE_EPOCH|vergen|git.?describe'`).
- Grep for license packaging and a dependency-review record (`rg -l -i 'LICENSE|license.*allow|dependency.*review'`).
- ABSENT only after all four probes returned nothing — record each as an explicit open gap (history-thin ≠ assumed-closed).

**Anti-patterns to hunt:**
- silent dependency bump — version/feature change buried in an unrelated diff
  with no tree-diff, no advisory-delta record, no dedicated review.
- audit≠provenance gap — dependencies are scanned for advisories but the
  shipped artifact is unsigned/unattested and not traceable to its source
  revision; "we scanned" is mistaken for "we can prove what shipped".
- frozen-version leak — embedded version/identifier hard-frozen to a stale
  literal, diverging from the VCS tag; the artifact misreports its own
  provenance.
- committed-credential — a `.creds`/key file in the repo instead of secret-
  manager delivery; or plaintext transport where an encryption mandate applies.
- license-drift — a transitive dependency's license is outside the allow-list
  with no documented, narrowly-scoped exception; or LICENSE packaging missing.
- no-SBOM/no-signing (history-thin) — no bill of materials, no artifact
  signature/attestation, no reproducible-build claim; record as an open gap.
