# Hosting: AWS (S3 and CloudFront)

The __PART_TITLE__ is a static site. No config file is written: this is done once in the AWS console or CLI.

1. Build in `__PART_DIR__` with the public values (never secrets) set: __ENV_KEYS__ (the API is `__PROD_API_URL__`). `__PART_BUILD__` writes `__PART_OUTPUT__/`.
2. Create a private S3 bucket and a CloudFront distribution that reads it through origin access control; default root object `index.html`.
3. Single-page routing: add custom error responses for 403 and 404 that return `/index.html` with status 200.
4. Headers: attach a response headers policy. If the build wrote `__PART_OUTPUT__/_headers` (the admin panel does), copy its Content-Security-Policy and HSTS lines into the policy.
5. Publish: `aws s3 sync __PART_OUTPUT__ s3://<bucket> --delete`, then `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"`.
6. Add the site origin to the server's `CORS_ALLOWED_ORIGINS`. Roll back by syncing the previous build.
