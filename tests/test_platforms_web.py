"""Phase 4: the `web` kind (a template on top of a base template), the prune lists that remove a platform from a KMP app,
web apps and platforms in the plan conversion, and the generated output (registry, masters, `tasks.py check`)."""
from __future__ import annotations

import json
import subprocess

from _support import FIXTURE_KNOWLEDGE, FIXTURE_TEMPLATES, TOOL_ROOT, TempDirTest, make_spec, valid_plan_data

from catalog import load_catalog
from documents import make_targets
from cli import generate, needed_kinds
from engine import EngineError, instantiate
from kmp import dropped_platforms
from manifest import ManifestError, load_manifest, parse_manifest, templates_root
from plan import Plan
from planspec import plan_to_spec
from prompts import AppSpec, WebSpec, parse_app, parse_web
from workspace import projects_registry

CATALOG = load_catalog()
APP_PLATFORMS = {"android": ["android"], "ios": ["ios"], "both": ["android", "ios"]}


def kmp_values(spec, app):
    values = spec.token_values()
    values.update(spec.app_values(app))
    return values


class PruneListTest(TempDirTest):
    """The kmp fixture declares `ios` and `android` prune groups; each platform choice leaves exactly its own files and targets."""

    def build(self, platforms):
        spec = make_spec(self.root / "sys", apps=[AppSpec("Customer", "customer", platforms=platforms)])
        manifest = load_manifest(FIXTURE_TEMPLATES / "kmp")
        result = instantiate(manifest, spec.target, kmp_values(spec, spec.apps[0]), spec.part_values(), drop=dropped_platforms(manifest, spec.apps[0]))
        return result.dest, result

    def test_android_only_has_no_ios_folder_source_set_or_target(self):
        dest, _ = self.build(["android"])
        self.assertFalse((dest / "iosApp").exists())
        self.assertFalse(list(dest.rglob("iosMain")))
        self.assertTrue((dest / "androidApp").is_dir())
        targets = (dest / "build-logic/Targets.kt").read_text(encoding="utf-8")
        self.assertIn("androidTarget()", targets)
        self.assertNotIn("ios", targets)

    def test_ios_only_has_no_android_folder_or_target(self):
        dest, _ = self.build(["ios"])
        self.assertFalse((dest / "androidApp").exists())
        self.assertTrue((dest / "iosApp").is_dir())
        self.assertTrue(list(dest.rglob("iosMain")))
        targets = (dest / "build-logic/Targets.kt").read_text(encoding="utf-8")
        self.assertIn("iosArm64()", targets)
        self.assertNotIn("androidTarget", targets)

    def test_both_platforms_keep_everything(self):
        dest, _ = self.build(["android", "ios"])
        self.assertTrue((dest / "androidApp").is_dir() and (dest / "iosApp").is_dir())
        self.assertEqual("kotlin {\n    androidTarget()\n    iosArm64()\n    iosSimulatorArm64()\n}\n", (dest / "build-logic/Targets.kt").read_text(encoding="utf-8"))

    def test_the_dropped_groups_are_the_platforms_not_chosen(self):
        manifest = load_manifest(FIXTURE_TEMPLATES / "kmp")
        self.assertEqual({"ios", "android"}, set(manifest.prune))
        self.assertEqual(["ios"], dropped_platforms(manifest, AppSpec("A", "a", platforms=["android"])))
        self.assertEqual(["android"], dropped_platforms(manifest, AppSpec("A", "a", platforms=["ios"])))
        self.assertEqual([], dropped_platforms(manifest, AppSpec("A", "a")))

    def test_an_unknown_group_and_an_edit_that_no_longer_matches_are_errors_not_silent(self):
        manifest = load_manifest(FIXTURE_TEMPLATES / "kmp")
        spec = make_spec(self.root / "sys", apps=[AppSpec("Customer", "customer")])
        values = kmp_values(spec, spec.apps[0])
        with self.assertRaises(EngineError) as unknown:
            instantiate(manifest, spec.target, values, drop=["watchos"])
        self.assertIn("no prune group watchos", str(unknown.exception))
        manifest.prune["ios"]["edits"][0]["find"] = "text that is not in the file"
        with self.assertRaises(EngineError) as missing:
            instantiate(manifest, self.root / "other", values, drop=["ios"])
        self.assertIn("text not found in build-logic/Targets.kt", str(missing.exception))

    def test_a_dropped_group_also_removes_its_post_generate_commands(self):
        manifest = parse_manifest({"kind": "kmp", "placeholders": [], "post_generate": ["./gradlew a", "./gradlew linkIos"],
                                   "prune": {"ios": {"post_generate": ["./gradlew linkIos"]}}}, self.root)
        (self.root / "x.txt").write_text("x", encoding="utf-8")
        self.assertEqual(["./gradlew a", "./gradlew linkIos"], instantiate(manifest, self.root / "o1", {"__APP_DIR__": "app"}).post_generate)
        self.assertEqual(["./gradlew a"], instantiate(manifest, self.root / "o2", {"__APP_DIR__": "app"}, drop=["ios"]).post_generate)

    def test_prune_blocks_are_validated(self):
        base = {"kind": "kmp", "placeholders": []}
        for prune in ({"ios": {"remove": []}}, {"ios": {"skip": [1]}}, {"ios": {"edits": [{"file": "a", "find": "b"}]}},
                      {"ios": {"edits": [{"file": "a", "find": "", "replace_with": ""}]}}, ["ios"]):
            with self.assertRaises(ManifestError, msg=prune):
                parse_manifest(dict(base, prune=prune), self.root)
        ok = parse_manifest(dict(base, prune={"ios": {"edits": [{"file": "a", "find": "b", "replace_with": ""}]}}), self.root)
        self.assertEqual("", ok.prune["ios"]["edits"][0]["replace_with"])


