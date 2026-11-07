#!/usr/bin/env python3
"""Backlog tool: query and update task tables without reading whole backlog files.

Usage (run from anywhere inside the repo):
  tasks.py next <project> [--all]      first TODO task whose dependencies are DONE (--all: every ready task)
  tasks.py show <ID>                   one task row with its dependencies and dependents
  tasks.py set <ID> <STATUS> [--note T]  change a status; DONE unblocks dependents, then rebuilds the board
  tasks.py board                       cross-project board (also written into INTEGRATION.md)
  tasks.py blocked                     every BLOCKED/PENDING task with what it waits for
  tasks.py check                       validate ids, statuses and dependency consistency (exit 1 on problems)
Projects, prefixes, paths and statuses come from .claude/projects.json (nothing is hardcoded here).
"""
from __future__ import annotations

import datetime as _dt
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REGISTRY_REL = Path(".claude") / "projects.json"
BOARD_START, BOARD_END = "<!-- BOARD:START -->", "<!-- BOARD:END -->"
HEADER_PREFIX = "| ID |"
DEP_HEADERS = ("needs", "server", "depends", "blocked by")
EMPTY_CELLS = {"", "-", "—", "–", "none", "n/a"}
CHARS_PER_TOKEN = 4


def repo_root(start: Path | None = None) -> Path:
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / REGISTRY_REL).is_file():
            return candidate
    sys.exit(f"registry not found: {REGISTRY_REL} (run inside the workspace repo)")


@dataclass
class Task:
    id: str
    project: str
    title: str
    branch: str
    status: str
    notes: str
    deps: list[str]
    file: Path
    line_no: int
    status_col: int
    notes_col: int
    cells: list[str] = field(default_factory=list)


