# Hosting: Render

`render.yaml` in `__PART_DIR__` describes a static site: build `__PART_BUILD__`, publish `__PART_OUTPUT__`, and a rewrite of every path to `/index.html` (single-page routing).

1. Render reads `render.yaml` at the repository root. Copy it there (the `rootDir` line already points at `__PART_DIR__`), or point the Blueprint at this path if your Render account offers that setting.
2. New -> Blueprint -> repository `__REPO_NAME__`. Give the public values (never secrets): __ENV_KEYS__. The API is `__PROD_API_URL__`.
3. If Render reports that the publish folder is missing, prefix `staticPublishPath` with `__PART_DIR__/`.
4. Headers: Render does not read `_headers`. If the build wrote `__PART_OUTPUT__/_headers` (the admin panel does), add its Content-Security-Policy and HSTS lines under `headers:` in `render.yaml`.
5. Add the site origin to the server's `CORS_ALLOWED_ORIGINS`. Roll back by redeploying the previous deploy.
