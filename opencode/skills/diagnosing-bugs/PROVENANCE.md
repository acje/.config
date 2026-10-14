# PROVENANCE — diagnosing-bugs

Fleet-adapted opencode skill derived from MIT-licensed upstream material.

## Upstream

- Repository: https://github.com/mattpocock/skills
- Pinned revision (commit, immutable): `49dd158d1076134a641b33efb035946536778336`
- Source path: `skills/engineering/diagnosing-bugs/SKILL.md` at that commit
- Upstream license: MIT — Copyright (c) 2026 Matt Pocock; full text in `./LICENSE` (verbatim upstream bytes)
- Vet evidence: bd `sf-sdlc-go7y` (§11 raw pins, API-anchored), `sf-sdlc-xfdm` (external survey), `sf-sdlc-l12y` (raw-hash re-verification trail, mission sf-sdlc-4b56-exec)

## Source file authenticity

Referenced upstream files at the pinned commit (verified 2026-10-14 against `sf-sdlc-go7y` §11):

| Source path | Raw sha256 | Bytes | Git blob id |
|---|---|---|---|
| skills/engineering/diagnosing-bugs/SKILL.md | `849198df88cdb65fd0d97236604c1fca7ff2f22d2f705f9724a800d0266b118d` | 8664 | `d039541ddd1c46e6ddbd662fe99d49b686fc5e12` |
| LICENSE | `0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5` | 1068 | `f1dd2c09108dde1a5f56097cee8461b3ea834499` |
| skills/engineering/diagnosing-bugs/agents/openai.yaml | `3e430dbe4334a87597488c060cb3dc3786bb00c9182877d6f5ec41f62490e90b` | 103 | `a13a755a77634ce61a649a3a0d905a66d3865b35` |
| skills/engineering/diagnosing-bugs/scripts/hitl-loop.template.sh | `35103539fc36873eea36074769ad454f9379d6fc8b2dc0e26ce987fd3bfe5503` | 1316 | `243198464a8401a7ba1d63b3708fa43c3d067665` |

## Adaptation ledger (vs upstream at the pinned commit)

- Frontmatter description rewritten as a tight fleet discovery cue with an explicit no-authority-grant note; `name` unchanged (folder/name match). Upstream's model-invoked trigger wording ("when the user says diagnose/debug") is retained as the trigger cue, but no `disable-model-invocation`-style flag is used (unsupported as opencode enforcement; invocation rests on description + caller gate).
- HITL last-resort step generalized: the bundled `scripts/hitl-loop.template.sh` is NOT bundled or executed; the structured-HITL concept is described in-repo with an explicit no-daemon boundary (global Bash hygiene).
- Removed host-tool specificity where it invited unsupported execution (curl/Puppeteer wording generalized to "HTTP script"/"browser script"); every command shown remains read/observe-first.
- Core method preserved: Redact, Phase 1 tight red loop (this is the skill), tighten/non-deterministic/no-loop handling, Phase 2 reproduce+minimise, Phase 3 ranked falsifiable hypotheses, Phase 4 single-variable instrumentation with tagged logs + perf branch, Phase 5 regression-before-fix with the correct-seam requirement + no-seam-is-a-finding, Phase 6 cleanup.
- **Revision 2 (2026-10-14, review round sf-sdlc-t1rf):** added a "Role and escalation scope" section — loop construction/instrumentation are Act-executor-owned; ranked hypotheses route through the invoking caller to the fleet orientation owner (Feynman in multi-causal missions) rather than being shown to the end user unbidden; blocked-loop and redaction-insufficient escalations return to the invoking caller naming what is needed. Frontmatter description tightened with the role-scope phrasing. *(Historical: the routing it describes was removed in revision 3 after two same-class review rejections.)*
- **Revision 3 (2026-10-14, contract sf-sdlc-4b56.2 after ReviewRejected):** made the method role-neutral and activity-scoped. Removed named fleet-role allocation, recipient choice, embedded hypothesis routing, the caller-unavailable continuation permission, and the ranking-before-routing sequence from the frontmatter and body; the previous "Role and escalation scope" section became "Activity scope and authority boundary". Phases are now techniques applicable only where the invoking role's existing contract authorizes the activity: reading evidence and forming falsifiable predictions are usable without the loop phases (Phase 3 is consumable standalone), while a party authorized to run loops and assert fixes is bound by the execution discipline (reproduce before claiming a cause, test a prediction before accepting it). Redaction, evidence honesty, single-variable probes, correct-seam regression-before-fix, no-daemon / bounded-execution, authorized cleanup, and the no-authority-grant boundary are retained. Final method boundary: no cross-role actor names, no routing/confirmation/fallback instructions, no all-role execution prerequisites; escalation follows existing invoker contracts only.

## Exclusions

- `agents/openai.yaml` (host-specific openai agent descriptor, nil opencode relevance) — not bundled; upstream hash recorded above.
- `scripts/hitl-loop.template.sh` (upstream interactive script) — not bundled or executed; concept adapted in-body; upstream hash recorded above. No upstream script/hook executed.

## Verification

`git diff --check` clean; frontmatter `name` == folder name; `LICENSE` bytes == upstream LICENSE blob (see table). No upstream script/hook executed. See mission evidence bead `sf-sdlc-l12y`.
