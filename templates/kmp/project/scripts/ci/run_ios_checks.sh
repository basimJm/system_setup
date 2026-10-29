#!/usr/bin/env bash
# Builds every iOS configuration for the simulator exactly like CI (.github/workflows/ci.yml, iOS matrix),
# then runs the Kotlin/Native unit tests and SwiftLint (when installed). CLAUDE.md §1.5: all four iOS variants must build.
# Usage: scripts/ci/run_ios_checks.sh [--dry-run]   (--dry-run prints the commands instead of running them)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

PROJECT="iosApp/iosApp.xcodeproj"
DESTINATION="generic/platform=iOS Simulator"
# scheme:configuration pairs, one per CI matrix row
MATRIX=(
  "iosApp-Dev:Debug-Dev"
  "iosApp-Dev:Release-Dev"
  "iosApp-Prod:Debug-Prod"
  "iosApp-Prod:Release-Prod"
)
DRY_RUN="${1:-}"

run() {
  if [ "$DRY_RUN" = "--dry-run" ]; then
    printf '%q ' "$@"; printf '\n'
  else
    "$@"
  fi
}

for pair in "${MATRIX[@]}"; do
  scheme="${pair%%:*}"
  configuration="${pair##*:}"
  echo "== iOS ${scheme} ${configuration}"
  run xcodebuild -project "$PROJECT" -scheme "$scheme" -configuration "$configuration" \
    -sdk iphonesimulator -destination "$DESTINATION" CODE_SIGNING_ALLOWED=NO -quiet build
done

echo "== Kotlin/Native unit tests (iOS simulator)"
run ./gradlew iosSimulatorArm64Test -q

if command -v swiftlint >/dev/null 2>&1; then
  echo "== SwiftLint"
  run swiftlint lint --strict --config config/swiftlint.yml
else
  echo "SwiftLint not installed: skipped here; CI runs it."
fi
