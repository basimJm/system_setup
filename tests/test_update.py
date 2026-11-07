"""`SYSTEM_SETUP update` on the fixture templates and the fake analyzer: additions, nothing overwritten, removals listed only, the plan
diff in words, a dirty git tree refused, an edited document kept with `<name>.proposed.md`, and the plan written only on success.
No model, no network."""
from __future__ import annotations

import io
import json
import subprocess
from contextlib import redirect_stdout
from pathlib import Path

from _support import FIXTURE_KNOWLEDGE, FIXTURE_PLANS, FIXTURE_TEMPLATES, SAMPLE_DOCS, TempDirTest, valid_plan_data

from analyzer import FakeAnalyzer
from catalog import load_catalog
from cli import generate, main
from commands import run_documents_command
from plan import PLAN_FILE, Plan, load_plan
from test_documents import Canned
from update import add_integration_rows, new_rows, plan_diff, run_update

CATALOG = load_catalog()
GIT = ["git", "-c", "user.name=Tester", "-c", "user.email=tester@example.com"]
DRIVER = {"id": "driver", "kind": "app", "name": "Driver", "audience": "couriers", "why": "deliver orders", "platforms": ["android", "ios"]}
STORAGE = {"id": "storage", "title": "Storage", "why": "product photos", "source": "internal", "provider": "s3"}


def plan_of(data: dict) -> Plan:
    return Plan.from_dict(data, CATALOG)


def changed(change) -> dict:
    data = valid_plan_data()
    change(data)
    return data


def with_driver_and_storage(data: dict) -> None:
    data["modules"].append(dict(DRIVER))
    data["sdks"].append(dict(STORAGE))


class UpdateTest(TempDirTest):
    def setUp(self):
        super().setUp()
        self.system = self.root / "acme-shop"
        self.count = 0
        self.assertEqual(0, self.make(valid_plan_data()))

    def make(self, data: dict) -> int:
        path = self.write("in/base.json", json.dumps(data))
        with redirect_stdout(io.StringIO()):
            return main(["new", "--plan", str(path), "--yes", "--target", str(self.system), "--templates", str(FIXTURE_TEMPLATES),
                         "--knowledge", str(FIXTURE_KNOWLEDGE), "--no-documents"])

    def update(self, data=None, *extra, analyzer=None, reader=None, plan=True):
        """Runs `update` with the plan `data` (a dict) in a file; returns (code, text)."""
        self.count += 1
        argv = ["--target", str(self.system), "--templates", str(FIXTURE_TEMPLATES), "--knowledge", str(FIXTURE_KNOWLEDGE), "--no-documents"]
        if data is not None and plan:
            argv += ["--plan", str(self.write(f"in/plan{self.count}.json", json.dumps(data)))]
        if reader is None:
            argv.append("--yes")
        lines = []
        code = run_update(argv + list(extra), generate, analyzer=analyzer, reader=reader or input, say=lines.append)
        return code, "\n".join(lines)

    def git(self, *args) -> str:
        return subprocess.run(GIT + list(args), cwd=self.system, capture_output=True, text=True, check=True).stdout

    def commit(self, message="work") -> None:
        self.git("add", "-A")
        self.git("commit", "-q", "--allow-empty", "-m", message)

    def saved_plan(self) -> dict:
        return load_plan(self.system / PLAN_FILE, CATALOG).to_dict()

    def registry(self) -> dict:
        return json.loads((self.system / ".claude" / "projects.json").read_text(encoding="utf-8"))["projects"]

    def backlog(self, key: str) -> str:
        return (self.system / self.registry()[key]["backlog"]).read_text(encoding="utf-8")

    def break_the_check(self) -> Path:
        """The fixture `tasks.py check` fails when a session file is missing; returns it (its text is the repair)."""
        session = self.system / self.registry()["server"]["session"]
        session.unlink()
        self.commit("a missing session file")
        return session

    def tasks_check(self) -> str:
        done = subprocess.run(["python3", "scripts/tasks.py", "check"], cwd=self.system, capture_output=True, text=True, check=False)
        self.assertEqual(0, done.returncode, done.stdout + done.stderr)
        return done.stdout


