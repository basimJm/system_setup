"""Server audiences from the plan: role mapping, the rename forms, pruning a role, a second audience of one role, the notes,
the fallback in `--no-git`, and the plan field `role`."""
from __future__ import annotations

import io
import json
from contextlib import redirect_stdout
from pathlib import Path

from _support import TOOL_ROOT, TempDirTest

import cli
from audiences import (Audience, Renamer, infer_role, load_audience_catalog, plan_audiences, pluralize)
from catalog import load_catalog
from engine import EngineError, audience_leftovers, instantiate
from manifest import parse_manifest
from plan import Plan, PlanError, load_plan
from planspec import plan_to_spec
from prompts import AppSpec, Spec, WebSpec

WORDS = {"end_user": ("customer", "customers"), "staff": ("merchant", "merchants")}
SLUGS = {"end_user": "parent-web", "staff": "facility-staff"}
PLANS = TOOL_ROOT / "tests" / "fixtures" / "plans"


class RoleTest(TempDirTest):
    def test_staff_words_make_a_staff_module_everything_else_is_an_end_user(self):
        catalog = load_audience_catalog()
        self.assertEqual(infer_role("facility-app", "Facility", catalog), "staff")
        self.assertEqual(infer_role("driver-app", "Driver App", catalog), "staff")
        self.assertEqual(infer_role("parent-web", "Parent Fee Portal", catalog), "end_user")
        self.assertEqual(infer_role("customer-app", "Customer App", catalog), "end_user")

    def test_the_plan_role_is_optional_checked_and_wins_over_the_guess(self):
        catalog = load_catalog()
        data = json.loads((PLANS / "booking-marketplace-ar.json").read_text(encoding="utf-8"))
        self.assertTrue(all("role" not in m for m in data["modules"]))
        converted = plan_to_spec(Plan.from_dict(data, catalog), self.root / "t", catalog).spec
        self.assertEqual({a.slug: a.role for a in converted.apps}, {"customer-app": "end_user", "facility-app": "staff"})
        data["modules"][0]["role"] = "staff"
        spec = plan_to_spec(Plan.from_dict(data, catalog), self.root / "t", catalog).spec
        self.assertEqual({a.slug: a.role for a in spec.apps}["customer-app"], "staff")
        data["modules"][0]["role"] = "owner"
        with self.assertRaises(PlanError) as raised:
            Plan.from_dict(data, catalog)
        self.assertIn("modules[0].role", str(raised.exception))

    def test_one_audience_per_role_the_rest_are_extra_and_missing_roles_are_dropped(self):
        plan = plan_audiences([Audience("customer-app", "end_user"), Audience("driver-app", "staff"), Audience("staff-web", "staff")])
        self.assertEqual({r: a.slug for r, a in plan.chosen.items()}, {"end_user": "customer-app", "staff": "driver-app"})
        self.assertEqual([a.slug for a in plan.extra], ["staff-web"])
        self.assertEqual(plan_audiences([Audience("parent-web", "end_user")]).dropped, ["staff"])
        self.assertEqual(plan_audiences([]).dropped, ["end_user", "staff"])

    def test_a_web_variant_of_an_app_shares_the_audience_of_its_app(self):
        catalog = load_catalog()
        data = json.loads((PLANS / "booking-marketplace-ar.json").read_text(encoding="utf-8"))
        data["modules"][0]["platforms"] = ["android", "web"]
        spec = plan_to_spec(Plan.from_dict(data, catalog), self.root / "t", catalog).spec
        self.assertEqual([w.api_slug for w in spec.webs], ["customer-app"])
        self.assertEqual(spec.web_values(spec.webs[0])["__API_PREFIX__"], "/customer-app/v1")
        self.assertEqual([e.slug for e in spec.audience_plan().extra], [])

    def test_the_flat_command_apps_get_roles_too(self):
        spec = Spec("Shop", "", "SHP", "com.shop", "@shop", self.root / "t", apps=[AppSpec("Customer", "customer"), AppSpec("Merchant", "merchant")])
        self.assertEqual({r: a.slug for r, a in spec.audience_plan().chosen.items()}, {"end_user": "customer", "staff": "merchant"})


