Task: write BUSINESS_DOMAIN.md, the single source for the data and the rules every project of this system must agree on. All other
documents cite its section numbers.
- Sub-sections: 3.1 Identity & sessions, 3.2 Reference data, 3.3 Core aggregates, 3.4 Operations (audit log, notifications, jobs);
  5.0 Rules given by the owner (number them R1, R2 ... as in the plan), 5.1 Time, 5.2 Completeness → visibility state, 5.3
  Availability, 5.4 Pricing & amounts, 5.5 Atomic creation, 5.6 State machine, 5.7 Cancellation & refunds, 5.8 Account deletion.
  Keep a sub-section only when this business has the matter; otherwise write `Not applicable: <reason from the document>`.
- 1: a table `| Actor | Namespace / scope | Identity | Owns |`. 2: one enum per entity of the plan, its states in the plan's order.
  3: per collection the fields (name: type, required, default), indexes and status meaning. 5: numbered, testable rules
  (`§5.N`). 6: permissions matrix (keys x operations), 7: real-time events, 8: notifications (event → recipient → channel),
  9: scheduled jobs (job → trigger → effect → idempotency), from the plan's jobs.
- 10: table `| Key | Type | Default | Read by |`. Every limit, window, percentage and length is a settings key, never a literal in
  code. Include these base rows: locale.defaultLanguage, locale.rtl, money.currency, money.minorUnit, time.storedZone, time.businessZone.
- 11: ONLY the error codes this business adds, as a table `| Code | Status | When | Client behaviour |` (UPPER_SNAKE codes). The
  base codes are added by the tool; do not repeat them. If there is none, write one line saying so.
- 12: one numbered entry per plan open question: `OP-<n> (<question id>)`, the question, and the assumption in use. A question that
  has an answer is a decided fact: put it in the section it belongs to and do not list it here.
- 13: one entry per SDK of the plan: capability, provider, source, and `fake adapter until live`.
