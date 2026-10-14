# PROVENANCE — spec-driven-development

Fleet-adapted opencode skill derived from MIT-licensed upstream material.

## Upstream

- Repository: https://github.com/addyosmani/agent-skills
- Pinned revision (commit, immutable): `aeac41d4d005999432bb7312f7ff06383a91d59d`
- Source path: `skills/spec-driven-development/SKILL.md` at that commit
- Upstream license: MIT — Copyright (c) 2025 Addy Osmani; full text in `./LICENSE` (verbatim upstream bytes)
- Vet evidence: bd `sf-sdlc-go7y` (§11 raw pins, API-anchored), `sf-sdlc-xfdm` (external survey), `sf-sdlc-l12y` (raw-hash re-verification trail, mission sf-sdlc-4b56-exec)

## Source file authenticity

Referenced upstream file at the pinned commit (verified 2026-10-14 against `sf-sdlc-go7y` §11):

| Source path | Raw sha256 | Bytes | Git blob id |
|---|---|---|---|
| skills/spec-driven-development/SKILL.md | `c4b97ce3d7f24be0e67fd612c7595f65504872e3a9f8d338d098b2363fdb66ef` | 13096 | `f54426bec00bcda5f700ab3368eed7203306830f` |
| LICENSE | `6f202f8bd568cd730dbb2b0d1f8e243bc74c2fa1f64dbce9b2c7ea08bd5c9fd7` | 1068 | `d67778ada6b9cda6227e9130da182c13e73c8b2e` |

## Adaptation ledger (vs upstream at the pinned commit)

- Frontmatter description rewritten as a tight fleet discovery cue; `name` unchanged (folder/name match).
- Capped to DEFINE-phase gated-spec practice. The upstream phase pipeline (SPECIFY → PLAN → TASKS → IMPLEMENT) is retained as the method, but PLAN/TASKS/IMPLEMENT are repointed at fleet owners (plan-mode, moltke, hopper with Kent Beck TDD + tier-scoped verification).
- Removed upstream cross-skill dependencies: `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `context-engineering`, `api-and-interface-design` → dropped or mapped to fleet equivalents (hopper TDD, bd beads for durable task state).
- Removed slash-command and `tasks/plan.md` / `tasks/todo.md` task-store conventions → fleet keeps durable state in bd beads, not a markdown task store.
- Made npm-shaped command examples repo-native (commands come from the repo AGENTS.md tiers).
- Core method preserved: gated human-approval phases, Phase 0 capability map, six-area spec, assumptions surfaced, stop-after-spec, living spec, rationalizations/red flags/verification checklists.
- **Revision 2 (2026-10-14, review round sf-sdlc-t1rf):** DEFINE-gate-only workflow diagram (Human-review rows on PLAN/TASKS/IMPLEMENT removed); Phase 0 map gate now the owning role's, with ordering kept off the user; Phase 1 clarification risk-gated (no decomposition/ordering delegation to the user); the DEFINE approval checkpoint is caller-granted in the fleet; added an explicit read-only mode (spec inline or in a bd bead, no working-tree writes) and mode-aware spec storage/verification wording; red-flag/checklist references updated to match.

## Exclusions

None. Source complete (single file + upstream LICENSE); no upstream hooks/scripts are bundled or executed.

## Verification

`git diff --check` clean; frontmatter `name` == folder name; `LICENSE` bytes == upstream LICENSE blob (see table). No upstream script/hook executed. See mission evidence bead `sf-sdlc-l12y`.
