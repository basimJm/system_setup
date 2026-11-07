"""SDKs and providers of a plan (phase 5). `plan_sdks` turns the plan's `sdks` into what is generated: `internal` builds the SDK folder
(a dedicated overlay from `templates/sdk/kinds/`, or the generic overlay for an SDK the template does not know), `published` records
package and version and makes the server depend on it, `none` generates nothing. Each chosen provider then becomes, per SDK:
  - a ready adapter (`catalog/providers.json` `adapter` -> `templates/sdk/providers/<sdk>/<adapter>/`) copied in, its npm dependencies
    added to that SDK's package.json, its environment key names added to `.env.example`;
  - `builtin`: the adapter is already inside the SDK overlay, only the default is named;
  - otherwise a skeleton: an adapter implementing the port that rejects every call, a test that fails until it is implemented
    (`it.failing`, listing what is missing), and a backlog row.
Everything is data (catalog + template folders); no SDK or provider has code of its own here."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from catalog import Catalog
from engine import substitute_tokens
from plan import Plan
from prompts import FIXED_PREFIXES, MAIN_BRANCH, Spec, pascal_from, prefix_from, slug_from, unique_prefix

GENERIC_LAYER = "kinds/generic"
PROVIDERS_DIR = "providers"
SKELETON_DIR = "skeleton"
ADAPTER_FILE = "adapter.json"
ADAPTER_FILES_DIR = "files"
PROVIDERS_MODULE = "src/config/providers.ts"
INDEX_FILE = "src/index.ts"
ENV_FILE = ".env.example"
INTEGRATION_FILE = ".claude/Integration.md"
PACKAGE_FILE = "package.json"
RESERVED_IDS = ("server", "admin", MAIN_BRANCH)
DEDICATED_PREFIXES = ("STO", "OTP", "NOT", "PAY", "ANA")  # the prefixes of the five dedicated overlays stay free of clashes
ROOT_INTEGRATION = "INTEGRATION.md"
PUBLISHED_HEADING = "## Published SDKs (used, not built here)"
MODE_ADAPTER, MODE_BUILTIN, MODE_SKELETON = "adapter", "builtin", "skeleton"
UNSAFE = re.compile(r"[^A-Za-z0-9 .,:;()\-/'’]+")


@dataclass
class ProviderUse:
    id: str
    title: str
    known: bool
    channel: str
    sdk: str                       # the SDK the catalog lists the provider under ("" when unknown)
    adapter: str = ""
    builtin: bool = False
    port: Dict[str, Any] = field(default_factory=dict)

    @property
    def mode(self) -> str:
        return MODE_ADAPTER if self.adapter else MODE_BUILTIN if self.builtin else MODE_SKELETON


@dataclass
class SdkPlan:
    id: str
    title: str
    why: str
    source: str
    package: str = ""
    version: str = ""
    dedicated: bool = False        # a dedicated overlay exists in the catalog (`generated: true`)
    providers: List[ProviderUse] = field(default_factory=list)


@dataclass
class Selection:
    internal: List[SdkPlan] = field(default_factory=list)
    published: List[SdkPlan] = field(default_factory=list)
    overrides: Dict[str, Dict[str, str]] = field(default_factory=dict)   # generic SDKs: prefix, title, dir, description
    deferred: List[str] = field(default_factory=list)


@dataclass
class Applied:
    """What provider handling did to one generated SDK."""
    dependencies_added: bool = False
    rows: List[Tuple[str, str, str, str]] = field(default_factory=list)  # (title, branch key, status, note) for the backlog
    written: List[str] = field(default_factory=list)


def one_line(text: str) -> str:
    """Prose that is safe inside a comment, a Markdown cell and a TypeScript doc block (no quotes of code, no `*/`, no `__`)."""
    return " ".join(UNSAFE.sub(" ", text).replace("__", " ").split())


def provider_uses(sdk_id: str, provider_text: str, catalog: Catalog) -> List[ProviderUse]:
    uses: List[ProviderUse] = []
    for name in catalog.provider_ids(provider_text):
        found = catalog.find_provider(name)
        if found is not None:
            same = found.sdk == sdk_id   # adapters and builtins are written for the SDK the catalog lists the provider under
            uses.append(ProviderUse(found.id, found.title, True, found.channel, found.sdk, found.adapter if same else "",
                                    found.builtin and same, catalog.port_for(sdk_id, found.channel)))
        else:
            uses.append(ProviderUse(slug_from(name) or "provider", one_line(name) or "provider", False, "", "", "", False,
                                    catalog.port_for(sdk_id, "")))
    return uses


def plan_sdks(plan: Plan, catalog: Catalog) -> Selection:
    """Splits the plan's SDKs by `source` and derives the names of the ones built from the generic overlay."""
    selection = Selection()
    taken = list(FIXED_PREFIXES.values()) + list(DEDICATED_PREFIXES)
    for sdk in plan.sdks:
        item = SdkPlan(sdk.id, sdk.title, sdk.why, sdk.source, sdk.package, sdk.version, catalog.sdks[sdk.id].generated if sdk.id in catalog.sdks else False,
                       provider_uses(sdk.id, sdk.provider, catalog))
        if sdk.source == "published":
            selection.published.append(item)
        elif sdk.source == "internal":
            if sdk.id in RESERVED_IDS:
                selection.deferred.append(f"SDK '{sdk.id}' ({sdk.title}): the id is a master branch name, so no folder is generated; rename it in the plan")
                continue
            selection.internal.append(item)
            if not item.dedicated:
                prefix = unique_prefix(prefix_from(sdk.id), taken, sdk.id)
                taken.append(prefix)
                description = one_line(f"{sdk.title}. {sdk.why}") or sdk.id
                selection.overrides[sdk.id] = {"dir": GENERIC_LAYER, "prefix": prefix, "title": pascal_from(sdk.id), "description": description}
    return selection


