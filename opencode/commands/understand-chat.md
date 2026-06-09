---
description: Ask questions about a codebase using its knowledge graph. Wraps the `understand-chat` skill.
argument-hint: "[query]"
---

# /understand-chat — Knowledge-graph Q&A (skill wrapper)

Load the `understand-chat` skill via the `skill` tool, then execute it with the user's arguments.

## Invocation

1. Call `skill({ name: "understand-chat" })` to load the workflow.
2. Treat the following as `$ARGUMENTS` (user query): `$ARGUMENTS`
3. Follow the skill's instructions exactly.

If `$ARGUMENTS` is empty, prompt the user once for the question.
