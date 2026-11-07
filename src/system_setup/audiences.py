"""Server audiences from the plan. The server template ships two reusable shapes: `end_user` (people who use the product
for themselves: phone sign-in, guests, their own data) and `staff` (people of an organization: members, teams, permissions).
Each client module of the plan (`app` or `web`) is one audience with a role; the template's own words for the two shapes
(TEMPLATE.json `audiences`) are renamed to the module's name, and a shape no module uses is pruned.

Role of a module: the plan's `role` when set; else `staff` when a word of its id or name is in `catalog/audiences.json`
`staff_words` (merchant, driver, facility, ...), else `end_user`. The first module of a role is generated; later ones of
the same role are recorded as a PENDING row and a note (the template has one module per role)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Pattern, Sequence, Tuple

from manifest import tool_root

ROLES = ("end_user", "staff")
AUDIENCES_FILE = "catalog/audiences.json"


@dataclass(frozen=True)
class AudienceCatalog:
    roles: Tuple[str, ...] = ROLES
    default_role: str = "end_user"
    staff_words: Tuple[str, ...] = ()
    client_words: Tuple[str, ...] = ()


def load_audience_catalog(root: Optional[Path] = None) -> AudienceCatalog:
    path = (root or tool_root()) / AUDIENCES_FILE
    if not path.is_file():
        return AudienceCatalog()
    data = json.loads(path.read_text(encoding="utf-8"))
    roles = tuple(r["id"] for r in data.get("roles", [])) or ROLES
    return AudienceCatalog(roles=roles, default_role=data.get("default_role", "end_user"),
                           staff_words=tuple(w.lower() for w in data.get("staff_words", [])),
                           client_words=tuple(w.lower() for w in data.get("client_words", [])))


def infer_role(module_id: str, name: str, catalog: Optional[AudienceCatalog] = None) -> str:
    """`staff` when a whole word of the id or the (Latin) name is a staff word, else the default role."""
    catalog = catalog or load_audience_catalog()
    words = set(re.findall(r"[a-z0-9]+", f"{module_id} {name}".lower()))
    return "staff" if words & set(catalog.staff_words) else catalog.default_role


@dataclass(frozen=True)
class Audience:
    slug: str   # the module id, kebab: the REST prefix `/<slug>/v1` and the socket namespace `/<slug>`
    role: str


@dataclass
class AudiencePlan:
    """Which module is the server's audience of each role, which are left for later, which roles are dropped."""
    chosen: Dict[str, Audience] = field(default_factory=dict)      # role -> generated audience
    extra: List[Audience] = field(default_factory=list)            # same role as a chosen one: not generated
    dropped: List[str] = field(default_factory=list)               # roles with no audience: pruned from the server


def plan_audiences(audiences: Sequence[Audience], roles: Sequence[str] = ROLES) -> AudiencePlan:
    result = AudiencePlan()
    for audience in audiences:
        if audience.role in result.chosen:
            result.extra.append(audience)
        else:
            result.chosen[audience.role] = audience
    result.dropped = [role for role in roles if role not in result.chosen]
    return result


# ---------- the forms of a name ----------

def words_of(slug: str) -> List[str]:
    return [w for w in re.split(r"[^A-Za-z0-9]+", slug) if w]


def pluralize(word: str) -> str:
    lower = word.lower()
    if re.search(r"[^aeiou]y$", lower):
        return word[:-1] + "ies"
    if re.search(r"(s|x|z|ch|sh)$", lower):
        return word + "es"
    return word + "s"


def camel(words: Sequence[str]) -> str:
    return "".join(w.lower() if i == 0 else w[:1].upper() + w[1:].lower() for i, w in enumerate(words))


def pascal(words: Sequence[str]) -> str:
    return "".join(w[:1].upper() + w[1:].lower() for w in words)


def upper(words: Sequence[str]) -> str:
    return "_".join(w.upper() for w in words)


def plural_words(words: Sequence[str]) -> List[str]:
    return [*words[:-1], pluralize(words[-1])] if words else []


class Renamer:
    """One pass over a text: every audience word of the template (`customer`, `customers`, `Customer`, `CUSTOMER` ...) becomes
    the audience's name. One pass, so a name that contains another role's word (`merchant-app` for the end-user role) is never
    renamed twice. Forms: plurals first (pluralised last word), then the kebab slug where the word is a URL or folder segment
    (`/customer/`, a quoted `'/customer'`), then camelCase, PascalCase and UPPER_SNAKE for identifiers, files and constants."""

    SEGMENT_END = r"(?=[/'\"`,)\s]|$)"

    def __init__(self, words: Mapping[str, Tuple[str, str]], slugs: Mapping[str, str]):
        """`words`: role -> (singular, plural) as the template spells them; `slugs`: role -> the audience slug (roles missing
        from `slugs` are not renamed)."""
        self.table: Dict[str, str] = {}
        alternatives: List[str] = []
        for role, (singular, plural) in words.items():
            if role not in slugs:
                continue
            parts = words_of(slugs[role])
            plural_parts = plural_words(parts)
            kebab = "-".join(w.lower() for w in parts)
            forms = [(plural, camel(plural_parts)), (plural.capitalize(), pascal(plural_parts)), (plural.upper(), upper(plural_parts)),
                     (singular, camel(parts)), (singular.capitalize(), pascal(parts)), (singular.upper(), upper(parts))]
            segment = f"s_{role}"
            alternatives.append(f"(?P<{segment}>(?<=/){re.escape(singular)}{self.SEGMENT_END})")
            self.table[segment] = kebab
            # the segment form sits before the plain forms, after the plurals
            ordered = [f"(?P<p0_{role}>{re.escape(forms[0][0])})", f"(?P<p1_{role}>{re.escape(forms[1][0])})", f"(?P<p2_{role}>{re.escape(forms[2][0])})"]
            for index, (_, target) in enumerate(forms[:3]):
                self.table[f"p{index}_{role}"] = target
            alternatives = alternatives[:-1] + ordered + [alternatives[-1]]
            for index, (source, target) in enumerate(forms[3:]):
                alternatives.append(f"(?P<w{index}_{role}>{re.escape(source)})")
                self.table[f"w{index}_{role}"] = target
        self.pattern: Optional[Pattern[str]] = re.compile("|".join(alternatives)) if alternatives else None

    def apply(self, text: str) -> str:
        if self.pattern is None:
            return text
        return self.pattern.sub(lambda match: self.table[match.lastgroup or ""], text)
