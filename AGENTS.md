# Repo notes for agents

Personal `~/.config` dotfiles repo. Not a software project — no package
manager, no build, no test suite, no CI. Verification is "does the tool
that consumes the file still load it".

## What's actually tracked

Run `git ls-files` before assuming anything is or isn't versioned. Run
`cat .gitignore` before assuming anything is or isn't ignored. Never
stage anything matched by `.gitignore`.

## opencode/ is the real content

This is an opencode (https://opencode.ai) configuration.
`opencode/opencode.json` is the entrypoint: it defines the model, plugin
load order, mode prompt files, and the read-permission denylist for
secrets. `share: "disabled"` is intentional.

`opencode/AGENTS.md` is auto-loaded by opencode when CWD is `opencode/`
and is the authoritative source for the agent fleet — subagent roster,
OODA doctrine, handoff grammar, mission contract format, back-brief
protocol, bead model, tracing. **This root file does not duplicate it.**
For the contents of `opencode/`, read the filesystem and that file; do
not rely on an inventory here.

## High-coupling references — break carefully

Agent, skill, and command names are string-referenced across `opencode/`
(doctrine tables, dispatch examples, mode prompts, cross-references
between agent files, skill descriptions). Grep `opencode/` for the name
before any rename or removal.

## Verification (such as it is)

There is no `make`, `npm test`, etc. After editing config:

- `opencode.json` — `python3 -m json.tool opencode/opencode.json` (or any
  JSON validator) to catch syntax errors.
- Agent / prompt / skill markdown — open in opencode and confirm it
  loads; no schema validator is checked into the repo.
- Plugins — only exercised at runtime by opencode; no standalone test
  harness.

Don't invent a build/test workflow. If a check is needed, run it ad-hoc
and don't commit scaffolding.

## Conventions worth preserving

- Prose style across `opencode/` follows the "terse structured text"
  doctrine in `opencode/AGENTS.md` § Communication style. Match it when
  editing existing files; don't add banners, emoji, or marketing tone.
- Agent frontmatter `description` is what opencode shows users in the
  agent picker; keep it tight and factual.
- `.ooda/` is scratch space for live agent runs and is gitignored — never
  stage anything from it. `opencode/plugins/tracer.mjs` writes session
  traces there; see `opencode/AGENTS.md` § Tracing for shape and
  redaction rules.

## Out of scope for this file

OODA doctrine, handoff grammar, mission contract format, Rust house
style, back-brief protocol, bead model — all live in `opencode/AGENTS.md`
and are auto-loaded when working there. Do not copy them here.
