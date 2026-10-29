"""TEMPLATE.json parsing and validation."""
from __future__ import annotations

import json

from _support import FIXTURE_TEMPLATES, TempDirTest

from manifest import DEFAULT_DEST, KINDS, ManifestError, available_kinds, load_manifest, parse_manifest

VALID = {"kind": "server", "description": "x", "placeholders": ["__SYSTEM_NAME__", "__APP_DIR_<n>__"],
         "sentinels": {"WAB": "__SYSTEM_PREFIX__"}, "rename_paths": {"WAB": "__SYSTEM_PREFIX__"},
         "skip": ["node_modules/**"], "post_generate": ["npm install"], "binary_globs": ["*.png"]}


class ManifestTest(TempDirTest):
    def test_parses_every_key_and_defaults_the_destination_by_kind(self):
        manifest = parse_manifest(VALID, self.root)
        self.assertEqual("server", manifest.kind)
        self.assertEqual(["__SYSTEM_NAME__", "__APP_DIR_<n>__", "__SYSTEM_PREFIX__"], manifest.tokens)
        self.assertEqual({"WAB": "__SYSTEM_PREFIX__"}, manifest.sentinels)
        self.assertEqual(["npm install"], manifest.post_generate)
        self.assertEqual(DEFAULT_DEST["server"], manifest.dest)
        self.assertEqual(".", parse_manifest(dict(VALID, kind="workspace"), self.root).dest)
        self.assertEqual("packages/x", parse_manifest(dict(VALID, dest="packages/x"), self.root).dest)

    def test_sdk_kinds_targeted_and_layers_are_parsed(self):
        data = dict(VALID, kind="sdk", kinds={"otp": {"dir": "__SYSTEM_PREFIX_LOWER__-otp", "prefix": "OTP", "title": "OTP"}},
                    targeted=[{"file": "a.kt", "placeholder": "__X__", "find": "f", "replace_with": "__X__", "why": "short"}],
                    layers=["common", "kinds/__SDK_NAME__"])
        manifest = parse_manifest(data, self.root)
        self.assertEqual({"otp": {"dir": "__SYSTEM_PREFIX_LOWER__-otp", "prefix": "OTP", "title": "OTP"}}, manifest.kinds)
        self.assertEqual("f", manifest.targeted[0]["find"])
        self.assertEqual(["common", "kinds/__SDK_NAME__"], manifest.layers)
        self.assertEqual(["."], parse_manifest(VALID, self.root).layers)  # no sdk/kmp folders in an empty root
        self.assertEqual("", parse_manifest({"kind": "admin", "placeholders": []}, self.root).description)

    def test_unknown_documentation_keys_are_tolerated(self):
        data = dict(VALID, kind="kmp", source={"tool": "x"}, derived_placeholders={"__X__": "y"}, sentinel_locations={},
                    neutral_literals=["WAB-1001"], verified="2026-10-28", regenerate="KMP_TEMPLATE …", firebase="placeholders")
        self.assertEqual("kmp", parse_manifest(data, self.root).kind)

    def test_optional_keys_may_be_absent(self):
        manifest = parse_manifest({"kind": "admin", "description": "d", "placeholders": []}, self.root)
        self.assertEqual(({}, {}, [], [], []), (manifest.sentinels, manifest.rename_paths, manifest.skip,
                                                manifest.post_generate, manifest.binary_globs))

    def test_rejects_contract_violations(self):
        bad_cases = {
            "missing placeholders": {"kind": "server", "description": "x"},
            "unknown kind": dict(VALID, kind="backend"),
            "placeholder not a token": dict(VALID, placeholders=["SYSTEM_NAME"]),
            "sentinel target not a token": dict(VALID, sentinels={"@wab": "__NPM_SCOPE__/x"}),
            "empty sentinel literal": dict(VALID, sentinels={"": "__NPM_SCOPE__"}),
            "skip not a list": dict(VALID, skip="node_modules"),
            "dest escapes": dict(VALID, dest="../elsewhere"),
            "dest absolute": dict(VALID, dest="/tmp"),
            "kinds on a non-sdk": dict(VALID, kinds={"otp": {"dir": "x", "prefix": "OTP", "title": "OTP"}}),
            "kind without prefix": dict(VALID, kind="sdk", kinds={"otp": {"dir": "x", "title": "OTP"}}),
            "targeted without find": dict(VALID, targeted=[{"file": "a", "placeholder": "__X__", "replace_with": "b"}]),
            "targeted placeholder not a token": dict(VALID, targeted=[{"file": "a", "placeholder": "X", "find": "f", "replace_with": "b"}]),
            "layer escapes": dict(VALID, layers=["../x"]),
        }
        for label, data in bad_cases.items():
            with self.assertRaises(ManifestError, msg=label):
                parse_manifest(data, self.root)

    def test_load_checks_folder_name_json_and_presence(self):
        (self.root / "server").mkdir()
        with self.assertRaises(ManifestError):
            load_manifest(self.root / "server")  # no TEMPLATE.json
        self.write("server/TEMPLATE.json", "{not json")
        with self.assertRaises(ManifestError):
            load_manifest(self.root / "server")
        self.write("server/TEMPLATE.json", json.dumps(dict(VALID, kind="admin")))
        with self.assertRaises(ManifestError):
            load_manifest(self.root / "server")  # kind != folder
        self.write("server/TEMPLATE.json", json.dumps(VALID))
        self.assertEqual("server", load_manifest(self.root / "server").kind)

    def test_fixture_templates_cover_every_kind(self):
        self.assertEqual(sorted(KINDS), available_kinds(FIXTURE_TEMPLATES))
        self.assertEqual([], available_kinds(self.root / "nowhere"))
        for kind in KINDS:
            load_manifest(FIXTURE_TEMPLATES / kind)
