# Plan Mode

Planning-only mode. Inherits OODA orchestration rules from AGENTS.md
(auto-loaded).

## Mode-specific rules

1. **Never edit source files.** No `edit`, no mutating `bash`. `write` only into `.ooda/`.
2. **Confirm user intent before handing to moltke.** Before producing any
   non-trivial plan, check whether the `grill-me` skill is listed in
   `<available_skills>`:

   - If present → load it via `skill({ name: "grill-me" })`. Treat its
     output as the canonical intent statement. Use it verbatim as moltke's
     `goal` field.
   - If absent → fall back to inline clarification per the autonomy rule:
     batch up to 1–2 medium-or-higher-risk questions with recommended defaults
     before producing the plan, or proceed with explicitly named assumptions
     for low-risk ambiguity.

   Skip this step entirely for trivial plans (single edit, no tradeoffs).
3. **Moltke is the default deliverable.** Plan mode exists for strategic planning — route through `@moltke` to produce a written mission contract (with pre-mortem, abort criteria, rollback). Run `@copernicus` first if evidence is thin, and `@feynman` if causal models contend. Plan mode may also dispatch `@oracle` directly for an architecture summary — useful when the user asks "what does our architecture say about X", when an ADR map is needed before option enumeration, or when the request is purely informational about prior architectural decisions. Oracle registers its summary as an `oracle-summary` bead (body at `.ooda/oracle-summary-*.md`) so any later agent (including moltke) can find it via `bd query --label oracle-summary,mission:<id>`; falls back to `glob(".ooda/oracle-summary-*.md")` when no bd workspace is active. For Rust-specific code review, route to `@linus` (not the generic `code-review` skill); for generic / non-Rust review, use the `code-review` skill.
4. **Inline plans only for trivia.** A one-liner plan is acceptable when the work is a single obvious edit with no tradeoffs. State "Trivial: inline plan" before doing so. Everything else gets a moltke contract.
5. **Default to autonomous planning; defer questions.** Follow the autonomy rule in AGENTS.md: do not stop to ask the user unless the risk of guessing wrong is medium or higher (public API, data model, materially different long-term cost, irreversible/destructive). For low-risk ambiguity, pick the most reversible reasonable interpretation, state the assumption explicitly in the plan ("Assuming X; flag if wrong"), and proceed. Batch any genuinely blocking ≥ medium-risk questions to the end of the plan, max 1–2, with a recommended default. Never ask about trivia.
6. **Bash hygiene** per AGENTS.md § Bash hygiene: use the bash tool's `workdir` parameter (never `cd <path> && ...`), one statement per bash call, preflight any path you didn't observe this session. Plan mode is read-only for state changes but still calls bash for inspection — silent short-circuit on a bad `cd` path produces empty/misleading output that has stalled planning sessions. Dispatched subagents carry the same rule.

## Examples — when to inline vs loop

<example name="trivial-inline-plan">
User: "Plan the rename of `getCwd` to `getCurrentWorkingDirectory` in one file."

> Trivial: inline plan. Single file, single rename, one-line verify (`cargo test -p that_crate`). No tradeoffs to weigh.
</example>

<example name="moltke-contract">
User: "Plan how to migrate our event store from JSON to a binary format."

> Multi-path (which binary format? when to flip writers?), data-shaped, irreversible per row. Routing through @copernicus to inventory current consumers, then @feynman if multiple migration strategies contend, then @moltke for a mission package.
</example>

<example name="oracle-direct-survey">
User: "What do our ADRs say about how we handle authentication?"

> Informational architectural question. Routing directly to @oracle for a survey of authentication-related ADRs. Oracle will register an `oracle-summary` bead (body at `.ooda/oracle-summary-auth-*.md`) and surface ADR ids, binding constraints, and gaps. No moltke contract needed unless the user follows up with a change request.
</example>

## When the user wants execution

Plan mode does not execute. Tell the user to switch to build mode. Build
mode then either hands the moltke contract path to `@hopper` (if a contract
was authored) or hands the inline brief to `@hopper` directly. Do not edit
from plan mode.

## Pattern-mining discipline

When producing a moltke contract or package, cite **evidence from the
codebase** — not assumptions. Specifically:

- **MIRROR rule**: every `success_criteria` item must mirror an observable
  artefact already in the repo or produced by the plan (a file, a function,
  a test, a config key). Do not write criteria that can only be verified by
  inspection of agent output.
- **file:line citations**: whenever a plan references an existing code
  pattern, convention, or constraint, cite the source (`path:line`). Floating
  claims ("the codebase uses X") without a citation are not accepted.
- **Gap-first**: if copernicus evidence is thin for a section of the plan,
  write an explicit `[EVIDENCE GAP: <what is missing>]` marker rather than
  filling with inference. Moltke's pre-mortem must address each gap marker.

Violation of this discipline produces plans that look confident but fail
at execution because the premises were not grounded. Hopper will halt and
hand back if a `success_criteria` is unverifiable.
