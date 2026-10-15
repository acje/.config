---
name: create-verification-skill
description: Generates a project-local verification skill that drives the app the way a user does — any language, framework, or platform. Use when a project has no scripted way to prove UI/CLI/service behavior, or to author a verification skill for a repo. Late-QA verification authoring, user-invoked: it writes the skill that runs verification; it does not itself run a QA runner, start daemons, or confer acceptance authority.
---

# Create a verification skill

Every serious project needs a scripted way to drive the real app and prove behavior: launch it, exercise a feature the way a user would, and capture evidence. This skill generates that as a project-local skill (`<project>/.opencode/skills/verify-<app>/`, or `~/.config/opencode/skills/` for a paved workspace) tailored to the repo. You write the generator's output for the next agent, not for a human: it will be read cold, mid-task, by an agent that has never seen the app.

Scope boundary: this is **verification-skill authoring**. It produces the method and its evidence standards. It does not run a persistent QA runner, does not grant daemon/long-lived-service authority, and does not confer acceptance or gate ownership — fleet native gates and the no-background-daemon Bash-hygiene rule stay binding (global AGENTS.md § Bash hygiene, § Code-quality methods).

## 1. Interview the repo, not the user

Answer these from the codebase and only ask the user what you cannot observe:

- **Surface:** what does a user actually touch — web UI, CLI/TUI, desktop app, API, mobile app, library? Pick the primary one; note the rest.
- **Run:** how does the app start locally? Prefer the repo's documented dev command (package scripts, Makefile, README quickstart). Note ports, env vars, seed data, auth.
- **Drive:** how can an agent interact programmatically? Existing harnesses first (Playwright/Cypress specs, expect scripts, PTY helpers, curl-able endpoints, a debug port). Only then pick a generic recipe: browser/CDP for web and Electron, a PTY/tmux harness for CLI/TUI, plain HTTP for services.
- **Observe:** what evidence can be captured? Screenshots, terminal transcripts, response bodies, logs, exit codes, DB state.
- **Isolate:** can two instances run side by side (ports, data dirs, profiles)? If not, say so in the generated skill: refusing to double-drive a shared instance beats corrupting the user's session.

If the checkout doesn't build or start as-is, fix that first (or report it precisely) before generating. When an irrelevant missing asset blocks startup, the generated skill may create it, clearly marked as verification scaffolding, and remove it in cleanup.

## 2. Generate the skill

Write `<project>/.opencode/skills/verify-<app>/SKILL.md` with YAML frontmatter (`name: verify-<app>`, a `description` naming the app, surface, and when to reach for it — without frontmatter the skill never registers) and these sections, each grounded in what the interview actually found (no placeholders left):

- **Launch:** the exact command that starts the app for verification and how to tell it's ready (a log line, a prompt). Launch must reach a usable state from an empty data dir, including migrations and seed data. Ready means usable, not just "a process answers"; a database health check can pass while init scripts still run. Include teardown. For a short-lived CLI/TUI there is no server to keep alive: launch means build/install once, then start each drive in its own isolated PTY or tmux session.
- **Doctor:** one read-only check answering "is this instance worth driving?" — process up, right version/build, port owned by us, auth valid. Run it first whenever anything looks off.
- **Drive:** the harness recipe with real selectors/commands from this repo, not examples. Prefer stable handles (ARIA labels, data attributes, prompt strings, route paths) over coordinates and tab order.
- **Evidence:** what to capture for a proof and where it goes. State proof standards: exercise the real user path, not internal setters/test-only endpoints; capture the action and the resulting state, not just the final screen; verify side effects (files written, rows inserted, messages sent) alongside what's visible; mocks only where a production boundary already isolates the external system. When the safe path is a dry-run/test mode, verify what it actually skips by observing (files, network, git refs) rather than trusting its name — some dry-runs still touch the network or open a browser.
- **Cleanup:** how to tear down instances the run created. Never kill by process name; kill what you started. Cleanup removes instances and scratch state, never evidence: proof artifacts survive the teardown, in a location the skill names.
- **Helpers:** any script the skill ships is executable and its invocation is shown in the skill body. A helper the reader has to reverse-engineer is not a helper.

All bounded execution stays within the operator's verification contract; a step that would start or keep a long-lived process beyond its own teardown is out of this skill's authority.

## 3. Seed the feature map

Create `<project>/.opencode/skills/verify-<app>/features/README.md` plus one file per user-facing feature you can identify (top 3–5 to start, from routes, commands, menus, or docs). Follow the shape in the bundled [`references/feature-map-example/`](references/feature-map-example/) — a README index plus one file per feature, each answering from the user's point of view: what the feature is, how to reach it, how to drive it with the harness, and what observable end state proves it works. The four H2s are `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`. If seed data lacks a precondition a journey needs, the journey reports a failure and the reason goes in that feature's `Gotchas` — never weaken the journey to make it pass. The map is the repo's maintained verification source; a proof that drives one convenient entry point is incomplete when the map lists others.

## 4. Prove the generated skill before handing it over

Run its own instructions end to end once: launch, doctor, drive ONE mapped feature (one is enough; the map exists so later runs cover the rest), capture evidence, clean up. After cleanup, confirm the evidence still exists at the named location — a cleanup that eats the proof fails this step. Fix what fails, and run the generated cleanup after every failed iteration too, so broken attempts don't strand processes and ports. A generated skill that was never executed is a draft, not a deliverable. If you proved it in a stand-in for the real target (a container in place of a fresh VM, a local stack in place of a remote one), list every setup step the stand-in did that the target will not — those steps stay unverified until a run on the real target covers them.

## 5. Offer the maintenance loop

Point the user at keeping the map honest as the app changes (a follow-up verification-skill maintenance pass in the same family, or a new authoring session). Suggest a cadence only if they ask.
