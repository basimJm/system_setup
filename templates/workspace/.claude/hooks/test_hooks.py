#!/usr/bin/env python3
"""Unit tests for __SYSTEM_NAME__ hooks. Run: python3 .claude/hooks/test_hooks.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import io  # noqa: E402
import json  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402
import _common  # noqa: E402
from _common import task_block, task_verified, is_source_file, is_test_file, worktree_root  # noqa: E402
from guard_git import violation  # noqa: E402
from check_hardcoded import findings  # noqa: E402
from stop_review import evaluate  # noqa: E402
from prompt_reminder import reminder  # noqa: E402

_common._RULES_OVERRIDE = {}   # every rule on: the tests do not depend on the rules map of the checkout they run in

SESSION = """# Log
### T-001 — done task
- Branch: `feat/done`
- Loops: 1/1
- Review: PASSED (SE ✔)
### T-002 — open task
- Branch: `feat/open`
- Loops: 1/3
- Review: PENDING
"""

def lookup(branch):
    return task_block(branch, SESSION)


class WorktreeResolution(unittest.TestCase):
    def tearDown(self):
        _common._ROOT_OVERRIDE = None

    def test_resolves_the_checkout_of_the_payload_cwd(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["git", "init", "-q", tmp], check=True)
            sub = os.path.join(tmp, "a")
            os.mkdir(sub)
            self.assertEqual(os.path.realpath(worktree_root(sub)), os.path.realpath(tmp))

    def test_non_repository_and_missing_dirs_resolve_to_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(worktree_root(tmp), "")
        self.assertEqual(worktree_root("/definitely/not/here"), "")

    def test_read_input_switches_the_project_dir_to_the_payload_cwd(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["git", "init", "-q", tmp], check=True)
            old = sys.stdin
            sys.stdin = io.StringIO(json.dumps({"cwd": tmp, "tool_input": {}}))
            try:
                _common.read_input()
            finally:
                sys.stdin = old
            self.assertEqual(os.path.realpath(_common.project_dir()), os.path.realpath(tmp))

    def test_bad_payload_keeps_the_default(self):
        old = sys.stdin
        sys.stdin = io.StringIO("not json")
        try:
            self.assertEqual(_common.read_input(), {})
        finally:
            sys.stdin = old
        self.assertIsNone(_common._ROOT_OVERRIDE)


class SessionParsing(unittest.TestCase):
    def test_finds_block_for_branch(self):
        self.assertIn("T-001", lookup("feat/done"))
        self.assertEqual(lookup("feat/missing"), "")

    def test_verified_requires_loops_and_review(self):
        self.assertTrue(task_verified(lookup("feat/done")))
        self.assertFalse(task_verified(lookup("feat/open")))


class SessionParsingLegacy(unittest.TestCase):
    def test_old_three_loop_blocks_stay_valid_and_bare_one_of_three_does_not(self):
        self.assertTrue(task_verified("- Loops: 3/3\n- Review: PASSED"))
        self.assertTrue(task_verified("- Loops: 1/1 (user decision)\n- Review: PASSED"))
        self.assertFalse(task_verified("- Loops: 1/3\n- Review: PASSED"))


class GuardGit(unittest.TestCase):
    def test_blocks_commit_on_main(self):
        self.assertIsNotNone(violation("git commit -m x", "main", lookup))

    def test_allows_commit_on_feature_branch(self):
        self.assertIsNone(violation("git commit -m x", "feat/open", lookup))

    def test_blocks_push_to_main(self):
        self.assertIsNotNone(violation("git push origin main", "feat/done", lookup))
        self.assertIsNotNone(violation("git push origin HEAD:main", "feat/done", lookup))

    def test_blocks_force_and_no_verify(self):
        self.assertIsNotNone(violation("git push --force origin feat/done", "feat/done", lookup))
        self.assertIsNotNone(violation("git commit --no-verify -m x", "feat/done", lookup))

    def test_push_requires_verified_task(self):
        self.assertIsNotNone(violation("git push -u origin feat/open", "feat/open", lookup))
        self.assertIsNotNone(violation("git push -u origin feat/missing", "feat/missing", lookup))
        self.assertIsNone(violation("git push -u origin feat/done", "feat/done", lookup))

    def test_ignores_flags_inside_messages(self):
        flag = "--no-" + "verify"
        heredoc = "git commit -F - <<'EOF'\nNever use " + flag + " or push to main\nEOF"
        self.assertIsNone(violation(heredoc, "feat/done", lookup))
        self.assertIsNone(violation('git commit -m "mentions ' + flag + ' and main"', "feat/done", lookup))
        self.assertIsNotNone(violation("git commit " + flag + " -m 'x'", "feat/done", lookup))

    def test_checks_each_segment_separately(self):
        cmd = "git push -u origin feat/done && gh pr create --base main --head feat/done"
        self.assertIsNone(violation(cmd, "feat/done", lookup))
        self.assertIsNotNone(violation("cd x && git push origin main", "feat/done", lookup))

    def test_ignores_non_git_commands(self):
        self.assertIsNone(violation("npm test", "main", lookup))
        self.assertIsNone(violation("git status", "main", lookup))


def fake_assignment(key):
    """Build a fake `key = "<value>"` line at runtime so secret scanners don't flag test fixtures."""
    value = "x" * 12
    return f'{key} = "{value}"'


