"""R2 / H-rules: no hardcoded colors, dimensions, texts, URLs, secrets or magic numbers in Kotlin and Swift code."""
import re
from .files import Config, iter_files, matches_any, rel
from .kotlin_lexer import StringLiteral, lex
from .model import Violation

COLOR, DIMENSION, TEXT, URL, SECRET, NUMBER = "H001", "H002", "H003", "H004", "H005", "H006"

_COLOR_CALL = re.compile(r"\bColor\(\s*(?:0[xX][0-9A-Fa-f_]+|\d)")
_COLOR_NAMED = re.compile(r"\bColor\.(?:Red|Green|Blue|Black|White|Gray|DarkGray|LightGray|Yellow|Cyan|Magenta)\b")
_DIMENSION = re.compile(r"(?<!\w)(\d+(?:\.\d+)?)\.(?:dp|sp|em)\b")
_NUMBER = re.compile(r"(?<!\w)(0[xX][0-9A-Fa-f_]+[LuU]*|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?[fFLuU]*)(?!\w)")
_ANNOTATION = re.compile(r"@[\w.]+\s*\(")
_LETTER = re.compile(r"[A-Za-z؀-ۿ]")
_TEMPLATE = re.compile(r"\$\{[^}]*\}|\$\w+")
_URL = re.compile(r"https?://|(?<![\w.])www\.|\b\d{1,3}(?:\.\d{1,3}){3}\b|\blocalhost\b", re.IGNORECASE)
_SECRET_NAME = re.compile(r"(?i)(?:api[_-]?key|secret|passw(?:or)?d|token|bearer|authorization)\w*\s*[:=]\s*$")
_SECRET_VALUE = re.compile(r"AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}")
_POSITIONAL_TEXT = re.compile(r"\b[A-Z]\w*Text\w*\(\s*$")
_FALLBACK_TEXT = re.compile(r"\?:\s*$")
_IDENTIFIER = re.compile(r"[a-z][A-Za-z0-9]*$")
_SWIFT_COMMENT = re.compile(r"(?:^|\s)//.*$")


def _blank(text: str, start: int, end: int) -> str:
    return text[:start] + "".join(ch if ch == "\n" else " " for ch in text[start:end]) + text[end:]


def _mask_annotations(masked: str) -> str:
    for match in list(_ANNOTATION.finditer(masked)):
        depth, i = 1, match.end()
        while i < len(masked) and depth:
            depth += {"(": 1, ")": -1}.get(masked[i], 0)
            i += 1
        masked = _blank(masked, match.start(), i)
    return masked


def _number_value(token: str) -> str:
    token = token.replace("_", "").rstrip("fFLuU") if not token.lower().startswith("0x") else token
    try:
        value = float(token)
    except ValueError:
        return token
    return str(int(value)) if value == int(value) else str(value)


def _line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def _code_rules(path: str, masked: str, cfg: dict, theme: bool, numbers_allowed: bool, dimensions_allowed: bool = False) -> list[Violation]:
    found: list[Violation] = []
    scan = _mask_annotations(masked)
    for match in _COLOR_CALL.finditer(scan):
        if not theme:
            found.append(Violation(path, _line_of(scan, match.start()), COLOR, "color literal; use a LocalAppColors token"))
    for match in _COLOR_NAMED.finditer(scan):
        if not theme:
            found.append(Violation(path, _line_of(scan, match.start()), COLOR, "named color; use a LocalAppColors token"))
    for match in _DIMENSION.finditer(scan):
        if not (theme or dimensions_allowed) and float(match.group(1)) != 0:
            found.append(Violation(path, _line_of(scan, match.start()), DIMENSION, f"{match.group(0)}; use a spacing/size/typography token"))
    if not numbers_allowed:
        scan = _COLOR_CALL.sub(lambda m: " " * len(m.group(0)), scan)
        scan = _DIMENSION.sub(lambda m: " " * len(m.group(0)), scan)
        allowed = set(cfg["allowedNumbers"])
        for number in _NUMBER.finditer(scan):
            line_start = scan.rfind("\n", 0, number.start()) + 1
            line_end = scan.find("\n", number.end())
            if re.search(r"\bconst\s+val\b", scan[line_start:line_end if line_end != -1 else len(scan)]):
                continue
            if _number_value(number.group(1)) not in allowed:
                found.append(Violation(path, _line_of(scan, number.start()), NUMBER, f"magic number {number.group(1)}; name it in a constants or token file"))
    return found


def _string_rules(path: str, masked: str, strings: list[StringLiteral], cfg: dict) -> list[Violation]:
    found: list[Violation] = []
    lines = masked.split("\n")
    text_args = "|".join(cfg["textArguments"])
    named_arg = re.compile(rf"\b({text_args})\s*=\s*$")
    for literal in strings:
        before = lines[literal.line - 1][: literal.column]
        content = literal.content
        if _URL.search(content):
            found.append(Violation(path, literal.line, URL, "URL/host literal; use per-environment build config"))
        if _SECRET_VALUE.search(content) or (_SECRET_NAME.search(before) and len(content) >= 8):
            found.append(Violation(path, literal.line, SECRET, "secret-looking literal; use local.properties / CI secrets"))
        visible = _LETTER.search(_TEMPLATE.sub("", content))
        named = named_arg.search(before)
        if not visible or not (named or _POSITIONAL_TEXT.search(before) or _FALLBACK_TEXT.search(before)):
            continue
        if named and named.group(1) in cfg["identifierLabelArguments"] and _IDENTIFIER.match(content):
            continue
        found.append(Violation(path, literal.line, TEXT, "user-visible string literal; use a string resource (AR + EN)"))
    return found


def check_kotlin_source(path: str, text: str, config_kotlin: dict) -> list[Violation]:
    masked, strings = lex(text)
    theme = matches_any(path, config_kotlin["themeGlobs"])
    constants = matches_any(path, config_kotlin["constantsGlobs"])
    numbers_allowed = theme or constants or matches_any(path, config_kotlin["previewGlobs"])
    found = _code_rules(path, masked, config_kotlin, theme, numbers_allowed, dimensions_allowed=constants)
    if not matches_any(path, config_kotlin["previewGlobs"]):
        found += _string_rules(path, masked, strings, config_kotlin)
    return found


def check_swift_source(path: str, text: str) -> list[Violation]:
    found: list[Violation] = []
    for number, raw in enumerate(text.split("\n"), start=1):
        code = _SWIFT_COMMENT.sub("", raw)
        if _URL.search(code):
            found.append(Violation(path, number, URL, "URL/host literal; read it from Info.plist (xcconfig)"))
        if _SECRET_VALUE.search(code):
            found.append(Violation(path, number, SECRET, "secret-looking literal"))
    return found


def check(config: Config) -> list[Violation]:
    kotlin = config.section("kotlin")
    swift = config.section("swift")
    found: list[Violation] = []
    for path in iter_files(config, {".kt", ".swift"}):
        rel_path = rel(config, path)
        text = path.read_text(encoding="utf-8", errors="replace")
        if path.suffix == ".kt":
            if not matches_any(rel_path, kotlin["sourceGlobs"]) or matches_any(rel_path, kotlin["excludeGlobs"] + kotlin["testGlobs"]):
                continue
            found += check_kotlin_source(rel_path, text, kotlin)
        elif matches_any(rel_path, swift["sourceGlobs"]):
            found += check_swift_source(rel_path, text)
    return found
