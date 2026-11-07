"""R5: every build variant (Android flavors x build types, iOS configurations and schemes) stays declared and wired into CI."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path
from .files import Config
from .model import Violation

RULE = "V001"
_ANDROID_PLUGIN = "build-logic/convention/src/main/kotlin/com/acme/shop/buildlogic/AndroidAppPlugin.kt"
_XCODE_PROJECT = "iosApp/iosApp.xcodeproj/project.pbxproj"
_SCHEMES_DIR = "iosApp/iosApp.xcodeproj/xcshareddata/xcschemes"
_BUILD_ACTIONS = {"TestAction": "Debug", "LaunchAction": "Debug", "AnalyzeAction": "Debug", "ProfileAction": "Release", "ArchiveAction": "Release"}


def _read(config: Config, rel_path: str) -> str | None:
    path = config.root / rel_path
    return path.read_text(encoding="utf-8") if path.exists() else None


def _properties(text: str) -> dict[str, str]:
    pairs = (line.split("=", 1) for line in text.splitlines() if "=" in line and not line.lstrip().startswith("#"))
    return {key.strip(): value.strip() for key, value in pairs}


def _check_android(config: Config, section: dict) -> list[Violation]:
    found: list[Violation] = []
    plugin = _read(config, _ANDROID_PLUGIN)
    if plugin is None:
        return [Violation(_ANDROID_PLUGIN, 1, RULE, "Android app convention plugin not found")]
    for flavor in section["flavors"]:
        if not re.search(rf'create\("{flavor}"\)', plugin):
            found.append(Violation(_ANDROID_PLUGIN, 1, RULE, f"product flavor '{flavor}' is not declared"))
    for build_type in section["buildTypes"]:
        if not re.search(rf'getByName\("{build_type}"\)', plugin):
            found.append(Violation(_ANDROID_PLUGIN, 1, RULE, f"build type '{build_type}' is not configured"))
    props = _properties(_read(config, "gradle.properties") or "")
    for key in section["gradlePropertyKeys"]:
        if not props.get(key):
            found.append(Violation("gradle.properties", 1, RULE, f"missing or empty property {key}"))
    return found


def _check_ios(config: Config, section: dict) -> list[Violation]:
    found: list[Violation] = []
    project = _read(config, _XCODE_PROJECT)
    if project is None:
        return [Violation(_XCODE_PROJECT, 1, RULE, "Xcode project not found")]
    names = set(re.findall(r"^\s*name = ([\w-]+);$", project, re.MULTILINE))
    for configuration in section["iosConfigurations"]:
        if configuration not in names:
            found.append(Violation(_XCODE_PROJECT, 1, RULE, f"build configuration '{configuration}' is missing"))
    for stray in ("Debug", "Release"):
        if stray in names:
            found.append(Violation(_XCODE_PROJECT, 1, RULE, f"unscoped configuration '{stray}' still exists; use the -Dev/-Prod ones"))
    for scheme, (debug, release) in section["iosSchemes"].items():
        scheme_path = f"{_SCHEMES_DIR}/{scheme}.xcscheme"
        text = _read(config, scheme_path)
        if text is None:
            found.append(Violation(scheme_path, 1, RULE, f"shared scheme '{scheme}' is missing"))
            continue
        for node in ET.fromstring(text):
            expected = debug if _BUILD_ACTIONS.get(node.tag) == "Debug" else release
            if node.tag in _BUILD_ACTIONS and node.get("buildConfiguration") != expected:
                found.append(Violation(scheme_path, 1, RULE, f"{node.tag} must use '{expected}', found '{node.get('buildConfiguration')}'"))
    for environment in ("Dev", "Prod"):
        xcconfig = f"iosApp/Configuration/{environment}.xcconfig"
        values = _properties(_read(config, xcconfig) or "")
        for key in section["iosXcconfigKeys"]:
            if not values.get(key):
                found.append(Violation(xcconfig, 1, RULE, f"missing or empty key {key}"))
    return found


def _check_workflow(config: Config, section: dict) -> list[Violation]:
    workflow = section["workflow"]
    text = _read(config, workflow) or _read(config, f"../{workflow}")
    if text is None:
        return [Violation(workflow, 1, RULE, "CI workflow is missing")]
    wanted = section["flavors"] + section["buildTypes"] + list(section["iosSchemes"]) + section["iosConfigurations"]
    return [Violation(workflow, 1, RULE, f"workflow does not build '{item}'") for item in wanted if item not in text]


def check(config: Config) -> list[Violation]:
    """An app generated for one platform declares no variants of the other (empty lists in policy.json): those checks are skipped."""
    section = config.section("variants")
    found: list[Violation] = []
    if section["flavors"] or section["buildTypes"]:
        found += _check_android(config, section)
    if section["iosConfigurations"] or section["iosSchemes"]:
        found += _check_ios(config, section)
    return found + _check_workflow(config, section)
