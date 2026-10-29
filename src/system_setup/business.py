"""The business domain the tool asks about: questions, the answers (`Business`), parsing of a `--business` file
(`.md` with `## <heading>` sections or `.json` with the same keys), the workspace tokens rendered from the answers,
`docs/BUSINESS_INPUT.md` (the raw answers, re-loadable with `--business`) and `docs/AGENT_PROMPT.md` (the filled copy
of the tool's `PROMPT.md` for an agent that works in the generated repo)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Callable, Dict, List, Mapping, Optional

TBD = "TBD"
DEFAULT_LANGUAGE = "ar"
DEFAULT_STORED_TIME_ZONE = "UTC"
RTL_ON, RTL_OFF = "on", "off"
LIST_SEPARATOR = ";"
OPEN_MARK = "open — ask the owner"
PROMPT_FILE = "PROMPT.md"
AGENT_PROMPT_REL = Path("docs") / "AGENT_PROMPT.md"
BUSINESS_INPUT_REL = Path("docs") / "BUSINESS_INPUT.md"
PROMPT_START = "<!-- AGENT_PROMPT:START -->"
PROMPT_END = "<!-- AGENT_PROMPT:END -->"
README_PROMPT_LINK = ("## Give this to your AI agent\n[`docs/AGENT_PROMPT.md`](docs/AGENT_PROMPT.md) — the filled prompt: "
                      "the business, the projects, and the steps to write the PRDs, backlogs and tasks, then work task by task.\n")
HEADING_RE = re.compile(r"^##\s+(.+?)\s*$", re.M)
Reader = Callable[[str], str]


@dataclass(frozen=True)
class Field:
    key: str          # Business attribute, JSON key, flag `--<key with dashes>`
    heading: str      # `## <heading>` in the .md business file and in BUSINESS_INPUT.md
    question: str
    token: str
    kind: str         # "text" (one line), "flag" (on/off), "multiline" (free text), "list" (one item per line or `;`)
    default: str = TBD


FIELDS = (
    Field("summary", "Business summary", "Business summary (~10 lines: actors, what each app lets them do, how money moves "
          "phase 1 vs later; end with an empty line)", "__BUSINESS_SUMMARY__", "multiline"),
    Field("default_language", "Default language", "Default language (BCP-47 code)", "__DEFAULT_LANGUAGE__", "text", DEFAULT_LANGUAGE),
    Field("rtl", "RTL", "Right-to-left layout by default? (on/off)", "__RTL__", "flag", RTL_ON),
    Field("currency", "Currency", "Currency (ISO code)", "__CURRENCY__", "text"),
    Field("currency_minor_unit", "Currency minor unit", "Currency minor unit and decimals (e.g. `<unit>, 3 decimals`)",
          "__CURRENCY_MINOR_UNIT__", "text"),
    Field("stored_time_zone", "Stored time zone", "Time zone timestamps are stored in", "__STORED_TIME_ZONE__", "text",
          DEFAULT_STORED_TIME_ZONE),
    Field("business_time_zone", "Business time zone", "Time zone business dates and hours are computed in (IANA name)",
          "__BUSINESS_TIME_ZONE__", "text"),
    Field("actors", "Actors", "Actors / roles and their permissions (one per line or `;`-separated)", "__BUSINESS_ACTORS__", "list"),
    Field("rules", "Core business rules", "Core business rules (one per line; numbered in the docs)", "__BUSINESS_RULES__", "list"),
    Field("entities", "Entities and states", "Entities and their states / transitions (one per line, e.g. `Order: PENDING -> PAID -> DONE`)",
          "__BUSINESS_ENTITIES__", "list"),
    Field("jobs", "Scheduled jobs", "Scheduled jobs and reminders (one per line)", "__BUSINESS_JOBS__", "list"),
    Field("integrations", "Integrations", "Integrations — OTP, payments, push, storage, maps, analytics — or `decide later` (one per line)",
          "__BUSINESS_INTEGRATIONS__", "list"),
    Field("open_decisions", "Open decisions", "Open decisions only the owner can take (one per line)", "__OPEN_DECISIONS__", "list"),
)
FIELD_BY_KEY = {f.key: f for f in FIELDS}
FIELD_BY_HEADING = {f.heading.lower(): f for f in FIELDS}
TOKENS = tuple(f.token for f in FIELDS)


@dataclass
class Business:
    summary: str = TBD
    default_language: str = DEFAULT_LANGUAGE
    rtl: str = RTL_ON
    currency: str = TBD
    currency_minor_unit: str = TBD
    stored_time_zone: str = DEFAULT_STORED_TIME_ZONE
    business_time_zone: str = TBD
    actors: List[str] = field(default_factory=list)
    rules: List[str] = field(default_factory=list)
    entities: List[str] = field(default_factory=list)
    jobs: List[str] = field(default_factory=list)
    integrations: List[str] = field(default_factory=list)
    open_decisions: List[str] = field(default_factory=list)

    def is_tbd(self, key: str) -> bool:
        value = getattr(self, key)
        return not value or (isinstance(value, str) and value.strip().upper() == TBD)

    def tbd_keys(self) -> List[str]:
        return [f.key for f in FIELDS if f.key != "open_decisions" and self.is_tbd(f.key)]


# ---------- values ----------

def split_items(value: str) -> List[str]:
    """One item per line, each line further split on `;`; blanks dropped; a leading `- ` / `1. ` marker removed."""
    items = []
    for line in value.splitlines():
        for part in line.split(LIST_SEPARATOR):
            item = re.sub(r"^\s*(?:[-*]|\d+[.)])\s+", "", part).strip()
            if item and item.upper() != TBD:
                items.append(item)
    return items


def normalize_flag(value: str) -> Optional[str]:
    text = value.strip().lower()
    if text in ("on", "yes", "y", "true", "1", "rtl"):
        return RTL_ON
    if text in ("off", "no", "n", "false", "0", "ltr"):
        return RTL_OFF
    return None


def validate_flag(value: str) -> Optional[str]:
    return None if normalize_flag(value) else "answer on or off"


def coerce(spec: Field, raw: object) -> object:
    """A raw answer (str or JSON list) into the attribute value of its field."""
    if spec.kind == "list":
        if isinstance(raw, list):
            return split_items("\n".join(str(item) for item in raw))
        return split_items(str(raw))
    text = str(raw).strip()
    if spec.kind == "flag":
        flag = normalize_flag(text)
        if flag is None:
            raise ValueError(f"{spec.heading}: answer on or off, not {text!r}")
        return flag
    return text or spec.default


def business_from(values: Mapping[str, object], base: Optional[Business] = None) -> Business:
    """`Business` from answers keyed by field key or heading (unknown keys are an error, so a typo is not a silent TBD)."""
    business = Business(**{f.key: getattr(base, f.key) for f in FIELDS}) if base else Business()
    for key, raw in values.items():
        spec = FIELD_BY_KEY.get(key) or FIELD_BY_HEADING.get(str(key).strip().lower())
        if spec is None:
            raise ValueError(f"unknown business field {key!r}; known: {', '.join(f.key for f in FIELDS)}")
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            continue
        setattr(business, spec.key, coerce(spec, raw))
    return business


def parse_business_markdown(text: str) -> Dict[str, str]:
    """`## <heading>` sections → {heading: body}; text before the first heading is ignored."""
    sections: Dict[str, str] = {}
    matches = list(HEADING_RE.finditer(text))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[match.group(1)] = text[match.end():end].strip()
    return sections


def load_business_file(path: Path) -> Business:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError(f"{path}: the JSON business file must be an object keyed by field")
        return business_from(data)
    if path.suffix.lower() in (".md", ".markdown"):
        sections = parse_business_markdown(text)
        if not sections:
            raise ValueError(f"{path}: no `## <field>` headings found; headings: {', '.join(f.heading for f in FIELDS)}")
        return business_from(sections)
    raise ValueError(f"{path}: a business file is .md (## headings) or .json")


# ---------- interactive ----------

def ask_multiline(question: str, default: str, reader: Reader) -> str:
    """Reads lines until an empty line; an empty first line keeps the default."""
    print(f"{question} [{default}] (empty line ends):")
    lines: List[str] = []
    while True:
        line = reader("  > ")
        if not line.strip():
            break
        lines.append(line.rstrip())
    return "\n".join(lines) if lines else default


def ask_business(reader: Reader, ask_line: Callable[..., str], base: Optional[Business] = None) -> Business:
    """Asks every field in order; Enter keeps the default (TBD placeholders are flagged as open in the generated docs)."""
    business = base or Business()
    for spec in FIELDS:
        current = getattr(business, spec.key)
        if spec.kind in ("multiline", "list"):
            default = "\n".join(current) if isinstance(current, list) else current
            raw = ask_multiline(spec.question, default or TBD, reader)
        elif spec.kind == "flag":
            raw = ask_line(spec.question, current, validate_flag, reader)
        else:
            raw = ask_line(spec.question, current, None, reader)
        setattr(business, spec.key, coerce(spec, raw))
    return business


# ---------- rendering ----------

def bullets(items: List[str], empty: str) -> str:
    return "\n".join(f"- {item}" for item in items) if items else f"- {empty}"


def numbered(items: List[str], empty: str) -> str:
    return "\n".join(f"{n}. {item}" for n, item in enumerate(items, start=1)) if items else f"1. {empty}"


def open_decisions(business: Business) -> List[str]:
    """The owner's open decisions plus every answer still TBD, so the generated docs flag them as open."""
    items = list(business.open_decisions)
    items.extend(f"{FIELD_BY_KEY[key].heading}: {TBD} ({OPEN_MARK})" for key in business.tbd_keys())
    return items


