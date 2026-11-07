"""`intake` and `new`: the plan becomes a Spec (nothing dropped silently), `new --plan` generates end to end on the fixture templates,
a document goes through the fake analyzer, and every failure ends with a clear message."""
from __future__ import annotations

import io
import json
import os
import subprocess
from contextlib import redirect_stdout
from pathlib import Path

from _support import FIXTURE_KNOWLEDGE, FIXTURE_TEMPLATES, TOOL_ROOT, TempDirTest, valid_plan_data

from analyzer import AnalyzerFailed, FakeAnalyzer
from catalog import AnalyzerSettings, load_catalog
from cli import generate, main, print_report
from commands import keep_plan, run_intake, run_new
from plan import PLAN_FILE, Plan, load_plan
from planspec import plan_to_spec

CATALOG = load_catalog()


def plan_of(**change) -> Plan:
    data = valid_plan_data()
    for key, value in change.items():
        data[key] = value
    return Plan.from_dict(data, CATALOG)


class PlanToSpecTest(TempDirTest):
    def convert(self, plan):
        return plan_to_spec(plan, self.root / "out", CATALOG)

    def test_what_the_engine_builds_goes_into_the_spec(self):
        conversion = self.convert(plan_of())
        spec = conversion.spec
        self.assertEqual(("Acme Shop", "ACME", "com.acme", "@acme"), (spec.system_name, spec.prefix, spec.package_root, spec.npm_scope))
        self.assertEqual((True, True, ["otp", "payments"]), (spec.with_server, spec.with_admin, spec.sdks))
        self.assertEqual([("Customer", "customer", "")], [(a.name, a.slug, a.name_ar) for a in spec.apps])
        business = spec.business
        self.assertEqual(("en", "off", "EUR", "cent, 2 decimals", "UTC", "Europe/Dublin"),
                         (business.default_language, business.rtl, business.currency, business.currency_minor_unit,
                          business.stored_time_zone, business.business_time_zone))
        self.assertEqual(["Customer: orders"], business.actors)
        self.assertEqual(["Order: PLACED -> DELIVERED"], business.entities)
        self.assertIn("One-time codes: twilio (built in the system)", business.integrations)
        self.assertEqual(["How is alcohol handled? (proposed: ID check at the door)"], business.open_decisions)

    def test_everything_not_generated_is_listed(self):
        text = "\n".join(self.convert(plan_of()).deferred)
        for part in ("other languages ar", "language of the generated documents: en", "countries IE"):
            self.assertIn(part, text)
        self.assertNotIn("deployment of", text)   # phase 6: the chosen host's files are generated (see test_deploy.py)
        self.assertNotIn("SDK '", text)   # phase 5: every SDK and provider of the plan is generated, so none is listed as later

    def test_single_platform_apps_and_web_modules_are_generated_and_sdks_follow_their_source(self):
        data = valid_plan_data()
        data["modules"] += [
            {"id": "portal", "kind": "web", "name": "Portal", "audience": "parents", "why": "pay", "platforms": ["web"]},
            {"id": "driver", "kind": "app", "name": "Driver", "audience": "drivers", "why": "deliver", "platforms": ["android"]},
            {"id": "kiosk", "kind": "app", "name": "Kiosk", "audience": "walk-ins", "why": "order", "platforms": ["web"]},
            {"id": "admin-two", "kind": "admin", "name": "Second admin", "audience": "x", "why": "y", "platforms": ["web"]}]
        data["sdks"] += [
            {"id": "maps", "title": "Maps", "why": "zones", "source": "internal", "provider": "mapbox"},
            {"id": "loyalty", "title": "Loyalty", "why": "points", "source": "internal", "provider": ""},
            {"id": "storage", "title": "Storage", "why": "photos", "source": "published", "package": "@acme/storage", "version": "3.1.0", "provider": "s3"},
            {"id": "analytics", "title": "Analytics", "why": "events", "source": "none", "provider": ""}]
        conversion = self.convert(Plan.from_dict(data, CATALOG))
        spec, text = conversion.spec, "\n".join(conversion.deferred)
        self.assertEqual(["customer", "driver"], [a.slug for a in spec.apps])
        self.assertEqual([["android", "ios"], ["android"]], [a.platforms for a in spec.apps])
        self.assertEqual(["portal", "kiosk"], [w.slug for w in spec.webs])   # a web module and an app module that chose only web
        self.assertEqual(["otp", "payments", "maps", "loyalty"], spec.sdks)   # internal ones, new SDKs included
        self.assertEqual(["storage"], [item.id for item in spec.published_sdks])
        self.assertEqual({"maps", "loyalty"}, set(spec.sdk_overrides))
        for gone in ("web module", "platform android only", "only web was chosen", "web target", "not generated yet"):
            self.assertNotIn(gone, text)
        for part in ("admin module 'admin-two'",):
            self.assertIn(part, text)
        self.assertNotIn("SDK '", text)

    def test_answers_become_rules_and_an_unusual_name_keeps_the_slug_for_folders(self):
        data = valid_plan_data()
        data["open_questions"][0]["answer"] = "ID at the door"
        data["business"]["rules"] = ["A; B"]
        data["system"].update(name="Orchard", slug="green-orchard", name_ar="بستان")
        conversion = self.convert(Plan.from_dict(data, CATALOG))
        self.assertEqual(["A, B", "How is alcohol handled? Decided: ID at the door"], conversion.spec.business.rules)
        self.assertEqual([], conversion.spec.business.open_decisions)
        self.assertEqual(("Green Orchard", "بستان"), (conversion.spec.system_name, conversion.spec.system_name_ar))
        self.assertIn("folders are named from the slug", conversion.deferred[0])

    def test_a_server_less_and_admin_less_plan(self):
        data = valid_plan_data()
        data["modules"] = [data["modules"][2]]
        data["deployment"] = []
        spec = self.convert(Plan.from_dict(data, CATALOG)).spec
        self.assertEqual((False, False), (spec.with_server, spec.with_admin))


