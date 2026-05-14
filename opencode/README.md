# OODA Loop Agents for opencode

**Eight subagents**: four OODA-phase agents (`copernicus`, `feynman`,
`moltke`, `hopper`) plus four specialists (`gardener`, `automaton`,
`oracle`, `linus`). Each is named after a historical figure whose documented
method maps to its phase or specialty.

| Role        | Agent        | Why this person                                                                            |
|-------------|--------------|--------------------------------------------------------------------------------------------|
| Observe     | `copernicus` | Patient naked-eye observation, decades of data before theory                               |
| Orient      | `feynman`    | The Feynman Technique: explain simply, find gaps, stress-test against examples             |
| Decide      | `moltke`     | Auftragstaktik / mission command — operations expert; sets intent, tasks subordinates      |
| Act         | `hopper`     | Speed and decisiveness in execution                                                        |
| Specialist  | `gardener`   | Workspace cleanup after loop completes: delete completed `.ooda/` artefacts, surfaces unfinished tasks           |
| Specialist  | `automaton`  | Writes idiomatic Rust CLI tools to `scripts/` when control flow exceeds in-context budgets |
| Specialist  | `oracle`     | Surfaces architectural constraints from the repo's ADRs                                    |
| Specialist  | `linus`      | Rust-specialist code reviewer — idioms, unsafe soundness, cargo-audit/deny. Read-only.     |

## The loop (with the two named cycles inside it)

```text
                              USER
                            ┌───┴───┐
                  plan mode │       │ build mode
                 (strategic)│       │(direct execution;
                                    │ contract to Hopper)
                                    │ 
                                    │
   ┌──── STRATEGY LOOP ────┐        │      ┌── EXECUTION LOOP ──┐
   │                       │        │      │                    │
   │                       │        │      │                    │
   │   Copernicus          │        │      │       Hopper       │
   │      ▲ │              │        │      │        ▲ │         │
   │      │ │ observations │        │      │contract│ │complete │
   │ tasking│              │        │      │        │ │/surprise│
   │      │ ▼              │        ▼      │        │ ▼         │
   │    Feynman ───────────┼─► Moltke ◄────┼────────┘           │
   │            hypotheses │        ▲      │                    │
   │           + falsifiers│        │      │                    │
   │                       │        │      │                    │
   └───────────────────────┘        │      └────────────────────┘
                                    │
                       back-briefs from any
                       subordinate route to Moltke
                                    │
                                    ▼
                       ┌── SPECIALISTS (on demand) ──┐
                       │   Oracle      (ADR guidance)│
                       │   Automaton   (Rust CLI)    │
                       │   Gardener    (.ooda/ GC)   │
                       └─────────────────────────────┘
```

Both named loops pivot on moltke:

- **Strategy loop** — `moltke → feynman → copernicus` outbound; observations and hypotheses + falsifiers return inbound. Closes when orientation supports a real decision (≥ 2 viable options + working falsifiers).
- **Execution loop** — `moltke → hopper` outbound (mission contract); complete or surprise returns inbound. Closes when `package_success_criteria` are met (→ gardener → user) or the package is abandoned.
- **Review loop ↔ linus** — nested inside the execution loop. On each non-trivial Rust TDD increment, hopper creates a review-request bead, linus reviews and comments APPROVE or NEEDS WORK. Max 2 rounds before escalation to moltke.

Specialists (oracle, automaton, gardener) are dispatched by moltke from inside whichever loop needs them. Back-briefs from any subordinate route upward to moltke regardless of who tasked them.

Boyd's insight: whoever cycles the loop fastest *and most accurately* dominates.
Orientation shapes everything downstream — get it right or pay later.

## Mission command (Auftragstaktik)

**Moltke is the supreme commander** during a mission. The orchestrator
(plan mode) hands off to moltke once for non-trivial work; moltke drives the
mission to completion. Moltke is the only role with authority to task any
agent directly during a mission, and the only role to which all subordinates
**back-brief** strategic shifts.

**Three named loops** sit inside moltke's standing-commander role:

- **Strategy loop — moltke ↔ feynman.** Closes when orientation supports a
  real decision (ranked hypotheses, working falsifiers, ≥ 2 viable options).
  Moltke bounces back to feynman on single-hypothesis or evidence gaps;
  feynman may re-task copernicus.
