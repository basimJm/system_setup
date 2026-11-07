# Deployment

Where this server runs is chosen in the plan (`system.plan.json`, `deployment`); the system's `docs/DEPLOYMENT.md` lists the choice. When a host is chosen, its configuration file and a short guide (`docs/HOSTING.md`) are written into this folder, and nothing for other hosts.

The server is one container image, built from the `Dockerfile` in this folder, and it needs MongoDB and Redis.

1. Build the image from this folder: `docker build -t __SYSTEM_SLUG__-server .`
2. Fill a copy of `docker/env.dev.example` (dev) or `docker/env.prod.example` (prod) in the secret store of wherever the server runs; check it first with `npm run build && npm run env:check -- <file>` (names only, never values).
3. Run the image with those variables. `docker-compose.deploy.yml` runs it on any Docker machine: `ENV_FILE=<file> docker compose -f docker-compose.deploy.yml up -d --build` (add `--profile redis` when there is no managed Redis).
4. First boot: `npm run seed` (indexes) and `npm run seed:admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` set once; dev environments may use `SEED_DEV_ON_START=true`.
5. Health: `GET /health` (process), `GET /ready` (MongoDB + Redis). Logs are JSON (pino) with `traceId`.

A plan that picks another database or cache does not change this: the data layer stays MongoDB and Redis until a backlog task changes it.
