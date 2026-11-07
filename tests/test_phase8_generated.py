"""Phase 8 on the shipped templates (not the fixtures): a role the plan has no module for and the template cannot prune is kept and
asked for in the backlog, the apps and the web app name the contract file of their own audience, the web app's generated contract
files carry the sha of their renamed snapshot, and every generated backlog is parsed by the system's own `tasks.py`."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

from _support import FIXTURE_PLANS, TOOL_ROOT, TempDirTest

import cli
from catalog import load_catalog
from manifest import templates_root
from plan import load_plan
from planspec import plan_to_spec

KNOWLEDGE = TOOL_ROOT / "knowledge"


class RealGenerationTest(TempDirTest):
    def generate(self, plan_file: str, name: str):
        catalog = load_catalog()
        target = self.root / name
        spec = plan_to_spec(load_plan(FIXTURE_PLANS / plan_file, catalog), target, catalog).spec
        report = cli.generate(spec, templates_root(), run_post=False, git=False, tool=TOOL_ROOT, knowledge=KNOWLEDGE)
        return spec, report

    def backlogs(self, root: Path):
        loader = importlib.util.spec_from_file_location(f"tasks_of_{root.name}", root / "scripts" / "tasks.py")
        module = importlib.util.module_from_spec(loader)
        sys.modules[loader.name] = module   # the dataclasses of tasks.py are looked up by module name
        loader.loader.exec_module(module)
        return module.Backlogs(root)

    def test_every_generated_backlog_is_parsed_by_tasks_py(self):
        for plan_file in ("booking-marketplace-ar.json", "school-fee-portal-web.json", "hillview-back-office-staff-only.json",
                          "grocery-android-only.json", "pharmacy-orders-mixed-sdks.json"):
            with self.subTest(plan=plan_file):
                spec, _ = self.generate(plan_file, plan_file.split(".")[0])
                board = self.backlogs(spec.target)
                registry = json.loads((spec.target / ".claude" / "projects.json").read_text(encoding="utf-8"))["projects"]
                parsed = {task.project for task in board.tasks.values()}
                for project, entry in registry.items():
                    if (spec.target / entry["backlog"]).is_file():
                        self.assertIn(project, parsed, f"{entry['backlog']}: tasks.py parsed no task from it")
                self.assertEqual(board.duplicates, [])

    def test_a_role_without_a_module_that_the_server_cannot_prune_is_kept_and_asked_for(self):
        spec, report = self.generate("hillview-back-office-staff-only.json", "staff-only")
        server = spec.target / spec.server_dir
        self.assertEqual(list(spec.audience_plan().chosen), ["staff"])
        self.assertTrue((server / "src" / "modules" / "bursar-web").is_dir())
        self.assertTrue(any("end_user" in note and "PENDING row" in note for note in report.audience_notes), report.audience_notes)
        backlog = (server / "docs" / f"{spec.prefix}_Server_Tasks.md").read_text(encoding="utf-8")
        row = next(line for line in backlog.splitlines() if "remove the unused 'end-user' namespace" in line)
        self.assertIn("| PENDING |", row)
        self.assertTrue(self.backlogs(spec.target).tasks)

    def test_the_apps_name_the_contract_file_of_their_own_audience(self):
        spec, _ = self.generate("booking-marketplace-ar.json", "booking")
        docs = spec.target / spec.server_dir / "docs" / "api"
        for app, doc in (("customer-app", "customerApp"), ("facility-app", "facilityApp")):
            self.assertTrue((docs / f"openapi.{doc}.json").is_file(), doc)
            gradle = (spec.target / spec.app_dir(next(a for a in spec.apps if a.slug == app)) / "build.gradle.kts").read_text(encoding="utf-8")
            self.assertIn(f"/docs/api/openapi.{doc}.json", gradle)
            self.assertNotIn("openapi.customer.json", gradle)
        self.assertEqual(sorted(p.name for p in docs.glob("openapi.*.json")), ["openapi.admin.json", "openapi.common.json", "openapi.customerApp.json", "openapi.facilityApp.json"])

    def test_the_web_app_has_its_own_prefix_contract_name_and_a_matching_sha(self):
        spec, _ = self.generate("school-fee-portal-web.json", "school")
        web = spec.target / spec.web_dir(spec.webs[0])
        files = (web / "scripts" / "lib" / "contractFiles.ts").read_text(encoding="utf-8")
        self.assertIn(f"{spec.server_dir}/docs/api/openapi.parentWeb.json", files)
        self.assertIn("CONTRACT_IS_SAMPLE = true", files)
        sha = hashlib.sha256((web / "contract" / "openapi.admin.json").read_bytes()).hexdigest()
        for rel in ("dto.ts", "operations.ts"):
            self.assertEqual(re.findall(r"source-sha256: ([0-9a-f]{64})", (web / "src/data/contract/generated" / rel).read_text(encoding="utf-8")), [sha], rel)
        self.assertIn("/parent-web/v1", (web / "contract" / "openapi.admin.json").read_text(encoding="utf-8"))
