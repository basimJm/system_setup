"""The review: the proposal is shown in plain language and the person confirms or changes each choice, with the proposal as the
default (Enter keeps it). `--yes` accepts the proposal untouched. Questions go through the `reader` seam, so tests script them.

It asks, in order: names and identifiers, then per module keep / remove / add and its platforms, then per SDK keep / remove / add,
where it comes from (build it here, already published as package + version, or none) and its provider, then per deployable
module the host (and database and cache for the server), then each open question (left open when not answered), then the language
of the generated documents. It never asks for a secret value and refuses one that is typed anyway."""
from __future__ import annotations

import copy
import re
from typing import Callable, List, Optional

from audiences import ROLES, infer_role, load_audience_catalog
from catalog import Catalog, OTHER
from plan import LANGUAGE_RE, PACKAGE_NAME_RE, SOURCES, VERSION_RE, Deployment, Module, Plan, Sdk
from prompts import ask, slug_from, validate_npm_scope, validate_package, validate_prefix, validate_required, validate_slug

Reader = Callable[[str], str]
Say = Callable[[str], None]
KEEP, REMOVE = "keep", "remove"
TAKE_PROPOSED = "="
SECRET_HINT = ("that looks like a secret value. Never type secrets here: name the environment variable instead "
               "(for example PAYMENT_API_KEY) and keep the value in your own .env file")
SECRET_SHAPES = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY"),
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}"),
    re.compile(r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{30,}"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\."),
    re.compile(r"(?i)\b(?:secret|password|passwd|token|api[_-]?key|private[_-]?key)\b\s*[:=]\s*\S{6,}"),
    re.compile(r"\b[a-z][a-z0-9+.-]*://[^/\s:@]+:[^/\s@]+@"),
)
LONG_TOKEN = re.compile(r"^[A-Za-z0-9_+/=-]{32,}$")


def looks_like_secret(text: str) -> bool:
    """True for a typed secret: a key or token shape, `name=value` for a secret-like name, or one long opaque word."""
    if any(shape.search(text) for shape in SECRET_SHAPES):
        return True
    return bool(LONG_TOKEN.match(text.strip())) and bool(re.search(r"\d", text)) and bool(re.search(r"[A-Za-z]", text))


def safe(check: Optional[Callable[[str], Optional[str]]] = None) -> Callable[[str], Optional[str]]:
    """A validator that first refuses secrets, then runs `check`."""
    def run(value: str) -> Optional[str]:
        if looks_like_secret(value):
            return SECRET_HINT
        return check(value) if check else None
    return run


def one_of(options: List[str], aliases: Optional[dict] = None) -> Callable[[str], Optional[str]]:
    def run(value: str) -> Optional[str]:
        return None if (aliases or {}).get(value.lower(), value.lower()) in options else f"answer {' or '.join(options)}"
    return run


def yes_no(value: str) -> Optional[str]:
    return None if value.lower() in ("y", "yes", "n", "no") else "answer yes or no"


def is_yes(value: str) -> bool:
    return value.lower() in ("y", "yes")


def title_of(identifier: str) -> str:
    return " ".join(part.capitalize() for part in identifier.split("-"))


def names(choices) -> str:
    return ", ".join(choice.id for choice in choices)


# ---------- the proposal in plain language ----------

def describe(plan: Plan, catalog: Catalog) -> str:
    lines = [f"\nProposal for {plan.system.name}" + (f" ({plan.system.name_ar})" if plan.system.name_ar else ""),
             f"  Identifiers: folder prefix {plan.system.prefix}, package {plan.system.package_root}, npm scope {plan.system.npm_scope}",
             f"  Languages: {', '.join(plan.languages.supported)} (main {plan.languages.default}, "
             f"{'right to left' if plan.languages.direction == 'rtl' else 'left to right'}); generated documents in {plan.languages.documents}",
             f"  Money: {plan.currency.code} ({plan.currency.minor_unit}, {plan.currency.decimals} decimals); times shown in "
             f"{plan.time_zones.business}, stored in {plan.time_zones.stored}"
             + (f"; countries {', '.join(plan.countries)}" if plan.countries else ""),
             f"\n  Parts of the system ({len(plan.modules)}):"]
    for number, module in enumerate(plan.modules, start=1):
        kind = catalog.kinds.get(module.kind)
        lines.append(f"    {number}. {module.name} - {kind.title if kind else module.kind} for {module.audience} "
                     f"[{', '.join(module.platforms)}]" + (f" role: {module.role}" if module.role else "") + f"\n       why: {module.why}")
    lines.append(f"\n  Building blocks (SDKs) ({len(plan.sdks)}):" if plan.sdks else "\n  Building blocks (SDKs): none")
    for sdk in plan.sdks:
        origin = {"internal": "built here", "published": f"already published ({sdk.package} {sdk.version})", "none": "no code"}[sdk.source]
        flags = ("" if sdk.known else ", new: not in the catalog") + ("" if sdk.provider_known else ", provider not in the catalog")
        lines.append(f"    - {sdk.title} ({sdk.id}): {origin}; provider {sdk.provider or 'not chosen'}{flags}\n      why: {sdk.why}")
    if plan.deployment:
        lines.append("\n  Where it runs:")
        for item in plan.deployment:
            extra = ", ".join(part for part in (f"database {item.database}" if item.database != "none" else "",
                                                f"cache {item.cache}" if item.cache != "none" else "") if part)
            lines.append(f"    - {item.part}: {item.host}" + (f" ({extra})" if extra else "") + ("" if item.known else " [not in the catalog]"))
    open_ones = plan.open_questions_unanswered()
    lines.append(f"\n  Open questions: {len(open_ones)} of {len(plan.open_questions)} unanswered")
    return "\n".join(lines)


