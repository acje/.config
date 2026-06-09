---
description: Analyze a git diff or PR to understand changes, affected components, and risks. Wraps the `understand-diff` skill.
argument-hint: "[git-ref-or-range]"
---

# /understand-diff — Diff analyzer (skill wrapper)

Load the `understand-diff` skill via the `skill` tool, then execute it with the user's arguments.

## Invocation

1. Call `skill({ name: "understand-diff" })` to load the workflow.
2. Treat the following as `$ARGUMENTS`: `$ARGUMENTS`
3. Follow the skill's instructions exactly.
