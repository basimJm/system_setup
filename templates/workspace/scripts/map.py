#!/usr/bin/env python3
"""The whole system in a few hundred tokens, generated from the real state on every call.

Nothing here is written by hand and nothing is committed, so it cannot go stale or conflict. The
SessionStart hook prints it; `recall.py` finds the details it leaves out.

    python3 scripts/map.py                 # the system
    python3 scripts/map.py <project>       # one module
    python3 scripts/map.py --cwd <path>    # the system + the module that holds <path>
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tasks import Backlogs, repo_root  # noqa: E402

DOMAIN_FILE = "BUSINESS_DOMAIN.md"
CONTRACT_GLOB = "*/docs/api/openapi.*.json"
SCREEN_RE = re.compile(r"^### ((?:[A-Z]\d{2})(?: / [A-Z]\d{2})*) — (.+)$", re.M)
DOMAIN_RE = re.compile(r"^(?:## (\d+)\.|### (\d+\.\d+)) +(.+)$", re.M)
DROP_PARENS_RE = re.compile(r"\s*\([^)]*\)")
VERSION_RE = re.compile(r'"version"\s*:\s*"([^"]+)"')
OPEN_STATUSES = ("IN PROGRESS", "IN REVIEW")
READY_SHOWN = 3
RECENT_SHOWN = 3
TITLE_WIDTH = 64
VERSION_READ_BYTES = 4096
GIT_TIMEOUT_SECONDS = 5


def approx_tokens(text: str) -> int:
    """About four characters per token: close enough for a budget."""
    return len(text) // 4


def git(root: Path, *args: str) -> str:
    try:
        done = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, timeout=GIT_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return ""
    return done.stdout.strip() if done.returncode == 0 else ""


def short(text: str, width: int = TITLE_WIDTH) -> str:
    text = re.sub(r"[`*]", "", text).strip()
    return text if len(text) <= width else text[: width - 1].rstrip() + "…"


def status_counts(b: Backlogs, project: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for task in b.tasks.values():
        if task.project == project:
            counts[task.status] = counts.get(task.status, 0) + 1
    return counts


def module_line(b: Backlogs, name: str) -> str:
    project = b.projects[name]
    counts = status_counts(b, name)
    parts = [f"{counts[s]} {s.lower()}" for s in ("DONE", "TODO", *OPEN_STATUSES, "PENDING", "BLOCKED") if counts.get(s)]
    ready = b.ready(name)
    next_id = f"; next {ready[0].id}" if ready else ""
    return f"- `{name}` {project['dir']}/ (master `{project['master']}`): {', '.join(parts) or 'no tasks'}{next_id}"


def open_tasks(b: Backlogs) -> list[str]:
    return [f"- {t.id} [{t.status}] {short(t.title)}" for t in b.tasks.values() if t.status in OPEN_STATUSES]


def waiting_on_owner(b: Backlogs) -> list[str]:
    lines = []
    for name in b.projects:
        ids = [t.id for t in b.tasks.values() if t.project == name and t.status == "PENDING"]
        if ids:
            lines.append(f"{name}: {' '.join(ids)}")
    return lines


def domain_index(root: Path) -> str:
    path = root / DOMAIN_FILE
    if not path.is_file():
        return ""
    entries = []
    for chapter, section, title in DOMAIN_RE.findall(path.read_text(encoding="utf-8")):
        entries.append(f"§{chapter or section} {DROP_PARENS_RE.sub('', title).strip()}")
    return " · ".join(entries)


def contract_versions(root: Path) -> str:
    versions = []
    for path in sorted(root.glob(CONTRACT_GLOB)):
        with path.open(encoding="utf-8") as fh:
            found = VERSION_RE.search(fh.read(VERSION_READ_BYTES))
        if found:
            versions.append(f"{path.name.split('.')[1]} {found.group(1)}")
    return ", ".join(versions)


def system_map(root: Path, b: Backlogs) -> str:
    lines = ["## System map (generated now from git, backlogs, contracts)", "### Modules"]
    lines += [module_line(b, name) for name in b.projects]
    contracts = contract_versions(root)
    if contracts:
        lines.append(f"Contracts: {contracts}.")
    busy = open_tasks(b)
    if busy:
        lines += ["### In progress or in review", *busy]
    waiting = waiting_on_owner(b)
    if waiting:
        lines += ["### Waiting on the owner (`tasks.py show <ID>`)", *waiting]
    index = domain_index(root)
    if index:
        lines += [f"### Rules index ({DOMAIN_FILE})", index]
    return "\n".join(lines)


def screens(root: Path, project: dict) -> str:
    found = []
    for path in sorted((root / project["dir"] / "docs").glob("*PRD*.md")):
        found += [f"{ids} {DROP_PARENS_RE.sub('', title).strip()}" for ids, title in SCREEN_RE.findall(path.read_text(encoding="utf-8"))]
    return " · ".join(found)


def code_areas(root: Path, project: dict) -> str:
    areas = []
    for rel in project.get("code_dirs", []):
        folder = root / project["dir"] / rel
        if folder.is_dir():
            names = sorted(p.name for p in folder.iterdir() if p.is_dir() and not p.name.startswith("."))
            areas.append(f"{rel}: {' '.join(names)}")
    return "\n".join(areas)


def module_map(root: Path, b: Backlogs, name: str) -> str:
    project = b.projects[name]
    lines = [f"## Module map: {name}", module_line(b, name)]
    busy = [f"- {t.id} [{t.status}] {short(t.title)}" for t in b.tasks.values() if t.project == name and t.status in OPEN_STATUSES]
    ready = [f"- {t.id} {short(t.title)}" for t in b.ready(name)[:READY_SHOWN]]
    if busy:
        lines += ["In progress or in review:", *busy]
    if ready:
        lines += ["Ready next:", *ready]
    recent = git(root, "log", f"-{RECENT_SHOWN}", "--no-merges", "--format=%s", "--", project["dir"])
    if recent:
        lines += ["Latest work:", *[f"- {short(line)}" for line in recent.splitlines()]]
    pages = screens(root, project)
    if pages:
        lines += ["Screens (PRD):", pages]
    areas = code_areas(root, project)
    if areas:
        lines += ["Code:", areas]
    return "\n".join(lines)


def project_of_path(root: Path, b: Backlogs, path: str) -> str | None:
    try:
        rel = Path(path).resolve().relative_to(root.resolve())
    except ValueError:
        return None
    return next((name for name, project in b.projects.items() if rel.parts and rel.parts[0] == project["dir"]), None)


def main(argv: list[str]) -> int:
    root = repo_root()
    b = Backlogs(root)
    if len(argv) == 3 and argv[1] == "--cwd":
        module = project_of_path(root, b, argv[2])
        print(system_map(root, b) + (f"\n{module_map(root, b, module)}" if module else ""))
    elif len(argv) == 2:
        if argv[1] not in b.projects:
            sys.exit(f"unknown project {argv[1]!r}; one of: {', '.join(b.projects)}")
        print(module_map(root, b, argv[1]))
    elif len(argv) == 1:
        print(system_map(root, b))
    else:
        sys.exit(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