class RealTemplatesTest(TempDirTest):
    """The prune lists and the sentinels of the real templates still match their files (an edit that matches nothing is an error)."""

    def kmp(self, platforms):
        spec = make_spec(self.root / "sys", apps=[AppSpec("Customer", "customer", platforms=platforms)])
        manifest = load_manifest(templates_root() / "kmp")
        result = instantiate(manifest, spec.target, kmp_values(spec, spec.apps[0]), spec.part_values(), drop=dropped_platforms(manifest, spec.apps[0]))
        return result.dest, result

    def text(self, dest, rel):
        return (dest / rel).read_text(encoding="utf-8")

    def test_android_only_app_has_no_ios_in_any_gradle_file_or_ci_job(self):
        dest, result = self.kmp(["android"])
        self.assertFalse((dest / "iosApp").exists())
        self.assertFalse(list(dest.rglob("iosMain")))
        for path in [*dest.rglob("*.kts"), *dest.rglob("*.kt"), *dest.rglob("*.toml"), dest / ".github/workflows/ci.yml"]:
            if "build" in path.parts:
                continue
            body = path.read_text(encoding="utf-8")
            for word in ("iosArm64", "iosSimulatorArm64", "iosMain", "ktor.ios", "xcodebuild", "iosApp"):
                self.assertNotIn(word, body, f"{path.relative_to(dest)} still mentions {word}")
        ci = self.text(dest, ".github/workflows/ci.yml")
        self.assertIn("  android:", ci)
        self.assertNotIn("\n  ios:", ci)
        self.assertIn("needs: [policy, lint, secret-scan, android]", ci)
        policy = json.loads(self.text(dest, "config/policy.json"))["variants"]
        self.assertEqual(([], {}), (policy["iosConfigurations"], policy["iosSchemes"]))
        self.assertEqual(["dev", "prod"], policy["flavors"])
        self.assertIn("./gradlew :androidApp:assembleDevDebug", result.post_generate)
        self.assertFalse([c for c in result.post_generate if "Ios" in c])
        json.loads(self.text(dest, "config/policy-baseline.json"))   # still valid JSON after the entries were removed
        self.assertIn('":androidApp"', self.text(dest, "settings.gradle.kts"))

    def test_ios_only_app_has_no_android_host_module_job_or_variants(self):
        dest, result = self.kmp(["ios"])
        self.assertFalse((dest / "androidApp").exists())
        self.assertTrue((dest / "iosApp").is_dir())
        self.assertNotIn("androidApp", self.text(dest, "settings.gradle.kts"))
        ci = self.text(dest, ".github/workflows/ci.yml")
        self.assertNotIn("\n  android:", ci)
        self.assertIn("needs: [policy, lint, secret-scan, ios]", ci)
        policy = json.loads(self.text(dest, "config/policy.json"))["variants"]
        self.assertEqual(([], []), (policy["flavors"], policy["buildTypes"]))
        self.assertTrue(policy["iosSchemes"])
        self.assertFalse([c for c in result.post_generate if "androidApp" in c])
        json.loads(self.text(dest, "config/policy-baseline.json"))

    def test_both_platforms_leave_the_template_unchanged(self):
        dest, result = self.kmp(["android", "ios"])
        self.assertIn("\n  ios:", self.text(dest, ".github/workflows/ci.yml"))
        plugin = next((dest / "build-logic").rglob("KotlinMultiplatform.kt"))
        self.assertIn("iosArm64()", plugin.read_text(encoding="utf-8"))
        self.assertIn("./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64", result.post_generate)

    def test_the_web_template_is_the_admin_template_with_its_own_identity(self):
        manifest = load_manifest(templates_root() / "web")
        self.assertEqual(("web", "admin"), (manifest.kind, manifest.base.kind))
        self.assertEqual("__WEB_DIR__", manifest.dest)
        spec = make_spec(self.root / "sys", webs=[WebSpec("Parent Portal", "parent-portal")])
        values = dict(spec.token_values(), **spec.web_values(spec.webs[0]))
        result = instantiate(manifest, spec.target, values, spec.part_values())
        dest = spec.target / "ACME-Web-ParentPortal"
        self.assertEqual(dest, result.dest)
        self.assertEqual("parent-portal", json.loads(self.text(dest, "package.json"))["name"])
        self.assertIn("<title>Parent Portal</title>", self.text(dest, "index.html"))
        self.assertEqual({}, result.sentinel_left)
        self.assertEqual({}, result.unresolved)
        leftovers = [str(p.relative_to(dest)) for p in dest.rglob("*") if p.is_file() and p.suffix in (".md", ".json", ".ts", ".tsx", ".html", ".toml", ".sh")
                     and ("Admin-Dashboard" in p.read_text(encoding="utf-8") or "__ADMIN_DIR__" in p.read_text(encoding="utf-8"))]
        self.assertEqual([], leftovers)
        self.assertEqual(["npm ci", "sh scripts/gate.sh"], result.post_generate)   # inherited from the base


