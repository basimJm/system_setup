#!/usr/bin/env python3
"""SessionStart: branch, the live system map (scripts/map.py) and open task blocks. Small on purpose."""
import os
import re
import subprocess
import sys
from _common import current_branch, read_input, read_sessions, project_dir, PROTECTED_BRANCHES

MAP_TIMEOUT_SECONDS = 10
OPEN_TASK_RE = r"(?m)^###\s+(\S+[^\n]*)\n(?:(?!^###).*\n)*?- Status:\s*(TODO|IN PROGRESS|BLOCKED)"
TITLE_WIDTH = 70


def system_map(cwd):
    """The picture comes from the real state; a failure here must never block a session."""
    script = os.path.join(project_dir(), "scripts", "map.py")
    try:
        done = subprocess.run([sys.executable, script, "--cwd", cwd], cwd=project_dir(),
                              capture_output=True, text=True, timeout=MAP_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return ""
    return done.stdout.strip() if done.returncode == 0 else ""


def build(branch, map_text, sessions):
    lines = [f"__SYSTEM_NAME__ session. Branch: {branch}. Hard rules are in CLAUDE.md. "
             "The map below is live: do not read files to get the picture; details: `python3 scripts/recall.py <words>`."]
    if branch in PROTECTED_BRANCHES:
        lines.append("You are on a protected branch: create the task branch from the project's master before editing.")
    if map_text:
        lines.append(map_text)
    open_tasks = re.findall(OPEN_TASK_RE, sessions)
    if open_tasks:
        lines.append("Open task blocks: " + "; ".join(f"{t[:TITLE_WIDTH]} [{s}]" for t, s in open_tasks))
    return "\n".join(lines)


def main():
    data = read_input()
    cwd = data.get("cwd") or os.getcwd()
    print(build(current_branch() or "unknown", system_map(cwd), read_sessions()))


if __name__ == "__main__":
    main()
