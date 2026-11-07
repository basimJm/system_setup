"""Template engine: copies a template tree, substitutes sentinels and tokens in text files, renames paths.

A template is read layer by layer (`layers` in TEMPLATE.json, e.g. sdk = `common/` then `kinds/<name>/`, kmp =
`project/`; default = the template root); a later layer overlays the earlier ones. Order inside a text file: repeated
blocks are expanded, then sentinels (longest literal first) become tokens, then every token becomes its value. Files
matching `binary_globs` (and files that are not UTF-8) are copied byte for byte. `targeted` edits run last, on the
written files. Every sentinel literal still present in a rendered text file is reported (never silently kept).
"""
from __future__ import annotations

import fnmatch
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from audiences import Renamer
from manifest import MANIFEST_NAME, Manifest

ALWAYS_SKIP = (".git", "__pycache__", ".DS_Store")
BLOCK_RE = re.compile(r"^[^\S\n]*__EACH_(APP|SDK|WEB)__[^\n]*\n(.*?)^[^\S\n]*__END_EACH__[^\n]*\n?", re.M | re.S)
LEFTOVER_RE = re.compile(r"__[A-Z][A-Z0-9]*(?:_[A-Za-z0-9]+)*__")


class EngineError(RuntimeError):
    """Generation cannot continue (e.g. the target is inside the tool)."""


@dataclass
class Result:
    kind: str
    dest: Path
    files: List[Path] = field(default_factory=list)
    binaries: List[Path] = field(default_factory=list)
    overwritten: List[Path] = field(default_factory=list)
    unresolved: Dict[str, List[str]] = field(default_factory=dict)   # declared tokens nobody filled
    foreign: Dict[str, List[str]] = field(default_factory=dict)      # other __X__ strings (the template's own code)
    sentinel_left: Dict[str, List[str]] = field(default_factory=dict)
    post_generate: List[str] = field(default_factory=list)


# ---------- substitution ----------

def expand_blocks(text: str, parts: Mapping[str, Iterable[Mapping[str, str]]]) -> str:
    """Repeats `__EACH_APP__ … __END_EACH__` (or SDK) once per app/SDK with the contextual tokens filled in."""
    def repeat(match: "re.Match[str]") -> str:
        body = match.group(2)
        return "".join(substitute_tokens(body, values) for values in parts.get(match.group(1), []))
    return BLOCK_RE.sub(repeat, text)


def substitute_sentinels(text: str, sentinels: Mapping[str, str]) -> str:
    for literal in sorted(sentinels, key=len, reverse=True):
        text = text.replace(literal, sentinels[literal])
    return text


def substitute_tokens(text: str, values: Mapping[str, str]) -> str:
    for token in sorted(values, key=len, reverse=True):
        if token in text:
            text = text.replace(token, values[token])
    return text


def audience_renamer(manifest: Manifest, slugs: Optional[Mapping[str, str]]) -> Optional[Renamer]:
    """The renamer of a template that declares `audiences`, for the audience slugs the plan chose (role -> slug)."""
    if not manifest.audiences:
        return None
    chosen = dict(slugs or {})
    generic = {role: role.replace("_", "-") for role in manifest.audiences if role not in chosen}   # a pruned role: its leftover words get the role's own name
    return Renamer({role: (words["word"], words["plural"]) for role, words in manifest.audiences.items()}, {**generic, **chosen})


def render_text(text: str, manifest: Manifest, values: Mapping[str, str],
                parts: Optional[Mapping[str, Iterable[Mapping[str, str]]]] = None, renamer: Optional[Renamer] = None) -> str:
    text = expand_blocks(text, parts or {})
    text = substitute_sentinels(text, manifest.sentinels)
    if renamer is not None:
        text = renamer.apply(text)
    return substitute_tokens(text, values)


def render_path(rel: PurePosixPath, manifest: Manifest, values: Mapping[str, str], renamer: Optional[Renamer] = None) -> PurePosixPath:
    """Renames on the whole relative path, so a literal like `com/acme/shop` can span folders (package paths)."""
    text = substitute_sentinels(rel.as_posix(), manifest.rename_paths)
    if renamer is not None:
        text = renamer.apply(text)
    text = substitute_tokens(text, values)
    rendered = PurePosixPath(text)
    if rendered.is_absolute() or ".." in rendered.parts or not rendered.parts:
        raise EngineError(f"path {rel} renders to {text!r}, which leaves the destination")
    return rendered


