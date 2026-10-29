"""Minimal Kotlin lexer: blanks comments, string contents and char literals, and lists the string literals.

The masked text keeps every character position and newline, so line/column numbers stay valid.
Template expressions inside strings are treated as part of the string.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class StringLiteral:
    line: int  # 1-based
    column: int  # 0-based column of the opening quote
    content: str  # raw text between the quotes


def _blank(chars: list[str], start: int, end: int) -> None:
    for k in range(start, end):
        if chars[k] != "\n":
            chars[k] = " "


def _skip_template(src: str, i: int) -> int:
    """`i` points at `${`; return the index after the matching brace."""
    depth, n = 0, len(src)
    while i < n:
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def lex(src: str) -> tuple[str, list[StringLiteral]]:
    chars = list(src)
    strings: list[StringLiteral] = []
    n, i, line, line_start = len(src), 0, 1, 0
    while i < n:
        c = src[i]
        if c == "\n":
            line += 1
            line_start = i + 1
            i += 1
        elif src.startswith("//", i):
            end = src.find("\n", i)
            end = n if end == -1 else end
            _blank(chars, i, end)
            i = end
        elif src.startswith("/*", i):
            depth, j = 1, i + 2
            while j < n and depth:
                if src.startswith("/*", j):
                    depth, j = depth + 1, j + 2
                elif src.startswith("*/", j):
                    depth, j = depth - 1, j + 2
                else:
                    j += 1
            line += src.count("\n", i, j)
            if "\n" in src[i:j]:
                line_start = src.rfind("\n", i, j) + 1
            _blank(chars, i, j)
            i = j
        elif src.startswith('"""', i):
            end = src.find('"""', i + 3)
            end = n if end == -1 else end
            strings.append(StringLiteral(line, i - line_start, src[i + 3:end]))
            _blank(chars, i + 3, end)
            line += src.count("\n", i, end)
            if "\n" in src[i:end]:
                line_start = src.rfind("\n", i, end) + 1
            i = min(end + 3, n)
        elif c == '"':
            j = i + 1
            while j < n and src[j] != '"' and src[j] != "\n":
                if src[j] == "\\":
                    j += 2
                elif src.startswith("${", j):
                    j = _skip_template(src, j)
                else:
                    j += 1
            strings.append(StringLiteral(line, i - line_start, src[i + 1:j]))
            _blank(chars, i + 1, j)
            i = min(j + 1, n)
        elif c == "'" and i + 2 < n:
            j = i + 1
            while j < n and src[j] != "'" and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            _blank(chars, i + 1, j)
            i = min(j + 1, n)
        else:
            i += 1
    return "".join(chars), strings


def nested_comment_openers(src: str) -> list[int]:
    """Lines where a block comment opens inside another one. Kotlin nests comments, so `design/*.json` in a KDoc
    leaves the comment unclosed and breaks the whole file."""
    lines: list[int] = []
    n, i, line = len(src), 0, 1
    while i < n:
        if src.startswith("/*", i):
            depth, j = 1, i + 2
            while j < n and depth:
                if src.startswith("/*", j):
                    depth += 1
                    lines.append(line + src.count("\n", i, j))
                    j += 2
                elif src.startswith("*/", j):
                    depth, j = depth - 1, j + 2
                else:
                    j += 1
            line += src.count("\n", i, j)
            i = j
        else:
            if src[i] == "\n":
                line += 1
            i += 1
    return lines
