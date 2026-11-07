#!/usr/bin/env python3
"""Unit tests for scripts/map.py, scripts/recall.py and the context budgets of tasks.py.

Run: python3 -m unittest scripts/test_map_recall.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import recall  # noqa: E402
import tasks  # noqa: E402

spec = importlib.util.spec_from_file_location("system_map", HERE / "map.py")
system_map = importlib.util.module_from_spec(spec)
spec.loader.exec_module(system_map)

ROOT_MAP_TOKEN_LIMIT = 1500
MODULE_MAP_TOKEN_LIMIT = 500
REGISTRY = {
    "board_file": "INTEGRATION.md",
    "statuses": ["TODO", "IN PROGRESS", "IN REVIEW", "DONE", "PENDING", "BLOCKED"],
    "owner_input_markers": ["user input"],
    "context_budgets": {
        "root": {"CLAUDE.md": 20},
        "per_project": {"CLAUDE.md": 20},
    },
    "projects": {
        "server": {"title": "Server", "prefix": "SRV", "dir": "srv", "master": "server", "backlog": "srv/docs/Tasks.md",
                   "session": "srv/.claude/session.md", "memory": "srv/.claude/memory.md", "integration": "srv/.claude/Integration.md"},
        "app": {"title": "App", "prefix": "APP", "dir": "app", "master": "app", "backlog": "app/docs/Tasks.md",
                "session": "app/.claude/session.md", "memory": "app/.claude/memory.md", "integration": "app/.claude/Integration.md",
                "code_dirs": ["feature"]},
    },
}
BACKLOG = """# Tasks
| ID | Task | Branch | Needs | Status | Notes |
|---|---|---|---|---|---|
| {p}-001 | Done thing | `feat/1` | — | DONE | — |
| {p}-002 | Busy thing | `feat/2` | — | IN REVIEW | — |
| {p}-003 | Ready thing | `feat/3` | — | TODO | — |
| {p}-004 | Owner thing | `feat/4` | — | PENDING | user input |
"""
DOMAIN = "# Domain\n## 5. Computed Rules\n### 5.20 Bookings by the business (owner 2026-11-03)\n### 5.21 Closing\n"
PRD = "# PRD\n### S01 — Onboarding\n### S08 / S09 — Reviews (shared)\n"
OPENAPI = '{"openapi": "3.1.0", "info": {"title": "x", "version": "1.13.0"}, "paths": {}}'


class Repo(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name).resolve()
        self.write(".claude/projects.json", json.dumps(REGISTRY))
        self.write("BUSINESS_DOMAIN.md", DOMAIN)
        self.write("CLAUDE.md", "short")
        self.write("srv/docs/Tasks.md", BACKLOG.format(p="SRV"))
        self.write("app/docs/Tasks.md", BACKLOG.format(p="APP"))
        self.write("app/docs/App_PRD.md", PRD)
        self.write("srv/docs/api/openapi.customer.json", OPENAPI)
        (self.root / "app/feature/home").mkdir(parents=True)
        (self.root / "app/feature/search").mkdir(parents=True)
        self.b = tasks.Backlogs(self.root)

    def write(self, rel, text):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


class SystemMapTest(Repo):
    def test_shows_every_module_with_counts_and_next_task(self):
        text = system_map.system_map(self.root, self.b)
        self.assertIn("`server` srv/ (master `server`): 1 done, 1 todo, 1 in review, 1 pending; next SRV-003", text)
        self.assertIn("`app` app/", text)

    def test_shows_open_work_owner_waits_contract_and_rules_index(self):
        text = system_map.system_map(self.root, self.b)
        self.assertIn("SRV-002 [IN REVIEW] Busy thing", text)
        self.assertIn("server: SRV-004", text)
        self.assertIn("Contracts: customer 1.13.0.", text)
        self.assertIn("§5.20 Bookings by the business · §5.21 Closing", text)

    def test_missing_sources_leave_their_part_out_instead_of_failing(self):
        (self.root / "BUSINESS_DOMAIN.md").unlink()
        (self.root / "srv/docs/api/openapi.customer.json").unlink()
        text = system_map.system_map(self.root, self.b)
        self.assertNotIn("Rules index", text)
        self.assertNotIn("Contracts:", text)

    def test_long_titles_are_cut(self):
        self.assertEqual(system_map.TITLE_WIDTH, len(system_map.short("x" * 200)))

    def test_cwd_picks_the_module_that_holds_the_path(self):
        self.assertEqual("app", system_map.project_of_path(self.root, self.b, str(self.root / "app/feature/home")))
        self.assertIsNone(system_map.project_of_path(self.root, self.b, str(self.root)))
        self.assertIsNone(system_map.project_of_path(self.root, self.b, "/elsewhere"))


class ModuleMapTest(Repo):
    def test_shows_tasks_screens_and_code_areas(self):
        text = system_map.module_map(self.root, self.b, "app")
        self.assertIn("APP-002 [IN REVIEW] Busy thing", text)
        self.assertIn("APP-003 Ready thing", text)
        self.assertIn("S01 Onboarding · S08 / S09 Reviews", text)
        self.assertIn("feature: home search", text)

    def test_a_module_without_a_prd_or_code_dirs_still_works(self):
        text = system_map.module_map(self.root, self.b, "server")
        self.assertNotIn("Screens", text)
        self.assertNotIn("Code:", text)


class RealRepoBudgetTest(unittest.TestCase):
    """The promise of the map: the whole picture stays small on the real repository."""

    def setUp(self):
        self.root = tasks.repo_root(HERE)
        self.b = tasks.Backlogs(self.root)

    def test_system_map_stays_within_budget(self):
        tokens = system_map.approx_tokens(system_map.system_map(self.root, self.b))
        self.assertLessEqual(tokens, ROOT_MAP_TOKEN_LIMIT)

    def test_every_module_map_stays_within_budget(self):
        for name in self.b.projects:
            tokens = system_map.approx_tokens(system_map.module_map(self.root, self.b, name))
            self.assertLessEqual(tokens, MODULE_MAP_TOKEN_LIMIT, name)


class RecallTest(Repo):
    def setUp(self):
        super().setUp()
        self.write("docs/knowledge/facts.md", "Gateway sends the OTP code\nunrelated line\n")
        self.write("app/docs/App_BRD.md", "## OTP\nthe code arrives\nGateway is the sender of the OTP\n")

    def test_lines_with_every_word_rank_first(self):
        results = recall.search(self.root, ["gateway", "otp"])
        self.assertTrue(results[0].startswith("docs/knowledge/facts.md:1:"), results)
        self.assertEqual(3, len(results))

    def test_results_name_the_file_and_line(self):
        self.assertIn("app/docs/App_BRD.md:3: Gateway is the sender of the OTP", recall.search(self.root, ["sender"]))

    def test_nothing_found_gives_nothing(self):
        self.assertEqual([], recall.search(self.root, ["zzzz"]))

    def test_results_are_capped(self):
        self.write("docs/knowledge/many.md", "needle\n" * 100)
        self.assertEqual(recall.MAX_RESULTS, len(recall.search(self.root, ["needle"])))

    def test_long_lines_become_a_snippet_around_the_match(self):
        self.write("docs/knowledge/long.md", "a" * 500 + " needle " + "b" * 500)
        line = recall.search(self.root, ["needle"])[0]
        self.assertIn("needle", line)
        self.assertLess(len(line), recall.SNIPPET_WIDTH + 60)


class ContextBudgetTest(Repo):
    def test_files_within_budget_pass(self):
        self.assertEqual([], self.b.context_budget_problems())

    def test_a_grown_root_file_fails_with_its_size(self):
        self.write("CLAUDE.md", "x" * 400)
        problems = self.b.context_budget_problems()
        self.assertEqual(1, len(problems))
        self.assertIn("CLAUDE.md: ~100 tokens, budget 20", problems[0])

    def test_a_grown_project_file_fails(self):
        self.write("app/CLAUDE.md", "x" * 400)
        self.assertIn("app/CLAUDE.md", self.b.context_budget_problems()[0])

    def test_a_missing_file_is_fine(self):
        (self.root / "CLAUDE.md").unlink()
        self.assertEqual([], self.b.context_budget_problems())

    def test_check_reports_budget_problems(self):
        self.write("CLAUDE.md", "x" * 400)
        self.assertTrue(any("budget" in p for p in self.b.check()))

    def test_a_registry_without_budgets_checks_nothing(self):
        registry = {k: v for k, v in REGISTRY.items() if k != "context_budgets"}
        self.write(".claude/projects.json", json.dumps(registry))
        self.write("CLAUDE.md", "x" * 400)
        self.assertEqual([], tasks.Backlogs(self.root).context_budget_problems())


if __name__ == "__main__":
    unittest.main()