- **Execution loop — moltke ↔ hopper.** Closes when `package_success_criteria`
  are met (→ gardener → user) or the package is abandoned (→ user with a
  written reason). Hopper reports on every sub-mission complete or on
  surprise; moltke adjusts intent, re-decomposes, or escalates back to the
  strategy loop.
- **Review loop — hopper ↔ linus.** Nested inside the execution loop. Hopper
  creates review-request beads; linus reviews and comments APPROVE or NEEDS
  WORK. See AGENTS.md § Beads for the full protocol.

**Specialists** sit beside the loop and are dispatched on demand:

- `oracle` — consulted by moltke during the Decide phase when a decision
  touches architectural surface (data model, public API, cross-module
  contracts, deployment topology). Surfaces relevant ADRs and any tensions.
- `linus` — Rust-specialist code reviewer. Deeper than the generic
  `code-review` skill: Rust idioms, unsafe soundness, cargo-audit/deny,
  MSRV/edition. Read-only (no source edits; writes only to `.ooda/**`).
  Generic / non-Rust review → `code-review` skill; Rust deep-dive → linus.
- `automaton` — commissioned by any agent (most often hopper or copernicus)
  when a control-flow problem is too large for in-context solving (walking
  many files, deterministic transforms, graph traversals). Writes a small
  Rust CLI tool to `scripts/` and returns a tool description (purpose,
  inputs, output schema, exit-code semantics, performance envelope).

**Back-briefs** route upward from any subordinate to moltke when an observation
exceeds the current mission scope but is strategically relevant — load-bearing
assumption now suspect, new constraint, major architectural opportunity, or
dead-end that invalidates the package premise. Moltke triages each back-brief
into one of `Acknowledge | AdjustIntent | ReDecompose | EscalateToUser`.

## Plan mode vs build mode

Two opencode prompt modes orchestrate the agents differently:

- **Plan mode** owns the full OODA loop. Confirms user intent (via `grill-me`
  when available, falling back to inline clarification), then routes through
  copernicus → feynman → moltke (→ oracle) to produce a mission contract or
  package. Never edits source.
- **Build mode** is direct user-driven execution. Trivial → inline edit.
  Non-trivial single-path → hopper with an inline brief. Strategic /
  multi-path / architectural / irreversible → redirects the user back to
  plan mode rather than spinning up moltke.

Build mode can *receive* a plan-mode-produced contract and hand it to
hopper — that's execution, not planning.

## Internal vs outer OODA

Each agent runs an internal observe→orient→decide→act loop inside its role
to close small problems without escalation. Trivial in-role tasks may be
closed by any agent without handoff. The outer multi-agent loop is reserved
for *strategic* concerns: multi-causal contention, multi-option decisions
under uncertainty, multi-file/irreversible work, cross-role gaps.

- `copernicus` — pure sensor. **No internal OODA, no hypotheses.** If
  evidence is thin, feynman re-tasks it with a sharper target.
- `feynman` — hypothesis-falsifier-stress-test cycle as its internal loop.
  Re-tasks copernicus when a falsifier needs evidence it cannot derive.
  Moltke can bounce orientation back if it is single-hypothesis or weakly
  falsified (strategy loop).
- `moltke` — internal observe→orient→decide loop over options; emits a
  single mission or a mission package. Persists as supreme commander
  through the whole mission.
- `hopper` — tightest internal loop (pre-flight → smallest increment →
  verify → next). Halts only on *surprise*. Always reports back to moltke,
  never directly to user.
- `oracle` — read-only ADR survey + tension report. No internal cycle
  beyond its single workflow.
- `linus` — Rust-specialist review along three axes (idioms, quality,
  security). Runs cargo check/clippy/test/audit/deny, writes report to
  `.ooda/review-linus-<ts>.md`. Read-only; halts on pre-existing build
  break (Surprise).
- `automaton` — write tool, build, smoke-test, hand back tool path + run
  command + tool description.
- `gardener` — scan `.ooda/`, delete files with all tasks closed, retain
  files with open tasks, report to moltke.

## Decomposition by coupling (Moltke)

Moltke decomposes work by **coupling**, not by stakes:

- **Tightly coupled** (shared schema, single behaviour change, atomic
  refactor that cannot leave the tree green mid-way) → one mission.
