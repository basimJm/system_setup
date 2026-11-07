"""Phase 5: SDKs and providers from the plan. The sources (internal, published, none), the three provider paths (ready adapter, builtin,
skeleton), a new SDK built from the generic overlay, dependencies added only when the provider is chosen, environment key names without
values, and `tasks.py check` on the output. Generation uses the real templates."""
from __future__ import annotations

import copy
import io
import json
import re
from contextlib import redirect_stdout
from pathlib import Path

from _support import FIXTURE_KNOWLEDGE, FIXTURE_PLANS, TOOL_ROOT, TempDirTest, valid_plan_data

from catalog import CatalogError, load_catalog
from cli import generate, main, print_report
from manifest import load_manifest, templates_root
from plan import PLAN_FILE, Plan, dumps
from planspec import plan_to_spec
from sdks import append_backlog_rows, one_line, plan_sdks, provider_uses

CATALOG = load_catalog()
SDK_TEMPLATE = templates_root() / "sdk"
SECRET_KEY_LINE = re.compile(r"^[A-Z][A-Z0-9_]*=$")
TOKEN = re.compile(r"__[A-Z][A-Z0-9]*(?:_[A-Za-z0-9]+)*__")


def sdk(sdk_id, provider="", source="internal", title=None, **extra):
    return {"id": sdk_id, "title": title or sdk_id.title(), "why": f"{sdk_id} is needed", "source": source, "provider": provider, **extra}


def mixed_plan() -> dict:
    data = valid_plan_data()
    data["modules"] = data["modules"][:2]   # server + admin: no mobile app, so generation stays fast
    data["deployment"] = data["deployment"][:2]
    data["sdks"] = [
        sdk("otp", "http-sms"),                       # internal, ready adapter, no npm package
        sdk("notifications", "fcm, smtp, AcmePush"),  # two ready adapters (npm packages) and a provider the catalog does not know
        sdk("storage", "s3, gcs"),                    # builtin + skeleton with a synchronous method
        sdk("payments", "tap"),                       # skeleton of a five-method port
        sdk("maps", "google-maps"),                   # in the catalog, no dedicated overlay: generic
        sdk("loyalty", "", title="Loyalty points"),   # new SDK, no provider yet
        sdk("analytics", "posthog", source="published", package="@acme/analytics", version="1.2.0"),
        sdk("chat", "", source="none"),
    ]
    return data


def plan_of(data) -> Plan:
    return Plan.from_dict(data, CATALOG)


def text_files(folder: Path):
    for path in sorted(folder.rglob("*")):
        if path.is_file() and "node_modules" not in path.parts:
            try:
                yield path, path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue


class CatalogDataTest(TempDirTest):
    def test_every_ready_adapter_is_a_complete_overlay_for_its_sdk(self):
        for provider in CATALOG.providers:
            self.assertFalse(provider.adapter and provider.builtin, provider.id)
            if not provider.adapter:
                continue
            folder = SDK_TEMPLATE / "providers" / provider.sdk / provider.adapter
            meta = json.loads((folder / "adapter.json").read_text(encoding="utf-8"))
            self.assertEqual((provider.id, provider.sdk), (meta["id"], meta["sdk"]), provider.id)
            files = [p for p in (folder / "files").rglob("*") if p.is_file()]
            self.assertTrue(any(p.parent.name == "adapters" for p in files), provider.id)
            self.assertTrue(any("tests" in p.parts for p in files), f"{provider.id} ships no test")
            for key in meta["env"]:
                self.assertTrue(key.startswith("__SDK_PREFIX__"), key)

    def test_the_catalog_names_a_port_for_every_sdk_and_a_generic_one_for_the_rest(self):
        for sdk_id in ("otp", "notifications", "payments", "storage", "analytics"):
            self.assertTrue(CATALOG.sdks[sdk_id].ports, sdk_id)
        self.assertEqual("PushSender", CATALOG.port_for("notifications", "push")["interface"])
        self.assertEqual("EmailSender", CATALOG.port_for("notifications", "email")["interface"])
        self.assertEqual("OtpChannel", CATALOG.port_for("otp", "whatsapp")["interface"])
        self.assertEqual("PushSender", CATALOG.port_for("notifications", "")["interface"])   # unknown channel: the first port
        self.assertEqual("__SDK_TITLE__Port", CATALOG.port_for("maps", "maps")["interface"])
        self.assertEqual("__SDK_TITLE__Port", CATALOG.port_for("sms", "sms")["interface"])    # an SDK that is not in the catalog
        self.assertTrue(CATALOG.skeleton_missing)

    def test_a_bad_ports_or_adapter_entry_is_refused(self):
        import shutil
        copy_root = self.root / "catalog"
        shutil.copytree(TOOL_ROOT / "catalog", copy_root)
        path = copy_root / "providers.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["providers"][0].update(adapter="x", builtin=True)
        path.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(CatalogError, "both `adapter` and `builtin`"):
            load_catalog(copy_root)
        shutil.copyfile(TOOL_ROOT / "catalog" / "providers.json", path)
        sdks_path = copy_root / "sdks.json"
        data = json.loads(sdks_path.read_text(encoding="utf-8"))
        data["sdks"][0]["ports"] = {"*": {"interface": "X"}}
        sdks_path.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(CatalogError, "ports"):
            load_catalog(copy_root)


