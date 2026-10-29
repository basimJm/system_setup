"""Shared test helpers: import path, fixture location, a Spec factory and a temp-dir TestCase."""
from __future__ import annotations

import datetime as _dt
import sys
import tempfile
import unittest
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
TOOL_ROOT = TESTS_DIR.parent
FIXTURE_TEMPLATES = TESTS_DIR / "fixtures" / "templates"
FIXTURE_KNOWLEDGE = TESTS_DIR / "fixtures" / "knowledge"
sys.path.insert(0, str(TOOL_ROOT / "src" / "system_setup"))

from prompts import AppSpec, Spec  # noqa: E402

FIXED_DATE = _dt.date(2026, 10, 28)


def make_spec(target: Path, **overrides) -> Spec:
    values = dict(system_name="Acme Shop", system_name_ar="متجر أكمي", prefix="ACME", package_root="com.acme",
                  npm_scope="@acme", target=target, apps=[AppSpec("Customer", "customer"), AppSpec("Merchant", "merchant", "التاجر")],
                  sdks=["storage", "otp"], owner_github="acme-inc", today=FIXED_DATE)
    values.update(overrides)
    return Spec(**values)


class TempDirTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rel: str, text: str) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path
