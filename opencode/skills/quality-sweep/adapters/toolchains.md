# Toolchain adapter

Phase-1 validation checks are ecosystem-specific. Detect the target's
ecosystem (lockfile / manifest presence), then run the matching row. A
non-detected ecosystem is not "all-SKIPPED" — pick the closest row, or run
whatever the target's own CI/manifest declares, and record what you ran.

Each ecosystem provides four command slots: `{test, lint, audit, deny}`.
`deny` = policy/licence gate (may be empty for ecosystems without one). An
empty slot means "no standard tool"; record `SKIPPED (no standard tool)`, not
`ABSENT`.

| Ecosystem | Detect via | test | lint | audit | deny |
|---|---|---|---|---|---|
| rust | `Cargo.toml` | `cargo test` | `cargo clippy -- -D warnings` | `cargo audit` | `cargo deny check` |
| node | `package.json` | `npm test` (or `pnpm test` / `yarn test`) | `eslint .` | `npm audit` | `license-checker` (or `npm-license-crawler`) |
| python | `pyproject.toml` / `requirements.txt` | `pytest` | `ruff check .` (or `flake8`) | `pip-audit` | `pip-licenses` |

Notes:

- The **rust** row is a single row: cargo/clippy/audit/deny are its four slots,
  not four separate ecosystems.
- Prefer the target's declared runner over the row default when the target's
  CI or manifest names a specific command (e.g. `pnpm` over `npm`, `nox`/`tox`
  over bare `pytest`). The row is a fallback, not an override.
- Extend this table for other ecosystems (go, ruby, dotnet, …) by adding a row
  with the same four slots; the engine reads whatever rows are present.
- Record the exit code for each command actually run. Tool absent → `SKIPPED`
  with the reason; never fabricate a pass.
- **Interpret each exit code against the tool's config, not at face value.** A
  passing `audit` with an ignore list (e.g. `.cargo/audit.toml`) is
  `PASS-WITH-IGNORES` — name the suppressed advisories; it is not a clean pass.
  A failing `deny`/policy gate with no policy file present is `UNCONFIGURED`,
  not a license violation. Read the config before scoring the check.
- **Compiled ecosystems: run the four mechanical commands ONCE, centrally.**
  For any ecosystem whose commands share a build directory (rust `target/`, go
  build cache, dotnet `obj/bin`, …), do not re-invoke `test`/`lint`/`audit`/
  `deny` inside each parallel phase shard — the shared build dir causes
  lock contention and wasted rebuilds. Run them once, capture exit codes +
  transcripts, and share the captured results with the shards as evidence.
  Anti-pattern: parallel shards each spawning the compiler on one `target/`.
