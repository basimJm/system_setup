"""`SYSTEM_SETUP update`: the business changes later and the system follows without losing work.

The saved plan (`system.plan.json`) and the new one (analyzed again from a changed business document, or given with `--plan`) are
compared in plain language. Then the tool renders BOTH plans into scratch folders with the normal generator; the difference between
the two renderings is exactly what the plan change causes, whatever the person edited in their own copy since. Only additions are
applied to the system:

  - a new part (module, web app, SDK) gets its folder, its backlog and its entry in `.claude/projects.json`, and a row in INTEGRATION.md;
  - a new row of an existing backlog (for example a deployment's PENDING task) is appended with a fresh id;
  - a file that is new in the rendering and absent from the system is copied; an existing file is never overwritten: when the
    generated version differs it is kept and listed, and an existing folder of a new part is left alone;
  - removals and changed platforms or providers are never executed: they are listed, each with a PENDING row for the person.

Documents reuse the hash-based resume of `documents.py`; a document the person edited is kept and the new text is written next to it as
`<name>.proposed.md`. The tool commits nothing: it prints what changed and the commands to review and commit. The new plan is written
to `system.plan.json` only when everything above and `tasks.py check` succeeded."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

from analyzer import Analyzer, AnalyzerError, ClaudeAnalyzer, PlanRejected, propose
from catalog import AnalyzerSettings, Catalog, CatalogError, load_analyzer_settings, load_catalog, load_document_settings
from documents import ANALYZED_DOC_REL, BUSINESS_DOC_REL, DocumentsError, run_documents, sha
from engine import EngineError
from manifest import ManifestError, templates_root
from plan import PLAN_FILE, Plan, PlanError, dumps, load_plan
from planspec import plan_to_spec
from prompts import ask, validate_required
from review import is_yes, review, yes_no
from sdks import append_backlog_rows
from workspace import BOARD_FILE, REGISTRY_REL, TASKS_TOOL_REL, run_tasks_check

SKIP_PARTS = {".git", ".system_setup", "__pycache__", "node_modules"}
BOARD_START, BOARD_END = "<!-- BOARD:START -->", "<!-- BOARD:END -->"
BOARD_PLACEHOLDER = "_Run `python3 scripts/tasks.py board`"
REGISTRY_POSIX = REGISTRY_REL.as_posix()
MAX_LISTED = 15
IDENTITY = ("slug", "prefix", "package_root", "npm_scope")
Row = Tuple[str, str, str, str]   # title, branch key, status, note
Say = Callable[[str], None]


# ---------- the plan diff, in plain language ----------

@dataclass
class Item:
    kind: str            # module, sdk, deployment
    id: str
    text: str
    pending: bool = False   # a changed part: the person decides what the generated folder does about it
    key: str = ""           # the registry key of the part this item is about (when it has one)


@dataclass
class PlanDiff:
    added: List[Item] = field(default_factory=list)
    removed: List[Item] = field(default_factory=list)
    changed: List[Item] = field(default_factory=list)
    questions: List[str] = field(default_factory=list)
    other: List[str] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not (self.added or self.removed or self.changed or self.questions or self.other)

    def render(self) -> List[str]:
        if self.empty:
            return ["  The plan has no changes."]
        titles = {"module": "Modules", "sdk": "Building blocks (SDKs)", "deployment": "Where it runs"}
        lines: List[str] = []
        for kind, title in titles.items():
            for label, items, mark in (("added", self.added, "+"), ("removed", self.removed, "-"), ("changed", self.changed, "~")):
                chosen = [i for i in items if i.kind == kind]
                if chosen:
                    suffix = " (nothing is deleted: listed for you, with a PENDING row)" if label == "removed" else \
                        " (the existing folder is not changed: listed for you, with a PENDING row)" if label == "changed" and any(i.pending for i in chosen) else ""
                    lines.append(f"  {title}, {label}{suffix}:")
                    lines.extend(f"    {mark} {i.text}" for i in chosen)
        if self.questions:
            lines.append("  Open questions:")
            lines.extend(f"    ~ {q}" for q in self.questions)
        if self.other:
            lines.append("  Other:")
            lines.extend(f"    ~ {o}" for o in self.other)
        return lines


def module_line(m) -> str:
    return f"{m.name} ({m.id}, {m.kind}) for {m.audience} [{', '.join(m.platforms)}]"


def sdk_line(s) -> str:
    origin = {"internal": "built here", "published": f"already published ({s.package} {s.version})", "none": "no code"}.get(s.source, s.source)
    return f"{s.title} ({s.id}): {origin}; provider {s.provider or 'not chosen'}"


def deployment_line(d) -> str:
    extra = ", ".join(x for x in (f"database {d.database}" if d.database != "none" else "", f"cache {d.cache}" if d.cache != "none" else "") if x)
    return f"{d.part}: {d.host}" + (f" ({extra})" if extra else "")


def show(value) -> str:
    return ", ".join(value) if isinstance(value, list) else (value or "none")


def differences(old, new, fields: Tuple[Tuple[str, bool], ...]) -> Tuple[List[str], bool]:
    """(`field a -> b` pieces, whether one of them needs the person's decision) for the dataclass fields (attribute, decision)."""
    pieces, decision = [], False
    for attribute, needs in fields:
        before, after = getattr(old, attribute), getattr(new, attribute)
        if before != after:
            pieces.append("reason rewritten" if attribute == "why" else f"{attribute} {show(before)} -> {show(after)}")
            decision = decision or needs
    return pieces, decision


def plan_diff(old: Plan, new: Plan) -> PlanDiff:
    diff = PlanDiff()
    for kind, before, after, line, fields, key_of in (
            ("module", {m.id: m for m in old.modules}, {m.id: m for m in new.modules}, module_line,
             (("kind", True), ("platforms", True), ("name", False), ("audience", False), ("why", False)),
             lambda m: m.kind if m.kind in ("server", "admin") else m.id),
            ("sdk", {s.id: s for s in old.sdks}, {s.id: s for s in new.sdks}, sdk_line,
             (("source", True), ("provider", True), ("package", True), ("version", True), ("title", False), ("why", False)), lambda s: s.id),
            ("deployment", {d.part: d for d in old.deployment}, {d.part: d for d in new.deployment}, deployment_line,
             (("host", True), ("database", True), ("cache", True)), lambda d: d.part)):
        diff.added += [Item(kind, i, line(v), key=key_of(v)) for i, v in after.items() if i not in before]
        diff.removed += [Item(kind, i, line(v), key=key_of(v)) for i, v in before.items() if i not in after]
        for identifier, value in after.items():
            if identifier in before:
                pieces, decision = differences(before[identifier], value, fields)
                if pieces:
                    diff.changed.append(Item(kind, identifier, f"{identifier}: " + "; ".join(pieces), decision, key_of(value)))
    oq, nq = {q.id: q for q in old.open_questions}, {q.id: q for q in new.open_questions}
    diff.questions += [f"new: {q.question}" for i, q in nq.items() if i not in oq]
    diff.questions += [f"removed: {q.question}" for i, q in oq.items() if i not in nq]
    diff.questions += [f"answered: {q.question} -> {q.answer}" for i, q in nq.items() if i in oq and q.answer and q.answer != oq[i].answer]
    before, after = old.to_dict(), new.to_dict()
    for key, label in (("system", "system"), ("languages", "languages"), ("countries", "countries"), ("currency", "currency"), ("time_zones", "time zones")):
        if before[key] != after[key]:
            if isinstance(before[key], dict):
                changed = [f"{k} {before[key].get(k)} -> {after[key].get(k)}" for k in after[key] if before[key].get(k) != after[key].get(k)]
                diff.other.append(f"{label}: " + "; ".join(changed))
            else:
                diff.other.append(f"{label}: {', '.join(before[key]) or 'none'} -> {', '.join(after[key]) or 'none'}")
    if before["business"] != after["business"]:
        diff.other.append("the business description (summary, actors, rules, entities, jobs) changed; the documents that read it are rewritten")
    if before["rules"] != after["rules"]:
        diff.other.append("the delivery rule settings changed (rules.md and the hooks follow when they are regenerated)")
    return diff


def identity_problems(old: Plan, new: Plan) -> List[str]:
    return [f"{key} {getattr(old.system, key)!r} -> {getattr(new.system, key)!r}" for key in IDENTITY if getattr(old.system, key) != getattr(new.system, key)]


def carry_over(old: Plan, new: Plan, catalog: Catalog, say: Say) -> Plan:
    """What a new analysis must not lose: the system identity (folders are named from it), the answers to open questions and the rule settings."""
    data, previous = new.to_dict(), old.to_dict()
    if data["system"] != previous["system"]:
        say("The system name and identifiers cannot change in an update (folders are named from them): the saved ones are kept.")
        data["system"] = previous["system"]
    answers = {q["id"]: q["answer"] for q in previous["open_questions"] if q.get("answer")}
    for question in data["open_questions"]:
        if not question.get("answer") and question["id"] in answers:
            question["answer"] = answers[question["id"]]
    if not data["rules"] and previous["rules"]:
        data["rules"] = previous["rules"]
    return Plan.from_dict(data, catalog)


# ---------- the system on disk ----------

def digest(path: Path) -> str:
    if path.is_symlink():
        return "link:" + os.readlink(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree(root: Path) -> Dict[str, Path]:
    found: Dict[str, Path] = {}
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if (path.is_file() or path.is_symlink()) and not SKIP_PARTS & set(rel.parts) and rel.name != ".DS_Store":
            found[rel.as_posix()] = path
    return found


def copy_file(source: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if source.is_symlink():
        os.symlink(os.readlink(source), dest)
    else:
        shutil.copy2(source, dest)


def read_registry(root: Path) -> dict:
    return json.loads((root / REGISTRY_REL).read_text(encoding="utf-8"))


def dirty_paths(root: Path) -> Optional[List[str]]:
    """The uncommitted paths of the system's git tree; None when the folder is not in a git work tree (or git is missing)."""
    if shutil.which("git") is None:
        return None
    probe = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=root, capture_output=True, text=True, check=False)
    if probe.returncode != 0 or probe.stdout.strip() != "true":
        return None
    status = subprocess.run(["git", "status", "--porcelain", "--", "."], cwd=root, capture_output=True, text=True, check=False)
    return [line for line in status.stdout.splitlines() if line.strip()] if status.returncode == 0 else None


def one_line(text: str) -> str:
    return " ".join(text.replace("|", "/").split())


def table_rows(text: str, prefix: str) -> List[List[str]]:
    """The cells of every backlog row `| PREFIX-NNN | title | branch | needs | status | notes |`."""
    rows = []
    for line in text.splitlines():
        if re.match(rf"^\|\s*{re.escape(prefix)}-\d+\s*\|", line):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) == 6:
                rows.append(cells)
    return rows


def new_rows(before: str, after: str, prefix: str) -> List[Row]:
    """The backlog rows the plan change adds (by title) as `(title, key, status, notes)`, ready for `append_backlog_rows`."""
    known = {cells[1] for cells in table_rows(before, prefix)}
    rows = []
    for _, title, branch, _, status, notes in table_rows(after, prefix):
        if title not in known:
            match = re.search(r"-\d+-(.+?)`?$", branch)
            rows.append((title, match.group(1) if match else "update", status, notes))
    return rows


# ---------- what the plan change causes ----------

@dataclass
class Changes:
    new_parts: Dict[str, dict] = field(default_factory=dict)        # registry key -> entry, registered and copied
    copy: List[Tuple[str, Path]] = field(default_factory=list)      # (path in the system, file of the rendering)
    kept: List[str] = field(default_factory=list)                   # exists and the generated version differs: kept
    left_alone: List[str] = field(default_factory=list)             # a new part whose folder (or prefix) is taken
    not_removed: List[str] = field(default_factory=list)            # no longer generated; stays
    rows: List[Tuple[str, str, List[Row]]] = field(default_factory=list)   # (backlog path, prefix, rows to append)
    pending_titles: List[str] = field(default_factory=list)

    def add_rows(self, projects: Dict[str, dict], key: str, rows: List[Row]) -> None:
        entry = projects.get(key) or next(iter(projects.values()))
        self.rows.append((entry["backlog"], entry["prefix"], rows))


def keys_of(item: Item, projects: Dict[str, dict]) -> List[str]:
    if item.kind == "module":
        return [k for k in (item.key, f"{item.key}-web") if k in projects]
    return [item.key] if item.key in projects else []


def decision(title: str, key: str, note: str) -> Row:
    return (one_line(title), key, "PENDING", one_line("Owner decision: " + note))


def plan_changes(root: Path, diff: PlanDiff, tree_a: Dict[str, Path], tree_b: Dict[str, Path], registry_a: dict, registry_b: dict) -> Changes:
    """Pure: compares the two renderings with each other and with the system; nothing is written."""
    changes = Changes()
    target = read_registry(root)
    projects = target["projects"]
    prefixes = {p["prefix"] for p in projects.values()}
    dirs_b = {k: e["dir"] for k, e in registry_b["projects"].items()}
    skipped: List[str] = []
    for key, entry in registry_b["projects"].items():
        if key in projects:
            continue
        if (root / entry["dir"]).exists() or entry["prefix"] in prefixes:
            reason = f"{entry['dir']}/ already exists" if (root / entry["dir"]).exists() else f"the task prefix {entry['prefix']} is taken"
            changes.left_alone.append(f"{entry['dir']}/ (new part `{key}`): {reason}, so it was not generated or registered")
            changes.add_rows(projects, "server", [decision(f"New part `{key}` was not generated: {reason}", f"new-part-{key}",
                                                           f"move {entry['dir']}/ away (or pick another prefix) and run the update again, or register it by hand.")])
            skipped.append(key)
            continue
        changes.new_parts[key] = entry
        prefixes.add(entry["prefix"])
    owners = {entry["dir"]: key for key, entry in registry_b["projects"].items() if key not in projects}
    backlogs = {e["backlog"]: (k, e["prefix"]) for k, e in projects.items()}
    removed_keys = [k for k in registry_a["projects"] if k not in registry_b["projects"] and k in projects]
    removed_dirs = [projects[k]["dir"] for k in removed_keys]

    def owner_of(rel: str) -> Optional[str]:
        return next((key for directory, key in owners.items() if rel == directory or rel.startswith(directory + "/")), None)

    for rel, source in tree_b.items():
        if rel == REGISTRY_POSIX or rel == target.get("board_file", BOARD_FILE):
            continue
        owner = owner_of(rel)
        if owner in skipped:
            continue
        added = rel not in tree_a
        changed = not added and digest(tree_a[rel]) != digest(source)
        if not (added or changed):
            continue
        dest = root / rel
        if rel in backlogs and (dest.is_file()) and not added:
            key, prefix = backlogs[rel]
            rows = new_rows(tree_a[rel].read_text(encoding="utf-8"), source.read_text(encoding="utf-8"), prefix)
            if rows:
                changes.rows.append((rel, prefix, rows))
            continue
        if dest.exists() or dest.is_symlink():
            if digest(dest) != digest(source):
                changes.kept.append(rel)
        elif added:
            changes.copy.append((rel, source))
    gone: Dict[str, List[str]] = {}   # files that are no longer generated, grouped by the part they are in
    part_dirs = sorted((e["dir"] for e in projects.values()), key=len, reverse=True)
    for rel in tree_a:
        if rel not in tree_b and (root / rel).exists() and not any(rel.startswith(d + "/") for d in removed_dirs):
            gone.setdefault(next((d for d in part_dirs if rel.startswith(d + "/")), rel), []).append(rel)
    changes.not_removed += [f"{group}/: {len(files)} file(s) are no longer generated (for example {files[0]})" if group != files[0] else files[0]
                            for group, files in gone.items()]
    for key in removed_keys:
        entry = projects[key]
        changes.not_removed.append(f"{entry['dir']}/ (`{key}`)")
        changes.add_rows(projects, key, [decision(f"Decide what to do with {entry['dir']}/: it is no longer in the plan", f"remove-{key}",
                                                  f"nothing was deleted. Keep {entry['dir']}/ or remove it together with `{key}` in {REGISTRY_REL} and its backlog.")])
    for item in diff.removed:
        if item.kind == "deployment":
            changes.add_rows(projects, item.key if item.key in projects else "server",
                             [decision(f"Deployment of {item.id} is no longer in the plan", f"undeploy-{item.id}",
                                       f"{item.text}. The host files already written were not removed; delete them or keep the deployment.")])
    for item in diff.changed:
        keys = keys_of(item, projects)
        if item.pending and not any(k in removed_keys for k in keys):
            changes.add_rows(projects, keys[0] if keys else "server",
                             [decision(f"The plan changed {item.kind} {item.id}: bring the generated part in line", f"update-{item.kind}-{item.id}",
                                       f"{item.text}. The generated folder was not changed; apply this by hand, or move the folder away and run the update again.")])
    changes.pending_titles = [row[0] for _, _, rows in changes.rows for row in rows if row[2] == "PENDING"]
    return changes


# ---------- applying the additions ----------

def add_integration_rows(path: Path, projects: Dict[str, dict], keys: List[str]) -> List[str]:
    """One row per new part in the parts table (§1) of INTEGRATION.md, after the last row of the table."""
    if not path.is_file() or not keys:
        return []
    lines = path.read_text(encoding="utf-8").split("\n")
    start = next((i for i, line in enumerate(lines) if line.startswith("## 1.")), None)
    if start is None:
        return []
    last, body = None, []
    for i in range(start + 1, len(lines)):
        if lines[i].startswith("## "):
            break
        if lines[i].startswith("|"):
            last, body = i, body + [lines[i]]
    if last is None:
        return []
    existing = "\n".join(body)
    added = [key for key in keys if f"| `{key}` |" not in existing]
    rows = [f"| `{key}` | `{projects[key]['dir']}/` | {projects[key]['title']} | `{projects[key]['master']}` | `{projects[key]['backlog']}` "
            f"({projects[key]['prefix']}-) | `{projects[key]['dir']}/.claude/{{session,memory,Integration}}.md` |" for key in added]
    if rows:
        lines[last + 1:last + 1] = rows
        path.write_text("\n".join(lines), encoding="utf-8")
    return added


def refresh_board(root: Path, board_file: str) -> None:
    """Regenerates the board of INTEGRATION.md when it already holds one (it is machine-written between its markers)."""
    path = root / board_file
    if not path.is_file() or not (root / TASKS_TOOL_REL).is_file():
        return
    text = path.read_text(encoding="utf-8")
    if BOARD_START not in text or BOARD_END not in text or BOARD_PLACEHOLDER in text.split(BOARD_START, 1)[1].split(BOARD_END, 1)[0]:
        return
    subprocess.run(["python3", str(root / TASKS_TOOL_REL), "board"], cwd=root, capture_output=True, text=True, check=False)


def apply_changes(root: Path, changes: Changes) -> Tuple[int, List[str]]:
    """Copies the new files, registers the new parts, appends the rows. Returns (files copied, ids of the rows added)."""
    for rel, source in changes.copy:
        copy_file(source, root / rel)
    registry = read_registry(root)
    if changes.new_parts:
        registry["projects"].update(changes.new_parts)
        (root / REGISTRY_REL).write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        add_integration_rows(root / registry.get("board_file", BOARD_FILE), registry["projects"], list(changes.new_parts))
    ids: List[str] = []
    for rel, prefix, rows in changes.rows:
        text = (root / rel).read_text(encoding="utf-8") if (root / rel).is_file() else ""
        fresh = [row for row in rows if f"| {row[0]} |" not in text]
        added = append_backlog_rows(root / rel, prefix, fresh)
        ids += [f"{i} in {rel}" for i in added]
    refresh_board(root, registry.get("board_file", BOARD_FILE))
    return len(changes.copy), ids


# ---------- the command ----------

def parse_update(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="SYSTEM_SETUP update", description="The business changed: a changed business document (or a changed plan) is "
                                     "compared with the system's saved plan, and the system follows with additions only. Nothing is overwritten or deleted, "
                                     "and nothing is committed.")
    parser.add_argument("--target", type=Path, default=None, help="the generated system (default: the current folder)")
    parser.add_argument("--business-doc", type=Path, metavar="FILE", help="the changed business document; analyzed again when it differs from docs/BUSINESS.md")
    parser.add_argument("--plan", type=Path, metavar="FILE", help=f"a changed {PLAN_FILE}: used as it is, no model is used for the plan")
    parser.add_argument("--yes", action="store_true", help="accept the proposal and apply it; never prompt")
    parser.add_argument("--no-documents", action="store_true", help="do not rewrite the documents with the model")
    parser.add_argument("--allow-dirty", action="store_true", help="work although the git tree has uncommitted changes")
    parser.add_argument("--templates", type=Path, default=None, help="templates folder (default: the tool's templates/)")
    parser.add_argument("--knowledge", type=Path, default=None, help="folder of lessons and playbooks (default: the tool's knowledge/)")
    parser.add_argument("--documents-budget", type=float, metavar="USD", help="total budget of the document step (default: catalog/documents.json)")
    return parser.parse_args(argv)


def render_into(plan: Plan, catalog: Catalog, templates: Path, knowledge: Optional[Path], generate: Callable, base: Path, name: str) -> Tuple[Path, dict]:
    target = base / name
    generate(plan_to_spec(plan, target, catalog).spec, templates, run_post=False, git=False, knowledge=knowledge)
    return target, read_registry(target)


def listed(lines: List[str], say: Say, indent: str = "    ") -> None:
    for line in lines[:MAX_LISTED]:
        say(f"{indent}{line}")
    if len(lines) > MAX_LISTED:
        say(f"{indent}... and {len(lines) - MAX_LISTED} more")


def run_update(argv: List[str], generate: Callable, analyzer: Optional[Analyzer] = None, reader: Callable[[str], str] = input,
               say: Say = print) -> int:
    args = parse_update(argv)
    root = (args.target or Path.cwd()).expanduser().resolve()
    try:
        catalog, settings = load_catalog(), load_analyzer_settings()
        if not (root / PLAN_FILE).is_file() or not (root / REGISTRY_REL).is_file():
            say(f"{root} is not a system made by SYSTEM_SETUP: {PLAN_FILE} or {REGISTRY_REL} is missing. Use --target to name the system.")
            return 2
        old = load_plan(root / PLAN_FILE, catalog)
    except (CatalogError, PlanError) as error:
        say(str(error))
        return 2
    dirty = dirty_paths(root)
    if dirty and not args.allow_dirty:
        say(f"The git tree of {root} has uncommitted changes, and the update must be reviewable on its own:")
        listed(dirty, say, "  ")
        say("Commit or stash them, then run the update again (or pass --allow-dirty).")
        return 1
    if dirty is None:
        say("Note: this folder is not in a git repository, so there is nothing to review the update with; the commit commands are not shown.")
    say("SYSTEM_SETUP: update the system from a changed business\n")
    saved_path = root / BUSINESS_DOC_REL
    saved = saved_path.read_text(encoding="utf-8") if saved_path.is_file() else None
    document, changed_document = saved, False
    try:
        if args.business_doc is not None:
            try:
                document = args.business_doc.expanduser().read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as error:
                say(f"Cannot read the business document {args.business_doc}: {error}")
                return 2
            changed_document = document_changed(root, document, saved)
        if args.plan:
            new = load_plan(args.plan.expanduser(), catalog)
            say(f"Plan {args.plan} is valid; no model is used for the plan.")
            problems = identity_problems(old, new)
            if problems:
                say("The system name and identifiers cannot change in an update (folders are named from them): " + "; ".join(problems))
                return 2
        else:
            if args.business_doc is None:
                if args.yes:
                    say("Pass --business-doc FILE (the changed document) or --plan FILE with --yes.")
                    return 2
                path = Path(ask("Path of the changed business document", str(BUSINESS_DOC_REL), validate_required, reader)).expanduser()
                try:
                    document = path.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError) as error:
                    say(f"Cannot read the business document {path}: {error}")
                    return 2
                changed_document = document_changed(root, document, saved)
            if not changed_document:
                say("The business document is the same as the saved one (docs/BUSINESS.md): there is nothing to analyze. "
                    "Pass the changed document with --business-doc, or a changed plan with --plan.")
                return 0
            say(f"Analyzing the changed document (one model call, at most ${settings.max_budget_usd:.2f}) ...")
            proposal = propose(analyzer or ClaudeAnalyzer(settings), document, catalog, settings.max_budget_usd, say)
            say(f"Analysis cost: ${proposal.cost_usd:.4f} ({proposal.attempts} model call{'s' if proposal.attempts != 1 else ''}).")
            new = carry_over(old, proposal.plan, catalog, say)
    except PlanError as error:
        say(str(error))
        return 2
    except PlanRejected as error:
        say(str(error))
        return 1
    except AnalyzerError as error:
        say(f"Analysis failed: {error}")
        return 1
    diff = plan_diff(old, new)
    say("What the change means for the plan:")
    for line in diff.render():
        say(line)
    new = review(new, catalog, reader, say, yes=args.yes)
    problems = identity_problems(old, new)
    if problems:
        say("The system name and identifiers cannot change in an update (folders are named from them): " + "; ".join(problems))
        return 2
    again = plan_diff(old, new)
    if again.render() != diff.render():
        say("\nAfter your review the plan differs from the saved one like this:")
        for line in again.render():
            say(line)
    diff = again
    if new.to_dict() == old.to_dict() and not changed_document:
        say("\nNothing to update: the plan and the document are unchanged.")
        return 0
    doc_settings = None
    if args.no_documents:
        say("--no-documents: the documents are not rewritten.")
    elif document is None:
        say("No business document is saved or given, so no model is used and the documents stay as they are.")
    else:
        try:
            doc_settings = load_document_settings()
        except CatalogError as error:
            say(str(error))
            return 1
    templates = (args.templates or templates_root()).resolve()
    scratch = Path(tempfile.mkdtemp(prefix="system_setup_update_"))
    try:
        try:
            tree_a_root, registry_a = render_into(old, catalog, templates, args.knowledge, generate, scratch, "before")
            tree_b_root, registry_b = render_into(new, catalog, templates, args.knowledge, generate, scratch, "after")
        except (EngineError, ManifestError, OSError) as error:
            say(f"\nThe system could not be rendered from the plan, so nothing was changed:\n{error}")
            return 1
        changes = plan_changes(root, diff, tree(tree_a_root), tree(tree_b_root), registry_a, registry_b)
        say("\nThe update will:")
        names = ", ".join(f"{e['dir']}/ (`{k}`)" for k, e in changes.new_parts.items()) or "none"
        say(f"  add {len(changes.new_parts)} new part(s): {names}")
        say(f"  copy {len(changes.copy)} new file(s); keep {len(changes.kept)} existing file(s) whose generated version differs")
        say(f"  add {len(changes.pending_titles)} PENDING row(s) for what it does not do itself ({len(changes.not_removed)} item(s) no longer generated stay in place)")
        if doc_settings is not None:
            say(f"  then rewrite only the documents whose inputs changed (one small call each, at most ${args.documents_budget if args.documents_budget is not None else doc_settings.max_budget_total_usd:.2f} in all)")
        if not args.yes and not is_yes(ask("Apply? (yes/no)", "yes", yes_no, reader)):
            say("Cancelled. Nothing was changed.")
            return 1
        copied, row_ids = apply_changes(root, changes)
        outcome = None
        if doc_settings is not None and document is not None:
            writer = analyzer or ClaudeAnalyzer(AnalyzerSettings(settings.claude_bin, doc_settings.model, doc_settings.max_budget_per_call_usd,
                                                                  doc_settings.timeout_seconds))
            budget = args.documents_budget if args.documents_budget is not None else doc_settings.max_budget_total_usd
            try:
                outcome = run_documents(root, new, document, catalog, writer, doc_settings, say, budget,
                                        f"SYSTEM_SETUP documents --target {root}", protect_edited=True)
            except KeyboardInterrupt:
                say("\nInterrupted. The additions are applied and the plan is not updated yet: run the same update again, nothing is repeated or overwritten.")
                return 130
            except DocumentsError as error:
                say(f"\n{error}\nThe additions are applied and the plan is not updated yet: fix the problem and run the same update again.")
                return 1
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    ok, output = run_tasks_check(root)
    say(f"\ntasks.py check: {'OK' if ok else 'skipped' if ok is None else 'PROBLEMS'}" + (f"\n{output}" if output and not ok else ""))
    if ok is False:
        say(f"The additions are applied but the plan {PLAN_FILE} is NOT updated, because the check found problems. "
            "Fix them and run the same update again: nothing is repeated or overwritten.")
        return 1
    (root / PLAN_FILE).write_text(dumps(new), encoding="utf-8")
    if changed_document and document is not None:
        saved_path.parent.mkdir(parents=True, exist_ok=True)
        saved_path.write_text(document if document.endswith("\n") else document + "\n", encoding="utf-8")
        analyzed = root / ANALYZED_DOC_REL
        analyzed.parent.mkdir(parents=True, exist_ok=True)
        analyzed.write_text(sha(document.strip()) + "\n", encoding="utf-8")
    print_summary(root, changes, copied, row_ids, outcome, changed_document, dirty is not None, say)
    return 0 if outcome is None or not (outcome.unfinished or outcome.stopped) else 1


