# Worked example — arrayref / proc-macro1, 2026-08-20

The incident this skill was written from. Read it as an instance of four
mechanisms, not as a list of indicators to match — the next attack will use the
same mechanisms with different indicators.

## Timeline (cross-confirmed: rust-lang postmortem, SafeDep analysis, contemporaneous incident record)

| Time (UTC) | Event |
|---|---|
| 01:25:58 | Impersonating crates.io account created (`name` field forged to a well-known maintainer) |
| 01:55:34 | `proc-macro1` 1.0.106 published (the only other version that ever existed) |
| 07:11:15 | `proc-macro1` 1.0.107 published — carries the build-time payload |
| ~07:15 | `arrayref` 0.3.5–0.3.9 yanked in one burst, no reason given |
| 07:15:00 | `arrayref` 0.3.10 published, depending on `proc-macro1` 1.0.107 |
| 07:15 | Rust Security Response Team receives a report (credited: Nextron Systems GmbH Research Team) |
| 07:34:07 | `internment` 0.8.7 published (same author, same shape) |
| 07:37:49 | `append-only-vec` 0.1.9 published |
| 08:41:40 | `arrayref` 0.3.10 deleted — 86 minutes online |
| ~09:21 | `arrayref` 0.3.5–0.3.9 un-yanked by crates.io |
| 09:25:24 | `append-only-vec` 0.1.9 deleted — 107 minutes online |
| ~12:07 | `internment` 0.8.3–0.8.6 un-yanked (slower; initially missed) |

Crates deleted entirely: `proc-macro1`, `proc-macro-en`, `aovine`, `arone`,
`aronenao`, `tinymember`. The maintainer's account was locked as a precaution;
the assessment was credential/machine compromise, not malicious authorship.

Advisories: RUSTSEC-2026-0259 … -0265, via `rustsec/advisory-db` issue #3161 →
PR #3162 (advisory TOMLs) → PR #3164 (id assignment).

## Mechanism 1 — Yank-as-delivery

A poisoned release sitting beside healthy ones converts nobody: lock files pin
consumers in place. Yanking the healthy history makes every supply-chain gate
(`cargo deny`, `cargo audit`, renovate, dependabot) push consumers **up** onto the
single live poisoned version. **The security tooling becomes the delivery
mechanism.** The RustSec reporter noted this is precisely how they were exposed
to it.

Skill response: the yank interrupt in SKILL.md §Entry points; yank census in
`triage-signals.md` §Y; `yanked = "deny"` as a hard gate rather than a nudge.

## Mechanism 2 — Build-time execution

`arrayref` 0.3.10 itself had `build = false` and **no build.rs**. The vector was
its dependency's. `proc-macro1`'s `src/` was a mechanical rename of `proc-macro2`
— a genuine drop-in, so builds "worked" — while the payload lived in its own
`build.rs`.

Payload anatomy, as documented in the advisory analysis:

| Property | Detail |
|---|---|
| Build-dependencies | `base64 0.22`, `rustls 0.23` (ring/std/tls12, `default-features = false`), `ureq 2` (tls) — for a token-parsing library |
| Endpoint concealment | base64-encoded URL fragments in `SRC_URL_PARTS` / `END_URL_PARTS` consts, assembled at build time |
| Decoded targets | payload host `23.254.165.112:9089`, C2 `23.254.165.112:443` |
| TLS | custom `rustls` `ServerCertVerifier` returning `Ok` unconditionally — self-signed cert on a raw IP, so no validation occurs |
| Platform dispatch | in `main()`, no feature gate: linux/x86_64, windows/x86_64, macos/x86_64, macos/aarch64 → four distinct payloads; other → panic |
| Unix behaviour | writes `/tmp/rust-setup`, `chmod +x`, spawns detached (stdio→null), passes the C2 address as `argv[1]`, does not wait |
| Windows behaviour | writes `%TEMP%\rust-setup.ps1`, launches it via a VBScript through `wscript.exe` — the source comment states this escapes Cargo's job object so the payload survives after `cargo build` exits; `std::mem::forget` leaks the child handle |
| Trigger | runs unconditionally at the top of `main()`, before any legitimate config logic — every build, no env-var or feature opt-out |

