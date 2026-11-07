"""The lists a plan chooses from, loaded from `catalog/*.json`: module kinds and platforms, SDKs, providers, hosts,
databases and caches, plus the analyzer settings. Data only: adding a choice is a JSON edit, never a code change.
Every list is a proposal; a plan may name something that is not here (it is then marked `known: false`)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from manifest import tool_root

CATALOG_DIR = "catalog"
OTHER = "other"
NONE = "none"
SEPARATOR = re.compile(r"\s*[,+/]\s*")


class CatalogError(ValueError):
    pass


@dataclass(frozen=True)
class ModuleKind:
    id: str
    title: str
    description: str
    allowed_platforms: List[str]
    default_platforms: List[str]
    deployable: bool
    stores_data: bool
    generated: object  # True, False or a short text naming what the engine generates today


@dataclass(frozen=True)
class SdkChoice:
    id: str
    title: str
    description: str
    generated: bool


@dataclass(frozen=True)
class Provider:
    id: str
    title: str
    sdk: str
    channel: str


@dataclass(frozen=True)
class Choice:
    id: str
    title: str
    parts: List[str] = field(default_factory=list)


@dataclass
class Catalog:
    platforms: Dict[str, str]
    kinds: Dict[str, ModuleKind]
    sdks: Dict[str, SdkChoice]
    providers: List[Provider]
    hosts: List[Choice]
    databases: List[Choice]
    caches: List[Choice]

    # ---- lookups (case-insensitive on the id or the title) ----
    def sdk_known(self, sdk_id: str) -> bool:
        return sdk_id in self.sdks

    def provider_ids(self, text: str) -> List[str]:
        """`'fcm, smtp'` -> ['fcm', 'smtp'] (empty for '' or 'none')."""
        return [part for part in SEPARATOR.split(text.strip()) if part and part.lower() != NONE]

    def find_provider(self, name: str) -> Optional[Provider]:
        wanted = name.strip().lower()
        for provider in self.providers:
            if wanted in (provider.id.lower(), provider.title.lower()):
                return provider
        return None

    def provider_known(self, text: str) -> bool:
        ids = self.provider_ids(text)
        return all(self.find_provider(item) for item in ids)

    def providers_for(self, sdk_id: str) -> List[Provider]:
        return [provider for provider in self.providers if provider.sdk == sdk_id]

    def find_host(self, name: str) -> Optional[Choice]:
        return _find(self.hosts, name)

    def hosts_for(self, kind: str) -> List[Choice]:
        return [host for host in self.hosts if kind in host.parts]

    def deployable_kinds(self) -> List[str]:
        return [kind.id for kind in self.kinds.values() if kind.deployable]


def _find(choices: List[Choice], name: str) -> Optional[Choice]:
    wanted = name.strip().lower()
    for choice in choices:
        if wanted in (choice.id.lower(), choice.title.lower()):
            return choice
    return None


def _read(root: Path, name: str) -> Dict[str, Any]:
    path = root / name
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise CatalogError(f"{path}: cannot read ({error})")
    except json.JSONDecodeError as error:
        raise CatalogError(f"{path}: not valid JSON ({error})")
    if not isinstance(data, dict):
        raise CatalogError(f"{path}: must be a JSON object")
    return data


def _items(data: Dict[str, Any], key: str, file: str) -> List[Dict[str, Any]]:
    items = data.get(key)
    if not isinstance(items, list) or not all(isinstance(item, dict) for item in items):
        raise CatalogError(f"{file}: `{key}` must be a list of objects")
    return items


def _text(item: Dict[str, Any], key: str, file: str) -> str:
    value = item.get(key)
    if not isinstance(value, str) or not value.strip():
        raise CatalogError(f"{file}: every entry needs a non-empty `{key}` (got {item!r})")
    return value


def _choices(data: Dict[str, Any], key: str, file: str) -> List[Choice]:
    choices = [Choice(_text(item, "id", file), _text(item, "title", file), list(item.get("parts") or []))
               for item in _items(data, key, file)]
    _unique([choice.id for choice in choices], key, file)
    return choices


def _unique(ids: List[str], what: str, file: str) -> None:
    duplicates = sorted({item for item in ids if ids.count(item) > 1})
    if duplicates:
        raise CatalogError(f"{file}: duplicate id(s) in `{what}`: {', '.join(duplicates)}")


def load_catalog(root: Optional[Path] = None) -> Catalog:
    root = root or tool_root() / CATALOG_DIR
    modules = _read(root, "modules.json")
    platforms = {_text(item, "id", "modules.json"): _text(item, "title", "modules.json")
                 for item in _items(modules, "platforms", "modules.json")}
    kinds: Dict[str, ModuleKind] = {}
    for item in _items(modules, "kinds", "modules.json"):
        kind_id = _text(item, "id", "modules.json")
        spec = item.get("platforms") or {}
        allowed, default = list(spec.get("allowed") or []), list(spec.get("default") or [])
        unknown = [p for p in allowed + default if p not in platforms]
        if not allowed or unknown or not set(default) <= set(allowed):
            raise CatalogError(f"modules.json: kind {kind_id!r}: platforms must be listed in `platforms` and the default "
                               f"must be allowed (unknown: {', '.join(unknown) or 'none'})")
        if kind_id in kinds:
            raise CatalogError(f"modules.json: duplicate kind {kind_id!r}")
        kinds[kind_id] = ModuleKind(kind_id, _text(item, "title", "modules.json"), str(item.get("description", "")), allowed,
                                    default, bool(item.get("deployable")), bool(item.get("stores_data")), item.get("generated", False))
    sdks_data = _read(root, "sdks.json")
    sdks = {}
    for item in _items(sdks_data, "sdks", "sdks.json"):
        sdk_id = _text(item, "id", "sdks.json")
        if sdk_id in sdks:
            raise CatalogError(f"sdks.json: duplicate sdk {sdk_id!r}")
        sdks[sdk_id] = SdkChoice(sdk_id, _text(item, "title", "sdks.json"), str(item.get("description", "")), bool(item.get("generated")))
    providers = [Provider(_text(item, "id", "providers.json"), _text(item, "title", "providers.json"),
                          _text(item, "sdk", "providers.json"), str(item.get("channel", "")))
                 for item in _items(_read(root, "providers.json"), "providers", "providers.json")]
    _unique([provider.id for provider in providers], "providers", "providers.json")
    orphan = sorted({provider.sdk for provider in providers if provider.sdk not in sdks})
    if orphan:
        raise CatalogError(f"providers.json: provider(s) for unknown sdk(s): {', '.join(orphan)}")
    deploy = _read(root, "deploy.json")
    return Catalog(platforms, kinds, sdks, providers, _choices(deploy, "hosts", "deploy.json"),
                   _choices(deploy, "databases", "deploy.json"), _choices(deploy, "caches", "deploy.json"))


@dataclass(frozen=True)
class AnalyzerSettings:
    claude_bin: str
    model: str
    max_budget_usd: float
    timeout_seconds: int


def load_analyzer_settings(root: Optional[Path] = None) -> AnalyzerSettings:
    root = root or tool_root() / CATALOG_DIR
    data = _read(root, "analyzer.json")
    budget, timeout = data.get("max_budget_usd"), data.get("timeout_seconds", 600)
    if isinstance(budget, bool) or not isinstance(budget, (int, float)) or budget <= 0:
        raise CatalogError("analyzer.json: `max_budget_usd` must be a number above 0")
    if isinstance(timeout, bool) or not isinstance(timeout, int) or timeout <= 0:
        raise CatalogError("analyzer.json: `timeout_seconds` must be a whole number above 0")
    return AnalyzerSettings(_text(data, "claude_bin", "analyzer.json"), _text(data, "model", "analyzer.json"), float(budget), timeout)


@dataclass(frozen=True)
class DocumentSettings:
    """The document step (documents.py): the model, the budget of one call, the budget of one run, the smallest budget worth a
    call, the timeout, and how much of the business document one call may read."""
    model: str
    max_budget_per_call_usd: float
    max_budget_total_usd: float
    min_call_budget_usd: float
    timeout_seconds: int
    excerpt_chars: int


def load_document_settings(root: Optional[Path] = None) -> DocumentSettings:
    root = root or tool_root() / CATALOG_DIR
    data = _read(root, "documents.json")

    def number(key: str, low: float = 0.0) -> float:
        value = data.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= low:
            raise CatalogError(f"documents.json: `{key}` must be a number above {low:g}")
        return float(value)

    def whole(key: str) -> int:
        value = data.get(key)
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise CatalogError(f"documents.json: `{key}` must be a whole number above 0")
        return value

    settings = DocumentSettings(_text(data, "model", "documents.json"), number("max_budget_per_call_usd"), number("max_budget_total_usd"),
                                number("min_call_budget_usd"), whole("timeout_seconds"), whole("excerpt_chars"))
    if settings.max_budget_per_call_usd > settings.max_budget_total_usd:
        raise CatalogError("documents.json: `max_budget_per_call_usd` cannot be above `max_budget_total_usd`")
    return settings
