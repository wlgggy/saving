# Y2K Savings Checklist Design

## Goal

Create a private, browser-based savings planner for a five-year plan (January 2026 through December 2030). The app should make it quick to record deposits, see the checked savings total, and review progress by month, year, or across the full plan.

## Scope and decisions

- The first release is a static, client-side application. It stores categories and check state in `localStorage`; no database or sign-in is included.
- The visual direction is Y2K: lavender, baby pink, aqua, glossy gradients, rounded bubble controls, and oversized financial figures.
- The initial plan includes two preloaded categories:
  - ISA: 500,000 KRW each month from January 2026 to December 2030.
  - Youth Future Savings (`청년미래적금`): 500,000 KRW each month from October 2026 to September 2029.
- A user can add, edit, or remove categories. A category has a required name; optional account number or product name; optional start and end months; a required per-deposit amount; and an optional target amount. If the period is empty, the category applies to the full 2026–2030 range.
- The per-deposit amount is counted when a scheduled month is checked. The target amount is informational progress data; it does not replace the check-based total.

## UI structure

1. **Header / dashboard**: Shows the plan period, total checked amount, scheduled total, and overall completion percentage.
2. **View switcher**: `이번 달`, `연도별`, and `전체` selects which scheduled months appear. The selected month/year is adjustable when the active view requires it.
3. **Savings schedule**: A responsive month grid lists active categories. Each row has a check control, category details, and the applicable deposit amount. Toggling a control immediately recalculates all summaries.
4. **Category manager**: An add/edit dialog provides the category fields and validates the required name and per-deposit amount. It includes an account/product input and optional date range.
5. **Progress details**: Each category's checked total and, when supplied, its target progress are visible in the category manager or schedule header.

## Data model

```text
Category
  id: string
  name: string                 // required
  accountOrProduct: string     // optional
  startMonth: YYYY-MM | null
  endMonth: YYYY-MM | null
  depositAmount: number        // KRW per checked scheduled month
  targetAmount: number | null

Check record
  categoryId:monthKey -> boolean
```

All values are persisted as one versioned local-storage payload. Invalid or unavailable stored data falls back to the initial two-category plan rather than preventing the app from loading.

## Data flow

On startup, the app reads persisted data or creates the initial plan. It builds the 60 plan months and filters each category into the selected view according to its period. The visible checked entries are then reduced into monthly, annual, category, and overall totals. Each mutation updates in-memory state, rerenders the relevant UI, and persists the new payload.

## Error handling and edge cases

- Amounts must be non-negative KRW numbers; the deposit amount must be greater than zero.
- Start month after end month is rejected with an inline form error.
- Category deletion also removes its related check records.
- Categories without a period show in every plan month.
- Empty filtered views display a helpful message and an add-category action.

## Testing and verification

- Unit-test schedule generation, period filtering, amount totals, and category validation if the chosen tooling supports tests.
- Manually verify the three view modes, toggling and persistence after reload, category CRUD, form validation, responsive layout, and keyboard-accessible controls.
- Run the production build and lint/type checks supplied by the selected starter.

## Deferred work

Cloud synchronization, user accounts, multi-device access, and an external database/API are deliberately deferred. The category/check payload boundary is intended to make that later replacement straightforward.