def document_changed(root: Path, document: str, saved: Optional[str]) -> bool:
    """Against what the plan was last analyzed from, so editing docs/BUSINESS.md in place and passing it back counts as a change."""
    recorded = root / ANALYZED_DOC_REL
    if recorded.is_file():
        return sha(document.strip()) != recorded.read_text(encoding="utf-8").strip()
    return saved is None or document.strip() != saved.strip()


def print_summary(root: Path, changes: Changes, copied: int, row_ids: List[str], outcome, changed_document: bool, in_git: bool, say: Say) -> None:
    say(f"\nDone. {PLAN_FILE} is updated" + (" and docs/BUSINESS.md holds the changed document." if changed_document else "."))
    say(f"  Added: {len(changes.new_parts)} new part(s), {copied} file(s)" + (f"; {len(row_ids)} backlog row(s)" if row_ids else ""))
    for key, entry in changes.new_parts.items():
        say(f"    - {entry['dir']}/ registered as `{key}` (tasks {entry['prefix']}-, master {entry['master']})")
    if changes.kept:
        say(f"  Kept as they are, the generated version differs ({len(changes.kept)}); merge by hand if you want the change:")
        listed(changes.kept, say)
    if changes.left_alone:
        say(f"  Left alone ({len(changes.left_alone)}):")
        listed(changes.left_alone, say)
    if changes.not_removed:
        say(f"  Not removed ({len(changes.not_removed)}): no longer generated, it stays until you decide; PENDING rows were added:")
        listed(changes.not_removed, say)
    if row_ids:
        say("  New backlog rows:")
        listed(row_ids, say)
    if outcome is not None and outcome.notes:
        say("  Documents:")
        listed(outcome.notes, say)
    proposed = sorted(p for p in (outcome.created if outcome else []) if ".proposed." in p)
    if proposed:
        say(f"  Your edited documents were kept; the new text is next to them ({len(proposed)}): " + ", ".join(proposed))
    if in_git:
        say(f"\nNothing was committed. Review and commit:\n  git -C {root} status\n  git -C {root} diff\n"
            f"  git -C {root} add -A && git -C {root} commit -m \"SYSTEM_SETUP update: follow the changed plan\"")
        masters = sorted({e["master"] for e in changes.new_parts.values()})
        for master in masters:
            if subprocess.run(["git", "rev-parse", "--verify", "-q", f"refs/heads/{master}"], cwd=root, capture_output=True, check=False).returncode != 0:
                say(f"  git -C {root} branch {master} main   # the master branch of a new part (after the commit)")