Every one of those properties is in the `build-script-review.md` red-flag
catalogue, and every one is visible by **reading the file**. None of it is
visible from the dependency graph alone.

Skill response: T3 is the gate; T3 enumerates the *closure's* build-time surface,
not the bumped crate's.

## Mechanism 3 — Identity theft / impersonation

- `proc-macro1` — one character from `proc-macro2`, a crate present in essentially
  every Rust lock file.
- Description copy-pasted verbatim from the crate it impersonated.
- `repository` field pointed at a nonexistent GitHub path under a well-known
  maintainer's account — a **404**.
- Publishing account's `name` field forged to that maintainer's real name; account
  created hours earlier.
- Pinned to `1.0.107` because that was `proc-macro2`'s exact current version in the
  victim project's own lock file — chosen so the added line would read as
  unremarkable in a lock diff.

Skill response: `triage-signals.md` §T (typosquat **against your own lock**, plus
the version-mimicry conjunction), §C (description / 404 repository), §O (owner and
account age).

## Mechanism 4 — Closure expansion

A **patch-level bump added an HTTP client**. Through one new dependency, `arrayref`
0.3.9 → 0.3.10 pulled in `ureq`, `rustls`, `base64` and `unicode-ident`.

Blast-radius asymmetry: `proc-macro1` had **9 downloads**; `arrayref` had
**~245M** all-time (152M on the clean 0.3.9). You do not need anyone to install
your crate — you need one crate everybody already installs to install it for you.

Skill response: `triage-signals.md` §D (network/TLS categories, weighted higher on
build edges), §W (download asymmetry), §S (lock-diff shape).

## What caught it, and what did not

Caught it:

1. `cargo deny` configured to **fail loudly** on yanked dependencies.
2. A **mandatory read-the-diff-before-commit** step the agent could not skip.
   `git diff --stat` showed 33 insertions / 2 deletions in `Cargo.lock` for a
   **patch** bump. Shape, not content, was the tell.
3. Cargo's own stdout already said `Adding proc-macro1 v1.0.107` /
   `Adding ureq v2.12.1` — it took the review step to **act** on it.
4. A halt-and-back-brief escape hatch instead of "try harder".
5. Independent re-verification one level up, against the crates.io API and the
   crate manifest itself — `[dependencies.proc-macro1] version = "1.0.107"` read
   **out of the manifest**, not inferred from the graph.

Did not catch it — the gap this skill closes:

The agent **did** run `cargo update -p arrayref --precise 0.3.10`, and the lock
file **did** move onto the poisoned version. The obvious response to "`cargo deny`
says your dependency is yanked" is "bump to newest" — that walks straight into the
trap. Only the post-hoc diff review saved it. And throughout, the payload was
**inferred from the dependency closure**; **nobody opened the `build.rs`**.

That is the precise capability gap. T3 exists so that reading it is not optional.

## IOCs

Recorded for detection tooling only. **Do not fetch these artefacts.**

```
arrayref     0.3.10   sha256 25ad700976873c76af785cb99b33c48db7df8b81f21d1e9e06b3676b9a9373ae
proc-macro1  1.0.107  sha256 61198155da51b838772eecf5bfaac6cbc4dcc388dccc56658fc28a8e831b34d4
proc-macro1  1.0.106  sha256 b5c1b5b0763a8809a644a8f92224653f0aca623a98eecc714d27f74b80fbe436
network      23.254.165.112:9089 (payload), 23.254.165.112:443 (C2)
dropped      /tmp/rust-setup, %TEMP%\rust-setup.ps1, %TEMP%\rust-setup-launch.vbs
```

Local-cache check, from the rust-lang postmortem's own remediation one-liner:

```
find ~/.cargo/registry/cache -type f \( -name 'arrayref-0.3.10.crate' -o -name 'proc-macro1-*.crate' \)
```

Delete both the `.crate` under `cache/` and the unpacked tree under
`~/.cargo/registry/src/`. If any executing cargo command ran against them, this is
an incident, not a cleanup.
