#!/usr/bin/env python3
"""Tests for `templates/workspace` (the monorepo-root layer of SYSTEM_SETUP).

Run: python3 -m unittest discover -s .claude/tools/SYSTEM_SETUP/tests -p 'test_*.py'

The test plays the role of the core engine: it copies the template, replaces every placeholder from
TEMPLATE.json with fake values (a two-project registry), writes a minimal backlog per project and then runs
the template's `post_generate` commands (`tasks.py check`, the hook tests, the tasks tests) inside the
generated workspace. It also guards the template itself: every placeholder is declared, nothing WAB-specific
leaked in, and the bundled skills carry their license.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOL_DIR = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = TOOL_DIR / "templates" / "workspace"
KNOWLEDGE_DIR = TOOL_DIR / "knowledge"
TEXT_SUFFIXES = {".md", ".json", ".py", ".txt", ".gitignore", ""}
PLACEHOLDER_RE = re.compile(r"__[A-Z][A-Z0-9_]*__")
# Facts that belong to the system the template was learned from and must never reach a new system.
LEAK_RE = re.compile(
    r"WAB|wab-|Render|onrender|HyperPay|ARQAM|Amman|JOD|salon|Salon|basim|\+962|wab-dev|wab-prod",
)

FAKE_PROJECTS = {
    "server": {"title": "Backend API", "prefix": "SRV", "dir": "Acme-Server", "master": "server",
               "backlog": "Acme-Server/docs/Acme_Server_Tasks.md", "session": "Acme-Server/.claude/session.md",
               "memory": "Acme-Server/.claude/memory.md", "integration": "Acme-Server/.claude/Integration.md"},
    "admin": {"title": "Admin panel", "prefix": "ADM", "dir": "Acme-Admin", "master": "admin",
              "backlog": "Acme-Admin/docs/Acme_Admin_Tasks.md", "session": "Acme-Admin/.claude/session.md",
              "memory": "Acme-Admin/.claude/memory.md", "integration": "Acme-Admin/.claude/Integration.md"},
    "app": {"title": "Customer app", "prefix": "APP", "dir": "Acme-App", "master": "app",
            "backlog": "Acme-App/docs/Acme_App_Tasks.md", "session": "Acme-App/.claude/session.md",
            "memory": "Acme-App/.claude/memory.md", "integration": "Acme-App/.claude/Integration.md"},
}
FAKE_VALUES = {
    "__SYSTEM_NAME__": "Acme",
    "__SYSTEM_NAME_AR__": "أكمي",
    "__SYSTEM_SLUG__": "acme",
    "__SYSTEM_PREFIX__": "T",
    "__SERVER_DIR__": "Acme-Server",
    "__ADMIN_DIR__": "Acme-Admin",
    "__APPS_TABLE__": "| `Acme-App/` | Customer app (KMP) | scaffold |",
    "__SDKS_TABLE__": "| `acme-otp/` | SDK: one-time codes (ports + adapters) | backlog only |",
    "__PROJECTS_JSON__": json.dumps(FAKE_PROJECTS, indent=2, ensure_ascii=False),
    "__MASTERS_LIST__": "`server`, `admin`, `app`",
    "__OWNER_GITHUB__": "acme-org",
    "__REPO_NAME__": "acme-system",
    "__DATE__": "2026-01-01",
    "__BUSINESS_SUMMARY__": "Customers order from shops.\nShops fulfil and get paid monthly.",
    "__DEFAULT_LANGUAGE__": "ar",
    "__RTL__": "on",
    "__CURRENCY__": "USD",
    "__CURRENCY_MINOR_UNIT__": "cent, 2 decimals",
    "__STORED_TIME_ZONE__": "UTC",
    "__BUSINESS_TIME_ZONE__": "Europe/Paris",
    "__BUSINESS_ACTORS__": "- Customer: orders\n- Shop owner: fulfils",
    "__BUSINESS_RULES__": "1. One order per slot\n2. Refund on shop cancel",
    "__BUSINESS_ENTITIES__": "- Order: PENDING -> PAID -> DONE",
    "__BUSINESS_JOBS__": "- Reminder 1 h before",
    "__BUSINESS_INTEGRATIONS__": "- payments: decide later",
    "__OPEN_DECISIONS__": "- Payment gateway",
}
BACKLOG = """# {title} — Task Backlog

