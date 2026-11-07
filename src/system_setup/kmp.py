"""The kmp template is a snapshot with a sentinel identity; this module knows that identity,
checks the kmp TEMPLATE.json declares it, and instantiates the snapshot once per requested app."""
from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from engine import EngineError, Result, instantiate, verification_errors
from manifest import Manifest
from prompts import AppSpec, Spec

# Identity of the snapshot in templates/kmp (app name / package / project name).
SENTINEL_APP_NAME = "Acme Shop"
SENTINEL_PACKAGE = "com.acme.shop"
SENTINEL_PROJECT = "AcmeShop"
# Which contextual token each sentinel must map to in templates/kmp/TEMPLATE.json.
EXPECTED_SENTINELS = {
    SENTINEL_APP_NAME: "__APP_NAME__",
    SENTINEL_PACKAGE: "__APP_PACKAGE__",
    SENTINEL_PROJECT: "__APP_PROJECT__",
}
EXPECTED_RENAMES = {
    SENTINEL_PACKAGE.replace(".", "/"): "__APP_PACKAGE_PATH__",
    SENTINEL_PROJECT: "__APP_PROJECT__",
}
IDENTITY_MARKERS = (SENTINEL_PACKAGE, SENTINEL_PROJECT, SENTINEL_APP_NAME, SENTINEL_PACKAGE.replace(".", "/"))


def check_kmp_manifest(manifest: Manifest) -> List[str]:
    """Returns the contract problems of a kmp TEMPLATE.json (empty = fine)."""
    problems = []
    for literal, token in EXPECTED_SENTINELS.items():
        got = manifest.sentinels.get(literal)
        if got != token:
            problems.append(f"sentinels[{literal!r}] should be {token!r} (got {got!r})")
    for literal, token in EXPECTED_RENAMES.items():
        got = manifest.rename_paths.get(literal)
        if got is None:
            problems.append(f"rename_paths[{literal!r}] missing (should be {token!r})")
    return problems


def app_token_values(spec: Spec, app: AppSpec) -> Dict[str, str]:
    values = spec.token_values()
    values.update(spec.app_values(app))
    return values


def dropped_platforms(manifest: Manifest, app: AppSpec) -> List[str]:
    """The prune groups (platforms) of the kmp template this app did not choose: an Android-only app drops `ios`."""
    return [group for group in manifest.prune if group not in app.platforms]


def instantiate_apps(manifest: Manifest, repo_root: Path, spec: Spec) -> List[Result]:
    """One app per AppSpec; a sentinel left in any path or text file of the app is an error (as in the snapshot's
    instantiate.py `verify`), never a warning."""
    results = []
    for app in spec.apps:
        result = instantiate(manifest, repo_root, app_token_values(spec, app), spec.part_values(), drop=dropped_platforms(manifest, app))
        errors = verification_errors(result)
        if errors:
            raise EngineError(f"kmp {spec.app_dir(app)}: sentinels left after instantiation:\n  " + "\n  ".join(errors))
        results.append(result)
    return results


def identity_leftovers(app_root: Path) -> List[str]:
    """Generated app files that still carry the sentinel identity (should be empty)."""
    found = []
    for path in sorted(app_root.rglob("*")):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = path.relative_to(app_root).as_posix()
        if any(marker in rel for marker in IDENTITY_MARKERS):
            found.append(rel)
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if any(marker in text for marker in IDENTITY_MARKERS):
            found.append(rel)
    return found
