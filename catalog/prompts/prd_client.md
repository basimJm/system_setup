Task: write the PRD (product requirements) of ONE client module (app, web app or admin panel): the source of truth for its
behaviour. A developer builds screens from it; a task row cites `PRD S07, F02`.
- 2: one `### S01 — <name>` per screen (S01, S02 ...; never skip a number). Under each, bullet lines with exactly these English
  labels: **Purpose**, **Entry / exit**, **Content** (every element with its data source and its empty/loading/error state),
  **Actions** (each action → `operationId` → success behaviour → error codes from BUSINESS_DOMAIN §11), **Rules** (validation and
  limits as settings keys, permissions), **Satisfies** (BRD ids such as B01, B03).
  Operation ids are lowerCamelCase verb+noun (`postBookings`, `getSlots`); reuse one id for the same operation everywhere.
- 3: one `### F01 — <name>` per flow: numbered steps across screens, with the states of BUSINESS_DOMAIN §5.6 and the events
  of §7 that update it.
- 0: platforms, languages (default + direction), out of scope. 1: navigation map and auth gates. 4: session expiry, offline,
  analytics, accessibility. 5: open questions of the owner with the assumption in use.
- Cover every requirement of the BRD and every actor/entity of the domain that this module serves; nothing for other modules.
