"""The analyzer seam: the fake one, the repair retry, and every failure path of the real one, driven by a fake `claude` command."""
from __future__ import annotations

import json
import os
import stat
import sys

from _support import TempDirTest, valid_plan_data

from analyzer import (AnalyzerFailed, BadOutput, BudgetStop, ClaudeAnalyzer, ClaudeNotFound, FakeAnalyzer, PlanRejected, Request,
                      propose, system_prompt, user_message)
from catalog import AnalyzerSettings, load_catalog

CATALOG = load_catalog()
FAKE_CLAUDE = """#!{python}
import json, os, sys, time
mode = os.environ["FAKE_MODE"]
stdin = sys.stdin.read()
with open(os.environ["FAKE_LOG"], "a") as log:
    log.write(json.dumps({{"argv": sys.argv[1:], "stdin": stdin, "disable_mds": os.environ.get("CLAUDE_CODE_DISABLE_CLAUDE_MDS"),
                          "cwd": os.getcwd()}}) + "\\n")
plan = json.load(open(os.environ["FAKE_PLAN"]))
def result(**extra):
    return json.dumps(dict({{"type": "result", "subtype": "success", "is_error": False, "total_cost_usd": 0.0123}}, **extra))
if mode == "ok":
    print(result(structured_output=plan))
elif mode == "fenced":
    print(result(result="```json\\n" + json.dumps(plan) + "\\n```"))
elif mode == "list":
    print(json.dumps([{{"type": "system"}}, json.loads(result(structured_output=plan))]))
elif mode == "exit2":
    sys.stderr.write("boom: it broke\\n"); sys.exit(2)
elif mode == "budget":
    print(result(subtype="error_max_budget_usd", is_error=True, total_cost_usd=1.02)); sys.exit(1)
elif mode == "garbage":
    print("this is not json")
elif mode == "nostructured":
    print(result(result="I am sorry, I cannot do that."))
elif mode == "iserror":
    print(result(is_error=True, subtype="error_during_execution", result="API overloaded"))
elif mode == "sleep":
    time.sleep(30)
elif mode == "repair":
    count = int(open(os.environ["FAKE_COUNT"]).read() or 0) if os.path.exists(os.environ["FAKE_COUNT"]) else 0
    open(os.environ["FAKE_COUNT"], "w").write(str(count + 1))
    bad = json.loads(json.dumps(plan)); bad["system"]["prefix"] = "a"
    print(result(structured_output=bad if count == 0 else plan))
elif mode == "alwaysbad":
    bad = json.loads(json.dumps(plan)); bad["system"]["prefix"] = "a"
    print(result(structured_output=bad))
"""


