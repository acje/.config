# Phase 7 — Documentation & Human-facing quality: detailed checks

> Enrichment reference for the quality-sweep skill. Concrete, generalized
> checks mined from real improvement history. Evidence arbitrates: a check is
> PRESENT only with a cited artifact; absence is a finding. Accessibility,
> Usability, and i18n are N/A for targets with no human-facing surface (e.g. a
> pure backend library) — state N/A explicitly with a one-line reason.

**Shard ownership.** This is the phase-7 evidence shard. It scores exactly the
four dimensions below (Docs, Usability/UX, Accessibility, i18n/l10n).
**Accessibility's home row is here** — the phase-1 shard reads a11y-as-design-
intent context but does not score it (facet-ownership rule, SKILL.md § The 29
dimensions); this shard scores a11y against the delivered surface.

**Probe floor is mandatory.** A dimension may be scored `ABSENT` only after its
probe floor below has been executed and its transcript recorded. `ABSENT` means
"these specific probes returned nothing", never "I didn't find anything". For
Accessibility and i18n, prefer `N/A` (with a one-line reason) over `ABSENT` when
the target ships no human-facing surface — but run the probes first so the N/A
is earned, not assumed.

## Docs

Good documentation is a *contract that tracks the code*, not aspirational prose.
Public API surface carries doc comments where the signature warrants; the
architecture document describes the shipping structure, not a past or planned
one; diagrams are internally consistent and match real names; the primary
README lets an external adopter go from zero to a working invocation. Doc
comments are reserved for genuine API contract — they are not a default home for
rationale (that lives in ADRs, commit messages, or an issue tracker). History
here is RICH: API-doc-section discipline, architecture-doc drift, diagram
integrity, README walkthroughs, and stale cross-references recur heavily.

**Checks:**
- Every public API item (functions, types, enums, consts, fields that are not
  self-documenting) carries a doc comment stating purpose; functions that can
  fail document their error conditions, functions that can panic document the
  panic, and unsafe items document the safety contract. Undocumented public
  surface is a finding; blanket suppression of the "missing docs" lint at
  module scope is itself a finding — fix by documenting, not silencing.
- Documented errors/panics/safety are ACCURATE — the stated conditions match
  the actual code path, not boilerplate. A `# Errors`/`# Panics` section that
  lists conditions the body cannot produce (or omits ones it can) is a finding.
- The architecture document reflects the current module structure and the
  current public surface. Cross-check its API tables, module map, and dependency
  narrative against the code; stale rows listing removed commands/types/events
  as "current" are doc-drift findings.
- Diagrams (mermaid, C4, Graphviz, dependency graphs) are internally
  consistent: every edge references a declared node/subgraph; every node name
  matches a real symbol/module/function; data-flow edges correspond to real call
  sites. An edge to an undeclared node, or a node naming a nonexistent
  module/function, is a finding.
- Operational/runbook docs (OPERATIONS/DEPLOYMENT/runbook) match the running
  system: config defaults, env-var names, backends, intervals, uids, and route
  lists reflect reality. Known template-residue values (placeholder module/
  package names, copied-in defaults) are findings even if flagged as "known
  drift".
- The primary README (or equivalent entry doc) matches the current
  implementation and gives an external adopter a real quickstart: overview,
  minimal working invocation, module/architecture map, and pointers to deeper
  docs. A stale README claim, or a README that is a thin stub for a shipped
  tool, is a finding.
- Doc comments are contract, not a rationale dump. A doc comment added only to
  justify a lint suppression, park a design rationale, host an ADR link, or
  stand in for a deleted plain comment is a smell — prefer rename/extract or a
  durable home (ADR/commit). Over-long doc comments that bury the one-line
  summary are a finding: lead with the summary, keep contract sections, cut
  prose.
- Cross-references resolve and are current: intra-doc links are not broken; ADR
  (or design-doc) citations point at the governing, non-superseded record;
  file:line citations embedded in docs/comments are not stale. A broken link, a
  citation to a superseded decision, or a surviving stale file:line pointer
  after a refactor is a finding.