# ---------- the review ----------

def review(plan: Plan, catalog: Catalog, reader: Reader = input, say: Say = print, yes: bool = False) -> Plan:
    """Returns a new, validated plan; the argument is not changed."""
    plan = copy.deepcopy(plan)
    say(describe(plan, catalog))
    if yes:
        say("\n--yes: the proposal is accepted as it is.")
        return Plan.from_dict(plan.to_dict(), catalog)
    say("\nReview: Enter keeps the proposal shown in [brackets]. Never type a secret value here.")
    Review(plan, catalog, reader, say).run()
    return Plan.from_dict(plan.to_dict(), catalog)


class Review:
    def __init__(self, plan: Plan, catalog: Catalog, reader: Reader, say: Say):
        self.plan, self.catalog, self.reader, self.say = plan, catalog, reader, say

    def ask(self, question: str, default: str = "", check=None) -> str:
        return ask(question, default, safe(check), self.reader)

    def run(self) -> None:
        self.identity()
        self.modules()
        self.sdks()
        self.deployment()
        self.questions()
        self.documents_language()
        self.roles()

    # -- names --
    def identity(self) -> None:
        system = self.plan.system
        if not is_yes(self.ask(f"Change the names ({system.name}, prefix {system.prefix}, package {system.package_root}, "
                               f"npm scope {system.npm_scope})? (yes/no)", "no", yes_no)):
            return
        system.name = self.ask("System name (Latin letters, used for folders)", system.name, lambda v: None if slug_from(v) else "needs Latin letters or digits")
        system.name_ar = self.ask("System name in the local script (Enter = none)", system.name_ar)
        system.slug = self.ask("Short slug (lower case, dashes)", system.slug, validate_slug)
        system.prefix = self.ask("Folder and task prefix (2 to 6 capitals)", system.prefix, validate_prefix)
        system.package_root = self.ask("Package root (Kotlin / Android)", system.package_root, validate_package)
        system.npm_scope = self.ask("npm scope of the SDKs", system.npm_scope, validate_npm_scope)

    # -- modules --
    def modules(self) -> None:
        for module in list(self.plan.modules):
            kind = self.catalog.kinds.get(module.kind)
            if len(self.plan.modules) > 1:
                answer = self.ask(f"Part '{module.name}' ({kind.title if kind else module.kind}): keep or remove? (keep/remove)", KEEP,
                                  one_of([KEEP, REMOVE], {"k": KEEP, "r": REMOVE}))
                if answer.lower() in (REMOVE, "r"):
                    self.plan.modules.remove(module)
                    self.plan.deployment = [d for d in self.plan.deployment if d.part != module.id]
                    continue
            if kind and len(kind.allowed_platforms) > 1:
                module.platforms = self.platforms(module.name, kind.allowed_platforms, module.platforms)
        while is_yes(self.ask("Add another part (for example a web app or a mobile app for one more kind of user)? (yes/no)", "no", yes_no)):
            self.add_module()

    def platforms(self, name: str, allowed: List[str], current: List[str]) -> List[str]:
        def check(value: str) -> Optional[str]:
            chosen = [p.strip().lower() for p in value.split(",") if p.strip()]
            bad = [p for p in chosen if p not in allowed]
            return f"choose from {', '.join(allowed)}" if bad or not chosen else None
        answer = self.ask(f"  Platforms for '{name}' ({', '.join(allowed)}; comma separated)", ", ".join(current), check)
        out: List[str] = []
        for platform in (p.strip().lower() for p in answer.split(",") if p.strip()):
            if platform not in out:
                out.append(platform)
        return out

    def add_module(self) -> None:
        kind_id = self.ask(f"  Kind ({names(self.catalog.kinds.values())})", "web", lambda v: None if v in self.catalog.kinds else f"choose from {', '.join(self.catalog.kinds)}")
        kind = self.catalog.kinds[kind_id]
        name = self.ask("  Name", "", validate_required)
        base, taken = slug_from(name) or "part", {m.id for m in self.plan.modules}
        module_id, number = base, 2
        while module_id in taken:
            module_id, number = f"{base}-{number}", number + 1
        platforms = self.platforms(name, kind.allowed_platforms, kind.default_platforms) if len(kind.allowed_platforms) > 1 else list(kind.default_platforms)
        self.plan.modules.append(Module(module_id, kind_id, name, self.ask("  Who uses it", "", validate_required),
                                        self.ask("  Why it is needed", "added during the review"), platforms))

    def roles(self) -> None:
        """Last question: which kind of server audience each app or web module is (end user or staff)."""
        audiences = load_audience_catalog()
        for module in self.plan.modules:
            if module.kind not in ("app", "web"):
                continue
            proposed = module.role or infer_role(module.id, module.name, audiences)
            answer = self.ask(f"Who is '{module.name}' for on the server: end_user (people using it for themselves) or staff (an organization's team)? ({', '.join(ROLES)})",
                               proposed, lambda v: None if v in ROLES else f"choose from {', '.join(ROLES)}")
            module.role = module.role if answer == proposed else answer   # keeping the proposal keeps the plan as it was

    # -- SDKs --
    def sdks(self) -> None:
        for sdk in list(self.plan.sdks):
            if self.ask(f"Building block '{sdk.title}': keep or remove? (keep/remove)", KEEP, one_of([KEEP, REMOVE], {"k": KEEP, "r": REMOVE})).lower() in (REMOVE, "r"):
                self.plan.sdks.remove(sdk)
                continue
            self.sdk_details(sdk)
        while True:
            available = [s.id for s in self.catalog.sdks.values() if not self.plan.sdk(s.id)]
            added = self.ask("Add a building block? Name one (" + (", ".join(available) + ", or " if available else "") + "a new name; Enter = no)", "",
                             lambda v: None if not v or validate_slug(v) is None else validate_slug(v))
            if not added:
                return
            if self.plan.sdk(added):
                self.say(f"  '{added}' is already in the plan.")
                continue
            known = self.catalog.sdks.get(added)
            sdk = Sdk(added, known.title if known else title_of(added), self.ask("  Why it is needed", "added during the review"), "internal")
            self.plan.sdks.append(sdk)
            self.sdk_details(sdk)

    def sdk_details(self, sdk: Sdk) -> None:
        sdk.source = self.ask(f"  '{sdk.title}' source: internal = build it here, published = an existing package, none = no code ({'/'.join(SOURCES)})",
                              sdk.source, one_of(list(SOURCES))).lower()
        if sdk.source == "published":
            sdk.package = self.ask("  Package name (for example @acme/otp)", sdk.package, lambda v: None if PACKAGE_NAME_RE.match(v) else "not a valid package name")
            sdk.version = self.ask("  Version", sdk.version, lambda v: None if VERSION_RE.match(v) else "not a valid version, for example 1.4.0")
        else:
            sdk.package = sdk.version = ""
        options = [p.id for p in self.catalog.providers_for(sdk.id)]
        listed = (", ".join(options) + "; ") if options else ""
        sdk.provider = self.ask(f"  Provider for '{sdk.title}' ({listed}'{OTHER}' = any other name, none = no provider)", sdk.provider or "none").strip()
        if sdk.provider.lower() == OTHER:
            sdk.provider = self.ask("  Name of the provider", "", validate_required)
        if sdk.provider.lower() == "none":
            sdk.provider = ""

    # -- deployment --
    def deployment(self) -> None:
        for module in self.plan.modules:
            kind = self.catalog.kinds.get(module.kind)
            if not kind or not kind.deployable:
                continue
            current = self.plan.deployment_of(module.id)
            hosts = self.catalog.hosts_for(kind.id)
            host = self.ask(f"Where should '{module.name}' run? ({names(hosts)}; or any other name)", current.host if current else (hosts[0].id if hosts else "custom"), validate_required)
            database = cache = "none"
            if kind.stores_data:
                database = self.ask(f"  Database for '{module.name}' ({names(self.catalog.databases)}; or any other name)",
                                    current.database if current else self.catalog.databases[0].id, validate_required)
                cache = self.ask(f"  Cache for '{module.name}' ({names(self.catalog.caches)}; or any other name)", current.cache if current else "none", validate_required)
            if current is None:
                current = Deployment(part=module.id)
                self.plan.deployment.append(current)
            current.host, current.database, current.cache = host, database, cache

    # -- open questions and the document language --
    def questions(self) -> None:
        if not self.plan.open_questions:
            return
        self.say("\nOpen questions. Answer what you know; Enter leaves a question open (it becomes an open point and a PENDING task), "
                 f"'{TAKE_PROPOSED}' takes the proposed answer.")
        for question in self.plan.open_questions:
            self.say(f"\n  {question.question}\n  why it matters: {question.why}\n  proposed: {question.proposed_default or '(nothing proposed)'}")
            answer = self.ask("  Your answer", question.answer or "")
            if answer == TAKE_PROPOSED:
                answer = question.proposed_default
            question.answer = answer or None

    def documents_language(self) -> None:
        self.plan.languages.documents = self.ask("In which language should the generated documents be written? (language code, for example ar or en)",
                                                 self.plan.languages.documents, lambda v: None if LANGUAGE_RE.match(v) else "use a language code such as ar or en-GB")
