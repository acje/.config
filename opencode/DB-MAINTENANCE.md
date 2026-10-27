# OpenCode DB Maintenance

**Status (2026-10-27):** the daily launchd job now runs `vacuum` — a
holder-gated, fail-closed, data-preserving freelist reclaim — against the real
DB every day at 03:05. Root cause: opencode's `background_compaction` deletes
rows, but the DB was created with `auto_vacuum=NONE`, so freed pages were never
returned to the filesystem — an ~164 GB freelist. `vacuum` enables INCREMENTAL
auto_vacuum and reclaims the freelist via the INCREMENTAL `incremental_vacuum`
path with a full-`VACUUM` fallback that guarantees reclaim; it is safe to run
unattended. `migrate` is superseded for freelist shrink by `vacuum` (still
present). `schedule` remains refusal-only, retained for diagnostics. Launch
state is snapshot-recorded history only (never a current runtime claim).

## What this tool does

Offline maintenance under `opencode/maintenance/opencode_db_maintenance.py`,
reached by the daily plist for `vacuum`. It never executes application delete
SQL and never mutates without a holder-clear inventory (fail-closed on
inconclusive lsof).

| Command | Behaviour |
|---|---|
| `--help` | lists `dry-run`, `migrate`, `schedule`, `vacuum` |
| `dry-run --db <PATH> [--backup-dir <DIR>]` | read-only eligibility report (which session trees would be aged); holder inventory. No mutation. |
| `vacuum --db <PATH>` | **durable scheduled reclaim**: holder-gated first (fail-closed on inconclusive lsof). On NONE mode records `PRAGMA auto_vacuum=INCREMENTAL` then `incremental_vacuum`; on INCREMENTAL mode `incremental_vacuum` only; on FULL mode the cheap pass is skipped. If any material freelist remains, a full `VACUUM` fallback fires (re-recording INCREMENTAL in the same connection so a NONE DB converts) and guarantees reclaim. Data rows are not touched; no backup step — data-preserving by design, so no `--offline-confirmation` is required and it is schedulable. POST-verify is fail-closed: `integrity_check == "ok"` AND final freelist decreased (or already zero), else exit 4. |
| `migrate --db <PATH> --offline-confirmation [--backup-dir <DIR>]` | **superseded for freelist shrink** by `vacuum` (still present): holder check → backup+restore probe → `PRAGMA auto_vacuum = FULL; VACUUM;` → verify persistence + integrity. A ~170 GB file whose ~164 GB is freelist. Its sqlite3-CLI `.backup/.restore` probe carries a **120 s timeout** that cannot span a DB that large, and its full-mode POST-verify can fail on non-empty NONE DBs. Keep it offline-confirmed and operator-explicit. |
| `schedule --db <PATH>` | **refuses destructive execution** (exit 3): retained for diagnostics; the daily job no longer reaches it. |

## Running vacuum

1. `vacuum` is the durable path and what the daily job runs. It is
   holder-gated (fail-closed on inconclusive lsof) and data-preserving, so it
   needs no `--offline-confirmation` and no backup step.
2. The first run on the current NONE-mode DB performs a full `VACUUM` (the
   cheap INCREMENTAL path alone cannot reclaim a pre-existing NONE freelist),
   reclaiming the ~164 GB and converting the header to INCREMENTAL. Later runs
   reclaim cheaply where freed pages are tail-contiguous, with the full-`VACUUM`
   fallback as the guarantee.
3. To finish the header conversion promptly with OpenCode closed, an operator
   may run the one-time shrink command in the next section; the daily job
   reaches the same end state on its own schedule.

## Operator one-time shrink command

With every OpenCode instance closed, run:

```
/usr/bin/sqlite3 ~/.local/share/opencode/opencode.db "PRAGMA auto_vacuum=INCREMENTAL; VACUUM; PRAGMA integrity_check;"
```

This converts the header to INCREMENTAL, fully compacts (frees the ~164 GB
freelist), and verifies integrity (`ok`).

## Running migrate safely

1. Close every OpenCode instance; `migrate` checks holders twice and any
   holder refuses before mutation (exit 2).
2. `migrate` is superseded for freelist shrink — prefer `vacuum`. If you still
   run it: `--offline-confirmation` is mandatory; a coherent backup plus a
   verified restore probe always precedes VACUUM.
3. On any failure the error names the **retained backup/probe paths** inside
   the operator-owned reserve `maintenance/backups/` (git-ignored). Restore
   with `sqlite3 target ".restore <retained-backup>"` then verify; never delete
   a retained recovery copy without operator authorisation.

## Limits

- `vacuum`: in this stdlib runtime each `incremental_vacuum` call removes at
  most a single freelist page, so the cheap path alone is not a full reclaim —
  the full-`VACUUM` fallback runs whenever any material freelist remains. The
  cheap path is a pre-step, not a guarantee, by design.
- `migrate`: backup/restore via sqlite3 CLI carries an explicit **120 s
  timeout**; a larger DB may interrupt — documented gap, not a guarantee, and
  the reason `vacuum` supersedes it for freelist shrink.
- Backup volume must be the **same filesystem** as the source (rejected
  otherwise, before any write); capacity is sized as coherent source (max of
  file bytes and page_count×page_size) + WAL + backup+restore+VACUUM + 1 GiB
  margin — an approximate bound. SQLite temp-dir capacity is unknowable, so
  `SQLITE_TMPDIR` is scoped to the source parent around SQLite steps.
- FULL-mode VACUUM reclaims freed pages only; it does not recover
  currently-occupied data or partial-page slack.
