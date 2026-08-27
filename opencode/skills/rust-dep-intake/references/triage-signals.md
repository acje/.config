# T2 — Triage signals

Metadata only. Every command here is VERIFIED non-executing. This tier must be
able to produce a `Halt` on its own.

## API preliminaries (VERIFIED)

The crates.io JSON API **requires a User-Agent** — a request without one returns
403. No auth token is needed once a UA is supplied.

```
UA='rust-dep-intake (contact: <your-email-or-repo>)'
api() { curl -s -A "$UA" "https://crates.io/api/v1/$1"; }
```

The **sparse index** needs neither UA nor auth and returns newline-delimited JSON,
one line per version, with `vers`, `yanked` (bool) and `cksum`.

Sharding rule (VERIFIED with negative controls, config-6sc G5) — lowercase the
name first:

| name length | path | example |
|---|---|---|
| 1 | `/1/{name}` | `/1/a` |
| 2 | `/2/{name}` | `/2/if` |
| 3 | `/3/{name[0]}/{name}` | `/3/g/gcc` |
| ≥4 | `/{name[0:2]}/{name[2:4]}/{name}` | `/li/bc/libc` |

## §Y — Yank history and burst timing

**There is no yank-timestamp API.** VERIFIED/CONTRADICTED (config-ece R4): the
crates.io API exposes per-version `created_at` (publish time) and `yanked` (a bare
boolean). Crate-level `updated_at` is an approximation of "when something last
changed", nothing more. Do not look for, or invent, a yank-time endpoint.

Yank census — which versions are yanked, right now:

```
curl -s https://index.crates.io/li/bc/libc | jq -r 'select(.yanked==true) | .vers'
```

Read the **shape**:

| Shape | Reading |
|---|---|
| One old version yanked, newer clean versions live | Normal churn |
| A contiguous run of recent, previously-good versions yanked, leaving only the newest live | **Halt** — yank-as-delivery |
| Whole crate history yanked | Maintainer withdrawal; investigate, do not auto-bump |

Cross-check against publish times (below): if the newest version was published
within minutes of the yanks, that is one event, not two.

## §P — Publish-timestamp clustering

```
api "crates/<name>" | jq -r '.versions[] | "\(.num)\t\(.created_at)\t\(.yanked)"'
```

`created_at` is the publish timestamp. Cluster it:

- The suspect version published minutes after a dependency it introduces was
  itself first published → **Halt**. (`proc-macro1` 1.0.107 at 07:11:15Z,
  `arrayref` 0.3.10 at 07:15:00Z — under four minutes apart.)
- A publish burst across several unrelated crates by the same owner in one window
  → account compromise shape.
- A crate whose entire version history spans a single day → §O.

## §O — Owner / publisher identity

```
api "crates/<name>/owners"            | jq -r '.users[] | "\(.id)\t\(.login)\t\(.kind)"'
api "crates/<name>/<version>"         | jq -r '.version.published_by.login'
```

Compare `published_by.login` on the **new** version against the login on the
version you currently ship. A change is not automatically malicious, but it is a
signal that must be explained.

Account age proxy: a low-download, brand-new crate published by an account whose
own crates all appeared the same day. `proc-macro1`'s publishing account was
created at 01:25:58Z and published the payload at 07:11:15Z the same day, with the
`name` field forged to impersonate a well-known maintainer.

## §D — New build edges (not merely new nodes)

```
cargo tree -e normal,build --prefix depth      # whole graph incl. build edges
cargo tree -e build                            # build edges only — read this first
cargo tree -i <suspect-crate>                  # who pulled it in
```

**The trigger is a new *edge*, not a new node.** A crate that was already
somewhere in the closure, newly acquired as a `[build-dependencies]` entry of the
crate you just bumped, is exactly as serious as a brand-new crate — and it is
invisible to a node-name delta. Diff the edge set (SKILL.md §T1) before reading
any node list.

Flag by category, not by name list — the category is the mechanism:

