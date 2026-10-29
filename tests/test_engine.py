"""Substitution (sentinels, tokens, repeated blocks), path renames, skip/binary handling and target checks."""
from __future__ import annotations

import json
from pathlib import PurePosixPath

from _support import TOOL_ROOT, TempDirTest

from engine import (EngineError, check_target, expand_blocks, instantiate, layer_dirs, leftovers, matches_any, render_path,
                    is_declared, render_text, sentinel_leftovers, split_leftovers, substitute_sentinels, substitute_tokens, template_files,
                    verification_errors)
from manifest import load_manifest, parse_manifest

VALUES = {"__SYSTEM_PREFIX__": "ACME", "__SYSTEM_NAME__": "Acme Shop", "__APP_PACKAGE__": "com.acme.customer",
          "__APP_PACKAGE_PATH__": "com/acme/customer", "__APP_PROJECT__": "Customer", "__NPM_SCOPE__": "@acme"}


def manifest(root, **extra):
    data = {"kind": "kmp", "description": "t", "placeholders": [], **extra}
    return parse_manifest(data, root)


class SubstitutionTest(TempDirTest):
    def test_sentinels_longest_literal_first_then_tokens(self):
        m = manifest(self.root, sentinels={"com.acme.shop": "__APP_PACKAGE__", "com.acme": "__PACKAGE_ROOT__",
                                           "Acme Shop": "__SYSTEM_NAME__"})
        text = substitute_sentinels("package com.acme.shop // Acme Shop by com.acme", m.sentinels)
        self.assertEqual("package __APP_PACKAGE__ // __SYSTEM_NAME__ by __PACKAGE_ROOT__", text)
        rendered = render_text("package com.acme.shop", m, {"__APP_PACKAGE__": "com.acme.customer"})
        self.assertEqual("package com.acme.customer", rendered)

    def test_tokens_including_adjacent_and_numbered_ones(self):
        values = {"__SYSTEM_PREFIX__": "ACME", "__APP_PROJECT__": "Customer", "__APP_DIR_2__": "ACME-Mobile-Merchant"}
        self.assertEqual("ACME_Customer_Tasks.md / ACME-Mobile-Merchant",
                         substitute_tokens("__SYSTEM_PREFIX_____APP_PROJECT___Tasks.md / __APP_DIR_2__", values))
        self.assertEqual(["__APP_DIR_3__", "__SDK_DIR_analytics__", "__UNKNOWN__"],
                         leftovers("x __UNKNOWN__ y __APP_DIR_3__ __not_a_token__ __SDK_DIR_analytics__ __init__"))

    def test_each_blocks_repeat_per_app_and_sdk_and_vanish_when_empty(self):
        text = "| Project |\n__EACH_APP__\n| __APP_DIR__ (__APP_PREFIX__) |\n__END_EACH__\n__EACH_SDK__\n| __SDK_DIR__ |\n__END_EACH__\nend\n"
        parts = {"APP": [{"__APP_DIR__": "A-1", "__APP_PREFIX__": "ONE"}, {"__APP_DIR__": "A-2", "__APP_PREFIX__": "TWO"}], "SDK": []}
        self.assertEqual("| Project |\n| A-1 (ONE) |\n| A-2 (TWO) |\nend\n", expand_blocks(text, parts))
        self.assertEqual("| Project |\nend\n", expand_blocks(text, {}))

    def test_render_path_renames_across_folders_and_refuses_escapes(self):
        m = manifest(self.root, rename_paths={"com/acme/shop": "__APP_PACKAGE_PATH__", "AcmeShop": "__APP_PROJECT__",
                                              "WAB": "__SYSTEM_PREFIX__"})
        self.assertEqual(PurePosixPath("src/com/acme/customer/App.kt"),
                         render_path(PurePosixPath("src/com/acme/shop/App.kt"), m, VALUES))
        self.assertEqual(PurePosixPath("iosApp/Customer/ACME_Customer_Tasks.md"),
                         render_path(PurePosixPath("iosApp/AcmeShop/WAB___APP_PROJECT___Tasks.md"), m, VALUES))
        with self.assertRaises(EngineError):
            render_path(PurePosixPath("__SYSTEM_PREFIX__"), m, {"__SYSTEM_PREFIX__": "../out"})

    def test_globs_match_whole_paths_folders_and_names(self):
        self.assertTrue(matches_any(PurePosixPath("node_modules/dep/index.js"), ["node_modules/**"]))
        self.assertTrue(matches_any(PurePosixPath("assets/logo.png"), ["*.png"]))
        self.assertTrue(matches_any(PurePosixPath("a/build/x"), ["build"]))
        self.assertFalse(matches_any(PurePosixPath("src/index.ts"), ["node_modules/**", "*.png"]))
        self.assertTrue(matches_any(PurePosixPath("build/out.txt"), ["**/build/**"]))
        self.assertTrue(matches_any(PurePosixPath("a/b/build/out.txt"), ["**/build/**"]))
        self.assertTrue(matches_any(PurePosixPath("local.properties"), ["**/local.properties"]))
        self.assertFalse(matches_any(PurePosixPath("builder/x.kt"), ["**/build/**"]))


