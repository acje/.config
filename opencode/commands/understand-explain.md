---
description: Deep-dive explanation of a specific file, function, or module. Wraps the `understand-explain` skill.
argument-hint: "[file-path]"
---

# /understand-explain — Code explainer (skill wrapper)

Load the `understand-explain` skill via the `skill` tool, then execute it with the user's arguments.

## Invocation

1. Call `skill({ name: "understand-explain" })` to load the workflow.
2. Treat the following as `$ARGUMENTS` (target file/function/module): `$ARGUMENTS`
3. Follow the skill's instructions exactly.

If `$ARGUMENTS` is empty, prompt the user once for the target.
