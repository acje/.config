---
name: rust-dep-intake
description: Secure intake procedure for Rust/cargo dependency changes — gates build-time code execution (build.rs, proc-macros, build-dependencies) behind a mandatory source read. Tiered: cheap non-executing triage always, deep source review only when triage flags. Use when the user says "update dependencies", "cargo update", "bump a crate", "add a dependency", "new dependency", "is this crate safe", "vet a crate", "review build.rs", "cargo deny says yanked", "yanked crate", "supply chain", or when a dependency gate (cargo-deny / cargo-audit / renovate / dependabot) has fired on a Rust project.
---

# Rust Dependency Intake

Applies to any Rust/cargo project. It governs the moment a dependency enters or
moves in `Cargo.lock`.

## The one rule that governs everything

**No command that can execute a dependency's code runs until the build-time
surface of the closure delta has been read.**

`cargo build`, `check`, `test`, `clippy`, `doc`, `run` and `cargo package`
(without `--no-verify`) compile and execute every `build.rs` and proc-macro in
the resolved graph. That execution is arbitrary code, running as you, before any
test asserts anything. Everything below exists to put a read between the lock
change and that execution.

## The prohibition

> **DO NOT run `cargo build` / `check` / `test` / `clippy` / `doc` / `run`
> "just to see if it still works" before T3 clears.**
>
> This is not a stylistic preference. It is the exact observed failure mode: in
> the arrayref incident (2026-08-20) the agents inferred the payload from the
> dependency closure and **never opened the build.rs**. The payload was
> build-time. A single `cargo check` would have run it.

`cargo package --no-verify` is safe; bare `cargo package` is not.

## Entry points

| Trigger | Enter at | Note |
|---|---|---|
| Routine bump (`cargo update`, renovate/dependabot PR) | T0 | Lock diff shape is the first signal |
| New dependency added (`cargo add`, manifest edit) | T0 | No prior version to diff — review the whole crate, not a diff |
| `cargo audit` / `cargo deny` fired (advisory) | T0 | Advisory tells you *a* problem, not *the* problem |
| **Yanked warning / `cargo deny` yanked failure** | **T0, with the interrupt below** | **Weaponised path** |
| Incident response (a crate you already ship is implicated) | T5 + rollback | Assume execution already happened |

### The yank interrupt

When the trigger is "this version is yanked", the reflex is *bump to newest*.
**Stop.** Yanking is publisher-controlled: an attacker holding the account can
yank the entire clean history so the only live version is the poisoned one. Your
supply-chain tooling then pushes you onto it — the gate becomes the delivery
mechanism. Worked example: `arrayref` 0.3.5–0.3.9 were yanked in the same
~40-second burst that published the poisoned 0.3.10 (config-ece R1).

Required response to a yank, in order:

1. Read the **yank census** for the crate (`references/triage-signals.md` §Y).
2. A *burst* yank of multiple historical versions with no stated reason is a
   `Halt`, not a bump. One old version yanked for a bug is normal churn.
3. Bumping to the newest live version is the **last** option. Pinning a
   yanked-but-known-good version is legitimate — see §Rollback.

## Tiers

Cheap triage runs always; expensive source review only on what triage flags.

| Tier | What | Executes dep code? |
|---|---|---|
| T0 | Freeze — capture `Cargo.lock` before anything moves | no |
| T1 | Closure delta — compute what actually changed | no |
| T2 | Triage signals — metadata-only checklist; **may HALT here** | no |
| T3 | **Build-time surface review — the gate** | no |
| T4 | Full source review — only for what T2/T3 flagged | no |
| T5 | Containment — only if execution is unavoidable and review did not clear | yes, contained |

### T0 — Freeze

```
git status --porcelain          # start clean, or know exactly what is dirty
cp Cargo.lock Cargo.lock.pre
```
`Cargo.lock.pre` is the rollback anchor and the delta baseline. Do this first;
after a resolve it is unrecoverable without VCS.

### T1 — Closure delta (non-executing commands only)

VERIFIED non-executing (config-ece R2, config-6sc G2 — G2 carried a positive
control that *did* detect execution when execution happened):