class AdditionsTest(UpdateTest):
    def test_a_new_app_and_a_new_sdk_are_added_and_the_work_of_the_person_stays(self):
        mine = self.system / "ACME-Server" / "CLAUDE.md"
        mine.write_text(mine.read_text(encoding="utf-8") + "\nMy own rule: never deploy on Friday.\n", encoding="utf-8")
        self.commit("my own work")
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(0, code, text)
        self.assertIn("My own rule: never deploy on Friday.", mine.read_text(encoding="utf-8"))
        self.assertTrue((self.system / "ACME-Mobile-Driver").is_dir() and (self.system / "acme-shop-storage").is_dir(), text)
        self.assertIn("driver", self.registry())
        self.assertIn("storage", self.registry())
        self.assertTrue((self.system / self.registry()["driver"]["backlog"]).is_file())
        self.assertIn("Modules, added", text)
        self.assertIn("Driver (driver, app) for couriers [android, ios]", text)
        self.assertIn("tasks.py check: OK", text)
        self.assertEqual(changed(with_driver_and_storage)["modules"][-1]["id"], self.saved_plan()["modules"][-1]["id"])
        self.tasks_check()

    def test_nothing_is_committed_and_the_commands_to_review_are_printed(self):
        self.commit("start")
        before = self.git("rev-parse", "HEAD")
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(0, code, text)
        self.assertEqual(before, self.git("rev-parse", "HEAD"))
        self.assertIn("?? ACME-Mobile-Driver/", self.git("status", "--short"))
        self.assertIn("Nothing was committed", text)
        self.assertIn(f"git -C {self.system} diff", text)
        self.assertIn(f"git -C {self.system} branch driver main", text)

    def test_an_update_that_changes_nothing_says_so(self):
        self.commit("start")
        code, text = self.update(valid_plan_data())
        self.assertEqual(0, code, text)
        self.assertIn("Nothing to update", text)

    def test_a_second_run_with_the_same_plan_adds_nothing_again(self):
        self.update(changed(with_driver_and_storage))
        self.commit("first update")
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(0, code, text)
        self.assertIn("Nothing to update", text)
        self.assertEqual("", self.git("status", "--short"))


class NothingIsOverwrittenTest(UpdateTest):
    def test_an_existing_folder_of_a_new_part_is_left_alone_and_the_new_part_is_not_registered(self):
        mine = self.write("acme-shop/ACME-Mobile-Driver/notes.txt", "my own folder\n")
        self.commit("a folder with the same name")
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(0, code, text)
        self.assertEqual("my own folder\n", mine.read_text(encoding="utf-8"))
        self.assertEqual(["notes.txt"], sorted(p.name for p in mine.parent.iterdir()))
        self.assertNotIn("driver", self.registry())
        self.assertIn("ACME-Mobile-Driver/ (new part `driver`): ACME-Mobile-Driver/ already exists", text)
        self.assertIn("New part `driver` was not generated", self.backlog("server"))
        self.assertTrue((self.system / "acme-shop-storage").is_dir())   # the rest of the update still happens
        self.tasks_check()

    def test_a_generated_file_that_exists_and_differs_is_kept_and_listed(self):
        mine = self.system / "CLAUDE.md"
        mine.write_text("# My own root file\n", encoding="utf-8")
        self.commit("my own root file")
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(0, code, text)
        self.assertEqual("# My own root file\n", mine.read_text(encoding="utf-8"))
        self.assertRegex(text, r"Kept as they are, the generated version differs \(\d+\)")
        self.assertIn("    CLAUDE.md", text)

    def test_a_file_the_person_deleted_is_not_brought_back(self):
        (self.system / "ACME-Server" / "CLAUDE.md").unlink()
        self.commit("deleted")
        self.update(changed(with_driver_and_storage))
        self.assertFalse((self.system / "ACME-Server" / "CLAUDE.md").exists())


