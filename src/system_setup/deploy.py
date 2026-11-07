"""Deployment of a plan (phase 6). The plan says where each part runs (`deployment`: part, host, database, cache). For every part the
engine generates, `write_deployment` writes only the chosen host's config and a short guide, copied from the data-driven overlay
`templates/deploy/<host's deploy>/<part kind>/` with tokens filled in (see `catalog/deploy.json`: each host names its overlay, each part
kind names its build, start, port, health path and environment key names). A new host is a folder and a line of JSON, never code.

  - An overlay may `extend` others (shared files) and alias a part kind to another (`web` -> `admin`): `overlay.json`.
  - A host that is not in the catalog, or whose overlay folder is missing, is deployed as `custom` (Docker plus a guide) with a PENDING task.
  - The generated server template uses MongoDB and Redis. Another database or cache is only recorded: generation continues, a warning is
    printed and a PENDING task says the data layer must change. Nothing switches automatically.
  - `docs/DEPLOYMENT.md` (the only generic file that names hosts) lists the plan's choices. Environment key names only, never a value.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, Dict, List, Optional, Tuple

from catalog import Catalog
from engine import EngineError, leftovers, substitute_tokens
from plan import Plan
from sdks import append_backlog_rows, one_line

CUSTOM = "custom"
OVERLAYS_DIR = "deploy"
OVERLAY_FILE = "overlay.json"
GUIDE_REL = "docs/HOSTING.md"
INDEX_REL = "docs/DEPLOYMENT.md"
SERVER, ADMIN = "server", "admin"
ENV_BLOCK = re.compile(r"^[^\S\n]*__EACH_ENV(_JOINED)?__[^\n]*\n(.*?)^[^\S\n]*__END_EACH__[^\n]*\n?", re.M | re.S)
KEY_LINE = re.compile(r"^\s*([A-Z][A-Z0-9_]*)\s*=")
Row = Tuple[str, str, str, str]


class DeployError(EngineError):
    pass


@dataclass
class PartDeploy:
    id: str
    kind: str
    name: str
    directory: str            # the part's folder in the new system ("" = the engine does not generate this part yet)
    host: str                 # as written in the plan
    host_title: str
    overlay: str              # the overlay folder under templates/deploy/
    known: bool
    database: str = "none"
    cache: str = "none"
    rows: List[Row] = field(default_factory=list)   # backlog rows (title, key, status, note)
    files: List[str] = field(default_factory=list)  # written, relative to the system root


@dataclass
class DeploymentPlan:
    parts: List[PartDeploy] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    deferred: List[str] = field(default_factory=list)
    part_info: Dict[str, Dict[str, Any]] = field(default_factory=dict)   # catalog/deploy.json `parts`, kept so writing needs no catalog


@dataclass
class Written:
    files: List[str] = field(default_factory=list)
    rows: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "x"


def part_directory(spec: Any, plan: Plan, module: Any) -> str:
    """The folder the engine generates for a module, or "" when it does not (yet)."""
    first = next((m for m in plan.modules if m.kind == module.kind), None)
    if module.kind == SERVER:
        return spec.server_dir if spec.with_server and first is module else ""
    if module.kind == ADMIN:
        return spec.admin_dir if spec.with_admin and first is module else ""
    maker = getattr(spec, f"{module.kind}_dir", None)   # a web module: set by the web template's wiring, when it exists
    return maker(module.id) if callable(maker) else ""


def plan_deployment(plan: Plan, catalog: Catalog, spec: Any) -> DeploymentPlan:
    """What to write per part, the warnings to print and the PENDING rows to add. Pure: no file is touched."""
    result = DeploymentPlan(part_info=dict(catalog.deploy_parts))
    for item in plan.deployment:
        module = plan.module(item.part)
        if module is None or module.kind not in catalog.deploy_parts:
            result.deferred.append(f"deployment of '{item.part}': host {item.host}; this kind of part has no deployment files")
            continue
        host = catalog.find_host(item.host)
        if host is not None and module.kind not in host.parts:
            raise DeployError(f"'{item.part}' is a {module.kind} part and {host.title} does not host that "
                              f"(it hosts: {', '.join(host.parts)}); choose one of: {', '.join(h.id for h in catalog.hosts_for(module.kind))}")
        overlay = host.deploy if host is not None and host.deploy else CUSTOM
        part = PartDeploy(item.part, module.kind, module.name, part_directory(spec, plan, module), item.host,
                          host.title if host is not None else item.host, overlay, host is not None, item.database, item.cache)
        if host is None:
            result.warnings.append(f"host '{item.host}' of '{item.part}' is not in the catalog: it is deployed as custom (Docker plus a guide); "
                                   "a PENDING task asks for the real host to be set up")
        if overlay == CUSTOM:
            part.rows.append((f"Choose and set up the host for {item.part}", f"host-{slug(item.part)}", "PENDING",
                              one_line(f"The plan names {item.host}, which has no ready configuration. Docker files and a guide ({GUIDE_REL}) were written; "
                                       "write the host's own configuration and prove one real deploy.")))
        if catalog.deploy_parts[module.kind].get("data_layer"):
            for what, chosen, options, uses in (("database", item.database, catalog.databases, "MongoDB with Mongoose"),
                                                ("cache", item.cache, catalog.caches, "Redis (queues, sockets and caching)")):
                choice = next((c for c in options if c.id.lower() == chosen.lower() or c.title.lower() == chosen.lower()), None)
                if choice is not None and choice.supported:
                    continue
                result.warnings.append(f"{what} '{chosen}' of '{item.part}': the generated server template uses {uses}, not {chosen}. "
                                       f"Generation continues with the template as it is; the server's data layer must be changed by hand "
                                       f"(a PENDING task was added). Nothing switches automatically.")
                part.rows.append((f"Server data layer: replace {uses.split(' ')[0]} with {chosen}", f"{what}-{slug(chosen)}", "PENDING",
                                  one_line(f"The plan chose {what} {chosen}; the generated server uses {uses} and does not switch by itself. "
                                           "Change the models, repositories, seeds, health check and environment keys, with tests.")))
        if not part.directory:
            result.deferred.append(f"deployment of '{item.part}': host {item.host}; its files are written when that {module.kind} part is generated")
        result.parts.append(part)
    return result


# ---------- overlays ----------

def read_meta(folder: Path) -> Dict[str, Any]:
    path = folder / OVERLAY_FILE
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DeployError(f"{path}: not valid ({error})")
    if not isinstance(data, dict):
        raise DeployError(f"{path}: must be a JSON object")
    return data


def overlay_files(root: Path, overlay: str, kind: str, trail: Tuple[str, ...] = ()) -> Dict[PurePosixPath, Path]:
    """(relative path -> source) of one overlay for a part kind: the overlays it extends first, then its own folder (which wins)."""
    if overlay in trail:
        raise DeployError(f"deploy overlays extend each other in a circle: {' -> '.join(trail + (overlay,))}")
    folder = root / overlay
    if not folder.is_dir():
        raise DeployError(f"deploy overlay '{overlay}' not found in {root}")
    meta = read_meta(folder)
    files: Dict[PurePosixPath, Path] = {}
    for parent in meta.get("extends") or []:
        files.update(overlay_files(root, str(parent), kind, trail + (overlay,)))
    own = folder / kind
    if not own.is_dir():
        own = folder / str((meta.get("kinds") or {}).get(kind, kind))
    if own.is_dir():
        for path in sorted(own.rglob("*")):
            if path.is_file() and not path.is_symlink() and ".DS_Store" not in path.parts:
                files[PurePosixPath(path.relative_to(own).as_posix())] = path
    return files


def env_keys(dest: Path, info: Dict[str, Any]) -> List[str]:
    if info.get("env"):
        return [str(key) for key in info["env"]]
    path = dest / str(info.get("env_file") or "-")
    if not path.is_file():
        return []
    keys: List[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        found = KEY_LINE.match(line)
        if found and found.group(1) not in keys:
            keys.append(found.group(1))
    return keys


def expand_env(text: str, keys: List[str]) -> str:
    def repeat(match: "re.Match[str]") -> str:
        items = [match.group(2).replace("__ENV_KEY__", key) for key in keys]
        if match.group(1):
            return ",\n".join(item.rstrip("\n") for item in items) + ("\n" if items else "")
        return "".join(items)
    return ENV_BLOCK.sub(repeat, text)


def part_values(spec: Any, part: PartDeploy, info: Dict[str, Any], keys: List[str]) -> Dict[str, str]:
    values = dict(spec.token_values())
    values.update({
        "__PART_ID__": part.id, "__PART_DIR__": part.directory, "__PART_TITLE__": str(info.get("title", part.kind)),
        "__SERVICE_NAME__": f"{spec.slug}-{part.id}", "__HOST_TITLE__": part.host_title,
        "__PART_PORT__": str(info.get("port", "")), "__PART_HEALTH__": str(info.get("health", "")),
        "__PART_BUILD__": str(info.get("build", "")), "__PART_START__": str(info.get("start", "")),
        "__PART_OUTPUT__": str(info.get("output", "")), "__PART_BUILD_DEV__": str(info.get("build_dev", info.get("build", ""))),
        "__PART_OUTPUT_DEV__": str(info.get("output_dev", info.get("output", ""))),
        "__ENV_KEYS__": ", ".join(f"`{key}`" for key in keys) or "none"})
    return values


def write_part(spec: Any, root: Path, info: Dict[str, Any], part: PartDeploy, written: Written) -> None:
    dest = spec.target / part.directory
    overlay = part.overlay
    try:
        files = overlay_files(root, overlay, part.kind)
    except DeployError as error:
        if overlay == CUSTOM:
            raise
        written.warnings.append(f"{error}; '{part.id}' is deployed as custom instead (Docker plus a guide) and a PENDING task was added")
        part.rows.append((f"Choose and set up the host for {part.id}", f"host-{slug(part.id)}", "PENDING",
                          one_line(f"The catalog names the overlay '{overlay}' for {part.host}, but it is missing. Docker files and a guide were written instead.")))
        part.overlay = overlay = CUSTOM
        files = overlay_files(root, overlay, part.kind)
    if not files:
        raise DeployError(f"deploy overlay '{overlay}' has no files for a {part.kind} part")
    keys = env_keys(dest, info)
    values = part_values(spec, part, info, keys)
    for rel, source in sorted(files.items()):
        target = dest / Path(*rel.parts)
        if target.exists():
            raise DeployError(f"deploy overlay '{overlay}' would overwrite {part.directory}/{rel}; rename the overlay file")
        text = substitute_tokens(expand_env(source.read_text(encoding="utf-8"), keys), values)
        left = leftovers(text)
        if left:
            raise DeployError(f"deploy overlay '{overlay}': {part.kind}/{rel} still has {', '.join(left)}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        shown = f"{part.directory}/{rel}"
        part.files.append(shown)
        written.files.append(shown)


def index_text(spec: Any, deployment: DeploymentPlan, warnings: List[str]) -> str:
    lines = [f"# Deployment of {spec.system_name}", "",
             "Where each part runs, as chosen in `system.plan.json` (`deployment`). For every part only the chosen host's configuration and "
             "guide are in the part's folder (the guide is `docs/HOSTING.md` there). Environment key names are listed in the guides; values "
             "never live in the repository.", "",
             "| Part | Folder | Runs on | Database | Cache | Files written |", "|---|---|---|---|---|---|"]
    for part in deployment.parts:
        host = part.host_title + ("" if part.known else " (not in the catalog: custom)")
        files = ", ".join(f"`{f.split('/', 1)[1]}`" for f in part.files) if part.files else "not generated yet"
        database = "-" if part.database == "none" else part.database
        cache = "-" if part.cache == "none" else part.cache
        lines.append(f"| {part.id} | `{part.directory or '-'}` | {host} | {database} | {cache} | {files} |")
    if warnings:
        lines += ["", "## Open points", ""] + [f"- {warning}" for warning in warnings]
    lines += ["", "To change a host, edit `deployment` in `system.plan.json` and generate the system again; nothing here is deployed by the tool, "
              "and a real deploy needs an account with that host.", ""]
    return "\n".join(lines)


def write_deployment(spec: Any, templates: Path, registry: Dict[str, Any]) -> Written:
    """Writes the chosen host's files into each generated part, `docs/DEPLOYMENT.md`, and the PENDING rows. Returns what it did."""
    deployment: Optional[DeploymentPlan] = getattr(spec, "deployment", None)
    written = Written()
    if deployment is None or not deployment.parts:
        return written
    root = templates / OVERLAYS_DIR
    if not root.is_dir():   # a templates folder without overlays (a custom or test one): say so, write nothing
        written.warnings = deployment.warnings + [f"{templates} has no '{OVERLAYS_DIR}' folder, so no deployment files were written for the plan's hosts"]
        return written
    for part in deployment.parts:
        if part.directory and (spec.target / part.directory).is_dir():
            write_part(spec, root, deployment.part_info[part.kind], part, written)
        else:
            part.directory = ""
    warnings = deployment.warnings + written.warnings
    for part in deployment.parts:
        project = registry["projects"].get(part.kind if part.kind in (SERVER, ADMIN) else part.id)
        if project and part.rows:
            written.rows += append_backlog_rows(spec.target / project["backlog"], project["prefix"], part.rows)
        elif part.rows:
            warnings += [f"'{part.id}' has no backlog, so this is not tracked: {row[0]}" for row in part.rows]
    written.warnings = warnings
    index = spec.target / INDEX_REL
    index.parent.mkdir(parents=True, exist_ok=True)
    index.write_text(index_text(spec, deployment, written.warnings), encoding="utf-8")
    written.files.append(INDEX_REL)
    return written
