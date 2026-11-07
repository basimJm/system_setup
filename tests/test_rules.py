"""Delivery rules: the catalog matches the template, the plan overrides them (on, off, edited), a safety rule needs a second
confirmation, `.claude/rules.md` and the `rules` map are rendered from them, and the generated hooks follow the map."""
from __future__ import annotations

import io
import json
import subprocess
import sys
from contextlib import redirect_stdout

from _support import TOOL_ROOT, TempDirTest, make_spec, valid_plan_data

from catalog import CatalogError, load_catalog
from cli import generate
from plan import Plan, PlanError
from review import Review, review
from rules import RuleSetting, load_rule_defs, parse_items, render_rules, rules_map, safety_off, template_problems

CATALOG = load_catalog()
DEFS = load_rule_defs()
TEMPLATE_RULES = (TOOL_ROOT / "templates" / "workspace" / ".claude" / "rules.md").read_text(encoding="utf-8")
HOOKS = TOOL_ROOT / "templates" / "workspace" / ".claude" / "hooks"
SAFETY = {"tests-with-code", "no-protected-commits", "no-force-push", "no-hook-bypass", "no-secrets"}


class Scripted:
    def __init__(self, answers=()):
        self.answers, self.prompts = list(answers), []

    def __call__(self, prompt):
        self.prompts.append(prompt)
        return self.answers.pop(0) if self.answers else ""


def reviewed(settings, answers=(), yes=False):
    """The rules step alone (the earlier steps have their own tests), or the whole review under --yes."""
    data = valid_plan_data()
    data["rules"] = settings
    plan, reader, out = Plan.from_dict(data, CATALOG), Scripted(answers), io.StringIO()
    with redirect_stdout(out):
        if yes:
            return review(plan, CATALOG, reader, lambda _text: None, yes=True), reader
        Review(plan, CATALOG, reader, lambda _text: None).rules()
    return plan, reader


class CatalogMatchesTemplate(TempDirTest):
    def test_every_rule_of_the_template_has_an_entry_and_every_entry_points_at_a_rule(self):
        self.assertEqual([], template_problems(TEMPLATE_RULES, DEFS))
        self.assertGreaterEqual(len(DEFS), 40)

    def test_safety_rules_are_the_expected_ones(self):
        self.assertEqual(SAFETY, {d.id for d in DEFS if d.safety})

    def test_enforcing_hooks_exist_and_read_the_map(self):
        for rule in DEFS:
            for hook in rule.enforced_by:
                self.assertTrue((HOOKS / hook).is_file(), f"{rule.id}: {hook}")
                code = (HOOKS / hook).read_text(encoding="utf-8") + (HOOKS / "_common.py").read_text(encoding="utf-8")
                self.assertIn(f'"{rule.id}"', code, f"{hook} does not read {rule.id}")

    def test_a_template_rule_without_an_entry_is_reported(self):
        extra = TEMPLATE_RULES.rstrip("\n") + "\n11. An extra rule at the end of section 4.\n"
        self.assertTrue(any("has no entry" in p for p in template_problems(extra, DEFS)))
        self.assertTrue(any("points at" in p for p in template_problems(TEMPLATE_RULES.replace("## 4. ", "## 9. ", 1), DEFS)))

    def test_bad_catalog_is_refused(self):
        self.write("rules.json", json.dumps({"rules": [{"id": "A b", "section": "1.1", "title": "x"}]}))
        with self.assertRaises(CatalogError):
            load_rule_defs(self.root)
        self.write("rules.json", json.dumps({"rules": [{"id": "ab", "section": "1.1", "title": "x"}, {"id": "ab", "section": "1.2", "title": "y"}]}))
        with self.assertRaises(CatalogError):
            load_rule_defs(self.root)


