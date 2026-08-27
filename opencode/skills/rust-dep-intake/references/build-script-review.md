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
| 2 | Process spawn | `rg -n 'Command::new\|process::\|exec\|spawn\|Stdio' build.rs` | Persistence and payload launch |
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

### What a BENIGN build script looks like

Signal is only visible against a baseline. Ordinary, non-suspicious build scripts
do one of these and little else:

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
env; it opens no sockets; it spawns only compilers/codegen tools that are
themselves declared build-dependencies. Deviation from that profile is the
finding, whatever its shape.

## 4. Read the proc-macro crates too

A proc-macro crate's code runs in the compiler at build time — same trust level as
a build script. Apply the same catalogue to its `src/`, and be alert to the
identity case: a proc-macro crate whose `src/` is a mechanical rename of a
well-known crate (so builds "just work") while its `build.rs` carries the payload.
That was exactly `proc-macro1`: a drop-in `proc-macro2` rename with the payload in
its own build script.

## 5. Recording the outcome

For each crate reviewed, record: crate + version, which of the five surfaces it
had, which catalogue items fired, and the verdict. That record is what a `Halt`
back-brief cites and what lets a later reviewer skip re-reading an unchanged
crate.
