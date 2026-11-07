"""Validators, derived names, the Spec token values and the `ask` seam."""
from __future__ import annotations

import io
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from _support import make_spec

from prompts import (AppSpec, ask, parse_app, parse_apps, prefix_from, slug_from, system_prefix_from, validate_app_specs, validate_npm_scope,
                     validate_package, validate_prefix, validate_sdk_names, validate_slug, validate_team_id, validate_url)


class ValidatorTest(unittest.TestCase):
    def test_package_root(self):
        self.assertIsNone(validate_package("com.acme"))
        self.assertIsNone(validate_package("io.app2.x9"))
        for bad in ("acme", "Com.acme", "com.acme_shop", "com.acme-shop", "com..acme", "com.1acme", "com.acme.object"):
            self.assertIsNotNone(validate_package(bad), bad)

    def test_slug_prefix_and_scope(self):
        self.assertIsNone(validate_slug("acme-shop"))
        for bad in ("Acme", "acme_shop", "-acme", "acme--shop", "1acme", ""):
            self.assertIsNotNone(validate_slug(bad), bad)
        self.assertIsNone(validate_prefix("ACME"))
        for bad in ("A", "acme", "1ACME", "ACMEACME", "AC-ME"):
            self.assertIsNotNone(validate_prefix(bad), bad)
        self.assertIsNone(validate_npm_scope("@acme"))
        for bad in ("acme", "@Acme", "@", "@acme/x"):
            self.assertIsNotNone(validate_npm_scope(bad), bad)

    def test_urls_team_id_and_sdk_names(self):
        self.assertIsNone(validate_url("https://api-dev.acme.io"))
        self.assertIsNone(validate_url("http://localhost:4000"))
        for bad in ("api.acme.io", "ftp://x.io", "https://", "https://x.io/", "https://x.io?a=1", "https://x.io/v1"):
            self.assertIsNotNone(validate_url(bad), bad)
        self.assertIsNone(validate_team_id(""))
        self.assertIsNone(validate_team_id("ABCDE12345"))
        self.assertIsNotNone(validate_team_id("abc"))
        self.assertIsNone(validate_sdk_names("storage, otp"))
        self.assertIsNone(validate_sdk_names(""))
        self.assertIn("billing", validate_sdk_names("storage,billing") or "")

    def test_app_specs(self):
        self.assertEqual(AppSpec("Customer", "customer"), parse_app("Customer:customer"))
        self.assertEqual(AppSpec("Shop Staff", "shop-staff"), parse_app("Shop Staff"))
        self.assertEqual("التاجر", parse_app("Merchant:merchant:التاجر").name_ar)
        self.assertEqual("ShopStaff", parse_app("Shop Staff").project)
        for bad in ("Customer:Cust", ":x", "Admin:admin", "Main:main", "Server:server"):
            with self.assertRaises(ValueError, msg=bad):
                parse_app(bad)
        self.assertIsNotNone(validate_app_specs("Customer:customer, Client:customer"))
        self.assertIsNone(validate_app_specs("Customer:customer, Merchant:merchant"))
        self.assertEqual(2, len(parse_apps("Customer:customer; Merchant:merchant")))


