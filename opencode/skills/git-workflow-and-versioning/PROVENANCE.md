# PROVENANCE — git-workflow-and-versioning

Fleet-adapted opencode skill derived from MIT-licensed upstream material.

## Upstream

- Repository: https://github.com/addyosmani/agent-skills
- Pinned revision (commit, immutable): `aeac41d4d005999432bb7312f7ff06383a91d59d`
- Source path: `skills/git-workflow-and-versioning/SKILL.md` at that commit
- Upstream license: MIT — Copyright (c) 2025 Addy Osmani; full text in `./LICENSE` (verbatim upstream bytes)
- Vet evidence: bd `sf-sdlc-go7y` (§11 raw pins, API-anchored), `sf-sdlc-xfdm` (external survey), `sf-sdlc-l12y` (raw-hash re-verification trail, mission sf-sdlc-4b56-exec)

## Source file authenticity

Referenced upstream file at the pinned commit (verified 2026-10-14 against `sf-sdlc-go7y` §11):

| Source path | Raw sha256 | Bytes | Git blob id |
|---|---|---|---|
| skills/git-workflow-and-versioning/SKILL.md | `b7465d187935c52546d39fdc7bd6ac36d94eda25a9500ef8c18b767d2eb116ea` | 14141 | `0e03a2323ed3f0131626660c3142f69c4a6f8830` |
| LICENSE | `6f202f8bd568cd730dbb2b0d1f8e243bc74c2fa1f64dbce9b2c7ea08bd5c9fd7` | 1068 | `d67778ada6b9cda6227e9130da182c13e73c8b2e` |

## Adaptation ledger (vs upstream at the pinned commit)

- Frontmatter description rewritten as a tight fleet discovery cue; `name` unchanged (folder/name match).
- Removed feature-branch/worktree/merge-in-1–3-days defaults → fleet pure-trunk default; noted single-parent append-only accepted-main compatibility (scar GIT-WORKFLOW.md:11).
- Removed `git reset --hard HEAD` as a save-point recovery default → non-destructive recovery or explicit destructive-recovery permission only.
- Removed npm/husky/lint-staged pre-commit commands → repo-native verification commands (repo AGENTS.md tiers) and the concepts only.
- Tag push made explicitly user-gated (push stays user-driven per fleet § Commits).
- Cross-skill references dropped/repointed: `code-review-and-quality` → fleet code-review/linus practice; `api-and-interface-design`, `deprecation-and-migration`, `shipping-and-launch` → dropped (no fleet equivalent installed).
- 2026-10-14 (mission sf-sdlc-4b56.4, agent-method migration): § 3 Descriptive Messages became the technique owner for the fleet message-construction method — merged hopper R10's technique (behavioural message from mission/sub-mission `intent` with rationale; structural tidyings prefix `tidy:` and take their message from the structural change). Removed the backwards authority claim "Fleet convention (hopper R10)"; hopper.md now loads this section before constructing a message (R10 loader). This adaptation is native fleet prose, not upstream bytes.
- 2026-10-14 (mission sf-sdlc-lrwb, Rev-2 SCAR linear/single-checkout consolidation): this skill became the **canonical MECE fleet owner of Git workflow and SCAR Git environment mechanics**. Rewrote around SCAR single-checkout (one repository checkout, one candidate owned by one named drafter, read-only parallel observers/reviewers) and no parallel Git state (no agent-created worktrees, branches, checkout copies, candidate stacks, or stashes); made strict single-parent append-only commits on `main` the unconditional fleet default, removing all long-lived-vs-short-lived-branch and feature-flag framing (oracle sf-sdlc-zdty T1); consolidated the inspection-gated init/add/commit/push protocol (scar `GIT-WORKFLOW.md` + build Rule 3 + AGENTS.md § Bash hygiene item 6) into this skill as the sole owner of Git state-mutation mechanics.
- Paragraphs migrated INTO this skill from `~/.config/opencode/AGENTS.md` and `prompts/build.md` (Rev-2): the no-parallel-Git-state / no-branch / no-worktree / no-stash rules and single-parent append-only commitment (§ Commits and § Single verification state), the inspection-gated scoped-staging checklists (Bash hygiene item 6), and the direct-path `git init`/`add`/`commit`/`push` checklist (build Rule 3). Those prompts now carry compact authority boundaries and load pointers only.
- Core method preserved: atomic commits, message conventions, keep-concerns-separate, sizing, save-point, change summaries, generated files/.gitignore, git debugging, semver/tag/changelog, rationalizations/red flags/verification checklists.

## Exclusions

None. Source complete (single file + upstream LICENSE); no upstream hooks/scripts are bundled or executed.

## Verification

`git diff --check` clean; frontmatter `name` == folder name; `LICENSE` bytes == upstream LICENSE blob (see table); local `references`/links resolve (no external links in body except the provenance pointer, which is optional metadata). No upstream script/hook executed. See mission evidence bead `sf-sdlc-l12y`. Rev-2 (mission sf-sdlc-lrwb): byte-equality of the synced `sf-sdlc` reference files and the template alias pairs is verified by the consuming mission's own gate, not restated here.
