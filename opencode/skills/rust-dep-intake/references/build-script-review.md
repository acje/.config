# T3 — Build-script and proc-macro review

The gate. Everything here is non-executing: reading files, never compiling them.

## 1. Obtain sources WITHOUT executing them

Three routes, all VERIFIED non-executing (config-ece R2/R3, config-6sc G2/G4).

### (a) `cargo vendor` — whole closure at once

```
cargo vendor vendor_out
```

Pure file copy from `~/.cargo/registry/src/` into `vendor_out/`. `build.rs` lands
as an inert file. Directly verified: after `cargo vendor`, no `target/` directory
exists at all.

### (b) Registry cache — what is already on disk

```
~/.cargo/registry/cache/index.crates.io-<hash>/<name>-<version>.crate
~/.cargo/registry/src/index.crates.io-<hash>/<name>-<version>/
```

`index.crates.io-<hash>` is a fixed per-registry-URL identifier; the same hash
appears under both `cache/` and `src/`. Glob it rather than hardcoding it.

### (c) Published tarball — the authoritative artefact

```
curl -sSL -o <name>-<version>.crate \
  https://static.crates.io/crates/<name>/<name>-<version>.crate
mkdir -p x && tar -xzf <name>-<version>.crate -C x
```

VERIFIED: `https://crates.io/api/v1/crates/<name>/<version>/download` 302-redirects
to exactly that `static.crates.io` URL; the static URL serves 200 on a plain GET
with **no** User-Agent required (unlike the JSON API, which 403s without one). A
`.crate` is a gzipped tar containing exactly one top-level `<name>-<version>/`
directory. Extraction is inert.

**Review the tarball, not the GitHub repo.** `include`/`exclude` in `Cargo.toml`
means the published artefact can differ from the repo. Repo-looks-clean is not
evidence about what cargo will compile.

## 2. Enumerate the build-time surface

Across the ADDED / CHANGED / EDGE-CHANGED set only.

| Surface | How to find it |
|---|---|
| `build.rs` | `find <src> -name build.rs` |
| build script under another name | `rg '^\s*build\s*=' <src>/*/Cargo.toml` |
| native-lib link declaration | `rg '^\s*links\s*=' <src>/*/Cargo.toml` |
| proc-macro crate | `rg -A2 '^\[lib\]' <src>/*/Cargo.toml \| rg 'proc-macro\s*=\s*true'` |
| build-time dependency closure | `rg -A20 '^\[build-dependencies' <src>/*/Cargo.toml` |

From `cargo metadata` (non-executing) the same set is derivable per package via
the `build` / `links` fields and `dependencies[].kind == "build"`.

`[build-dependencies]` alone can decide the verdict. Ask: *what does this crate
plausibly need at build time?* A parser needing an HTTP client, a TLS stack, or
base64 is not plausible. `proc-macro1` declared `base64 0.22`, `rustls 0.23`
(features ring/std/tls12, `default-features = false`) and `ureq 2` (feature tls).

## 3. Read every build script found

Read it top to bottom. Do not skim for keywords only — obfuscation exists to
defeat keyword skimming — but the greps below tell you where to look first.

### Red-flag catalogue