class Backlogs:
    def __init__(self, root: Path):
        self.root = root
        self.registry = json.loads((root / REGISTRY_REL).read_text(encoding="utf-8"))
        self.projects: dict = self.registry["projects"]
        self.statuses: list[str] = self.registry["statuses"]
        prefixes = "|".join(re.escape(p["prefix"]) for p in self.projects.values())
        self.id_re = re.compile(rf"\b(?:{prefixes})-\d{{3}}[a-z]?\b")
        self.prefix_to_project = {p["prefix"]: name for name, p in self.projects.items()}
        self.tasks: dict[str, Task] = {}
        self.duplicates: list[str] = []
        for name, project in self.projects.items():
            path = root / project["backlog"]
            if path.is_file():
                self._parse(name, path)

    # ---- parsing -------------------------------------------------------
    @staticmethod
    def _cells(line: str) -> list[str]:
        """Split a table row on `|`, ignoring pipes inside backticks (e.g. `fake|real`)."""
        cells, current, in_code = [], [], False
        for ch in line.strip().strip("|") + "|":
            if ch == "`":
                in_code = not in_code
            if ch == "|" and not in_code:
                cells.append("".join(current).strip())
                current = []
            else:
                current.append(ch)
        return cells

    def _parse(self, project: str, path: Path) -> None:
        columns: list[str] | None = None
        for idx, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if line.startswith(HEADER_PREFIX):
                columns = [c.lower() for c in self._cells(line)]
                continue
            if not line.startswith("|") or columns is None or set(line.strip()) <= {"|", "-", " ", ":"}:
                continue
            cells = self._cells(line)
            if len(cells) != len(columns) or "status" not in columns:
                continue
            task_id = cells[0].strip("`* ")
            if not self.id_re.fullmatch(task_id):
                continue
            if task_id in self.tasks:
                self.duplicates.append(f"{task_id} appears twice ({self.tasks[task_id].file.name}:{self.tasks[task_id].line_no} and {path.name}:{idx})")
                continue
            status_col = columns.index("status")
            notes_col = next((i for i, c in enumerate(columns) if c.startswith(("notes", "pending", "sources"))), len(columns) - 1)
            deps = sorted({d for i, c in enumerate(columns) if c.startswith(DEP_HEADERS) for d in self.id_re.findall(cells[i]) if d != task_id})
            self.tasks[task_id] = Task(
                id=task_id, project=project, title=cells[1] if len(cells) > 1 else "",
                branch=cells[2].strip("`") if len(cells) > 2 and "branch" in columns[2] else "",
                status=cells[status_col].upper(), notes=cells[notes_col], deps=deps,
                file=path, line_no=idx, status_col=status_col, notes_col=notes_col, cells=cells,
            )

    # ---- queries -------------------------------------------------------
    def dependents(self, task_id: str) -> list[Task]:
        return [t for t in self.tasks.values() if task_id in t.deps]

    def unfinished_deps(self, task: Task) -> list[str]:
        return [d for d in task.deps if self.tasks.get(d) is None or self.tasks[d].status != "DONE"]

    def ready(self, project: str) -> list[Task]:
        return [t for t in self.tasks.values() if t.project == project and t.status == "TODO" and not self.unfinished_deps(t)]

    def project_of(self, task_id: str) -> str:
        return self.prefix_to_project.get(task_id.split("-")[0], "?")

    # ---- mutations -----------------------------------------------------
    def set_status(self, task_id: str, status: str, note: str | None = None) -> list[str]:
        status = status.upper()
        if status not in self.statuses:
            sys.exit(f"unknown status {status!r}; allowed: {', '.join(self.statuses)}")
        task = self.tasks.get(task_id) or sys.exit(f"unknown task {task_id}")
        changes = [self._rewrite(task, status, note)]
        if status == "DONE":
            for dep in self.dependents(task_id):
                if dep.status == "BLOCKED" and not self.unfinished_deps(dep):
                    changes.append(self._rewrite(dep, "TODO", f"unblocked by {task_id} on {_dt.date.today().isoformat()}"))
        return changes

    def _rewrite(self, task: Task, status: str, note: str | None) -> str:
        lines = task.file.read_text(encoding="utf-8").splitlines()
        cells = self._cells(lines[task.line_no - 1])
        old = cells[task.status_col]
        cells[task.status_col] = status
        if note:
            cells[task.notes_col] = (cells[task.notes_col] + " " if cells[task.notes_col] not in EMPTY_CELLS else "") + note
        lines[task.line_no - 1] = "| " + " | ".join(cells) + " |"
        task.file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        task.status, task.cells = status, cells
        return f"{task.id}: {old} -> {status} ({task.file.relative_to(self.root)})"

    # ---- reports -------------------------------------------------------
    def board(self) -> str:
        today = _dt.date.today().isoformat()
        out = [f"_Generated by `scripts/tasks.py board` on {today}. Do not edit by hand._", "",
               "| Project | Master branch | " + " | ".join(self.statuses) + " | Next ready task |", "|---|---|" + "---|" * (len(self.statuses) + 1)]
        for name, project in self.projects.items():
            tasks = [t for t in self.tasks.values() if t.project == name]
            counts = [str(sum(1 for t in tasks if t.status == s)) for s in self.statuses]
            ready = self.ready(name)
            nxt = f"{ready[0].id} {ready[0].title[:60]}" if ready else ("backlog missing" if not tasks else "none ready")
            out.append(f"| {project['title']} | `{project['master']}` | " + " | ".join(counts) + f" | {nxt} |")
        out += ["", "### Cross-project dependencies (task → waits for)", "", "| Task | Project | Status | Waits for | Status of blocker |", "|---|---|---|---|---|"]
        rows = [(t, d) for t in sorted(self.tasks.values(), key=lambda x: x.id) for d in t.deps if self.project_of(d) != t.project and t.status != "DONE"]
        for t, d in rows:
            blocker = self.tasks.get(d)
            out.append(f"| {t.id} | {t.project} | {t.status} | {d} ({self.project_of(d)}) | {blocker.status if blocker else 'MISSING'} |")
        if not rows:
            out.append("| — | — | — | — | — |")
        out += ["", "### Waiting on the owner (PENDING)", ""]
        pending = [t for t in sorted(self.tasks.values(), key=lambda x: x.id) if t.status == "PENDING"]
        out += [f"- **{t.id}** ({t.project}) {t.title[:70]} — {t.notes[:120]}" for t in pending] or ["- none"]
        return "\n".join(out)

    def write_board(self) -> Path:
        path = self.root / self.registry["board_file"]
        text = path.read_text(encoding="utf-8") if path.is_file() else f"# Board\n\n{BOARD_START}\n{BOARD_END}\n"
        if BOARD_START not in text or BOARD_END not in text:
            sys.exit(f"{path.name} lacks the {BOARD_START} / {BOARD_END} markers")
        head, rest = text.split(BOARD_START, 1)
        _, tail = rest.split(BOARD_END, 1)
        path.write_text(f"{head}{BOARD_START}\n{self.board()}\n{BOARD_END}{tail}", encoding="utf-8")
        return path

    def context_budget_problems(self) -> list[str]:
        """Files loaded into every session must stay small; about four characters per token."""
        budgets = self.registry.get("context_budgets", {})
        checks = [(self.root / rel, rel, limit) for rel, limit in budgets.get("root", {}).items()]
        for project in self.projects.values():
            for rel, limit in budgets.get("per_project", {}).items():
                checks.append((self.root / project["dir"] / rel, f"{project['dir']}/{rel}", limit))
        problems = []
        for path, rel, limit in checks:
            if path.is_file():
                tokens = len(path.read_text(encoding="utf-8")) // CHARS_PER_TOKEN
                if tokens > limit:
                    problems.append(f"{rel}: ~{tokens} tokens, budget {limit} (move details to docs/knowledge/)")
        return problems

    def check(self) -> list[str]:
        problems = list(self.duplicates) + self.context_budget_problems()
        for name, project in self.projects.items():
            if not (self.root / project["backlog"]).is_file():
                problems.append(f"{name}: backlog file missing ({project['backlog']})")
        for t in self.tasks.values():
            if t.status not in self.statuses:
                problems.append(f"{t.id}: unknown status {t.status!r}")
            for d in t.deps:
                if d not in self.tasks:
                    problems.append(f"{t.id}: depends on unknown task {d}")
            if t.status == "BLOCKED" and not self.unfinished_deps(t):
                problems.append(f"{t.id}: BLOCKED but every dependency is DONE (run: tasks.py set {t.id} TODO)")
            if t.status == "TODO" and self.unfinished_deps(t) and any(self.project_of(d) != t.project for d in self.unfinished_deps(t)):
                problems.append(f"{t.id}: TODO but waits on another project: {', '.join(self.unfinished_deps(t))} (should be BLOCKED)")
            if t.status == "PENDING" and t.notes in EMPTY_CELLS:
                problems.append(f"{t.id}: PENDING without a note saying what the owner must provide")
        return problems


