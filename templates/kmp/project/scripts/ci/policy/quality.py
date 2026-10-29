"""R7 / performance rules (Q and P): crash-prone constructs and Compose performance anti-patterns."""
import re
from .files import Config, iter_files, matches_any, rel
from .kotlin_lexer import lex, nested_comment_openers
from .model import Violation

BANG, PRINT, GLOBAL_SCOPE, RUN_BLOCKING, EMPTY_CATCH, SUPPRESS, TODO = "Q001", "Q002", "Q003", "Q004", "Q005", "Q006", "Q007"
LAZY_KEY, COLLECT_STATE, SLEEP = "P001", "P002", "P003"
NESTED_COMMENT = "Q008"

_SIMPLE = [
    (BANG, re.compile(r"!!"), "non-null assertion (!!); handle null explicitly"),
    (PRINT, re.compile(r"\bprintln\s*\(|\.printStackTrace\s*\("), "console output; use the logging abstraction without PII"),
    (GLOBAL_SCOPE, re.compile(r"\bGlobalScope\b"), "GlobalScope; use a lifecycle-bound scope"),
    (RUN_BLOCKING, re.compile(r"\brunBlocking\b"), "runBlocking blocks the calling thread"),
    (TODO, re.compile(r"\bTODO\s*\("), "TODO() throws at runtime"),
    (COLLECT_STATE, re.compile(r"\.collectAsState\s*\("), "use collectAsStateWithLifecycle"),
    (SLEEP, re.compile(r"\bThread\.sleep\b"), "Thread.sleep blocks the thread; use delay in a coroutine"),
]
_EMPTY_CATCH = re.compile(r"\bcatch\s*\([^)]*\)\s*\{\s*\}")
_LAZY_FILE = re.compile(r"\b(?:LazyColumn|LazyRow|LazyVerticalGrid|LazyHorizontalGrid|LazyVerticalStaggeredGrid|LazyHorizontalStaggeredGrid)\b")
_ITEMS_CALL = re.compile(r"(?<![\w.])items(?:Indexed)?\s*\(")
_KEY_ARG = re.compile(r"\b(?:key|contentType|count)\s*=")


def _line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def _balanced_args(masked: str, open_index: int) -> str:
    depth, i = 0, open_index
    while i < len(masked):
        depth += {"(": 1, ")": -1}.get(masked[i], 0)
        i += 1
        if depth == 0:
            break
    return masked[open_index:i]


def check_source(path: str, text: str) -> list[Violation]:
    masked, _ = lex(text)
    found: list[Violation] = []
    for rule, pattern, message in _SIMPLE:
        found += [Violation(path, _line_of(masked, m.start()), rule, message) for m in pattern.finditer(masked)]
    found += [Violation(path, _line_of(masked, m.start()), EMPTY_CATCH, "empty catch swallows errors") for m in _EMPTY_CATCH.finditer(masked)]
    found += [Violation(path, line, NESTED_COMMENT, "nested block comment opener; rewrite the text so it has no slash-star") for line in nested_comment_openers(text)]
    raw_lines = text.split("\n")
    for number, raw in enumerate(raw_lines, start=1):
        if "@Suppress" in raw and "//" not in raw and "//" not in (raw_lines[number - 2] if number > 1 else ""):
            found.append(Violation(path, number, SUPPRESS, "@Suppress needs a one-line reason comment"))
    if _LAZY_FILE.search(masked):
        for match in _ITEMS_CALL.finditer(masked):
            args = _balanced_args(masked, match.end() - 1)
            if not _KEY_ARG.search(args):
                found.append(Violation(path, _line_of(masked, match.start()), LAZY_KEY, "lazy list items() needs key = and contentType ="))
    return found


def check(config: Config) -> list[Violation]:
    kotlin = config.section("kotlin")
    found: list[Violation] = []
    for path in iter_files(config, {".kt"}):
        rel_path = rel(config, path)
        if not matches_any(rel_path, kotlin["sourceGlobs"]) or matches_any(rel_path, kotlin["excludeGlobs"] + kotlin["testGlobs"]):
            continue
        found += check_source(rel_path, path.read_text(encoding="utf-8", errors="replace"))
    return found
