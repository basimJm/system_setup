#!/usr/bin/env python3
"""SYSTEM_SETUP: create a brand-new multi-project system (server + admin + KMP apps + SDKs + the AI-agent workspace).

Interactive: run it and answer the questions (Enter keeps the default, an empty optional answer skips it).
Non-interactive: pass the values as flags and --yes. See README.md next to this file.

From a business description instead of answers:
  SYSTEM_SETUP intake [--out BUSINESS.md]       Claude interviews you and writes the business document
  SYSTEM_SETUP new [--business-doc FILE | --plan FILE] [--yes] [--target DIR]
                                                analyze, review the plan with you, generate
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

from business import (FIELDS, PROMPT_FILE, REVIEW_PROMPT_NAME, Business, ask_business, business_from, load_business_file,  # noqa: E402
                      prompt_placeholders, write_agent_prompt, write_business_input)
from deploy import write_deployment  # noqa: E402
from audiences import AudiencePlan  # noqa: E402
from engine import EngineError, Result, check_target, instantiate, run_post_generate  # noqa: E402
from kmp import check_kmp_manifest, identity_leftovers, instantiate_apps  # noqa: E402
from manifest import KINDS, Manifest, ManifestError, available_kinds, load_manifest, templates_root, tool_root  # noqa: E402
from sdks import add_published_dependencies, append_backlog_rows, apply_providers, record_published  # noqa: E402
from prompts import (SDK_CATALOG, SDK_DESCRIPTIONS, Spec, ask, parse_apps, parse_webs, slug_from, split_list, system_prefix_from,  # noqa: E402
                     validate_app_specs, validate_github_name, validate_npm_scope, validate_package, validate_prefix,
                     validate_required, validate_sdk_names, validate_team_id, validate_url)
from workspace import (copy_knowledge, ensure_project_files, git_init, next_steps, projects_registry, projects_table,  # noqa: E402
                       registry_shipped, run_tasks_check, workspace_values, write_registry)

YES = ("y", "yes")
DEFAULT_PACKAGE_ROOT = "com.example"


@dataclass
class Report:
    results: List[Result] = field(default_factory=list)
    created: List[str] = field(default_factory=list)
    knowledge: List[str] = field(default_factory=list)
    post_failures: List[str] = field(default_factory=list)
    check_ok: Optional[bool] = None
    check_output: str = ""
    git_error: Optional[str] = None
    git_done: bool = False   # a repository was created (False with --no-git: nothing to report as initialised)
    audience_notes: List[str] = field(default_factory=list)   # which server audience each role got, and what was left for later
    documents: Any = None  # the Outcome of the document step (documents.py), when it ran
    identity_left: Dict[str, List[str]] = field(default_factory=dict)
    steps: List[str] = field(default_factory=list)
    deploy_files: List[str] = field(default_factory=list)   # the chosen hosts' config and guides (deploy.py)
    warnings: List[str] = field(default_factory=list)       # things that work but need the person's attention (printed after the report)

    @property
    def unresolved(self) -> Dict[str, List[str]]:
        merged: Dict[str, List[str]] = {}
        for result in self.results:
            merged.update(result.unresolved)
        return merged

    @property
    def sentinel_left(self) -> Dict[str, List[str]]:
        merged: Dict[str, List[str]] = {}
        for result in self.results:
            merged.update(result.sentinel_left)
        return merged

    @property
    def ok(self) -> bool:
        unfinished = bool(self.documents is not None and (self.documents.unfinished or self.documents.stopped))
        return not self.post_failures and self.check_ok is not False and self.git_error is None and not unfinished


def yes_no(value: str) -> Optional[str]:
    return None if value.lower() in (*YES, "n", "no") else "answer y or n"


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", help="system name in English, e.g. 'Acme Shop'")
    parser.add_argument("--name-ar", help="system name in Arabic (default: the English name)")
    parser.add_argument("--prefix", help="short upper prefix for folders and task ids, e.g. ACME")
    parser.add_argument("--package-root", help="Kotlin/Android package root, e.g. com.acme")
    parser.add_argument("--npm-scope", help="npm scope of the SDKs, e.g. @acme")
    parser.add_argument("--target", type=Path, help="folder to create (absent or empty; never inside this tool)")
    parser.add_argument("--no-server", action="store_true", help="skip the backend")
    parser.add_argument("--no-admin", action="store_true", help="skip the admin web panel")
    parser.add_argument("--app", action="append", default=None, metavar="NAME[:slug[:arabic]]",
                        help="a KMP app, repeatable, e.g. --app Customer:customer --app Merchant:merchant")
    parser.add_argument("--web", action="append", default=None, metavar="NAME[:slug[:arabic]]",
                        help="a web app (customer portal, merchant site ...) from the web template, repeatable, e.g. --web 'Parent Portal:parent-portal'")
    parser.add_argument("--sdk", action="append", default=None, metavar="NAME",
                        help=f"an SDK from the catalog ({', '.join(SDK_CATALOG)}), repeatable or comma separated")
    parser.add_argument("--dev-api-url")
    parser.add_argument("--prod-api-url")
    parser.add_argument("--dev-web-url")
    parser.add_argument("--prod-web-url")
    parser.add_argument("--team-id", help="Apple Team ID (10 characters; default: none)")
    parser.add_argument("--github-owner", help="GitHub owner used in the docs")
    parser.add_argument("--repo-name", help="GitHub repository name used in the docs (default: the system slug)")
    business = parser.add_argument_group("business domain (interactive questions; or --business FILE; or these flags; "
                                         "--yes keeps TBD placeholders the generated docs flag as open)")
    business.add_argument("--business", type=Path, metavar="FILE", help="answers file: .md with `## <field>` headings or .json with the field keys")
    for spec in FIELDS:
        business.add_argument(f"--{spec.key.replace('_', '-')}", dest=f"biz_{spec.key}", metavar="TEXT",
                              help=spec.question + ("; items `;`-separated" if spec.kind == "list" else "") + f" (default: {spec.default})")
    parser.add_argument("--templates", type=Path, default=None, help="templates folder (default: the tool's templates/)")
    parser.add_argument("--knowledge", type=Path, default=None, help="folder of LESSONS.md/PLAYBOOKS.md to copy to docs/knowledge/ (default: the tool's knowledge/)")
    parser.add_argument("--run-post", action="store_true", help="run each template's post_generate commands")
    parser.add_argument("--no-git", action="store_true", help="do not run 'git init' + first commit")
    parser.add_argument("--list-templates", action="store_true", help="show the template kinds found and exit")
    parser.add_argument("--yes", action="store_true", help="never prompt: use flags and defaults")
    return parser.parse_args(argv)


def collect(args: argparse.Namespace, reader: Callable[[str], str] = input) -> Spec:
    interactive = not args.yes

    def value(current: Optional[str], question: str, default: str = "", check=None) -> str:
        if current is not None:
            error = check(current) if check else None
            if error:
                sys.exit(f"{question}: {error}")
            return current
        if interactive:
            return ask(question, default, check, reader)
        error = check(default) if check else None
        if error:
            sys.exit(f"{question}: {error} (pass the flag with --yes)")
        return default

    name = value(args.name, "System name (English)", check=validate_required)
    name_ar = value(args.name_ar, "System name (Arabic, Enter = same)", name)
    slug = slug_from(name)
    prefix = value(args.prefix, "Short prefix for folders and task ids", system_prefix_from(name), check=validate_prefix)
    package_root = value(args.package_root, "Package root (Kotlin / Android)", f"{DEFAULT_PACKAGE_ROOT}.{slug.replace('-', '')}",
                         check=validate_package)
    npm_scope = value(args.npm_scope, "npm scope of the SDKs", f"@{slug}", check=validate_npm_scope)
    target = Path(value(str(args.target) if args.target else None, "Create the system in folder",
                        str(Path.cwd() / slug), check=validate_required)).expanduser()
    with_server = not args.no_server and (not interactive or value(None, "Include the backend server? (y/n)", "y",
                                                                   check=yes_no).lower() in YES)
    with_admin = not args.no_admin and (not interactive or value(None, "Include the admin web panel? (y/n)", "y",
                                                                 check=yes_no).lower() in YES)
    apps_text = value(",".join(args.app) if args.app is not None else None,
                      "KMP apps as Name:slug, comma separated (Enter = none)", "", check=validate_app_specs)
    if interactive and args.sdk is None:
        print("  SDK catalog: " + "; ".join(f"{k} = {v}" for k, v in SDK_DESCRIPTIONS.items()))
    sdks_text = ",".join(args.sdk) if args.sdk is not None else None
    sdks_text = value(sdks_text, "SDKs from the catalog, comma separated (Enter = none)", "", check=validate_sdk_names)
    spec = Spec(system_name=name, system_name_ar=name_ar, prefix=prefix, package_root=package_root, npm_scope=npm_scope,
                target=target.resolve(), with_server=with_server, with_admin=with_admin, apps=parse_apps(apps_text),
                sdks=split_list(sdks_text), webs=parse_webs(",".join(args.web or [])))
    spec.dev_api_url = value(args.dev_api_url, "Dev API base URL", spec.dev_api_url, check=validate_url)
    spec.prod_api_url = value(args.prod_api_url, "Prod API base URL", spec.prod_api_url, check=validate_url)
    spec.dev_web_url = value(args.dev_web_url, "Dev web URL (admin panel, deep links)", spec.dev_web_url, check=validate_url)
    spec.prod_web_url = value(args.prod_web_url, "Prod web URL (admin panel, deep links)", spec.prod_web_url, check=validate_url)
    spec.apple_team_id = value(args.team_id, "Apple Team ID (Enter = skip)", "", check=validate_team_id)
    spec.owner_github = value(args.github_owner, "GitHub owner (for the docs)", spec.owner_github, check=validate_github_name)
    spec.repo_name = value(args.repo_name, "GitHub repository name (for the docs)", slug, check=validate_github_name)
    spec.business = collect_business(args, interactive, reader)
    return spec


def collect_business(args: argparse.Namespace, interactive: bool, reader: Callable[[str], str]) -> Business:
    """File (`--business`) first, flags on top of it, then the interactive questions (skipped under --yes or when a file
    or a flag already answered)."""
    flagged = {spec.key: getattr(args, f"biz_{spec.key}") for spec in FIELDS if getattr(args, f"biz_{spec.key}") is not None}
    try:
        business = load_business_file(args.business.expanduser()) if args.business else Business()
        business = business_from(flagged, business)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        sys.exit(f"Business domain: {error}")
    if interactive and not args.business and not flagged:
        print("\nBusiness domain (Enter keeps the default; TBD answers are listed as open decisions in the generated docs)")
        business = ask_business(reader, ask, business)
    return business


def needed_kinds(spec: Spec) -> List[str]:
    kinds = []
    if spec.with_server:
        kinds.append("server")
    if spec.with_admin:
        kinds.append("admin")
    if spec.sdks:
        kinds.append("sdk")
    if spec.apps:
        kinds.append("kmp")
    if spec.webs:
        kinds.append("web")
    kinds.append("workspace")
    return kinds


def load_templates(root: Path, kinds: List[str]) -> Dict[str, Manifest]:
    found = available_kinds(root)
    missing = [kind for kind in kinds if kind not in found]
    if missing:
        raise ManifestError(f"templates missing in {root}: {', '.join(missing)} (found: {', '.join(found) or 'none'})")
    manifests = {kind: load_manifest(root / kind) for kind in kinds}
    if "kmp" in manifests:
        problems = check_kmp_manifest(manifests["kmp"])
        if problems:
            raise ManifestError("templates/kmp/TEMPLATE.json: " + "; ".join(problems))
    return manifests


def apply_sdk_kinds(spec: Spec, manifest: Optional[Manifest]) -> None:
    """The sdk template's `kinds` decide which SDKs exist (prefix, title, overlay folder); the overlay folder of every
    chosen SDK must exist in the template."""
    if manifest is None:
        return
    if manifest.kinds:
        # An SDK the template does not declare is built from the generic overlay when the plan derived its names (planspec).
        unknown = [sdk for sdk in spec.sdks if sdk not in manifest.kinds and sdk not in spec.sdk_overrides]
        if unknown:
            raise ManifestError(f"the sdk template has no kind(s) {', '.join(unknown)}; it declares: {', '.join(sorted(manifest.kinds))}")
        spec.sdk_overrides = {sdk: dict(manifest.kinds[sdk]) if sdk in manifest.kinds else spec.sdk_overrides[sdk] for sdk in spec.sdks}
    if manifest.layers != ["."]:
        missing = [sdk for sdk in spec.sdks if not (manifest.root / spec.sdk_layer(sdk)).is_dir()]
        if missing:
            shipped = sorted(p.name for p in (manifest.root / "kinds").iterdir() if p.is_dir()) if (manifest.root / "kinds").is_dir() else []
            raise ManifestError(f"the sdk template has no overlay folder for {', '.join(missing)} "
                                f"({', '.join(spec.sdk_layer(s) for s in missing)}); folders shipped under kinds/: {', '.join(shipped) or 'none'}")


def generate(spec: Spec, templates: Path, run_post: bool = False, git: bool = True,
             tool: Optional[Path] = None, knowledge: Optional[Path] = None, prompt: Optional[Path] = None,
             extra_files: Optional[Dict[str, str]] = None, documents: Optional[Callable[[Path], Any]] = None) -> Report:
    tool = tool or tool_root()
    check_target(spec.target, tool)
    manifests = load_templates(templates, needed_kinds(spec))
    apply_sdk_kinds(spec, manifests.get("sdk"))
    spec.target.mkdir(parents=True, exist_ok=True)
    report = Report()
    values, parts = spec.token_values(), spec.part_values()
    registry = projects_registry(spec)
    if "server" in manifests:
        audiences = spec.audience_plan()
        report.audience_notes = audience_notes(audiences)
        report.results.append(instantiate(manifests["server"], spec.target, values, parts, drop=[r for r in audiences.dropped if r in manifests["server"].prune],
                                          audiences={role: a.slug for role, a in audiences.chosen.items()}))
    if "admin" in manifests:
        report.results.append(instantiate(manifests["admin"], spec.target, values, parts))
    for web in spec.webs:
        report.results.append(instantiate(manifests["web"], spec.target, dict(values, **spec.web_values(web)), parts))
    sdk_rows: Dict[str, List[Any]] = {}
    for sdk in spec.sdks:
        sdk_values = dict(values, **spec.sdk_values(sdk))
        result = instantiate(manifests["sdk"], spec.target, sdk_values, parts)
        applied = apply_providers(spec, sdk, manifests["sdk"].root, spec.skeleton_missing)   # chosen providers: adapter, builtin or skeleton
        sdk_rows[sdk] = applied.rows
        if applied.written or spec.sdk_overrides.get(sdk):   # generated names change line breaks: format once before `verify`
            result.post_generate = [part for command in result.post_generate for part in (["npm run format", command] if command == "npm run verify" else [command])]
        if applied.dependencies_added:   # the shipped lock does not list the adapters' packages: `npm ci` would refuse it
            result.post_generate = ["npm install" if command == "npm ci" else command for command in result.post_generate]
        report.results.append(result)
    if spec.apps:
        app_results = instantiate_apps(manifests["kmp"], spec.target, spec)
        report.results.extend(app_results)
        for app, result in zip(spec.apps, app_results):
            left = identity_leftovers(result.dest)
            if left:
                report.identity_left[spec.app_dir(app)] = left
    report.results.append(instantiate(manifests["workspace"], spec.target, dict(values, **workspace_values(spec, registry)), parts))
    if not registry_shipped(spec.target, registry):
        write_registry(spec.target, registry)
    report.created = ensure_project_files(spec.target, registry)
    projects = registry["projects"]
    if "server" in manifests and spec.audience_plan().extra:
        append_backlog_rows(spec.target / projects["server"]["backlog"], projects["server"]["prefix"], audience_rows(spec.audience_plan()))
    for sdk, rows in sdk_rows.items():   # one backlog row per skeleton adapter / unproven adapter / new SDK port, after the starter rows
        append_backlog_rows(spec.target / projects[sdk]["backlog"], projects[sdk]["prefix"], rows)
    if add_published_dependencies(spec):   # the server depends on the published SDKs; its lock is stale until `npm install`
        for result in report.results:
            if result.kind == "server":
                result.post_generate = ["npm install" if command == "npm ci" else command for command in result.post_generate]
    record_published(spec)
    deployed = write_deployment(spec, templates, registry)   # only the chosen host's config + guide per part, docs/DEPLOYMENT.md, PENDING rows
    report.deploy_files, report.warnings = deployed.files, deployed.warnings
    report.created.append(write_business_input(spec.target, spec.business, spec.system_name, spec.today.isoformat()))
    for rel, text in (extra_files or {}).items():  # e.g. system.plan.json and the business document, part of the first commit
        path = spec.target / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        report.created.append(rel)
    if documents is not None:  # the model writes the domain, BRDs, PRDs, backlogs, ... before the first check, post step and commit
        report.documents = documents(spec.target)
    written = report.documents is not None and report.documents.generated
    prompt_rel = write_agent_prompt(spec.target, prompt or tool_root() / PROMPT_FILE, prompt_placeholders(
        spec.system_name, spec.business, projects_table(registry), ", ".join(f"`{m}`" for m in spec.masters()),
        f"github.com/{spec.owner_github}/{spec.repo_name or spec.slug}", spec.today.isoformat(),
        report.documents.status_text() if written else ""), REVIEW_PROMPT_NAME if written else "AGENT_PROMPT")
    if prompt_rel:
        report.created.append(prompt_rel)
    report.knowledge = copy_knowledge(spec.target, knowledge if knowledge is not None else tool / "knowledge")
    if run_post:
        for result in report.results:
            report.post_failures.extend(run_post_generate(result))
    report.check_ok, report.check_output = run_tasks_check(spec.target)
    if git:
        report.git_error = git_init(spec.target, f"{spec.system_name}: system generated by SYSTEM_SETUP", spec.masters())
        report.git_done = report.git_error is None
    report.steps = next_steps(spec, registry, git_done=git and report.git_error is None, documents=written)
    return report


def audience_notes(plan: AudiencePlan) -> List[str]:
    """What the server got: one line per role generated, dropped, or left for later (printed after the report)."""
    notes = [f"{role}: audience '{a.slug}' (REST prefix /{a.slug}/v1)" for role, a in plan.chosen.items()]
    notes += [f"{role}: no module of this role, so the server has none of its code" for role in plan.dropped]
    notes += [f"'{a.slug}' ({a.role}): not generated; the server template has one module per role, so '{a.slug}' shares the "
              f"role of '{plan.chosen[a.role].slug}'. A PENDING row in the server backlog asks to copy it" for a in plan.extra]
    return notes


def audience_rows(plan: AudiencePlan) -> List[Tuple[str, str, str, str]]:
    return [(f"Server audience '{a.slug}' ({a.role}): copy the '{plan.chosen[a.role].slug}' module for it", f"audience-{a.slug}", "PENDING",
             f"Routes /{a.slug}/v1 and socket /{a.slug} do not exist yet; the client calls them. Copy src/modules/{plan.chosen[a.role].slug}, its auth service, "
             f"constants, docs and tests under the new name, then mount it in src/routes/index.ts and src/docs/index.ts")
            for a in plan.extra]


def describe(spec: Spec) -> str:
    parts = []
    if spec.with_server:
        parts.append(spec.server_dir)
    if spec.with_admin:
        parts.append(spec.admin_dir)
    parts.extend(spec.app_dir(app) for app in spec.apps)
    parts.extend(spec.web_dir(web) for web in spec.webs)
    parts.extend(spec.sdk_dir(sdk) for sdk in spec.sdks)
    return f"{spec.system_name} ({spec.prefix}, {spec.package_root}, {spec.npm_scope}) in {spec.target}\n  parts: " + ", ".join(parts)


def print_report(report: Report, run_post: bool) -> None:
    for result in report.results:
        print(f"  {result.kind:9} -> {result.dest}  ({len(result.files)} files, {len(result.binaries)} binary)")
        if result.overwritten:
            print(f"            overwrote {len(result.overwritten)} file(s) written by an earlier template")
    if report.deploy_files:
        print(f"  deployment: {len(report.deploy_files)} file(s) for the chosen host(s): " + ", ".join(report.deploy_files))
    if report.created:
        print(f"  per-project files created ({len(report.created)}): " + ", ".join(report.created))
    if report.knowledge:
        print("  knowledge: " + ", ".join(report.knowledge))
    if report.documents is not None:
        print(f"  documents: {len(report.documents.created)} file(s) written by the model step; cost ${report.documents.spent_usd:.4f}"
              + (f"; {len(report.documents.unfinished)} not finished (see above)" if report.documents.unfinished else ""))
    if report.unresolved:
        print("\nUnresolved tokens (fix the template or the answers):")
        for rel, tokens in sorted(report.unresolved.items()):
            print(f"  {rel}: {', '.join(tokens)}")
    foreign = sorted({t for r in report.results for ts in r.foreign.values() for t in ts})
    if foreign:
        print(f"  (other __X__ strings kept as they are, not contract tokens: {', '.join(foreign)})")
    if report.sentinel_left:
        print("\nSentinel literals left in rendered files (the template's TEMPLATE.json maps them, but the text still has them):")
        for rel, literals in sorted(report.sentinel_left.items()):
            print(f"  {rel}: {', '.join(literals)}")
    for app_dir, rest in report.identity_left.items():
        print(f"\n{app_dir} still mentions the kmp sentinel identity in {len(rest)} file(s): " + ", ".join(rest[:10]))
    if report.warnings:
        print(f"\nWarnings ({len(report.warnings)}):")
        for warning in report.warnings:
            print(f"  ! {warning}")
    commands = [(r.kind, c) for r in report.results for c in r.post_generate]
    if commands:
        print("\nPost-generate commands" + (" (run):" if run_post else " (not run; pass --run-post or run them yourself):"))
        for kind, command in commands:
            print(f"  [{kind}] {command}")
    for failure in report.post_failures:
        print(f"  FAILED {failure}")
    if report.check_ok is None:
        print(f"\ntasks.py check: skipped — {report.check_output}")
    else:
        print(f"\ntasks.py check: {'OK' if report.check_ok else 'PROBLEMS'}" + (f"\n{report.check_output}" if report.check_output else ""))
    if report.audience_notes:
        print("\nServer audiences:")
        for note in report.audience_notes:
            print(f"  - {note}")
    print("\nGit: " + (report.git_error or ("initialised: first commit on main + local master branches" if report.git_done else "not initialised (--no-git): run git init yourself")))
    print("\nNext steps:")
    for step in report.steps:
        print(f"  - {step}")


def main(argv: List[str]) -> int:
    if argv and argv[0] in ("intake", "new", "documents"):  # the plan-driven flow (commands.py); the flat command below is unchanged
        from commands import run
        return run(argv, generate, print_report)
    args = parse_args(argv)
    templates = (args.templates or templates_root()).resolve()
    if args.list_templates:
        found = available_kinds(templates)
        for kind in KINDS:
            print(f"  {kind:9} {'ready' if kind in found else 'missing'}")
        return 0
    print("SYSTEM_SETUP — new multi-project system\n")
    try:
        spec = collect(args)
    except SystemExit as stop:  # a flag failed its validator
        print(stop)
        return 2
    print(f"\nCreating {describe(spec)}")
    if not args.yes and ask("Continue? (y/n)", "y").lower() not in YES:
        print("Cancelled.")
        return 1
    try:
        report = generate(spec, templates, run_post=args.run_post, git=not args.no_git, knowledge=args.knowledge)
    except (EngineError, ManifestError) as error:
        print(f"\n{error}")
        return 1
    print("\nDone.")
    print_report(report, args.run_post)
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
