#!/usr/bin/env python3
"""Tests for opencode_db_maintenance.py.

Stdlib-only unittest. All fixtures are disposable and self-cleaned. The
pruning (`apply`) subcommand was retired, so no native opencode invocation and
no deletion entrypoint remains in scope; the test suite asserts apply is
rejected as an unknown command (no DB/native effect). Retained coverage:
dry-run eligibility, offline-confirmed migrate, refusal-only schedule,
holder refusal, capacity, backup/restore probe, and the logical fingerprint.
Schema-present-but-broken tables must fail the tool, never yield a clean
result. Fingerprint is rowid-independent (VACUUM-growing / WITHOUT ROWID /
rowid-gap) and includes the schema definition; no counts-only fallback.
Exits 0 when green.
"""

import argparse
import contextlib
import io
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import unittest.mock
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(MODULE_DIR))

import opencode_db_maintenance as m

DAY_MS = m.DAY_MS


def now_ms():
    return int(__import__("time").time() * 1000)


def clean_env():
    env = {}
    for key, value in os.environ.items():
        if key.startswith("OPENCODE_") or key.startswith("XDG_"):
            continue
        env[key] = value
    return env


def run_script(*argv, env_extra=None):
    env = clean_env()
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        [sys.executable, str(MODULE_DIR / "opencode_db_maintenance.py"), *argv],
        capture_output=True, text=True, env=env,
    )


def _session_count(db):
    conn = sqlite3.connect(db)
    try:
        return conn.execute("SELECT count(*) FROM session").fetchone()[0]
    finally:
        conn.close()


def mini_session_db(path, rows, with_schema=True):
    conn = sqlite3.connect(path)
    try:
        if with_schema:
            conn.execute("CREATE TABLE session "
                         "(id TEXT PRIMARY KEY, parent_id TEXT, time_created "
                         "INTEGER, slug TEXT, directory TEXT, title TEXT, "
                         "version TEXT, time_updated INTEGER)")
        conn.executemany(
            "INSERT INTO session (id, parent_id, time_created, slug, "
            "directory, title, version, time_updated) VALUES (?,?,?,?,?,?,?,?)",
            [(rid, parent, created, rid.lower(), "/t", rid, "1.18.34", created)
             for rid, parent, created in rows],
        )
        conn.commit()
    finally:
        conn.close()


class EligibilityTest(unittest.TestCase):

    def test_eligible_when_whole_tree_old(self):
        s = {"A": {"parent": None, "created": 100_000},
             "B": {"parent": "A", "created": 200_000},
             "C": {"parent": "B", "created": 300_000}}
        eligible, retained = m.compute_eligible_roots(s, cutoff=400_000)
        self.assertEqual([r for r, _ in eligible], ["A"])
        self.assertEqual(retained, [])

    def test_recent_descendant_preserves_tree(self):
        s = {"A": {"parent": None, "created": 100_000},
             "B": {"parent": "A", "created": 500_000}}
        eligible, retained = m.compute_eligible_roots(s, cutoff=400_000)
        self.assertEqual(eligible, [])
        self.assertEqual([sorted(c) for c in retained], [["A", "B"]])

    def test_cutoff_equality_is_not_eligible(self):
        at = {"A": {"parent": None, "created": 400_000}}
        self.assertEqual(m.compute_eligible_roots(at, 400_000)[0], [])
        older = {"A": {"parent": None, "created": 399_999}}
        self.assertEqual([r for r, _ in m.compute_eligible_roots(older, 400_000)[0]],
                         ["A"])

    def test_missing_parent_retained(self):
        s = {"A": {"parent": None, "created": 100},
             "B": {"parent": "GHOST", "created": 200}}
        eligible, retained = m.compute_eligible_roots(s, cutoff=1_000_000)
        self.assertEqual([r for r, _ in eligible], ["A"])
        self.assertEqual([sorted(c) for c in retained], [["B"]])

    def test_cycle_retained(self):
        s = {"A": {"parent": "B", "created": 100},
             "B": {"parent": "A", "created": 200}}
        eligible, retained = m.compute_eligible_roots(s, cutoff=1_000_000)
        self.assertEqual(eligible, [])
        self.assertEqual(len(retained), 1)


