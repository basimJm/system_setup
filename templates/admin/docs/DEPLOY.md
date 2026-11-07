# Deploying the admin panel

The panel is a static site (`dist/<variant>/`). Wherever it runs it must serve the files, send the security headers and answer every path with `index.html`. `scripts/write-hosting.ts` writes the header and routing files from the same public values the build used, so the Content-Security-Policy always names the real API and socket origins.

Where the panel runs is chosen in the plan (`system.plan.json`, `deployment`); the system's `docs/DEPLOYMENT.md` lists the choice. When a host is chosen, its configuration file and a short guide (`docs/HOSTING.md`) are written into this folder, and nothing for other hosts. The server must allow the panel's origin in `CORS_ALLOWED_ORIGINS`.

## Public values (never secrets)

| Name | Where | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | build | API base URL, `https://…` (required for prod) |
| `VITE_SOCKET_URL` | build | Socket.IO origin, `https://…` (required for prod) |
| `VITE_DATA_SOURCE` | build | `remote` (default everywhere except dev-debug) or `mock` (dev-debug only) |
| `CSP_CONNECT_EXTRA` | build machine | comma list of extra `https://` origins the browser may call, e.g. a file-storage host the browser uploads to |

## Checks before the first prod deploy

- `npm run verify` and the four variant builds pass (`sh scripts/gate.sh`).
- Open the deployed site: the login page renders, the browser console shows no `Content Security Policy` errors, and `/about` shows the prod variant and the live API source.
- Headers: `curl -sI https://<domain>/ | grep -iE "content-security|strict-transport|x-content-type|x-frame"`.
- Rollback: redeploy the previous successful build (the guide for the chosen host says how).

## What the headers are

`scripts/lib/hosting.ts` is the single source (tested in `tests/hosting.test.ts`): CSP (self only, plus API, socket https+wss and the extras; no framing; fonts may be `data:` because the build inlines small fonts), HSTS (2 years), `nosniff`, `X-Frame-Options: DENY`, referrer, permissions and opener policies, immutable cache for `/assets/*`, no cache for `index.html`.
