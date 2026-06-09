---
description: Analyze a Karpathy-pattern LLM wiki knowledge base; generate an entity/relationship knowledge graph. Wraps the `understand-knowledge` skill.
argument-hint: "[wiki-directory]"
---

# /understand-knowledge — Wiki knowledge-graph generator (skill wrapper)

Load the `understand-knowledge` skill via the `skill` tool, then execute it with the user's arguments.

## Invocation

1. Call `skill({ name: "understand-knowledge" })` to load the workflow.
2. Treat the following as `$ARGUMENTS`: `$ARGUMENTS`
3. Follow the skill's instructions exactly.
