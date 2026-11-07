"""`system.plan.json`: the one input of generation. A versioned, validated description of the system: identity, languages,
currency, time zones, the business, modules, SDKs, deployment, rules and open questions.

Everything a model produced is untrusted, so `Plan.from_dict` checks every field with the standard library only and reports
all problems at once, each naming its field (`modules[1].platforms[0]: ...`). The catalog is consulted for the module kinds and
platforms; an SDK, provider or host that is not in the catalog is allowed and marked `known: false` (computed here, never
trusted from the input)."""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from business import IANA_ZONE_RE
from audiences import ROLES
from catalog import Catalog
from prompts import validate_npm_scope, validate_package, validate_prefix, validate_slug

SCHEMA_VERSION = 1
PLAN_FILE = "system.plan.json"
SOURCES = ("internal", "published", "none")
DIRECTIONS = ("ltr", "rtl")
RESERVED_APP_IDS = ("server", "admin", "main")
LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$")
COUNTRY_RE = re.compile(r"^[A-Z]{2}$")
CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
QUESTION_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")
PACKAGE_NAME_RE = re.compile(r"^[@A-Za-z0-9][@A-Za-z0-9._/:-]{0,199}$")
VERSION_RE = re.compile(r"^[0-9A-Za-z][0-9A-Za-z.+_-]{0,49}$")
SHORT, LONG, SUMMARY, MANY = 200, 1500, 6000, 100


class PlanError(ValueError):
    """The plan is not valid. `errors` holds one message per problem, each starting with the field."""

    def __init__(self, errors: List[str], source: str = "plan"):
        self.errors = list(errors)
        self.source = source
        super().__init__(f"{source} is not valid ({len(errors)} problem{'s' if len(errors) != 1 else ''}):\n  - " + "\n  - ".join(errors))


@dataclass
class System:
    name: str = ""
    name_ar: str = ""
    slug: str = ""
    prefix: str = ""
    package_root: str = ""
    npm_scope: str = ""


@dataclass
class Languages:
    default: str = "en"
    supported: List[str] = field(default_factory=lambda: ["en"])
    direction: str = "ltr"
    documents: str = "en"


@dataclass
class Currency:
    code: str = ""
    minor_unit: str = ""
    decimals: int = 2


@dataclass
class TimeZones:
    stored: str = "UTC"
    business: str = ""


@dataclass
class Actor:
    name: str = ""
    does: str = ""


@dataclass
class Entity:
    name: str = ""
    states: List[str] = field(default_factory=list)


@dataclass
class BusinessInfo:
    summary: str = ""
    actors: List[Actor] = field(default_factory=list)
    rules: List[str] = field(default_factory=list)
    entities: List[Entity] = field(default_factory=list)
    jobs: List[str] = field(default_factory=list)
    existing: List[str] = field(default_factory=list)


@dataclass
class Module:
    id: str = ""
    kind: str = ""
    name: str = ""
    audience: str = ""
    why: str = ""
    platforms: List[str] = field(default_factory=list)
    role: str = ""   # app and web modules: "end_user" or "staff" (the server audience shape); empty = inferred (audiences.py)


@dataclass
class Sdk:
    id: str = ""
    title: str = ""
    why: str = ""
    source: str = "internal"
    package: str = ""
    version: str = ""
    provider: str = ""
    known: bool = True
    provider_known: bool = True


@dataclass
class Deployment:
    part: str = ""
    host: str = ""
    known: bool = True
    database: str = "none"
    cache: str = "none"


@dataclass
class OpenQuestion:
    id: str = ""
    question: str = ""
    why: str = ""
    proposed_default: str = ""
    answer: Optional[str] = None


@dataclass
class Plan:
    schema_version: int = SCHEMA_VERSION
    system: System = field(default_factory=System)
    languages: Languages = field(default_factory=Languages)
    countries: List[str] = field(default_factory=list)
    currency: Currency = field(default_factory=Currency)
    time_zones: TimeZones = field(default_factory=TimeZones)
    business: BusinessInfo = field(default_factory=BusinessInfo)
    modules: List[Module] = field(default_factory=list)
    sdks: List[Sdk] = field(default_factory=list)
    deployment: List[Deployment] = field(default_factory=list)
    rules: List[Any] = field(default_factory=list)
    open_questions: List[OpenQuestion] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def module(self, module_id: str) -> Optional[Module]:
        return next((m for m in self.modules if m.id == module_id), None)

    def sdk(self, sdk_id: str) -> Optional[Sdk]:
        return next((s for s in self.sdks if s.id == sdk_id), None)

    def deployment_of(self, part: str) -> Optional[Deployment]:
        return next((d for d in self.deployment if d.part == part), None)

    def open_questions_unanswered(self) -> List[OpenQuestion]:
        return [q for q in self.open_questions if not q.answer]

    @classmethod
    def from_dict(cls, data: Any, catalog: Catalog, source: str = "plan") -> "Plan":
        return _Reader(catalog, source).plan(data)


