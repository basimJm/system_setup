# system-setup: notes for AI agents

A generator that turns a business description into a ready-to-build multi-project system (documents, backlogs, code
skeletons, SDKs, deployment files, rules, lessons). Standard-library Python 3.9, no dependencies.

## Start here
1. Read `docs/ROADMAP.md` once: the goal, the design rules and the phase you are working on. Do not read `templates/` to get
   the picture; search, then read only the matched lines. `README.md` has the questions, tokens and template contract.
2. Work on a branch from `main` and open a pull request into `main`. Never commit or push to `main`, never force-push, never
   skip hooks or CI.
3. Tests with every change: `python3 -m unittest discover -s tests -p 'test_*.py'` must pass (about a minute).

## Rules that protect the project
- Nothing private may enter the repository: no secret, personal name, brand, absolute path, real e-mail, hosted URL or IP.
  `tests/test_no_private_data.py` enforces it with secret patterns and a hashed word list. Use `example.com`, `Acme Shop`,
  `com.acme.shop` and the `__TOKENS__`. Never print a secret; report file, line and type only.
- Never read, print or commit `.env` files with values. Only key names go in `.env.example`.
- Defaults for time zone, currency and country come from tokens, never from a real value.
- Add a font, image or skill only with its license, and list it in `THIRD_PARTY_NOTICES.md`.
- Lists are data (`catalog/*.json` once Phase 2 lands), generation is deterministic and uses no model. Never invent a business
  answer: a gap becomes a question, then an open point, then a `PENDING` backlog row.

## Reporting
Say plainly what was not done, not proven or not run. Do not write "passed" for a check that did not happen. Real-model and
real-build proof is reported as measured.
