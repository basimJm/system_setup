# ADR-0002 — Local gate instead of GitHub CI

- **Status:** accepted (owner decision)
- **Context:** No hosted CI is assumed for this repository, so no automated check can be relied on for a pull request.
- **Decision:** the gate is local and mandatory before every push: `npm run verify`, the four variant builds, `npm run check:size`, e2e, and a browser check against the PRD/BRD/task (`.claude/rules.md` §6, §8). Task PRs target the `admin` branch; the user runs `admin` on their device before merging it into `main`.
- **Consequences:** every rule must be expressible as a script or test (coverage floor, dependency-cruiser, lint limits, contract staleness). Re-enabling CI later only has to call the same npm scripts.
