---
description: Analyze a codebase to produce an interactive knowledge graph (architecture, components, relationships). Wraps the `understand` skill.
argument-hint: "[path] [--full|--auto-update|--no-auto-update|--review|--language <lang>]"
---

# /understand — Knowledge graph generator (skill wrapper)

Load the `understand` skill via the `skill` tool, then execute it with the user's arguments.

## Invocation

1. Call `skill({ name: "understand" })` to load the full workflow.
2. Treat the following as `$ARGUMENTS` for that skill: `$ARGUMENTS`
3. Follow the skill's phase-by-phase workflow exactly. Do not abridge.

If `$ARGUMENTS` is empty, run the skill against the current working directory with default options.