def dumps(plan: Plan) -> str:
    return json.dumps(plan.to_dict(), indent=2, ensure_ascii=False) + "\n"


def save_plan(plan: Plan, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dumps(plan), encoding="utf-8")


def load_plan(path: Path, catalog: Catalog) -> Plan:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise PlanError([f"cannot read the file ({error})"], str(path))
    except json.JSONDecodeError as error:
        raise PlanError([f"not valid JSON (line {error.lineno}, column {error.colno}: {error.msg})"], str(path))
    return Plan.from_dict(data, catalog, source=str(path))


# ---------- validation ----------

class _Reader:
    """Reads untrusted data into a `Plan`; collects every problem, raises once at the end."""

    def __init__(self, catalog: Catalog, source: str):
        self.catalog = catalog
        self.source = source
        self.errors: List[str] = []

    def fail(self, path: str, message: str) -> None:
        self.errors.append(f"{path}: {message}")

    def obj(self, data: Any, path: str, required: List[str], optional: List[str] = ()) -> Dict[str, Any]:
        if not isinstance(data, dict):
            self.fail(path, f"must be an object, not {type(data).__name__}")
            return {}
        for key in required:
            if key not in data:
                self.fail(f"{path}.{key}" if path else key, "is required")
        for key in data:
            if key not in required and key not in optional:
                self.fail(f"{path}.{key}" if path else key, "is not a known field")
        return data

    def text(self, data: Dict[str, Any], key: str, path: str, empty: bool = False, limit: int = SHORT, default: str = "") -> str:
        if key not in data:
            return default
        value = data[key]
        where = f"{path}.{key}" if path else key
        if not isinstance(value, str):
            self.fail(where, f"must be text, not {type(value).__name__}")
            return default
        value = value.strip()
        if not value and not empty:
            self.fail(where, "must not be empty")
        elif len(value) > limit:
            self.fail(where, f"is too long ({len(value)} characters; the limit is {limit})")
            return value[:limit]
        return value

    def checked(self, value: str, where: str, check) -> str:
        message = check(value) if value else None
        if message:
            self.fail(where, f"{value!r}: {message}")
        return value

    def items(self, data: Dict[str, Any], key: str, path: str, minimum: int = 0) -> List[Any]:
        if key not in data:
            return []
        value = data[key]
        where = f"{path}.{key}" if path else key
        if not isinstance(value, list):
            self.fail(where, f"must be a list, not {type(value).__name__}")
            return []
        if len(value) < minimum:
            self.fail(where, f"needs at least {minimum} item{'s' if minimum != 1 else ''}")
        if len(value) > MANY:
            self.fail(where, f"has {len(value)} items; the limit is {MANY}")
            return value[:MANY]
        return value

    def strings(self, data: Dict[str, Any], key: str, path: str, minimum: int = 0, limit: int = LONG, pattern=None, label: str = "") -> List[str]:
        out = []
        where = f"{path}.{key}" if path else key
        for index, value in enumerate(self.items(data, key, path, minimum)):
            if not isinstance(value, str) or not value.strip():
                self.fail(f"{where}[{index}]", "must be non-empty text")
            elif len(value.strip()) > limit:
                self.fail(f"{where}[{index}]", f"is too long (limit {limit} characters)")
            elif pattern is not None and not pattern.match(value.strip()):
                self.fail(f"{where}[{index}]", f"{value.strip()!r} is not {label}")
            else:
                out.append(value.strip())
        if len(set(out)) != len(out):
            self.fail(where, "has duplicates")
        return out

    def choice(self, value: str, where: str, allowed) -> str:
        if value and value not in allowed:
            self.fail(where, f"{value!r} is not one of {', '.join(allowed)}")
        return value

    # ---- sections ----
    def plan(self, data: Any) -> Plan:
        data = self.obj(data, "", ["schema_version", "system", "languages", "currency", "time_zones", "business", "modules"],
                        ["countries", "sdks", "deployment", "rules", "open_questions"])
        version = data.get("schema_version")
        if "schema_version" in data and (isinstance(version, bool) or version != SCHEMA_VERSION):
            self.fail("schema_version", f"{version!r} is not supported; this tool reads version {SCHEMA_VERSION}")
        def section(key, reader, default):
            return reader(data[key]) if key in data else default()

        plan = Plan(
            system=section("system", self.system, System), languages=section("languages", self.languages, Languages),
            countries=self.strings(data, "countries", "", pattern=COUNTRY_RE, label="a two-letter country code such as JO"),
            currency=section("currency", self.currency, Currency), time_zones=section("time_zones", self.time_zones, TimeZones),
            business=section("business", self.business, BusinessInfo), modules=self.modules(data))
        plan.sdks = self.sdks(data)
        plan.deployment = self.deployment(data, plan.modules)
        rules = self.items(data, "rules", "")
        if rules:
            self.fail("rules", f"must be empty in schema version {SCHEMA_VERSION} (rules arrive in a later phase), not {len(rules)} item(s)")
        plan.open_questions = self.questions(data)
        if self.errors:
            raise PlanError(self.errors, self.source)
        return plan

    def system(self, data: Any) -> System:
        data = self.obj(data, "system", ["name", "slug", "prefix", "package_root", "npm_scope"], ["name_ar"])
        return System(
            name=self.text(data, "name", "system", limit=80), name_ar=self.text(data, "name_ar", "system", empty=True, limit=80),
            slug=self.checked(self.text(data, "slug", "system", limit=60), "system.slug", validate_slug),
            prefix=self.checked(self.text(data, "prefix", "system", limit=6), "system.prefix", validate_prefix),
            package_root=self.checked(self.text(data, "package_root", "system"), "system.package_root", validate_package),
            npm_scope=self.checked(self.text(data, "npm_scope", "system"), "system.npm_scope", validate_npm_scope))

    def languages(self, data: Any) -> Languages:
        data = self.obj(data, "languages", ["default", "supported", "direction"], ["documents"])
        default = self.text(data, "default", "languages", limit=20)
        supported = self.strings(data, "supported", "languages", minimum=1, limit=20, pattern=LANGUAGE_RE, label="a language code such as ar or en-GB")
        documents = self.text(data, "documents", "languages", limit=20, default=default)
        for where, code in (("languages.default", default), ("languages.documents", documents)):
            if code and not LANGUAGE_RE.match(code):
                self.fail(where, f"{code!r} is not a language code such as ar or en-GB")
        if default and supported and default not in supported:
            self.fail("languages.supported", f"must include the default language {default!r}")
        direction = self.choice(self.text(data, "direction", "languages", limit=3), "languages.direction", DIRECTIONS)
        return Languages(default, supported, direction, documents)

    def currency(self, data: Any) -> Currency:
        data = self.obj(data, "currency", ["code", "minor_unit", "decimals"])
        code = self.text(data, "code", "currency", limit=3)
        if code and not CURRENCY_RE.match(code):
            self.fail("currency.code", f"{code!r} is not a three-letter ISO 4217 code such as USD")
        decimals = data.get("decimals", 0)
        if "decimals" in data and (isinstance(decimals, bool) or not isinstance(decimals, int) or not 0 <= decimals <= 4):
            self.fail("currency.decimals", f"{decimals!r} must be a whole number from 0 to 4")
            decimals = 0
        return Currency(code, self.text(data, "minor_unit", "currency", limit=40), decimals)

    def time_zones(self, data: Any) -> TimeZones:
        data = self.obj(data, "time_zones", ["stored", "business"])
        zones = []
        for key in ("stored", "business"):
            zone = self.text(data, key, "time_zones", limit=60)
            if zone and not IANA_ZONE_RE.match(zone):
                self.fail(f"time_zones.{key}", f"{zone!r} is not an IANA zone name such as UTC or Europe/Paris")
            zones.append(zone)
        return TimeZones(*zones)

    def business(self, data: Any) -> BusinessInfo:
        data = self.obj(data, "business", ["summary", "actors", "rules", "entities", "jobs"], ["existing"])
        actors = []
        for index, raw in enumerate(self.items(data, "actors", "business", minimum=1)):
            item = self.obj(raw, f"business.actors[{index}]", ["name", "does"])
            actors.append(Actor(self.text(item, "name", f"business.actors[{index}]"), self.text(item, "does", f"business.actors[{index}]", limit=LONG)))
        entities = []
        for index, raw in enumerate(self.items(data, "entities", "business")):
            where = f"business.entities[{index}]"
            item = self.obj(raw, where, ["name", "states"])
            entities.append(Entity(self.text(item, "name", where), self.strings(item, "states", where, limit=60)))
        return BusinessInfo(
            summary=self.text(data, "summary", "business", limit=SUMMARY), actors=actors,
            rules=self.strings(data, "rules", "business"), entities=entities, jobs=self.strings(data, "jobs", "business"),
            existing=self.strings(data, "existing", "business"))

    def modules(self, data: Dict[str, Any]) -> List[Module]:
        out, seen = [], set()
        for index, raw in enumerate(self.items(data, "modules", "", minimum=1)):
            where = f"modules[{index}]"
            item = self.obj(raw, where, ["id", "kind", "name", "audience", "why", "platforms"], ["role"])
            module = Module(id=self.checked(self.text(item, "id", where, limit=40), f"{where}.id", validate_slug),
                            kind=self.text(item, "kind", where, limit=40), name=self.text(item, "name", where, limit=80),
                            audience=self.text(item, "audience", where, limit=LONG), why=self.text(item, "why", where, limit=LONG))
            if module.id in seen:
                self.fail(f"{where}.id", f"{module.id!r} is used twice")
            seen.add(module.id)
            kind = self.catalog.kinds.get(module.kind)
            if module.kind and kind is None:
                self.fail(f"{where}.kind", f"{module.kind!r} is not one of {', '.join(self.catalog.kinds)}")
            if module.kind in ("app", "web") and module.id in RESERVED_APP_IDS:
                self.fail(f"{where}.id", f"{module.id!r} is reserved for a master branch; name the app differently")
            module.platforms = self.strings(item, "platforms", where, minimum=1, limit=20)
            module.role = self.text(item, "role", where, empty=True, limit=20)
            if module.role and module.role not in ROLES:
                self.fail(f"{where}.role", f"{module.role!r} is not one of {', '.join(ROLES)}")
            allowed = kind.allowed_platforms if kind else list(self.catalog.platforms)
            for p_index, platform in enumerate(module.platforms):
                if platform not in allowed:
                    self.fail(f"{where}.platforms[{p_index}]", f"{platform!r} is not one of {', '.join(allowed)}" + (f" for kind {kind.id}" if kind else ""))
            out.append(module)
        return out

    def sdks(self, data: Dict[str, Any]) -> List[Sdk]:
        out, seen = [], set()
        for index, raw in enumerate(self.items(data, "sdks", "")):
            where = f"sdks[{index}]"
            item = self.obj(raw, where, ["id", "title", "why", "source", "provider"], ["package", "version", "known", "provider_known"])
            sdk = Sdk(id=self.checked(self.text(item, "id", where, limit=40), f"{where}.id", validate_slug),
                      title=self.text(item, "title", where, limit=80), why=self.text(item, "why", where, limit=LONG),
                      source=self.choice(self.text(item, "source", where, limit=20), f"{where}.source", SOURCES),
                      package=self.text(item, "package", where, empty=True, limit=200), version=self.text(item, "version", where, empty=True, limit=50),
                      provider=self.text(item, "provider", where, empty=True, limit=SHORT))
            if sdk.id in seen:
                self.fail(f"{where}.id", f"{sdk.id!r} is used twice")
            seen.add(sdk.id)
            if sdk.source == "published":
                for key, value, pattern in (("package", sdk.package, PACKAGE_NAME_RE), ("version", sdk.version, VERSION_RE)):
                    if not value:
                        self.fail(f"{where}.{key}", "is required when source is published")
                    elif not pattern.match(value):
                        self.fail(f"{where}.{key}", f"{value!r} is not a valid {key}")
            elif sdk.package or sdk.version:
                self.fail(f"{where}.package", "and version are only for source published")
            sdk.known = self.catalog.sdk_known(sdk.id)
            sdk.provider_known = self.catalog.provider_known(sdk.provider)
            out.append(sdk)
        return out

    def deployment(self, data: Dict[str, Any], modules: List[Module]) -> List[Deployment]:
        out, seen = [], set()
        by_id = {m.id: m for m in modules}
        for index, raw in enumerate(self.items(data, "deployment", "")):
            where = f"deployment[{index}]"
            item = self.obj(raw, where, ["part", "host"], ["database", "cache", "known"])
            part = self.text(item, "part", where, limit=40)
            module = by_id.get(part)
            if part and module is None:
                self.fail(f"{where}.part", f"{part!r} is not a module id ({', '.join(by_id) or 'no modules'})")
            elif module is not None and module.kind in self.catalog.kinds and not self.catalog.kinds[module.kind].deployable:
                self.fail(f"{where}.part", f"{part!r} is a {module.kind} module; those are distributed through stores and have no host")
            if part in seen:
                self.fail(f"{where}.part", f"{part!r} is used twice")
            seen.add(part)
            host = self.text(item, "host", where, limit=SHORT)
            chosen = self.catalog.find_host(host) if host else None
            if (chosen is not None and module is not None and module.kind in self.catalog.kinds and self.catalog.kinds[module.kind].deployable
                    and chosen.parts and module.kind not in chosen.parts):
                self.fail(f"{where}.host", f"{chosen.title} does not host a {module.kind} part (it hosts: {', '.join(chosen.parts)}); "
                          f"choose one of: {', '.join(h.id for h in self.catalog.hosts_for(module.kind))}")
            out.append(Deployment(part, host, self.catalog.find_host(host) is not None,
                                  self.text(item, "database", where, limit=SHORT, default="none") or "none",
                                  self.text(item, "cache", where, limit=SHORT, default="none") or "none"))
        return out

    def questions(self, data: Dict[str, Any]) -> List[OpenQuestion]:
        out, seen = [], set()
        for index, raw in enumerate(self.items(data, "open_questions", "")):
            where = f"open_questions[{index}]"
            item = self.obj(raw, where, ["id", "question", "why", "proposed_default"], ["answer"])
            answer = item.get("answer")
            if answer is not None and not isinstance(answer, str):
                self.fail(f"{where}.answer", f"must be text or null, not {type(answer).__name__}")
                answer = None
            question = OpenQuestion(id=self.text(item, "id", where, limit=40), question=self.text(item, "question", where, limit=LONG),
                                    why=self.text(item, "why", where, limit=LONG),
                                    proposed_default=self.text(item, "proposed_default", where, empty=True, limit=LONG),
                                    answer=(answer or "").strip()[:LONG] or None)
            if question.id and not QUESTION_ID_RE.match(question.id):
                self.fail(f"{where}.id", f"{question.id!r} must be lowercase letters, digits, '-' or '_'")
            if question.id in seen:
                self.fail(f"{where}.id", f"{question.id!r} is used twice")
            seen.add(question.id)
            out.append(question)
        return out


