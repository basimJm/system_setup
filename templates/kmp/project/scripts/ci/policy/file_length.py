"""R8: no source file longer than the configured number of lines."""
from .files import Config, iter_files, matches_any, rel
from .model import Violation

RULE = "L001"


def check(config: Config) -> list[Violation]:
    section = config.section("fileLength")
    limit = section["max"]
    found: list[Violation] = []
    for path in iter_files(config, set(section["extensions"])):
        rel_path = rel(config, path)
        if matches_any(rel_path, section["excludeGlobs"]):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        count = text.count("\n") + (0 if text.endswith("\n") or not text else 1)
        if count > limit:
            found.append(Violation(rel_path, count, RULE, f"{count} lines, limit is {limit}; split it by responsibility"))
    return found
