"""Plan validation: the valid plan round-trips, every rule has a test, and the messages name the bad field."""
from __future__ import annotations

import json

from _support import TempDirTest, valid_plan_data

from catalog import load_catalog
from plan import PLAN_FILE, SCHEMA_VERSION, Plan, PlanError, dumps, load_plan, model_schema, save_plan

CATALOG = load_catalog()


def broken(change):
    data = valid_plan_data()
    change(data)
    return data


class PlanValidationTest(TempDirTest):
    def problems(self, data):
        with self.assertRaises(PlanError) as caught:
            Plan.from_dict(data, CATALOG)
        return caught.exception.errors

    def assertProblem(self, data, field, text=""):
        errors = self.problems(data)
        self.assertTrue(any(e.startswith(field + ":") and text in e for e in errors), f"{field} / {text!r} not in {errors}")

    def test_valid_plan_reads_and_round_trips_through_a_file(self):
        plan = Plan.from_dict(valid_plan_data(), CATALOG)
        self.assertEqual(SCHEMA_VERSION, plan.schema_version)
        self.assertEqual(["server", "admin", "customer"], [m.id for m in plan.modules])
        path = self.root / PLAN_FILE
        save_plan(plan, path)
        again = load_plan(path, CATALOG)
        self.assertEqual(plan.to_dict(), again.to_dict())
        self.assertTrue(dumps(plan).endswith("\n"))

    def test_the_model_schema_is_json_and_matches_the_catalog(self):
        schema = model_schema(CATALOG)
        json.dumps(schema)
        self.assertEqual(list(CATALOG.kinds), schema["properties"]["modules"]["items"]["properties"]["kind"]["enum"])
        self.assertNotIn("known", json.dumps(schema))
        self.assertNotIn("name_ar", schema["properties"]["system"]["required"])
        self.assertEqual(0, schema["properties"]["rules"]["maxItems"])

    def test_known_flags_are_computed_never_trusted(self):
        data = valid_plan_data()
        data["sdks"][0].update(known=True, provider="a-local-gateway", provider_known=True)
        data["sdks"].append({"id": "loyalty", "title": "Loyalty", "why": "points", "source": "internal", "provider": "", "known": True})
        data["deployment"][1]["host"] = "my-own-box"
        plan = Plan.from_dict(data, CATALOG)
        self.assertEqual([(True, False), (True, True), (False, True)], [(s.known, s.provider_known) for s in plan.sdks])
        self.assertFalse(plan.deployment[1].known)
        self.assertTrue(plan.deployment[0].known)

    def test_not_an_object_and_unknown_fields(self):
        self.assertIn("must be an object", self.problems([])[0])
        self.assertProblem(broken(lambda d: d.update(colour="red")), "colour", "not a known field")
        self.assertProblem(broken(lambda d: d["system"].update(owner="x")), "system.owner", "not a known field")
        self.assertProblem(broken(lambda d: d.pop("modules")), "modules", "required")

    def test_schema_version(self):
        self.assertProblem(broken(lambda d: d.update(schema_version=2)), "schema_version", "not supported")
        self.assertProblem(broken(lambda d: d.update(schema_version="1")), "schema_version")
        self.assertProblem(broken(lambda d: d.pop("schema_version")), "schema_version", "required")

    def test_system_identity(self):
        self.assertProblem(broken(lambda d: d["system"].update(name="")), "system.name", "must not be empty")
        self.assertProblem(broken(lambda d: d["system"].update(slug="Acme Shop")), "system.slug")
        self.assertProblem(broken(lambda d: d["system"].update(prefix="a")), "system.prefix")
        self.assertProblem(broken(lambda d: d["system"].update(package_root="Com.Acme")), "system.package_root")
        self.assertProblem(broken(lambda d: d["system"].update(npm_scope="acme")), "system.npm_scope")
        self.assertProblem(broken(lambda d: d["system"].update(name=7)), "system.name", "must be text")
        self.assertProblem(broken(lambda d: d["system"].update(name="x" * 90)), "system.name", "too long")

    def test_languages(self):
        self.assertProblem(broken(lambda d: d["languages"].update(direction="up")), "languages.direction", "ltr")
        self.assertProblem(broken(lambda d: d["languages"].update(default="fr")), "languages.supported", "must include the default")
        self.assertProblem(broken(lambda d: d["languages"].update(supported=[])), "languages.supported", "at least 1")
        self.assertProblem(broken(lambda d: d["languages"].update(supported=["en", "en"])), "languages.supported", "duplicates")
        self.assertProblem(broken(lambda d: d["languages"].update(supported=["English"])), "languages.supported[0]", "language code")
        self.assertProblem(broken(lambda d: d["languages"].update(documents="Arabic")), "languages.documents", "language code")
        self.assertEqual("en", Plan.from_dict(broken(lambda d: d["languages"].pop("documents")), CATALOG).languages.documents)

    def test_countries_currency_and_time_zones(self):
        self.assertProblem(broken(lambda d: d.update(countries=["Ireland"])), "countries[0]", "country code")
        self.assertProblem(broken(lambda d: d["currency"].update(code="euro")), "currency.code", "ISO 4217")
        self.assertProblem(broken(lambda d: d["currency"].update(decimals=9)), "currency.decimals", "0 to 4")
        self.assertProblem(broken(lambda d: d["currency"].update(decimals=True)), "currency.decimals")
        self.assertProblem(broken(lambda d: d["currency"].update(minor_unit="")), "currency.minor_unit")
        self.assertProblem(broken(lambda d: d["time_zones"].update(business="Dublin time")), "time_zones.business", "IANA")
        self.assertProblem(broken(lambda d: d["time_zones"].update(stored=3)), "time_zones.stored", "must be text")

    def test_business(self):
        self.assertProblem(broken(lambda d: d["business"].update(actors=[])), "business.actors", "at least 1")
        self.assertProblem(broken(lambda d: d["business"].update(actors=[{"name": "Customer"}])), "business.actors[0].does", "required")
        self.assertProblem(broken(lambda d: d["business"].update(rules=["ok", ""])), "business.rules[1]", "non-empty")
        self.assertProblem(broken(lambda d: d["business"].update(entities=[{"name": "Order", "states": "PLACED"}])), "business.entities[0].states", "must be a list")
        self.assertProblem(broken(lambda d: d["business"].update(summary="x" * 7000)), "business.summary", "too long")
        self.assertEqual([], Plan.from_dict(broken(lambda d: d["business"].pop("existing")), CATALOG).business.existing)

    def test_modules(self):
        self.assertProblem(broken(lambda d: d.update(modules=[])), "modules", "at least 1")
        self.assertProblem(broken(lambda d: d["modules"][0].update(kind="spaceship")), "modules[0].kind", "server, admin, app, web")
        self.assertProblem(broken(lambda d: d["modules"][2].update(platforms=["desktop"])), "modules[2].platforms[0]", "android, ios, web")
        self.assertProblem(broken(lambda d: d["modules"][0].update(platforms=["web"])), "modules[0].platforms[0]", "for kind server")
        self.assertProblem(broken(lambda d: d["modules"][2].update(platforms=[])), "modules[2].platforms", "at least 1")
        self.assertProblem(broken(lambda d: d["modules"][1].update(id="server")), "modules[1].id", "used twice")
        self.assertProblem(broken(lambda d: d["modules"][2].update(id="admin")), "modules[2].id", "reserved")
        self.assertProblem(broken(lambda d: d["modules"][2].update(id="Customer App")), "modules[2].id")
        self.assertProblem(broken(lambda d: d["modules"][2].pop("why")), "modules[2].why", "required")
        plan = Plan.from_dict(broken(lambda d: d["modules"][2].update(platforms=["web", "ios"])), CATALOG)
        self.assertEqual(["web", "ios"], plan.modules[2].platforms)

    def test_sdks(self):
        self.assertProblem(broken(lambda d: d["sdks"][0].update(source="download")), "sdks[0].source", "internal, published, none")
        self.assertProblem(broken(lambda d: d["sdks"][0].update(source="published")), "sdks[0].package", "required when source is published")
        self.assertProblem(broken(lambda d: d["sdks"][0].update(source="published", package="@acme/otp")), "sdks[0].version", "required")
        self.assertProblem(broken(lambda d: d["sdks"][0].update(source="published", package="two words", version="1.0.0")), "sdks[0].package", "not a valid package")
        self.assertProblem(broken(lambda d: d["sdks"][0].update(source="published", package="@acme/otp", version="v 1")), "sdks[0].version", "not a valid version")
        self.assertProblem(broken(lambda d: d["sdks"][0].update(package="@acme/otp", version="1.0.0")), "sdks[0].package", "only for source published")
        self.assertProblem(broken(lambda d: d["sdks"][1].update(id="otp")), "sdks[1].id", "used twice")
        self.assertProblem(broken(lambda d: d["sdks"][0].pop("provider")), "sdks[0].provider", "required")
        plan = Plan.from_dict(broken(lambda d: d["sdks"][0].update(source="published", package="@acme/otp", version="1.4.0")), CATALOG)
        self.assertEqual(("@acme/otp", "1.4.0"), (plan.sdks[0].package, plan.sdks[0].version))

    def test_deployment(self):
        self.assertProblem(broken(lambda d: d["deployment"][0].update(part="shop")), "deployment[0].part", "not a module id")
        self.assertProblem(broken(lambda d: d["deployment"][0].update(part="customer")), "deployment[0].part", "no host")
        self.assertProblem(broken(lambda d: d["deployment"][1].update(part="server")), "deployment[1].part", "used twice")
        self.assertProblem(broken(lambda d: d["deployment"][0].update(host="")), "deployment[0].host", "must not be empty")
        plan = Plan.from_dict(broken(lambda d: d["deployment"][1].pop("database")), CATALOG)
        self.assertEqual(("none", "none"), (plan.deployment[1].database, plan.deployment[1].cache))

    def test_rule_overrides_are_checked_against_the_catalog(self):
        self.assertProblem(broken(lambda d: d.update(rules=[{"id": "R1"}])), "rules[0].id", "not a rule of catalog/rules.json")

    def test_open_questions(self):
        self.assertProblem(broken(lambda d: d["open_questions"][0].update(id="Bad Id")), "open_questions[0].id", "lowercase")
        self.assertProblem(broken(lambda d: d["open_questions"].append(dict(d["open_questions"][0]))), "open_questions[1].id", "used twice")
        self.assertProblem(broken(lambda d: d["open_questions"][0].update(answer=5)), "open_questions[0].answer", "text or null")
        self.assertProblem(broken(lambda d: d["open_questions"][0].pop("why")), "open_questions[0].why", "required")
        plan = Plan.from_dict(broken(lambda d: d["open_questions"][0].update(answer="  ")), CATALOG)
        self.assertIsNone(plan.open_questions[0].answer)
        self.assertEqual(1, len(plan.open_questions_unanswered()))

    def test_all_problems_come_at_once_and_the_message_lists_them(self):
        data = broken(lambda d: (d["system"].update(prefix="a"), d["currency"].update(code="x"), d["modules"][0].update(kind="nope")))
        with self.assertRaises(PlanError) as caught:
            Plan.from_dict(data, CATALOG, source="my.json")
        self.assertEqual(3, len(caught.exception.errors))
        text = str(caught.exception)
        self.assertIn("my.json is not valid (3 problems)", text)
        self.assertIn("system.prefix", text)

    def test_too_many_items_are_cut_not_followed(self):
        self.assertProblem(broken(lambda d: d["business"].update(rules=["r%d" % i for i in range(500)])), "business.rules", "limit")

    def test_load_plan_reports_missing_and_broken_files(self):
        with self.assertRaisesRegex(PlanError, "cannot read"):
            load_plan(self.root / "nope.json", CATALOG)
        path = self.write("bad.json", "{oops")
        with self.assertRaisesRegex(PlanError, "not valid JSON"):
            load_plan(path, CATALOG)
        path = self.write("list.json", "[1, 2]")
        with self.assertRaisesRegex(PlanError, "must be an object"):
            load_plan(path, CATALOG)
