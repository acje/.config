# OpenCode DB Maintenance

**Status (2026-10-07):** preparation tool installed and fixture-tested; **no live
execution ever performed** — live readiness is unverified. Automatic 30-day
retention is **undelivered**: the launchd job reaches `schedule` only, which
refuses destructively. Session pruning (`apply`) was **RETIRED 2026-10-07**
(config-5to): no deletion route over any target DB exists in this tool.
Launch state is snapshot-recorded history only (never a current runtime claim).

## What this tool does

Offline maintenance under `opencode/maintenance/opencode_db_maintenance.py`,
reached by the daily plist for `schedule` only. It never executes application
delete SQL and never mutates without an explicit operator flag.

| Command | Behaviour |
|---|---|
| `--help` | lists `dry-run`, `migrate`, `schedule` |
| `dry-run --db <PATH> [--backup-dir <DIR>]` | read-only eligibility report (which session trees would be aged); holder inventory. No mutation. |
| `migrate --db <PATH> --offline-confirmation [--backup-dir <DIR>]` | the **only real-DB mutation**: holder check → backup+restore probe → `PRAGMA auto_vacuum = FULL; VACUUM;` → verify persistence + integrity. Data rows are not touched. `--offline-confirmation` is mandatory (argparse rejects its absence). |
| `schedule --db <PATH>` | **refuses destructive execution** (exit 3): a scheduled context cannot prove exclusive offline ownership. |

## Running migrate safely

1. Close every OpenCode instance; holders are checked twice and any holder
   refuses before mutation (exit 2).
2. Run `migrate` with `--offline-confirmation`. A coherent backup plus a
   verified restore probe always precedes VACUUM; fingerprint (every user table,
   all logical columns + schema, rowid-excluded) compares source/backup/probe
   before and source before/after VACUUM. No counts-only fallback — any read or
   verify error refuses before mutation or returns non-zero after, never success.
3. On any failure the error names the **retained backup/probe paths** inside the
   operator-owned reserve `maintenance/backups/` (git-ignored). Restore with
   `sqlite3 target ".restore <retained-backup>"` then verify; never delete a
   retained recovery copy without operator authorisation.

## Limits

- Backup/restore via sqlite3 CLI carries an explicit **120 s timeout**; a larger
  DB may interrupt — documented gap, not a guarantee.
- Backup volume must be the **same filesystem** as the source (rejected
  otherwise, before any write); capacity is sized as coherent source (max of
  file bytes and page_count×page_size) + WAL + backup+restore+VACUUM + 1 GiB
  margin — an approximate bound. SQLite temp-dir capacity is unknowable, so
  `SQLITE_TMPDIR` is scoped to the source parent around SQLite steps.
- FULL-mode VACUUM reclaims freed pages only; it does not recover
  currently-occupied data or partial-page slack.

## History (brief)

- 2026-10-05 (`code-pxb.1`/`code-pxb.2`): preparation contract; tool and plist
  installed, fixture-proven; live DB untouched.
- 2026-10-06 (`sf-sdlc-e5j2`, read-only audit): job registered idle, runs=1,
  last exit 3 (schedule refusal).
- 2026-10-07 (`config-5to`): `apply`/pruning and the native deletion harness
  retired; reserve fully git-ignored; runbook condensed to this truth.
- Detailed evidence, capacity figures and the migration-background fixture
  proofs live in beads `code-i8k`, `code-ppu`, `code-4br`; do not re-derive
  numbers from memory.
