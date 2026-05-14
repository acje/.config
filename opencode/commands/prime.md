---
description: Prime the session — gather context from AGENTS.md, recent git log, and project layout so the agent fleet starts oriented rather than blind.
agent: copernicus
subtask: true
---

# /prime — Session context priming

Load project context at the start of a session so every subsequent agent call starts oriented.

## What this command does

1. **Read AGENTS.md** (or `.opencode/AGENTS.md` if present) — absorb the OODA doctrine, agent roles, and any repo-specific rules.
2. **Recent git log** — `git log --oneline -20` to understand the last 20 changes and their scope.
3. **Project layout** — glob `**/*.md` for docs, `**/*.toml` / `**/*.json` for config markers, `src/**` or `crates/**` for source structure. Use rg to find entry points and key interfaces.
4. **Active work** — query bd for open mission epics and evidence beads (`bd query --label mission: --status open --json` if a workspace exists; falls back to `glob(".ooda/mission-*.md")` when no `.beads/` is active). Note any open `.ooda/` body files paired with closed beads (orphan candidates).
5. **Produce an inline summary** — do NOT write a file. Return structured inline context.

## Output shape (inline, no file written)

```
Project: <name inferred from git remote or directory>
AGENTS.md: loaded | not found
bd workspace: active (path) | none
Active missions: <list of bd epic ids with mission: labels, or .ooda/mission-*.md paths if no bd workspace, or none>
Recent changes (last 5): <git log --oneline -5 output>
Layout:
  <key directories / entry points discovered>
Doctrine highlights:
  <2–3 most relevant rules from AGENTS.md for this session's likely work>
Gaps observed:
  <any open mission epics, retained evidence beads, or .ooda/ orphans worth flagging>
```

## Scope

- Read-only. No edits, no writes, no bash mutations. Never run `bd init` (medium+ risk per autonomy rule).
- Produces inline summary only — the output is context for the current agent session, not a persisted artefact.
- If AGENTS.md is absent, note the gap; do not fabricate doctrine.
- If bd has open mission epics or `.ooda/` has active mission files with open checkboxes, surface them prominently.

## Out of scope

- Loading external issue trackers, MCP servers, or third-party services not already configured in `opencode.json`.
- Polling any remote endpoint.
- Writing any file (use `@copernicus` for evidence dumps if a deeper survey is needed).
