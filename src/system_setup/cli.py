#!/usr/bin/env python3
"""SYSTEM_SETUP: create a brand-new multi-project system (server + admin + KMP apps + SDKs + the AI-agent workspace).

Interactive: run it and answer the questions (Enter keeps the default, an empty optional answer skips it).
Non-interactive: pass the values as flags and --yes. See README.md next to this file.
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from engine import EngineError, Result, check_target, instantiate, run_post_generate  # noqa: E402
from kmp import check_kmp_manifest, identity_leftovers, instantiate_apps  # noqa: E402
from manifest import KINDS, Manifest, ManifestError, available_kinds, load_manifest, templates_root, tool_root  # noqa: E402
from prompts import (SDK_CATALOG, SDK_DESCRIPTIONS, Spec, ask, parse_apps, slug_from, split_list, system_prefix_from,  # noqa: E402
                     validate_app_specs, validate_github_name, validate_npm_scope, validate_package, validate_prefix,
                     validate_required, validate_sdk_names, validate_team_id, validate_url)
from workspace import (copy_knowledge, ensure_project_files, git_init, next_steps, projects_registry,  # noqa: E402
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
    identity_left: Dict[str, List[str]] = field(default_factory=dict)
    steps: List[str] = field(default_factory=list)

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
        return not self.post_failures and self.check_ok is not False and self.git_error is None


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
    parser.add_argument("--sdk", action="append", default=None, metavar="NAME",
                        help=f"an SDK from the catalog ({', '.join(SDK_CATALOG)}), repeatable or comma separated")
    parser.add_argument("--dev-api-url")
    parser.add_argument("--prod-api-url")
    parser.add_argument("--dev-web-url")
    parser.add_argument("--prod-web-url")
    parser.add_argument("--team-id", help="Apple Team ID (10 characters; default: none)")
    parser.add_argument("--github-owner", help="GitHub owner used in the docs")
    parser.add_argument("--repo-name", help="GitHub repository name used in the docs (default: the system slug)")
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
                sdks=split_list(sdks_text))
    spec.dev_api_url = value(args.dev_api_url, "Dev API base URL", spec.dev_api_url, check=validate_url)
    spec.prod_api_url = value(args.prod_api_url, "Prod API base URL", spec.prod_api_url, check=validate_url)
    spec.dev_web_url = value(args.dev_web_url, "Dev web URL (admin panel, deep links)", spec.dev_web_url, check=validate_url)
    spec.prod_web_url = value(args.prod_web_url, "Prod web URL (admin panel, deep links)", spec.prod_web_url, check=validate_url)
    spec.apple_team_id = value(args.team_id, "Apple Team ID (Enter = skip)", "", check=validate_team_id)
    spec.owner_github = value(args.github_owner, "GitHub owner (for the docs)", spec.owner_github, check=validate_github_name)
    spec.repo_name = value(args.repo_name, "GitHub repository name (for the docs)", slug, check=validate_github_name)
    return spec


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
        unknown = [sdk for sdk in spec.sdks if sdk not in manifest.kinds]
        if unknown:
            raise ManifestError(f"the sdk template has no kind(s) {', '.join(unknown)}; it declares: {', '.join(sorted(manifest.kinds))}")
        spec.sdk_overrides = {sdk: dict(manifest.kinds[sdk]) for sdk in spec.sdks}
    if manifest.layers != ["."]:
        missing = [sdk for sdk in spec.sdks if not (manifest.root / spec.sdk_layer(sdk)).is_dir()]
        if missing:
            shipped = sorted(p.name for p in (manifest.root / "kinds").iterdir() if p.is_dir()) if (manifest.root / "kinds").is_dir() else []
            raise ManifestError(f"the sdk template has no overlay folder for {', '.join(missing)} "
                                f"({', '.join(spec.sdk_layer(s) for s in missing)}); folders shipped under kinds/: {', '.join(shipped) or 'none'}")


def generate(spec: Spec, templates: Path, run_post: bool = False, git: bool = True,
             tool: Optional[Path] = None, knowledge: Optional[Path] = None) -> Report:
    tool = tool or tool_root()
    check_target(spec.target, tool)
    manifests = load_templates(templates, needed_kinds(spec))
    apply_sdk_kinds(spec, manifests.get("sdk"))
    spec.target.mkdir(parents=True, exist_ok=True)
    report = Report()
    values, parts = spec.token_values(), spec.part_values()
    registry = projects_registry(spec)
    if "server" in manifests:
        report.results.append(instantiate(manifests["server"], spec.target, values, parts))
    if "admin" in manifests:
        report.results.append(instantiate(manifests["admin"], spec.target, values, parts))
    for sdk in spec.sdks:
        sdk_values = dict(values, **spec.sdk_values(sdk))
        report.results.append(instantiate(manifests["sdk"], spec.target, sdk_values, parts))
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
    report.knowledge = copy_knowledge(spec.target, knowledge if knowledge is not None else tool / "knowledge")
    if run_post:
        for result in report.results:
            report.post_failures.extend(run_post_generate(result))
    report.check_ok, report.check_output = run_tasks_check(spec.target)
    if git:
        report.git_error = git_init(spec.target, f"{spec.system_name}: system generated by SYSTEM_SETUP", spec.masters())
    report.steps = next_steps(spec, registry, git_done=git and report.git_error is None)
    return report


def describe(spec: Spec) -> str:
    parts = []
    if spec.with_server:
        parts.append(spec.server_dir)
    if spec.with_admin:
        parts.append(spec.admin_dir)
    parts.extend(spec.app_dir(app) for app in spec.apps)
    parts.extend(spec.sdk_dir(sdk) for sdk in spec.sdks)
    return f"{spec.system_name} ({spec.prefix}, {spec.package_root}, {spec.npm_scope}) in {spec.target}\n  parts: " + ", ".join(parts)


def print_report(report: Report, run_post: bool) -> None:
    for result in report.results:
        print(f"  {result.kind:9} -> {result.dest}  ({len(result.files)} files, {len(result.binaries)} binary)")
        if result.overwritten:
            print(f"            overwrote {len(result.overwritten)} file(s) written by an earlier template")
    if report.created:
        print(f"  per-project files created ({len(report.created)}): " + ", ".join(report.created))
    if report.knowledge:
        print("  knowledge: " + ", ".join(report.knowledge))
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
    print("\nGit: " + (report.git_error or "initialised: first commit on main + local master branches"))
    print("\nNext steps:")
    for step in report.steps:
        print(f"  - {step}")


def main(argv: List[str]) -> int:
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