class InstantiateTest(TempDirTest):
    def setUp(self):
        super().setUp()
        self.template = self.root / "kmp"
        self.write("kmp/TEMPLATE.json", json.dumps({
            "kind": "kmp", "description": "t", "placeholders": ["__SYSTEM_PREFIX__"],
            "sentinels": {"Acme Shop": "__APP_NAME__", "com.acme.shop": "__APP_PACKAGE__", "AcmeShop": "__APP_PROJECT__"},
            "rename_paths": {"com/acme/shop": "__APP_PACKAGE_PATH__", "AcmeShop": "__APP_PROJECT__"},
            "skip": ["build/**", "*.log"], "post_generate": ["echo __APP_PROJECT__"], "binary_globs": ["*.png"]}))
        self.write("kmp/src/com/acme/shop/App.kt", "package com.acme.shop\nval n = \"Acme Shop\" // __SYSTEM_PREFIX__ __MISSING__\n")
        self.write("kmp/build/out.txt", "skip me")
        self.write("kmp/trace.log", "skip me")
        (self.root / "kmp/img").mkdir()
        (self.root / "kmp/img/AcmeShop.png").write_bytes(b"\x89PNG Acme Shop com.acme.shop")
        (self.root / "kmp/raw.bin").write_bytes(b"\xff\xfe Acme Shop")
        script = self.write("kmp/run.sh", "#!/bin/sh\necho AcmeShop\n")
        script.chmod(0o755)
        self.values = {"__SYSTEM_PREFIX__": "ACME", "__APP_NAME__": "Customer", "__APP_PACKAGE__": "com.acme.customer",
                       "__APP_PACKAGE_PATH__": "com/acme/customer", "__APP_PROJECT__": "Customer", "__APP_DIR__": "ACME-Mobile-Customer"}

    def test_copies_substitutes_renames_skips_and_keeps_binaries(self):
        repo = self.root / "repo"
        result = instantiate(load_manifest(self.template), repo, self.values)
        dest = repo / "ACME-Mobile-Customer"
        self.assertEqual(dest, result.dest)
        self.assertEqual('package com.acme.customer\nval n = "Customer" // ACME __MISSING__\n',
                         (dest / "src/com/acme/customer/App.kt").read_text(encoding="utf-8"))
        self.assertFalse((dest / "src/com/acme/shop").exists())
        self.assertFalse((dest / "build").exists())
        self.assertFalse((dest / "trace.log").exists())
        self.assertFalse((dest / "TEMPLATE.json").exists())
        self.assertEqual(b"\x89PNG Acme Shop com.acme.shop", (dest / "img/Customer.png").read_bytes())  # renamed, bytes intact
        self.assertEqual(b"\xff\xfe Acme Shop", (dest / "raw.bin").read_bytes())  # not utf-8 -> binary
        self.assertEqual({}, result.unresolved)  # __MISSING__ is not a declared token
        self.assertEqual({"ACME-Mobile-Customer/src/com/acme/customer/App.kt": ["__MISSING__"]}, result.foreign)
        self.assertEqual(["echo Customer"], result.post_generate)
        self.assertTrue((dest / "run.sh").stat().st_mode & 0o100)
        self.assertEqual("#!/bin/sh\necho Customer\n", (dest / "run.sh").read_text(encoding="utf-8"))
        self.assertEqual(2, len(result.binaries))
        self.assertEqual([], result.overwritten)

    def test_second_template_writing_the_same_path_is_reported(self):
        repo = self.root / "repo"
        instantiate(load_manifest(self.template), repo, self.values)
        result = instantiate(load_manifest(self.template), repo, self.values)
        self.assertTrue(any(p.name == "App.kt" for p in result.overwritten))