class Hardcoded(unittest.TestCase):
    def test_flags_url_and_secret_in_source(self):
        found = findings("__SYSTEM_NAME__-Server/src/app.ts", 'const u = "https://api.example.com"; ' + fake_assignment("apiKey"))
        self.assertIn("URL", found)
        self.assertIn("secret/API key", found)

    def test_allows_url_in_config_but_not_secret(self):
        self.assertEqual(findings("__SYSTEM_NAME__-Server/src/config/env.ts", 'url: "https://api.example.com"'), [])
        self.assertIn("secret/API key", findings("__SYSTEM_NAME__-Server/src/config/env.ts", fake_assignment("pass" + "word")))

    def test_ignores_docs_and_tests(self):
        self.assertEqual(findings("__SYSTEM_NAME__-Server/docs/a.md", '"https://x.com"'), [])
        self.assertEqual(findings("__SYSTEM_NAME__-Server/src/a.test.ts", '"https://x.com"'), [])

    def test_clean_source_passes(self):
        self.assertEqual(findings("__SYSTEM_NAME__-Server/src/a.ts", "const limit = config.otp.maxAttempts;"), [])


class StopReview(unittest.TestCase):
    def test_no_source_changes_passes(self):
        self.assertIsNone(evaluate(["README.md", ".claude/session.md"], "feat/x", ""))

    def test_source_without_tests_blocks(self):
        reason = evaluate(["__SYSTEM_NAME__-Server/src/a.ts"], "feat/done", lookup("feat/done"))
        self.assertIn("no unit test", reason)

    def test_unverified_task_blocks(self):
        reason = evaluate(["__SYSTEM_NAME__-Server/src/a.ts", "__SYSTEM_NAME__-Server/src/a.test.ts"], "feat/open", lookup("feat/open"))
        self.assertIn("Loops: 1/1", reason)

    def test_master_branches_are_exempt_even_with_source_changes(self):
        masters = {"main", "master", "customer", "server", "admin", "merchant"}
        self.assertIsNone(evaluate(["__SYSTEM_NAME__-Server/src/a.ts"], "customer", "", masters))
        self.assertIsNotNone(evaluate(["__SYSTEM_NAME__-Server/src/a.ts"], "feat/x", "", masters))

    def test_verified_with_tests_passes(self):
        self.assertIsNone(evaluate(["__SYSTEM_NAME__-Server/src/a.ts", "__SYSTEM_NAME__-Server/src/a.test.ts"], "feat/done", lookup("feat/done")))

    def test_file_classification(self):
        self.assertTrue(is_source_file("__SYSTEM_NAME__-Mobile-Customer/feature/auth/Login.kt"))
        self.assertFalse(is_source_file("__SYSTEM_NAME__-Mobile-Customer/feature/auth/LoginTest.kt"))
        self.assertTrue(is_test_file("composeApp/src/commonTest/kotlin/A.kt"))
        self.assertFalse(is_source_file(".claude/hooks/guard_git.py"))


