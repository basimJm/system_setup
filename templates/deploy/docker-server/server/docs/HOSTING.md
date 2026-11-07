# Hosting: Docker on a server

__SYSTEM_NAME__ `__PART_DIR__` runs as the container the template already builds (`Dockerfile`, `docker-compose.deploy.yml`). Nothing is added to this folder for this host.

1. Install Docker and the Compose plugin on the server and copy this folder there (or build the image elsewhere and push it to a registry).
2. Write an environment file on the server from `docker/env.prod.example`, keeping it out of the repository. Keys: __ENV_KEYS__. Check it first with `npm run build && npm run env:check -- <file>`.
3. Start it: `ENV_FILE=<file> docker compose -f docker-compose.deploy.yml up -d --build` (add `--profile redis` when the server has no managed Redis).
4. Put a reverse proxy with HTTPS in front (the port is bound to 127.0.0.1 by default; `API_BIND` and `API_PORT` change it). Allow its origin in the other parts' `CORS_ALLOWED_ORIGINS`.
5. Health: `GET __PART_HEALTH__`. Roll back by starting the previous image tag (`IMAGE_TAG`).
