# Hosting: Vercel

`vercel.json` in `__PART_DIR__` sets the build, the output folder (`__PART_OUTPUT__`), single-page routing and the basic security headers.

1. Import the repository `__REPO_NAME__`, Root Directory `__PART_DIR__`, framework preset Other, Node 22.
2. Environment variables (the public values, never secrets): __ENV_KEYS__. The API is `__PROD_API_URL__`.
3. Vercel reads `vercel.json` from the project root only. If the build wrote a `vercel.json` into `__PART_OUTPUT__` (the admin panel does, with `--target vercel`), copy its Content-Security-Policy and HSTS entries into the `headers` of this file.
4. Add the site origin to the server's `CORS_ALLOWED_ORIGINS`. Roll back by promoting an earlier deployment.
