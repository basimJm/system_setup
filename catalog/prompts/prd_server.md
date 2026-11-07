Task: write the PRD of the SERVER (backend API) module: the behaviour every client module relies on. There are no screens.
- 1: one namespace per client module of the plan (path prefix `/<namespace>/v1`), who uses it and how they authenticate.
- 2: one `### C01 — <capability>` per capability (C01, C02 ... never skip a number). Under each, bullet lines with exactly these
  English labels: **Purpose**, **Operations** (`operationId`, method and path, request fields, response fields, error codes from
  BUSINESS_DOMAIN §11; lowerCamelCase verb+noun ids such as `postBookings`), **Rules** (cite BUSINESS_DOMAIN §N, settings keys, not
  literal numbers), **Events and jobs** (real-time events §7, notifications §8, jobs §9), **Satisfies** (BRD ids).
- 3: one `### F01 — <name>` per cross-capability flow (state transitions with who may trigger them, atomic steps, locks).
- 0: scope and principles (envelope `{success,message,data}`, money in minor units, UTC). 4: security, rate limits as settings
  keys, audit, idempotency. 5: open questions of the owner with the assumption in use.
- Cover what the client modules need (their audiences and the BRD requirements); nothing else.
