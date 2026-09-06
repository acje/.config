---
name: comment-free
description: "Use when checking Rust doc-comment word budgets or previewing removal of non-doc comments with comment-free. Distinguishes read-only lint, rewrite preview and explicitly authorized scoped rewrites; preserves required documentation and rationale."
---

# comment-free

CLI mechanics support existing Rust comment doctrine; tool defaults do not
define policy. Linus uses read-only modes only.

## Preflight

- Read repository instructions and the files in scope. ROOT must be a
  directory, not a single file. Choose the narrowest authorized directory;
  if that includes out-of-scope files, use focused edits instead of rewriting.
- Run `command -v comment-free` and `comment-free --help`. Record
  capability-available or fallback; if absent, use source inspection and
  report the mechanical check unavailable. Do not silently install. When
  provenance matters, use `cargo install --list`; any installation is a
  separate task following canonical-source/toolchain policy.
- Determine the applicable documentation budget from repository/mission
  policy. The CLI default of **80 prose words** is not a fleet limit.
  Fenced code is excluded mechanically, not by semantic example detection.

## Modes

| Mode | Command | What it establishes |
|---|---|---|
| Read-only doc lint | `comment-free "<ROOT>"` | Checks doc prose against the default budget, not absence of ordinary comments. |
| Explicit budget | `comment-free --doc-max-words <N> "<ROOT>"` | Same lint with the selected budget; record N. |
| Read-only rewrite preview | `comment-free --rewrite --dry-run "<ROOT>"` | Shows proposed non-doc comment removal **and rustdoc-link canonicalisation**; no files written. |
| Authorized rewrite | `comment-free --rewrite "<ROOT>"` | Writes both passes; only after the safeguards below, never during Linus review. |

`--dry-run` and `--context <N>` require `--rewrite`. Do not use the deprecated
`--rustdoc-link-idioms` alias. Default lint is already read-only.

## Interpret outcomes by mode

| Exit | Meaning |
|---|---|
| `0` | Lint: all inspected doc payloads decided within budget, subject to detection limits below. Preview: no pending rewrite. Write: completed, whether or not files changed; not a lint verdict. |
| `1` | Catastrophic/unmapped I/O error; check unavailable/failed, not clean. |
| `2` | Invalid CLI arguments; correct invocation before interpreting results. |
| `3` | Preview has pending changes; these may be doc links alone, not evidence of an ordinary comment. |
| `4` | Lint finding **or undecided item**. Read `findings` and `undecided` in `lint_summary`; undecided is not a proven violation. |
| `5` | Per-file parse/I/O or traversal errors; inspect `run_error`. Outranks pending-preview exit 3; coverage incomplete. |

Capture both streams and the producer exit. Findings/rewrite records and
preview diffs go to stdout; summaries and run diagnostics go to stderr.
Records are JSON Lines, but the unified diff body and terminal error messages
are plain text: do not feed mixed output wholesale to a JSON parser. Preserve
non-JSON stderr as diagnostics. Consult the installed version's
help and `docs/record-format.md` in its canonical source for record grammar.

Macro-valued doc attributes and doc attributes inside macro token bodies can
be undecided. Docs synthesised by procedural macros without a spelled `doc`
token are not detected. Neither lint exit 0 nor lexer-based rewriting proves
semantic correctness, complete documentation coverage or fleet compliance.

## Before any write

1. Require explicit rewrite authorization for the exact scope and a rollback
   path preserving unrelated changes. Inspect git status and the full preview.
2. Preserve required API, Errors/Panics/Safety contracts, useful doctests,
   architectural rationale, licenses and tool directives. The tool preserves
   doc comments but changes doc-link payloads and strips non-doc comments
   indiscriminately. If a required notice/directive would be removed, exclude
   that file/scope or stop and report the conflict; do not waive obligations.
3. Prefer focused edits/refactoring when blanket stripping would lose meaning.
   Put durable rationale in existing ADRs/beads under repository doctrine;
   do not relocate arbitrary prose into rustdoc or delete required docs merely
   to meet a numeric budget. Lexical preservation is not semantic safety.
4. After an authorized write, inspect the entire diff and run the mission's
   matching verifies, including rustdoc/doctests when links or contracts are
   affected. Re-run lint and preview as applicable. On failure, inspect actual
   state; do not assume multi-file rewrite is atomic or cancellation rolls back.

Report scope, mode, budget, command, exit, findings versus undecided/errors,
and verification gaps in the existing evidence/review bead. Keep rewrite
authorization and review verdict separate from tool output.
