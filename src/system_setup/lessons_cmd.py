"""`SYSTEM_SETUP lessons list [--tag X]` and `SYSTEM_SETUP lessons import <project> [--yes]`.

Import reads the project's `docs/knowledge/LESSONS.local.md`, drops what the tool already knows (same normalized text, then a close
match), flags business names (from the project's `system.plan.json`) and private patterns, shows what would be added as a diff, and
adds only what the person approves, with new IDs, to the tool's `knowledge/LESSONS.md`. `--yes` approves the clean ones and still
skips everything flagged; a lesson that holds a secret is never added."""
from __future__ import annotations

import argparse
import difflib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from lessons import (ENFORCEMENTS, LESSONS_FILE, LOCAL_FILE, Document, Lesson, LessonsError, add, find_duplicate, has_secret, names_from_plan,
                     next_id, parse, parse_local, scrub, valid_tags)
from manifest import tool_root
from prompts import ask

LOCAL_REL = Path("docs") / "knowledge" / LOCAL_FILE
PLAN_REL = "system.plan.json"
REGISTRY_REL = Path(".claude") / "projects.json"
KIND_TAGS = {"server": ["server"], "web": ["web"], "kmp": ["kmp"], "sdk": ["sdk"]}
DEFAULT_TAG = "workflow"
Say = Callable[[str], None]


@dataclass
class Candidate:
    task: str
    original: str
    text: str                       # the text that would be added (scrubbed when flagged)
    tags: List[str]
    flags: List[str] = field(default_factory=list)


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="SYSTEM_SETUP lessons", description="List the tool's lessons or import a project's own.")
    sub = parser.add_subparsers(dest="action", required=True)
    for name in ("list", "import"):
        one = sub.add_parser(name)
        one.add_argument("--knowledge", type=Path, default=None, help="folder holding LESSONS.md (default: the tool's knowledge/)")
        if name == "list":
            one.add_argument("--tag", help="only lessons with this tag")
        else:
            one.add_argument("project", type=Path, help="a generated system (its docs/knowledge/LESSONS.local.md is read)")
            one.add_argument("--yes", action="store_true", help="add every clean lesson without asking; flagged ones are still skipped")
    return parser.parse_args(argv)


def load_document(folder: Path) -> Document:
    return parse((folder / LESSONS_FILE).read_text(encoding="utf-8"), str(folder / LESSONS_FILE))


def tags_by_prefix(project: Path) -> dict:
    """Task prefix -> tags of that project's kind, from the project's registry; unknown prefixes get `workflow`."""
    try:
        registry = json.loads((project / REGISTRY_REL).read_text(encoding="utf-8"))
        return {p["prefix"]: KIND_TAGS.get(p.get("kind", ""), [DEFAULT_TAG]) for p in registry.get("projects", {}).values()}
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return {}


def run_list(args: argparse.Namespace, say: Say) -> int:
    try:
        document = load_document((args.knowledge or tool_root() / "knowledge"))
    except (OSError, LessonsError) as error:
        say(str(error))
        return 1
    shown = [l for l in document.lessons() if not args.tag or args.tag in l.tags]
    for lesson in shown:
        say(f"{lesson.id}  [{', '.join(lesson.tags)}]  ({lesson.enforcement})  {lesson.text if len(lesson.text) <= 110 else lesson.text[:107] + '...'}")
    say(f"{len(shown)} of {len(document.lessons())} lessons" + (f" tagged '{args.tag}'" if args.tag else ""))
    return 0


