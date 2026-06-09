---
description: Extract business-domain knowledge and generate a domain flow graph. Wraps the `understand-domain` skill.
argument-hint: "[--full]"
---

# /understand-domain — Domain extraction (skill wrapper)

Load the `understand-domain` skill via the `skill` tool, then execute it with the user's arguments.

## Invocation

1. Call `skill({ name: "understand-domain" })` to load the workflow.
2. Treat the following as `$ARGUMENTS`: `$ARGUMENTS`
3. Follow the skill's instructions exactly.
