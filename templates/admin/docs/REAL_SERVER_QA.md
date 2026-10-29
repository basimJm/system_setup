# Testing the admin panel against the real server

Everything but `dev-debug` (`npm run dev`) calls the real API, so the panel is tested against a real `__SERVER_DIR__` before any deployment. This runs the server on your machine: MongoDB (replica set), Redis and the server with its fake external providers (no e-mail, SMS or payment leaves the machine).

## One time

```bash
brew install mongodb-community redis        # mongod, mongosh, redis-server
cd __SERVER_DIR__ && npm ci && npm run build
```

## Every time

```bash
sh __ADMIN_DIR__/qa/stack.sh                          # databases, seeds, server on http://127.0.0.1:4000
cd __ADMIN_DIR__
node qa/seed.mjs                                      # a few items in every status (once)
VITE_API_BASE_URL=http://localhost:4000 VITE_SOCKET_URL=http://localhost:4000 npm run build:dev-release
npx vite preview --mode dev-release --outDir dist/dev-release --port 4173
```

Sign in at <http://localhost:4173> with the QA admin printed by `qa/stack.sh`. The sign-in code is e-mailed by the server; with the fake notifier it is only in Redis, so read it with:

```bash
node -e 'import("./qa/lib.mjs").then(async (m) => console.log(m.adminOtp()))'
```

## Contract check (every real answer against the generated schemas)

```bash
node qa/contract-check.mjs            # writes qa-contract.txt
```

Every line must be `OK`; `BAD` means the server answers differently from the OpenAPI the panel was generated from. Run `npm run api:sync` first: a stale contract hides new server fields and enum values.

## Realtime check and hosted wiring

```bash
node qa/socket-check.mjs                                   # local stack only: handshake refusals, then `item.updated`
QA_HOSTED=__DEV_API_URL__ QA_ORIGINS=http://localhost:4173 node qa/hosted-check.mjs
```

`hosted-check` sends no credentials (health, 401/404 envelopes, CORS preflight, `/admin` websocket handshake). Admin sign-ins are rate limited: sign in once and reuse the token with `QA_ADMIN_TOKEN=<token>` for the other scripts.

## Report

Write the pass into `docs/E2E_RESULTS.md` (template there): what was opened, what failed, what was fixed, what the server owner must fix.
