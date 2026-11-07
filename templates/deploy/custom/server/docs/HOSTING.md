# Hosting: not chosen yet (custom)

No host-specific file is written. The server is a container: use the template's `Dockerfile` here (and `docker-compose.deploy.yml` on a plain Docker host) on whatever platform runs containers. A PENDING task in the backlog asks for the real host to be chosen and set up.

1. Build the image from `__PART_DIR__`: `docker build -t __SERVICE_NAME__ .`
2. Give the container these environment keys through the platform's secret store: __ENV_KEYS__. Check a file first with `npm run build && npm run env:check -- <file>`.
3. The server needs MongoDB and Redis (`MONGODB_URI`, `REDIS_URL`). The container listens on `PORT` (default __PART_PORT__); the health check is `GET __PART_HEALTH__`.
4. First boot: `npm run seed` and `npm run seed:admin` once. Allow the other parts' origins in `CORS_ALLOWED_ORIGINS`.
