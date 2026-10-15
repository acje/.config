---
name: fleet-execution-methods
description: Activity-scoped execution techniques with a single fleet home: non-interactive shell command hygiene, Kent Beck TDD red-green-refactor discipline, and compiled fast developer/verification tooling. Load before executing non-interactive commands, running a TDD increment, or building developer tooling. Techniques are activity-scoped and never confer authority; role prompts and AGENTS doctrine retain authority and safety.
---

# Fleet Execution Methods

One home for reusable execution techniques. Each section is activity-scoped:
load only the section relevant to the current activity, and reload after a
context reload or compaction. Techniques here are **methods**, not authority —
role prompts (hopper, build) and AGENTS doctrine retain routing, safety and
permission control. None of these sections grants edit/run/instrumentation
authority or a new permission by itself.

## Non-interactive Commands

Applies before **any non-interactive execution** (subagents execute
non-interactively; commands that prompt for user confirmation stall execution
indefinitely). Use the force/batch/stream technique only for **already
authorized exact operations**; never make a destructive flag a grant, and never
require quiet when output is itself the evidence.

- Always use non-interactive / force flags: `cp -f`, `rm -f`, `rm -rf` (never
  the interactive aliases).
- Batch / quiet modes where available: `--batch`, `-y`, `--quiet`
  (e.g. `scp -o BatchMode=yes`, `ssh -o BatchMode=yes`, `apt-get -y`,
  `HOMEBREW_NO_AUTO_UPDATE=1`).
- Stream separation: machine-readable findings route to `stdout`; diagnostics
  and logs route to `stderr`. A repository may define a concrete
  stdout/stderr contract of its own (see its AGENTS.md Target Classification);
  this section owns the generic technique, the repo owns the concrete contract.

Deeper bash hygiene — exit handling and `set -o pipefail`, file-tool/search
practice, secret protection, git cadence, machine data, no background daemons,
filter-vs-producer verdicts — is canonical in global `AGENTS.md` § Bash hygiene
and is not restated here. Global Cargo native aliases remain owned by global
§ Bash hygiene → Cargo command noise (canonical).

## TDD (red → green → refactor)

Applies when `success_criteria` describe a behavioural change: run the smallest
shippable increment as red → green → refactor (see also the caller's Mode and
TDD rules — hopper R5/R18 — which remain self-contained obligations).

1. **Red.** Smallest failing test capturing one slice. Run; capture failing
   exit code as evidence. "Failing for the right reason" = failure message
   names the intended behaviour, not a syntax error or missing import.
2. **Green.** Smallest change to flip red→green. Obvious-implementation if
   visible; fake-it (return constant) if not. Don't generalise.
3. **Refactor.** Tests green; remove duplication, improve names. This is a
   *tidying* (Tidy First) — a separate commit. Re-run tests after each tidying.

One assertion-of-intent per cycle. Many small green commits beat one big green
commit. Cycle dragging > ~5 min without green ⇒ slice too big; back the slice
off, not the test.

For cargo work, red/green/refactor uses INNER-LOOP scope for fast crate-local
feedback; the completion done-claim is tier-scoped (global AGENTS §
Verification cadence (canonical); command spellings are repo-native).

## Tool Development

Applies when building developer or verification tooling: prefer compiled,
ultra-fast Rust binaries operating directly on ASTs and files over slow
interpreted wrappers or token-heavy in-context simulation. Fast tools enable
high-frequency local feedback loops (INNER cadence) without friction.

This preserves the compiled-Rust / AST-direct / fast-INNER intent with its
existing developer-and-verification-tooling scope. It is not a universal
implementation-language ban, a new latency threshold, or a daemon grant — the
caller retains project-local authority over where tools live and how they are
run.

## Cargo Command Noise Reduction

When running Cargo in verification loops, use Cargo's native array aliases (configured in `~/.cargo/config.toml`) to reduce routine output noise without filtering streams or narrowing test coverage:

```toml
[alias]
atest = ["test", "--quiet", "--no-fail-fast"]
aclippy = ["clippy", "--quiet", "--message-format=short"]
```

- **Libtest run**: `cargo [+toolchain] atest <selection/options> [-- <harness args>]`
- **Clippy**: `cargo [+toolchain] aclippy <selection/options> -- -D warnings`
- Keep `<selection/options>` (`-p`, `--workspace`, `--all-targets`, `--all-features`, `--locked`) and post-`--` arguments verbatim. Check compatibility before passing `--quiet` to non-standard harnesses (`nextest`, `criterion`, `trybuild`).

## Sourcing Unpublished In-House Rust CLIs

Install in-house Rust CLI tools (`adr-fmt`, `comment-free`, etc.) from their canonical git repo with an explicit pinned toolchain and `--locked`, never via `cargo install --path`:

```sh
cargo +<pinned-toolchain> install --git https://github.com/<org>/<tool> --locked <tool>
```

 Verify provenance via `cargo install --list`, not `--version` alone.

