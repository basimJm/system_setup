# Hosting: Render

`render.yaml` in `__PART_DIR__` describes the service: a web service on the Node runtime, health check `__PART_HEALTH__`, and the environment key names (no values).

1. Render reads `render.yaml` at the repository root. Copy it there (the `rootDir` line already points at `__PART_DIR__`), or point the Blueprint at this path if your Render account offers that setting.
2. New -> Blueprint -> repository `__REPO_NAME__`. Render asks for a value for each key (`sync: false`): __ENV_KEYS__. Set `NODE_ENV` to `production`.
3. The server needs MongoDB and Redis: create or connect them (their connection strings are `MONGODB_URI` and `REDIS_URL`), then check the file with `npm run env:check`.
4. First boot: run `npm run seed` and `npm run seed:admin` once from a Render shell. Health: `GET __PART_HEALTH__`.
5. Allow the origins of the other parts in `CORS_ALLOWED_ORIGINS`. Roll back by redeploying the previous deploy.
