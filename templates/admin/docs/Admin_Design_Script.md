# __SYSTEM_NAME__ — Admin Panel Design Script

## 0. Instructions to the designer
Design every page in Arabic (RTL) first and English (LTR) second, light and dark, at 375 / 768 / 1440 px. Use the tokens of `src/design/tokens/` (colors, spacing, radii, type scale); the dev-only gallery (`/design-system` in dev builds) shows every component and state that already exists.

## 1. Global layout and components
### 1.1 App shell
Sidebar with the brand mark, one row per module (icon + label + optional counter), collapse button; top bar with language, theme and the admin menu; content area with breadcrumbs.
### 1.2 Components
Buttons, badges (six tones), fields (text, number, date, select, combobox, multi-select, money, search), data table (sort, column picker, density, selection, row actions), pagination, filter bar with chips, date range picker, export menu, drawers, dialogs (confirm, reason), toasts, charts (line, bar, donut, funnel, heatmap, sparkline), timeline, JSON viewer, key-value list, section card, KPI card.

## 2. Pages and states
| Page | Frame | States to draw |
|---|---|---|
| P00 Login | credentials, code | errors, resend countdown |
| P01 Items | list | loading, empty, error, filters active, reason dialog open |
| P02 Item details | overview, history | loading, not found, reason dialog |
| P05 Settings | tabs | changed value, validation error, reason dialog |
| P06 Audit log | list, record dialog | diff present / absent |

## 3. Flows to prototype
Sign-in → items → archive an item with a reason → see it in the audit log → restore it.

## 4. Completion checklist
AR + EN, RTL + LTR, light + dark, three widths, every state of §2, focus-visible on every control.
