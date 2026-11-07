# Hosting: not chosen yet (custom)

The __PART_TITLE__ is a static site. `Dockerfile` and `nginx.conf.template` in `__PART_DIR__` build and serve it anywhere containers run; a PENDING task in the backlog asks for the real host to be chosen and set up.

1. `docker build -t __SERVICE_NAME__ .` with one `--build-arg KEY=...` for each public value (never secrets): __ENV_KEYS__. The API is `__PROD_API_URL__`.
2. Run the image behind HTTPS; it listens on `PORT` (default __PART_PORT__). Every unknown path already returns `index.html`.
3. If the build wrote `__PART_OUTPUT__/_headers` (the admin panel does), copy its Content-Security-Policy and HSTS lines to the platform or to `nginx.conf.template`.
4. Add the site origin to the server's `CORS_ALLOWED_ORIGINS`.