def leftovers(text: str) -> List[str]:
    return sorted(set(LEFTOVER_RE.findall(text)))


def is_declared(token: str, declared: Iterable[str]) -> bool:
    """`__APP_DIR_2__` is declared by `__APP_DIR_<n>__`, `__SDK_DIR_otp__` by `__SDK_DIR_<name>__`."""
    for family in declared:
        if token == family:
            return True
        if "<" in family:
            head = family[:family.index("<")]
            if token.startswith(head) and token.endswith("__") and token[len(head):-2].isalnum():
                return True
    return False


def split_leftovers(text: str, manifest: Manifest, values: Mapping[str, str]) -> Tuple[List[str], List[str]]:
    """(unresolved declared tokens, foreign token-shaped strings) left in a rendered text."""
    declared = [*manifest.tokens, *values]
    unresolved, foreign = [], []
    for token in leftovers(text):
        (unresolved if is_declared(token, declared) else foreign).append(token)
    return unresolved, foreign


def sentinel_leftovers(text: str, sentinels: Mapping[str, str], values: Mapping[str, str]) -> List[str]:
    """Sentinel literals still in a rendered text or path, ignoring literals some answer legitimately equals."""
    chosen = set(values.values())
    return sorted(literal for literal in sentinels if literal in text and literal not in chosen)


def verification_errors(result: "Result") -> List[str]:
    """Post-write check of one part: every sentinel left in a path or text file, one line each (empty = clean)."""
    return [f"{rel}: {', '.join(literals)}" for rel, literals in sorted(result.sentinel_left.items())]


# ---------- selection ----------

def matches_any(rel: PurePosixPath, globs: Iterable[str]) -> bool:
    """`*.png` / `build` match any path segment; `node_modules/**` and `**/build/**` match a folder at any depth."""
    text = rel.as_posix()
    for glob in globs:
        for pattern in {glob, glob[3:]} if glob.startswith("**/") else {glob}:
            if not pattern:
                continue
            if fnmatch.fnmatch(text, pattern):
                return True
            if pattern.endswith("/**"):
                folder = pattern[:-3]
                parents = rel.parts[:-1]
                if any(fnmatch.fnmatch("/".join(parents[:i]), folder) for i in range(1, len(parents) + 1)):
                    return True
            elif "/" not in pattern and any(fnmatch.fnmatch(part, pattern) for part in rel.parts):
                return True
    return False


def is_skipped(rel: PurePosixPath, manifest: Manifest, extra_skip: Iterable[str] = ()) -> bool:
    if rel.name == MANIFEST_NAME and len(rel.parts) == 1:
        return True
    if any(part in ALWAYS_SKIP for part in rel.parts):
        return True
    return matches_any(rel, manifest.skip) or matches_any(rel, extra_skip)


def layer_dirs(manifest: Manifest, values: Mapping[str, str]) -> List[Path]:
    """The template folders to copy, in overlay order; tokens in a layer name (`kinds/__SDK_NAME__`) are rendered."""
    dirs = layer_dirs(manifest.base, values) if manifest.base else []   # a template with a base overlays its own files on it
    for layer in manifest.layers or ["."]:
        rendered = substitute_tokens(layer, values)
        if "__" in rendered:
            raise EngineError(f"{manifest.kind}: layer {layer!r} needs a value for its token(s)")
        folder = (manifest.root / rendered).resolve()
        if manifest.root.resolve() not in (folder, *folder.parents):
            raise EngineError(f"{manifest.kind}: layer {layer!r} leaves the template")
        if not folder.is_dir():
            raise EngineError(f"{manifest.kind}: layer {layer!r} = {rendered!r} not found in {manifest.root}")
        dirs.append(folder)
    return dirs


def template_files(manifest: Manifest, values: Optional[Mapping[str, str]] = None,
                   extra_skip: Iterable[str] = ()) -> List[Tuple[PurePosixPath, Path]]:
    """(relative output path, source file) for every file of every layer; a later layer replaces an earlier one."""
    chosen: Dict[PurePosixPath, Path] = {}
    for folder in layer_dirs(manifest, values or {}):
        for path in sorted(folder.rglob("*")):
            if not path.is_file() and not path.is_symlink():
                continue
            rel = PurePosixPath(path.relative_to(folder).as_posix())
            if not is_skipped(rel, manifest, extra_skip):
                chosen[rel] = path
    return sorted(chosen.items())