`cargo fetch`, `cargo metadata`, `cargo tree`, `cargo tree -i <crate>`,
`cargo vendor`, `cargo package --no-verify`, `cargo update`,
`cargo update --dry-run`, `cargo info <spec>`, `cargo add`, `cargo audit`,
`cargo deny check`.

VERIFIED executing — forbidden before T3: `cargo build`, `check`, `test`,
`clippy`, `doc`, `run`, and `cargo package` without `--no-verify`.

```
cargo update --dry-run                 # preview the resolve, nothing moves
cargo update                           # or the specific -p bump
diff -u Cargo.lock.pre Cargo.lock
git diff --stat -- Cargo.lock          # SHAPE first: insertions/deletions count
```

Read the **shape** before the content: a patch-level bump that inserts 33 lines
into `Cargo.lock` is itself the signal — in the arrayref case shape, not content,
was the tell (config-vur). Then read cargo's own stdout, which already prints
`Adding <crate> v<version>` for every new node.

Classify each changed node:

- **Added** — no prior version. Review the whole crate at T3/T4, not a diff.
- **Version-changed** — old→new source diff (`references/source-diff-recipes.md`).
- **Edge-changed** — same version, but it gained a new dependent, a new
  `build.rs`, or new `[build-dependencies]`. **Exactly as interesting as a new
  crate.** See §Open worries.

**Compute the delta over edges, not over node names.** `Cargo.lock` records a
`dependencies = [...]` array per package (VERIFIED), and cargo merges normal and
build dependencies into that one array — so a newly acquired
`[build-dependencies]` entry *is* visible in the lock diff even when the crate it
points at was already somewhere in the closure:

```
diff -u Cargo.lock.pre Cargo.lock | grep -E '^[-+] "'   # changed EDGES, not nodes
```

A node-name delta (`grep '^name = '` on both locks) is the wrong instrument: it
reports nothing when the attacker reuses crates already present. Run the edge
diff first; the node diff is a subset of it.

### T2 — Triage signals

Full checklist with how-to-observe commands: `references/triage-signals.md`.
Summary of what is checked, all metadata-only:

yank history shape and burst timing · publish-timestamp clustering ·
owner/publisher change and account age · new transitive deps, especially network
stacks (`ureq`/`reqwest`/`hyper`/`curl`/`rustls`/`native-tls`) and process/FS
crates · typosquat against **the project's own existing lock entries** ·
copied/verbatim descriptions · download-count asymmetry · missing/404/mismatched
repository link · version-number mimicry · lock-diff shape.

T2 can and should produce a `Halt` on its own. It is required to be able to: a
skill that only halts after deep review is a skill nobody runs.

### T3 — Build-time surface review (THE GATE)

Full procedure: `references/build-script-review.md`.

For every crate in the ADDED / CHANGED / EDGE-CHANGED set, enumerate and then
**read**:

1. every `build.rs`,
2. every `build = "..."` key in a manifest (a build script under any filename),
3. every `links = "..."` key,
4. every crate with `proc-macro = true` in `[lib]`,
5. every entry in `[build-dependencies]`.

Sources are obtained without executing anything: `cargo vendor`, the registry
cache under `~/.cargo/registry/src/`, or the published tarball
(`https://static.crates.io/crates/<name>/<name>-<version>.crate`).

`[build-dependencies]` is a first-class signal before a line of `build.rs` is
read: `proc-macro1` declared `base64`, `rustls` and `ureq` — a token-parsing
library needing an HTTP client at build time.

`arrayref` 0.3.10 itself had `build = false` and no build.rs; **the malicious
build-time surface was its dependency's.** Enumerate the closure, not the crate
you bumped.

### T4 — Full source review

Only on what T2/T3 flagged. Diff recipes: `references/source-diff-recipes.md`
(version-vs-version tarball diff; tarball-vs-upstream-git via
`.cargo_vcs_info.json`; the benign tarball-exclusive baseline).

### T5 — Containment

Only when execution is genuinely required and review did not clear.
Recipe: `references/containment.md`.

> **`cargo build --offline` is NOT a security control.** VERIFIED (config-6sc
> G1): a build script's own outbound socket connected identically with and
> without `--offline`. `--offline` constrains cargo's registry access only — no
> sandbox, no namespace, no seccomp for the build-script child process. Present
> it as a **reproducibility** control. Had arrayref 0.3.10 been built with
> `--offline`, proc-macro1's build.rs would still have reached its C2.

