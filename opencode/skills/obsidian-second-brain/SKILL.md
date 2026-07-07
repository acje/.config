---
name: obsidian-second-brain
description: "Read-only navigation of an obsidian-second-brain-style Obsidian vault (PARA-style People/Projects/Daily/Ideas/Research folders, frontmatter, bi-temporal facts) — detect vault conventions, search, summarize, and answer questions about vault contents. Vault path comes from OBSIDIAN_VAULT_PATH env or an explicit argument, never hardcoded. Use when the user asks to read, search, or summarize an Obsidian second-brain vault, or asks how to integrate obsidian-second-brain with this fleet. Write mode is a separately documented user opt-in; this skill performs no vault writes."
---

# obsidian-second-brain (read-only)

> **Provenance.** Fleet-native curated skill teaching agents to READ an
> `eugeniughelbur/obsidian-second-brain`-style vault. This is not the
> vendor's own skill/adapter — that ships 44 slash-commands, an optional
> MCP server, and an OpenCode build-time adapter that writes generated
> files into the vault itself. None of that is vendored, cloned, or run
> here; see Out of scope below. Evidence: bd `config-678` (repo
> characterization), bd `config-p2v` (integration orientation).

## What this is for

Curated read/search/summarize workflow for a personal Obsidian PKM
vault that follows, or approximates, the obsidian-second-brain
conventions. Route vault questions here instead of guessing vault
structure from training data — vendor conventions vary release to
release, and any given user's vault may deviate from the reference
shape below.

## Vault conventions — detect, don't assume

