#!/usr/bin/env python3
"""Find a detail without loading a document: the best matching lines, as `path:line: text`.

    python3 scripts/recall.py <word> [<word> ...]

Lines holding every word rank first, then headings, then the files that are made for this
(knowledge and rules before long requirement documents). The git log fills in when few lines match.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tasks import repo_root  # noqa: E402

# Earlier patterns win ties: durable facts before long documents, backlogs last.
SOURCE_PATTERNS = (
    "docs/knowledge/*.md",
    "*/docs/knowledge/*.md",
    "BUSINESS_DOMAIN.md",
    "INTEGRATION.md",
    "*/docs/ENGINEERING_RULES.md",
    "*/.claude/memory.md",
    "*/.claude/Integration.md",
    ".claude/*.md",
    "*/docs/*.md",
    "*/README.md",
)
MAX_RESULTS = 20
SNIPPET_WIDTH = 180
SNIPPET_LEAD = 40
GIT_FILL_BELOW = 5
GIT_RESULTS = 5
GIT_TIMEOUT_SECONDS = 5
HEADING_BONUS = 1


def source_files(root: Path) -> list[tuple[int, Path]]:
    seen: dict[Path, int] = {}
    for rank, pattern in enumerate(SOURCE_PATTERNS):
        for path in sorted(root.glob(pattern)):
            seen.setdefault(path, rank)
    return [(rank, path) for path, rank in seen.items()]


def snippet(line: str, words: list[str]) -> str:
    line = line.strip()
    if len(line) <= SNIPPET_WIDTH:
        return line
    lower = line.lower()
    first = min((lower.find(w) for w in words if w in lower), default=0)
    start = max(0, first - SNIPPET_LEAD)
    text = line[start:start + SNIPPET_WIDTH]
    return ("…" if start else "") + text + ("…" if start + SNIPPET_WIDTH < len(line) else "")


def search(root: Path, words: list[str]) -> list[str]:
    words = [w.lower() for w in words]
    hits = []
    for rank, path in source_files(root):
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for number, line in enumerate(lines, start=1):
            lower = line.lower()
            matched = sum(1 for w in words if w in lower)
            if matched:
                score = matched * 2 + (HEADING_BONUS if line.startswith("#") else 0)
                rel = path.relative_to(root)
                hits.append((-score, rank, str(rel), number, f"{rel}:{number}: {snippet(line, words)}"))
    hits.sort(key=lambda h: h[:4])
    return [hit[4] for hit in hits[:MAX_RESULTS]]


def git_log(root: Path, words: list[str]) -> list[str]:
    args = ["git", "log", f"-{GIT_RESULTS}", "--no-merges", "--all-match", "-i", "--format=%h %ad %s", "--date=short"]
    args += [f"--grep={re.escape(w)}" for w in words]
    try:
        done = subprocess.run(args, cwd=root, capture_output=True, text=True, timeout=GIT_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return []
    return [f"git: {line}" for line in done.stdout.splitlines()] if done.returncode == 0 else []


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        sys.exit(__doc__)
    root = repo_root()
    words = argv[1:]
    results = search(root, words)
    if len(results) < GIT_FILL_BELOW:
        results += git_log(root, words)
    print("\n".join(results) if results else f"nothing found for: {' '.join(words)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
