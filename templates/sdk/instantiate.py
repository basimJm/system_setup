#!/usr/bin/env python3
"""Reference instantiation of the `sdk` template (for the SYSTEM_SETUP core engine to mirror).

Merge `common/` + `kinds/<kind>/` (overlay wins), substitute every placeholder of `TEMPLATE.json`
in file contents and in relative paths, honour `skip`, and optionally run `post_generate`.

    python3 instantiate.py --kind storage --out "$TMPDIR/acme-sdk" \
        --system-name "Acme Shop" --slug acme --prefix ACM --scope @acme \
        --server-dir acme-server --owner acme-org --repo acme-system [--year 2026] [--run]

The package lands in `<out>/<slug>-<kind>`. Python 3.9, standard library only.
"""
from __future__ import annotations

import argparse
import datetime
import fnmatch
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable, List

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "TEMPLATE.json"
COMMON_DIR = "common"
TEXT_PROBE_BYTES = 8_000


def load_template() -> dict:
    with TEMPLATE.open(encoding="utf-8") as handle:
        return json.load(handle)


def build_tokens(template: dict, kind: str, args: argparse.Namespace) -> Dict[str, str]:
    """Every placeholder of TEMPLATE.json gets a value; the per-kind ones come from `kinds`."""
    kinds = template["kinds"]
    if kind not in kinds:
        raise SystemExit(f"unknown kind {kind!r}; known: {', '.join(sorted(kinds))}")
    spec = kinds[kind]
    tokens: Dict[str, str] = {
        "__SYSTEM_NAME__": args.system_name,
        "__SYSTEM_SLUG__": args.slug,
        "__SYSTEM_PREFIX__": args.prefix,
        "__NPM_SCOPE__": args.scope,
        "__SERVER_DIR__": args.server_dir,
        "__OWNER_GITHUB__": args.owner,
        "__REPO_NAME__": args.repo,
        "__YEAR__": str(args.year),
        "__SDK_KIND__": kind,
        "__SDK_PREFIX__": spec["prefix"],
        "__SDK_TITLE__": spec["title"],
    }
    for name in kinds:
        tokens[f"__SDK_DIR_{name}__"] = f"{args.slug}-{name}"
    missing = [p for p in template["placeholders"] if p not in tokens]
    if missing:
        raise SystemExit(f"TEMPLATE.json placeholders without a value: {missing}")
    return tokens


def substitute(text: str, tokens: Dict[str, str]) -> str:
    # Longest token first so `__SDK_DIR_otp__` is never split by a shorter token.
    for token in sorted(tokens, key=len, reverse=True):
        text = text.replace(token, tokens[token])
    return text


def is_skipped(rel: str, skip: Iterable[str]) -> bool:
    return any(fnmatch.fnmatch(rel, pattern) or fnmatch.fnmatch("/" + rel, pattern) for pattern in skip)


def is_text(path: Path) -> bool:
    with path.open("rb") as handle:
        chunk = handle.read(TEXT_PROBE_BYTES)
    if b"\0" in chunk:
        return False
    try:
        chunk.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def collect(root: Path, skip: Iterable[str]) -> Dict[str, Path]:
    files: Dict[str, Path] = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if is_skipped(rel, skip):
            continue
        files[rel] = path
    return files


def merge(template: dict, kind: str) -> Dict[str, Path]:
    """`common/` first, then the kind overlay; a path present in both takes the overlay's file."""
    skip = template.get("skip", [])
    files = collect(HERE / COMMON_DIR, skip)
    files.update(collect(HERE / template["kinds"][kind]["dir"], skip))
    return files


def write_package(files: Dict[str, Path], tokens: Dict[str, str], rename: Dict[str, str], dest: Path) -> List[str]:
    written: List[str] = []
    for rel, source in files.items():
        target_rel = substitute(rename.get(rel, rel), tokens)
        target = dest / target_rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if is_text(source):
            target.write_text(substitute(source.read_text(encoding="utf-8"), tokens), encoding="utf-8")
        else:
            shutil.copy2(source, target)
        shutil.copymode(source, target)
        written.append(target_rel)
    return written


def leftover_tokens(dest: Path) -> List[str]:
    """Any `__UPPER__` token left after substitution is a template bug; report it."""
    found: List[str] = []
    for path in dest.rglob("*"):
        if path.is_file() and is_text(path) and "node_modules" not in path.parts:
            text = path.read_text(encoding="utf-8")
            if "__SYSTEM_" in text or "__SDK_" in text or "__NPM_SCOPE__" in text:
                found.append(path.relative_to(dest).as_posix())
    return found


def run_post_generate(template: dict, dest: Path, env: Dict[str, str]) -> None:
    for command in template.get("post_generate", []):
        print(f"$ {command}  (in {dest})", flush=True)
        subprocess.run(command, shell=True, cwd=str(dest), check=True, env=env)


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--kind", required=True)
    parser.add_argument("--out", required=True, help="parent directory; the package is created under it")
    parser.add_argument("--system-name", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--scope", required=True, help="npm scope with the @")
    parser.add_argument("--server-dir", required=True)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--year", type=int, default=datetime.date.today().year)
    parser.add_argument("--force", action="store_true", help="replace an existing output directory")
    parser.add_argument("--run", action="store_true", help="run TEMPLATE.json post_generate afterwards")
    return parser.parse_args(argv)


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    template = load_template()
    tokens = build_tokens(template, args.kind, args)
    dest = Path(args.out).expanduser().resolve() / f"{args.slug}-{args.kind}"
    if dest.exists():
        if not args.force:
            raise SystemExit(f"{dest} exists (use --force to replace it)")
        shutil.rmtree(dest)
    files = merge(template, args.kind)
    written = write_package(files, tokens, template.get("rename_paths", {}), dest)
    left = leftover_tokens(dest)
    print(f"generated {len(written)} files in {dest}")
    if left:
        print("ERROR: placeholders left in: " + ", ".join(left), file=sys.stderr)
        return 1
    if args.run:
        run_post_generate(template, dest, dict(os.environ))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
