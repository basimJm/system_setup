#!/usr/bin/env python3
"""PostToolUse(Edit|Write|MultiEdit): flag hardcoded secrets, URLs, IPs and ports in source files."""
import os
import re
import sys
from _common import read_input, is_source_file, is_test_file, project_dir, rule_on

ALLOWED_PATH_HINTS = ("config", "constants", "env", ".example", "/test", "Test.", ".test.", ".spec.", "build.gradle", "settings.gradle", "gradle/")
PATTERNS = {
    "secret/API key": re.compile(r"(?i)(api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"),
    "private key block": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "URL": re.compile(r"['\"]https?://(?!schemas\.|www\.w3\.org)[^'\"\s]+['\"]"),
    "IP address": re.compile(r"['\"](?:\d{1,3}\.){3}\d{1,3}(?::\d+)?['\"]"),
    "localhost/port": re.compile(r"['\"](?:localhost|127\.0\.0\.1)(?::\d+)?['\"]"),
}

SECRET_KINDS = ("secret/API key", "private key block")


def findings(path, text, rules=None):
    """Secret shapes follow the `no-secrets` rule, URLs/IPs/ports the `no-hardcoded` rule (a rule the plan turned off is not checked)."""
    if not is_source_file(path) or is_test_file(path):
        return []
    names = [n for n in PATTERNS if rule_on("no-secrets" if n in SECRET_KINDS else "no-hardcoded", rules)]
    if any(hint in path for hint in ALLOWED_PATH_HINTS):
        names = [n for n in names if n in SECRET_KINDS]
    return [n for n in names if PATTERNS[n].search(text)]

def main():
    data = read_input()
    tool_input = data.get("tool_input") or {}
    path = tool_input.get("file_path", "")
    rel = os.path.relpath(path, project_dir()) if path else ""
    text = tool_input.get("content") or tool_input.get("new_string") or ""
    for edit in tool_input.get("edits") or []:
        text += "\n" + (edit.get("new_string") or "")
    found = findings(rel, text)
    if found:
        print(f"No-hardcode rule: {rel} contains possible hardcoded {', '.join(found)}. "
              "Move it to config/env, constants, localization or design tokens.", file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
