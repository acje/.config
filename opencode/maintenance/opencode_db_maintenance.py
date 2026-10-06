#!/usr/bin/env python3
"""OpenCode DB offline maintenance: migration + retention tooling.

Session pruning was retired (the `apply` subcommand and native fixture
harness were removed); no deletion route over an arbitrary target DB remains.
The retained surface is read-only eligibility (`dry-run`), the sole real-DB
mutation `migrate` (auto_vacuum FULL + VACUUM, requiring --offline-confirmation
and a holder-free process inventory that FAILS CLOSED on inconclusive lsof),
and refusal-only `schedule`.

Backup/restore verification is a REQUIRED logical fingerprint over every user
table (all logical columns, ordered by all logical columns — rowid-excluded,
so VACUUM renumbering and WITHOUT ROWID tables are handled) plus the schema
definition. There is no counts-only fallback: any read/verification error
refuses before mutation or yields non-zero after — never success. Capacity is
checked against the same-filesystem backup volume using a coherent source
size (max of file bytes and page_count*page_size plus WAL bytes) for
source+backup+restore+VACUUM; backup directories that are symlinks are
rejected before any chmod. SQLite temp-dir capacity is unknowable, so
SQLITE_TMPDIR is scoped to the source parent around sqlite operations.
Scheduled mode (schedule) refuses destructive execution. This tool never
executes application delete SQL itself. Table membership decisions read
sqlite_schema explicitly; a query error on a schema-present table
propagates as a failure, never a clean result.
"""

import argparse
import hashlib
import os
import secrets
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

DAY_MS = 86_400_000
DEFAULT_RETENTION_DAYS = 30
MARGIN_BYTES = 1_073_741_824  # 1 GiB conservative operational margin
NATIVE_TIMEOUT_SECONDS = 120
FIXED_VERIFY_TABLES = ("session", "message", "part", "event",
                       "event_sequence", "project")


class MaintenanceError(Exception):
    """A fail-closed precondition was not met."""


def now_ms():
    return int(time.time() * 1000)


def cutoff_ms(days=DEFAULT_RETENTION_DAYS):
    return now_ms() - days * DAY_MS


def _ro_connect(db_path):
    path = str(Path(db_path).resolve())
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def _qid(ident):
    return '"' + ident.replace('"', '""') + '"'


def load_sessions(db_path):
    conn = _ro_connect(db_path)
    try:
        rows = conn.execute(
            "SELECT id, parent_id, time_created FROM session"
        ).fetchall()
        return {rid: {"parent": pard, "created": created}
                for rid, pard, created in rows}
    finally:
        conn.close()


def _schema_table_names(conn):
    """Explicit membership via sqlite_schema (tables and views). Absence here
    is the ONLY reason a fixture-optional table may be skipped; presence of a
    broken table/view must surface as a query error, not a clean skip."""
    rows = conn.execute(
        "SELECT name FROM sqlite_schema WHERE type IN ('table','view')"
    ).fetchall()
    return {r[0] for r in rows}


def _table_counts(db_path, readonly=False):
    """Counts for FIXED_VERIFY_TABLES present in sqlite_schema (diagnostic
    only — never a verification fallback). An error querying a
    schema-present table propagates as MaintenanceError."""
    mode = "ro" if readonly else "rw"
    conn = sqlite3.connect(f"file:{str(Path(db_path).resolve())}?mode={mode}",
                           uri=True)
    try:
        present = _schema_table_names(conn)
        return {t: conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
                for t in FIXED_VERIFY_TABLES if t in present}
    except sqlite3.OperationalError as exc:
        raise MaintenanceError(
            f"table count failed on schema-present table: {exc}") from exc
    finally:
        conn.close()


