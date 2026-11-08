"""TEMPLATE.json: the contract between the engine and every template kind (workspace, server, admin, web, sdk, kmp)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, Dict, List, Optional

MANIFEST_NAME = "TEMPLATE.json"
# `__APP_DIR_<n>__` / `__SDK_DIR_<name>__` are the documented families; concrete tokens start upper-case and a later
# segment may be a lower-case name (`__SDK_DIR_storage__`).
TOKEN_RE = re.compile(r"__[A-Z][A-Z0-9]*(?:_(?:[A-Za-z0-9]+|<[a-z]+>))*__")
KINDS = ("workspace", "server", "admin", "web", "sdk", "kmp")
# Where each kind lands inside the generated repo (relative to its root). A template may override this with "dest".
DEFAULT_DEST = {
    "workspace": ".",
    "server": "__SERVER_DIR__",
    "admin": "__ADMIN_DIR__",
    "web": "__WEB_DIR__",
    "sdk": "__SDK_DIR__",
    "kmp": "__APP_DIR__",
}
REQUIRED_KEYS = ("kind", "placeholders")  # description is recommended, not required
LIST_KEYS = ("placeholders", "skip", "post_generate", "binary_globs", "layers")
DICT_KEYS = ("sentinels", "rename_paths")
# Where a template keeps its files when not at its root: sdk = common/ + kinds/<name>/ overlay, kmp = project/.
DEFAULT_LAYERS = {"sdk": ["common", "kinds/__SDK_NAME__"], "kmp": ["project"]}
SDK_KIND_KEYS = ("prefix", "title")   # optional: "dir" = overlay folder inside the template, "description"
# Copied byte for byte and never substituted, per kind (on top of binary_globs): vendored skills keep their files intact.
DEFAULT_VERBATIM = {"workspace": [".claude/skills/**"]}
TARGETED_KEYS = ("file", "placeholder", "find", "replace_with")
PRUNE_KEYS = ("skip", "edits", "post_generate", "drop_lines", "drop_blocks")
AUDIENCE_KEYS = ("word", "plural")   # the template's own words for one audience role (server): `customer` / `customers`
PRUNE_EDIT_KEYS = ("file", "find")   # plus "replace_with": a string, empty to delete the text


class ManifestError(ValueError):
    """The TEMPLATE.json is missing, unreadable or breaks the contract."""


@dataclass
class Manifest:
    kind: str
    description: str
    root: Path
    placeholders: List[str] = field(default_factory=list)
    sentinels: Dict[str, str] = field(default_factory=dict)
    rename_paths: Dict[str, str] = field(default_factory=dict)
    skip: List[str] = field(default_factory=list)
    post_generate: List[str] = field(default_factory=list)
    binary_globs: List[str] = field(default_factory=list)
    dest: str = "."
    verbatim_globs: List[str] = field(default_factory=list)  # copied as-is, no substitution (kind default)
    layers: List[str] = field(default_factory=list)          # sub-folders copied in order (later ones overlay)
    kinds: Dict[str, Dict[str, str]] = field(default_factory=dict)  # sdk only: name -> {dir, prefix, title}
    targeted: List[Dict[str, str]] = field(default_factory=list)   # {file, placeholder, find, replace_with}
    # Optional parts of the template, e.g. a platform: group -> {skip: [globs], edits: [{file, find, replace_with}],
    # post_generate: [commands]}. A group the caller drops removes those files, edits and commands (see `instantiate`).
    prune: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    # Server audiences: role (end_user, staff) -> {word, plural}. The words are renamed to the plan's audience of that role and
    # `prune[<role>]` removes the role when the plan has none (see audiences.py).
    audiences: Dict[str, Dict[str, str]] = field(default_factory=dict)
    base: Optional["Manifest"] = None   # `"base": "<template>"`: that template's files, rules and tokens come first

    @property
    def tokens(self) -> List[str]:
        """Every token the template may use: declared placeholders plus the targets of sentinels and renames."""
        seen: List[str] = []
        for token in [*self.placeholders, *self.sentinels.values(), *self.rename_paths.values()]:
            if token not in seen:
                seen.append(token)
        return seen


def _expect(condition: bool, message: str) -> None:
    if not condition:
        raise ManifestError(message)


def parse_manifest(data: object, root: Path) -> Manifest:
    where = root / MANIFEST_NAME
    _expect(isinstance(data, dict), f"{where}: top level must be an object")
    assert isinstance(data, dict)
    for key in REQUIRED_KEYS:
        _expect(key in data, f"{where}: missing key {key!r}")
    kind = data["kind"]
    _expect(kind in KINDS, f"{where}: kind {kind!r} not one of {', '.join(KINDS)}")
    for key in LIST_KEYS:
        value = data.get(key, [])
        _expect(isinstance(value, list) and all(isinstance(v, str) for v in value),
                f"{where}: {key!r} must be a list of strings")
    for key in DICT_KEYS:
        value = data.get(key, {})
        _expect(isinstance(value, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in value.items()),
                f"{where}: {key!r} must map literal strings to tokens")
        for literal, token in value.items():
            _expect(bool(literal), f"{where}: {key!r} has an empty literal")
            _expect(TOKEN_RE.fullmatch(token) is not None,
                    f"{where}: {key!r} maps {literal!r} to {token!r}, which is not a __TOKEN__")
    for token in data["placeholders"]:
        _expect(TOKEN_RE.fullmatch(token) is not None, f"{where}: placeholder {token!r} is not a __TOKEN__")
    dest = data.get("dest", DEFAULT_DEST[kind])
    _expect(isinstance(dest, str) and bool(dest) and not dest.startswith("/") and ".." not in Path(dest).parts,
            f"{where}: 'dest' must be a relative path inside the generated repo")
    layers = _layers(data, kind, root, where)
    kinds = data.get("kinds", {})
    _expect(isinstance(kinds, dict), f"{where}: 'kinds' must map SDK names to objects")
    for name, meta in kinds.items():
        _expect(kind == "sdk", f"{where}: 'kinds' is only valid for the sdk template")
        _expect(isinstance(meta, dict) and all(isinstance(meta.get(k), str) and meta[k] for k in SDK_KIND_KEYS),
                f"{where}: kinds[{name!r}] needs the string keys {', '.join(SDK_KIND_KEYS)}")
    targeted = data.get("targeted", [])
    _expect(isinstance(targeted, list), f"{where}: 'targeted' must be a list")
    for edit in targeted:
        _expect(isinstance(edit, dict) and all(isinstance(edit.get(k), str) and edit[k] for k in TARGETED_KEYS),
                f"{where}: every 'targeted' edit needs the string keys {', '.join(TARGETED_KEYS)}")
        _expect(TOKEN_RE.fullmatch(edit["placeholder"]) is not None,
                f"{where}: targeted placeholder {edit['placeholder']!r} is not a __TOKEN__")
    prune = _prune(data.get("prune", {}), where)
    audiences = data.get("audiences", {})
    _expect(isinstance(audiences, dict), f"{where}: 'audiences' must map a role to its words")
    for role, words in audiences.items():
        _expect(isinstance(words, dict) and all(isinstance(words.get(k), str) and words[k] for k in AUDIENCE_KEYS) and set(words) <= set(AUDIENCE_KEYS),
                f"{where}: audiences[{role!r}] needs the string keys {', '.join(AUDIENCE_KEYS)}")
    base = data.get("base", "")
    _expect(isinstance(base, str) and (not base or re.fullmatch(r"[a-z][a-z0-9-]*", base) is not None and base != kind),
            f"{where}: 'base' must be the folder name of another template")
    return Manifest(kind=kind, description=str(data.get("description", "")), root=root, placeholders=list(data["placeholders"]),
                    sentinels=dict(data.get("sentinels", {})), rename_paths=dict(data.get("rename_paths", {})),
                    skip=list(data.get("skip", [])), post_generate=list(data.get("post_generate", [])),
                    binary_globs=list(data.get("binary_globs", [])), dest=dest, layers=layers,
                    verbatim_globs=list(DEFAULT_VERBATIM.get(kind, [])),
                    kinds={k: dict(v) for k, v in kinds.items()}, targeted=[dict(e) for e in targeted], prune=prune,
                    audiences={r: dict(w) for r, w in audiences.items()})


def _prune(raw: object, where: Path) -> Dict[str, Dict[str, Any]]:
    _expect(isinstance(raw, dict), f"{where}: 'prune' must map a group name (e.g. ios) to its removals")
    assert isinstance(raw, dict)
    groups: Dict[str, Dict[str, Any]] = {}
    for name, group in raw.items():
        _expect(isinstance(group, dict) and set(group) <= set(PRUNE_KEYS), f"{where}: prune[{name!r}] may only have {', '.join(PRUNE_KEYS)}")
        for key in ("skip", "post_generate"):
            value = group.get(key, [])
            _expect(isinstance(value, list) and all(isinstance(v, str) and v for v in value),
                    f"{where}: prune[{name!r}].{key} must be a list of non-empty strings")
        edits = group.get("edits", [])
        _expect(isinstance(edits, list), f"{where}: prune[{name!r}].edits must be a list")
        for edit in edits:
            _expect(isinstance(edit, dict) and all(isinstance(edit.get(k), str) and edit[k] for k in PRUNE_EDIT_KEYS)
                    and isinstance(edit.get("replace_with"), str),
                    f"{where}: every prune[{name!r}] edit needs the string keys file and find, and a string replace_with (may be empty)")
        lines = group.get("drop_lines", [])
        _expect(isinstance(lines, list) and all(isinstance(e, dict) and isinstance(e.get("file"), str) and isinstance(e.get("contains"), list)
                                                 and e["contains"] and all(isinstance(c, str) and c for c in e["contains"]) for e in lines),
                f"{where}: prune[{name!r}].drop_lines must be a list of {{file, contains: [text, ...]}}")
        blocks = group.get("drop_blocks", [])
        _expect(isinstance(blocks, list) and all(isinstance(e, dict) and all(isinstance(e.get(k), str) and e[k] for k in ("file", "start", "end")) for e in blocks),
                f"{where}: prune[{name!r}].drop_blocks must be a list of {{file, start, end}}")
        groups[name] = {"skip": list(group.get("skip", [])), "edits": [dict(e) for e in edits], "post_generate": list(group.get("post_generate", [])),
                        "drop_lines": [dict(e) for e in lines], "drop_blocks": [dict(e) for e in blocks]}
    return groups


def inherit(own: Manifest, base: Manifest, declared: Dict[str, Any]) -> Manifest:
    """A template with `"base"` is the base template plus its own overlay: lists add up, maps are overridden key by key,
    `post_generate` is the base's unless the template declares its own."""
    own.base = base
    own.placeholders = [*base.placeholders, *[t for t in own.placeholders if t not in base.placeholders]]
    own.sentinels = {**base.sentinels, **own.sentinels}
    own.rename_paths = {**base.rename_paths, **own.rename_paths}
    own.skip = [*base.skip, *own.skip]
    own.binary_globs = [*base.binary_globs, *own.binary_globs]
    own.targeted = [*base.targeted, *own.targeted]
    own.prune = {**base.prune, **own.prune}
    if "post_generate" not in declared:
        own.post_generate = list(base.post_generate)
    return own


