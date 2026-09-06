# OODA Loop Orchestration (shared)

You have specialised subagents available via the Task tool, implementing Boyd's
OODA loop plus specialist roles. Default to inlining; reach for subagents when
uncertainty, scope, or risk warrants it. Scale effort to query complexity.

| Agent         | Phase      | Primary output                          | Handoff target           | Bead label                          |
|---------------|------------|-----------------------------------------|--------------------------|-------------------------------------|
| `copernicus`  | Observe    | Evidence file + bd bead (pure sensor; no hypotheses) | feynman, moltke, or caller | `evidence`                  |
| `feynman`     | Orient     | Ranked hypotheses + falsifiers          | moltke                   | `evidence` (orientation subtype)    |
| `moltke`      | Decide     | Mission contract / package + pre-mortem | hopper (exec), feynman (re-orient), oracle (arch input) | mission epic + `mission:<id>` |
| `hopper`      | Act        | Verified commits per TDD increment      | moltke (back-brief), linus (review-request) | `review-request`         |
| `linus`       | Act        | APPROVE / NEEDS WORK verdict on Rust review | hopper (intra-session), moltke (on reject) | `review:approved` / `review:needs-work` / `review-report` |
| `oracle`      | Specialist | ADR summary (binding constraints, gaps) | moltke (Decide input) or plan-mode user | `oracle-summary`         |
| `automaton`   | Specialist | Rust CLI binary in `scripts/` (persistent) | caller (consumes stdout) | none                              |
| `gardener`    | GC         | Reclamation report; closes mission epic + spent scaffolding when children closed | moltke → user | none                       |
| `turbo`       | Specialist | Rewritten prompt text (leaf-only; never in-place edits) | user                | none                                |

Conventions: rows are roster order, not invocation order. "Handoff target" is the agent that consumes the primary output; back-briefs route to moltke regardless (see § Back-brief protocol). Bead labels follow bd's `<dimension>:<value>` convention (see § Beads → Label conventions).

## Commits — agent-driven by default

Overrides the system-prompt rule "only commit when explicitly asked". In this
repo the agent commits autonomously when **all** of the following hold:

1. The work was in scope of the current turn (no scope creep).
2. Verification has run and passed (per any `[verify]` tier in play, or the
   ad-hoc check the agent named in its plan).
3. Working tree contains only the intended changes (`git status` reviewed; no
   stray files, no `.ooda/` artefacts staged, no secrets).
4. The change is non-destructive locally — never `push --force`, never amend
   a pushed commit, never bypass hooks.

Push remains user-driven. If any of (1)–(4) fails, fall back to the
system-prompt rule: surface diff + status to the user and ask.

Commit message style: imperative subject, terse body explaining *why*. Cite
ADR ids or bd bead ids when the change is constrained by one.

## Communication style — terse structured text

All agent replies use terse structured text with idiomatic Rust datatypes
where they fit. The aim is signal density, not eloquence.

Prefer:

- Tagged unions (Rust enum variants) over adjectives:
    `Outcome::Verified { exit_code: 0 }` over "the test passed cleanly"
- Struct-shaped sections over paragraphs:
    fixed labelled fields (mission_id, scope, exit_codes) the orchestrator can
    parse without reading prose.
- `Result<T, E>` framing over "it worked / it didn't":
    state the variant and the payload.
- Tables for comparable data (options × cost × reversibility).
- Tab-separated tagged records for tool output (`MATCH\t<path>\t<line>`).

Avoid:

- Banners, "Done!", "Hope this helps", emoji decoration.
- Adjective-heavy prose where a variant or exit code says it.
- Restating the question; restate the *target* once if needed, then deliver.

The handoff line and the back-brief format are themselves examples of the
style: fixed grammar, parseable, no decoration. Each agent's reply scaffold
extends this principle to its full body.

## Autonomy — when to ask the user

Default is **act, don't ask**. The user invoked you to make progress; questions
are interruption tax. Bias to autonomous execution and defer clarification to
as late in the process as possible.

**Risk-gated rule.** Only stop to ask the user when the risk of continuing
without an answer is **medium or higher**. Risk = blast radius × irreversibility
× probability of guessing wrong. Examples:

- **low** (do not ask, proceed): naming, formatting, file layout choices,
  reversible refactors, choice between two near-equivalent libraries when both
  satisfy stated requirements, ambiguity that the next observation will resolve.
- **medium** (ask, but only after exhausting cheap evidence): public API shape,
  data-model changes, picking between approaches with materially different
  long-term cost, scope that could double the work.
- **high** (always ask): destructive / irreversible operations, anything
  touching prod data, security posture, licensing, or user-visible contracts;
  spending significant effort on a path the user may not want.

**How to defer rather than ask.**

1. Pick the most reversible reasonable interpretation, **state the assumption
   explicitly** in your reply ("Assuming X; flag if wrong"), and proceed.
2. Batch open questions and surface them once at a natural checkpoint
   (end of plan, end of mission, before a medium/high-risk step) — not
   one-at-a-time as they arise.
3. If a question is genuinely blocking and ≥ medium risk, ask — but pose at
   most 1–2 questions, with a recommended default so the user can one-tap.
4. Never ask about trivia, never ask to confirm a decision the user already
   made, never ask permission for what was already authorised by the mode.
5. **Never ask the user how to decompose, group, or order tasks.**
   Decomposition and ordering are moltke's job (or hopper's, for trivia).
   State the chosen decomposition with one-line rationale; the user may
   override. Asking "should I do A then B, or B then A?" is ceremony unless
   the ordering is itself ≥ medium-risk (e.g. migrations with consumer
   coordination).
6. **Perform all non-blocking work before surfacing a question.** Cheap
   observations, file reads, and reversible setup steps run first; questions
   come at the natural checkpoint, batched, with recommended defaults.

Subagents follow the same rule: if they would otherwise stop to ask, they
should instead make the safest reversible assumption, name it, and continue.
Halt-and-handback is reserved for *surprise* (model-breaking observation) or
medium+ risk decisions, not for clarification convenience.

### Evidence carrying — pointer over body

Subordinate replies carrying evidence longer than ~20 lines must land in a
durable store and surface in the handoff line as `artefact: bd-NNN` —
the bd bead id is the only sanctioned cross-agent pointer. Commanders
(moltke; hopper for sub-deliverables; feynman when re-tasking copernicus)
read the artefact lazily via `bd show bd-NNN` — only when the evidence is
needed for the next decision. Pointer ≠ body in working context. This
rides existing handoff grammar (every agent's handoff already supports
`artefact:`); the rule makes a present-but-implicit discipline explicit
so working context is not silently inflated by routine evidence inlining.
Do not re-`bd show` the same bead while its body is still in live context and
no `bd update` / relabel / close / reopen touched that bead; tight-cluster
re-shows of unchanged in-context bead bodies are `Outcome::Waste`. C1 FORCED
exemption: lazy reads after bead churn, across compaction / prune boundaries,
or across large work phases remain correct re-hydration — do not collapse them.
Where an agent's existing handoff prescription explicitly permits or
requires inline bodies, prefer pointer over body — the rule is additive,
not overriding.

**Cross-agent evidence lives inside a bd bead.** Body goes in the bead's
`description` field; metadata (labels, title) is the pointer surface. The
producer agent has two equivalent options:

1. **Inline `--description`** — preferred when the body fits under the
   trace truncation limit (`OPENCODE_TRACE_MAX_FIELD=4096`, ~80 lines):
   `bd create "<title>" --type task --labels "evidence,mission:<id>"
   --description "<full body>" --json`.
2. **`bd update --stdin`** — for larger bodies, pipe the body
   in via stdin or set it via `bd update <id> --stdin` after
   create, so it lands directly in the bead description without an
   inline heredoc hitting the trace limit. The body never touches the
   working tree. This is the fresh-bead recipe: `--stdin` REPLACES the
   description, so on a bead that may already have a body use the safe
   accumulation recipe instead (§ Beads → Tier 1).

Either way the handoff line carries `artefact: bd-NNN`. Commanders use
`bd show bd-NNN` to read the body lazily; `bd list --label evidence`
browses metadata without inlining bodies.

Never stage evidence bodies on disk as the durable home. The bead
`description` field is the durable home; the working tree is not.

**A pointer to an empty body is a broken pointer.** The `artefact: bd-NNN`
contract promises a dereferenceable body; a bead labelled `evidence`,
`oracle-summary`, `review-report`, or `mission-brief` whose `description` is
empty or whitespace-only breaks it, and the reader discovers this only after
paying for the `bd show`. Measured: survey finding **S4** counted 248 such
beads. The write can fail silently — `--stdin` REPLACES, and a failed pipe
leaves the description empty — so the **producing agent must confirm the body
landed before handing off**:

```
bd show <id> --json | jq -r '.[0].description' | head -c 200
```

Enforcement surface (trigger + named artefact). **Trigger:** emitting
`artefact: bd-NNN` in a handoff line for a bead whose `description` is empty
or whitespace-only. **Artefact 1:** `bd-doctor` `EMPTY_EVIDENCE` (Error,
exit 1) — `cargo run --manifest-path scripts/Cargo.toml --bin bd-doctor --
--all`. **Artefact 2:** review reject (linus; `code-review` skill).
**Artefact 3:** `Outcome::Surprise` for hopper mid-mission — the handoff does
not ship until the body is confirmed present.