def compute_eligible_roots(sessions, cutoff):
    """Return (eligible, retained) where eligible is [(root, members)] and
    retained is [members] for preserved components."""
    children = {sid: [] for sid in sessions}
    for sid, rec in sessions.items():
        p = rec["parent"]
        if p is not None and p in sessions:
            children[p].append(sid)

    eligible = []
    retained = []
    seen = set()
    for start in sorted(sessions):
        if start in seen:
            continue
        component = set()
        stack = [start]
        while stack:
            node = stack.pop()
            if node in component:
                continue
            component.add(node)
            parent = sessions[node]["parent"]
            if parent is not None and parent in sessions:
                stack.append(parent)
            stack.extend(children.get(node, []))

        root = None
        clean = True
        for member in component:
            parent = sessions[member]["parent"]
            if parent is None:
                if root is not None:
                    clean = False
                root = member
            elif parent not in sessions:
                clean = False
        seen.update(component)
        if not clean or root is None:
            retained.append(sorted(component))
            continue
        if max(sessions[m]["created"] for m in component) < cutoff:
            eligible.append((root, sorted(component)))
        else:
            retained.append(sorted(component))
    return eligible, retained


def check_holders(db_path):
    """Return (pids, unknown). unknown=True means lsof was inconclusive and
    destructive steps must refuse (fail closed). Only existing files are
    queried; an erroring lsof (rc 1 with stderr, or any other rc) is UNKNOWN,
    never treated as no-holders."""
    db_path = str(Path(db_path).resolve())
    targets = [p for p in (db_path, db_path + "-wal", db_path + "-shm")
               if os.path.exists(p)]
    if not targets:
        return [], False
    try:
        completed = subprocess.run(
            ["/usr/sbin/lsof", "-nP", "-t", *targets],
            capture_output=True, text=True, timeout=20,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return [], True
    if completed.returncode == 0:
        pids = [ln.strip() for ln in completed.stdout.splitlines() if ln.strip()]
        return pids, False
    if completed.returncode == 1 and not completed.stderr.strip():
        return [], False
    return [], True


def free_bytes(path):
    st = os.statvfs(path)
    return st.f_bavail * st.f_frsize


def coherent_db_bytes(db_path):
    """Conservative coherent size of a possibly-WAL DB: max(file bytes,
    page_count*page_size) plus WAL bytes when present. Approximate bound, not
    a universal guarantee."""
    src = os.path.getsize(db_path)
    try:
        page_count = single_value(db_path, "PRAGMA page_count") or 0
        page_size = single_value(db_path, "PRAGMA page_size") or 0
    except (sqlite3.Error, OSError):
        page_count = page_size = 0
    coherent = max(src, page_count * page_size)
    if os.path.exists(db_path + "-wal"):
        coherent += os.path.getsize(db_path + "-wal")
    return coherent


def require_capacity(db_path, backup_dir):
    """Capacity seam: backup volume must be the same filesystem as the source
    (checked by the caller before any write); size the aggregate
    source+backup+restore+VACUUM from the coherent source size."""
    src_dev = os.stat(db_path).st_dev
    if os.stat(backup_dir).st_dev != src_dev:
        raise MaintenanceError(
            "backup must live on the same filesystem as the source DB; "
            "refusing before any write")
    coherent = coherent_db_bytes(db_path)
    free = free_bytes(backup_dir)
    need = 4 * coherent + MARGIN_BYTES
    if free < need:
        raise MaintenanceError(
            f"capacity: free={free} < required={need} "
            f"(coherent source={coherent}; source+backup+restore+VACUUM "
            f"+{MARGIN_BYTES} margin)"
        )
    return src_dev, free, need


def _sqlite(args, readonly=False, tmpdir=None):
    invoked = ["/usr/bin/sqlite3"]
    if readonly:
        invoked.append("-readonly")
    invoked.extend(args)
    env = os.environ.copy()
    if tmpdir:
        env["SQLITE_TMPDIR"] = tmpdir
    completed = subprocess.run(invoked, capture_output=True, text=True,
                               timeout=NATIVE_TIMEOUT_SECONDS, env=env)
    if completed.returncode != 0:
        raise MaintenanceError(
            f"sqlite3 rc={completed.returncode}: {completed.stderr.strip()}"
        )
    return completed.stdout


def _sqlite_quoted(path):
    return "'" + str(path).replace("'", "''") + "'"


def _reserve_exclusive(path):
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW,
                 0o600)
    os.close(fd)


