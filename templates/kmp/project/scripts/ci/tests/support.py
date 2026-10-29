"""Helpers shared by the policy-check tests."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

CI_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CI_DIR))

from policy.files import Config  # noqa: E402

REPO_ROOT = CI_DIR.parents[1]
DEFAULT_POLICY = json.loads((REPO_ROOT / "config/policy.json").read_text(encoding="utf-8"))
KOTLIN = DEFAULT_POLICY["kotlin"]


class TempProject(unittest.TestCase):
    """A throw-away project directory with the real policy.json."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name) / "app"
        self.root.mkdir()
        self.config = Config(json.loads(json.dumps(DEFAULT_POLICY)), self.root)

    def write(self, rel_path: str, text: str) -> Path:
        path = self.root / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def rules(self, violations) -> list[str]:
        return sorted(v.rule for v in violations)
