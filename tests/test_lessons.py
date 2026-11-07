"""Lessons: the file parses, every lesson has an ID, tags and an enforcement, a project gets the ones that match its modules,
`lessons import` removes duplicates and business names, shows a diff and adds only what is approved."""
from __future__ import annotations

import hashlib
import io
import json
import shutil
import subprocess
import sys
from contextlib import redirect_stdout

from _support import TOOL_ROOT, TempDirTest, make_spec, valid_plan_data

from cli import generate, main
from lessons import (ENFORCEMENTS, MODULE_TAGS, LessonsError, add, find_duplicate, for_project, matches, module_tags, names_from_plan,
                     next_id, normalize, parse, parse_local, scrub, select)
from lessons_cmd import run_lessons
from prompts import AppSpec

KNOWLEDGE = TOOL_ROOT / "knowledge"
LESSONS = (KNOWLEDGE / "LESSONS.md").read_text(encoding="utf-8")
LINE = "- **L-%03d** · `%s` · `%s` — %s"


def doc(*lines):
    return "# Title\n\n> note\n\n## 1. Group\n" + "".join(l + "\n" for l in lines)


class Scripted:
    def __init__(self, answers=()):
        self.answers, self.prompts = list(answers), []

    def __call__(self, prompt):
        self.prompts.append(prompt)
        return self.answers.pop(0) if self.answers else ""


class LessonsFile(TempDirTest):
    def test_the_shipped_file_round_trips_and_every_lesson_is_well_formed(self):
        document = parse(LESSONS)
        self.assertEqual(LESSONS, document.render())
        lessons = document.lessons()
        self.assertGreater(len(lessons), 150)
        self.assertEqual(len(lessons), len({l.id for l in lessons}))
        self.assertTrue(all(l.tags and l.enforcement in ENFORCEMENTS for l in lessons))
        self.assertTrue({"rule", "policy-check", "template", "note"} <= {l.enforcement for l in lessons})
        self.assertTrue(set(MODULE_TAGS) <= {t for l in lessons for t in l.tags})

    def test_the_first_harvest_is_in_the_file_without_names(self):
        text = LESSONS.lower()
        for fragment in ("firebase_messaging_installation_id_enabled=true", "swallow a registration error", "152 requests in 90 s",
                         "hosted environment with a real device push", "token, delivery and display", "from another checkout",
                         "force-stopped android app", "before creating anything outside the repository"):
            self.assertIn(fragment, text)

    def test_malformed_lines_are_refused_with_their_line_number(self):
        for text, message in ((doc("- a plain bullet"), ":6: not a lesson line"), (doc(LINE % (1, "a", "magic", "x")), "enforcement 'magic'"),
                              (doc(LINE % (1, "a", "note", "x"), LINE % (1, "b", "note", "y")), "L-001 is used twice"),
                              (doc("some prose"), "text between lessons")):
            with self.assertRaises(LessonsError) as caught:
                parse(text)
            self.assertIn(message, str(caught.exception))

    def test_ids_are_stable_and_new_ones_continue_after_the_highest(self):
        document = parse(doc(LINE % (7, "a", "note", "x"), LINE % (3, "b", "rule", "y")))
        self.assertEqual("L-008", next_id(document))
        add(document, [parse(doc(LINE % (8, "c", "note", "z"))).lessons()[0]])
        self.assertEqual("## 2. Learned from projects", document.groups[-1].heading)
        self.assertEqual(["L-007", "L-003", "L-008"], [l.id for l in document.lessons()])
        self.assertEqual(document.render(), parse(document.render()).render())


