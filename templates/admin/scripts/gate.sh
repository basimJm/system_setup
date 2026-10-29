#!/bin/sh
# Local gate for the admin panel (root rules §3.9 / admin rules §0): one line per step, the tail of the first failure.
# Usage: sh scripts/gate.sh        (e2e is run separately: npm run e2e)
cd "$(dirname "$0")/.." || exit 1
: "${VITE_API_BASE_URL:=https://api.example.com}"
: "${VITE_SOCKET_URL:=https://api.example.com}"
export VITE_API_BASE_URL VITE_SOCKET_URL

LOG="${TMPDIR:-/tmp}/admin-gate.log"

step() {
  name="$1"
  shift
  if "$@" >"$LOG" 2>&1; then
    printf 'PASS  %s\n' "$name"
  else
    printf 'FAIL  %s\n' "$name"
    tail -n 25 "$LOG"
    exit 1
  fi
}

step "typecheck, lint, format, tests+coverage, env, hardcoded, layers" npm run verify
step "build dev-debug" npm run build:dev-debug
step "build dev-release" npm run build:dev-release
step "build prod-debug" npm run build:prod-debug
step "build prod-release" npm run build:prod-release
step "check:size (4 variants)" npm run check:size -- dev-debug dev-release prod-debug prod-release

echo "GATE OK (run e2e once, alone: npm run e2e)"