# ---------- providers inside one generated SDK ----------

def class_name(provider: ProviderUse, port: Dict[str, Any], values: Dict[str, str]) -> str:
    interface = substitute_tokens(str(port["interface"]), values)
    return pascal_from(provider.id) + interface[:1].upper() + interface[1:]


def method_blocks(port: Dict[str, Any], values: Dict[str, str]) -> str:
    interface = substitute_tokens(str(port["interface"]), values)
    blocks = [f"  {name}(): ReturnType<{interface}['{name}']> {{\n    return Promise.reject(notImplemented());\n  }}" for name in port["methods"]]
    blocks += [f"  {name}(): ReturnType<{interface}['{name}']> {{\n    throw notImplemented();\n  }}" for name in port.get("sync", [])]
    return "\n\n".join(blocks)


def provider_values(provider: ProviderUse, port: Dict[str, Any], values: Dict[str, str], missing: List[str]) -> Dict[str, str]:
    interface = substitute_tokens(str(port["interface"]), values)
    methods = [*port["methods"], *port.get("sync", [])]
    return {
        "__PROVIDER_ID__": provider.id,
        "__PROVIDER_TITLE__": one_line(provider.title) or provider.id,
        "__PROVIDER_CLASS__": class_name(provider, port, values),
        "__PORT_INTERFACE__": interface,
        "__PORT_METHODS__": method_blocks(port, values),
        "__PORT_METHOD_LIST__": "[" + ", ".join(f"'{name}'" for name in methods) + "]",
        "__PORT_CALL__": substitute_tokens(str(port["call"]), values),
        "__MISSING_INLINE__": "; ".join(missing),
        "__MISSING_LINES__": "\n".join(f" * - {item}" for item in missing),
    }


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def read_adapter(template_root: Path, provider: ProviderUse) -> Tuple[Dict[str, Any], Path]:
    folder = template_root / PROVIDERS_DIR / provider.sdk / provider.adapter
    meta_path = folder / ADAPTER_FILE
    if not meta_path.is_file():
        raise ValueError(f"provider {provider.id}: adapter overlay {folder} has no {ADAPTER_FILE}")
    return json.loads(meta_path.read_text(encoding="utf-8")), folder


def copy_adapter(folder: Path, dest: Path, values: Dict[str, str]) -> List[str]:
    written = []
    source_root = folder / ADAPTER_FILES_DIR
    for source in sorted(p for p in source_root.rglob("*") if p.is_file()):
        rel = source.relative_to(source_root).as_posix()
        write_text(dest / substitute_tokens(rel, values), substitute_tokens(source.read_text(encoding="utf-8"), values))
        written.append(rel)
    return written


def merge_dependencies(dest: Path, dependencies: Dict[str, str], dev_dependencies: Dict[str, str]) -> bool:
    if not dependencies and not dev_dependencies:
        return False
    path = dest / PACKAGE_FILE
    data = json.loads(path.read_text(encoding="utf-8"))
    for key, added in (("dependencies", dependencies), ("devDependencies", dev_dependencies)):
        if added:
            data[key] = dict(sorted({**data.get(key, {}), **added}.items()))
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return True


