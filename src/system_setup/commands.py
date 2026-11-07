"""The two subcommands of the plan-driven flow: `intake` (an interview that writes BUSINESS.md) and `new` (a business document or
a plan, reviewed with the person, becomes a generated system). The flat command (`SYSTEM_SETUP --name ...`) lives in cli.py and
is unchanged; `cli.main` hands `intake` and `new` to `run`, passing its own `generate` and `print_report` so nothing is imported twice."""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path
from typing import Callable, List, Optional

from analyzer import Analyzer, AnalyzerError, ClaudeAnalyzer, PlanRejected, propose
from catalog import AnalyzerSettings, CatalogError, load_analyzer_settings, load_catalog
from engine import EngineError
from manifest import ManifestError, templates_root, tool_root
from plan import PLAN_FILE, Plan, PlanError, dumps, load_plan
from planspec import DEFERRED_TITLE, plan_to_spec
from prompts import ask, validate_required
from review import is_yes, review, yes_no

INTAKE_PROMPT_FILE = "INTAKE_PROMPT.md"
INTAKE_START = "Start the interview now."
BUSINESS_DOC_REL = "docs/BUSINESS.md"
SUBCOMMANDS = ("intake", "new")
NO_CLAUDE_MDS = {"CLAUDE_CODE_DISABLE_CLAUDE_MDS": "1"}

NO_CLAUDE_HELP = """\
`{claude}` (Claude Code) is not installed, so the interview cannot start here. Two ways forward:
  1. Install Claude Code, then run `SYSTEM_SETUP intake` again.
  2. Open claude.ai in a browser, paste the whole of {prompt} as your first message, answer the questions, and save the
     final document as {out}.
Then run: SYSTEM_SETUP new --business-doc {out}"""


def parse_intake(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="SYSTEM_SETUP intake", description="Claude interviews you, one question at a time and in "
                                     "your language, and writes the business document (BUSINESS.md) for `SYSTEM_SETUP new`.")
    parser.add_argument("--out", type=Path, default=Path("BUSINESS.md"), help="where to write the document (default: ./BUSINESS.md)")
    return parser.parse_args(argv)


def parse_new(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="SYSTEM_SETUP new", description="A business document (or a saved plan) is analyzed into a plan, "
                                     "you review it, and the system is generated from it.")
    parser.add_argument("--business-doc", type=Path, metavar="FILE", help="the business document, free-form, in any language "
                        "(from `SYSTEM_SETUP intake` or written by hand); asked for when missing")
    parser.add_argument("--plan", type=Path, metavar="FILE", help=f"a saved {PLAN_FILE}: skips the analysis, no model is used")
    parser.add_argument("--yes", action="store_true", help="accept the proposal as it is; never prompt")
    parser.add_argument("--target", type=Path, help="folder to create (absent or empty; never inside this tool)")
    parser.add_argument("--templates", type=Path, default=None, help="templates folder (default: the tool's templates/)")
    parser.add_argument("--knowledge", type=Path, default=None, help="folder of lessons and playbooks to copy to docs/knowledge/")
    parser.add_argument("--run-post", action="store_true", help="run each template's post_generate commands")
    parser.add_argument("--no-git", action="store_true", help="do not run 'git init' + first commit")
    return parser.parse_args(argv)


# ---------- intake ----------

def intake_message(prompt_text: str, out: Path) -> str:
    return (prompt_text.rstrip() + "\n\n---\nWhere to save: when the document is complete and the person agrees, write it with the Write tool "
            f"to exactly this path: {out}\nTell the person the file was saved and that the next step is "
            f"`SYSTEM_SETUP new --business-doc {out.name}`.\n")


def run_intake(argv: List[str], runner: Callable[..., int] = subprocess.call, say: Callable[[str], None] = print,
               environ: Optional[dict] = None, settings: Optional[AnalyzerSettings] = None) -> int:
    args = parse_intake(argv)
    try:
        settings = settings or load_analyzer_settings()
    except CatalogError as error:
        say(str(error))
        return 1
    prompt_file = tool_root() / INTAKE_PROMPT_FILE
    out = args.out.expanduser().resolve()
    if shutil.which(settings.claude_bin) is None:
        say(NO_CLAUDE_HELP.format(claude=settings.claude_bin, prompt=prompt_file, out=args.out))
        return 1
    if not prompt_file.is_file():
        say(f"{prompt_file} is missing; reinstall the tool.")
        return 1
    if out.exists():
        say(f"{out} already exists. Pick another file with --out, or move it away first.")
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    say(f"Starting the interview with Claude. When it is done it writes {out} (it will ask your permission to save the file: say yes).")
    command = [settings.claude_bin, INTAKE_START, "--tools", "Write", "--append-system-prompt",
               intake_message(prompt_file.read_text(encoding="utf-8"), out)]
    env = dict(os.environ if environ is None else environ, **NO_CLAUDE_MDS)
    code = runner(command, cwd=str(out.parent), env=env)
    if code != 0:
        say(f"Claude ended with code {code}.")
    if out.is_file():
        say(f"\nSaved {out}. Next: SYSTEM_SETUP new --business-doc {out}")
        return 0
    say(f"\n{out} was not written. If you saved the document somewhere else, use that file with `SYSTEM_SETUP new --business-doc FILE`.")
    return code or 1


