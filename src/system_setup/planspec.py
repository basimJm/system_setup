"""From a reviewed `Plan` to what the engine generates today: a `Spec` for `generate()` plus the list of everything the plan
records that is not generated yet. Nothing in the plan is dropped silently: each unsupported item becomes one line of
`deferred`, printed at the end as "recorded in the plan, generated in a later phase"."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from business import Business
from catalog import Catalog
from plan import Plan
from sdks import plan_sdks
from prompts import AppSpec, Spec, slug_from

ARABIC = re.compile(r"[؀-ۿ]")
MOBILE = ("android", "ios")
DEFERRED_TITLE = "Recorded in the plan, generated in a later phase"


@dataclass
class Conversion:
    spec: Spec
    deferred: List[str] = field(default_factory=list)


def clean(item: str) -> str:
    """One list item for the business file: no `;` (the separator) and no line breaks."""
    return " ".join(item.replace(";", ",").split())


def title_of(identifier: str) -> str:
    return " ".join(part.capitalize() for part in identifier.split("-"))


def business_of(plan: Plan) -> Business:
    business = plan.business
    entities = [f"{e.name}: {' -> '.join(e.states)}" if e.states else e.name for e in business.entities]
    integrations = [f"{s.title}: {s.provider or 'provider not chosen'} ({'existing package ' + s.package + ' ' + s.version if s.source == 'published' else 'built in the system' if s.source == 'internal' else 'no code'})"
                    for s in plan.sdks]
    decided = [f"{q.question} Decided: {q.answer}" for q in plan.open_questions if q.answer]
    open_ones = [f"{q.question} (proposed: {q.proposed_default})" if q.proposed_default else q.question for q in plan.open_questions_unanswered()]
    return Business(
        summary=business.summary.strip(), default_language=plan.languages.default, rtl="on" if plan.languages.direction == "rtl" else "off",
        currency=plan.currency.code, currency_minor_unit=f"{plan.currency.minor_unit}, {plan.currency.decimals} decimals",
        stored_time_zone=plan.time_zones.stored, business_time_zone=plan.time_zones.business,
        actors=[clean(f"{a.name}: {a.does}") for a in business.actors], rules=[clean(r) for r in business.rules + decided],
        entities=[clean(e) for e in entities], jobs=[clean(j) for j in business.jobs], integrations=[clean(i) for i in integrations],
        open_decisions=[clean(q) for q in open_ones])


def plan_to_spec(plan: Plan, target: Path, catalog: Catalog) -> Conversion:
    """The engine builds one server, one admin panel, KMP apps for Android and iOS together, and every internal SDK of the plan (see sdks.py)."""
    deferred: List[str] = []
    servers = [m for m in plan.modules if m.kind == "server"]
    admins = [m for m in plan.modules if m.kind == "admin"]
    deferred += [f"server module '{m.id}' ({m.name}): the engine builds one server; this one is recorded only" for m in servers[1:]]
    deferred += [f"admin module '{m.id}' ({m.name}): the engine builds one admin panel; this one is recorded only" for m in admins[1:]]
    apps: List[AppSpec] = []
    for module in plan.modules:
        label = f"'{module.id}' ({module.name})"
        if module.kind == "web":
            deferred.append(f"web module {label} for {module.audience}: a web app is not generated yet")
        elif module.kind == "app":
            targets = [p for p in module.platforms if p in MOBILE]
            if not targets:
                deferred.append(f"app module {label}: only {', '.join(module.platforms)} was chosen, and the engine generates Android and iOS apps")
                continue
            apps.append(AppSpec(name=title_of(module.id), slug=module.id, name_ar=module.name if ARABIC.search(module.name) else ""))
            if sorted(targets) != sorted(MOBILE):
                deferred.append(f"app module {label}: platform {', '.join(targets)} only was chosen, but the generated app still holds both Android and iOS")
            if "web" in module.platforms:
                deferred.append(f"app module {label}: the web target was chosen and is not generated yet")
        elif module.kind not in ("server", "admin"):
            deferred.append(f"module {label} of kind {module.kind}: not generated yet")
    selection = plan_sdks(plan, catalog)   # SDKs and providers: sdks.py (internal = generated, published = a dependency, none = nothing)
    deferred += selection.deferred
    for item in plan.deployment:
        extra = ", ".join(p for p in (f"database {item.database}" if item.database != "none" else "", f"cache {item.cache}" if item.cache != "none" else "") if p)
        deferred.append(f"deployment of '{item.part}': host {item.host}" + (f", {extra}" if extra else "") + "; deployment files come in a later phase")
    other_languages = [code for code in plan.languages.supported if code != plan.languages.default]
    if other_languages:
        deferred.append(f"other languages {', '.join(other_languages)}: recorded for the documents and apps")
    deferred.append(f"language of the generated documents: {plan.languages.documents}; used when the model step writes the documents")
    if plan.countries:
        deferred.append(f"countries {', '.join(plan.countries)}")
    name = plan.system.name
    notes: List[str] = []
    if slug_from(name) != plan.system.slug:
        name = title_of(plan.system.slug)
        notes.append(f"the system name '{plan.system.name}' does not give the slug '{plan.system.slug}', so folders are named from the slug ('{name}')")
    spec = Spec(system_name=name, system_name_ar=plan.system.name_ar or plan.system.name, prefix=plan.system.prefix,
                package_root=plan.system.package_root, npm_scope=plan.system.npm_scope, target=target.resolve(),
                with_server=bool(servers), with_admin=bool(admins), apps=apps, sdks=[s.id for s in selection.internal], business=business_of(plan),
                sdk_overrides=selection.overrides, sdk_plans={s.id: s for s in selection.internal}, published_sdks=selection.published,
                skeleton_missing=list(catalog.skeleton_missing))
    return Conversion(spec, notes + deferred)
