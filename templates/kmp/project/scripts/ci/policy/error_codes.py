"""Error-code contract (CUS-059): every code of BUSINESS_DOMAIN §11 and of the OpenAPI snapshot exists in `ErrorCode`,
has an AR + EN `error_code_<code>` string and a handling path in `ErrorHandling`."""
from __future__ import annotations
import json
import re
from pathlib import Path
from .files import Config
from .model import Violation

CODE = "E001"
_ENUM_FILE = "core/domain/src/commonMain/kotlin/com/acme/shop/core/domain/ErrorCode.kt"
_SNAPSHOT = "core/data/src/commonMain/kotlin/com/acme/shop/core/data/contract/generated/openapi.snapshot.json"
_HANDLING = "core/design-system/src/commonMain/kotlin/com/acme/shop/designsystem/components/feedback/ErrorHandling.kt"
_STRINGS = ("core/design-system/src/commonMain/composeResources/values/strings.xml",
            "core/design-system/src/commonMain/composeResources/values-ar/strings.xml")
_DOMAIN_DOC = "BUSINESS_DOMAIN.md"
_UPPER = re.compile(r"\b[A-Z][A-Z_]{2,}\b")
_LOCAL_ONLY = {"UNKNOWN"}


def domain_codes(text: str) -> set[str]:
    """Codes inside the fenced block of the '## 11. Error Codes' section."""
    section = text.split("## 11. Error Codes", 1)[-1]
    block = re.search(r"```(.*?)```", section, re.S)
    return set(_UPPER.findall(block.group(1))) if block else set()


def snapshot_codes(text: str) -> set[str]:
    found: set[str] = set()
    for match in re.finditer(r'"code":\s*\{[^{}]*"enum":\s*\[([^\]]*)\]', text):
        found.update(re.findall(r'"([A-Z_]+)"', match.group(1)))
    return found


def enum_codes(text: str) -> set[str]:
    body = text.split("enum class ErrorCode", 1)[-1].split(";", 1)[0]
    return set(re.findall(r"^\s*([A-Z_]+),", body, re.M))


def handled_codes(text: str) -> set[str]:
    return set(re.findall(r"ErrorCode\.([A-Z_]+)", text))


def string_keys(text: str) -> set[str]:
    return set(re.findall(r'name="error_code_([a-z_]+)"', text))


def check(config: Config) -> list[Violation]:
    root: Path = config.root
    read = lambda rel: (root / rel).read_text(encoding="utf-8") if (root / rel).exists() else ""
    doc = read(_DOMAIN_DOC) or read(f"../{_DOMAIN_DOC}")
    expected = domain_codes(doc) | snapshot_codes(read(_SNAPSHOT))
    declared = enum_codes(read(_ENUM_FILE))
    handled = handled_codes(read(_HANDLING))
    found: list[Violation] = []
    if not expected:
        return [Violation(_SNAPSHOT, 1, CODE, "no error codes found in BUSINESS_DOMAIN §11 or the OpenAPI snapshot")]
    for code in sorted(expected - declared):
        found.append(Violation(_ENUM_FILE, 1, CODE, f"{code} is in the contract but not in ErrorCode"))
    for code in sorted(declared - expected - _LOCAL_ONLY):
        found.append(Violation(_ENUM_FILE, 1, CODE, f"{code} is in ErrorCode but not in the contract (BUSINESS_DOMAIN §11 / openapi)"))
    for code in sorted(declared - handled):
        found.append(Violation(_HANDLING, 1, CODE, f"{code} has no handling path in ErrorHandling"))
    for path in _STRINGS:
        keys = string_keys(read(path))
        for code in sorted(declared):
            if code.lower() not in keys:
                found.append(Violation(path, 1, CODE, f"missing error_code_{code.lower()}"))
    return found
