Task: write four sections of INTEGRATION.md, the map of how the parts of this system depend on each other. The tool keeps the other
sections of the template. Answer with Markdown containing ONLY these four level-2 sections, with exactly these headings:
{headings}
- 3: a table `| Edge | Contract | Mock on the client | State |`: one row per client module → its API namespace, per SDK → provider,
  with the draft contract file named in the input and state `planned`. Use the module ids and SDK ids of the plan.
- 4: how each actor of the domain authenticates (cite BUSINESS_DOMAIN §1 and §6), token and verification rules only as settings keys.
- 5: real-time rooms and events (BUSINESS_DOMAIN §7), notifications (§8) and channels, scheduled jobs (§9), storage, analytics: only what this business needs.
- 8: one bullet per PENDING row given in the input: the row id, what it blocks, the assumption in use.
Length: about 700 words in total.