class Selection(TempDirTest):
    def test_a_module_tag_limits_a_lesson_to_projects_that_have_it(self):
        server, android, general = (parse(doc(LINE % (n, tags, "note", "x"))).lessons()[0] for n, tags in ((1, "server"), (2, "kmp` `android"), (3, "workflow` `qa")))
        self.assertEqual((True, False, True), tuple(matches(l, {"server"}) for l in (server, android, general)))
        self.assertEqual((False, True, True), tuple(matches(l, {"kmp", "android"}) for l in (server, android, general)))
        self.assertTrue(matches(general, set()))

    def test_module_tags_of_a_spec(self):
        self.assertEqual({"server", "web", "kmp", "android", "ios", "sdk"}, module_tags(make_spec(self.root / "a")))
        spec = make_spec(self.root / "b", with_admin=False, apps=[AppSpec("Customer", "customer", platforms=["android"])], sdks=[])
        self.assertEqual({"server", "kmp", "android"}, module_tags(spec))
        self.assertEqual({"server"}, module_tags(make_spec(self.root / "c", with_admin=False, apps=[], sdks=[])))

    def test_selection_keeps_only_matching_lessons_and_drops_empty_groups(self):
        document = parse(LESSONS)
        server = select(document, {"server"})
        tags = {t for l in server.lessons() for t in l.tags}
        self.assertTrue(tags.isdisjoint({"android", "ios", "kmp"}))
        self.assertIn("server", tags)
        self.assertIn("workflow", tags)
        self.assertTrue(all(g.lessons for g in server.groups))
        ios = {l.id for l in select(document, {"kmp", "ios"}).lessons()}
        android = {l.id for l in select(document, {"kmp", "android"}).lessons()}
        self.assertTrue(ios - android and android - ios)
        web_only = select(document, {"web"}).lessons()
        self.assertTrue(all(not ({"android", "ios", "kmp", "server"} & set(l.tags)) for l in web_only))

    def test_a_lessons_file_in_the_old_format_is_copied_whole(self):
        from workspace import copy_knowledge
        old = self.root / "old"
        old.mkdir()
        (old / "LESSONS.md").write_text("# Lessons\n\n## 1. A\n- a plain bullet\n", encoding="utf-8")
        repo = self.root / "repo"
        repo.mkdir()
        self.assertEqual(["docs/knowledge/LESSONS.md"], copy_knowledge(repo, old, {"server"}))
        self.assertEqual((old / "LESSONS.md").read_text(encoding="utf-8"), (repo / "docs" / "knowledge" / "LESSONS.md").read_text(encoding="utf-8"))

    def test_project_copy_says_for_which_modules_and_still_parses(self):
        text = for_project(LESSONS, {"server", "sdk"})
        self.assertIn("This copy is for a project with: sdk, server.", text)
        self.assertLess(len(parse(text).lessons()), len(parse(LESSONS).lessons()))
        self.assertEqual(text, parse(text).render())


class Duplicates(TempDirTest):
    def test_normalized_text_and_close_matches_are_found(self):
        known = [("L-001", "Retry the token sync only when the token changed; otherwise it loops."), ("L-002", "Keep files under 300 lines.")]
        self.assertEqual(("L-001", "same"), find_duplicate("retry the TOKEN sync, only when the token changed - otherwise it loops", known))
        self.assertEqual(("L-001", "close"), find_duplicate("Retry the token sync only when the token has changed, otherwise it loops.", known))
        self.assertIsNone(find_duplicate("Always pin the toolchain version.", known))
        self.assertEqual("a b c", normalize("A, b; C!"))


class NamesAndPrivatePatterns(TempDirTest):
    PLAN = valid_plan_data()

    def test_names_come_from_the_plan_and_generic_words_are_left_out(self):
        names = names_from_plan(self.PLAN)
        lowered = [n.lower() for n in names]
        for expected in ("acme shop", "acme-shop"):
            self.assertIn(expected, lowered)
        self.assertNotIn("acme", lowered)   # the prefix is matched only as `ACME-...`
        self.assertTrue({"server", "admin", "app"}.isdisjoint(lowered))

    def test_scrub_replaces_names_in_any_spelling_and_private_patterns(self):
        text, found = scrub("At Acme Shop the acme-shop server (ops@example.com, http://10.0.0.1:3000, " + "/Us" + "ers/x/y) failed; ACME-001.",
                            names_from_plan(self.PLAN), ["ACME", "NOT"])
        self.assertEqual("At <name> the <name> server (<removed>, <removed>, <removed>) failed; <name>.", text)
        for part in ("the name 'Acme Shop'", "an e-mail address", "a web address", "an absolute path", "a task id or folder name of the project"):
            self.assertIn(part, found)
        self.assertEqual(("Retry the sync.", []), scrub("Retry the sync.", names_from_plan(self.PLAN)))
        self.assertEqual("The <name> package.", scrub("The acmeshop package.", ["Acme Shop"])[0])   # slug-like spellings too
        self.assertEqual("An acme-shopping cart stays.", scrub("An acme-shopping cart stays.", ["Acme Shop"])[0])   # but not longer words
        self.assertEqual("Do NOT retry, not <name>.", scrub("Do NOT retry, not NOT-004.", [], ["NOT"])[0])   # a prefix that is a word is matched only as an id


