---
description: Launch the interactive web dashboard for a codebase's knowledge graph. Wraps the `understand-dashboard` skill.
argument-hint: "[project-path]"
---

# /understand-dashboard — Dashboard launcher (skill wrapper)

Load the `understand-dashboard` skill via the `skill` tool, then execute it with the user's arguments.

## Invocation

1. Call `skill({ name: "understand-dashboard" })` to load the workflow.
2. Treat the following as `$ARGUMENTS`: `$ARGUMENTS`
3. Follow the skill's instructions exactly.

If `$ARGUMENTS` is empty, launch against the current working directory.
