# Security policy

## Reporting a vulnerability
Please do not open a public issue for a security problem. Use GitHub private vulnerability reporting:
open the **Security** tab of this repository, choose **Report a vulnerability**, and describe the problem, the affected
files or commands and, if you can, how to reproduce it. We will acknowledge the report, work on a fix in private and credit
you if you wish.

## What counts
- A generated system that contains a secret, a private name or an insecure default.
- The tool writing or reading outside the target folder, running unexpected commands, or asking for secret values.
- A secret, private name or personal data committed to this repository (also report it here, then rotate the secret).

## Supported versions
Only the latest commit on `main` is supported until the first release.

## Secrets
The tool never asks for secret values; only environment key names are recorded in `.env.example`. If you find a real secret in
this repository, treat it as exposed and rotate it.