class Import(TempDirTest):
    def setUp(self):
        super().setUp()
        self.knowledge = self.root / "knowledge"
        shutil.copytree(KNOWLEDGE, self.knowledge)
        self.project = self.root / "acme-shop"
        self.write("acme-shop/system.plan.json", json.dumps(valid_plan_data()))
        self.write("acme-shop/.claude/projects.json", json.dumps({"projects": {"server": {"prefix": "SRV", "kind": "server"}, "app": {"prefix": "CUS", "kind": "kmp"}}}))
        self.real = hashlib.sha256((KNOWLEDGE / "LESSONS.md").read_bytes()).hexdigest()

    def tearDown(self):
        self.assertEqual(self.real, hashlib.sha256((KNOWLEDGE / "LESSONS.md").read_bytes()).hexdigest(), "the real lessons file was changed")
        super().tearDown()

    def local(self, *items):
        self.write("acme-shop/docs/knowledge/LESSONS.local.md", "# Lessons\n\n" + "".join(f"- [{task}] {text}\n" for task, text in items))

    def run_import(self, *argv, answers=()):
        out, said, reader = io.StringIO(), [], Scripted(answers)
        with redirect_stdout(out):
            code = run_lessons(["import", str(self.project), "--knowledge", str(self.knowledge), *argv], said.append, reader)
        return code, "\n".join(said), reader

    def lessons(self):
        return parse((self.knowledge / "LESSONS.md").read_text(encoding="utf-8")).lessons()

    def test_yes_adds_clean_lessons_with_new_ids_and_skips_duplicates_names_and_secrets(self):
        before = self.lessons()
        existing = before[0].text
        secret = "key=" + "sk_" + "live_" + "abcdefghij0123456789"
        self.local(("SRV-001", "Cache the signing keys per process and refresh them on a 401."), ("SRV-002", existing), ("SRV-003", existing.lower() + " "),
                   ("SRV-004", "Cache the signing keys per process, and refresh them on a 401 error!"), ("SRV-005", "The Acme Shop checkout waits for the queue."),
                   ("CUS-001", "Pin the Gradle wrapper in CI."), ("SRV-006", "Do not log " + secret), ("SRV-007", "See https://example.com/a for the fix."))
        code, text, _ = self.run_import("--yes")
        self.assertEqual(0, code)
        after = self.lessons()
        added = after[len(before):]
        self.assertEqual(["Cache the signing keys per process and refresh them on a 401.", "Pin the Gradle wrapper in CI."], [l.text for l in added])
        top = max(int(l.id[2:]) for l in before)
        self.assertEqual([f"L-{top + n:03d}" for n in (1, 2)], [l.id for l in added])
        self.assertEqual([["server"], ["kmp"]], [l.tags for l in added])
        self.assertTrue(all(l.enforcement == "note" for l in added))
        self.assertEqual(before, after[:len(before)])
        for part in ("skipped duplicate  [SRV-002] the same as", "[SRV-004] close to [SRV-001]", "flagged            [SRV-005] holds the name 'Acme Shop'",
                     "[SRV-007] holds a web address", "never added", "--yes: 2 flagged lesson(s) skipped", "+- **L-"):
            self.assertIn(part, text)
        self.assertNotIn("Acme Shop checkout", "\n".join(l.text for l in after))
        self.assertNotIn("example.com", "\n".join(l.text for l in after))

    def test_a_second_import_adds_nothing(self):
        self.local(("SRV-001", "Cache the signing keys per process and refresh them on a 401."))
        self.run_import("--yes")
        count = len(self.lessons())
        code, text, _ = self.run_import("--yes")
        self.assertEqual((0, count), (code, len(self.lessons())))
        self.assertIn("Nothing new to import", text)

    def test_interactive_adds_only_what_is_approved_with_tags_and_enforcement_chosen(self):
        self.local(("SRV-001", "Cache the signing keys per process and refresh them on a 401."), ("SRV-002", "Prefer a queue over a cron for retries."),
                   ("SRV-003", "The Acme Shop checkout waits for the queue."))
        before = len(self.lessons())
        code, text, reader = self.run_import(answers=["yes", "no", "yes", "server, sdk", "policy-check", "", ""])   # three approvals, then tags + enforcement
        self.assertEqual(0, code)
        added = self.lessons()[before:]
        self.assertEqual([("Cache the signing keys per process and refresh them on a 401.", ["server", "sdk"], "policy-check"),
                          ("The <name> checkout waits for the queue.", ["server"], "note")], [(l.text, l.tags, l.enforcement) for l in added])
        self.assertIn("Proposed change to knowledge/LESSONS.md", text)
        self.assertIn("flagged: the name 'Acme Shop'; only the text above (names removed) would be added", text)
        self.assertNotIn("Prefer a queue", "\n".join(l.text for l in added))

    def test_nothing_approved_leaves_the_file_alone(self):
        self.local(("SRV-001", "Cache the signing keys per process and refresh them on a 401."))
        before = (self.knowledge / "LESSONS.md").read_bytes()
        code, text, _ = self.run_import(answers=["no"])
        self.assertEqual((0, before), (code, (self.knowledge / "LESSONS.md").read_bytes()))
        self.assertIn("Nothing approved", text)

    def test_missing_local_file_and_missing_plan_are_reported(self):
        code, text, _ = self.run_import("--yes")
        self.assertEqual(1, code)
        self.assertIn("LESSONS.local.md not found", text)
        self.local(("SRV-001", "Cache the signing keys per process and refresh them on a 401."))
        (self.project / "system.plan.json").unlink()
        code, text, _ = self.run_import("--yes")
        self.assertEqual(0, code)
        self.assertIn("business names are not checked", text)

    def test_list_filters_by_tag(self):
        said = []
        self.assertEqual(0, run_lessons(["list", "--tag", "ios", "--knowledge", str(self.knowledge)], said.append))
        self.assertTrue(said[-1].endswith("tagged 'ios'"))
        self.assertTrue(all("[" in line and "ios" in line for line in said[:-1]))
        self.assertGreater(len(said), 3)

    def test_the_subcommand_is_wired_into_the_cli(self):
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(0, main(["lessons", "list", "--tag", "sdk", "--knowledge", str(self.knowledge)]))
        self.assertIn("lessons tagged 'sdk'", out.getvalue())

    def test_local_file_parser(self):
        self.assertEqual([("SRV-001", "a b"), ("ADM-12a", "c")], parse_local("# x\n- [SRV-001] a b\nnoise\n- [ADM-12a] c\n- [bad] d\n"))