def _user_table_names(db_path):
    conn = _ro_connect(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_schema WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()


def _schema_definition(db_path):
    """Ordered schema-definition snapshot (tables, indexes, views, triggers)
    as a nested tuple; part of the logical fingerprint so schema changes are
    detected (column adds, index changes, rebuilds)."""
    conn = _ro_connect(db_path)
    try:
        rows = conn.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_schema "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"
        ).fetchall()
        return tuple(tuple(r) for r in rows)
    finally:
        conn.close()


def logical_fingerprint(db_path):
    """Streaming logical fingerprint over every user table: per-table sha256 of
    ALL logical columns (ordered by ALL logical columns), excluding rowid
    entirely, so VACUUM rowid renumbering and WITHOUT ROWID tables are handled.
    Read in bounded batches (constant memory, no table materialised, no row
    contents emitted). The schema definition is included in the fingerprint.
    Returns {table: (digest, row_count), "_schema_": digest}. A query error on
    a schema-present table raises MaintenanceError — never a clean result."""
    conn = _ro_connect(db_path)
    current = None
    out = {}
    try:
        for table in _user_table_names(db_path):
            current = table
            cols = [r[1] for r in conn.execute(
                "PRAGMA table_info('" + table.replace("'", "''") + "')")]
            if not cols:
                raise MaintenanceError(
                    f"fingerprint: table {table!r} has no logical columns")
            idents = ", ".join(_qid(c) for c in cols)
            cur = conn.execute(
                f"SELECT {idents} FROM {_qid(table)} ORDER BY {idents}")
            h = hashlib.sha256()
            total = 0
            while True:
                batch = cur.fetchmany(512)
                if not batch:
                    break
                for row in batch:
                    h.update(repr(tuple(row)).encode("utf-8", "surrogatepass"))
                    total += 1
            out[table] = (h.hexdigest(), total)
    except sqlite3.OperationalError as exc:
        raise MaintenanceError(
            f"fingerprint failed on table {current}: {exc}") from exc
    finally:
        conn.close()
    schema_rows = _schema_definition(db_path)
    h = hashlib.sha256()
    for row in schema_rows:
        h.update(repr(row).encode("utf-8", "surrogatepass"))
    out["_schema_"] = h.hexdigest()
    return out


def backup_and_probe(db_path, backup_dir):
    """Runbook-coherent .backup plus verified restore probe. Exclusive random
    name, private 0700/0600 files; refuses pre-existing names via O_EXCL and
    any symlink via O_NOFOLLOW; the backup DIRECTORY itself must not be a
    symlink (rejected before chmod); quoted sqlite CLI paths; capacity gated
    on a same-filesystem backup volume. Verification is a REQUIRED logical
    fingerprint over every user table + schema, source vs backup vs probe —
    no counts-only fallback; any fingerprint error refuses. SQLite CLI steps
    scope SQLITE_TMPDIR to the source parent. Returns
    (backup_path, backup_counts, probe_counts, src_fp)."""
    print("[backup] WARNING: sqlite3 CLI .backup/.restore carry an explicit "
          "120s timeout; a DB larger than that window may be interrupted — "
          "documented gap, not a usable guarantee.", file=sys.stderr)
    os.makedirs(backup_dir, mode=0o700, exist_ok=True)
    if os.path.islink(backup_dir):
        raise MaintenanceError("backup directory must not be a symlink; "
                               "refusing before chmod")
    require_capacity(db_path, backup_dir)
    os.chmod(backup_dir, 0o700)
    src_parent = str(Path(db_path).resolve().parent)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup_path = Path(backup_dir) / f"opencode.db-{stamp}-{secrets.token_hex(4)}.bak"
    probe_path = Path(backup_dir) / f"opencode.db-{stamp}-{secrets.token_hex(4)}.probe"

    try:
        _reserve_exclusive(backup_path)
        _reserve_exclusive(probe_path)
        _sqlite([db_path, f".backup {_sqlite_quoted(backup_path)}"],
                tmpdir=src_parent)
        os.chmod(backup_path, 0o600)
        _sqlite([str(probe_path), f".restore {_sqlite_quoted(backup_path)}"],
                tmpdir=src_parent)
        os.chmod(probe_path, 0o600)
    except FileExistsError as exc:
        raise MaintenanceError(f"backup name collision: {exc}") from exc

    backup_out = _sqlite([str(backup_path),
                          "PRAGMA integrity_check; SELECT count(*) FROM session;"],
                         readonly=True, tmpdir=src_parent)
    probe_out = _sqlite([str(probe_path),
                         "PRAGMA integrity_check; SELECT count(*) FROM session;"],
                        tmpdir=src_parent)
    backup_lines = [ln.strip() for ln in backup_out.splitlines()]
    probe_lines = [ln.strip() for ln in probe_out.splitlines()]
    backup_ok = backup_lines[0].lower() == "ok"
    probe_ok = probe_lines[0].lower() == "ok"
    backup_n = int(backup_lines[-1])
    probe_n = int(probe_lines[-1])
    backup_counts = _table_counts(backup_path, readonly=True)
    probe_counts = _table_counts(probe_path)
    if not (backup_ok and probe_ok and backup_n == probe_n
            and backup_counts == probe_counts):
        raise MaintenanceError(
            "backup restore probe failed: coherent snapshot not established; "
            f"retained backup: {backup_path}; retained probe: {probe_path}"
        )

    src_fp = logical_fingerprint(db_path)
    bak_fp = logical_fingerprint(str(backup_path))
    probe_fp = logical_fingerprint(str(probe_path))
    if not (bak_fp == src_fp == probe_fp):
        raise MaintenanceError(
            "backup restore probe failed: logical fingerprint mismatch across "
            f"source/backup/probe; retained backup: {backup_path}; "
            f"retained probe: {probe_path}")

    os.remove(probe_path)
    for sidecar in (f"{probe_path}-wal", f"{probe_path}-shm"):
        if os.path.exists(sidecar):
            os.remove(sidecar)
    return backup_path, backup_counts, probe_counts, src_fp