class RenameTest(TempDirTest):
    def test_every_case_plural_and_path_form(self):
        renamer = Renamer(WORDS, SLUGS)
        text = "/customer/v1/me customers Customers CUSTOMERS customerToken CustomerAuthService CUSTOMER_AVATAR '/customer' ./modules/customer' customer.model"
        self.assertEqual(renamer.apply(text), "/parent-web/v1/me parentWebs ParentWebs PARENT_WEBS parentWebToken ParentWebAuthService PARENT_WEB_AVATAR '/parent-web' ./modules/parent-web' parentWeb.model")
        self.assertEqual(renamer.apply("API_PREFIXES.merchant merchants /merchant/v1 MerchantSession"),
                         "API_PREFIXES.facilityStaff facilityStaffs /facility-staff/v1 FacilityStaffSession")

    def test_one_pass_a_name_with_another_roles_word_is_not_renamed_twice(self):
        self.assertEqual(Renamer(WORDS, {"end_user": "merchant-app", "staff": "customer-desk"}).apply("customer merchant"), "merchantApp customerDesk")

    def test_plurals(self):
        self.assertEqual([pluralize(w) for w in ("facility", "bus", "parent", "day")], ["facilities", "buses", "parents", "days"])
        self.assertEqual(Renamer(WORDS, {"end_user": "facility"}).apply("customers"), "facilities")

    def test_a_role_without_a_slug_is_left_alone(self):
        self.assertEqual(Renamer(WORDS, {"end_user": "parent-web"}).apply("customer merchant"), "parentWeb merchant")


def server_template(root: Path) -> None:
    (root / "src").mkdir(parents=True)
    (root / "src" / "customer.ts").write_text("export const customerToken = '/customer/v1'; // customers\n", encoding="utf-8")
    (root / "src" / "merchant.ts").write_text("export const merchantToken = 1;\n", encoding="utf-8")
    (root / "src" / "routes.ts").write_text("import { merchantToken } from './merchant';\nconst routers = {\n  customer: a,\n  merchant: [\n    one,\n  ],\n};\nconst scope = 'customer' | 'merchant';\n", encoding="utf-8")
    (root / "TEMPLATE.json").write_text(json.dumps({
        "kind": "server", "description": "t", "placeholders": [], "audiences": {"end_user": {"word": "customer", "plural": "customers"}, "staff": {"word": "merchant", "plural": "merchants"}},
        "prune": {"staff": {"skip": ["src/merchant.ts"], "edits": [{"file": "src/routes.ts", "find": "'customer' | 'merchant'", "replace_with": "'customer'"}],
                            "drop_blocks": [{"file": "src/routes.ts", "start": "merchant: [", "end": "  ],"}],
                            "drop_lines": [{"file": "src/routes.ts", "contains": ["merchantToken"]}]}}}), encoding="utf-8")


