"""Captured real responses for the generated contract (CUS-060); used by api_sync.py.

* `load_captured(dir)`: `<OperationId>.json` envelopes written by capture_remote_fixtures.py.
* `envelope_json(envelope)`: one-line JSON with `data` last, so `MockTransport`'s Empty scenario (which rewrites the
  trailing `data`) also works for paginated envelopes that carry `meta`.
* `render_decoders(...)`: the commonTest table operation id → `KSerializer` of its `data` type, so a test can decode
  every fixture with the app's own DTOs and a contract drift fails the build.
"""
from __future__ import annotations

import json
from pathlib import Path

ENVELOPE_ORDER = ("success", "message", "meta", "data")
NULL_DATA_TYPE = "JsonElement"


def load_captured(directory: Path | None) -> dict[str, dict]:
    if directory is None or not directory.is_dir():
        return {}
    return {file.stem: json.loads(file.read_text(encoding="utf-8")) for file in sorted(directory.glob("*.json"))}


def envelope_json(envelope: dict) -> str:
    ordered = {key: envelope[key] for key in ENVELOPE_ORDER if key in envelope}
    ordered.update({key: value for key, value in envelope.items() if key not in ordered})
    if "data" in ordered:
        ordered["data"] = ordered.pop("data")
    return json.dumps(ordered, ensure_ascii=False)


def render_captured_ids(captured_ids: list[str]) -> str:
    """Kotlin set of the operation ids whose fixture is a real captured response (not schema-derived)."""
    items = "".join(f'        "{op}",\n' for op in sorted(captured_ids))
    return "    /** Operations whose fixture is a real response captured from the dev API / local stack. */\n" \
        f"    val captured: Set<String> = setOf(\n{items}    )\n"


def render_decoders(head: str, package: str, data_types: dict[str, str | None]) -> str:
    entries = "".join(
        f'        "{op}" to serializer<{kotlin or NULL_DATA_TYPE}>(),\n' for op, kotlin in sorted(data_types.items())
    )
    return (
        f"{head}package {package}\n\n"
        "import kotlinx.serialization.KSerializer\nimport kotlinx.serialization.json.JsonElement\n"
        "import kotlinx.serialization.json.JsonObject\nimport kotlinx.serialization.serializer\n\n"
        "/** Serializer of each operation's `data` (generated DTOs); `ContractFixturesTest` decodes every fixture with it. */\n"
        "object ContractDecoders {\n    val byOperationId: Map<String, KSerializer<*>> = mapOf(\n"
        f"{entries}    )\n}}\n"
    )
