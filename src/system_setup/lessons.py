"""`knowledge/LESSONS.md`: lessons with a stable ID, tags and how each is enforced, kept as readable Markdown (one line per lesson).

    - **L-012** · `server` `sdk` · `rule` — the lesson, with its why.

A generated project gets only the lessons that match its modules; a project's own lessons come back through `lessons import`, which
removes duplicates (normalized text, then a close match with `difflib`) and business names. Standard library only, no model."""
from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Set, Tuple

ENFORCEMENTS = ("rule", "policy-check", "template", "note")
MODULE_TAGS = ("server", "web", "kmp", "android", "ios", "sdk")   # a lesson with one of these is for projects that have such a module
PLATFORM_TAGS = ("android", "ios")                                # more specific than kmp: a lesson tagged with one needs that platform
LESSONS_FILE = "LESSONS.md"
LOCAL_FILE = "LESSONS.local.md"
IMPORT_GROUP = "Learned from projects"
CLOSE_MATCH = 0.85
LESSON_RE = re.compile(r"^- \*\*(L-\d{3,})\*\* · ((?:`[a-z0-9-]+` ?)+) · `([a-z-]+)` — (\S.*)$")
GROUP_RE = re.compile(r"^## (\d+)\. (.+)$")
LOCAL_RE = re.compile(r"^- \[([A-Z][A-Z0-9]*-\d+[a-z]?)\] (.+)$")
TAG_RE = re.compile(r"^[a-z][a-z0-9-]{1,19}$")
PRIVATE_PATTERNS = {
    "an e-mail address": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "a web address": re.compile(r"https?://[^\s,;)\]]+"),
    "an absolute path": re.compile(r"(?:/Users/|/home/|/var/|[A-Za-z]:\\)[^\s,;)\]]+"),
    "an IP address": re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b"),
}
GENERIC_WORDS = {"server", "admin", "web", "app", "apps", "api", "sdk", "android", "ios", "mobile", "backend", "frontend", "panel", "dashboard",
                 "system", "user", "users", "portal", "main", "common"}
MIN_NAME = 3


class LessonsError(ValueError):
    pass


@dataclass
class Lesson:
    id: str
    tags: List[str]
    enforcement: str
    text: str

    def line(self) -> str:
        return f"- **{self.id}** · {' '.join(f'`{t}`' for t in self.tags)} · `{self.enforcement}` — {self.text}"


@dataclass
class Group:
    heading: str
    lessons: List[Lesson] = field(default_factory=list)


@dataclass
class Document:
    header: str
    groups: List[Group] = field(default_factory=list)

    def lessons(self) -> List[Lesson]:
        return [lesson for group in self.groups for lesson in group.lessons]

    def render(self) -> str:
        parts = [self.header.rstrip("\n") + "\n"]
        for group in self.groups:
            parts.append(group.heading + "\n" + "".join(lesson.line() + "\n" for lesson in group.lessons))
        return "\n".join(parts)


def parse(text: str, source: str = LESSONS_FILE) -> Document:
    """Reads the Markdown; any bullet that is not a well-formed lesson, or a repeated ID, is an error naming its line."""
    header: List[str] = []
    groups: List[Group] = []
    seen: Set[str] = set()
    for number, line in enumerate(text.split("\n"), start=1):
        if GROUP_RE.match(line):
            groups.append(Group(line))
        elif not groups:
            header.append(line)
        elif line.startswith("- "):
            found = LESSON_RE.match(line)
            if not found:
                raise LessonsError(f"{source}:{number}: not a lesson line (expected `- **L-NNN** · `tag` · `enforcement` — text`)")
            lesson = Lesson(found.group(1), re.findall(r"`([^`]+)`", found.group(2)), found.group(3), found.group(4).strip())
            if lesson.enforcement not in ENFORCEMENTS:
                raise LessonsError(f"{source}:{number}: enforcement {lesson.enforcement!r} is not one of {', '.join(ENFORCEMENTS)}")
            if lesson.id in seen:
                raise LessonsError(f"{source}:{number}: {lesson.id} is used twice")
            seen.add(lesson.id)
            groups[-1].lessons.append(lesson)
        elif line.strip():
            raise LessonsError(f"{source}:{number}: text between lessons; keep notes in the header")
    return Document("\n".join(header), groups)


def module_tags(spec) -> Set[str]:
    """Module tags of a Spec (what the system builds): server, web (admin and web apps), kmp + the app platforms, sdk."""
    tags: Set[str] = set()
    if spec.with_server:
        tags.add("server")
    if spec.with_admin or spec.webs:
        tags.add("web")
    for app in spec.apps:
        tags.update({"kmp", *app.platforms})
    if spec.sdks or getattr(spec, "published_sdks", None):
        tags.add("sdk")
    return tags