class PruneTest(TempDirTest):
    def generate(self, audiences, drop):
        template, out = self.root / "server", self.root / "out"
        server_template(template)
        manifest = parse_manifest(json.loads((template / "TEMPLATE.json").read_text(encoding="utf-8")), template)
        return manifest, instantiate(manifest, out, {"__SERVER_DIR__": "srv"}, drop=drop, audiences=audiences), out / "srv"

    def test_both_audiences_are_renamed_in_files_and_in_paths(self):
        _, _, out = self.generate({"end_user": "parent-web", "staff": "facility-staff"}, [])
        self.assertTrue((out / "src" / "parentWeb.ts").is_file() and (out / "src" / "facilityStaff.ts").is_file())
        self.assertIn("'/parent-web/v1'", (out / "src" / "parentWeb.ts").read_text(encoding="utf-8"))
        self.assertIn("parentWebs", (out / "src" / "parentWeb.ts").read_text(encoding="utf-8"))

    def test_a_role_without_an_audience_loses_its_files_lines_blocks_and_edits(self):
        manifest, _, out = self.generate({"end_user": "parent-web"}, ["staff"])
        self.assertFalse((out / "src" / "merchant.ts").exists() or (out / "src" / "staff.ts").exists())
        routes = (out / "src" / "routes.ts").read_text(encoding="utf-8")
        self.assertEqual(routes, "const routers = {\n  parentWeb: a,\n};\nconst scope = 'parentWeb';\n")
        self.assertEqual(audience_leftovers(manifest, out, ["staff"]), {})

    def test_leftovers_name_the_files_that_still_carry_a_pruned_word(self):
        manifest, _, out = self.generate({"end_user": "parent-web", "staff": "facility-staff"}, [])
        self.assertEqual(sorted(audience_leftovers(manifest, out, ["end_user"])), [])
        (out / "note.md").write_text("a customer\n", encoding="utf-8")
        self.assertEqual(audience_leftovers(manifest, out, ["end_user"]), {"note.md": ["customer"]})

    def test_a_prune_text_that_is_not_there_is_an_error(self):
        template = self.root / "server"
        server_template(template)
        data = json.loads((template / "TEMPLATE.json").read_text(encoding="utf-8"))
        data["prune"]["staff"]["drop_lines"] = [{"file": "src/routes.ts", "contains": ["nothing like this"]}]
        with self.assertRaises(EngineError):
            instantiate(parse_manifest(data, template), self.root / "out", {"__SERVER_DIR__": "srv"}, drop=["staff"], audiences={"end_user": "parent-web"})

    def test_the_shipped_server_template_prunes_staff_for_the_school_portal(self):
        out = self.root / "school"
        catalog = load_catalog()
        spec = plan_to_spec(load_plan(PLANS / "school-fee-portal-web.json", catalog), out, catalog).spec
        plan = spec.audience_plan()
        self.assertEqual((list(plan.chosen), plan.dropped), (["end_user"], ["staff"]))
        from manifest import load_manifest
        manifest = load_manifest(TOOL_ROOT / "templates" / "server")
        instantiate(manifest, out, spec.token_values(), spec.part_values(), drop=plan.dropped, audiences={"end_user": "parent-web"})
        server = out / spec.server_dir
        self.assertEqual(audience_leftovers(manifest, server, ["staff"]), {})
        self.assertTrue((server / "src" / "modules" / "parent-web" / "index.ts").is_file())
        self.assertFalse((server / "src" / "modules" / "staff").exists())
        self.assertIn("/parent-web/v1", (server / "src" / "constants" / "server.ts").read_text(encoding="utf-8"))
        self.assertEqual(len([p for p in server.rglob("*") if p.is_file() and "merchant" in p.name.lower()]), 0)


class ReportTest(TempDirTest):
    def report(self, **fields):
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            cli.print_report(cli.Report(check_ok=True, **fields), False)
        return buffer.getvalue()

    def test_no_git_does_not_say_initialised(self):
        self.assertNotIn("initialised:", self.report())
        self.assertIn("not initialised (--no-git)", self.report())
        self.assertIn("initialised: first commit", self.report(git_done=True))

    def test_the_audience_notes_say_what_was_generated_and_what_is_left(self):
        plan = plan_audiences([Audience("customer-app", "end_user"), Audience("driver-app", "staff"), Audience("staff-web", "staff")])
        notes = cli.audience_notes(plan)
        self.assertTrue(any("'staff-web'" in n and "not generated" in n for n in notes))
        rows = cli.audience_rows(plan)
        self.assertEqual([(r[1], r[2]) for r in rows], [("audience-staff-web", "PENDING")])
        self.assertIn("/staff-web/v1", rows[0][3])
        self.assertIn("Server audiences:", self.report(audience_notes=notes))