def print_summary(label, db_path, cutoff, sessions, eligible, retained):
    print(f"[{label}] db={db_path}")
    print(f"[{label}] cutoff_ms={cutoff} sessions={len(sessions)}")
    print(f"[{label}] eligible_root_trees={len(eligible)} "
          f"eligible_members={sum(len(m) for _, m in eligible)}")
    for root, members in eligible:
        print(f"[{label}] eligible root={root} members={','.join(members)}")
    print(f"[{label}] retained_components={len(retained)} "
          f"retained_members={sum(len(m) for m in retained)}")


def _refuse_holders(label, pids, unknown):
    if unknown:
        print(f"[{label}] REFUSED: holder check inconclusive (lsof error/"
              f"timeout); offline ownership unknown. No mutation.",
              file=sys.stderr)
        return 2
    if pids:
        print(f"[{label}] REFUSED: active holders {','.join(pids)}; "
              f"offline ownership required. No mutation.", file=sys.stderr)
        return 2
    return None


def cmd_dry_run(args):
    sessions = load_sessions(args.db)
    cutoff = cutoff_ms(args.cutoff_days)
    eligible, retained = compute_eligible_roots(sessions, cutoff)
    print_summary("dry-run", args.db, cutoff, sessions, eligible, retained)
    pids, unknown = check_holders(args.db)
    state = "unknown" if unknown else ("present" if pids else "none")
    print(f"[dry-run] holders={state}"
          + (f" pids={','.join(pids)}" if pids else ""))
    return 0


