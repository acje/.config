---
name: code-review
description: Structured code review with two modes — `standard` (correctness, types, patterns, tests) and `security` (six OWASP categories with PASS/FAIL verdict). Scope auto-detects PR / file / folder / unstaged changes. Writes a timestamped report under `.ooda/`. Use when the user asks for a code review, security review, or "review this PR/file/folder".
---

# Code Review

> **Provenance.** Synthesized from coleam00/ai-transformation-workshop@4500128
> (`.claude/commands/review.md` + `.claude/commands/security-review.md`).
> Adapted: dropped Atlassian/Jira hooks; reports land in `.ooda/` to match
> existing convention; two modes (standard, security) merged into one skill
> with mode parameter. Optional `gh pr review --comment` posting re-added
> for PR scope (off by default; user must request it).

## Modes

| Mode | Use when |
|------|----------|
| `standard` | General correctness/quality review — types, patterns, tests, error handling |
| `security` | Security-focused — injection, auth, data exposure, deps, crypto, error handling |

If the user did not specify a mode, default to `standard` and offer
`security` as a follow-up. If the diff touches auth, crypto, or input
parsing, run `security` mode in addition.

## Scope detection

Parse the user's input:

| Input | Action |
|-------|--------|
| PR number `123` or URL `github.com/.../pull/123` | `gh pr view <n> --json number,title,author,files` then `gh pr diff <n>` |
| File path `src/api/foo.ts` | Review the single file |
| Folder path `server/src/` | Review all source files under it |
| Empty | `git diff --cached --name-only` (staged); fall back to `git diff --name-only` (unstaged) |

State the resolved scope before reviewing. If scope is empty, halt and
ask the user.

---

## Mode: `standard`

### Phase 1 — Context

- Read project rules (`AGENTS.md`, `CLAUDE.md`, equivalents) for patterns
  and engineering priorities the codebase commits to (e.g. AGENTS.md § Fleet engineering priorities).
- For PRs: read title and description for intent.
- For files: identify role in the codebase before judging the code.

### Phase 2 — Review each file

| Category | Check |
|----------|-------|
| Correctness | Does the code do what it claims to? Edge cases handled? |
| Type safety | Explicit types, no implicit `any`, no unsafe casts |
| Construction paths (Rust) | Independently of control flow, apply fleet AGENTS.md § Rustling — selective TigerStyle adaptation → Construction-path review inventory to changed constrained types/routes. Use the existing `illegal-state-representable` artefact, as Linus does: record invariant/caller boundary; public fields/literals, constructors/builders, defaults, conversions, serde, mutation and absent routes; preservation/counterexample per route; valid and invalid cases with verdict and test evidence. Private fields do not protect defining-module paths. Accept independent booleans, genuine optionality and fallible input boundaries; do not invent stronger invariants. Missing evidence is a review gap, not safety. Respect review tiers and distinguish read-level assessment from executed tests. |
| Patterns | Matches existing codebase conventions |
| Error handling | Errors caught, propagated, or surfaced — not swallowed |
| Tests | New behavior has new tests; regressions have regression tests |
| Control flow (Rust) | Is one decision SPLIT between leading `if … { return … }` guards and a `match` deciding the same thing? Where the guards only reject a sentinel (`""`/`Some("")`/`0`/magic default), flag the **type**, not the layout. Exempt: genuine preconditions, `?`/`let … else`, loop `continue` guards, early returns short-circuiting expensive work, guards establishing the scrutinee's validity. Not "always use exhaustive match". See AGENTS.md § House style — Rust control flow |

### Phase 3 — Validate

Run automated checks for the project. Detect from `package.json` /
`Cargo.toml` / `pyproject.toml`:

```bash
# Type check (one of)
pnpm run build  |  npm run build  |  cargo check  |  mypy .  |  tsc --noEmit

# Lint (one of)
pnpm run lint  |  eslint .  |  cargo clippy  |  ruff check

# Tests (one of)
pnpm test  |  cargo test  |  pytest
```

Record exit codes. Don't fabricate PASS results.
Keep the raw command result/exit separate from the finding's disposition
(Phase 5). Interpret diagnostics using the command's documented contract and
the actual output, not an unconditional `exit > 1` ⇒ domain defect rule.
Execution errors or missing required evidence are Unknown, never a clean pass.

### Phase 4 — Severity

| Severity | Criteria |
|----------|----------|
| Critical | Security issues, data loss, crashes |
| High     | Type violations, missing error handling, logic errors |
| Medium   | Pattern inconsistencies, missing edge cases |
| Low      | Style suggestions, minor improvements |