def _fmt(b: Backlogs, t: Task) -> str:
    project = b.projects[t.project]
    deps = ", ".join(f"{d}[{b.tasks[d].status if d in b.tasks else 'MISSING'}]" for d in t.deps) or "none"
    dependents = ", ".join(x.id for x in b.dependents(t.id)) or "none"
    return "\n".join([
        f"{t.id}  [{t.status}]  {t.title}", f"  project: {t.project}  master branch: {project['master']}  task branch: {t.branch or '(see backlog)'}",
        f"  needs: {deps}", f"  unblocks: {dependents}", f"  notes: {t.notes}",
        f"  backlog: {t.file.relative_to(b.root)}:{t.line_no}   session: {project['session']}   integration: {project['integration']}",
    ])


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] in {"-h", "--help"}:
        print(__doc__.strip())
        return 0
    b = Backlogs(repo_root())
    cmd, args = argv[1], argv[2:]
    if cmd == "next":
        project = args[0] if args else sys.exit("usage: tasks.py next <project> [--all]")
        if project not in b.projects:
            sys.exit(f"unknown project {project!r}; known: {', '.join(b.projects)}")
        ready = b.ready(project)
        if not ready:
            print(f"{project}: no TODO task is ready (run `tasks.py blocked` to see why)")
            return 0
        print("\n\n".join(_fmt(b, t) for t in (ready if "--all" in args else ready[:1])))
    elif cmd == "show":
        print(_fmt(b, b.tasks.get(args[0]) or sys.exit(f"unknown task {args[0]}")))
    elif cmd == "set":
        note = args[args.index("--note") + 1] if "--note" in args else None
        print("\n".join(b.set_status(args[0], args[1], note)))
        print(f"board written: {b.write_board().relative_to(b.root)}")
    elif cmd == "board":
        print(b.board())
        b.write_board()
    elif cmd == "blocked":
        for t in sorted(b.tasks.values(), key=lambda x: x.id):
            if t.status in {"BLOCKED", "PENDING"}:
                print(f"{t.id} [{t.status}] waits for: {', '.join(b.unfinished_deps(t)) or 'owner input'} — {t.notes[:100]}")
    elif cmd == "check":
        problems = b.check()
        print("\n".join(problems) if problems else f"OK: {len(b.tasks)} tasks across {len(b.projects)} projects")
        return 1 if problems else 0
    else:
        sys.exit(f"unknown command {cmd!r}; see --help")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