def token_values(business: Business) -> Dict[str, str]:
    """The 13 business tokens; lists as markdown bullets, rules numbered, empty lists flagged as open."""
    empty = f"{TBD} ({OPEN_MARK})"
    return {
        "__BUSINESS_SUMMARY__": business.summary or TBD,
        "__DEFAULT_LANGUAGE__": business.default_language,
        "__RTL__": business.rtl,
        "__CURRENCY__": business.currency,
        "__CURRENCY_MINOR_UNIT__": business.currency_minor_unit,
        "__STORED_TIME_ZONE__": business.stored_time_zone,
        "__BUSINESS_TIME_ZONE__": business.business_time_zone,
        "__BUSINESS_ACTORS__": bullets(business.actors, empty),
        "__BUSINESS_RULES__": numbered(business.rules, empty),
        "__BUSINESS_ENTITIES__": bullets(business.entities, empty),
        "__BUSINESS_JOBS__": bullets(business.jobs, empty),
        "__BUSINESS_INTEGRATIONS__": bullets(business.integrations, empty),
        "__OPEN_DECISIONS__": bullets(open_decisions(business), "none recorded"),
    }


def render_business_input(business: Business, system_name: str, date: str) -> str:
    """`docs/BUSINESS_INPUT.md`: the raw answers under the exact headings `--business <file.md>` reads back."""
    parts = [f"# {system_name} — Business input (answers given to SYSTEM_SETUP on {date})\n",
             "> Raw answers, one `## <field>` section each. Re-run the tool with `--business docs/BUSINESS_INPUT.md` to reuse "
             f"them; `{TBD}` marks what the owner still has to decide (listed in `BUSINESS_DOMAIN.md` §12).\n"]
    for spec in FIELDS:
        value = getattr(business, spec.key)
        body = "\n".join(value) if isinstance(value, list) else value
        parts.append(f"## {spec.heading}\n{body or TBD}\n")
    return "\n".join(parts)


