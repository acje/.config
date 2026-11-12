# OODA Loop Agents for OpenCode

Eight subagents orchestrated across two OODA loops (`Strategic` and `Tactical`), plus two primary prompt modes (`build` and `plan`). Agents focus on role, coordination, delegation boundaries, and skill loading; coding/toolchain mechanics live in skills.

## Agent Roster

| Role | Agent | Responsibility |
|---|---|---|
| Observe | `copernicus` | Pure sensor. Gathers cited facts (`path:line`, command exits, web/spec docs); registers large evidence in `bd` beads. No hypotheses, no edits. |
| Orient | `feynman` | Synthesizes observations into ≥ 2 ranked causal hypotheses with cheap falsifiers and a stress-test. Re-tasks `copernicus` on blocked falsifiers; consults `oracle` on architectural surfaces. |
| Specialist | `oracle` | Surfaces binding ADR constraints, tensions, and gaps via `adr-fmt` or markdown fallback. Informs, never decides. |
| Decide | `moltke` | Standing mission commander (Auftragstaktik). Sets `commander_intent`, authors TOML mission contracts/packages with pre-mortem and abort criteria, commands `hopper`/`linus`/`hamilton`, verifies results, and invokes `gardener`. |
| Act | `hopper` | Executes mission contracts via TDD (`red → green → refactor`), Tidy First commit separation, and tier-scoped verification (`inner`/`mid`/`boundary`). Returns `review-ready` beads and outcomes to `moltke`; may delegate scoped worker sub-tasks to the general-purpose `general` subagent (non-fleet, no authority). |
| Review | `linus` | Pre-merge Rust-specialist code reviewer (source-level). Reviews idioms, type safety, `unsafe` soundness, resource contracts, and test design. Read-only on source; writes verdicts to `bd` beads. |
| Assurance | `hamilton` | Runs during CI/deploy wait windows on `main` (or external PRs). Reviews cross-component failure, ADR alignment, resource stress, recovery/shutdown, and broad regressions. Read-only; files `assurance-finding` beads for `moltke`. |
| Closeout | `gardener` | Closes completed `bd` mission epics and spent scaffolding, holds live findings, and runs guarded Cargo artifact cleanup. |

## The Two OODA Loops

```mermaid
flowchart LR
    U([User]) --> B[Build mode]
    B -->|Uncertain / coupled / multi-step| M{{Moltke · Decide & Command}}

    subgraph Strategic[Strategic OODA]
        direction TB
        C[Copernicus · Observe] -->|Evidence| F[Feynman · Orient]
        F -->|Blocked falsifier| C
        O[Oracle · ADR constraints]
    end

    subgraph Tactical[Tactical OODA]
        direction TB
        H[Hopper · Execute & verify] -->|review-ready bead| M
        M -->|Dispatch review| L[Linus / code-review]
        L -->|Verdict| M
        M -->|Relay verdict| H
    end

    M <-->|Task / Report| C & F & O
    M -->|Contract| H
    H -->|Verified outcome| M
    M -->|CI / deploy wait| A[Hamilton · Assurance]
    A -->|Findings| M
    M -->|Complete| G[Gardener · GC]
    G -->|GC summary| M
    M -->|Final report| U
```

## Modes: `plan` vs `build`

- **Plan mode (`prompts/plan.md`)**: Read-only on the working tree. Dispatches `copernicus`, `feynman`, and `oracle` directly (permitted strategic access) to produce a structured written plan (goal, evidence, options, stakes, success criteria, risks, open questions). Never dispatches execution-role agents (`moltke`, `hopper`, `linus`); informational Rust review is requested through build mode / `moltke`, which dispatches `linus`/`code-review`.
- **Build mode (`prompts/build.md`)**: Completes bounded, low-risk, reversible work (and inspected, authorized Git operations) directly using skills. Delegates uncertain, coupled, or multi-step work — and plan-mode artefacts — to `moltke`, which drives execution end-to-end.

## Coordination Primitives

- **Beads (`bd`)**: Primary cross-agent memory layer. Contracts, evidence, review reports, and oracle summaries live in `bd` bead `description` fields; handoffs pass `artefact: bd-NNN`, never raw dumps or working-tree paths.
- **Frozen Handoff Line**: Every subagent reply ends with:
  ```text
  → to: <agent|user> | status: <ready|blocked|needs-reloop|complete> | next_input: <one-line> | artefact: <bd-NNN|->
  ```
- **Back-Briefs**: Subordinates append a structured `↑ back-brief to moltke` block (`Surprise | Opportunity`) after the handoff line when an observation materially alters `commander_intent` or mission bounds.
- **Skills (`skills/*/SKILL.md`)**: Own domain, toolchain, and workflow mechanics (`fleet-execution-methods`, `git-workflow-and-versioning`, `rust-design-evidence`, `code-review`, `diagnosing-bugs`, `adr-fmt`, `comment-free`, `graphify`, `beads`, `wayfinder`, `spec-driven-development`, `repo-closeout`, `repo-eval`, `quality-sweep`, `sf-sdlc-check`, `rust-dep-intake`, `create-verification-skill`, `grill-me`, `show-me`, `obsidian-second-brain`, `agent-browser`).

## Runtime Notes (OpenCode)

Relocated out of `AGENTS.md`: product behaviour, not fleet doctrine. Check here before treating a config edit as a doctrine question.

- **Config reload**: Config files reload automatically; a request already in progress keeps the settings it started with ([models#caveats](https://opencode.ai/v2/docs/models#caveats)). A session stores its selected agent/model separately and they take precedence over config defaults; selecting a primary agent by ID does not change the session model ([agents](https://opencode.ai/v2/docs/agents)).
- **Force reload**: `/reload` client command (per the OpenCode skill; V2 docs gap) or `opencode api post /api/location/reload` (verified in current OpenAPI: shuts down and rebuilds every loaded location next step boundary, cancelling pending permissions/forms). Do not run these for routine config edits. Restart the service (`opencode service restart`) only when the service is stuck/unhealthy or to activate an installed update, never for config changes ([troubleshooting](https://opencode.ai/v2/docs/troubleshooting)).
- **Tracing**: no per-session trace files are written; the v1 `tracer.mjs` plugin was removed 2026-10-24. Session history lives in the global `~/.local/share/opencode/opencode.db`.

## Layout

```text
~/.config/opencode/
├── opencode.json        # Model bindings, permissions, MCP servers, plugins
├── cli.json             # CLI/theme/session preferences (v2)
├── AGENTS.md            # Shared fleet doctrine (auto-loaded)
├── README.md            # Overview (this file)
├── DB-MAINTENANCE.md    # Offline SQLite maintenance runbook
├── prompts/             # Mode prompts (build.md, plan.md)
├── agents/              # Subagent definitions (8 agents)
├── skills/              # Reusable toolchain & workflow skills
├── commands/            # Custom slash commands (/prime, /validate, /create-prd, /create-rules)
└── maintenance/         # Offline opencode.db VACUUM script & launchd plist
```