- **Loosely coupled** (disjoint files, independent verifies, can each
  leave the tree green) → a **mission package**: 2–5 self-contained
  sub-missions, each with its own `success_criteria`, `verify_commands`,
  `abort_if`, `rollback_plan`. Hopper executes them in dependency order
  with **green checkpoints** between them. On sub-mission failure, only
  that sub-mission rolls back; prior greens stay; control returns to
  moltke (`package_rollback_strategy = "rollback_failed_only"`, the
  default).

Auftragstaktik scales recursively: every sub-mission specifies *what* and
*why*, not *how*.

## Communication style

All agent replies use **terse structured text with idiomatic Rust datatypes**.
The aim is signal density, not eloquence.

Prefer:

- Tagged unions (Rust enum variants) over adjectives:
  `Outcome::Verified { exit_code: 0 }` over "the test passed cleanly".
- Struct-shaped sections over paragraphs — fixed labelled fields the
  orchestrator can parse without reading prose.
- `Result<T, E>` framing over "it worked / it didn't".
- Tables for comparable data (options × cost × reversibility).
- Tab-separated tagged records for tool output (`MATCH\t<path>\t<line>`).

Avoid: banners, emoji decoration, adjective-heavy prose, restating the
question.

The handoff line and the back-brief format are themselves examples of the
style: fixed grammar, parseable, no decoration.

```
→ to: <agent|user> | status: <ready|blocked|needs-reloop|complete> | next_input: <one-line> | artefact: <path|->

↑ back-brief to moltke
  scope: <OutsideMission | PackageLevel | SystemLevel>
  observation: <terse, cited>
  implication: <what shifts in planning>
  confidence: <high | medium | low>
```

## Design principles (the 12 baked in)

These are taken from Anthropic's published agent engineering, Simon Willison's
agentic-engineering patterns, and TDD-governance research on multi-agent code
generation.

1. **Goldilocks system prompts** — specific heuristics with flexibility, not brittle if-else, not vague waffle.
2. **Detailed delegation contracts** — each agent declares its required input fields and refuses if they're missing.
3. **Effort budget scales to complexity** — every agent has explicit tiers (trivial / standard / deep) with tool-call ceilings.
4. **Canonical few-shot examples** — every agent ends with at least one trivial and one complex worked example.
5. **Start broad, narrow down** — encoded in copernicus and feynman workflows.
6. **Just-in-time context via filesystem + beads** — large evidence is written to `.ooda/` body files and indexed by a bd bead carrying a 3-line summary; handoffs pass the bead id (`bd-NNN`), not the body. Avoids the "telephone game" through the orchestrator.
7. **Compaction & note-taking** — moltke creates a bd epic per mission; hopper closes child task beads on verify-green; gardener closes the epic and prunes paired `.ooda/` body files when missions complete.
8. **Token-efficient tool design** — automaton writes a Rust CLI rather than simulating a for-loop in tokens.
9. **End-state evaluation** — hopper's "Result vs intent" check is grounded in moltke's `success_criteria`, not adherence to prescribed steps.
10. **Interleaved thinking between tool calls** — feynman's stress-test loop and hopper's verify-after-each-step enforce this.
11. **Explicit effort ceilings** — `max_files_changed`, `max_tool_calls`, `max_wall_clock_minutes` in every moltke contract.
12. **Failure-mode awareness** — known anti-patterns are forbidden by name in each agent's Rules section (single-hypothesis orientation, unverified success claims, single-option "decisions").

## Conditional tools

Some agents depend on capabilities that may or may not be available.
Probe before using; fall back gracefully.

- **`grill-me`** — opencode skill (loaded via the `skill` tool), used by
  plan mode to confirm user intent before handing to moltke. Falls back to
  inline clarification per the autonomy rule when the skill is not listed
  in `<available_skills>`.
- **`adr-fmt`** — CLI tool used by oracle to enumerate and read ADRs. Probe
  with `command -v adr-fmt`. Falls back to direct markdown reads from
  standard locations (`docs/adr/`, `doc/adr/`, `adr/`, `architecture/adr/`).

Agents state which mode they ran in (capability-available vs. fallback) so
the caller knows whether output reflects authoritative tooling or a
best-effort scan.

## The `.ooda/` directory

