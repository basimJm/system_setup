# Hosting: Cloudflare Pages

`wrangler.toml` in `__PART_DIR__` names the project and the folder to publish (`__PART_OUTPUT__`). Pages reads the `_headers` and `_redirects` files the admin build writes (`node scripts/write-hosting.ts <variant> --target cloudflare`); a web app without them needs its own `_redirects` line `/* /index.html 200`.

**With Git:** Workers & Pages -> Create -> Pages -> repository `__REPO_NAME__`. Root directory `__PART_DIR__`; build command `__PART_BUILD__ --target cloudflare` for the admin panel (otherwise `__PART_BUILD__`); output `__PART_OUTPUT__`; Node 22.
Variables (plain text, never secrets): __ENV_KEYS__. The API is `__PROD_API_URL__`.

**Without Git:**

```bash
cd __PART_DIR__
__PART_BUILD__
npx wrangler login
npx wrangler pages deploy
```

Then add the site origin to the server's `CORS_ALLOWED_ORIGINS`. Roll back by promoting an earlier deployment in the Pages dashboard.