class RemovalsTest(UpdateTest):
    def test_a_removed_app_and_sdk_delete_nothing_and_add_pending_rows(self):
        self.update(changed(with_driver_and_storage))
        self.commit("with driver and storage")
        files = sorted(p.relative_to(self.system).as_posix() for p in (self.system / "ACME-Mobile-Driver").rglob("*") if p.is_file())
        code, text = self.update(valid_plan_data())
        self.assertEqual(0, code, text)
        self.assertEqual(files, sorted(p.relative_to(self.system).as_posix() for p in (self.system / "ACME-Mobile-Driver").rglob("*") if p.is_file()))
        self.assertTrue((self.system / "acme-shop-storage").is_dir())
        self.assertIn("driver", self.registry())
        self.assertRegex(self.backlog("driver"), r"\| DRI-\d+ \| Decide what to do with ACME-Mobile-Driver/: it is no longer in the plan \|.*\| PENDING \|")
        self.assertRegex(self.backlog("storage"), r"\| PENDING \| Owner decision: nothing was deleted")
        self.assertIn("nothing is deleted", text)
        self.assertIn("Not removed", text)
        self.assertEqual(valid_plan_data()["modules"], self.saved_plan()["modules"])
        self.tasks_check()

    def test_a_changed_platform_is_listed_with_a_pending_row_and_the_folder_is_untouched(self):
        self.commit("start")
        data = changed(lambda d: d["modules"][2].update(platforms=["android"]))
        code, text = self.update(data)
        self.assertEqual(0, code, text)
        self.assertIn("customer: platforms android, ios -> android", text)
        self.assertIn("the existing folder is not changed", text)
        self.assertRegex(self.backlog("customer"), r"The plan changed module customer.*\| PENDING \|")
        self.tasks_check()

    def test_the_pending_rows_are_not_added_twice_when_the_update_is_run_again_after_a_failure(self):
        self.update(changed(with_driver_and_storage))
        self.commit("with driver")
        self.break_the_check()
        code, text = self.update(valid_plan_data())
        self.assertEqual(1, code, text)
        self.commit("rows of the first try")
        self.update(valid_plan_data())
        self.assertEqual(1, self.backlog("driver").count("Decide what to do with ACME-Mobile-Driver/"))


class PlanDiffTest(UpdateTest):
    def test_the_diff_says_in_words_what_changed(self):
        data = changed(lambda d: (d["modules"].append(dict(DRIVER)), d["modules"][2].update(platforms=["android"]),
                                   d["sdks"][0].update(provider="vonage"), d["sdks"].pop(1),
                                   d["deployment"][0].update(host="fly"), d["open_questions"][0].update(answer="Not sold"),
                                   d["open_questions"].append({"id": "tips", "question": "Can customers tip?", "why": "pay", "proposed_default": "no"})))
        lines = "\n".join(plan_diff(plan_of(valid_plan_data()), plan_of(data)).render())
        self.assertIn("Modules, added:\n    + Driver (driver, app) for couriers [android, ios]", lines)
        self.assertIn("customer: platforms android, ios -> android", lines)
        self.assertIn("Building blocks (SDKs), removed", lines)
        self.assertIn("- Payments (payments): built here; provider stripe", lines)
        self.assertIn("otp: provider twilio -> vonage", lines)
        self.assertIn("server: host render -> fly", lines)
        self.assertIn("answered: How is alcohol handled? -> Not sold", lines)
        self.assertIn("new: Can customers tip?", lines)

    def test_no_change_reads_as_no_change(self):
        self.assertEqual(["  The plan has no changes."], plan_diff(plan_of(valid_plan_data()), plan_of(valid_plan_data())).render())

    def test_the_system_identity_cannot_change_with_a_plan(self):
        self.commit("start")
        code, text = self.update(changed(lambda d: d["system"].update(prefix="OTHER")))
        self.assertEqual(2, code, text)
        self.assertIn("cannot change in an update", text)
        self.assertEqual("ACME", self.saved_plan()["system"]["prefix"])


