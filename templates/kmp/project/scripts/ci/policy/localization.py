"""R3: every string resource exists in English and Arabic with identical keys and placeholders."""
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from .files import Config, rel
from .model import Violation

RULE = "I001"
_PLACEHOLDER = re.compile(r"%(?:\d+\$)?[sdfx%]|\{\w+\}")
_ARABIC = re.compile(r"[؀-ۿ]")
_WORD = re.compile(r"[A-Za-z]{4,}")
# Compose resources format only `%N$s`/`%N$d`; an Android-style `%%` escape is printed literally ("30%%", CUS-092).
_COMPOSE_DIR = "composeResources"
_ESCAPED_PERCENT = "%%"


def _escaped_percent(config: Config, path: Path, entries: dict[str, str]) -> list[Violation]:
    if _COMPOSE_DIR not in path.parts:
        return []
    where = rel(config, path)
    return [Violation(where, 1, RULE, f"{key} uses %% (Compose resources print it literally; write a single %)")
            for key, text in sorted(entries.items()) if _ESCAPED_PERCENT in text]


def _entries(path: Path) -> dict[str, str]:
    """Map `kind:name` to text; arrays/plurals are flattened to one joined value."""
    entries: dict[str, str] = {}
    for node in ET.parse(path).getroot():
        name = node.get("name", "")
        if node.get("translatable") == "false":
            continue
        if node.tag == "string":
            entries[f"string:{name}"] = "".join(node.itertext())
        elif node.tag in ("plurals", "string-array"):
            items = [("".join(child.itertext())) for child in node]
            entries[f"{node.tag}:{name}"] = "\n".join(items)
    return entries


def _find_default_files(config: Config) -> list[Path]:
    section = config.section("localization")
    excluded = set(config.data["excludeDirs"])
    found: list[Path] = []
    for root in section["resourceRoots"]:
        base = config.root / root
        if base.is_dir():
            found += [p for p in base.rglob(section["stringFile"])
                      if p.parent.name == section["defaultDir"] and not excluded.intersection(p.relative_to(config.root).parts)]
    return sorted(found)


def check(config: Config) -> list[Violation]:
    section = config.section("localization")
    same_as_default = set(section.get("sameAsDefault", []))   # proper nouns (the brand name) that stay as written when a system has no Arabic name
    found: list[Violation] = []
    for default_file in _find_default_files(config):
        default = _entries(default_file)
        found += _escaped_percent(config, default_file, default)
        for language, folder in section["translations"].items():
            target = default_file.parent.parent / folder / section["stringFile"]
            where = rel(config, default_file)
            if not target.exists():
                found.append(Violation(where, 1, RULE, f"missing {folder}/{section['stringFile']} ({language} translation)"))
                continue
            translated = _entries(target)
            target_rel = rel(config, target)
            found += _escaped_percent(config, target, translated)
            for key in sorted(default.keys() - translated.keys()):
                found.append(Violation(target_rel, 1, RULE, f"missing {language} translation for {key}"))
            for key in sorted(translated.keys() - default.keys()):
                found.append(Violation(target_rel, 1, RULE, f"{key} has no default (English) entry"))
            for key in sorted(default.keys() & translated.keys()):
                if sorted(_PLACEHOLDER.findall(default[key])) != sorted(_PLACEHOLDER.findall(translated[key])):
                    found.append(Violation(target_rel, 1, RULE, f"placeholders of {key} differ between languages"))
                if not translated[key].strip():
                    found.append(Violation(target_rel, 1, RULE, f"{key} is empty in {language}"))
                elif language == "ar" and key not in same_as_default and translated[key] == default[key] and _WORD.search(translated[key]) and not _ARABIC.search(translated[key]):
                    found.append(Violation(target_rel, 1, RULE, f"{key} in ar is an untranslated copy of the English text"))
    return found