class NewCommandTest(TempDirTest):
    def setUp(self):
        super().setUp()
        self.cwd = os.getcwd()
        self.work = self.root / "work"
        self.work.mkdir()
        os.chdir(self.work)
        self.addCleanup(os.chdir, self.cwd)

    def run_main(self, argv):
        out = io.StringIO()
        with redirect_stdout(out):
            code = main(argv)
        return code, out.getvalue()

    def fixture_args(self, *extra):
        return ["--templates", str(FIXTURE_TEMPLATES), "--knowledge", str(FIXTURE_KNOWLEDGE), *extra]

    def test_new_with_a_plan_generates_end_to_end_with_no_model(self):
        plan_path = self.write("in/plan.json", json.dumps(valid_plan_data()))
        target = self.root / "acme-shop"
        code, text = self.run_main(["new", "--plan", str(plan_path), "--yes", "--target", str(target), *self.fixture_args()])
        self.assertEqual(0, code, text)
        for folder in ("ACME-Server", "ACME-Admin-Dashboard", "acme-shop-otp", "acme-shop-payments", "ACME-Mobile-Customer"):
            self.assertTrue((target / folder).is_dir(), folder)
        saved = load_plan(target / PLAN_FILE, CATALOG)
        self.assertEqual(Plan.from_dict(valid_plan_data(), CATALOG).to_dict(), saved.to_dict())
        self.assertFalse((target / "docs" / "BUSINESS.md").exists())
        self.assertIn("tasks.py check: OK", text)
        self.assertIn("Recorded in the plan, generated in a later phase", text)
        self.assertNotIn("deployment of 'server'", text)   # phase 6: no longer a later-phase item
        self.assertIn("database 'postgres' of 'server'", text)   # the plan's database is not the template's: a warning, not a silent drop
        business_input = (target / "docs" / "BUSINESS_INPUT.md").read_text(encoding="utf-8")
        self.assertIn("Order: PLACED -> DELIVERED", business_input)
        self.assertIn("How is alcohol handled?", business_input)
        tracked = subprocess.run(["git", "ls-files", PLAN_FILE], cwd=target, capture_output=True, text=True, check=True).stdout
        self.assertEqual(PLAN_FILE, tracked.strip())  # part of the first commit

    def test_new_with_a_document_uses_the_analyzer_and_keeps_the_document(self):
        document = self.write("in/BUSINESS.md", "# Acme Shop\nWe sell groceries.\n")
        fake = FakeAnalyzer([valid_plan_data()], cost_usd=0.07)
        target = self.root / "from-doc"
        out = io.StringIO()
        with redirect_stdout(out):
            code = run_new(["--business-doc", str(document), "--yes", "--target", str(target), "--no-git", "--no-documents", *self.fixture_args()],
                           generate, print_report, analyzer=fake)
        self.assertEqual(0, code, out.getvalue())
        self.assertEqual("# Acme Shop\nWe sell groceries.\n", fake.requests[0].document)
        self.assertEqual("# Acme Shop\nWe sell groceries.\n", (target / "docs" / "BUSINESS.md").read_text(encoding="utf-8"))
        self.assertIn("Analysis cost: $0.0700 (1 model call)", out.getvalue())
        self.assertTrue((target / PLAN_FILE).is_file())

    def test_interactive_new_asks_for_the_document_reviews_and_confirms(self):
        document = self.write("in/doc.md", "We sell groceries.")
        target = self.root / "asked"
        prompts = []

        def reader(prompt):
            prompts.append(prompt)
            if "Path of the business document" in prompt:
                return str(document)
            if "Create the system in folder" in prompt:
                return str(target)
            return ""

        out = io.StringIO()
        with redirect_stdout(out):
            code = run_new(["--no-git", "--no-documents", *self.fixture_args()], generate, print_report, analyzer=FakeAnalyzer([valid_plan_data()]), reader=reader)
        self.assertEqual(0, code, out.getvalue())
        self.assertTrue(any("Keep or remove" in p or "keep or remove" in p for p in prompts))
        self.assertTrue(any(p.startswith("Continue?") for p in prompts))
        self.assertTrue((target / "ACME-Server").is_dir())

    def test_declining_to_continue_creates_nothing(self):
        plan_path = self.write("in/plan.json", json.dumps(valid_plan_data()))
        target = self.root / "never"
        out = io.StringIO()
        with redirect_stdout(out):
            code = run_new(["--plan", str(plan_path), "--target", str(target), *self.fixture_args()], generate, print_report,
                           reader=lambda p: "no" if p.startswith("Continue?") else "")
        self.assertEqual(1, code)
        self.assertFalse(target.exists())

    def test_failures_end_with_a_clear_message_and_a_non_zero_code(self):
        code, text = self.run_main(["new", "--yes"])
        self.assertEqual(2, code)
        self.assertIn("--business-doc FILE (or --plan FILE)", text)
        code, text = self.run_main(["new", "--yes", "--business-doc", str(self.root / "missing.md")])
        self.assertEqual(2, code)
        self.assertIn("Cannot read the business document", text)
        bad = valid_plan_data()
        bad["modules"][0]["kind"] = "spaceship"
        code, text = self.run_main(["new", "--yes", "--plan", str(self.write("bad.json", json.dumps(bad)))])
        self.assertEqual(2, code)
        self.assertIn("modules[0].kind", text)
        document = self.write("doc.md", "x")
        out = io.StringIO()
        with redirect_stdout(out):
            code = run_new(["--yes", "--business-doc", str(document)], generate, print_report, analyzer=FakeAnalyzer([AnalyzerFailed("the model is down")]))
        self.assertEqual(1, code)
        self.assertIn("Analysis failed: the model is down", out.getvalue())

    def test_a_target_that_is_not_empty_saves_the_reviewed_plan_so_the_analysis_is_not_lost(self):
        plan_path = self.write("in/plan.json", json.dumps(valid_plan_data()))
        busy = self.root / "busy"
        busy.mkdir()
        (busy / "file.txt").write_text("x", encoding="utf-8")
        code, text = self.run_main(["new", "--plan", str(plan_path), "--yes", "--target", str(busy), *self.fixture_args()])
        self.assertEqual(1, code)
        self.assertIn("is not empty", text)
        self.assertIn(f"The reviewed plan was saved to {self.work / PLAN_FILE}", text)
        self.assertEqual("acme-shop", load_plan(self.work / PLAN_FILE, CATALOG).system.slug)
        self.assertEqual(self.work / "system.plan.2.json", keep_plan(plan_of()))

    def test_the_flat_command_still_works(self):
        code, text = self.run_main(["--list-templates", "--templates", str(FIXTURE_TEMPLATES)])
        self.assertEqual(0, code)
        self.assertIn("server", text)


