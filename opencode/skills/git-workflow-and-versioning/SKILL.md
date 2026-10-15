---
name: git-workflow-and-versioning
description: >-
  The canonical fleet technique owner for Git workflow and SCAR Git environment
  mechanics: single-checkout environment, no parallel Git state (no branches,
  worktrees, stashes, candidate stacks), strict single-parent append-only
  commits on main, inspection-gated init/add/commit/push protocol, atomic
  commits, message conventions, save points, pre-commit hygiene, release and
  semantic versioning. Load before any `git init`/`add`/`commit`/`push` or
  commit-message construction. Commands are guidance, never authority — commit,
  push, and destructive recovery stay user/caller-gated.
---

# Git Workflow and Versioning

## Overview

Git is your safety net. Treat commits as save points and history as documentation. With agents generating code at high speed, disciplined version control keeps changes manageable, reviewable, and reversible. Under SCAR (SCAR single-checkout environment design), the repository is the only codebase: one checkout, one linear history, no parallel Git state.

## When to Use

Any code change you commit, split, or release, and any Git state mutation. The technique lives here; the authority to act does not. Commands in this skill are guidance, not authorization: following it never grants commit, push, or destructive-recovery rights. Load this skill before any `git init`, `git add`, `git commit`, `git push`, or commit-message construction (fleet AGENTS.md § Commits; build Rule 3/9; hopper R10; scar GIT-WORKFLOW.md:21 "commands are guidance, not authorization to execute").

## SCAR Single-Checkout Environment & No Parallel Git State

SCAR is the guiding concept for environment design (scar `ALGORITHM.html#environment`, `GIT-WORKFLOW.md:3`). One repository checkout, one active candidate owned by **one named drafter** (`hopper`, or `build` on bounded direct paths). Observers and reviewers (`copernicus`, `feynman`, `oracle`, `linus`, `hamilton`) operate in parallel **read-only** without editing that candidate.

There is **no place to put parallel Git state.** Agents NEVER create worktrees (`git worktree add`), branches (`git checkout -b`, `git switch -c`, `git branch`), checkout copies, candidate stacks, or stashes (`git stash`) to hide, isolate, or parallelize state. No candidate stack, feature branch, advanced Git plumbing, bespoke gate, lock, or daemon is required (scar `ALGORITHM.html#environment:62-65`). Pre-existing **user-owned** worktrees or stashes are never modified, deleted, or reported as threats without explicit user authority. Only the repository is a codebase; snapshot/checkout copies are not second codebases.

Parallel work is cooperative, not writer exclusion: observers and reviewers may work in parallel without editing the candidate; external copies and offline edits are not prevented (scar `GIT-WORKFLOW.md:3`).

## Strict Linear Commits (single-parent append-only on `main`)

Unconditional fleet default, not an optional side-note (scar `GIT-WORKFLOW.md:11`; `ALGORITHM.html#environment:56-59`). After the declared accepted baseline (`git rev-parse --verify refs/heads/main^{commit}`), every accepted successor is a **single-parent append-only commit** directly on `main` whose sole parent is the immediately preceding accepted `main` commit.

- **No feature branches.** No long-lived *or* short-lived branches, no candidate stacks, no merge commits (`git merge`). Integrate small, reversible increments directly on trunk; `main` stays always deployable.
- **Never rewrite accepted history.** Never amend, rebase, `git reset --hard`, or force-push declared accepted history (scar `GIT-WORKFLOW.md:25`; `ALGORITHM.html#authority:216`). A supplied linear log does not prove no rewrite, exclusivity, intent, or historical authority.
- **Mistakes are corrected forward.** A scoped mistake in accepted history is corrected by a new scoped task and an authorized single-parent append-only corrective commit — never by erasing decisions.
- **Off-the-rails uncommitted increments** are recovered non-destructively: diff inspection, targeted unstaging, scoped file restore of only the drafter increment — while preserving unrelated dirty work. Destructive recovery is not a default.

## Inspection-Gated Git Protocol & Scoped Staging

Consolidates scar `GIT-WORKFLOW.md` with build Rule 3 and AGENTS.md § Bash hygiene item 6.

### Observe & frame before any Git state mutation

