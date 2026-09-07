---
name: comment-free
description: "Use when checking Rust doc-comment word budgets, running the opt-in two-threshold budget gate, or previewing non-doc comment removal with comment-free. Separates read-only checks from authorized rewrites and preserves required documentation."
---

# comment-free

CLI mechanics support existing Rust comment doctrine; tool defaults do not
define policy. Linus uses read-only modes only.

## Preflight

- Read repository instructions and the files in scope. ROOT accepts a directory
  or one regular `.rs` file; omitted ROOT scans cwd without upward discovery.
  Choose the narrowest authorized scope. Directory scans recursively select
  Rust files with build/hidden pruning, regardless of Cargo.toml. Leaf file
  symlinks are rejected; nested source-hiding links are traversal errors.
  Explicit directory-root links retain traversal. If scope includes unrelated
  files, narrow it or use focused edits instead of rewriting.
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
| Opt-in policy gate | `comment-free --check-doc-budget --doc-advisory-words <A> --doc-max-words <E> --max-warning-files 0 "<ROOT>"` | Read-only independent advisory/enforced evaluation; summary-only details, not reduced coverage. |
| Read-only rewrite preview | `comment-free --rewrite --dry-run "<ROOT>"` | Shows proposed non-doc comment removal **and rustdoc-link canonicalisation**; no files written. |
| Authorized rewrite | `comment-free --rewrite "<ROOT>"` | Writes both passes; only after the safeguards below, never during Linus review. |

`--dry-run` and `--context <N>` require `--rewrite`. Do not use the deprecated
`--rustdoc-link-idioms` alias. Default lint is already read-only.

## Opt-in two-threshold gate

Select thresholds from the mission/repository policy, not this example. Supply
both explicitly: `A <= E`; equal thresholds, including zero, are valid. The
legacy default of 80 does not supply an omitted gate threshold. Gate mode
conflicts with `--rewrite`, `--dry-run`/`-n` and `--rustdoc-link-idioms`.

Canonical-source example (verified mechanics: evidence `config-p7w`):

```sh
cargo run --locked -- --check-doc-budget --doc-advisory-words 80 --doc-max-words 120 --max-warning-files 0 .
```

Set the command's `workdir` to a verified canonical `acje/comment-free` source
checkout (`https://github.com/acje/comment-free`). Here `.` targets that source
checkout itself, not the caller's project. For another target, use the installed
`comment-free` command from the modes table with its explicit ROOT. Do not run
`cargo run` in an arbitrary target project expecting it to invoke comment-free.
If source access is denied, use available installed help and verified evidence;
do not bypass permissions or infer installation provenance from version alone.

Each candidate Rust path is read once and parsed once. The same AST is evaluated
separately against advisory and enforced thresholds; findings, undecided items,
warning files and shown/hidden counters remain independent per threshold.
Warning-file admission is independent per threshold in native path order.
`--max-warning-files` defaults to 1; `0` hides detail records, not findings,
undecided items or errors. All scoped files are still scanned; summaries retain
full and shown/hidden totals. `unlimited` removes the detail cap. The cap is not
accepted with rewrite or the deprecated alias.

| Gate exit | Meaning |
|---|---|
| `0` | Pass: all inspected payloads evaluated, no enforced findings, no undecided items at either threshold, no errors. Advisory-only findings pass. |
| `1` | Confirmed enforced violation with no undecided items or errors. |
| `2` | Unknown/error, overriding any confirmed violation: invalid CLI/thresholds/root, walk/read/parse errors, undecided at either threshold, empty Rust scope, counter overflow, or output write/flush failure. Never treat it as pass or merely an enforced violation. |

Gate JSON Lines use `kind` and `version: 1`: `policy_detail` on stdout,
`policy_summary` on stderr. Legacy records instead use `record` and `v`
(doc-lint/diagnostics v3); a legacy `run_error` may accompany gate output on
stderr. Dispatch by record family/version, not a guessed unified schema. Keep
the producer exit and both streams; missing/corrupt output is not a clean
verdict. The envelope and mechanics above come from `config-p7w`; consult the
matching canonical record grammar only when access is authorized.

## Legacy lint / preview / write exits (not the gate)

| Exit | Meaning |
|---|---|
| `0` | Lint: all inspected doc payloads decided within budget, subject to detection limits below. Preview: no pending rewrite. Write: completed, whether or not files changed; not a lint verdict. |
| `1` | Catastrophic/unmapped I/O error or exact-counter overflow; check unavailable/failed, not clean. |
| `2` | Invalid CLI arguments; correct invocation before interpreting results. |
| `3` | Preview has pending changes; these may be doc links alone, not evidence of an ordinary comment. |
| `4` | Lint finding **or undecided item**. Read `findings` and `undecided` in `lint_summary`; undecided is not a proven violation. |
| `5` | Per-file parse/I/O or traversal errors; inspect `run_error`. Outranks pending-preview exit 3; coverage incomplete. |

Capture both streams and the producer exit. Findings/rewrite records and
preview diffs go to stdout; summaries and run diagnostics go to stderr.
Records are JSON Lines, but the unified diff body and terminal error messages
are plain text: do not feed mixed output wholesale to a JSON parser. Preserve
non-JSON stderr as diagnostics. Consult the installed version's help and,
when authorized, `docs/record-format.md` in its canonical source for grammar.

Macro-valued doc attributes and doc attributes inside macro token bodies can
be undecided. Docs synthesised by procedural macros without a spelled `doc`
token are not detected. Neither lint/gate exit 0 nor lexer-based rewriting proves
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
