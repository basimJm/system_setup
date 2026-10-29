#!/usr/bin/env python3
"""Fixture stand-in for the workspace tasks tool: `check` validates .claude/projects.json against the backlog files."""
import json
import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] != "check":
        print("usage: tasks.py check")
        return 2
    root = Path(__file__).resolve().parents[1]
    registry = json.loads((root / ".claude" / "projects.json").read_text(encoding="utf-8"))
    problems = []
    prefixes = set()
    for name, project in registry["projects"].items():
        for key in ("backlog", "session", "memory", "integration"):
            if not (root / project[key]).is_file():
                problems.append(f"{name}: {key} file missing ({project[key]})")
        if project["prefix"] in prefixes:
            problems.append(f"{name}: duplicate prefix {project['prefix']}")
        prefixes.add(project["prefix"])
        backlog = root / project["backlog"]
        if backlog.is_file() and not re.search(rf"^\| {re.escape(project['prefix'])}-\d{{3}} \|", backlog.read_text(encoding="utf-8"), re.M):
            problems.append(f"{name}: backlog has no {project['prefix']}-NNN row")
    for problem in problems:
        print(problem)
    print("OK" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