class CliTest(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="pxb2-")
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def test_help_exits_zero(self):
        result = run_script("--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("usage", result.stdout)

    def test_dry_run_reports_eligibility(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS),
                             ("B", "A", now_ms() - 40 * DAY_MS),
                             ("C", None, now_ms() - 5 * DAY_MS)])
        result = run_script("dry-run", "--db", str(db))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("eligible root=A", result.stdout)
        self.assertIn("eligible_root_trees=1", result.stdout)

    def test_canonical_schedule_file_exists(self):
        self.assertTrue(
            (MODULE_DIR / "com.opencode.db-maintenance.daily.plist").exists())

    def test_apply_retired_not_a_command(self):
        # The pruning entrypoint was retired: `apply` must be rejected as an
        # invalid subcommand before reaching any handler or DB access, and its
        # --fixture-only flag must not be advertised. This is the
        # no-arbitrary-target-deletion guarantee made structural.
        db = self.dir / "never-created.db"
        result = run_script("apply", "--db", str(db), "--fixture-only",
                            "--offline-confirmation",
                            "--backup-dir", str(self.dir / "backups"))
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("invalid choice: 'apply'", result.stderr)
        self.assertNotIn("REFUSED", result.stderr)
        self.assertFalse(Path(db).exists())
        self.assertNotIn("--fixture-only", run_script("--help").stdout)

    def test_capacity_refusal_fail_revert_clean(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        backup_dir = self.dir / "backups"
        os.makedirs(backup_dir, exist_ok=True)
        with unittest.mock.patch.object(m, "free_bytes", return_value=0):
            with self.assertRaises(m.MaintenanceError):
                m.require_capacity(str(db), str(backup_dir))
        # revert: real free space -> passes
        self.assertIsNotNone(m.require_capacity(str(db), str(backup_dir)))

    def test_backup_probe_and_migrate(self):
        db = self.dir / "migrate.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS),
                             ("B", None, now_ms() - 1 * DAY_MS)])
        backup_dir = self.dir / "backups"
        bp, bcounts, pcounts, src_fp = m.backup_and_probe(str(db), str(backup_dir))
        self.assertTrue(Path(bp).exists())
        self.assertEqual(bcounts, pcounts)
        self.assertIsNotNone(src_fp)
        self.assertFalse(list(backup_dir.glob("*.probe")))
        result = run_script("migrate", "--db", str(db),
                            "--offline-confirmation",
                            "--backup-dir", str(backup_dir))
        self.assertEqual(result.returncode, 0, result.stderr)
        conn = sqlite3.connect(db)
        try:
            self.assertEqual(
                conn.execute("PRAGMA auto_vacuum").fetchone()[0], 1)
            self.assertEqual(
                conn.execute("SELECT count(*) FROM session").fetchone()[0], 2)
        finally:
            conn.close()

    def test_backup_dir_private_and_no_symlink_overwrite(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        backup_dir = self.dir / "backups"
        bp, _, _, _ = m.backup_and_probe(str(db), str(backup_dir))
        self.assertEqual(os.stat(backup_dir).st_mode & 0o777, 0o700)
        self.assertEqual(os.stat(bp).st_mode & 0o777, 0o600)
        # a pre-existing name must not be overwritten (O_EXCL)
        before = Path(bp).read_bytes()
        with self.assertRaises(FileExistsError):
            _ = m._reserve_exclusive(str(bp))
        self.assertEqual(Path(bp).read_bytes(), before)

    def test_backup_dir_symlink_rejected_before_chmod(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        real = self.dir / "real-backup"
        real.mkdir(mode=0o755)
        alias = self.dir / "backups"
        alias.symlink_to(real, target_is_directory=True)
        with self.assertRaises(m.MaintenanceError):
            _ = m.backup_and_probe(str(db), str(alias))
        # the symlink target must not have been chmodded to 0700
        self.assertEqual(os.stat(real).st_mode & 0o777, 0o755)

    def test_schedule_refuses_without_mutation(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        before = db.read_bytes()
        result = run_script("schedule", "--db", str(db))
        self.assertEqual(result.returncode, 3, result.stderr)
        self.assertIn("REFUSED", result.stderr)
        self.assertEqual(db.read_bytes(), before)

    def test_holder_plant_refusal_revert_clean(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        before = db.read_bytes()
        holder = sqlite3.connect(db)
        try:
            result = run_script("migrate", "--db", str(db),
                                "--offline-confirmation",
                                "--backup-dir", str(self.dir / "backups"))
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertIn("REFUSED", result.stderr)
        finally:
            holder.close()
        self.assertEqual(db.read_bytes(), before)  # no mutation
        self.assertEqual(_session_count(str(db)), 1)

    def test_holder_unknown_treated_as_refusal(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        before = db.read_bytes()
        args = unittest.mock.Mock()
        args.db = str(db)
        args.backup_dir = str(self.dir / "backups")
        with unittest.mock.patch.object(m, "check_holders",
                                        return_value=([], True)):
            rc = m.cmd_migrate(args)
        self.assertEqual(rc, 2)
        self.assertEqual(db.read_bytes(), before)  # no mutation

    def test_schema_present_broken_table_fails_not_clean(self):
        db = self.dir / "broken.db"
        conn = sqlite3.connect(db)
        try:
            conn.execute("CREATE TABLE session (id TEXT PRIMARY KEY, "
                         "parent_id TEXT, time_created INTEGER)")
            conn.execute("INSERT INTO session VALUES ('A', NULL, 1)")
            conn.execute("CREATE VIEW event AS SELECT * FROM no_such_table")
            conn.commit()
        finally:
            conn.close()
        # schema-present but broken: must FAIL, never a clean 0/None
        with self.assertRaises(m.MaintenanceError):
            m._table_counts(str(db), readonly=True)

    def test_migrate_requires_offline_confirmation(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        before = db.read_bytes()
        result = run_script("migrate", "--db", str(db),
                            "--backup-dir", str(self.dir / "backups"))
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("--offline-confirmation", result.stderr)
        self.assertEqual(db.read_bytes(), before)

    def test_migrate_holder_checkpoint1_refuses_no_backup(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        before = db.read_bytes()
        args = unittest.mock.Mock()
        args.db = str(db)
        args.backup_dir = str(self.dir / "backups")
        with unittest.mock.patch.object(m, "check_holders",
                                        return_value=(["7"], False)):
            rc = m.cmd_migrate(args)
        self.assertEqual(rc, 2)
        self.assertEqual(db.read_bytes(), before)          # no mutation
        self.assertFalse((self.dir / "backups").exists())  # nothing retained yet

    def test_migrate_holder_checkpoint2_refuses_retains_backup(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        args = unittest.mock.Mock()
        args.db = str(db)
        args.backup_dir = str(self.dir / "backups")
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf), \
                unittest.mock.patch.object(
                    m, "check_holders",
                    side_effect=[([], False), (["7"], False)]):
            rc = m.cmd_migrate(args)
        self.assertEqual(rc, 2)
        self.assertIn("REFUSED before VACUUM", buf.getvalue())
        self.assertIn("backup at ", buf.getvalue())
        self.assertEqual(
            sqlite3.connect(str(db)).execute(
                "PRAGMA auto_vacuum").fetchone()[0], 0)   # VACUUM never ran
        self.assertTrue(list((self.dir / "backups").glob("opencode.db-*.bak")))

    def test_migrate_capacity_failure_no_mutation(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        before = db.read_bytes()
        args = unittest.mock.Mock()
        args.db = str(db)
        args.backup_dir = str(self.dir / "backups")
        with unittest.mock.patch.object(m, "free_bytes", return_value=0):
            with self.assertRaises(m.MaintenanceError):
                m.cmd_migrate(args)
        self.assertEqual(db.read_bytes(), before)          # no VACUUM

    def test_migrate_pre_fingerprint_mismatch_retains_backup(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        args = unittest.mock.Mock()
        args.db = str(db)
        args.backup_dir = str(self.dir / "backups")
        with unittest.mock.patch.object(
                m, "logical_fingerprint",
                side_effect=[{"_schema_": "aaa"}, {"_schema_": "bbb"},
                             {"_schema_": "bbb"}]):
            with self.assertRaises(m.MaintenanceError) as cm:
                m.cmd_migrate(args)
        self.assertIn("retained backup", str(cm.exception))
        self.assertIn("retained probe", str(cm.exception))
        self.assertTrue(list((self.dir / "backups").glob("opencode.db-*.bak")))

    def test_migrate_post_fingerprint_mismatch_reports_backup(self):
        db = self.dir / "mini.db"
        mini_session_db(db, [("A", None, now_ms() - 61 * DAY_MS)])
        args = unittest.mock.Mock()
        args.db = str(db)
        args.backup_dir = str(self.dir / "backups")
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf), \
                unittest.mock.patch.object(
                    m, "logical_fingerprint",
                    side_effect=[{"_schema_": "aaa"}, {"_schema_": "aaa"},
                                 {"_schema_": "aaa"}, {"_schema_": "bbb"}]):
            rc = m.cmd_migrate(args)
        self.assertEqual(rc, 4)
        self.assertIn("retained backup", buf.getvalue())

    def test_fingerprint_rowid_gap_and_vacuum_stable(self):
        def build(path, gap):
            conn = sqlite3.connect(path)
            try:
                conn.execute("CREATE TABLE t (a INTEGER, b TEXT)")
                conn.execute("INSERT INTO t VALUES (1,'x'),(2,'y'),(3,'z')")
                if gap:
                    # delete + reinsert => identical content with a rowid hole
                    conn.execute("DELETE FROM t WHERE a=2")
                    conn.execute("INSERT INTO t VALUES (2,'y')")
                conn.execute("CREATE TABLE wr (k TEXT PRIMARY KEY, v TEXT) "
                             "WITHOUT ROWID")
                conn.execute("INSERT INTO wr VALUES ('p','q'),('r','s')")
                conn.commit()
            finally:
                conn.close()

        d1 = self.dir / "fp-gap.db"
        d2 = self.dir / "fp-nogap.db"
        build(d1, gap=True)
        build(d2, gap=False)
        f1 = m.logical_fingerprint(str(d1))
        f2 = m.logical_fingerprint(str(d2))
        self.assertEqual(f1, f2)          # rowid layout is irrelevant
        self.assertIn("t", f1)
        self.assertIn("wr", f1)           # all user tables included
        # VACUUM rebuild renumbers rowids; logical fingerprint must not change
        conn = sqlite3.connect(str(d2))
        try:
            conn.execute("VACUUM")
        finally:
            conn.close()
        self.assertEqual(m.logical_fingerprint(str(d2)), f1)

    def test_fingerprint_schema_change_detected(self):
        def build(path, alter):
            conn = sqlite3.connect(path)
            try:
                conn.execute("CREATE TABLE t (a INTEGER, b TEXT)")
                conn.execute("INSERT INTO t VALUES (1,'x')")
                if alter:
                    conn.execute("ALTER TABLE t ADD COLUMN c INTEGER")
                conn.commit()
            finally:
                conn.close()

        d1 = self.dir / "fp-s1.db"
        d2 = self.dir / "fp-s2.db"
        build(d1, alter=False)
        build(d2, alter=True)
        self.assertNotEqual(m.logical_fingerprint(str(d1)),
                            m.logical_fingerprint(str(d2)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