| ID | Title | Branch | Needs | Status | Notes |
|---|---|---|---|---|---|
| {p}-001 | Scaffold | `feat/{lp}-001-scaffold` | — | DONE | project `CLAUDE.md` §1 |
| {p}-002 | Config loader | `feat/{lp}-002-config` | {p}-001 | TODO | no ops |
| {p}-003 | Hosting | `feat/{lp}-003-hosting` | — | PENDING | **owner input**: hosting product |
"""


def is_text(path: Path) -> bool:
    return path.suffix in TEXT_SUFFIXES or path.name == ".gitignore"


def template_text_files():
    for path in TEMPLATE_DIR.rglob("*"):
        if path.is_file() and ".claude/skills" not in path.as_posix() and is_text(path):
            yield path


def instantiate(target: Path) -> None:
    """What the core engine does for `kind: workspace`: copy, substitute, keep binaries as-is."""
    shutil.copytree(TEMPLATE_DIR, target, dirs_exist_ok=True)
    (target / "TEMPLATE.json").unlink()
    for path in target.rglob("*"):
        if not path.is_file() or ".claude/skills" in path.as_posix() or not is_text(path):
            continue
        text = path.read_text(encoding="utf-8")
        for key, value in FAKE_VALUES.items():
            text = text.replace(key, value)
        path.write_text(text, encoding="utf-8")
    for key, project in FAKE_PROJECTS.items():
        backlog = target / project["backlog"]
        backlog.parent.mkdir(parents=True, exist_ok=True)
        backlog.write_text(BACKLOG.format(title=project["title"], p=project["prefix"], lp=project["prefix"].lower()),
                           encoding="utf-8")
        session = target / project["session"]
        session.parent.mkdir(parents=True, exist_ok=True)
        session.write_text(f"# {project['title']} — Session\n", encoding="utf-8")


def run(target: Path, command: str) -> subprocess.CompletedProcess:
    argv = command.split()
    if argv and argv[0] == "python3":
        argv[0] = sys.executable
    return subprocess.run(argv, cwd=target, capture_output=True, text=True, timeout=300)


class TemplateContract(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((TEMPLATE_DIR / "TEMPLATE.json").read_text(encoding="utf-8"))

    def test_manifest_shape(self):
        self.assertEqual(self.manifest["kind"], "workspace")
        self.assertEqual(set(self.manifest["placeholders"]), set(FAKE_VALUES))
        self.assertEqual(set(self.manifest["placeholder_notes"]), set(FAKE_VALUES))
        self.assertEqual(self.manifest["post_generate"], [
            "python3 scripts/tasks.py check",
            "python3 .claude/hooks/test_hooks.py",
            "python3 -m unittest scripts/test_tasks.py",
        ])

    def test_every_placeholder_in_files_is_declared_and_every_declared_one_is_used(self):
        used = set()
        for path in template_text_files():
            if path.name == "TEMPLATE.json":
                continue
            used.update(PLACEHOLDER_RE.findall(path.read_text(encoding="utf-8")))
        declared = set(self.manifest["placeholders"])
        self.assertEqual(used - declared, set(), "undeclared placeholders in the template")
        self.assertEqual(declared - used, set(), "declared placeholders no file uses")

    def test_required_files_exist(self):
        for rel in ("CLAUDE.md", "README.md", "INTEGRATION.md", "BUSINESS_DOMAIN.md", ".gitignore",
                    ".claude/rules.md", ".claude/roles.md", ".claude/hooks.md", ".claude/session.md",
                    ".claude/memory.md", ".claude/settings.json", ".claude/projects.json",
                    ".claude/hooks/_common.py", ".claude/hooks/guard_git.py", ".claude/hooks/stop_review.py",
                    ".claude/hooks/check_hardcoded.py", ".claude/hooks/session_start.py",
                    ".claude/hooks/prompt_reminder.py", ".claude/hooks/test_hooks.py",
                    "scripts/tasks.py", "scripts/test_tasks.py",
                    "docs/README.md", "docs/templates/TASKS_TEMPLATE.md", "docs/templates/PRD_TEMPLATE.md",
                    "docs/templates/BRD_TEMPLATE.md", "docs/templates/PROJECT_CLAUDE_TEMPLATE.md",
                    "docs/templates/PROJECT_SESSION_TEMPLATE.md", "docs/templates/PROJECT_MEMORY_TEMPLATE.md",
                    "docs/templates/PROJECT_INTEGRATION_TEMPLATE.md",
                    ".claude/skills/ANDROID_SKILLS_LICENSE", ".claude/skills/android-profiler/SKILL.md",
                    ".claude/skills/anr-audit-and-fix/SKILL.md", ".claude/skills/jetpack-compose-performance/SKILL.md",
                    ".claude/skills/r8-analyzer/SKILL.md"):
            self.assertTrue((TEMPLATE_DIR / rel).is_file(), rel)

    def test_settings_json_holds_hooks_only_and_wires_every_script(self):
        settings = json.loads((TEMPLATE_DIR / ".claude" / "settings.json").read_text(encoding="utf-8"))
        self.assertEqual(list(settings), ["hooks"])
        wired = json.dumps(settings)
        for script in ("session_start.py", "prompt_reminder.py", "guard_git.py", "check_hardcoded.py", "stop_review.py"):
            self.assertIn(script, wired)

    def test_scripts_are_unchanged_copies_of_the_live_tool_except_naming(self):
        live = TOOL_DIR.parents[2] / "scripts"
        if not (live / "tasks.py").is_file():
            self.skipTest("live scripts/ not available")
        self.assertEqual((live / "test_tasks.py").read_bytes(), (TEMPLATE_DIR / "scripts" / "test_tasks.py").read_bytes())
        live_lines = (live / "tasks.py").read_text(encoding="utf-8").splitlines()
        tpl_lines = (TEMPLATE_DIR / "scripts" / "tasks.py").read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(live_lines), len(tpl_lines))
        differing = [(a, b) for a, b in zip(live_lines, tpl_lines) if a != b]
        self.assertLessEqual(len(differing), 3, differing)
        for live_line, _ in differing:
            self.assertIn("WAB", live_line, "only the source-system naming may differ")

    def test_no_source_system_facts_leak(self):
        for path in list(template_text_files()) + sorted(KNOWLEDGE_DIR.glob("*.md")):
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                self.assertIsNone(LEAK_RE.search(line), f"{path.relative_to(TOOL_DIR)}:{n}: {line[:120]}")

    def test_knowledge_files_exist_with_required_groups(self):
        lessons = (KNOWLEDGE_DIR / "LESSONS.md").read_text(encoding="utf-8")
        for group in ("Workflow", "Git", "Parallel agents", "Server", "Admin", "KMP Android", "KMP iOS", "SDKs",
                      "QA", "Hosting", "Owner decisions"):
            self.assertRegex(lessons, rf"(?m)^## .*{group}", group)
        playbooks = (KNOWLEDGE_DIR / "PLAYBOOKS.md").read_text(encoding="utf-8")
        for play in ("Start a task", "Ship a task", "Batch-verify five", "Sync masters", "Local QA stack",
                     "end-to-end pass", "Device integrations", "Performance pass", "contract field",
                     "Adding a project"):
            self.assertRegex(playbooks, rf"(?mi)^## .*{play}", play)


class GeneratedWorkspace(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.target = Path(cls.tmp.name) / "acme-system"
        instantiate(cls.target)
        subprocess.run(["git", "init", "-q", str(cls.target)], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_no_placeholder_left(self):
        for path in self.target.rglob("*"):
            if path.is_file() and ".claude/skills" not in path.as_posix() and is_text(path):
                self.assertEqual(PLACEHOLDER_RE.findall(path.read_text(encoding="utf-8")), [], str(path))

    def test_projects_json_is_valid_and_lists_the_projects(self):
        registry = json.loads((self.target / ".claude" / "projects.json").read_text(encoding="utf-8"))
        self.assertEqual(set(registry["projects"]), set(FAKE_PROJECTS))
        self.assertIn("BLOCKED", registry["statuses"])

    def test_post_generate_commands_pass(self):
        manifest = json.loads((TEMPLATE_DIR / "TEMPLATE.json").read_text(encoding="utf-8"))
        for command in manifest["post_generate"]:
            result = run(self.target, command)
            self.assertEqual(result.returncode, 0, f"{command}\n{result.stdout}\n{result.stderr}")

    def test_board_and_next_and_status_propagation(self):
        self.assertEqual(run(self.target, "python3 scripts/tasks.py board").returncode, 0)
        board = (self.target / "INTEGRATION.md").read_text(encoding="utf-8")
        self.assertIn("<!-- BOARD:START -->", board)
        self.assertIn("SRV", board)
        nxt = run(self.target, "python3 scripts/tasks.py next server")
        self.assertEqual(nxt.returncode, 0, nxt.stderr)
        self.assertIn("SRV-002", nxt.stdout)
        blocked = run(self.target, "python3 scripts/tasks.py blocked")
        self.assertIn("SRV-003", blocked.stdout)

    def test_hooks_read_masters_from_the_registry(self):
        code = ("import sys; sys.path.insert(0, '.claude/hooks'); import _common; "
                "print(sorted(_common.master_branches()))")
        result = subprocess.run([sys.executable, "-c", code], cwd=self.target, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        for master in ("main", "master", "server", "admin", "app"):
            self.assertIn(f"'{master}'", result.stdout)


if __name__ == "__main__":
    unittest.main()
