"""The question flow (`collect`) through the `ask` reader seam, defaults, --yes and needed template kinds."""
from __future__ import annotations

import io
from contextlib import redirect_stdout
from pathlib import Path

from _support import FIXTURE_TEMPLATES, TempDirTest

from cli import apply_sdk_kinds, collect, load_templates, needed_kinds, parse_args
from manifest import ManifestError, load_manifest
from prompts import AppSpec, Spec


def scripted(answers):
    answers = iter(answers)
    seen = []

    def reader(prompt):
        seen.append(prompt)
        return next(answers)
    return reader, seen


class CollectTest(TempDirTest):
    def test_interactive_answers_and_derived_defaults(self):
        reader, seen = scripted([
            "Acme Shop",          # name
            "",                   # arabic = same
            "",                   # prefix default ACME
            "",                   # package root default com.example.acmeshop
            "",                   # npm scope default @acme-shop
            str(self.root / "sys"),
            "y", "n",             # server yes, admin no
            "Customer:customer, Merchant:merchant:التاجر",
            "otp",                # sdks
            "", "", "", "",       # urls default
            "", "acme-inc", "",   # team id skip, owner, repo default
            "Customers order.", "Shops fulfil.", "",   # business summary: two lines, empty line ends
            "en", "off", "USD", "cent, 2 decimals", "", "Europe/Paris",
            "Customer: orders; Shop owner: fulfils", "",  # actors: one line, `;`-separated
            "One order per slot", "Refund on shop cancel", "",  # rules: two lines
            "", "", "decide later", "", "",            # entities default, jobs default, integrations, open decisions default
        ])
        with redirect_stdout(io.StringIO()):
            spec = collect(parse_args([]), reader)
        self.assertEqual(("Acme Shop", "Acme Shop", "ACME", "com.example.acmeshop", "@acme-shop"),
                         (spec.system_name, spec.system_name_ar, spec.prefix, spec.package_root, spec.npm_scope))
        self.assertEqual((self.root / "sys").resolve(), spec.target)
        self.assertEqual((True, False), (spec.with_server, spec.with_admin))
        self.assertEqual([AppSpec("Customer", "customer"), AppSpec("Merchant", "merchant", "التاجر")], spec.apps)
        self.assertEqual(["otp"], spec.sdks)
        self.assertEqual(("https://api-dev.example.com", "", "acme-inc", "acme-shop"),
                         (spec.dev_api_url, spec.apple_team_id, spec.owner_github, spec.repo_name))
        self.assertTrue(seen[0].startswith("System name (English)"))
        self.assertIn("Short prefix for folders and task ids [ACME]", seen[2])
        business = spec.business
        self.assertEqual("Customers order.\nShops fulfil.", business.summary)
        self.assertEqual(("en", "off", "USD", "cent, 2 decimals", "UTC", "Europe/Paris"),
                         (business.default_language, business.rtl, business.currency, business.currency_minor_unit,
                          business.stored_time_zone, business.business_time_zone))
        self.assertEqual(["Customer: orders", "Shop owner: fulfils"], business.actors)
        self.assertEqual(["One order per slot", "Refund on shop cancel"], business.rules)
        self.assertEqual(([], [], ["decide later"], []), (business.entities, business.jobs, business.integrations, business.open_decisions))

    def test_invalid_interactive_answers_are_asked_again(self):
        reader, seen = scripted(["Acme", "", "acme", "ACME", "", "", str(self.root / "s"), "y", "y", "Bad:Slug", "", "billing", "",
                                 "", "", "", "", "", "", "",
                                 "", "", "maybe", "on", "", "", "", "", "", "", "", "", "", ""])  # business: rtl asked again
        with redirect_stdout(io.StringIO()) as out:
            spec = collect(parse_args([]), reader)
        self.assertEqual("ACME", spec.prefix)
        self.assertEqual(("on", "TBD", "ar"), (spec.business.rtl, spec.business.summary, spec.business.default_language))
        self.assertIn("answer on or off", out.getvalue())
        self.assertEqual(([], []), (spec.apps, spec.sdks))
        self.assertIn("uppercase", out.getvalue())
        self.assertIn("slug", out.getvalue())
        self.assertIn("unknown SDK", out.getvalue())
        self.assertEqual(seen.count("Short prefix for folders and task ids [ACME]: "), 2)

    def test_yes_uses_flags_and_defaults_without_reading(self):
        def no_reader(prompt):
            raise AssertionError(f"prompted: {prompt}")
        args = parse_args(["--yes", "--name", "Beta Store", "--target", str(self.root / "b"), "--no-admin", "--sdk", "otp",
                           "--sdk", "storage", "--app", "Shop:shop"])
        spec = collect(args, no_reader)
        self.assertEqual(("BETA", "com.example.betastore", "@beta-store", "beta-store"),
                         (spec.prefix, spec.package_root, spec.npm_scope, spec.repo_name))
        self.assertEqual((True, False, ["otp", "storage"], "shop"), (spec.with_server, spec.with_admin, spec.sdks, spec.apps[0].slug))
        with self.assertRaises(SystemExit):
            collect(parse_args(["--yes", "--target", str(self.root / "b")]), no_reader)  # name is required
        with self.assertRaises(SystemExit):
            collect(parse_args(["--yes", "--name", "B", "--target", str(self.root / "b"), "--team-id", "short"]), no_reader)