| # | Red flag | Grep / rg pattern | Why |
|---|---|---|---|
| 1 | Network access | `rg -n 'TcpStream\|UdpSocket\|to_socket_addrs\|reqwest\|ureq\|hyper\|curl\|http://\|https://' build.rs` | A build script has no legitimate reason to open a socket |
| 2 | Process spawn | `rg -n 'Command::new\|process::\|exec\|spawn\|Stdio' build.rs` | Persistence and payload launch; only §Approved activity categories can dispose this signal |
| 3 | FS write outside `OUT_DIR` | `rg -n 'File::create\|fs::write\|OpenOptions\|/tmp\|TEMP\|tempdir' build.rs` | Legitimate scripts write only under `OUT_DIR` |
| 4 | Environment exfiltration | `rg -n 'env::vars\|env::var\("(?!CARGO\|OUT_DIR\|TARGET\|HOST\|PROFILE)' build.rs` | Reading secrets/tokens from the build env |
| 5 | Encoded blobs | `rg -n 'base64\|from_hex\|hex::decode\|\^\s*=\|xor\|rot13\|decode' build.rs` | Payload or endpoint hidden from a reader |
| 6 | Embedded binary | `rg -n 'include_bytes!\|include_str!' build.rs` | Ships an artefact the reviewer never sees as source |
| 7 | Platform-conditional dispatch | `rg -n 'target_os\|target_arch\|cfg!\(' build.rs` | Per-platform payloads; benign uses exist, so read the branches |
| 8 | Obfuscated string assembly | `rg -n 'concat!\|\.join\(\|push_str\|chars\(\)\.rev' build.rs` | Endpoint split across constants to defeat grep |
| 9 | Linker/env injection | `rg -n 'cargo:rustc-link-arg\|cargo:rustc-env\|cargo:rustc-cfg\|cargo::' build.rs` | Influences the final binary beyond this crate |
| 10 | Permissive TLS verifier | `rg -n 'ServerCertVerifier\|danger_accept\|dangerous\(\)\|InsecureSkipVerify' build.rs` | A verifier returning `Ok` unconditionally means there is no TLS validation |
| 11 | Detached / surviving child | `rg -n 'mem::forget\|setsid\|wscript\|powershell\|\.ps1\|vbs' build.rs` | Deliberately outliving `cargo build` |
| 12 | chmod / exec-bit | `rg -n 'set_permissions\|from_mode\|chmod' build.rs` | Making a downloaded file runnable |

Run the whole catalogue over the vendored/extracted tree at once:

```
rg -n --glob 'build.rs' \
  'TcpStream|Command::new|include_bytes!|base64|cargo:rustc-link-arg|ServerCertVerifier|mem::forget' \
  vendor_out/
```

A hit is not a verdict; it is a place to read. A *clean* grep is also not a
verdict — item 8 exists precisely to defeat it. Read the file.

### Approved activity categories (process disposition)

A process spawn from a build script or proc-macro is disposed by **behaviour
and context, never by binary name or crate popularity**. A small set of benign
build-time activity categories below is reviewable; each requires the shared
disposition rubric (category-neutral) plus the category's own argv/behaviour
obligations. Every other hard stop (network access, obfuscated payload, path
escape, unreviewed execution, unauthorized output) still forces `Halt`. A
disposition is a read-level ruling on one call site or one coherent helper
chain — not a package allowlist, tool permission, intake clearance, or sandbox
proof. Do not execute a candidate to establish its trust. Every rubric item
must be evidenced before accepting a category.

The categories:

- **A — compiler/toolchain config, version and metadata queries** (the exact
  `--version` probe plus bounded metadata/config reads of the resolved
  compiler, version/metadata-only consumption);