### Phase 5 — Standard disposition (canonical)

Severity ranks impact; it does **not** decide whether publication must halt.
Assign each finding a disposition independently of severity:

| Disposition | Evidence required | Consequence |
|-------------|-------------------|-------------|
| Blocking | Concrete defect/risk witness, or a named mandatory invariant with an actual applicability/trigger witness and demonstrated violation | NEEDS WORK; fix before publication |
| Advisory | Improvement suggestion without either blocking witness; state why no mandatory invariant is violated | May APPROVE with notes; do not halt solely because a fix is suggested |
| Unknown | Unresolved execution/error result, applicability, or missing evidence needed to decide | Obtain required evidence; unresolved required evidence prevents approval, never counts as PASS |

For each finding record `file:line`, severity, disposition, witness, applicable
authority/trigger (or none), and remedy. Read cited rules; do not invent a
mandatory gate from a preference. A Low finding can block when a mandatory
invariant really applies. Known correctness, security, unsafe soundness, and
enforcement failures remain blocking; mandatory hooks, CI, whitespace gates,
and changed-guard four-step proof requirements remain mandatory. Tracking or
acknowledging a failure does not discharge them. Do not import security mode's
`PASS WITH NOTES` / High-finding semantics into standard mode.

**Scope and semantics adjudication:**

- Portable generic documentation/examples are not executed fleet operations.
  Apply fleet-specific constraints when the content is explicitly intended as
  runnable fleet instructions; a malformed actual fleet operation, or an
  instruction that would violate the applicable invariant, can block. Do not
  execute examples merely to manufacture a violation.
- An agreeing restatement of canonical policy is advisory absent competing
  authority. A reordered/conflicting list purporting to govern the same scope
  blocks when it conflicts with the canonical authority.
- Intentional TSV terminal tabs encode an empty final field: splitting a
  ten-field row on tabs yields ten fields; trimming the terminal tab yields
  nine. A generic whitespace diagnostic is not itself a content defect.
  Accidental whitespace with an actual defect witness, or whitespace violating
  an applicable mandatory whitespace gate, blocks. Never blindly trim semantic
  bytes or waive a required gate.

**Recommendation:** APPROVE only when no Blocking findings and no unresolved
required Unknown evidence remain, and all applicable mandatory gates are
satisfied. Report advisory notes and any optional evidence gaps explicitly;
otherwise NEEDS WORK, distinguishing demonstrated failures from Unknowns.
Preserve raw nonzero diagnostic results; approval is not “all checks green”.
An explicit hard exit-0 mission obligation is not overridden by adjudication:
hand back for contract correction if a diagnostic result conflicts with it.

---

## Mode: `security`

### Categories (focus only on what's relevant to the diff)

#### 1. Injection
- SQL injection: raw queries with string concat / template literals
- Command injection: `exec`, `spawn`, `child_process` with user input
- XSS: unescaped input in HTML/JSX, `dangerouslySetInnerHTML`
- NoSQL injection: unsanitized query objects
- Path traversal: user input in file paths

#### 2. Authentication & Authorization
- Missing auth checks on protected routes
- Hardcoded credentials, tokens, API keys
- Insecure session management
- Missing CSRF on state-changing endpoints
- Overly permissive CORS

#### 3. Data exposure
- Sensitive data in logs (passwords, tokens, PII)
- API responses leaking internals (stack traces, schemas)
- Secrets in source / config
- Missing input validation on API boundaries

#### 4. Dependency & configuration
- Known-vulnerable dependency versions
- Insecure default config
- Missing security headers
- Debug mode enabled in production paths

#### 5. Cryptography
- Weak hashing (MD5/SHA1 for passwords)
- Hardcoded encryption keys
- Insecure RNG for security values
- Missing HTTPS enforcement

#### 6. Error handling
- Verbose errors exposing internals
- Unhandled promise rejections
- Missing error boundaries
- Catch blocks that swallow errors

### Severity (security mode)

| Severity | Meaning | Action |
|----------|---------|--------|
| Critical | Exploitable, data-breach risk | Block merge, fix immediately |
| High     | Significant weakness | Fix before merge |
| Medium   | Defense-in-depth issue | Fix soon; OK to merge with tracking |
| Low      | Best-practice deviation | Address when convenient |
| Info     | Observation, no immediate risk | Consider for future |

**Verdict definitions:**

