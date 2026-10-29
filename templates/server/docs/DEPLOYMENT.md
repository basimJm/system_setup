# Deployment

1. Build the image from this folder: `docker build -t __SYSTEM_SLUG__-server .`
2. Fill a copy of `docker/env.dev.example` (dev) or `docker/env.prod.example` (prod) in the host's secret store; check it first with `npm run build && npm run env:check -- <file>` (names only, never values).
3. Run `docker compose -f docker-compose.deploy.yml up -d --build` with `ENV_FILE=<file>` (add `--profile redis` on hosts without managed Redis), or deploy the image to the platform of choice with the same variables.
4. First boot: `npm run seed` (indexes) and `npm run seed:admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` set once; dev hosts may use `SEED_DEV_ON_START=true`.
5. Health: `GET /health` (process), `GET /ready` (MongoDB + Redis). Logs are JSON (pino) with `traceId`.