def resolve_dest(manifest: Manifest, repo_root: Path, values: Mapping[str, str]) -> Path:
    if manifest.dest in (".", ""):
        return repo_root.resolve()
    dest = render_path(PurePosixPath(manifest.dest), manifest, values)
    full = (repo_root / Path(*dest.parts)).resolve()
    if repo_root.resolve() not in (full, *full.parents):
        raise EngineError(f"{manifest.kind}: dest {manifest.dest!r} escapes the repository root")
    return full


# ---------- generation ----------

def instantiate(manifest: Manifest, repo_root: Path, values: Mapping[str, str],
                parts: Optional[Mapping[str, Iterable[Mapping[str, str]]]] = None, drop: Sequence[str] = (),
                audiences: Optional[Mapping[str, str]] = None) -> Result:
    """Writes one template into `repo_root` (under the manifest's dest). Returns what it did. `drop` names the template's
    `prune` groups to remove: their files are not copied, their edits are applied and their commands are not listed.
    `audiences` (role -> slug) renames the template's audience words (server); a role without a slug must be in `drop`."""
    renamer = audience_renamer(manifest, audiences)
    unknown = [group for group in drop if group not in manifest.prune]
    if unknown:
        raise EngineError(f"{manifest.kind}: no prune group {', '.join(unknown)} (the template declares: {', '.join(manifest.prune) or 'none'})")
    dest = resolve_dest(manifest, repo_root, values)
    result = Result(kind=manifest.kind, dest=dest)
    removed_files = [glob for group in drop for glob in manifest.prune[group]["skip"]]
    for rel, source in template_files(manifest, values, removed_files):
        out_rel = render_path(rel, manifest, values, renamer)
        out = dest / Path(*out_rel.parts)
        out.parent.mkdir(parents=True, exist_ok=True)
        left_in_path = sentinel_leftovers(out_rel.as_posix(), manifest.sentinels, values)
        if left_in_path:
            result.sentinel_left[str(out.relative_to(repo_root))] = left_in_path
        if out.exists():
            result.overwritten.append(out)
        if source.is_symlink():
            if out.is_symlink() or out.exists():
                out.unlink()
            out.symlink_to(source.readlink())
            result.files.append(out)
            continue
        if matches_any(rel, manifest.binary_globs) or matches_any(rel, manifest.verbatim_globs):
            shutil.copyfile(source, out)
            result.binaries.append(out)
        else:
            raw = source.read_bytes()
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                out.write_bytes(raw)
                result.binaries.append(out)
            else:
                rendered = render_text(text, manifest, values, parts, renamer)
                out.write_text(rendered, encoding="utf-8")
                unresolved, foreign = split_leftovers(rendered, manifest, values)
                if unresolved:
                    result.unresolved[str(out.relative_to(repo_root))] = unresolved
                if foreign:
                    result.foreign[str(out.relative_to(repo_root))] = foreign
                left = sentinel_leftovers(rendered, manifest.sentinels, values)
                if left:
                    key = str(out.relative_to(repo_root))
                    result.sentinel_left[key] = sorted(set(result.sentinel_left.get(key, [])) | set(left))
                result.files.append(out)
        shutil.copymode(source, out)
    apply_targeted(manifest, dest, values)
    apply_prune_edits(manifest, dest, values, drop, renamer)
    removed_commands = {cmd for group in drop for cmd in manifest.prune[group]["post_generate"]}
    result.post_generate = [render_text(cmd, manifest, values) for cmd in manifest.post_generate if cmd not in removed_commands]
    return result


def audience_leftovers(manifest: Manifest, dest: Path, dropped: Sequence[str]) -> Dict[str, List[str]]:
    """Files of a generated template that still carry the word of a role the plan does not have (should be empty; a word
    left in a path or a file is listed so it is explained or fixed, never silent)."""
    found: Dict[str, List[str]] = {}
    for role in dropped:
        word = manifest.audiences.get(role, {}).get("word", "")
        if not word:
            continue
        for path in sorted(dest.rglob("*")):
            rel = path.relative_to(dest).as_posix()
            if not path.is_file() or any(part in ("node_modules", ".git") for part in path.parts):
                continue
            if word in rel.lower():
                found.setdefault(rel, []).append(word)
                continue
            try:
                if word in path.read_text(encoding="utf-8").lower():
                    found.setdefault(rel, []).append(word)
            except (UnicodeDecodeError, OSError):
                continue
    return found


