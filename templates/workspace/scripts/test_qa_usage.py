#!/usr/bin/env python3
"""Unit tests for scripts/qa.py and scripts/usage.py.

Run: python3 -m unittest scripts/test_qa_usage.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import qa  # noqa: E402
import usage  # noqa: E402


def registry(steps, timeout=30):
    return {"kinds": {"k": {"qa": steps}}, "projects": {"p": {"kind": "k", "dir": "p"}},
            "line": {"scope_exempt": ["shared/*.json"], "fail_tail_lines": 3, "timeouts_seconds": {"qa": timeout}}}


class Steps(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "p").mkdir()

    def test_all_green(self):
        result = qa.run_qa(registry([{"name": "a", "run": "true"}, {"name": "b", "run": "true"}]), "p", self.root)
        self.assertTrue(result.ok)
        self.assertEqual(result.lines(), ["PASS  a", "PASS  b"])

    def test_stops_at_the_first_failure_with_only_its_tail(self):
        noisy = "for i in 1 2 3 4 5 6; do echo line$i; done; exit 1"
        result = qa.run_qa(registry([{"name": "a", "run": noisy}, {"name": "never", "run": "touch ran"}]), "p", self.root)
        self.assertFalse(result.ok)
        self.assertEqual(len(result.steps), 1)
        self.assertNotIn("line3", result.failure.tail)
        self.assertIn("line6", result.failure.tail)
        self.assertFalse((self.root / "p" / "ran").exists())

    def test_steps_run_in_the_module_with_their_env(self):
        result = qa.run_qa(registry([{"name": "a", "run": 'test "$X" = "1" && test "$(basename "$PWD")" = p', "env": {"X": "1"}}]), "p", self.root)
        self.assertTrue(result.ok)

    def test_a_step_over_the_limit_is_stopped_and_fails(self):
        result = qa.run_qa(registry([{"name": "slow", "run": "sleep 30"}], timeout=1), "p", self.root)
        self.assertFalse(result.ok)
        self.assertIn("timed out after 1s", result.failure.tail)

    def test_no_steps_is_not_a_pass(self):
        self.assertFalse(qa.run_qa(registry([]), "p", self.root).ok)


class BranchChecks(unittest.TestCase):
    def test_source_without_a_test_is_a_problem(self):
        self.assertIn("no unit test", qa.branch_problems(["p/src/a.ts"], "p", [])[0])

    def test_source_with_a_test_is_fine(self):
        self.assertEqual(qa.branch_problems(["p/src/a.ts", "p/test/a.test.ts"], "p", []), [])

    def test_docs_alone_need_no_test(self):
        self.assertEqual(qa.branch_problems(["p/docs/a.md"], "p", []), [])

    def test_a_file_outside_the_module_is_a_problem_unless_exempt(self):
        self.assertIn("other/a.md", qa.branch_problems(["p/docs/a.md", "other/a.md"], "p", [])[0])
        self.assertEqual(qa.branch_problems(["shared/x.json"], "p", ["shared/*.json"]), [])

    def test_a_sibling_folder_with_the_same_prefix_is_outside(self):
        self.assertTrue(qa.branch_problems(["p-two/a.md"], "p", []))

    def test_changed_on_branch_sees_commits_edits_and_new_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            git = lambda *a: subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@example.test", *a], cwd=tmp, check=True, capture_output=True)
            git("init", "-q", "-b", "base")
            (Path(tmp) / "a.txt").write_text("1")
            (Path(tmp) / "b.txt").write_text("1")
            git("add", "-A")
            git("commit", "-qm", "base")
            git("checkout", "-qb", "work")
            (Path(tmp) / "a.txt").write_text("2")
            git("add", "-A")
            git("commit", "-qm", "work")
            (Path(tmp) / "b.txt").write_text("2")
            (Path(tmp) / "c.txt").write_text("new")
            self.assertEqual(qa.changed_on_branch(Path(tmp), "base"), ["a.txt", "b.txt", "c.txt"])


def assistant(mid, read=0, create=0, fresh=0, out=0, nested=False):
    numbers = {"input_tokens": fresh, "cache_creation_input_tokens": create, "cache_read_input_tokens": read, "output_tokens": out}
    if nested:
        numbers = {"input_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0, "output_tokens": 0, "iterations": [numbers]}
    return json.dumps({"type": "assistant", "message": {"id": mid, "usage": numbers}})


class Meter(unittest.TestCase):
    def stats(self, *lines):
        meter = usage.Meter()
        for line in lines:
            meter.feed(line)
        return meter, meter.stats()

    def test_start_average_and_cache_read(self):
        _, stats = self.stats(assistant("a", read=0, create=1000, fresh=10), assistant("b", read=1000, create=200, fresh=10))
        self.assertEqual(stats.requests, 2)
        self.assertEqual(stats.start_context, 1010)
        self.assertEqual(stats.avg_context, (1010 + 1210) // 2)
        self.assertEqual(stats.max_context, 1210)
        self.assertEqual(stats.cache_read, 1000)

    def test_one_request_on_several_lines_counts_once(self):
        meter, stats = self.stats(assistant("a", read=100, out=1), assistant("a", read=100, out=50))
        self.assertEqual(stats.requests, 1)
        self.assertEqual(meter.total, 150)

    def test_numbers_inside_iterations(self):
        _, stats = self.stats(assistant("a", read=946851, create=1031, fresh=2, nested=True))
        self.assertEqual(stats.start_context, 947884)

    def test_other_lines_and_junk_are_ignored(self):
        _, stats = self.stats("not json", json.dumps({"type": "user"}), json.dumps([1]), json.dumps({"type": "assistant", "message": {"id": "z"}}))
        self.assertEqual(stats.requests, 0)

    def test_empty_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.jsonl"
            path.write_text("")
            self.assertEqual(usage.stats_of_file(path), usage.Stats())


class Reporting(unittest.TestCase):
    TARGETS = {"loaded_files": 3000, "worker_start": 10000, "main_avg_context": 50000, "worker_cache_read": 1000000}

    def test_transcripts_folder_follows_the_cli_naming(self):
        found = usage.transcripts_dir(Path("/home/dev/my.repo_1"), {"CLAUDE_CONFIG_DIR": "/c"})
        self.assertEqual(found, Path("/c/projects/-home-dev-my-repo-1"))

    def test_money_never_shows_an_unknown_cost_as_zero(self):
        self.assertEqual(usage.money(None), "cost unknown")
        self.assertEqual(usage.money(1.5), "$1.50")

    def test_verdict_says_when_a_target_is_missed(self):
        self.assertIn("OK", usage.verdict(10, 10))
        self.assertIn("MISSED", usage.verdict(11, 10))

    def test_approx(self):
        self.assertEqual([usage.approx(n) for n in (5, 1500, 2500000)], ["5", "1.5k", "2.5M"])

    def test_sessions_and_subagents_are_read_from_their_folders(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / "abcdefghij.jsonl").write_text(assistant("a", read=500))
            agents = folder / "abcdefghij" / "subagents"
            agents.mkdir(parents=True)
            (agents / "agent-1.jsonl").write_text(assistant("a", read=70000))
            (agents / "agent-2.jsonl").write_text("")
            rows = usage.session_rows(folder, 5)
            self.assertEqual(rows[0][0], "abcdefgh")
            self.assertEqual(rows[0][2].cache_read, 500)
            self.assertEqual([a.cache_read for a in usage.subagent_rows(folder)], [70000])

    def test_a_worker_over_target_is_reported_as_missed_with_its_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run = root / "features" / "f" / "run"
            run.mkdir(parents=True)
            step = {"role": "worker", "model": "sonnet", "ok": False, "reason": "over the cap", "cost_usd": 1.5, "requests": 4,
                    "start_context": 12000, "cache_read": 900, "total_tokens": 5000}
            (run / "server.json").write_text(json.dumps({"module": "server", "steps": [step]}))
            (run / "broken.json").write_text("{")
            (run / "coordination.json").write_text(json.dumps([{"name": "contract: customer", "ok": True, "detail": ""}]))
            registry_data = {"projects": {}, "line": {"usage_targets": self.TARGETS, "features_dir": "features"}}
            text = "\n".join(usage.summary_lines(root, registry_data, 1, "f"))
            self.assertIn("f/server worker (sonnet)", text)
            self.assertIn("MISSED", text)
            self.assertIn("over the cap", text)
            self.assertIn("$1.50", text)

    def test_no_runs_says_so(self):
        with tempfile.TemporaryDirectory() as tmp:
            registry_data = {"projects": {}, "line": {"usage_targets": self.TARGETS, "features_dir": "features"}}
            self.assertIn("no runs yet", "\n".join(usage.summary_lines(Path(tmp), registry_data, 1, "f")))


if __name__ == "__main__":
    unittest.main()