class PlanSdksTest(TempDirTest):
    def test_sources_split_and_no_sdk_is_left_in_the_later_phase_list(self):
        conversion = plan_to_spec(plan_of(mixed_plan()), self.root / "out", CATALOG)
        spec = conversion.spec
        self.assertEqual(["otp", "notifications", "storage", "payments", "maps", "loyalty"], spec.sdks)
        self.assertEqual(["analytics"], [item.id for item in spec.published_sdks])
        self.assertNotIn("chat", spec.sdk_plans)   # source none: nothing is generated
        self.assertFalse([line for line in conversion.deferred if line.startswith("SDK ")], conversion.deferred)
        self.assertEqual({"maps", "loyalty"}, set(spec.sdk_overrides))

    def test_generic_sdks_get_their_own_unique_prefix_title_and_overlay(self):
        data = mixed_plan()
        data["sdks"] += [sdk("stock"), sdk("storm")]   # STO is taken by storage, so these must not clash
        spec = plan_to_spec(plan_of(data), self.root / "out", CATALOG).spec
        prefixes = [spec.sdk_prefix(name) for name in spec.sdks]
        self.assertEqual(len(prefixes), len(set(prefixes)))
        self.assertEqual("kinds/generic", spec.sdk_layer("loyalty"))
        self.assertEqual("Loyalty", spec.sdk_title_of("loyalty"))
        self.assertIn("Loyalty points. loyalty is needed", spec.sdk_description("loyalty"))

    def test_provider_modes_unknown_names_and_other_sdks_adapters(self):
        modes = {u.id: u.mode for u in provider_uses("notifications", "fcm, smtp, AcmePush, sendgrid", CATALOG)}
        self.assertEqual({"fcm": "adapter", "smtp": "adapter", "acmepush": "skeleton", "sendgrid": "skeleton"}, modes)
        self.assertEqual("builtin", provider_uses("storage", "s3", CATALOG)[0].mode)
        self.assertFalse(provider_uses("notifications", "AcmePush", CATALOG)[0].known)
        # the adapter belongs to the otp SDK: chosen for another SDK it is not copied, a skeleton is written instead
        self.assertEqual("skeleton", provider_uses("sms", "http-sms", CATALOG)[0].mode)
        self.assertEqual("skeleton", provider_uses("notifications", "s3", CATALOG)[0].mode)

    def test_an_sdk_id_that_is_a_master_branch_is_not_generated_and_is_said(self):
        data = valid_plan_data()
        data["sdks"] = [sdk("server")]
        selection = plan_sdks(plan_of(data), CATALOG)
        self.assertEqual([], selection.internal)
        self.assertIn("master branch name", selection.deferred[0])

    def test_text_for_comments_is_sanitized(self):
        self.assertEqual("Africa's Talking", one_line("Africa's Talking"))
        self.assertEqual("a / b", one_line("a */ b"))
        self.assertNotIn("__", one_line("x __SDK_TITLE__ y"))

    def test_backlog_rows_are_numbered_after_the_highest_id_of_the_prefix(self):
        path = self.write("b.md", "| ID | T | B | N | S | O |\n|---|---|---|---|---|---|\n| SMS-001 | a | b | — | TODO | x |\n| SMS-004 | a | b | SMS-001 | TODO | x |\n| OTP-009 | a | b | — | TODO | x |\n")
        ids = append_backlog_rows(path, "SMS", [("first", "one", "TODO", "n"), ("second", "two", "PENDING", "owner input: x")])
        self.assertEqual(["SMS-005", "SMS-006"], ids)
        self.assertIn("| SMS-006 | second | `feat/sms-006-two` | SMS-001 | PENDING | owner input: x |", path.read_text(encoding="utf-8"))
        self.assertEqual([], append_backlog_rows(path, "SMS", []))
        self.assertEqual([], append_backlog_rows(self.root / "missing.md", "SMS", [("t", "k", "TODO", "n")]))