class Rendering(TempDirTest):
    def render(self, *settings):
        return render_rules(TEMPLATE_RULES, DEFS, settings).split("\n")

    def test_defaults_tag_every_rule_with_its_id_and_change_nothing_else(self):
        out, original = self.render(), TEMPLATE_RULES.split("\n")
        self.assertEqual(len(original), len(out))
        items = parse_items(TEMPLATE_RULES)
        for rule in DEFS:
            self.assertTrue(out[items[rule.section]].endswith(f" (`{rule.id}`)"), rule.id)
            self.assertTrue(out[items[rule.section]].startswith(original[items[rule.section]][:12]), rule.id)
        changed = [i for i, (a, b) in enumerate(zip(original, out)) if a != b]
        self.assertEqual(sorted(items.values()), changed)

    def test_off_rule_is_struck_through_and_says_so_and_a_safety_one_says_confirmed(self):
        out = "\n".join(self.render(RuleSetting("no-hardcoded", "off"), RuleSetting("no-force-push", "off", confirmed=True)))
        self.assertIn("~~No hardcoded values~~ Rule turned off in this system's plan; the hooks do not enforce it. (`no-hardcoded`, off)", out)
        self.assertIn("~~Never force-push~~ A safety rule, turned off with the owner's confirmation.", out)
        self.assertNotIn("No URLs, hosts, ports", out)

    def test_edited_rule_replaces_the_text_and_keeps_its_number(self):
        out = self.render(RuleSetting("verify-loop", "on", "Verify twice before every push."))
        line = next(line for line in out if "`verify-loop`" in line)
        self.assertEqual("4. Verify twice before every push. (`verify-loop`, edited in the plan)", line)

    def test_clause_under_an_item_is_a_rule_of_its_own(self):
        out = self.render(RuleSetting("no-hook-bypass", "off", confirmed=True))
        self.assertTrue(any(line.startswith("   - ~~Never skip or disable git hooks~~") for line in out))
        self.assertTrue(any(line.startswith("   - **Never force-push.**") for line in out))

    def test_rules_map_is_true_unless_off(self):
        rules = rules_map(DEFS, [RuleSetting("no-hardcoded", "off"), RuleSetting("verify-loop", "on", "x")])
        self.assertEqual(len(DEFS), len(rules))
        self.assertEqual([k for k, v in rules.items() if not v], ["no-hardcoded"])
        self.assertEqual(["no-force-push"], [d.id for d in safety_off(DEFS, [RuleSetting("no-force-push", "off"), RuleSetting("no-hardcoded", "off")])])


class PlanOverrides(TempDirTest):
    def plan(self, rules):
        data = valid_plan_data()
        data["rules"] = rules
        return Plan.from_dict(data, CATALOG)

    def problems(self, rules):
        with self.assertRaises(PlanError) as caught:
            self.plan(rules)
        return "\n".join(caught.exception.errors)

    def test_on_off_and_edited_are_read_and_round_trip(self):
        plan = self.plan([{"id": "no-hardcoded", "state": "off"}, {"id": "verify-loop", "text": "Twice."}, {"id": "map-first", "state": "on"}])
        self.assertEqual([("no-hardcoded", "off", ""), ("verify-loop", "on", "Twice."), ("map-first", "on", "")], [(r.id, r.state, r.text) for r in plan.rules])
        self.assertEqual(plan.to_dict()["rules"], Plan.from_dict(plan.to_dict(), CATALOG).to_dict()["rules"])

    def test_unknown_duplicate_and_bad_values_are_named(self):
        text = self.problems([{"id": "nope"}, {"id": "map-first"}, {"id": "map-first", "state": "maybe"}, {"id": "verify-loop", "confirmed": "yes"}])
        for part in ("rules[0].id", "not a rule of catalog/rules.json", "rules[2].id", "used twice", "rules[2].state", "rules[3].confirmed"):
            self.assertIn(part, text)

    def test_turning_off_a_safety_rule_needs_confirmed_true_in_the_plan(self):
        self.assertIn("needs \"confirmed\": true", self.problems([{"id": "no-secrets", "state": "off"}]))
        self.assertEqual("off", self.plan([{"id": "no-secrets", "state": "off", "confirmed": True}]).rules[0].state)
        self.assertEqual("on", self.plan([{"id": "no-secrets", "state": "on"}]).rules[0].state)   # on needs no confirmation