From the named repository inspect `git status --porcelain=v1 --untracked-files=all`, `git diff`, `git diff --cached`, and `git log --oneline -10`. Resolve accepted main with `git rev-parse --verify refs/heads/main^{commit}` and record its full ID and observation context. HEAD is checkout context, not fallback acceptance authority; missing or stale accepted state is Unknown/Unresolved. Reuse observations until state changes or external activity makes them stale.

### Preserve unrelated work

Never reset, overwrite, clean (`git clean`), or stage unrelated tracked/untracked work. If a file mixes unrelated changes, separate the scoped staging safely or halt. Never use blanket `git add .` or `git add -A`. Record scope, baseline dirty/untracked/staged work, and the exact candidate including new files and deletions.

### Inspection-gated `git init` (only when authorized)

Before `git init` on an existing user-owned non-repository directory: confirm no repo/ancestor/nested/symlink surprise and inspect directory contents.

### Inspection-gated `git add` / `git commit`

- Stage only explicit scoped paths: `git add -- <explicit scoped paths>`; never blanket add.
- Before `git commit`: inspect `git status` and the full `git diff --cached` content (never `--name-only`); verify no secrets/credentials or `.ooda/` / `.scratchpad/` artefacts are staged; confirm no unreviewed hooks/filters/signing execute arbitrary code; confirm repo-native verification tiers passed.
- After `git commit`: record the full commit SHA, inspect the actual commit content and its sole parent (`git rev-parse <sha>^`), and confirm `refs/heads/main` names that exact single-parent successor.

### Inspection-gated `git push` (requires explicit user authority)

Before `git push`: confirm the exact repository path, remote, target ref, and linear single-parent ancestry; never force-push.

## Core Principles

### 1. Commit Early, Commit Often

Each successful increment gets its own commit. Don't accumulate large uncommitted changes.

```
Implement slice → Verify → Commit → Next slice

Not: Implement everything → Hope it works → Giant commit
```

Commits are save points: if the next change breaks something, you can return to the last known-good state.

### 2. Atomic Commits

Each commit does one logical thing:

```
a1b2c3d Add task creation endpoint with validation
d4e5f6g Add task creation tests (unit + integration)

x1y2z3a Add task feature, fix sidebar, update deps, refactor utils   ← bad
```

### 3. Descriptive Messages

Commit messages explain the *why*, not just the *what*:

```
<type>: <short description>

<optional body explaining why, not what>
```

Types: `feat` (new feature), `fix` (bug fix), `refactor` (neither bug fix nor feature), `test`, `docs`, `chore`.