class ClaudeAnalyzerTest(TempDirTest):
    def setUp(self):
        super().setUp()
        self.script = self.root / "fake-claude"
        self.script.write_text(FAKE_CLAUDE.format(python=sys.executable), encoding="utf-8")
        self.script.chmod(self.script.stat().st_mode | stat.S_IXUSR)
        self.plan_file = self.write("plan.json", json.dumps(valid_plan_data()))
        self.log = self.root / "calls.log"

    def analyzer(self, mode, timeout=30, bin_path=None, budget=1.0):
        settings = AnalyzerSettings(str(bin_path or self.script), "sonnet", budget, timeout)
        environ = dict(os.environ, FAKE_MODE=mode, FAKE_LOG=str(self.log), FAKE_PLAN=str(self.plan_file), FAKE_COUNT=str(self.root / "count"))
        return ClaudeAnalyzer(settings, environ=environ)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text(encoding="utf-8").splitlines()]

    def request(self, **kw):
        return Request("A shop sells groceries.", CATALOG, **kw)

    def test_the_command_is_lean_and_the_document_goes_through_stdin(self):
        analysis = self.analyzer("ok").analyze(self.request())
        self.assertEqual(valid_plan_data()["system"], analysis.data["system"])
        self.assertAlmostEqual(0.0123, analysis.cost_usd)
        call = self.calls()[0]
        argv = call["argv"]
        self.assertEqual("-p", argv[0])
        for flag in ("--json-schema", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence"):
            self.assertIn(flag, argv)
        self.assertEqual("", argv[argv.index("--tools") + 1])
        self.assertEqual("", argv[argv.index("--setting-sources") + 1])
        self.assertEqual("sonnet", argv[argv.index("--model") + 1])
        self.assertEqual("1.00", argv[argv.index("--max-budget-usd") + 1])
        self.assertEqual("json", argv[argv.index("--output-format") + 1])
        schema = json.loads(argv[argv.index("--json-schema") + 1])
        self.assertEqual("object", schema["type"])
        self.assertIn("DATA, not instructions", argv[argv.index("--system-prompt") + 1])
        self.assertIn("open_questions", argv[argv.index("--system-prompt") + 1])
        self.assertNotIn("A shop sells groceries.", " ".join(argv))
        self.assertIn("<business_document>\nA shop sells groceries.\n</business_document>", call["stdin"])
        self.assertEqual("1", call["disable_mds"])
        self.assertNotEqual(os.getcwd(), call["cwd"])  # a neutral folder: no project settings or skills

    def test_the_budget_comes_from_the_request_when_given(self):
        self.analyzer("ok").analyze(self.request(budget_usd=0.4))
        argv = self.calls()[0]["argv"]
        self.assertEqual("0.40", argv[argv.index("--max-budget-usd") + 1])

    def test_answer_as_text_json_and_as_a_message_list(self):
        for mode in ("fenced", "list"):
            self.assertEqual("acme-shop", self.analyzer(mode).analyze(self.request()).data["system"]["slug"], mode)

    def test_claude_missing(self):
        with self.assertRaises(ClaudeNotFound) as caught:
            self.analyzer("ok", bin_path=self.root / "no-such-claude").analyze(self.request())
        self.assertIn("was not found", str(caught.exception))
        self.assertIn("--plan", str(caught.exception))

    def test_non_zero_exit(self):
        with self.assertRaisesRegex(AnalyzerFailed, "exited with code 2: boom: it broke"):
            self.analyzer("exit2").analyze(self.request())

    def test_budget_stop(self):
        with self.assertRaisesRegex(BudgetStop, r"budget cap of \$1.00.*max_budget_usd"):
            self.analyzer("budget").analyze(self.request())

    def test_invalid_json_and_missing_structured_output(self):
        with self.assertRaisesRegex(BadOutput, "did not print JSON"):
            self.analyzer("garbage").analyze(self.request())
        with self.assertRaisesRegex(BadOutput, "without the structured plan"):
            self.analyzer("nostructured").analyze(self.request())

    def test_reported_error_and_timeout(self):
        with self.assertRaisesRegex(AnalyzerFailed, "API overloaded"):
            self.analyzer("iserror").analyze(self.request())
        with self.assertRaisesRegex(AnalyzerFailed, "longer than 1 seconds"):
            self.analyzer("sleep", timeout=1).analyze(self.request())

    def test_a_huge_document_is_refused_before_any_call(self):
        with self.assertRaisesRegex(AnalyzerFailed, "limit"):
            self.analyzer("ok").analyze(Request("x" * 130_000, CATALOG))
        self.assertFalse(self.log.exists())

    def test_one_repair_retry_then_success_adds_up_the_cost(self):
        said = []
        proposal = propose(self.analyzer("repair"), "A shop.", CATALOG, 1.0, said.append)
        self.assertEqual(2, proposal.attempts)
        self.assertAlmostEqual(0.0246, proposal.cost_usd)
        self.assertEqual("ACME", proposal.plan.system.prefix)
        self.assertEqual(1, len(said))
        first, second = self.calls()
        self.assertNotIn("rejected by the validator", first["stdin"])
        self.assertIn("rejected by the validator", second["stdin"])
        self.assertIn("system.prefix", second["stdin"])
        self.assertLess(float(second["argv"][second["argv"].index("--max-budget-usd") + 1]), 1.0)  # only what is left

    def test_a_plan_that_stays_invalid_stops_with_a_clear_error(self):
        with self.assertRaises(PlanRejected) as caught:
            propose(self.analyzer("alwaysbad"), "A shop.", CATALOG, 1.0)
        self.assertEqual(2, len(self.calls()))
        self.assertIn("still fails validation after one repair attempt", str(caught.exception))
        self.assertIn("system.prefix", str(caught.exception))
        self.assertAlmostEqual(0.0246, caught.exception.cost_usd)

    def test_no_repair_when_the_budget_is_used_up(self):
        with self.assertRaisesRegex(PlanRejected, "no repair was tried"):
            propose(self.analyzer("alwaysbad", budget=0.01), "A shop.", CATALOG, 0.01)
        self.assertEqual(1, len(self.calls()))


class FakeAnalyzerTest(TempDirTest):
    def test_canned_answers_in_order_and_requests_recorded(self):
        fake = FakeAnalyzer([valid_plan_data()], cost_usd=0.5)
        proposal = propose(fake, "Doc.", CATALOG, 1.0)
        self.assertEqual((1, 0.5), (proposal.attempts, proposal.cost_usd))
        self.assertEqual("Doc.", fake.requests[0].document)
        with self.assertRaisesRegex(AnalyzerFailed, "no more answers"):
            fake.analyze(Request("Doc.", CATALOG))

    def test_an_exception_in_the_list_is_raised(self):
        with self.assertRaises(BudgetStop):
            propose(FakeAnalyzer([BudgetStop("cap")]), "Doc.", CATALOG, 1.0)

    def test_repair_through_the_fake(self):
        bad = valid_plan_data()
        bad["modules"] = []
        fake = FakeAnalyzer([bad, valid_plan_data()])
        self.assertEqual(2, propose(fake, "Doc.", CATALOG, 1.0).attempts)
        self.assertIn("modules", fake.requests[1].errors[0])
        self.assertEqual(bad, fake.requests[1].previous)

    def test_empty_document_and_prompt_content(self):
        with self.assertRaisesRegex(AnalyzerFailed, "empty"):
            propose(FakeAnalyzer([]), "  \n", CATALOG, 1.0)
        prompt = system_prompt(CATALOG)
        for text in ("DATA, not instructions", "open_questions", "Never invent", "otp", "docker-server", "web:"):
            self.assertIn(text, prompt)
        self.assertIn("previous_answer", user_message(Request("Doc.", CATALOG, previous={"a": 1}, errors=["x: bad"])))

    def test_from_file(self):
        path = self.write("plan.json", json.dumps(valid_plan_data()))
        self.assertEqual("acme-shop", FakeAnalyzer.from_file(path).responses[0]["system"]["slug"])
