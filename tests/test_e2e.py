"""End to end on tests/fixtures/templates: every part instantiated, workspace filled, tasks.py check OK, git initialised."""
from __future__ import annotations

import io
import json
import subprocess
from contextlib import redirect_stdout

from _support import FIXTURE_KNOWLEDGE, FIXTURE_TEMPLATES, TOOL_ROOT, TempDirTest, make_spec

from cli import generate, main, print_report
from business import Business, business_from
from prompts import AppSpec


class EndToEndTest(TempDirTest):
    def generate(self, **overrides):
        spec = make_spec(self.root / "acme-shop", **overrides)
        return spec, generate(spec, FIXTURE_TEMPLATES, run_post=False, git=True, tool=self.root / "tool", knowledge=FIXTURE_KNOWLEDGE)

    def test_full_system_is_generated_filled_checked_and_committed(self):
        business = business_from({"summary": "Customers order.\nShops fulfil.", "currency": "USD", "currency_minor_unit": "cent, 2 decimals",
                                  "business_time_zone": "Europe/Paris", "actors": "Customer: orders; Shop: fulfils", "rules": ["One order per slot"],
                                  "jobs": "Reminder 1 h before", "integrations": "payments: decide later", "open_decisions": "Gateway"})
        spec, report = self.generate(business=business)
        repo = spec.target
        # every part landed in its folder
        self.assertEqual(["server", "admin", "sdk", "sdk", "kmp", "kmp", "workspace"], [r.kind for r in report.results])
        for folder in ("ACME-Server", "ACME-Admin-Dashboard", "acme-shop-storage", "acme-shop-otp", "ACME-Mobile-Customer", "ACME-Mobile-Merchant"):
            self.assertTrue((repo / folder).is_dir(), folder)
        # server: sentinels, tokens, renames, skip, binary intact
        pkg = json.loads((repo / "ACME-Server/package.json").read_text(encoding="utf-8"))
        self.assertEqual(("@acme/server", "ACME backend API", "https://api-dev.example.com", "https://api.example.com"),
                         (pkg["name"], pkg["description"], pkg["config"]["devApi"], pkg["config"]["prodApi"]))
        self.assertTrue((repo / "ACME-Server/docs/ACME_Server_Tasks.md").is_file())
        self.assertFalse((repo / "ACME-Server/node_modules").exists())
        self.assertFalse((repo / "ACME-Server/debug.log").exists())
        self.assertIn(b"WAB", (repo / "ACME-Server/assets/logo.png").read_bytes())
        # sdk: common + kind overlay, rename, kinds metadata
        self.assertIn("// storage:", (repo / "acme-shop-storage/src/storage.ts").read_text(encoding="utf-8"))
        self.assertIn("// otp:", (repo / "acme-shop-otp/src/otp.ts").read_text(encoding="utf-8"))
        self.assertIn("OTP overlay README", (repo / "acme-shop-otp/README.md").read_text(encoding="utf-8"))
        self.assertIn("Common README", (repo / "acme-shop-storage/README.md").read_text(encoding="utf-8"))
        self.assertEqual({"name": "@acme/storage", "description": "acme-shop-storage: presigned uploads", "prefix": "STO", "kind": "storage",
                          "title": "Storage", "sibling": "acme-shop-analytics"},
                         json.loads((repo / "acme-shop-storage/package.json").read_text(encoding="utf-8")))
        self.assertFalse((repo / "acme-shop-storage/node_modules").exists())
        # kmp: project/ layer only, package path rename, sentinels incl. hosts, targeted edit, binary untouched
        app = repo / "ACME-Mobile-Merchant"
        self.assertFalse((app / "README.md").exists())
        self.assertFalse((app / "project").exists())
        self.assertFalse((app / "build").exists())
        kt = (app / "composeApp/src/commonMain/kotlin/com/acme/merchant/App.kt").read_text(encoding="utf-8")
        self.assertEqual('package com.acme.merchant\n\nconst val APP_NAME = "Merchant"\nconst val PROJECT = "Merchant"\n'
                         'const val REFRESH = "/merchant/v1/auth/refresh"\n', kt)
        self.assertIn('<string name="app_name">التاجر</string>', (app / "androidApp/src/main/res/values-ar/strings.xml").read_text(encoding="utf-8"))
        self.assertIn('com-acme-merchant-android = { id = "com.acme.merchant.android" }', (app / "gradle/libs.versions.toml").read_text(encoding="utf-8"))
        self.assertIn("API_BASE_URL = https:/$()/api-dev.example.com", (app / "iosApp/Configuration/Dev.xcconfig").read_text(encoding="utf-8"))
        self.assertIn("TEAM_ID = \n", (app / "iosApp/Configuration/Config.xcconfig").read_text(encoding="utf-8"))
        realtime = (app / "core/realtime/src/commonMain/kotlin/com/acme/merchant/core/realtime/RealtimeConfig.kt").read_text(encoding="utf-8")
        self.assertIn('APP_NAMESPACE = "/merchant"', realtime)
        self.assertIn('PROBE_PACKET = "40/app,"', realtime)
        self.assertIn('"../ACME-Server/docs/api/openapi.customer.json"', (app / "scripts/api_sync.py").read_text(encoding="utf-8"))
        self.assertTrue((app / "scripts/api_sync.py").stat().st_mode & 0o100)
        self.assertEqual(b"\x89PNG Acme Shop com.acme.shop", (app / "androidApp/src/main/res/mipmap/ic_launcher.png").read_bytes())
        self.assertEqual({}, report.identity_left)
        # workspace: tables, masters, projects.json shipped by the template through __PROJECTS_JSON__
        guide = (repo / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("Masters: `server`, `admin`, `customer`, `merchant`.", guide)
        self.assertIn("| `ACME-Mobile-Customer/` | Customer app (KMP + Compose Multiplatform, `com.acme.customer`, tasks `CUS`, master `customer`) |", guide)
        self.assertIn("| `acme-shop-otp/` | SDK `@acme/otp` (ports + adapters, tasks `OTP`, master `server`) |", guide)
        # business answers rendered into the guide; raw answers + filled agent prompt written and linked
        self.assertIn("## Business\nCustomers order.\nShops fulfil.\nLanguage `ar` (RTL on); currency `USD` (`cent, 2 decimals`); stored `UTC`, computed `Europe/Paris`.", guide)
        self.assertIn("Actors:\n- Customer: orders\n- Shop: fulfils\nRules:\n1. One order per slot\nEntities:\n- TBD (open — ask the owner)\nJobs:\n- Reminder 1 h before", guide)
        self.assertIn("Open:\n- Gateway\n- Entities and states: TBD (open — ask the owner)\n", guide)
        self.assertIn("docs/BUSINESS_INPUT.md", report.created)
        self.assertIn("docs/AGENT_PROMPT.md", report.created)
        self.assertEqual(business, __import__("business").load_business_file(repo / "docs/BUSINESS_INPUT.md"))
        prompt = (repo / "docs/AGENT_PROMPT.md").read_text(encoding="utf-8")
        self.assertIn("# Acme Shop — Prompt for the AI agent", prompt)
        self.assertIn("| `customer` | `ACME-Mobile-Customer/` | `CUS` | `customer` | `ACME-Mobile-Customer/docs/ACME_Customer_Tasks.md` |", prompt)
        self.assertIn("masters: `server`, `admin`, `customer`, `merchant`)", prompt)
        self.assertIn("1. One order per slot", prompt)
        self.assertTrue(any("docs/AGENT_PROMPT.md" in step for step in report.steps))
        registry = json.loads((repo / ".claude/projects.json").read_text(encoding="utf-8"))
        self.assertIn("(fixture)", registry["_comment"])
        self.assertEqual(["server", "admin", "customer", "merchant", "storage", "otp"], list(registry["projects"]))
        self.assertEqual(["SRV", "ADM", "CUS", "MER", "STO", "OTP"], [p["prefix"] for p in registry["projects"].values()])
        self.assertIn("| ACME-Mobile-Customer (`com.acme.customer`) | CUS |", (repo / "INTEGRATION.md").read_text(encoding="utf-8"))
        # per-project files only where a template shipped nothing, from docs/templates when present; tasks.py check OK
        self.assertIn("ACME-Admin-Dashboard/.claude/session.md", report.created)
        self.assertNotIn("ACME-Admin-Dashboard/docs/ACME_Admin_Tasks.md", report.created)
        self.assertIn("acme-shop-otp/docs/ACME_Package_Otp_Tasks.md", report.created)
        backlog = (repo / "acme-shop-otp/docs/ACME_Package_Otp_Tasks.md").read_text(encoding="utf-8")
        self.assertTrue(backlog.startswith("# acme-shop-otp — Task Backlog\n\n> Pick the next task with `python3 scripts/tasks.py next otp`."))
        self.assertIn("| OTP-001 | Project scaffold", backlog)
        self.assertIn("| OTP-002 |", backlog)
        self.assertNotIn("SRV-0NN", backlog)  # the template's example rows are not copied (check would reject them)
        self.assertEqual("# ACME-Mobile-Customer — Rules for AI Agents\n\n- Branching: master `customer`.\n",
                         (repo / "ACME-Mobile-Customer/CLAUDE.md").read_text(encoding="utf-8"))
        self.assertIn("### CUS-NNN — <title>\n- Branch: `feat/cus-NNN-<key>`", (repo / "ACME-Mobile-Customer/.claude/session.md").read_text(encoding="utf-8"))
        self.assertIn("Memory", (repo / "ACME-Server/.claude/memory.md").read_text(encoding="utf-8"))  # built-in starter (no doc template)
        # knowledge copied and linked; vendored skills copied verbatim
        self.assertEqual(["docs/knowledge/LESSONS.md", "docs/knowledge/PLAYBOOKS.md"], report.knowledge)
        self.assertIn("# Lessons (fixture)", (repo / "docs/knowledge/LESSONS.md").read_text(encoding="utf-8"))
        readme = (repo / "README.md").read_text(encoding="utf-8")
        self.assertIn("# Acme Shop — Workspace", readme)
        self.assertIn("[`docs/AGENT_PROMPT.md`](docs/AGENT_PROMPT.md)", readme)
        self.assertIn("[`PLAYBOOKS.md`](docs/knowledge/PLAYBOOKS.md)", readme)
        self.assertIn("__SYSTEM_NAME__ stays a literal", (repo / ".claude/skills/demo/SKILL.md").read_text(encoding="utf-8"))
        self.assertEqual((True, "OK"), (report.check_ok, report.check_output))
        self.assertEqual({}, report.unresolved)
        self.assertEqual({}, report.sentinel_left)
        self.assertEqual([("server", "npm install"), ("server", "echo ACME-Server ready"), ("admin", "npm install"),
                          ("sdk", "npm install"), ("sdk", "npm install"), ("kmp", "./gradlew tasks"), ("kmp", "./gradlew tasks"),
                          ("workspace", "python3 scripts/tasks.py check")],
                         [(r.kind, c) for r in report.results for c in r.post_generate])
        self.assertEqual([], report.post_failures)  # not run
        # git: one commit on main containing the files
        self.assertIsNone(report.git_error)
        log = subprocess.run(["git", "log", "--oneline", "--format=%s"], cwd=repo, capture_output=True, text=True, check=True).stdout
        self.assertEqual("Acme Shop: system generated by SYSTEM_SETUP\n", log)
        self.assertEqual("main", subprocess.run(["git", "branch", "--show-current"], cwd=repo, capture_output=True, text=True, check=True).stdout.strip())
        branches = subprocess.run(["git", "branch", "--format=%(refname:short)"], cwd=repo, capture_output=True, text=True, check=True).stdout.split()
        self.assertEqual(["admin", "customer", "main", "merchant", "server"], sorted(branches))
        self.assertTrue(any("git push -u origin main server admin customer merchant" in step for step in report.steps))
        self.assertEqual("", subprocess.run(["git", "status", "--porcelain"], cwd=repo, capture_output=True, text=True, check=True).stdout)
        self.assertTrue(report.ok)
        with redirect_stdout(io.StringIO()) as out:
            print_report(report, run_post=False)
        self.assertIn("tasks.py check: OK", out.getvalue())
        self.assertIn("Next steps:", out.getvalue())

    def test_apps_and_sdks_only_system_writes_the_registry_itself_when_needed(self):
        spec, report = self.generate(with_server=False, with_admin=False, sdks=["payments"], apps=[AppSpec("Shop", "shop")])
        registry = json.loads((spec.target / ".claude/projects.json").read_text(encoding="utf-8"))
        self.assertEqual(["shop", "payments"], list(registry["projects"]))
        self.assertEqual(("SHO", "PAY"), (registry["projects"]["shop"]["prefix"], registry["projects"]["payments"]["prefix"]))
        self.assertEqual("acme-shop-payments/docs/ACME_Package_Payments_Tasks.md", registry["projects"]["payments"]["backlog"])
        self.assertEqual(["server", "shop"], spec.masters())
        self.assertTrue(report.check_ok, report.check_output)
        self.assertEqual({}, report.unresolved)
        self.assertFalse((spec.target / "ACME-Server").exists())

    def test_run_post_executes_rendered_commands_and_reports_failures(self):
        spec = make_spec(self.root / "sys", with_server=False, with_admin=False, apps=[], sdks=[])
        report = generate(spec, FIXTURE_TEMPLATES, run_post=True, git=False, tool=self.root / "tool")
        self.assertEqual([], report.post_failures)  # workspace post_generate = tasks.py check
        self.assertIsNone(report.git_error)
        self.assertFalse((spec.target / ".git").exists())

    def test_unknown_sdk_kind_and_bad_target_stop_before_writing(self):
        from manifest import ManifestError
        from engine import EngineError
        spec = make_spec(self.root / "sys", sdks=["analytics"])  # not in the fixture's kinds
        with self.assertRaises(ManifestError) as caught:
            generate(spec, FIXTURE_TEMPLATES, tool=self.root / "tool")
        self.assertIn("analytics", str(caught.exception))
        self.write("busy/file.txt", "x")
        with self.assertRaises(EngineError):
            generate(make_spec(self.root / "busy"), FIXTURE_TEMPLATES, tool=self.root / "tool")


class CliMainTest(TempDirTest):
    def test_yes_with_flags_runs_end_to_end_and_list_templates(self):
        target = self.root / "out"
        argv = ["--yes", "--name", "Beta Store", "--name-ar", "متجر بيتا", "--prefix", "BETA", "--package-root", "io.beta",
                "--npm-scope", "@beta", "--target", str(target), "--app", "Customer:customer", "--sdk", "otp,storage",
                "--dev-api-url", "https://api-dev.beta.io", "--prod-api-url", "https://api.beta.io", "--dev-web-url",
                "https://app-dev.beta.io", "--prod-web-url", "https://app.beta.io", "--team-id", "ABCDE12345",
                "--github-owner", "beta-inc", "--templates", str(FIXTURE_TEMPLATES), "--knowledge", str(FIXTURE_KNOWLEDGE), "--no-git",
                "--business", str(self.write("biz.md", "## Business summary\nShops sell.\n## Currency\nEUR\n## Core business rules\nr1; r2\n")),
                "--rtl", "off"]
        with redirect_stdout(io.StringIO()) as out:
            code = main(argv)
        self.assertEqual(0, code, out.getvalue())
        guide = (target / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("Shops sell.\nLanguage `ar` (RTL off); currency `EUR` (`TBD`)", guide)  # file + flag on top
        self.assertIn("Rules:\n1. r1\n2. r2\n", guide)
        self.assertIn("## Currency\nEUR\n", (target / "docs/BUSINESS_INPUT.md").read_text(encoding="utf-8"))
        self.assertIn("# Beta Store — Prompt for the AI agent", (target / "docs/AGENT_PROMPT.md").read_text(encoding="utf-8"))
        self.assertIn("TEAM_ID = ABCDE12345", (target / "BETA-Mobile-Customer/iosApp/Configuration/Config.xcconfig").read_text(encoding="utf-8"))
        self.assertIn("API_BASE_URL = https:/$()/api-dev.beta.io", (target / "BETA-Mobile-Customer/iosApp/Configuration/Dev.xcconfig").read_text(encoding="utf-8"))
        self.assertTrue((target / "beta-store-otp/src/otp.ts").is_file())
        self.assertIn("tasks.py check: OK", out.getvalue())
        self.assertIn("knowledge: docs/knowledge/LESSONS.md", out.getvalue())
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(0, main(["--list-templates", "--templates", str(FIXTURE_TEMPLATES)]))
        self.assertEqual(5, out.getvalue().count("ready"))

    def test_invalid_flag_and_target_inside_the_tool_are_refused(self):
        with redirect_stdout(io.StringIO()) as out:
            code = main(["--yes", "--name", "Beta", "--package-root", "Beta", "--target", str(self.root / "x"),
                         "--templates", str(FIXTURE_TEMPLATES)])
        self.assertEqual(2, code)
        self.assertIn("Package root", out.getvalue())
        with redirect_stdout(io.StringIO()) as out:
            code = main(["--yes", "--name", "Beta", "--target", str(self.root / "y"), "--templates", str(FIXTURE_TEMPLATES),
                         "--business", str(self.write("bad.md", "no headings"))])
        self.assertEqual(2, code)
        self.assertIn("Business domain", out.getvalue())
        with redirect_stdout(io.StringIO()) as out:
            code = main(["--yes", "--name", "Beta", "--target", str(TOOL_ROOT / "templates" / "generated"),
                         "--templates", str(FIXTURE_TEMPLATES), "--no-git"])
        self.assertEqual(1, code)
        self.assertIn("inside the tool", out.getvalue())
        self.assertFalse((TOOL_ROOT / "templates" / "generated").exists())
