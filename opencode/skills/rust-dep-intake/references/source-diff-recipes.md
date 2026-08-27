# T4 — Source diff recipes

All VERIFIED end to end (config-6sc G4). No special tool is required: `curl`,
`tar`, `diff`, `git` and `jq` suffice. `cargo-crev` and web services such as
diff.rs are not needed for any recipe here.

Nothing in this file executes crate code. Extraction is inert.

## (a) Published version vs published version

Use when a crate you already ship changed version.

```
name=once_cell; old=1.20.2; new=1.20.3
curl -sSL -o "$name-$old.crate" "https://static.crates.io/crates/$name/$name-$old.crate"
curl -sSL -o "$name-$new.crate" "https://static.crates.io/crates/$name/$name-$new.crate"
mkdir -p a b
tar -xzf "$name-$old.crate" -C a
tar -xzf "$name-$new.crate" -C b
diff -ru "a/$name-$old" "b/$name-$new"
```

Facts this recipe depends on, all verified:

- The `static.crates.io` URL shape works with a plain GET and **no User-Agent**
  (unlike the crates.io JSON API, which 403s without one).
- A `.crate` file is a gzipped tar containing exactly **one** top-level directory,
  `<name>-<version>/`. Diff the versioned subdirectories, not the extraction roots.

Read the diff in this order: `Cargo.toml` (dependency table first), then any
`build.rs`, then `src/`. A dependency added in `Cargo.toml` is more decisive than
a thousand lines of `src/` churn.

## (b) Published tarball vs upstream git

Use when the crate is new to you, or when (a) shows something you want to check
against the public repo.

**The tarball self-identifies its upstream commit.** Every published `.crate`
contains `.cargo_vcs_info.json`:

```json
{ "git": { "sha1": "d119eeade59cd7e47b7abf979488b0be1d5b2d79" }, "path_in_vcs": "" }
```

This removes all guesswork about which commit to compare against — no tag
matching, no trusting a release tag that could itself have been moved.

```
sha=$(jq -r .git.sha1 "b/$name-$new/.cargo_vcs_info.json")
mkdir gitsrc && cd gitsrc
git init -q .
git remote add origin https://github.com/<owner>/<repo>.git
git fetch -q --depth 1 origin "$sha"
git checkout -q FETCH_HEAD
cd ..
diff -rq "b/$name-$new" gitsrc -x .git
```

A `--depth 1` fetch of an explicit sha works; no full clone is needed.

### The benign baseline — memorise this shape

On a KNOWN-GOOD crate the output looks like:

```
Only in tarball: .cargo_vcs_info.json      <- cargo-generated
Only in tarball: Cargo.lock                <- cargo-generated
Only in tarball: Cargo.toml.orig           <- cargo-generated (pre-normalization)
Only in git:     <docs, xtask, rustfmt.toml, assets, ...>
Files Cargo.toml differ                    <- cargo normalizes the manifest
```

Interpretation rules:

| Observation | Reading |
|---|---|
| Tarball-exclusive: exactly `.cargo_vcs_info.json`, `Cargo.lock`, `Cargo.toml.orig` | Expected; benign |
| **Any other tarball-exclusive file** | **Red flag** — the published artefact contains code absent from the public repo |
| Git-exclusive files | Normal (`include`/`exclude`/`.gitignore`); not suspicious by itself |
| `Cargo.toml` differs | Always. Cargo normalizes the manifest — diff it by content |

`Cargo.toml` is where `arrayref` 0.3.10 hid its `proc-macro1` dependency. Read the
dependency tables (`[dependencies]`, `[build-dependencies]`, `[dev-dependencies]`,
and any `[target.*.dependencies]`) explicitly, from the manifest, rather than
inferring them from the graph.

Note that a *malicious repository* defeats this recipe: matching the upstream
commit proves the tarball matches the repo, not that either is trustworthy. It
catches the "published artefact diverges from public source" shape only.

## (c) Whole-closure diff via vendoring

Use when many crates moved at once.

```
git stash                                    # or check out the pre-bump lock
cargo vendor vendor_before >/dev/null
git stash pop
cargo vendor vendor_after  >/dev/null
diff -ru vendor_before vendor_after | less
```

`cargo vendor` is VERIFIED non-executing. Restrict attention to `build.rs`,
`Cargo.toml`, and proc-macro `src/` first:

```
diff -rq vendor_before vendor_after | rg 'build\.rs|Cargo\.toml'
```

## (d) New crate with no prior version

There is nothing to diff. Review the whole crate:

1. `Cargo.toml` — every dependency table, `build`, `links`, `[lib] proc-macro`.
2. `build.rs` if present — full read, `build-script-review.md` catalogue.
3. `src/` — proportional to what the crate claims to do. A crate that claims to
   be small and is not is itself a signal.
4. Recipe (b) against upstream git.

## Sparse-index reference (shared with triage)

Verified sharding, for pulling the version/yank census during a diff session:

| name length | path | example |
|---|---|---|
| 1 | `/1/{name}` | `/1/a` |
| 2 | `/2/{name}` | `/2/if` |
| 3 | `/3/{name[0]}/{name}` | `/3/g/gcc` |
| ≥4 | `/{name[0:2]}/{name[2:4]}/{name}` | `/li/bc/libc` |

Negative controls confirmed the rule is the rule and not a redirect artefact:
`/a/a`, `/if/if`, `/gc/c/gcc` all return 404. Lowercase the crate name and apply
cargo's `-`/`_` normalization before sharding.

```
curl -s https://index.crates.io/li/bc/libc | jq -r 'select(.yanked==true) | .vers'
```