def providers_module(item: SdkPlan, uses: List[ProviderUse]) -> str:
    entries = ",\n".join(f"  {{ id: '{u.id}', channel: '{u.channel or 'unspecified'}', adapter: '{'ready' if u.mode == MODE_ADAPTER else u.mode}' }}" for u in uses)
    default = uses[0].id if uses else ""
    return ("/** Written by SYSTEM_SETUP from the plan. `adapter`: ready = copied from a tested adapter, builtin = inside this SDK, "
            "skeleton = rejects every call until it is implemented (see the backlog). */\n"
            f"export const CHOSEN_PROVIDERS = [\n{entries},\n] as const;\n\n"
            f"/** The provider the SDK is configured for unless the environment says otherwise. */\nexport const DEFAULT_PROVIDER = '{default}';\n")


def providers_test() -> str:
    return ("import { CHOSEN_PROVIDERS, DEFAULT_PROVIDER } from '../src';\n\n"
            "describe('chosen providers', () => {\n"
            "  it('names the default provider among the chosen ones', () => {\n"
            "    expect(CHOSEN_PROVIDERS.map((provider) => provider.id)).toContain(DEFAULT_PROVIDER);\n"
            "  });\n});\n")


def apply_providers(spec: Spec, sdk: str, template_root: Path, catalog_missing: List[str]) -> Applied:
    """Provider handling for one generated SDK (called right after the SDK template is instantiated)."""
    item: Optional[SdkPlan] = spec.sdk_plans.get(sdk)
    applied = Applied()
    if item is None or not item.providers:
        return applied
    dest = spec.target / spec.sdk_dir(sdk)
    values = {**spec.token_values(), **spec.sdk_values(sdk)}
    exports: List[str] = []
    env_lines: List[str] = []
    dependencies: Dict[str, str] = {}
    dev_dependencies: Dict[str, str] = {}
    notes: List[str] = []
    for use in item.providers:
        if use.mode == MODE_ADAPTER:
            meta, folder = read_adapter(template_root, use)
            own = {**values, "__PROVIDER_ID__": use.id}
            applied.written += copy_adapter(folder, dest, own)
            dependencies.update(meta.get("dependencies", {}))
            dev_dependencies.update(meta.get("dev_dependencies", {}))
            exports += [substitute_tokens(line, own) for line in meta.get("exports", [])]
            keys = [substitute_tokens(key, own) for key in meta.get("env", [])]
            env_lines += [f"# {use.title} ({use.channel}): ready adapter", *[f"{key}=" for key in keys]]
            usage = substitute_tokens(meta.get("usage", ""), own)
            notes.append(f"- **{use.title}** (`{use.id}`, {use.channel}): ready adapter `src/adapters/{use.id}.ts`, ported from {meta.get('ported_from', 'a production adapter')}."
                         + (f" Environment keys: {', '.join(f'`{k}`' for k in keys)}." if keys else "")
                         + (f"\n  ```ts\n  {usage.replace(chr(10), chr(10) + '  ')}\n  ```" if usage else "")
                         + (f"\n  {meta['notes']}" if meta.get("notes") else ""))
            applied.rows.append((f"{use.title} adapter: real proof with a live account (unit tests use a stub)", f"{use.id}-proof", "PENDING",
                                 f"owner input: {use.title} account and credentials (environment or secret store only)"))
        elif use.mode == MODE_BUILTIN:
            env_lines.append(f"# {use.title} ({use.channel}): built into this SDK")
            notes.append(f"- **{use.title}** (`{use.id}`, {use.channel}): built into this SDK; configure it through the options and the keys above.")
        else:
            port = use.port
            tokens = provider_values(use, port, values, catalog_missing)
            skeleton = template_root / PROVIDERS_DIR / SKELETON_DIR
            own = {**values, **tokens}
            write_text(dest / f"src/adapters/{use.id}.ts", substitute_tokens((skeleton / "adapter.ts").read_text(encoding="utf-8"), own))
            write_text(dest / f"tests/{use.id}.test.ts", substitute_tokens((skeleton / "adapter.test.ts").read_text(encoding="utf-8"), own))
            applied.written += [f"src/adapters/{use.id}.ts", f"tests/{use.id}.test.ts"]
            exports.append(f"export {{ {tokens['__PROVIDER_CLASS__']} }} from './adapters/{use.id}';")
            env_lines.append(f"# {use.title} ({use.channel or 'channel not stated'}): skeleton only; its credential keys are added when the adapter is written")
            notes.append(f"- **{use.title}** (`{use.id}`, {use.channel or 'channel not stated'}): " + ("NOT in the provider catalog; " if not use.known else "no ready adapter; ")
                         + f"skeleton `src/adapters/{use.id}.ts` implements `{tokens['__PORT_INTERFACE__']}` and rejects every call. "
                         f"The expected-failure test `tests/{use.id}.test.ts` lists what is missing: " + "; ".join(catalog_missing) + ".")
            applied.rows.append((f"{use.title} adapter for {sdk}: implement the skeleton ({'; '.join(catalog_missing)})", f"{use.id}-adapter", "TODO",
                                 f"owner input: {use.title} account and credentials; skeleton src/adapters/{use.id}.ts, test tests/{use.id}.test.ts" + ("" if use.known else "; provider not in the catalog")))
    if not item.dedicated:
        applied.rows.insert(0, (f"Write the BRD of {sdk} and shape its port (operations, request and result) from the real need", "port", "TODO",
                                "owner input: which operations the business needs; generic skeleton in src/types.ts"))
    write_text(dest / PROVIDERS_MODULE, providers_module(item, item.providers))
    write_text(dest / "tests/providers.test.ts", providers_test())
    applied.written += [PROVIDERS_MODULE, "tests/providers.test.ts"]
    with (dest / INDEX_FILE).open("a", encoding="utf-8") as handle:
        handle.write("export { CHOSEN_PROVIDERS, DEFAULT_PROVIDER } from './config/providers';\n" + "\n".join(exports) + ("\n" if exports else ""))
    with (dest / ENV_FILE).open("a", encoding="utf-8") as handle:
        handle.write(f"# Default provider: {item.providers[0].id} (src/config/providers.ts). Keys only, never values.\n" + "\n".join(env_lines) + "\n")
    integration = dest / INTEGRATION_FILE
    section = ("\n## Providers (from the plan)\n" + "\n".join(notes) + "\n")
    applied.dependencies_added = merge_dependencies(dest, dependencies, dev_dependencies)
    if applied.dependencies_added:
        section += ("\nThe adapter's npm packages were added to `package.json`; the generated `package-lock.json` does not list them yet. "
                    "Run `npm install` once and commit the new lock; `npm ci` works after that.\n")
    with integration.open("a", encoding="utf-8") as handle:
        handle.write(section)
    return applied


