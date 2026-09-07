---
name: repo-closeout
description: "Use ONLY when explicitly invoked to close out a named repository and work scope: verify completed beads, actual PR merges, and a clean synchronized main branch. Not a routine end-of-turn action or authority to bypass protections."
---

# repo-closeout

Produce an evidence-backed closeout snapshot, not a promise of perpetual
synchronization. Loading or editing this skill does not invoke closeout.
Repository instructions, active permissions and mission bounds remain binding.

## Resolve scope and authority before mutation

1. Read repository instructions. Resolve the git root, remote name and URL,
   GitHub `[HOST/]OWNER/REPO`, and the intended main branch. Do not assume
   `origin`, `main`, or the current branch's PR identifies the whole scope.
   Use the tool's `workdir` for that root and quote resolved arguments.
2. Enumerate exact bead IDs/mission labels and all scoped PR IDs/URLs. Record
   base/head branches and stacked relationships; trace the stack through to
   main. A child PR merged into an unmerged parent is not delivered to main.
   An unexplained empty inventory or ambiguous scope blocks completion.
3. Record authority separately for commit, push, normal merge, main switching,
   fast-forward synchronization and scoped Cargo artifact cleanup. Explicit
   invocation is not blanket
   authority for unrelated work or destructive cleanup. Use only explicit or
   applicable repository/mission authority; missing authority blocks that step.
   Admin bypass needs the exact authorization check below; ask through the
   question tool only when matching explicit authorization is absent.
4. Inspect `git status --porcelain=v1 --untracked-files=all`, staged and unstaged
   diffs, `git stash list`, `git worktree list --porcelain`, upstreams and
   ahead/behind state. Inspect relevant other worktree status without modifying
   it. Preserve unrelated tracked/untracked files, stashes and worktrees.
   Dirty unrelated work blocks the clean-tree claim: never reset, clean,
   discard, force push, or stash-to-hide. Do not delete branches automatically.
   Existing unrelated stashes/worktrees may remain, explicitly reported as
   preserved exclusions; never claim they were cleaned. If main is occupied in
   another worktree, resolve that location/authority instead of forcing a switch.
5. Probe installed `gh pr view --help` and `gh pr merge --help`, available JSON
   fields, and authentication for the resolved host. Missing tools, auth,
   denied reads or unavailable remote probes mean blocked/unknown, not no work.
   Do not install tools or change permissions as a closeout workaround.

## Verify the scoped beads

Run `bd where` and pin the intended repository with the supported CLI mechanism;
confirm the returned workspace identity, not just exit 0. Follow repository
database-discovery rules; never create a home/non-repository store. Read CLI
help and actual store configuration before any synchronization; do not guess
a Beads sync command or assume git push persists its database.

Read every scoped task and its completion evidence, including dependency and
review state. Closed status without supporting verification is insufficient.
Run the repository/mission's actual verification entries, including declared
E2E and local CI entry points, or cite still-applicable evidence tied to the
exact commit and scope. Stale/missing evidence and unfinished beads block
completion. Unfinished tasks must remain open and block closeout; do not close
tasks just to make the inventory empty. Close genuinely completed scoped tasks
within authority and verify their actual closed state. If closure authority is
missing, hand back rather than claiming completion. Leave epic GC to its
assigned owner, then verify that owner's GC evidence and the resulting scoped
epic closure state before final success. Pending GC blocks final closeout;
if no epic is in scope, record that resolved fact rather than inventing one.
Record unavailable store/sync capabilities and whether they block the required
durability contract; local closure alone is not proof of remote persistence.

## Verify and merge each scoped PR

Use explicit PR identities and `--repo` on every `gh` PR command. After resolving
placeholders, the read-only evidence query is:

```sh
gh pr view "<PR>" --repo "<HOST/OWNER/REPO>" --json number,url,state,baseRefName,headRefName,headRefOid,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,autoMergeRequest,mergedAt,mergeCommit
```

Read checks/reviews and required policy, not merely an aggregate status or an
empty check list. Confirm the verified commit equals `headRefOid`, the base is
intended, and stack dependencies are satisfied. Unknown mergeability, failed
or pending checks, draft status, requested changes, absent policy evidence and
unexpected base/head changes block normal merge readiness. Process the stack
in dependency order; re-read/re-verify affected PRs after any base/head change.
Do not silently retarget or rebase the stack as a closeout shortcut.

When normal merge is authorized, choose the repository-approved strategy from
installed help (or its merge-queue workflow) and bind it to the verified head:

```sh
gh pr merge "<PR>" --repo "<HOST/OWNER/REPO>" --match-head-commit "<VERIFIED_HEAD_SHA>" <APPROVED_STRATEGY_OR_QUEUE_FLAGS>
```

Placeholders are not executable shell syntax; replace them with resolved,
quoted values and supported flags. Never add `--delete-branch`. Never infer
success from this command's exit alone: `--auto` or a required queue may only
schedule the merge. Poll PR state with a declared finite deadline and interval;
on expiry report pending, not complete. `CLOSED` without merge is not `MERGED`.

### Admin bypass: separate, exact approval

Before any `--admin` attempt, first inspect recorded explicit authorization for
this repository, PR number/URL, current verified head SHA, and the exact
protections or queue bypass. If that matching authorization already exists and
has not been withdrawn, retain and cite it in the existing mission/evidence
bead without asking again. Blanket permission, skill invocation or approval of
another PR, head or bypass is insufficient.

Only when matching explicit authorization is absent, use the **question tool**
to ask about that exact repository/PR/head/bypass, showing current checks,
reviews and consequences. Require an affirmative answer and record it in the
existing mission/evidence bead. Do not ask through shell prompts. When new
approval is needed, an unavailable or denied question tool, an unanswered
question or refused approval blocks admin bypass: hand back the missing
authority/capability and do not attempt another bypass route. Question-tool
unavailability alone does not invalidate an existing matching authorization.

Approval does not override active tool policy or the mission's verification
requirements. Immediately re-read PR state and head before the attempt; changed
head invalidates the prior approval and requires renewed verification and
authorization for the new head through the same check above. Use `--repo` and
`--match-head-commit` even with approved `--admin`; poll for actual merge evidence
as for normal merges.

## Synchronize main without discarding work

After every scoped PR is actually `MERGED`, record its URL, verified head,
`mergedAt` and `mergeCommit.oid`; absent fields leave evidence incomplete.
Confirm the full stack's resulting changes reached the intended main, not
just a side base branch. Do not require feature-head ancestry for squash/rebase
merges; use the actual merge result and final stack delivery evidence.

Only with a clean target worktree and switching/synchronization authority:

1. Fetch the resolved main branch from the intended remote; capture the producer
   status and verify the remote-tracking ref was actually updated. A failed
   fetch leaves cached refs stale and blocks the synchronization claim.
2. Inspect local main versus that fresh remote-tracking main. Divergence or
   local-only commits block closeout. Never blind-pull, rebase or reset main.
3. Switch to the resolved main in its authorized worktree. Confirm its upstream
   identifies the intended remote/main; an incorrect/missing upstream blocks
   until a separately authorized correction. Fast-forward only, using
   `git merge --ff-only "<REMOTE>/<MAIN>"` when behind. Equal needs no merge.
4. Refresh remote evidence after synchronization: successfully fetch again and
   query `git ls-remote --exit-code "<REMOTE>" "refs/heads/<MAIN>"`. Require one
   matching branch record; command failure or missing/ambiguous output is unknown.
   Compare local HEAD, local main, fresh remote-tracking main and this advertised
   SHA: all must be equal. Record
   `git rev-list --left-right --count "<MAIN>...<REMOTE>/<MAIN>"` as `0 0`.
   If the remote moved, retry only within the declared deadline or report partial.
5. Recheck branch/upstream and `git status --porcelain=v1 --untracked-files=all`:
   the branch must be main and status empty, including untracked files. Keep
   stash/worktree exclusions visible; do not turn them into cleanup targets.

## Clean authorized Cargo artifacts after verification

This phase requires its own resolved cleanup authority; invoking closeout does
not authorize deletion of unrelated or shared artifacts. Retain build/test/E2E
commands, exits, commit identities and results in durable evidence first.
Complete all required verification, including any post-sync checks on final
main, before cleanup. A later build/test or other artifact-producing command
invalidates the cleanup snapshot: resolve scope again and repeat an authorized
cleanup pass after that command before claiming success.

1. Inventory Cargo manifests/workspaces throughout the named repository/work
   scope, including nested independent workspaces and relevant worktrees. Do
   not infer non-Cargo from a missing root `Cargo.toml`. Record inspected scope
   and exclusions; inaccessible paths or an incomplete inventory are Unknown.
   NotApplicable requires confirmed absence of Cargo workspaces across scope.