class FullLoop(TempDirTest):
    """A lesson written in one generated project reaches the tool's lessons and the next generated project."""

    def test_task_lesson_to_import_to_the_next_project(self):
        knowledge = self.root / "knowledge"
        shutil.copytree(KNOWLEDGE, knowledge)
        templates = TOOL_ROOT / "templates"
        first = make_spec(self.root / "first", apps=[], sdks=[], with_admin=False)
        generate(first, templates, git=False, tool=self.root / "tool", knowledge=knowledge)
        server_lessons = (first.target / "docs" / "knowledge" / "LESSONS.md").read_text(encoding="utf-8")
        tags = {t for l in parse(server_lessons).lessons() for t in l.tags}
        self.assertFalse({"android", "ios", "kmp", "web"} & tags)
        self.assertIn("server", tags)
        self.assertIn("docs/knowledge/LESSONS.md", (first.target / "CLAUDE.md").read_text(encoding="utf-8"))
        (first.target / "ACME-Server" / "docs" / "ACME_Server_Tasks.md").write_text(   # the shipped table has a padded header `tasks.py` does not read
            "| ID | Task | Branch | Needs | Status | Notes |\n|---|---|---|---|---|---|\n| SRV-001 | Scaffold | `feat/srv-001-scaffold` | — | IN REVIEW | — |\n", encoding="utf-8")
        session = first.target / "ACME-Server" / ".claude" / "session.md"
        session.write_text("### SRV-001 — Scaffold\n- Branch: `feat/srv-001-scaffold`\n- Lesson: Rotate the signing keys before the grace period ends, not after.\n", encoding="utf-8")
        done = subprocess.run([sys.executable, "scripts/tasks.py", "set", "SRV-001", "DONE"], cwd=first.target, capture_output=True, text=True, timeout=60)
        self.assertEqual(0, done.returncode, done.stderr)
        self.assertIn("lesson of SRV-001 recorded", done.stdout)
        said = []
        self.assertEqual(0, run_lessons(["import", str(first.target), "--knowledge", str(knowledge), "--yes"], said.append))
        added = parse((knowledge / "LESSONS.md").read_text(encoding="utf-8")).lessons()[-1]
        self.assertEqual(("Rotate the signing keys before the grace period ends, not after.", ["server"]), (added.text, added.tags))
        second = make_spec(self.root / "second", apps=[], sdks=[], with_admin=False)
        generate(second, templates, git=False, tool=self.root / "tool", knowledge=knowledge)
        found = subprocess.run([sys.executable, "scripts/recall.py", "signing", "keys", "grace"], cwd=second.target, capture_output=True, text=True, timeout=60)
        self.assertIn("docs/knowledge/LESSONS.md", found.stdout)
        self.assertIn(added.id, found.stdout)
