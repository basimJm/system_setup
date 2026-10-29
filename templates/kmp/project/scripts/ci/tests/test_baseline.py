import unittest
from support import TempProject
from policy import baseline
from policy.model import Violation

V = lambda path, rule, line=1: Violation(path, line, rule, "m")  # noqa: E731
PREFIX = ("H",)


class BaselineTest(TempProject):
    def test_counts(self):
        self.assertEqual(baseline.counts([V("a", "H006"), V("a", "H006"), V("b", "H001")]), {"a": {"H006": 2}, "b": {"H001": 1}})

    def test_within_allowance_passes(self):
        self.assertEqual(baseline.apply([V("a", "H006")], {"a": {"H006": 1}}, PREFIX), [])

    def test_new_violations_fail(self):
        failures = baseline.apply([V("a", "H006"), V("a", "H006", 2)], {"a": {"H006": 1}}, PREFIX)
        self.assertEqual(len(failures), 2)
        self.assertIn("baseline allows 1", failures[0])
        self.assertEqual(len(baseline.apply([V("new", "H001")], {}, PREFIX)), 1)

    def test_stale_allowance_fails(self):
        failures = baseline.apply([], {"a": {"H006": 3}}, PREFIX)
        self.assertEqual(len(failures), 1)
        self.assertIn("lower it", failures[0])

    def test_other_rule_groups_are_not_judged(self):
        self.assertEqual(baseline.apply([], {"a": {"L001": 1}}, PREFIX), [])

    def test_update_replaces_owned_entries_only(self):
        path = self.root / "baseline.json"
        path.write_text('{"a": {"L001": 1, "H006": 9}, "gone": {"H001": 2}}', encoding="utf-8")
        baseline.update(path, [V("a", "H006"), V("b", "H002")], PREFIX)
        self.assertEqual(baseline.load(path), {"a": {"H006": 1, "L001": 1}, "b": {"H002": 1}})


if __name__ == "__main__":
    unittest.main()
