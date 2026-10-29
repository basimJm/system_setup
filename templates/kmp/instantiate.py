#!/usr/bin/env python3
"""Reference instantiation of the `kmp` template (SYSTEM_SETUP/templates/kmp): sentinels -> a new app identity.

The core SYSTEM_SETUP engine should do exactly what this file does (or import `instantiate()`):

1. Walk `project/`; for every file compute the destination path by applying the *path* substitutions
   (`rename_paths` in TEMPLATE.json: `com/acme/shop` -> the new package as a path, `AcmeShop` -> the new project
   name). Kotlin source trees live under `src/<sourceSet>/kotlin/com/acme/shop/...`, so the package rename is a path
   rename, not only a text edit.
2. Copy binaries (`binary_globs`) byte for byte; rewrite every other file as UTF-8 text with the *text* substitutions
   (`sentinels` + the derived package forms, longest sentinel first), including the xcconfig `https:/$()/host` form,
   which only works because the sentinel there is the bare host (`api-dev.example.com`), not the full URL.
3. Apply the `targeted` edits (values that are too short to substitute globally, e.g. the realtime namespace `/app`).
4. Verify no sentinel is left anywhere (text or path) and fail loudly otherwise.

Usage:
  instantiate.py --target DIR --app-name "Beta Store" --app-name-ar "متجر بيتا" --package io.beta.store \
      --project-name BetaStore --dev-api-url https://api-dev.beta.io --prod-api-url https://api.beta.io \
      --dev-web-url https://app-dev.beta.io --prod-web-url https://app.beta.io --team-id ABCDE12345 \
      --api-prefix /store/v1 --realtime-namespace /store --server-dir Beta-Server
Standard library only (Python 3.9+).
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = HERE / "project"
DEFAULT_MANIFEST = HERE / "TEMPLATE.json"


def host_of(url: str) -> str:
    """`https://api-dev.example.com` -> `api-dev.example.com` (the form used by every sentinel URL)."""
    match = re.match(r"^https?://([^/]+)/?$", url.strip())
    if not match:
        raise SystemExit(f"URL must be https://<host> with no path: {url}")
    return match.group(1)


def package_forms(package: str) -> dict[str, str]:
    parts = package.split(".")
    if len(parts) < 2 or not all(re.fullmatch(r"[a-z][a-z0-9_]*", p) for p in parts):
        raise SystemExit(f"package must be lower-case dotted segments: {package}")
    return {"dotted": package, "dashed": "-".join(parts), "slashed": "/".join(parts)}


def build_text_map(manifest: dict, identity: dict[str, str]) -> list[tuple[str, str]]:
    """Sentinel literal -> new value, longest first so `com.acme.shop` wins over `acme`-like substrings."""
    values = dict(identity)
    forms = package_forms(identity["__APP_PACKAGE__"])
    values["__APP_PACKAGE_DASHED__"] = forms["dashed"]
    values["__APP_PACKAGE_PATH__"] = forms["slashed"]
    for key in ("__DEV_API_URL__", "__PROD_API_URL__", "__DEV_WEB_URL__", "__PROD_WEB_URL__"):
        values[key.replace("_URL__", "_HOST__")] = host_of(identity[key])
    pairs = []
    for literal, placeholder in manifest["sentinels"].items():
        if placeholder not in values:
            raise SystemExit(f"no value for {placeholder} (sentinel {literal!r})")
        pairs.append((literal, values[placeholder]))
    pairs.sort(key=lambda p: len(p[0]), reverse=True)
    return pairs, values


def substitute(text: str, pairs: list[tuple[str, str]]) -> str:
    for literal, value in pairs:
        text = text.replace(literal, value)
    return text


def is_binary(rel: str, globs: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel, g) or fnmatch.fnmatch(Path(rel).name, g.rsplit("/", 1)[-1]) for g in globs)


def instantiate(template: Path, manifest_path: Path, target: Path, identity: dict[str, str]) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if target.exists() and any(target.iterdir()):
        raise SystemExit(f"target exists and is not empty: {target}")
    pairs, values = build_text_map(manifest, identity)
    # Path renames: `com/acme/shop` -> package as path, `AcmeShop` -> project name (longest literal first).
    path_pairs = sorted(((k, values[v]) for k, v in manifest["rename_paths"].items()), key=lambda p: len(p[0]), reverse=True)
    skip = manifest.get("skip", [])
    written = 0
    for src in sorted(p for p in template.rglob("*") if p.is_file()):
        rel = src.relative_to(template).as_posix()
        if any(fnmatch.fnmatch(rel, g) for g in skip):
            continue
        dest = target / substitute(rel, path_pairs)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if is_binary(rel, manifest["binary_globs"]):
            dest.write_bytes(src.read_bytes())
        else:
            dest.write_text(substitute(src.read_text(encoding="utf-8"), pairs), encoding="utf-8")
            if src.stat().st_mode & 0o111:
                dest.chmod(dest.stat().st_mode | 0o111)
        written += 1
    for edit in manifest.get("targeted", []):
        file = target / substitute(edit["file"], path_pairs)
        text = file.read_text(encoding="utf-8")
        if edit["find"] not in text:
            raise SystemExit(f"targeted edit not found in {file}: {edit['find']!r}")
        file.write_text(text.replace(edit["find"], edit["replace_with"].replace(edit["placeholder"], identity[edit["placeholder"]])),
                        encoding="utf-8")
    verify(target, manifest, [literal for literal, _ in pairs])
    return written


def verify(target: Path, manifest: dict, sentinels: list[str]) -> None:
    leftovers = []
    for path in target.rglob("*"):
        rel = path.relative_to(target).as_posix()
        hits = [s for s in sentinels if s in rel]
        if path.is_file() and not is_binary(rel, manifest["binary_globs"]):
            text = path.read_text(encoding="utf-8")
            hits += [s for s in sentinels if s in text]
        leftovers += [f"{rel}: {s}" for s in hits]
    if leftovers:
        raise SystemExit("sentinels left after instantiation:\n  " + "\n  ".join(leftovers))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--target", type=Path, required=True)
    flags = {
        "--app-name": "__APP_NAME__", "--app-name-ar": "__APP_NAME_AR__", "--package": "__APP_PACKAGE__",
        "--project-name": "__APP_PROJECT__", "--dev-api-url": "__DEV_API_URL__", "--prod-api-url": "__PROD_API_URL__",
        "--dev-web-url": "__DEV_WEB_URL__", "--prod-web-url": "__PROD_WEB_URL__", "--team-id": "__APPLE_TEAM_ID__",
        "--api-prefix": "__API_PREFIX__", "--realtime-namespace": "__REALTIME_NAMESPACE__",
        "--server-dir": "__SERVER_DIR__", "--system-name": "__SYSTEM_NAME__", "--system-prefix": "__SYSTEM_PREFIX__",
    }
    for flag, placeholder in flags.items():
        parser.add_argument(flag, dest=placeholder, required=placeholder in REQUIRED, default="")
    args = parser.parse_args(argv)
    identity = {placeholder: getattr(args, placeholder) for placeholder in flags.values()}
    identity["__APP_DIR__"] = args.target.name
    identity.setdefault("__APP_NAME_AR__", identity["__APP_NAME__"])
    if not identity["__APP_NAME_AR__"]:
        identity["__APP_NAME_AR__"] = identity["__APP_NAME__"]
    if not identity["__SERVER_DIR__"]:
        identity["__SERVER_DIR__"] = f"{identity['__APP_PROJECT__']}-Server"
    count = instantiate(args.template.resolve(), args.manifest.resolve(), args.target.resolve(), identity)
    print(f"instantiated {count} files into {args.target}")
    return 0


REQUIRED = {"__APP_NAME__", "__APP_PACKAGE__", "__APP_PROJECT__", "__DEV_API_URL__", "__PROD_API_URL__",
            "__DEV_WEB_URL__", "__PROD_WEB_URL__", "__APPLE_TEAM_ID__", "__API_PREFIX__", "__REALTIME_NAMESPACE__"}

if __name__ == "__main__":
    sys.exit(main())