def cmd_migrate(args):
    db_path = str(Path(args.db).resolve())
    refusal = _refuse_holders("migrate", *check_holders(db_path))
    if refusal is not None:
        return refusal
    before_counts = _table_counts(db_path, readonly=True)
    backup_path, backup_counts, probe_counts, src_fp = backup_and_probe(
        db_path, args.backup_dir)
    print(f"[migrate] backup={backup_path} backups={backup_counts} "
          f"probes={probe_counts}")
    refusal = _refuse_holders("migrate", *check_holders(db_path))
    if refusal is not None:
        print(f"[migrate] REFUSED before VACUUM; backup at {backup_path} "
              f"covers restore", file=sys.stderr)
        return refusal
    before_pages = single_value(db_path, "PRAGMA page_count")
    before_free = single_value(db_path, "PRAGMA freelist_count")
    saved_tmpdir = os.environ.get("SQLITE_TMPDIR")
    os.environ["SQLITE_TMPDIR"] = str(Path(db_path).resolve().parent)
    try:
        conn = sqlite3.connect(db_path)
        try:
            conn.execute("PRAGMA auto_vacuum = FULL")
            conn.execute("VACUUM")
            conn.commit()
        finally:
            conn.close()
    finally:
        if saved_tmpdir is None:
            os.environ.pop("SQLITE_TMPDIR", None)
        else:
            os.environ["SQLITE_TMPDIR"] = saved_tmpdir

    try:
        after_fp = logical_fingerprint(db_path)
    except MaintenanceError as exc:
        print(f"[migrate] VERIFY FAILED: post-VACUUM fingerprint error: {exc}; "
              f"retained backup: {backup_path}", file=sys.stderr)
        return 4
    after_counts = _table_counts(db_path, readonly=True)
    preserved = src_fp == after_fp
    if not preserved:
        print("[migrate] VERIFY FAILED: logical fingerprint changed after "
              "VACUUM — data identity not preserved; "
              f"retained backup: {backup_path}", file=sys.stderr)
        return 4
    persisted = single_value(db_path, "PRAGMA auto_vacuum")
    after_pages = single_value(db_path, "PRAGMA page_count")
    after_free = single_value(db_path, "PRAGMA freelist_count")
    if persisted != 1 or not _integrity_ok(db_path):
        print(f"[migrate] VERIFY FAILED: auto_vacuum={persisted} "
              f"integrity={_integrity_ok(db_path)}", file=sys.stderr)
        return 4
    print(f"[migrate] auto_vacuum={persisted} pages {before_pages}->{after_pages} "
          f"freelist {before_free}->{after_free}; integrity ok; "
          f"data preserved (logical fingerprint, counts {after_counts})")
    return 0


def single_value(db_path, sql):
    conn = _ro_connect(db_path)
    try:
        return conn.execute(sql).fetchone()[0]
    finally:
        conn.close()


def _integrity_ok(db_path):
    return str(single_value(db_path, "PRAGMA integrity_check")).strip() == "ok"


def cmd_schedule(args):
    pids, unknown = check_holders(args.db)
    print("[schedule] REFUSED destructive execution: scheduled context cannot "
          "establish exclusive startup fencing; run migrate explicitly with "
          "all OpenCode instances closed.", file=sys.stderr)
    state = "unknown" if unknown else ("present" if pids else "none")
    print(f"[schedule] holders={state}"
          + (f" pids={','.join(pids)}" if pids else ""), file=sys.stderr)
    return 3


def build_parser():
    parser = argparse.ArgumentParser(
        prog="opencode_db_maintenance.py",
        description="OpenCode DB offline maintenance: prune (apply) is "
                    "retired; migrate is the real usable mutation after "
                    "shutdown, schedule refuses destructive execution. "
                    "See DB-MAINTENANCE.md.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("dry-run", "migrate", "schedule"):
        p = sub.add_parser(name)
        p.add_argument("--db", required=True, help="explicit database path")
        if name == "migrate":
            p.add_argument(
                "--offline-confirmation", action="store_true", required=True,
                help="must be passed explicitly: operator keeps every OpenCode "
                     "instance closed for the whole interval",
            )
            p.add_argument(
                "--cutoff-days", type=int, default=DEFAULT_RETENTION_DAYS,
                help="retention window in elapsed 24-hour days (default 30)",
            )
        elif name == "dry-run":
            p.add_argument(
                "--cutoff-days", type=int, default=DEFAULT_RETENTION_DAYS,
                help="retention window in elapsed 24-hour days (default 30)",
            )
        if name in ("migrate", "dry-run"):
            p.add_argument(
                "--backup-dir", default="/Users/anders.jensen/.config/opencode/"
                                         "maintenance/backups",
                help="operator-owned backup reserve directory (must be on the "
                     "same filesystem as --db)",
            )
        p.set_defaults(handler=globals()["cmd_" + name.replace("-", "_")])
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return args.handler(args)
    except MaintenanceError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    sys.exit(main())
