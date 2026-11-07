# Hosting: Docker on a server

The __PART_TITLE__ of __SYSTEM_NAME__ is a static site served by nginx in a container (`Dockerfile`, `nginx.conf.template`, `docker-compose.deploy.yml` in `__PART_DIR__`).

1. On the server, set the public build values in the shell (never secrets): __ENV_KEYS__. Use `__PROD_API_URL__` for the API.
2. `docker compose -f docker-compose.deploy.yml up -d --build` in `__PART_DIR__`. The site is on `127.0.0.1:__PART_PORT__` (`SITE_BIND`, `SITE_PORT` change it).
3. Put a reverse proxy with HTTPS in front, then add the site origin to the server's `CORS_ALLOWED_ORIGINS`.
4. Security headers: nginx sets the basic ones. If the build wrote `__PART_OUTPUT__/_headers` (the admin panel does), copy its Content-Security-Policy and HSTS lines into the proxy as `add_header`.
5. Roll back by starting the previous image tag (`IMAGE_TAG`).
