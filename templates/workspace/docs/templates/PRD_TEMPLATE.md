# <Project> — Product Requirements (PRD)

> Behaviour source of truth for this project. Agents read it by heading: keep ids stable (`S01`, `S02` … for screens; `F01` … for flows). A task row cites `PRD S07, F02`. Never renumber; add `S07a` instead.

## 0. Scope and principles
- Platforms, languages (default + RTL), themes, orientations, offline expectations.
- Out of scope for this phase (explicit list).

## 1. Navigation map
- Entry points, tabs, deep links, auth gates (which screens need a session).

## 2. Screens
### S01 — <Screen name>
- **Purpose:** one line.
- **Entry / exit:** from where, to where.
- **Content:** every element, with its data source (operation id or local state) and empty/loading/error state.
- **Actions:** each action → operation id → success behaviour → error codes handled (from `BUSINESS_DOMAIN.md` §11).
- **Rules:** validation, limits (named settings keys, no literal numbers), permissions shown/hidden.
- **Copy keys:** `screen.s01.title` … (AR + EN live in resources, not here).
- **Design reference:** `design/<file>` (visual only).

### S02 — …

## 3. Flows
### F01 — <Flow name>
Step list across screens with the state machine states involved and the real-time/push events that update it.

## 4. Cross-cutting behaviour
- Session expiry, token refresh, maintenance screen, version gate, analytics events per screen/action, accessibility.

## 5. Open questions (owner)
Numbered; each with the assumption implemented meanwhile.
