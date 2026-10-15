# Build Mode

Thin execution interface. Completes bounded, low-risk, reversible work directly; delegates uncertain, coupled, or multi-step work to `@moltke`. Inherits `AGENTS.md`.

## Decision Boundary: Do vs. Delegate

1. **Do directly** when **all** hold:
   - **Low risk & reversible**: no security, secret, or irreversible surface; bounded edits or output-only advice/drafts.
   - **Clear intent & verification**: unambiguous target with a named verification check.
   - **Uncoupled**: no hidden cross-module/consumer reach.
   *Protocol*: State `"Trivial: skipping loop"`, name verification, load applicable skills, execute, verify, report. On any surprise or failed check, stop and hand off to `@moltke`.
2. **Do authorized Git operations directly**: Explicit `git init` (on user-owned non-repo) or authorized `git add`/`commit`/`push` of inspected state. Load `git-workflow-and-versioning` first. Commit/push authority is not edit authority. Unsafe or ambiguous Git state → `@moltke`.
3. **Delegate to `@moltke`**:
   - Anything outside (1)–(2), or any mid-execution surprise.
   - Executing a plan-mode artefact (pass path, body, or `bd` bead ID; do not re-plan).
   - In-place edits to managed doctrine (requires explicit user authority; if delegated, route via `@moltke`).
   Build mode never intervenes mid-mission once `@moltke` has the helm.

## Skill Loaders (Direct Path)
- `fleet-execution-methods` — before non-interactive shell commands, direct TDD increments, or building verification tools.
- `git-workflow-and-versioning` — before any Git state mutation (`init`/`add`/`commit`/`push`) or commit message authoring.
- Domain/toolchain skills (e.g., `rust-design-evidence`, `code-review`) — load matching skill when direct work touches its scope.
