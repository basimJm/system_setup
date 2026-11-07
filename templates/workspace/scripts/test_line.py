#!/usr/bin/env python3
"""Tests for scripts/line.py against real git and a fake `claude` and `gh`: no tokens, no network.

Run: python3 -m unittest scripts/test_line.py
"""
from __future__ import annotations

import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))
import line  # noqa: E402
from tasks import Backlogs  # noqa: E402

FAKE_CLAUDE = r'''#!/usr/bin/env python3
"""Plays a scripted agent: writes files like a worker would and answers in stream-json."""
import json, os, sys, time
from pathlib import Path
args = sys.argv[1:]
prompt = sys.stdin.read()
state_dir = Path(os.environ["FAKE_STATE"])
scenario = json.loads((state_dir / "scenario.json").read_text())
is_po = "--json-schema" in args
is_contract = "First step only" in prompt
is_docs = "## Write this" in prompt
is_fix = "## Fix this" in prompt
role = "po" if is_po else "contract" if is_contract else "docs" if is_docs else "fix" if is_fix else "worker"
with (state_dir / "calls.jsonl").open("a") as fh:
    fh.write(json.dumps({"role": role, "cwd": os.getcwd(), "args": args, "prompt": prompt,
                         "mds_off": os.environ.get("CLAUDE_CODE_DISABLE_CLAUDE_MDS")}) + "\n")
module = Path(os.getcwd()).name
counter = state_dir / f"{module}.{role}.count"
n = int(counter.read_text()) + 1 if counter.exists() else 1
counter.write_text(str(n))
plan = scenario.get(f"{module}.{role}", {})
def say(usage, mid):
    print(json.dumps({"type": "assistant", "message": {"id": mid, "usage": usage}}), flush=True)
usage = {"input_tokens": 10, "cache_creation_input_tokens": 500, "cache_read_input_tokens": 4000, "output_tokens": 50}
say(usage, "m1")
if plan.get("burn"):
    for i in range(50):
        say({**usage, "cache_read_input_tokens": plan["burn"]}, f"b{i}")
        time.sleep(0.05)
    time.sleep(30)
if role == "contract" and not plan.get("no_change"):
    spec = Path("docs/api/openapi.customer.json")
    spec.write_text(json.dumps({"version": "2", "openNow": True}))
if role == "docs":
    Path("BUSINESS_DOMAIN.md").write_text(Path("BUSINESS_DOMAIN.md").read_text() + "\nOpen now.\n")
if role in ("worker", "fix") and not plan.get("no_code"):
    Path("src").mkdir(exist_ok=True); Path("test").mkdir(exist_ok=True)
    Path("src/feature.ts").write_text(f"// {role} {n}\n")
    Path("test/feature.test.ts").write_text(f"// test {n}\n")
    if plan.get("qa_fail_until", 0) >= n and role == "worker":
        Path("QA_FAIL").write_text("boom")
    elif Path("QA_FAIL").exists():
        Path("QA_FAIL").unlink()
result = {"type": "result", "subtype": "success", "is_error": False, "total_cost_usd": 0.25, "session_id": "s", "result": "done"}
if plan.get("text"):
    result["result"] = plan["text"]
if plan.get("error"):
    result.update(subtype=plan["error"], is_error=True)
if is_po:
    verdicts = plan.get("verdicts", [{"verdict": "PASS", "gaps": [], "summary": "all criteria met"}])
    chosen = verdicts[min(n - 1, len(verdicts) - 1)]
    if chosen is not None:
        result["structured_output"] = chosen
print(json.dumps(result), flush=True)
'''