- **B — C/Rust compilation of reviewed package/generated inputs and helper
  chains** (in-tarball C/C++ via `cc`, generators emitting into `OUT_DIR`,
  build-time metadata compilation of the crate's own reviewed sources);
- **C — local Git identity query** (a literal, fetch-free local read such as
  `git rev-parse HEAD` for embedding a revision);
- **D — supported-platform conditional reachability** (branches reachable only
  on the targets the platform-conditional is written for, e.g. a
  `freebsd-version` or `emcc -dumpversion` probe on that target).

The disposition record and the benign/known-bad matrix below are
**review-judgment evidence, not automated enforcement proof**: they guide a
human reviewer; they are not a tool that grants approval by matching a row.
Reviewing an ordinary reviewed operation does not require modifying upstream to
make it pass; the activity is disposed as it actually exists.

#### Shared disposition rubric (category-neutral)

Every candidate spawn must record and satisfy each item for its category. These
items are the discipline common to all four categories; each category section
then lists its specific argv/behaviour obligations:

1. **Source binding.** Read the complete actual build script and reachable
   helpers/branches. Bind the review to package/version/source, lock checksum
   or immutable revision, archive/source integrity comparison, and reviewed
   file hashes. A familiar name or unchanged bytes does not remove an
   acquired-dependent review.
2. **Executable identity and provenance.** Establish the executable's resolved
   absolute path, identity and trusted installation provenance for the intended
   build context. Record the actual selection (`RUSTC`, `CC`/`AR`, `git` or the
   probe tool), any PATH/symlink resolution, Cargo config/overrides, cwd,
   toolchain version and host. A basename, path spelling, or version string is
   not provenance. A launcher/proxy/wrapper is covered only if independently
   reviewed as a transparent dispatcher to that exact intended executable,
   performing no installation, update or other work; unknown wrapper behaviour
   blocks acceptance.
3. **Environment and loader/plugin injection.** Account for inherited
   environment and injection, including `RUSTC_WRAPPER`,
   `RUSTC_WORKSPACE_WRAPPER`, rustup selection, loader hooks, the `cc`-family
   `CC`/`CFLAGS`/`AR` resolution, and compiler plugin/include/link paths.
   Determine which settings actually reach this call; do not assume Cargo's
   wrappers are invoked or bypassed safely. Establish no untrusted redirection,
   injected code, secret reads/exfiltration, or network access by this
   invocation or dispatcher. Missing context is unknown, not evidence of
   absence. Record relevant settings without exposing secrets.
4. **Input/output closure.** Every input read is reviewed (the package's own
   source, a reviewed in-tarball source, or a derivation generated from
   reviewed inputs) or comes from the documented cargo env. Every write lands
   under `OUT_DIR` (the default output root) or an explicitly authorized
   separate canonical root per the output rule below; no filesystem escape, no
   `$TMP`/`/tmp` writes, no parent-relative or repo-escape writes.
5. **Lifecycle and context.** The activity is finite and supervised: it
   executes, is collected/reaped, does not detach, and does not retry without a
   bound. Record the actual child lifetime, output size/use and resource
   context rather than assuming a cap; a supervised build gate deadline bounds
   the overall step. Review the rest of the script independently: network
   access, obfuscated payloads, unexpected writes and every other hard stop
   still force `Halt`, including in platform/feature-conditional branches.
6. **Output-consumption trust.** How stdout is consumed is part of the
   disposition: output is never executed or evaluated as a command. For a
   query, nonzero, malformed, absent or foreign output is never trusted as
   identity or provenance.

#### Output rule (authoritative)

`OUT_DIR` is the default output root for build-time compilation/generation.
Any other output root must be an **explicitly authorized, scoped canonical
root**: an owner policy decision amending the skill's first hard stop for that
root, with ownership, symlink/escape review, actual write-closure evidence and
matching source/context approval recorded in the disposition. Absent such an
amendment, `OUT_DIR`-only applies and a write anywhere else is the retained
hard stop. SKILL.md §Hard stops carries this same rule by cross-reference; the
two never compete.

Record `ActivityDisposition::Accepted` | `Rejected` | `Unknown` with the call
site, the category (A–D) it was disposed under, exact argv, evidence for each
rubric item, unresolved gaps, reviewer and date. `Accepted` removes only the
identified activity's spawn hard stop; finish T2/T3/T4 and record a separate
intake disposition before any dependency execution. **Missing evidence is
`Unknown` → `Indeterminate` → `Investigate`**, with execution blocked — an
unresolved chain/identity/context is never a benign pass and never, by itself,
a known-bad `Halt`. **A known forbidden activity** — an outside-category spawn,
a category claim contradicted by the evidence, or one of the retained hard-stop
behaviours — is `Rejected`; `Halt`. A separate hard stop dominates either
result. Reassess if source, executable, arguments, environment, wrappers,
toolchain or build context changes.

#### Category A — compiler/toolchain config, version and metadata queries

Category A covers non-compiling queries of the identified Rust compiler —
version, config and metadata. The canonical version probe is the literal
`--version` call on the resolved compiler, consumed for version parsing/feature
selection only, never executed or evaluated. A reviewed non-compiling
config/metadata query of the same resolved compiler (e.g. a single
`--print`/`--cfg` diagnostic used for feature selection) is a Category-A
variant: its argv is read and bounded to the resolved compiler's non-compiling
query surface, its output consumed for metadata/config selection only, and it
satisfies the shared rubric (identity/provenance, wrappers, input/output,
lifecycle, output-consumption trust). Anything that compiles or generates code
falls to Category B.

#### Category B — C/Rust compilation of reviewed inputs and helper chains

Reviewable build-time compilation/generation where **every input is reviewed**:
the package's own source, a reviewed in-tarball source, or a derivation
generated from reviewed inputs. Output lands under `OUT_DIR` by default or an
explicitly authorized canonical root (output rule above). Members:

- compile bundled C/C++ that is **present in the tarball** via the `cc` crate;
- generate Rust/C source into `env!("OUT_DIR")` (bindgen, protobuf,
  lexer/parser generators) from reviewed inputs, and the subsequent compilation
  of those generated or reviewed inputs;
- a build-time metadata compilation of the crate's own reviewed sources (e.g. a
  proc-macro compile probe with `--emit=dep-info,metadata`).