Agents write artefacts here. Gardener prunes completed missions. Add it to
`.gitignore` unless you want missions journaled in git.

```
.ooda/
├── observations-<slug>-<ts>.md      # Copernicus broad-tier evidence dumps
├── orientation-<slug>-<ts>.md       # Feynman deep-orientation dumps
├── mission-<slug>-<ts>.md           # Moltke contracts (Hopper's input)
├── mission-<slug>-<ts>.journal.md   # Hopper's append-only execution log
└── oracle-summary-<slug>-<ts>.md    # Oracle survey-mode ADR summaries
```

```sh
echo ".ooda/" >> .gitignore
```

`.ooda/` task hygiene: any task list, sub-mission, or checkbox an agent
writes is closed (`- [x]` / `status = "completed"` / `**COMPLETED**`) the
moment it finishes. Gardener deletes files where every task is closed and
retains files with open items, surfacing the open items back to moltke.

## The `scripts/` directory (automaton's workspace)

Automaton bootstraps `scripts/` lazily on first invocation. Single cargo
workspace, one binary per tool:

```
scripts/
├── Cargo.toml              # workspace + shared deps
├── Cargo.lock
└── src/
    └── bin/
        ├── find-orphan-tests.rs
        └── count-todos.rs
```

Run a tool: `cargo run --manifest-path scripts/Cargo.toml --bin <tool> -- <args>`.

Tool style: idiomatic Rust enums for outcomes/errors, `.expect("informative
message")` for error handling (panics carry the diagnostic), `std::env::args()`
for simple CLIs (clap only when justified), tab-separated tagged records to
stdout, deterministic output (sort when iteration order matters).

## Installation

```sh
# user-level (all projects)
cp agents/*.md ~/.config/opencode/agents/
cp prompts/*.md ~/.config/opencode/prompts/
cp AGENTS.md ~/.config/opencode/

# or project-level
mkdir -p .opencode/agents && cp agents/*.md .opencode/agents/

# create the artefact directory
mkdir -p .ooda && echo ".ooda/" >> .gitignore
```

## Usage

### Plan mode (full loop, recommended for non-trivial work)

```
> @plan migrate the event store from JSON to a binary format
```

Plan mode probes `grill-me`, confirms intent, then routes:

1. **copernicus** — gather evidence at the right tier. Returns inline summary + scratch path. If thin, expect a re-task from feynman.
2. **feynman** — produce ranked hypotheses with falsifiers, stress-test the leader, name remaining unknowns. Re-task copernicus rather than guessing.
3. **moltke** — consult oracle if architectural surface is touched; enumerate options; run a pre-mortem; judge coupling; emit either a single TOML mission contract or a `[mission_package]` with `[[missions]]` array.
4. Hand off to build mode (or stay in plan if more orientation is needed).

### Build mode (direct execution)

```
> @build fix the off-by-one in list_orders pagination
```

Build mode picks one of:

```rust
enum BuildAction {
    InlineEdit,                              // single edit, no tradeoffs
    InvokeHopper { brief: InlineBrief },     // single mission, clear plan
    ExecutePlanContract { path: PathBuf },   // contract from plan mode
    RedirectToPlanMode { reason: &'static str }, // multi-path / strategic
    AskUser { question: &'static str },      // medium+ risk only
}
```

For plan-mode-produced contracts:

```
> @build execute mission package bd-42 (artefact: .ooda/mission-package-rename-job-1730500000.md)
```

### Single phase (rare; advanced)

```
> @copernicus tier=moderate observe the websocket reconnect machinery
> @feynman depth=standard orient on observations bead bd-55 (body: .ooda/observations-ws-1730000000.md)
> @moltke decide between revert vs patch — orientation in the previous message
> @hopper execute mission package bd-60 (artefact: .ooda/mission-package-ws-revert-1730000123.md)
> @oracle survey ADR coverage of the event-store storage layer
> @automaton write a tool to find every .rs file whose tests block lacks #[cfg(test)]
> @gardener clean up after package rename-getcwd-1730300000
```

### What good looks like