def write_business_input(repo_root: Path, business: Business, system_name: str, date: str) -> str:
    path = repo_root / BUSINESS_INPUT_REL
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_business_input(business, system_name, date), encoding="utf-8")
    return BUSINESS_INPUT_REL.as_posix()


def agent_prompt_section(prompt_text: str) -> str:
    """The part of PROMPT.md between the START/END markers (the whole file when they are missing)."""
    start, end = prompt_text.find(PROMPT_START), prompt_text.find(PROMPT_END)
    if start < 0 or end < 0 or end < start:
        return prompt_text
    return prompt_text[start + len(PROMPT_START):end].strip() + "\n"


def prompt_placeholders(system_name: str, business: Business, projects_table: str, masters: str,
                        repo: str, date: str) -> Dict[str, str]:
    """`<…>` placeholders of PROMPT.md → values (business tokens included under their `<field>` names)."""
    values = {"<system name>": system_name, "<repository>": repo, "<date>": date,
              "<projects table>": projects_table, "<masters>": masters}
    for spec in FIELDS:
        values[f"<{spec.heading.lower()}>"] = token_values(business)[spec.token]
    return values


def render_agent_prompt(prompt_text: str, placeholders: Mapping[str, str]) -> str:
    text = agent_prompt_section(prompt_text)
    for marker in sorted(placeholders, key=len, reverse=True):
        text = text.replace(marker, placeholders[marker])
    return text


def unfilled_placeholders(text: str, placeholders: Mapping[str, str]) -> List[str]:
    return sorted(marker for marker in placeholders if marker in text)


def write_agent_prompt(repo_root: Path, prompt_file: Path, placeholders: Mapping[str, str]) -> Optional[str]:
    """Writes `docs/AGENT_PROMPT.md` from the tool's PROMPT.md and links it from the generated README; None when the
    prompt file is missing."""
    if not prompt_file.is_file():
        return None
    path = repo_root / AGENT_PROMPT_REL
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_agent_prompt(prompt_file.read_text(encoding="utf-8"), placeholders), encoding="utf-8")
    readme = repo_root / "README.md"
    if readme.is_file() and AGENT_PROMPT_REL.as_posix() not in readme.read_text(encoding="utf-8"):
        with readme.open("a", encoding="utf-8") as handle:
            handle.write("\n" + README_PROMPT_LINK)
    return AGENT_PROMPT_REL.as_posix()


def field_keys() -> List[str]:
    return [f.key for f in FIELDS]


def dataclass_keys() -> List[str]:
    return [f.name for f in fields(Business)]