# ---------- the JSON schema the model must follow (--json-schema) ----------

def _s(**extra: Any) -> Dict[str, Any]:
    return dict({"type": "string"}, **extra)


def _list(items: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
    return dict({"type": "array", "items": items}, **extra)


def _obj(properties: Dict[str, Any], required: Optional[List[str]] = None) -> Dict[str, Any]:
    return {"type": "object", "properties": properties, "required": list(properties) if required is None else required,
            "additionalProperties": False}


def model_schema(catalog: Catalog) -> Dict[str, Any]:
    """What the analyzer asks the model for: the plan without the fields the tool computes (`known`, `provider_known`) and
    without `answer` (the person answers in the review)."""
    return _obj({
        "schema_version": {"type": "integer", "enum": [SCHEMA_VERSION]},
        "system": _obj({"name": _s(), "name_ar": _s(), "slug": _s(), "prefix": _s(), "package_root": _s(), "npm_scope": _s()},
                       ["name", "slug", "prefix", "package_root", "npm_scope"]),
        "languages": _obj({"default": _s(pattern=LANGUAGE_RE.pattern), "supported": _list(_s(pattern=LANGUAGE_RE.pattern), minItems=1),
                           "direction": _s(enum=list(DIRECTIONS)), "documents": _s(pattern=LANGUAGE_RE.pattern)}),
        "countries": _list(_s(pattern=COUNTRY_RE.pattern)),
        "currency": _obj({"code": _s(), "minor_unit": _s(), "decimals": {"type": "integer", "minimum": 0, "maximum": 4}}),
        "time_zones": _obj({"stored": _s(), "business": _s()}),
        "business": _obj({"summary": _s(), "actors": _list(_obj({"name": _s(), "does": _s()}), minItems=1), "rules": _list(_s()),
                          "entities": _list(_obj({"name": _s(), "states": _list(_s())})), "jobs": _list(_s()), "existing": _list(_s())}),
        "modules": _list(_obj({"id": _s(), "kind": _s(enum=list(catalog.kinds)), "name": _s(), "audience": _s(), "why": _s(),
                               "platforms": _list(_s(enum=list(catalog.platforms)), minItems=1),
                               "role": _s(enum=[*ROLES, ""])}), minItems=1),
        "sdks": _list(_obj({"id": _s(), "title": _s(), "why": _s(), "source": _s(enum=list(SOURCES)), "package": _s(), "version": _s(),
                            "provider": _s()})),
        "deployment": _list(_obj({"part": _s(), "host": _s(), "database": _s(), "cache": _s()})),
        "rules": _list(_s(), maxItems=0),
        "open_questions": _list(_obj({"id": _s(), "question": _s(), "why": _s(), "proposed_default": _s()})),
    })