- Comments in code are the code's own explanation, not a substitute for it. If a
  reader needs a "why" comment to follow the code, treat the code as the defect
  (rename/extract/restructure); durable rationale belongs in ADR/commit, not
  inline prose.

**Probe floor (mandatory before ABSENT):**
- Locate the entry docs (`README*`, `ARCHITECTURE*`, `docs/`, `OPERATIONS*`) via `rg -l -i 'readme|architecture|operations'` / directory listing.
- Grep public items for doc comments (`rg 'pub (fn|struct|enum|trait)'` vs preceding `///`/`/**` — sample the ratio).
- Grep for diagrams and cross-references (`rg -i 'mermaid|```mermaid|C4|\.svg|\]\('` for intra-doc links).
- Grep for missing-docs suppression (`rg 'allow\(missing_docs|missing_docs'`).
- ABSENT only if the target has a public surface AND no README/API docs exist — record the transcript.

**Anti-patterns to hunt:**
- doc-drift — architecture/ops/README describes a past or aspirational state; API
  table lists removed surface as current.
- undocumented-public-API — `pub` items with no doc comment, or missing
  `# Errors`/`# Panics`/`# Safety` where the signature warrants.
- blanket-doc-suppression — module-level allow of the missing-docs lint
  masking a whole undocumented surface.
- boilerplate-contract — `# Errors`/`# Panics` section present but inaccurate
  (lists impossible errors, omits real ones).
- diagram-contradicts-code — mermaid/C4 edge to an undeclared node, or a node
  naming a nonexistent module/function.
- aspirational-doc-claim — doc-comment promises a field/behaviour never actually
  landed (load-bearing-wrong).
- rationale-in-doc-comment — doc comment used to park rationale, ADR links, or lint
  justifications instead of contract.
- stale-citation — surviving stale file:line pointer or superseded-ADR
  reference after a rename/refactor.
- broken-intra-doc-link — doc link that fails a docs build.
- stub-README — thin/placeholder README for a shipped, adopter-facing tool.

## Usability / UX

Good UX means a task succeeds with minimal friction and errors that arise are
legible to *the person who hit them*. The dominant, recurring distinction in
history: end-user-facing messages state what failed and the next action, and are
kept separate from operator-facing diagnostic logs. For libraries/tools the
adopter is the user — API and CLI ergonomics, and a real getting-started path,
are the UX surface. History here is MODERATE.

**Checks:**
- End-user error messages state what failed and what to do next, in the user's
  vocabulary — distinct from operator diagnostic logs (internal type names,
  stack context, variant names). Operator jargon surfacing in an end-user
  message is a finding.
- Error messages are directional and disambiguated: a message clearly
  distinguishes fundamentally different causes (e.g. a contract violation vs a
  benign "output needs regenerating") so the user takes the right action. A
  single message conflating distinct failure classes is a finding.
- CLI/argument ergonomics avoid footguns: required-argument and mutual-exclusion
  errors are intelligible; a flag whose parse-time failure message contradicts
  the user's mental model ("this should be safe regardless") is a usability
  finding. Prefer the simplest argument surface that fits (plain args for a
  couple of positionals; a parser framework only for real subcommands/flags).
- Untrusted or unbounded input echoed into an error message is truncated to a
  sane bound before inclusion — an error that splices an arbitrarily long
  attacker/user value verbatim is both a UX and a robustness finding.
- Adopter-facing API is the primary DX surface for a library: the public API is
  the sole, coherent, documented way to accomplish adopter tasks; internal or
  test-only generic forms are hidden or clearly marked, not leaked into the
  natural adopter vocabulary. An adopter forced to reach past the public facade
  into substrate internals to do a common task is a DX finding.
- A getting-started / setup path exists and is executable: for a tool that needs
  bootstrapping, running it with no config prints (or docs provide) a concrete
  multi-step walkthrough — what config is required, a minimal first example, and
  verification steps — not a bare error. Assert this in a test where feasible so
  it does not silently rot.
- User-facing copy (tooltips, labels, help text, status descriptions) is
  ACCURATE against the thing it describes and consistent across every surface
  that shows it. A tooltip whose stated formula/scope disagrees with the metric
  it annotates, or a label that means different things on different pages, is a
  finding — flag explicitly whether the fix is wording-only or a real semantic
  gap.
- Task effectiveness: the primary user task can be completed through the shipped
  surface without dead ends. A control/column/affordance that references data
  the user cannot reach, or a documented capability with no working path, is a
  finding.

**Probe floor (mandatory before ABSENT):**
- Identify the user surface: CLI (`rg -i 'clap|argparse|commander|cobra|help'`), API (public facade), or GUI/HTML.
- Grep for end-user error copy vs operator logs (`rg -i 'eprintln|error!|println.*error|user.*message'`; sample for jargon leakage).
- Grep for a getting-started / quickstart path (`rg -l -i 'quickstart|getting.?started|usage|example'`).
- ABSENT only if the target has a user/adopter surface AND these probes surfaced no UX affordance — record the transcript. (N/A if there is genuinely no human/adopter surface — state so.)

**Anti-patterns to hunt:**
- operator-jargon-in-end-user-error — internal type/variant names or diagnostic
  context leaking into a message a user reads.
- conflated-error — one message covering distinct causes that need different user
  actions.
- cli-footgun — parse-time error that contradicts the user's safety expectation
  (e.g. a "safe" dry-run flag failing on an unrelated required arg).
- unbounded-value-in-error — untrusted/long input spliced verbatim into an error
  string.
- leaky-adopter-API — public surface forces internal/generic vocabulary or
  substrate reach-through for common tasks.
- no-onboarding-path — tool prints a bare error instead of a bootstrap
  walkthrough; no quickstart for a shipped tool.
- inaccurate-copy — tooltip/label/help text disagreeing with the value or scope
  it annotates.
- inconsistent-copy — the same concept described differently across pages/surfaces.

## Accessibility (a11y)

History-thin — the corpus touches a11y only lightly (a `title=` attribute called
out as an "a11y floor" on tooltip triggers; one Hugo site audit listing
accessibility as a launch gate; contrast/keyboard appear only incidentally).
Treat a11y as N/A for targets with no shipped human-facing UI (backend
libraries, CLIs with no GUI) — state N/A with a one-line reason. For targets
that DO ship a user-facing visual/interactive surface, apply the standard WCAG
POUR checks below. **These are best-practice-derived, not history-mined.**

**Checks (best-practice-derived):**
- Perceivable: meaningful non-text content has text alternatives (alt text,
  accessible names); information is not conveyed by colour/shape alone; text and
  UI contrast meet WCAG AA ratios (4.5:1 body text, 3:1 large text / UI
  components).
- Operable: every interactive control reachable and usable by keyboard alone
  (no mouse-only affordance); focus order is logical and focus is visible; no
  keyboard trap. A hover-only tooltip/menu with no keyboard/focus equivalent is
  a finding.
- Understandable: form fields have programmatically associated labels; error
  states are announced (not colour-only); language of the page/section is set so
  assistive tech pronounces correctly.
- Robust: interactive widgets expose correct role/name/state (native elements
  preferred; ARIA only where native semantics are insufficient, and used
  correctly — no broken/contradictory ARIA); custom controls degrade to an
  accessible baseline (e.g. `title=`/native attribute as a documented floor).

**Probe floor (mandatory before ABSENT):**
- First determine whether the target ships a human-facing visual/interactive surface (`rg -l -i '\.html|\.tsx|\.jsx|\.vue|\.svelte|template'`). If none → `N/A` with the one-line reason (run this probe to earn it).
- If a surface exists: grep for text alternatives and semantics (`rg -i 'alt=|aria-|role=|<label|title='`).
- Grep for colour-only signalling and contrast tells (`rg -i 'color:|background:|status.*color'` on status/severity markup).
- Grep for keyboard/focus handling (`rg -i 'tabindex|onkeydown|:focus|hover'`).
- ABSENT only if a user-facing surface exists AND these probes surfaced no a11y affordance — record the transcript.

**Anti-patterns to hunt:**
- mouse-only-control — an affordance (tooltip, menu, drag handle) with no
  keyboard or focus path.
- colour-only-signal — status/severity encoded solely by colour with no
  text/shape backup.
- low-contrast-text — foreground/background below WCAG AA.
- unlabelled-input — form control with no associated accessible label.
- aria-misuse — ARIA role/state that is wrong, redundant, or contradicts native
  semantics.
- missing-text-alternative — image/icon conveying meaning with no accessible name.

## Internationalisation / localisation (i18n/l10n)

History-thin — the corpus shows locale-config edits (a Hugo `locale` key), a
template audit flagging "missing i18n", and one explicit *anti*-signal: a
mixed-language UI (a stray non-English link label in an otherwise-English
surface) fixed as an English-CONSISTENCY change with an explicit instruction NOT
to build a localization framework. That YAGNI signal matters: for a
single-locale target, do not manufacture i18n scope — flag consistency, not
missing frameworks. Treat i18n as N/A for a target with no user-facing text or a
deliberate single-locale scope — state N/A with a one-line reason. Where a target
genuinely serves multiple locales, apply the standard checks below. **These are
best-practice-derived, not history-mined.**

**Checks (best-practice-derived):**
- Language consistency: a single-locale surface is uniformly in that locale — no
  stray strings in another language. Mixed-language UI is a finding even when
  full i18n is out of scope (fix by consistency, not by a framework).
- User-facing strings are externalized from code/markup into a translatable
  resource where localization is a real requirement; hard-coded user-facing
  literals embedded in logic that block translation are a finding. (For a
  deliberate single-locale target, this is N/A — do not invent the requirement.)
- Locale-affected formatting (dates, numbers, currency, collation, pluralization)
  goes through locale-aware APIs rather than hard-coded formats/assumptions;
  locale config values are in the format the toolchain expects.
- Layout and encoding tolerate localization: UTF-8 throughout; layouts absorb
  text expansion/contraction and, where in scope, bidirectional text; no
  fixed-width assumptions that clip translated strings.
- Scope discipline: distinguish an i18n gap (multi-locale product missing
  translation infrastructure) from a mere consistency defect (single-locale
  product with a stray string). Recommending a localization framework for a
  single-locale target is itself a scoping error.

**Probe floor (mandatory before ABSENT):**
- First determine locale scope: is this a deliberate single-locale target (then consistency, not framework, is the bar) or multi-locale? Check `rg -l -i 'locale|i18n|l10n|translat|lang='`.
- Grep for externalized strings / translation resources (`rg -l -i '\.po|\.mo|messages\.|i18n/|locales/|gettext|fluent'`).
- Grep for locale-aware formatting and a stray-language consistency check (`rg -i 'Intl\.|strftime|locale|toLocale'`; scan a user-facing surface for mixed-language strings).
- Prefer `N/A` (one-line reason) over `ABSENT` for a no-user-text or deliberate single-locale target — but run the probes first so the N/A is earned. Record the transcript.

**Anti-patterns to hunt:**
- mixed-language-UI — a stray foreign-language string in an otherwise
  single-locale surface.
- hard-coded-user-string — translatable user-facing literal baked into logic,
  blocking localization (multi-locale targets only).
- locale-unaware-formatting — dates/numbers/currency/collation formatted with
  hard-coded assumptions.
- clipped-translation — fixed-width layout that truncates expanded translated
  text.
- over-scoped-i18n — proposing a localization framework for a deliberate
  single-locale target (YAGNI violation).
