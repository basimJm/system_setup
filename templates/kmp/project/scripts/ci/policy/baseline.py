"""Ratchet: known legacy violations may not grow, and the allowance must shrink as they are fixed."""
import json
from collections import Counter
from pathlib import Path
from .model import Violation

Table = dict[str, dict[str, int]]


def counts(violations: list[Violation]) -> Table:
    table: dict[str, Counter] = {}
    for violation in violations:
        table.setdefault(violation.path, Counter())[violation.rule] += 1
    return {path: dict(sorted(rules.items())) for path, rules in sorted(table.items())}


def load(path: Path) -> Table:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def select(table: Table, prefixes: tuple[str, ...], owned: bool = True) -> Table:
    """Entries whose rule starts (owned) or does not start (not owned) with one of the prefixes."""
    picked = {path: {r: n for r, n in rules.items() if r.startswith(prefixes) == owned} for path, rules in table.items()}
    return {path: rules for path, rules in picked.items() if rules}


def apply(violations: list[Violation], stored: Table, prefixes: tuple[str, ...]) -> list[str]:
    """Failure messages: violations beyond the baseline, and baseline entries that are now too generous."""
    actual = counts(violations)
    allowed = select(stored, prefixes)
    failures: list[str] = []
    for violation in violations:
        limit = allowed.get(violation.path, {}).get(violation.rule, 0)
        if actual[violation.path][violation.rule] > limit:
            failures.append(f"{violation}" + (f"  (baseline allows {limit})" if limit else ""))
    for path, rules in allowed.items():
        for rule, limit in rules.items():
            remaining = actual.get(path, {}).get(rule, 0)
            if remaining < limit:
                failures.append(f"{path}: [{rule}] baseline allows {limit} but {remaining} remain; run --update-baseline to lower it")
    return failures


def update(path: Path, violations: list[Violation], prefixes: tuple[str, ...]) -> None:
    merged = select(load(path), prefixes, owned=False)
    for file_path, rules in counts(violations).items():
        merged.setdefault(file_path, {}).update(rules)
    path.write_text(json.dumps(dict(sorted(merged.items())), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
