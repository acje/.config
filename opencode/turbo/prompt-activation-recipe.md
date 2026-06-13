# Prompt Activation Recipe (P1–P12)

Single source of truth for the twelve principles `turbo` applies during
prompt rewrites. Referenced from `opencode/agents/turbo.md`. When this file
changes, update turbo.md's principle citations in the same commit — two
sources of truth drift silently otherwise.

## Status

- Authored 2026-05-14, reverse-engineered from `opencode/agents/turbo.md`'s
  existing principle citations.
- P1, P3, P5, P6, P7, P8, P9, P10, P11, P12a, P12b: **high confidence** —
  turbo.md cites enough context to write them directly.
- P2, P4: **medium confidence — [EVIDENCE GAP]** — turbo.md names them by
  number but does not describe them. Defined here from gap analysis;
  verify on first real turbo invocation and revise on mismatch.
- Cross-surface table: **high** — turbo.md's clarify-step enumerates the
  three surfaces and differential treatment.
- Tensions + dead-letter tables: **medium** — turbo.md references them by
  name. Entries inferred from observable patterns across the agent fleet.
- Frozen. Changes require cited trace evidence per P12a.

---

## The twelve principles

### P1 — Recency anchoring

Place load-bearing rules (safety, correctness, output format) at the tail
under `# Final instructions`. When prompt body exceeds ~5k tokens, restate
the same rules at the top.

**Rationale.** Long-context attention degrades in the middle of the
window. The tail is the most recently attended span when the model
generates; the head is the most recently primed when reading.

**Checklist.**
- [ ] Load-bearing rules collected under `# Final instructions` at tail.
- [ ] If body > ~5k tokens: same rules restated at top.
- [ ] No critical rule appears *only* in the middle.

### P2 — Dead-letter pruning  [EVIDENCE GAP]

Rules that haven't fired in observable traces (no `permission.ask`,
no anti-pattern catch, no example match) over the prompt's lifetime
become candidates for removal. The Dead-letter table below collects
common offenders.

**Rationale.** Each rule costs context budget and adds rule-interaction
surface. A rule that fires zero times across N sessions either (a) covers
a failure mode that doesn't occur in practice, (b) is unobservable
(e.g. "be thoughtful"), or (c) is shadowed by another rule that fires
first. All three are candidates for deletion.

**Checklist.**
- [ ] Each rule has at least one observable failure mode it prevents.
- [ ] No rule duplicates another by entailment.
- [ ] Unobservable rules ("be helpful", "think carefully") removed or
      replaced with named failure modes.

### P3 — Evidence extraction

Inlined evidence (logs, transcripts, file dumps, long examples) becomes
pointers to bd beads, user-facing `.ooda/` artefacts, or external paths. The
prompt body stays load-bearing only.

**Rationale.** Evidence is read once at design time, then forever costs
context budget on every invocation. Pointer-over-body (see
`opencode/AGENTS.md` § Evidence carrying) is doctrine for cross-agent
handoff; P3 applies the same discipline to prompt authoring.

**Checklist.**
- [ ] No multi-line log / trace / transcript inlined in the prompt body.
- [ ] Worked examples > ~20 lines extracted to sibling files.
- [ ] Each pointer states what the artefact contains and why the reader
      should follow it.

### P4 — Compaction triggers  [EVIDENCE GAP]

Name the section or rule where compaction should fire when context fills
up. Pair with `compaction: { auto, prune, reserved }` in `opencode.json`.
Compaction-aware prompts mark which sections are *load-bearing forever*
(survive prune) and which are *scratch* (eligible for prune).

**Rationale.** opencode's compaction runs automatically when context
approaches the model's window. Prompts that don't declare priority lose
load-bearing rules to prune indiscriminately. Naming the trigger lets
the operator (and future reader) reason about which rules survive.

**Checklist.**
- [ ] Compaction-survive sections labelled (e.g. `## Final instructions
      (compaction-survive)`).
- [ ] Scratch / example sections labelled as prune-eligible.
- [ ] Trigger placed *before* the tail (so the tail survives the prune).

### P5 — Load-bearing rationale

Every safety / correctness rule carries one line of "why this matters" —
not citation, not authority, just the failure mode the rule prevents.

**Rationale.** A rule with rationale is a rule the model (and the
future reader) can apply situationally. A rule without rationale is a
rule that gets pattern-matched on surface form and missed when the
surface form shifts. The rationale also serves as P2's deletion test:
if you can't state the rationale, the rule is a candidate for prune.

**Checklist.**
- [ ] Every `must` / `never` / `always` rule names its failure mode in
      one line.
- [ ] Rationale is concrete ("corrupts state with no rollback"), not
      abstract ("be safe").