The verified containment primitive is `podman run --network=none` over a
pre-vendored tree (config-nfh G7). See the reference for the exact recipe and
its honest limits.

## Verdict

```rust
enum Intake {
    Clear,        // proceed to build/test
    Churn,        // benign but noisy; proceed, record what was noisy
    Investigate,  // T3/T4 required before any executing command
    Halt,         // stop; do not build; back-brief; rollback
}
```

| Verdict | Forced by |
|---|---|
| `Clear` | Closure delta empty or version-only, no build-time surface added or changed, T2 all-negative |
| `Churn` | Many nodes moved but every added/changed crate has no build.rs / no proc-macro / no `[build-dependencies]`, and T2 is negative. Version churn is not a finding. |
| `Investigate` | Any added or changed build-time surface (T3 list items 1–5), OR any single T2 signal positive, OR a lock-diff shape disproportionate to the version bump |
| `Halt` | Any of the hard-stop list below |

**Hard stops — `Halt` without judgement call:**

- A build script or proc-macro in the delta performs network access, spawns a
  process, writes outside `OUT_DIR`, or decodes an obfuscated blob
  (`references/build-script-review.md` red-flag catalogue).
- Multiple historical versions of a crate were yanked in one burst with no
  stated reason.
- An added crate's name is within one edit of a crate already in your lock file.
- An added crate pins to the exact version of a crate you already depend on.
- A crate's stated repository is 404, or the published tarball contains files
  absent from the upstream commit named in its own `.cargo_vcs_info.json`
  (beyond the three cargo-generated files).
- A patch/minor bump gives a crate a **build-time edge** to an HTTP/TLS stack —
  whether or not that crate is new to the closure. Re-use of a crate you already
  depend on elsewhere removes novelty, not the edge.