class WebKindTest(TempDirTest):
    def test_the_fixture_web_template_overlays_and_extends_its_base(self):
        manifest = load_manifest(FIXTURE_TEMPLATES / "web")
        base = load_manifest(FIXTURE_TEMPLATES / "admin")
        self.assertEqual(base.placeholders + ["__WEB_NAME__", "__WEB_DIR__", "__WEB_SLUG__"], manifest.placeholders)
        self.assertEqual({"__ADMIN_DIR__": "__WEB_DIR__", "__SYSTEM_NAME__ admin panel": "__WEB_NAME__"}, manifest.sentinels)
        self.assertEqual(base.rename_paths, manifest.rename_paths)
        self.assertEqual(base.post_generate, manifest.post_generate)
        spec = make_spec(self.root / "sys", webs=[WebSpec("Parent Portal", "parent-portal")])
        result = instantiate(manifest, spec.target, dict(spec.token_values(), **spec.web_values(spec.webs[0])), spec.part_values())
        dest = spec.target / "ACME-Web-ParentPortal"
        self.assertEqual(dest, result.dest)
        self.assertEqual({"name": "ACME-Web-ParentPortal", "description": "Parent Portal", "homepage": "https://example.com", "dev": "https://dev.example.com"},
                         json.loads((dest / "package.json").read_text(encoding="utf-8")))          # base file, web sentinels
        self.assertEqual({"name": "Parent Portal", "slug": "parent-portal", "dir": "ACME-Web-ParentPortal"},
                         json.loads((dest / "web-notes.json").read_text(encoding="utf-8")))        # the web template's own file
        self.assertFalse(list((dest / "docs").glob("*Admin_Tasks.md")))                            # the web template's skip, added to the base's

    def test_a_base_must_exist_and_cannot_have_a_base_of_its_own(self):
        (self.root / "web").mkdir()
        (self.root / "web/TEMPLATE.json").write_text(json.dumps({"kind": "web", "placeholders": [], "base": "admin"}), encoding="utf-8")
        with self.assertRaises(ManifestError) as error:
            load_manifest(self.root / "web")
        self.assertIn("base template 'admin' not found", str(error.exception))
        for name, base in (("admin", "server"), ("server", "")):
            (self.root / name).mkdir()
            data = {"kind": name, "placeholders": []}
            if base:
                data["base"] = base
            (self.root / name / "TEMPLATE.json").write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaises(ManifestError) as chain:
            load_manifest(self.root / "web")
        self.assertIn("has a base of its own", str(chain.exception))
        with self.assertRaises(ManifestError):
            parse_manifest({"kind": "web", "placeholders": [], "base": "../x"}, self.root)

    def test_web_apps_get_their_own_prefix_master_folder_and_registry_entry(self):
        spec = make_spec(self.root / "sys", webs=[WebSpec("Parent Portal", "parent-portal"), WebSpec("Shop Site", "shop-site", "موقع")])
        self.assertEqual(["ACME-Web-ParentPortal", "ACME-Web-ShopSite"], [spec.web_dir(w) for w in spec.webs])
        prefixes = spec.all_prefixes()
        self.assertEqual(len(prefixes), len(set(prefixes.values())))     # unique across server, admin, apps, webs and SDKs
        self.assertEqual({"parent-portal": "PAR", "shop-site": "SHO"}, spec.web_prefixes())
        self.assertEqual(["server", "admin", "customer", "merchant", "parent-portal", "shop-site"], spec.masters())
        entry = projects_registry(spec)["projects"]["parent-portal"]
        self.assertEqual(("web", "PAR", "ACME-Web-ParentPortal", "parent-portal"), (entry["kind"], entry["prefix"], entry["dir"], entry["master"]))
        self.assertEqual("ACME-Web-ParentPortal/docs/ACME_ParentPortal_Tasks.md", entry["backlog"])
        self.assertIn("web", needed_kinds(spec))
        self.assertNotIn("web", needed_kinds(make_spec(self.root / "x")))

    def test_flat_command_names_accept_platforms_and_web_apps(self):
        self.assertEqual(["android"], parse_app("Customer:customer::android").platforms)
        self.assertEqual(["ios"], parse_app("Customer:customer:متجر:ios").platforms)
        self.assertEqual(["android", "ios"], parse_app("Customer:customer::both").platforms)
        self.assertEqual(["android", "ios"], parse_app("Customer").platforms)
        with self.assertRaises(ValueError):
            parse_app("Customer:customer::windows")
        self.assertEqual(("parent-portal", "Parent Portal"), (parse_web("Parent Portal").slug, parse_web("Parent Portal").name))
        for bad in ("", "Admin:admin", "Main:main", "X:Bad Slug"):
            with self.assertRaises(ValueError, msg=bad):
                parse_web(bad)


