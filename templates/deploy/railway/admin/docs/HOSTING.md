# Hosting: Railway

`railway.json` in `__PART_DIR__` builds `Dockerfile` (the site served by nginx on Railway's `PORT`).

1. New project -> Deploy from GitHub repo `__REPO_NAME__`; set Root Directory to `__PART_DIR__`.
2. Variables tab: add the public values (never secrets): __ENV_KEYS__. The API is `__PROD_API_URL__`. Railway passes them to the Docker build as build arguments.
3. Generate a domain under Networking, then add that origin to the server's `CORS_ALLOWED_ORIGINS`. Roll back from the Deployments list.
4. Headers: nginx sets the basic ones. If the build wrote `__PART_OUTPUT__/_headers` (the admin panel does), add its Content-Security-Policy and HSTS lines to `nginx.conf.template` as `add_header`.