2. For every workspace and each build context used by verification, record
   cwd, toolchain, manifest, effective environment, Cargo config and CLI
   overrides. Inspect installed help for that toolchain. Where supported, use
   `cargo metadata --frozen --no-deps --format-version 1` with the matching cwd,
   toolchain, explicit manifest and applicable configuration; capture producer
   exit and parseable output. Failed probes are Unknown, not absence. Do not
   drop frozen/offline constraints, mutate a lockfile, install a toolchain or
   enable network access to make discovery succeed.
3. Resolve `workspace_root`, effective target directories and any distinct
   build directory/layout supported by that toolchain. Reconcile metadata
   `target_directory` with actual build CLI `--target-dir` overrides,
   `CARGO_TARGET_DIR`, config and invocation context; metadata alone does not
   prove where every build wrote. Record every distinct location, including
   external ones. Unsupported or unresolved layout/overrides are Unknown and
   block cleanup, not grounds to assume `<repo>/target`.
4. Resolve aliases/symlinks to canonical paths and inspect contents and
   ownership before deletion. Reject filesystem/home/repository/workspace
   roots, their ancestors, source-bearing directories and mixed non-artifact
   contents. Gitignore, a clean git status, a directory named `target`, a
   successful metadata probe, `-p`, and dry-run output are not ownership proof.
   Identify other repositories/worktrees using shared or external locations.
   Unknown ownership is Unknown; known unrelated/shared artifacts require
   explicit authority for their exact scope and consequences, otherwise
   Blocked. External paths must be proven artifact-only and authorized too.
   Do not use package selection as a substitute for that proof.
5. Pin the inspected workspace/context and canonical deletion scope immediately
   before execution; ensure concurrent builds/writers cannot change that scope
   during cleanup. Changed paths, contents or ownership require renewed
   inspection/authority; inability to establish a stable scope blocks cleanup.
   Use only supported `cargo clean` options in that exact context, explicitly
   selecting the resolved manifest and target directory where supported.
   Account for distinct build directories too; unresolved deletion semantics
   block execution. Unqualified clean can delete the entire target directory,
   including unrelated files. If installed help supports preview, inspect it
   first, but preview is not cleanup success or authorization. Never substitute
   `rm`, `git clean`, cache-wide deletion or a permission workaround.
6. Capture each clean command, exact scope, exit and observed artifact state.
   A nonzero clean exit is Blocked even after partial deletion; record residue.
   Missing/error evidence is Unknown. Require exit 0 plus read-only confirmation
   of the intended artifact removal for every resolved Cargo scope before
   Cleaned; an already-empty authorized scope still needs a successful clean
   pass and confirmation. Narrow profile/package/target options cannot justify
   a whole-workspace cleanup claim. Recheck git status without rebuilding;
   unexpected source/lockfile changes block closeout, never reset them away.

## Report the snapshot

Capture command exits and observable results, preserving producer status for
any filtered output (`set -o pipefail;` per repository bash hygiene). A filter's
success is not a producer verdict. Missing/error evidence is never negative
domain evidence.

Report repository/remote/main and scope; verification commands and exits;
bead completion/evidence and persistence limitations; each PR's actual state,
`mergedAt` and merge SHA; main/upstream, compared SHAs, `0 0` divergence and
empty status; preserved unrelated state; UTC observation time and polling
deadline. Final success requires all genuinely completed scoped task beads
actually closed, verified responsible-owner epic GC and scoped epic closure
(or documented no-epic scope), as well as all PR/main conditions above. Evidence
read without those resulting states is insufficient. Otherwise report
blocked/partial with exact remaining work, not a clean closeout.

Include a per-workspace/context cleanup record: canonical target/build paths,
ownership evidence, authorization, commands/exits, remaining artifacts and UTC
observation time. Report `Cleaned` only when every scoped Cargo cleanup passed
after the last artifact-producing verification; `NotApplicable` only for a
confirmed non-Cargo scope. Otherwise report `Blocked` (known failed clean,
unsafe scope or missing authority) or `Unknown` (unresolved scope/ownership,
failed probe or incomplete evidence), with exact remaining work. Partial
cleanup is not Cleaned. Overall closeout success requires Cleaned for every
Cargo scope, or justified NotApplicable, in addition to all bead/PR/main gates;
clean git status alone cannot establish artifact cleanup.

Store cross-agent evidence in the existing bead workflow. Under fleet doctrine,
handoff to moltke for gardener and final reporting; this skill does not replace
role ownership. Skill-file edits require an opencode restart to take effect;
static review is not evidence of live loading or execution of this workflow.