# ---------- backlog rows ----------

ROW_ID_RE = re.compile(r"^\|\s*([A-Z][A-Z0-9]*)-(\d+)\s*\|", re.M)


def append_backlog_rows(path: Path, prefix: str, rows: List[Tuple[str, str, str, str]]) -> List[str]:
    """Appends rows to a backlog (`| ID | Task | Branch | Needs | Status | Notes |`), numbered after the highest id; returns the ids."""
    if not rows or not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    numbers = [int(n) for p, n in ROW_ID_RE.findall(text) if p == prefix]
    number, ids, lines = max(numbers or [0]), [], []
    for title, key, status, note in rows:
        number += 1
        identifier = f"{prefix}-{number:03d}"
        ids.append(identifier)
        lines.append(f"| {identifier} | {title} | `feat/{prefix.lower()}-{number:03d}-{key}` | {prefix}-001 | {status} | {note} |")
    write_text(path, text.rstrip("\n") + "\n" + "\n".join(lines) + "\n")
    return ids


# ---------- published SDKs ----------

def add_published_dependencies(spec: Spec) -> bool:
    """The server depends on every published SDK: its `package.json` gets the package and the version."""
    if not spec.published_sdks or not spec.with_server:
        return False
    path = spec.target / spec.server_dir / PACKAGE_FILE
    if not path.is_file():
        return False
    data = json.loads(path.read_text(encoding="utf-8"))
    deps = dict(data.get("dependencies", {}))
    deps.update({item.package: item.version for item in spec.published_sdks})
    data["dependencies"] = dict(sorted(deps.items()))
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return True


def published_section(spec: Spec) -> str:
    rows = ["| SDK | Package | Version | Provider | Consumer |", "|---|---|---|---|---|"]
    consumer = f"`{spec.server_dir}/package.json` (dependencies)" if spec.with_server else "no server in this system"
    for item in spec.published_sdks:
        providers = ", ".join(u.title for u in item.providers) or "not stated"
        rows.append(f"| {item.title} (`{item.id}`) | `{item.package}` | `{item.version}` | {providers} | {consumer} |")
    return (f"\n{PUBLISHED_HEADING}\n\nThese SDKs already exist as packages: no folder is generated for them. The server depends on them; "
            "install them from the registry that serves their scope (add it to the server's `.npmrc` if it is private).\n\n" + "\n".join(rows) + "\n")


def record_published(spec: Spec) -> Optional[str]:
    """Adds the published-SDK section to the root INTEGRATION.md (created when the workspace template has none)."""
    if not spec.published_sdks:
        return None
    path = spec.target / ROOT_INTEGRATION
    text = path.read_text(encoding="utf-8") if path.is_file() else f"# {spec.system_name} — Integration\n"
    if PUBLISHED_HEADING not in text:
        write_text(path, text.rstrip("\n") + "\n" + published_section(spec))
    return ROOT_INTEGRATION
