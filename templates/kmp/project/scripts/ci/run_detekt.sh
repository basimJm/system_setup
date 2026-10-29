#!/usr/bin/env bash
# Runs detekt with the Compose rules exactly like CI (CLAUDE.md §1.7, §6).
# Usage: scripts/ci/run_detekt.sh [--create-baseline]
# Tool jars are downloaded from Maven Central once and verified against the pinned SHA-256 checksums below.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAVEN_BASE="${MAVEN_BASE:-https://repo1.maven.org/maven2}"
CACHE="${WAB_LINT_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/wab-customer-lint}"

DETEKT_VERSION=1.23.8
DETEKT_SHA=3afe89a11120303c73c9bdda3d8fe558dd9070a6937d27819ddc04b275381245
RULES_VERSION=0.4.22
RULES_SHA=437dd7d8731b13fb274099e8058dae6640f312165ed53171d50927e6c3d2468b
COMMON_SHA=00a38c838b53209ea6be44d51a07edb02eacdb6cd523676125d021a5087ca11c

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

fetch() { # <maven path> <sha256>
  local file="$CACHE/$(basename "$1")"
  mkdir -p "$CACHE"
  if [ ! -f "$file" ] || [ "$(sha256 "$file")" != "$2" ]; then
    curl -fsSL --retry 3 -o "$file" "$MAVEN_BASE/$1"
  fi
  if [ "$(sha256 "$file")" != "$2" ]; then
    echo "Checksum mismatch for $file" >&2
    exit 1
  fi
}

fetch "io/gitlab/arturbosch/detekt/detekt-cli/$DETEKT_VERSION/detekt-cli-$DETEKT_VERSION-all.jar" "$DETEKT_SHA"
fetch "io/nlopez/compose/rules/detekt/$RULES_VERSION/detekt-$RULES_VERSION.jar" "$RULES_SHA"
fetch "io/nlopez/compose/rules/common/$RULES_VERSION/common-$RULES_VERSION.jar" "$COMMON_SHA"

mkdir -p "$ROOT/build/reports"
exec java -jar "$CACHE/detekt-cli-$DETEKT_VERSION-all.jar" \
  --input "$ROOT/core,$ROOT/composeApp,$ROOT/feature,$ROOT/androidApp/src,$ROOT/build-logic" \
  --excludes '**/build/**,**/contract/generated/**' \
  --config "$ROOT/config/detekt/detekt.yml" --build-upon-default-config \
  --baseline "$ROOT/config/detekt/baseline.xml" \
  --plugins "$CACHE/detekt-$RULES_VERSION.jar,$CACHE/common-$RULES_VERSION.jar" \
  --report "txt:$ROOT/build/reports/detekt.txt" \
  "$@"