class DirtyTreeTest(UpdateTest):
    def test_an_uncommitted_change_stops_the_update_before_any_model_call(self):
        (self.system / "ACME-Server" / "CLAUDE.md").write_text("changed, not committed\n", encoding="utf-8")
        fake = FakeAnalyzer([])
        document = self.write("in/BUSINESS.md", "# Acme Shop\nWe also deliver now.\n")
        code, text = self.update(None, "--business-doc", str(document), analyzer=fake)
        self.assertEqual(1, code, text)
        self.assertIn("uncommitted changes", text)
        self.assertEqual([], fake.requests)
        self.assertFalse((self.system / "ACME-Mobile-Driver").exists())
        self.assertEqual(valid_plan_data()["modules"], self.saved_plan()["modules"])

    def test_allow_dirty_goes_on(self):
        (self.system / "ACME-Server" / "CLAUDE.md").write_text("changed, not committed\n", encoding="utf-8")
        code, text = self.update(changed(with_driver_and_storage), "--allow-dirty")
        self.assertEqual(0, code, text)
        self.assertTrue((self.system / "ACME-Mobile-Driver").is_dir())
        self.assertEqual("changed, not committed\n", (self.system / "ACME-Server" / "CLAUDE.md").read_text(encoding="utf-8"))

    def test_a_folder_that_is_not_a_git_repository_is_updated_with_a_note(self):
        subprocess.run(["rm", "-rf", str(self.system / ".git")], check=True)
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(0, code, text)
        self.assertIn("not in a git repository", text)
        self.assertNotIn("git -C", text)


class PlanIsWrittenOnlyOnSuccessTest(UpdateTest):
    def test_a_failing_check_leaves_the_saved_plan_and_a_rerun_after_the_fix_writes_it(self):
        session = self.break_the_check()
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(1, code, text)
        self.assertIn("is NOT updated", text)
        self.assertEqual(valid_plan_data()["modules"], self.saved_plan()["modules"])
        self.assertTrue((self.system / "ACME-Mobile-Driver").is_dir())   # the additions are applied; the rerun is safe
        session.write_text("# Session\n", encoding="utf-8")
        self.commit("fixed")
        code, text = self.update(changed(with_driver_and_storage))
        self.assertEqual(0, code, text)
        self.assertEqual("driver", self.saved_plan()["modules"][-1]["id"])

    def test_a_plan_that_cannot_be_rendered_changes_nothing(self):
        self.commit("start")
        broken = changed(lambda d: d["modules"].append(dict(DRIVER)))
        code, text = self.update(broken, "--templates", str(self.root / "no-templates"))
        self.assertEqual(1, code, text)
        self.assertIn("nothing was changed", text)
        self.assertFalse((self.system / "ACME-Mobile-Driver").exists())
        self.assertEqual(valid_plan_data()["modules"], self.saved_plan()["modules"])

    def test_declining_the_confirmation_changes_nothing(self):
        self.commit("start")
        asked = []

        def reader(prompt):
            asked.append(prompt)
            return "no" if prompt.startswith("Apply?") else ""

        code, text = self.update(changed(with_driver_and_storage), reader=reader)
        self.assertEqual(1, code, text)
        self.assertIn("Cancelled. Nothing was changed.", text)
        self.assertFalse((self.system / "ACME-Mobile-Driver").exists())
        self.assertEqual(valid_plan_data()["modules"], self.saved_plan()["modules"])


