---
name: wayfinder
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map of decision tickets in bd, and resolve them one at a time until the way to the destination is clear. Use when the user wants to chart a map for a big fuzzy effort, or to work through an existing wayfinder map.
---

# Wayfinder

> **Provenance.** Ported from mattpocock/skills
> (https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder).
> Adapted: bd (`.beads/`) replaces the tracker abstraction and its
> `/setup-matt-pocock-skills` provisioning step; `skills/grill-me` replaces
> `/grilling`; `copernicus` (via Task) replaces the `/research` subagent;
> `/domain-modeling` and `/prototype` have no analogue here (see Gaps).
> Every bd command below was verified in this repo before landing: `bd
> create --help`, `bd dep add --help`, `bd ready --help`, `bd assign --help`,
> `bd comment --help`, `bd children --help`, `bd update --help`, `bd close
> --help`, `bd show --help`, `bd delete --help`. The frontier/parentage
> claim — that `--parent`-only linkage surfaces in `bd ready --parent`, that
> a blocking edge drops a ticket out of it, and that claiming does too — was
> confirmed by an executed round-trip against throwaway beads, not inferred
> from help text (see `config-7h7`).

A loose idea has arrived — too big for one agent session, and wrapped in
fog: the way from here to the **destination** isn't visible yet. Wayfinding
is about finding that way, not charging at the destination. This skill
charts the way as a **shared map** in bd, then works its **decision
tickets** — questions whose resolution is a decision, not slices of a build
to execute — one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of
charting — it shapes every ticket. It might be a spec to hand off and
iterate on, a decision to lock before planning starts, or a change made in
place like a data-structure migration. The map is domain-agnostic —
engineering work, course content, whatever fits the shape.

## Boundary vs the OODA fleet

Wayfinder is **multi-session decision discovery under fog** — it exists
because the question "what should we even decide, and in what order" does
not fit in one context window. It is not the other planning apparatus in
this fleet:

- **moltke** commands *execution* of an already-decided mission (contract +
  pre-mortem + rollback). Route to moltke once a wayfinder ticket resolves
  into a concrete, shippable mission — not before.
- **feynman** orients on a *diagnosed* problem with a bounded hypothesis set.
  Route to feynman when a single ticket's resolution is genuinely
  multi-hypothesis and needs falsifiers, not when the whole map is still fog.
- **plan mode** is single-session planning. Route there when the fuzzy idea
  turns out to fit in one session — see step 2 of Chart the map below.

Rule for future sessions: if the ask is "figure out what we're even deciding,
across more than one session" → wayfinder. If the ask is "execute this
already-decided thing" → moltke. If unsure which, default to wayfinder's
step 2 (map the frontier); an empty frontier means the fog was thin enough
for plan mode or moltke directly.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and
the map is done when the way is clear — nothing left to decide before
someone goes and does the thing. The pull to just do the work is usually the
signal you've reached the edge of the map and it's time to hand off. An
effort can override this in its **Notes** — carrying execution into the map
itself — but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket is a bd bead, so it has a **name** — its title. In
everything the human reads — narration, the map's Decisions-so-far — refer
to it by that name, never by a bare bead id. A wall of `config-a1`,
`config-b2`, `config-c3` is illegible; names read at a glance. The id
doesn't vanish — a name wraps its `bd show <id>` reference — but it rides
*inside* the name, never stands in for it.

## Current state only

The map states **what is true now**. It is not a chronicle of how it got
there. When a later decision changes an earlier one, **overwrite the
earlier text in place** — never append a correction beside the thing it
corrects.

This is *the map is an index, not a store* applied across time rather than
across tickets: a fact lives in exactly one place, and that place holds the
current version of it.

The named practice is **defensible deletion** — data cleansing, or
maintaining a single source of truth by overwriting and in-place update.
Framed as an intentional policy to purge stale states it belongs to active
data lifecycle management. It is deletion *with* a policy, not carelessness.

**Why it earns its keep.** A correction gets marked; the text it corrects
usually does not. A reader skimming for the rule hits the dead one and has
no way to tell. The failure is silent, and it compounds — every supersession
left in place is one a later reader must adjudicate with less context than
whoever wrote it had.

**The test.** Would a reader of *only this sentence* get the current state
right? If no, rewrite the sentence rather than annotate it.

**Rewrite, don't annotate:**

| Instead of | Write |
|---|---|
| "X was Y — SUPERSEDED — it is now Z" | "X is Z" |
| "the form below is superseded by this paragraph" | delete the form below |
| "Still rejected: A. Still unadopted: B." | nothing — unless the refusal is a rule, then state the rule |
| a ledger of which old records this one supersedes | one pointer, plus the rule governing the edge |
| an erratum fixing a typo, date, or anything with no semantic content | fix it in place; add nothing |

**Where displaced history goes.** Nothing is deleted without a home:

- **Why a decision was made, and what it replaced** — the ticket's
  resolution comment, and an ADR where the effort keeps one. The decision
  log is the chronicle; the map is not.
