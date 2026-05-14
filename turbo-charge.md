# Turbo-charge: agent prompt evolution recipe

A reusable mission for improving any agent prompt under `opencode/agents/*.md`
by iterating over **read → critique → propose-minimal-fix → apply**. Distilled
from the moltke.md / moltke-draft.md / moltke-draft-v2.md pass executed
2026-05-04.

The recipe is shaped as a moltke mission package so it can be re-run on any
agent. Substitute `<agent>` for the target name (`hopper`, `feynman`,
`copernicus`, etc.) and `<draft-paths>` for the candidate variants.

---

## Mission package (TOML)

````toml
[mission_package]
package_id              = "turbo-charge-<agent>-<unix_ts>"
commander_intent        = "Surface the highest-leverage weakness in each candidate prompt for <agent> and apply the smallest concrete edit that fixes it, without rewriting frozen elements (worked examples, TOML grammars, handoff line, enum shapes)."
package_success_criteria = [
  "Each candidate file has exactly one targeted edit applied.",
  "Each edit references a single named weakness from the analysis.",
  "Frozen elements unchanged: YAML frontmatter, worked examples, contract grammars, handoff line, BackBriefResponse-style enums.",
  "Final line-count delta reported per file.",
]
package_abort_if = [
  "Any candidate's worked example or TOML grammar is modified.",
  "Edit footprint exceeds ~30 lines net change in any single file (signals scope creep — re-decompose).",
  "An edit cannot be expressed as a single Edit tool call (multi-region rewrite — re-decompose into sub-missions).",
]
package_rollback_strategy = "rollback_failed_only"
journal_path             = ".ooda/mission-turbo-charge-<agent>-<unix_ts>.journal.md"

[[missions]]
mission_id     = "turbo-charge-01-analyse"
objective      = "Read all candidate files and produce top-5 weaknesses per file."
intent         = "Generate a comparable critique surface so the highest-leverage weakness per file is visible."
depends_on     = []
success_criteria = [
  "Each file has exactly 5 weaknesses listed.",
  "Each weakness cites concrete line numbers.",
  "Cross-cutting weaknesses (frontmatter, worked examples) are called out separately so they don't dominate per-file lists.",
]
preflight_checks = [
  "All candidate paths exist (ls).",
  "Files differ in body, not just frontmatter (wc -l + diff sample).",
]
verify_commands  = []  # judgement task; no machine verify
out_of_scope     = ["proposing fixes", "applying edits"]
abort_if         = ["a candidate file is < 50 lines (not a real prompt)"]
rollback_plan    = "none — read-only phase"

[[missions]]
mission_id     = "turbo-charge-02-select-and-design"
objective      = "Pick the single most significant weakness per file and design the smallest fix."
intent         = "Force a per-file ranking; resist the urge to address every weakness. Smallest-fix discipline keeps the change reviewable and the doctrine drift-resistant."
depends_on     = ["turbo-charge-01-analyse"]
success_criteria = [
  "Each file has one chosen weakness with a written justification (why this one over the other four).",
  "Each fix is expressible as a unified diff or a single-region replace.",
  "Each fix preserves frozen elements (no edits to worked examples, TOML grammars, handoff line, enum shapes).",
]
preflight_checks = ["analysis from mission 01 in working context"]
verify_commands  = []
out_of_scope     = ["applying edits", "evolving more than one weakness per file"]
abort_if         = [
  "the chosen weakness requires touching a frozen element (re-pick)",
  "the fix design exceeds ~30 net lines (split into sub-mission or scope down)",
]
rollback_plan    = "none — design phase"

[[missions]]
mission_id     = "turbo-charge-03-apply"
objective      = "Apply each per-file fix."
intent         = "Land each independent edit in parallel so the diff per file maps 1:1 to the chosen weakness."
depends_on     = ["turbo-charge-02-select-and-design"]
success_criteria = [
  "All planned edits applied successfully.",
  "Line-count delta per file matches the design within ±5 lines.",
  "Frozen elements byte-identical pre/post (spot-check by line range).",
]
preflight_checks = [
  "designs from mission 02 in working context",
  "no uncommitted changes in target files (git status)",
]
verify_commands = [
  "wc -l <file>...",
  "git diff --stat opencode/agents/",
]
out_of_scope     = ["committing", "running broader CI"]
abort_if         = [
  "an Edit call returns 'oldString not found' more than once for the same target (signals stale read; re-read and retry)",
  "git diff shows changes to lines inside frozen ranges",
]
rollback_plan    = "git checkout -- <each touched file>"

[missions.effort_budget]
max_files_changed      = 3
max_tool_calls         = 10
max_wall_clock_minutes = 10
````

---

## Worked recipe — actual command sequence (2026-05-04 pass)

This is the concrete, replayable trace of what each agent did. Use it as the
template for the next iteration.

### Phase 1 — Analyse (orchestrator + plan mode)