class AnalysisTest(UpdateTest):
    def test_a_changed_document_is_analyzed_once_and_the_identity_and_answers_are_kept(self):
        self.commit("start")
        data = changed(with_driver_and_storage)
        data["system"].update(prefix="NEW", npm_scope="@new")
        data["open_questions"][0]["answer"] = None
        saved = self.system / "docs" / "BUSINESS.md"
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_text("# Acme Shop\nWe sell groceries.\n", encoding="utf-8")
        self.commit("the saved document")
        old = self.saved_plan()
        old["open_questions"][0]["answer"] = "ID check at the door"
        (self.system / PLAN_FILE).write_text(json.dumps(old, indent=2), encoding="utf-8")
        self.commit("an answered question")
        document = self.write("in/BUSINESS.md", "# Acme Shop\nWe sell groceries and have couriers.\n")
        fake = FakeAnalyzer([data], cost_usd=0.07)
        code, text = self.update(None, "--business-doc", str(document), analyzer=fake)
        self.assertEqual(0, code, text)
        self.assertEqual(1, len(fake.requests))
        self.assertIn("the saved ones are kept", text)
        saved_plan = self.saved_plan()
        self.assertEqual("ACME", saved_plan["system"]["prefix"])
        self.assertEqual("ID check at the door", saved_plan["open_questions"][0]["answer"])
        self.assertEqual("# Acme Shop\nWe sell groceries and have couriers.\n", saved.read_text(encoding="utf-8"))
        self.assertTrue((self.system / "ACME-Mobile-Driver").is_dir())
        self.assertIn("Analysis cost: $0.0700", text)

    def test_an_unchanged_document_needs_no_model(self):
        saved = self.system / "docs" / "BUSINESS.md"
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_text("# Acme Shop\n", encoding="utf-8")
        self.commit("the saved document")
        fake = FakeAnalyzer([])
        document = self.write("in/BUSINESS.md", "# Acme Shop\n\n")
        code, text = self.update(None, "--business-doc", str(document), analyzer=fake)
        self.assertEqual(0, code, text)
        self.assertEqual([], fake.requests)
        self.assertIn("nothing to analyze", text)

    def test_a_failed_analysis_changes_nothing(self):
        saved = self.system / "docs" / "BUSINESS.md"
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_text("# Acme Shop\n", encoding="utf-8")
        self.commit("the saved document")
        document = self.write("in/BUSINESS.md", "# Acme Shop\nChanged.\n")
        code, text = self.update(None, "--business-doc", str(document), analyzer=FakeAnalyzer([]))
        self.assertEqual(1, code, text)
        self.assertIn("Analysis failed", text)
        self.assertEqual("", self.git("status", "--short"))


class HelpersTest(UpdateTest):
    def test_new_rows_are_those_whose_title_is_new(self):
        before = "| ACME-001 | First | `feat/acme-001-first` | — | TODO | n |\n"
        after = before + "| ACME-002 | Choose the host | `feat/acme-002-host-server` | ACME-001 | PENDING | Owner decision: pick |\n"
        self.assertEqual([("Choose the host", "host-server", "PENDING", "Owner decision: pick")], new_rows(before, after, "ACME"))
        self.assertEqual([], new_rows(after, after, "ACME"))

    def test_integration_rows_go_after_the_parts_table_once(self):
        path = self.write("INTEGRATION.md", "# Map\n\n## 1. Parts\n| Key | Folder |\n|---|---|\n| `server` | `S/` |\n<!-- one row per app -->\n\n## 2. Next\n")
        projects = {"server": {"dir": "S", "title": "S (API)", "master": "server", "backlog": "S/docs/T.md", "prefix": "SRV"},
                    "driver": {"dir": "D", "title": "D (app)", "master": "driver", "backlog": "D/docs/T.md", "prefix": "DRV"}}
        self.assertEqual(["driver"], add_integration_rows(path, projects, ["server", "driver"]))
        text = path.read_text(encoding="utf-8")
        self.assertLess(text.index("| `driver` |"), text.index("<!-- one row"))
        self.assertEqual([], add_integration_rows(path, projects, ["driver"]))
        self.assertEqual(1, sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("| `driver` |")))


