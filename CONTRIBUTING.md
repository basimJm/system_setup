# Contributing

Thank you for helping. This project generates multi-project systems from a business description, so changes are judged by
one question: does the generated system stay correct, neutral and easy to change?

## Ground rules
- Read `docs/ROADMAP.md` first: it holds the goal, the design rules and the phase each change belongs to.
- No direct pushes to `main`. Fork the repository (or create a branch if you have write access) and open a pull request into `main`.
- One branch and one pull request per change. Keep it small and describe what it does and what it does not do.
- Tests are required with every change. Run them before you push:
  `python3 -m unittest discover -s tests -p 'test_*.py'`
- The engine is standard-library Python 3.9 with no dependencies. Models are used only behind the `Analyzer` seam, and tests
  use a fake analyzer.
- Lists (modules, SDKs, providers, rules) are data, not code. Adding a choice should not need a code change.
- Never ask for, record or commit secret values. Environment key names only, in `.env.example`.

## Keep the repository free of private data
`tests/test_no_private_data.py` fails on secret shapes, on words from the hashed deny list `tests/fixtures/private_words.sha256`,
on absolute user paths, real-looking e-mail addresses, hosted URLs and public IP addresses, in file contents and file names.
Use neutral values: `example.com`, `Acme Shop`, `com.acme.shop`, `TEAMID0000`, the `__TOKENS__` described in `README.md`.
To add a word to the deny list without publishing it: `python3 tests/test_no_private_data.py --hash WORD` and append the line.

## Third-party material
Add a font, image, skill or any copied file only with its license, and list it in `THIRD_PARTY_NOTICES.md`.
If you cannot establish the license, do not add it.

## Pull request checklist
The pull request template asks for the same things: what changed, the tests you ran, anything you did not do, and a
confirmation that no private data, secret or unlicensed material is included. A maintainer merges after the `tests` check passes.

By contributing you agree that your contribution is licensed under the MIT license of this repository.
