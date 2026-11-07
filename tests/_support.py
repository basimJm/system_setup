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
FIXTURE_PLANS = TESTS_DIR / "fixtures" / "plans"
SAMPLE_DOCS = TOOL_ROOT / "examples" / "business"
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


def valid_plan_data() -> dict:
    """A small valid plan (the shape `Plan.from_dict` reads); every test that needs a bad plan edits a copy of this."""
    return {
        "schema_version": 1,
        "system": {"name": "Acme Shop", "name_ar": "", "slug": "acme-shop", "prefix": "ACME", "package_root": "com.acme", "npm_scope": "@acme"},
        "languages": {"default": "en", "supported": ["en", "ar"], "direction": "ltr", "documents": "en"},
        "countries": ["IE"],
        "currency": {"code": "EUR", "minor_unit": "cent", "decimals": 2},
        "time_zones": {"stored": "UTC", "business": "Europe/Dublin"},
        "business": {"summary": "Customers order groceries.", "actors": [{"name": "Customer", "does": "orders"}],
                     "rules": ["Minimum basket 20 euro"], "entities": [{"name": "Order", "states": ["PLACED", "DELIVERED"]}],
                     "jobs": ["Daily sales sheet"], "existing": ["A product list"]},
        "modules": [
            {"id": "server", "kind": "server", "name": "Server", "audience": "every other part", "why": "stores and processes orders", "platforms": ["server"]},
            {"id": "admin", "kind": "admin", "name": "Admin panel", "audience": "shop staff", "why": "manage products", "platforms": ["web"]},
            {"id": "customer", "kind": "app", "name": "Customer", "audience": "customers", "why": "order from a phone", "platforms": ["android", "ios"]}],
        "sdks": [
            {"id": "otp", "title": "One-time codes", "why": "log in by phone", "source": "internal", "provider": "twilio"},
            {"id": "payments", "title": "Payments", "why": "card payment", "source": "internal", "provider": "stripe"}],
        "deployment": [{"part": "server", "host": "render", "database": "postgres", "cache": "redis"},
                       {"part": "admin", "host": "vercel", "database": "none", "cache": "none"}],
        "rules": [],
        "open_questions": [{"id": "alcohol", "question": "How is alcohol handled?", "why": "legal", "proposed_default": "ID check at the door"}],
    }
