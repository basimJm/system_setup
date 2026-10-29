"""Performance gate: release builds are minified (mapping file exists) and stay under the APK size budget."""
from __future__ import annotations

import json
from pathlib import Path
from .model import Violation

SIZE, MINIFY = "B001", "B002"


def check(root: Path, budget_file: Path, flavor: str | None = None) -> list[Violation]:
    budgets = json.loads(budget_file.read_text(encoding="utf-8"))["apkMaxBytes"]
    if flavor is not None:
        budgets = {flavor: budgets[flavor]}
    found: list[Violation] = []
    for flavor, limit in budgets.items():
        apk_dir = root / "androidApp/build/outputs/apk" / flavor / "release"
        apks = sorted(apk_dir.glob("*.apk"))
        if not apks:
            found.append(Violation(str(apk_dir.relative_to(root)), 1, SIZE, f"no release APK found for flavor {flavor}"))
        for apk in apks:
            size = apk.stat().st_size
            print(f"{apk.relative_to(root)}: {size} bytes (budget {limit})")
            if size > limit:
                found.append(Violation(str(apk.relative_to(root)), 1, SIZE, f"{size} bytes exceeds the {limit} byte budget"))
        mapping = root / "androidApp/build/outputs/mapping" / f"{flavor}Release" / "mapping.txt"
        if not mapping.exists():
            found.append(Violation(str(mapping.relative_to(root)), 1, MINIFY, "no R8 mapping file; release must be minified"))
    return found