class GenerationTest(TempDirTest):
    """One real generation of the mixed plan, shared by the assertions."""

    @classmethod
    def setUpClass(cls):
        import tempfile
        cls.tmp = tempfile.TemporaryDirectory()
        base = Path(cls.tmp.name).resolve()
        plan = plan_of(mixed_plan())
        cls.target = base / "acme-shop"
        spec = plan_to_spec(plan, cls.target, CATALOG).spec
        cls.report = generate(spec, templates_root(), git=False, knowledge=FIXTURE_KNOWLEDGE, extra_files={PLAN_FILE: dumps(plan)})
        out = io.StringIO()
        with redirect_stdout(out):
            print_report(cls.report, False)
        cls.code, cls.output = (0 if cls.report.ok else 1), out.getvalue()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def sdk(self, name) -> Path:
        return self.target / f"acme-shop-{name}"

    def read(self, name, rel) -> str:
        return (self.sdk(name) / rel).read_text(encoding="utf-8")

    def package(self, name) -> dict:
        return json.loads(self.read(name, "package.json"))

    def test_generation_succeeds_and_tasks_check_passes_on_the_output(self):
        self.assertEqual(0, self.code, self.output[-2000:])
        self.assertIn("tasks.py check: OK", self.output)
        self.assertNotIn("Unresolved tokens", self.output)

    def test_internal_sdks_get_folders_published_and_none_do_not(self):
        for name in ("otp", "notifications", "storage", "payments", "maps", "loyalty"):
            self.assertTrue(self.sdk(name).is_dir(), name)
        for name in ("analytics", "chat"):
            self.assertFalse(self.sdk(name).exists(), name)
        projects = json.loads((self.target / ".claude" / "projects.json").read_text(encoding="utf-8"))["projects"]
        self.assertEqual({"server", "admin", "otp", "notifications", "storage", "payments", "maps", "loyalty"}, set(projects))

    def test_no_generated_sdk_file_keeps_a_template_token(self):
        for name in ("otp", "notifications", "storage", "payments", "maps", "loyalty"):
            for path, text in text_files(self.sdk(name)):
                if path.name == "package-lock.json":
                    continue
                self.assertEqual([], TOKEN.findall(text), str(path))

    def test_a_ready_adapter_is_copied_with_its_test_and_exported(self):
        self.assertIn("export class HttpSmsChannel", self.read("otp", "src/adapters/http-sms.ts"))
        self.assertTrue((self.sdk("otp") / "tests/http-sms.test.ts").is_file())
        self.assertIn("HttpSmsChannel", self.read("otp", "src/index.ts"))
        for rel in ("src/adapters/fcm.ts", "src/adapters/fcm-vendor.ts", "tests/fcm.test.ts", "src/adapters/smtp.ts", "tests/smtp.test.ts"):
            self.assertTrue((self.sdk("notifications") / rel).is_file(), rel)
        index = self.read("notifications", "src/index.ts")
        self.assertIn("FcmPushSender", index)
        self.assertIn("SmtpEmailSender", index)
        self.assertNotIn("firebase-admin", self.read("notifications", "src/adapters/fcm.ts").split("import type")[0])   # no static vendor import

    def test_adapter_packages_are_added_only_to_the_sdk_whose_provider_was_chosen(self):
        notifications = self.package("notifications")
        self.assertIn("firebase-admin", notifications["dependencies"])
        self.assertIn("nodemailer", notifications["dependencies"])
        self.assertIn("@types/nodemailer", notifications["devDependencies"])
        self.assertIn("zod", notifications["dependencies"])   # what the template had stays
        for name in ("otp", "storage", "payments", "maps", "loyalty"):
            deps = self.package(name)["dependencies"]
            self.assertEqual(["zod"], list(deps), name)
        self.assertEqual(sorted(notifications["dependencies"]), list(notifications["dependencies"]))

    def test_post_generate_installs_instead_of_ci_when_the_lock_cannot_match(self):
        commands = {r.dest.name: r.post_generate for r in self.report.results if r.kind == "sdk"}
        self.assertEqual("npm install", commands["acme-shop-notifications"][0])
        self.assertEqual("npm ci", commands["acme-shop-otp"][0])
        for name, steps in commands.items():
            self.assertIn("npm run format", steps, name)
            self.assertLess(steps.index("npm run format"), steps.index("npm run verify"), name)

    def test_builtin_provider_copies_nothing_and_is_named_the_default(self):
        providers = self.read("storage", "src/config/providers.ts")
        self.assertIn("id: 's3'", providers)
        self.assertIn("adapter: 'builtin'", providers)
        self.assertIn("DEFAULT_PROVIDER = 's3'", providers)
        self.assertIn("built into this SDK", self.read("storage", ".claude/Integration.md"))
        self.assertFalse((self.sdk("storage") / "src/adapters/s3.ts").exists())

    def test_the_chosen_default_is_in_the_config_and_the_env_example(self):
        self.assertIn("DEFAULT_PROVIDER = 'fcm'", self.read("notifications", "src/config/providers.ts"))
        env = self.read("notifications", ".env.example")
        self.assertIn("Default provider: fcm", env)
        for key in ("NOT_FCM_SERVICE_ACCOUNT_FILE=", "NOT_SMTP_HOST=", "NOT_SMTP_PASSWORD="):
            self.assertIn(key, env.splitlines())
        self.assertIn("Default provider: http-sms", self.read("otp", ".env.example"))
        self.assertIn("OTP_SMS_GATEWAY_API_KEY=", self.read("otp", ".env.example").splitlines())

    def test_env_examples_hold_key_names_only_never_a_value(self):
        for name in ("otp", "notifications", "storage", "payments", "maps", "loyalty"):
            for line in self.read(name, ".env.example").splitlines():
                self.assertTrue(not line.strip() or line.startswith("#") or SECRET_KEY_LINE.match(line), f"{name}: {line}")

    def test_an_unknown_provider_gets_a_skeleton_with_a_failing_test_and_a_backlog_row(self):
        adapter = self.read("notifications", "src/adapters/acmepush.ts")
        self.assertIn("class AcmepushPushSender implements PushSender", adapter)
        self.assertIn("Promise.reject(notImplemented())", adapter)
        test = self.read("notifications", "tests/acmepush.test.ts")
        self.assertIn("it.failing('NOT IMPLEMENTED", test)
        for missing in CATALOG.skeleton_missing:
            self.assertIn(missing, test)
        self.assertIn("AcmepushPushSender", self.read("notifications", "src/index.ts"))
        backlog = self.read("notifications", "docs/ACME_Package_Notifications_Tasks.md")
        self.assertRegex(backlog, r"\| NOT-\d{3} \| AcmePush adapter for notifications: implement the skeleton .* \| TODO \| .*not in the catalog")
        self.assertIn("NOT in the provider catalog", self.read("notifications", ".claude/Integration.md"))

    def test_skeletons_cover_every_method_of_their_port_including_synchronous_ones(self):
        payments = self.read("payments", "src/adapters/tap.ts")
        for method in ("createSession", "verify", "refund", "parseWebhook", "close"):
            self.assertIn(f"  {method}(): ReturnType<PaymentGateway['{method}']>", payments)
        storage = self.read("storage", "src/adapters/gcs.ts")
        self.assertIn("getPublicUrl(): ReturnType<StorageProvider['getPublicUrl']> {\n    throw notImplemented();", storage)
        self.assertIn("read(): ReturnType<StorageProvider['read']> {\n    return Promise.reject(notImplemented());", storage)

    def test_a_new_sdk_is_built_from_the_generic_overlay_with_its_own_prefix_and_backlog(self):
        for rel in ("src/types.ts", "src/adapters/fake.ts", "tests/contract/port.contract.ts", "tests/loop/maps.loop.ts", "docs/Maps_BRD.md"):
            self.assertTrue((self.sdk("maps") / rel).is_file(), rel)
        self.assertIn("export interface MapsPort", self.read("maps", "src/types.ts"))
        self.assertIn("MAP_OPERATION_FAILED", self.read("maps", "src/constants/sdk.ts"))
        self.assertEqual("@acme/maps", self.package("maps")["name"])
        self.assertIn("class GoogleMapsMapsPort implements MapsPort", self.read("maps", "src/adapters/google-maps.ts"))
        backlog = self.read("maps", "docs/ACME_Package_Maps_Tasks.md")
        self.assertRegex(backlog, r"\| MAP-003 \| Write the BRD of maps and shape its port .* \| TODO \| \*\*owner input\*\*")
        self.assertRegex(backlog, r"\| MAP-004 \| Google Maps Platform adapter for maps")
        self.assertIn("LOY-003", self.read("loyalty", "docs/ACME_Package_Loyalty_Tasks.md"))
        self.assertFalse((self.sdk("loyalty") / "src/config/providers.ts").exists())   # no provider chosen yet: nothing to name

    def test_a_ready_adapter_without_a_real_proof_has_a_pending_row_for_the_owner(self):
        backlog = self.read("otp", "docs/ACME_Package_Otp_Tasks.md")
        self.assertRegex(backlog, r"\| OTP-003 \| Any SMS gateway with a JSON HTTP API adapter: real proof with a live account .* \| PENDING \| \*\*owner input\*\*: ")

    def test_the_published_sdk_is_a_dependency_of_the_server_and_recorded_in_integration(self):
        server = json.loads((self.target / "ACME-Server" / "package.json").read_text(encoding="utf-8"))
        self.assertEqual("1.2.0", server["dependencies"]["@acme/analytics"])
        self.assertEqual(sorted(server["dependencies"]), list(server["dependencies"]))
        integration = (self.target / "INTEGRATION.md").read_text(encoding="utf-8")
        self.assertIn("## Published SDKs (used, not built here)", integration)
        self.assertRegex(integration, r"\| Analytics \(`analytics`\) \| `@acme/analytics` \| `1\.2\.0` \| PostHog \| `ACME-Server/package.json`")
        server_result = next(r for r in self.report.results if r.kind == "server")
        self.assertEqual("npm install", server_result.post_generate[0])

    def test_the_plan_stays_the_only_source_of_the_choices(self):
        saved = json.loads((self.target / "system.plan.json").read_text(encoding="utf-8"))
        self.assertEqual(["otp", "notifications", "storage", "payments", "maps", "loyalty", "analytics", "chat"], [s["id"] for s in saved["sdks"]])
        self.assertEqual("1.2.0", saved["sdks"][6]["version"])