def _layers(data: dict, kind: str, root: Path, where: Path) -> List[str]:
    """Declared `layers`, else the kind's default when that folder exists in the template, else the template root.
    For the sdk kind the second layer is `kinds.<name>.dir` when declared (`__SDK_LAYER__`), else `kinds/<name>`."""
    if "layers" in data:
        layers = list(data["layers"])
        for layer in layers:
            _expect(bool(layer) and not layer.startswith("/") and ".." not in PurePosixPath(layer).parts,
                    f"{where}: layer {layer!r} must be a relative folder inside the template")
        return layers
    default = DEFAULT_LAYERS.get(kind, [])
    if default and (root / default[0]).is_dir():
        if kind == "sdk" and any(isinstance(m, dict) and m.get("dir") for m in data.get("kinds", {}).values()):
            return [default[0], "__SDK_LAYER__"]
        return default
    return ["."]


def load_manifest(template_dir: Path) -> Manifest:
    path = template_dir / MANIFEST_NAME
    _expect(path.is_file(), f"template {template_dir.name}: {MANIFEST_NAME} not found in {template_dir}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ManifestError(f"{path}: invalid JSON ({error})") from error
    manifest = parse_manifest(data, template_dir)
    _expect(manifest.kind == template_dir.name,
            f"{path}: kind {manifest.kind!r} does not match the folder name {template_dir.name!r}")
    base_name = data.get("base", "")
    if base_name:
        base_dir = template_dir.parent / base_name
        _expect((base_dir / MANIFEST_NAME).is_file(), f"{path}: base template {base_name!r} not found in {template_dir.parent}")
        base = load_manifest(base_dir)
        _expect(base.base is None, f"{path}: the base template {base_name!r} has a base of its own; only one level is supported")
        inherit(manifest, base, data)
    return manifest


def tool_root() -> Path:
    """The tool folder (this file is src/system_setup/manifest.py)."""
    return Path(__file__).resolve().parents[2]


def templates_root() -> Path:
    return tool_root() / "templates"


def available_kinds(root: Optional[Path] = None) -> List[str]:
    root = root or templates_root()
    if not root.is_dir():
        return []
    return sorted(p.name for p in root.iterdir() if p.is_dir() and (p / MANIFEST_NAME).is_file())
