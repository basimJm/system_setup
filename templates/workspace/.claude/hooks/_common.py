"""Shared helpers for the workspace Claude Code hooks. Standard library only."""
import json
import os
import re
import subprocess
import sys

PROTECTED_BRANCHES = ("main", "master")
SESSION_FILE = os.path.join(".claude", "session.md")
REGISTRY_FILE = os.path.join(".claude", "projects.json")
# One verification loop is the rule (owner decision); older blocks with 3/3 stay valid.
LOOPS_DONE = re.compile(r"Loops:\s*(1\s*/\s*1|3\s*/\s*3)", re.IGNORECASE)
REVIEW_DONE = re.compile(r"Review:\s*PASSED", re.IGNORECASE)
DOC_EXTENSIONS = (".md", ".txt", ".html", ".png", ".jpg", ".jpeg", ".svg", ".mp4", ".pdf", ".json", ".yml", ".yaml")
SOURCE_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".kt", ".kts", ".swift", ".py")
TEST_MARKERS = ("/test/", "/tests/", "__tests__/", "commonTest/", "androidUnitTest/", "iosTest/", "jvmTest/",
                ".test.", ".spec.", "Test.kt", "Tests.kt", "Test.swift", "test_")
IGNORED_PREFIXES = (".claude/", "docs/")


_ROOT_OVERRIDE = None


def project_dir():
    """The repository checkout the command runs in (a git worktree has its own branch and session files)."""
    return _ROOT_OVERRIDE or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def worktree_root(cwd):
    """Top-level folder of the git checkout containing `cwd`, or '' when it cannot be resolved."""
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd, capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return ""
    return out.stdout.strip() if out.returncode == 0 else ""


def read_input():
    """Parse the hook payload; its `cwd` (the Bash tool's directory) selects the checkout the rules apply to."""
    global _ROOT_OVERRIDE
    try:
        data = json.load(sys.stdin)
    except (ValueError, OSError):
        return {}
    cwd = data.get("cwd") if isinstance(data, dict) else None
    if isinstance(cwd, str) and os.path.isdir(cwd):
        _ROOT_OVERRIDE = worktree_root(cwd) or None
    return data


def git(*args):
    try:
        out = subprocess.run(["git", *args], cwd=project_dir(), capture_output=True, text=True, timeout=20)
        return out.stdout.strip() if out.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def current_branch():
    return git("rev-parse", "--abbrev-ref", "HEAD")


def changed_files():
    """Files changed on this branch vs main (committed + uncommitted + untracked)."""
    base_ref = "origin/main" if git("rev-parse", "--verify", "--quiet", "origin/main") else "main"
    base = git("merge-base", "HEAD", base_ref)
    files = set()
    if base:
        files.update(git("diff", "--name-only", base).splitlines())
    files.update(git("diff", "--name-only", "HEAD").splitlines())
    files.update(git("ls-files", "--others", "--exclude-standard").splitlines())
    return sorted(f for f in files if f)


def is_test_file(path):
    return any(marker in path for marker in TEST_MARKERS)


def is_source_file(path):
    if any(path.startswith(p) or f"/{p}" in path for p in IGNORED_PREFIXES):
        return False
    return path.endswith(SOURCE_EXTENSIONS) and not is_test_file(path)


def master_branches():
    """Branches that only receive merged PRs: main/master plus every project master in .claude/projects.json."""
    branches = set(PROTECTED_BRANCHES)
    try:
        with open(os.path.join(project_dir(), REGISTRY_FILE), encoding="utf-8") as fh:
            registry = json.load(fh)
        branches.update(p["master"] for p in registry.get("projects", {}).values() if p.get("master"))
    except (OSError, ValueError, TypeError):
        pass
    return branches


def session_files():
    """Root session.md plus every project/SDK session file listed in .claude/projects.json."""
    root = project_dir()
    paths = [os.path.join(root, SESSION_FILE)]
    try:
        with open(os.path.join(root, REGISTRY_FILE), encoding="utf-8") as fh:
            registry = json.load(fh)
        paths += [os.path.join(root, p["session"]) for p in registry.get("projects", {}).values() if p.get("session")]
    except (OSError, ValueError):
        pass
    return paths


def read_sessions():
    texts = []
    for path in session_files():
        try:
            with open(path, encoding="utf-8") as fh:
                texts.append(fh.read())
        except OSError:
            continue
    return "\n".join(texts)


def task_block(branch, session_text=None):
    """Return the task block (from any session file) that references this branch, or ''."""
    if session_text is None:
        session_text = read_sessions()
    blocks = re.split(r"(?m)^###\s+", session_text)
    for block in blocks:
        if re.search(r"Branch:\s*`?" + re.escape(branch) + r"`?\s*$", block, re.MULTILINE):
            return block
    return ""


def task_verified(block):
    return bool(LOOPS_DONE.search(block)) and bool(REVIEW_DONE.search(block))
