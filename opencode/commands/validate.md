---
description: Run project validation — detect toolchain from Cargo.toml / package.json / pyproject.toml and execute build, lint, and test. Output inline tabular pass/fail.
---

# /validate — Project validation

Detect the project's toolchain and run build, lint, and test. Output is inline tabular — no file written.

## Usage

```
/validate
```

Run from the project root (or any subdirectory; detection scans upward).

## Detection logic

Probe in this order. Multiple toolchains may coexist (e.g. a Rust workspace with a JS frontend).

| Marker | Toolchain | Commands |
|--------|-----------|----------|
| `Cargo.toml` | Rust / cargo | `cargo build`, `cargo clippy --all-targets`, `cargo test` |
| `package.json` | Node (npm/pnpm/bun/yarn) | detect lock file → `npm`/`pnpm`/`bun`/`yarn`; run `build`, `lint`, `test` scripts if present |
| `pyproject.toml` or `setup.py` | Python | detect `uv` → `uv run pytest`; else `python -m pytest`; lint via `ruff check` if available |
| `go.mod` | Go | `go build ./...`, `go vet ./...`, `go test ./...` |
| `Makefile` / `justfile` | Make / just | list targets; run `build`, `test`, `lint` if they exist |

**Lock-file detection for Node:**
- `bun.lockb` → `bun`
- `pnpm-lock.yaml` → `pnpm`
- `yarn.lock` → `yarn`
- `package-lock.json` → `npm`
- No lock file → `npm` (fallback)

## Execution

For each detected toolchain:

1. Run build command; capture exit code.
2. Run lint command; capture exit code.
3. Run test command; capture exit code.
4. If a command is not available (tool not installed, script not present in `package.json`), mark `SKIPPED` with reason.

Do not fabricate results. If a tool is not installed, mark `SKIPPED`, not `PASS`.

## Output (inline — no file written)

```
Toolchain: <detected toolchain(s)>

| Step  | Command                        | Result  | Exit |
|-------|--------------------------------|---------|------|
| Build | cargo build                    | PASS    | 0    |
| Lint  | cargo clippy --all-targets     | PASS    | 0    |
| Test  | cargo test                     | PASS    | 0    |
```

If multiple toolchains detected, emit one table per toolchain.

**Verdict line (after table):**
- All PASS → `Verdict: PASS`
- Any FAIL → `Verdict: FAIL — see rows above`
- No toolchain found → `Verdict: SKIPPED — no supported toolchain detected in current directory`

## Discipline

- Run commands with `workdir` set to the project root, not via `cd &&`.
- Do not pipe build tools through grep/head — capture exit code directly.
- Report actual exit codes; never report PASS on a non-zero exit.
- Do not write any file. Output is inline only.
