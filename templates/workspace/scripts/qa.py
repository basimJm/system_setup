#!/usr/bin/env python3
"""One quiet QA command for every module, no model. The steps come from `.claude/projects.json` by project kind.

    python3 scripts/qa.py <project>                      # run the steps in this checkout
    python3 scripts/qa.py <project> --checkout <path>    # run them in a worktree
    python3 scripts/qa.py <project> --base origin/<ref>  # + branch checks: tests changed, stayed inside the module

One line per step, the tail of the first failure, exit 1 when anything failed.
"""
from __future__ import annotations

import argparse
import fnmatch
import os
import signal
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / ".claude" / "hooks"))
from _common import is_source_file, is_test_file  # noqa: E402
from tasks import Backlogs, repo_root  # noqa: E402

GIT_TIMEOUT_SECONDS = 60
KILL_GRACE_SECONDS = 10


@dataclass
class Step:
    name: str
    ok: bool
    tail: str = ""


@dataclass
class QaResult:
    steps: list[Step] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return bool(self.steps) and all(s.ok for s in self.steps)

    @property
    def failure(self) -> Step | None:
        return next((s for s in self.steps if not s.ok), None)

    def lines(self) -> list[str]:
        out = [f"{'PASS' if s.ok else 'FAIL'}  {s.name}" for s in self.steps]
        if self.failure and self.failure.tail:
            out.append(self.failure.tail)
        return out

    def as_dict(self) -> list[dict]:
        return [{"name": s.name, "ok": s.ok} for s in self.steps]


def tail_of(text: str, lines: int) -> str:
    return "\n".join(text.splitlines()[-lines:])


def run_shell(command: str, cwd: Path, extra_env: dict | None, timeout: int, tail_lines: int) -> tuple[bool, str]:
    """Output goes to a file and stays out of context; only its tail comes back."""
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as log:
        proc = subprocess.Popen(command, shell=True, cwd=cwd, env={**os.environ, **(extra_env or {})},
                                stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            ok, note = proc.wait(timeout=timeout) == 0, ""
        except subprocess.TimeoutExpired:
            stop_group(proc)
            ok, note = False, f"\ntimed out after {timeout}s"
        log.seek(0)
        return ok, "" if ok else tail_of(log.read() + note, tail_lines)


def stop_group(proc: subprocess.Popen) -> None:
    """A gate starts children (Gradle, jest workers); stop the whole group, then make sure."""
    for sig, wait in ((signal.SIGTERM, KILL_GRACE_SECONDS), (signal.SIGKILL, None)):
        try:
            os.killpg(proc.pid, sig)
            proc.wait(timeout=wait)
            return
        except ProcessLookupError:
            return
        except subprocess.TimeoutExpired:
            continue


def changed_on_branch(checkout: Path, base: str) -> list[str]:
    files: set[str] = set()
    for args in (["diff", "--name-only", f"{base}...HEAD"], ["diff", "--name-only", "HEAD"],
                 ["ls-files", "--others", "--exclude-standard"]):
        done = subprocess.run(["git", *args], cwd=checkout, capture_output=True, text=True, timeout=GIT_TIMEOUT_SECONDS)
        if done.returncode != 0:
            raise RuntimeError(f"git {' '.join(args)}: {done.stderr.strip()}")
        files.update(f for f in done.stdout.splitlines() if f)
    return sorted(files)


def branch_problems(files: list[str], module_dir: str, scope_exempt: list[str]) -> list[str]:
    """What the Stop hook checks for a session, for a worker that has no Stop hook, plus staying in its own module."""
    problems = []
    if any(is_source_file(f) for f in files) and not any(is_test_file(f) for f in files):
        problems.append("source code changed but no unit test file changed")
    outside = [f for f in files if not f.startswith(f"{module_dir}/")
               and not any(fnmatch.fnmatch(f, pattern) for pattern in scope_exempt)]
    if outside:
        problems.append("changed outside the module: " + ", ".join(outside))
    return problems


def run_qa(registry: dict, project_name: str, checkout: Path, base: str | None = None) -> QaResult:
    project = registry["projects"][project_name]
    kind = registry["kinds"][project["kind"]]
    settings = registry["line"]
    result = QaResult()
    if base:
        problems = branch_problems(changed_on_branch(checkout, base), project["dir"], settings["scope_exempt"])
        result.steps.append(Step("branch: tests changed, stayed in the module", not problems, "\n".join(problems)))
        if problems:
            return result
    for step in kind["qa"]:
        ok, tail = run_shell(step["run"], checkout / project["dir"], step.get("env"),
                             settings["timeouts_seconds"]["qa"], settings["fail_tail_lines"])
        result.steps.append(Step(step["name"], ok, tail))
        if not ok:
            break
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("project")
    parser.add_argument("--checkout", help="a worktree of this repo; default: this checkout")
    parser.add_argument("--base", help="also check the branch against this ref")
    args = parser.parse_args(argv)
    root = repo_root()
    registry = Backlogs(root).registry
    if args.project not in registry["projects"]:
        print(f"unknown project: {args.project}", file=sys.stderr)
        return 2
    result = run_qa(registry, args.project, Path(args.checkout).resolve() if args.checkout else root, args.base)
    print("\n".join(result.lines()))
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.exit(main())