- **A rejected option whose reason prevents re-proposal** — keep it, but as
  a *rule* in the destination artifact ("enforce-once-in-core is unsound
  because the loser's cached value passes its own check"), not as a
  rejection register in the map. A bare "rejected" without its reason
  invites a rerun and is worth less than nothing.

**Append-only stores are the exception that proves the rule.** Where a
correction cannot overwrite — bd comments cannot be edited, close reasons
cannot be amended — an erratum is the only honest fix, so keep it minimal
and say plainly that it is spent. That constraint argues for being ruthless
everywhere overwriting *is* possible; it is not a licence to annotate by
default.

## The map

The map is a single bd **epic** (`bd create "<destination title>" --type
epic --labels wayfinder:map`) — the canonical artifact. Its tickets are
child tasks: `bd create "<title>" --type task --parent <map-id> --labels
wayfinder:<type>`.

The map is an **index**, not a store. It lists the decisions made and
points at the tickets that hold their detail; a decision lives in exactly
one place — its ticket — so the map never restates it, only gists it and
links (by name).

### The map body

The whole map at low resolution, loaded once per session via `bd show
<map-id>`. Open tickets are **not** listed in the body — they are open
child tasks, found by `bd ready --parent <map-id> -u` (frontier) or `bd
children <map-id>` (all children).

The map epic's description holds:

```
## Destination

<what reaching the end of this map looks like — the spec, decision, or
change this effort is finding its way to. One or two lines; every session
orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult (e.g. grill-me); standing
preferences for this effort>

## Decisions so far

<!-- the index — one line per closed ticket -->
- [<closed ticket title>](bd show <id>) — <one-line gist of the answer>

## Not yet specified

<!-- fog of war: in-scope, not yet sharp enough to ticket -->

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->
```

Update it with `bd update <map-id> --stdin` (pipe the revised description
in; never write it to a scratch file first — see AGENTS.md § Beads).

### Tickets

Each ticket is a **child bd task** of the map epic, wired by the `--parent`
flag at create time. `bd dep add` is reserved solely for blocking edges
between tickets (see below) — it defaults to a `blocks` edge, not
parent-child, so it must never be used to wire parentage. The bead id is
its identity. Its description is the question, sized to one session:

```
## Question

<the decision or investigation this ticket resolves>
```

Each ticket carries a `wayfinder:<type>` label — one of `research`,
`prototype`, `grilling`, `task` (see Ticket Types).

A session **claims** a ticket by `bd assign <id> <assignee>` — assigning it
to the dev driving the map, **first**, before any work, so concurrent
sessions skip it (`bd ready --parent <map-id> -u` only surfaces
unassigned tickets). That assignee *is* the claim: `bd assign <id> ""`
unassigns.

Blocking uses `bd dep add <blocked-id> --blocked-by <blocker-id>` (bd's
native dependency edge). A ticket is **unblocked** when every ticket
blocking it is closed; the **frontier** is `bd ready --parent <map-id> -u`
— the open, unblocked, unclaimed children.

The answer isn't part of the description — it's recorded on resolution (see
Work through the map) as a **resolution comment** (`bd comment <id> "text"`)
then `bd close <id> --reason "<gist>"`. Assets created while resolving a
ticket are linked from the ticket (by name + `bd show` reference), not
pasted in.

## Ticket Types

Every ticket is either **HITL** — human in the loop, worked *with* a human
who speaks for themselves — or **AFK**, driven by the agent alone. A HITL
ticket only resolves through that live exchange; the agent never stands in
for the human's side of it (an agent that answers its own grilling
questions has broken this).

- **Research** (AFK): reading documentation, third-party APIs, or local
  resources to surface a fact a decision waits on. Resolved by dispatching
  **copernicus via Task**; findings land in a bd evidence bead
  (`--labels evidence,mission:<map-id>`), and the ticket's resolution
  comment links that bead id — not a throwaway branch.
- **Prototype** (HITL): raise the fidelity of the discussion by
  hand-making a cheap, rough, concrete artifact to react to — an outline,
  a rough take, a stub. No skill call exists for this in this fleet; make
  the artifact directly and link it from the ticket. Use when "how should
  it look" or "how should it behave" is the key question.
- **Grilling** (HITL): conversation. The default case. Invoke
  `skills/grill-me` (opt-in per AGENTS.md § Conditional capabilities — load
  it explicitly for this ticket rather than assuming it auto-fires).
- **Task** (HITL or AFK): manual work that must happen before a *decision*
  can be made — nothing to decide, prototype, or research, but the
  discussion is blocked until it's done. This is the one type that *does*
  rather than decides — and it earns its place by unblocking a decision,
  not by delivering the destination. The agent drives it alone where it
  can (AFK); otherwise it hands the human a precise checklist (HITL).
  Resolved when the work is done; the resolution comment records what was
  done and any resulting facts later tickets depend on.

## Fog of war

The map is *deliberately* incomplete: don't chart what you can't yet see.
Beyond the live tickets lies the **fog of war** — the dim view of decisions
and investigations you can tell are coming but can't yet pin down, because
they hang on questions still open. Resolving a ticket clears the fog ahead
of it, graduating whatever's now specifiable into fresh tickets — one at a
time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written
down: the suspected question, the area to revisit later. It's the
undiscovered frontier *toward* the destination — everything here is in
scope, just not sharp enough to ticket.