class DocumentsTest(TempDirTest):
    """The real templates and the canned document analyzer: an edited document is kept, and only the documents that read a change are redone."""

    def setUp(self):
        super().setUp()
        self.system = self.root / "school"
        out = io.StringIO()
        with redirect_stdout(out):
            code = main(["new", "--plan", str(FIXTURE_PLANS / "school-fee-portal-web.json"), "--business-doc", str(SAMPLE_DOCS / "school-fee-portal-web.md"),
                         "--yes", "--target", str(self.system), "--no-documents"])
            self.assertEqual(0, code, out.getvalue()[-1500:])
            run_documents_command(["--target", str(self.system)], analyzer=Canned())
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "documents written")

    def git(self, *args) -> str:
        return subprocess.run(GIT + list(args), cwd=self.system, capture_output=True, text=True, check=True).stdout

    def test_an_edited_document_is_kept_and_the_new_text_is_written_next_to_it(self):
        brd = self.system / "HFP-Web-ParentWeb" / "docs" / "Parent_Web_BRD.md"
        brd.write_text(brd.read_text(encoding="utf-8") + "\nOwner decision recorded by hand.\n", encoding="utf-8")
        self.git("commit", "-q", "-am", "my edit")
        plan = load_plan(self.system / PLAN_FILE, load_catalog()).to_dict()
        next(m for m in plan["modules"] if m["id"] == "parent-web")["why"] = "Parents also see a yearly statement."
        path = self.root / "changed.json"
        path.write_text(json.dumps(plan), encoding="utf-8")
        canned, lines = Canned(), []
        code = run_update(["--target", str(self.system), "--plan", str(path), "--yes"], generate, analyzer=canned, say=lines.append)
        text = "\n".join(lines)
        self.assertEqual(0, code, text)
        self.assertEqual({"brd:parent-web", "prd:parent-web", "design:parent-web", "backlog:parent-web", "contract:parent-web", "integration"}, set(canned.labels()))
        self.assertIn("Owner decision recorded by hand.", brd.read_text(encoding="utf-8"))
        proposed = brd.with_name("Parent_Web_BRD.proposed.md")
        self.assertTrue(proposed.is_file(), text)
        self.assertNotIn("Owner decision recorded by hand.", proposed.read_text(encoding="utf-8"))
        self.assertIn("your file is kept and the new text is in", text)
        self.assertIn("Parent_Web_BRD.proposed.md", text)
        self.assertEqual("Parents also see a yearly statement.", next(m for m in load_plan(self.system / PLAN_FILE, load_catalog()).to_dict()["modules"] if m["id"] == "parent-web")["why"])
        self.assertIn("tasks.py check: OK", text)
        again, lines = Canned(), []
        run_update(["--target", str(self.system), "--plan", str(path), "--yes", "--allow-dirty"], generate, analyzer=again, say=lines.append)
        self.assertEqual([], again.labels())   # nothing changed, nothing is called

    def test_a_removed_sdk_redoes_only_the_documents_that_read_the_sdk_list(self):
        plan = load_plan(self.system / PLAN_FILE, load_catalog()).to_dict()
        plan["sdks"] = [s for s in plan["sdks"] if s["id"] != "sms"]
        path = self.root / "fewer.json"
        path.write_text(json.dumps(plan), encoding="utf-8")
        canned, lines = Canned(), []
        code = run_update(["--target", str(self.system), "--plan", str(path), "--yes"], generate, analyzer=canned, say=lines.append)
        self.assertEqual(0, code, "\n".join(lines))
        self.assertEqual({"domain", "brd:server-core", "brd:staff-admin", "brd:parent-web", "integration"}, set(canned.labels()))
