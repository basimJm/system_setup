"""The lists a plan chooses from are data: loading, lookups, bad files, and adding a choice without touching code."""
from __future__ import annotations

import json
import shutil

from _support import TOOL_ROOT, TempDirTest

from catalog import CatalogError, load_analyzer_settings, load_catalog
from prompts import SDK_CATALOG

REAL = TOOL_ROOT / "catalog"


class CatalogTest(TempDirTest):
    def copy_catalog(self):
        target = self.root / f"catalog{len(list(self.root.iterdir()))}"
        shutil.copytree(REAL, target)
        return target

    def edit(self, folder, name, change):
        path = folder / name
        data = json.loads(path.read_text(encoding="utf-8"))
        change(data)
        path.write_text(json.dumps(data), encoding="utf-8")

    def test_real_catalog_loads_with_the_expected_choices(self):
        catalog = load_catalog()
        self.assertEqual(["server", "admin", "app", "web"], list(catalog.kinds))
        self.assertEqual(["android", "ios"], catalog.kinds["app"].default_platforms)
        self.assertTrue(catalog.kinds["server"].stores_data and not catalog.kinds["admin"].stores_data)
        self.assertEqual(["server", "web", "android", "ios"], list(catalog.platforms))
        for sdk in ("otp", "notifications", "payments", "storage", "maps", "analytics"):
            self.assertTrue(catalog.providers_for(sdk), sdk)
        self.assertEqual({"push", "email"}, {p.channel for p in catalog.providers_for("notifications")} & {"push", "email"})
        self.assertEqual({"render", "docker-server", "aws", "fly", "railway", "cloudflare", "vercel", "netlify", "custom"}, {h.id for h in catalog.hosts})

    def test_the_sdks_the_engine_builds_are_exactly_the_ones_marked_generated(self):
        catalog = load_catalog()
        self.assertEqual(set(SDK_CATALOG), {s.id for s in catalog.sdks.values() if s.generated})

    def test_lookups_ignore_case_and_accept_several_providers(self):
        catalog = load_catalog()
        self.assertEqual("twilio", catalog.find_provider("Twilio").id)
        self.assertEqual("fcm", catalog.find_provider("Firebase Cloud Messaging").id)
        self.assertTrue(catalog.provider_known("fcm, SendGrid"))
        self.assertTrue(catalog.provider_known("") and catalog.provider_known("none"))
        self.assertFalse(catalog.provider_known("fcm, some-local-gateway"))
        self.assertEqual(["fcm", "smtp"], catalog.provider_ids("fcm + smtp"))
        self.assertEqual(["server", "admin", "web"], catalog.deployable_kinds())
        self.assertIn("render", [h.id for h in catalog.hosts_for("server")])
        self.assertNotIn("cloudflare", [h.id for h in catalog.hosts_for("server")])
        self.assertIsNone(catalog.find_host("a-new-host"))

    def test_adding_a_provider_a_host_and_a_module_kind_needs_no_code(self):
        folder = self.copy_catalog()
        self.edit(folder, "providers.json", lambda d: d["providers"].append({"id": "newpay", "title": "New Pay", "sdk": "payments", "channel": "card"}))
        self.edit(folder, "deploy.json", lambda d: d["hosts"].append({"id": "my-host", "title": "My Host", "parts": ["server"]}))
        self.edit(folder, "modules.json", lambda d: d["kinds"].append(
            {"id": "kiosk", "title": "Kiosk", "description": "x", "platforms": {"allowed": ["web"], "default": ["web"]}, "deployable": True, "generated": False}))
        catalog = load_catalog(folder)
        self.assertTrue(catalog.provider_known("New Pay"))
        self.assertIsNotNone(catalog.find_host("my-host"))
        self.assertIn("kiosk", catalog.kinds)

    def test_bad_files_are_named(self):
        folder = self.copy_catalog()
        (folder / "sdks.json").write_text("{not json", encoding="utf-8")
        with self.assertRaisesRegex(CatalogError, "sdks.json.*not valid JSON"):
            load_catalog(folder)
        folder = self.copy_catalog()
        self.edit(folder, "providers.json", lambda d: d["providers"].append({"id": "x", "title": "X", "sdk": "no-such-sdk"}))
        with self.assertRaisesRegex(CatalogError, "unknown sdk"):
            load_catalog(folder)
        folder = self.copy_catalog()
        self.edit(folder, "deploy.json", lambda d: d["hosts"].append(d["hosts"][0]))
        with self.assertRaisesRegex(CatalogError, "duplicate id"):
            load_catalog(folder)
        folder = self.copy_catalog()
        self.edit(folder, "modules.json", lambda d: d["kinds"][0]["platforms"].update(default=["ios"]))
        with self.assertRaisesRegex(CatalogError, "default must be allowed"):
            load_catalog(folder)
        (folder / "modules.json").unlink()
        with self.assertRaisesRegex(CatalogError, "cannot read"):
            load_catalog(folder)

    def test_analyzer_settings(self):
        settings = load_analyzer_settings()
        self.assertEqual(("claude", "sonnet"), (settings.claude_bin, settings.model))
        self.assertTrue(0 < settings.max_budget_usd <= 1.0)
        folder = self.copy_catalog()
        self.edit(folder, "analyzer.json", lambda d: d.update(max_budget_usd=0))
        with self.assertRaisesRegex(CatalogError, "max_budget_usd"):
            load_analyzer_settings(folder)
