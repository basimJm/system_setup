# __SYSTEM_NAME__ memory (loaded every session: keep short; details in `docs/knowledge/facts.md`)

- Monorepo `github.com/__OWNER_GITHUB__/__REPO_NAME__`. Masters: `main` and __MASTERS_LIST__.
- The sandbox cannot write `.claude/hooks`, `.claude/settings.json` or `.git/config`, and has no network or local ports: `gh`, `git fetch/push`, builds and anything on localhost run through the Terminal panel.
- Token cost matters: small contexts, one task per session, no re-reading. Numbers: `python3 scripts/usage.py`.
