# **SERVER_DIR**

Backend API of **SYSTEM_NAME** (**SYSTEM_NAME_AR**): the customer app, the merchant app and the admin panel (`__ADMIN_DIR__`) talk to it. Rules for agents: [`CLAUDE.md`](CLAUDE.md). Task list: [`docs/__SYSTEM_PREFIX___Server_Tasks.md`](docs/__SYSTEM_PREFIX___Server_Tasks.md). Repository: `github.com/__OWNER_GITHUB__/__REPO_NAME__`.

| Environment | API                |
| ----------- | ------------------ |
| dev         | `__DEV_API_URL__`  |
| prod        | `__PROD_API_URL__` |

## Scripts

| Command                                       | What it does                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` / `lint` / `format:check` | Static checks                                                                                                                |
| `npm test`                                    | Unit and integration tests (a local `redis-server` is started per suite that needs one, or set `REDIS_TEST_URL`)             |
| `npm run verify`                              | typecheck + lint + format + tests + build: the local gate before every push                                                  |
| `npm run build` / `npm start`                 | Compile to `dist/` / run the built server                                                                                    |
| `npm run docs`                                | Regenerate Swagger (`docs/api/openapi.*.json`) and Postman (`docs/api/postman/`). Required after every endpoint change (§11) |
| `npm run contract:bump -- <name> "<impact>"`  | Record a contract change (fingerprint + minor version + client impact); `tests/contractGuard.test.ts` enforces it            |
| `npm run seed` / `seed:admin` / `seed:dev`    | Indexes (+ reference data) / the first admin from `ADMIN_EMAIL` + `ADMIN_PASSWORD` / one-command development data            |
| `npm run env:check -- <file>`                 | Validate an env file exactly as the server does at startup (names only, never values)                                        |
| `npm run loadtest`                            | Drive the read endpoints of a running server (`LOADTEST_BASE_URL`, `LOADTEST_CUSTOMER_TOKEN`)                                |

## Local environment

```bash
cp docker/env.development.example .env.development   # application settings (fake providers)
cp docker/compose.env.example .env                   # values docker compose needs
docker compose up -d                                 # MongoDB (replica set) + Redis
npm ci && npm run build && npm run seed:dev && npm start
```

- Swagger UI is at `/docs` when `NODE_ENV` is not `production`.
- Local QA sign-in with the fake OTP provider: `OTP_FIXED_CODE=123456`, then `POST …/auth/otp/request {phone, purpose}`, `POST …/auth/otp/verify {phone, purpose, code}` and send the returned `otpToken` to login / register.
- `.env*` files are never committed; `.env.example` lists the keys.

## Architecture in one paragraph

Express 5 + Mongoose + Redis + Socket.IO + BullMQ, TypeScript strict. Three namespaces with separate token scopes (`/customer/v1`, `/merchant/v1`, `/admin/v1`), `Accept-Language: ar|en` on every request, one response envelope. Customers and merchant members sign in by phone OTP (server-generated codes, signed single-use `otpToken`, JWT access + rotating refresh tokens); admins by email + password + emailed code. Merchant members carry permissions the owner grants (`src/constants/enums.ts` `PERMISSIONS`); every admin write needs a reason and lands in the append-only audit log. Settings are a typed registry with Redis cache; uploads are presign → direct upload → confirm; notifications are stored in both languages and pushed in the recipient's language; real-time events go through Socket.IO rooms; recurring work runs on BullMQ. External services sit behind ports with in-repo fakes (`src/providers/README.md`): plug the `__NPM_SCOPE__/<sdk>` adapters into `src/providers/<name>/real.ts`.

## The sample feature: `items`

`src/domain/items` + `src/modules/shared/items` show the full path of one feature in the three namespaces: customers and merchant members manage their own items (merchant reads need `ITEMS_VIEW`, writes `ITEMS_MANAGE`), admins list everything and archive/restore with a reason (audit log + owner notification + socket event). Replace it with the first real feature of the product; keep its shape.

## Authentication

Access tokens are HS256 JWTs signed with `JWT_ACCESS_SECRET` (at least 32 characters). Each token is valid for one namespace only; a token of another namespace gets `403`. Protect a route with `requireAuth(scope, secret)`; merchant routes add `loadMember` (+ `requirePermission` / `requireOwner`).

## Real-time (Socket.IO)

One namespace per token scope: `/customer`, `/merchant`, `/admin` (path `/socket.io`). Connect with `io(baseUrl + '/customer', { auth: { token } })`. Rooms: `customer:{id}`, `member:{id}`, `tenant:{tenantId}`, `admin`. Events are emitted through `SocketHub` and reach every instance through the Redis adapter.

## Deployment

`docker build -t __SYSTEM_SLUG__-server .` (context = this folder), configuration by environment variables only: `docker/env.dev.example` and `docker/env.prod.example` list every key; check a filled copy with `npm run env:check -- <file>` before the first boot. Production refuses fake providers and a fixed OTP code. `docker-compose.deploy.yml` runs the API (and optionally Redis) on any Docker host.