| Category | Examples (non-exhaustive) |
|---|---|
| HTTP / network | `ureq`, `reqwest`, `hyper`, `curl`, `isahc`, `attohttpc` |
| TLS | `rustls`, `native-tls`, `openssl`, `ring`, `webpki` |
| Process / FS | `std::process` users, `nix`, `libc` in a pure-logic crate, `tempfile` |
| Encoding | `base64`, `hex`, `flate2` in a crate with no data format to handle |

**A patch-level bump that gives a crate a build-time edge to an HTTP client or a
TLS stack is a `Halt`** — including when that client or stack is already used
elsewhere in your closure. `arrayref` 0.3.9 → 0.3.10 was a patch bump that pulled
in `ureq`, `rustls`, `base64` and `unicode-ident` through one new dependency.

Weight these far higher when the edge is a **build** edge (`cargo tree -e build`)
than a normal one.

## §T — Typosquat, against your own lock file

The important variant: not "is this name close to a famous crate", but **"is this
name one edit away from a crate already in my `Cargo.lock`"**, and **"is it pinned
to the exact version of that crate that I already have"**.

```
grep '^name = ' Cargo.lock | sed 's/name = //;s/"//g' | sort -u > /tmp/lockcrates
# then compare each newly added crate name against that list by edit distance
```

Manual check that catches the real case: for each added crate, ask whether
changing one character, or swapping `-`/`_`, yields a name already in the list.
`proc-macro1` vs `proc-macro2` differs by one character; it was pinned to
`1.0.107` because that was `proc-macro2`'s exact current version in the victim's
lock file, so the added line read as unremarkable.

**Both conditions together are a `Halt` with no further evidence required.**

## §C — Copied identity: description, repository, keywords

```
api "crates/<name>" | jq -r '.crate | "\(.description)\n\(.repository)\n\(.homepage)"'
```

- Description byte-identical to another crate's → impersonation.
- `repository` returns 404 → **Halt**. `proc-macro1` pointed at a nonexistent
  GitHub path under a well-known maintainer's account.
- `repository` newly changed relative to the version you currently ship →
  investigate.
- No repository at all on a crate that claims to be a mature library → investigate.

Confirm the repo link resolves before trusting anything you read there:

```
curl -sI -o /dev/null -w '%{http_code}\n' "<repository-url>"
```

## §W — Download-count asymmetry

```
api "crates/<name>" | jq -r '.crate.downloads'
```

A near-zero-download crate newly attached to a crate with hundreds of millions of
downloads is the attack's economic signature: you do not need anyone to install
your crate, you need one crate everyone already installs to install it for you.
`proc-macro1` had 9 downloads at detection; `arrayref` had ~245M all-time.

Low downloads alone is not a finding — every crate starts at zero. Low downloads
**as a new build-time dependency of a very high-download crate** is.

## §V — Version-number mimicry

A newly added crate whose version number mirrors a crate you already depend on
(same `major.minor.patch`) is chosen to be unremarkable in a lock diff. Combined
with §T it is decisive.

Also: a version number far ahead of the crate's own history (0.1.0 → 1.0.107) with
no corresponding repository activity.

## §S — Lock-diff shape

```
git diff --stat -- Cargo.lock
diff -u Cargo.lock.pre Cargo.lock
```

Judge insertions/deletions **against the size of the version bump**. A patch bump
should move a handful of lines. 33 insertions / 2 deletions for a patch bump is
disproportionate — that was the tell that caught the arrayref incident, and it was
visible before anyone read a single line of crate source.

## Scoring

| Observation | Action |
|---|---|
| All sections negative, no build-time surface changed | `Clear` |
| Nodes moved, nothing above fired, no new build-time surface | `Churn` |
| Any single section positive | `Investigate` → T3 |
| Any hard-stop in SKILL.md §Verdict | `Halt` |
| Two or more sections positive independently | `Halt`, confirmed finding |

**When the delta adds no new node.** §T, §V and §W are all keyed to a *newly
added* crate and go silent when the attacker reuses crates already in your
closure. That silence is not a `Clear`. The sections that still bite are §Y
(yank census), §P (publish clustering), §O (publisher identity) and §D **read as
an edge delta** — plus T3 on any crate whose build-time surface changed. Never
score an all-silent §T/§V/§W as negative evidence; score it as not applicable,
and rely on the edge delta.