class RulesMap(unittest.TestCase):
    """A rule the plan turned off in .claude/projects.json (`rules`: id -> false) is not enforced; the others still are."""

    def tearDown(self):
        _common._RULES_OVERRIDE = {}

    def test_missing_map_or_id_means_on(self):
        self.assertTrue(_common.rule_on("no-force-push", {}))
        self.assertTrue(_common.rule_on("no-force-push", {"other": False}))
        self.assertFalse(_common.rule_on("no-force-push", {"no-force-push": False}))

    def test_registry_map_is_read_when_no_override(self):
        _common._RULES_OVERRIDE = None
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, ".claude"))
            with open(os.path.join(tmp, ".claude", "projects.json"), "w", encoding="utf-8") as fh:
                json.dump({"projects": {}, "rules": {"no-hardcoded": False, "tests-with-code": True}}, fh)
            _common._ROOT_OVERRIDE = tmp
            try:
                self.assertEqual(_common.load_rules(), {"no-hardcoded": False, "tests-with-code": True})
                self.assertFalse(_common.rule_on("no-hardcoded"))
                self.assertTrue(_common.rule_on("no-force-push"))
            finally:
                _common._ROOT_OVERRIDE = None

    def test_force_push_allowed_only_when_its_rule_is_off(self):
        cmd = "git push --force origin feat/done"
        self.assertIsNotNone(violation(cmd, "feat/done", lookup))
        self.assertIsNone(violation(cmd, "feat/done", lookup, {"no-force-push": False}))
        self.assertIsNotNone(violation("git push origin main", "feat/done", lookup, {"no-force-push": False}))

    def test_protected_branch_commit_and_push_follow_their_rule(self):
        off = {"no-protected-commits": False}
        self.assertIsNone(violation("git commit -m x", "main", lookup, off))
        self.assertNotIn("Pushing to main", violation("git push origin main", "main", lookup, off))  # the task block rule still applies
        self.assertIsNotNone(violation("git push origin main", "main", lookup))
        self.assertIsNotNone(violation("git commit --no-verify -m x", "main", lookup, off))

    def test_hook_bypass_follows_its_rule(self):
        self.assertIsNone(violation("git commit --no-verify -m x", "feat/done", lookup, {"no-hook-bypass": False}))

    def test_push_checks_follow_the_loop_and_review_rules(self):
        cmd = "git push -u origin feat/open"
        self.assertIsNotNone(violation(cmd, "feat/open", lookup))
        self.assertIsNotNone(violation(cmd, "feat/open", lookup, {"verify-loop": False}))   # the review is still required
        self.assertIsNone(violation(cmd, "feat/open", lookup, {"verify-loop": False, "four-role-review": False}))
        self.assertIsNone(violation("git push -u origin feat/missing", "feat/missing", lookup, {"verify-loop": False, "four-role-review": False}))

    def test_secret_and_hardcode_checks_follow_their_rules(self):
        path, text = "__SYSTEM_NAME__-Server/src/app.ts", 'const u = "https://api.example.com"; ' + fake_assignment("apiKey")
        self.assertEqual(findings(path, text, {"no-hardcoded": False}), ["secret/API key"])
        self.assertEqual(findings(path, text, {"no-secrets": False}), ["URL"])
        self.assertEqual(findings(path, text, {"no-secrets": False, "no-hardcoded": False}), [])
        config = "__SYSTEM_NAME__-Server/src/config/env.ts"
        self.assertIn("secret/API key", findings(config, fake_assignment("pass" + "word"), {}))
        self.assertEqual(findings(config, fake_assignment("pass" + "word"), {"no-secrets": False}), [])

    def test_stop_hook_follows_tests_loop_and_review_rules(self):
        source = ["__SYSTEM_NAME__-Server/src/a.ts"]
        self.assertIn("no unit test", evaluate(source, "feat/done", lookup("feat/done")))
        self.assertIsNone(evaluate(source, "feat/done", lookup("feat/done"), rules={"tests-with-code": False}))
        both = {"verify-loop": False, "four-role-review": False}
        self.assertIsNotNone(evaluate(source + ["x/a.test.ts"], "feat/open", lookup("feat/open")))
        self.assertIsNone(evaluate(source + ["x/a.test.ts"], "feat/open", lookup("feat/open"), rules=both))
        self.assertIsNone(evaluate(source + ["x/a.test.ts"], "feat/none", "", rules=both))
        self.assertIn("no unit test", evaluate(source, "feat/none", "", rules=both))

    def test_prompt_reminder_drops_the_rules_that_are_off(self):
        full = reminder({})
        self.assertIn("one verification loop (Loops: 1/1)", full)
        self.assertIn("unit tests", full)
        short = reminder({"verify-loop": False, "tests-with-code": False})
        self.assertNotIn("Loops: 1/1", short)
        self.assertNotIn("unit tests", short)
        self.assertIn("4-role review", short)
        self.assertTrue(short.startswith("Reminder: ") and short.endswith("."))


class SessionStartTest(unittest.TestCase):
    def test_prints_branch_map_and_open_tasks(self):
        import session_start
        text = session_start.build("feat/x", "## System map", "### T-1 Work\n- Status: IN PROGRESS\n### T-2 Old\n- Status: DONE\n")
        self.assertIn("Branch: feat/x", text)
        self.assertIn("## System map", text)
        self.assertIn("T-1 Work [IN PROGRESS]", text)
        self.assertNotIn("T-2", text)

    def test_warns_on_a_protected_branch(self):
        import session_start
        self.assertIn("protected branch", session_start.build("main", "", ""))

    def test_a_failed_map_still_gives_a_session_header(self):
        import session_start
        self.assertNotIn("System map", session_start.build("feat/x", "", ""))


if __name__ == "__main__":
    unittest.main(verbosity=1)