def matches(lesson: Lesson, project_tags: Iterable[str]) -> bool:
    """A lesson with no module tag applies to every project; otherwise one of its module tags must be among the project's, and a
    lesson tagged with a platform (android, ios) needs one of those platforms, not just a kmp app."""
    project_tags = set(project_tags)
    platforms = [t for t in lesson.tags if t in PLATFORM_TAGS]
    needed = platforms or [t for t in lesson.tags if t in MODULE_TAGS]
    return not needed or bool(set(needed) & project_tags)


def select(document: Document, project_tags: Iterable[str]) -> Document:
    project_tags = set(project_tags)
    groups = [Group(g.heading, [l for l in g.lessons if matches(l, project_tags)]) for g in document.groups]
    return Document(document.header, [g for g in groups if g.lessons])


def for_project(text: str, project_tags: Iterable[str]) -> str:
    """The text of the lessons file a generated project gets: the matching lessons only; the header says for which modules."""
    tags = sorted(set(project_tags))
    full = parse(text)
    chosen = select(full, tags)
    chosen.header = (chosen.header.rstrip("\n") + f"\n>\n> **This copy is for a project with: {', '.join(tags) or 'no module tags'}.** "
                     f"{len(chosen.lessons())} of {len(full.lessons())} lessons match; `SYSTEM_SETUP lessons list` (in the tool) shows all.\n")
    return chosen.render()


def next_id(document: Document) -> str:
    numbers = [int(l.id[2:]) for l in document.lessons()]
    return f"L-{(max(numbers) if numbers else 0) + 1:03d}"


def add(document: Document, lessons: List[Lesson]) -> None:
    """Appends to the group `Learned from projects`, created after the last group when missing."""
    group = next((g for g in document.groups if g.heading.endswith(f". {IMPORT_GROUP}")), None)
    if group is None:
        last = max((int(GROUP_RE.match(g.heading).group(1)) for g in document.groups), default=0)
        group = Group(f"## {last + 1}. {IMPORT_GROUP}")
        document.groups.append(group)
    group.lessons.extend(lessons)


# ---------- the project's own lessons ----------

def parse_local(text: str) -> List[Tuple[str, str]]:
    return [(m.group(1), m.group(2).strip()) for m in (LOCAL_RE.match(line) for line in text.split("\n")) if m]


# ---------- duplicates ----------

def normalize(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


def find_duplicate(text: str, known: Iterable[Tuple[str, str]]) -> Optional[Tuple[str, str]]:
    """(id, 'same' | 'close') of the first known lesson with the same normalized text, else of the closest one at or above CLOSE_MATCH."""
    wanted, best = normalize(text), None
    for ident, other in known:
        other_norm = normalize(other)
        if other_norm == wanted:
            return ident, "same"
        ratio = difflib.SequenceMatcher(None, wanted, other_norm).ratio()
        if ratio >= CLOSE_MATCH and (best is None or ratio > best[0]):
            best = (ratio, ident)
    return (best[1], "close") if best else None


# ---------- business names and private patterns ----------

def names_from_plan(plan: dict, extra: Iterable[str] = ()) -> List[str]:
    """The names of one system that must not enter the tool: system name/slug/prefix/package/scope, modules, actors, task prefixes."""
    system = plan.get("system") or {}
    found = [system.get(k, "") for k in ("name", "name_ar", "slug", "prefix", "package_root", "npm_scope")]
    for module in plan.get("modules") or []:
        found += [module.get("id", ""), module.get("name", "")]
    for actor in (plan.get("business") or {}).get("actors") or []:
        found.append(actor.get("name", ""))
    found += list(extra)
    names: Dict[str, str] = {}
    for name in found:
        name = (name or "").strip()
        if len(name) >= MIN_NAME and name.lower() not in GENERIC_WORDS:
            names.setdefault(name.lower(), name)
    return sorted(names.values(), key=len, reverse=True)   # longest first: "Acme Shop" before "Acme"


def name_pattern(name: str) -> "re.Pattern[str]":
    words = [re.escape(w) for w in re.split(r"[\s_-]+", name) if w]
    return re.compile(r"(?<![\w])" + r"[\s_-]*".join(words) + r"(?![\w])", re.I)


def scrub(text: str, names: Iterable[str]) -> Tuple[str, List[str]]:
    """The text with every business name and private pattern replaced by `<...>`, and what was found (names, pattern kinds)."""
    found: List[str] = []
    for name in names:
        pattern = name_pattern(name)
        if pattern.search(text):
            found.append(f"the name '{name}'")
            text = pattern.sub("<name>", text)
    for kind, pattern in PRIVATE_PATTERNS.items():
        if pattern.search(text):
            found.append(kind)
            text = pattern.sub("<removed>", text)
    return text, found


def has_secret(text: str) -> bool:
    from review import looks_like_secret   # the same shapes the review refuses; imported late (review needs plan)
    return looks_like_secret(text) or any(looks_like_secret(word) for word in text.split())


def valid_tags(tags: Iterable[str]) -> Optional[str]:
    tags = list(tags)
    if not tags:
        return "give at least one tag"
    bad = [t for t in tags if not TAG_RE.match(t)]
    return f"not a valid tag: {', '.join(bad)} (lowercase letters, digits and '-')" if bad else None