class TemplateSelectionTest(TempDirTest):
    def spec(self, **overrides):
        values = dict(system_name="A", system_name_ar="A", prefix="AA", package_root="com.a", npm_scope="@a", target=self.root)
        values.update(overrides)
        return Spec(**values)

    def test_needed_kinds_follow_the_chosen_parts(self):
        self.assertEqual(["server", "admin", "workspace"], needed_kinds(self.spec()))
        self.assertEqual(["sdk", "kmp", "workspace"], needed_kinds(self.spec(with_server=False, with_admin=False,
                                                                           sdks=["otp"], apps=[AppSpec("X", "x")])))

    def test_missing_template_kind_is_named(self):
        (self.root / "server").mkdir()
        with self.assertRaises(ManifestError) as caught:
            load_templates(self.root, ["server", "workspace"])
        self.assertIn("server, workspace", str(caught.exception))
        self.assertEqual({"server", "admin", "workspace"}, set(load_templates(FIXTURE_TEMPLATES, ["server", "admin", "workspace"])))

    def test_sdk_kinds_override_dir_prefix_and_title(self):
        spec = self.spec(sdks=["otp", "storage"])
        apply_sdk_kinds(spec, load_manifest(FIXTURE_TEMPLATES / "sdk"))
        self.assertEqual(("a-otp", "OTP", "Otp", "a-storage", "STO", "Storage"),
                         (spec.sdk_dir("otp"), spec.sdk_prefix("otp"), spec.sdk_title_of("otp"),
                          spec.sdk_dir("storage"), spec.sdk_prefix("storage"), spec.sdk_title_of("storage")))
        with self.assertRaises(ManifestError) as caught:
            apply_sdk_kinds(self.spec(sdks=["notifications"]), load_manifest(FIXTURE_TEMPLATES / "sdk"))  # declared, no folder
        self.assertIn("kinds/notifications", str(caught.exception))
        self.assertIn("otp, payments, storage", str(caught.exception))
        apply_sdk_kinds(self.spec(sdks=["analytics"]), None)  # no manifest: derived names stay
        self.assertEqual("ANA", self.spec(sdks=["analytics"]).sdk_prefix("analytics"))
        self.assertEqual(("kinds/otp", "kinds/notifications", "presigned uploads"),
                         (spec.sdk_layer("otp"), spec.sdk_layer("notifications"), spec.sdk_description("storage")))