def apply_prune_edits(manifest: Manifest, dest: Path, values: Mapping[str, str], drop: Sequence[str], renamer: Optional[Renamer] = None) -> None:
    """The removals of every dropped prune group, run on the written files. `edits`: exact `find` -> `replace_with`; `drop_lines`:
    every line of the file that contains one of the texts is deleted; `drop_blocks`: from the first line containing `start` to the
    next line that begins with `end` (indentation counts, so `  });` is a line indented by two), both included. Texts are written as in the template (sentinels, audience words and tokens render
    like the file). A file or a text that is not there is an error, so a template that changed under its prune list is noticed,
    never skipped silently."""
    def target(group: str, name: str) -> "tuple[PurePosixPath, Path, str]":
        rel = render_path(PurePosixPath(name), manifest, values, renamer)
        path = dest / Path(*rel.parts)
        if not path.is_file():
            raise EngineError(f"{manifest.kind}: prune {group}: file {rel} was not generated")
        return rel, path, path.read_text(encoding="utf-8")

    def rendered(text: str) -> str:
        return render_text(text, manifest, values, renamer=renamer)

    for group in drop:
        spec = manifest.prune[group]
        for edit in spec["edits"]:
            rel, path, text = target(group, edit["file"])
            needle = rendered(edit["find"])
            if needle not in text:
                raise EngineError(f"{manifest.kind}: prune {group}: text not found in {rel}: {edit['find'][:80]!r}")
            path.write_text(text.replace(needle, rendered(edit["replace_with"])), encoding="utf-8")
        for entry in spec["drop_blocks"]:
            rel, path, text = target(group, entry["file"])
            start, end = rendered(entry["start"]), rendered(entry["end"])
            lines = text.split("\n")
            first = next((i for i, line in enumerate(lines) if start in line), None)
            last = next((i for i in range(first + 1, len(lines)) if lines[i].startswith(end)), None) if first is not None else None
            if first is None or last is None:
                raise EngineError(f"{manifest.kind}: prune {group}: block {entry['start'][:60]!r} .. {entry['end'][:60]!r} not found in {rel}")
            path.write_text("\n".join(lines[:first] + lines[last + 1:]), encoding="utf-8")
        for entry in spec["drop_lines"]:
            rel, path, text = target(group, entry["file"])
            needles = [rendered(c) for c in entry["contains"]]
            lines = text.split("\n")
            kept = [line for line in lines if not any(n in line for n in needles)]
            if len(kept) == len(lines):
                raise EngineError(f"{manifest.kind}: prune {group}: no line with {needles[0][:80]!r} in {rel}")
            path.write_text("\n".join(kept), encoding="utf-8")


def apply_targeted(manifest: Manifest, dest: Path, values: Mapping[str, str]) -> None:
    """`targeted` edits: exact `find` -> `replace_with` (tokens rendered) in one written file; missing text = error."""
    for edit in manifest.targeted:
        rel = render_path(PurePosixPath(edit["file"]), manifest, values)
        path = dest / Path(*rel.parts)
        if not path.is_file():
            raise EngineError(f"{manifest.kind}: targeted edit file {rel} was not generated")
        text = path.read_text(encoding="utf-8")
        if edit["find"] not in text:
            raise EngineError(f"{manifest.kind}: targeted edit text not found in {rel}: {edit['find']!r}")
        replacement = substitute_tokens(edit["replace_with"], values)
        if edit["placeholder"] in replacement:
            raise EngineError(f"{manifest.kind}: no value for {edit['placeholder']} (targeted edit in {rel})")
        path.write_text(text.replace(edit["find"], replacement), encoding="utf-8")


def run_post_generate(result: Result) -> List[str]:
    """Runs the rendered post_generate commands in the part's folder; returns the failures."""
    failures = []
    for command in result.post_generate:
        completed = subprocess.run(command, shell=True, cwd=result.dest, check=False)
        if completed.returncode != 0:
            failures.append(f"{result.kind}: `{command}` exited {completed.returncode}")
    return failures


def check_target(target: Path, tool_root: Path) -> None:
    """The target must not be inside the tool (its templates) and must be empty or absent."""
    resolved = target.resolve()
    tool = tool_root.resolve()
    if resolved == tool or tool in resolved.parents:
        raise EngineError(f"the target {resolved} is inside the tool {tool}; pick a folder outside it")
    if resolved in tool.parents:
        raise EngineError(f"the target {resolved} contains the tool {tool}; pick a folder outside it")
    if resolved.exists() and not resolved.is_dir():
        raise EngineError(f"the target {resolved} is not a folder")
    if resolved.is_dir() and any(resolved.iterdir()):
        raise EngineError(f"the target {resolved} is not empty")