Specific obligations on top of the shared rubric: resolve the actual
compiler/archiver chain (`cc` → resolved `cc`/`clang`/ar + `CC`/`CFLAGS`/`AR`
selection), its identity and provenance; review the flags, response files, and
include/link/plugin paths as part of the disposition — a substantively reviewed
`--emit`, source path, or response file on a resolved chain is admissible, not
a blanket refusal; record the actual child lifetime and output context under
the supervised build-gate deadline; confirm every write obeys the output rule.
Normal compilation is not explicit networking, but executable identity alone
does not constrain plugins or subprocess behaviour — the full resolved chain is
part of the disposition. Declaring a compiler/codegen tool as a
`[build-dependencies]` entry does **not** authorize spawning it; the rubric
still applies.

#### Category C — local Git identity query

A literal, fetch-free local Git read — e.g. `git rev-parse HEAD` to embed a
revision — is reviewable when the identity it establishes is the only purpose.
Specific obligations on top of the shared rubric:

- **no fetch/update/submodule and no shell evaluation** in the call;
- assess **cwd and repository discovery** (parent-escape into an outer repo),
  symlink resolution, `GIT_DIR`/`GIT_WORK_TREE`/config overrides, and `PATH`
  selection of the `git` executable (basename is not provenance);
- **output-consumption trust**: the Git output is used only as the bounded
  identity value; nonzero, malformed, absent, or foreign-repository output is
  never trusted as provenance — absent/failed Git metadata is not trusted
  identity. Record the actual child lifetime and output context; do not invent
  a mandatory output cap.

#### Category D — supported-platform conditional reachability

Platform/feature-conditional spawns (e.g. a `freebsd-version` probe, an
`emcc -dumpversion` on Emscripten) are reviewable **only on the targets the
conditional is written for**. The policy owner defines and reviews the
supported-target reachability set. Each branch is disposed under the shared
rubric plus its own argv/behaviour (e.g. `freebsd-version` is a zero-argument
read; `emcc -dumpversion` is a single-argument version query) on its reachable
targets.

Disposition split for Category D: **missing reachability evidence** — the
conditional's reachable target set or branch is not yet reviewed — is `Unknown`
→ `Indeterminate` → `Investigate`, execution blocked; a **demonstrated** branch
that is not actually target-conditional, or a forbidden branch behaviour on a
reachable conditional, is `Rejected`; `Halt`. A branch is never silently ignored
because the host platform does not hit it.

#### Benign / known-bad matrix (review-judgment evidence, not executed tests)

Each row names the activity, the fields the disposition must record (wrappers /
argv / cwd / config / env / plugins / inputs / outputs / timeouts alongside
identity), and the adjudication. The matrix guides reading; it is not an
automated gate.

