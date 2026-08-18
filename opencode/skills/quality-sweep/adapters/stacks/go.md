# Go stack profile

- **Detection markers:** `go.mod`, `go.sum`, `vendor/`.
- **Toolchain slots** (`adapters/toolchains.md` go row): test `go test
  ./...`; lint `golangci-lint run` (config: `.golangci.yml`, `.golangci.
  yaml`, `.golangci.toml`, or `.golangci.json` — probe for all four); audit
  `govulncheck ./...` (module `golang.org/x/vuln/cmd/govulncheck`); deny
  `go-licenses check <pkg> --disallowed_types=...` (module `github.com/
  google/go-licenses/v2` — the `/v2` suffix is required on install: `go
  install github.com/google/go-licenses/v2@latest`).
- Depth contract and composition rule: see `adapters/stacks/README.md`. Only
  dimensions with a material Go-specific probe delta appear below; every
  other dimension INHERITS GENERIC from `references/phase-<n>-*.md` as-is.

## Phase 2 — Error handling

**Probes (add):**
- `rg '_ = \w+\(' ` and `rg ', _ :?= \w+\('` for discarded error returns.
- `rg '\bpanic\('` outside `main()`/test files for a naked panic used as
  ordinary control flow in library code.
- `rg '\.\(\w+\)$'` (bare type assertion, no comma-ok form) for an unchecked
  type assertion that panics on mismatch instead of returning `ok bool`.

**Anti-patterns:** `_ = someFunc()` discarding an error return with no
justification comment discipline; `panic()` in library code reachable
outside `main`/test, forcing every caller to recover(); a bare `x.(T)` type
assertion without the `v, ok := x.(T)` form on untrusted input.

## Phase 2 — Concurrency

**Probes (add):**
- `rg 'go func\('` cross-checked against a `context.Context` parameter and
  a `select`/`ctx.Done()` exit path — a goroutine launched with no
  cancellation path is a leak candidate.
- `rg 'sync\.WaitGroup|sync\.Mutex'` for shared-state coordination primitives
  and confirm they're paired with the goroutines they guard.

**Anti-patterns:** a `go func(...)` with no `context.Context` propagated in
and no `select`/`ctx.Done()` exit — the goroutine outlives its caller with no
cancellation signal (leak); a `sync.WaitGroup.Add` call inside the spawned
goroutine instead of before `go func()` (race on the counter).

## Phase 3 — Lint / format / style

**Probes (add):**
- Detect `golangci-lint` config: `.golangci.yml`, `.golangci.yaml`,
  `.golangci.toml`, `.golangci.json` (all four are accepted filenames — probe
  for all four, not just the `.yml` form).
- Run `golangci-lint run` from the module root (default target is `./...`).

**Anti-patterns:** no `.golangci.*` config present while CI still claims a
lint gate (running on tool defaults only, not a reviewed rule set);
`interface{}`/`any` overuse flagged by config-enabled linters
(`ireturn`/similar) left unaddressed.

## Phase 4 — Dependency / build

**Probes (add):**
- Confirm `govulncheck ./...` runs from the module root, not a subpackage
  (its call-graph analysis needs the full module).
- Confirm the `go-licenses` install path is `github.com/google/go-licenses/
  v2` (not the bare, unversioned `github.com/google/go-licenses`) — the
  `/v2` suffix is easy to omit and points at a real but stale/incompatible
  path if dropped.

**Anti-patterns:** `go-licenses` invoked via the unversioned module path
(silently resolves to the wrong major version or fails); `govulncheck` run
per-package instead of at module root, missing cross-package call-graph
vulnerabilities.