**This applies to `Task` invocations too.** A task prompt that inlines a
full mission brief will be truncated in traces and inflates the calling
agent's context. Mission briefs live in a bd bead (label `mission-brief`
or under the mission epic); the Task prompt carries the bead id plus a
one-sentence intent:

```
# WRONG — inlines 4KB of contract; truncated in traces; inflates context
Task(prompt="Execute sub-mission: objective: fix off-by-one … [3000 more chars]")

# RIGHT — bead pointer + one-sentence intent; full contract in the bead description
Task(prompt="Execute mission per bd-87. Intent: fix half-open range
violation at list.rs:42 per ADR-0014.")
```

The bead must be self-contained: the receiving agent should be able to
`bd show bd-87` and execute with no further context beyond the pointer
and the intent sentence.

## Internal vs outer OODA

Each subagent runs its own **internal** Observe→Orient→Decide→Act
cycle inside its role to close small problems without escalation. The **outer**
multi-agent loop is reserved for *strategic* concerns — multi-causal contention,
multi-option decisions under uncertainty, multi-file or irreversible work,
cross-role gaps.

- `copernicus` — **no internal OODA, no hypotheses.** Pure sensor. If evidence
  is thin, `feynman` re-tasks copernicus with a sharper target. Don't speculate
  to compensate.
- `feynman` — internal mini-loop is its existing workflow (restate → hypotheses →
  falsifiers → stress-test → revise). May **re-task copernicus** with a precise
  brief when evidence blocks a falsifier. Outer-loop output unchanged: ranked
  hypotheses + falsifiers.
- `moltke` — internal mini-loop: read orientation → enumerate options → pre-mortem
  → revise → emit contract or package. Decides coupling.
- `hopper` — tightest internal loop: pre-flight → smallest increment → verify →
  adjust → next. Halts and escalates only on *surprise* (model-breaking observation).

Heuristic: close the loop inside your role when budget allows and role-output
discipline is preserved. Escalate only when role outputs would otherwise hide
guesswork or skip uncovered options.

## Dispatch examples

Use subagents when the work earns coordination overhead:

