# Architecture decision records

One file per decision: `NNNN-short-title.md` with Status, Context, Decision, Consequences. Decisions that are still open are listed in `docs/Admin_Tasks.md`, Appendix C; write the ADR in the task that needs the decision, before the code.

| ADR | Decision |
| --- | --- |
| [0001](0001-contract-source.md) | The server's OpenAPI is the API contract; zod DTOs are generated from it |
| [0002](0002-local-gate-no-ci.md) | No GitHub CI for the admin panel; a local gate protects `admin` |
| [0003](0003-money-and-time.md) | Money as money strings / integer minor units, time as UTC instants shown in Etc/GMT-3 |
| [0004](0004-form-library.md) | Forms use react-hook-form validated by zod; messages are i18n keys |
| [0005](0005-charts-svg.md) | Charts are hand-written SVG components with a View data table and CSV export |
| [0006](0006-rich-text.md) | Rich text is a Markdown-subset editor emitting sanitized HTML (no Tiptap) |