class LeftoverTest(TempDirTest):
    def test_declared_tokens_and_families_are_unresolved_others_are_foreign(self):
        from manifest import parse_manifest as pm
        m = pm({"kind": "server", "description": "t", "placeholders": ["__SYSTEM_NAME__", "__APP_DIR_<n>__", "__SDK_DIR_<name>__"]}, self.root)
        unresolved, foreign = split_leftovers("__SYSTEM_NAME__ __APP_DIR_3__ __SDK_DIR_otp__ __TEXT__ __APP_DIR__ __NPM_SCOPE__", m,
                                              {"__NPM_SCOPE__": "@x"})
        self.assertEqual(["__APP_DIR_3__", "__NPM_SCOPE__", "__SDK_DIR_otp__", "__SYSTEM_NAME__"], unresolved)
        self.assertEqual(["__APP_DIR__", "__TEXT__"], foreign)
        self.assertTrue(is_declared("__APP_DIR_12__", ["__APP_DIR_<n>__"]))
        self.assertFalse(is_declared("__APP_DIR_a-b__", ["__APP_DIR_<n>__"]))


class TargetTest(TempDirTest):
    def test_target_inside_the_tool_or_containing_it_is_refused(self):
        with self.assertRaises(EngineError):
            check_target(TOOL_ROOT / "templates" / "new-system", TOOL_ROOT)
        with self.assertRaises(EngineError):
            check_target(TOOL_ROOT, TOOL_ROOT)
        with self.assertRaises(EngineError):
            check_target(TOOL_ROOT.parents[2], TOOL_ROOT)

    def test_target_must_be_absent_or_an_empty_folder(self):
        check_target(self.root / "fresh", self.root / "tool")
        (self.root / "empty").mkdir()
        check_target(self.root / "empty", self.root / "tool")
        self.write("full/x.txt", "x")
        with self.assertRaises(EngineError):
            check_target(self.root / "full", self.root / "tool")
        with self.assertRaises(EngineError):
            check_target(self.root / "full/x.txt", self.root / "tool")


class LayerTest(TempDirTest):
    def test_sdk_layers_overlay_common_with_the_kind_and_render_the_layer_token(self):
        self.write("sdk/TEMPLATE.json", json.dumps({"kind": "sdk", "description": "t", "placeholders": [],
                                                    "kinds": {"otp": {"dir": "kinds/otp", "prefix": "OTP", "title": "OTP"}}}))
        self.write("sdk/common/README.md", "common")
        self.write("sdk/common/src/index.ts", "common index")
        self.write("sdk/kinds/otp/README.md", "otp overlay")
        self.write("sdk/kinds/otp/src/otp.ts", "otp only")
        m = load_manifest(self.root / "sdk")
        self.assertEqual(["common", "__SDK_LAYER__"], m.layers)  # kinds[].dir names the overlay folder
        values = {"__SDK_NAME__": "otp", "__SDK_DIR__": "x-otp", "__SDK_LAYER__": "kinds/otp"}
        self.assertEqual([self.root / "sdk/common", self.root / "sdk/kinds/otp"], layer_dirs(m, values))
        files = dict(template_files(m, values))
        self.assertEqual(self.root / "sdk/kinds/otp/README.md", files[PurePosixPath("README.md")])
        self.assertEqual({"README.md", "src/index.ts", "src/otp.ts"}, {str(k) for k in files})
        with self.assertRaises(EngineError):
            layer_dirs(m, {"__SDK_DIR__": "x-otp", "__SDK_NAME__": "otp"})  # layer token without a value
        with self.assertRaises(EngineError):
            layer_dirs(m, {"__SDK_LAYER__": "kinds/storage", "__SDK_DIR__": "x"})  # no such kind folder
        result = instantiate(m, self.root / "repo", values)
        self.assertEqual("otp overlay", (self.root / "repo/x-otp/README.md").read_text(encoding="utf-8"))
        self.assertEqual("common index", (self.root / "repo/x-otp/src/index.ts").read_text(encoding="utf-8"))
        self.assertEqual(3, len(result.files))

    def test_kmp_project_layer_is_used_only_when_present(self):
        self.write("kmp/TEMPLATE.json", json.dumps({"kind": "kmp", "description": "t", "placeholders": []}))
        self.write("kmp/README.md", "about the template")
        self.assertEqual(["."], load_manifest(self.root / "kmp").layers)
        self.write("kmp/project/settings.gradle.kts", "x")
        m = load_manifest(self.root / "kmp")
        self.assertEqual(["project"], m.layers)
        self.assertEqual([PurePosixPath("settings.gradle.kts")], [rel for rel, _ in template_files(m)])
        self.write("kmp/TEMPLATE.json", json.dumps({"kind": "kmp", "description": "t", "placeholders": [], "layers": ["."]}))
        self.assertEqual({"README.md", "TEMPLATE.json", "project/settings.gradle.kts"} - {"TEMPLATE.json"},
                         {str(rel) for rel, _ in template_files(load_manifest(self.root / "kmp"))})


