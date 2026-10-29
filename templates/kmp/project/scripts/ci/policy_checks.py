#!/usr/bin/env python3
"""AcmeShop policy checks (CLAUDE.md §1). Usage: policy_checks.py <command> [--root DIR] [--update-baseline]."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from policy import baseline, error_codes, file_length, hardcoded, localization, quality, security, variants  # noqa: E402
from policy.budget import check as check_budget  # noqa: E402
from policy.files import Config  # noqa: E402

RATCHETED = {
    "file-length": (file_length.check, ("L",)),
    "hardcoded": (hardcoded.check, ("H",)),
    "quality": (quality.check, ("Q", "P")),
}
STRICT = {
    "localization": localization.check, "variants": variants.check, "security": security.check, "error-codes": error_codes.check,
}
COMMANDS = [*RATCHETED, *STRICT, "budget", "all"]


def run(command: str, config: Config, update_baseline: bool, flavor: str | None = None) -> list[str]:
    if command == "all":
        return [line for name in (*RATCHETED, *STRICT) for line in run(name, config, update_baseline)]
    if command == "budget":
        return [str(v) for v in check_budget(config.root, config.root / "config/budgets.json", flavor)]
    if command in STRICT:
        return [str(v) for v in STRICT[command](config)]
    check, prefixes = RATCHETED[command]
    violations = check(config)
    baseline_path = config.root / config.data["baseline"]
    if update_baseline:
        baseline.update(baseline_path, violations, prefixes)
        return []
    return baseline.apply(violations, baseline.load(baseline_path), prefixes)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=COMMANDS)
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument("--update-baseline", action="store_true")
    parser.add_argument("--flavor", help="budget only: check a single flavor")
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    config = Config.load(root / "config/policy.json", root)
    failures = run(args.command, config, args.update_baseline, args.flavor)
    for line in failures:
        print(line)
    print(f"{args.command}: {'FAILED, ' + str(len(failures)) + ' problem(s)' if failures else 'ok'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
