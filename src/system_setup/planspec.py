"""From a reviewed `Plan` to what the engine generates today: a `Spec` for `generate()` plus the list of everything the plan
records that is not generated yet. Nothing in the plan is dropped silently: each unsupported item becomes one line of
`deferred`, printed at the end as "recorded in the plan, generated in a later phase"."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from audiences import infer_role, load_audience_catalog
from business import Business
from catalog import Catalog
from deploy import plan_deployment
from plan import Plan
from sdks import plan_sdks
from prompts import AppSpec, Spec, WebSpec, slug_from

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
    """The engine builds one server, one admin panel, any number of KMP apps (Android, iOS or both) and web apps, and every
    internal SDK of the plan (see sdks.py). A module whose platforms are mobile and web becomes a KMP app and a separate web app."""
    deferred: List[str] = []
    deferred_notes: List[str] = []   # decisions taken while converting; listed first, they are not "later phase" items
    servers = [m for m in plan.modules if m.kind == "server"]
    admins = [m for m in plan.modules if m.kind == "admin"]
    deferred += [f"server module '{m.id}' ({m.name}): the engine builds one server; this one is recorded only" for m in servers[1:]]
    deferred += [f"admin module '{m.id}' ({m.name}): the engine builds one admin panel; this one is recorded only" for m in admins[1:]]
    apps: List[AppSpec] = []
    webs: List[WebSpec] = []
    used = {module.id for module in plan.modules}

    audiences = load_audience_catalog()
    for module in plan.modules:
        label = f"'{module.id}' ({module.name})"
        arabic = module.name if ARABIC.search(module.name) else ""
        role = module.role or infer_role(module.id, module.name, audiences)
        if module.kind == "web":
            webs.append(WebSpec(name=title_of(module.id), slug=module.id, name_ar=arabic, role=role))
        elif module.kind == "app":
            targets = [p for p in MOBILE if p in module.platforms]
            if targets:
                apps.append(AppSpec(name=title_of(module.id), slug=module.id, name_ar=arabic, platforms=targets, role=role))
            if "web" in module.platforms:
                slug = module.id if not targets else f"{module.id}-web"
                while slug != module.id and slug in used:
                    slug += "-2"
                used.add(slug)
                webs.append(WebSpec(name=title_of(slug), slug=slug, name_ar=arabic, role=role, api_slug=module.id if targets else ""))
                if targets:
                    deferred_notes.append(f"app module {label}: the web platform becomes its own web app '{slug}' next to the {'/'.join(targets)} app and calls the same server audience")
            if not targets and "web" not in module.platforms:
                deferred.append(f"app module {label}: only {', '.join(module.platforms)} was chosen, and the engine generates Android, iOS and web apps")
        elif module.kind not in ("server", "admin"):
            deferred.append(f"module {label} of kind {module.kind}: not generated yet")
    selection = plan_sdks(plan, catalog)   # SDKs and providers: sdks.py (internal = generated, published = a dependency, none = nothing)
    deferred += selection.deferred
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
                with_server=bool(servers), with_admin=bool(admins), apps=apps, webs=webs, sdks=[s.id for s in selection.internal], business=business_of(plan),
                sdk_overrides=selection.overrides, sdk_plans={s.id: s for s in selection.internal}, published_sdks=selection.published,
                skeleton_missing=list(catalog.skeleton_missing), rule_settings=list(plan.rules))
    spec.deployment = plan_deployment(plan, catalog, spec)   # deploy.py: the chosen host's files are written by generate()
    deferred += spec.deployment.deferred
    return Conversion(spec, notes + deferred_notes + deferred)