class IntakeCommandTest(TempDirTest):
    def setUp(self):
        super().setUp()
        self.out = self.root / "deep" / "folder" / "BUSINESS.md"
        self.script = self.root / "fake-claude"
        self.script.write_text("#!/bin/sh\n", encoding="utf-8")
        self.script.chmod(0o755)
        self.settings = AnalyzerSettings(str(self.script), "sonnet", 1.0, 60)
        self.said = []

    def intake(self, runner, *extra, settings=None):
        return run_intake(["--out", str(self.out), *extra], runner=runner, say=self.said.append, environ={"PATH": "/usr/bin"},
                          settings=settings or self.settings)

    def test_starts_an_interactive_claude_with_the_intake_prompt_in_the_output_folder(self):
        seen = {}

        def runner(command, cwd, env):
            seen.update(command=command, cwd=cwd, env=env)
            self.out.write_text("# Business document\n", encoding="utf-8")   # what the interview would do
            return 0

        self.assertEqual(0, self.intake(runner))
        command = seen["command"]
        self.assertEqual(str(self.script), command[0])
        self.assertNotIn("-p", command)   # interactive, not print mode
        self.assertEqual("Write", command[command.index("--tools") + 1])
        prompt = command[command.index("--append-system-prompt") + 1]
        self.assertIn((TOOL_ROOT / "INTAKE_PROMPT.md").read_text(encoding="utf-8").strip(), prompt)
        self.assertIn(f"exactly this path: {self.out}", prompt)
        self.assertEqual(self.out.parent, Path(seen["cwd"]))
        self.assertTrue(self.out.parent.is_dir())
        self.assertEqual("1", seen["env"]["CLAUDE_CODE_DISABLE_CLAUDE_MDS"])
        self.assertIn("new --business-doc", "\n".join(self.said))
        self.assertEqual(command.index("--tools") + 2, command.index("--append-system-prompt"))  # the start message is not swallowed by --tools
        self.assertEqual("Start the interview now.", command[1])

    def test_claude_not_installed_says_what_to_do(self):
        calls = []
        code = self.intake(lambda *a, **k: calls.append(1) or 0, settings=AnalyzerSettings("no-such-claude-binary", "sonnet", 1.0, 60))
        self.assertEqual((1, []), (code, calls))
        text = "\n".join(self.said)
        self.assertIn("is not installed", text)
        self.assertIn("claude.ai", text)
        self.assertIn("INTAKE_PROMPT.md", text)
        self.assertIn("new --business-doc", text)

    def test_an_existing_document_is_not_overwritten_and_a_missing_result_is_reported(self):
        self.out.parent.mkdir(parents=True)
        self.out.write_text("mine", encoding="utf-8")
        self.assertEqual(1, self.intake(lambda *a, **k: 0))
        self.assertIn("already exists", "\n".join(self.said))
        self.assertEqual("mine", self.out.read_text(encoding="utf-8"))
        self.out.unlink()
        self.said.clear()
        self.assertEqual(1, self.intake(lambda *a, **k: 0))
        self.assertIn("was not written", "\n".join(self.said))
