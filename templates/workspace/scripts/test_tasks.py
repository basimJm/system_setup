#!/usr/bin/env python3
"""Unit tests for scripts/tasks.py (run: python3 -m unittest scripts/test_tasks.py)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tasks  # noqa: E402

REGISTRY = {
    "board_file": "INTEGRATION.md",
    "statuses": ["TODO", "IN PROGRESS", "IN REVIEW", "DONE", "PENDING", "BLOCKED"],
    "owner_input_markers": ["user input"],
    "projects": {
        "server": {"title": "Server", "prefix": "SRV", "dir": "srv", "master": "server", "backlog": "srv/TASKS.md",
                   "session": "srv/.claude/session.md", "memory": "srv/.claude/memory.md", "integration": "srv/.claude/Integration.md"},
        "admin": {"title": "Admin", "prefix": "ADM", "dir": "adm", "master": "admin", "backlog": "adm/TASKS.md",
                  "session": "adm/.claude/session.md", "memory": "adm/.claude/memory.md", "integration": "adm/.claude/Integration.md"},
    },
}
SERVER = """# Server
| ID | Task | Branch | Needs (besides previous merged) | Status | Pending on / notes |
|---|---|---|---|---|---|
| SRV-001 | Scaffold | `feat/srv-001` | — | DONE | `*_PROVIDER=fake|real` kept. |
| SRV-002 | Auth | `feat/srv-002` | SRV-001 | TODO | — |
| SRV-003 | Deploy | `feat/srv-003` | — | PENDING | DigitalOcean — **user input**. |
| SRV-004a | Sub task | `feat/srv-004a` | SRV-002 | TODO | — |
"""
ADMIN = """# Admin
| ID | Task | Branch | Needs | Server (SRV) | Status | Notes |
|---|---|---|---|---|---|---|
| ADM-001 | Setup | `feat/adm-001` | — | — | DONE | — |
| ADM-002 | Login | `feat/adm-002` | ADM-001 | SRV-002 | BLOCKED | Server gap. |
| ADM-003 | Profile | `feat/adm-003` | ADM-002 | SRV-002, SRV-004a | BLOCKED | — |
"""
BOARD = "# Integration\n\nintro\n\n<!-- BOARD:START -->\nold\n<!-- BOARD:END -->\n\ntail\n"


class TasksTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / ".claude").mkdir()
        (self.root / ".claude" / "projects.json").write_text(json.dumps(REGISTRY), encoding="utf-8")
        for rel, text in (("srv/TASKS.md", SERVER), ("adm/TASKS.md", ADMIN), ("INTEGRATION.md", BOARD)):
            (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
            (self.root / rel).write_text(text, encoding="utf-8")
        self.b = tasks.Backlogs(self.root)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_parses_rows_deps_and_suffixed_ids(self) -> None:
        self.assertEqual(self.b.tasks["SRV-001"].notes, "`*_PROVIDER=fake|real` kept.")
        self.assertEqual(sorted(self.b.tasks), ["ADM-001", "ADM-002", "ADM-003", "SRV-001", "SRV-002", "SRV-003", "SRV-004a"])
        self.assertEqual(self.b.tasks["ADM-003"].deps, ["ADM-002", "SRV-002", "SRV-004a"])
        self.assertEqual(self.b.tasks["SRV-002"].branch, "feat/srv-002")
        self.assertEqual(self.b.tasks["SRV-003"].status, "PENDING")

    def test_next_returns_first_ready_todo_only(self) -> None:
        self.assertEqual([t.id for t in self.b.ready("server")], ["SRV-002"])
        self.assertEqual(self.b.ready("admin"), [])

    def test_done_unblocks_dependents_only_when_all_deps_done(self) -> None:
        changes = self.b.set_status("SRV-002", "DONE")
        self.assertIn("SRV-002: TODO -> DONE (srv/TASKS.md)", changes[0])
        self.assertEqual(self.b.tasks["ADM-002"].status, "TODO")
        self.assertEqual(self.b.tasks["ADM-003"].status, "BLOCKED")  # SRV-004a still TODO
        text = (self.root / "adm/TASKS.md").read_text(encoding="utf-8")
        self.assertIn("| ADM-002 | Login | `feat/adm-002` | ADM-001 | SRV-002 | TODO | Server gap. unblocked by SRV-002 on", text)
        self.assertIn("| ADM-003 | Profile | `feat/adm-003` | ADM-002 | SRV-002, SRV-004a | BLOCKED | — |", text)

    def test_set_rejects_unknown_status_and_task(self) -> None:
        with self.assertRaises(SystemExit):
            self.b.set_status("SRV-002", "FINISHED")
        with self.assertRaises(SystemExit):
            self.b.set_status("SRV-999", "DONE")

    def test_board_written_between_markers_only(self) -> None:
        path = self.b.write_board()
        text = path.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("# Integration\n\nintro\n\n<!-- BOARD:START -->\n"))
        self.assertTrue(text.endswith("<!-- BOARD:END -->\n\ntail\n"))
        self.assertNotIn("old", text)
        self.assertIn("| ADM-002 | admin | BLOCKED | SRV-002 (server) | TODO |", text)
        self.assertIn("**SRV-003** (server) Deploy", text)
        self.assertIn("| Server | `server` | 2 | 0 | 0 | 1 | 1 | 0 | SRV-002 Auth |", text)

    def test_check_reports_inconsistencies(self) -> None:
        self.assertEqual(self.b.check(), [])
        (self.root / "adm/TASKS.md").write_text(ADMIN.replace("| ADM-002 | Login | `feat/adm-002` | ADM-001 | SRV-002 | BLOCKED |", "| ADM-002 | Login | `feat/adm-002` | ADM-001 | SRV-002 | TODO |")
                                               .replace("SRV-002, SRV-004a", "SRV-002, SRV-777"), encoding="utf-8")
        problems = tasks.Backlogs(self.root).check()
        self.assertTrue(any("ADM-003: depends on unknown task SRV-777" in p for p in problems))
        self.assertTrue(any("ADM-002: TODO but waits on another project: SRV-002" in p for p in problems))

    def test_duplicate_ids_are_reported(self) -> None:
        (self.root / "srv/TASKS.md").write_text(SERVER + "| SRV-001 | Again | `x` | — | TODO | — |\n", encoding="utf-8")
        problems = tasks.Backlogs(self.root).check()
        self.assertTrue(any(p.startswith("SRV-001 appears twice") for p in problems))

    def test_cli_next_and_show(self) -> None:
        import contextlib
        import io
        import os
        cwd = os.getcwd()
        os.chdir(self.root)
        try:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(tasks.main(["tasks.py", "next", "server"]), 0)
                self.assertEqual(tasks.main(["tasks.py", "show", "ADM-003"]), 0)
                self.assertEqual(tasks.main(["tasks.py", "check"]), 0)
            text = out.getvalue()
            self.assertIn("SRV-002  [TODO]  Auth", text)
            self.assertIn("needs: ADM-002[BLOCKED], SRV-002[TODO], SRV-004a[TODO]", text)
            self.assertIn("OK: 7 tasks across 2 projects", text)
        finally:
            os.chdir(cwd)


SESSION = """# Server session
## Current
### SRV-002 — Auth
- Branch: `feat/srv-002`
- Loops: 1/1
- Lesson: Retry the token sync only when the token changed; otherwise it loops.
### SRV-004a — Sub task
- Branch: `feat/srv-004a`
- Lesson: none
"""


class LessonsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / ".claude").mkdir()
        (self.root / ".claude" / "projects.json").write_text(json.dumps(REGISTRY), encoding="utf-8")
        for rel, text in (("srv/TASKS.md", SERVER), ("adm/TASKS.md", ADMIN), ("INTEGRATION.md", BOARD), ("srv/.claude/session.md", SESSION)):
            (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
            (self.root / rel).write_text(text, encoding="utf-8")
        self.b = tasks.Backlogs(self.root)
        self.local = self.root / "docs" / "knowledge" / "LESSONS.local.md"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_lesson_line_of_the_block_is_read(self) -> None:
        self.assertEqual("Retry the token sync only when the token changed; otherwise it loops.", self.b.lesson_of("SRV-002"))

    def test_none_empty_placeholder_and_missing_block_or_file_give_no_lesson(self) -> None:
        self.assertEqual("", self.b.lesson_of("SRV-004a"))      # "none"
        self.assertEqual("", self.b.lesson_of("SRV-001"))       # no block
        self.assertEqual("", self.b.lesson_of("ADM-002"))       # the project has no session file
        (self.root / "srv/.claude/session.md").write_text("### SRV-001 — x\n- Lesson: <one line or none>\n### SRV-003 — y\n- Lesson:\n", encoding="utf-8")
        self.assertEqual(("", ""), (self.b.lesson_of("SRV-001"), self.b.lesson_of("SRV-003")))

    def test_done_copies_the_lesson_with_the_task_id_once(self) -> None:
        self.b.set_status("SRV-002", "DONE")
        self.assertIn("recorded in docs/knowledge/LESSONS.local.md", self.b.collect_lesson("SRV-002"))
        text = self.local.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("# Lessons learned in this project"))
        self.assertIn("- [SRV-002] Retry the token sync only when the token changed; otherwise it loops.\n", text)
        self.assertIn("already in", self.b.collect_lesson("SRV-002"))
        self.assertEqual(1, self.local.read_text(encoding="utf-8").count("- [SRV-002]"))

    def test_same_lesson_under_another_task_is_not_added_again_and_a_new_one_is(self) -> None:
        self.b.collect_lesson("SRV-002")
        (self.root / "srv/.claude/session.md").write_text(
            SESSION + "### SRV-003 — z\n- Lesson: retry the TOKEN sync only when the token changed otherwise it loops\n"
            "### SRV-001 — a\n- Lesson: Pin the toolchain version.\n", encoding="utf-8")
        b = tasks.Backlogs(self.root)
        self.assertIn("already in", b.collect_lesson("SRV-003"))
        self.assertIn("recorded", b.collect_lesson("SRV-001"))
        self.assertEqual(["SRV-002", "SRV-001"], [m.group(1) for m in (tasks.LOCAL_LESSON.match(l) for l in self.local.read_text(encoding="utf-8").splitlines()) if m])

    def test_cli_set_done_collects_the_lesson_and_other_statuses_do_not(self) -> None:
        import contextlib
        import io
        import os
        cwd = os.getcwd()
        os.chdir(self.root)
        try:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                tasks.main(["tasks.py", "set", "SRV-002", "IN REVIEW"])
                self.assertFalse(self.local.exists())
                tasks.main(["tasks.py", "set", "SRV-002", "DONE"])
                tasks.main(["tasks.py", "set", "SRV-004a", "DONE"])
            self.assertIn("lesson of SRV-002 recorded", out.getvalue())
            self.assertIn("no lesson recorded", out.getvalue())
            self.assertEqual(1, self.local.read_text(encoding="utf-8").count("- ["))
        finally:
            os.chdir(cwd)


if __name__ == "__main__":
    unittest.main()