- Publisher identity changed, or the publishing account is younger than the crate
  it is publishing into (`arrayref`'s impersonator account was ~6 hours old).

Two independent hard stops is a confirmed finding, not a suspicion.

## Rollback

```
cp Cargo.lock.pre Cargo.lock                       # restore the frozen lock
cargo update -p <crate> --precise <known-good>     # or pin explicitly
```

**Hard case: the only clean version is itself yanked.** Exactly the arrayref
situation. Pinning a yanked version is legitimate: cargo uses a yanked version
when `Cargo.lock` names it explicitly — the yank removes it from *resolution*,
not from the registry. Restoring `Cargo.lock.pre` is therefore itself the fix.
Tolerate that one pin in your gate (an `[advisories] ignore` entry or explicit
exemption) rather than turning the yanked gate off wholesale.

**Purge downloaded artefacts.** A resolve puts the crate on disk even if it was
never built. Registry layout (VERIFIED, config-ece R3):

```
~/.cargo/registry/cache/index.crates.io-<hash>/<name>-<version>.crate
~/.cargo/registry/src/index.crates.io-<hash>/<name>-<version>/
```

The rust-lang postmortem's own remediation one-liner targets exactly this path:
`find ~/.cargo/registry/cache -type f -name '<name>-<version>.crate'`. Delete
both the `.crate` and the unpacked `src/` tree. If any executing command ran
before the purge, this is an incident, not a cleanup.

## Escalation

`Halt` → `Outcome::Surprise` back-brief carrying an evidence table of
**independent, individually-cited** signals — one row per signal with the command
or API field that produced it. One signal is a suspicion; three independent ones
are a finding.

Confirmed findings go upstream: **crates.io security team** (account compromise,
malicious publish, impersonation) and **RustSec advisory-db**
(`github.com/rustsec/advisory-db`). Observed workflow for this incident (VERIFIED
live, config-ece R1/R6): **issue** describing the malicious crate → **PR adding
the advisory TOML** → follow-up **PR assigning RUSTSEC ids**. This incident
produced RUSTSEC-2026-0259 … -0265.

Do not publish IOCs you have not verified yourself, and do not fetch the
malicious artefact to "confirm" it.

## Tooling

Environment-dependent. **Probe presence in the current environment; do not
assume.** Everything below installs with `cargo install <tool>` unless noted.

| Tool | Role in this workflow | Presence check |
|---|---|---|
| `cargo` (built-in) | `fetch` / `metadata` / `tree -i` / `vendor` / `update --dry-run` / `info` / `add` — the whole non-executing T1 surface | `cargo --version` |
| `cargo-deny` | Yanked + advisory + source gate. **See the yanked note below.** | `cargo deny --version` |
| `cargo-audit` | Advisory DB against `Cargo.lock`. `--json` and `-D/--deny <warnings\|unmaintained\|unsound\|yanked>` are real flags (VERIFIED) | `cargo audit --version` |
| `cargo-vet` | Audit/exemption ledger for reviewed crates | `cargo vet --help` |
| `curl` + `tar` + `diff` | All that T4 source diffing needs — no special tool required (VERIFIED, config-6sc G4) | standard |
| `jq` | crates.io JSON API and sparse-index NDJSON | `jq --version` |
| `podman` (or another container runtime) | The one verified containment primitive (`--network=none`) | `podman --version` |
| `gh` | RustSec advisory-db search and reporting | `gh --version` |

Named but not evaluated here: `cargo-crev`, `cargo-supply-chain`,
`cargo-geiger`, `cargo-outdated`, `cargo-semver-checks`. `cargo add` is built
into cargo (since 1.62); `cargo-edit` is not needed.

> **`cargo-deny`'s yanked check is OFF BY DEFAULT.** `cargo deny init` ships no
> `yanked` key, so yanked crates are a **warning** and the check exits 0. A clean
> `cargo deny check` does **not** mean "no yanked crates". VERIFIED fix
> (config-6sc G3), either form:
>
> ```toml
> # deny.toml — the key MUST sit under [advisories]
> [advisories]
> yanked = "deny"
> ```
> ```
> cargo deny check advisories -D yanked      # config-free equivalent
> ```
>
> Appending the key to the end of the generated template lands it in
> `[sources]` and errors with `unexpected-keys`.

> **There is no crates.io API endpoint for yank timestamps or owner-change
> history.** VERIFIED / CONTRADICTED (config-ece R4). The API exposes per-version
> `created_at` (publish time) and `yanked` (a boolean, no timestamp). Crate-level
> `updated_at` is an approximation only. Do not invent an endpoint; reconstruct
> yank *shape* from the sparse index instead (`references/triage-signals.md` §Y).

## Open worries, answered

**"What if the library already had a lot of transitive dependencies?"**
T3 scales with the **delta**, not the closure — a 400-crate closure with a
two-node delta is a two-node review. Size argues for automating enumeration, not
for skipping it.

**"What if the added crate was already a dependency elsewhere in the closure, so
it does not stand out in the delta?"**
The signal is not novelty-in-the-closure; it is the **changed build-time surface**
and the **changed edge set**. A crate already present that acquires a new
dependent, a new `build.rs`, or new `[build-dependencies]` enters the T3 set on
exactly the same terms as a brand-new crate. Compute the delta over edges and
build-time surface, never over the node name list — a node-name delta is precisely
what this variant defeats.

**"Would an agent have caught it?"**
Only via mechanisms, not vigilance. What caught arrayref: `cargo deny` set to
fail loudly on yanked; an unskippable read-the-diff step; cargo's own
`Adding proc-macro1 v1.0.107` stdout being *acted on*; halt-and-back-brief
instead of "try harder"; re-verification against the manifest rather than
inference. What failed: the lock file *did* move onto the poisoned version and
nobody opened the build.rs. Attention is not a control; a gate is.

## Mechanism index

Organise your thinking by mechanism, not by this incident's indicators — the next
attack will not look like this one.

| Mechanism | Where it is handled | arrayref instance |
|---|---|---|
| Yank-as-delivery | Yank interrupt, T2 §Y, Rollback | 0.3.5–0.3.9 yanked, only poisoned 0.3.10 live |
| Build-time execution | T3, `references/build-script-review.md` | payload in proc-macro1's build.rs |
| Identity theft / impersonation | T2 owner + description + repo signals | forged "David Tolnay", 404 repo link |
| Closure expansion | T1 delta, T2 network-stack signal | patch bump added ureq + rustls |

Worked example in full: `references/incident-arrayref.md`.