- Copernicus reports include `Tool calls used: 8/15` and a non-empty `Unobserved (gaps)`. Re-tasks are first-class, not failure.
- Feynman reports always have ≥ 2 hypotheses with falsifiers, a stress-test walk-through, and (when needed) an explicit re-task brief to copernicus.
- Moltke contracts always have a pre-mortem, `rollback_plan`, and a one-sentence **coupling judgement**. Oracle is consulted (or explicitly skipped with reason) when architectural surface is touched.
- Hopper's `Result vs intent` is backed by an exit-0 verify command, not vibes. Every mission has a journal file; sub-missions are checkbox-closed when their `verify_commands` go green.
- Gardener reports clean GC outcomes (`deleted: [...]`, `retained: [...]`) per package; back-briefs accumulating retention as a system-level signal.
- Automaton always returns a tool description (purpose / inputs / output schema / exit codes / determinism / performance) alongside the run command.

## Role discipline (doctrine, not permissions)

All subagents share hopper's permission matrix — this is for **tempo**, not
role-creep. The role separation is doctrinal:

- `copernicus` observes (no hypotheses, no decisions).
- `feynman` orients (no decisions, no execution).
- `moltke` decides and commands.
- `hopper` executes (verify-before-claim).
- `linus` reviews Rust code (read-only; no edits, no decisions).
- `oracle` informs about architecture (no decisions).
- `automaton` builds tools (no business logic).
- `gardener` cleans (never edits, only deletes or skips).

An agent stepping outside its role is a doctrine violation even though the
permission allows it. Trivial in-role tasks may be closed without escalation.

## Custom commands (`opencode/commands/`)

Four slash commands are available in `opencode/commands/`. Invoke them with `/command-name` in opencode:

| Command | File | Purpose |
|---------|------|---------|
| `/prime` | `commands/prime.md` | Session context priming — loads AGENTS.md, git log, project layout, open missions |
| `/create-prd` | `commands/create-prd.md` | 15-section PRD generator; output to `.ooda/PRDs/<slug>.prd.md` |
| `/create-rules` | `commands/create-rules.md` | AGENTS.md generator for new projects (refuses if AGENTS.md exists) |
| `/validate` | `commands/validate.md` | Multi-toolchain build/lint/test (Cargo/npm/pnpm/uv/go); inline tabular output |

## File map

```
.config/opencode/
├── README.md                    (this file)
├── AGENTS.md                    Shared orchestration rules; auto-loaded into every mode
├── opencode.json
├── agents/
│   ├── copernicus.md            Observe — pure sensor, owns external research
│   ├── feynman.md               Orient — ranked hypotheses + falsifiers + stress-test
│   ├── moltke.md                Decide / supreme commander — mission command, two-loop owner
│   ├── hopper.md               Act — verify-before-claim execution
│   ├── gardener.md              Garbage collect — close completed .ooda/ artefacts
│   ├── automaton.md             Specialist — Rust CLI tool-builder for scripts/
│   ├── oracle.md                Specialist — ADR-driven architectural guidance
│   └── linus.md                Specialist — Rust-specific code reviewer
├── commands/                    Custom slash commands (invoke with /command-name)
│   ├── prime.md                 /prime — session context priming via copernicus
│   ├── create-prd.md            /create-prd — 15-section PRD generator → .ooda/PRDs/
│   ├── create-rules.md          /create-rules — AGENTS.md generator for new projects
│   └── validate.md              /validate — multi-toolchain build/lint/test runner
└── prompts/
    ├── plan.md                  Plan mode — full OODA loop + grill-me intent confirmation
    └── build.md                 Build mode — direct user-driven execution
```

## References

- Anthropic — *How we built our multi-agent research system*: <https://www.anthropic.com/engineering/built-multi-agent-research-system>
- Anthropic — *Effective context engineering for AI agents*: <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Simon Willison — *Subagents (Agentic Engineering Patterns)*: <https://simonwillison.net/guides/agentic-engineering-patterns/subagents/>
- Boyd's OODA loop: <https://en.wikipedia.org/wiki/OODA_loop>
- Moltke & Auftragstaktik: <https://en.wikipedia.org/wiki/Helmuth_von_Moltke_the_Elder>
- Stephen Bungay — *The Art of Action* (directed opportunism, mission command in practice).
- Feynman Technique: <https://fs.blog/feynman-technique/>
- Klein pre-mortem: <https://hbr.org/2007/09/performing-a-project-premortem>
- ADR (Architecture Decision Records): <https://adr.github.io/>
