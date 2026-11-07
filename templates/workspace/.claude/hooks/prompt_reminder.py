#!/usr/bin/env python3
"""UserPromptSubmit: one-line reminder injected into every request. A rule the plan turned off (.claude/projects.json) is left out."""
from _common import rule_on

REMINDERS = (
    ("map-first", "minimal tokens"),
    ("acceptance-criteria", "acceptance criteria first"),
    ("branch-per-task", "task branch from the project master"),
    ("tests-with-code", "unit tests"),
    ("no-hardcoded", "no hardcoded values"),
    ("verify-loop", "one verification loop (Loops: 1/1)"),
    ("four-role-review", "4-role review"),
    ("keep-session-memory", "update the project's .claude/session.md & memory.md"),
    ("status-through-tool", "backlog via scripts/tasks.py"),
)


def reminder(rules=None):
    return "Reminder: " + "; ".join(text for rule, text in REMINDERS if rule_on(rule, rules)) + "."


if __name__ == "__main__":
    print(reminder())
