"""Data sources: dev uses one configured source (mock or remote) on Android and iOS, with the same API host on both;
prod always talks to the real API (`DATA_SOURCE=remote`)."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
XCCONFIG_SPLIT = "$()"  # `//` starts an xcconfig comment, so URLs are written `https:/$()/host`
DATA_SOURCES = ("mock", "remote")


def properties(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith(("#", "//")) and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def host(url: str) -> str:
    match = re.match(r"^https://([^/]+)/?$", url.replace(XCCONFIG_SPLIT, ""))
    return match.group(1) if match else ""


class DevRemoteConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        self.gradle = properties(PROJECT / "gradle.properties")
        self.ios_dev = properties(PROJECT / "iosApp/Configuration/Dev.xcconfig")

    def test_dev_uses_one_known_data_source_on_both_platforms(self) -> None:
        self.assertIn(self.gradle["DEV_DATA_SOURCE"], DATA_SOURCES)
        self.assertEqual(self.gradle["DEV_DATA_SOURCE"], self.ios_dev["DATA_SOURCE"])

    def test_dev_api_is_an_https_host_shared_by_android_and_ios(self) -> None:
        android = host(self.gradle["DEV_API_BASE_URL"])
        self.assertTrue(android, "DEV_API_BASE_URL must be https://<host>")
        self.assertEqual(android, host(self.ios_dev["API_BASE_URL"]))

    def test_prod_never_uses_the_mock(self) -> None:
        self.assertEqual("remote", self.gradle["PROD_DATA_SOURCE"])
        self.assertEqual("remote", properties(PROJECT / "iosApp/Configuration/Prod.xcconfig")["DATA_SOURCE"])


if __name__ == "__main__":
    unittest.main()