FAKE_GH = r'''#!/usr/bin/env python3
"""`pr create` remembers the branches; `pr merge` really merges them into the bare origin."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
state = Path(os.environ["FAKE_STATE"])
args = sys.argv[1:]
with (state / "gh.jsonl").open("a") as fh:
    fh.write(json.dumps(args) + "\n")
prs = state / "prs.json"
data = json.loads(prs.read_text()) if prs.exists() else {}
if args[:2] == ["pr", "create"]:
    url = f"https://example.test/pull/{len(data) + 1}"
    data[url] = {"base": args[args.index("--base") + 1], "head": args[args.index("--head") + 1]}
    prs.write_text(json.dumps(data))
    print(url)
elif args[:2] == ["pr", "merge"]:
    if (state / "fail_merge").exists():
        (state / "fail_merge").unlink()
        sys.exit("merge refused")
    pr = data[args[2]]
    with tempfile.TemporaryDirectory() as tmp:
        run = lambda *a: subprocess.run(["git", *a], cwd=tmp, check=True, capture_output=True)
        subprocess.run(["git", "clone", "-q", "-b", pr["base"], os.environ["FAKE_ORIGIN"], tmp], check=True)
        run("config", "user.email", "t@example.test")
        run("config", "user.name", "t")
        run("merge", "--no-ff", "-m", "merge", f"origin/{pr['head']}")
        run("push", "origin", pr["base"])
'''

PACKET = """# Feature: open-now

## Decisions
- Any bookable branch open now counts.

## Contract
`GET /items?openNow=true`

## Design
none

## Docs
BUSINESS_DOMAIN: say that open now exists.

## Module: server
Tasks: SRV-001
- [ ] The filter matches an open branch

## Module: customer
Tasks: CUS-001
- [ ] The chip sends the filter
"""

BACKLOG = "# Tasks\n\n| ID | Title | Branch | Needs | Status | Notes |\n|---|---|---|---|---|---|\n{rows}\n"


def registry() -> dict:
    return {
        "board_file": "INTEGRATION.md",
        "statuses": ["TODO", "IN PROGRESS", "IN REVIEW", "DONE", "PENDING", "BLOCKED", "CANCELLED"],
        "owner_input_markers": ["user input"],
        "kinds": {"server": {"autofix": "git log -1 --format=%s > /dev/null && echo formatted > formatted.txt", "qa": [{"name": "server gate", "run": "test ! -e QA_FAIL || (echo qa-tail-line; exit 1)"}]},
                  "kmp": {"contract_sync": "cp ../server/docs/api/openapi.customer.json generated.json",
                          "qa": [{"name": "app gate", "run": "test ! -e QA_FAIL || (echo qa-tail-line; exit 1)"}]}},
        "projects": {
            "server": {"title": "Server", "kind": "server", "prefix": "SRV", "dir": "server", "master": "m-server",
                       "backlog": "server/docs/tasks.md", "session": "server/.claude/session.md"},
            "customer": {"title": "Customer", "kind": "kmp", "prefix": "CUS", "dir": "customer", "master": "m-customer",
                         "backlog": "customer/docs/tasks.md", "session": "customer/.claude/session.md"},
        },
        "line": {
            "contract_module": "server", "contract_glob": "docs/api/openapi.*.json",
            "scope_exempt": ["server/docs/api/openapi.*.json"], "features_dir": "features", "run_dir": "run",
            "prompts_dir": "prompts", "packet_file": "PACKET.md", "packet_template": "PACKET_TEMPLATE.md",
            "report_file": "REPORT.md", "coordination_file": "coordination.json", "worktrees_dir": ".claude/worktrees",
            "hook_settings": ".claude/settings.json", "worker_hooks": ["PreToolUse", "PostToolUse"],
            "review_checklist": ".claude/hooks.md", "session_archive": "docs/knowledge/session-archive.md",
            "claude_bin": "claude", "gh_bin": "gh", "worker_env": {"CLAUDE_CODE_DISABLE_CLAUDE_MDS": "1"},
            "permission_mode": "acceptEdits", "parallel": 2, "max_fix_rounds": 2, "packet_max_tokens": 1500,
            "fail_tail_lines": 10, "po_diff_max_chars": 5000, "po_diff_exclude": ["**/docs/api/**"],
            "timeouts_seconds": {"agent": 60, "qa": 30, "setup": 30, "git": 30},
            "roles": {role: {"model": "sonnet", "budget_usd": 1, "max_tokens": 100000,
                             "tools": ["Read", "Grep"] if role == "po" else ["Read", "Edit", "Write", "Bash", "Grep"]}
                      for role in ("contract", "worker", "fix", "po", "docs")},
            "allowed_bash": ["npm:*"], "denied": ["Bash(git push:*)", "Read(**/.env*)"], "smoke": [],
            "not_covered_note": "no emulator", "not_covered_report": ["Screens"],
            "commit_trailer": "Co-Authored-By: Test <t@example.test>", "pr_footer": "footer",
            "usage_targets": {"loaded_files": 3000, "worker_start": 10000, "main_avg_context": 50000, "worker_cache_read": 1000000},
        },
    }


