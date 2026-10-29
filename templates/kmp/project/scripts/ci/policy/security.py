"""Configuration security checks: manifest and Info.plist flags, repositories, versions and files that must never be tracked."""
import fnmatch
import plistlib
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from .files import Config, iter_files, rel
from .model import Violation

MANIFEST, PLIST, GRADLE, SECRET_FILE = "S001", "S002", "S003", "S004"
_ANDROID = "{http://schemas.android.com/apk/res/android}"
_COMPONENTS = ("activity", "activity-alias", "service", "receiver", "provider")
_INSECURE_REPO = re.compile(r"allowInsecureProtocol\s*=\s*true|url\s*=?\s*\(?\s*uri\(\s*\"http://|url\s*=\s*\"http://")
_SIGNING_SECRET = re.compile(r"(?:storePassword|keyPassword)\s*=\s*\"[^\"$]+\"")
_DYNAMIC_VERSION = re.compile(r'=\s*"[^"]*(?:\+|latest|SNAPSHOT|\[|\()[^"]*"|version\s*=\s*"[^"]*(?:\+|latest|SNAPSHOT)')
_SECRET_FILES = ("*.jks", "*.keystore", "*.p12", "*.pem", "*.pfx", ".env", ".env.*", "local.properties", "service-account*.json", "*.mobileprovision")


def _is_launcher(node: ET.Element) -> bool:
    return any(c.get(f"{_ANDROID}name") == "android.intent.category.LAUNCHER" for c in node.iter("category"))


def check_manifest(path: str, text: str) -> list[Violation]:
    found: list[Violation] = []
    app = ET.fromstring(text).find("application")
    if app is None:
        return found
    flags = {"debuggable": "true", "usesCleartextTraffic": "true", "allowBackup": "true"}
    for flag, bad in flags.items():
        if app.get(f"{_ANDROID}{flag}") == bad:
            found.append(Violation(path, 1, MANIFEST, f"android:{flag}=\"{bad}\" is not allowed in the main manifest"))
    for node in app.iter():
        if node.tag in _COMPONENTS and node.get(f"{_ANDROID}exported") == "true" and not _is_launcher(node) and not node.get(f"{_ANDROID}permission"):
            found.append(Violation(path, 1, MANIFEST, f"exported {node.tag} {node.get(f'{_ANDROID}name')} needs android:permission"))
    return found


def check_plist(path: str, data: bytes) -> list[Violation]:
    transport = plistlib.loads(data).get("NSAppTransportSecurity", {})
    return [Violation(path, 1, PLIST, f"App Transport Security flag {key} must not be enabled")
            for key in ("NSAllowsArbitraryLoads", "NSAllowsArbitraryLoadsInWebContent") if transport.get(key) is True]


def check_gradle(path: str, text: str) -> list[Violation]:
    found = [Violation(path, 1, GRADLE, "repository over plain http or allowInsecureProtocol") for _ in _INSECURE_REPO.finditer(text)]
    found += [Violation(path, 1, SECRET_FILE, "signing password written in the build script") for _ in _SIGNING_SECRET.finditer(text)]
    if path.endswith("libs.versions.toml"):
        found += [Violation(path, 1, GRADLE, "dynamic or snapshot dependency version; pin it") for _ in _DYNAMIC_VERSION.finditer(text)]
    return found


def _tracked_files(config: Config) -> list[Path]:
    """Files git tracks under the project root; falls back to a directory walk outside a git checkout."""
    try:
        out = subprocess.run(["git", "ls-files", "-z"], cwd=config.root, capture_output=True, check=True, timeout=30).stdout
        return [config.root / name for name in out.decode("utf-8").split("\0") if name]
    except (OSError, subprocess.SubprocessError):
        return list(iter_files(config, None))


def check(config: Config) -> list[Violation]:
    found: list[Violation] = []
    for path in iter_files(config, {".xml", ".plist", ".kts"}):
        rel_path = rel(config, path)
        if path.name == "AndroidManifest.xml" and "/src/main/" in rel_path:
            found += check_manifest(rel_path, path.read_text(encoding="utf-8"))
        elif path.name == "Info.plist":
            found += check_plist(rel_path, path.read_bytes())
        elif path.suffix == ".kts":
            found += check_gradle(rel_path, path.read_text(encoding="utf-8"))
    for extra in ("gradle/libs.versions.toml", "settings.gradle.kts", "build.gradle.kts"):
        if (config.root / extra).exists():
            found += check_gradle(extra, (config.root / extra).read_text(encoding="utf-8"))
    for path in _tracked_files(config):
        if path.is_file() and any(fnmatch.fnmatch(path.name, pattern) for pattern in _SECRET_FILES):
            found.append(Violation(rel(config, path), 1, SECRET_FILE, "secret/credential file must not be committed"))
    return found
