#!/usr/bin/env python3
"""Where the tokens went, from the real transcripts and line runs, against the targets in `.claude/projects.json`.

    python3 scripts/usage.py                      # loaded files, recent main sessions, sub-agents, line workers
    python3 scripts/usage.py --sessions 10        # more sessions
    python3 scripts/usage.py --feature <name>     # the workers of one line run

Cost = requests x context, so the numbers that matter are the context at the start, the average per request and the
total cache read. Reports what was measured even when a target was missed.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tasks import CHARS_PER_TOKEN, Backlogs, repo_root  # noqa: E402

CONFIG_DIR_ENV = "CLAUDE_CONFIG_DIR"
DEFAULT_CONFIG_DIR = ".claude"
SLUG_RE = re.compile(r"[^a-zA-Z0-9]")
SESSION_ID_WIDTH = 8
DEFAULT_SESSIONS = 5
MAP_TIMEOUT_SECONDS = 30
USAGE_FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


@dataclass
class Stats:
    requests: int = 0
    start_context: int = 0
    avg_context: int = 0
    max_context: int = 0
    cache_read: int = 0
    total_tokens: int = 0


def request_usage(message: dict) -> tuple[int, int, int, int]:
    """Newer transcripts can leave the top level at zero and put the numbers in `iterations`."""
    usage = message.get("usage") or {}
    top = tuple(usage.get(key) or 0 for key in USAGE_FIELDS)
    if any(top):
        return top
    rows = usage.get("iterations") or []
    return tuple(sum(row.get(key) or 0 for row in rows) for key in USAGE_FIELDS)


class Meter:
    """Feeds on transcript or stream-json lines. One request can span several lines with the same message id."""

    def __init__(self) -> None:
        self.by_request: dict[str, tuple[int, int, int, int]] = {}

    def feed(self, line: str) -> None:
        try:
            row = json.loads(line)
        except ValueError:
            return
        if not isinstance(row, dict) or row.get("type") != "assistant":
            return
        message = row.get("message") or {}
        key = message.get("id") or row.get("uuid") or str(len(self.by_request))
        numbers = request_usage(message)
        if sum(numbers) >= sum(self.by_request.get(key, (0, 0, 0, 0))):
            self.by_request[key] = numbers

    @property
    def total(self) -> int:
        return sum(sum(numbers) for numbers in self.by_request.values())

    def stats(self) -> Stats:
        contexts = [n[0] + n[1] + n[2] for n in self.by_request.values() if sum(n)]
        if not contexts:
            return Stats()
        return Stats(requests=len(contexts), start_context=contexts[0], avg_context=sum(contexts) // len(contexts),
                     max_context=max(contexts), cache_read=sum(n[2] for n in self.by_request.values()), total_tokens=self.total)


def stats_of_file(path: Path) -> Stats:
    meter = Meter()
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            meter.feed(line)
    return meter.stats()


def transcripts_dir(root: Path, env: dict | None = None) -> Path:
    env = os.environ if env is None else env
    config = Path(env[CONFIG_DIR_ENV]) if env.get(CONFIG_DIR_ENV) else Path.home() / DEFAULT_CONFIG_DIR
    return config / "projects" / SLUG_RE.sub("-", str(root))


def approx(number: int) -> str:
    if number >= 1_000_000:
        return f"{number / 1_000_000:.1f}M"
    return f"{number / 1_000:.1f}k" if number >= 1_000 else str(number)


def money(amount: float | None) -> str:
    return "cost unknown" if amount is None else f"${amount:.2f}"


def verdict(value: int, target: int) -> str:
    return f"target <= {approx(target)}: {'OK' if value <= target else 'MISSED'}"


def loaded_files_tokens(root: Path, registry: dict) -> tuple[int, int]:
    """What every session loads: the budgeted files plus the printed map. Returns the root and the largest module."""
    budgets = registry.get("context_budgets", {})
    size = lambda path: len(path.read_text(encoding="utf-8")) // CHARS_PER_TOKEN if path.is_file() else 0  # noqa: E731
    try:
        printed = subprocess.run([sys.executable, str(root / "scripts" / "map.py")], cwd=root, capture_output=True,
                                 text=True, timeout=MAP_TIMEOUT_SECONDS).stdout
    except (OSError, subprocess.SubprocessError):
        printed = ""
    base = sum(size(root / rel) for rel in budgets.get("root", {})) + len(printed) // CHARS_PER_TOKEN
    largest = max((sum(size(root / p["dir"] / rel) for rel in budgets.get("per_project", {}))
                   for p in registry["projects"].values()), default=0)
    return base, largest


def session_rows(folder: Path, limit: int) -> list[tuple[str, str, Stats]]:
    files = sorted(folder.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]
    rows = []
    for path in files:
        day = _dt.date.fromtimestamp(path.stat().st_mtime).isoformat()
        rows.append((path.stem[:SESSION_ID_WIDTH], day, stats_of_file(path)))
    return rows


def subagent_rows(folder: Path) -> list[Stats]:
    return [stats for stats in map(stats_of_file, sorted(folder.glob("*/subagents/*.jsonl"))) if stats.requests]


def worker_rows(features: Path, feature: str | None) -> list[dict]:
    """Every agent call of the line runs, flattened: one row per worker, PO, fix or docs call."""
    pattern = f"{feature}/{{}}/*.json" if feature else "*/{}/*.json"
    rows = []
    for status_file in sorted(features.glob(pattern.format("run"))):
        try:
            status = json.loads(status_file.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if not isinstance(status, dict):  # the run folder also holds the list of cross-module checks
            continue
        for step in status.get("steps", []):
            rows.append({"feature": status_file.parent.parent.name, "module": status.get("module", status_file.stem), **step})
    return rows


def summary_lines(root: Path, registry: dict, sessions: int, feature: str | None) -> list[str]:
    targets = registry["line"]["usage_targets"]
    features = root / registry["line"]["features_dir"]
    lines = []
    if not feature:
        base, largest = loaded_files_tokens(root, registry)
        lines += [f"Loaded at session start: root ~{approx(base)} ({verdict(base, targets['loaded_files'])}), "
                  f"largest module adds ~{approx(largest)}", "", "Main sessions (context per request):"]
        folder = transcripts_dir(root)
        for short_id, day, stats in session_rows(folder, sessions):
            lines.append(f"- {short_id} {day}: {stats.requests} requests, start {approx(stats.start_context)}, "
                         f"avg {approx(stats.avg_context)} ({verdict(stats.avg_context, targets['main_avg_context'])}), "
                         f"cache read {approx(stats.cache_read)}")
        agents = subagent_rows(folder)
        if agents:
            lines += ["", f"Sub-agents ({len(agents)}): average start {approx(sum(a.start_context for a in agents) // len(agents))}, "
                          f"average cache read {approx(sum(a.cache_read for a in agents) // len(agents))}"]
    rows = worker_rows(features, feature)
    lines += ["", "Line workers:" if rows else "Line workers: no runs yet."]
    for row in rows:
        lines.append(f"- {row['feature']}/{row['module']} {row['role']} ({row.get('model', '?')}): {row.get('requests', 0)} requests, "
                     f"start {approx(row.get('start_context', 0))} ({verdict(row.get('start_context', 0), targets['worker_start'])}), "
                     f"cache read {approx(row.get('cache_read', 0))} ({verdict(row.get('cache_read', 0), targets['worker_cache_read'])}), "
                     f"{money(row.get('cost_usd'))}{'' if row.get('ok') else ' FAILED: ' + str(row.get('reason', ''))}")
    if rows:
        lines.append(f"Total: {approx(sum(r.get('total_tokens', 0) for r in rows))} tokens through the model, "
                     f"{money(sum(r.get('cost_usd') or 0 for r in rows))}{' + unknown' if any(r.get('cost_usd') is None for r in rows) else ''}")
    return lines


def stats_dict(stats: Stats) -> dict:
    return asdict(stats)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sessions", type=int, default=DEFAULT_SESSIONS)
    parser.add_argument("--feature")
    args = parser.parse_args(argv)
    root = repo_root()
    print("\n".join(summary_lines(root, Backlogs(root).registry, args.sessions, args.feature)).strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