class OlderTemplateTest(TempDirTest):
    def test_an_sdk_template_without_providers_still_generates_and_skips_them(self):
        from _support import FIXTURE_TEMPLATES
        plan_path = self.write("in/plan.json", json.dumps(valid_plan_data()))
        out = io.StringIO()
        with redirect_stdout(out):
            code = main(["new", "--plan", str(plan_path), "--yes", "--target", str(self.root / "acme-shop"), "--no-git", "--no-documents",
                         "--templates", str(FIXTURE_TEMPLATES), "--knowledge", str(FIXTURE_KNOWLEDGE)])
        self.assertEqual(0, code, out.getvalue()[-1500:])
        self.assertTrue((self.root / "acme-shop" / "acme-shop-otp").is_dir())
        self.assertFalse((self.root / "acme-shop" / "acme-shop-otp" / "src" / "config" / "providers.ts").exists())


class TemplateManifestTest(TempDirTest):
    def test_the_sdk_manifest_still_loads_and_the_generic_overlay_is_not_a_chosen_kind(self):
        manifest = load_manifest(SDK_TEMPLATE)
        self.assertNotIn("generic", manifest.kinds)
        self.assertTrue((SDK_TEMPLATE / "kinds" / "generic" / "src" / "types.ts").is_file())
        self.assertTrue((SDK_TEMPLATE / "providers" / "skeleton" / "adapter.ts").is_file())

    def test_fixture_plans_still_validate(self):
        for name in ("pharmacy-orders-mixed-sdks", "school-fee-portal-web", "booking-marketplace-ar"):
            data = json.loads((FIXTURE_PLANS / f"{name}.json").read_text(encoding="utf-8"))
            self.assertTrue(plan_of(copy.deepcopy(data)).sdks, name)
