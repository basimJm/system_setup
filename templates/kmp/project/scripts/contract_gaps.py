#!/usr/bin/env python3
"""Compare captured API responses with the OpenAPI contract (CUS-060).

Usage: python3 scripts/contract_gaps.py [--spec PATH] [--fixtures DIR]
Prints one line per gap between `<fixtures>/<OperationId>.json` (real responses, scripts/capture_remote_fixtures.py) and
the success schema of that operation: a required field missing, null where the schema does not allow it, a value
outside the enum, a wrong JSON type, or a field the schema does not declare. Exit code 1 when a gap would break the
app's DTOs (missing required / null / type); undeclared fields and enum values are reported only (the app ignores
unknown keys and maps enums tolerantly), so they go to docs/REMOTE_DEV_GAPS.md as contract notes.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_sync import DEFAULT_SPEC, METHODS, SUCCESS_CODES, operation_id  # noqa: E402

DEFAULT_FIXTURES = Path(__file__).resolve().parents[1] / "core/data/fixtures/remote"
BREAKING = ("missing", "null", "type")
JSON_TYPES = {"string": str, "boolean": bool, "object": dict, "array": list}


def success_schemas(spec: dict) -> dict[str, dict]:
    """Operation id → schema of `data` in its success envelope."""
    found = {}
    for path, methods in spec.get("paths", {}).items():
        for method, op in methods.items():
            if method not in METHODS:
                continue
            for code in SUCCESS_CODES:
                schema = op.get("responses", {}).get(code, {}).get("content", {}).get("application/json", {}).get("schema")
                if schema and "data" in schema.get("properties", {}):
                    found[operation_id(method, path)] = schema["properties"]["data"]
                    break
    return found


def _types(schema: dict) -> list[str]:
    kind = schema.get("type")
    return kind if isinstance(kind, list) else [kind] if kind else []


def _matches(value, kind: str) -> bool:
    if kind == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if kind == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    expected = JSON_TYPES.get(kind)
    return expected is None or (isinstance(value, expected) and not (kind != "boolean" and isinstance(value, bool)))


def diff(value, schema: dict | None, components: dict, where: str) -> list[tuple[str, str, str]]:
    """Gaps of [value] against [schema] as (kind, json path, detail)."""
    if not schema:
        return []
    if "$ref" in schema:
        return diff(value, components.get(schema["$ref"].rsplit("/", 1)[-1]), components, where)
    if any(k in schema for k in ("oneOf", "anyOf", "allOf")):
        return []
    kinds = _types(schema)
    if value is None:
        return [] if "null" in kinds or not kinds or schema.get("nullable") else [("null", where, f"null, schema {kinds}")]
    concrete = [k for k in kinds if k != "null"]
    if concrete and not any(_matches(value, k) for k in concrete):
        return [("type", where, f"{type(value).__name__}, schema {concrete}")]
    if "enum" in schema and value not in schema["enum"]:
        return [("enum", where, f"{value!r} not in {schema['enum']}")]
    gaps: list[tuple[str, str, str]] = []
    if isinstance(value, dict) and schema.get("properties"):
        props = schema["properties"]
        for name in schema.get("required", []):
            if name not in value:
                gaps.append(("missing", f"{where}.{name}", "required field absent"))
        for name, sub in value.items():
            if name in props:
                gaps += diff(sub, props[name], components, f"{where}.{name}")
            elif not schema.get("additionalProperties"):
                gaps.append(("undeclared", f"{where}.{name}", "field not in the schema"))
    if isinstance(value, list):
        for index, item in enumerate(value):
            gaps += diff(item, schema.get("items"), components, f"{where}[{index}]")
    return gaps


def collapse(gaps: list[tuple[str, str, str]]) -> list[tuple[str, str, str]]:
    """One line per field: list indexes are folded (`data[0].x`, `data[1].x` → `data[].x`)."""
    seen, out = set(), []
    for kind, where, detail in gaps:
        key = (kind, ".".join(part.split("[")[0] + ("[]" if "[" in part else "") for part in where.split(".")))
        if key not in seen:
            seen.add(key)
            out.append((kind, key[1], detail))
    return out


def report(spec: dict, fixtures: Path) -> list[tuple[str, str, str, str]]:
    schemas = success_schemas(spec)
    components = spec.get("components", {}).get("schemas", {})
    rows = []
    for file in sorted(fixtures.glob("*.json")):
        op = file.stem
        if op not in schemas:
            continue
        envelope = json.loads(file.read_text(encoding="utf-8"))
        for kind, where, detail in collapse(diff(envelope.get("data"), schemas[op], components, "data")):
            rows.append((op, kind, where, detail))
    return rows


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", default=str(DEFAULT_SPEC))
    parser.add_argument("--fixtures", default=str(DEFAULT_FIXTURES))
    args = parser.parse_args(argv)
    rows = report(json.loads(Path(args.spec).read_text(encoding="utf-8")), Path(args.fixtures))
    for op, kind, where, detail in rows:
        print(f"{op}\t{kind}\t{where}\t{detail}")
    breaking = [r for r in rows if r[1] in BREAKING]
    print(f"contract_gaps: {len(rows)} gap(s), {len(breaking)} breaking")
    return 1 if breaking else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
