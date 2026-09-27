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
| 2 | Process spawn | `rg -n 'Command::new\|process::\|exec\|spawn\|Stdio' build.rs` | Persistence and payload launch; only §Bounded compiler-version probe can dispose this signal |
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

### Bounded compiler-version probe

This is the sole process-spawn exception to the skill's hard stops. It is a
read-level disposition of one build-script call site, not a package allowlist,
tool permission, intake clearance, or sandbox proof. Do not execute a candidate
to establish its trust. Every criterion must be evidenced before accepting it:

1. Read the complete actual build script and reachable helpers/branches. Bind
   the review to package/version/source, lock checksum or immutable revision,
   archive/source integrity comparison, and reviewed file hashes. A familiar
   name or unchanged bytes does not remove an acquired-dependent review.
2. The call directly invokes the identified Rust compiler with exactly one
   argument: the literal `--version`. No shell, command string, extra/dynamic
   arguments, response file, compilation, code generation, or delegation beyond
   the transparent dispatcher in criterion 3 is covered. Read how stdout is
   consumed: version parsing/feature selection
   only, never execution or evaluation of output.
3. Establish the executable's resolved absolute path, identity and trusted
   installation provenance for the intended build context. Record the actual
   `RUSTC` selection, any PATH/symlink resolution, Cargo config/overrides, cwd,
   toolchain version and host. A basename, path spelling, or version string is
   not provenance. A launcher/proxy is covered only if independently reviewed
   as a transparent dispatcher to that exact installed compiler, preserving
   the sole argument and performing no installation, update or other work.
   Other wrappers are not covered; unknown wrapper behavior blocks acceptance.
4. Account for inherited environment and loader/compiler injection, including
   `RUSTC_WRAPPER`, `RUSTC_WORKSPACE_WRAPPER`, rustup selection and loader hooks.
   Determine which settings reach this direct call; do not assume Cargo's
   wrappers are invoked or bypassed safely. Establish no untrusted redirection,
   injected code, secret reads/exfiltration, network access or writes outside
   `OUT_DIR` by this invocation or dispatcher. Missing context is unknown, not
   evidence of absence. Record relevant settings without exposing secrets.
5. The reviewed path performs a finite version query, collects/reaps its child,
   and neither detaches nor retries without a bound. Review the rest of the
   script independently: network access, outside-`OUT_DIR` writes, obfuscated
   payloads and every other hard stop still force `Halt`, including in
   platform/feature-conditional branches.

Record `ProbeDisposition::Accepted`, `Rejected`, or `Unknown` with call site,
exact argv, evidence for each criterion, unresolved gaps, reviewer and date.
`Accepted` removes only this spawn hard stop; finish T2/T3/T4 and record a
separate intake disposition before any dependency execution. `Rejected` for a
known disallowed invocation/non-probe means `Halt`; `Unknown` means
`Indeterminate` → `Investigate`, with execution blocked. A separate hard stop
dominates either result. Reassess if source, executable, arguments, environment,
wrappers, toolchain or build context changes.

#### Worked judgement cases (not executed tests)

| Evidence | Probe decision / intake consequence |
|---|---|
| Full script reviewed; direct trusted, provenance-verified compiler; sole `--version`; version-only consumption; resolved context satisfies all criteria | `Accepted`; spawn signal disposed, remaining intake still required |
| Same call and unchanged crate bytes, but `RUSTC`/toolchain identity or inherited loader environment is unresolved | `Unknown`; `Indeterminate` → `Investigate`, no execution |
| Executable merely named `rustc`, or unreviewed PATH shim/rustup proxy/wrapper | `Unknown`; investigate executable/dispatcher before any execution |
| Known substituted executable, shell `-c`, arbitrary wrapper, extra `-v`, `--emit`, source path, response file or dynamic argv | `Rejected`; `Halt`, even if it prints a plausible version |
| Compiler/codegen invocation declared in build-dependencies, but doing compilation/generation rather than this exact query | `Rejected`; `Halt`; declaration is not an exception |
| Exact trusted probe plus a conditional network call, secret exfiltration, outside write or decoded payload elsewhere in script | Other hard stop/finding retained; no probe-based clearance |
| Probe stdout subsequently evaluated as a command, detached child, or unbounded retry loop | `Rejected`; `Halt` |

### Benign patterns are not clearance

These patterns guide reading, but do not override hard stops. Compiler/codegen
spawns below remain `Halt` unless they meet the exact exception above:

- emit `cargo:rustc-cfg=...` / `cargo:rustc-check-cfg=...` after probing the
  compiler version or a `cfg` (feature detection),
- emit `cargo:rerun-if-changed=` / `cargo:rerun-if-env-changed=` lines,
- generate Rust source into `env!("OUT_DIR")` (bindgen, protobuf, lexer/parser
  generators) and nothing outside it,
- compile bundled C/C++ that is **present in the tarball** via the `cc` crate,
- emit `cargo:rustc-link-lib=` / `cargo:rustc-link-search=` alongside a `links`
  key, for a `-sys` crate,
- read `TARGET`, `HOST`, `PROFILE`, `OUT_DIR`, `CARGO_*` env vars.

Properties of a benign script: it is short; every path it writes is under
`OUT_DIR`; every input it reads is inside its own package or the documented cargo
env; it opens no sockets. Declaring a compiler/codegen tool as a build-dependency
does not authorize spawning it. Apply §Bounded compiler-version probe to each
candidate query; all other spawns retain the skill's hard stop.

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
probe disposition with its context/evidence, and the separate intake verdict.
That record is what a `Halt` back-brief cites. Reuse requires matching scope and
context; unchanged bytes alone do not waive the acquired-dependent rule.