| Activity (benign witness) | Fields the disposition must record | Adjudication |
|---|---|---|
| Category A — sole `--version` probe of a provenance-verified compiler, version-only consumption | resolved abs path + identity, `RUSTC`/toolchain, cwd, argv = exactly `--version`, wrappers reach it?, output consumption, child reaped | `Accepted` — that activity's spawn signal disposed; remaining intake still required |
| Category B — `cc` compiling in-tarball C into `OUT_DIR` | resolved cc/archiver chain + `CC`/`CFLAGS`/`AR`, argv incl. any response file, include/link/plugin paths, inputs all reviewed/in-tarball, writes under the output rule, child lifetime recorded | `Accepted` — that activity's spawn signal disposed |
| Category B — bindgen/protobuf generator emitting into `OUT_DIR` from reviewed inputs | generator resolved identity, flags/response file reviewed, input closure reviewed, writes under the output rule, child reaped | `Accepted` — that activity's spawn signal disposed |
| Category B — metadata compile (`--emit=dep-info,metadata`) of reviewed crate sources with resolved `rustc` + reviewed flags | resolved `rustc` + flags reviewed, inputs reviewed/in-tarball/generated-from-reviewed, writes under the output rule, child lifetime recorded | `Accepted` — that activity's spawn signal disposed |
| Category C — literal fetch-free `git rev-parse HEAD`, revision embedding only | resolved `git` (PATH/basename), cwd + repo-discovery no parent-escape, `GIT_DIR`/`GIT_WORK_TREE`/config overrides, no fetch/shell-eval, output-consumption trust (nonzero/foreign/absent ⇒ no identity) | `Accepted` — that activity's spawn signal disposed |
| Category D — reachable-target conditional probe (`freebsd-version`, `emcc -dumpversion`) on a target the owner defined as supported | target-reachability record, category-specific argv, resolved executable identity | `Accepted` — that activity's spawn signal disposed on its reachable targets |

| Activity (known-bad witness) | Why it is bad | Adjudication |
|---|---|---|
| Downloader / explicit network fetch ("`curl` a script then run it", a socket) | network stop retained | `Rejected`; `Halt` |
| Obfuscated/decoded payload (base64/hex/xor blob decoded into an executed artefact) | obfuscation stop retained | `Rejected`; `Halt` |
| Path escape — writes outside the authorized output roots (`$TMP`/`/tmp`, parent-relative, repo-escape), or a merely named root with no owner authorization | unauthorized-output stop retained; a named root without explicit authorization is not a root | `Rejected`; `Halt` |
| Substituted executable, shell `-c`, or other **demonstrated** injection (known wrong executable, forged/unvalidated argv that ran) | unreviewed-execution stop retained; basename/path spelling is not provenance; reviewed argv/response-files on a resolved chain are NOT this row | `Rejected`; `Halt` |
| Output **executed/evaluated as a command**, detached child, or unbounded retry without bound | lifetime / output-as-code stop retained | `Rejected`; `Halt` |
| Unreviewed wrapper/proxy/plugin with **unknown** behaviour, or argv assembled from unreviewed/unvalidated data with **no demonstrated** forbidden behavior | evidence absent, not known bad | `Unknown`; `Indeterminate` → `Investigate`, execution blocked |
| Execution or target-reachability whose nature is otherwise **unknown** (no demonstrated forbidden behavior) | evidence absent, not known bad | `Unknown`; `Indeterminate` → `Investigate`, execution blocked |
| Any spawn **outside** categories A–D | no legitimate category home; not a popularity/top-of-closure pass | `Rejected`; `Halt` |
| Category claim with **missing evidence** (unresolved chain/identity/wrappers/context) | evidence absent, not known bad | `Unknown`; `Indeterminate` → `Investigate`, execution blocked |

Worked judgement cases also still apply below, extended from the probe to all
four categories.