Reference shape (bd `config-678`, vendor's own "Vault Architecture"):

| Folder | Purpose |
|---|---|
| `People/` | one note per person; bi-temporal fact frontmatter (below) |
| `Projects/` | project notes |
| `Daily/` | daily notes, one per date |
| `Ideas/` | freeform idea capture |
| `Research/` | research / reading notes |

Treat this table as a hypothesis, not a given. Before answering any
question about a specific vault:

1. Resolve the vault path (see below).
2. `glob "<vault>/*"` (top level only) to see which of the above folders
   actually exist, plus anything else — the vendor's own layout also
   has `Boards/`, `Reviews/`, `Tasks/`.
3. Sample one file per present folder and `read` its first ~20 lines to
   check the actual frontmatter shape before assuming any specific key
   exists.

**Bi-temporal facts.** Person-notes may carry frontmatter arrays
tracking a fact over time — e.g. job history as company + role +
start/end dates. This is an append/reconcile log, not a flat
current-value field. When summarizing a person-note, preserve the
timeline; don't report only the most recent entry as if it were the
only fact on record.

**Lexical-search caveat.** The vendor's own retrieval eval reports its
default search as term-frequency, title-weighted lexical ranking that
scored 0% recall@10 on paraphrased questions against a 1,000+ note
vault (bd `config-678`, Q5). Don't assume semantic/paraphrase recall —
this fleet doesn't wire the vendor's search or MCP server anyway (Out
of scope, below). Use `grep`/`glob` directly against the vault path,
try more than one literal phrasing of a query, and read matched notes
rather than trusting rank order alone.

## Vault path — never hardcode

Resolve in this order:

1. `OBSIDIAN_VAULT_PATH` env var, if set — the same variable name the
   vendor's own MCP server reads (bd `config-678`, Q3), kept for
   consistency.
2. Else, an explicit path argument passed by the caller/user.
3. Else: stop and ask for the vault path. Do not guess a default (e.g.
   `~/vaults/brain`, `~/Documents/...`) — a wrong guess risks reading an
   unrelated directory, and per AGENTS.md § Bash hygiene any path not
   already observed this session must be preflighted before use.

## Read / search / summarize workflow

| Task shape | Route to |
|---|---|
| Broad multi-file survey ("what's in my vault about X", cross-note evidence gathering) | `copernicus` — pure sensor, no hypotheses; matches its Observe role |
| Single-file or narrow lookup ("what does my Q3 project note say") | inline `read`/`grep`, no subagent dispatch needed (trivial autonomy) |
| "How do I integrate obsidian-second-brain further?" | Point back at this skill's Write mode and Relationship-to-graphify sections; don't improvise a new integration shape inline |

Steps, either route:

1. Resolve the vault path (above).
2. `glob` the top-level structure to detect actual conventions (previous
   section) — don't assume the reference shape holds.
3. `grep` the vault for search terms. Treat `[[wiki-links]]` as plain
   grep targets — no live Obsidian graph/backlink API is queried.
4. `read` matched files; cite `path:line` per house style; respect
   bi-temporal frontmatter when summarizing a person or a fact.
5. If asked to save/update/capture/write anything into the vault: stop.
   This skill is read-only. Point at "Write mode (opt-in)" below;
   do not attempt the write and do not edit `opencode.json`.

## Write mode (opt-in)

Read-only by default. To let a fleet agent WRITE into your vault, you
must opt in explicitly:

1. Add an allow rule for your vault path to `opencode/opencode.json`'s
   `external_directory` block (today at `opencode.json:136-138`, which
   ships with only `~/tmp/**` allowed):

   ```jsonc
   "external_directory": {
     "~/tmp/**": "allow",
     "<your-vault-path>/**": "allow"
   }
   ```

2. **Security implication.** This grants every fleet agent write access
   to every file under `<your-vault-path>/**` for the rest of the
   session — not scoped to this skill, not scoped to a single
   invocation. A prompt-injected note (e.g. an adversarial instruction
   embedded in a captured web clip) or an ordinary agent bug could
   silently rewrite or delete vault content with no further
   confirmation, because the path is now pre-authorized. Treat the
   grant with the same weight as trusting the fleet to run `rm -rf`
   inside that tree.
3. Without this edit, a write attempt raises the `external_directory`
   ask-prompt — and because most fleet execution is headless (subagent
   tasks, hopper missions), nobody is present to answer it, so the
   agent hangs forever (AGENTS.md § Permission-ask-hang). Read-only by
   default is a consequence of that gate, not an arbitrary restriction.
4. This skill never performs step 1 itself, and no mission run under it
   may either. Only the user makes this edit, deliberately, outside any
   mission contract.

## Relationship to graphify

Orthogonal, lightly complementary — not superseded, not reused (bd
`config-p2v`). The two skills touch at exactly one point: both *can*
emit markdown into an Obsidian vault directory (graphify: `export
obsidian --obsidian-dir <path>`; obsidian-second-brain: any vault-write
command, none of which this skill runs). They diverge in what they
project and who owns the vault: graphify writes a disposable,
regenerated code/knowledge-graph projection — one node per
symbol/community, derived from source and safe to delete and rebuild;
obsidian-second-brain operates a human-authored PKM vault (`People/`,
`Projects/`, `Daily/`) as the source of truth the human curates by
hand. Do not co-mingle the two by default — pointing graphify's
node-per-symbol dump at a human's PKM vault would bury it under
hundreds of derived files. The one legitimate overlap is user-initiated:
someone who explicitly wants their code graph inside their PKM vault
can already point graphify's `--obsidian-dir` at it, and
obsidian-second-brain's own search would then index those files too —
but that is a deliberate user choice, not a default of either skill.

## Out of scope (this skill does not)

- Vendor, fork, or clone the `eugeniughelbur/obsidian-second-brain` repo.
- Wire the vendor's optional MCP server
  (`integrations/obsidian-mcp-server/`).
- Port the vendor's full 44-command surface — this is a curated read
  subset only.
- Run the vendor's `scripts/build.sh`, or copy its generated adapter
  output into any vault.
- Edit `opencode/opencode.json`, or perform any vault write, under any
  circumstance — including when asked to enable write mode (see above:
  that edit is the user's own action, never this skill's).

## Evidence

- bd `config-678` — repo characterization (vault conventions,
  44-command inventory, MCP server shape, lexical-search caveat).
- bd `config-p2v` — integration orientation (write-permission-gate
  analysis, graphify reconciliation).
