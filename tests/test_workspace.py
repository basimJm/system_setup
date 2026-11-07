"""`.claude/projects.json` for several part combinations, starter files and the kmp manifest check."""
from __future__ import annotations

import json

from _support import FIXTURE_TEMPLATES, TempDirTest, make_spec

from kmp import check_kmp_manifest, identity_leftovers
from manifest import load_manifest, parse_manifest
from prompts import AppSpec
from workspace import ensure_project_files, projects_registry, run_tasks_check, write_registry


class RegistryTest(TempDirTest):
    def test_full_system(self):
        registry = projects_registry(make_spec(self.root))
        projects = registry["projects"]
        self.assertEqual(["server", "admin", "customer", "merchant", "storage", "otp"], list(projects))
        self.assertEqual(["TODO", "IN PROGRESS", "IN REVIEW", "DONE", "PENDING", "BLOCKED", "CANCELLED"], registry["statuses"])
        self.assertEqual("INTEGRATION.md", registry["board_file"])
        self.assertEqual({"title": "ACME-Server (backend API)", "kind": "server", "prefix": "SRV", "dir": "ACME-Server", "master": "server",
                          "backlog": "ACME-Server/docs/ACME_Server_Tasks.md", "session": "ACME-Server/.claude/session.md",
                          "memory": "ACME-Server/.claude/memory.md", "integration": "ACME-Server/.claude/Integration.md"},
                         projects["server"])
        self.assertEqual(("ADM", "admin", "ACME-Admin-Dashboard/docs/ACME_Admin_Tasks.md"),
                         (projects["admin"]["prefix"], projects["admin"]["master"], projects["admin"]["backlog"]))
        self.assertEqual(("MER", "merchant", "ACME-Mobile-Merchant/docs/ACME_Merchant_Tasks.md"),
                         (projects["merchant"]["prefix"], projects["merchant"]["master"], projects["merchant"]["backlog"]))
        self.assertEqual(("STO", "server", "acme-shop-storage", "acme-shop-storage/docs/ACME_Package_Storage_Tasks.md"),
                         (projects["storage"]["prefix"], projects["storage"]["master"], projects["storage"]["dir"], projects["storage"]["backlog"]))
        self.assertEqual("acme-shop-otp/docs/ACME_Package_OTP_Tasks.md", projects["otp"]["backlog"])
        self.assertEqual(len(projects), len({p["prefix"] for p in projects.values()}))

    def test_partial_systems(self):
        server_only = projects_registry(make_spec(self.root, with_admin=False, apps=[], sdks=[]))["projects"]
        self.assertEqual(["server"], list(server_only))
        apps_only = projects_registry(make_spec(self.root, with_server=False, with_admin=False, sdks=[]))["projects"]
        self.assertEqual(["customer", "merchant"], list(apps_only))
        sdks_only = projects_registry(make_spec(self.root, with_server=False, with_admin=False, apps=[]))["projects"]
        self.assertEqual({"server"}, {p["master"] for p in sdks_only.values()})
        one_app = projects_registry(make_spec(self.root, sdks=[], apps=[AppSpec("Shop", "shop")]))["projects"]
        self.assertEqual(("SHO", "shop", "ACME-Mobile-Shop"), (one_app["shop"]["prefix"], one_app["shop"]["master"], one_app["shop"]["dir"]))

    def test_registry_written_and_starter_files_fill_what_templates_did_not_ship(self):
        spec = make_spec(self.root, sdks=["otp"], apps=[AppSpec("Customer", "customer")])
        registry = projects_registry(spec)
        path = write_registry(self.root, registry)
        self.assertEqual(registry, json.loads(path.read_text(encoding="utf-8")))
        self.write("ACME-Server/docs/ACME_Server_Tasks.md", "| ID | Task | Status |\n| SRV-001 | shipped | TODO |\n")
        created = ensure_project_files(self.root, registry)
        self.assertNotIn("ACME-Server/docs/ACME_Server_Tasks.md", created)
        self.assertIn("ACME-Server/.claude/session.md", created)
        self.assertIn("acme-shop-otp/docs/ACME_Package_OTP_Tasks.md", created)
        self.assertIn("ACME-Server/CLAUDE.md", created)
        self.assertIn("ACME-Mobile-Customer/docs/ACME_Customer_Tasks.md", created)
        self.assertIn("| SRV-001 | shipped |", (self.root / "ACME-Server/docs/ACME_Server_Tasks.md").read_text(encoding="utf-8"))
        self.assertIn("| OTP-001 |", (self.root / "acme-shop-otp/docs/ACME_Package_OTP_Tasks.md").read_text(encoding="utf-8"))
        self.assertIn("feat/cus-001-scaffold", (self.root / "ACME-Mobile-Customer/docs/ACME_Customer_Tasks.md").read_text(encoding="utf-8"))
        self.assertEqual([], ensure_project_files(self.root, registry))  # idempotent

    def test_tasks_check_reports_a_missing_tool(self):
        ok, output = run_tasks_check(self.root)
        self.assertIsNone(ok)
        self.assertIn("scripts/tasks.py", output)


class KmpContractTest(TempDirTest):
    def test_fixture_kmp_manifest_passes_and_a_wrong_one_is_explained(self):
        self.assertEqual([], check_kmp_manifest(load_manifest(FIXTURE_TEMPLATES / "kmp")))
        wrong = parse_manifest({"kind": "kmp", "description": "x", "placeholders": [],
                                "sentinels": {"Acme Shop": "__SYSTEM_NAME__"}}, self.root)
        problems = check_kmp_manifest(wrong)
        self.assertEqual(5, len(problems))
        self.assertTrue(any("'Acme Shop'" in p and "__APP_NAME__" in p for p in problems))
        self.assertTrue(any("com/acme/shop" in p for p in problems))

    def test_identity_leftovers_find_paths_and_contents(self):
        self.write("app/src/com/acme/shop/A.kt", "package x")
        self.write("app/README.md", "Welcome to Acme Shop")
        self.write("app/clean.kt", "package com.acme.customer")
        self.assertEqual(["README.md", "src/com/acme/shop/A.kt"], identity_leftovers(self.root / "app"))