# ---------- new ----------

def run_new(argv: List[str], generate: Callable, print_report: Callable, analyzer: Optional[Analyzer] = None,
            reader: Callable[[str], str] = input, say: Callable[[str], None] = print) -> int:
    args = parse_new(argv)
    try:
        catalog, settings = load_catalog(), load_analyzer_settings()
    except CatalogError as error:
        say(str(error))
        return 1
    say("SYSTEM_SETUP: a new system from a plan\n")
    document: Optional[str] = None
    cost = 0.0
    try:
        if args.plan:
            plan = load_plan(args.plan.expanduser(), catalog)
            say(f"Plan {args.plan} is valid; no model is used.")
        else:
            doc_path = args.business_doc
            if doc_path is None:
                if args.yes:
                    say("Pass --business-doc FILE (or --plan FILE) with --yes.")
                    return 2
                doc_path = Path(ask("Path of the business document", "BUSINESS.md", validate_required, reader)).expanduser()
            try:
                document = doc_path.expanduser().read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as error:
                say(f"Cannot read the business document {doc_path}: {error}")
                return 2
            say(f"Analyzing {doc_path} (one model call, at most ${settings.max_budget_usd:.2f}) ...")
            proposal = propose(analyzer or ClaudeAnalyzer(settings), document, catalog, settings.max_budget_usd, say)
            plan, cost = proposal.plan, proposal.cost_usd
            say(f"Analysis cost: ${cost:.4f} ({proposal.attempts} model call{'s' if proposal.attempts != 1 else ''}).")
    except PlanError as error:
        say(str(error))
        return 2
    except PlanRejected as error:
        say(str(error))
        return 1
    except AnalyzerError as error:
        say(f"Analysis failed: {error}")
        return 1
    plan = review(plan, catalog, reader, say, yes=args.yes)
    target = args.target or Path(ask("Create the system in folder", str(Path.cwd() / plan.system.slug), validate_required, reader) if not args.yes
                                 else Path.cwd() / plan.system.slug)
    conversion = plan_to_spec(plan, Path(target).expanduser(), catalog)
    spec = conversion.spec
    say(f"\nCreating {spec.system_name} ({spec.prefix}, {spec.package_root}, {spec.npm_scope}) in {spec.target}")
    if not args.yes and not is_yes(ask("Continue? (yes/no)", "yes", yes_no, reader)):
        say("Cancelled.")
        return 1
    extra = {PLAN_FILE: dumps(plan)}
    if document is not None:
        extra[BUSINESS_DOC_REL] = document if document.endswith("\n") else document + "\n"
    templates = (args.templates or templates_root()).resolve()
    try:
        report = generate(spec, templates, run_post=args.run_post, git=not args.no_git, knowledge=args.knowledge, extra_files=extra)
    except (EngineError, ManifestError) as error:
        saved = keep_plan(plan)
        say(f"\n{error}\nThe reviewed plan was saved to {saved}; fix the problem and run `SYSTEM_SETUP new --plan {saved}`.")
        return 1
    say("\nDone.")
    print_report(report, args.run_post)
    print_deferred(conversion.deferred, say)
    return 0 if report.ok else 1


def keep_plan(plan: Plan) -> Path:
    """Saves the reviewed plan next to the person's cwd so a failed generation never loses the analysis."""
    path, number = Path.cwd() / PLAN_FILE, 1
    while path.exists():
        number += 1
        path = Path.cwd() / f"system.plan.{number}.json"
    path.write_text(dumps(plan), encoding="utf-8")
    return path


def print_deferred(deferred: List[str], say: Callable[[str], None] = print) -> None:
    say(f"\n{DEFERRED_TITLE} ({len(deferred)}):")
    for line in deferred:
        say(f"  - {line}")
    say(f"The reviewed plan is {PLAN_FILE} in the new system: change it there and nothing is lost when those phases arrive.")


def run(argv: List[str], generate: Callable, print_report: Callable, **seams) -> int:
    if argv[0] == "intake":
        return run_intake(argv[1:], **{k: v for k, v in seams.items() if k in ("runner", "say", "environ", "settings")})
    return run_new(argv[1:], generate, print_report, **{k: v for k, v in seams.items() if k in ("analyzer", "reader", "say")})