class DerivedNamesTest(unittest.TestCase):
    def test_slug_and_prefix_from_names(self):
        self.assertEqual("acme-shop", slug_from("Acme Shop!"))
        self.assertEqual("app-2026", slug_from("2026"))
        self.assertEqual("ACM", prefix_from("Acme Shop"))
        self.assertEqual(("ACME", "BETA", "ZED", "AX"), tuple(system_prefix_from(n) for n in ("Acme Shop", "Beta Store!", "ZED", "a")))
        self.assertEqual("ABX", prefix_from("a b"))

    def test_spec_names_packages_prefixes_and_masters(self):
        spec = make_spec(Path("/x"))
        self.assertEqual(("ACME-Server", "ACME-Admin-Dashboard"), (spec.server_dir, spec.admin_dir))
        self.assertEqual("ACME-Mobile-Customer", spec.app_dir(spec.apps[0]))
        self.assertEqual("com.acme.merchant", spec.app_package(spec.apps[1]))
        self.assertEqual("acme-shop-storage", spec.sdk_dir("storage"))
        self.assertEqual("@acme/otp", spec.sdk_package("otp"))
        self.assertEqual({"customer": "CUS", "merchant": "MER"}, spec.app_prefixes())
        self.assertEqual(["server", "admin", "customer", "merchant"], spec.masters())
        self.assertEqual(["customer"], make_spec(Path("/x"), with_server=False, with_admin=False, sdks=[],
                                                 apps=[AppSpec("Customer", "customer")]).masters())

    def test_app_prefix_clashes_are_resolved(self):
        spec = make_spec(Path("/x"), sdks=[], apps=[AppSpec("Customer", "customer"), AppSpec("Custodian", "custodian"),
                                                    AppSpec("Admin Lite", "admin-lite"), AppSpec("Store", "storage-app")])
        prefixes = spec.app_prefixes()
        self.assertEqual("CUS", prefixes["customer"])
        self.assertEqual("CUT", prefixes["custodian"])
        self.assertEqual("ADI", prefixes["admin-lite"])  # ADM is taken by the admin panel
        self.assertEqual(4, len(set(prefixes.values())))

    def test_token_values_cover_the_contract(self):
        spec = make_spec(Path("/x"))
        values = spec.token_values()
        expected = {"__SYSTEM_NAME__": "Acme Shop", "__SYSTEM_NAME_AR__": "متجر أكمي", "__SYSTEM_SLUG__": "acme-shop",
                    "__SYSTEM_PREFIX__": "ACME", "__PACKAGE_ROOT__": "com.acme", "__NPM_SCOPE__": "@acme",
                    "__SERVER_DIR__": "ACME-Server", "__ADMIN_DIR__": "ACME-Admin-Dashboard",
                    "__APP_DIR_1__": "ACME-Mobile-Customer", "__APP_NAME_2__": "Merchant", "__APP_PACKAGE_2__": "com.acme.merchant",
                    "__SDK_DIR_STORAGE__": "acme-shop-storage", "__SDK_DIR_otp__": "acme-shop-otp", "__SDK_DIR_analytics__": "acme-shop-analytics", "__OWNER_GITHUB__": "acme-inc",
                    "__REPO_NAME__": "acme-shop", "__YEAR__": "2026", "__DATE__": "2026-10-28", "__APPLE_TEAM_ID__": ""}
        for token, value in expected.items():
            self.assertEqual(value, values[token], token)
        app = spec.app_values(spec.apps[0])
        self.assertEqual(("Customer", "com.acme.customer", "com/acme/customer", "Customer", "CUS"),
                         (app["__APP_NAME__"], app["__APP_PACKAGE__"], app["__APP_PACKAGE_PATH__"], app["__APP_PROJECT__"], app["__APP_PREFIX__"]))
        sdk = spec.sdk_values("otp")
        self.assertEqual(("otp", "OTP", "acme-shop-otp", "@acme/otp", "OTP"),
                         (sdk["__SDK_NAME__"], sdk["__SDK_TITLE__"], sdk["__SDK_DIR__"], sdk["__SDK_PACKAGE__"], sdk["__SDK_PREFIX__"]))


class AskTest(unittest.TestCase):
    def test_ask_repeats_until_valid_and_keeps_defaults(self):
        answers = iter(["", "com.Acme", "com.acme"])
        prompts = []

        def reader(prompt):
            prompts.append(prompt)
            return next(answers)

        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual("com.acme", ask("Package", "", validate_package, reader))
        self.assertEqual(["Package: "] * 3, prompts)
        self.assertEqual(2, out.getvalue().count("✗"))  # two rejected answers, each explained
        prompts.clear()
        self.assertEqual("ACME", ask("Prefix", "ACME", validate_prefix, lambda p: prompts.append(p) or ""))
        self.assertEqual(["Prefix [ACME]: "], prompts)