class PlanConversionTest(TempDirTest):
    def convert(self, modules, **more):
        data = valid_plan_data()
        data["modules"] = [data["modules"][0], *modules]
        data["deployment"] = []
        data.update(more)
        return plan_to_spec(Plan.from_dict(data, CATALOG), self.root / "out", CATALOG)

    def module(self, id, kind, platforms, name=None):
        return {"id": id, "kind": kind, "name": name or id.title(), "audience": "users", "why": "needed", "platforms": platforms}

    def test_each_mobile_platform_choice_is_kept_on_the_app(self):
        conversion = self.convert([self.module("a", "app", ["android"]), self.module("b", "app", ["ios"]), self.module("c", "app", ["android", "ios"])])
        self.assertEqual([("a", ["android"]), ("b", ["ios"]), ("c", ["android", "ios"])], [(a.slug, a.platforms) for a in conversion.spec.apps])
        self.assertEqual([], conversion.spec.webs)
        text = "\n".join(conversion.deferred)
        for gone in ("platform ", "Android and iOS", "not generated"):
            self.assertNotIn(gone, text)

    def test_a_web_module_becomes_a_web_app_and_is_not_listed_as_later(self):
        conversion = self.convert([self.module("parents", "web", ["web"])])
        self.assertEqual([("parents", "Parents")], [(w.slug, w.name) for w in conversion.spec.webs])
        self.assertEqual([], conversion.spec.apps)
        self.assertNotIn("parents", "\n".join(conversion.deferred))

    def test_mobile_plus_web_platforms_give_a_kmp_app_and_a_separate_web_app(self):
        conversion = self.convert([self.module("customer", "app", ["android", "ios", "web"]), self.module("customer-web", "web", ["web"]),
                                   self.module("driver", "app", ["android", "web"])])
        spec = conversion.spec
        self.assertEqual([("customer", ["android", "ios"]), ("driver", ["android"])], [(a.slug, a.platforms) for a in spec.apps])
        self.assertEqual(["customer-web", "customer-web-2", "driver-web"], sorted(w.slug for w in spec.webs))   # a taken slug gets a suffix
        self.assertEqual(len(spec.webs), len({w.slug for w in spec.webs}))
        self.assertIn("the web platform becomes its own web app 'driver-web' next to the android app", "\n".join(conversion.deferred))
        self.assertEqual(len(spec.all_prefixes()), len(set(spec.all_prefixes().values())))

    def test_an_app_module_that_chose_only_web_is_a_web_app(self):
        conversion = self.convert([self.module("kiosk", "app", ["web"])])
        self.assertEqual(([], ["kiosk"]), ([a.slug for a in conversion.spec.apps], [w.slug for w in conversion.spec.webs]))

    def test_web_ids_cannot_take_a_master_branch_name(self):
        data = valid_plan_data()
        data["modules"].append(self.module("admin", "web", ["web"]))
        with self.assertRaises(Exception) as error:
            Plan.from_dict(data, CATALOG)
        self.assertIn("reserved for a master branch", str(error.exception))

    def test_the_catalog_says_web_is_generated(self):
        self.assertTrue(CATALOG.kinds["web"].generated)
        self.assertEqual(["web"], CATALOG.kinds["web"].allowed_platforms)