Fleet convention (message-construction technique owner): behavioural commit messages come from the mission contract's
`intent` (or a sub-mission's `intent` field) — history reads as
intent-over-time, and implementation mechanics drown the signal. Structural
tidyings (Tidy First, separate commit) prefix `tidy:` and take their message
from the structural change — e.g. `tidy: extract parse_header from decode`.

### 4. Keep Concerns Separate

Don't combine formatting changes with behavior changes, or refactors with features — each concern is a separate commit (fleet Tidy First, hopper R3: one axis of advance). Small cleanups (renaming a variable) may ride along at reviewer discretion.

### 5. Size Your Changes

Target ~100 lines per change; split anything over ~1000 lines.

```
~100 lines  → Easy to review, easy to revert
~300 lines  → Acceptable for a single logical change
~1000 lines → Split into smaller changes
```

## The Save Point Pattern

```
Agent starts work
    │
    ├── Makes a change
    │   ├── Test passes? → Commit → Continue
    │   └── Test fails?  → Repair or revert the increment → Investigate
    │
    └── Feature complete → All commits form a clean history
```

Adjustment for fleet safety: destructive history rewriting (`git reset --hard`, force-push, rebase/amend of declared accepted history) is NOT a recovery default (scar `GIT-WORKFLOW.md:25`). Recover an off-the-rails increment non-destructively (diff, targeted unstaging, a corrective commit) or request explicit destructive-recovery permission from the owning authority. Accepted history is never rewritten once declared.

## Change Summaries

After any modification, provide a structured summary so review shows scope discipline and surfaces unintended change:

```
CHANGES MADE:
- <path>: <change>

THINGS I DIDN'T TOUCH (intentionally):
- <path>: <nearby issue, out of scope>

POTENTIAL CONCERNS:
- <anything a reviewer should verify>
```

The DIDN'T TOUCH section proves you did not go on an unsolicited renovation (hopper R17 surface-not-execute).

## Pre-Commit Hygiene

Before every commit:

```
# 1. Review exactly what you are about to commit
git diff --staged

# 2. Ensure no secrets in the staged diff (password/secret/api_key/token patterns)

# 3. Run the repo's native verification for the change
#    — exact commands come from the repo AGENTS.md INNER/MID/BOUNDARY tiers
```

Automating hygiene with git hooks is a repo-local decision under the repo's own authority; this skill does not install hooks. Unreviewed hooks/filters/signing must not execute arbitrary code as a side effect of staging or committing.

## Handling Generated Files

- Commit generated files only if the project expects them (lockfiles, checked-in migrations).
- Don't commit build output, environment files, or IDE config unless shared.
- Have a `.gitignore` covering standard exclusions (`target/`, `dist/`, `.env`, `*.pem`). Ignore is not secrecy, untracking, backup exclusion, or secure deletion; do not store secrets.

## Using Git for Debugging

```
git bisect start / git bisect bad HEAD / git bisect good <known-good-commit>
git log --oneline -20
git diff HEAD~5..HEAD -- <scope>
git blame <path>
git log --grep="<keyword>" --oneline
```

Note: `HEAD` here is a debugging convenience against the current checkout; accepted main remains `refs/heads/main^{commit}` (SCAR current state). Debugging reads never mutate accepted history.

## Release & Versioning

Commits track *your* change; a **version** is how *consumers* track it. A version number and changelog are the contract that answers "what am I running, and is it safe to upgrade?".

### Semantic Versioning

`MAJOR.MINOR.PATCH` — MAJOR: breaking; MINOR: backward-compatible feature; PATCH: backward-compatible fix. When unsure whether a change is breaking, assume it is: a surprise major is far cheaper than a broken consumer.

### Tag the release; derive the version from the tag

A release is an immutable point in history. Tag it so it can always be reproduced, and derive the version from the tag rather than hand-editing scattered files. Tag push (`git push origin <tag>`) requires separate, explicit user authority — push remains user-driven (fleet AGENTS.md § Commits).

### Keep a changelog written for humans

A changelog is the curated, consumer-facing answer to "what changed and do I care?" — grouped `Added / Changed / Fixed / Deprecated / Removed / Security`, newest on top, phrased around user impact. Write the entry in the same change that makes the change, while the impact is fresh — not reconstructed from commit archaeology at release time.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll commit when the feature is done" | One giant commit is impossible to review, debug, or revert. Commit each slice. |
| "The message doesn't matter" | Messages are documentation. Future readers and agents need the why. |
| "I'll squash it all later" | Squashing destroys the development narrative and rewrites history. Prefer clean incremental commits. |
| "A branch keeps this separate" | There is no place to put parallel Git state. One linear `main`, one single-parent commit at a time. |
| "I'll split this change later" | Large changes are riskier to review and deploy. Split before submitting. |
| "I don't need a .gitignore" | Until `.env` with secrets gets committed. Set it up immediately. |
| "It's a small fix, bump the patch" | A behavior change consumers relied on is a major, whatever the diff size. |
| "The changelog is the commit log" | Commits are for you; the changelog is curated for consumers by impact. |

## Red Flags

- Large uncommitted changes accumulating
- Vague commit messages ("fix", "update", "misc")
- Formatting changes mixed with behavioral changes
- No `.gitignore` in the project
- Committing `target/`, `dist/`, `.env`, or build artifacts
- Any agent-created worktree, branch, checkout copy, candidate stack, or stash (parallel Git state)
- Merge commits or rewrites of declared accepted history
- Force-pushing shared/declared-accepted history
- A breaking change shipped under a minor or patch bump
- A release with no tag, or a version hand-edited out of sync with the tag
- A user-facing release with no curated changelog entry

## Verification

For every commit:

- [ ] Commit does one logical thing
- [ ] Message explains the why and follows the type convention
- [ ] Repo-native verification passed before committing
- [ ] No secrets in the staged diff
- [ ] No formatting-only changes mixed with behavioral changes
- [ ] `.gitignore` covers standard exclusions
- [ ] Full staged diff inspected (never `--name-only`); sole parent confirmed after commit

For every release (anything with consumers):

- [ ] Version bump matches the change (breaking → major, additive → minor, fix → patch)
- [ ] Release is tagged and the version is derived from the tag
- [ ] Changelog has a curated, human-readable entry grouped by impact