class ReviewOfRules(TempDirTest):
    def test_enter_keeps_every_rule_on(self):
        result, reader = reviewed([])
        self.assertEqual([], result.rules)
        self.assertTrue(any("Change a rule?" in p for p in reader.prompts))

    def test_safety_rule_needs_its_id_typed_again(self):
        asked = ["yes", "no-force-push", "off", "no-force-push", ""]
        result, reader = reviewed([], asked + [""] * 20)
        self.assertEqual([("no-force-push", "off", True)], [(r.id, r.state, r.confirmed) for r in result.rules])
        self.assertTrue(any("safety rule" in p for p in reader.prompts))

    def test_declining_the_extra_confirmation_keeps_the_rule_on(self):
        for second in ("", "no", "nope"):
            result, _ = reviewed([], ["yes", "no-secrets", "off", second, ""] + [""] * 20)
            self.assertEqual([], result.rules, second)

    def test_a_normal_rule_turns_off_without_the_extra_question(self):
        result, reader = reviewed([], ["yes", "no-hardcoded", "off", ""] + [""] * 20)
        self.assertEqual([("no-hardcoded", "off", False)], [(r.id, r.state, r.confirmed) for r in result.rules])
        self.assertFalse(any("safety rule" in p for p in reader.prompts))

    def test_on_resets_an_override_and_edit_sets_the_text(self):
        result, _ = reviewed([{"id": "verify-loop", "state": "off"}], ["yes", "verify-loop", "on", "yes", "map-first", "edit", "Short.", ""] + [""] * 20)
        self.assertEqual([("map-first", "on", "Short.")], [(r.id, r.state, r.text) for r in result.rules])

    def test_unknown_rule_id_is_asked_again(self):
        result, reader = reviewed([], ["yes", "nope", "no-hardcoded", "off", ""] + [""] * 20)
        self.assertEqual(["no-hardcoded"], [r.id for r in result.rules])

    def test_yes_keeps_defaults_and_a_confirmed_plan_as_it_is(self):
        result, reader = reviewed([], yes=True)
        self.assertEqual(([], []), (result.rules, reader.prompts))
        confirmed, _ = reviewed([{"id": "no-secrets", "state": "off", "confirmed": True}], yes=True)
        self.assertEqual("off", confirmed.rules[0].state)


class GeneratedWorkspace(TempDirTest):
    """Real workspace template: the rendered rules.md, the rules map and the generated hooks, end to end."""

    @classmethod
    def generate(cls, target, settings):
        spec = make_spec(target, apps=[], sdks=[], with_admin=False, rule_settings=settings)
        return generate(spec, TOOL_ROOT / "templates", git=True, tool=target.parent / "tool", knowledge=target.parent / "none")

    def hook(self, target, name, payload):
        return subprocess.run([sys.executable, str(target / ".claude" / "hooks" / name)], input=json.dumps(dict(payload, cwd=str(target))),
                              capture_output=True, text=True, cwd=target, timeout=60)

    def test_a_rule_turned_off_is_rendered_mapped_and_no_longer_enforced(self):
        on, off = self.root / "on", self.root / "off"
        self.generate(on, [])
        self.generate(off, [RuleSetting("no-protected-commits", "off", confirmed=True), RuleSetting("no-hardcoded", "off"),
                            RuleSetting("verify-loop", "on", "Verify twice.")])
        commit = {"tool_input": {"command": "git commit -m x"}}
        blocked, allowed = self.hook(on, "guard_git.py", commit), self.hook(off, "guard_git.py", commit)
        self.assertEqual((2, 0), (blocked.returncode, allowed.returncode))
        self.assertIn("forbidden", blocked.stderr)
        force = self.hook(off, "guard_git.py", {"tool_input": {"command": "git push --force origin feat/x"}})
        self.assertEqual(2, force.returncode)   # the rules that stayed on still block
        edit = {"tool_input": {"file_path": str(off / "src" / "app.ts"), "content": 'const u = "https://api.example.com";'}}
        self.assertEqual((0, 2), (self.hook(off, "check_hardcoded.py", edit).returncode, self.hook(on, "check_hardcoded.py", dict(edit, tool_input=dict(edit["tool_input"], file_path=str(on / "src" / "app.ts")))).returncode))
        registry = json.loads((off / ".claude" / "projects.json").read_text(encoding="utf-8"))
        self.assertEqual(["no-hardcoded", "no-protected-commits"], sorted(k for k, v in registry["rules"].items() if not v))
        self.assertEqual(len(DEFS), len(registry["rules"]))
        text = (off / ".claude" / "rules.md").read_text(encoding="utf-8")
        self.assertIn("~~Never commit or push to main or a master~~", text)
        self.assertIn("4. Verify twice. (`verify-loop`, edited in the plan)", text)
        self.assertTrue(all(f"`{d.id}`" in text for d in DEFS))
        self.assertIn("(`no-force-push`)", (on / ".claude" / "rules.md").read_text(encoding="utf-8"))
        self.assertNotIn("~~", (on / ".claude" / "rules.md").read_text(encoding="utf-8"))
        self.assertNotIn("__RULES_JSON__", (off / ".claude" / "projects.json").read_text(encoding="utf-8"))
