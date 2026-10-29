#!/usr/bin/env python3
"""Stop: require unit tests, the verification loop and the 4-role review when source code changed."""
import json
from _common import read_input, current_branch, changed_files, is_source_file, is_test_file, task_block, task_verified, master_branches

def evaluate(files, branch, block, masters=None):
    """A master branch (main plus every project master in .claude/projects.json) only holds merged, already-reviewed PRs."""
    if branch in (masters if masters is not None else master_branches()):
        return None
    source = [f for f in files if is_source_file(f)]
    if not source:
        return None
    problems = []
    if not any(is_test_file(f) for f in files):
        problems.append("source code changed but no unit test files changed — add/extend unit tests and run them")
    if not block:
        problems.append(f"no task block for branch '{branch}' in the project's .claude/session.md")
    elif not task_verified(block):
        problems.append("task block is missing 'Loops: 1/1' and/or 'Review: PASSED'")
    if not problems:
        return None
    return ("Review hook: " + "; ".join(problems) +
            ". Run the four-role review in .claude/hooks.md §2 (Staff SE, Staff Mobile, Staff Solution Architect, QA), "
            "fix blocking findings, complete the verification loop, then update the project's .claude/session.md and .claude/memory.md.")

def main():
    data = read_input()
    if data.get("stop_hook_active"):
        return
    branch = current_branch()
    reason = evaluate(changed_files(), branch, task_block(branch))
    if reason:
        print(json.dumps({"decision": "block", "reason": reason}))

if __name__ == "__main__":
    main()