| Step | Tool / Agent | Command / Action | Why |
|---|---|---|---|
| 1.1 | `read` × 3 (parallel) | Read all three candidate files in one message | Single round-trip; avoid sequential reads |
| 1.2 | orchestrator (in-context) | Produce top-5 weaknesses per file with line citations | Comparable critique surface |
| 1.3 | orchestrator | Add cross-cutting note (frontmatter, worked examples identical) | Prevent shared mass from dominating per-file analysis |

**Output shape:** three lists of 5 weaknesses + one cross-cutting bullet block.
Each weakness includes a line range citation so the fix can target it exactly.

### Phase 2 — Select & design (plan mode, still read-only)

| Step | Tool / Agent | Command / Action | Why |
|---|---|---|---|
| 2.1 | orchestrator | For each file, pick W{n} that is *signature* to that file's design intent (not just the largest) | Operational impact > aesthetic count |
| 2.2 | orchestrator | Write each fix as a diff block in the reply | Forces concreteness; reviewer sees exactly what will change |
| 2.3 | orchestrator | State net line cost per fix | Budget check; flags scope creep before edit |
| 2.4 | user | Approve / pick file(s) to evolve | Human gate before mutation |

**Selection heuristic.** For each file ask "what is the *defining* edit of this
draft vs. its sibling?" The defining edit is usually where the highest-leverage
weakness lives, because it's where the draft over-committed.

### Phase 3 — Apply (build mode)

| Step | Tool / Agent | Command / Action | Why |
|---|---|---|---|
| 3.1 | mode switch | Plan → Build (system reminder) | Read-only → write |
| 3.2 | `bash` | `ls` target dir or `wc -l` files | Verified-source check before edit (AGENTS.md § Path discipline) |
| 3.3 | `edit` × N (parallel) | One Edit call per planned fix; multiple files in one message | Independent edits → parallel; opencode runs them concurrently |
| 3.4 | `bash` | `wc -l` on all touched files | Confirm line-count delta matches design |
| 3.5 | orchestrator | Report delta table to user with handoff line | Loop closure |

**Anti-patterns observed and avoided.**

- *Don't* fold multi-region edits into one Edit call with creative `replaceAll`.
  Multi-region → multiple Edit calls, one per region.
- *Don't* read the files again between Edit calls if they were read at the top
  of the message. Edit accepts the same `oldString` from the original read.
- *Don't* cite `Liu 2023` / `Sclar 2023` inside the prompt as justification for
  prompt structure. The model does not verify; the rule fires identically
  without the citation.

---

## Generalisation: per-agent dispatch

This recipe applies to any prompt under `opencode/agents/*.md`. The pattern:

```rust
enum AgentEvolutionTarget {
    SingleFile(PathBuf),                    // moltke.md
    DraftSet { live: PathBuf, drafts: Vec<PathBuf> }, // moltke.md + moltke-draft*.md
}

fn turbo_charge(target: AgentEvolutionTarget) -> MissionPackage {
    // 1. analyse: top-5 weaknesses per file
    // 2. select+design: 1 weakness × 1 fix per file
    // 3. apply: parallel Edit calls; verify line counts
}
```

For a single-file evolution, drop the per-file ranking step and produce one
weakness/one fix. The mission package collapses to a single mission.

---

## Frozen-elements list (per agent)

Edits must not touch these without explicit trace evidence (Sclar 2023 lesson:
prompt-format thrash hurts more than it helps once an agent works):

| Element | Where | Why frozen |
|---|---|---|
| YAML frontmatter | top of file | permission matrix is load-bearing for safety; reformatting risks regressions |
| Worked examples | `<example name="…">` blocks | byte-identical across drafts; changing them shifts the model's output template |
| TOML mission contract grammar | `## Mission contract` section | hopper parses this; field-name drift breaks the execution loop |
| Handoff line grammar | `→ to: … \| status: …` | orchestrator parses verbatim |
| `BackBriefResponse` enum | back-brief section | hopper / feynman / copernicus reference variants by name |
| `<thinking>` pre-mortem scaffold | workflow section | structural; affects whether Klein-style failure imagination fires |

Editing any of these requires a separate mission with cited trace evidence
showing the current shape causes a real failure.

---

## Re-running the recipe

```
Task(
  subagent_type = "moltke",
  description   = "Turbo-charge <agent> prompts",
  prompt        = "Execute mission package per .ooda/brief-turbo-charge-<agent>.md.
                   Intent: surface highest-leverage weakness per candidate file
                   and apply smallest fix per turbo-charge.md recipe."
)
```

The brief at `.ooda/brief-turbo-charge-<agent>.md` should carry:

- list of candidate files
- any prior trace evidence motivating the iteration
- frozen-elements list (copy from above unless agent-specific overrides apply)

---

## Closing note

The key insight from this pass: **drafts that visibly over-commit (triple-
restate rules; rewrite prose as Rust pseudo-code) make the highest-leverage
weakness obvious**. The fix is to walk back the over-commitment to the point
where it still pulls weight. That's why the recipe forces "one weakness, one
fix, smallest expression" — it's the same discipline applied at the meta-
level.
