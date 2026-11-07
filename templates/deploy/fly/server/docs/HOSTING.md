# Hosting: Fly.io

`fly.toml` in `__PART_DIR__` builds the template's `Dockerfile` and checks `__PART_HEALTH__` on port __PART_PORT__.

1. Install `flyctl` and run `fly auth login`. In `__PART_DIR__`: `fly launch --no-deploy --copy-config` (it asks for the region and may rename the app).
2. Secrets are set by name, from your own env file, never written in the repository: `fly secrets set KEY=...` for each key: __ENV_KEYS__.
3. The server needs MongoDB and Redis reachable from Fly (`MONGODB_URI`, `REDIS_URL`); Fly's own Redis or an external service both work.
4. `fly deploy`. First boot: `fly ssh console`, then `npm run seed` and `npm run seed:admin` once.
5. Allow the other parts' origins in `CORS_ALLOWED_ORIGINS`. Roll back with `fly releases` and `fly deploy --image <previous image>`.
