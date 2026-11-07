"""The delivery rules of the generated workspace: `catalog/rules.json` lists every rule of `templates/workspace/.claude/rules.md`
(id, title, a pointer to its text, a safety flag, the hooks that enforce it). The plan's `rules` block overrides per rule: on, off or
edited text. From that this module renders the generated `.claude/rules.md` and the `rules` map of `.claude/projects.json` that the
generated hooks read, so a rule that is off is not enforced. Data only in the catalog; no model is involved."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from catalog import CATALOG_DIR, CatalogError
from manifest import tool_root

RULES_FILE = "rules.json"
RULES_MD_REL = Path(".claude") / "rules.md"
STATES = ("on", "off")
RULE_ID_RE = re.compile(r"^[a-z][a-z0-9-]{1,39}$")
HEADING_RE = re.compile(r"^## (\d+)\. ")
NUMBERED_RE = re.compile(r"^(\d+)\. ")
BULLET_RE = re.compile(r"^- ")
SUB_RE = re.compile(r"^(\s+)- ")
MARKER_RE = re.compile(r"^(\d+\. |- |\s+- )")
OFF_NOTE = "turned off in this system's plan; the hooks do not enforce it."
SAFETY_NOTE = "A safety rule, turned off with the owner's confirmation."


@dataclass(frozen=True)
class RuleDef:
    id: str
    section: str          # "3.1" = item 1 of section 3; "3.2.1" = the first clause under item 2
    title: str
    safety: bool = False
    enforced_by: tuple = ()


@dataclass
class RuleSetting:
    """One entry of the plan's `rules` list. `text` is an edited wording; `confirmed` records the extra confirmation of a safety rule."""
    id: str = ""
    state: str = "on"
    text: str = ""
    confirmed: bool = False


def load_rule_defs(root: Optional[Path] = None) -> List[RuleDef]:
    path = (root or tool_root() / CATALOG_DIR) / RULES_FILE
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CatalogError(f"{path}: cannot read the rules ({error})")
    items = data.get("rules") if isinstance(data, dict) else None
    if not isinstance(items, list) or not items:
        raise CatalogError(f"{path}: `rules` must be a non-empty list")
    defs = []
    for item in items:
        if not isinstance(item, dict) or not all(isinstance(item.get(k), str) and item[k].strip() for k in ("id", "section", "title")):
            raise CatalogError(f"{path}: every rule needs an `id`, a `section` and a `title` (got {item!r})")
        if not RULE_ID_RE.match(item["id"]):
            raise CatalogError(f"{path}: rule id {item['id']!r} must be lowercase letters, digits and '-'")
        defs.append(RuleDef(item["id"], item["section"], item["title"], bool(item.get("safety")), tuple(item.get("enforced_by") or ())))
    for key in ("id", "section"):
        values = [getattr(d, key) for d in defs]
        duplicates = sorted({v for v in values if values.count(v) > 1})
        if duplicates:
            raise CatalogError(f"{path}: duplicate {key}(s): {', '.join(duplicates)}")
    return defs


def find_def(defs: Iterable[RuleDef], rule_id: str) -> Optional[RuleDef]:
    return next((d for d in defs if d.id == rule_id), None)


# ---------- the template ----------

def parse_items(text: str) -> Dict[str, int]:
    """Section pointer -> line index of every rule of rules.md: numbered items and bullets of each `## N.` section, and the
    indented bullets under an item as clauses (N.M.K)."""
    found: Dict[str, int] = {}
    section = item = None
    bullets = clauses = 0
    for index, line in enumerate(text.split("\n")):
        heading = HEADING_RE.match(line)
        if heading:
            section, item, bullets = heading.group(1), None, 0
        elif section is None:
            continue
        elif NUMBERED_RE.match(line):
            item, clauses = NUMBERED_RE.match(line).group(1), 0
            found[f"{section}.{item}"] = index
        elif BULLET_RE.match(line):
            bullets += 1
            item, clauses = str(bullets), 0
            found[f"{section}.{item}"] = index
        elif SUB_RE.match(line) and item:
            clauses += 1
            found[f"{section}.{item}.{clauses}"] = index
    return found


def template_problems(text: str, defs: List[RuleDef]) -> List[str]:
    """Rules of the template without a catalog entry, and catalog entries that point at nothing."""
    items = parse_items(text)
    pointed = {d.section for d in defs}
    return ([f"rules.md item {key} has no entry in catalog/rules.json" for key in items if key not in pointed]
            + [f"catalog rule {d.id!r} points at {d.section}, which rules.md does not have" for d in defs if d.section not in items])


def by_id(settings: Iterable[RuleSetting]) -> Dict[str, RuleSetting]:
    return {s.id: s for s in settings}


def rules_map(defs: List[RuleDef], settings: Iterable[RuleSetting]) -> Dict[str, bool]:
    """What the generated hooks read: every catalog rule, true unless the plan turned it off."""
    chosen = by_id(settings)
    return {d.id: not (d.id in chosen and chosen[d.id].state == "off") for d in defs}


def safety_off(defs: List[RuleDef], settings: Iterable[RuleSetting]) -> List[RuleDef]:
    chosen = by_id(settings)
    return [d for d in defs if d.safety and d.id in chosen and chosen[d.id].state == "off"]


def render_rules(text: str, defs: List[RuleDef], settings: Iterable[RuleSetting]) -> str:
    """The template text with every rule tagged by its id, a rule that is off struck through and an edited rule replaced."""
    lines, items, chosen = text.split("\n"), parse_items(text), by_id(settings)
    for rule in defs:
        index = items.get(rule.section)
        if index is None:
            continue
        marker = MARKER_RE.match(lines[index]).group(0)
        setting = chosen.get(rule.id)
        if setting is not None and setting.state == "off":
            body, tag = f"~~{rule.title}~~ {SAFETY_NOTE if rule.safety else ''} Rule {OFF_NOTE}".replace("  ", " "), f"`{rule.id}`, off"
        elif setting is not None and setting.text:
            body, tag = setting.text, f"`{rule.id}`, edited in the plan"
        else:
            body, tag = lines[index][len(marker):], f"`{rule.id}`"
        lines[index] = f"{marker}{body} ({tag})"
    return "\n".join(lines)


def write_rules(repo_root: Path, defs: List[RuleDef], settings: Iterable[RuleSetting]) -> Optional[str]:
    """Renders the generated `.claude/rules.md` in place; returns its relative path, or None when the workspace template has none."""
    path = repo_root / RULES_MD_REL
    if not path.is_file():
        return None
    path.write_text(render_rules(path.read_text(encoding="utf-8"), defs, settings), encoding="utf-8")
    return RULES_MD_REL.as_posix()
