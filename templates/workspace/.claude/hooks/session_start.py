#!/usr/bin/env python3
"""SessionStart: show branch, open tasks (all session files) and how to pick the next backlog task."""
import json
import os
import re
from _common import current_branch, read_sessions, master_branches, project_dir, REGISTRY_FILE


def project_keys():
    """Project keys from .claude/projects.json (the only place they are listed)."""
    try:
        with open(os.path.join(project_dir(), REGISTRY_FILE), encoding="utf-8") as fh:
            return list(json.load(fh).get("projects", {}))
    except (OSError, ValueError, TypeError):
        return []


def main():
    branch = current_branch() or "unknown"
    keys = ", ".join(project_keys()) or "<see .claude/projects.json>"
    lines = [
        "Session start — MANDATORY: follow .claude/rules.md, act as all roles in .claude/roles.md, "
        "run the workflow and review hook in .claude/hooks.md, keep the PROJECT .claude/session.md and memory.md updated.",
        f"Current branch: {branch}",
        "Backlog: never read a backlog file whole — run `python3 scripts/tasks.py next <project>` "
        f"(projects: {keys}) and `tasks.py set <ID> <STATUS>`.",
    ]
    if branch in master_branches():
        lines.append("You are on a master branch: create the task branch from the project's master (see INTEGRATION.md §1) before changing code.")
    text = read_sessions()
    open_tasks = re.findall(r"(?m)^###\s+(\S+[^\n]*)\n(?:(?!^###).*\n)*?- Status:\s*(TODO|IN PROGRESS|BLOCKED)", text)
    if open_tasks:
        lines.append("Open tasks: " + "; ".join(f"{t[:60]} [{s}]" for t, s in open_tasks))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