def classify(project: Path, document: Document, say: Say) -> Tuple[List[Candidate], List[str], List[str]]:
    """(candidates, skipped-as-duplicate lines, skipped-for-a-secret lines) for the project's local lessons."""
    try:
        local = parse_local((project / LOCAL_REL).read_text(encoding="utf-8"))
    except OSError:
        raise LessonsError(f"{project / LOCAL_REL} not found: finish a task with a `Lesson:` line and `tasks.py set <ID> DONE` first")
    try:
        plan = json.loads((project / PLAN_REL).read_text(encoding="utf-8"))
        prefixes = [p for p in tags_by_prefix(project)]
    except (OSError, ValueError):
        plan, prefixes = {}, []
        say(f"note: {project / PLAN_REL} not found, so business names are not checked (private patterns still are)")
    names = names_from_plan(plan, prefixes)
    prefix_tags = tags_by_prefix(project)
    known = [(l.id, l.text) for l in document.lessons()]
    candidates: List[Candidate] = []
    duplicates: List[str] = []
    secrets: List[str] = []
    for task, text in local:
        if has_secret(text):
            secrets.append(f"[{task}] looks like it holds a secret value; never added")
            continue
        match = find_duplicate(text, known)
        if match:
            duplicates.append(f"[{task}] {'the same as' if match[1] == 'same' else 'close to'} {match[0]}")
            continue
        cleaned, flags = scrub(text, names)
        candidates.append(Candidate(task, text, cleaned, prefix_tags.get(task.split("-")[0], [DEFAULT_TAG]), flags))
        known.append((f"[{task}]", text))   # a repeat inside the same batch is a duplicate too
    return candidates, duplicates, secrets


def show_diff(before: str, after: str, say: Say) -> None:
    for line in difflib.unified_diff(before.splitlines(), after.splitlines(), LESSONS_FILE, f"{LESSONS_FILE} (after import)", n=0, lineterm=""):
        say("  " + line)


def run_import(args: argparse.Namespace, say: Say, reader: Callable[[str], str]) -> int:
    folder = (args.knowledge or tool_root() / "knowledge")
    project = args.project.expanduser().resolve()
    try:
        document = load_document(folder)
        candidates, duplicates, secrets = classify(project, document, say)
    except (OSError, LessonsError) as error:
        say(str(error))
        return 1
    for line in duplicates:
        say(f"skipped duplicate  {line}")
    for line in secrets:
        say(f"skipped            {line}")
    clean = [c for c in candidates if not c.flags]
    flagged = [c for c in candidates if c.flags]
    for c in flagged:
        say(f"flagged            [{c.task}] holds {', '.join(c.flags)}")
        say(f"                   as imported it would read: {c.text}")
    if not candidates:
        say("Nothing new to import.")
        return 0
    before = document.render()
    preview = parse(before)
    for c in candidates:   # everything that is proposed, with provisional IDs; flagged lessons appear with their names removed
        add(preview, [Lesson(next_id(preview), c.tags, "note", c.text)])
    say("\nProposed change to knowledge/LESSONS.md:")
    show_diff(before, preview.render(), say)
    approved: List[Candidate] = []
    if args.yes:
        approved = clean
        if flagged:
            say(f"--yes: {len(flagged)} flagged lesson(s) skipped; run without --yes to review them.")
    else:
        for c in candidates:
            say(f"\n[{c.task}] {c.text}" + (f"\n  flagged: {', '.join(c.flags)}; only the text above (names removed) would be added" if c.flags else ""))
            if ask("  Add this lesson? (yes/no)", "no", lambda v: None if v.lower() in ("y", "yes", "n", "no") else "answer yes or no", reader).lower() in ("y", "yes"):
                approved.append(c)
    if not approved:
        say("Nothing approved; the lessons file is unchanged.")
        return 0
    created = []
    cursor = parse(before)
    for c in approved:
        tags, enforcement = c.tags, "note"
        if not args.yes:
            raw = ask(f"  Tags for [{c.task}] (comma separated)", ", ".join(tags), lambda v: valid_tags([t.strip() for t in v.split(",") if t.strip()]), reader)
            tags = [t.strip() for t in raw.split(",") if t.strip()]
            enforcement = ask(f"  How is it enforced ({', '.join(ENFORCEMENTS)})", "note", lambda v: None if v in ENFORCEMENTS else f"choose {', '.join(ENFORCEMENTS)}", reader)
        lesson = Lesson(next_id(cursor), tags, enforcement, c.text)
        add(cursor, [lesson])
        created.append(lesson)
    (folder / LESSONS_FILE).write_text(cursor.render(), encoding="utf-8")
    say(f"\nAdded {len(created)} lesson(s) ({', '.join(l.id for l in created)}) to {folder / LESSONS_FILE}.")
    return 0


def run_lessons(argv: List[str], say: Say = print, reader: Callable[[str], str] = input) -> int:
    args = parse_args(argv)
    return run_list(args, say) if args.action == "list" else run_import(args, say, reader)
