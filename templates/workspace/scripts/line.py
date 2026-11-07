#!/usr/bin/env python3
"""The feature line: one packet, thin short-lived workers, scripts for everything else. No model orchestrates.

    python3 scripts/line.py new <feature>                 features/<feature>/PACKET.md from the template
    python3 scripts/line.py check <feature>               validate the packet
    python3 scripts/line.py run <feature> [--only a,b]    contract first, then each module: worker -> QA -> PO -> fixes
    python3 scripts/line.py status <feature>              one line per module
    python3 scripts/line.py report <feature>              rewrite the one-page REPORT.md
    python3 scripts/line.py merge <feature>               push, PR, merge; only when every module passed

Workers talk to no one: the contract, the packet and the status files coordinate them. A worker edits its own module
in its own worktree and cannot commit, push or merge; this script does that, re-runs every check, and records
`Loops`/`Review` only after they really passed. Budgets and rules live in `.claude/projects.json` (`line`, `kinds`).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / ".claude" / "hooks"))
import _common  # noqa: E402
from guard_git import violation as guard_violation  # noqa: E402
from qa import run_qa, run_shell  # noqa: E402
from tasks import CHARS_PER_TOKEN, Backlogs, repo_root  # noqa: E402
from usage import Meter, stats_dict  # noqa: E402

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
SECTION_RE = re.compile(r"^## +(.+?) *$", re.M)
MODULE_PREFIX = "module:"
REQUIRED_SECTIONS = ("Decisions", "Contract", "Design", "Docs")
NONE_VALUE = "none"
MODULE_TOKEN = "<module>"
FEATURE_TOKEN = "<feature>"
KILL_GRACE_SECONDS = 10
TASKS_RE = re.compile(r"^Tasks: *(.+)$", re.M)
CRITERION_RE = re.compile(r"^- \[[ x]\] +(.+)$", re.M)
BLOCKED_RE = re.compile(r"^BLOCKED: *(.+)$", re.M)
IMPORT_LINE_RE = re.compile(r"^@\S+\n?", re.M)
REVIEW_SECTION_RE = re.compile(r"^## 2\..*?(?=^## )", re.M | re.S)
REVIEW_ITEM_RE = re.compile(r"^- \*\*.+$", re.M)
UNAVAILABLE_STATES = ("PENDING", "DONE", "CANCELLED")
WAITING, PASS, FAILED, RUNNING, MERGED = "WAITING", "PASS", "FAILED", "RUNNING", "MERGED"
PO_SCHEMA = {
    "type": "object",
    "properties": {"verdict": {"enum": ["PASS", "FAIL"]}, "gaps": {"type": "array", "items": {"type": "string"}},
                   "summary": {"type": "string"}},
    "required": ["verdict", "gaps", "summary"],
}


class LineError(Exception):
    """Stops the command with a message; nothing is pushed or merged."""


# ---- the packet -------------------------------------------------------------------------------------------------
@dataclass
class ModulePart:
    name: str
    tasks: list[str]
    criteria: list[str]
    body: str


@dataclass
class Packet:
    sections: dict[str, str]
    modules: dict[str, ModulePart] = field(default_factory=dict)
    tokens: int = 0

    @property
    def contract_change(self) -> bool:
        return self.sections.get("Contract", "").strip().lower() != NONE_VALUE

    @property
    def docs_change(self) -> bool:
        return self.sections.get("Docs", "").strip().lower() != NONE_VALUE


def parse_packet(text: str, id_re: re.Pattern) -> Packet:
    parts = SECTION_RE.split(text)
    packet = Packet(sections={}, tokens=len(text) // CHARS_PER_TOKEN)
    for title, body in zip(parts[1::2], parts[2::2]):
        body = body.strip()
        if title.lower().startswith(MODULE_PREFIX):
            name = title[len(MODULE_PREFIX):].strip()
            found = TASKS_RE.search(body)
            packet.modules[name] = ModulePart(name, id_re.findall(found.group(1)) if found else [],
                                              CRITERION_RE.findall(body), body)
        else:
            packet.sections[title] = body
    return packet


def packet_problems(packet: Packet, backlogs: Backlogs, settings: dict) -> list[str]:
    problems = [f"missing section: ## {s}" for s in REQUIRED_SECTIONS if not packet.sections.get(s)]
    if packet.tokens > settings["packet_max_tokens"]:
        problems.append(f"packet is ~{packet.tokens} tokens, limit {settings['packet_max_tokens']}: two pages at most")
    if not packet.modules:
        problems.append("no ## Module: section")
    in_packet = {task for part in packet.modules.values() for task in part.tasks}
    for name, part in packet.modules.items():
        if name not in backlogs.projects:
            problems.append(f"{name}: unknown module ({', '.join(backlogs.projects)})")
            continue
        if not part.tasks:
            problems.append(f"{name}: no `Tasks:` line")
        if not part.criteria:
            problems.append(f"{name}: no acceptance criteria (`- [ ] ...`)")
        for task_id in part.tasks:
            task = backlogs.tasks.get(task_id)
            if task is None:
                problems.append(f"{name}: unknown task {task_id}")
            elif task.project != name:
                problems.append(f"{name}: {task_id} belongs to {task.project}")
            elif task.status in UNAVAILABLE_STATES:
                problems.append(f"{name}: {task_id} is {task.status}")
            else:
                waiting = [d for d in task.deps if d not in in_packet and backlogs.tasks.get(d) and backlogs.tasks[d].status != "DONE"]
                if waiting:
                    problems.append(f"{name}: {task_id} waits for {', '.join(waiting)}, not in this packet")
    if packet.contract_change and settings["contract_module"] not in packet.modules:
        problems.append(f"the contract changes but ## Module: {settings['contract_module']} is missing")
    return problems


# ---- the worker command ------------------------------------------------------------------------------------------
def worker_settings(repo_settings: dict, events: list[str], worktree: Path) -> str:
    """The enforcing hooks stay on: the same commands as the session, resolved for this worktree. Nothing else loads."""
    hooks = {event: repo_settings["hooks"][event] for event in events if event in repo_settings.get("hooks", {})}
    return json.dumps({"hooks": hooks}).replace("$CLAUDE_PROJECT_DIR", str(worktree))


def agent_command(settings: dict, role: dict, system: str, hooks_json: str, worktree: Path, schema: dict | None = None) -> list[str]:
    tools = role["tools"]
    allowed = [t for t in tools if t != "Bash"] + [f"Read(/{worktree}/**)"]
    if "Bash" in tools:
        allowed += [f"Bash({rule})" for rule in settings["allowed_bash"]]
    command = [settings["claude_bin"], "-p", "--model", role["model"], "--output-format", "stream-json", "--verbose",
               "--strict-mcp-config", "--setting-sources", "", "--settings", hooks_json, "--disable-slash-commands",
               "--tools", ",".join(tools), "--permission-mode", settings["permission_mode"],
               "--allowedTools", *allowed, "--disallowedTools", *settings["denied"],
               "--max-budget-usd", str(role["budget_usd"]), "--system-prompt", system]
    return command + ["--json-schema", json.dumps(schema)] if schema else command


@dataclass
class AgentResult:
    ok: bool
    reason: str = ""
    text: str = ""
    structured: dict | None = None


def cost_text(steps: list[dict]) -> str:
    known = sum(s.get("cost_usd") or 0 for s in steps)
    return f"${known:.2f}{'+?' if any(s.get('cost_usd') is None for s in steps) else ''}"


def read_result(log_path: Path) -> dict:
    last: dict = {}
    with log_path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if '"type":"result"' in line.replace(" ", ""):
                try:
                    last = json.loads(line)
                except ValueError:
                    continue
    return last


def stream_agent(command: list[str], cwd: Path, env: dict, prompt: str, log_path: Path, timeout: int, max_tokens: int) -> tuple[int, str, Meter]:
    """Runs one agent, writing its stream to the log. Stops it at the time limit or the token cap, whatever the plan is."""
    meter = Meter()
    stop: dict[str, str] = {}
    proc = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, errors="replace", start_new_session=True)

    def signal_group(sig: int) -> None:
        try:
            os.killpg(proc.pid, sig)
        except ProcessLookupError:
            pass

    last_resort = threading.Timer(KILL_GRACE_SECONDS, signal_group, [signal.SIGKILL])
    last_resort.daemon = True

    def kill(reason: str) -> None:
        if "reason" not in stop:
            stop["reason"] = reason
            signal_group(signal.SIGTERM)
            last_resort.start()

    timer = threading.Timer(timeout, kill, [f"stopped: over the {timeout}s limit"])
    timer.daemon = True
    timer.start()
    try:
        try:
            proc.stdin.write(prompt)
            proc.stdin.close()
        except BrokenPipeError:
            pass
        with log_path.open("w", encoding="utf-8") as log, proc.stdout:
            for line in proc.stdout:
                log.write(line)
                log.flush()
                meter.feed(line)
                if meter.total > max_tokens:
                    kill(f"stopped: over the cap of {max_tokens} tokens")
        code = proc.wait()
    finally:
        timer.cancel()
        last_resort.cancel()
    return code, stop.get("reason", ""), meter


# ---- one run -----------------------------------------------------------------------------------------------------
class Line:
    def __init__(self, root: Path, feature: str):
        if not NAME_RE.match(feature):
            raise LineError(f"bad feature name: {feature} (lowercase letters, digits, dashes)")
        self.root = root
        self.feature = feature
        self.backlogs = Backlogs(root)
        self.registry = self.backlogs.registry
        self.settings = self.registry["line"]
        self.dir = root / self.settings["features_dir"] / feature
        self.run_dir = self.dir / self.settings["run_dir"]
        self.prompts = root / self.settings["features_dir"] / self.settings["prompts_dir"]
        self.packet_path = self.dir / self.settings["packet_file"]
        self.qa_lock = threading.Lock()
        self.save_lock = threading.Lock()

    # ---- packet --------------------------------------------------------------------------------------------------
    def load_packet(self) -> Packet:
        if not self.packet_path.is_file():
            raise LineError(f"no packet: {self.packet_path.relative_to(self.root)} (run: line.py new {self.feature})")
        packet = parse_packet(self.packet_path.read_text(encoding="utf-8"), self.backlogs.id_re)
        problems = packet_problems(packet, self.backlogs, self.settings)
        if problems:
            raise LineError("packet problems:\n" + "\n".join(f"- {p}" for p in problems))
        return packet

    def ordered(self, packet: Packet, only: list[str] | None = None) -> list[str]:
        """The contract module first, because everything builds on it; then the registry's order."""
        first = self.settings["contract_module"]
        order = [first] + [name for name in self.registry["projects"] if name != first]
        return [m for m in order if m in packet.modules and (not only or m in only)]

    def create_packet(self) -> Path:
        if self.packet_path.exists():
            raise LineError(f"already exists: {self.packet_path.relative_to(self.root)}")
        template = self.root / self.settings["features_dir"] / self.settings["packet_template"]
        self.dir.mkdir(parents=True, exist_ok=True)
        self.packet_path.write_text(template.read_text(encoding="utf-8").replace(FEATURE_TOKEN, self.feature), encoding="utf-8")
        return self.packet_path

    # ---- status files --------------------------------------------------------------------------------------------
    def status_path(self, module: str) -> Path:
        return self.run_dir / f"{module}.json"

    def load_status(self, module: str) -> dict:
        path = self.status_path(module)
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
        return {"module": module, "state": WAITING, "reason": "", "steps": [], "qa": [], "po": {}, "decide": [], "pr": ""}

    def save_status(self, status: dict) -> None:
        with self.save_lock:
            self.run_dir.mkdir(parents=True, exist_ok=True)
            path = self.status_path(status["module"])
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(status, indent=2, ensure_ascii=False), encoding="utf-8")
            tmp.replace(path)

    def fail(self, status: dict, reason: str) -> dict:
        status.update(state=FAILED, reason=reason)
        self.save_status(status)
        return status

    # ---- git -----------------------------------------------------------------------------------------------------
    def git(self, cwd: Path, *args: str, check: bool = True) -> str:
        done = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=self.settings["timeouts_seconds"]["git"])
        if check and done.returncode != 0:
            raise LineError(f"git {' '.join(args)}: {done.stderr.strip()}")
        return done.stdout.strip()

    def masters(self) -> set[str]:
        return set(_common.PROTECTED_BRANCHES) | {p["master"] for p in self.registry["projects"].values() if p.get("master")}

    def branch_of(self, part: ModulePart) -> str:
        branch = self.backlogs.tasks[part.tasks[0]].branch
        if not branch or branch in self.masters():
            raise LineError(f"{part.tasks[0]}: its backlog row names no task branch")
        return branch

    def worktree_of(self, module: str) -> Path:
        return self.root / self.settings["worktrees_dir"] / f"line-{self.feature}-{module}"

    def ensure_worktree(self, path: Path, branch: str, master: str) -> Path:
        """A new branch starts from the master; a re-run continues the worktree it finds."""
        if path.is_dir():
            return path
        if not self.git(self.root, "branch", "--list", branch):
            self.git(self.root, "branch", "--no-track", branch, f"origin/{master}")
        path.parent.mkdir(parents=True, exist_ok=True)
        self.git(self.root, "worktree", "add", str(path), branch)
        return path

    def commit(self, worktree: Path, message: str) -> bool:
        self.git(worktree, "add", "-A", "--", ".", ":(exclude,glob)**/.env*")
        if not self.git(worktree, "diff", "--cached", "--name-only"):
            return False
        self.git(worktree, "commit", "-m", f"{message}\n\n{self.settings['commit_trailer']}")
        return True

    # ---- agents --------------------------------------------------------------------------------------------------
    def prompt_file(self, name: str) -> str:
        return (self.prompts / f"{name}.md").read_text(encoding="utf-8").strip()

    def run_agent(self, status: dict, role_name: str, cwd: Path, worktree: Path, system: str, prompt: str, schema: dict | None = None) -> AgentResult:
        role = self.settings["roles"][role_name]
        repo_settings = json.loads((worktree / self.settings["hook_settings"]).read_text(encoding="utf-8"))
        command = agent_command(self.settings, role, system, worker_settings(repo_settings, self.settings["worker_hooks"], worktree), worktree, schema)
        self.run_dir.mkdir(parents=True, exist_ok=True)
        log_path = self.run_dir / f"{status['module']}.{len(status['steps']) + 1}.{role_name}.jsonl"
        env = {**os.environ, **self.settings["worker_env"]}
        code, stopped, meter = stream_agent(command, cwd, env, prompt, log_path, self.settings["timeouts_seconds"]["agent"], role["max_tokens"])
        result = read_result(log_path)
        reason = stopped or ("" if code == 0 and result.get("subtype") == "success" and not result.get("is_error")
                             else f"{result.get('subtype') or 'no result'} (exit {code})")
        cost = result.get("total_cost_usd")  # a stopped agent never reports it: unknown, not zero
        status["steps"].append({"role": role_name, "model": role["model"], "ok": not reason, "reason": reason, "cost_usd": cost,
                                "log": log_path.name, **stats_dict(meter.stats())})
        self.save_status(status)
        return AgentResult(not reason, reason, str(result.get("result") or ""), result.get("structured_output"))

    def module_map(self, module: str) -> str:
        done = subprocess.run([sys.executable, str(self.root / "scripts" / "map.py"), module], cwd=self.root, capture_output=True, text=True)
        return done.stdout.strip()

    def card(self, packet: Packet, module: str, status_note: str = "") -> str:
        """All a worker gets: its module's short file and map, the decisions, and its own part of the packet."""
        project = self.registry["projects"][module]
        part = packet.modules[module]
        titles = "; ".join(f"{t}: {self.backlogs.tasks[t].title}" for t in part.tasks)
        module_file = IMPORT_LINE_RE.sub("", (self.root / project["dir"] / "CLAUDE.md").read_text(encoding="utf-8")).strip()
        blocks = [f"# {titles}", module_file, self.module_map(module), "## Decisions\n" + packet.sections["Decisions"],
                  "## Contract\n" + packet.sections["Contract"], "## Design\n" + packet.sections["Design"], "## Your part\n" + part.body]
        return "\n\n".join(blocks + ([status_note] if status_note else []))

    def earlier_work(self, worktree: Path, master: str) -> str:
        """A retry or a later phase starts on what is committed; saying so is cheaper than letting it find out."""
        stat = self.git(worktree, "diff", "--stat", f"origin/{master}...HEAD")
        return f"## Already on this branch\nContinue from this; do not redo it.\n{stat}" if stat else ""

    def worker_system(self, module: str) -> str:
        return self.prompt_file("worker").replace(MODULE_TOKEN, self.registry["projects"][module]["title"])

    def blocked(self, status: dict, result: AgentResult) -> bool:
        """A worker that hit an open business rule asks instead of guessing; the question goes to the owner's page."""
        found = BLOCKED_RE.search(result.text)
        if found:
            status["decide"].append(found.group(1).strip())
            self.fail(status, f"worker asks: {found.group(1).strip()}")
        return bool(found)

    # ---- the contract comes first ----------------------------------------------------------------------------------
    def contract_paths(self, worktree: Path) -> list[Path]:
        project = self.registry["projects"][self.settings["contract_module"]]
        return sorted((worktree / project["dir"]).glob(self.settings["contract_glob"]))

    def run_contract(self, packet: Packet) -> dict:
        module = self.settings["contract_module"]
        status = self.load_status(module)
        if status.get("contract_ready"):
            return status
        project = self.registry["projects"][module]
        status.update(state=RUNNING, reason="", branch=self.branch_of(packet.modules[module]), master=project["master"])
        worktree = self.ensure_worktree(self.worktree_of(module), status["branch"], project["master"])
        status["worktree"] = str(worktree)
        self.save_status(status)
        if not self.setup(status, module, worktree):
            return status
        result = self.run_agent(status, "contract", worktree / project["dir"], worktree, self.worker_system(module),
                                self.prompt_file("contract") + "\n\n" + self.card(packet, module, self.earlier_work(worktree, project["master"])))
        self.commit(worktree, f"{packet.modules[module].tasks[0]}: contract for {self.feature}")
        if self.blocked(status, result):
            return status
        if not result.ok:
            return self.fail(status, f"contract worker: {result.reason}")
        rel = [str(p.relative_to(worktree)) for p in self.contract_paths(worktree)]
        changed = self.git(worktree, "diff", "--name-only", f"origin/{project['master']}...HEAD", "--", *rel) if rel else ""
        if not changed:
            return self.fail(status, "the packet changes the contract but the OpenAPI files did not change")
        status["contract_ready"] = True
        self.save_status(status)
        return status

    def safe_contract(self, packet: Packet) -> dict:
        try:
            return self.run_contract(packet)
        except Exception as error:
            return self.fail(self.load_status(self.settings["contract_module"]), f"{type(error).__name__}: {error}")

    def sync_contract(self, worktree: Path, module: str) -> None:
        """Clients build on the new contract from the first minute: the same files, then their own generator."""
        source = self.worktree_of(self.settings["contract_module"])
        for path in self.contract_paths(source):
            target = worktree / path.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
        project = self.registry["projects"][module]
        command = self.registry["kinds"][project["kind"]].get("contract_sync")
        if command:
            ok, tail = run_shell(command, worktree / project["dir"], None, self.settings["timeouts_seconds"]["setup"], self.settings["fail_tail_lines"])
            if not ok:
                raise LineError(f"contract sync: {tail}")

    # ---- one module ----------------------------------------------------------------------------------------------
    def setup(self, status: dict, module: str, worktree: Path) -> bool:
        if status.get("setup_done"):
            return True
        project = self.registry["projects"][module]
        command = self.registry["kinds"][project["kind"]].get("setup")
        if command:
            ok, tail = run_shell(command, worktree / project["dir"], None, self.settings["timeouts_seconds"]["setup"], self.settings["fail_tail_lines"])
            if not ok:
                self.fail(status, f"setup: {tail}")
                return False
        status["setup_done"] = True
        self.save_status(status)
        return True

    def run_module(self, packet: Packet, module: str) -> dict:
        status = self.load_status(module)
        if status["state"] in (PASS, MERGED):
            return status
        project = self.registry["projects"][module]
        part = packet.modules[module]
        status.update(state=RUNNING, reason="", branch=self.branch_of(part), master=project["master"])
        self.save_status(status)
        try:
            return self.drive_module(packet, status, module, project, part)
        except Exception as error:  # one module's failure is written down and never takes the others with it
            return self.fail(status, f"{type(error).__name__}: {error}")

    def drive_module(self, packet: Packet, status: dict, module: str, project: dict, part: ModulePart) -> dict:
        worktree = self.ensure_worktree(self.worktree_of(module), status["branch"], project["master"])
        status["worktree"] = str(worktree)
        cwd = worktree / project["dir"]
        if packet.contract_change and module != self.settings["contract_module"] and not status.get("contract_synced"):
            self.sync_contract(worktree, module)
            self.commit(worktree, f"{part.tasks[0]}: new contract from {self.settings['contract_module']}")
            status["contract_synced"] = True
        if not self.setup(status, module, worktree):
            return status
        system = self.worker_system(module)
        if not status.get("implemented"):
            result = self.run_agent(status, "worker", cwd, worktree, system, self.card(packet, module, self.earlier_work(worktree, project["master"])))
            self.commit(worktree, f"{part.tasks[0]}: {self.feature}")
            if self.blocked(status, result):
                return status
            if not result.ok:
                return self.fail(status, f"worker: {result.reason}")
            status["implemented"] = True
        for attempt in range(self.settings["max_fix_rounds"] + 1):
            problem = self.check_module(packet, status, module, worktree)
            if not problem:
                self.record_block(packet, status, module, worktree)
                status.update(state=PASS, reason="")
                self.save_status(status)
                return status
            if attempt == self.settings["max_fix_rounds"]:
                status["decide"] += status["po"].get("gaps", []) if status["po"].get("verdict") == "FAIL" else []
                return self.fail(status, problem)
            note = f"## Fix this, nothing else\n{problem}"
            result = self.run_agent(status, "fix", cwd, worktree, system, self.card(packet, module, note))
            self.commit(worktree, f"{part.tasks[0]}: fix {self.feature}")
            if self.blocked(status, result):
                return status
            if not result.ok:
                return self.fail(status, f"fix worker: {result.reason}")
        return self.fail(status, "no fix rounds")

    def check_module(self, packet: Packet, status: dict, module: str, worktree: Path) -> str:
        """QA first, without a model; the PO is called only for green code. Returns what is wrong, or ''."""
        base = f"origin/{status['master']}"
        with self.qa_lock:  # gates share Gradle and ports, and they cost no tokens: one at a time
            self.autofix(packet, module, worktree)
            result = run_qa(self.registry, module, worktree, base)
        status["qa"] = result.as_dict()
        self.save_status(status)
        if not result.ok:
            return f"QA step `{result.failure.name}` failed:\n{result.failure.tail}"
        return self.review(packet, status, module, worktree)

    def autofix(self, packet: Packet, module: str, worktree: Path) -> None:
        """Formatting is a script's job: a fix worker for it costs tokens and teaches nothing. A failure shows up in QA."""
        project = self.registry["projects"][module]
        command = self.registry["kinds"][project["kind"]].get("autofix")
        if command:
            run_shell(command, worktree / project["dir"], None, self.settings["timeouts_seconds"]["setup"], self.settings["fail_tail_lines"])
            self.commit(worktree, f"{packet.modules[module].tasks[0]}: format")

    def review(self, packet: Packet, status: dict, module: str, worktree: Path) -> str:
        """One shot per round: criteria and diff in, a verdict out. Anything but a clean PASS is not a pass."""
        part = packet.modules[module]
        excludes = [f":(exclude,glob){pattern}" for pattern in self.settings["po_diff_exclude"]]
        diff = self.git(worktree, "diff", f"origin/{status['master']}...HEAD", "--", ".", *excludes)
        limit = self.settings["po_diff_max_chars"]
        cut = f"\n\n(diff cut at {limit} characters; read the files for the rest)" if len(diff) > limit else ""
        checklist = self.review_checklist(worktree)
        prompt = "\n\n".join(["## Acceptance criteria\n" + "\n".join(f"- {c}" for c in part.criteria),
                              "## Decisions\n" + packet.sections["Decisions"], "## Review checklist\n" + checklist,
                              f"## Diff\n{diff[:limit]}{cut}"])
        result = self.run_agent(status, "po", worktree / self.registry["projects"][module]["dir"], worktree, self.prompt_file("po"), prompt, PO_SCHEMA)
        if not result.ok:
            status["po"] = {"verdict": "NOT RUN", "gaps": [], "summary": result.reason}
            self.save_status(status)
            return f"the review did not finish: {result.reason}"
        verdict = result.structured or {}
        status["po"] = {"verdict": verdict.get("verdict", "NOT RUN"), "gaps": verdict.get("gaps", []), "summary": verdict.get("summary", "")}
        self.save_status(status)
        if verdict.get("verdict") == "PASS" and not verdict.get("gaps"):
            return ""
        return "The reviewer found these gaps:\n" + "\n".join(f"- {g}" for g in verdict.get("gaps", ["no verdict returned"]))

    def review_checklist(self, worktree: Path) -> str:
        section = REVIEW_SECTION_RE.search((worktree / self.settings["review_checklist"]).read_text(encoding="utf-8"))
        if not section:
            raise LineError(f"no review checklist in {self.settings['review_checklist']}")
        return "\n".join(REVIEW_ITEM_RE.findall(section.group(0)))

    def record_block(self, packet: Packet, status: dict, module: str, worktree: Path) -> None:
        """Written only here, after QA and the review really passed on the final code."""
        part = packet.modules[module]
        project = self.registry["projects"][module]
        tasks = self.backlogs.tasks
        criteria = "\n".join(f"  - [x] {c}" for c in part.criteria)
        steps = ", ".join(s["name"] for s in status["qa"])
        block = (f"\n### {part.tasks[0]} — {tasks[part.tasks[0]].title}\n- Branch: `{status['branch']}`\n- Status: IN REVIEW\n"
                 f"- Tasks: {', '.join(part.tasks)}; packet `{self.packet_path.relative_to(self.root)}`\n- Acceptance criteria:\n{criteria}\n"
                 f"- Tests: `scripts/qa.py {module}` green ({steps})\n- Loops: 1/1 — QA re-ran after the last change; the reviewer checked each criterion\n"
                 f"- Review: PASSED (one reviewer through the four roles, model {self.settings['roles']['po']['model']}) — {status['po']['summary']}\n"
                 f"- Notes: {self.settings['not_covered_note']}\n")
        path = worktree / project["session"]
        path.write_text(path.read_text(encoding="utf-8").rstrip() + "\n" + block, encoding="utf-8")
        self.commit(worktree, f"{part.tasks[0]}: task block after QA and review")

    # ---- the whole feature ---------------------------------------------------------------------------------------
    def run(self, only: list[str] | None = None) -> int:
        packet = self.load_packet()
        self.git(self.root, "fetch", "origin")
        modules = self.ordered(packet, only)
        contract_module = self.settings["contract_module"]
        if packet.contract_change and contract_module in packet.modules:
            status = self.safe_contract(packet)
            if not status.get("contract_ready"):
                self.write_report(packet)
                print(f"Stopped at the contract: {status['reason']}")
                return 1
        with ThreadPoolExecutor(max_workers=self.settings["parallel"]) as pool:
            statuses = list(pool.map(lambda m: self.run_module(packet, m), modules))
        self.coordinate(packet)
        path = self.write_report(packet)
        print(f"Report: {path.relative_to(self.root)}")
        return 0 if all(s["state"] == PASS for s in statuses) else 1

    def coordinate(self, packet: Packet) -> list[dict]:
        """No model: every client holds the server's contract, then the cross-module smoke commands when configured."""
        checks = []
        source = self.worktree_of(self.settings["contract_module"])
        if packet.contract_change and source.is_dir():
            for module in self.ordered(packet):
                worktree = self.worktree_of(module)
                if module == self.settings["contract_module"] or not worktree.is_dir():
                    continue
                drift = [p.name for p in self.contract_paths(source)
                         if not (worktree / p.relative_to(source)).is_file() or (worktree / p.relative_to(source)).read_bytes() != p.read_bytes()]
                checks.append({"name": f"contract: {module}", "ok": not drift, "detail": ", ".join(drift)})
                if drift:
                    status = self.load_status(module)
                    if status["state"] == PASS:
                        self.fail(status, "contract differs from the server: " + ", ".join(drift))
        for smoke in self.settings["smoke"]:
            ok, tail = run_shell(smoke["run"], self.root, smoke.get("env"), self.settings["timeouts_seconds"]["qa"], self.settings["fail_tail_lines"])
            checks.append({"name": smoke["name"], "ok": ok, "detail": tail})
        self.run_dir.mkdir(parents=True, exist_ok=True)
        (self.run_dir / self.settings["coordination_file"]).write_text(json.dumps(checks, indent=2, ensure_ascii=False), encoding="utf-8")
        return checks

    def status_lines(self, packet: Packet) -> list[str]:
        lines = []
        for module in self.ordered(packet):
            status = self.load_status(module)
            qa = " ".join(("+" if s["ok"] else "x") + s["name"] for s in status["qa"]) or "not run"
            lines.append(f"{module}: {status['state']} qa[{qa}] po[{status['po'].get('verdict', 'not run')}] "
                         f"{cost_text(status['steps'])}{(' - ' + status['reason'].splitlines()[0]) if status['reason'] else ''}")
        return lines

    def write_report(self, packet: Packet) -> Path:
        """The one page for the owner: what happened, what failed, what to decide, what no check covered."""
        statuses = {m: self.load_status(m) for m in self.ordered(packet)}
        rows = ["| Module | Tasks | State | QA | PO | Requests | Start context | Cache read | Cost |", "|---|---|---|---|---|---|---|---|---|"]
        for module, status in statuses.items():
            steps = status["steps"]
            qa = "not run" if not status["qa"] else ("green" if all(s["ok"] for s in status["qa"]) else "failed")
            starts = [s.get("start_context", 0) for s in steps]
            rows.append(f"| {module} | {', '.join(packet.modules[module].tasks)} | {status['state']} | {qa} | {status['po'].get('verdict', 'not run')} | "
                        f"{sum(s.get('requests', 0) for s in steps)} | {max(starts, default=0)} | {sum(s.get('cache_read', 0) for s in steps)} | "
                        f"{cost_text(steps)} |")
        failed = [f"- **{m}**: {s['reason']}" for m, s in statuses.items() if s["state"] == FAILED] or ["- nothing"]
        decide = [f"- {m}: {q}" for m, s in statuses.items() for q in s["decide"]] or ["- nothing"]
        coordination_path = self.run_dir / self.settings["coordination_file"]
        coordination = json.loads(coordination_path.read_text(encoding="utf-8")) if coordination_path.is_file() else []
        checks = [f"- {'PASS' if c['ok'] else 'FAIL'} {c['name']}{': ' + c['detail'] if c['detail'] else ''}" for c in coordination] or ["- none ran"]
        text = "\n".join([f"# {self.feature}: line report", "", f"**{self.report_headline(statuses)}**", "", *rows, "",
                          "## Failed", *failed, "", "## You decide", *decide, "", "## Across modules", *checks, "",
                          "## Not covered by any check here", *[f"- {note}" for note in self.settings["not_covered_report"]], ""])
        self.dir.mkdir(parents=True, exist_ok=True)
        path = self.dir / self.settings["report_file"]
        path.write_text(text, encoding="utf-8")
        return path

    @staticmethod
    def report_headline(statuses: dict[str, dict]) -> str:
        states = [s["state"] for s in statuses.values()]
        if states and all(state == MERGED for state in states):
            return "Merged: " + ", ".join(s["pr"] for s in statuses.values())
        if states and all(state in (PASS, MERGED) for state in states):
            return "Every module passed; ready for `line.py merge`."
        return "Not ready: nothing was merged." if MERGED not in states else "Partly merged: run `line.py merge` again after fixing the failure."

    # ---- merge: the script, never a worker ---------------------------------------------------------------------------
    def merge(self) -> int:
        packet = self.load_packet()
        modules = self.ordered(packet)
        waiting = [m for m in modules if self.load_status(m)["state"] not in (PASS, MERGED)]
        if waiting:
            raise LineError("not merged, these modules did not pass: " + ", ".join(waiting))
        self.git(self.root, "fetch", "origin")
        for module in modules:
            status = self.load_status(module)
            if status["state"] != MERGED:
                self.ship(packet, status, module)
        self.write_report(packet)
        self.wrap_up(packet, modules)
        self.drop_local_records()
        print(f"Merged: {', '.join(modules)}. Pull the master to get {self.dir.relative_to(self.root)}.")
        return 0

    def ship(self, packet: Packet, status: dict, module: str) -> None:
        """The same guard as a session's push: no block with `Loops: 1/1` and `Review: PASSED`, no push."""
        project = self.registry["projects"][module]
        worktree = Path(status["worktree"])
        branch = status["branch"]
        session_text = (worktree / project["session"]).read_text(encoding="utf-8")
        reason = guard_violation(f"git push -u origin {branch}", branch, lambda b: _common.task_block(b, session_text))
        if reason:
            raise LineError(f"{module}: {reason}")
        self.git(worktree, "push", "-u", "origin", branch)
        part = packet.modules[module]
        self.open_and_merge(status, branch, status["master"], f"{part.tasks[0]}: {self.feature}", self.pr_body(status, part))
        status["state"] = MERGED
        self.save_status(status)

    def pr_body(self, status: dict, part: ModulePart) -> str:
        criteria = "\n".join(f"- {c}" for c in part.criteria)
        return (f"Feature line: `{self.feature}`, tasks {', '.join(part.tasks)}.\n\n## Acceptance criteria\n{criteria}\n\n"
                f"## Checks\nQA: {', '.join(s['name'] for s in status['qa'])}. Review: {status['po']['summary']}\n\n"
                f"Not covered: {self.settings['not_covered_note']}\n\n{self.settings['pr_footer']}")

    def open_and_merge(self, status: dict, branch: str, master: str, title: str, body: str) -> None:
        """The PR is remembered as soon as it exists, so a failed merge can be retried without opening a second one."""
        gh = self.settings["gh_bin"]
        timeout = self.settings["timeouts_seconds"]["git"]
        if not status.get("pr"):
            created = subprocess.run([gh, "pr", "create", "--base", master, "--head", branch, "--title", title, "--body", body],
                                     cwd=self.root, capture_output=True, text=True, timeout=timeout)
            if created.returncode != 0:
                raise LineError(f"gh pr create: {created.stderr.strip()}")
            status["pr"] = created.stdout.strip().splitlines()[-1]
            self.save_status(status)
        merged = subprocess.run([gh, "pr", "merge", status["pr"], "--merge"], cwd=self.root, capture_output=True, text=True, timeout=timeout)
        if merged.returncode != 0:
            raise LineError(f"gh pr merge {status['pr']}: {merged.stderr.strip()}")

    def wrap_up(self, packet: Packet, modules: list[str]) -> None:
        """Statuses, the board and the docs once, after the merges, so parallel branches never fight over them."""
        self.git(self.root, "fetch", "origin")
        masters = list(dict.fromkeys(self.registry["projects"][m]["master"] for m in modules))
        task_ids = [t for m in modules for t in packet.modules[m].tasks]
        for index, master in enumerate(masters):
            status = self.load_status(f"wrapup-{master}")
            if status["state"] == MERGED:
                continue
            branch = f"chore/line-{self.feature}-wrapup-{master}"
            worktree = self.ensure_worktree(self.root / self.settings["worktrees_dir"] / f"line-{self.feature}-wrapup-{master}", branch, master)
            known = self.check_problems(worktree)
            for module in modules:
                if self.registry["projects"][module]["master"] == master:
                    archive_block(worktree, self.registry["projects"][module], self.load_status(module)["branch"], self.settings["session_archive"])
            for task_id in task_ids:
                self.set_status(worktree, task_id)
            if index == 0:
                self.write_records(packet, status, worktree)
            new = self.check_problems(worktree) - known
            if new:
                raise LineError("tasks.py check after the wrap-up: " + "; ".join(sorted(new)))
            if self.commit(worktree, f"{self.feature}: statuses, board and docs after the merge"):
                self.git(worktree, "push", "-u", "origin", branch)
                self.open_and_merge(status, branch, master, f"{self.feature}: statuses, board and docs", f"Wrap-up of feature line `{self.feature}`: no product code.\n\n{self.settings['pr_footer']}")
            status.update(state=MERGED, branch=branch)
            self.save_status(status)
        self.remove_worktrees(modules, masters)

    def check_problems(self, worktree: Path) -> set[str]:
        """Older problems of the backlog are not this feature's; only what the wrap-up adds stops it."""
        done = subprocess.run([sys.executable, "scripts/tasks.py", "check"], cwd=worktree, capture_output=True, text=True)
        return set(done.stdout.splitlines()) if done.returncode != 0 else set()

    def set_status(self, worktree: Path, task_id: str) -> None:
        done = subprocess.run([sys.executable, "scripts/tasks.py", "set", task_id, "DONE"], cwd=worktree, capture_output=True, text=True)
        if done.returncode != 0:
            raise LineError(f"tasks.py set {task_id} DONE: {done.stdout.strip()} {done.stderr.strip()}")

    def write_records(self, packet: Packet, status: dict, worktree: Path) -> None:
        target = worktree / self.dir.relative_to(self.root)
        target.mkdir(parents=True, exist_ok=True)
        for name in (self.settings["packet_file"], self.settings["report_file"]):
            shutil.copyfile(self.dir / name, target / name)
        if packet.docs_change:
            prompt = "\n\n".join(["## Decisions\n" + packet.sections["Decisions"], "## Contract\n" + packet.sections["Contract"], "## Write this\n" + packet.sections["Docs"]])
            result = self.run_agent(status, "docs", worktree, worktree, self.prompt_file("docs"), prompt)
            if not result.ok:
                raise LineError(f"docs worker: {result.reason}")

    def drop_local_records(self) -> None:
        """The packet and report now live on the master; untracked copies here would make the next pull fail."""
        for name in (self.settings["packet_file"], self.settings["report_file"]):
            rel = str((self.dir / name).relative_to(self.root))
            if self.git(self.root, "ls-files", "--others", "--", rel):
                (self.dir / name).unlink()

    def remove_worktrees(self, modules: list[str], masters: list[str]) -> None:
        paths = [self.worktree_of(m) for m in modules] + [self.root / self.settings["worktrees_dir"] / f"line-{self.feature}-wrapup-{m}" for m in masters]
        for path in paths:
            if path.is_dir():
                self.git(self.root, "worktree", "remove", "--force", str(path), check=False)


