"""The three sample businesses, analyzed once by the real analyzer (tests/fixtures/plans/*.json), give three different plans, and each
plan drives the fake analyzer and a full generation on the fixture templates."""
from __future__ import annotations

import io
import json
import shutil
from contextlib import redirect_stdout

from _support import FIXTURE_KNOWLEDGE, FIXTURE_PLANS, FIXTURE_TEMPLATES, SAMPLE_DOCS, TempDirTest

from analyzer import FakeAnalyzer, propose
from catalog import load_catalog
from cli import generate, print_report
from commands import run_new
from plan import PLAN_FILE, load_plan

CATALOG = load_catalog()
BOOKING, GROCERY, SCHOOL = "booking-marketplace-ar", "grocery-delivery-en", "school-fee-portal-web"
NAMES = (BOOKING, GROCERY, SCHOOL)


def fixture_plan(name):
    return load_plan(FIXTURE_PLANS / f"{name}.json", CATALOG)


class SamplePlansTest(TempDirTest):
    def test_documents_and_plans_exist_and_are_valid(self):
        for name in NAMES:
            self.assertTrue((SAMPLE_DOCS / f"{name}.md").read_text(encoding="utf-8").strip(), name)
            plan = fixture_plan(name)
            self.assertTrue(plan.modules and plan.business.actors and plan.open_questions, name)
        self.assertRegex((SAMPLE_DOCS / f"{BOOKING}.md").read_text(encoding="utf-8"), "[؀-ۿ]")

    def test_the_three_businesses_give_different_modules_and_sdks(self):
        plans = {name: fixture_plan(name) for name in NAMES}
        modules = {name: tuple(sorted((m.kind, tuple(m.platforms)) for m in plan.modules)) for name, plan in plans.items()}
        ids = {name: {m.id for m in plan.modules} for name, plan in plans.items()}
        sdks = {name: {s.id for s in plan.sdks} for name, plan in plans.items()}
        self.assertEqual(3, len(set(modules.values())))
        self.assertEqual(3, len({tuple(sorted(v)) for v in ids.values()}))
        self.assertEqual(3, len({tuple(sorted(v)) for v in sdks.values()}))
        self.assertEqual(3, len({plan.system.slug for plan in plans.values()}))
        self.assertEqual(3, len({(plan.languages.default, plan.currency.code) for plan in plans.values()}))

    def test_the_school_portal_is_web_only(self):
        plan = fixture_plan(SCHOOL)
        self.assertTrue(all(set(m.platforms) <= {"server", "web"} for m in plan.modules), [(m.id, m.platforms) for m in plan.modules])
        self.assertFalse([m for m in plan.modules if m.kind == "app"])
        self.assertTrue([m for m in plan.modules if m.kind == "web" or m.kind == "admin"])
        self.assertTrue(plan.sdk("payments"))
        self.assertEqual(("KES", "en"), (plan.currency.code, plan.languages.default))
        self.assertIn("sw", plan.languages.supported)

    def test_the_other_two_have_phone_apps_and_their_own_language_and_money(self):
        booking, grocery = fixture_plan(BOOKING), fixture_plan(GROCERY)
        for plan in (booking, grocery):
            self.assertTrue([m for m in plan.modules if m.kind == "app" and "android" in m.platforms and "ios" in m.platforms])
        self.assertEqual(("ar", "rtl", "ar", "SAR", "Asia/Riyadh"),
                         (booking.languages.default, booking.languages.direction, booking.languages.documents, booking.currency.code, booking.time_zones.business))
        self.assertEqual(("en", "ltr", "EUR", "Europe/Dublin"),
                         (grocery.languages.default, grocery.languages.direction, grocery.currency.code, grocery.time_zones.business))
        self.assertTrue(booking.sdk("payments") and grocery.sdk("payments"))

    def test_the_fake_analyzer_replays_each_real_plan_through_propose(self):
        for name in NAMES:
            document = (SAMPLE_DOCS / f"{name}.md").read_text(encoding="utf-8")
            fake = FakeAnalyzer.from_file(FIXTURE_PLANS / f"{name}.json")
            proposal = propose(fake, document, CATALOG, 1.0)
            self.assertEqual(fixture_plan(name).to_dict(), proposal.plan.to_dict(), name)
            self.assertEqual(document, fake.requests[0].document)


class SampleGenerationTest(TempDirTest):
    def setUp(self):
        super().setUp()
        # the fixture sdk template ships storage / otp / payments; add the two other catalog SDKs the real plans ask for
        self.templates = self.root / "templates"
        shutil.copytree(FIXTURE_TEMPLATES, self.templates)
        manifest = self.templates / "sdk" / "TEMPLATE.json"
        data = json.loads(manifest.read_text(encoding="utf-8"))
        data["kinds"]["analytics"] = {"dir": "kinds/analytics", "prefix": "ANA", "title": "Analytics"}
        manifest.write_text(json.dumps(data), encoding="utf-8")
        for kind in ("notifications", "analytics"):
            folder = self.templates / "sdk" / "kinds" / kind
            (folder / "src").mkdir(parents=True, exist_ok=True)
            (folder / "src" / f"{kind}.ts").write_text(f"// {kind}: overlay\n", encoding="utf-8")

    def generate(self, name, via_document):
        target = self.root / f"out-{name}"
        args = ["--yes", "--target", str(target), "--templates", str(self.templates), "--knowledge", str(FIXTURE_KNOWLEDGE), "--no-git"]
        args += ["--business-doc", str(SAMPLE_DOCS / f"{name}.md")] if via_document else ["--plan", str(FIXTURE_PLANS / f"{name}.json")]
        out = io.StringIO()
        with redirect_stdout(out):
            code = run_new(args, generate, print_report, analyzer=FakeAnalyzer.from_file(FIXTURE_PLANS / f"{name}.json"))
        return code, out.getvalue(), target

    def test_each_sample_generates_a_checked_system_and_the_three_differ(self):
        folders = {}
        for name in NAMES:
            plan = fixture_plan(name)
            code, text, target = self.generate(name, via_document=name != GROCERY)
            self.assertEqual(0, code, f"{name}\n{text[-1500:]}")
            self.assertIn("tasks.py check: OK", text)
            self.assertEqual(plan.to_dict(), load_plan(target / PLAN_FILE, CATALOG).to_dict())
            self.assertEqual(name != GROCERY, (target / "docs" / "BUSINESS.md").is_file())
            folders[name] = sorted(p.name for p in target.iterdir() if p.is_dir() and p.name not in {".claude", "docs", "scripts", "knowledge"})
            generated_sdks = [s.id for s in plan.sdks if s.source == "internal" and s.id in CATALOG.sdks and CATALOG.sdks[s.id].generated]
            for sdk in generated_sdks:
                self.assertTrue((target / f"{plan.system.slug}-{sdk}").is_dir() or any(f.endswith(f"-{sdk}") for f in folders[name]), (name, sdk))
            self.assertIn("Recorded in the plan, generated in a later phase", text)
        self.assertEqual(3, len({tuple(v) for v in folders.values()}))
        self.assertFalse([f for f in folders[SCHOOL] if "-Mobile-" in f])
        self.assertTrue([f for f in folders[BOOKING] if "-Mobile-" in f])
        self.assertTrue([f for f in folders[GROCERY] if "-Mobile-" in f])
