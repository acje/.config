# Toolchain adapter

Phase-1 validation checks are ecosystem-specific. Detect the target's
ecosystem (lockfile / manifest presence), then run the matching row. A
non-detected ecosystem is not "all-SKIPPED" — pick the closest row, or run
whatever the target's own CI/manifest declares, and record what you ran.

Service discovery (which root directories the sweep scopes to) is a separate
concern with its own data layer: see `adapters/services.md`.

Each ecosystem provides four command slots: `{test, lint, audit, deny}`.
`deny` = policy/licence gate (may be empty for ecosystems without one). An
empty slot means "no standard tool"; record `SKIPPED (no standard tool)`, not
`ABSENT`.

Where a row has a matching `adapters/stacks/<stack>.md` profile, the
stack-profile column names it — Phase 0 binds both the toolchain row and the
profile per service (see `adapters/stacks/README.md`). A row with no profile
column entry runs the generic reference only (`none (unseeded)`).

| Ecosystem | Detect via | test | lint | audit | deny | Stack profile |
|---|---|---|---|---|---|---|
| rust | `Cargo.toml` | `cargo test` | `cargo clippy -- -D warnings` | `cargo audit` | `cargo deny check` | `adapters/stacks/rust.md` |
| node | `package.json` (no `tsconfig.json`) | `npm test` (or `pnpm test` / `yarn test`) | `eslint .` | `npm audit` | `license-checker` (or `npm-license-crawler`) | none (unseeded) |
| typescript | `package.json` + `tsconfig.json` | `npm test` (or `pnpm test` / `yarn test`) | `eslint .` + `tsc --noEmit` | `npm audit` | `license-checker` (or `npm-license-crawler`) | none (unseeded) |
| python | `pyproject.toml` / `requirements.txt` | `pytest` | `ruff check .` (or `flake8`) | `pip-audit` | `pip-licenses` | none (unseeded) |

Notes:

- The **rust** row is a single row: cargo/clippy/audit/deny are its four slots,
  not four separate ecosystems.
- The **typescript** row is split out from bare **node**: a `tsconfig.json`
  alongside `package.json` is a real distinct probe surface (`tsc --noEmit`
  type-checking, ESLint flat-config parsing of `.ts`/`.tsx`), not just node
  with extra files. Detect typescript first; fall back to the node row when
  no `tsconfig.json` is present.
- Prefer the target's declared runner over the row default when the target's
  CI or manifest names a specific command (e.g. `pnpm` over `npm`, `nox`/`tox`
  over bare `pytest`). The row is a fallback, not an override.
- Extend this table for other ecosystems (go, ruby, dotnet, kotlin, clojure,
  …) by adding a row with the same four slots (plus a stack-profile column
  entry once that stack's profile file exists); the engine reads whatever
  rows are present.
- Record the exit code for each command actually run. Tool absent → `SKIPPED`
  with the reason; never fabricate a pass.
- **Interpret each exit code against the tool's config, not at face value.** A
  passing `audit` with an ignore list (e.g. `.cargo/audit.toml`) is
  `PASS-WITH-IGNORES` — name the suppressed advisories; it is not a clean pass.
  A failing `deny`/policy gate with no policy file present is `UNCONFIGURED`,
  not a license violation. Read the config before scoring the check.
- **Compiled ecosystems: run the four mechanical commands ONCE PER BUILD
  ROOT, centrally.** For any ecosystem whose commands share a build
  directory (rust `target/`, go build cache, dotnet `obj/bin`, …), do not
  re-invoke `test`/`lint`/`audit`/`deny` inside each parallel phase shard —
  the shared build dir causes lock contention and wasted rebuilds. Run them
  once per build root, capture exit codes + transcripts, and share the
  captured results with every shard *and every service* that maps to that
  build root as evidence. A monorepo with one shared `target/` runs the four
  commands once for the whole sweep, exactly as today; a polyglot repo with a
  separate manifest/build dir per service runs them once per service — this
  is what the build-root re-key preserves rather than breaks. Anti-pattern:
  parallel shards (or parallel services sharing a build root) each spawning
  the compiler on the same `target/`.