class TargetedAndSentinelTest(TempDirTest):
    def test_targeted_edit_renders_its_token_and_fails_loudly(self):
        edit = {"file": "src/com/acme/shop/Config.kt", "placeholder": "__REALTIME_NAMESPACE__",
                "find": 'NS = "/app"', "replace_with": 'NS = "__REALTIME_NAMESPACE__"'}
        self.write("kmp/TEMPLATE.json", json.dumps({"kind": "kmp", "description": "t", "placeholders": [], "layers": ["."],
                                                    "rename_paths": {"com/acme/shop": "__APP_PACKAGE_PATH__"}, "targeted": [edit]}))
        self.write("kmp/src/com/acme/shop/Config.kt", 'NS = "/app"\nPACKET = "40/app,"\n')
        values = {"__APP_DIR__": "App", "__APP_PACKAGE_PATH__": "io/beta/store", "__REALTIME_NAMESPACE__": "/store"}
        instantiate(load_manifest(self.root / "kmp"), self.root / "repo", values)
        self.assertEqual('NS = "/store"\nPACKET = "40/app,"\n', (self.root / "repo/App/src/io/beta/store/Config.kt").read_text(encoding="utf-8"))
        with self.assertRaises(EngineError):  # no value for the placeholder
            instantiate(load_manifest(self.root / "kmp"), self.root / "repo2", {"__APP_DIR__": "App", "__APP_PACKAGE_PATH__": "io/beta/store"})
        self.write("kmp/src/com/acme/shop/Config.kt", 'NS = "/other"\n')
        with self.assertRaises(EngineError):  # find text missing
            instantiate(load_manifest(self.root / "kmp"), self.root / "repo3", values)

    def test_sentinel_leftovers_are_reported_unless_the_value_is_the_literal(self):
        sentinels = {"api.example.com": "__PROD_API_HOST__", "Acme Shop": "__APP_NAME__"}
        self.assertEqual(["Acme Shop"], sentinel_leftovers("Acme Shop at api.example.com", sentinels,
                                                           {"__PROD_API_HOST__": "api.example.com", "__APP_NAME__": "Beta"}))
        self.write("kmp/TEMPLATE.json", json.dumps({"kind": "kmp", "description": "t", "placeholders": [], "layers": ["."],
                                                    "sentinels": {"Acme Shop": "__APP_NAME__"}}))
        self.write("kmp/a.txt", "Acme Shop\n")
        self.write("kmp/b.txt", "Acme Shop in a line, and AcmeShop too\n")  # 'Acme Shop' replaced; AcmeShop is not a sentinel here
        result = instantiate(load_manifest(self.root / "kmp"), self.root / "repo", {"__APP_DIR__": "App", "__APP_NAME__": "Beta"})
        self.assertEqual({}, result.sentinel_left)
        result = instantiate(load_manifest(self.root / "kmp"), self.root / "repo2", {"__APP_DIR__": "App", "__APP_NAME__": "Acme Shop"})
        self.assertEqual({}, result.sentinel_left)  # same identity chosen: not a leftover

    def test_sentinel_left_in_a_path_is_reported_and_kmp_fails_loudly(self):
        self.write("kmp/TEMPLATE.json", json.dumps({"kind": "kmp", "description": "t", "placeholders": [], "layers": ["."],
                                                    "sentinels": {"AcmeShop": "__APP_PROJECT__"}}))  # no rename_paths on purpose
        self.write("kmp/iosApp/AcmeShop/Info.plist", "ok")
        result = instantiate(load_manifest(self.root / "kmp"), self.root / "repo", {"__APP_DIR__": "App", "__APP_PROJECT__": "Beta"})
        self.assertEqual({"App/iosApp/AcmeShop/Info.plist": ["AcmeShop"]}, result.sentinel_left)
        self.assertEqual(["App/iosApp/AcmeShop/Info.plist: AcmeShop"], verification_errors(result))
        from kmp import instantiate_apps
        from _support import make_spec
        from prompts import AppSpec
        spec = make_spec(self.root / "repo2", apps=[AppSpec("Beta", "beta")], sdks=[])
        with self.assertRaises(EngineError) as caught:
            instantiate_apps(load_manifest(self.root / "kmp"), spec.target, spec)
        self.assertIn("sentinels left", str(caught.exception))
