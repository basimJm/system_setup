# __SYSTEM_NAME__ — Business Requirements Document (Admin Panel)

## 1. Executive summary
The admin panel gives the __SYSTEM_NAME__ team visibility and control over the platform's data with a full audit trail. Behaviour details live in `docs/Admin_PRD.md`.

## 2. Business background and problem
Describe the business, who operates it, and what the operators cannot do today without a panel.

## 3. Business objectives
| ID | Objective | Measure |
|---|---|---|
| BO-01 | Every admin action is traceable (who, what, why, when, from where) | 100 % of writes in the audit log with a reason |
| BO-02 | Operators work in Arabic or English on any device | AR + EN, RTL + LTR, phone to desktop |
| BO-03 | The panel never shows stale or partial data silently | loading / empty / error states everywhere |

## 4. Scope
### 4.1 In scope
Sign-in with a second factor, the items module (reference), settings, audit log.
### 4.2 Out of scope
Public pages, end-user apps, billing. Add product-specific exclusions here.

## 5. Stakeholders
| Role | Interest |
|---|---|
| Product owner | decides scope and priorities |
| Operations | daily users of the panel |
| Engineering | server contract (`__SERVER_DIR__`) and this panel |

## 6. Business requirements
| ID | Requirement | PRD |
|---|---|---|
| BR-01 | Two-step sign-in, sessions end after inactivity | P00 |
| BR-02 | Moderate items: list, search, filter, archive and restore with a reason | P01, P02 |
| BR-03 | Platform settings are editable in one place, audited | P05 |
| BR-04 | Every action is visible in the audit log | P06 |

## 7. Business rules
1. No write without a reason. 2. Records are never deleted from the panel: they change status. 3. Server messages are shown as sent; the client branches on error codes only.

## 8. KPIs the panel must surface
Add the numbers the operators need on day one (counts per status, archived items, …).

## 9. Assumptions, constraints and dependencies
The server exposes `/admin/v1` as described by its OpenAPI; the panel is deployed as a static site with the headers from `scripts/lib/hosting.ts`.

## 10. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Contract drift | `npm run api:check` and `tests/contract.test.ts` fail on a stale snapshot |
| Untranslated text | `tests/i18n.test.ts` fails on any missing key |

## 11. Open items
Record open business questions with an owner.