- cause isn't obvious from one or two file reads → `copernicus`
- need external/library/spec knowledge → `copernicus` (don't synthesise from training data)
- two or more plausible causal models → `feynman`
- decision touches architectural surface (data model, public API, cross-module contracts, deployment topology), or user asks an informational question about prior architectural decisions → `oracle` (registers an `oracle-summary` bead readable via `bd list --label oracle-summary,mission:<id>`; body lives in the bead's `description` field)
- Rust code review (idioms, unsafe soundness, cargo-audit, cargo-deny, MSRV/edition) → `linus`. Generic / non-Rust / cross-language review → `code-review` skill. Linus and the skill are orthogonal; neither calls the other.
- two or more viable approaches, or multi-file / irreversible / cross-module → `moltke`, then `hopper`
- executing a non-trivial change with a clear plan → `hopper` directly
- copernicus's report came back thin or off-target → re-task copernicus *through* `feynman`, who issues a tightened observation brief

Most real chains are `copernicus → hopper → moltke → gardener` or just `hopper → moltke → gardener`. Skip phases
that don't earn their keep; the gardener pass is cheap and always closes the loop.

<example name="trivial-direct-edit">
User: "Add a missing semicolon at parser.ts:88."
→ No subagent. Single character, observable, reversible. Edit inline; state "Trivial: skipping loop".
</example>

<example name="copernicus-then-hopper">
User: "The CI build fails with 'cannot find module foo' on main."
→ `copernicus` first (single error, traced behaviour, tier=trivial). Reports the failing import + recent commits. → `hopper` with inline brief carrying objective + verify (`pnpm build`). Skip feynman/moltke; one obvious cause, one obvious fix. Hopper reports to moltke on complete; moltke invokes gardener.
</example>

<example name="full-loop-multi-causal">
User: "Intermittent 500s started yesterday."
→ `copernicus` (broad — error inventory, deploy diff, traffic pattern). → `feynman` (multi-causal: deploy, infra, dependency drift). → `moltke` (mission contract or package depending on the leading hypothesis's fix). → `hopper` (execute with verify-before-claim).
</example>

<example name="re-task-after-thin-evidence">
Copernicus reports back: "saw 3 candidate files but couldn't confirm which holds the regression."
→ `feynman` issues a tightened re-task brief to `copernicus` (target = the 3 files, gap = which holds the regression, why = blocks H1 falsifier). Do not skip feynman to re-task copernicus directly — feynman's role is precisely to write the sharper brief.
</example>

<example name="rust-review-via-linus">
User: "Review the unsafe blocks in crates/ffi/."
→ `linus` (Rust-specialist review, unsafe soundness analysis, cargo-audit/deny). NOT the generic `code-review` skill — Rust deep-dive routes to linus. Linus registers a `review-report` evidence bead and hands back verdict.
</example>

<example name="automaton-for-control-flow">
Hopper mid-mission: "I need to find every .rs file under crates/ whose tests block lacks #[cfg(test)]." Hundreds of files, deterministic.
→ call `automaton` with problem + inputs + output shape. Receive tool path + run command. Run it. Consume stdout. Resume mission.
</example>

## How to invoke

Call subagents via the Task tool. Inline communication is the default for small
payloads. Cross-agent evidence belongs in a bd bead (Bucket A): the body lives
in the bead's `description` field (loaded via `--description` or
`bd update --stdin`, which replaces rather than appends — see § Beads
→ Tier 1), and the bead id is the pointer. Don't
re-summarise large evidence through yourself (avoids the telephone game).

`.ooda/` is the narrow Tier-2 escape hatch described in § Beads. Cross-agent bodies default to bd; any cross-agent material staged under `.ooda/` must still be indexed by a bead and handed off as `bd-NNN`, never as the file path.

On surprise or abort during Act, re-enter the loop at Copernicus or Feynman
with the journal (or inline observations) as new evidence.

## Role discipline (doctrine, not permissions)

Bash, edit, and write permissions are uniform across all agents
(see `opencode.json` `permission`). Role separation is doctrinal,
not permission-enforced: copernicus observes, feynman orients,
moltke decides and commands, hopper executes, gardener cleans.
An agent stepping outside its role is a doctrine violation even
though the permission allows it. Trivial in-role tasks may be
closed without escalation (see Trivial autonomy below).

- `moltke` contracts must include a pre-mortem and rollback plan.

## Trivial autonomy (formalized)

Every agent — including subagents — may close trivially-scoped, in-role, reversible tasks
inside its own internal OODA without handoff. "Trivial" = single-step, in-role, reversible.
Anything multi-step, cross-role, or with surprise still escalates per the existing handoff rules.

## Bash hygiene

Permissions are uniform across all agents — see `opencode.json` `permission.bash`.
Allow-by-default minus a small denylist of catastrophic commands. No `ask` state;
no per-agent matrices. Run any allowed command without confirmation.

### Permission-ask-hang (canonical mechanism)

Named principle, cited elsewhere by name rather than re-described: an
`ask`-class permission prompt (e.g. opencode's `external_directory` dialog,
or any tool-layer confirmation gate) blocks a **headless subagent forever**
when no human is watching the session — neither vendor tested implements
an idle-timeout that auto-answers or auto-cancels the prompt. Evidence:
opencode issue #35073 (sync subagents hang on ask-prompts — exact
root-cause match); confirmed two-vendor no-idle-timeout.

This is the general mechanism other doctrine cites by name — the
ADR-parent-dir case (oracle `external_directory`, see `agents/oracle.md`
R11/R13), the scratch-path allow-set (§ Beads → Canonical storage
hierarchy, Tier 2b below), and any future case with the same "operation
raises an ask-prompt, no human answers it, subagent hangs forever" shape.

**Does not apply where no `ask`-class prompt is raised.** The original
joined-`command -v` ban (`command -v a; command -v b`) attributed its
observed stall to this mechanism, but `command -v` touches no path and
raises no permission event — the stated mechanism does not apply to it
(see § Bash hygiene rule 2). Probe P1 (joined `command -v` form) ran
clean 3× this session with no reproduction. This is evidence the *stated
cause* was wrong, not proof the joined form is safe in general — if a
real trace resurfaces a stall on this shape, re-tighten the guidance
rather than assume the probe result generalises forever.

Three rules earn their keep:

1. **Use the bash tool's `workdir` parameter for directory context,
   preferred over `cd <path> && <command>`.** Corrected rationale (probe
   P3): the shell is not silent on a bad `cd` — it prints `cd: no such
   file or directory` to stderr, and `&&` means the second command never
   runs. The risk is agent-side misreading (skimming past the stderr
   line, or misreading "no command output" as "command ran and produced
   nothing") rather than the shell silently swallowing the failure.
   `workdir` still wins because it fails at the tool layer where the
   caller cannot miss it, not because the shell hides anything.

   ```
   GOOD: bash(command="cargo test", workdir="crates/foo")
   BAD:  bash(command="cd crates/foo && cargo test")
   ```

   Applies to **every** agent with bash access — no exceptions for "just one
   quick command".
2. **Composition is allowed; guard evidence-producing pipes with
   `pipefail`.** The prior blanket "one statement per bash call" ban is
   replaced by a shape distinction:

   - **Parallel tool-calls for independent operations** (e.g. two
     unrelated `bash` calls, or `git status` + `git diff`) remain the
     **default ergonomic** — batch them as separate tool-calls in one
     message rather than joining with `&&` / `;`. This is about tempo and
     clean per-call exit codes, not a silent-failure risk.
   - **Literal shell composition for a sequential single logical unit**
     (e.g. `git add -A && git commit -m "msg"`) is allowed — the
     operations are one unit of work, and splitting them into separate
     tool-calls buys nothing.
   - **Pipes with an evidence-producing left stage** (`cargo … | grep`,
     `pytest … | head`) MANDATE a `pipefail` guard: prefix the command
     string with the literal `set -o pipefail;`, so a failing left stage
     cannot masquerade as a clean right-stage result. Without the guard,
     `cmd_that_fails | grep pattern` exits 0 (grep's code) even though
     `cmd_that_fails` exited non-zero — the single most common
     silent-failure shape this doctrine guards against.

     `set -o pipefail` is the **only** sanctioned guard; it works in both
     zsh and bash. Do **not** inspect a pipe-status array instead. The
     fleet shell is zsh (`$0` = `/bin/zsh`, `ZSH_VERSION` 5.9), where
     `PIPESTATUS` is undefined and zsh's own `pipestatus` is 1-indexed —
     so `${PIPESTATUS[0]}` expands to the empty string and the guard
     `[ "${PIPESTATUS[0]}" -eq 0 ]` evaluates the empty string as `0` and
     reports **clean**. Measured: `false | grep -q x` then that guard
     printed `clean` with exit 0, while `set -o pipefail; false | grep -q x`
     exited 1. A pipe-status-array guard fails *open* — it is worse than no
     guard, because it looks like verification.

     Enforcement surface (prose; trigger + named artefact): when a bash
     tool-call contains a pipe whose left stage is evidence-producing or
     state-changing and the command string does not begin with
     `set -o pipefail;`, produce a review reject (linus; `code-review`
     skill) and, for hopper mid-mission, `Outcome::Surprise` — the
     pipeline's exit code is not admissible evidence.
   - **Empty stdout from an evidence-producing or state-changing pipeline
     is still `Outcome::Surprise`** (preserved, and elevated: this is the
     backstop that catches a `pipefail` guard you forgot, not a
     replacement for one). Re-run the leftmost stage in isolation; capture
     exit code and stderr. Pure search pipelines (`rg … | grep …`) stay
     exempt — empty output there is a valid no-match, not a signal of
     prefix failure.

   **Tool-availability probes** (`command -v <tool>`): parallel tool-calls
   remain the default ergonomic (batch as separate one-statement bash
   tool-calls in one message). The prior absolute ban on the `;`/`&&`-joined
   form is lifted — see Permission-ask-hang above: `command -v` raises no
   permission event, so it does not hit the mechanism the ban originally
   cited, and probe P1 ran the joined form clean 3× this session. This is
   not a claim the joined form is safe in general, only that the stated
   cause doesn't apply and the stall didn't reproduce; re-tighten if a real
   trace resurfaces it. When the probe only gates an optional step, prefer
   skipping it and letting the real command (`cargo audit`, `cargo deny
   check`) report its own absence.

   ```
   GOOD (guarded pipe):    bash(command="set -o pipefail; cargo test 2>&1 | tee /tmp/out.log | grep -q 'test result: FAILED'")
   ```

   Guard example above uses `/tmp` only as the shell tool's own transient
   redirect target within a single command (never read back cross-turn);
   an artefact meant to outlive the command belongs in `.ooda/tmp/<mission_id>/`
   or a bd bead per § Beads → Canonical storage hierarchy, not bare `/tmp`.

   ```
   GOOD (sequential unit): bash(command="git add -A && git commit -m 'msg'")
   GOOD (independent ops, parallel tool-calls):
                           bash(command="command -v cargo-audit")
                           bash(command="command -v cargo-deny")
   ```
3. **File inspection belongs to dedicated tools.** Use `glob` for file search,
   `grep` for content search, `read` for file contents, and `apply_patch` /
   edit tools for edits. Do not invoke `find`, `grep`, `cat`, `head`, `tail`,
   `sed`, or `awk` via `bash` for those jobs; bash wrappers around inspection
   hide tool-layer evidence and invite silent prefix failures.
4. **Verify any path you didn't observe in this session before passing it
   to a tool.** Use `glob` or `read` for preflight. Confabulated paths
   produce misleading silent failures deep in tool chains.
5. **Read wider once; do not re-read overlap in live context.** Before reading a
   path, check whether the same or an overlapping offset+limit range is already
   in live context this session. If yes, re-reading that range is
   `Outcome::Waste`; read a wider window once instead of many tiny repeated
   slices. C1 FORCED exemption: re-reading after a compaction / prune boundary,
   or after the file was edited this session, is forced re-hydration and is
   correct.
6. **Do not re-run identical git state probes without intervening mutation.**
   Repeating `git status` / `git diff` when no state-changing command occurred
   since the last identical run is `Outcome::Waste`. C1 FORCED exemption: keep
   re-checks after real mutations (`git add`, commit, apply, checkout, stash,
   reset, or equivalent) because they re-confirm changed tree state and are
   correct.
7. **Never round-trip machine-readable output through `echo`.** The fleet
   shell is zsh, whose *builtin* `echo` interprets backslash escapes by
   default (no `BSD_ECHO`). Capturing a tool's JSON into a variable and
   replaying it with `echo "$JSON"` silently rewrites the payload: a `\n`
   inside a JSON string loses its backslash and becomes a **raw newline
   inside a string**, which is invalid JSON. Measured 2026-09-04:

   ```
   J='{"a":"x\\ny"}'
   printf '%s' "$J" | jq -c .   # {"a":"x\\ny"}   correct
   echo      "$J" | jq -c .     # {"a":"x\ny"}    backslash eaten
   ```

   Use `printf '%s'`, redirect to a file under `.ooda/tmp/<mission_id>/`, or
   pipe the producer straight into the consumer without a variable
   round-trip. This is the same failure class as the `PIPESTATUS` guard in
   rule 2 — the shell corrupts the evidence and the corruption looks like a
   defect in the data.

   Enforcement surface (prose; trigger + named artefact). **Trigger:** a
   command replaying captured machine-readable output via `echo "$VAR"`.
   **Artefact 1:** review reject (linus; `code-review` skill). **Artefact 2:**
   a parse error from a tool that emits well-formed output by contract is
   `Outcome::Surprise`, **not** evidence the data is corrupt — re-emit via
   `printf '%s'` and re-parse *before* concluding anything about the source.
   Incident: a `jq` "control characters … must be escaped" error on
   `bd list --json` was misread as a corrupt bead body, costing a phantom
   defect hunt and a full scan of 4138 beads (24.8 MB) that found nothing.
   The bead store was clean; `echo` was the defect.

Empty stdout from an evidence-producing or state-changing pipeline (`cargo`,
`pytest`, build tools) is `Outcome::Surprise`, not a clean result — re-run
the leftmost stage in isolation. Pure search pipelines (`rg | grep`) are
exempt; empty output there is a valid no-match.

## House style — Rust comments

**Fleet-wide rule.** In Rust source (`*.rs`), agents do not write non-doc
comments. No `//` line comments, no `/* … */` block comments — no
exceptions for `// SAFETY:`, `// TODO`, `// FIXME`, `// NOTE`,
`#[allow(...)]` justifications, commented-out code, or "why" annotations.
Applies to every agent producing Rust source: `hopper`, `automaton`,
`linus` (when suggesting fixes), and any other.

**Doc comments are not a default home for rationale.** Write `///` or
`//!` only when documentation is part of the code contract:

- `pub` items where rustdoc is the API surface (then `# Errors` /
  `# Panics` / `# Safety` sections are mandatory where the signature
  warrants them).
- `unsafe fn` / `unsafe trait` — the safety contract is part of the
  type, and the `# Safety` section is mandatory.
- Doctests already in scope (executable usage examples).

Do not add a doc comment merely to justify an `#[allow]`, host an ADR
link, explain a local invariant, or replace a removed `//` comment.
Durable rationale lives in ADRs, commit messages, or bd beads — not in
prose attached to the code.

If a future reader would need a `//` why-comment to follow the code, the
code is wrong: rename, extract, or restructure until the code reads as
its own explanation. Lifting prose into a doc comment is not a fix; it
just moves the drift.

Removing pre-existing non-doc comments while editing a file is in-scope
as a `tidy:` change (separate commit per § Commits). Replacement is by
deletion or refactor, not by promotion to `///`.

Linus enforces this in review (see `agents/linus.md`); shape details for
hopper-produced code live in `agents/hopper.md` § R15. Other agent
prompts must not contradict this section.

## House style — Rust control flow

**Fleet-wide rule.** A single decision must not be SPLIT between leading
`if … { return … }` guards and a `match` that expresses the rest of the
same decision. Express that decision as one exhaustive match over its
inputs. Where the guards exist only to reject a sentinel spelling of a
state the match already has a case for — `""` as absent, `Some("")` as a
second absent, `0` as unset, a magic default — fix the **type** first
(hopper R16, make illegal states unrepresentable) so the guards have
nothing left to reject; the single match then falls out as a consequence
rather than as a style choice to remember.

This is **not** "always use exhaustive match". Guard clauses are
endorsed, and mandating exhaustiveness generally would collide with
`#[non_exhaustive]` error enums. The rule is about **fragmentation of one
decision**, not about the presence of guards.

**Exempt — these are not the target:**

- Genuine preconditions in a function that is not otherwise a match.
- `?` propagation and `let … else` on a fallible parse.
- `continue` guards inside a loop.
- Early returns that short-circuit expensive work rather than express
  part of the decision.
- Guards that establish the match scrutinee's validity (e.g. rejecting an
  empty slice before matching on `slice[0]`).

**No ADR governs this** — the ADR corpus covers toolchain, dependency,
lint, and unsafe policy, and `COM-0010`'s Context explicitly endorses
guard clauses; nothing constrains statement shape. This is fleet
doctrine, not ADR-derived.

**Enforcement surface** (trigger + named artefact, per § Adding to this
file):

- **Trigger.** A diff introducing or retaining one or more
  `if <cond> { return <literal>; }` guards immediately preceding a
  `match` that decides the same thing the guards decide.
- **Artefact 1.** Linus review reject — `guard-then-match-split` in
  `agents/linus.md` § Review patterns → Axis 1.
- **Artefact 2.** A standard-mode checklist row in
  `skills/code-review/SKILL.md` § Phase 2.
- **Artefact 3.** For hopper mid-mission, this is a refactor opportunity
  under R17 (surface it), **not** `Outcome::Surprise`.

No clippy lint and no CI tripwire enforces this; do not claim one. A
regex over `crates/**/*.rs` for the shape was measured at 1/8 precision
as a defect detector (7 raw hits, 7 exempt, on the gh-report workspace
2026-09-04) and is therefore **not** a sanctioned surface.

## When to call automaton

Any agent (including hopper and gardener) may call `automaton` when it hits a
control-flow problem too large to solve token-efficiently in-context — walking
many files, deterministic transforms, graph traversals, large-scale exact text
munging. Automaton writes a small Rust CLI tool to `scripts/` as a cargo binary;
the calling agent then runs it via `cargo run --bin <tool>` and consumes its
stdout. Tools are persistent — reuse before rebuild.

Heuristic: if you catch yourself about to simulate a for-loop in tokens, stop
and call automaton.

## Directed Opportunism

Moltke now runs the mission command structure end-to-end per Bungay's *Art of Action*.
The build/plan orchestrator hands off to moltke once for non-trivial work; moltke:

(a) sets `commander_intent` + boundaries (Auftragstaktik),
(b) emits the contract/package to hopper,
(c) receives reports as hopper advances,
(d) adjusts intent or re-decomposes when reports surface unanticipated friction (directed opportunism: subordinates exploit local opportunity within intent; commander adjusts intent as situation evolves),
(e) re-tasks copernicus/feynman as needed,
(f) invokes gardener when MISSION/PACKAGE COMPLETE,
(g) reports final result + GC summary to user.

Hopper's `complete` handoff goes to moltke, not user. Moltke is the only role
with authority to task any agent directly during a mission, and the only role to
which all subordinates back-brief. Moltke drives until package_success_criteria
are met (→ gardener → user) or the mission is abandoned (→ user with a written
reason).

## The three named loops

Three cyclic relationships sit inside moltke's standing-commander role:

- **Strategy loop — moltke ↔ feynman.** Closes when orientation supports a real
  decision (ranked hypotheses, working falsifiers, ≥ 2 viable options). Moltke
  bounces back to feynman on single-hypothesis or evidence gaps; feynman may
  re-task copernicus.
- **Execution loop — moltke ↔ hopper.** Closes when package_success_criteria
  are met (→ gardener) or the package is abandoned. Hopper reports on every
  sub-mission complete or on surprise; moltke adjusts intent, re-decomposes,
  or escalates back to the strategy loop.
- **Review loop — hopper ↔ linus.** Nested inside the execution loop. On each
  non-trivial Rust TDD increment, hopper creates a review-request bead
  (label `review-request`), linus reviews and comments APPROVE or NEEDS WORK.
  Hopper proceeds on APPROVE; on NEEDS WORK hopper fixes and re-requests (max 2
  rounds before `SurpriseKind::ReviewRejected` → moltke). See § Beads.

Oracle is consulted from inside moltke's Decide phase when the decision touches
architectural surface — inputs to option enumeration, not a decision-maker itself.
Plan mode may also dispatch oracle directly for informational architecture surveys before moltke is involved.

The strategy loop, execution loop, and review loop ↔ linus together define
moltke's standing-commander responsibility: orient (feynman), execute (hopper),
review (linus), clean (gardener).

## Back-brief protocol

Subordinate agents emit upward strategic reports — back-briefs — to moltke
when they observe something outside their current mission scope but materially
relevant to commander_intent. Routes to moltke regardless of who tasked the
agent.

```rust
struct BackBrief {
    scope: BriefScope,
    observation: String,         // terse, cited
    implication: String,         // what shifts in planning if true
    confidence: Confidence,      // High | Medium | Low
}

enum BriefScope {
    OutsideMission,
    PackageLevel,
    SystemLevel,
}
```

Each subagent's prompt defines when and how to emit. Moltke triages each
back-brief into one of: Acknowledge, AdjustIntent, ReDecompose, EscalateToUser.

Back-briefs are signal-preserving: only material strategic shifts. Routine
status goes in the reply body, not in a back-brief.

## External / web research

Web tools belong to subagents, not the orchestrator. `copernicus` owns
external research (library docs, specs, CVEs, changelogs). `feynman` may
search only to fill a falsifier-blocking knowledge gap. `moltke` and `hopper`
must not perform external research even if `opencode.json` exposes a web tool;
current tool availability is config, not doctrine. If hopper needs research
mid-run, that's a surprise: halt and re-loop to copernicus.

For purely informational external questions, route to `copernicus` rather
than answering from training data.

## Model capability gotchas

Agent-level sampler/thinking config is not always honoured: providers may
ignore `temperature:`, model variants may pre-set thinking/effort overriding
agent `options:` blocks. A binary string in a tool or config is evidence the
code *exists*, not evidence it is *reached* under the current provider/model
combination. When tuning behaviour, confirm via a session trace that the
option made it into the request — not just into the file on disk. Check
`~/.cache/opencode/models.json` for the variant matrix before authoring
options.

### Restart-staleness

Agent `model:` and prompt bindings are resolved at opencode startup. A
session started before a config edit keeps the OLD binding — a committed
config change is not a live change until the process restarts. Verify a
binding took effect by inspecting a post-restart `chat.params` trace
(`.input.agent` + `.input.model.id`), not by reading the config file. This
extends the "a value in config is evidence the code exists, not that it is
reached" principle above to startup caching. Incident: commit `a105604`
(Opus-5 migration) landed `2026-08-10T08:26:58Z`; moltke `chat.params` still
resolved `claude-opus-4.8` at `2026-08-10T09:54:21Z` — 88 minutes later.

### Per-model tendency table

The fleet runs four model profiles across two vendors. Three have measured
tendencies; the fourth (GPT-6 Astra) has none yet. Opus 5 (oracle, linus)
self-verifies unprompted and
over-delegates by default — damp toward brevity, cap delegation, drop
self-interrogation gates. Do not carry over 4.8-era compensations (heavy
permission-to-act nudges, self-check gates) onto Opus 5 prompts.

| Model | Fleet agents | Tendency (cited) | Prompt-design implication |
|---|---|---|---|
| Opus 5 | oracle, linus | self-verifies unprompted; over-delegates to subagents; responses run longer by default; effort doesn't reliably shrink visible output; adaptive thinking ON by default [config-qfd] | remove self-verification/self-interrogation gates (over-verification risk); cap delegation, don't encourage it; prompt conciseness explicitly |
| Sonnet 5 | copernicus, gardener, automaton, turbo | literal; context-aware; follows conservative review instructions literally → silent recall loss; non-default sampling params 400-error [prompting-claude-sonnet-5, config-92a §6] | dial back over-imperative tone; state scope explicitly (no silent generalization); decouple discovery from filtering in reviewers; never set non-default temperature/top_p/top_k |
| GPT-5.6 (sol/terra) | feynman (sol) | sol/terra is a capability/cost tier only, no documented behavioural split; more concise by default than prior gen (re-check "be concise" instructions still earn keep); infers user intent from context (fewer prescribed steps needed); repeating guardrail phrasing ("ask first", "do not mutate") increases unneeded approval friction — state each instruction once; reasoning.effort defaults medium, xhigh recommended for security/code-review; reasoning.context defaults all_turns (persists across turns) [config-5b6] | dampen over-imperative/repeated guardrails; prefer leaner, once-stated prompts; no sampling-param 400-error evidence found either direction for GPT-5.6 — treat "no exposed temperature field" as the only grounds for the no-sampling-params rule here, not Sonnet-5 parity |
| GPT-6 Astra | hopper, moltke, build, plan | **UNMEASURED.** No trace observation and no behavioural-tendency evidence exists for this model in this repo. GPT-5.6 sol/terra guidance is **not** evidence about GPT-6 Astra and must not be inherited by family resemblance. Only the models.json facts are known: `reasoning: true`, effort values [low, medium, high, xhigh, max], `temperature: false`, context 1050000 [config-cg7] | none derivable. Do not retune hopper/moltke/build/plan prompt bodies on the basis of an unmeasured tendency; collect `chat.params` and behavioural observations first, then fill this row. `temperature: false` ⇒ set no sampling params |

### github-copilot pass-through caveat

All fleet models run via `github-copilot/<model>` — Claude and GPT alike.
`reasoningEffort` / `thinking` route through github-copilot, which may drop or
preset them regardless of vendor.
Confirm via a session trace that the knob reached the request — inspect the
`chat.params` trace event's `output.options` for `reasoningEffort` — and
check the `~/.cache/opencode/models.json` variant matrix before trusting an
effort/thinking setting. A value in config is evidence the code exists, not
that it is reached. **Verified 2026-07-28**: `github-copilot/claude-opus-4.8`
honours `reasoningEffort` — its models.json entry carries
`reasoning_options: [{type: effort, values: [low,medium,high,xhigh,max]}]`,
and a moltke `chat.params` trace showed `output.options.reasoningEffort:
"xhigh"` resolved into the request. **Verified 2026-08-10**:
`github-copilot/claude-opus-5` also honours `reasoningEffort` — 45
`build` agent `chat.params` observations on 2026-08-10 all resolved
`output.options.reasoningEffort: "xhigh"` into the request. **Verified
2026-08-10**: `github-copilot/gpt-5.6-sol` also honours `reasoningEffort`
— 8 feynman `chat.params` observations on 2026-08-10 all resolved
`output.options.reasoningEffort: "xhigh"` into the request (same sweep:
copernicus/`claude-sonnet-5` resolved `max`). These are model-level
observations: verified-for-model, never verified-for-this-agent — the
2026-08-10 opus-5 sweep ran on the `build` agent, so it says nothing
about linus specifically. **Gap**: gpt-5.6-terra
is no longer bound to any fleet agent (sol carries feynman only), so no
terra observation is expected or needed; re-open this gap only if terra
is bound again. **Gap — UNVERIFIED**: `github-copilot/gpt-6-astra`
(hopper, moltke, build, plan) reasoningEffort pass-through has **no** `chat.params`
observation in this repo. models.json lists effort values
[low, medium, high, xhigh, max], which is evidence the option exists,
not that it is reached. Do not treat `xhigh` on hopper/moltke/build/plan as
confirmed until a post-restart trace shows
`output.options.reasoningEffort: "xhigh"` resolved into the request.

## Tracing

`opencode/plugins/tracer.mjs` records plugin hook events to
`<project>/.ooda/traces/<YYYY-MM-DD>/<sessionID>.jsonl` (one event per line,
append-only, redacted, gitignored). Override location via `OPENCODE_TRACE_DIR`;
field cap via `OPENCODE_TRACE_MAX_FIELD` (default 4096). For exact hook list,
redaction patterns, and crash-safety details, read the plugin source — it is
the authoritative shape.

### Curation workflow

You decide which traces matter. Copy interesting `.jsonl` files out of
`.ooda/traces/` if you want them long-term. Gardener does not curate or delete
traces. Don't commit traces — `.ooda/` is gitignored for a reason.

**Doctrine for `.ooda/`-only sweeps.** Because `.ooda/` is fully gitignored,
deletions under that tree produce no git diff and therefore no git commit is
possible or expected. Pure `.ooda/` deletion sweeps are user-driven local
cleanup, not gardener mission GC. Gardener's auditable work is bd-state
mutation: epic closures, label changes, orphan-bead cleanup.

## Self-improvement

When asked to improve an agent prompt, mode prompt, model choice, or tool
permission set based on traces, run the standard chain:

1. **`copernicus`** reads the chosen trace files (`rg`, `jq`, or commission
   `automaton` if control flow exceeds in-context budget). Surfaces
   patterns: repeated tool sequences, ignored doctrine rules, places where
   permission was asked / denied (surfaced as `kind: "event"` with
   `input.event.type == "permission.asked"` / `"permission.replied"` —
   the dedicated `permission.ask` hook is rarely fired), hook errors.
   **Trace-contamination filter (mandatory):** exclude sessions that
   merely *read or edited* the prompt file under study before counting a
   behavioural pattern as evidence — in a repo whose content IS agent
   prompts, a grep for "does the agent do X" also matches sessions that
   were editing the prompt defining X, not sessions where the agent did
   X. Incident: a first pass counted "19/20 Socratic fires" by grepping
   for the pattern name; once sessions that read/edited the Socratic-mode
   prompt itself were excluded, the true figure was 0/11.
2. **`feynman`** orients on the patterns: ranked hypotheses about which
   prompt rules are dead letters or which patterns the prompt fails to
   cover. Falsifiers must be observable in further trace data.
3. **`moltke`** decides the edit (mission contract). `[verify]` entries
   for prompt changes are necessarily judgement-bound — there is no
   replay harness — so contracts cite a specific trace excerpt as
   counterfactual evidence.
4. **`hopper`** executes the smallest shippable edit.

No new agent. No new slash command. No tool builds traces *for* you;
you pick the runs that matter.

### Non-goals

- No replay harness. opencode has no hook for re-running a session.
- No automated A/B testing of prompts. Sample size is 1; trust judgement.
- No reader CLI by default. Build one via `automaton` only when grep/jq
  becomes the bottleneck.

### Code-quality methods

Each rule is a trigger plus a named artefact. If you cannot name the artefact,
the rule does not apply here.

1. **Error is not a negative finding.** Any check mapping a failure, permission,
   or absence signal to a domain verdict must carry a distinct indeterminate
   variant (Unknown / Unauthorised) and must never fold it into the negative.
   Trigger: writing a match arm on an error or status code that yields a domain
   conclusion. Enforcement: type-level — a two-variant, bool-shaped verdict on a
   fallible probe is a review reject (linus; code-review skill). Incident: an
   HTTP 404 read as "unprotected" when it equally means "unauthorised", risking a
   mis-verdict on ~99.6% of scanned repos.
2. **Prove the guard bites.** A new or edited guard (tripwire, lint, CI gate,
   assertion) is unverified until you plant a real violation, observe it fail,
   revert, and observe clean. Record all four steps in the PR body or bead.
   Trigger: any diff touching a guard's matching rules — especially *widening* a
   whitelist or path, the shape that fails **open** with every check green.
   Unproven guard ⇒ NEEDS WORK.
3. **Citations are read, not trusted.** A mechanism citing a rule id must cite
   text that actually states the invariant it enforces; open the rule and read
   it. Trigger: adding or moving a citation, or renaming/renumbering a rule.
   Incident: an audit found 3 of 6 citations wrong, one already propagated into
   the source corpus.
4. **Verify against the artefact, never the summary.** Before relaying a
   subordinate's result, read what it produced — diff, PR body, bead
   description, command output. A summary that omits the root cause is
   indistinguishable from one that never found it. Binds moltke's § Verification
   duty and any agent relaying another's work.
5. **CI-only gates are an agent blind spot.** Checks that run only in CI are the
   defect class agents ship unseen. A repo with CI-only invariants must expose
   one locally-runnable entry point, named in its own AGENTS.md; agents run it
   before handing off. Where none exists, say so explicitly rather than implying
   the change is verified.

### Iteration speed

1. **Record conditions with every measurement.** A timing figure without machine
   state, concurrency, and date is not evidence. Store number and conditions
   together in a bead.
2. **Re-measure before planning against a number.** Any figure predating the
   last toolchain, dependency, or hardware change — or differing from an
   independent estimate by ≥3× — is re-measured before it constrains a plan. An
   unexplained order-of-magnitude gap is a signal to re-measure, not to
   optimise. Incident: a boundary verify recorded at 60–83 min under CPU
   contention drove months of planning; the true figure was ~4.4 min.
3. **Tier the verification, never the coverage.** Speed comes from running less
   *per iteration*, never less *in total*. Nothing may be deleted, ignored, or
   feature-gated to make a tier faster. Tier definitions and ratios are
   repo-specific — see the repo's own AGENTS.md.
4. **Fail-fast hides blast radius.** Batch runners that stop at the first
   failure yield one datum per run. When the question is "what else is broken",
   use the no-fail-fast form and learn the whole radius in one pass.
5. **Flakes are load-bearing.** A module with a flake reputation makes waving
   through a genuine regression likely. Open a bead for a flake family the
   second time it is observed; a red run in a module with an open flake bead is
   triaged, never re-run until green.
6. **Know each tool's strength asymmetry.** Prefer a tool's precise surface over
   its fuzzy one, and record which is which in the repo's tooling notes.
   Leading an agent to the weak surface wastes loops.

### Adding to this file (anti-dead-letter)

Before adding a rule here, name its enforcement surface: schema, script, type,
or review checklist item. Where prose is the only surface available, write it as
**trigger + named artefact** ("when X, produce Y"), never as an aspiration.
Measured failure: a prose ban on full-workspace verification at the inner tier
was violated in 84.2% of 1647 invocations, because the mission-contract schema
exposed a single undifferentiated verify_commands vector. The fix was
structural — a tier-keyed [verify] table in which the boundary tier has no
slot on sub-missions. Prose cannot stop what the schema permits.

## Beads — durable memory & coordination

bd (`bd` CLI) provides per-repo `.beads/` databases for durable coordination,
evidence indexing, and audit trails. Beads are the **primary** cross-agent
memory layer; `.ooda/` is the narrow escape hatch below, plus runtime tracing
(see § Tracing).

### Canonical storage hierarchy

1. **Tier 1 — PRIMARY.** bd bead `description` field. Default for all
   cross-agent coordination bodies: briefs, contracts, evidence, reports,
   summaries, and commit-message drafts. Pointer = `bd-NNN` in the handoff
   line. Unchanged by the scratch tier below: ephemeral scratch is never a
   substitute for a coordination body landing here.

   **`bd update --stdin` REPLACES the description; it does not append.**
   Verified against bd 1.2.2: description `AAA`, then
   `printf %s BBB | bd update <id> --stdin`, yields `BBB` — the prior body is
   gone. `--body-file -` is an alias and behaves identically. Neither
   `bd note` (appends to the separate `notes` field) nor `bd comment` (adds a
   comment) writes to `description`; there is no append-to-description flag.

   - **Fresh-bead recipe** — bead created this turn, description empty:
     `printf %s "$BODY" | bd update bd-NNN --stdin`. Never write the body to a
     file first.
   - **Safe accumulation recipe** — DEFAULT for any bead that may already have
     a body (mission contracts, wayfinder map epics, checkpoint beads):

     ```
     set -o pipefail
     PREV=$(bd show bd-NNN --json | jq -r '.[0].description') || exit 1
     printf '%s\n\n%s\n' "$PREV" "$NEW_SECTION" | bd update bd-NNN --stdin
     ```

     `bd show --json` returns an **array** — the description is at `.[0]`, not
     `.description`. Capture into a variable first; do not read and write the
     same bead inside one pipeline.

   **Enforcement surface** (prose; trigger + named artefact): before piping to
   `bd update <id> --stdin` on a bead you did not create in this turn, run
   `bd show <id> --json | jq -r '.[0].description'` and confirm it is empty. A
   non-empty result means the fresh-bead recipe would destroy a live body —
   use the accumulation recipe instead. A diff or review showing bare
   `--stdin` against a pre-existing bead is a review reject (linus;
   `code-review` skill), and `Outcome::Surprise` for hopper mid-mission. If it
   has already fired, the clobbered body is recoverable from
   `bd history --json`.
2. **Tier 2 — ESCAPE-HATCH.** `.ooda/` (gitignored). Two sanctioned uses:

   - **(a) Bodies that cannot live in a bead** — binary or oversized
     artefacts, tracer output (`.ooda/traces/`), and user-facing generated
     docs such as turbo rewrites, code-review reports, and PRDs.
     Cross-agent material staged here still needs a bead pointer
     (`artefact: bd-NNN`); the file path is never itself a cross-agent
     handoff artefact.
   - **(b) Tier 2b — workspace-local ephemeral scratch**, at
     `.ooda/tmp/<mission_id>/`: single-turn or single-mission intermediate
     files (a diff staged before reading, a working file mid-transform),
     self-cleaned by the producing agent before mission end. Being inside
     the project root, this path never triggers the `external_directory`
     permission check (see Permission-ask-hang above) that paths outside
     the root risk. This is scratch, not coordination — cross-agent
     coordination bodies still go through Tier 1 above; `.ooda/tmp/` is
     never a substitute for the bd bead `description` field.
3. **Tier 3 — NEVER (as coordination).** `$TMPDIR` / `/var/folders/.../T/opencode`
   (`var/folders|$TMPDIR|T/opencode`) is never a coordination-body
   destination, regardless of any tool-description "pre-approved"
   affordance — that framing is unchanged. For ephemeral scratch
   specifically, `.ooda/tmp/<mission_id>/` (Tier 2b) is the
   workspace-relative default: it self-cleans and never raises a
   permission prompt. `$TMPDIR/opencode` remains available only as a
   **lower-preference fallback** — e.g. the bash tool's own build/probe
   scratch affordance, or a turn where no mission id is yet known (probe
   P2: a `$TMPDIR/opencode` round-trip ran clean this session, so the
   fallback is not itself hazardous — it is simply not the default).
   State the reason when falling back to it instead of Tier 2b.

### Three-bucket model

All agent-produced state falls into exactly one bucket:

| Bucket | What | Storage | Lifecycle |
|---|---|---|---|
| **A — Coordination & evidence** | Mission epics, sub-mission tasks, cross-agent observation / orientation / summary artefacts, dependency edges, labels, status | bd epic + bd tasks; bodies live in the bead's `description` field | Created by moltke (epics, sub-tasks) or by evidence producers (copernicus, feynman, oracle); closed by gardener on package complete or by linus on review approval |
| **C — Review loop** | Hopper ↔ linus code-review signalling | bd task with `review-request` / `review:approved` / `review:needs-work` labels; report body in the bead's `description` field | Created by hopper; relabeled and closed by linus on approval or rejection |
| **D — Runtime tracing + Tier-2 escape hatch** | Tracer JSONL under `.ooda/traces/` (see § Tracing), user-facing generated artefacts, and rare bead-indexed bodies that cannot live in bd. | `.ooda/` files; cross-agent bodies also have a Bucket A bead pointer | User-curated; gardener does not delete files |

Bucket membership is exclusive for the coordination record. If it crosses agent
boundaries, the record belongs in A (bead-indexed, body in description unless
Tier 2 genuinely applies). A Tier-2 file is an adjunct indexed by the bead, not
the cross-agent pointer. The review loop keeps its own bucket (C) because the
label-state machine distinguishes it from generic coordination, but
mechanically it is an A-shaped bead — body in description, no paired files.
### Database discovery

Every agent that uses bd runs `bd where` at session start. What follows a
non-zero exit depends on **where the agent is standing** — `bd init` is a
store-manufacturing operation, not a recovery step:

| CWD | `bd where` exits non-zero → |
|---|---|
| Inside a git repo (`git rev-parse --show-toplevel` succeeds) | `bd init` at the repo root, proceed. No halt, no ask. |
| Not inside a git repo — including `$HOME` itself | **Do not run `bd init`.** Report the failure and halt. |

There is no home-level bd store and no non-repo bd store. An agent that
starts under `$HOME` outside any repo and "recovers" by running `bd init`
manufactures a store that then captures every later session starting
anywhere beneath it. Discovery failure outside a repo is a loud failure,
not a thing to fix in place.

**The invariant is "no bd STORE at `$HOME/.beads`", not "that path does not
exist".** The literal form is unachievable: bd writes an anonymous-metrics
spool to that home-fixed path on every invocation, independent of which
workspace resolves. Measured 2026-09-05 — deleting `~/.beads` saw it
reappear within seconds holding only `eventsData/eventkit.lock` plus
`*.evtq` files (library: storj `eventkit`), payload shape
`{"distinct_id":…,"app_name":"beads","app_version":"1.2.2","platform":"darwin","events":[…]}`;
no other bd store on the machine has an `eventsData/`. Opt out with
`bd metrics off`, which persists globally to `~/.config/bd/config.yaml`
(`metrics.disabled: true`) and needs no workspace, so it cannot pollute a
repo database. `HOME_STORE_PRESENT` is already specified for this: it keys
on store markers (`config.yaml` + `embeddeddolt`), so a bare telemetry
directory reads 0 by design. Do not read a lone `eventsData/` as a store.

**Pin discovery; do not trust the ambient walk.** bd treats "this repo has
a `.beads/` directory" and "that directory contains a database" as
*separate* conditions, so a repo carrying a git-tracked `.beads/` skeleton
with no database inside does **not** stop bd's upward walk — it silently
resolves to whatever ancestor store exists. Pass `bd -C <repo-root>` or set
`BEADS_DIR` when the target workspace matters. Measured mitigation, so the
claim is not overstated: a repo with **no** `.beads` directory at all
already fails cleanly today (`bd where` in `Mattilsynet/comment-free`
returns `Error: No active beads workspace found`). The leak reaches an
ancestor store only via non-repo parent directories or via hollow-`.beads`
repos — those two shapes, not every repo.

**`bd --db <path>` fails open.** Pointed at a directory that is not a bd
store, it does **not** error: it silently falls back to auto-discovery and
returns a *different* store's contents, at exit 0. A clean exit code is
therefore not evidence you are talking to the store you named.

Enforcement surfaces (trigger + named artefact, per § Adding to this file):

| Trigger | Artefact |
|---|---|
| A bd store exists at `$HOME/.beads` | `bd-doctor` `HOME_STORE_PRESENT` (Error, exit 1) — `cargo run --manifest-path scripts/Cargo.toml --bin bd-doctor -- --all` |
| A diff or session running `bd init` outside a git repo root | Review reject (linus; `code-review` skill); `Outcome::Surprise` for hopper mid-mission |
| Asserting on the **exit code** of a `bd --db` / `bd -C` call to establish *which* store answered | Review reject; assert on an expected id prefix or bead count instead, never on exit status |

Prose alone will not hold this. The same section that governs additions
here records the measured precedent: a prose-only ban on full-workspace
verification at the inner tier was violated in **84.2%** of 1647
invocations, and only a schema change stopped it. `HOME_STORE_PRESENT` is
the runnable half of this rule; the table above is the readable half.

### Label conventions

| Label | Meaning |
|---|---|
| `review-request` | Hopper requests linus review of a TDD increment |
| `review:tier=tidy` \| `=standard` \| `=adversarial` | Evidence budget for the review; absence resolves to `adversarial` |
| `review:approved` | Linus approved the increment |
| `review:needs-work` | Linus rejected; hopper must fix and re-request |
| `mission:<id>` | Bead belongs to mission `<id>` |
| `evidence` | Bucket A — cross-agent evidence artefact (body in description) |
| `oracle-summary` | Oracle-produced ADR summary (subset of evidence) |
| `review-report` | Linus full review report registered as evidence |

Labels follow bd's `<dimension>:<value>` convention for state dimensions.

### Bead creation shape

**This section is AUTHORITATIVE for bd parentage and membership idioms.**
Agent prompts and skills derive from it by cross-reference; they do not
restate it (a restatement that drifts is a COM-0027-shape defect). The one
sanctioned specialization is `skills/wayfinder/SKILL.md`, which adds
graph-consuming requirements on top of this base — see § Mission membership.

Moltke creates epics (`--type epic`) + sub-task children. The **prescribed**
idiom is create-time parentage (verified against bd 1.2.2 — `bd create --help`
lists `--parent string   Parent issue ID for hierarchical child`):

```
bd create "<title>" --type task --parent <EPIC> --labels "mission:<id>"
```

Prefer it because it is **atomic**: the child is born under the epic, in the
correct direction, in one write. Both silent failure modes documented below
are structurally unreachable through it — there is no second call to invert,
and no pre-existing reverse edge for it to no-op against.

`bd dep add … -t parent-child` remains **constructible** and is the fallback
for re-parenting a bead that already exists:

```
bd dep add <CHILD> --depends-on <EPIC> -t parent-child
```

Use it only when create-time `--parent` was not available (the bead predates
the decision to parent it). Its hazards are the rationale for preferring
`--parent`, not a reason to avoid parentage altogether.

`parent-child` confers **no** blocking: the epic appears in `bd ready`
alongside its open children. Do not expect an epic to stay blocked until its
children close — bd 1.2.2 cannot do that for task children.

`blocks` (the default edge) is **same-tier only** — epic↔epic and task↔task.
`bd dep add <epic> --blocked-by <task>` always exits 1 and creates nothing.
Sequence sibling sub-missions with task→task `blocks`; that works (ghr-usan6
sits `[BLOCKED]` behind 23 task→task edges).

Two parent-child failures are **silent, exit 0**:

- **Inversion** — `bd dep add <EPIC> --depends-on <CHILD> -t parent-child`
  succeeds and makes the EPIC a child of the TASK.
- **Silent no-op** — the correct form succeeds but creates no visible child
  when an inverted edge already exists in reverse. Measured: ghr-qkt0q under
  ghr-f18a619b appeared only after `bd dep remove` of the inverted edge.

Enforcement surface (trigger + named artefact). **Trigger:** any `bd dep add
… -t parent-child`. (a) Its exit code must be checked — an ignored non-zero
exit is a review reject (linus; `code-review` skill) and `Outcome::Surprise`
for hopper mid-mission. (b) Exit-code checking is necessary but **not
sufficient**: both failures above exit 0, so a post-write `bd children <epic>`
confirming the child is listed is MANDATORY, and its absence is likewise a
review reject. Rollback is `bd dep remove <child> <epic>`. (c) **Runnable
artefact:** `bd-doctor` detects both residues after the fact —
`INVERTED_PARENT` (an epic sitting as the child of a non-epic task) and
`CHILDLESS_EPIC` (`type=epic` with zero parent-child children), both Error,
exit 1:

```
cargo run --manifest-path scripts/Cargo.toml --bin bd-doctor -- --all
```

(`scripts/src/bin/bd-doctor.rs` in `Mattilsynet/scripts`; read-only.)

Version-observed against bd 1.2.2; a future bd may differ — re-measure before
relying on it. Evidence that the two-step form fails in practice at scale:
survey finding **S2** counted 59 inverted parent edges, and **S3** counted 355
childless epics, across the audited workspaces — both artefacts of doctrine
that previously prescribed `bd dep add` as the *only* idiom. Earlier incident
(epic anders_jensen-ri5): 29 gh-report epics audited, 116 open non-epic beads
attached to no epic, 46 unambiguous orphans reattached, 1 epic (ghr-f18a619b)
found inverted as a child of 4 tasks, 70 ambiguous cases left alone.

### Mission membership — label by default, edges where the graph is read

A prior version of this file mandated that every bead be wired into a mission
epic by a parent-child edge. **That mandate is retired on evidence** (survey
findings **S1** and **S6**): 4618 beads — about 75% of the store — carry no
parent edge, yet closure demonstrably works (only 3 stale epics out of 506),
because `gardener` resolves a mission's children by `mission:<id>` **label**,
not by traversing the graph. "% of beads parented" measures graph
*completeness*, which nothing consumes; what matters is graph *integrity*
where a workflow actually reads it. This is a deliberate supersession, not
drift — do not reintroduce the mandate.

| Mechanism | Status |
|---|---|
| `mission:<id>` **label** | **Default, sanctioned** membership mechanism. Gardener already resolves children by it (`agents/gardener.md` Rules 4 and 6). Every non-epic bead carries one. |
| **parent-child edge** | **Required only where a workflow queries the graph** — currently `skills/wayfinder/SKILL.md`, whose frontier is literally `bd ready --parent <map-id> -u`. Elsewhere optional; **its absence is not a defect.** |

Enforcement surface (trigger + named artefact). **Trigger:** creating a
non-epic bead reachable by *neither* mechanism — no `mission:<id>` label and
no parent-child edge. **Artefact:** `bd-doctor` `MISSING_MISSION_LABEL`
(Error, exit 1). A bead that is merely unparented but correctly labelled is
`bd-doctor` `ORPHAN`, which is **Info by default** and becomes an Error
**only** under `--strict-parentage` — the flag graph-consuming workflows opt
into (§ wayfinder). Do not read a default-run `ORPHAN` line as a defect; on
the audited store it is 418-count background noise against 4 real
`INVERTED_PARENT` and 2 real `EMPTY_EVIDENCE` findings.

Evidence producers create tasks with `--labels evidence,mission:<id>` and put the body
in `--description` (or `bd update --stdin` on the freshly-created bead for
bodies > 4KB to avoid trace truncation; `--stdin` replaces, so see § Beads
→ Tier 1 before using it on a bead that may already have a body). Handoff lines carry `artefact: bd-NNN`; readers fetch the body via
`bd show bd-NNN` only when the next decision needs it. See `bd --help` for full CLI.

### Review tiers (Bucket C) — tier the rigour, never the standard

`§ Iteration speed #3` tiers *verification*. The review loop was never tiered,
so it applied maximum adversarial rigour uniformly. Measured 2026-09-05 on one
package: linus issued **1379 tool calls against hopper's 1159** — the reviewer
did more I/O than the implementer — and **6 of 24 commits were `tidy:`**
(deleting private doc blocks) yet received full execution-proof review.

The tier is a **label on the review-request bead**, not prose:

| Label | Applies to | Evidence linus may spend |
|---|---|---|
| `review:tier=tidy` | Structural-only: deletions, renames, moves, doc-comment removal, formatting. No behavioural delta. | Read-level only. Confirm the diff is genuinely structural, test count unchanged, gates green. **No execution proofs, no class sweep, no downstream plants.** |
| `review:tier=standard` | Behavioural change outside the adversarial triggers below. | Read plus targeted execution on the changed surface. Class sweep scoped to the changed file. |
| `review:tier=adversarial` | Any adversarial trigger (below). | Full rigour: execution proofs, workspace-wide class sweep, downstream compile plants, four-step guard proof. |

**Adversarial triggers — any one forces the top tier:** guards / tripwires /
CI gates; `unsafe`; public API surface change; parsing or emitting
machine-readable records; path handling; error-or-verdict modelling (the
"error is not a negative finding" class); and **enforcement tooling itself** —
any tool whose verdict other work relies on, where a false-clean propagates
silently.

Three rules make the tier fail-safe rather than a discount:

1. **Hopper applies exactly one tier label on create.** A review-request bead
   carrying no tier label is malformed and linus treats it as
   `adversarial` — absence resolves to the *most* expensive tier, so
   under-declaring by omission buys nothing.
2. **Linus may escalate a tier, never de-escalate.** Escalation is recorded in
   the verdict line with the trigger that caused it. A reviewer who finds a
   behavioural delta inside a `tidy:` diff escalates and says so.
3. **A class sweep is performed once per class per package, not once per
   finding.** The sweeping increment records the class and its full site list
   in the report bead; later increments in the same package cite that record
   instead of re-walking the tree.

Tiering governs the **budget of evidence**, never the **standard of
correctness**. Nothing is waved through at any tier; a `tidy:` diff that turns
out to change behaviour is escalated, not excused.

Enforcement surface (trigger + named artefact). **Trigger:** a review-request
bead created without a `review:tier=` label, or a diff touching an adversarial
trigger reviewed at a lower tier. **Artefact:** linus escalates to
`adversarial`, states the trigger, and records the mis-tiering as a Low finding
against the increment — so the miss is visible in the report rather than
silently cheap.

### Review loop ↔ linus (intra-session, Bucket C)

The review loop uses label-based signaling, not gates, for intra-session
pair programming:

1. Hopper creates a review-request bead (`bd create --type task --labels review-request`)
   with the diff context in the bead's `description` field. Hopper does
   **not** Task-dispatch linus (no `task` tool; doctrine reserves dispatch to moltke).
2. Linus picks up via `bd ready --json --label review-request` (or is dispatched by moltke).
3. Linus reviews, comments APPROVE or NEEDS WORK with actionable findings.
4. On APPROVE: linus performs three bd actions atomically:
   (a) relabels the review-request bead `review-request` → `review:approved`
       (`bd label remove <id> review-request` + `bd label add <id> review:approved`),
   (b) closes the paired review-report evidence bead
       (`bd close <report-bead-id> --reason "review:approved"`) so gardener's normal
       evidence sweep can reclaim the bead,
   (c) closes the review-request bead itself
       (`bd close <id> --reason "review:approved"`) so the bead does not linger
       open in `review:approved` state.
   Keeping (a) before (c) preserves APPROVE/NEEDS-WORK signal on closed beads
   for historical bd queries. Hopper proceeds.
5. On NEEDS WORK: linus relabels `review:needs-work`. The round-N report bead
   stays OPEN — its findings are live, unactioned work. Hopper fixes,
   re-requests. **The cap counts repeat rejections, not rounds.** A round that
   surfaces a *new* defect class is convergent discovery and does not consume
   the cap; two rounds rejecting on the *same* class →
   `SurpriseKind::ReviewRejected` → moltke. Linus states which case applies in
   its verdict line. Measured 2026-09-05: a round-count cap was overridden
   twice in one package, both times because each round found a new class — the
   cap was counting the wrong thing, so it was obeyed by exception rather than
   by design.
6. **Supersede-on-create.** Before creating a round-N report bead with N ≥ 2,
   linus first closes the round-(N-1) report bead:
   `bd close <prev-report-id> --reason "superseded by round-<N> review"`.
   A report bead therefore outlives its round only while its findings are
   still unactioned. On the terminal 2×-NEEDS-WORK → `ReviewRejected` path the
   final report bead is left OPEN **by design** (findings handed to moltke
   unactioned); gardener's evidence sweep (`agents/gardener.md` rules 3–4)
   closes it on package conclusion.

### Pointer discipline with beads

Large evidence stays inside the bead as its `description` field; the bead id
(`bd-NNN`) is the durable cross-session pointer. Handoff lines carry the bead
id, not the body. Commanders use `bd list --label evidence` (metadata-only,
no body inlining) to browse, and `bd show bd-NNN` only when the body is
needed to decide the next step. This preserves pointer-over-body discipline
(§ Evidence carrying) — the cost is paid once at decision time, not on every
handoff.

Handoff artefacts use `artefact: bd-NNN` for cross-agent evidence (Bucket A).
`.ooda/` paths are sanctioned for tracing, user-facing local outputs, and the
narrow Tier-2 escape hatch. Cross-agent material staged through Tier 2 still
hands off the bead id; never pass the file path as the cross-agent pointer.

### Audit trail

`bd audit record` captures agent actions to `.beads/interactions.jsonl` (append-only,
gitignored — durable persistence comes from bd's Dolt remotes, not git). Use CLI flags (`--kind`, `--actor`, `--issue-id`, `--tool-name`,
`--exit-code`); avoid `--stdin` until `audit.Entry` schema is fully documented.

Hopper records TDD boundary events; linus records review verdicts via
`bd audit record --kind label`.

### User-facing artefacts vs cross-agent evidence

Generated artefacts that are user-facing local outputs (turbo prompt rewrites,
generic `code-review` skill reports, PRD/source artefacts) may live under
`.ooda/` and need no bead. The moment such an artefact becomes cross-agent
handoff evidence, register an evidence bead (Bucket A) and pass the bead id;
never pass disk paths across agents.

## MCP servers

opencode loads MCP servers from the `mcp` block in `opencode.json`. Two
ways to wire one:

1. **Native** — `command` + `args` for a server with its own SDK / binary.
2. **HTTP via `mcp-remote` proxy** — works with any HTTP MCP endpoint
   without a native SDK. Pattern (from coleam00/ai-transformation-workshop):

   ```json
   "mcp": {
     "atlassian": {
       "command": "npx",
       "args": ["mcp-remote@latest", "https://mcp.atlassian.com/v1/mcp"]
     }
   }
   ```

`mcp-remote` is a universal HTTP→stdio bridge — useful when the only
documented integration is a hosted server URL. No server is wired in
this config by default; add one only when a concrete need arises and
audit the tool surface it exposes.

## Quality

If a subagent reply is vague or missing the deliverables defined in its own
prompt, send it back with specific feedback rather than proceeding.

## Conditional capabilities (grill-me skill, adr-fmt CLI)

Some agents depend on capabilities that may or may not be available in a given
environment. Probe before using; fall back gracefully when absent.

- **`grill-me`** — opencode skill (loaded via the `skill` tool), used by plan
  mode **only when the user explicitly invokes it** ("grill me", "interview
  me", "stress-test the plan", etc.). It is opt-in, not the default
  intent-confirmation path. When triggered and listed in
  `<available_skills>`, load via `skill({ name: "grill-me" })`. When
  triggered but absent, fall back to inline clarification per the autonomy
  rule. Default plan-mode behaviour does **not** auto-load grill-me; it
  proceeds with named assumptions per § Autonomy.
- **`adr-fmt`** — CLI tool used by oracle to enumerate and read ADRs. Probe
  with `command -v adr-fmt`. When absent, oracle falls back to direct ADR
  markdown reads from standard locations (docs/adr/, doc/adr/, adr/,
  architecture/adr/).

Agents must state which mode they ran in (capability-available vs. fallback)
so the caller knows whether output reflects authoritative tooling or a
best-effort scan.

### Sourcing an in-house CLI tool (unpublished)

In-house Rust CLI tools are installed **from their canonical git repo**, not
from a path, a vendored copy, or crates.io. This is the standing pattern for
`adr-fmt` and for `comment-free` (canonical at
https://github.com/acje/comment-free), and for any further tool on the same
footing:

```
cargo +<pinned-toolchain> install --git https://github.com/<org>/<tool> --locked <tool>
```

Three rules make it work:

1. **`cargo install --git` ignores the source repo's `rust-toolchain.toml`.**
   It builds with the *invoking* toolchain. Pass `+<version>` explicitly
   matching the tool's pin, or the install fails with "requires rustc X or
   newer". Measured 2026-09-04: `adr-fmt` pins 1.98.0, local `stable` was
   1.97.1, the unqualified install errored.
2. **`--locked` is mandatory.** It uses the tool repo's committed
   `Cargo.lock`, so the build is the one the tool's own CI exercised.
3. **A path-installed binary is unverifiable.** `cargo install` records
   provenance and prints it on replace; a `--path` install records a
   *local directory*, which can be renamed or deleted while the binary keeps
   working and keeps answering the same `--version`. Incident 2026-09-04:
   `~/.cargo/bin/adr-fmt` was a ghost build from
   `~/Documents/github/acje/adr-fmt/crates/adr-fmt`, a directory that no
   longer exists; oracle had been running it for an unknown period. Nothing
   surfaced this until a `--git` install replaced it and printed the old
   source path.

**Version is not an identity.** Two divergent builds of the same tool at the
same `version =` are indistinguishable at the CLI. When more than one copy of
a tool exists, treat `--version` output as non-evidence and establish
provenance from the install record (`cargo install --list`) instead.

Enforcement surface (prose; trigger + named artefact). **Trigger:** a diff
adding or retaining `cargo install --path` for an in-house tool in CI or
setup docs. **Artefact:** review reject (linus; `code-review` skill) — a path
install pins CI to a copy that is not the canonical repo, which is how forks
go unnoticed. Vendoring a tool as a workspace member is a separate decision
requiring a recorded rationale, not a default.

## graphify

Structural knowledge graph at `graphify-out/graph.json`.

When the user types `/graphify`, invoke the `skill` tool with
`skill: "graphify"` first.

Use graphify for structural questions:
- `graphify query "<q>"` — symbols + neighbours matching the question.
- `graphify explain "<symbol>"` — one node and its edges.
- `graphify affected "<symbol>" --depth 3` — blast-radius before refactor.
- `graphify path "<A>" "<B>"` — shortest path; intra-module only.

Use `rg`/`grep` for textual searches, the `oracle` agent for ADR
questions, and read files directly for definitions at specific locations.
After code changes, `graphify update .` (or commit so the post-commit hook
fires).