| Verdict | Meaning |
|---------|---------|
| `PASS` | No Critical or High findings; Medium/Low are advisory only |
| `PASS WITH NOTES` | No Critical findings; one or more High findings that are acknowledged and tracked |
| `FAIL` | One or more Critical findings, or unacknowledged High findings |

### OWASP references per finding

For every finding in security mode, include the most specific applicable OWASP URL:

| Category | OWASP reference |
|----------|----------------|
| Injection | https://owasp.org/www-community/Injection_Theory |
| Auth/AuthZ | https://owasp.org/www-project-top-ten/2017/A2_2017-Broken_Authentication |
| Data exposure | https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure |
| Dependency | https://owasp.org/www-project-top-ten/2017/A9_2017-Using_Components_with_Known_Vulnerabilities |
| Cryptography | https://owasp.org/www-project-top-ten/2017/A6_2017-Security_Misconfiguration |
| Error handling | https://owasp.org/www-community/Improper_Error_Handling |

The `**Reference**` field in each finding template is mandatory for security mode, not optional.

---

## Report — write to `.ooda/review-<timestamp>.md`

```bash
mkdir -p .ooda
TS=$(date +%s)
REPORT=".ooda/review-${TS}.md"
```

### Optional: post to PR (PR scope only)

If the scope is a PR **and** the user explicitly requests posting the review to GitHub:

```bash
gh pr review <PR_NUMBER> --comment --body "$(cat ${REPORT})"
```

Do **not** post by default. Ask or wait for explicit instruction. Never post Jira or
Atlassian comments.

### Standard mode template

```markdown
# Code Review: <SCOPE>

**Mode**: standard
**Scope**: <PR #N | file path | folder path | unstaged>
**Recommendation**: <APPROVE | NEEDS WORK>
**Disposition counts**: Blocking=<n> Advisory=<n> Unknown=<n>

## Summary

<2–3 sentences: what was reviewed, overall assessment, and alignment/tradeoffs against project engineering priorities>

## Issues

### Critical
<each issue: file:line; severity; disposition; witness; authority/trigger or none; remedy, or "None">

### High
<...>

### Medium
<...>

### Low
<...>

## Validation

| Check | Raw result | Exit code | Role / expectation | Disposition / evidence |
|-------|------------|-----------|--------------------|------------------------|
| Type check | <output/error/unrun> | <n or unrun> | <hard gate or diagnostic; expected outcome> | <Blocking/Advisory/Unknown or satisfied; witness> |
| Lint | <...> | <...> | <...> | <...> |
| Tests | <...> | <...> | <...> | <...> |

## What's good

<acknowledge positive patterns>

## Recommendation

<specific next actions; separate blockers, advisory improvements and required Unknown evidence>
```

### Security mode template

```markdown
# Security Review: <SCOPE>

**Mode**: security
**Scope**: <files reviewed>
**Verdict**: <PASS | PASS WITH NOTES | FAIL>

## Findings summary

| Severity | Count |
|----------|-------|
| Critical | <n>   |
| High     | <n>   |
| Medium   | <n>   |
| Low      | <n>   |
| Info     | <n>   |

## Findings

### [SEVERITY] <Finding title>

**Category**: Injection | Auth | Data Exposure | Dependency | Crypto | Error Handling
**File**: `path/to/file.ts:LINE`

**Issue**: <1–2 sentences>

**Risk**: <1–2 sentences>

**Fix**:
```<lang>
// suggested fix
```

**Reference**: <OWASP / advisory link if applicable>

---

## Action items

1. <most important fix>
2. <second>
3. ...

## What looks good

- <positive security patterns observed>
```

---

## Final reply (terse, structured)

After writing the report, reply with:

```
Mode: <standard|security>
Scope: <resolved scope>
Verdict / Recommendation: <...>
Issues: Critical=<n>  High=<n>  Medium=<n>  Low=<n>
Dispositions: Blocking=<n> Advisory=<n> Unknown=<n>   (standard mode only)
Validation: <raw results/exits; gate satisfaction and diagnostic disposition separately>   (standard mode only)
Report: .ooda/review-<timestamp>.md
```

## Discipline

- Be specific: cite `file:line` for every issue.
- Suggest fixes; don't just flag problems.
- Don't post to GitHub. Don't update Jira. Reports stay local; the
  orchestrator decides what to do with them.
- Don't fabricate validation results — if a tool isn't installed, mark
  the row `SKIPPED` with a one-line reason.
- Focus on the actual diff. Pre-existing issues are fair game only if
  Critical or directly tangled with the change.
