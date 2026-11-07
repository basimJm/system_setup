# syntax=docker/dockerfile:1
# __SYSTEM_NAME__ __PART_TITLE__ image. Build context is this folder: docker build -t __SERVICE_NAME__ .
# Public build values (never secrets) are build arguments, for example --build-arg VITE_API_BASE_URL=<api url>.

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
__EACH_ENV__
ARG __ENV_KEY__
__END_EACH__
RUN __PART_BUILD__

FROM nginx:1.27-alpine
# The official image fills ${PORT} in /etc/nginx/templates/*.template when the container starts.
ENV PORT=__PART_PORT__
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/__PART_OUTPUT__ /usr/share/nginx/html
EXPOSE __PART_PORT__