- [ ] No rule cites authority ("per Liu 2023"); the model does not
      verify citations.

### P6 — Scoped cross-cutting + negative/positive pairing

Cross-cutting rules (those that apply across many sections) name their
scope explicitly: when they activate, when they go inert. Negative rules
("don't X") are paired with a positive replacement ("do Y instead").

**Rationale.** A negative without a positive leaves the model with no
forward path — it knows what *not* to do but not what *to* do, so it
picks something adjacent and equally wrong. Pairing forces the prompt
author to surface the intended path.

**Checklist.**
- [ ] Cross-cutting rules name `when active` and `when inert` scopes.
- [ ] Every `don't X` rule has a paired `do Y` (or explicit "halt and
      ask the user" when no Y exists).
- [ ] No "always be careful with"-style untargeted warnings.

### P7 — Consistent structural markers

Headers use `#` levels consistently (one `#` per concept level, not
mixed with bold for the same kind of content). Worked examples in
`<example name="…">` blocks. Lists vs prose follow a consistent rule
per section type.

**Rationale.** Models pattern-match on structure as much as content.
Consistent markers let the model navigate the prompt as a graph of
sections; mixed markers force linear re-read and miss section boundaries.
`<example>` blocks specifically prevent the model from treating example
content as instructions.

**Checklist.**
- [ ] No `## Foo` adjacent to `**Foo**` for the same concept level.
- [ ] Every worked example in `<example name="…">` blocks.
- [ ] Tool / command names in backticks, prose in plain text.

### P8 — Example diversity not coverage

3 examples that cover the failure space > 7 near-duplicates of the
same case. Each example must change the model's behaviour from another
— if two examples produce the same output, one is dead weight.

**Rationale.** Examples teach by contrast. N examples of "happy path"
plus zero examples of "surprise mid-execution" leaves the model
unprepared for the latter. The fix is to choose examples that span the
behaviour space: trivial / happy-path / medium-with-surprise / long-
running / aborted.

**Checklist.**
- [ ] Each example differs from every other in at least one observable
      output dimension (decision, tool call, abort).
- [ ] No two examples could be deleted as equivalent.
- [ ] At least one example covers a failure / abort / surprise case.

### P9 — Vendor-split tuning

Tuning rules differ by target model family:

- **Claude 4.x:** Adaptive thinking is native. Note "the model thinks
  adaptively when the task warrants" — do not impose explicit
  Reason → Plan → Act triads. Claude pattern-matches `<thinking>` as
  scaffolding; do not require it as audit trail (see P12b).
- **GPT-4.x:** Include explicit triad — "Reason: …\nPlan: …\nAct: …" —
  before tool calls in long missions. GPT-4.x benefits from
  externalised intermediate state.
- **Mixed:** Mark sections with `[claude]` / `[gpt]` headers when the
  guidance diverges. Default to Claude shape; note GPT additions.

**Rationale.** The two model families respond to different scaffolds.
A GPT triad on a Claude prompt wastes tokens and trains the model to
emit visible reasoning that wasn't asked for. A bare Claude prompt on
GPT-4.x risks under-planning on multi-step tasks.

**Checklist.**
- [ ] Target model family declared (clarify-step output).
- [ ] If Claude: no GPT triad scaffolding.
- [ ] If GPT: explicit triad for multi-step tool sequences.
- [ ] If mixed: divergent sections marked.

### P10 — Tool boundary lines

For each tool exposed to the agent, name what it's for and what it's
*not* for in one line. Boundaries prevent the agent from reaching for
an adjacent-but-wrong tool when the right one is more typing.

**Rationale.** Tools that overlap (e.g. `bash grep` vs the dedicated
`Grep` tool, `bash find` vs `Glob`, `read` vs `bash cat`) get conflated
without boundary lines. The cost is tool sprawl in traces and missed
performance / safety benefits of the specialised tool.

**Checklist.**
- [ ] Every exposed tool has a one-line "for X; not for Y" statement.
- [ ] Adjacent-but-wrong tools explicitly steered against (e.g. "never
      bash find/grep; use Glob/Grep").
- [ ] No tool listed without a boundary.

### P11 — Doctrine pointer in handoff sections

Cross-agent handoff sections cite the doctrine line they implement
(file:line, not "see the docs"). When the handoff grammar changes,
the cite anchors the trace back to the canonical rule.

**Rationale.** Handoff sections accumulate "wait, why is this field
called X?" drift over time. A doctrine pointer turns archaeology into
a single read. It also creates a back-pressure on doctrine drift: if
the cited line moves, the handoff section breaks visibly.

**Checklist.**
- [ ] Each handoff field cites the doctrine source
      (`opencode/AGENTS.md:NNN` or similar).
- [ ] Citation is file:line, not "see AGENTS.md".
- [ ] Handoff grammar verbatim from doctrine, not paraphrased.

### P12 — Freeze marker discipline

Two sub-principles:

- **P12a — Evidence-cited churn.** Changes to a frozen prompt require
  cited trace evidence (a real session where the current shape caused
  a failure). Taste-only reformatting is refused.
- **P12b — `<thinking>` is scaffolding, not audit.** `<thinking>` blocks
  in Claude prompts are inference scaffolding the model emits to itself.
  They are not an audit trail and must not be cited as such. If audit
  is needed, register it as evidence: bd bead with body in `description`
  (Bucket A) for cross-agent durability; `.ooda/` is only the narrow Tier-2
  escape hatch described in `opencode/AGENTS.md` § Beads.

**Rationale.** Once a prompt works, reformatting it for aesthetic
preference (Sclar 2023's "prompt-format thrash") regresses performance
more often than it improves. The freeze marker is the gate; the
evidence is the key. P12b prevents a common misreading where operators
treat the model's internal scratch as a log.

**Checklist.**
- [ ] Frozen sections marked (e.g. `<!-- Grammar frozen: … -->`).
- [ ] Any change PR cites at least one trace excerpt as
      counter-factual.
- [ ] `<thinking>` blocks not relied on for audit; cross-agent audit goes to
      a bd evidence bead.

---

## Cross-surface table

How P1–P12 weight differs by the prompt's surface (turbo's `surface`
clarify-step):

| Surface | P1 weight | P2 weight | P4 weight | P9 application | Output destination default |
|---|---|---|---|---|---|
| `standing` (full agent prompt, > 100 lines) | high | high | high | full per target | `both` (artefact + inline) |
| `handoff` (terse routing message, < 50 lines) | low | medium | low | minimal | `inline` |
| `skill` (loadable SKILL.md with probe-then-fallback) | medium | high | medium | mixed (skill may run on multiple model families) | `artefact` |

**Weight semantics.** `high` = principle is load-bearing for this
surface, must apply. `medium` = applies when source shows the failure
mode. `low` = skip unless source explicitly violates. `minimal` = the
surface itself is too small for the principle to matter.

---

## Tensions table

When two principles point in different directions, resolve as follows:

| Tension | Resolution |
|---|---|
| P1 (tail anchoring) vs P4 (compaction trigger) | Place compaction trigger *before* the tail. Tail rules survive prune. |
| P5 (rationale) vs P2 (prune dead rules) | Rationale is the deletion test: if you can't state it, the rule is a P2 candidate. |
| P8 (example diversity) vs P7 (structural consistency) | Examples vary in content; their structural shape (`<example name="…">`, bullet lists, etc.) stays consistent. |
| P6 (negative/positive pairing) vs P5 (rationale required) | The positive replacement is itself the rationale's natural form ("don't X because failure-mode Y; do Z to avoid Y"). |
| P3 (evidence extraction) vs P11 (doctrine pointers) | Doctrine pointers are not evidence — they're citations. P11 stays inline; P3 still extracts logs/traces/dumps. |
| P9 vendor split vs P7 consistency | Within a vendor section, structure stays consistent. Cross-vendor sections may diverge in shape if shape itself differs (e.g. Claude omits triad markers GPT requires). |
| P12 (freeze) vs P2 (prune dead rules) | A dead rule with a freeze marker still needs cited evidence to remove. Freeze beats prune until trace evidence accumulates. |

---

## Dead-letter table

Common patterns that historically lived in prompts but no longer earn
their keep. Candidates for P2 deletion unless cited evidence justifies
retaining them.

| Pattern | Why dead | What to do instead |
|---|---|---|
| "Be helpful and harmless" / "Be thoughtful" | Unobservable; no failure mode named | Name a concrete failure mode (P5) |
| "Think step by step" on Claude 4.x | Adaptive thinking is native | Omit on Claude; keep on GPT-4.x (P9) |
| Citing prompt-engineering papers (Liu 2023, Sclar 2023, Wei 2022) inside the prompt | Model does not verify citations; pure decoration | Omit citation; keep the principle if it earns its keep |
| "Pay attention to the instructions" | Meta-rule with no failure mode | Delete; if attention is a real failure, restructure with P1 |
| "Use chain-of-thought reasoning" | Conflated with `<thinking>`; not an audit signal (P12b) | If reasoning is needed, name the decision points; do not require visible CoT |
| Restating the user's question before answering | Wastes tokens; trains verbose openings | Skip restatement unless ambiguity demands it |
| "I will now …" / "Let me …" pre-action narration | Filler; pattern-matched as politeness | Just act (per `opencode/AGENTS.md` § Communication style) |
| Generic "follow best practices" | Unscoped; means nothing | Name the specific practice and its failure mode (P5, P6) |
| `<thinking>` blocks cited as audit trail | Scaffolding, not log (P12b) | Cross-agent audit goes to bd evidence beads |
| Long preamble before the load-bearing rules | Buries the signal (P1 violation) | Move rules to tail; restate at top if body > 5k tokens |

---

## Worked rewrites

<example name="standing-prompt-claude">
**Before** (excerpt, 600-line agent prompt for Claude 4.7 executor):

```
... [200 lines of role description] ...

Always think step by step using <thinking> blocks before acting.
Pay attention to all instructions carefully. Be helpful.

... [more prose] ...

CRITICAL: Never run destructive operations without a dry-run first.
(This appears once at line 240; no rationale.)

... [400 more lines] ...
```

**After:**

```
# Final instructions

- Never run destructive operations without dry-run first. Rationale:
  destructive ops corrupt state with no rollback path; dry-run surfaces
  intent before commitment. (driver: P1, P5)

... [load-bearing rules collected here] ...
```

Plus, at the top (body > 5k tokens):

```
# Recency anchor

The full instructions are at the tail under `# Final instructions`. The
single rule that matters most: no destructive ops without dry-run.
```

**Changelog:**
- Moved dry-run rule to tail and restated at top (driver: P1).
- Added rationale: "corrupts state with no rollback" (driver: P5).
- Deleted "always think step by step" — Claude adaptive thinking is
  native (driver: P9, dead-letter).
- Deleted "be helpful" — unobservable (driver: P2, dead-letter).
- Deleted "pay attention to all instructions" — meta-rule, no failure
  mode (driver: P2, dead-letter).

**Self-audit:**
- P1  [x] anchored at tail; restated at top (body > 5k tokens)
- P2  [x] 3 dead rules removed (named above)
- P3  [ ] deferred — source had no inlined evidence to extract
- P4  [x] compaction trigger named before tail
- P5  [x] dry-run rule carries rationale
- P6  [x] "never destructive without dry-run" paired with "always dry-run first"
- P7  [x] consistent `#` headers; rule in bullet list, not bold
- P8  [ ] no example changes (rewrite scope was rule consolidation)
- P9  [x] Claude target → no GPT triad
- P10 [ ] deferred — source didn't expose tool list
- P11 [ ] deferred — no handoff sections in source
- P12 [x] freeze marker not yet added (post-rewrite hand-off)
</example>

<example name="handoff-line">
**Before** (40 lines):

```
Hello executor, please find below the details of the task I'd like
you to handle. The researcher has completed the investigation and
identified that the issue lies in the orders module's pagination
logic. Specifically, the off-by-one error occurs when... [25 more
lines of context]
```

**After** (8 lines):

```
→ to: hopper
  objective: fix off-by-one in list_orders pagination
  success_criteria: cargo test -p orders passes (incl new regression test)
  rollback: git checkout -- crates/orders/src/list.rs
  artefact: bd-NNN
  commander_intent: half-open range discipline (per ADR-0014)
  abort_if: regression test cannot reproduce on main
```

**Changelog:**
- Collapsed prose narrative to terse-structured-text grammar (driver: P2, P7).
- Replaced 25-line evidence dump with `artefact:` pointer (driver: P3).
- Added `commander_intent:` and `success_criteria:` (driver: P11).
- Named verify command concretely, not "run tests" (driver: P10).
- Cited ADR-0014 as doctrine source (driver: P11).

**Self-audit:**
- P1  [ ] N/A — surface too small
- P2  [x] removed 32 lines of dead prose
- P3  [x] evidence extracted to bd evidence bead
- P4  [ ] N/A — handoff is one-shot, no compaction
- P5  [x] no `must` rules in surface; N/A
- P6  [x] `abort_if` paired with positive criteria
- P7  [x] consistent field grammar
- P8  [ ] N/A — handoff, not example block
- P9  [x] minimal vendor application — none needed
- P10 [x] verify command named concretely
- P11 [x] doctrine pointer (ADR-0014) cited
- P12 [x] handoff grammar verbatim from `opencode/AGENTS.md`
</example>

---

## Re-running this recipe

Turbo reads this file once per invocation (workflow step 1). When you
update a principle here:

1. Update the matching citation in `opencode/agents/turbo.md` in the
   same commit (turbo.md line 20 mandates this).
2. Add the trace evidence that motivated the change to the commit
   message (P12a).
3. If the change affects a dead-letter table entry, audit existing
   prompts under `opencode/agents/*.md` for the pattern.

Do not edit P2 or P4 without first checking whether the
`[EVIDENCE GAP]` markers can be removed — the next real turbo
invocation should surface concrete content for them.
