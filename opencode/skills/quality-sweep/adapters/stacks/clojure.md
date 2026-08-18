# Clojure stack profile

- **Detection markers:** `deps.edn`, `project.clj`, `bb.edn` (babashka),
  `shadow-cljs.edn`.
- **Toolchain slots** (`adapters/toolchains.md` clojure row): test
  project-dependent — `clojure -X:test` (cognitect-labs/test-runner alias),
  `kaocha` (via `bin/kaocha` or `clojure -M:test`), or `lein test`
  (Leiningen projects); detect via which marker file + alias is present.
  lint `clj-kondo --lint <path>` (no canonical `-M:clj-kondo` alias form —
  the direct binary invocation is clj-kondo's own documented form). audit
  `nvd-clojure` — **must be run from a separate helper project, never added
  as a dependency of the target project being scanned**; see probe below.
  deny SKIPPED (no standard tool) — Clojure has no verified license-policy
  tool equivalent to `cargo-deny`; this is a real ecosystem gap, not an
  omission to fill.
- Depth contract and composition rule: see `adapters/stacks/README.md`. Only
  dimensions with a material Clojure-specific probe delta appear below;
  every other dimension INHERITS GENERIC from `references/phase-<n>-*.md`
  as-is.

## Phase 1 — Type safety

**Probes (add):**
- `rg 'clojure.spec.alpha|malli.core'` at namespace boundaries (public `defn`
  entry points, external I/O edges) for a spec/malli schema guarding the
  boundary.

**Anti-patterns:** a public boundary function with no spec/malli validation
on its inputs, relying on duck-typing all the way to a runtime `ClassCastException`.

## Phase 2 — Correctness / bugfix

**Probes (add):**
- Read `clj-kondo`'s reflection-warning output (`:reflection-warning` in
  `.clj-kondo/config.edn` linter config) — reflection is both a correctness
  smell (silently falls back to slow/incorrect dispatch) and a performance
  one in Clojure.
- `rg ':unresolved-symbol|:unused-binding'` findings from a `clj-kondo --lint`
  run for dead or broken bindings.

**Anti-patterns:** unaddressed reflection warnings on a hot path;
unresolved-symbol findings left in committed code (implies the file was
never actually loaded/tested).

## Phase 3 — Lint / format / style

**Probes (add):**
- Confirm `.clj-kondo/config.edn` presence — this file, and any
  `--copy-configs`-imported per-library configs under `.clj-kondo/<org>/
  <lib>/`, are normally committed; only the `.clj-kondo/.cache` analysis
  cache is typically gitignored.
- Run `clj-kondo --lint <path>` (e.g. `clj-kondo --lint src`, or `clj-kondo
  --lint src:test` for both source roots) as the canonical invocation.

**Anti-patterns:** `.clj-kondo/.cache` committed (bloats the repo, machine-
specific); `.clj-kondo/config.edn` absent while CI still claims a lint gate
(nothing is actually configured beyond clj-kondo's defaults).

## Phase 4 — Security

**Probes (add):**
- Confirm any `nvd-clojure` invocation is run from a **separate helper
  project**, e.g. `clojure -J-Dclojure.main.report=stderr -M -m nvd.task.
  check "nvd-clojure.edn" "$(cd <target-project>; clojure -Spath -A:any:
  aliases)"` (or the Leiningen equivalent) — flag any project that declares
  `nvd-clojure`/`lein-nvd` as its own dependency or plugin; this is an
  explicit, documented misuse (the scanner must not be a dependency of the
  thing it scans).
- Confirm a `nvd-clojure.edn` config file exists in the helper project (auto-
  generated with defaults on first run if absent).

**Anti-patterns:** `nvd-clojure`/`lein-nvd` declared as a project dependency
or plugin of the scanned project itself (breaks the tool's own documented
usage model); no helper project at all, meaning the advisory scan has never
actually run.

## Phase 4 — Dependency / build

**Probes (add):**
- No license-policy/deny-equivalent tool exists for Clojure; record this
  slot `SKIPPED (no standard tool)` rather than substituting a dependency-
  freshness tool like `antq` (which checks staleness, not license policy —
  not equivalent).

**Anti-patterns:** treating `antq` output as if it were a license/policy
gate — it answers "is this dependency stale", not "is this dependency's
license allowed".
