# T5 — Containment

Only for the case where execution is genuinely required and review did not clear.
Containment is not a substitute for T3; it is what you do when you must compile
something you could not fully clear.

## What is NOT containment

> **`cargo build --offline` is not a security control.**

VERIFIED by direct experiment (config-6sc G1). A probe crate whose `build.rs`
resolved a hostname and opened a TCP connection was built twice, forcing the build
script to re-run:

```
$ cargo build
warning: g1probe@0.0.0: PROBE_NET_OK connected to 104.20.23.154:80
EXIT_NORMAL:0

$ cargo build --offline
warning: g1probe@0.0.0: PROBE_NET_OK connected to 104.20.23.154:80
EXIT_OFFLINE:0
```

Identical. `--offline` constrains **cargo's own** registry and index access. It
applies no sandbox, no seccomp policy, and no network namespace to the
build-script child process, which opens sockets freely. Had `arrayref 0.3.10` been
built under `--offline`, `proc-macro1`'s build script would still have reached its
C2 host.

Treat `--offline` as a **reproducibility** control: it makes cargo fail loudly
rather than silently fetch. Never present it as mitigating build-time execution.

Also not containment on macOS: `sandbox-exec` exists but Apple's own man page
marks it **DEPRECATED** ("execute within a sandbox (DEPRECATED)"). No
forward-compatibility guarantee; do not build a procedure on it.

## The verified containment recipe

VERIFIED end to end (config-nfh G7): a full `cargo build` succeeded inside
`podman --network=none` while the network was provably severed — proven with a
positive control (the same `build.rs` reached the network on the host) and a
negative (it could not resolve DNS in the container), in the same session.

### Step 0 — start the container machine

```
podman machine start <name>
```

A stopped machine yields a confusing `unable to connect to Podman socket ...
connection refused` from `podman run`, not a clear "not running" message. Check
this first when `podman run` fails.

### Step 1 — HOST, network ON: vendor all sources

```
cd <project>
mkdir -p .cargo
cargo vendor vendor > .cargo/config.toml
```

`cargo vendor` prints the source-replacement stanza on stdout and writes sources
to `vendor/`; redirecting it straight into `.cargo/config.toml` is the whole
configuration step. Emitted stanza:

```toml
[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
```

`cargo vendor` is VERIFIED non-executing, so this host step runs no build scripts.

### Step 2 — CONTAINER, network SEVERED: build

```
podman run --rm --network=none \
  -v "$PWD":/w:Z -w /w \
  -e CARGO_HOME=/tmp/ch -e CARGO_TARGET_DIR=/tmp/t \
  docker.io/library/rust:1-alpine \
  cargo build --offline
```

Verified observations from the severed run:

```
   Compiling libc v0.2.189
   Compiling netprobe v0.0.0 (/w)
warning: netprobe@0.0.0: PROBE_NET_BLOCKED resolve failed: failed to lookup address information: Try again
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.77s
CARGO_EXIT:0
BINARY_PRESENT
```

Contained **and** working: `libc`'s genuine build script ran, the binary was
produced, exit 0 — while the probe's own outbound attempt failed.

### Facts established empirically about the mounts

- **Vendoring alone is sufficient. No `CARGO_HOME` mount is needed.**
  `CARGO_HOME=/tmp/ch` exists only to give cargo a writable scratch home inside
  the container; it starts empty and carries no pre-fetched registry data.
- **`CARGO_TARGET_DIR=/tmp/t` is required in practice**, to keep the container's
  linux/musl artefacts out of the host's darwin `target/`. Sharing one target dir
  across two ABIs invites confusing rebuilds and pollutes the host tree.
- `-v "$PWD":/w:Z -w /w`, with `vendor/` and `.cargo/config.toml` inside it, is
  the only mount required.
- `--offline` is still passed, but per G1 it is not the control. **`--network=none`
  is what does the containing.** Under vendoring `--offline` is nearly a no-op;
  keep it so cargo fails loudly rather than silently attempting a fetch.
- `--network=none` also blocks cargo's own registry access, which is why the
  vendoring precondition is not optional.

### Image

`docker.io/library/rust:1-alpine`, 981 MB, pulled in ~24s. Pull cost is not a
reason to skip containment. The bookworm variants are ~1.5 GB.

## Honest limits

- **Verified with `rust:1-alpine` (musl).** A crate whose build script or sys-crate
  needs glibc, or system libraries absent from alpine, needs `rust:1-slim` or
  `rust:1-bookworm` instead. The `--network=none` argument is image-independent;
  build *success* is not.
- **`--network=none` severs network only.** It does not stop a build script writing
  to the mounted project directory, reading mounted files, or consuming CPU.
  Mounting read-only (`:ro`) if write-containment is also wanted **was NOT
  exercised** — do not present it as verified.
- The container runs as root against a `:Z`-relabelled host mount, so files it
  creates in the project are root-owned. `CARGO_TARGET_DIR=/tmp/t` avoids this for
  build output.
- Failure surfaces at the **DNS resolve** step inside `--network=none`; a build
  script hard-coding an IP would fail at connect instead. Do not match on a
  specific error string — only on the fact that outbound access fails.
- Containment proves nothing about what the code *would* do with network access.
  A clean contained build is not a clearance; it is a way to get an artefact
  without paying the exfiltration cost. The clearance still comes from T3.

## Environment-dependence

This recipe was verified on macOS/aarch64 with podman. Any OCI runtime with a
`--network=none` equivalent works on the same argument; probe what is present
rather than assuming. If no container runtime is available, the honest position is
that **no verified containment primitive exists in that environment** — say so and
escalate, rather than substituting `--offline`.
