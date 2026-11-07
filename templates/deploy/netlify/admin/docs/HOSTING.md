# Hosting: Netlify

`netlify.toml` in `__PART_DIR__` sets the build and the publish folder (`__PART_OUTPUT__`); previews and branch deploys use the dev build.

1. New site from Git, repository `__REPO_NAME__`, Base directory `__PART_DIR__`. Build command and publish folder come from `netlify.toml`.
2. Site settings -> Environment variables (the public values, never secrets): __ENV_KEYS__. The API is `__PROD_API_URL__`.
3. Single-page routing and headers come from `_redirects` and `_headers`, which the admin build writes (`node scripts/write-hosting.ts <variant>`); a web app without them needs `/* /index.html 200` in a `_redirects` file.
4. Add the site origin to the server's `CORS_ALLOWED_ORIGINS`. Roll back by publishing an earlier deploy.
