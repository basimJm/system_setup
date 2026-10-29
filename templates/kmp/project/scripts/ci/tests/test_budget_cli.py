import io
import json
import unittest
from contextlib import redirect_stdout
from support import CI_DIR, REPO_ROOT, TempProject
from policy.budget import check
import policy_checks


class BudgetTest(TempProject):
    def setUp(self):
        super().setUp()
        self.budget = self.write("config/budgets.json", json.dumps({"apkMaxBytes": {"dev": 100, "prod": 100}}))

    def apk(self, flavor, size, mapping=True):
        self.write(f"androidApp/build/outputs/apk/{flavor}/release/app.apk", "x" * size)
        if mapping:
            self.write(f"androidApp/build/outputs/mapping/{flavor}Release/mapping.txt", "m")

    def run_check(self):
        with redirect_stdout(io.StringIO()):
            return [(v.rule, v.message) for v in check(self.root, self.budget)]

    def test_within_budget_and_minified(self):
        self.apk("dev", 100)
        self.apk("prod", 10)
        self.assertEqual(self.run_check(), [])

    def test_over_budget(self):
        self.apk("dev", 101)
        self.apk("prod", 10)
        self.assertEqual([rule for rule, _ in self.run_check()], ["B001"])

    def test_single_flavor_is_checked_alone(self):
        self.apk("dev", 10)
        self.assertEqual(self.flavor_check("dev"), [])
        self.assertEqual([rule for rule, _ in self.flavor_check("prod")], ["B001", "B002"])

    def flavor_check(self, flavor):
        with redirect_stdout(io.StringIO()):
            return [(v.rule, v.message) for v in check(self.root, self.budget, flavor)]

    def test_missing_apk_and_mapping(self):
        self.apk("dev", 10, mapping=False)
        rules = [rule for rule, _ in self.run_check()]
        self.assertEqual(sorted(rules), ["B001", "B002", "B002"])


class CliTest(TempProject):
    def test_main_reports_failures_and_success(self):
        self.write("config/policy.json", json.dumps(self.config.data))
        self.write("core/a/A.kt", "x\n" * 301)
        with redirect_stdout(io.StringIO()) as out:
            code = policy_checks.main(["file-length", "--root", str(self.root)])
        self.assertEqual(code, 1)
        self.assertIn("[L001]", out.getvalue())
        with redirect_stdout(io.StringIO()):
            policy_checks.main(["file-length", "--root", str(self.root), "--update-baseline"])
            code = policy_checks.main(["file-length", "--root", str(self.root)])
        self.assertEqual(code, 0)


class RepositoryStateTest(unittest.TestCase):
    """The checked-in project itself must satisfy every policy (legacy debt only through the baseline)."""

    def test_repository_passes_all_checks(self):
        with redirect_stdout(io.StringIO()) as out:
            code = policy_checks.main(["all", "--root", str(REPO_ROOT)])
        self.assertEqual(code, 0, out.getvalue())


if __name__ == "__main__":
    unittest.main()
