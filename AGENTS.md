# Repo notes for agents

Personal `~/.config` dotfiles repo. Not a software project — no package
manager, no build, no test suite, no CI. Verification is "does the tool
that consumes the file still load it".

## What's actually tracked

Run `git ls-files` before assuming anything. Only these are versioned:

- `opencode/` — opencode config, agent prompts, mode prompts, plugins, skills
- `ghostty/config` — terminal config
- `AGENTS.md` (this file) — root-level agent notes
- `LICENSE` — MIT
- `.gitignore`

Gitignored and **must not be committed** (already covered, but worth
knowing they exist locally and are not under version control):
`gh/`, `containers/`, `searxng/`, `opencode/auth.json`,
`opencode/.opencode/`, `.ooda/`, `*.bak.*`, `.DS_Store`.

## opencode/ is the real content

This is an opencode (https://opencode.ai) configuration. Layout:

- `opencode/opencode.json` — entrypoint. Defines model, plugin load order,
  `agent.build` / `agent.plan` prompt files, and the read-permission
  denylist for secrets. `share: "disabled"` is intentional.
- `opencode/AGENTS.md` — auto-loaded by opencode when CWD is
  `opencode/`. ~470 lines of OODA doctrine binding the agent fleet.
  **This root file does not duplicate it.** When working under
  `opencode/`, treat `opencode/AGENTS.md` as authoritative.
- `opencode/prompts/{build,plan}.md` — mode prompts referenced from
  `opencode.json` via `{file:./prompts/...}`.
- `opencode/agents/*.md` — seven subagents (`copernicus`, `feynman`,
  `moltke`, `hopper`, `gardener`, `automaton`, `oracle`). Each has YAML
  frontmatter (`description`, `mode: subagent`, `model`, `tools: {...}`).
- `opencode/plugins/searxng.mjs` — loaded via `opencode.json` `plugin`
  array. Provides `searxng_web_search` tool used by `copernicus` /
  `feynman`.
- `opencode/README.md` — human-facing overview of the agent system.

## High-coupling references — break carefully

Agent names are referenced by string in many places. Renaming or removing
one is a multi-file edit:

- `opencode/AGENTS.md` (doctrine table, dispatch examples, vocabulary)
- `opencode/README.md` (diagrams, tables)
- `opencode/prompts/build.md` and `opencode/prompts/plan.md`
- cross-references inside other `opencode/agents/*.md`

Grep for the agent name across `opencode/` before any rename.

## Verification (such as it is)

There is no `make`, `npm test`, etc. After editing config:

- `opencode.json` — `python3 -m json.tool opencode/opencode.json` (or any
  JSON validator) to catch syntax errors.
- Agent / prompt markdown — open in opencode and confirm it loads; no
  schema validator is checked into the repo.
- Plugin (`searxng.mjs`) — only exercised at runtime by opencode; no
  standalone test harness.

Don't invent a build/test workflow. If a check is needed, run it ad-hoc
and don't commit scaffolding.

## Conventions worth preserving

- Prose style across `opencode/` follows the "terse structured text"
  doctrine in `opencode/AGENTS.md` § Communication style. Match it when
  editing existing files; don't add banners, emoji, or marketing tone.
- Agent frontmatter `description` is what opencode shows users in the
  agent picker; keep it tight and factual.
- `.ooda/` is scratch space for live agent runs and is gitignored — never
  stage anything from it.
- `opencode/plugins/tracer.mjs` writes session traces to
  `.ooda/traces/<date>/<sessionID>.jsonl`. See `opencode/AGENTS.md`
  § Tracing for the data shape, redaction rules, and self-improvement
  workflow.

## Out of scope for this file

OODA doctrine, handoff grammar, mission contract format, Rust house
style, back-brief protocol — all live in `opencode/AGENTS.md` and are
auto-loaded when working there. Do not copy them here.