class GeneratedSystemTest(TempDirTest):
    """Whole systems on the fixture templates: folders per platform choice, registry, masters, per-project files, `tasks.py check`."""

    def generate(self, **overrides):
        spec = make_spec(self.root / "sys", **overrides)
        return spec, generate(spec, FIXTURE_TEMPLATES, run_post=False, git=True, tool=self.root / "tool", knowledge=FIXTURE_KNOWLEDGE)

    def test_android_only_ios_only_both_and_web_apps_in_one_system(self):
        spec, report = self.generate(apps=[AppSpec("Customer", "customer", platforms=["android"]), AppSpec("Driver", "driver", platforms=["ios"]),
                                           AppSpec("Merchant", "merchant")],
                                     webs=[WebSpec("Parent Portal", "parent-portal"), WebSpec("Shop Site", "shop-site")])
        repo = spec.target
        self.assertTrue(report.check_ok, report.check_output)
        self.assertEqual({}, report.unresolved)
        self.assertEqual({}, report.sentinel_left)
        self.assertEqual(["server", "admin", "web", "web", "sdk", "sdk", "kmp", "kmp", "kmp", "workspace"], [r.kind for r in report.results])
        customer, driver, merchant = (repo / f"ACME-Mobile-{n}" for n in ("Customer", "Driver", "Merchant"))
        self.assertEqual((True, False), (( customer / "androidApp").is_dir(), (customer / "iosApp").exists()))
        self.assertEqual((False, True), ((driver / "androidApp").exists(), (driver / "iosApp").is_dir()))
        self.assertEqual((True, True), ((merchant / "androidApp").is_dir(), (merchant / "iosApp").is_dir()))
        registry = json.loads((repo / ".claude/projects.json").read_text(encoding="utf-8"))["projects"]
        for slug, folder in (("parent-portal", "ACME-Web-ParentPortal"), ("shop-site", "ACME-Web-ShopSite")):
            self.assertEqual(("web", folder), (registry[slug]["kind"], registry[slug]["dir"]))
            self.assertTrue((repo / folder / "package.json").is_file())
            self.assertTrue((repo / registry[slug]["backlog"]).is_file())
            self.assertTrue((repo / folder / "CLAUDE.md").is_file())
        prefixes = [p["prefix"] for p in registry.values()]
        self.assertEqual(len(prefixes), len(set(prefixes)))
        branches = subprocess.run(["git", "branch", "--format=%(refname:short)"], cwd=repo, capture_output=True, text=True, check=True).stdout.split()
        for master in ("parent-portal", "shop-site", "customer", "driver"):
            self.assertIn(master, branches)
        self.assertIn("ACME-Web-ParentPortal", (repo / "CLAUDE.md").read_text(encoding="utf-8"))   # the repository map lists the web app
        steps = "\n".join(report.steps)
        self.assertIn("first task `python3 scripts/tasks.py next parent-portal`", steps)

    def test_a_web_only_system_has_no_kmp_and_no_admin(self):
        spec, report = self.generate(with_admin=False, apps=[], sdks=[], webs=[WebSpec("Parent Portal", "parent-portal")])
        self.assertTrue(report.check_ok, report.check_output)
        self.assertEqual(["server", "web", "workspace"], [r.kind for r in report.results])
        self.assertEqual(["server", "parent-portal"], spec.masters())
        self.assertEqual({}, report.unresolved)