def archive_block(worktree: Path, project: dict, branch: str, archive_rel: str) -> bool:
    """The merged task's block leaves the session file, which holds only the task in progress."""
    session = worktree / project["session"]
    text = session.read_text(encoding="utf-8")
    block = _common.task_block(branch, text)
    if not block:
        return False
    archive = worktree / project["dir"] / archive_rel
    existing = archive.read_text(encoding="utf-8") if archive.is_file() else ""
    archive.parent.mkdir(parents=True, exist_ok=True)
    archive.write_text(existing.rstrip() + f"\n\n### {block.strip()}\n", encoding="utf-8")
    session.write_text(text.replace(f"### {block}", "").rstrip() + "\n", encoding="utf-8")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("new", "check", "run", "status", "report", "merge"))
    parser.add_argument("feature")
    parser.add_argument("--only", help="comma-separated modules, for a re-run")
    args = parser.parse_args(argv)
    line = Line(repo_root(), args.feature)
    try:
        if args.command == "new":
            print(line.create_packet().relative_to(line.root))
            return 0
        if args.command == "run":
            return line.run(args.only.split(",") if args.only else None)
        if args.command == "merge":
            return line.merge()
        packet = line.load_packet()
        if args.command == "check":
            print(f"OK: ~{packet.tokens} tokens, modules: {', '.join(line.ordered(packet))}, contract change: {packet.contract_change}")
        elif args.command == "status":
            print("\n".join(line.status_lines(packet)))
        else:
            print(line.write_report(packet).relative_to(line.root))
        return 0
    except LineError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