**Fog or ticket?** The test is whether you can state the question precisely
now — *not* whether you can answer it now.

- **Ticket when** the question is already sharp — even if it's blocked and
  you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't
  pre-slice the fog into ticket-sized pieces: it's coarser than a ticket,
  and one patch may graduate into several tickets, or none, once the
  frontier reaches it.

**Not yet specified** excludes what's already decided (Decisions so far),
what's already a live ticket, and what's out of scope (the next section).

## Out of scope

Fog only ever gathers *toward* the destination. The destination fixes the
scope, so work beyond it is **out of scope** — it isn't fog, and it doesn't
belong in **Not yet specified**. It gets its own **Out of scope** section on
the map: work you've consciously ruled out of *this* effort. Scope, not
sharpness, lands it here.

Out-of-scope work never graduates — the frontier stops at the destination —
so it returns only if the destination is redrawn, and then as a fresh
effort, not a resumption.

When a ticket that already exists turns out to sit past the destination —
mis-scoped in while charting, or exposed by a resolution — **close it**
(`bd close <id> --reason "out of scope: <why>"`) and leave one line in the
**Out of scope** section: the gist plus why, linking the closed ticket by
name. It stays out of **Decisions so far**, which records the route
actually walked — a scope boundary isn't a step on it.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session** —
with the exception of research tickets.

### Chart the map

User invokes with a loose idea.

1. **Name the destination.** Load `skills/grill-me` to pin down what this
   map is finding its way to — the spec, decision, or change. The
   destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out
   across the whole space rather than deep on any one thread, surfacing the
   open decisions and the first steps takeable now. **If this surfaces no
   fog** — the way to the destination is already clear, the whole journey
   small enough for one session — you don't need a map. Stop and ask the
   user whether plan mode or a direct moltke mission fits better.
3. **Create the map**: `bd create "<destination title>" --type epic
   --labels wayfinder:map --description "<Destination + Notes filled in,
   Decisions-so-far empty, fog sketched into Not yet specified>"`.
4. **Create the tickets you can specify now** as child tasks (`bd create
   "<title>" --type task --parent <map-id> --labels wayfinder:<type>`) —
   then wire blocking edges in a **second pass** (`bd dep add <blocked>
   --blocked-by <blocker>`; tickets need ids before they can reference each
   other). Wiring sorts them into the frontier and the blocked; everything
   you can't yet specify stays in the fog — the **Not yet specified**
   section.
5. **Fire the research tickets.** For each research ticket just created,
   dispatch copernicus via Task to resolve it, capturing findings in a bd
   evidence bead and linking its id from the ticket.
6. Stop — charting is one session's work; it hand-resolves nothing.

### Work through the map

User invokes with a map (name or bead id). A ticket is **optional** —
without one, you pick the next decision, not the user.

1. Load the **map**: `bd show <map-id>` — the low-res view, not every
   ticket body.
2. Choose the ticket. If the user named one, use it. Otherwise take the
   first frontier ticket: `bd ready --parent <map-id> -u`. **Claim it**:
   `bd assign <id> <assignee>` before any work.
3. Resolve it — **zoom as needed**: `bd show <id>` for the full body of any
   related or closed ticket on demand; invoke the skills the map's Notes
   block names. If in doubt, load `skills/grill-me`.
4. Record the resolution: `bd comment <id> "<answer>"`, then `bd close <id>
   --reason "<gist>"`, and append a context pointer (the ticket's name +
   id) to the map epic's Decisions-so-far (`bd update <map-id> --stdin`).
5. Add newly-surfaced tickets (create-then-wire, as in Chart step 4);
   graduate any fog the answer has made specifiable, clearing each
   graduated patch from **Not yet specified** so it lives only as its new
   ticket. If the answer reveals a ticket — this one or another — sits
   beyond the destination, **rule it out of scope** (see Out of scope)
   rather than resolving it on the route. If the decision invalidates other
   parts of the map, update or close those tickets.
6. **Purge what the answer superseded** (see Current state only). Any Notes
   entry, Decisions-so-far line or standing constraint the decision has
   changed is **rewritten in place**, not annotated — the map must read as
   current truth when the next session loads it. Anything worth keeping
   about the superseded version belongs in this ticket's resolution
   comment, which is where the chronicle lives.

The user may run unblocked tickets in parallel, so expect other sessions to
be editing bd concurrently.

## Gaps

Two upstream skills have no analogue in this fleet and were not ported as
new skills (out of scope for this port):

- **`/domain-modeling`** — upstream always paired this with `/grilling`
  when naming the destination and mapping the frontier. Folded into the
  grill-me pass above; a dedicated domain-modeling skill is a follow-up,
  not part of this port.
- **`/prototype`** — the **Prototype** ticket type is preserved (it is
  doctrine), but there is no skill call behind it here: making the
  prototype is manual, hand-done work per the Ticket Types section above.
  A dedicated prototype-scaffolding skill is a follow-up, not part of this
  port.