class DocumentTargetsTest(TempDirTest):
    """Where the documents of each module go: a web module has its own project, a second admin panel still gets a module folder."""

    def test_web_and_app_modules_map_to_their_project_and_a_second_admin_to_a_module_folder(self):
        data = valid_plan_data()
        data["modules"] += [
            {"id": "parents", "kind": "web", "name": "Parents", "audience": "parents", "why": "pay", "platforms": ["web"]},
            {"id": "admin-two", "kind": "admin", "name": "Second admin", "audience": "x", "why": "y", "platforms": ["web"]}]
        plan = Plan.from_dict(data, CATALOG)
        spec = make_spec(self.root / "sys", webs=[WebSpec("Parents", "parents")], apps=[AppSpec("Customer", "customer")])
        registry = projects_registry(spec)
        targets = {t.module.id: t for t in make_targets(plan, registry, self.root)}
        self.assertEqual(("parents", "ACME-Web-Parents/docs"), (targets["parents"].key, targets["parents"].docs_dir))
        self.assertEqual("Parents", targets["parents"].stem)
        self.assertEqual(("customer", "ACME-Mobile-Customer/docs"), (targets["customer"].key, targets["customer"].docs_dir))
        self.assertEqual(("", "docs/modules/admin-two"), (targets["admin-two"].key, targets["admin-two"].docs_dir))