class LineCase(unittest.TestCase):
    """A real repo with two masters on a bare origin; only `claude` and `gh` are fake."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.origin = self.tmp / "origin.git"
        self.root = self.tmp / "repo"
        self.state = self.tmp / "state"
        self.bin = self.tmp / "bin"
        for path in (self.state, self.bin):
            path.mkdir()
        self.install("claude", FAKE_CLAUDE)
        self.install("gh", FAKE_GH)
        self.scenario({})
        self.env_patch = {"PATH": f"{self.bin}{os.pathsep}{os.environ['PATH']}", "FAKE_STATE": str(self.state), "FAKE_ORIGIN": str(self.origin),
                          "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.test", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.test"}
        self.saved_env = dict(os.environ)
        self.addCleanup(self.restore_env)
        os.environ.update(self.env_patch)
        self.build_repo()

    def restore_env(self):
        os.environ.clear()
        os.environ.update(self.saved_env)

    def install(self, name, body):
        path = self.bin / name
        path.write_text(body)
        path.chmod(path.stat().st_mode | stat.S_IEXEC)

    def scenario(self, data):
        (self.state / "scenario.json").write_text(json.dumps(data))

    def sh(self, *args, cwd=None):
        return subprocess.run(["git", *args], cwd=cwd or self.root, check=True, capture_output=True, text=True).stdout.strip()

    def build_repo(self):
        subprocess.run(["git", "init", "-q", "--bare", str(self.origin)], check=True)
        self.root.mkdir()
        self.sh("init", "-q", "-b", "start")
        write = lambda rel, text: ((self.root / rel).parent.mkdir(parents=True, exist_ok=True), (self.root / rel).write_text(text))
        write(".claude/projects.json", json.dumps(registry()))
        write(".claude/settings.json", (REPO / ".claude" / "settings.json").read_text())
        write(".claude/hooks.md", "# H\n\n## 2. Review Hook\n- **Software Engineer:** correct.\n- **QA Engineer:** tested.\n\n## 3. Next\n")
        write(".claude/session.md", "# Root\n")
        write(".gitignore", ".claude/worktrees/\nfeatures/*/run/\n")
        write("INTEGRATION.md", "# Board\n\n<!-- BOARD:START -->\n<!-- BOARD:END -->\n")
        write("BUSINESS_DOMAIN.md", "# Domain\n")
        write("server/CLAUDE.md", "# Server\n\nGate: fake.\n\n@.claude/session.md\n")
        write("customer/CLAUDE.md", "# Customer\n\nGate: fake.\n")
        write("server/.claude/session.md", "# Server tasks\n")
        write("customer/.claude/session.md", "# Customer tasks\n")
        write("server/docs/api/openapi.customer.json", json.dumps({"version": "1"}))
        write("server/docs/tasks.md", BACKLOG.format(rows="| SRV-001 | Open now | `feat/srv-001-open` | none | TODO | - |"))
        write("customer/docs/tasks.md", BACKLOG.format(rows="| CUS-001 | Chip | `fix/cus-001-chip` | SRV-001 | BLOCKED | - |"))
        for script in ("map.py", "tasks.py"):
            write(f"scripts/{script}", (HERE / script).read_text())
        write("features/PACKET_TEMPLATE.md", (REPO / "features" / "PACKET_TEMPLATE.md").read_text())
        for prompt in ("worker", "contract", "po", "docs"):
            write(f"features/prompts/{prompt}.md", (REPO / "features" / "prompts" / f"{prompt}.md").read_text())
        hooks = self.root / ".claude" / "hooks"
        shutil.copytree(REPO / ".claude" / "hooks", hooks, ignore=shutil.ignore_patterns("__pycache__", "test_*"))
        self.sh("add", "-A")
        self.sh("commit", "-q", "-m", "start")
        self.sh("remote", "add", "origin", str(self.origin))
        for master in ("m-server", "m-customer"):
            self.sh("push", "-q", "origin", f"HEAD:refs/heads/{master}")
        self.sh("fetch", "-q", "origin")

    def packet(self, text=PACKET, feature="open-now"):
        path = self.root / "features" / feature / "PACKET.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return line.Line(self.root, feature)

    def calls(self):
        path = self.state / "calls.jsonl"
        return [json.loads(x) for x in path.read_text().splitlines()] if path.exists() else []

    def gh_calls(self):
        path = self.state / "gh.jsonl"
        return [json.loads(x) for x in path.read_text().splitlines()] if path.exists() else []

    def remote_file(self, master, rel):
        return self.sh("--git-dir", str(self.origin), "show", f"{master}:{rel}", cwd=self.tmp)


class Pipeline(LineCase):
    def test_contract_first_then_each_module_passes_and_records_only_then(self):
        run = self.packet()
        self.assertEqual(run.run(), 0)
        roles = [c["role"] for c in self.calls()]
        self.assertEqual(roles[0], "contract", "the contract comes before everything")
        self.assertEqual(roles.count("worker"), 2)
        self.assertEqual(roles.count("po"), 2)
        customer = run.worktree_of("customer")
        self.assertIn("openNow", (customer / "customer" / "generated.json").read_text(), "the client's generator ran on the new contract")
        for module, branch in (("server", "feat/srv-001-open"), ("customer", "fix/cus-001-chip")):
            status = run.load_status(module)
            self.assertEqual(status["state"], line.PASS)
            block = (run.worktree_of(module) / module / ".claude" / "session.md").read_text()
            self.assertIn(f"Branch: `{branch}`", block)
            self.assertIn("Loops: 1/1", block)
            self.assertIn("Review: PASSED", block)
        self.assertEqual(self.gh_calls(), [], "run never pushes or opens a PR")
        report = (run.dir / "REPORT.md").read_text()
        self.assertIn("ready for `line.py merge`", report)
        self.assertIn("Screens", report, "what no check covered is on the owner's page")

    def test_workers_are_thin_keep_the_enforcing_hooks_and_cannot_push(self):
        run = self.packet()
        run.run()
        call = next(c for c in self.calls() if c["role"] == "worker")
        args = call["args"]
        self.assertEqual(call["mds_off"], "1")
        self.assertEqual(args[args.index("--setting-sources") + 1], "")
        self.assertIn("--strict-mcp-config", args)
        self.assertIn("--disable-slash-commands", args)
        self.assertNotIn("--dangerously-skip-permissions", args)
        self.assertEqual(args[args.index("--max-budget-usd") + 1], "1")
        self.assertIn("Bash(git push:*)", args)
        hooks = json.loads(args[args.index("--settings") + 1])["hooks"]
        self.assertEqual(sorted(hooks), ["PostToolUse", "PreToolUse"])
        self.assertIn("guard_git.py", json.dumps(hooks))
        self.assertNotIn("$CLAUDE_PROJECT_DIR", json.dumps(hooks))
        self.assertIn(str(run.root), json.dumps(hooks))
        self.assertTrue(call["cwd"].endswith("/server") or call["cwd"].endswith("/customer"), "a worker starts inside its module")
        self.assertIn("The filter matches" if call["cwd"].endswith("/server") else "The chip sends", call["prompt"])
        po = next(c for c in self.calls() if c["role"] == "po")
        self.assertEqual(po["args"][po["args"].index("--tools") + 1], "Read,Grep", "the reviewer cannot edit")
        self.assertIn("Software Engineer", po["prompt"], "the checklist comes from the review file")

    def test_qa_failure_calls_a_fix_worker_with_the_tail_then_reruns(self):
        self.scenario({"server.worker": {"qa_fail_until": 1}})
        run = self.packet()
        self.assertEqual(run.run(), 0)
        fix = next(c for c in self.calls() if c["role"] == "fix")
        self.assertIn("qa-tail-line", fix["prompt"])
        self.assertTrue(fix["cwd"].endswith("/server"))
        roles = [c["role"] for c in self.calls() if c["cwd"].endswith("/server")]
        self.assertLess(roles.index("fix"), roles.index("po"), "the model reviews only green code")

    def test_formatting_is_fixed_by_the_script_and_committed_before_qa(self):
        run = self.packet()
        self.assertEqual(run.run(), 0)
        worktree = run.worktree_of("server")
        self.assertEqual((worktree / "server" / "formatted.txt").read_text().strip(), "formatted")
        self.assertIn("SRV-001: format", self.sh("log", "--format=%s", cwd=worktree))
        self.assertEqual(self.sh("status", "--short", cwd=worktree), "")

    def test_review_gap_goes_to_a_fix_worker_and_is_reviewed_again(self):
        self.scenario({"customer.po": {"verdicts": [{"verdict": "FAIL", "gaps": ["chip.kt: no test"], "summary": "gap"},
                                                    {"verdict": "PASS", "gaps": [], "summary": "fine now"}]}})
        run = self.packet()
        self.assertEqual(run.run(), 0)
        fix = next(c for c in self.calls() if c["role"] == "fix")
        self.assertIn("chip.kt: no test", fix["prompt"])
        self.assertEqual(run.load_status("customer")["po"]["summary"], "fine now")

    def test_a_review_that_never_passes_fails_records_nothing_and_blocks_merge(self):
        self.scenario({"customer.po": {"verdicts": [{"verdict": "FAIL", "gaps": ["still missing"], "summary": "no"}]}})
        run = self.packet()
        self.assertEqual(run.run(), 1)
        status = run.load_status("customer")
        self.assertEqual(status["state"], line.FAILED)
        block = (run.worktree_of("customer") / "customer" / ".claude" / "session.md").read_text()
        self.assertNotIn("Review: PASSED", block)
        self.assertNotIn("Loops: 1/1", block)
        with self.assertRaises(line.LineError):
            run.merge()
        self.assertEqual(self.gh_calls(), [])
        self.assertIn("still missing", (run.dir / "REPORT.md").read_text())
        self.assertIn("nothing was merged", (run.dir / "REPORT.md").read_text())

    def test_pass_with_gaps_or_no_verdict_is_not_a_pass(self):
        self.scenario({"customer.po": {"verdicts": [{"verdict": "PASS", "gaps": ["but this"], "summary": "x"}, None, None]}})
        run = self.packet()
        self.assertEqual(run.run(), 1)
        self.assertEqual(run.load_status("customer")["state"], line.FAILED)

    def test_token_cap_stops_the_worker_and_nothing_passes(self):
        self.scenario({"customer.worker": {"burn": 90000}})
        run = self.packet()
        self.assertEqual(run.run(), 1)
        status = run.load_status("customer")
        self.assertEqual(status["state"], line.FAILED)
        self.assertIn("over the cap", status["reason"])
        self.assertEqual(run.load_status("server")["state"], line.PASS, "one module's failure stays its own")

    def test_a_stopped_worker_keeps_its_work_cost_is_unknown_and_the_retry_is_told(self):
        self.scenario({"customer.worker": {"burn": 90000}})
        run = self.packet()
        run.run()
        step = run.load_status("customer")["steps"][0]
        self.assertIsNone(step["cost_usd"], "a stopped agent reports no cost; zero would be a lie")
        self.assertIn("+?", "\n".join(run.status_lines(run.load_packet())))
        self.scenario({})
        self.assertEqual(run.run(), 0)
        retry = [c for c in self.calls() if c["role"] == "worker" and c["cwd"].endswith("/customer")][-1]
        self.assertIn("## Already on this branch", retry["prompt"])
        self.assertEqual(run.load_status("customer")["state"], line.PASS)

    def test_budget_error_from_the_cli_fails_the_module(self):
        self.scenario({"customer.worker": {"error": "error_max_budget_usd"}})
        run = self.packet()
        self.assertEqual(run.run(), 1)
        self.assertIn("error_max_budget_usd", run.load_status("customer")["reason"])

    def test_a_worker_question_stops_the_module_and_reaches_the_owner(self):
        self.scenario({"customer.worker": {"text": "looked at it\nBLOCKED: Does a closed branch count?"}})
        run = self.packet()
        self.assertEqual(run.run(), 1)
        self.assertIn("Does a closed branch count?", (run.dir / "REPORT.md").read_text())

    def test_contract_declared_but_unchanged_stops_every_module(self):
        self.scenario({"server.contract": {"no_change": True}})
        run = self.packet()
        self.assertEqual(run.run(), 1)
        self.assertEqual([c["role"] for c in self.calls()], ["contract"], "no client starts on a contract that did not change")
        self.assertIn("did not change", run.load_status("server")["reason"])

    def test_no_contract_change_skips_the_contract_step(self):
        run = self.packet(PACKET.replace("`GET /items?openNow=true`", "none"))
        self.assertEqual(run.run(), 0)
        self.assertNotIn("contract", [c["role"] for c in self.calls()])

    def test_rerun_continues_only_what_did_not_pass(self):
        self.scenario({"customer.worker": {"error": "error_max_budget_usd"}})
        run = self.packet()
        run.run()
        before = len([c for c in self.calls() if c["cwd"].endswith("/server")])
        self.scenario({})
        self.assertEqual(run.run(), 0)
        self.assertEqual(len([c for c in self.calls() if c["cwd"].endswith("/server")]), before, "a passed module is not paid for twice")

    def test_contract_drift_after_the_client_synced_fails_the_client(self):
        run = self.packet()
        run.run()
        spec = run.worktree_of("server") / "server" / "docs" / "api" / "openapi.customer.json"
        spec.write_text(json.dumps({"version": "3"}))
        checks = run.coordinate(run.load_packet())
        self.assertFalse(checks[0]["ok"])
        self.assertEqual(run.load_status("customer")["state"], line.FAILED)


class Merging(LineCase):
    def test_merge_ships_through_the_guard_and_wraps_up_once_per_master(self):
        run = self.packet()
        self.assertEqual(run.run(), 0)
        self.assertEqual(run.merge(), 0)
        creates = [c for c in self.gh_calls() if c[:2] == ["pr", "create"]]
        bases = [c[c.index("--base") + 1] for c in creates]
        heads = [c[c.index("--head") + 1] for c in creates]
        self.assertEqual(heads[:2], ["feat/srv-001-open", "fix/cus-001-chip"], "the contract merges first")
        self.assertEqual(bases[:2], ["m-server", "m-customer"], "every PR goes into its project's master")
        self.assertEqual(sorted(h for h in heads[2:]), ["chore/line-open-now-wrapup-m-customer", "chore/line-open-now-wrapup-m-server"])
        self.assertIn("feature.ts", self.sh("--git-dir", str(self.origin), "ls-tree", "-r", "--name-only", "m-server", cwd=self.tmp))
        for master in ("m-server", "m-customer"):
            self.assertRegex(self.remote_file(master, "customer/docs/tasks.md"), r"CUS-001.*DONE")
            self.assertRegex(self.remote_file(master, "server/docs/tasks.md"), r"SRV-001.*DONE")
        self.assertNotIn("Review: PASSED", self.remote_file("m-server", "server/.claude/session.md"), "a merged block leaves the session file")
        self.assertIn("Review: PASSED", self.remote_file("m-server", "server/docs/knowledge/session-archive.md"))
        self.assertIn("Open now.", self.remote_file("m-server", "BUSINESS_DOMAIN.md"), "one docs worker, after the merge")
        self.assertEqual(len([c for c in self.calls() if c["role"] == "docs"]), 1)
        self.assertIn("Any bookable branch", self.remote_file("m-server", "features/open-now/PACKET.md"))
        self.assertIn("Merged: https://example.test/pull/1, https://example.test/pull/2", self.remote_file("m-server", "features/open-now/REPORT.md"))
        self.assertFalse(run.worktree_of("server").exists(), "worktrees go away after the merge")
        self.assertFalse((run.dir / "PACKET.md").exists(), "untracked copies would make the next pull fail")

    def test_a_failed_merge_is_retried_without_a_second_pr(self):
        run = self.packet(PACKET.replace("`GET /items?openNow=true`", "none"))
        self.assertEqual(run.run(), 0)
        (self.state / "fail_merge").write_text("once")
        with self.assertRaises(line.LineError):
            run.merge()
        self.assertEqual(run.load_status("server")["state"], line.PASS, "not merged, not recorded as merged")
        self.assertEqual(run.merge(), 0)
        heads = [c[c.index("--head") + 1] for c in self.gh_calls() if c[:2] == ["pr", "create"]]
        self.assertEqual(heads.count("feat/srv-001-open"), 1)

    def test_guard_refuses_a_branch_without_a_verified_block(self):
        run = self.packet(PACKET.replace("`GET /items?openNow=true`", "none"))
        run.run()
        session = run.worktree_of("server") / "server" / ".claude" / "session.md"
        session.write_text(session.read_text().replace("Review: PASSED", "Review: PENDING"))
        with self.assertRaises(line.LineError) as caught:
            run.merge()
        self.assertIn("Review: PASSED", str(caught.exception))
        self.assertEqual(self.gh_calls(), [])

    def test_merge_refuses_when_nothing_ran(self):
        run = self.packet()
        with self.assertRaises(line.LineError):
            run.merge()
        self.assertEqual(self.gh_calls(), [])


class PacketRules(LineCase):
    def problems(self, text):
        run = self.packet(text)
        return line.packet_problems(line.parse_packet(text, run.backlogs.id_re), run.backlogs, run.settings)

    def test_good_packet(self):
        self.assertEqual(self.problems(PACKET), [])

    def test_parse_reads_sections_tasks_and_criteria(self):
        run = self.packet()
        packet = run.load_packet()
        self.assertTrue(packet.contract_change)
        self.assertTrue(packet.docs_change)
        self.assertEqual(packet.modules["server"].tasks, ["SRV-001"])
        self.assertEqual(packet.modules["customer"].criteria, ["The chip sends the filter"])
        self.assertEqual(run.ordered(packet), ["server", "customer"])
        self.assertEqual(run.ordered(packet, ["customer"]), ["customer"])

    def test_missing_section(self):
        self.assertIn("missing section: ## Design", self.problems(PACKET.replace("## Design\nnone\n\n", "")))

    def test_too_long(self):
        self.assertTrue(any("two pages" in p for p in self.problems(PACKET + "x" * 7000)))

    def test_unknown_module_task_and_foreign_task(self):
        self.assertTrue(any("unknown module" in p for p in self.problems(PACKET + "\n## Module: admin\nTasks: SRV-001\n- [ ] x\n")))
        self.assertTrue(any("unknown task SRV-999" in p for p in self.problems(PACKET.replace("Tasks: SRV-001", "Tasks: SRV-999"))))
        self.assertTrue(any("belongs to customer" in p for p in self.problems(PACKET.replace("Tasks: SRV-001", "Tasks: CUS-001"))))

    def test_no_criteria(self):
        self.assertTrue(any("no acceptance criteria" in p for p in self.problems(PACKET.replace("- [ ] The chip sends the filter\n", ""))))

    def test_dependency_outside_the_packet_blocks_it(self):
        only_customer = re.sub(r"## Module: server.*?(?=## Module: customer)", "", PACKET, flags=re.S).replace("`GET /items?openNow=true`", "none")
        self.assertTrue(any("waits for SRV-001" in p for p in self.problems(only_customer)))

    def test_contract_change_needs_the_contract_module(self):
        only_customer = re.sub(r"## Module: server.*?(?=## Module: customer)", "", PACKET, flags=re.S)
        self.assertTrue(any("## Module: server is missing" in p for p in self.problems(only_customer)))

    def test_new_writes_the_template_and_never_overwrites(self):
        run = line.Line(self.root, "checkout")
        path = run.create_packet()
        self.assertIn("# Feature: checkout", path.read_text())
        with self.assertRaises(line.LineError):
            run.create_packet()
        with self.assertRaises(line.LineError):
            line.Line(self.root, "../evil")

    def test_real_registry_and_template_fit_the_line(self):
        backlogs = Backlogs(REPO)
        settings = backlogs.registry["line"]
        self.assertEqual(sorted(settings["worker_hooks"]), ["PostToolUse", "PreToolUse"])
        for role in settings["roles"].values():
            self.assertNotIn("Bash", role["tools"]) if role is settings["roles"]["po"] else self.assertIn("Bash", role["tools"])
        for rule in ("Bash(git push:*)", "Bash(git merge:*)", "Bash(gh:*)", "Read(**/.env*)", "Edit(**/.env*)"):
            self.assertIn(rule, settings["denied"])
        for name in backlogs.projects:
            self.assertIn(backlogs.projects[name]["kind"], backlogs.registry["kinds"])
        self.assertIsNotNone(line.REVIEW_SECTION_RE.search((REPO / settings["review_checklist"]).read_text(encoding="utf-8")))


class Pieces(unittest.TestCase):
    def test_worker_settings_keep_only_the_chosen_events(self):
        repo = {"hooks": {"Stop": [{"x": 1}], "PreToolUse": [{"command": 'python3 "$CLAUDE_PROJECT_DIR/g.py"'}]}}
        parsed = json.loads(line.worker_settings(repo, ["PreToolUse", "PostToolUse"], Path("/w")))
        self.assertEqual(list(parsed["hooks"]), ["PreToolUse"])
        self.assertIn("/w/g.py", parsed["hooks"]["PreToolUse"][0]["command"])

    def test_archive_block_moves_only_the_merged_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            session = root / "p" / ".claude" / "session.md"
            session.parent.mkdir(parents=True)
            session.write_text("# T\n\n### A-1 — one\n- Branch: `feat/a`\n- Status: X\n\n### A-2 — two\n- Branch: `feat/b`\n")
            project = {"session": "p/.claude/session.md", "dir": "p"}
            self.assertTrue(line.archive_block(root, project, "feat/a", "docs/archive.md"))
            self.assertNotIn("A-1", session.read_text())
            self.assertIn("A-2", session.read_text())
            self.assertIn("### A-1", (root / "p" / "docs" / "archive.md").read_text())
            self.assertFalse(line.archive_block(root, project, "feat/none", "docs/archive.md"))


if __name__ == "__main__":
    unittest.main()
