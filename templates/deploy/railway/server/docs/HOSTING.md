# Hosting: Railway

`railway.json` in `__PART_DIR__` builds the template's `Dockerfile` and checks `__PART_HEALTH__`.

1. New project -> Deploy from GitHub repo `__REPO_NAME__`. In the service settings set Root Directory to `__PART_DIR__` (or the config file path to `/__PART_DIR__/railway.json` if the root stays at the top).
2. Variables tab: add one variable per key, values only there: __ENV_KEYS__. Railway sets `PORT`; the server reads it.
3. The server needs MongoDB and Redis (`MONGODB_URI`, `REDIS_URL`): add them as services of the project and reference their connection variables.
4. Generate a domain under Networking. First boot: `railway run npm run seed` and `npm run seed:admin` once.
5. Allow the other parts' origins in `CORS_ALLOWED_ORIGINS`. Roll back from the Deployments list.
