"""Config loading, glob matching and source file discovery."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterator


class Config:
    def __init__(self, data: dict, root: Path):
        self.data = data
        self.root = root

    @classmethod
    def load(cls, path: Path, root: Path) -> "Config":
        return cls(json.loads(path.read_text(encoding="utf-8")), root)

    def section(self, name: str) -> dict:
        return self.data[name]


@lru_cache(maxsize=None)
def _glob_regex(glob: str) -> "re.Pattern[str]":
    out, i = [], 0
    while i < len(glob):
        if glob.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif glob.startswith("**", i):
            out.append(".*")
            i += 2
        elif glob[i] == "*":
            out.append("[^/]*")
            i += 1
        elif glob[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(glob[i]))
            i += 1
    return re.compile("".join(out) + r"\Z")


def matches_any(rel_path: str, globs: list[str]) -> bool:
    return any(_glob_regex(g).match(rel_path) for g in globs)


def iter_files(config: Config, extensions: "set[str] | None") -> Iterator[Path]:
    """Yield files under the configured scan roots (any file when `extensions` is None), skipping excluded directories."""
    excluded = set(config.data["excludeDirs"])
    for scan_root in config.data["scanRoots"]:
        base = config.root / scan_root
        if base.is_file():
            if extensions is None or base.suffix in extensions:
                yield base
            continue
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            rel_parts = path.relative_to(config.root).parts
            if any(part in excluded for part in rel_parts[:-1]):
                continue
            if path.is_file() and (extensions is None or path.suffix in extensions):
                yield path


def rel(config: Config, path: Path) -> str:
    return path.relative_to(config.root).as_posix()