| Evidence | Disposition / intake consequence |
|---|---|
| Full script reviewed; direct trusted, provenance-verified compiler; sole `--version`; version-only consumption; resolved context satisfies the rubric | `Accepted`; spawn signal disposed, remaining intake still required |
| Category-B `cc` compile `[clang,-c,reviewed.c,-o,OUT_DIR/reviewed.o]` on a fully resolved, provenance-verified chain with reviewed flags | `Accepted`; that compile activity's spawn signal disposed |
| Category-B metadata compile with reviewed `--emit`/source path/response file on a resolved chain | `Accepted`; that compile activity's spawn signal disposed |
| Category-C literal fetch-free `git rev-parse HEAD` with validated output-consumption trust | `Accepted`; that Git activity's spawn signal disposed |
| Category-D reachable-target probe on a target the owner defined as supported | `Accepted` on that reachable target |
| Category-B compile of reviewed in-tarball C, but the resolved compiler chain / plugin paths are unresolved | `Unknown`; `Indeterminate` → `Investigate`, no execution |
| Same call and unchanged crate bytes, but `RUSTC`/toolchain identity or inherited loader environment is unresolved | `Unknown`; `Indeterminate` → `Investigate`, no execution |
| Executable merely named `rustc` (or `git`, `cc`), or unreviewed PATH shim/rustup proxy/wrapper | `Unknown`; investigate executable/dispatcher before any execution |
| Known substituted executable, shell `-c`, or other demonstrated injection | `Rejected`; `Halt`, even if it prints a plausible version |
| Unreviewed wrapper/proxy with unknown behaviour, or argv from unreviewed/unvalidated data, with no demonstrated forbidden behavior | `Unknown`; `Indeterminate` → `Investigate`, execution blocked |
| Category-A **version** probe with a compiling/emitting or injection argv (e.g. `--emit`, a compile source path, a compile response file, a substituted executable's argv) | `Rejected`; `Halt` for that probe activity — a reviewed non-compiling config/metadata query argv of the resolved compiler is disposed under Category A, never blanket-rejected |
| Category-A reviewed non-compiling config/metadata query (e.g. `--print=cfg`) of the resolved compiler, output used for feature/metadata selection only | `Accepted`; that query activity's spawn signal disposed |
| Category-B compilation outside the reviewed-input/output rules, or a write to a non-authorized root | `Rejected`; `Halt`; declaration is not an exception |
| Category-C Git read that fetches, shells out, or whose nonzero/malformed/foreign/absent output is trusted as revision identity | `Rejected`; `Halt`; no revision trust from unvalidated output |
| Exact trusted activity plus a conditional network call, secret exfiltration, outside write or decoded payload elsewhere in script | Other hard stop/finding retained; no category-based clearance |
| Output subsequently evaluated/executed as a command, detached child, or unbounded retry loop | `Rejected`; `Halt` |

### Category membership is not clearance

These patterns are the *candidate membership set* for the four categories — not
a verdict by themselves. They guide reading and tell you where a disposition
may apply, but they do not override hard stops. Every item still requires the
shared rubric and a disposition under its category before any execution:
missing identity/wrapper/reachability/context evidence is `Unknown` →
`Indeterminate` → `Investigate` (execution blocked); a **demonstrated** forbidden
behavior (substitution, network, escape, obfuscation, detach, output-as-code) or
a proven outside-category spawn is `Halt`.

- emit `cargo:rustc-cfg=...` / `cargo:rustc-check-cfg=...` after probing the
  compiler version or a `cfg` (feature detection) — Category A,
- emit `cargo:rerun-if-changed=` / `cargo:rerun-if-env-changed=` lines — no
  spawn, informational,
- generate Rust source into `env!("OUT_DIR")` (bindgen, protobuf, lexer/parser
  generators) and nothing outside it — Category B,
- compile bundled C/C++ that is **present in the tarball** via the `cc` crate —
  Category B,
- `git rev-parse HEAD`-style local revision embedding — Category C,
- platform-conditional probe reachable only on its supported target — Category D,
- emit `cargo:rustc-link-lib=` / `cargo:rustc-link-search=` alongside a `links`
  key, for a `-sys` crate — linker instruction, not a spawn,
- read `TARGET`, `HOST`, `PROFILE`, `OUT_DIR`, `CARGO_*` env vars — env reads,
  no spawn.

Properties of a benign script: it is short; every path it writes is under
`OUT_DIR`; every input it reads is inside its own package or the documented cargo
env; it opens no sockets. Declaring a compiler/codegen tool as a build-dependency
does not authorize spawning it. Apply §Approved activity categories to each
candidate spawn; all other spawns retain the skill's hard stop.

## 4. Read the proc-macro crates too

A proc-macro crate's code runs in the compiler at build time — same trust level as
a build script. Apply the same catalogue to its `src/`, and be alert to the
identity case: a proc-macro crate whose `src/` is a mechanical rename of a
well-known crate (so builds "just work") while its `build.rs` carries the payload.
That was exactly `proc-macro1`: a drop-in `proc-macro2` rename with the payload in
its own build script.

## 5. Recording the outcome

For each crate reviewed, record: crate + version/source and reviewed hashes,
which of the five surfaces it had, which catalogue items fired, any bounded
probe/category disposition with its context/evidence, and the separate intake
verdict. That record is what a `Halt` back-brief cites. Reuse requires matching
scope and context; unchanged bytes alone do not waive the acquired-dependent
rule.
