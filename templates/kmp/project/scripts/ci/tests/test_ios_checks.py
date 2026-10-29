"""The local iOS gate must build exactly the scheme/configuration matrix CI builds."""
from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = PROJECT_ROOT.parent
SCRIPT = PROJECT_ROOT / "scripts" / "ci" / "run_ios_checks.sh"
WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "ci.yml"
MATRIX_ROW = re.compile(r"\{\s*scheme:\s*([\w-]+),\s*configuration:\s*([\w-]+)\s*\}")


class IosChecksMatrixTest(unittest.TestCase):
    def setUp(self) -> None:
        result = subprocess.run(["bash", str(SCRIPT), "--dry-run"], capture_output=True, text=True, check=True, cwd=PROJECT_ROOT)
        self.lines = result.stdout.splitlines()

    def test_dry_run_builds_every_ci_matrix_row_in_order(self) -> None:
        expected = MATRIX_ROW.findall(WORKFLOW.read_text(encoding="utf-8"))
        self.assertEqual(4, len(expected), "CI iOS matrix should have four rows")
        built = [
            (re.search(r"-scheme (\S+)", line).group(1), re.search(r"-configuration (\S+)", line).group(1))
            for line in self.lines
            if line.startswith("xcodebuild ")
        ]
        self.assertEqual(expected, built)

    def test_builds_for_the_simulator_without_signing(self) -> None:
        for line in (line for line in self.lines if line.startswith("xcodebuild ")):
            self.assertIn("-sdk iphonesimulator", line)
            self.assertIn("CODE_SIGNING_ALLOWED=NO", line)
            self.assertIn("iOS\\ Simulator", line)

    def test_runs_native_unit_tests(self) -> None:
        self.assertTrue(any("iosSimulatorArm64Test" in line for line in self.lines))


if __name__ == "__main__":
    unittest.main()
