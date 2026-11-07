# Hosting: Fly.io

`fly.toml` in `__PART_DIR__` builds `Dockerfile` (the site served by nginx on port __PART_PORT__).

1. `fly auth login`, then in `__PART_DIR__`: `fly launch --no-deploy --copy-config`.
2. The public values (never secrets) are build arguments, not secrets: `fly deploy` with one `--build-arg KEY=...` for each: __ENV_KEYS__. The API is `__PROD_API_URL__`.
3. Add the site origin to the server's `CORS_ALLOWED_ORIGINS`. Roll back with `fly releases`.
4. Headers: nginx sets the basic ones. If the build wrote `__PART_OUTPUT__/_headers` (the admin panel does), add its Content-Security-Policy and HSTS lines to `nginx.conf.template` as `add_header`.
